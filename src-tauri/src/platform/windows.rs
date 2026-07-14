use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, SetForegroundWindow,
};

#[derive(Clone)]
pub struct FocusTracker {
    previous_window: Arc<Mutex<Option<isize>>>,
}

impl FocusTracker {
    pub fn start() -> Self {
        let previous_window = Arc::new(Mutex::new(None));
        let tracker_window = Arc::clone(&previous_window);

        thread::spawn(move || {
            let current_pid = std::process::id();
            loop {
                unsafe {
                    let window = GetForegroundWindow();
                    if !window.0.is_null() {
                        let mut pid = 0;
                        GetWindowThreadProcessId(window, Some(&mut pid));
                        if pid != current_pid {
                            if let Ok(mut previous) = tracker_window.lock() {
                                *previous = Some(window.0 as isize);
                            }
                        }
                    }
                }
                thread::sleep(Duration::from_millis(100));
            }
        });

        Self { previous_window }
    }

    pub fn restore_previous(&self) -> Result<(), String> {
        let raw_window = self
            .previous_window
            .lock()
            .map_err(|_| "目标窗口跟踪状态异常，请重启 SnapBar。".to_string())?
            .ok_or_else(|| "尚未记录目标窗口，请先切换到要输入文本的应用。".to_string())?;
        let target = HWND(raw_window as *mut _);

        unsafe {
            if GetForegroundWindow() == target {
                return Ok(());
            }
            if !SetForegroundWindow(target).as_bool() {
                return Err("Windows 拒绝激活此前使用的目标窗口。".to_string());
            }

            let deadline = Instant::now() + Duration::from_millis(500);
            while Instant::now() < deadline {
                if GetForegroundWindow() == target {
                    return Ok(());
                }
                thread::sleep(Duration::from_millis(20));
            }
        }

        Err("目标窗口未能在限定时间内获得焦点。".to_string())
    }
}
