#[derive(Clone)]
pub struct FocusTracker;

impl FocusTracker {
    pub fn start() -> Self {
        Self
    }

    pub fn restore_previous(&self) -> Result<(), String> {
        Err("当前平台尚未实现目标窗口焦点恢复。".to_string())
    }
}
