use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use std::fs;
use std::path::Path;

use crate::secure_store::dpapi;

const KEY_FILE: &str = "history.key";
const KEY_LENGTH: usize = 32;
const NONCE_LENGTH: usize = 12;

pub struct LocalKey {
    pub cipher: Aes256Gcm,
    pub fresh: bool,
}

fn describe(error: impl ToString) -> String {
    error.to_string()
}

fn stored_cipher(path: &Path) -> Option<Aes256Gcm> {
    let sealed = fs::read(path).ok()?;
    let key = dpapi::unprotect(&sealed).ok()?;
    if key.len() != KEY_LENGTH {
        return None;
    }
    Some(Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key)))
}

pub fn load_or_create(dir: &Path) -> Result<LocalKey, String> {
    let path = dir.join(KEY_FILE);
    if let Some(cipher) = stored_cipher(&path) {
        return Ok(LocalKey {
            cipher,
            fresh: false,
        });
    }
    let key = Aes256Gcm::generate_key(&mut OsRng);
    let sealed = dpapi::protect(key.as_slice())?;
    let pending = path.with_extension("tmp");
    fs::write(&pending, sealed).map_err(describe)?;
    fs::rename(&pending, &path).map_err(describe)?;
    Ok(LocalKey {
        cipher: Aes256Gcm::new(&key),
        fresh: true,
    })
}

pub fn seal(cipher: &Aes256Gcm, plain: &str) -> Result<Vec<u8>, String> {
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let body = cipher
        .encrypt(&nonce, plain.as_bytes())
        .map_err(|_| "encryption failed".to_string())?;
    let mut sealed = nonce.to_vec();
    sealed.extend(body);
    Ok(sealed)
}

pub fn unseal(cipher: &Aes256Gcm, sealed: &[u8]) -> Option<String> {
    if sealed.len() < NONCE_LENGTH {
        return None;
    }
    let (nonce, body) = sealed.split_at(NONCE_LENGTH);
    let plain = cipher.decrypt(Nonce::from_slice(nonce), body).ok()?;
    String::from_utf8(plain).ok()
}
