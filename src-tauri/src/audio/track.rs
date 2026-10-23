use std::sync::Arc;

#[derive(Clone)]
#[allow(dead_code)]
pub struct TrackState {
    pub id: String,
    pub name: String,
    pub samples: Arc<Vec<f32>>, // Interleaved stereo [L, R, L, R, ...]
    pub sample_rate: u32,
    pub duration_seconds: f64,

    // Controles de mezcla
    pub volume: f32, // 0.0 a 1.25
    pub pan: f32,    // -1.0 a 1.0
    pub mute: bool,
    pub solo: bool,
    pub semitones: i32,
    pub pitch_locked: bool,

    // Recortes y desvanecimientos
    pub trim_start: f64,
    pub trim_end: f64,
    pub fade_in: f64,
    pub fade_out: f64,
}

impl TrackState {
    pub fn new(id: String, name: String, samples: Vec<f32>, sample_rate: u32) -> Self {
        let total_frames = samples.len() / 2;
        let duration_seconds = total_frames as f64 / sample_rate as f64;
        Self {
            id,
            name,
            samples: Arc::new(samples),
            sample_rate,
            duration_seconds,
            volume: 1.0,
            pan: 0.0,
            mute: false,
            solo: false,
            semitones: 0,
            pitch_locked: false,
            trim_start: 0.0,
            trim_end: duration_seconds,
            fade_in: 0.0,
            fade_out: 0.0,
        }
    }

    /// Lee una muestra estéreo en una posición en segundos dada
    pub fn sample_at_time(&self, time_seconds: f64, any_solo: bool) -> (f32, f32) {
        if self.mute || (any_solo && !self.solo) {
            return (0.0, 0.0);
        }

        if time_seconds < self.trim_start || (self.trim_end > 0.0 && time_seconds >= self.trim_end) {
            return (0.0, 0.0);
        }

        let frame_pos = time_seconds * self.sample_rate as f64;
        let total_frames = self.samples.len() / 2;
        if total_frames == 0 {
            return (0.0, 0.0);
        }

        let idx0 = frame_pos.floor() as usize;
        let frac = (frame_pos - idx0 as f64) as f32;

        if idx0 >= total_frames {
            return (0.0, 0.0);
        }

        let idx1 = (idx0 + 1).min(total_frames - 1);

        // Muestras L y R con interpolación lineal
        let l0 = self.samples[idx0 * 2];
        let r0 = self.samples[idx0 * 2 + 1];
        let l1 = self.samples[idx1 * 2];
        let r1 = self.samples[idx1 * 2 + 1];

        let mut left = l0 + (l1 - l0) * frac;
        let mut right = r0 + (r1 - r0) * frac;

        // Fades
        if self.fade_in > 0.0 && time_seconds < self.trim_start + self.fade_in {
            let fade_factor = ((time_seconds - self.trim_start) / self.fade_in).clamp(0.0, 1.0) as f32;
            left *= fade_factor;
            right *= fade_factor;
        }

        if self.fade_out > 0.0 && time_seconds > (self.trim_end - self.fade_out) {
            let fade_factor = ((self.trim_end - time_seconds) / self.fade_out).clamp(0.0, 1.0) as f32;
            left *= fade_factor;
            right *= fade_factor;
        }

        // Paneo estéreo constante
        let pan_l = if self.pan > 0.0 { 1.0 - self.pan } else { 1.0 };
        let pan_r = if self.pan < 0.0 { 1.0 + self.pan } else { 1.0 };

        (left * self.volume * pan_l, right * self.volume * pan_r)
    }
}
