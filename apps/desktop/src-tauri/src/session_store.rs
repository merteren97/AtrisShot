use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
const FILE_NAME: &str = "session-token.dpapi";
fn path(app: &AppHandle) -> Result<PathBuf, String> { Ok(app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("auth").join(FILE_NAME)) }
#[cfg(windows)]
fn crypt(data: &[u8], decrypt: bool) -> Result<Vec<u8>, String> {
  use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN}; use windows_sys::Win32::Foundation::LocalFree;
  let mut input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 }; let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
  let ok = unsafe { if decrypt { CryptUnprotectData(&mut input, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) } else { CryptProtectData(&mut input, std::ptr::null(), std::ptr::null(), std::ptr::null_mut(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) } }; if ok == 0 { return Err("Windows DPAPI operation failed.".into()); }
  let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() }; unsafe { LocalFree(output.pbData as _); } Ok(bytes)
}
pub fn save(app: &AppHandle, token: &str) -> Result<(), String> { let target = path(app)?; if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; } #[cfg(windows)] let bytes = crypt(token.as_bytes(), false)?; #[cfg(not(windows))] let bytes = token.as_bytes().to_vec(); let temp = target.with_extension("tmp"); fs::write(&temp, bytes).map_err(|e| e.to_string())?; fs::rename(temp, target).map_err(|e| e.to_string()) }
pub fn load(app: &AppHandle) -> Result<Option<String>, String> { match fs::read(path(app)?) { Ok(bytes) => { #[cfg(windows)] let bytes = crypt(&bytes, true)?; String::from_utf8(bytes).map(Some).map_err(|e| e.to_string()) }, Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None), Err(e) => Err(e.to_string()) } }
pub fn clear(app: &AppHandle) -> Result<(), String> { match fs::remove_file(path(app)?) { Ok(()) => Ok(()), Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()), Err(e) => Err(e.to_string()) } }
