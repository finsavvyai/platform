// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cluster;
mod config;
mod utils;

use cluster::*;
use config::*;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{CustomMenuItem, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, WindowBuilder};

// Application state
pub struct AppState {
    cluster_state: Arc<Mutex<ClusterState>>,
    config: Arc<Mutex<AppConfig>>,
}

// Cluster state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterState {
    pub nodes: Vec<ClusterNode>,
    pub status: ClusterStatus,
    pub metrics: ClusterMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterNode {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub models: Vec<String>,
    pub status: String,
    pub load: u8,
    pub last_heartbeat: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterStatus {
    pub cluster_id: String,
    pub total_nodes: u32,
    pub online_nodes: u32,
    pub total_models: u32,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterMetrics {
    pub total_requests: u64,
    pub active_requests: u32,
    pub avg_response_time: f64,
    pub success_rate: f64,
}

// Commands for Tauri frontend
#[tauri::command]
async fn get_cluster_status(state: State<'_, AppState>) -> Result<ClusterStatus, String> {
    let cluster_manager = ClusterManager::new();
    match cluster_manager.get_status().await {
        Ok(status) => Ok(status),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn get_cluster_nodes(state: State<'_, AppState>) -> Result<Vec<ClusterNode>, String> {
    let cluster_manager = ClusterManager::new();
    match cluster_manager.get_nodes().await {
        Ok(nodes) => Ok(nodes),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn start_cluster(state: State<'_, AppState>) -> Result<String, String> {
    // Logic to start the cluster
    Ok("Cluster started successfully".to_string())
}

#[tauri::command]
async fn stop_cluster(state: State<'_, AppState>) -> Result<String, String> {
    // Logic to stop the cluster
    Ok("Cluster stopped successfully".to_string())
}

#[tauri::command]
async fn add_node(node_config: ClusterNodeConfig) -> Result<String, String> {
    let cluster_manager = ClusterManager::new();
    match cluster_manager.add_node(node_config).await {
        Ok(node_id) => Ok(format!("Node {} added successfully", node_id)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn remove_node(node_id: String) -> Result<String, String> {
    let cluster_manager = ClusterManager::new();
    match cluster_manager.remove_node(&node_id).await {
        Ok(_) => Ok(format!("Node {} removed successfully", node_id)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn get_app_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().unwrap();
    Ok(config.clone())
}

#[tauri::command]
async fn update_app_config(config: AppConfig, state: State<'_, AppState>) -> Result<String, String> {
    let mut state_config = state.config.lock().unwrap();
    *state_config = config.clone();

    // Save to file
    match config::save_config(&config).await {
        Ok(_) => Ok("Configuration updated successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    // Initialize application state
    let cluster_state = Arc::new(Mutex::new(ClusterState {
        nodes: Vec::new(),
        status: ClusterStatus {
            cluster_id: "finsavvy-home-cluster".to_string(),
            total_nodes: 0,
            online_nodes: 0,
            total_models: 0,
            timestamp: chrono::Utc::now().to_rfc3339(),
        },
        metrics: ClusterMetrics {
            total_requests: 0,
            active_requests: 0,
            avg_response_time: 0.0,
            success_rate: 100.0,
        },
    }));

    let config = Arc::new(Mutex::new(AppConfig::default()));

    // Create system tray
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show".to_string(), "Show FinSavvyAI"))
        .add_item(CustomMenuItem::new("hide".to_string(), "Hide Window"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("start_cluster".to_string(), "Start Cluster"))
        .add_item(CustomMenuItem::new("stop_cluster".to_string(), "Stop Cluster"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_native_item(SystemTrayMenuItem::Quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(AppState { cluster_state, config })
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                if window.is_visible().unwrap_or(false) {
                    window.hide().unwrap();
                } else {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                "hide" => {
                    let window = app.get_window("main").unwrap();
                    window.hide().unwrap();
                }
                "start_cluster" => {
                    app.emit_all("cluster-start-request", ()).unwrap();
                }
                "stop_cluster" => {
                    app.emit_all("cluster-stop-request", ()).unwrap();
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_cluster_status,
            get_cluster_nodes,
            start_cluster,
            stop_cluster,
            add_node,
            remove_node,
            get_app_config,
            update_app_config
        ])
        .setup(|app| {
            // Load configuration
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                match config::load_config().await {
                    Ok(loaded_config) => {
                        // Update state with loaded config
                        app_handle.emit_all("config-loaded", loaded_config).unwrap();
                    }
                    Err(e) => {
                        eprintln!("Failed to load config: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
