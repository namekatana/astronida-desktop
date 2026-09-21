use super::activity::Activity;
use super::{FRAME_SAMPLES, SAMPLE_RATE};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SampleFormat, SizedSample, Stream, StreamConfig};
use livekit::webrtc::audio_frame::AudioFrame;
use livekit::webrtc::audio_source::native::NativeAudioSource;
use livekit::webrtc::native::apm::AudioProcessingModule;
use livekit::webrtc::native::audio_resampler::AudioResampler;
use ringbuf::traits::{Consumer, Observer, Producer};
use ringbuf::{HeapCons, HeapProd};
use std::borrow::Cow;
use std::sync::mpsc::{Receiver, SyncSender};
use std::sync::Arc;

const ESTIMATED_DELAY_MS: i32 = 40;

pub struct InputFormat {
    pub sample_rate: u32,
    pub channels: u32,
}

pub struct Wake(pub SyncSender<()>);

impl Wake {
    fn ring(&self) {
        let _ = self.0.try_send(());
    }
}

pub fn open_input(raw: HeapProd<i16>, wake: Wake) -> Result<(Stream, InputFormat), String> {
    let host = cpal::default_host();
    let device = host.default_input_device().ok_or("no_input_device")?;
    let supported = device.default_input_config().map_err(|e| e.to_string())?;
    let config = supported.config();
    let format = InputFormat { sample_rate: config.sample_rate, channels: config.channels as u32 };
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, &config, raw, wake),
        SampleFormat::I16 => build::<i16>(&device, &config, raw, wake),
        SampleFormat::U16 => build::<u16>(&device, &config, raw, wake),
        SampleFormat::I32 => build::<i32>(&device, &config, raw, wake),
        other => Err(format!("unsupported_input_format:{other}")),
    }?;
    stream.play().map_err(|e| e.to_string())?;
    Ok((stream, format))
}

fn build<T>(
    device: &cpal::Device,
    config: &StreamConfig,
    mut raw: HeapProd<i16>,
    wake: Wake,
) -> Result<Stream, String>
where
    T: SizedSample,
    i16: FromSample<T>,
{
    device
        .build_input_stream::<T, _, _>(
            config.clone(),
            move |data: &[T], _| {
                for sample in data {
                    if raw.try_push(i16::from_sample(*sample)).is_err() {
                        break;
                    }
                }
                wake.ring();
            },
            |_| {},
            None,
        )
        .map_err(|e| e.to_string())
}

pub struct Processor {
    format: InputFormat,
    raw: HeapCons<i16>,
    far_end: HeapCons<i16>,
    source: NativeAudioSource,
    activity: Arc<Activity>,
    apm: AudioProcessingModule,
    resampler: AudioResampler,
    device_chunk: Vec<i16>,
    frame: [i16; FRAME_SAMPLES],
    far_frame: [i16; FRAME_SAMPLES],
}

impl Processor {
    pub fn new(
        format: InputFormat,
        raw: HeapCons<i16>,
        far_end: HeapCons<i16>,
        source: NativeAudioSource,
        activity: Arc<Activity>,
    ) -> Processor {
        let mut apm = AudioProcessingModule::new(true, true, true, true);
        let _ = apm.set_stream_delay_ms(ESTIMATED_DELAY_MS);
        let device_chunk = vec![0i16; (format.sample_rate / 100 * format.channels) as usize];
        Processor {
            format,
            raw,
            far_end,
            source,
            activity,
            apm,
            resampler: AudioResampler::default(),
            device_chunk,
            frame: [0; FRAME_SAMPLES],
            far_frame: [0; FRAME_SAMPLES],
        }
    }

    pub fn run(mut self, wake: Receiver<()>) {
        while wake.recv().is_ok() {
            while self.raw.occupied_len() >= self.device_chunk.len() {
                self.raw.pop_slice(&mut self.device_chunk);
                self.to_native_frame();
                self.feed_far_end();
                let _ = self.apm.process_stream(&mut self.frame, SAMPLE_RATE as i32, 1);
                self.activity.observe(&self.frame);
                let frame = AudioFrame {
                    data: Cow::Borrowed(&self.frame[..]),
                    sample_rate: SAMPLE_RATE,
                    num_channels: 1,
                    samples_per_channel: FRAME_SAMPLES as u32,
                };
                if tauri::async_runtime::block_on(self.source.capture_frame(&frame)).is_err() {
                    return;
                }
            }
        }
    }

    fn to_native_frame(&mut self) {
        if self.format.sample_rate == SAMPLE_RATE && self.format.channels == 1 {
            self.frame.copy_from_slice(&self.device_chunk);
            return;
        }
        let resampled = self.resampler.remix_and_resample(
            &self.device_chunk,
            self.format.sample_rate / 100,
            self.format.channels,
            self.format.sample_rate,
            1,
            SAMPLE_RATE,
        );
        self.frame.copy_from_slice(&resampled[..FRAME_SAMPLES]);
    }

    fn feed_far_end(&mut self) {
        while self.far_end.occupied_len() >= FRAME_SAMPLES {
            self.far_end.pop_slice(&mut self.far_frame);
            let _ = self.apm.process_reverse_stream(&mut self.far_frame, SAMPLE_RATE as i32, 1);
        }
    }
}
