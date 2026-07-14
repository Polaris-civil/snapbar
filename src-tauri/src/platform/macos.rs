use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication, NSWorkspace};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct FocusTracker {
    previous_pid: Arc<Mutex<Option<i32>>>,
}

impl FocusTracker {
    pub fn start() -> Self {
        let previous_pid = Arc::new(Mutex::new(None));
        let tracker_pid = Arc::clone(&previous_pid);

        thread::spawn(move || {
            let current_pid = std::process::id() as i32;
            let workspace = NSWorkspace::sharedWorkspace();
            loop {
                if let Some(application) = workspace.frontmostApplication() {
                    let pid = application.processIdentifier();
                    if pid > 0 && pid != current_pid {
                        if let Ok(mut previous) = tracker_pid.lock() {
                            *previous = Some(pid);
                        }
                    }
                }
                thread::sleep(Duration::from_millis(100));
            }
        });

        Self { previous_pid }
    }

    pub fn restore_previous(&self) -> Result<(), String> {
        let pid = self
            .previous_pid
            .lock()
            .map_err(|_| "目标应用跟踪状态异常，请重启 SnapBar。".to_string())?
            .ok_or_else(|| "尚未记录目标应用，请先切换到要输入文本的应用。".to_string())?;

        let application = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
            .ok_or_else(|| "此前使用的目标应用已退出。".to_string())?;
        if application.isTerminated() {
            return Err("此前使用的目标应用已退出。".to_string());
        }
        if application.isActive() {
            return Ok(());
        }
        if application.isHidden() && !application.unhide() {
            return Err("系统拒绝显示此前使用的目标应用。".to_string());
        }
        if !application.activateWithOptions(NSApplicationActivationOptions::empty()) {
            return Err("macOS 拒绝激活此前使用的目标应用。".to_string());
        }

        let deadline = Instant::now() + Duration::from_millis(500);
        while Instant::now() < deadline {
            if application.isActive() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(20));
        }

        Err("目标应用未能在限定时间内获得焦点。".to_string())
    }
}
