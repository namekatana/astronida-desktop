use aes_gcm::Aes256Gcm;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager, State};

use super::seal::{context, MEDIA_CACHE, MEDIA_OUTBOX};
use super::{describe, with_account, History};
use crate::local_key;

const CACHE_LIMIT_BYTES: u64 = 512 * 1024 * 1024;
const CACHE_TRIM_TARGET_BYTES: u64 = 384 * 1024 * 1024;
const MAX_FILE_BYTES: usize = 16 * 1024 * 1024;
const MAX_KEY_LENGTH: usize = 128;
const BUCKET_HEADER: &str = "x-media-bucket";
const KEY_HEADER: &str = "x-media-key";
const FILE_NAME_HEADER: &str = "x-file-name";
const MAX_FILE_NAME_LENGTH: usize = 96;
const DOWNLOADS_FOLDER: &str = "Astronida";
const DOWNLOAD_EXTENSION: &str = "webp";

#[derive(Clone, Copy, PartialEq)]
enum Bucket {
    Cache,
    Outbox,
}

impl Bucket {
    fn parse(name: &str) -> Result<Self, String> {
        match name {
            "cache" => Ok(Self::Cache),
            "outbox" => Ok(Self::Outbox),
            _ => Err("unknown media bucket".to_string()),
        }
    }

    fn folder(self) -> &'static str {
        match self {
            Self::Cache => "media",
            Self::Outbox => "outbox-media",
        }
    }

    fn context_field(self) -> &'static str {
        match self {
            Self::Cache => MEDIA_CACHE,
            Self::Outbox => MEDIA_OUTBOX,
        }
    }
}

struct MediaAccess {
    cipher: Aes256Gcm,
    dir: PathBuf,
    bucket: Bucket,
}

impl MediaAccess {
    fn context(&self, key: &str) -> String {
        context(self.bucket.context_field(), key)
    }
}

fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= MAX_KEY_LENGTH
        && key
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn checked_key(key: &str) -> Result<&str, String> {
    if valid_key(key) {
        Ok(key)
    } else {
        Err("invalid media key".to_string())
    }
}

fn media_access(history: &History, bucket: &str) -> Result<MediaAccess, String> {
    let bucket = Bucket::parse(bucket)?;
    with_account(history, |account| {
        Ok(MediaAccess {
            cipher: account.cipher.clone(),
            dir: account.dir.join(bucket.folder()),
            bucket,
        })
    })
}

fn header<'a>(request: &'a Request<'_>, name: &str) -> Result<&'a str, String> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| format!("missing {name}"))
}

async fn blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(describe)?
}

fn read_file(access: &MediaAccess, key: &str) -> Vec<u8> {
    let path = access.dir.join(key);
    let Ok(sealed) = fs::read(&path) else {
        return Vec::new();
    };
    let Some(plain) = local_key::unseal_bytes(&access.cipher, &sealed, &access.context(key)) else {
        let _ = fs::remove_file(&path);
        return Vec::new();
    };
    if access.bucket == Bucket::Cache {
        touch(&path);
    }
    plain
}

fn write_file(access: &MediaAccess, key: &str, bytes: &[u8]) -> Result<(), String> {
    fs::create_dir_all(&access.dir).map_err(describe)?;
    let sealed = local_key::seal_bytes(&access.cipher, bytes, &access.context(key))?;
    let pending = access.dir.join(format!("{key}.tmp"));
    fs::write(&pending, sealed).map_err(describe)?;
    fs::rename(&pending, access.dir.join(key)).map_err(describe)?;
    if access.bucket == Bucket::Cache {
        trim_cache(&access.dir);
    }
    Ok(())
}

fn delete_files(access: &MediaAccess, prefix: &str) -> Result<(), String> {
    let Ok(entries) = fs::read_dir(&access.dir) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(prefix) {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(())
}

fn checked_file_stem(name: &str) -> Result<&str, String> {
    let stem = name
        .strip_suffix(&format!(".{DOWNLOAD_EXTENSION}"))
        .ok_or_else(|| "invalid file name".to_string())?;
    let valid = !stem.is_empty()
        && name.len() <= MAX_FILE_NAME_LENGTH
        && !stem.starts_with(['.', ' '])
        && stem
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '-' | '_'));
    if valid {
        Ok(stem)
    } else {
        Err("invalid file name".to_string())
    }
}

fn downloads_folder(app: &AppHandle) -> Result<PathBuf, String> {
    let downloads = app.path().download_dir().map_err(describe)?;
    Ok(downloads.join(DOWNLOADS_FOLDER))
}

fn free_download_path(folder: &Path, stem: &str) -> PathBuf {
    let mut candidate = folder.join(format!("{stem}.{DOWNLOAD_EXTENSION}"));
    let mut counter = 2;
    while candidate.exists() {
        candidate = folder.join(format!("{stem} ({counter}).{DOWNLOAD_EXTENSION}"));
        counter += 1;
    }
    candidate
}

fn save_download(folder: &Path, stem: &str, bytes: &[u8]) -> Result<String, String> {
    fs::create_dir_all(folder).map_err(describe)?;
    let path = free_download_path(folder, stem);
    fs::write(&path, bytes).map_err(describe)?;
    Ok(path.to_string_lossy().into_owned())
}

fn list_keys(access: &MediaAccess) -> Vec<String> {
    let Ok(entries) = fs::read_dir(&access.dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| valid_key(name))
        .collect()
}

fn touch(path: &Path) {
    if let Ok(file) = fs::File::options().write(true).open(path) {
        let _ = file.set_modified(SystemTime::now());
    }
}

fn trim_cache(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<(PathBuf, u64, SystemTime)> = entries
        .flatten()
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            Some((entry.path(), metadata.len(), modified))
        })
        .collect();
    let mut total: u64 = files.iter().map(|(_, size, _)| size).sum();
    if total <= CACHE_LIMIT_BYTES {
        return;
    }
    files.sort_by_key(|(_, _, modified)| *modified);
    for (path, size, _) in files {
        if total <= CACHE_TRIM_TARGET_BYTES {
            break;
        }
        if fs::remove_file(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
}

#[tauri::command]
pub async fn media_read(
    history: State<'_, History>,
    bucket: String,
    key: String,
) -> Result<Response, String> {
    checked_key(&key)?;
    let access = media_access(&history, &bucket)?;
    let bytes = blocking(move || Ok(read_file(&access, &key))).await?;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn media_write(history: State<'_, History>, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("media body must be raw bytes".to_string());
    };
    if bytes.is_empty() || bytes.len() > MAX_FILE_BYTES {
        return Err("invalid media size".to_string());
    }
    let key = checked_key(header(&request, KEY_HEADER)?)?.to_string();
    let access = media_access(&history, header(&request, BUCKET_HEADER)?)?;
    let bytes = bytes.clone();
    blocking(move || write_file(&access, &key, &bytes)).await
}

#[tauri::command]
pub async fn media_save_download(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("download body must be raw bytes".to_string());
    };
    if bytes.is_empty() || bytes.len() > MAX_FILE_BYTES {
        return Err("invalid download size".to_string());
    }
    let stem = checked_file_stem(header(&request, FILE_NAME_HEADER)?)?.to_string();
    let folder = downloads_folder(&app)?;
    let bytes = bytes.clone();
    blocking(move || save_download(&folder, &stem, &bytes)).await
}

#[tauri::command]
pub fn media_reveal_download(app: AppHandle, path: String) -> Result<(), String> {
    let folder = downloads_folder(&app)?;
    let file = PathBuf::from(path);
    if file.parent() != Some(folder.as_path()) || !file.is_file() {
        return Err("not a saved photo".to_string());
    }
    tauri_plugin_opener::reveal_item_in_dir(&file).map_err(describe)
}

#[tauri::command]
pub async fn media_keys(
    history: State<'_, History>,
    bucket: String,
) -> Result<Vec<String>, String> {
    let access = media_access(&history, &bucket)?;
    blocking(move || Ok(list_keys(&access))).await
}

#[tauri::command]
pub async fn media_delete(
    history: State<'_, History>,
    bucket: String,
    prefix: String,
) -> Result<(), String> {
    checked_key(&prefix)?;
    let access = media_access(&history, &bucket)?;
    blocking(move || delete_files(&access, &prefix)).await
}
