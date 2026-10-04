pub mod cache;
pub mod media;
pub mod messages;
pub mod outbox;
mod schema;
mod seal;

use aes_gcm::Aes256Gcm;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

use crate::local_key;

pub struct History(Mutex<Option<Account>>);

pub struct Account {
    connection: Connection,
    cipher: Aes256Gcm,
    dir: PathBuf,
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(History(Mutex::new(None)));
    Ok(())
}

fn describe(error: impl ToString) -> String {
    error.to_string()
}

fn with_slot<T>(
    history: &History,
    action: impl FnOnce(&mut Option<Account>) -> Result<T, String>,
) -> Result<T, String> {
    let mut slot = history
        .0
        .lock()
        .map_err(|_| "history storage is locked".to_string())?;
    action(&mut slot)
}

fn with_account<T>(
    history: &History,
    action: impl FnOnce(&mut Account) -> Result<T, String>,
) -> Result<T, String> {
    with_slot(history, |slot| {
        let account = slot
            .as_mut()
            .ok_or_else(|| "history is not open".to_string())?;
        action(account)
    })
}

fn collect_readable<T>(
    rows: impl Iterator<Item = rusqlite::Result<Option<T>>>,
) -> Result<Vec<T>, String> {
    let mut items = Vec::new();
    for row in rows {
        if let Some(item) = row.map_err(describe)? {
            items.push(item);
        }
    }
    Ok(items)
}

fn valid_user_id(user_id: &str) -> bool {
    !user_id.is_empty()
        && user_id.len() <= 64
        && user_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

#[tauri::command]
pub fn history_open(
    app: AppHandle,
    history: State<History>,
    user_id: String,
) -> Result<(), String> {
    if !valid_user_id(&user_id) {
        return Err("invalid user id".to_string());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(describe)?
        .join("accounts")
        .join(&user_id);
    std::fs::create_dir_all(&dir).map_err(describe)?;
    let key = local_key::load_or_create(&dir)?;
    let mut connection = Connection::open(dir.join("history.sqlite")).map_err(describe)?;
    schema::prepare(&mut connection, &key.cipher, key.fresh)?;
    with_slot(&history, |slot| {
        *slot = Some(Account {
            connection,
            cipher: key.cipher,
            dir,
        });
        Ok(())
    })
}

#[cfg(test)]
pub(crate) mod testing {
    use super::{schema, Account, History};
    use aes_gcm::aead::{KeyInit, OsRng};
    use aes_gcm::Aes256Gcm;
    use rusqlite::Connection;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    pub struct TestDir(pub PathBuf);

    impl TestDir {
        pub fn new(name: &str) -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|elapsed| elapsed.as_nanos())
                .unwrap_or_default();
            let dir = std::env::temp_dir().join(format!(
                "astronida-history-test-{name}-{}-{unique}",
                std::process::id()
            ));
            std::fs::create_dir_all(&dir).expect("create test dir");
            Self(dir)
        }

        pub fn file_size(&self, name: &str) -> u64 {
            std::fs::metadata(self.0.join(name))
                .map(|metadata| metadata.len())
                .unwrap_or(0)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    pub fn random_cipher() -> Aes256Gcm {
        Aes256Gcm::new(&Aes256Gcm::generate_key(&mut OsRng))
    }

    pub fn open(dir: &Path, cipher: Aes256Gcm, fresh_key: bool) -> History {
        let mut connection = Connection::open(dir.join("history.sqlite")).expect("open sqlite");
        schema::prepare(&mut connection, &cipher, fresh_key).expect("prepare schema");
        History(Mutex::new(Some(Account {
            connection,
            cipher,
            dir: dir.to_path_buf(),
        })))
    }
}

#[tauri::command]
pub fn history_clear(history: State<History>) -> Result<(), String> {
    let account = with_slot(&history, |slot| {
        slot.take()
            .ok_or_else(|| "history is not open".to_string())
    })?;
    account
        .connection
        .close()
        .map_err(|(_, error)| describe(error))?;
    std::fs::remove_dir_all(&account.dir).map_err(describe)
}
