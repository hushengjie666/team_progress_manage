use objc2::AnyThread;
use objc2_app_kit::NSSound;
use objc2_foundation::NSData;
use std::f64::consts::TAU;
use std::time::Duration;

const SAMPLE_RATE: u32 = 44_100;

// A self-contained PCM sound keeps completion alerts independent of the WebView's
// AudioContext, including after the window has spent a long time in the background.
fn timer_sound_wav(profile: &str, repeats: u8) -> Vec<u8> {
    let repeats = repeats.clamp(1, 5) as usize;
    let tone_samples = SAMPLE_RATE as usize * 8 / 10;
    let gap_samples = SAMPLE_RATE as usize / 4;
    let sample_count = tone_samples * repeats + gap_samples * (repeats - 1);
    let data_size = (sample_count * 2) as u32;
    let mut wav = Vec::with_capacity(44 + data_size as usize);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_size).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt \x10\0\0\0\x01\0\x01\0");
    wav.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    wav.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes());
    wav.extend_from_slice(b"\x02\0\x10\0data");
    wav.extend_from_slice(&data_size.to_le_bytes());
    let frequency = match profile {
        "bell" => 880.0,
        "digital" => 520.0,
        _ => 660.0,
    };
    // Match the Web Audio levels in notifications.ts: lift the quieter tones
    // and reduce the square wave's more prominent harmonics.
    let peak_gain = match profile {
        "digital" => 0.12_f64,
        "bell" => 0.30_f64,
        _ => 0.36_f64,
    };
    for index in 0..sample_count {
        let offset = index % (tone_samples + gap_samples);
        let time = offset as f64 / SAMPLE_RATE as f64;
        let phase = (time * frequency).fract();
        let wave = match profile {
            "bell" => (TAU * phase).sin(),
            "digital" => {
                if phase < 0.5 {
                    1.0
                } else {
                    -1.0
                }
            }
            _ => 1.0 - 4.0 * (phase - 0.5).abs(),
        };
        let gain = if time < 0.02 {
            0.0001_f64 * (peak_gain / 0.0001).powf(time / 0.02)
        } else if time < 0.75 {
            peak_gain * (0.0001_f64 / peak_gain).powf((time - 0.02) / 0.73)
        } else {
            0.0
        };
        let sample = (wave * gain * i16::MAX as f64) as i16;
        wav.extend_from_slice(&sample.to_le_bytes());
    }
    wav
}

pub(crate) fn play(profile: &str, volume: u8, repeats: u8) -> Result<(), String> {
    if volume == 0 {
        return Ok(());
    }
    objc2::rc::autoreleasepool(|_| {
        let data = NSData::from_vec(timer_sound_wav(profile, repeats));
        let sound =
            NSSound::initWithData(NSSound::alloc(), &data).ok_or("Could not decode timer sound")?;
        sound.setVolume(volume.min(100) as f32 / 100.0);
        if !sound.play() {
            return Err("Could not start timer sound".into());
        }
        // NSSound starts asynchronously. Retain it on this worker until playback
        // finishes; neither the Tauri event loop nor React waits here.
        while sound.isPlaying() {
            std::thread::sleep(Duration::from_millis(25));
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quieter_tones_are_audible_and_electronic_tone_is_restrained() {
        let mut rms = Vec::new();
        for profile in ["soft", "bell", "digital"] {
            let wav = timer_sound_wav(profile, 1);
            let samples: Vec<f64> = wav[44..]
                .chunks_exact(2)
                .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]) as f64 / i16::MAX as f64)
                .collect();
            assert!(samples.iter().all(|sample| sample.abs() < 0.37));
            rms.push(
                (samples.iter().map(|sample| sample * sample).sum::<f64>() / samples.len() as f64)
                    .sqrt(),
            );
        }
        assert!(
            rms[0] > 0.045 && rms[1] > 0.045,
            "Soft and bell tones must remain audible: {rms:?}"
        );
        assert!(
            (0.9..1.1).contains(&(rms[0] / rms[1])),
            "Soft and bell energy should be close: {rms:?}"
        );
        assert!(
            (0.4..0.75).contains(&(rms[2] / rms[0])),
            "Restrain the electronic tone's stronger harmonics: {rms:?}"
        );
    }

    #[test]
    fn wav_is_decodable_and_preserves_repeat_duration() {
        for profile in ["soft", "bell", "digital"] {
            for repeats in [0, 1, 3, 5, 255] {
                let wav = timer_sound_wav(profile, repeats);
                let count = repeats.clamp(1, 5) as usize;
                let samples = 35_280 * count + 11_025 * (count - 1);
                assert_eq!(wav.len(), 44 + samples * 2);
                assert_eq!(
                    u32::from_le_bytes(wav[40..44].try_into().unwrap()) as usize,
                    samples * 2
                );
                let data = NSData::with_bytes(&wav);
                let sound = NSSound::initWithData(NSSound::alloc(), &data).unwrap();
                assert!((sound.duration() - samples as f64 / SAMPLE_RATE as f64).abs() < 0.001);
                assert!(wav[44..].chunks_exact(2).any(|bytes| i16::from_le_bytes([
                    bytes[0], bytes[1]
                ])
                .abs()
                    > 100));
            }
        }
    }
}
