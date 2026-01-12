#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      if !cfg!(debug_assertions) {
        use tauri_plugin_shell::ShellExt;
        let sidecar = app.shell().sidecar("trackpad-chars-backend").unwrap();
        let (mut rx, mut _child) = sidecar.spawn().expect("Failed to spawn sidecar");

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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
