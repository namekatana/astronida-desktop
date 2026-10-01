use aes_gcm::Aes256Gcm;
use rusqlite::Row;
use serde::de::DeserializeOwned;
use serde::Serialize;

use super::describe;
use super::messages::Reply;
use crate::local_key;

pub(super) const MESSAGE_CONTENT: &str = "messages.content";
pub(super) const MESSAGE_REPLY: &str = "messages.reply";
pub(super) const MESSAGE_ATTACHMENTS: &str = "messages.attachments";
pub(super) const OUTBOX_CONTENT: &str = "outbox.content";
pub(super) const OUTBOX_REPLY: &str = "outbox.reply";
pub(super) const OUTBOX_ATTACHMENTS: &str = "outbox.attachments";
pub(super) const CACHE_VALUE: &str = "cache.value";
pub(super) const MEDIA_CACHE: &str = "media.cache";
pub(super) const MEDIA_OUTBOX: &str = "media.outbox";
pub(super) const LEGACY_CONTEXT: &str = "";

pub(super) fn context(field: &str, key: &str) -> String {
    format!("{field}:{key}")
}

pub(super) fn seal_json<T: Serialize>(
    cipher: &Aes256Gcm,
    value: Option<&T>,
    context: &str,
) -> Result<Option<Vec<u8>>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    let json = serde_json::to_string(value).map_err(describe)?;
    local_key::seal(cipher, &json, context).map(Some)
}

pub(super) fn unseal_json<T: DeserializeOwned>(
    row: &Row,
    index: usize,
    cipher: &Aes256Gcm,
    context: &str,
) -> rusqlite::Result<Option<T>> {
    let Ok(Some(sealed)) = row.get_ref(index)?.as_blob_or_null() else {
        return Ok(None);
    };
    Ok(local_key::unseal(cipher, sealed, context).and_then(|json| serde_json::from_str(&json).ok()))
}

pub(super) fn seal_reply(
    cipher: &Aes256Gcm,
    reply: &Option<Reply>,
    context: &str,
) -> Result<Option<Vec<u8>>, String> {
    seal_json(cipher, reply.as_ref(), context)
}

pub(super) fn unseal_reply(
    row: &Row,
    index: usize,
    cipher: &Aes256Gcm,
    context: &str,
) -> rusqlite::Result<Option<Reply>> {
    unseal_json(row, index, cipher, context)
}

pub(super) fn seal_list<T: Serialize>(
    cipher: &Aes256Gcm,
    items: &[T],
    context: &str,
) -> Result<Option<Vec<u8>>, String> {
    if items.is_empty() {
        return Ok(None);
    }
    seal_json(cipher, Some(&items), context)
}

pub(super) fn unseal_list<T: DeserializeOwned>(
    row: &Row,
    index: usize,
    cipher: &Aes256Gcm,
    context: &str,
) -> rusqlite::Result<Vec<T>> {
    Ok(unseal_json(row, index, cipher, context)?.unwrap_or_default())
}
