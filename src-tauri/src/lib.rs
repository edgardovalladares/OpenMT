use std::sync::Arc;
use tauri::Manager;

mod audio;
mod commands;
mod server;

use audio::engine::AudioEngine;
use server::LanServer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine = Arc::new(AudioEngine::new());
    let server = LanServer::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(engine)
        .manage(server)
        .invoke_handler(tauri::generate_handler![
            commands::daw_load_file,
            commands::daw_remove_track,
            commands::daw_update_track_mix,
            commands::daw_play,
            commands::daw_pause,
            commands::daw_stop,
            commands::daw_seek,
            commands::daw_set_master_volume,
            commands::daw_set_tempo_ratio,
            commands::daw_switch_song,
            commands::daw_get_state,
            commands::daw_get_lan_info,
            commands::daw_send_lyrics_sync,
            commands::daw_read_file_bytes,
            commands::daw_file_exists,
            commands::daw_get_default_projects_dir,
            commands::daw_save_project_folder
        ])
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let _ = _app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                );
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
