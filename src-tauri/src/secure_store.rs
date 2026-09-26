use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const ENTROPY: &[u8] = b"astronida-secure-store-v1";
const MAX_KEY_LENGTH: usize = 64;

fn describe(error: impl ToString) -> String {
    error.to_string()
}

fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= MAX_KEY_LENGTH
        && key
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '_' | '-'))
}

fn store_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(describe)?.join("secure"))
}

fn path_for(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
    if !valid_key(key) {
        return Err("invalid key".to_string());
    }
    Ok(store_dir(app)?.join(format!("{key}.bin")))
}

#[tauri::command]
pub fn secure_store_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let path = path_for(&app, &key)?;
    let sealed = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(describe(error)),
    };
    let plain = dpapi::unprotect(&sealed)?;
    String::from_utf8(plain).map(Some).map_err(describe)
}

#[tauri::command]
pub fn secure_store_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let path = path_for(&app, &key)?;
    let sealed = dpapi::protect(value.as_bytes())?;
    fs::create_dir_all(store_dir(&app)?).map_err(describe)?;
    let pending = path.with_extension("tmp");
    fs::write(&pending, sealed).map_err(describe)?;
    fs::rename(&pending, &path).map_err(describe)
}

#[tauri::command]
pub fn secure_store_remove(app: AppHandle, key: String) -> Result<(), String> {
    let path = path_for(&app, &key)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(describe(error)),
    }
}

#[cfg(windows)]
pub(crate) mod dpapi {
    use std::ptr;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    fn blob(bytes: &[u8]) -> Result<CRYPT_INTEGER_BLOB, String> {
        let length = u32::try_from(bytes.len()).map_err(|_| "value is too large".to_string())?;
        Ok(CRYPT_INTEGER_BLOB {
            cbData: length,
            pbData: bytes.as_ptr().cast_mut(),
        })
    }

    fn empty_blob() -> CRYPT_INTEGER_BLOB {
        CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        }
    }

    fn take(output: CRYPT_INTEGER_BLOB) -> Vec<u8> {
        let bytes =
            unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
        unsafe { LocalFree(output.pbData.cast()) };
        bytes
    }

    fn last_error() -> String {
        std::io::Error::last_os_error().to_string()
    }

    pub fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
        let input = blob(plain)?;
        let entropy = blob(super::ENTROPY)?;
        let mut output = empty_blob();
        let succeeded = unsafe {
            CryptProtectData(
                &input,
                ptr::null(),
                &entropy,
                ptr::null(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if succeeded == 0 {
            return Err(last_error());
        }
        Ok(take(output))
    }

    pub fn unprotect(sealed: &[u8]) -> Result<Vec<u8>, String> {
        let input = blob(sealed)?;
        let entropy = blob(super::ENTROPY)?;
        let mut output = empty_blob();
        let succeeded = unsafe {
            CryptUnprotectData(
                &input,
                ptr::null_mut(),
                &entropy,
                ptr::null(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        };
        if succeeded == 0 {
            return Err(last_error());
        }
        Ok(take(output))
    }
}

#[cfg(not(windows))]
pub(crate) mod dpapi {
    pub fn protect(_plain: &[u8]) -> Result<Vec<u8>, String> {
        Err("secure store is only supported on Windows".to_string())
    }

    pub fn unprotect(_sealed: &[u8]) -> Result<Vec<u8>, String> {
        Err("secure store is only supported on Windows".to_string())
    }
}
