use super::audio::{AudioEngine, SAMPLE_RATE};
use livekit::e2ee::key_provider::{KeyDerivationAlgorithm, KeyProvider, KeyProviderOptions};
use livekit::e2ee::{E2eeOptions, EncryptionType};
use livekit::options::{AudioEncoding, TrackPublishOptions};
use livekit::prelude::*;
use livekit::webrtc::audio_source::native::NativeAudioSource;
use livekit::webrtc::audio_source::{AudioSourceOptions, RtcAudioSource};
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

const KEYRING_SIZE: i32 = 16;
const KEY_SWITCH_GRACE: Duration = Duration::from_millis(800);
const MICROPHONE_BITRATE: u64 = 64_000;

pub const STATE_EVENT: &str = "voice://state";
pub const PARTICIPANT_EVENT: &str = "voice://participant";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StateEvent {
    pub generation: u64,
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cause: Option<&'static str>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantEvent {
    pub generation: u64,
    pub identity: String,
    pub kind: &'static str,
}

pub struct Session {
    room: Arc<Room>,
    key_provider: KeyProvider,
    microphone: LocalAudioTrack,
    audio: Arc<AudioEngine>,
    events_task: JoinHandle<()>,
    key_switch: Option<JoinHandle<()>>,
}

pub fn key_index(version: u32) -> i32 {
    (version % KEYRING_SIZE as u32) as i32
}

fn key_provider(key: Vec<u8>, version: u32) -> KeyProvider {
    let provider = KeyProvider::with_shared_key(
        KeyProviderOptions {
            ratchet_window_size: 0,
            failure_tolerance: -1,
            key_ring_size: KEYRING_SIZE,
            key_derivation_algorithm: KeyDerivationAlgorithm::HKDF,
            ..Default::default()
        },
        key.clone(),
    );
    provider.set_shared_key(key, key_index(version));
    provider
}

fn apply_key_index(room: &Room, index: i32) {
    for (_, cryptor) in room.e2ee_manager().frame_cryptors() {
        cryptor.set_key_index(index);
    }
}

fn cause_of(reason: livekit::DisconnectReason) -> &'static str {
    use livekit::DisconnectReason as Reason;
    match reason {
        Reason::ClientInitiated => "client",
        Reason::DuplicateIdentity => "duplicate",
        Reason::ParticipantRemoved
        | Reason::RoomDeleted
        | Reason::RoomClosed
        | Reason::UserRejected => "removed",
        _ => "network",
    }
}

fn emit_state(app: &AppHandle, generation: u64, kind: &'static str, cause: Option<&'static str>) {
    let _ = app.emit(STATE_EVENT, StateEvent { generation, kind, cause });
}

fn emit_participant(app: &AppHandle, generation: u64, identity: String, kind: &'static str) {
    let _ = app.emit(PARTICIPANT_EVENT, ParticipantEvent { generation, identity, kind });
}

async fn pump_events(
    app: AppHandle,
    generation: u64,
    audio: Arc<AudioEngine>,
    mut events: mpsc::UnboundedReceiver<RoomEvent>,
) {
    while let Some(event) = events.recv().await {
        match event {
            RoomEvent::ConnectionStateChanged(ConnectionState::Reconnecting) => {
                emit_state(&app, generation, "reconnecting", None);
            }
            RoomEvent::ConnectionStateChanged(ConnectionState::Connected) => {
                emit_state(&app, generation, "connected", None);
            }
            RoomEvent::TrackSubscribed { track: RemoteTrack::Audio(track), participant, .. } => {
                let identity = participant.identity().to_string();
                audio.add_participant(identity.clone(), track.rtc_track(), 1.0);
                emit_participant(&app, generation, identity, "subscribed");
            }
            RoomEvent::TrackUnsubscribed { track: RemoteTrack::Audio(_), participant, .. } => {
                let identity = participant.identity().to_string();
                audio.remove_participant(&identity);
                emit_participant(&app, generation, identity, "unsubscribed");
            }
            RoomEvent::Disconnected { reason } => {
                let engine = audio.clone();
                let _ = tauri::async_runtime::spawn_blocking(move || engine.stop()).await;
                emit_state(&app, generation, "disconnected", Some(cause_of(reason)));
                break;
            }
            _ => {}
        }
    }
}

fn microphone_source() -> NativeAudioSource {
    NativeAudioSource::new(
        AudioSourceOptions {
            echo_cancellation: true,
            noise_suppression: true,
            auto_gain_control: true,
        },
        SAMPLE_RATE,
        1,
        0,
    )
}

impl Session {
    pub async fn connect(
        app: AppHandle,
        generation: u64,
        url: &str,
        token: &str,
        key: Vec<u8>,
        version: u32,
        microphone_enabled: bool,
    ) -> Result<Session, String> {
        let key_provider = key_provider(key, version);
        let mut options = RoomOptions::default();
        options.encryption = Some(E2eeOptions {
            encryption_type: EncryptionType::Gcm,
            key_provider: key_provider.clone(),
        });
        let (room, events) = Room::connect(url, token, options).await.map_err(|e| e.to_string())?;
        let room = Arc::new(room);

        let source = microphone_source();
        let audio = match AudioEngine::start(source.clone()) {
            Ok(engine) => Arc::new(engine),
            Err(error) => {
                let _ = room.close().await;
                return Err(error);
            }
        };
        let microphone =
            LocalAudioTrack::create_audio_track("microphone", RtcAudioSource::Native(source));
        if !microphone_enabled {
            microphone.mute();
        }
        let publish = room
            .local_participant()
            .publish_track(
                LocalTrack::Audio(microphone.clone()),
                TrackPublishOptions {
                    source: TrackSource::Microphone,
                    audio_encoding: Some(AudioEncoding { max_bitrate: MICROPHONE_BITRATE }),
                    dtx: false,
                    red: true,
                    ..Default::default()
                },
            )
            .await;
        if let Err(error) = publish {
            let _ = room.close().await;
            return Err(error.to_string());
        }
        apply_key_index(&room, key_index(version));

        let events_task =
            tauri::async_runtime::spawn(pump_events(app, generation, audio.clone(), events));
        Ok(Session { room, key_provider, microphone, audio, events_task, key_switch: None })
    }

    pub fn encrypted(&self) -> bool {
        self.room.e2ee_manager().enabled()
    }

    pub fn set_microphone_enabled(&self, enabled: bool) {
        if enabled {
            self.microphone.unmute();
        } else {
            self.microphone.mute();
        }
    }

    pub fn set_deafened(&self, deafened: bool) {
        self.audio.set_deafened(deafened);
    }

    pub fn set_volume(&self, identity: &str, volume: f32) {
        self.audio.set_volume(identity, volume);
    }

    pub fn rotate_key(&mut self, key: Vec<u8>, version: u32) {
        let index = key_index(version);
        self.key_provider.set_shared_key(key, index);
        if let Some(pending) = self.key_switch.take() {
            pending.abort();
        }
        let room = self.room.clone();
        self.key_switch = Some(tauri::async_runtime::spawn(async move {
            tokio::time::sleep(KEY_SWITCH_GRACE).await;
            apply_key_index(&room, index);
        }));
    }

    pub async fn close(self) {
        if let Some(pending) = self.key_switch {
            pending.abort();
        }
        self.events_task.abort();
        let _ = self.room.close().await;
        let audio = self.audio;
        let _ = tauri::async_runtime::spawn_blocking(move || drop(audio)).await;
    }
}
