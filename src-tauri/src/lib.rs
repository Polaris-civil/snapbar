mod platform;

use enigo::{Enigo, Keyboard, Settings};
use platform::FocusTracker;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, TryLockError};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, Size};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[derive(Debug, Clone, Deserialize)]
struct ShortcutBinding {
    shortcut: String,
    text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShortcutSyncResult {
    registered: Vec<String>,
    failed: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TypeTextResult {
    target_restored: bool,
}

#[derive(Clone)]
struct InputService {
    focus_tracker: FocusTracker,
    typing_lock: Arc<Mutex<()>>,
}

impl InputService {
    fn new() -> Self {
        Self {
            focus_tracker: FocusTracker::start(),
            typing_lock: Arc::new(Mutex::new(())),
        }
    }

    fn type_text_blocking(&self, text: &str) -> Result<TypeTextResult, String> {
        if text.is_empty() {
            return Err("不能输入空文本。".to_string());
        }

        let _typing_guard = match self.typing_lock.try_lock() {
            Ok(guard) => guard,
            Err(TryLockError::WouldBlock) => {
                return Err("另一条文本正在输入，请稍后重试。".to_string())
            }
            Err(TryLockError::Poisoned(_)) => {
                return Err("输入服务状态异常，请重启 SnapBar。".to_string())
            }
        };

        self.focus_tracker.restore_previous()?;

        let mut enigo = Enigo::new(&Settings::default()).map_err(|error| {
            if cfg!(target_os = "macos") {
                format!("无法初始化输入服务：{error}。请在系统设置的隐私与安全性中允许 SnapBar 使用辅助功能。")
            } else {
                format!("无法初始化输入服务：{error}")
            }
        })?;

        enigo
            .text(text)
            .map_err(|error| format!("系统未能输入文本：{error}"))?;

        Ok(TypeTextResult {
            target_restored: true,
        })
    }
}

async fn dispatch_text(app: AppHandle, text: String) -> Result<TypeTextResult, String> {
    let service = app.state::<InputService>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.type_text_blocking(&text))
        .await
        .map_err(|error| format!("输入任务意外终止：{error}"))?
}

#[tauri::command]
async fn type_text(app: AppHandle, text: String) -> Result<TypeTextResult, String> {
    dispatch_text(app, text).await
}

#[tauri::command]
async fn set_panel_expanded(app: AppHandle, expanded: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口。".to_string())?;
    let target_size = if expanded {
        Size::Logical(LogicalSize::new(780.0, 560.0))
    } else {
        Size::Logical(LogicalSize::new(800.0, 100.0))
    };

    window
        .set_size(target_size)
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn minimize_main(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到主窗口。".to_string())?;
    window.minimize().map_err(|error| error.to_string())
}

fn is_safe_shortcut(shortcut: &str) -> bool {
    let tokens = shortcut
        .split('+')
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    if tokens.len() < 2 {
        return false;
    }

    let mut has_safe_modifier = false;
    let mut modifiers = HashSet::new();
    let mut main_keys = 0;
    for token in tokens {
        let canonical_modifier = match token.to_ascii_uppercase().as_str() {
            "CTRL" | "CONTROL" => Some("CTRL"),
            "ALT" | "OPTION" => Some("ALT"),
            "CMD" | "COMMAND" | "SUPER" => Some("COMMAND"),
            "CMDORCTRL" | "CMDORCONTROL" | "COMMANDORCTRL" | "COMMANDORCONTROL" => {
                Some("CMDORCTRL")
            }
            "SHIFT" => Some("SHIFT"),
            _ => None,
        };
        if let Some(modifier) = canonical_modifier {
            if !modifiers.insert(modifier) {
                return false;
            }
            if modifier != "SHIFT" {
                has_safe_modifier = true;
            }
        } else {
            main_keys += 1;
        }
    }

    has_safe_modifier && main_keys == 1
}

fn duplicate_shortcuts(bindings: &[ShortcutBinding]) -> HashSet<String> {
    let mut counts = HashMap::new();
    for binding in bindings {
        let shortcut = binding.shortcut.trim().to_ascii_lowercase();
        *counts.entry(shortcut).or_insert(0usize) += 1;
    }
    counts
        .into_iter()
        .filter_map(|(shortcut, count)| (count > 1).then_some(shortcut))
        .collect()
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

    let duplicates = duplicate_shortcuts(&bindings);
    let mut registered = Vec::new();
    let mut failed = Vec::new();

    for binding in bindings {
        let shortcut = binding.shortcut.trim().to_string();
        if !is_safe_shortcut(&shortcut) || duplicates.contains(&shortcut.to_ascii_lowercase()) {
            failed.push(shortcut);
            continue;
        }

        let text = binding.text;
        match global_shortcut.on_shortcut(shortcut.as_str(), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app = app.clone();
                let text = text.clone();
                tauri::async_runtime::spawn(async move {
                    let event_app = app.clone();
                    if let Err(error) = dispatch_text(app, text).await {
                        eprintln!("SnapBar shortcut input failed: {error}");
                        if let Err(emit_error) = event_app.emit("input-error", error) {
                            eprintln!(
                                "SnapBar failed to report shortcut input error: {emit_error}"
                            );
                        }
                    }
                });
            }
        }) {
            Ok(_) => registered.push(shortcut),
            Err(_) => failed.push(shortcut),
        }
    }

    Ok(ShortcutSyncResult { registered, failed })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(InputService::new())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            type_text,
            set_panel_expanded,
            minimize_main,
            update_prompt_shortcuts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{duplicate_shortcuts, is_safe_shortcut, ShortcutBinding};

    #[test]
    fn rejects_shortcuts_without_a_safe_modifier() {
        assert!(!is_safe_shortcut("A"));
        assert!(!is_safe_shortcut("Shift+A"));
        assert!(!is_safe_shortcut("Delete"));
        assert!(!is_safe_shortcut("Ctrl+Control+A"));
        assert!(is_safe_shortcut("Ctrl+Shift+A"));
        assert!(is_safe_shortcut("Command+K"));
        assert!(is_safe_shortcut("CmdOrCtrl+Space"));
    }

    #[test]
    fn finds_case_insensitive_duplicate_shortcuts() {
        let bindings = vec![
            ShortcutBinding {
                shortcut: "Ctrl+K".to_string(),
                text: "one".to_string(),
            },
            ShortcutBinding {
                shortcut: "ctrl+k".to_string(),
                text: "two".to_string(),
            },
        ];

        assert!(duplicate_shortcuts(&bindings).contains("ctrl+k"));
    }
}
