// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Basic commands for the desktop app
#[tauri::command]
fn get_system_info() -> String {
    format!("UPM.Plus Desktop v{}", env!("CARGO_PKG_VERSION"))
}

#[tauri::command]
fn send_notification(title: String, body: String) -> Result<(), String> {
    log::info!("Notification: {} - {}", title, body);
    Ok(())
}

fn main() {
    // Initialize logger
    env_logger::init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            send_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}