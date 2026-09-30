use rusqlite::{params, OptionalExtension};
use tauri::State;

use super::seal::{context, CACHE_VALUE};
use super::{describe, with_account, History};
use crate::local_key;

const MAX_CACHE_SECTION_LENGTH: usize = 64;

fn valid_cache_section(section: &str) -> Result<(), String> {
    if section.is_empty() || section.len() > MAX_CACHE_SECTION_LENGTH {
        return Err("invalid cache section".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn cache_get(history: State<History>, section: String) -> Result<Option<String>, String> {
    valid_cache_section(&section)?;
    with_account(&history, |account| {
        let sealed = account
            .connection
            .query_row(
                "SELECT value FROM cache WHERE section = ?1",
                params![section],
                |row| row.get::<_, Vec<u8>>(0),
            )
            .optional()
            .map_err(describe)?;
        Ok(sealed.and_then(|sealed| {
            local_key::unseal(&account.cipher, &sealed, &context(CACHE_VALUE, &section))
        }))
    })
}

#[tauri::command]
pub fn cache_put(history: State<History>, section: String, value: String) -> Result<(), String> {
    valid_cache_section(&section)?;
    with_account(&history, |account| {
        let sealed = local_key::seal(&account.cipher, &value, &context(CACHE_VALUE, &section))?;
        account
            .connection
            .execute(
                "INSERT INTO cache (section, value) VALUES (?1, ?2)
                 ON CONFLICT (section) DO UPDATE SET value = excluded.value",
                params![section, sealed],
            )
            .map_err(describe)?;
        Ok(())
    })
}
