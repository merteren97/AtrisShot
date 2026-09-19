use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

#[cfg(windows)]
const FILE_NAME: &str = "refresh-token-v2.dpapi";
const LEGACY_FILE_NAME: &str = "session-token.dpapi";

#[cfg(not(windows))]
const CREDENTIAL_SERVICE: &str = "com.atrishub.shot.refresh-token-v2";
#[cfg(not(windows))]
const CREDENTIAL_USER: &str = "atris-refresh-token-v2";
#[cfg(not(windows))]
const LEGACY_CREDENTIAL_SERVICE: &str = "com.atrishub.shot";
#[cfg(not(windows))]
const LEGACY_CREDENTIAL_USER: &str = "atris-session";

#[cfg(windows)]
use std::{
    io::Write,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn MoveFileExW(existing_file_name: *const u16, new_file_name: *const u16, flags: u32) -> i32;
}

#[cfg(windows)]
const MOVEFILE_REPLACE_EXISTING: u32 = 0x0000_0001;
#[cfg(windows)]
const MOVEFILE_WRITE_THROUGH: u32 = 0x0000_0008;
#[cfg(windows)]
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn path_for(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("auth")
        .join(file_name))
}

#[cfg(windows)]
fn path(app: &AppHandle) -> Result<PathBuf, String> {
    path_for(app, FILE_NAME)
}

fn legacy_path(app: &AppHandle) -> Result<PathBuf, String> {
    path_for(app, LEGACY_FILE_NAME)
}

fn remove_file_if_exists(file_path: &Path) -> Result<(), String> {
    match fs::remove_file(file_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn remove_legacy_file(app: &AppHandle) -> Result<(), String> {
    remove_file_if_exists(&legacy_path(app)?)
}

fn is_hex_digit(byte: u8) -> bool {
    byte.is_ascii_hexdigit()
}

fn is_uuid_v4(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 36
        && [8, 13, 18, 23]
            .into_iter()
            .all(|index| bytes[index] == b'-')
        && bytes[14] == b'4'
        && matches!(bytes[19], b'8'..=b'9' | b'a'..=b'b' | b'A'..=b'B')
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| [8, 13, 18, 23].contains(&index) || is_hex_digit(*byte))
}

fn is_refresh_token(value: &str) -> bool {
    let Some(value) = value.strip_prefix("abrt_") else {
        return false;
    };
    let Some((session_id, secret)) = value.split_once('.') else {
        return false;
    };
    is_uuid_v4(session_id)
        && (40..=64).contains(&secret.len())
        && secret
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

#[cfg(windows)]
fn crypt(data: &[u8], decrypt: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    let ok = unsafe {
        if decrypt {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if ok == 0 {
        return Err("Windows DPAPI operation failed.".into());
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as _);
    }
    Ok(bytes)
}

#[cfg(windows)]
fn unique_temp_path(target: &Path) -> PathBuf {
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("refresh-token-v2.dpapi");
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    target.with_file_name(format!(
        ".{file_name}.tmp-{}-{timestamp}-{sequence}",
        std::process::id()
    ))
}

#[cfg(windows)]
fn replace_file(temp: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    let temp = temp
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let target = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let ok = unsafe {
        MoveFileExW(
            temp.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        Err(std::io::Error::last_os_error().to_string())
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn sync_parent_directory(target: &Path) {
    if let Some(parent) = target.parent() {
        if let Ok(directory) = fs::File::open(parent) {
            let _ = directory.sync_all();
        }
    }
}

#[cfg(windows)]
fn write_atomic(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let temp = unique_temp_path(target);
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|error| error.to_string())?;
        file.write_all(bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        replace_file(&temp, target)?;
        sync_parent_directory(target);
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

#[cfg(not(windows))]
fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER).map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn legacy_credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(LEGACY_CREDENTIAL_SERVICE, LEGACY_CREDENTIAL_USER)
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn remove_legacy_credential() -> Result<(), String> {
    match legacy_credential_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(not(windows))]
fn remove_current_credential(entry: &keyring::Entry) -> Result<(), String> {
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

// Legacy storage is deletion-only; its value must never become a refresh token.
#[cfg(windows)]
fn cleanup_legacy(app: &AppHandle) -> Result<(), String> {
    remove_legacy_file(app)
}

#[cfg(not(windows))]
fn cleanup_legacy(app: &AppHandle) -> Result<(), String> {
    remove_legacy_file(app)?;
    remove_legacy_credential()
}

pub fn save(app: &AppHandle, token: &str) -> Result<(), String> {
    if !is_refresh_token(token) {
        return Err("Session credential is not a valid refresh token.".to_string());
    }

    #[cfg(windows)]
    {
        let target = path(app)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let bytes = crypt(token.as_bytes(), false)?;
        write_atomic(&target, &bytes)?;
        cleanup_legacy(app)
    }

    #[cfg(not(windows))]
    {
        credential_entry()?
            .set_password(token)
            .map_err(|error| format!("Session token could not be stored securely: {error}"))?;
        cleanup_legacy(app)
    }
}

pub fn load(app: &AppHandle) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let target = path(app)?;
        match fs::read(&target) {
            Ok(bytes) => {
                let bytes = crypt(&bytes, true)?;
                let token = match String::from_utf8(bytes) {
                    Ok(token) => token,
                    Err(_) => {
                        remove_file_if_exists(&target)?;
                        cleanup_legacy(app)?;
                        return Ok(None);
                    }
                };
                if !is_refresh_token(&token) {
                    remove_file_if_exists(&target)?;
                    cleanup_legacy(app)?;
                    return Ok(None);
                }
                cleanup_legacy(app)?;
                Ok(Some(token))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                cleanup_legacy(app)?;
                Ok(None)
            }
            Err(error) => Err(error.to_string()),
        }
    }

    #[cfg(not(windows))]
    {
        let entry = credential_entry()?;
        match entry.get_password() {
            Ok(token) if is_refresh_token(&token) => {
                cleanup_legacy(app)?;
                Ok(Some(token))
            }
            Ok(_) => {
                remove_current_credential(&entry)?;
                cleanup_legacy(app)?;
                Ok(None)
            }
            Err(keyring::Error::NoEntry) => {
                cleanup_legacy(app)?;
                Ok(None)
            }
            Err(error) => Err(format!("Session token could not be read securely: {error}")),
        }
    }
}

pub fn clear(app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        remove_file_if_exists(&path(app)?)?;
        cleanup_legacy(app)
    }

    #[cfg(not(windows))]
    {
        let current = credential_entry()?;
        remove_current_credential(&current)?;
        cleanup_legacy(app)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_refresh_token() -> String {
        format!(
            "abrt_00000000-0000-4000-8000-000000000000.{}",
            "A".repeat(40)
        )
    }

    #[test]
    fn refresh_token_validation_accepts_v2_shape() {
        assert!(is_refresh_token(&sample_refresh_token()));
    }

    #[test]
    fn refresh_token_validation_rejects_access_tokens_and_malformed_values() {
        assert!(!is_refresh_token("access-token"));
        assert!(!is_refresh_token(
            "abrt_00000000-0000-5000-8000-000000000000.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        ));
        assert!(!is_refresh_token(
            "abrt_00000000-0000-4000-8000-000000000000.short"
        ));
    }
}
