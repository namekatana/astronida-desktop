mod audio;
mod session;
mod stats;

use base64::prelude::*;
use serde::{Deserialize, Serialize};
use session::Session;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

const KEY_BYTES: usize = 32;

pub struct VoiceEngine {
    session: Mutex<Option<Session>>,
    generation: AtomicU64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptionKey {
    key: String,
    version: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    url: String,
    token: String,
    e2ee: EncryptionKey,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectOptions {
    microphone: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connected {
    generation: u64,
    encrypted: bool,
    participants: Vec<String>,
}

pub fn init(app: &AppHandle) {
    app.manage(VoiceEngine { session: Mutex::new(None), generation: AtomicU64::new(0) });
}

fn validate_url(url: &str) -> Result<(), String> {
    let plain_allowed = cfg!(debug_assertions);
    if url.starts_with("wss://") || (plain_allowed && url.starts_with("ws://")) {
        Ok(())
    } else {
        Err("invalid_url".to_string())
    }
}

fn decode_key(encoded: &str) -> Result<Vec<u8>, String> {
    let key = BASE64_STANDARD.decode(encoded).map_err(|_| "invalid_e2ee_key".to_string())?;
    if key.len() != KEY_BYTES {
        return Err("invalid_e2ee_key".to_string());
    }
    Ok(key)
}

async fn close_current(engine: &VoiceEngine) {
    let previous = engine.session.lock().await.take();
    if let Some(session) = previous {
        session.close().await;
    }
}

#[tauri::command]
pub async fn voice_connect(
    app: AppHandle,
    engine: State<'_, VoiceEngine>,
    credentials: Credentials,
    options: ConnectOptions,
) -> Result<Connected, String> {
    validate_url(&credentials.url)?;
    let key = decode_key(&credentials.e2ee.key)?;
    close_current(&engine).await;
    let generation = engine.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let session = Session::connect(
        app,
        generation,
        &credentials.url,
        &credentials.token,
        key,
        credentials.e2ee.version,
        options.microphone,
    )
    .await?;
    let mut slot = engine.session.lock().await;
    if engine.generation.load(Ordering::SeqCst) != generation {
        session.close().await;
        return Err("superseded".to_string());
    }
    let encrypted = session.encrypted();
    let participants = session.participants();
    *slot = Some(session);
    Ok(Connected { generation, encrypted, participants })
}

#[tauri::command]
pub async fn voice_rotate_key(
    engine: State<'_, VoiceEngine>,
    next: EncryptionKey,
) -> Result<(), String> {
    let key = decode_key(&next.key)?;
    let mut slot = engine.session.lock().await;
    match slot.as_mut() {
        Some(session) => {
            session.rotate_key(key, next.version);
            Ok(())
        }
        None => Err("not_connected".to_string()),
    }
}

async fn with_session(
    engine: &VoiceEngine,
    apply: impl FnOnce(&Session),
) -> Result<(), String> {
    let slot = engine.session.lock().await;
    match slot.as_ref() {
        Some(session) => {
            apply(session);
            Ok(())
        }
        None => Err("not_connected".to_string()),
    }
}

#[tauri::command]
pub async fn voice_set_microphone(
    engine: State<'_, VoiceEngine>,
    enabled: bool,
) -> Result<(), String> {
    with_session(&engine, |session| session.set_microphone_enabled(enabled)).await
}

#[tauri::command]
pub async fn voice_set_deafened(
    engine: State<'_, VoiceEngine>,
    deafened: bool,
) -> Result<(), String> {
    with_session(&engine, |session| session.set_deafened(deafened)).await
}

#[tauri::command]
pub async fn voice_set_volume(
    engine: State<'_, VoiceEngine>,
    user_id: String,
    volume: f32,
) -> Result<(), String> {
    with_session(&engine, |session| session.set_volume(&user_id, volume)).await
}

#[tauri::command]
pub async fn voice_disconnect(engine: State<'_, VoiceEngine>) -> Result<(), String> {
    engine.generation.fetch_add(1, Ordering::SeqCst);
    close_current(&engine).await;
    Ok(())
}
