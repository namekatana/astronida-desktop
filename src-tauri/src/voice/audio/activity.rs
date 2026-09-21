use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::Instant;

const LOUD_RMS: f32 = 0.015;
const HOLD_MS: u64 = 180;

static ORIGIN: OnceLock<Instant> = OnceLock::new();

fn now_ms() -> u64 {
    ORIGIN.get_or_init(Instant::now).elapsed().as_millis() as u64 + 1
}

pub struct Activity(AtomicU64);

impl Activity {
    pub fn new() -> Activity {
        Activity(AtomicU64::new(0))
    }

    pub fn observe(&self, frame: &[i16]) {
        if is_loud(frame) {
            self.0.store(now_ms(), Ordering::Relaxed);
        }
    }

    pub fn active(&self) -> bool {
        let last = self.0.load(Ordering::Relaxed);
        last != 0 && now_ms().saturating_sub(last) <= HOLD_MS
    }
}

fn is_loud(frame: &[i16]) -> bool {
    if frame.is_empty() {
        return false;
    }
    let energy: f32 = frame
        .iter()
        .map(|sample| {
            let normalized = *sample as f32 / i16::MAX as f32;
            normalized * normalized
        })
        .sum();
    (energy / frame.len() as f32).sqrt() > LOUD_RMS
}
