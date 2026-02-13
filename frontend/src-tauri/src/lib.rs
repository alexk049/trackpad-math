use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri_plugin_shell::process::CommandChild;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;
use serde::{Deserialize, Serialize};

// --- CONFIG MANAGEMENT ---

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub minimize_to_tray: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            minimize_to_tray: true,
        }
    }
}

pub struct ConfigState {
    pub config: Mutex<AppConfig>,
}

// --- STATE MANAGEMENT ---

pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
    pub exit_rx: Mutex<Option<std::sync::mpsc::Receiver<()>>>,
    pub port_tx: tokio::sync::watch::Sender<Option<u16>>,
    pub app_data_dir: Mutex<Option<PathBuf>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        let (tx, _) = tokio::sync::watch::channel(None);
        Self {
            child: Mutex::new(None),
            exit_rx: Mutex::new(None),
            port_tx: tx,
            app_data_dir: Mutex::new(None),
        }
    }
}

// --- COMMANDS ---

#[tauri::command]
async fn get_backend_port(_state: tauri::State<'_, SidecarState>) -> Result<u16, String> {
    // DEV MODE: Return a fixed port immediately
    #[cfg(debug_assertions)]
    {
        return Ok(8000); 
    }

    // PRODUCTION: Existing sidecar logic
    #[cfg(not(debug_assertions))]
    {
        let mut rx = _state.port_tx.subscribe();
        
        // 1. Check if we already have the port
        if let Some(port) = *rx.borrow() {
            return Ok(port);
        }

        // 2. Wait for the port to be set (watch channel change)
        match tokio::time::timeout(std::time::Duration::from_secs(60), rx.changed()).await {
            Ok(Ok(_)) => {
                let port = *rx.borrow();
                port.ok_or_else(|| "Port not found after change".to_string())
            }
            Ok(Err(e)) => Err(format!("Watch channel error: {}", e)),
            Err(_) => Err("Timeout waiting for backend port".to_string()),
        }
    }
}

#[tauri::command]
fn get_config(state: tauri::State<'_, ConfigState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn set_config(state: tauri::State<'_, ConfigState>, sidecar_state: tauri::State<'_, SidecarState>, config: AppConfig) -> Result<(), String> {
    *state.config.lock().unwrap() = config.clone();
    
    // Save to disk
    let app_data_dir = sidecar_state.app_data_dir.lock().unwrap().clone()
        .ok_or_else(|| "App data directory not initialized".to_string())?;
    
    let config_path = app_data_dir.join("settings.json");
    let config_json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    std::fs::write(config_path, config_json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn show_main_window(window: tauri::Window) {
  // Show main window
  if let Some(main_window) = window.get_webview_window("main") {
    main_window.show().unwrap();
    main_window.set_focus().unwrap();
  }
}

#[tauri::command]
fn relaunch(app_handle: tauri::AppHandle) {
  app_handle.restart();
}

// --- SIDECAR LOGIC (Production Only) ---

#[cfg(not(debug_assertions))]
fn spawn_production_sidecar(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar = app.shell().sidecar("trackpad-math-backend")?;
    let (mut rx, child) = sidecar.spawn()?;

    let handle = app.handle().clone();
    let (tx_exit, rx_signal) = std::sync::mpsc::channel();

    {
        let state = handle.state::<SidecarState>();
        *state.child.lock().unwrap() = Some(child);
        *state.exit_rx.lock().unwrap() = Some(rx_signal);
    }

    tauri::async_runtime::spawn(async move {
        let state = handle.state::<SidecarState>();
        while let Some(event) = rx.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    let target = "sidecar";

                    // Handle Log Levels
                    if line_str.contains("[ERROR]") || line_str.contains("[CRITICAL]") {
                        log::error!(target: target, "{}", line_str.replace("[ERROR]", "").replace("[CRITICAL]", "").trim());
                    } else if line_str.contains("[WARNING]") {
                        log::warn!(target: target, "{}", line_str.replace("[WARNING]", "").trim());
                    } else if line_str.contains("[INFO]") {
                        log::info!(target: target, "{}", line_str.replace("[INFO]", "").trim());
                    } else if line_str.contains("[DEBUG]") {
                        log::debug!(target: target, "{}", line_str.replace("[DEBUG]", "").trim());
                    } else {
                        log::debug!(target: target, "{}", line_str.trim());
                    }

                    // Port Parsing
                    if line_str.contains("ACTUAL_PORT: ") {
                        if let Some(port_str) = line_str.split("ACTUAL_PORT: ").last() {
                            if let Ok(port) = port_str.trim().parse::<u16>() {
                                let _ = state.port_tx.send(Some(port));
                            }
                        }
                    }

                    if line_str.contains("BACKEND_SHUTDOWN_COMPLETE") {
                        let _ = tx_exit.send(());
                    }
                }
                // tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                //     log::error!(target: "sidecar_stderr", "{}", String::from_utf8_lossy(&line));
                // }
                tauri_plugin_shell::process::CommandEvent::Terminated(_) => {
                    let _ = tx_exit.send(());
                }
                _ => {}
            }
        }
    });

    Ok(())
}

// --- MAIN RUNNER ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .targets([
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            ])
            .format(|out, message, record| {
                let target = if record.target().contains("webview") { "frontend" } else { record.target() };
                out.finish(format_args!(
                    "{}[{}][{}] {}",
                    chrono::Local::now().format("[%Y-%m-%d][%H:%M:%S]"),
                    target,
                    record.level(),
                    message
                ))
            })
            // .level(log::LevelFilter::Info)
            .build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState::default())
        .manage(ConfigState { config: Mutex::new(AppConfig::default()) })
        .invoke_handler(tauri::generate_handler![get_backend_port, show_main_window, get_config, set_config, relaunch])
        .setup(|app| {
            let app_data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            std::env::set_var("APP_DATA_DIR", &app_data_dir);

            // Store app_data_dir in state
            let sidecar_state = app.state::<SidecarState>();
            *sidecar_state.app_data_dir.lock().unwrap() = Some(app_data_dir.clone());

            // Load config
            let config_path = app_data_dir.join("settings.json");
            let config = if config_path.exists() {
                let content = std::fs::read_to_string(config_path)?;
                serde_json::from_str(&content).unwrap_or_default()
            } else {
                AppConfig::default()
            };
            let config_state = app.state::<ConfigState>();
            *config_state.config.lock().unwrap() = config.clone();

            // Tray setup
            let quit_i = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let show_i = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show_i, &quit_i]).build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            for window in app_handle.webview_windows().values() {
                                let _ = window.destroy();
                            }
                            // Give Chromium/WebView2 a moment to clean up window classes
                            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                            app_handle.exit(0);
                        });
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if !window.is_visible().unwrap_or(false) {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            #[cfg(not(debug_assertions))]
            spawn_production_sidecar(app).map_err(|e| e.to_string())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let config_state = app.state::<ConfigState>();
                let config = config_state.config.lock().unwrap();
                
                if config.minimize_to_tray {
                    window.hide().unwrap();
                    api.prevent_close();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<SidecarState>();
                
                // We lock and take the child in one expression
                let mut child_lock = state.child.lock().unwrap();
                if let Some(mut child) = child_lock.take() {
                    let _ = child.write(b"shutdown\n");
            
                    // Handle exit_rx separately to ensure no cross-borrowing issues
                    let mut exit_lock = state.exit_rx.lock().unwrap();
                    if let Some(rx) = exit_lock.take() {
                        let _ = rx.recv_timeout(std::time::Duration::from_secs(2));
                    }
                    let _ = child.kill();
                } 
                // Locks are dropped here automatically
            }
});
}