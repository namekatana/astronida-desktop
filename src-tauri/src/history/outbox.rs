use aes_gcm::Aes256Gcm;
use rusqlite::{params, Connection, Row, Transaction};
use serde::{Deserialize, Serialize};
use tauri::State;

use super::messages::Reply;
use super::seal::{context, seal_reply, unseal_reply, LEGACY_CONTEXT, OUTBOX_CONTENT, OUTBOX_REPLY};
use super::{collect_readable, describe, with_account, Account, History};
use crate::local_key;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboxEntry {
    pub(super) client_id: String,
    pub(super) channel_id: String,
    pub(super) content: String,
    pub(super) created_at: String,
    #[serde(default)]
    pub(super) reply: Option<Reply>,
}

fn outbox_context(field: &str, client_id: &str, legacy: bool) -> String {
    if legacy {
        LEGACY_CONTEXT.to_string()
    } else {
        context(field, client_id)
    }
}

fn outbox_from_row(
    row: &Row,
    cipher: &Aes256Gcm,
    legacy: bool,
) -> rusqlite::Result<Option<OutboxEntry>> {
    let client_id: String = row.get(0)?;
    let content_context = outbox_context(OUTBOX_CONTENT, &client_id, legacy);
    let reply_context = outbox_context(OUTBOX_REPLY, &client_id, legacy);
    let content = row
        .get_ref(2)?
        .as_blob()
        .ok()
        .and_then(|sealed| local_key::unseal(cipher, sealed, &content_context));
    let Some(content) = content else {
        return Ok(None);
    };
    Ok(Some(OutboxEntry {
        channel_id: row.get(1)?,
        content,
        created_at: row.get(3)?,
        reply: unseal_reply(row, 4, cipher, &reply_context)?,
        client_id,
    }))
}

pub(super) fn read_outbox(
    connection: &Connection,
    cipher: &Aes256Gcm,
    legacy: bool,
) -> Result<Vec<OutboxEntry>, String> {
    let mut statement = connection
        .prepare(
            "SELECT client_id, channel_id, content, created_at, reply FROM outbox ORDER BY created_at, client_id",
        )
        .map_err(describe)?;
    let rows = statement
        .query_map([], |row| outbox_from_row(row, cipher, legacy))
        .map_err(describe)?;
    collect_readable(rows)
}

pub(super) fn insert_outbox(
    transaction: &Transaction,
    cipher: &Aes256Gcm,
    entry: &OutboxEntry,
) -> Result<(), String> {
    let sealed = local_key::seal(
        cipher,
        &entry.content,
        &context(OUTBOX_CONTENT, &entry.client_id),
    )?;
    let sealed_reply = seal_reply(
        cipher,
        &entry.reply,
        &context(OUTBOX_REPLY, &entry.client_id),
    )?;
    transaction
        .execute(
            "INSERT INTO outbox (client_id, channel_id, content, created_at, reply) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (client_id) DO NOTHING",
            params![entry.client_id, entry.channel_id, sealed, entry.created_at, sealed_reply],
        )
        .map_err(describe)?;
    Ok(())
}

#[tauri::command]
pub fn outbox_list(history: State<History>) -> Result<Vec<OutboxEntry>, String> {
    with_account(&history, |account| {
        read_outbox(&account.connection, &account.cipher, false)
    })
}

#[tauri::command]
pub fn outbox_put(history: State<History>, entry: OutboxEntry) -> Result<(), String> {
    with_account(&history, |account| {
        let Account {
            connection, cipher, ..
        } = account;
        let transaction = connection.transaction().map_err(describe)?;
        insert_outbox(&transaction, cipher, &entry)?;
        transaction.commit().map_err(describe)
    })
}

#[tauri::command]
pub fn outbox_remove(history: State<History>, client_id: String) -> Result<(), String> {
    with_account(&history, |account| {
        account
            .connection
            .execute(
                "DELETE FROM outbox WHERE client_id = ?1",
                params![client_id],
            )
            .map_err(describe)?;
        Ok(())
    })
}
