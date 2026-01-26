// Import necessary Rust standard library and Tauri dependencies
use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tauri::Manager;

/// Global state for managing the Python backend sidecar process
/// 
/// This struct holds all the resources needed to manage the backend:
/// - The running process itself
/// - Communication channels for coordinating shutdown and port discovery
/// 
/// Note: Mutex is used because this state is shared across threads.
/// In Rust, Mutex ensures only one thread can access the data at a time.
pub struct SidecarState {
  /// The spawned backend process (wrapped in Option because it may not exist yet)
  pub child: Mutex<Option<CommandChild>>,
  
  /// Channel receiver for shutdown signals from the backend
  /// When the backend exits, it sends a signal through this channel
  pub exit_rx: Mutex<Option<std::sync::mpsc::Receiver<()>>>,
  
  /// Channel sender for communicating the backend's port
  /// The async task uses this to send the port when discovered
  pub port_tx: Mutex<Option<std::sync::mpsc::Sender<u16>>>,
  
  /// Channel receiver for getting the backend's port
  /// The get_backend_port command uses this to receive the port
  pub port_rx: Mutex<Option<std::sync::mpsc::Receiver<u16>>>,
  
  /// Cached port value once received
  /// This allows multiple calls to get_backend_port without consuming the channel
  pub port_value: Mutex<Option<u16>>,
}

/// Tauri command that the frontend can call to get the backend's dynamic port
/// 
/// This function blocks until the backend reports its port (up to 10 seconds).
/// On subsequent calls, it returns the cached value immediately.
/// 
/// Returns: Result<u16, String> - either the port number or an error message
#[tauri::command]
fn get_backend_port(state: tauri::State<'_, SidecarState>) -> Result<u16, String> {
    // First, check if we already have the port cached from a previous call
    // The extra scope {} ensures the lock is released immediately after checking
    {
        let cached = state.port_value.lock().unwrap();
        if let Some(port) = *cached {
            return Ok(port);
        }
    }
    
    // Take ownership of the receiver (this can only happen once)
    // .take() replaces the Option with None and returns the previous value
    let rx = state.port_rx.lock().unwrap().take();
    
    if let Some(rx) = rx {
        // Block this thread until we receive the port from the backend
        // Timeout after 30 seconds to avoid hanging forever (increased from 10s)
        match rx.recv_timeout(std::time::Duration::from_secs(30)) {
            Ok(port) => {
                // Success! Cache the port for future calls
                *state.port_value.lock().unwrap() = Some(port);
                Ok(port)
            }
            Err(e) => Err(format!("Timeout waiting for backend port: {}", e))
        }
    } else {
        // This shouldn't happen if port_value is cached, but handle it anyway
        Err("Port receiver already consumed and no cached value".to_string())
    }
}

/// Main entry point for the Tauri application
/// 
/// This function sets up the entire application including:
/// - Spawning the Python backend as a sidecar process
/// - Monitoring the backend's output to discover its dynamic port
/// - Handling graceful shutdown when the app exits
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Enable shell plugin to spawn external processes
    .plugin(tauri_plugin_shell::init())
    
    // Initialize the global state with empty values
    // .manage() makes this state accessible from all Tauri commands
    .manage(SidecarState {
      child: Mutex::new(None),
      exit_rx: Mutex::new(None),
      port_tx: Mutex::new(None),
      port_rx: Mutex::new(None),
      port_value: Mutex::new(None),
    })
    
    // Register the get_backend_port command so the frontend can call it
    .invoke_handler(tauri::generate_handler![get_backend_port])
    
    // Setup function runs once when the app starts
    .setup(move |app| {
      // In debug mode (development), enable logging
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // In production mode, spawn the Python backend as a sidecar process
      if !cfg!(debug_assertions) {
        // Get the sidecar binary (bundled Python backend)
        let sidecar = app.shell().sidecar("trackpad-math-backend").unwrap();
        
        // Spawn the process and get:
        // - rx: a stream of events (stdout, stderr, termination)
        // - child: the running process handle
        let (mut rx, child) = sidecar.spawn().expect("Failed to spawn sidecar");
        
        // Get access to our global state
        let state = app.state::<SidecarState>();
        
        // Create two channels for communication:
        // 1. Exit channel: backend signals when it's shutting down
        let (tx_exit, rx_signal) = std::sync::mpsc::channel();
        // 2. Port channel: backend reports its dynamic port number
        let (tx_port, rx_port) = std::sync::mpsc::channel();
        
        // Store everything in the global state
        *state.child.lock().unwrap() = Some(child);
        *state.exit_rx.lock().unwrap() = Some(rx_signal);
        *state.port_tx.lock().unwrap() = Some(tx_port.clone());
        *state.port_rx.lock().unwrap() = Some(rx_port);

        // Spawn an async task to monitor the backend's output
        // This runs in the background for the lifetime of the app
        tauri::async_runtime::spawn(async move {
                  let mut buf = Vec::new(); // Initialize buffer for line assembly

          // Loop through all events from the backend process
          while let Some(event) = rx.recv().await {
             match event {
               // When the backend prints to stdout
               tauri_plugin_shell::process::CommandEvent::Stdout(data) => {
                  // Append new data to buffer
                  buf.extend_from_slice(&data);

                  // Process all complete lines in the buffer
                  while let Some(i) = buf.iter().position(|&b| b == b'\n') {
                      // Extract the line including the newline
                      let line_bytes: Vec<u8> = buf.drain(..=i).collect();
                      let line_str = String::from_utf8_lossy(&line_bytes);
                      
                      // Use println! so it shows up in release builds on stdout
                      print!("Sidecar: {}", line_str); // line_str already has newline

                      // Look for the special "ACTUAL_PORT: <number>" message
                      if line_str.contains("ACTUAL_PORT: ") {
                        if let Some(port_str) = line_str.split("ACTUAL_PORT: ").last() {
                            // Try to parse the port number
                            if let Ok(port) = port_str.trim().parse::<u16>() {
                                // Send the port through the channel
                                let _ = tx_port.send(port);
                            }
                        }
                      }

                      // Look for the shutdown completion message
                      if line_str.contains("BACKEND_SHUTDOWN_COMPLETE") {
                        let _ = tx_exit.send(());
                      }
                  }
               }
               // When the backend prints to stderr
               tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
                  let line_str = String::from_utf8_lossy(&line);
                  eprintln!("Sidecar Stderr: {}", line_str);
               }
               // When the backend process terminates
               tauri_plugin_shell::process::CommandEvent::Terminated(_) => {
                  let _ = tx_exit.send(());
               }
               // Ignore other event types (stderr, etc.)
               _ => {}
             }
          }
        });
      }
      
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    
    // Event handler that runs when the app is exiting
    .run(move |app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        // Get the backend process and exit channel from state
        let state = app_handle.state::<SidecarState>();
        let child_opt = state.child.lock().unwrap().take();
        let rx_opt = state.exit_rx.lock().unwrap().take();

        if let Some(mut child) = child_opt {
          println!("Tauri: App exiting, stopping sidecar...");
          
          // 1. Attempt graceful shutdown by sending "shutdown" to stdin
          //    The Python backend listens for this and exits cleanly
          let _ = child.write(b"shutdown\n");
          
          // 2. Wait for the backend to acknowledge shutdown (up to 2 seconds)
          //    The backend sends a signal through the exit channel
          if let Some(rx) = rx_opt {
            let _ = rx.recv_timeout(std::time::Duration::from_secs(2));
          }
          
          // 3. If the backend is still running, force kill it
          //    This ensures we don't leave zombie processes
          let _ = child.kill();
        }
      }
    });
}
