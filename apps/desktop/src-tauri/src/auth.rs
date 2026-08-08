use serde::Serialize;
use std::{
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, State};

// Session credentials for com.atrishub.shot are handled by session_store.rs.
// Non-Windows storage uses keyring::Entry there; Windows retains DPAPI.
const MAX_OFFLINE_GRACE_MS: u64 = 24 * 60 * 60 * 1000;

#[derive(Clone, Default)]
pub struct AccessGate {
    state: Arc<Mutex<AccessState>>,
}

#[derive(Default)]
struct AccessState {
    allowed_until_ms: u64,
    offline: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessStatus {
    allowed: bool,
    offline: bool,
    allowed_until_ms: u64,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64)
}

fn validate_grant(validated_at_ms: u64, offline: bool) -> Result<u64, String> {
    let now = now_ms();
    if validated_at_ms > now.saturating_add(5 * 60 * 1000) {
        return Err("Atris account verification timestamp is invalid.".to_string());
    }
    if offline && now.saturating_sub(validated_at_ms) > MAX_OFFLINE_GRACE_MS {
        return Err("Offline Atris session grace has expired.".to_string());
    }
    Ok(if offline {
        validated_at_ms.saturating_add(MAX_OFFLINE_GRACE_MS)
    } else {
        now.saturating_add(MAX_OFFLINE_GRACE_MS)
    })
}

impl AccessGate {
    pub fn require_access(&self) -> Result<(), String> {
        let state = self
            .state
            .lock()
            .map_err(|_| "Atris account access state is unavailable.".to_string())?;
        if state.allowed_until_ms <= now_ms() {
            return Err("A verified Atris account is required.".to_string());
        }
        Ok(())
    }
}

#[tauri::command]
pub fn authorize_product_access(
    gate: State<'_, AccessGate>,
    validated_at_ms: u64,
    offline: bool,
) -> Result<AccessStatus, String> {
    let allowed_until_ms = validate_grant(validated_at_ms, offline)?;
    let mut state = gate
        .state
        .lock()
        .map_err(|_| "Atris account access state is unavailable.".to_string())?;
    state.allowed_until_ms = allowed_until_ms;
    state.offline = offline;
    Ok(AccessStatus {
        allowed: true,
        offline,
        allowed_until_ms,
    })
}

#[tauri::command]
pub fn revoke_product_access(gate: State<'_, AccessGate>) -> Result<(), String> {
    let mut state = gate
        .state
        .lock()
        .map_err(|_| "Atris account access state is unavailable.".to_string())?;
    *state = AccessState::default();
    Ok(())
}

#[tauri::command]
pub fn store_session_token(app: AppHandle, token: String) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("Session token cannot be empty.".to_string());
    }
    crate::session_store::save(&app, &token)
}

#[tauri::command]
pub fn read_session_token(app: AppHandle) -> Result<Option<String>, String> {
    crate::session_store::load(&app)
}

#[tauri::command]
pub fn delete_session_token(app: AppHandle) -> Result<(), String> {
    crate::session_store::clear(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_grace_rejects_stale_and_future_timestamps() {
        let now = now_ms();
        assert!(validate_grant(now.saturating_sub(MAX_OFFLINE_GRACE_MS + 1), true).is_err());
        assert!(validate_grant(now.saturating_add(6 * 60 * 1000), false).is_err());
        assert!(validate_grant(now, true).is_ok());
    }
}
