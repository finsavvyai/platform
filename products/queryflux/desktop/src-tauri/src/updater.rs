use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

pub async fn check_for_updates<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let updater = app.updater()?;
    
    match updater.check().await {
        Ok(Some(update)) => {
            log::info!("Update available: {} -> {}", update.current_version, update.version);
            
            // Notify user about update
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("update-available", serde_json::json!({
                    "current_version": update.current_version.to_string(),
                    "new_version": update.version.to_string(),
                    "body": update.body,
                }));
            }
        }
        Ok(None) => {
            log::info!("No updates available");
        }
        Err(e) => {
            log::warn!("Failed to check for updates: {}", e);
        }
    }
    
    Ok(())
}

/// IPC command to manually check for updates
#[tauri::command]
pub async fn check_update(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            current_version: update.current_version.to_string(),
            new_version: update.version.to_string(),
            body: update.body.clone(),
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// IPC command to download and install update
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    if let Ok(Some(update)) = updater.check().await {
        log::info!("Downloading update {}", update.version);
        
        // Download the update
        let mut downloaded = 0;
        let bytes = update
            .download(
                |chunk_length, content_length| {
                    downloaded += chunk_length;
                    log::debug!("Downloaded {} of {:?}", downloaded, content_length);
                },
                || {
                    log::info!("Download finished, preparing to install...");
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        
        // Install the update (this will restart the app)
        update.install(bytes).map_err(|e| e.to_string())?;
        
        // Restart the app
        app.restart();
    }
    
    Ok(())
}

#[derive(serde::Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub new_version: String,
    pub body: Option<String>,
}
