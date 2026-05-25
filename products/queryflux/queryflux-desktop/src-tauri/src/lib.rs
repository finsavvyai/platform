mod commands;
mod tray;
mod updater;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            if let Err(e) = commands::hydrate_connections(app.handle(), &app.state::<AppState>()) {
                log::warn!("Failed to load saved connections: {}", e);
            }

            // Setup system tray
            tray::setup_system_tray(app)?;
            
            // Check for updates on startup (async)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = updater::check_for_updates(app_handle).await {
                    log::warn!("Failed to check for updates on startup: {}", e);
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Connection management
            commands::save_connection,
            commands::get_connections,
            commands::delete_connection,
            commands::test_connection,
            // Query execution
            commands::execute_query,
            commands::get_schema,
            // AI features
            commands::convert_nl_to_sql,
            // Updates
            updater::check_update,
            updater::install_update,
            // Runtime configuration
            commands::get_backend_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
