use aes_gcm::Aes256Gcm;
use rusqlite::{params, Connection};

use super::outbox::{insert_outbox, read_outbox, OutboxEntry};
use super::{collect_readable, describe};

const SCHEMA_VERSION: i64 = 2;

const SCHEMA: &str = "
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA secure_delete = ON;
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        reply BLOB,
        forwarded_from TEXT
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
    CREATE TABLE IF NOT EXISTS outbox (
        client_id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        reply BLOB
    );
    CREATE TABLE IF NOT EXISTS cache (
        section TEXT PRIMARY KEY,
        value BLOB NOT NULL
    );
";

pub(super) fn prepare(
    connection: &mut Connection,
    cipher: &Aes256Gcm,
    fresh_key: bool,
) -> Result<(), String> {
    connection.execute_batch(SCHEMA).map_err(describe)?;
    ensure_column(connection, "messages", "reply", "BLOB")?;
    ensure_column(connection, "messages", "forwarded_from", "TEXT")?;
    ensure_column(connection, "outbox", "reply", "BLOB")?;
    migrate(connection, cipher, fresh_key)
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    column: &str,
    column_type: &str,
) -> Result<(), String> {
    let exists: bool = connection
        .query_row(
            "SELECT EXISTS (SELECT 1 FROM pragma_table_info(?1) WHERE name = ?2)",
            params![table, column],
            |row| row.get(0),
        )
        .map_err(describe)?;
    if exists {
        return Ok(());
    }
    connection
        .execute_batch(&format!(
            "ALTER TABLE {table} ADD COLUMN {column} {column_type};"
        ))
        .map_err(describe)
}

fn plain_outbox(connection: &Connection) -> Result<Vec<OutboxEntry>, String> {
    let mut statement = connection
        .prepare("SELECT client_id, channel_id, content, created_at FROM outbox")
        .map_err(describe)?;
    let rows = statement
        .query_map([], |row| {
            Ok(row.get::<_, String>(2).ok().map(|content| OutboxEntry {
                client_id: row.get(0).unwrap_or_default(),
                channel_id: row.get(1).unwrap_or_default(),
                content,
                created_at: row.get(3).unwrap_or_default(),
                reply: None,
            }))
        })
        .map_err(describe)?;
    collect_readable(rows)
}

fn migrate(connection: &mut Connection, cipher: &Aes256Gcm, fresh_key: bool) -> Result<(), String> {
    let version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(describe)?;
    if version >= SCHEMA_VERSION && !fresh_key {
        return Ok(());
    }
    let readable_outbox = match version {
        0 => plain_outbox(connection)?,
        1 if !fresh_key => read_outbox(connection, cipher, true)?,
        _ => Vec::new(),
    };
    let transaction = connection.transaction().map_err(describe)?;
    transaction
        .execute_batch(
            "DELETE FROM messages;
             DELETE FROM channel_sync;
             DELETE FROM profiles;
             DELETE FROM outbox;
             DELETE FROM cache;",
        )
        .map_err(describe)?;
    for entry in &readable_outbox {
        insert_outbox(&transaction, cipher, entry)?;
    }
    transaction
        .execute_batch(&format!("PRAGMA user_version = {SCHEMA_VERSION};"))
        .map_err(describe)?;
    transaction.commit().map_err(describe)?;
    connection
        .execute_batch("VACUUM; PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(describe)
}
