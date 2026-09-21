use livekit::e2ee::key_provider::{KeyDerivationAlgorithm, KeyProvider, KeyProviderOptions};
use livekit::e2ee::{E2eeOptions, EncryptionType};
use livekit::prelude::*;
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

const KEYRING_SIZE: i32 = 16;
const KEY_SWITCH_GRACE: Duration = Duration::from_millis(800);

pub const STATE_EVENT: &str = "voice://state";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StateEvent {
    pub generation: u64,
    pub kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cause: Option<&'static str>,
}

pub struct Session {
    room: Arc<Room>,
    key_provider: KeyProvider,
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

async fn pump_events(
    app: AppHandle,
    generation: u64,
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
            RoomEvent::Disconnected { reason } => {
                emit_state(&app, generation, "disconnected", Some(cause_of(reason)));
                break;
            }
            _ => {}
        }
    }
}

impl Session {
    pub async fn connect(
        app: AppHandle,
        generation: u64,
        url: &str,
        token: &str,
        key: Vec<u8>,
        version: u32,
    ) -> Result<Session, String> {
        let key_provider = key_provider(key, version);
        let mut options = RoomOptions::default();
        options.encryption = Some(E2eeOptions {
            encryption_type: EncryptionType::Gcm,
            key_provider: key_provider.clone(),
        });
        let (room, events) = Room::connect(url, token, options).await.map_err(|e| e.to_string())?;
        let room = Arc::new(room);
        apply_key_index(&room, key_index(version));
        let events_task = tauri::async_runtime::spawn(pump_events(app, generation, events));
        Ok(Session { room, key_provider, events_task, key_switch: None })
    }

    pub fn encrypted(&self) -> bool {
        self.room.e2ee_manager().enabled()
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
    }
}
