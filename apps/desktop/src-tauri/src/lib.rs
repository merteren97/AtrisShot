use ab_glyph::{point, Font, FontArc, PxScale, ScaleFont};
use arboard::{Clipboard, ImageData};
use image::{Rgba, RgbaImage};
use rand::{distr::Alphanumeric, Rng};
use screenshots::Screen;
use serde::{Deserialize, Serialize};
use std::{
    borrow::Cow,
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Size,
    State, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

mod auth;
mod session_store;

const DEFAULT_SHORTCUT: &str = "Ctrl+Shift+S";
const DEFAULT_OVERLAY_SHORTCUT: &str = "Ctrl+Shift+O";
const ANNOTATION_FONT_BYTES: &[u8] = include_bytes!("../../public/brand/NotoSans-Regular.ttf");

#[derive(Clone, Default)]
struct ShotStore {
    entries: Arc<Mutex<Vec<ShotHistoryEntry>>>,
}

#[derive(Clone, Default)]
struct RegisteredShortcuts {
    capture: Arc<Mutex<Option<Shortcut>>>,
    overlay: Arc<Mutex<Option<Shortcut>>>,
}

static CAPTURE_HIDDEN_WINDOWS: OnceLock<Mutex<Vec<String>>> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DisplayInfo {
    id: String,
    name: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
    primary: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VirtualDisplayBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureOverlayOpenedPayload {
    displays: Vec<DisplayInfo>,
    bounds: VirtualDisplayBounds,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureRegion {
    display_id: String,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowTarget {
    window_id: String,
    title: String,
    region: CaptureRegion,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureRequest {
    mode: String,
    display_id: Option<String>,
    region: Option<CaptureRegion>,
    window_id: Option<String>,
    save_folder: Option<String>,
    clipboard_mode: Option<String>,
    post_capture_action: Option<String>,
    overlay_corner: Option<String>,
    include_cursor: Option<bool>,
    capture_delay_ms: Option<u64>,
    history_limit: Option<usize>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShotHistoryEntry {
    id: String,
    created_at: String,
    mode: String,
    original_path: String,
    edited_path: Option<String>,
    thumbnail_path: Option<String>,
    width: u32,
    height: u32,
    display_name: String,
    region: CaptureRegion,
    annotations_count: u32,
    #[serde(default)]
    edit_revision: u64,
    #[serde(default)]
    annotations: Vec<ShotAnnotation>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShotHistoryEvent {
    kind: String,
    entry: ShotHistoryEntry,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureResult {
    entry: ShotHistoryEntry,
    copied_image: bool,
    copied_path: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureUnavailable {
    code: String,
}

#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
enum EditorMode {
    #[serde(rename = "preview")]
    Preview,
    #[serde(rename = "edit")]
    #[default]
    Edit,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct EditorShotRequestedPayload {
    id: String,
    mode: EditorMode,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnnotationPoint {
    x: f32,
    y: f32,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShotAnnotation {
    id: String,
    tool: String,
    color: String,
    stroke_width: Option<u32>,
    #[serde(default)]
    blur_pixel_size: Option<u32>,
    points: Vec<AnnotationPoint>,
    text: Option<String>,
    font_size: Option<u32>,
}

fn now_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis());
    let suffix: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(8)
        .map(char::from)
        .collect();
    format!("{millis}-{suffix}")
}

fn now_isoish() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs());
    format!("{secs}")
}

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

fn history_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join("history.json"))
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join("settings.json"))
}

fn shots_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_root(app)?.join("shots"))
}

fn capture_root(app: &AppHandle, save_folder: Option<&str>) -> Result<PathBuf, String> {
    let Some(folder) = save_folder.map(str::trim).filter(|value| !value.is_empty()) else {
        return shots_dir(app);
    };
    validate_custom_save_folder(folder)
}

fn normalized_history_limit(limit: Option<usize>) -> usize {
    limit.unwrap_or(100).clamp(10, 500)
}

fn shortcut_value_from_settings_json(contents: &str, key: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(contents).ok()?;
    value
        .get("shotSettings")
        .and_then(|settings| settings.get(key))
        .and_then(|shortcut| shortcut.as_str())
        .map(str::trim)
        .filter(|shortcut| !shortcut.is_empty())
        .map(ToOwned::to_owned)
}

fn shortcut_from_settings_json(contents: &str) -> Option<String> {
    shortcut_value_from_settings_json(contents, "shortcut")
}

fn overlay_shortcut_from_settings_json(contents: &str) -> Option<String> {
    shortcut_value_from_settings_json(contents, "overlayShortcut")
}

fn shortcut_from_settings_file(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| shortcut_from_settings_json(&contents))
}

fn overlay_shortcut_from_settings_file(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| overlay_shortcut_from_settings_json(&contents))
}

fn validate_custom_save_folder(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder.trim());
    if path.as_os_str().is_empty() {
        return Err("Save folder is empty.".to_string());
    }
    if path.exists() && !path.is_dir() {
        return Err("Save folder points to a file, not a folder.".to_string());
    }
    fs::create_dir_all(&path)
        .map_err(|error| format!("Save folder could not be created: {error}"))?;
    path.canonicalize()
        .map_err(|error| format!("Save folder could not be resolved: {error}"))
}

fn display_path(path: &Path) -> String {
    let value = path.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        if let Some(stripped) = value.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{stripped}");
        }
        if let Some(stripped) = value.strip_prefix(r"\\?\") {
            return stripped.to_string();
        }
    }
    value
}

fn resolve_storage_folder(app: &AppHandle, save_folder: Option<&str>) -> Result<PathBuf, String> {
    let Some(folder) = save_folder.map(str::trim).filter(|value| !value.is_empty()) else {
        let path = shots_dir(app)?;
        fs::create_dir_all(&path)
            .map_err(|error| format!("Default save folder could not be created: {error}"))?;
        return Ok(path);
    };
    validate_custom_save_folder(folder)
}

fn remove_history_entry(entries: &mut Vec<ShotHistoryEntry>, id: &str) {
    entries.retain(|entry| entry.id != id);
}

fn remove_history_entries(
    entries: &mut Vec<ShotHistoryEntry>,
    ids: &[String],
) -> Vec<ShotHistoryEntry> {
    let removed = entries
        .iter()
        .filter(|entry| ids.iter().any(|id| id == &entry.id))
        .cloned()
        .collect::<Vec<_>>();
    entries.retain(|entry| !ids.iter().any(|id| id == &entry.id));
    removed
}

fn history_entry_file_paths(entry: &ShotHistoryEntry) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for value in [
        Some(entry.original_path.as_str()),
        entry.edited_path.as_deref(),
        entry.thumbnail_path.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if let Ok(path) = path_from_user_input(value) {
            if !paths.iter().any(|existing| existing == &path) {
                paths.push(path);
            }
        }
    }
    paths
}

fn remove_history_entry_files_checked(entry: &ShotHistoryEntry) -> Result<(), String> {
    for path in history_entry_file_paths(entry) {
        remove_file_if_exists(&path)?;
    }
    Ok(())
}

fn clear_history_entries(entries: &mut Vec<ShotHistoryEntry>) {
    entries.clear();
}

fn load_history_from_disk(app: &AppHandle) -> Vec<ShotHistoryEntry> {
    let Ok(path) = history_path(app) else {
        return Vec::new();
    };
    let Ok(text) = fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn persist_history(app: &AppHandle, entries: &[ShotHistoryEntry]) -> Result<(), String> {
    let path = history_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        path,
        serde_json::to_vec_pretty(entries).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn capturable_screens() -> Result<Vec<Screen>, String> {
    Screen::all().map_err(|error| error.to_string())
}

fn displays() -> Result<Vec<DisplayInfo>, String> {
    let screens = capturable_screens()
        .map_err(|error| format!("No capturable display is available: {error}"))?;
    if screens.is_empty() {
        return Err("No capturable display is available.".to_string());
    }
    let has_primary = screens.iter().any(|screen| screen.display_info.is_primary);
    Ok(screens
        .into_iter()
        .enumerate()
        .map(|(index, screen)| {
            let info = screen.display_info;
            DisplayInfo {
                id: format!("capture-{}", info.id),
                primary: info.is_primary || (!has_primary && index == 0),
                name: format!("Display {}", index + 1),
                x: info.x,
                y: info.y,
                width: info.width,
                height: info.height,
                scale_factor: f64::from(info.scale_factor),
            }
        })
        .collect())
}

fn path_is_inside(path: &Path, root: &Path) -> bool {
    path.starts_with(root)
}

fn virtual_display_bounds(displays: &[DisplayInfo]) -> Option<(i32, i32, u32, u32)> {
    if displays.is_empty() {
        return None;
    }
    let left = displays.iter().map(|display| display.x).min()?;
    let top = displays.iter().map(|display| display.y).min()?;
    let right = displays
        .iter()
        .map(|display| display.x + display.width as i32)
        .max()?;
    let bottom = displays
        .iter()
        .map(|display| display.y + display.height as i32)
        .max()?;
    Some((
        left,
        top,
        right.saturating_sub(left).max(1) as u32,
        bottom.saturating_sub(top).max(1) as u32,
    ))
}

fn capture_virtual_region(region: &CaptureRegion) -> Result<RgbaImage, String> {
    let screens = capturable_screens()?;
    let mut output = RgbaImage::from_pixel(
        region.width.max(1),
        region.height.max(1),
        Rgba([0, 0, 0, 255]),
    );
    let requested_right = region.x.saturating_add(region.width as i32);
    let requested_bottom = region.y.saturating_add(region.height as i32);
    let mut captured = false;

    for screen in screens {
        let info = screen.display_info;
        let screen_right = info.x.saturating_add(info.width as i32);
        let screen_bottom = info.y.saturating_add(info.height as i32);
        let left = region.x.max(info.x);
        let top = region.y.max(info.y);
        let right = requested_right.min(screen_right);
        let bottom = requested_bottom.min(screen_bottom);
        if right <= left || bottom <= top {
            continue;
        }
        let part = screen
            .capture_area(
                left - info.x,
                top - info.y,
                (right - left) as u32,
                (bottom - top) as u32,
            )
            .map_err(|error| error.to_string())?;
        for y in 0..(bottom - top) as u32 {
            for x in 0..(right - left) as u32 {
                output.put_pixel(
                    (left - region.x) as u32 + x,
                    (top - region.y) as u32 + y,
                    *part.get_pixel(x, y),
                );
            }
        }
        captured = true;
    }

    if captured {
        Ok(output)
    } else {
        Err("The requested capture region is outside the available displays.".to_string())
    }
}

fn capture_hidden_windows_store() -> &'static Mutex<Vec<String>> {
    CAPTURE_HIDDEN_WINDOWS.get_or_init(|| Mutex::new(Vec::new()))
}

fn configure_capture_exclusion(app: &AppHandle) {
    for label in ["main", "editor", "overlay", "capture"] {
        if let Some(_window) = app.get_webview_window(label) {
            #[cfg(target_os = "windows")]
            if let Ok(hwnd) = _window.hwnd() {
                use windows_sys::Win32::UI::WindowsAndMessaging::{
                    SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE,
                };
                unsafe {
                    let _ = SetWindowDisplayAffinity(hwnd.0 as _, WDA_EXCLUDEFROMCAPTURE);
                }
            }
        }
    }
}

fn flush_capture_compositor() {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Graphics::Dwm::DwmFlush;
        let _ = DwmFlush();
    }
    thread::sleep(Duration::from_millis(24));
}

fn hide_internal_windows_for_capture(app: &AppHandle) {
    configure_capture_exclusion(app);
    let Ok(mut hidden_labels) = capture_hidden_windows_store().lock() else {
        return;
    };
    if !hidden_labels.is_empty() {
        return;
    }
    for label in ["main", "editor", "overlay"] {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            hidden_labels.push(label.to_string());
        }
    }
    flush_capture_compositor();
}

fn restore_internal_windows_after_capture(app: &AppHandle) {
    let labels = capture_hidden_windows_store()
        .lock()
        .map(|mut hidden_labels| std::mem::take(&mut *hidden_labels))
        .unwrap_or_default();
    for label in labels {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.show();
        }
    }
    flush_capture_compositor();
}

#[cfg(target_os = "windows")]
fn window_target_at_cursor_native() -> Option<WindowTarget> {
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, POINT, RECT},
        Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS},
        UI::WindowsAndMessaging::{
            EnumWindows, GetCursorPos, GetWindow, GetWindowLongW, GetWindowTextLengthW,
            GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible, GWL_EXSTYLE,
            GW_OWNER, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
        },
    };

    struct SearchState {
        point: POINT,
        process_id: u32,
        target: Option<WindowTarget>,
    }

    unsafe fn title(hwnd: HWND) -> String {
        let length = GetWindowTextLengthW(hwnd);
        if length <= 0 {
            return String::new();
        }
        let mut buffer = vec![0_u16; length as usize + 1];
        let read = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        if read <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buffer[..read as usize])
    }

    unsafe fn frame_bounds(hwnd: HWND) -> Option<RECT> {
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            (&mut rect as *mut RECT).cast(),
            std::mem::size_of::<RECT>() as u32,
        ) == 0
        {
            Some(rect)
        } else {
            None
        }
    }

    unsafe extern "system" fn visit(hwnd: HWND, parameter: LPARAM) -> i32 {
        let state = &mut *(parameter as *mut SearchState);
        if hwnd.is_null() || IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
            return 1;
        }
        let mut process_id = 0_u32;
        GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id == 0 || process_id == state.process_id {
            return 1;
        }
        let style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if style & WS_EX_TOOLWINDOW != 0 && style & WS_EX_APPWINDOW == 0 {
            return 1;
        }
        let mut cloaked = 0_u32;
        if DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED as u32,
            (&mut cloaked as *mut u32).cast(),
            std::mem::size_of::<u32>() as u32,
        ) == 0
            && cloaked != 0
        {
            return 1;
        }
        let Some(rect) = frame_bounds(hwnd) else {
            return 1;
        };
        if state.point.x < rect.left
            || state.point.x >= rect.right
            || state.point.y < rect.top
            || state.point.y >= rect.bottom
        {
            return 1;
        }
        let width = rect.right.saturating_sub(rect.left);
        let height = rect.bottom.saturating_sub(rect.top);
        if width < 32 || height < 32 || !GetWindow(hwnd, GW_OWNER).is_null() {
            return 1;
        }
        state.target = Some(WindowTarget {
            window_id: (hwnd as usize).to_string(),
            title: title(hwnd),
            region: CaptureRegion {
                display_id: "clicked-window".to_string(),
                x: rect.left,
                y: rect.top,
                width: width as u32,
                height: height as u32,
            },
        });
        0
    }

    unsafe {
        let mut point = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut point) == 0 {
            return None;
        }
        let mut state = SearchState {
            point,
            process_id: std::process::id(),
            target: None,
        };
        let _ = EnumWindows(Some(visit), (&mut state as *mut SearchState) as isize);
        state.target
    }
}

#[cfg(not(target_os = "windows"))]
fn window_target_at_cursor_native() -> Option<WindowTarget> {
    None
}

fn copy_image_to_clipboard(width: u32, height: u32, bytes: Vec<u8>) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_image(ImageData {
            width: width as usize,
            height: height as usize,
            bytes: Cow::Owned(bytes),
        })
        .map_err(|error| error.to_string())
}

fn copy_text_to_clipboard(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(text.to_string())
        .map_err(|error| error.to_string())
}

fn existing_path_from_user_input(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("Shot path is empty.".to_string());
    }
    if !path.exists() {
        return Err("Shot file does not exist.".to_string());
    }
    Ok(path)
}

fn path_from_user_input(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("Shot path is empty.".to_string());
    }
    Ok(path)
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = *chunk.get(1).unwrap_or(&0);
        let third = *chunk.get(2).unwrap_or(&0);
        encoded.push(TABLE[(first >> 2) as usize] as char);
        encoded.push(TABLE[(((first & 0b0000_0011) << 4) | (second >> 4)) as usize] as char);
        if chunk.len() > 1 {
            encoded.push(TABLE[(((second & 0b0000_1111) << 2) | (third >> 6)) as usize] as char);
        } else {
            encoded.push('=');
        }
        if chunk.len() > 2 {
            encoded.push(TABLE[(third & 0b0011_1111) as usize] as char);
        } else {
            encoded.push('=');
        }
    }
    encoded
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn reveal_path(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(format!("/select,{}", path.to_string_lossy()))
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_folder(path: &Path) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn reveal_path(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_folder(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn reveal_path(path: &Path) -> Result<(), String> {
    let target = path.parent().unwrap_or(path);
    Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn open_folder(path: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn parse_color(value: &str, alpha: u8) -> Rgba<u8> {
    let hex = value.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return Rgba([14, 165, 233, alpha]);
    }
    let red = u8::from_str_radix(&hex[0..2], 16).unwrap_or(14);
    let green = u8::from_str_radix(&hex[2..4], 16).unwrap_or(165);
    let blue = u8::from_str_radix(&hex[4..6], 16).unwrap_or(233);
    Rgba([red, green, blue, alpha])
}

fn blend_pixel(image: &mut RgbaImage, x: i32, y: i32, color: Rgba<u8>) {
    if x < 0 || y < 0 || x >= image.width() as i32 || y >= image.height() as i32 {
        return;
    }
    let pixel = image.get_pixel_mut(x as u32, y as u32);
    let alpha = color[3] as f32 / 255.0;
    for channel in 0..3 {
        pixel[channel] =
            ((color[channel] as f32 * alpha) + (pixel[channel] as f32 * (1.0 - alpha))) as u8;
    }
    pixel[3] = 255;
}

fn draw_thick_point(image: &mut RgbaImage, x: i32, y: i32, color: Rgba<u8>, radius: i32) {
    for dy in -radius..=radius {
        for dx in -radius..=radius {
            if dx * dx + dy * dy <= radius * radius {
                blend_pixel(image, x + dx, y + dy, color);
            }
        }
    }
}

fn draw_line(
    image: &mut RgbaImage,
    start: &AnnotationPoint,
    end: &AnnotationPoint,
    color: Rgba<u8>,
    stroke_width: u32,
) {
    let mut x0 = start.x.round() as i32;
    let mut y0 = start.y.round() as i32;
    let x1 = end.x.round() as i32;
    let y1 = end.y.round() as i32;
    let dx = (x1 - x0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let dy = -(y1 - y0).abs();
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut error = dx + dy;
    let radius = (stroke_width.max(1) as i32) / 2;
    loop {
        draw_thick_point(image, x0, y0, color, radius.max(1));
        if x0 == x1 && y0 == y1 {
            break;
        }
        let twice = 2 * error;
        if twice >= dy {
            error += dy;
            x0 += sx;
        }
        if twice <= dx {
            error += dx;
            y0 += sy;
        }
    }
}

fn point_in_triangle(
    point: (f32, f32),
    first: (f32, f32),
    second: (f32, f32),
    third: (f32, f32),
) -> bool {
    let sign = |a: (f32, f32), b: (f32, f32), c: (f32, f32)| {
        (a.0 - c.0) * (b.1 - c.1) - (b.0 - c.0) * (a.1 - c.1)
    };
    let first_sign = sign(point, first, second);
    let second_sign = sign(point, second, third);
    let third_sign = sign(point, third, first);
    let has_negative = first_sign < 0.0 || second_sign < 0.0 || third_sign < 0.0;
    let has_positive = first_sign > 0.0 || second_sign > 0.0 || third_sign > 0.0;
    !(has_negative && has_positive)
}

fn draw_filled_triangle(
    image: &mut RgbaImage,
    tip: (f32, f32),
    first_corner: (f32, f32),
    second_corner: (f32, f32),
    color: Rgba<u8>,
) {
    let min_x = tip.0.min(first_corner.0).min(second_corner.0).floor() as i32;
    let max_x = tip.0.max(first_corner.0).max(second_corner.0).ceil() as i32;
    let min_y = tip.1.min(first_corner.1).min(second_corner.1).floor() as i32;
    let max_y = tip.1.max(first_corner.1).max(second_corner.1).ceil() as i32;

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            if point_in_triangle(
                (x as f32 + 0.5, y as f32 + 0.5),
                tip,
                first_corner,
                second_corner,
            ) {
                blend_pixel(image, x, y, color);
            }
        }
    }
}

fn draw_arrow(
    image: &mut RgbaImage,
    start: &AnnotationPoint,
    end: &AnnotationPoint,
    color: Rgba<u8>,
    stroke_width: u32,
) {
    draw_line(image, start, end, color, stroke_width);
    let delta_x = end.x - start.x;
    let delta_y = end.y - start.y;
    let distance = delta_x.hypot(delta_y);
    if distance < 1.0 {
        return;
    }

    let unit_x = delta_x / distance;
    let unit_y = delta_y / distance;
    let head_length = (18.0 + stroke_width as f32 * 2.0).min(distance * 0.45);
    let base_x = end.x - unit_x * head_length;
    let base_y = end.y - unit_y * head_length;
    let half_width = head_length * 0.45;
    let perpendicular_x = -unit_y * half_width;
    let perpendicular_y = unit_x * half_width;

    draw_filled_triangle(
        image,
        (end.x, end.y),
        (base_x + perpendicular_x, base_y + perpendicular_y),
        (base_x - perpendicular_x, base_y - perpendicular_y),
        color,
    );
}

fn draw_rect(
    image: &mut RgbaImage,
    start: &AnnotationPoint,
    end: &AnnotationPoint,
    color: Rgba<u8>,
    stroke_width: u32,
) {
    let left = start.x.min(end.x);
    let right = start.x.max(end.x);
    let top = start.y.min(end.y);
    let bottom = start.y.max(end.y);
    let top_left = AnnotationPoint { x: left, y: top };
    let top_right = AnnotationPoint { x: right, y: top };
    let bottom_left = AnnotationPoint { x: left, y: bottom };
    let bottom_right = AnnotationPoint {
        x: right,
        y: bottom,
    };
    draw_line(image, &top_left, &top_right, color, stroke_width);
    draw_line(image, &top_right, &bottom_right, color, stroke_width);
    draw_line(image, &bottom_right, &bottom_left, color, stroke_width);
    draw_line(image, &bottom_left, &top_left, color, stroke_width);
}

fn draw_ellipse(
    image: &mut RgbaImage,
    start: &AnnotationPoint,
    end: &AnnotationPoint,
    color: Rgba<u8>,
    stroke_width: u32,
) {
    let left = start.x.min(end.x);
    let right = start.x.max(end.x);
    let top = start.y.min(end.y);
    let bottom = start.y.max(end.y);
    let radius_x = ((right - left) / 2.0).max(1.0);
    let radius_y = ((bottom - top) / 2.0).max(1.0);
    let center_x = left + radius_x;
    let center_y = top + radius_y;
    let circumference = std::f32::consts::TAU * radius_x.max(radius_y);
    let steps = circumference.max(48.0).round() as u32;
    let mut previous: Option<AnnotationPoint> = None;

    for step in 0..=steps {
        let angle = std::f32::consts::TAU * (step as f32 / steps as f32);
        let point = AnnotationPoint {
            x: center_x + radius_x * angle.cos(),
            y: center_y + radius_y * angle.sin(),
        };
        if let Some(previous_point) = previous {
            draw_line(image, &previous_point, &point, color, stroke_width);
        }
        previous = Some(point);
    }
}

fn pixelate_region(
    image: &mut RgbaImage,
    start: &AnnotationPoint,
    end: &AnnotationPoint,
    stroke_width: u32,
) {
    let left = start.x.min(end.x).max(0.0) as u32;
    let top = start.y.min(end.y).max(0.0) as u32;
    let right = start.x.max(end.x).min(image.width() as f32) as u32;
    let bottom = start.y.max(end.y).min(image.height() as f32) as u32;
    let block = stroke_width.clamp(4, 48);
    let mut y = top;
    while y < bottom {
        let mut x = left;
        while x < right {
            let max_x = (x + block).min(right);
            let max_y = (y + block).min(bottom);
            let mut sum = [0_u32; 4];
            let mut count = 0_u32;
            for py in y..max_y {
                for px in x..max_x {
                    let pixel = image.get_pixel(px, py);
                    for channel in 0..4 {
                        sum[channel] += pixel[channel] as u32;
                    }
                    count += 1;
                }
            }
            if let (Some(red), Some(green), Some(blue), Some(alpha)) = (
                sum[0].checked_div(count),
                sum[1].checked_div(count),
                sum[2].checked_div(count),
                sum[3].checked_div(count),
            ) {
                let color = Rgba([red as u8, green as u8, blue as u8, alpha as u8]);
                for py in y..max_y {
                    for px in x..max_x {
                        image.put_pixel(px, py, color);
                    }
                }
            }
            x += block;
        }
        y += block;
    }
}

fn draw_text(
    image: &mut RgbaImage,
    origin: &AnnotationPoint,
    max_width: f32,
    max_height: f32,
    text: &str,
    color: Rgba<u8>,
    font_size: u32,
) {
    let font_size = font_size.clamp(12, 64) as f32;
    let font = FontArc::try_from_slice(ANNOTATION_FONT_BYTES)
        .expect("bundled annotation font must be valid");
    let scaled = font.as_scaled(PxScale::from(font_size));
    let origin_x = origin.x;
    let right = origin_x + max_width.max(font_size * 2.5);
    let bottom = origin.y + max_height.max(font_size * 1.35);
    let line_height = font_size * 1.35;
    let mut x = origin_x;
    let mut baseline = origin.y + font_size;

    for character in text.chars().take(300) {
        if character == '\n' {
            x = origin_x;
            baseline += line_height;
            continue;
        }

        let glyph_id = scaled.glyph_id(character);
        let advance = scaled.h_advance(glyph_id);
        if x > origin_x && x + advance > right {
            x = origin_x;
            baseline += line_height;
        }

        let glyph = glyph_id.with_scale_and_position(font_size, point(x, baseline));
        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|glyph_x, glyph_y, coverage| {
                let pixel_x = bounds.min.x.floor() as i32 + glyph_x as i32;
                let pixel_y = bounds.min.y.floor() as i32 + glyph_y as i32;
                if (pixel_x as f32) < origin_x
                    || (pixel_x as f32) >= right
                    || (pixel_y as f32) < origin.y
                    || (pixel_y as f32) >= bottom
                {
                    return;
                }
                let mut glyph_color = color;
                glyph_color[3] = (f32::from(color[3]) * coverage).round() as u8;
                blend_pixel(image, pixel_x, pixel_y, glyph_color);
            });
        }
        x += advance;
        if x >= right {
            x = origin_x;
            baseline += line_height;
        }
        if baseline > bottom + line_height {
            break;
        }
    }
}

fn render_annotations(
    original_path: &Path,
    edited_path: &Path,
    annotations: &[ShotAnnotation],
) -> Result<(), String> {
    let mut image = image::open(original_path)
        .map_err(|error| error.to_string())?
        .to_rgba8();
    for annotation in annotations {
        let Some(start) = annotation.points.first() else {
            continue;
        };
        let end = annotation.points.get(1).unwrap_or(start);
        let stroke_width = annotation.stroke_width.unwrap_or(3).max(1);
        let color = parse_color(&annotation.color, 245);
        match annotation.tool.as_str() {
            "rectangle" => draw_rect(&mut image, start, end, color, stroke_width),
            "ellipse" => draw_ellipse(&mut image, start, end, color, stroke_width),
            "line" => draw_line(&mut image, start, end, color, stroke_width),
            "arrow" => draw_arrow(&mut image, start, end, color, stroke_width),
            "pen" => {
                for pair in annotation.points.windows(2) {
                    draw_line(&mut image, &pair[0], &pair[1], color, stroke_width);
                }
            }
            "blur" => pixelate_region(
                &mut image,
                start,
                end,
                annotation.blur_pixel_size.unwrap_or(stroke_width),
            ),
            "text" => {
                let text = annotation.text.as_deref().unwrap_or("").trim();
                if !text.is_empty() {
                    let origin = AnnotationPoint {
                        x: start.x.min(end.x),
                        y: start.y.min(end.y),
                    };
                    draw_text(
                        &mut image,
                        &origin,
                        (end.x - start.x).abs().max(40.0),
                        (end.y - start.y).abs().max(32.0),
                        text,
                        color,
                        annotation.font_size.unwrap_or(24).clamp(12, 64),
                    );
                }
            }
            _ => draw_rect(&mut image, start, end, color, stroke_width),
        }
    }
    if let Some(parent) = edited_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    image.save(edited_path).map_err(|error| error.to_string())
}

fn edited_path_for(original_path: &Path, id: &str) -> PathBuf {
    let parent = original_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = original_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("atrisshot");
    parent.join(format!("{stem}-edited-{id}.png"))
}

fn thumbnail_path_for(image_path: &Path, id: &str) -> PathBuf {
    let parent = image_path.parent().unwrap_or_else(|| Path::new(""));
    let stem = image_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("atrisshot");
    parent.join(format!("{stem}-thumb-{id}.png"))
}

fn write_thumbnail(image_path: &Path, id: &str) -> Result<PathBuf, String> {
    let thumbnail_path = thumbnail_path_for(image_path, id);
    let image = image::open(image_path).map_err(|error| error.to_string())?;
    let thumbnail = image.thumbnail(480, 270);
    if let Some(parent) = thumbnail_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    thumbnail
        .save(&thumbnail_path)
        .map_err(|error| error.to_string())?;
    Ok(thumbnail_path)
}

#[tauri::command]
fn list_displays(_app: AppHandle) -> Vec<DisplayInfo> {
    displays().unwrap_or_default()
}

#[tauri::command]
fn list_shot_history(
    app: AppHandle,
    store: State<'_, ShotStore>,
) -> Result<Vec<ShotHistoryEntry>, String> {
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    Ok(entries.clone())
}

#[tauri::command]
fn capture_shot(
    app: AppHandle,
    store: State<'_, ShotStore>,
    access: State<'_, auth::AccessGate>,
    request: CaptureRequest,
) -> Result<CaptureResult, String> {
    access.require_access()?;
    let all_displays = displays()?;
    let requested_display = request
        .display_id
        .as_ref()
        .and_then(|id| all_displays.iter().find(|candidate| &candidate.id == id))
        .cloned();
    let mut window_title = None;
    let region = if request.mode == "window" {
        let target = window_target_at_cursor_native()
            .ok_or_else(|| "No visible application window is under the cursor.".to_string())?;
        if request
            .window_id
            .as_deref()
            .is_some_and(|window_id| window_id != target.window_id)
        {
            return Err("The selected application window changed before capture.".to_string());
        }
        window_title = Some(target.title);
        target.region
    } else {
        request.region.unwrap_or_else(|| {
            let display = requested_display
                .clone()
                .or_else(|| all_displays.first().cloned())
                .unwrap_or(DisplayInfo {
                    id: "display-1".to_string(),
                    name: "Display 1".to_string(),
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1,
                    scale_factor: 1.0,
                    primary: true,
                });
            CaptureRegion {
                display_id: display.id,
                x: display.x,
                y: display.y,
                width: display.width,
                height: display.height,
            }
        })
    };
    let display = requested_display
        .or_else(|| {
            let center_x = region.x + region.width as i32 / 2;
            let center_y = region.y + region.height as i32 / 2;
            all_displays
                .iter()
                .find(|candidate| {
                    center_x >= candidate.x
                        && center_x < candidate.x + candidate.width as i32
                        && center_y >= candidate.y
                        && center_y < candidate.y + candidate.height as i32
                })
                .cloned()
        })
        .or_else(|| all_displays.first().cloned())
        .ok_or("No display is available for capture.")?;
    let id = now_id();
    let root = capture_root(&app, request.save_folder.as_deref())?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let path = root.join(format!("atrisshot-{id}.png"));
    if request
        .save_folder
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
        && !path_is_inside(&path, &app_data_root(&app)?)
    {
        return Err("Shot path must stay inside the AtrisShot data directory.".to_string());
    }
    let captured_region = region.clone();

    let _include_cursor = request.include_cursor.unwrap_or(false);
    hide_capture_overlay_window(&app);
    flush_capture_compositor();
    thread::sleep(Duration::from_millis(
        request.capture_delay_ms.unwrap_or(0).min(10_000),
    ));

    let image_result = capture_virtual_region(&captured_region);
    restore_internal_windows_after_capture(&app);
    let image = match image_result {
        Ok(image) => image,
        Err(error) => {
            let _ = app.emit(
                "capture-unavailable",
                CaptureUnavailable {
                    code: "capture-failed".to_string(),
                },
            );
            restore_main_window(&app);
            return Err(error);
        }
    };
    image.save(&path).map_err(|error| error.to_string())?;
    let clipboard_mode = request.clipboard_mode.as_deref().unwrap_or("off");
    let mut copied_image = false;
    let mut copied_path = false;
    if clipboard_mode == "image" {
        copied_image =
            copy_image_to_clipboard(image.width(), image.height(), image.as_raw().clone()).is_ok();
    } else if clipboard_mode == "path" {
        copied_path = copy_text_to_clipboard(&display_path(&path)).is_ok();
    }
    let thumbnail_path = write_thumbnail(&path, &id).ok();
    let entry = ShotHistoryEntry {
        id,
        created_at: now_isoish(),
        mode: request.mode,
        original_path: display_path(&path),
        edited_path: None,
        thumbnail_path: thumbnail_path.map(|path| display_path(&path)),
        width: image.width(),
        height: image.height(),
        display_name: window_title.unwrap_or(display.name),
        region: captured_region,
        annotations_count: 0,
        edit_revision: 0,
        annotations: Vec::new(),
    };
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    entries.insert(0, entry.clone());
    entries.truncate(normalized_history_limit(request.history_limit));
    persist_history(&app, &entries)?;
    let _ = app.emit(
        "shot-captured",
        ShotHistoryEvent {
            kind: "created".to_string(),
            entry: entry.clone(),
        },
    );
    match request
        .post_capture_action
        .as_deref()
        .unwrap_or("corner-overlay")
    {
        "open-editor" => open_editor_window(app.clone(), entry.id.clone(), None),
        "save-silently" => {}
        _ => show_overlay(app.clone(), request.overlay_corner.clone()),
    }
    Ok(CaptureResult {
        entry,
        copied_image,
        copied_path,
    })
}

#[tauri::command]
fn delete_shot(
    app: AppHandle,
    store: State<'_, ShotStore>,
    id: String,
) -> Result<Vec<ShotHistoryEntry>, String> {
    let mut entry_to_remove = None;
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    if let Some(entry) = entries.iter().find(|entry| entry.id == id) {
        entry_to_remove = Some(entry.clone());
    }
    if let Some(entry) = &entry_to_remove {
        remove_history_entry_files_checked(entry)?;
    }
    remove_history_entry(&mut entries, &id);
    persist_history(&app, &entries)?;
    Ok(entries.clone())
}

#[tauri::command]
fn delete_shots(
    app: AppHandle,
    store: State<'_, ShotStore>,
    ids: Vec<String>,
) -> Result<Vec<ShotHistoryEntry>, String> {
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    let requested = entries
        .iter()
        .filter(|entry| ids.iter().any(|id| id == &entry.id))
        .cloned()
        .collect::<Vec<_>>();
    for entry in &requested {
        remove_history_entry_files_checked(entry)?;
    }
    let removed = remove_history_entries(&mut entries, &ids);
    persist_history(&app, &entries)?;
    let remaining = entries.clone();
    drop(entries);
    if removed.len() != requested.len() {
        return Err("Shot history changed during deletion.".to_string());
    }
    Ok(remaining)
}

#[tauri::command]
fn clear_shot_history(
    app: AppHandle,
    store: State<'_, ShotStore>,
) -> Result<Vec<ShotHistoryEntry>, String> {
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    let removed = entries.clone();
    for entry in &removed {
        remove_history_entry_files_checked(entry)?;
    }
    clear_history_entries(&mut entries);
    persist_history(&app, &entries)?;
    let remaining = entries.clone();
    drop(entries);
    Ok(remaining)
}

#[tauri::command]
fn latest_shot(
    app: AppHandle,
    store: State<'_, ShotStore>,
) -> Result<Option<ShotHistoryEntry>, String> {
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    Ok(entries.first().cloned())
}

#[tauri::command]
fn apply_annotations(
    app: AppHandle,
    store: State<'_, ShotStore>,
    id: String,
    annotations_json: String,
) -> Result<ShotHistoryEntry, String> {
    let annotations = serde_json::from_str::<Vec<ShotAnnotation>>(&annotations_json)
        .map_err(|error| format!("Annotation payload could not be read: {error}"))?;
    let annotations_count = annotations.len() as u32;
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    let entry = entries
        .iter_mut()
        .find(|entry| entry.id == id)
        .ok_or("Shot entry was not found.")?;
    let original_path = PathBuf::from(&entry.original_path);
    let edited_path = edited_path_for(&original_path, &entry.id);
    render_annotations(&original_path, &edited_path, &annotations)?;
    let thumbnail_path = write_thumbnail(&edited_path, &entry.id).ok();
    entry.annotations_count = annotations_count;
    entry.edit_revision = entry.edit_revision.saturating_add(1);
    entry.annotations = annotations;
    entry.edited_path = Some(display_path(&edited_path));
    entry.thumbnail_path = thumbnail_path.map(|path| display_path(&path));
    let next = entry.clone();
    persist_history(&app, &entries)?;
    let _ = app.emit(
        "shot-captured",
        ShotHistoryEvent {
            kind: "updated".to_string(),
            entry: next.clone(),
        },
    );
    Ok(next)
}

#[tauri::command]
fn reveal_shot(path: String) -> Result<(), String> {
    let path = existing_path_from_user_input(&path)?;
    reveal_path(&path)
}

#[tauri::command]
fn copy_shot_path(path: String) -> Result<(), String> {
    let path = path_from_user_input(&path)?;
    copy_text_to_clipboard(&display_path(&path))
}

#[tauri::command]
fn copy_shot_image(app: AppHandle, store: State<'_, ShotStore>, id: String) -> Result<(), String> {
    let mut entries = store
        .entries
        .lock()
        .map_err(|_| "Shot history state is unavailable.".to_string())?;
    if entries.is_empty() {
        *entries = load_history_from_disk(&app);
    }
    let entry = entries
        .iter()
        .find(|entry| entry.id == id)
        .cloned()
        .ok_or_else(|| "Screenshot was not found in local history.".to_string())?;
    drop(entries);

    let path = entry.edited_path.as_ref().unwrap_or(&entry.original_path);
    let image = image::open(existing_path_from_user_input(path)?)
        .map_err(|error| error.to_string())?
        .to_rgba8();
    copy_image_to_clipboard(image.width(), image.height(), image.into_raw())
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    path_from_user_input(&path)
        .map(|path| path.is_file())
        .unwrap_or(false)
}

#[tauri::command]
fn window_target_at_cursor() -> Option<WindowTarget> {
    window_target_at_cursor_native()
}

#[tauri::command]
fn read_shot_data_url(path: String) -> Result<String, String> {
    let path = existing_path_from_user_input(&path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > 32 * 1024 * 1024 {
        return Err("Shot file is too large to preview in the editor.".to_string());
    }
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    Ok(format!("data:image/png;base64,{}", base64_encode(&bytes)))
}

#[tauri::command]
fn remove_local_data(app: AppHandle, store: State<'_, ShotStore>) -> Result<(), String> {
    hide_overlay(app.clone());
    hide_capture_overlay(app.clone());

    {
        let mut entries = store
            .entries
            .lock()
            .map_err(|_| "Shot history state is unavailable.".to_string())?;
        clear_history_entries(&mut entries);
    }

    remove_file_if_exists(&history_path(&app)?)?;
    remove_dir_if_exists(&shots_dir(&app)?)?;
    remove_file_if_exists(&app_data_root(&app)?.join("settings.json"))?;
    Ok(())
}

#[tauri::command]
fn validate_save_folder(app: AppHandle, save_folder: String) -> Result<String, String> {
    if save_folder.trim().is_empty() {
        let path = resolve_storage_folder(&app, None)?;
        if !path_is_inside(&path, &app_data_root(&app)?) {
            return Err("Default save folder must stay inside AtrisShot app data.".to_string());
        }
        return Ok(String::new());
    }
    Ok(display_path(&resolve_storage_folder(
        &app,
        Some(&save_folder),
    )?))
}

#[tauri::command]
fn open_storage_folder(app: AppHandle, save_folder: String) -> Result<(), String> {
    let path = resolve_storage_folder(&app, Some(&save_folder))?;
    open_folder(&path)
}

fn register_capture_shortcut(app: &AppHandle, shortcut: &str) -> Result<Shortcut, String> {
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|error| format!("Invalid shortcut: {error}"))?;
    app.global_shortcut()
        .on_shortcut(parsed, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                show_capture_overlay(app.clone());
            }
        })
        .map_err(|error| format!("Shortcut is unavailable: {error}"))?;
    Ok(parsed)
}

fn register_overlay_shortcut(app: &AppHandle, shortcut: &str) -> Result<Shortcut, String> {
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|error| format!("Invalid shortcut: {error}"))?;
    app.global_shortcut()
        .on_shortcut(parsed, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_overlay(app.clone(), None);
            }
        })
        .map_err(|error| format!("Shortcut is unavailable: {error}"))?;
    Ok(parsed)
}

fn shortcuts_conflict(left: &str, right: &str) -> bool {
    match (left.parse::<Shortcut>(), right.parse::<Shortcut>()) {
        (Ok(left), Ok(right)) => left.id() == right.id(),
        _ => left.trim().eq_ignore_ascii_case(right.trim()),
    }
}

fn active_shortcut(slot: &Mutex<Option<Shortcut>>) -> Option<Shortcut> {
    slot.lock().ok().and_then(|value| *value)
}

fn set_active_shortcut(slot: &Mutex<Option<Shortcut>>, value: Option<Shortcut>) {
    if let Ok(mut active) = slot.lock() {
        *active = value;
    }
}

fn shortcut_is_distinct(candidate: &str, active: Option<Shortcut>) -> bool {
    candidate
        .parse::<Shortcut>()
        .map(|parsed| active.map_or(true, |current| parsed.id() != current.id()))
        .unwrap_or(false)
}

#[tauri::command]
fn save_shortcut(
    app: AppHandle,
    state: State<'_, RegisteredShortcuts>,
    shortcut: String,
    previous_shortcut: Option<String>,
) -> Result<String, String> {
    let _ = previous_shortcut;
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|error| format!("Invalid shortcut: {error}"))?;
    let current = active_shortcut(&state.capture);
    let overlay_shortcut = settings_path(&app)
        .ok()
        .and_then(|path| overlay_shortcut_from_settings_file(&path))
        .unwrap_or_else(|| DEFAULT_OVERLAY_SHORTCUT.to_string());
    let overlay_active = active_shortcut(&state.overlay);
    if shortcuts_conflict(&shortcut, &overlay_shortcut)
        || overlay_active.is_some_and(|active| parsed.id() == active.id())
    {
        return Err("Capture and overlay shortcuts must be different.".to_string());
    }
    if current.is_some_and(|active| active.id() == parsed.id()) {
        return Ok(shortcut);
    }

    let registered = register_capture_shortcut(&app, &shortcut)?;
    if let Some(previous) = current {
        if let Err(error) = app.global_shortcut().unregister(previous) {
            let _ = app.global_shortcut().unregister(registered);
            return Err(format!("Previous shortcut could not be replaced: {error}"));
        }
    }

    set_active_shortcut(&state.capture, Some(registered));
    Ok(shortcut)
}

#[tauri::command]
fn save_overlay_shortcut(
    app: AppHandle,
    state: State<'_, RegisteredShortcuts>,
    shortcut: String,
    previous_shortcut: Option<String>,
) -> Result<String, String> {
    let _ = previous_shortcut;
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|error| format!("Invalid shortcut: {error}"))?;
    let current = active_shortcut(&state.overlay);
    let capture_shortcut = settings_path(&app)
        .ok()
        .and_then(|path| shortcut_from_settings_file(&path))
        .unwrap_or_else(|| DEFAULT_SHORTCUT.to_string());
    let capture_active = active_shortcut(&state.capture);
    if shortcuts_conflict(&shortcut, &capture_shortcut)
        || capture_active.is_some_and(|active| parsed.id() == active.id())
    {
        return Err("Capture and overlay shortcuts must be different.".to_string());
    }
    if current.is_some_and(|active| active.id() == parsed.id()) {
        return Ok(shortcut);
    }

    let registered = register_overlay_shortcut(&app, &shortcut)?;
    if let Some(previous) = current {
        if let Err(error) = app.global_shortcut().unregister(previous) {
            let _ = app.global_shortcut().unregister(registered);
            return Err(format!("Previous shortcut could not be replaced: {error}"));
        }
    }

    set_active_shortcut(&state.overlay, Some(registered));
    Ok(shortcut)
}

fn overlay_position(
    corner: &str,
    monitor_position: &PhysicalPosition<i32>,
    monitor_size: &PhysicalSize<u32>,
    window_size: &PhysicalSize<u32>,
) -> PhysicalPosition<i32> {
    let margin = 24;
    let bottom_margin = 72;
    let right = monitor_position.x
        + monitor_size
            .width
            .saturating_sub(window_size.width + margin as u32) as i32;
    let left = monitor_position.x + margin;
    let top = monitor_position.y + margin;
    let bottom = monitor_position.y
        + monitor_size
            .height
            .saturating_sub(window_size.height + bottom_margin as u32) as i32;
    match corner {
        "bottom-right" => PhysicalPosition {
            x: right,
            y: bottom,
        },
        "top-left" => PhysicalPosition { x: left, y: top },
        "top-right" => PhysicalPosition { x: right, y: top },
        _ => PhysicalPosition { x: left, y: bottom },
    }
}

fn overlay_target_size(width: f64, height: f64, scale_factor: f64) -> PhysicalSize<u32> {
    let scale_factor = scale_factor.max(0.1);
    PhysicalSize {
        width: (width * scale_factor).round().max(1.0) as u32,
        height: (height * scale_factor).round().max(1.0) as u32,
    }
}

const OVERLAY_CARD_WIDTH: f64 = 250.0;
const OVERLAY_CARD_HEIGHT: u32 = 175;
const OVERLAY_CONTENT_PADDING: u32 = 16;
const OVERLAY_CARD_GAP: u32 = 12;
const OVERLAY_WINDOW_WIDTH: f64 = OVERLAY_CARD_WIDTH + OVERLAY_CONTENT_PADDING as f64;

fn overlay_expanded_height(item_count: u32, max_height: u32) -> u32 {
    let item_count = item_count.clamp(1, 5);
    let desired_height = OVERLAY_CONTENT_PADDING
        + (item_count * OVERLAY_CARD_HEIGHT)
        + (item_count.saturating_sub(1) * OVERLAY_CARD_GAP);
    desired_height.min(max_height)
}

fn position_overlay_window(app: &AppHandle, corner: &str, target_size: Option<PhysicalSize<u32>>) {
    let Some(window) = app.get_webview_window("overlay") else {
        return;
    };
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let size = target_size.or_else(|| window.outer_size().ok());
        if let Some(size) = size {
            let position = overlay_position(corner, monitor.position(), monitor.size(), &size);
            let _ = window.set_position(Position::Physical(position));
        }
    }
}

fn position_overlay_edge_window(
    app: &AppHandle,
    corner: &str,
    target_size: Option<PhysicalSize<u32>>,
) {
    let Some(window) = app.get_webview_window("overlay") else {
        return;
    };
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let size = target_size.or_else(|| window.outer_size().ok());
        if let Some(size) = size {
            let monitor_position = monitor.position();
            let monitor_size = monitor.size();
            let right = monitor_position.x + monitor_size.width.saturating_sub(size.width) as i32;
            let bottom = monitor_position.y
                + monitor_size
                    .height
                    .saturating_sub(size.height.saturating_add(72)) as i32;
            let position = match corner {
                "bottom-right" => PhysicalPosition {
                    x: right,
                    y: bottom,
                },
                "top-left" => PhysicalPosition {
                    x: monitor_position.x,
                    y: monitor_position.y + 24,
                },
                "top-right" => PhysicalPosition {
                    x: right,
                    y: monitor_position.y + 24,
                },
                _ => PhysicalPosition {
                    x: monitor_position.x,
                    y: bottom,
                },
            };
            let _ = window.set_position(Position::Physical(position));
        }
    }
}

fn overlay_max_height(app: &AppHandle) -> u32 {
    app.primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| monitor.size().height.saturating_sub(96).max(176))
        .or_else(|| {
            displays().ok().and_then(|items| {
                items
                    .iter()
                    .find(|display| display.primary)
                    .or_else(|| items.first())
                    .map(|display| display.height.saturating_sub(96).max(176))
            })
        })
        .unwrap_or(720)
}

#[tauri::command]
fn set_overlay_presentation(
    app: AppHandle,
    item_count: u32,
    state: String,
    overlay_corner: Option<String>,
) {
    let Some(window) = app.get_webview_window("overlay") else {
        return;
    };
    if state == "hidden" || item_count == 0 {
        let _ = window.hide();
        return;
    }

    let (width, height) = if state == "collapsed" {
        (32.0, 64.0)
    } else {
        (
            OVERLAY_WINDOW_WIDTH,
            f64::from(overlay_expanded_height(
                item_count,
                overlay_max_height(&app),
            )),
        )
    };
    let target_size = overlay_target_size(width, height, window.scale_factor().unwrap_or(1.0));
    let _ = window.set_size(Size::Logical(LogicalSize::new(width, height)));
    if state == "collapsed" {
        position_overlay_edge_window(
            &app,
            overlay_corner.as_deref().unwrap_or("bottom-left"),
            Some(target_size),
        );
    } else {
        position_overlay_window(
            &app,
            overlay_corner.as_deref().unwrap_or("bottom-left"),
            Some(target_size),
        );
    }
    let _ = window.set_always_on_top(true);
    let _ = window.show();
}

#[tauri::command]
fn set_overlay_stack_size(app: AppHandle, item_count: u32, overlay_corner: Option<String>) {
    set_overlay_presentation(app, item_count, "expanded".to_string(), overlay_corner);
}

#[tauri::command]
fn show_overlay(app: AppHandle, overlay_corner: Option<String>) {
    configure_capture_exclusion(&app);
    if let Some(window) = app.get_webview_window("overlay") {
        position_overlay_window(
            &app,
            overlay_corner.as_deref().unwrap_or("bottom-left"),
            None,
        );
        let _ = window.set_always_on_top(true);
        let _ = app.emit("result-overlay-opened", ());
        let _ = window.show();
    }
}

#[tauri::command]
fn hide_overlay(app: AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn toggle_overlay(app: AppHandle, overlay_corner: Option<String>) {
    configure_capture_exclusion(&app);
    if let Some(window) = app.get_webview_window("overlay") {
        if !window.is_visible().unwrap_or(false) {
            position_overlay_window(
                &app,
                overlay_corner.as_deref().unwrap_or("bottom-left"),
                None,
            );
            let _ = window.set_always_on_top(true);
            let _ = window.show();
        }
        let _ = app.emit("result-overlay-toggle-requested", ());
    }
}

fn restore_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        ensure_window_on_screen(&window);
        let _ = window.set_focus();
    }
}

fn report_capture_unavailable(app: &AppHandle, code: &str) {
    restore_internal_windows_after_capture(app);
    restore_main_window(app);
    let _ = app.emit(
        "capture-unavailable",
        CaptureUnavailable {
            code: code.to_string(),
        },
    );
}

fn try_show_capture_overlay(app: &AppHandle) -> Result<(), String> {
    let display_list = displays()?;
    let (x, y, width, height) = virtual_display_bounds(&display_list)
        .ok_or_else(|| "No capturable display is available.".to_string())?;
    let window = app
        .get_webview_window("capture")
        .ok_or_else(|| "Capture overlay window is unavailable.".to_string())?;

    configure_capture_exclusion(app);
    window
        .set_position(Position::Physical(PhysicalPosition { x, y }))
        .map_err(|error| error.to_string())?;
    window
        .set_size(Size::Physical(PhysicalSize { width, height }))
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;

    hide_internal_windows_for_capture(app);
    if let Err(error) = window.show() {
        restore_internal_windows_after_capture(app);
        return Err(error.to_string());
    }
    if let Err(error) = window.set_focus() {
        let _ = window.hide();
        restore_internal_windows_after_capture(app);
        return Err(error.to_string());
    }
    let _ = app.emit(
        "capture-overlay-opened",
        CaptureOverlayOpenedPayload {
            displays: display_list,
            bounds: VirtualDisplayBounds {
                x,
                y,
                width,
                height,
            },
        },
    );
    Ok(())
}

#[tauri::command]
fn show_capture_overlay(app: AppHandle) {
    if let Err(error) = try_show_capture_overlay(&app) {
        let code = if error.contains("No capturable display") {
            "no-display"
        } else {
            "overlay-unavailable"
        };
        eprintln!("AtrisShot capture overlay could not be shown: {error}");
        report_capture_unavailable(&app, code);
    }
}

#[tauri::command]
fn hide_capture_overlay(app: AppHandle) {
    hide_capture_overlay_window(&app);
    restore_internal_windows_after_capture(&app);
}

fn hide_capture_overlay_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn open_main_window(app: AppHandle) {
    restore_main_window(&app);
}

fn ensure_window_on_screen(window: &tauri::WebviewWindow) {
    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let Ok(display_list) = displays() else {
        return;
    };
    let right = position.x.saturating_add(size.width as i32);
    let bottom = position.y.saturating_add(size.height as i32);
    let intersects = display_list.iter().any(|display| {
        right > display.x
            && position.x < display.x.saturating_add(display.width as i32)
            && bottom > display.y
            && position.y < display.y.saturating_add(display.height as i32)
    });
    if intersects {
        return;
    }
    if let Some(display) = display_list
        .iter()
        .find(|display| display.primary)
        .or_else(|| display_list.first())
    {
        let x = display.x + (display.width.saturating_sub(size.width) / 2) as i32;
        let y = display.y + (display.height.saturating_sub(size.height) / 2) as i32;
        let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    }
}

fn center_window(window: &tauri::WebviewWindow, app: &AppHandle) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let x = monitor_position.x + ((monitor_size.width.saturating_sub(size.width)) / 2) as i32;
    let y = monitor_position.y + ((monitor_size.height.saturating_sub(size.height)) / 2) as i32;
    let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
}

#[tauri::command]
fn open_editor_window(app: AppHandle, id: String, mode: Option<EditorMode>) {
    if let Some(window) = app.get_webview_window("editor") {
        center_window(&window, &app);
        let _ = window.show();
        center_window(&window, &app);
        let _ = window.set_focus();
        let _ = app.emit(
            "editor-shot-requested",
            EditorShotRequestedPayload {
                id,
                mode: mode.unwrap_or_default(),
            },
        );
    }
}

#[tauri::command]
fn hide_editor_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("editor") {
        let _ = window.hide();
    }
}

fn build_tray_menu(app: &AppHandle, locale: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let turkish = locale == "tr";
    let open = MenuItem::with_id(
        app,
        "open",
        if turkish {
            "AtrisShot'u Aç"
        } else {
            "Open AtrisShot"
        },
        true,
        None::<&str>,
    )?;
    let capture = MenuItem::with_id(
        app,
        "capture",
        if turkish {
            "Ekran Görüntüsü Al"
        } else {
            "Capture Screenshot"
        },
        true,
        None::<&str>,
    )?;
    let overlay = MenuItem::with_id(
        app,
        "overlay",
        if turkish {
            "Sonucu Göster"
        } else {
            "Show Result Overlay"
        },
        true,
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(
        app,
        "quit",
        if turkish { "Çıkış" } else { "Exit" },
        true,
        None::<&str>,
    )?;
    Menu::with_items(app, &[&open, &capture, &overlay, &quit])
}

#[tauri::command]
fn set_tray_locale(app: AppHandle, locale: String) -> Result<(), String> {
    let menu = build_tray_menu(&app, &locale).map_err(|error| error.to_string())?;
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn restart_application(app: AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            restore_main_window(app);
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(ShotStore::default())
        .manage(RegisteredShortcuts::default())
        .manage(auth::AccessGate::default())
        .setup(|app| {
            configure_capture_exclusion(app.handle());
            if let (Some(window), Some(icon)) =
                (app.get_webview_window("main"), app.default_window_icon())
            {
                let _ = window.set_icon(icon.clone());
                ensure_window_on_screen(&window);
            }
            let saved_settings_path = settings_path(app.handle()).ok();
            let startup_shortcut = saved_settings_path
                .as_deref()
                .and_then(shortcut_from_settings_file)
                .unwrap_or_else(|| DEFAULT_SHORTCUT.to_string());
            let capture_active = match register_capture_shortcut(app.handle(), &startup_shortcut) {
                Ok(active) => Some(active),
                Err(_) if startup_shortcut != DEFAULT_SHORTCUT => {
                    register_capture_shortcut(app.handle(), DEFAULT_SHORTCUT).ok()
                }
                Err(_) => None,
            };
            set_active_shortcut(&app.state::<RegisteredShortcuts>().capture, capture_active);

            let overlay_shortcut = saved_settings_path
                .as_deref()
                .and_then(overlay_shortcut_from_settings_file)
                .unwrap_or_else(|| DEFAULT_OVERLAY_SHORTCUT.to_string());
            let mut overlay_active = None;
            if shortcut_is_distinct(&overlay_shortcut, capture_active) {
                overlay_active = register_overlay_shortcut(app.handle(), &overlay_shortcut).ok();
            }
            if overlay_active.is_none()
                && overlay_shortcut != DEFAULT_OVERLAY_SHORTCUT
                && shortcut_is_distinct(DEFAULT_OVERLAY_SHORTCUT, capture_active)
            {
                overlay_active =
                    register_overlay_shortcut(app.handle(), DEFAULT_OVERLAY_SHORTCUT).ok();
            }
            set_active_shortcut(&app.state::<RegisteredShortcuts>().overlay, overlay_active);

            if let Some(icon) = app.default_window_icon() {
                let menu = build_tray_menu(app.handle(), "en")?;
                let tray = TrayIconBuilder::with_id("main-tray")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "open" => {
                            restore_main_window(app);
                        }
                        "capture" => {
                            show_capture_overlay(app.clone());
                        }
                        "overlay" => toggle_overlay(app.clone(), None),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            restore_main_window(tray.app_handle());
                        }
                    })
                    .icon(icon.clone());
                if let Err(error) = tray.build(app) {
                    eprintln!("AtrisShot tray icon could not be created: {error}");
                }
            } else {
                eprintln!(
                    "AtrisShot tray icon skipped because the default window icon is unavailable."
                );
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::authorize_product_access,
            auth::revoke_product_access,
            auth::store_session_token,
            auth::read_session_token,
            auth::delete_session_token,
            list_displays,
            list_shot_history,
            capture_shot,
            delete_shot,
            delete_shots,
            clear_shot_history,
            latest_shot,
            apply_annotations,
            reveal_shot,
            copy_shot_path,
            copy_shot_image,
            path_exists,
            window_target_at_cursor,
            read_shot_data_url,
            remove_local_data,
            validate_save_folder,
            open_storage_folder,
            save_shortcut,
            save_overlay_shortcut,
            show_overlay,
            set_overlay_stack_size,
            set_overlay_presentation,
            hide_overlay,
            toggle_overlay,
            show_capture_overlay,
            hide_capture_overlay,
            open_main_window,
            open_editor_window,
            hide_editor_window,
            set_tray_locale,
            restart_application,
        ])
        .on_window_event(|window, event| {
            if matches!(window.label(), "main" | "editor") {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("build AtrisShot")
        .run(|_app, _event| {});
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_paths_do_not_escape_root() {
        let root = Path::new("data");
        assert!(path_is_inside(Path::new("data/shots/shot.png"), root));
        assert!(!path_is_inside(Path::new("../shot.png"), root));
    }

    #[test]
    fn history_limit_is_clamped_to_supported_range() {
        assert_eq!(normalized_history_limit(None), 100);
        assert_eq!(normalized_history_limit(Some(1)), 10);
        assert_eq!(normalized_history_limit(Some(120)), 120);
        assert_eq!(normalized_history_limit(Some(900)), 500);
    }

    #[test]
    fn virtual_display_bounds_include_negative_and_secondary_monitor_coordinates() {
        let displays = vec![
            DisplayInfo {
                id: "primary".to_string(),
                name: "Primary".to_string(),
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
                scale_factor: 1.25,
                primary: true,
            },
            DisplayInfo {
                id: "left".to_string(),
                name: "Left".to_string(),
                x: -1280,
                y: 120,
                width: 1280,
                height: 1024,
                scale_factor: 1.0,
                primary: false,
            },
        ];
        assert_eq!(
            virtual_display_bounds(&displays),
            Some((-1280, 0, 3200, 1144))
        );
        assert_eq!(virtual_display_bounds(&[]), None);
    }

    #[test]
    fn shortcut_settings_json_reads_saved_shortcut() {
        let settings = r#"{
            "shotSettings": {
                "shortcut": "Ctrl+Alt+S",
                "overlayShortcut": "Ctrl+Shift+O",
                "clipboardMode": "image"
            }
        }"#;
        assert_eq!(
            shortcut_from_settings_json(settings),
            Some("Ctrl+Alt+S".to_string())
        );
        assert_eq!(
            overlay_shortcut_from_settings_json(settings),
            Some("Ctrl+Shift+O".to_string())
        );
        assert_eq!(
            shortcut_from_settings_json(r#"{"shotSettings":{"shortcut":"   "}}"#),
            None
        );
        assert_eq!(
            shortcut_from_settings_json(r#"{"other":{"shortcut":"Ctrl+Alt+S"}}"#),
            None
        );
    }

    #[test]
    fn shortcut_conflict_check_is_trimmed_and_case_insensitive() {
        assert!(shortcuts_conflict("Ctrl+Shift+O", " ctrl+shift+o "));
        assert!(!shortcuts_conflict("Ctrl+Shift+S", "Ctrl+Shift+O"));
    }

    #[test]
    fn shortcut_distinct_check_uses_registered_hotkey_id() {
        let active = "Ctrl+Shift+O"
            .parse::<Shortcut>()
            .expect("parse active shortcut");
        assert!(!shortcut_is_distinct("ctrl+shift+o", Some(active)));
        assert!(shortcut_is_distinct("Ctrl+Alt+O", Some(active)));
        assert!(shortcut_is_distinct("Ctrl+Alt+O", None));
    }

    #[test]
    fn arrowhead_stays_at_the_second_point() {
        let white = Rgba([255, 255, 255, 255]);
        let red = Rgba([239, 68, 68, 255]);
        let mut right = RgbaImage::from_pixel(100, 64, white);
        draw_arrow(
            &mut right,
            &AnnotationPoint { x: 10.0, y: 32.0 },
            &AnnotationPoint { x: 50.0, y: 32.0 },
            red,
            3,
        );
        let rightmost = right
            .enumerate_pixels()
            .filter(|(_, _, pixel)| **pixel != white)
            .map(|(x, _, _)| x)
            .max()
            .expect("right arrow pixels");
        assert!(
            rightmost <= 51,
            "arrowhead crossed the endpoint: {rightmost}"
        );

        let mut left = RgbaImage::from_pixel(100, 64, white);
        draw_arrow(
            &mut left,
            &AnnotationPoint { x: 50.0, y: 32.0 },
            &AnnotationPoint { x: 10.0, y: 32.0 },
            red,
            3,
        );
        let leftmost = left
            .enumerate_pixels()
            .filter(|(_, _, pixel)| **pixel != white)
            .map(|(x, _, _)| x)
            .min()
            .expect("left arrow pixels");
        assert!(leftmost >= 9, "arrowhead crossed the endpoint: {leftmost}");
    }

    #[test]
    fn annotation_text_preserves_case_and_unicode_glyphs() {
        let white = Rgba([255, 255, 255, 255]);
        let red = Rgba([239, 68, 68, 255]);
        let origin = AnnotationPoint { x: 4.0, y: 4.0 };
        let mut lower = RgbaImage::from_pixel(260, 80, white);
        let mut upper = RgbaImage::from_pixel(260, 80, white);
        let mut unicode = RgbaImage::from_pixel(260, 80, white);
        draw_text(&mut lower, &origin, 240.0, 64.0, "small", red, 24);
        draw_text(&mut upper, &origin, 240.0, 64.0, "SMALL", red, 24);
        draw_text(&mut unicode, &origin, 240.0, 64.0, "çŞğİöÜ", red, 24);
        assert_ne!(lower.as_raw(), upper.as_raw());
        assert!(unicode.pixels().any(|pixel| *pixel != white));
    }

    #[test]
    fn history_mutation_helpers_delete_and_clear_entries() {
        let mut entries = vec![
            sample_history_entry("one"),
            sample_history_entry("two"),
            sample_history_entry("three"),
        ];
        remove_history_entry(&mut entries, "one");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].id, "two");
        let removed = remove_history_entries(&mut entries, &["two".to_string()]);
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0].id, "two");
        assert_eq!(entries[0].id, "three");
        clear_history_entries(&mut entries);
        assert!(entries.is_empty());
    }

    #[test]
    fn history_annotations_round_trip_and_legacy_entries_default_empty() {
        let mut entry = sample_history_entry("annotated");
        entry.annotations = vec![ShotAnnotation {
            id: "text-1".to_string(),
            tool: "text".to_string(),
            color: "#ffffff".to_string(),
            stroke_width: Some(1),
            blur_pixel_size: None,
            points: vec![AnnotationPoint { x: 10.0, y: 12.0 }],
            text: Some("Editable".to_string()),
            font_size: Some(24),
        }];

        let encoded = serde_json::to_value(&entry).expect("serialize annotated history");
        let decoded: ShotHistoryEntry =
            serde_json::from_value(encoded.clone()).expect("deserialize annotated history");
        assert_eq!(decoded.annotations[0].id, "text-1");
        assert_eq!(decoded.annotations[0].text.as_deref(), Some("Editable"));

        let mut legacy = encoded;
        legacy
            .as_object_mut()
            .expect("history object")
            .remove("annotations");
        legacy
            .as_object_mut()
            .expect("history object")
            .remove("editRevision");
        let legacy_entry: ShotHistoryEntry =
            serde_json::from_value(legacy).expect("deserialize legacy history");
        assert!(legacy_entry.annotations.is_empty());
        assert_eq!(legacy_entry.edit_revision, 0);
    }

    #[test]
    fn history_entry_file_cleanup_removes_original_edited_and_thumbnail() {
        let id = now_id();
        let root = std::env::temp_dir().join(format!("atrisshot-entry-cleanup-test-{id}"));
        fs::create_dir_all(&root).expect("create cleanup test dir");
        let original = root.join("original.png");
        let edited = root.join("edited.png");
        let thumbnail = root.join("thumb.png");
        fs::write(&original, b"original").expect("write original");
        fs::write(&edited, b"edited").expect("write edited");
        fs::write(&thumbnail, b"thumb").expect("write thumbnail");

        let mut entry = sample_history_entry("cleanup");
        entry.original_path = original.to_string_lossy().to_string();
        entry.edited_path = Some(edited.to_string_lossy().to_string());
        entry.thumbnail_path = Some(thumbnail.to_string_lossy().to_string());

        remove_history_entry_files_checked(&entry).expect("history files should be removed");

        assert!(!original.exists());
        assert!(!edited.exists());
        assert!(!thumbnail.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn existing_path_rejects_empty_or_missing_paths() {
        assert!(existing_path_from_user_input("").is_err());
        assert!(existing_path_from_user_input("definitely-missing-shot.png").is_err());
    }

    #[test]
    fn plain_path_accepts_missing_paths_for_copying() {
        assert!(path_from_user_input("").is_err());
        assert!(path_from_user_input("definitely-missing-shot.png").is_ok());
    }

    #[test]
    fn remove_helpers_ignore_missing_paths_and_remove_existing_items() {
        let id = now_id();
        let root = std::env::temp_dir().join(format!("atrisshot-remove-test-{id}"));
        let file = root.join("settings.json");
        let dir = root.join("shots");
        fs::create_dir_all(&dir).expect("create test dir");
        fs::write(&file, b"{}").expect("write test file");

        remove_file_if_exists(&file).expect("remove file");
        remove_dir_if_exists(&dir).expect("remove dir");
        remove_file_if_exists(&file).expect("ignore missing file");
        remove_dir_if_exists(&dir).expect("ignore missing dir");

        assert!(!file.exists());
        assert!(!dir.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn custom_save_folder_is_created_and_rejects_files() {
        let id = now_id();
        let root = std::env::temp_dir().join(format!("atrisshot-storage-test-{id}"));
        let target = root.join("shots");
        let resolved = validate_custom_save_folder(target.to_str().expect("target path"))
            .expect("create save folder");
        assert!(resolved.exists());
        assert!(resolved.is_dir());

        let file = root.join("not-a-folder.txt");
        fs::write(&file, b"not a folder").expect("write test file");
        assert!(validate_custom_save_folder(file.to_str().expect("file path")).is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn overlay_position_uses_selected_corner() {
        let monitor_position = PhysicalPosition { x: 100, y: 200 };
        let monitor_size = PhysicalSize {
            width: 1920,
            height: 1080,
        };
        let window_size = PhysicalSize {
            width: 320,
            height: 104,
        };
        assert_eq!(
            overlay_position(
                "bottom-left",
                &monitor_position,
                &monitor_size,
                &window_size
            ),
            PhysicalPosition { x: 124, y: 1104 }
        );
        assert_eq!(
            overlay_position(
                "bottom-right",
                &monitor_position,
                &monitor_size,
                &window_size
            ),
            PhysicalPosition { x: 1676, y: 1104 }
        );
        assert_eq!(
            overlay_position("top-right", &monitor_position, &monitor_size, &window_size),
            PhysicalPosition { x: 1676, y: 224 }
        );
    }

    #[test]
    fn overlay_target_size_scales_logical_dimensions() {
        assert_eq!(
            overlay_target_size(32.0, 64.0, 1.0),
            PhysicalSize {
                width: 32,
                height: 64,
            }
        );
        assert_eq!(
            overlay_target_size(32.0, 64.0, 1.25),
            PhysicalSize {
                width: 40,
                height: 80,
            }
        );
    }

    #[test]
    fn expanded_overlay_height_matches_card_stack_and_max_height() {
        assert_eq!(OVERLAY_CARD_WIDTH, 250.0);
        assert_eq!(overlay_expanded_height(0, 1_000), 191);
        assert_eq!(overlay_expanded_height(1, 1_000), 191);
        assert_eq!(overlay_expanded_height(2, 1_000), 378);
        assert_eq!(overlay_expanded_height(5, 1_000), 939);
        assert_eq!(overlay_expanded_height(5, 500), 500);
    }

    #[test]
    fn editor_event_payload_serializes_default_edit_mode() {
        let payload = EditorShotRequestedPayload {
            id: "shot-id".to_string(),
            mode: EditorMode::default(),
        };
        let encoded = serde_json::to_value(payload).expect("serialize editor event payload");
        assert_eq!(encoded["id"], "shot-id");
        assert_eq!(encoded["mode"], "edit");
    }

    #[test]
    fn shape_stroke_width_changes_rendered_pixels() {
        fn non_white_pixels(image: &RgbaImage) -> usize {
            image
                .pixels()
                .filter(|pixel| **pixel != Rgba([255, 255, 255, 255]))
                .count()
        }

        let start = AnnotationPoint { x: 8.0, y: 8.0 };
        let end = AnnotationPoint { x: 44.0, y: 34.0 };
        let color = Rgba([14, 165, 233, 245]);

        let mut thin_rect = RgbaImage::from_pixel(64, 48, Rgba([255, 255, 255, 255]));
        let mut thick_rect = thin_rect.clone();
        draw_rect(&mut thin_rect, &start, &end, color, 1);
        draw_rect(&mut thick_rect, &start, &end, color, 7);
        assert!(non_white_pixels(&thick_rect) > non_white_pixels(&thin_rect));

        let mut thin_ellipse = RgbaImage::from_pixel(64, 48, Rgba([255, 255, 255, 255]));
        let mut thick_ellipse = thin_ellipse.clone();
        draw_ellipse(&mut thin_ellipse, &start, &end, color, 1);
        draw_ellipse(&mut thick_ellipse, &start, &end, color, 7);
        assert!(non_white_pixels(&thick_ellipse) > non_white_pixels(&thin_ellipse));
    }

    #[test]
    fn blur_pixel_size_changes_rendered_pixels() {
        let mut small_pixel_size = RgbaImage::new(72, 48);
        for y in 0..small_pixel_size.height() {
            for x in 0..small_pixel_size.width() {
                small_pixel_size.put_pixel(
                    x,
                    y,
                    Rgba([
                        (x * 3).min(255) as u8,
                        (y * 5).min(255) as u8,
                        ((x + y) * 2).min(255) as u8,
                        255,
                    ]),
                );
            }
        }
        let mut large_pixel_size = small_pixel_size.clone();
        let start = AnnotationPoint { x: 0.0, y: 0.0 };
        let end = AnnotationPoint { x: 72.0, y: 48.0 };

        pixelate_region(&mut small_pixel_size, &start, &end, 4);
        pixelate_region(&mut large_pixel_size, &start, &end, 36);

        assert_ne!(small_pixel_size.as_raw(), large_pixel_size.as_raw());
    }

    #[test]
    fn render_annotations_writes_edited_png() {
        let id = now_id();
        let root = std::env::temp_dir().join(format!("atrisshot-render-test-{id}"));
        fs::create_dir_all(&root).expect("create test directory");
        let original = root.join("original.png");
        let edited = root.join("edited.png");
        let mut image = RgbaImage::new(80, 60);
        for pixel in image.pixels_mut() {
            *pixel = Rgba([255, 255, 255, 255]);
        }
        image.save(&original).expect("write original");
        let annotations = vec![
            ShotAnnotation {
                id: "rectangle".to_string(),
                tool: "rectangle".to_string(),
                color: "#0ea5e9".to_string(),
                stroke_width: Some(3),
                blur_pixel_size: None,
                points: vec![
                    AnnotationPoint { x: 8.0, y: 8.0 },
                    AnnotationPoint { x: 48.0, y: 34.0 },
                ],
                text: None,
                font_size: None,
            },
            ShotAnnotation {
                id: "ellipse".to_string(),
                tool: "ellipse".to_string(),
                color: "#22c55e".to_string(),
                stroke_width: Some(3),
                blur_pixel_size: None,
                points: vec![
                    AnnotationPoint { x: 54.0, y: 8.0 },
                    AnnotationPoint { x: 74.0, y: 32.0 },
                ],
                text: None,
                font_size: None,
            },
            ShotAnnotation {
                id: "line".to_string(),
                tool: "line".to_string(),
                color: "#f59e0b".to_string(),
                stroke_width: Some(3),
                blur_pixel_size: None,
                points: vec![
                    AnnotationPoint { x: 10.0, y: 52.0 },
                    AnnotationPoint { x: 70.0, y: 52.0 },
                ],
                text: None,
                font_size: None,
            },
            ShotAnnotation {
                id: "text".to_string(),
                tool: "text".to_string(),
                color: "#ef4444".to_string(),
                stroke_width: Some(1),
                blur_pixel_size: None,
                points: vec![AnnotationPoint { x: 12.0, y: 40.0 }],
                text: Some("OK".to_string()),
                font_size: Some(14),
            },
        ];
        render_annotations(&original, &edited, &annotations).expect("render annotations");
        assert!(edited.exists());
        assert!(fs::metadata(&edited).expect("edited metadata").len() > 0);
        let edited_image = image::open(&edited).expect("open edited image").to_rgba8();
        assert_ne!(*edited_image.get_pixel(74, 20), Rgba([255, 255, 255, 255]));
        assert_ne!(*edited_image.get_pixel(40, 52), Rgba([255, 255, 255, 255]));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn render_annotations_rebuilds_from_original_on_second_save() {
        let id = now_id();
        let root = std::env::temp_dir().join(format!("atrisshot-render-repeat-test-{id}"));
        fs::create_dir_all(&root).expect("create test directory");
        let original = root.join("original.png");
        let edited = root.join("edited.png");
        let image = RgbaImage::from_pixel(80, 60, Rgba([255, 255, 255, 255]));
        image.save(&original).expect("write original");
        let first = vec![ShotAnnotation {
            id: "first".to_string(),
            tool: "rectangle".to_string(),
            color: "#ef4444".to_string(),
            stroke_width: Some(3),
            blur_pixel_size: None,
            points: vec![
                AnnotationPoint { x: 5.0, y: 5.0 },
                AnnotationPoint { x: 25.0, y: 25.0 },
            ],
            text: None,
            font_size: None,
        }];
        render_annotations(&original, &edited, &first).expect("first render");
        let second = vec![
            first[0].clone(),
            ShotAnnotation {
                id: "second".to_string(),
                tool: "line".to_string(),
                color: "#0ea5e9".to_string(),
                stroke_width: Some(3),
                blur_pixel_size: None,
                points: vec![
                    AnnotationPoint { x: 50.0, y: 10.0 },
                    AnnotationPoint { x: 70.0, y: 10.0 },
                ],
                text: None,
                font_size: None,
            },
        ];
        render_annotations(&original, &edited, &second).expect("second render");
        let output = image::open(&edited).expect("open edited image").to_rgba8();
        assert_ne!(*output.get_pixel(60, 10), Rgba([255, 255, 255, 255]));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn write_thumbnail_creates_preview_png() {
        let id = now_id();
        let root = std::env::temp_dir().join(format!("atrisshot-thumb-test-{id}"));
        fs::create_dir_all(&root).expect("create test directory");
        let original = root.join("original.png");
        let mut image = RgbaImage::new(128, 72);
        for pixel in image.pixels_mut() {
            *pixel = Rgba([12, 18, 28, 255]);
        }
        image.save(&original).expect("write original");
        let thumbnail = write_thumbnail(&original, &id).expect("write thumbnail");
        assert!(thumbnail.exists());
        assert!(fs::metadata(thumbnail).expect("thumbnail metadata").len() > 0);
        let _ = fs::remove_dir_all(root);
    }

    fn sample_history_entry(id: &str) -> ShotHistoryEntry {
        ShotHistoryEntry {
            id: id.to_string(),
            created_at: "2026-06-30T00:00:00.000Z".to_string(),
            mode: "display".to_string(),
            original_path: format!("C:\\tmp\\{id}.png"),
            edited_path: None,
            thumbnail_path: None,
            width: 120,
            height: 80,
            display_name: "Primary".to_string(),
            region: CaptureRegion {
                display_id: "primary".to_string(),
                x: 0,
                y: 0,
                width: 120,
                height: 80,
            },
            annotations_count: 0,
            edit_revision: 0,
            annotations: Vec::new(),
        }
    }
}
