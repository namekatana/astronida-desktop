use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Manager, State};

const PAGE_SIZE: i64 = 50;

const SCHEMA: &str = "
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sent_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_channel_id ON messages (channel_id, id);
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channel_sync (
        channel_id TEXT PRIMARY KEY,
        reached_start INTEGER NOT NULL DEFAULT 0
    );
";

pub struct History(Mutex<Option<Account>>);

pub struct Account {
    connection: Connection,
    dir: PathBuf,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    id: String,
    username: String,
    display_name: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMessage {
    id: String,
    channel_id: String,
    author: Author,
    content: String,
    sent_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Coverage {
    before: Option<String>,
    has_more: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPage {
    messages: Vec<HistoryMessage>,
    reached_start: bool,
}

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(History(Mutex::new(None)));
    Ok(())
}

fn describe(error: impl ToString) -> String {
    error.to_string()
}

fn lock<'a>(history: &'a State<'a, History>) -> Result<MutexGuard<'a, Option<Account>>, String> {
    history.0.lock().map_err(|_| "history storage is locked".to_string())
}

fn opened(slot: &mut Option<Account>) -> Result<&mut Connection, String> {
    slot.as_mut()
        .map(|account| &mut account.connection)
        .ok_or_else(|| "history is not open".to_string())
}

fn valid_user_id(user_id: &str) -> bool {
    !user_id.is_empty()
        && user_id.len() <= 64
        && user_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

#[tauri::command]
pub fn history_open(app: AppHandle, history: State<History>, user_id: String) -> Result<(), String> {
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
    let connection = Connection::open(dir.join("history.sqlite")).map_err(describe)?;
    connection.execute_batch(SCHEMA).map_err(describe)?;
    *lock(&history)? = Some(Account { connection, dir });
    Ok(())
}

#[tauri::command]
pub fn history_page(
    history: State<History>,
    channel_id: String,
    before: Option<String>,
) -> Result<HistoryPage, String> {
    let mut slot = lock(&history)?;
    let connection = opened(&mut slot)?;
    let mut statement = connection
        .prepare(
            "SELECT m.id, m.channel_id, m.author_id, m.content, m.sent_at, p.username, p.display_name
             FROM messages m LEFT JOIN profiles p ON p.id = m.author_id
             WHERE m.channel_id = ?1 AND (?2 IS NULL OR m.id < ?2)
             ORDER BY m.id DESC LIMIT ?3",
        )
        .map_err(describe)?;
    let mut messages = statement
        .query_map(params![channel_id, before, PAGE_SIZE], |row| {
            Ok(HistoryMessage {
                id: row.get(0)?,
                channel_id: row.get(1)?,
                author: Author {
                    id: row.get(2)?,
                    username: row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "unknown".into()),
                    display_name: row.get::<_, Option<String>>(6)?.unwrap_or_else(|| "?".into()),
                },
                content: row.get(3)?,
                sent_at: row.get(4)?,
            })
        })
        .map_err(describe)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(describe)?;
    messages.reverse();

    let reached_start = connection
        .query_row(
            "SELECT reached_start FROM channel_sync WHERE channel_id = ?1",
            params![channel_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(describe)?
        .unwrap_or(0)
        != 0;

    Ok(HistoryPage { messages, reached_start })
}

#[tauri::command]
pub fn history_store(
    history: State<History>,
    channel_id: String,
    messages: Vec<HistoryMessage>,
    coverage: Option<Coverage>,
    reached_start: Option<bool>,
) -> Result<(), String> {
    let mut slot = lock(&history)?;
    let transaction = opened(&mut slot)?.transaction().map_err(describe)?;
    upsert_messages(&transaction, &messages)?;
    if let Some(coverage) = coverage {
        drop_missing(&transaction, &channel_id, &messages, &coverage)?;
    }
    if let Some(reached_start) = reached_start {
        transaction
            .execute(
                "INSERT INTO channel_sync (channel_id, reached_start) VALUES (?1, ?2)
                 ON CONFLICT (channel_id) DO UPDATE SET reached_start = excluded.reached_start",
                params![channel_id, reached_start as i64],
            )
            .map_err(describe)?;
    }
    transaction.commit().map_err(describe)
}

fn upsert_messages(transaction: &Transaction, messages: &[HistoryMessage]) -> Result<(), String> {
    let mut profile = transaction
        .prepare_cached(
            "INSERT INTO profiles (id, username, display_name) VALUES (?1, ?2, ?3)
             ON CONFLICT (id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name",
        )
        .map_err(describe)?;
    let mut message = transaction
        .prepare_cached(
            "INSERT INTO messages (id, channel_id, author_id, content, sent_at) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (id) DO UPDATE SET content = excluded.content, sent_at = excluded.sent_at",
        )
        .map_err(describe)?;
    for item in messages {
        profile
            .execute(params![item.author.id, item.author.username, item.author.display_name])
            .map_err(describe)?;
        message
            .execute(params![item.id, item.channel_id, item.author.id, item.content, item.sent_at])
            .map_err(describe)?;
    }
    Ok(())
}

fn drop_missing(
    transaction: &Transaction,
    channel_id: &str,
    messages: &[HistoryMessage],
    coverage: &Coverage,
) -> Result<(), String> {
    let oldest = messages.iter().map(|item| item.id.as_str()).min();
    if coverage.has_more && oldest.is_none() {
        return Ok(());
    }
    let lower = if coverage.has_more { oldest } else { None };
    let present: Vec<&str> = messages.iter().map(|item| item.id.as_str()).collect();
    let present_json = serde_json::to_string(&present).map_err(describe)?;
    transaction
        .execute(
            "DELETE FROM messages
             WHERE channel_id = ?1
               AND (?2 IS NULL OR id >= ?2)
               AND (?3 IS NULL OR id < ?3)
               AND id NOT IN (SELECT value FROM json_each(?4))",
            params![channel_id, lower, coverage.before, present_json],
        )
        .map_err(describe)?;
    Ok(())
}

#[tauri::command]
pub fn history_newest_ids(history: State<History>) -> Result<HashMap<String, String>, String> {
    let mut slot = lock(&history)?;
    let connection = opened(&mut slot)?;
    let mut statement = connection
        .prepare("SELECT channel_id, MAX(id) FROM messages GROUP BY channel_id")
        .map_err(describe)?;
    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(describe)?;
    rows.collect::<Result<HashMap<_, _>, _>>().map_err(describe)
}

#[tauri::command]
pub fn history_drop_channel(history: State<History>, channel_id: String) -> Result<(), String> {
    let mut slot = lock(&history)?;
    let transaction = opened(&mut slot)?.transaction().map_err(describe)?;
    transaction
        .execute("DELETE FROM messages WHERE channel_id = ?1", params![channel_id])
        .map_err(describe)?;
    transaction
        .execute("DELETE FROM channel_sync WHERE channel_id = ?1", params![channel_id])
        .map_err(describe)?;
    transaction.commit().map_err(describe)
}

#[tauri::command]
pub fn history_clear(history: State<History>) -> Result<(), String> {
    let account = lock(&history)?
        .take()
        .ok_or_else(|| "history is not open".to_string())?;
    account.connection.close().map_err(|(_, error)| describe(error))?;
    std::fs::remove_dir_all(&account.dir).map_err(describe)
}
