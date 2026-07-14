#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;
#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
pub use macos::FocusTracker;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub use unsupported::FocusTracker;
#[cfg(target_os = "windows")]
pub use windows::FocusTracker;
