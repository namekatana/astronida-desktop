mod activity;
mod capture;
mod playback;

use activity::Activity;
use capture::{Processor, Wake};
use livekit::webrtc::audio_source::native::NativeAudioSource;
use livekit::webrtc::audio_track::RtcAudioTrack;
use playback::Mixer;
use ringbuf::traits::Split;
use ringbuf::HeapRb;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

pub const SAMPLE_RATE: u32 = 48_000;
pub const FRAME_SAMPLES: usize = (SAMPLE_RATE / 100) as usize;
const RING_SECONDS: usize = 1;

pub struct AudioEngine {
    mixer: Arc<Mixer>,
    local_activity: Arc<Activity>,
    captures: bool,
    stop: Mutex<Option<mpsc::Sender<()>>>,
    owner: Mutex<Option<JoinHandle<()>>>,
}

impl AudioEngine {
    pub fn start(source: NativeAudioSource) -> Result<AudioEngine, String> {
        let mixer = Arc::new(Mixer::new());
        let local_activity = Arc::new(Activity::new());
        let (ready_tx, ready_rx) = mpsc::channel::<Result<bool, String>>();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();
        let owner_mixer = mixer.clone();
        let owner_activity = local_activity.clone();
        let owner = std::thread::Builder::new()
            .name("voice-audio".into())
            .spawn(move || run(owner_mixer, owner_activity, source, ready_tx, stop_rx))
            .map_err(|e| e.to_string())?;
        match ready_rx.recv() {
            Ok(Ok(captures)) => Ok(AudioEngine {
                mixer,
                local_activity,
                captures,
                stop: Mutex::new(Some(stop_tx)),
                owner: Mutex::new(Some(owner)),
            }),
            Ok(Err(error)) => {
                let _ = owner.join();
                Err(error)
            }
            Err(_) => Err("audio_thread_died".to_string()),
        }
    }

    pub fn captures(&self) -> bool {
        self.captures
    }

    pub fn add_participant(&self, identity: String, track: RtcAudioTrack) {
        self.mixer.add(identity, track);
    }

    pub fn remove_participant(&self, identity: &str) {
        self.mixer.remove(identity);
    }

    pub fn participants(&self) -> Vec<String> {
        self.mixer.identities()
    }

    pub fn set_volume(&self, identity: &str, gain: f32) {
        self.mixer.set_gain(identity, gain);
    }

    pub fn set_deafened(&self, deafened: bool) {
        self.mixer.set_deafened(deafened);
    }

    pub fn local_speaking(&self) -> bool {
        self.captures && self.local_activity.active()
    }

    pub fn has_participants(&self) -> bool {
        !self.mixer.is_empty()
    }

    pub fn remote_speaking(&self, out: &mut Vec<String>) {
        self.mixer.speaking(out);
    }

    pub fn stop(&self) {
        self.mixer.clear();
        self.stop.lock().unwrap().take();
        if let Some(owner) = self.owner.lock().unwrap().take() {
            let _ = owner.join();
        }
    }
}

impl Drop for AudioEngine {
    fn drop(&mut self) {
        self.stop();
    }
}

fn run(
    mixer: Arc<Mixer>,
    local_activity: Arc<Activity>,
    source: NativeAudioSource,
    ready: mpsc::Sender<Result<bool, String>>,
    stop: mpsc::Receiver<()>,
) {
    let (far_producer, far_consumer) = HeapRb::<i16>::new(SAMPLE_RATE as usize * RING_SECONDS).split();
    let (raw_producer, raw_consumer) = HeapRb::<i16>::new(SAMPLE_RATE as usize * RING_SECONDS * 2).split();
    let (wake_tx, wake_rx) = mpsc::sync_channel::<()>(1);
    let output = match playback::open_output(mixer, far_producer) {
        Ok(stream) => stream,
        Err(error) => {
            let _ = ready.send(Err(error));
            return;
        }
    };
    let capture = capture::open_input(raw_producer, Wake(wake_tx)).ok().map(|(input, format)| {
        let processor = Processor::new(format, raw_consumer, far_consumer, source, local_activity);
        let processing = std::thread::Builder::new()
            .name("voice-capture".into())
            .spawn(move || processor.run(wake_rx));
        (input, processing)
    });
    let _ = ready.send(Ok(capture.is_some()));
    let _ = stop.recv();
    drop(output);
    if let Some((input, processing)) = capture {
        drop(input);
        if let Ok(processing) = processing {
            let _ = processing.join();
        }
    }
}
