use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager};

const ACTIVATED_EVENT: &str = "notification-activated";
const MAIN_WINDOW: &str = "main";

#[derive(Deserialize)]
pub struct NotificationRequest {
    title: String,
    body: String,
    target: String,
}

#[tauri::command]
pub fn notify_show(app: AppHandle, request: NotificationRequest) {
    tauri::async_runtime::spawn(async move { show(app, request) });
}

#[cfg(windows)]
fn show(app: AppHandle, request: NotificationRequest) {
    use tauri_winrt_notification::Toast;

    let target = request.target;
    let _ = Toast::new(&app_id(&app))
        .title(&request.title)
        .text1(&request.body)
        .sound(None)
        .on_activated(move |_action| {
            open_target(&app, &target);
            Ok(())
        })
        .show();
}

#[cfg(not(windows))]
fn show(_app: AppHandle, _request: NotificationRequest) {}

#[cfg(windows)]
fn app_id(app: &AppHandle) -> String {
    if cfg!(debug_assertions) {
        tauri_winrt_notification::Toast::POWERSHELL_APP_ID.to_string()
    } else {
        app.config().identifier.clone()
    }
}

fn open_target(app: &AppHandle, target: &str) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit(ACTIVATED_EVENT, target.to_string());
}
