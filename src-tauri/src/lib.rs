/// Image Forge — desktop shell.
///
/// All of the application lives in the web frontend (dist/); the Rust side
/// exists to give it native superpowers:
///   · a real folder picker (dialog plugin)
///   · direct file writes anywhere on disk (fs plugin) — no permission
///     re-prompts, works even where the browser File System Access API can't
///   · external links opening in the real browser (shell plugin)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running the Image Forge shell");
}
