use aes_gcm::Aes256Gcm;
use rusqlite::{params, OptionalExtension, Row, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

use super::seal::{
    context, seal_list, seal_reply, unseal_list, unseal_reply, MESSAGE_ATTACHMENTS,
    MESSAGE_CONTENT, MESSAGE_REPLY,
};
use super::{collect_readable, describe, with_account, Account, History};
use crate::local_key;

const PAGE_SIZE: i64 = 50;

macro_rules! select_messages {
    () => {
        "SELECT m.id, m.channel_id, m.author_id, m.content, m.sent_at, p.username, p.display_name, m.reply, m.forwarded_from, m.attachments, p.avatar_id
         FROM messages m LEFT JOIN profiles p ON p.id = m.author_id"
    };
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    id: String,
    width: u32,
    height: u32,
    thumb_hash: String,
    #[serde(default)]
    spoiler: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    id: String,
    username: String,
    display_name: String,
    #[serde(
        default,
        deserialize_with = "present_value",
        skip_serializing_if = "Option::is_none"
    )]
    avatar_id: Option<Option<String>>,
}

fn present_value<'de, D>(deserializer: D) -> Result<Option<Option<String>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer).map(Some)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyOriginal {
    author: Author,
    content: String,
    #[serde(default)]
    forwarded_from: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reply {
    id: String,
    original: Option<ReplyOriginal>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMessage {
    id: String,
    channel_id: String,
    author: Author,
    content: String,
    sent_at: String,
    #[serde(default)]
    reply: Option<Reply>,
    #[serde(default)]
    forwarded_from: Option<String>,
    #[serde(default)]
    attachments: Vec<Attachment>,
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

fn message_from_row(row: &Row, cipher: &Aes256Gcm) -> rusqlite::Result<Option<HistoryMessage>> {
    let id: String = row.get(0)?;
    let Ok(sealed) = row.get_ref(3)?.as_blob() else {
        return Ok(None);
    };
    let Some(content) = local_key::unseal(cipher, sealed, &context(MESSAGE_CONTENT, &id)) else {
        return Ok(None);
    };
    let reply = unseal_reply(row, 7, cipher, &context(MESSAGE_REPLY, &id))?;
    let attachments = unseal_list(row, 9, cipher, &context(MESSAGE_ATTACHMENTS, &id))?;
    Ok(Some(HistoryMessage {
        id,
        channel_id: row.get(1)?,
        author: Author {
            id: row.get(2)?,
            username: row
                .get::<_, Option<String>>(5)?
                .unwrap_or_else(|| "unknown".into()),
            display_name: row
                .get::<_, Option<String>>(6)?
                .unwrap_or_else(|| "?".into()),
            avatar_id: Some(row.get(10)?),
        },
        content,
        sent_at: row.get(4)?,
        reply,
        forwarded_from: row.get(8)?,
        attachments,
    }))
}

#[tauri::command]
pub fn history_page(
    history: State<History>,
    channel_id: String,
    before: Option<String>,
) -> Result<HistoryPage, String> {
    with_account(&history, |account| {
        let Account {
            connection, cipher, ..
        } = account;
        let mut statement = connection
            .prepare(concat!(
                select_messages!(),
                " WHERE m.channel_id = ?1 AND (?2 IS NULL OR m.id < ?2) ORDER BY m.id DESC LIMIT ?3"
            ))
            .map_err(describe)?;
        let rows = statement
            .query_map(params![channel_id, before, PAGE_SIZE], |row| {
                message_from_row(row, cipher)
            })
            .map_err(describe)?;
        let mut messages = collect_readable(rows)?;
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

        Ok(HistoryPage {
            messages,
            reached_start,
        })
    })
}

#[tauri::command]
pub fn history_store(
    history: State<History>,
    channel_id: String,
    messages: Vec<HistoryMessage>,
    coverage: Option<Coverage>,
    reached_start: Option<bool>,
) -> Result<(), String> {
    with_account(&history, |account| {
        let Account {
            connection, cipher, ..
        } = account;
        let transaction = connection.transaction().map_err(describe)?;
        upsert_messages(&transaction, cipher, &messages)?;
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
    })
}

fn upsert_messages(
    transaction: &Transaction,
    cipher: &Aes256Gcm,
    messages: &[HistoryMessage],
) -> Result<(), String> {
    let mut profile = transaction
        .prepare_cached(
            "INSERT INTO profiles (id, username, display_name, avatar_id) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name,
               avatar_id = CASE WHEN ?5 THEN excluded.avatar_id ELSE profiles.avatar_id END",
        )
        .map_err(describe)?;
    let mut message = transaction
        .prepare_cached(
            "INSERT INTO messages (id, channel_id, author_id, content, sent_at, reply, forwarded_from, attachments) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT (id) DO UPDATE SET content = excluded.content, sent_at = excluded.sent_at, reply = excluded.reply, forwarded_from = excluded.forwarded_from, attachments = excluded.attachments",
        )
        .map_err(describe)?;
    for item in messages {
        let sealed = local_key::seal(cipher, &item.content, &context(MESSAGE_CONTENT, &item.id))?;
        let sealed_reply = seal_reply(cipher, &item.reply, &context(MESSAGE_REPLY, &item.id))?;
        let sealed_attachments = seal_list(
            cipher,
            &item.attachments,
            &context(MESSAGE_ATTACHMENTS, &item.id),
        )?;
        profile
            .execute(params![
                item.author.id,
                item.author.username,
                item.author.display_name,
                item.author.avatar_id.clone().flatten(),
                item.author.avatar_id.is_some()
            ])
            .map_err(describe)?;
        message
            .execute(params![
                item.id,
                item.channel_id,
                item.author.id,
                sealed,
                item.sent_at,
                sealed_reply,
                item.forwarded_from,
                sealed_attachments
            ])
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
    with_account(&history, |account| {
        let mut statement = account
            .connection
            .prepare("SELECT channel_id, MAX(id) FROM messages GROUP BY channel_id")
            .map_err(describe)?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(describe)?;
        rows.collect::<Result<HashMap<_, _>, _>>().map_err(describe)
    })
}

#[tauri::command]
pub fn history_latest_messages(
    history: State<History>,
    channel_ids: Vec<String>,
) -> Result<Vec<HistoryMessage>, String> {
    with_account(&history, |account| {
        let Account {
            connection, cipher, ..
        } = account;
        let mut statement = connection
            .prepare(concat!(
                select_messages!(),
                " WHERE m.channel_id = ?1 ORDER BY m.id DESC LIMIT 1"
            ))
            .map_err(describe)?;
        let mut latest = Vec::new();
        for channel_id in channel_ids {
            let message = statement
                .query_row(params![channel_id], |row| message_from_row(row, cipher))
                .optional()
                .map_err(describe)?
                .flatten();
            latest.extend(message);
        }
        Ok(latest)
    })
}

#[tauri::command]
pub fn history_drop_channel(history: State<History>, channel_id: String) -> Result<(), String> {
    with_account(&history, |account| {
        let transaction = account.connection.transaction().map_err(describe)?;
        transaction
            .execute(
                "DELETE FROM messages WHERE channel_id = ?1",
                params![channel_id],
            )
            .map_err(describe)?;
        transaction
            .execute(
                "DELETE FROM channel_sync WHERE channel_id = ?1",
                params![channel_id],
            )
            .map_err(describe)?;
        transaction.commit().map_err(describe)
    })
}

#[tauri::command]
pub fn history_remove_message(
    history: State<History>,
    channel_id: String,
    message_id: String,
) -> Result<(), String> {
    with_account(&history, |account| {
        let Account {
            connection, cipher, ..
        } = account;
        let transaction = connection.transaction().map_err(describe)?;
        transaction
            .execute(
                "DELETE FROM messages WHERE channel_id = ?1 AND id = ?2",
                params![channel_id, message_id],
            )
            .map_err(describe)?;
        forget_reply_originals(&transaction, cipher, &channel_id, &message_id)?;
        transaction.commit().map_err(describe)
    })
}

fn forget_reply_originals(
    transaction: &Transaction,
    cipher: &Aes256Gcm,
    channel_id: &str,
    message_id: &str,
) -> Result<(), String> {
    let replies = {
        let mut statement = transaction
            .prepare("SELECT id, reply FROM messages WHERE channel_id = ?1 AND reply IS NOT NULL")
            .map_err(describe)?;
        let rows = statement
            .query_map(params![channel_id], |row| {
                let id: String = row.get(0)?;
                let reply = unseal_reply(row, 1, cipher, &context(MESSAGE_REPLY, &id))?;
                Ok(reply.map(|reply| (id, reply)))
            })
            .map_err(describe)?;
        collect_readable(rows)?
    };
    let mut update = transaction
        .prepare("UPDATE messages SET reply = ?2 WHERE id = ?1")
        .map_err(describe)?;
    for (id, mut reply) in replies {
        if reply.id != message_id || reply.original.is_none() {
            continue;
        }
        reply.original = None;
        let sealed = seal_reply(cipher, &Some(reply), &context(MESSAGE_REPLY, &id))?;
        update.execute(params![id, sealed]).map_err(describe)?;
    }
    Ok(())
}
