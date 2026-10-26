use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::audio::decoder::decode_file;
use crate::audio::engine::AudioEngine;
use crate::audio::track::TrackState;
use crate::server::{LanInfo, LanServer};

#[derive(Serialize, Deserialize)]
pub struct FileMetadataResponse {
    pub duration: f64,
    pub sample_rate: u32,
    pub channels: usize,
    pub peaks: Vec<f32>,
}

#[derive(Serialize, Deserialize)]
pub struct PlaybackStateResponse {
    pub position: f64,
    pub is_playing: bool,
    pub duration: f64,
    pub meter_l: f32,
    pub meter_r: f32,
}

#[tauri::command]
pub fn daw_load_file(
    engine: State<'_, Arc<AudioEngine>>,
    song_id: String,
    track_id: String,
    file_path: String,
    track_name: String,
) -> Result<FileMetadataResponse, String> {
    // Decodificar archivo con Symphonia en hilo nativo
    let decoded = decode_file(&file_path)?;

    let track_state = TrackState::new(
        track_id,
        track_name,
        decoded.samples,
        decoded.sample_rate,
    );

    engine.add_track(song_id, track_state);

    Ok(FileMetadataResponse {
        duration: decoded.duration_seconds,
        sample_rate: decoded.sample_rate,
        channels: decoded.channels,
        peaks: decoded.peaks,
    })
}

#[tauri::command]
pub fn daw_remove_track(
    engine: State<'_, Arc<AudioEngine>>,
    song_id: String,
    track_id: String,
) -> Result<(), String> {
    engine.remove_track(&song_id, &track_id);
    Ok(())
}

#[tauri::command]
pub fn daw_update_track_mix(
    engine: State<'_, Arc<AudioEngine>>,
    song_id: String,
    track_id: String,
    volume: Option<f32>,
    pan: Option<f32>,
    mute: Option<bool>,
    solo: Option<bool>,
    semitones: Option<i32>,
    trim_start: Option<f64>,
    trim_end: Option<f64>,
    fade_in: Option<f64>,
    fade_out: Option<f64>,
) -> Result<(), String> {
    let trims = match (trim_start, trim_end, fade_in, fade_out) {
        (Some(ts), Some(te), Some(fi), Some(fo)) => Some((ts, te, fi, fo)),
        _ => None,
    };

    engine.update_track_mix(&song_id, &track_id, volume, pan, mute, solo, semitones, trims);
    Ok(())
}

#[tauri::command]
pub fn daw_play(engine: State<'_, Arc<AudioEngine>>) -> Result<(), String> {
    engine.play();
    Ok(())
}

#[tauri::command]
pub fn daw_pause(engine: State<'_, Arc<AudioEngine>>) -> Result<(), String> {
    engine.pause();
    Ok(())
}

#[tauri::command]
pub fn daw_stop(engine: State<'_, Arc<AudioEngine>>) -> Result<(), String> {
    engine.stop();
    Ok(())
}

#[tauri::command]
pub fn daw_seek(engine: State<'_, Arc<AudioEngine>>, seconds: f64) -> Result<(), String> {
    engine.seek(seconds);
    Ok(())
}

#[tauri::command]
pub fn daw_set_master_volume(engine: State<'_, Arc<AudioEngine>>, volume: f32) -> Result<(), String> {
    engine.set_master_volume(volume);
    Ok(())
}

#[tauri::command]
pub fn daw_set_tempo_ratio(engine: State<'_, Arc<AudioEngine>>, ratio: f32) -> Result<(), String> {
    engine.set_tempo_ratio(ratio);
    Ok(())
}

#[tauri::command]
pub fn daw_switch_song(engine: State<'_, Arc<AudioEngine>>, song_id: String) -> Result<(), String> {
    engine.switch_song(song_id);
    Ok(())
}

#[tauri::command]
pub fn daw_get_state(engine: State<'_, Arc<AudioEngine>>, song_id: String) -> Result<PlaybackStateResponse, String> {
    let (meter_l, meter_r) = engine.get_meters();
    Ok(PlaybackStateResponse {
        position: engine.get_position(),
        is_playing: engine.is_playing(),
        duration: engine.get_song_duration(&song_id),
        meter_l,
        meter_r,
    })
}

#[tauri::command]
pub fn daw_get_lan_info(server: State<'_, Arc<LanServer>>) -> Result<LanInfo, String> {
    Ok(server.get_info())
}

#[tauri::command]
pub fn daw_send_lyrics_sync(
    server: State<'_, Arc<LanServer>>,
    msg: serde_json::Value,
) -> Result<(), String> {
    server.update_state(msg);
    Ok(())
}

#[tauri::command]
pub fn daw_read_file_bytes(file_path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&file_path).map_err(|e| format!("Error al leer archivo {}: {}", file_path, e))
}

#[tauri::command]
pub fn daw_file_exists(file_path: String) -> bool {
    std::path::Path::new(&file_path).exists()
}

#[tauri::command]
pub fn daw_get_default_projects_dir() -> String {
    #[cfg(windows)]
    {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let path = std::path::Path::new(&user_profile).join("Documents").join("OpenMT Projects");
            return path.to_string_lossy().to_string();
        }
    }
    "./OpenMT Projects".to_string()
}

#[tauri::command]
pub fn daw_save_project_folder(
    folder_path: String,
    project_json: String,
    lyrics_files: Vec<(String, String)>,
    summary_text: String,
) -> Result<String, String> {
    let base_dir = std::path::Path::new(&folder_path);
    if !base_dir.exists() {
        std::fs::create_dir_all(base_dir).map_err(|e| format!("Error creando carpeta del proyecto: {}", e))?;
    }

    // 1. Guardar project.openmt
    let project_file = base_dir.join("project.openmt");
    std::fs::write(&project_file, project_json.as_bytes()).map_err(|e| format!("Error guardando project.openmt: {}", e))?;

    // 2. Guardar letras en subcarpeta lyrics/
    let lyrics_dir = base_dir.join("lyrics");
    let _ = std::fs::create_dir_all(&lyrics_dir);
    for (name, content) in lyrics_files {
        let safe_name: String = name
            .chars()
            .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let lrc_path = lyrics_dir.join(format!("{}.lrc", safe_name.trim()));
        let _ = std::fs::write(lrc_path, content.as_bytes());
    }

    // 3. Guardar resumen de repertorio
    let summary_file = base_dir.join("repertorio_setlist.txt");
    let _ = std::fs::write(summary_file, summary_text.as_bytes());

    Ok(project_file.to_string_lossy().to_string())
}
