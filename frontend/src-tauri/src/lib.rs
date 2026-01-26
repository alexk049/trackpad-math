use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tauri::Manager;

pub struct SidecarState {
  pub child: Mutex<Option<CommandChild>>,
  pub exit_rx: Mutex<Option<std::sync::mpsc::Receiver<()>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(SidecarState {
      child: Mutex::new(None),
      exit_rx: Mutex::new(None),
    })
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if !cfg!(debug_assertions) {
        let sidecar = app.shell().sidecar("trackpad-math-backend").unwrap();
        let (mut rx, child) = sidecar.spawn().expect("Failed to spawn sidecar");
        
        let state = app.state::<SidecarState>();
        let (tx, rx_signal) = std::sync::mpsc::channel();
        
        *state.child.lock().unwrap() = Some(child);
        *state.exit_rx.lock().unwrap() = Some(rx_signal);

        tauri::async_runtime::spawn(async move {
          while let Some(event) = rx.recv().await {
             match event {
               tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
                  let line_str = String::from_utf8_lossy(&line);
                  log::info!("Sidecar: {}", line_str);
                  if line_str.contains("BACKEND_SHUTDOWN_COMPLETE") {
                    let _ = tx.send(());
                  }
               }
               tauri_plugin_shell::process::CommandEvent::Terminated(_) => {
                  let _ = tx.send(());
               }
               _ => {}
             }
          }
        });
      }
      
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(move |app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        let state = app_handle.state::<SidecarState>();
        let child_opt = state.child.lock().unwrap().take();
        let rx_opt = state.exit_rx.lock().unwrap().take();

        if let Some(mut child) = child_opt {
          println!("Tauri: App exiting, stopping sidecar...");
          // 1. Attempt graceful shutdown via stdin
          let _ = child.write(b"shutdown\n");
          
          // 2. Wait for handshake or termination (up to 2 seconds)
          if let Some(rx) = rx_opt {
            let _ = rx.recv_timeout(std::time::Duration::from_secs(2));
          }
          
          // 3. Force kill if still alive
          let _ = child.kill();
        }
      }
    });
}
