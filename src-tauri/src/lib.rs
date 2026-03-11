use enigo::{Enigo, Keyboard, Settings};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, LogicalSize, Manager, Size};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
};

lazy_static! {
    static ref PREV_WINDOW: Mutex<Option<ThreadSafeHwnd>> = Mutex::new(None);
}

#[derive(Clone, Copy, Debug)]
struct ThreadSafeHwnd(HWND);

unsafe impl Send for ThreadSafeHwnd {}
unsafe impl Sync for ThreadSafeHwnd {}

#[derive(Debug, Clone, Deserialize)]
struct ShortcutBinding {
    shortcut: String,
    text: String,
}

#[derive(Debug, Clone, Serialize)]
struct ShortcutSyncResult {
    registered: Vec<String>,
    failed: Vec<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn toggle_main(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
async fn type_text(text: String) {
    unsafe {
        let prev = PREV_WINDOW.lock().unwrap();
        if let Some(hwnd_wrapper) = *prev {
            let _ = SetForegroundWindow(hwnd_wrapper.0);
        }
    }

    thread::sleep(Duration::from_millis(200));

    if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
        let _ = enigo.text(&text);
    }
}

#[tauri::command]
async fn set_input_mode(app: AppHandle, enable: bool) {
    if let Some(window) = app.get_webview_window("main") {
        if enable {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
async fn set_panel_expanded(app: AppHandle, expanded: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let target_size = if expanded {
            Size::Logical(LogicalSize::new(780.0, 560.0))
        } else {
            Size::Logical(LogicalSize::new(800.0, 100.0))
        };

        let _ = window.set_size(target_size);
    }
}

#[tauri::command]
async fn minimize_main(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
async fn update_prompt_shortcuts(
    app: AppHandle,
    bindings: Vec<ShortcutBinding>,
) -> Result<ShortcutSyncResult, String> {
    let global_shortcut = app.global_shortcut();
    global_shortcut
        .unregister_all()
        .map_err(|error| error.to_string())?;

    let mut registered = Vec::new();
    let mut failed = Vec::new();

    for binding in bindings {
        let shortcut = binding.shortcut.trim().to_string();
        if shortcut.is_empty() {
            continue;
        }

        let text = binding.text.clone();
        match global_shortcut.on_shortcut(shortcut.as_str(), move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let text = text.clone();
                tauri::async_runtime::spawn(async move {
                    type_text(text).await;
                });
            }
        }) {
            Ok(_) => registered.push(shortcut),
            Err(_) => failed.push(shortcut),
        }
    }

    Ok(ShortcutSyncResult { registered, failed })
}

fn start_focus_tracker() {
    thread::spawn(|| {
        let current_pid = unsafe { GetCurrentProcessId() };
        loop {
            unsafe {
                let hwnd = GetForegroundWindow();
                if hwnd.0 != std::ptr::null_mut() {
                    let mut pid = 0;
                    GetWindowThreadProcessId(hwnd, Some(&mut pid));

                    if pid != current_pid {
                        let mut prev = PREV_WINDOW.lock().unwrap();
                        *prev = Some(ThreadSafeHwnd(hwnd));
                    }
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    start_focus_tracker();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            type_text,
            toggle_main,
            set_input_mode,
            set_panel_expanded,
            minimize_main,
            update_prompt_shortcuts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
