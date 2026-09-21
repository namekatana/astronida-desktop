use super::audio::{AudioEngine, SAMPLE_RATE};
use super::stats::{self, Stats};
use livekit::e2ee::key_provider::{KeyDerivationAlgorithm, KeyProvider, KeyProviderOptions};
use livekit::e2ee::{E2eeOptions, EncryptionType};
use livekit::options::{AudioEncoding, TrackPublishOptions};
use livekit::prelude::*;
use livekit::webrtc::audio_source::native::NativeAudioSource;
use livekit::webrtc::audio_source::{AudioSourceOptions, RtcAudioSource};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

const KEYRING_SIZE: i32 = 16;
const KEY_SWITCH_GRACE: Duration = Duration::from_millis(800);
const MICROPHONE_BITRATE: u64 = 64_000;
const SPEAKING_POLL: Duration = Duration::from_millis(40);
const STATS_INTERVAL: Duration = Duration::from_secs(2);
const STATS_FIRST_DELAY: Duration = Duration::from_millis(300);
const STATS_MIN_GAP: Duration = Duration::from_millis(500);
const STATS_GATE_CAPACITY: usize = 256;

pub const STATE_EVENT: &str = "voice://state";
pub const PARTICIPANT_EVENT: &str = "voice://participant";
pub const SPEAKING_EVENT: &str = "voice://speaking";
pub const QUALITY_EVENT: &str = "voice://quality";
pub const STATS_EVENT: &str = "voice://stats";

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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeakingEvent {
    pub generation: u64,
    pub identities: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QualityEvent {
    pub generation: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<String>,
    pub quality: &'static str,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatsEvent {
    pub generation: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<String>,
    #[serde(flatten)]
    pub stats: Stats,
}

#[derive(Default)]
struct Background(Mutex<Vec<JoinHandle<()>>>);

impl Background {
    fn keep(&self, task: JoinHandle<()>) {
        self.0.lock().unwrap().push(task);
    }

    fn abort_all(&self) {
        for task in self.0.lock().unwrap().drain(..) {
            task.abort();
        }
    }
}

pub struct Session {
    room: Arc<Room>,
    key_provider: KeyProvider,
    key_index: Arc<AtomicI32>,
    microphone: Option<LocalAudioTrack>,
    audio: Arc<AudioEngine>,
    events_task: JoinHandle<()>,
    background: Arc<Background>,
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

fn quality_of(quality: ConnectionQuality) -> &'static str {
    match quality {
        ConnectionQuality::Excellent => "excellent",
        ConnectionQuality::Good => "good",
        ConnectionQuality::Poor => "poor",
        ConnectionQuality::Lost => "lost",
    }
}

fn emit_state(app: &AppHandle, generation: u64, kind: &'static str, cause: Option<&'static str>) {
    let _ = app.emit(STATE_EVENT, StateEvent { generation, kind, cause });
}

fn emit_participant(app: &AppHandle, generation: u64, identity: String, kind: &'static str) {
    let _ = app.emit(PARTICIPANT_EVENT, ParticipantEvent { generation, identity, kind });
}

fn emit_quality(app: &AppHandle, generation: u64, identity: Option<String>, quality: &'static str) {
    let _ = app.emit(QUALITY_EVENT, QualityEvent { generation, identity, quality });
}

fn emit_stats(app: &AppHandle, generation: u64, identity: Option<String>, stats: Stats) {
    let _ = app.emit(STATS_EVENT, StatsEvent { generation, identity, stats });
}

struct StatsGate(HashMap<String, Instant>);

impl StatsGate {
    fn accept(&mut self, identity: &str) -> bool {
        let now = Instant::now();
        if let Some(last) = self.0.get_mut(identity) {
            if now.duration_since(*last) < STATS_MIN_GAP {
                return false;
            }
            *last = now;
            return true;
        }
        if self.0.len() >= STATS_GATE_CAPACITY {
            return false;
        }
        self.0.insert(identity.to_string(), now);
        true
    }

    fn forget(&mut self, identity: &str) {
        self.0.remove(identity);
    }
}

#[derive(Default)]
struct LastStats(Mutex<Option<Stats>>);

impl LastStats {
    fn set(&self, stats: Stats) {
        *self.0.lock().unwrap() = Some(stats);
    }

    fn get(&self) -> Option<Stats> {
        *self.0.lock().unwrap()
    }
}

async fn publish_stats(room: &Room, stats: Stats) {
    let _ = room
        .local_participant()
        .publish_data(DataPacket {
            payload: stats::encode(stats),
            topic: Some(stats::TOPIC.to_string()),
            reliable: false,
            ..Default::default()
        })
        .await;
}

async fn pump_events(
    app: AppHandle,
    generation: u64,
    room: Arc<Room>,
    key_index: Arc<AtomicI32>,
    audio: Arc<AudioEngine>,
    background: Arc<Background>,
    last_stats: Arc<LastStats>,
    mut events: mpsc::UnboundedReceiver<RoomEvent>,
) {
    let mut gate = StatsGate(HashMap::new());
    while let Some(event) = events.recv().await {
        match event {
            RoomEvent::ConnectionStateChanged(ConnectionState::Reconnecting) => {
                emit_state(&app, generation, "reconnecting", None);
            }
            RoomEvent::ConnectionStateChanged(ConnectionState::Connected) => {
                apply_key_index(&room, key_index.load(Ordering::Relaxed));
                emit_state(&app, generation, "connected", None);
            }
            RoomEvent::TrackSubscribed { track: RemoteTrack::Audio(track), participant, .. } => {
                let identity = participant.identity().to_string();
                audio.add_participant(identity.clone(), track.rtc_track());
                emit_participant(&app, generation, identity, "subscribed");
            }
            RoomEvent::TrackUnsubscribed { track: RemoteTrack::Audio(_), participant, .. } => {
                let identity = participant.identity().to_string();
                audio.remove_participant(&identity);
                emit_participant(&app, generation, identity, "unsubscribed");
            }
            RoomEvent::ParticipantConnected(_) => {
                if let Some(stats) = last_stats.get() {
                    let room = room.clone();
                    tauri::async_runtime::spawn(async move { publish_stats(&room, stats).await });
                }
            }
            RoomEvent::ParticipantDisconnected(participant) => {
                let identity = participant.identity().to_string();
                gate.forget(&identity);
                emit_participant(&app, generation, identity, "left");
            }
            RoomEvent::ConnectionQualityChanged { quality, participant } => {
                let identity = match participant {
                    Participant::Local(_) => None,
                    Participant::Remote(remote) => Some(remote.identity().to_string()),
                };
                emit_quality(&app, generation, identity, quality_of(quality));
            }
            RoomEvent::DataReceived { payload, topic: Some(topic), participant: Some(sender), .. }
                if topic == stats::TOPIC =>
            {
                let identity = sender.identity().to_string();
                if gate.accept(&identity) {
                    let stats = stats::decode(&payload).unwrap_or_default();
                    emit_stats(&app, generation, Some(identity), stats);
                }
            }
            RoomEvent::Disconnected { reason } => {
                background.abort_all();
                let engine = audio.clone();
                let _ = tauri::async_runtime::spawn_blocking(move || engine.stop()).await;
                emit_state(&app, generation, "disconnected", Some(cause_of(reason)));
                break;
            }
            _ => {}
        }
    }
}

async fn poll_speaking(
    app: AppHandle,
    generation: u64,
    audio: Arc<AudioEngine>,
    microphone: Option<LocalAudioTrack>,
    local_identity: String,
) {
    let mut ticker = tokio::time::interval(SPEAKING_POLL);
    let mut previous: Vec<String> = Vec::new();
    let mut current: Vec<String> = Vec::new();
    loop {
        ticker.tick().await;
        let microphone_live = microphone.as_ref().is_some_and(|track| !track.is_muted());
        if !microphone_live && !audio.has_participants() {
            if !previous.is_empty() {
                previous.clear();
                let _ = app.emit(SPEAKING_EVENT, SpeakingEvent { generation, identities: Vec::new() });
            }
            continue;
        }
        current.clear();
        audio.remote_speaking(&mut current);
        if microphone_live && audio.local_speaking() {
            current.push(local_identity.clone());
        }
        current.sort_unstable();
        if current != previous {
            previous.clone_from(&current);
            let _ = app.emit(SPEAKING_EVENT, SpeakingEvent { generation, identities: current.clone() });
        }
    }
}

async fn poll_stats(app: AppHandle, generation: u64, room: Arc<Room>, last_stats: Arc<LastStats>) {
    let first = tokio::time::Instant::now() + STATS_FIRST_DELAY;
    let mut ticker = tokio::time::interval_at(first, STATS_INTERVAL);
    loop {
        ticker.tick().await;
        let Ok(report) = room.get_stats().await else {
            continue;
        };
        let stats = stats::measure(&report.publisher_stats);
        last_stats.set(stats);
        emit_stats(&app, generation, None, stats);
        if !room.remote_participants().is_empty() {
            publish_stats(&room, stats).await;
        }
    }
}

async fn publish_microphone(
    room: &Room,
    source: NativeAudioSource,
    enabled: bool,
) -> Result<LocalAudioTrack, String> {
    let track = LocalAudioTrack::create_audio_track("microphone", RtcAudioSource::Native(source));
    if !enabled {
        track.mute();
    }
    room.local_participant()
        .publish_track(
            LocalTrack::Audio(track.clone()),
            TrackPublishOptions {
                source: TrackSource::Microphone,
                audio_encoding: Some(AudioEncoding { max_bitrate: MICROPHONE_BITRATE }),
                dtx: false,
                red: true,
                ..Default::default()
            },
        )
        .await
        .map_err(|error| error.to_string())?;
    Ok(track)
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
        let microphone = if audio.captures() {
            match publish_microphone(&room, source, microphone_enabled).await {
                Ok(track) => Some(track),
                Err(error) => {
                    let _ = room.close().await;
                    return Err(error);
                }
            }
        } else {
            None
        };
        let key_index = Arc::new(AtomicI32::new(key_index(version)));
        apply_key_index(&room, key_index.load(Ordering::Relaxed));

        let background = Arc::new(Background::default());
        let last_stats = Arc::new(LastStats::default());
        background.keep(tauri::async_runtime::spawn(poll_speaking(
            app.clone(),
            generation,
            audio.clone(),
            microphone.clone(),
            room.local_participant().identity().to_string(),
        )));
        background.keep(tauri::async_runtime::spawn(poll_stats(
            app.clone(),
            generation,
            room.clone(),
            last_stats.clone(),
        )));
        let events_task = tauri::async_runtime::spawn(pump_events(
            app,
            generation,
            room.clone(),
            key_index.clone(),
            audio.clone(),
            background.clone(),
            last_stats,
            events,
        ));
        Ok(Session {
            room,
            key_provider,
            key_index,
            microphone,
            audio,
            events_task,
            background,
            key_switch: None,
        })
    }

    pub fn encrypted(&self) -> bool {
        self.room.e2ee_manager().enabled()
    }

    pub fn participants(&self) -> Vec<String> {
        self.audio.participants()
    }

    pub fn set_microphone_enabled(&self, enabled: bool) {
        let Some(microphone) = &self.microphone else {
            return;
        };
        if enabled {
            microphone.unmute();
        } else {
            microphone.mute();
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
        let current = self.key_index.clone();
        self.key_switch = Some(tauri::async_runtime::spawn(async move {
            tokio::time::sleep(KEY_SWITCH_GRACE).await;
            current.store(index, Ordering::Relaxed);
            apply_key_index(&room, index);
        }));
    }

    pub async fn close(self) {
        if let Some(pending) = self.key_switch {
            pending.abort();
        }
        self.background.abort_all();
        self.events_task.abort();
        let _ = self.room.close().await;
        let audio = self.audio;
        let _ = tauri::async_runtime::spawn_blocking(move || drop(audio)).await;
    }
}
