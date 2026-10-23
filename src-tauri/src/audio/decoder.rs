use std::fs::File;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::errors::Error;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Clone)]
pub struct DecodedTrack {
    pub duration_seconds: f64,
    pub sample_rate: u32,
    pub channels: usize,
    pub samples: Vec<f32>, // Estéreo intercalado [L, R, L, R, ...]
    pub peaks: Vec<f32>,   // 800 puntos de pico para dibujar onda en React
}

pub fn decode_file<P: AsRef<Path>>(path: P) -> Result<DecodedTrack, String> {
    let file = File::open(&path).map_err(|e| format!("No se pudo abrir el archivo: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.as_ref().extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Formato de audio no reconocido: {e}"))?;

    let mut format = probed.format;

    // Buscar la primera pista de audio válida
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| "No se encontró pista de audio en el archivo".to_string())?;

    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let _channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(2);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| format!("Error al crear decodificador: {e}"))?;

    let mut samples: Vec<f32> = Vec::new();
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(Error::ResetRequired) => continue,
            Err(Error::IoError(ref e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(Error::IoError(_)) => break,
            Err(_) => break,
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(decoded) => {
                let spec = *decoded.spec();
                let duration = decoded.capacity() as u64;

                let buf = sample_buf.get_or_insert_with(|| SampleBuffer::new(duration, spec));
                buf.copy_interleaved_ref(decoded);

                let slice = buf.samples();
                if spec.channels.count() == 1 {
                    // Mono a estéreo
                    for &s in slice {
                        samples.push(s);
                        samples.push(s);
                    }
                } else if spec.channels.count() >= 2 {
                    // Si tiene más de 2 canales, tomar solo L y R
                    let ch_count = spec.channels.count();
                    for chunk in slice.chunks(ch_count) {
                        samples.push(chunk[0]);
                        samples.push(chunk[1]);
                    }
                }
            }
            Err(Error::IoError(_)) => break,
            Err(Error::DecodeError(_)) => continue,
            Err(_) => break,
        }
    }

    let total_frames = samples.len() / 2;
    let duration_seconds = total_frames as f64 / sample_rate as f64;

    // Calcular 800 picos para visualización en el canvas de React
    let num_peaks = 800;
    let mut peaks = Vec::with_capacity(num_peaks);
    if total_frames > 0 {
        let step = (total_frames / num_peaks).max(1);
        for i in 0..num_peaks {
            let start = i * step * 2;
            let end = ((i + 1) * step * 2).min(samples.len());
            let mut max_val: f32 = 0.0;
            for &s in &samples[start..end] {
                let abs = s.abs();
                if abs > max_val {
                    max_val = abs;
                }
            }
            peaks.push(max_val.min(1.0));
        }
    }

    Ok(DecodedTrack {
        duration_seconds,
        sample_rate,
        channels: 2,
        samples,
        peaks,
    })
}
