const APP_COMMANDS: &[&str] = &[
    "authorize_product_access",
    "revoke_product_access",
    "store_session_token",
    "read_session_token",
    "delete_session_token",
    "list_displays",
    "list_shot_history",
    "capture_shot",
    "delete_shot",
    "delete_shots",
    "clear_shot_history",
    "latest_shot",
    "apply_annotations",
    "reveal_shot",
    "copy_shot_path",
    "copy_shot_image",
    "path_exists",
    "window_target_at_cursor",
    "read_shot_data_url",
    "remove_local_data",
    "validate_save_folder",
    "open_storage_folder",
    "save_shortcut",
    "save_overlay_shortcut",
    "show_overlay",
    "set_overlay_stack_size",
    "set_overlay_presentation",
    "hide_overlay",
    "toggle_overlay",
    "show_capture_overlay",
    "hide_capture_overlay",
    "open_main_window",
    "open_editor_window",
    "hide_editor_window",
    "set_tray_locale",
    "restart_application",
    "prune_shot_history",
];

fn main() {
    println!("cargo:rerun-if-changed=icons/source.svg");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons/icon.icns");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=permissions");

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS)),
    )
    .expect("failed to build AtrisShot Tauri configuration");
}
