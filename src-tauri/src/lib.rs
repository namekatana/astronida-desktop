mod history;
mod local_key;
mod notifications;
mod secure_store;
mod voice;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            voice::init(app.handle());
            history::init(app.handle())
        })
        .invoke_handler(tauri::generate_handler![
            history::history_open,
            history::history_page,
            history::history_store,
            history::history_newest_ids,
            history::history_latest_messages,
            history::history_drop_channel,
            history::history_clear,
            history::outbox_list,
            history::outbox_put,
            history::outbox_remove,
            history::cache_get,
            history::cache_put,
            notifications::notify_show,
            secure_store::secure_store_get,
            secure_store::secure_store_set,
            secure_store::secure_store_remove,
            voice::voice_connect,
            voice::voice_rotate_key,
            voice::voice_set_microphone,
            voice::voice_set_deafened,
            voice::voice_set_volume,
            voice::voice_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
