use std::sync::Mutex;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tauri::Manager;

pub struct SidecarState(pub Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(SidecarState(Mutex::new(None)))
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
        *state.0.lock().unwrap() = Some(child);

        tauri::async_runtime::spawn(async move {
          while let Some(event) = rx.recv().await {
             if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                  let line_str = String::from_utf8_lossy(&line);
                  log::info!("Sidecar: {}", line_str);
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
        let child_opt = { 
            state.0.lock().unwrap().take()
        };

        if let Some(mut child) = child_opt {
          println!("Tauri: App exiting, stopping sidecar...");
          // 1. Attempt graceful shutdown via stdin
          let _ = child.write(b"shutdown\n");
          
          // 2. Wait a bit
          std::thread::sleep(std::time::Duration::from_millis(200));
          
          // 3. Force kill
          let _ = child.kill();
        }
      }
    });
}
