use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

// --- STATE MANAGEMENT ---

pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
    pub exit_rx: Mutex<Option<std::sync::mpsc::Receiver<()>>>,
    pub port_rx: Mutex<Option<std::sync::mpsc::Receiver<u16>>>,
    pub port_value: Mutex<Option<u16>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
            exit_rx: Mutex::new(None),
            port_rx: Mutex::new(None),
            port_value: Mutex::new(None),
        }
    }
}

// --- COMMANDS ---

#[tauri::command]
fn get_backend_port(_state: tauri::State<'_, SidecarState>) -> Result<u16, String> {
    // DEV MODE: Return a fixed port immediately
    #[cfg(debug_assertions)]
    {
        return Ok(8000); 
    }

    // PRODUCTION: Existing sidecar logic
    #[cfg(not(debug_assertions))]
    {
        let mut cached = _state.port_value.lock().unwrap();
        if let Some(port) = *cached {
            return Ok(port);
        }

        let rx = _state.port_rx.lock().unwrap().take();
        if let Some(rx) = rx {
            match rx.recv_timeout(std::time::Duration::from_secs(600)) {
                Ok(port) => {
                    *cached = Some(port);
                    Ok(port)
                }
                Err(e) => Err(format!("Timeout waiting for backend port: {}", e)),
            }
        } else {
            Err("Port receiver already consumed".to_string())
        }
    }
}

#[tauri::command]
async fn close_splashscreen(window: tauri::Window) {
  // Close splashscreen
  if let Some(splashscreen) = window.get_webview_window("splashscreen") {
    splashscreen.close().unwrap();
  }
  // Show main window
  if let Some(main_window) = window.get_webview_window("main") {
    main_window.show().unwrap();
    main_window.set_focus().unwrap();
  }
}

// --- SIDECAR LOGIC (Production Only) ---

#[cfg(not(debug_assertions))]
fn spawn_production_sidecar(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar = app.shell().sidecar("trackpad-math-backend")?;
    let (mut rx, child) = sidecar.spawn()?;

    let state = app.state::<SidecarState>();
    let (tx_port, rx_port) = std::sync::mpsc::channel();
    let (tx_exit, rx_signal) = std::sync::mpsc::channel();

    *state.child.lock().unwrap() = Some(child);
    *state.exit_rx.lock().unwrap() = Some(rx_signal);
    *state.port_rx.lock().unwrap() = Some(rx_port);

    tauri::async_runtime::spawn(async move {
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
                                let _ = tx_port.send(port);
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
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState::default())
        .invoke_handler(tauri::generate_handler![get_backend_port, close_splashscreen])
        .setup(|app| {
            let app_data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            std::env::set_var("APP_DATA_DIR", &app_data_dir);

            #[cfg(not(debug_assertions))]
            spawn_production_sidecar(app).map_err(|e| e.to_string())?;

            Ok(())
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