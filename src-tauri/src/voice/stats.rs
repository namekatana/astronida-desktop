use livekit::webrtc::stats::{IceCandidatePairState, RtcStats};
use serde::Serialize;
use serde_json::Value;

pub const TOPIC: &str = "stats";
const MAX_PAYLOAD_BYTES: usize = 64;
const MAX_RTT_MS: f64 = 10_000.0;
const MAX_LOSS_PERCENT: f64 = 100.0;

#[derive(Serialize, Clone, Copy, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub rtt_ms: Option<f64>,
    pub loss_percent: Option<f64>,
}

#[derive(Serialize)]
struct Wire {
    r: Option<f64>,
    l: Option<f64>,
}

pub fn measure(report: &[RtcStats]) -> Stats {
    let mut candidate_pair = None;
    let mut remote_inbound = None;
    let mut fraction_lost = None;
    for entry in report {
        match entry {
            RtcStats::CandidatePair(pair)
                if pair.candidate_pair.nominated
                    && pair.candidate_pair.state == Some(IceCandidatePairState::Succeeded) =>
            {
                candidate_pair = Some(pair.candidate_pair.current_round_trip_time);
            }
            RtcStats::RemoteInboundRtp(inbound) => {
                if inbound.remote_inbound.round_trip_time_measurements > 0 {
                    remote_inbound = Some(inbound.remote_inbound.round_trip_time);
                }
                fraction_lost = Some(inbound.remote_inbound.fraction_lost);
            }
            _ => {}
        }
    }
    Stats {
        rtt_ms: candidate_pair.or(remote_inbound).map(|seconds| (seconds * 1000.0).round()),
        loss_percent: fraction_lost.map(|fraction| (fraction * 1000.0).round() / 10.0),
    }
}

pub fn encode(stats: Stats) -> Vec<u8> {
    serde_json::to_vec(&Wire { r: stats.rtt_ms, l: stats.loss_percent }).unwrap_or_default()
}

pub fn decode(payload: &[u8]) -> Option<Stats> {
    if payload.len() > MAX_PAYLOAD_BYTES {
        return None;
    }
    let value: Value = serde_json::from_slice(payload).ok()?;
    Some(Stats {
        rtt_ms: bounded(value.get("r"), MAX_RTT_MS),
        loss_percent: bounded(value.get("l"), MAX_LOSS_PERCENT),
    })
}

fn bounded(value: Option<&Value>, max: f64) -> Option<f64> {
    let number = value?.as_f64()?;
    number.is_finite().then(|| number.clamp(0.0, max))
}
