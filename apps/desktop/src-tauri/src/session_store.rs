use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "session-token.dpapi";
const CREDENTIAL_SERVICE: &str = "com.atrishub.shot";
const CREDENTIAL_USER: &str = "atris-session";

fn path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("auth")
        .join(FILE_NAME))
}

fn remove_legacy_file(app: &AppHandle) -> Result<(), String> {
    match fs::remove_file(path(app)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(windows)]
fn crypt(data: &[u8], decrypt: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let mut input = CRYPT_INTEGER_BLOB {
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
                &mut input,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptProtectData(
                &mut input,
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

#[cfg(not(windows))]
fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER).map_err(|error| error.to_string())
}

pub fn save(app: &AppHandle, token: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let target = path(app)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let bytes = crypt(token.as_bytes(), false)?;
        let temp = target.with_extension("tmp");
        fs::write(&temp, bytes).map_err(|error| error.to_string())?;
        fs::rename(temp, target).map_err(|error| error.to_string())
    }

    #[cfg(not(windows))]
    {
        credential_entry()?
            .set_password(token)
            .map_err(|error| format!("Session token could not be stored securely: {error}"))?;
        remove_legacy_file(app)
    }
}

pub fn load(app: &AppHandle) -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        match fs::read(path(app)?) {
            Ok(bytes) => {
                let bytes = crypt(&bytes, true)?;
                String::from_utf8(bytes)
                    .map(Some)
                    .map_err(|error| error.to_string())
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    #[cfg(not(windows))]
    {
        let entry = credential_entry()?;
        match entry.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => {
                // Migrate the short-lived plaintext fallback used by older non-Windows builds.
                match fs::read_to_string(path(app)?) {
                    Ok(token) if !token.trim().is_empty() => {
                        entry
                            .set_password(&token)
                            .map_err(|error| format!("Session token migration failed: {error}"))?;
                        remove_legacy_file(app)?;
                        Ok(Some(token))
                    }
                    Ok(_) => {
                        remove_legacy_file(app)?;
                        Ok(None)
                    }
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
                    Err(error) => Err(error.to_string()),
                }
            }
            Err(error) => Err(format!("Session token could not be read securely: {error}")),
        }
    }
}

pub fn clear(app: &AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        remove_legacy_file(app)
    }

    #[cfg(not(windows))]
    {
        let keyring_result = match credential_entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("Session token could not be removed: {error}")),
        };
        let file_result = remove_legacy_file(app);
        keyring_result.and(file_result)
    }
}
