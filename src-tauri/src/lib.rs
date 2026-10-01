mod history;
mod local_key;
mod notifications;
mod secure_store;
mod voice;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            voice::init(app.handle());
            history::init(app.handle())
        })
        .invoke_handler(tauri::generate_handler![
            history::history_open,
            history::history_clear,
            history::messages::history_page,
            history::messages::history_store,
            history::messages::history_newest_ids,
            history::messages::history_latest_messages,
            history::messages::history_drop_channel,
            history::messages::history_remove_message,
            history::outbox::outbox_list,
            history::outbox::outbox_put,
            history::outbox::outbox_remove,
            history::cache::cache_get,
            history::cache::cache_put,
            history::media::media_read,
            history::media::media_write,
            history::media::media_keys,
            history::media::media_save_download,
            history::media::media_reveal_download,
            history::media::media_delete,
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
