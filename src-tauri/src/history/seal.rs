use aes_gcm::Aes256Gcm;
use rusqlite::Row;

use super::describe;
use super::messages::Reply;
use crate::local_key;

pub(super) const MESSAGE_CONTENT: &str = "messages.content";
pub(super) const MESSAGE_REPLY: &str = "messages.reply";
pub(super) const OUTBOX_CONTENT: &str = "outbox.content";
pub(super) const OUTBOX_REPLY: &str = "outbox.reply";
pub(super) const CACHE_VALUE: &str = "cache.value";
pub(super) const LEGACY_CONTEXT: &str = "";

pub(super) fn context(field: &str, key: &str) -> String {
    format!("{field}:{key}")
}

pub(super) fn seal_reply(
    cipher: &Aes256Gcm,
    reply: &Option<Reply>,
    context: &str,
) -> Result<Option<Vec<u8>>, String> {
    let Some(reply) = reply else {
        return Ok(None);
    };
    let json = serde_json::to_string(reply).map_err(describe)?;
    local_key::seal(cipher, &json, context).map(Some)
}

pub(super) fn unseal_reply(
    row: &Row,
    index: usize,
    cipher: &Aes256Gcm,
    context: &str,
) -> rusqlite::Result<Option<Reply>> {
    let Ok(Some(sealed)) = row.get_ref(index)?.as_blob_or_null() else {
        return Ok(None);
    };
    Ok(
        local_key::unseal(cipher, sealed, context)
            .and_then(|json| serde_json::from_str(&json).ok()),
    )
}
