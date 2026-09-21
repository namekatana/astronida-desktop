mod history;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| history::init(app.handle()))
        .invoke_handler(tauri::generate_handler![
            history::history_open,
            history::history_page,
            history::history_store,
            history::history_drop_channel,
            history::history_clear
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
