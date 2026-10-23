use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use super::track::TrackState;

pub struct AudioEngine {
    _stream: Option<cpal::Stream>,
    tracks: Arc<RwLock<HashMap<String, Vec<TrackState>>>>, // song_id -> tracks
    active_song_id: Arc<RwLock<String>>,

    is_playing: Arc<AtomicBool>,
    current_time_f64_bits: Arc<AtomicU64>,
    master_volume_bits: Arc<AtomicU32>,
    tempo_ratio_bits: Arc<AtomicU32>,

    meter_l_bits: Arc<AtomicU32>,
    meter_r_bits: Arc<AtomicU32>,
}

unsafe impl Send for AudioEngine {}
unsafe impl Sync for AudioEngine {}

impl AudioEngine {
    pub fn new() -> Self {
        let tracks = Arc::new(RwLock::new(HashMap::<String, Vec<TrackState>>::new()));
        let active_song_id = Arc::new(RwLock::new(String::from("default")));

        let is_playing = Arc::new(AtomicBool::new(false));
        let current_time_f64_bits = Arc::new(AtomicU64::new(0.0f64.to_bits()));
        let master_volume_bits = Arc::new(AtomicU32::new(1.0f32.to_bits()));
        let tempo_ratio_bits = Arc::new(AtomicU32::new(1.0f32.to_bits()));

        let meter_l_bits = Arc::new(AtomicU32::new(0.0f32.to_bits()));
        let meter_r_bits = Arc::new(AtomicU32::new(0.0f32.to_bits()));

        let cb_tracks = Arc::clone(&tracks);
        let cb_active_song = Arc::clone(&active_song_id);
        let cb_playing = Arc::clone(&is_playing);
        let cb_time = Arc::clone(&current_time_f64_bits);
        let cb_master = Arc::clone(&master_volume_bits);
        let cb_tempo = Arc::clone(&tempo_ratio_bits);
        let cb_meter_l = Arc::clone(&meter_l_bits);
        let cb_meter_r = Arc::clone(&meter_r_bits);

        let stream_opt = Self::init_stream(
            cb_tracks,
            cb_active_song,
            cb_playing,
            cb_time,
            cb_master,
            cb_tempo,
            cb_meter_l,
            cb_meter_r,
        );

        Self {
            _stream: stream_opt,
            tracks,
            active_song_id,
            is_playing,
            current_time_f64_bits,
            master_volume_bits,
            tempo_ratio_bits,
            meter_l_bits,
            meter_r_bits,
        }
    }

    fn init_stream(
        cb_tracks: Arc<RwLock<HashMap<String, Vec<TrackState>>>>,
        cb_active_song: Arc<RwLock<String>>,
        cb_playing: Arc<AtomicBool>,
        cb_time: Arc<AtomicU64>,
        cb_master: Arc<AtomicU32>,
        cb_tempo: Arc<AtomicU32>,
        cb_meter_l: Arc<AtomicU32>,
        cb_meter_r: Arc<AtomicU32>,
    ) -> Option<cpal::Stream> {
        let host = cpal::default_host();
        let device = match host.default_output_device() {
            Some(d) => d,
            None => {
                eprintln!("[AudioEngine] Aviso: No se encontró dispositivo de audio de salida predeterminado.");
                return None;
            }
        };

        let config = match device.default_output_config() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[AudioEngine] Aviso: Error al obtener configuración de audio: {e}");
                return None;
            }
        };

        let sample_rate = config.sample_rate().0 as f64;
        let channels = config.channels() as usize;

        let stream_res = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                let err_fn = |err| eprintln!("[AudioEngine] Error en stream de audio (F32): {err}");
                device.build_output_stream(
                    &config.into(),
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        Self::process_audio(
                            data,
                            sample_rate,
                            channels,
                            &cb_tracks,
                            &cb_active_song,
                            &cb_playing,
                            &cb_time,
                            &cb_master,
                            &cb_tempo,
                            &cb_meter_l,
                            &cb_meter_r,
                        );
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                let err_fn = |err| eprintln!("[AudioEngine] Error en stream de audio (I16): {err}");
                let mut float_buf = Vec::new();
                device.build_output_stream(
                    &config.into(),
                    move |data: &mut [i16], _: &cpal::OutputCallbackInfo| {
                        if float_buf.len() != data.len() {
                            float_buf.resize(data.len(), 0.0);
                        }
                        Self::process_audio(
                            &mut float_buf,
                            sample_rate,
                            channels,
                            &cb_tracks,
                            &cb_active_song,
                            &cb_playing,
                            &cb_time,
                            &cb_master,
                            &cb_tempo,
                            &cb_meter_l,
                            &cb_meter_r,
                        );
                        for (i, sample) in float_buf.iter().enumerate() {
                            data[i] = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
                        }
                    },
                    err_fn,
                    None,
                )
            }
            cpal::SampleFormat::U16 => {
                let err_fn = |err| eprintln!("[AudioEngine] Error en stream de audio (U16): {err}");
                let mut float_buf = Vec::new();
                device.build_output_stream(
                    &config.into(),
                    move |data: &mut [u16], _: &cpal::OutputCallbackInfo| {
                        if float_buf.len() != data.len() {
                            float_buf.resize(data.len(), 0.0);
                        }
                        Self::process_audio(
                            &mut float_buf,
                            sample_rate,
                            channels,
                            &cb_tracks,
                            &cb_active_song,
                            &cb_playing,
                            &cb_time,
                            &cb_master,
                            &cb_tempo,
                            &cb_meter_l,
                            &cb_meter_r,
                        );
                        for (i, sample) in float_buf.iter().enumerate() {
                            let s = sample.clamp(-1.0, 1.0);
                            data[i] = ((s * 32767.0) as i16 as i32 + 32768) as u16;
                        }
                    },
                    err_fn,
                    None,
                )
            }
            fmt => {
                eprintln!("[AudioEngine] Aviso: Formato de audio {:?} no soportado.", fmt);
                return None;
            }
        };

        match stream_res {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    eprintln!("[AudioEngine] Aviso: Error al iniciar reproducción de audio: {e}");
                }
                Some(stream)
            }
            Err(e) => {
                eprintln!("[AudioEngine] Aviso: Error al construir stream de audio: {e}");
                None
            }
        }
    }

    fn process_audio(
        output: &mut [f32],
        sample_rate: f64,
        channels: usize,
        tracks_lock: &Arc<RwLock<HashMap<String, Vec<TrackState>>>>,
        active_song_lock: &Arc<RwLock<String>>,
        playing: &Arc<AtomicBool>,
        time_bits: &Arc<AtomicU64>,
        master_bits: &Arc<AtomicU32>,
        tempo_bits: &Arc<AtomicU32>,
        meter_l_bits: &Arc<AtomicU32>,
        meter_r_bits: &Arc<AtomicU32>,
    ) {
        if !playing.load(Ordering::Relaxed) {
            output.fill(0.0);
            meter_l_bits.store(0.0f32.to_bits(), Ordering::Relaxed);
            meter_r_bits.store(0.0f32.to_bits(), Ordering::Relaxed);
            return;
        }

        let mut current_time = f64::from_bits(time_bits.load(Ordering::Relaxed));
        let master_vol = f32::from_bits(master_bits.load(Ordering::Relaxed));
        let tempo_ratio = f32::from_bits(tempo_bits.load(Ordering::Relaxed)) as f64;
        let dt = (1.0 / sample_rate) * tempo_ratio;

        let active_id = active_song_lock.read();
        let all_tracks = tracks_lock.read();
        let song_tracks = all_tracks.get(&*active_id);

        let mut peak_l: f32 = 0.0;
        let mut peak_r: f32 = 0.0;

        let any_solo = song_tracks
            .map(|ts| ts.iter().any(|t| t.solo))
            .unwrap_or(false);

        for frame in output.chunks_mut(channels) {
            let mut sum_l: f32 = 0.0;
            let mut sum_r: f32 = 0.0;

            if let Some(ts) = song_tracks {
                for track in ts {
                    let (l, r) = track.sample_at_time(current_time, any_solo);
                    sum_l += l;
                    sum_r += r;
                }
            }

            sum_l = (sum_l * master_vol).clamp(-1.0, 1.0);
            sum_r = (sum_r * master_vol).clamp(-1.0, 1.0);

            if channels >= 2 {
                frame[0] = sum_l;
                frame[1] = sum_r;
                for ch in 2..channels {
                    frame[ch] = 0.0;
                }
            } else if channels == 1 {
                frame[0] = (sum_l + sum_r) * 0.5;
            }

            let abs_l = sum_l.abs();
            let abs_r = sum_r.abs();
            if abs_l > peak_l { peak_l = abs_l; }
            if abs_r > peak_r { peak_r = abs_r; }

            current_time += dt;
        }

        time_bits.store(current_time.to_bits(), Ordering::Relaxed);
        meter_l_bits.store(peak_l.to_bits(), Ordering::Relaxed);
        meter_r_bits.store(peak_r.to_bits(), Ordering::Relaxed);
    }

    // Controles de transporte
    pub fn play(&self) {
        self.is_playing.store(true, Ordering::Relaxed);
    }

    pub fn pause(&self) {
        self.is_playing.store(false, Ordering::Relaxed);
    }

    pub fn stop(&self) {
        self.is_playing.store(false, Ordering::Relaxed);
        self.current_time_f64_bits.store(0.0f64.to_bits(), Ordering::Relaxed);
    }

    pub fn seek(&self, seconds: f64) {
        self.current_time_f64_bits.store(seconds.max(0.0).to_bits(), Ordering::Relaxed);
    }

    pub fn set_master_volume(&self, vol: f32) {
        self.master_volume_bits.store(vol.max(0.0).to_bits(), Ordering::Relaxed);
    }

    pub fn set_tempo_ratio(&self, ratio: f32) {
        self.tempo_ratio_bits.store(ratio.clamp(0.5, 2.0).to_bits(), Ordering::Relaxed);
    }

    pub fn get_position(&self) -> f64 {
        f64::from_bits(self.current_time_f64_bits.load(Ordering::Relaxed))
    }

    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Relaxed)
    }

    pub fn get_meters(&self) -> (f32, f32) {
        (
            f32::from_bits(self.meter_l_bits.load(Ordering::Relaxed)),
            f32::from_bits(self.meter_r_bits.load(Ordering::Relaxed)),
        )
    }

    // Gestión de canciones y pistas
    pub fn switch_song(&self, song_id: String) {
        self.stop();
        *self.active_song_id.write() = song_id;
    }

    pub fn add_track(&self, song_id: String, track: TrackState) {
        let mut map = self.tracks.write();
        let list = map.entry(song_id).or_default();
        list.retain(|t| t.id != track.id);
        list.push(track);
    }

    pub fn remove_track(&self, song_id: &str, track_id: &str) {
        let mut map = self.tracks.write();
        if let Some(list) = map.get_mut(song_id) {
            list.retain(|t| t.id != track_id);
        }
    }

    pub fn update_track_mix(
        &self,
        song_id: &str,
        track_id: &str,
        volume: Option<f32>,
        pan: Option<f32>,
        mute: Option<bool>,
        solo: Option<bool>,
        semitones: Option<i32>,
        trims: Option<(f64, f64, f64, f64)>,
    ) {
        let mut map = self.tracks.write();
        if let Some(list) = map.get_mut(song_id) {
            if let Some(t) = list.iter_mut().find(|t| t.id == track_id) {
                if let Some(v) = volume { t.volume = v; }
                if let Some(p) = pan { t.pan = p; }
                if let Some(m) = mute { t.mute = m; }
                if let Some(s) = solo { t.solo = s; }
                if let Some(semi) = semitones { t.semitones = semi; }
                if let Some((ts, te, fi, fo)) = trims {
                    t.trim_start = ts;
                    t.trim_end = te;
                    t.fade_in = fi;
                    t.fade_out = fo;
                }
            }
        }
    }

    pub fn get_song_duration(&self, song_id: &str) -> f64 {
        let map = self.tracks.read();
        map.get(song_id)
            .and_then(|ts| ts.iter().map(|t| t.duration_seconds).max_by(|a, b| a.total_cmp(b)))
            .unwrap_or(0.0)
    }
}
