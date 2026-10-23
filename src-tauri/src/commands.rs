use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

use crate::audio::decoder::decode_file;
use crate::audio::engine::AudioEngine;
use crate::audio::track::TrackState;

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
