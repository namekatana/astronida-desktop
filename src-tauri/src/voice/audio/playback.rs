use super::{FRAME_SAMPLES, SAMPLE_RATE};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, SizedSample, Stream, StreamConfig};
use futures_util::StreamExt;
use livekit::webrtc::audio_stream::native::NativeAudioStream;
use livekit::webrtc::audio_track::RtcAudioTrack;
use livekit::webrtc::native::audio_resampler::AudioResampler;
use ringbuf::traits::{Consumer, Producer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::async_runtime::JoinHandle;

const BUFFER_SECONDS: usize = 1;
const MAX_GAIN: f32 = 2.0;
const PENDING_CAPACITY: usize = SAMPLE_RATE as usize;

struct Slot {
    consumer: HeapCons<i16>,
    gain: f32,
    reader: JoinHandle<()>,
}

pub struct Mixer {
    slots: Mutex<HashMap<String, Slot>>,
    deafened: AtomicBool,
}

impl Mixer {
    pub fn new() -> Mixer {
        Mixer { slots: Mutex::new(HashMap::new()), deafened: AtomicBool::new(false) }
    }

    pub fn add(&self, identity: String, track: RtcAudioTrack, gain: f32) {
        let (mut producer, consumer): (HeapProd<i16>, HeapCons<i16>) =
            HeapRb::<i16>::new(SAMPLE_RATE as usize * BUFFER_SECONDS).split();
        let reader = tauri::async_runtime::spawn(async move {
            let mut frames = NativeAudioStream::new(track, SAMPLE_RATE as i32, 1);
            while let Some(frame) = frames.next().await {
                producer.push_slice(&frame.data);
            }
        });
        let slot = Slot { consumer, gain: clamp_gain(gain), reader };
        if let Some(previous) = self.slots.lock().unwrap().insert(identity, slot) {
            previous.reader.abort();
        }
    }

    pub fn remove(&self, identity: &str) {
        if let Some(slot) = self.slots.lock().unwrap().remove(identity) {
            slot.reader.abort();
        }
    }

    pub fn set_gain(&self, identity: &str, gain: f32) {
        if let Some(slot) = self.slots.lock().unwrap().get_mut(identity) {
            slot.gain = clamp_gain(gain);
        }
    }

    pub fn set_deafened(&self, deafened: bool) {
        self.deafened.store(deafened, Ordering::Relaxed);
    }

    pub fn clear(&self) {
        for (_, slot) in self.slots.lock().unwrap().drain() {
            slot.reader.abort();
        }
    }

    fn mix_frame(&self, out: &mut [i16; FRAME_SAMPLES], scratch: &mut [i16; FRAME_SAMPLES]) {
        let silent = self.deafened.load(Ordering::Relaxed);
        let mut slots = self.slots.lock().unwrap();
        if slots.is_empty() {
            drop(slots);
            out.fill(0);
            return;
        }
        let mut sum = [0f32; FRAME_SAMPLES];
        for slot in slots.values_mut() {
            let got = slot.consumer.pop_slice(scratch);
            if silent || slot.gain == 0.0 {
                continue;
            }
            for (acc, sample) in sum.iter_mut().zip(scratch[..got].iter()) {
                *acc += *sample as f32 * slot.gain;
            }
        }
        drop(slots);
        for (dst, acc) in out.iter_mut().zip(sum.iter()) {
            *dst = acc.clamp(i16::MIN as f32, i16::MAX as f32) as i16;
        }
    }
}

fn clamp_gain(gain: f32) -> f32 {
    if gain.is_finite() {
        gain.clamp(0.0, MAX_GAIN)
    } else {
        1.0
    }
}

pub fn open_output(mixer: Arc<Mixer>, far_end: HeapProd<i16>) -> Result<Stream, String> {
    let host = cpal::default_host();
    let device = host.default_output_device().ok_or("no_output_device")?;
    let supported = device.default_output_config().map_err(|e| e.to_string())?;
    let config = supported.config();
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, &config, mixer, far_end),
        SampleFormat::I16 => build::<i16>(&device, &config, mixer, far_end),
        SampleFormat::U16 => build::<u16>(&device, &config, mixer, far_end),
        SampleFormat::I32 => build::<i32>(&device, &config, mixer, far_end),
        other => Err(format!("unsupported_output_format:{other}")),
    }?;
    stream.play().map_err(|e| e.to_string())?;
    Ok(stream)
}

fn build<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    mixer: Arc<Mixer>,
    mut far_end: HeapProd<i16>,
) -> Result<Stream, String>
where
    T: SizedSample + FromSample<i16>,
{
    let channels = config.channels as u32;
    let sample_rate = config.sample_rate;
    let native = sample_rate == SAMPLE_RATE && channels == 1;
    let mut resampler = AudioResampler::default();
    let mut pending: VecDeque<i16> = VecDeque::with_capacity(PENDING_CAPACITY);
    let mut mono = [0i16; FRAME_SAMPLES];
    let mut scratch = [0i16; FRAME_SAMPLES];
    device
        .build_output_stream::<T, _, _>(
            config.clone(),
            move |out: &mut [T], _| {
                while pending.len() < out.len() {
                    mixer.mix_frame(&mut mono, &mut scratch);
                    far_end.push_slice(&mono);
                    if native {
                        pending.extend(mono);
                    } else {
                        let remixed = resampler.remix_and_resample(
                            &mono,
                            FRAME_SAMPLES as u32,
                            1,
                            SAMPLE_RATE,
                            channels,
                            sample_rate,
                        );
                        pending.extend(remixed.iter().copied());
                    }
                }
                let needed = out.len();
                for (dst, sample) in out.iter_mut().zip(pending.drain(..needed)) {
                    *dst = T::from_sample(sample);
                }
            },
            |_| {},
            None,
        )
        .map_err(|e| e.to_string())
}
