//! Telemetry -- per-request metrics tracking.
//!
//! Tracks cost, tokens, latency, cache hits, and booster hits.

use crate::types::TelemetrySnapshot;
use std::collections::HashMap;

#[derive(Debug, Clone)]
#[allow(dead_code)]
struct RequestRecord {
    provider: String,
    model: String,
    tokens_in: u64,
    tokens_out: u64,
    latency_ms: u64,
    cost_usd: f64,
    cached: bool,
    boosted: bool,
}

/// Cost per 1K tokens (input) for known models.
fn cost_table() -> HashMap<&'static str, f64> {
    let mut m = HashMap::new();
    m.insert("deepseek:deepseek-chat", 0.00014);
    m.insert("openai:gpt-4o-mini", 0.00015);
    m.insert("anthropic:claude-3-haiku", 0.00025);
    m.insert("openai:gpt-4o", 0.0025);
    m.insert("anthropic:claude-sonnet-4", 0.003);
    m.insert("anthropic:claude-opus-4", 0.015);
    m.insert("groq:llama-3.1-70b", 0.00059);
    m.insert("mistral:mistral-large", 0.002);
    m
}

/// Telemetry tracker for ClawPipe requests.
pub struct Telemetry {
    records: Vec<RequestRecord>,
    max_records: usize,
    costs: HashMap<&'static str, f64>,
}

impl Telemetry {
    pub fn new(max_records: usize) -> Self {
        Self {
            records: Vec::new(),
            max_records,
            costs: cost_table(),
        }
    }

    /// Estimate cost in USD for a request.
    pub fn estimate_cost(
        &self, provider: &str, model: &str,
        tokens_in: u64, tokens_out: u64,
    ) -> f64 {
        let key = format!("{provider}:{model}");
        let rate = self.costs.get(key.as_str()).copied().unwrap_or(0.001);
        ((tokens_in + tokens_out) as f64 / 1000.0) * rate
    }

    /// Record a completed request.
    #[allow(clippy::too_many_arguments)]
    pub fn record(
        &mut self, provider: &str, model: &str,
        tokens_in: u64, tokens_out: u64, latency_ms: u64,
        cost_usd: f64, cached: bool, boosted: bool,
    ) {
        if self.records.len() >= self.max_records {
            let keep = self.max_records / 2;
            self.records = self.records.split_off(self.records.len() - keep);
        }
        self.records.push(RequestRecord {
            provider: provider.to_string(),
            model: model.to_string(),
            tokens_in, tokens_out, latency_ms, cost_usd, cached, boosted,
        });
    }

    /// Get aggregate telemetry snapshot.
    pub fn snapshot(&self) -> TelemetrySnapshot {
        if self.records.is_empty() {
            return TelemetrySnapshot {
                total_requests: 0, total_tokens_in: 0, total_tokens_out: 0,
                total_cost_usd: 0.0, total_saved_by_cache: 0,
                total_saved_by_booster: 0, avg_latency_ms: 0,
                cache_hit_rate: "0.0%".to_string(),
            };
        }
        let mut ti = 0u64;
        let mut to = 0u64;
        let mut tc = 0.0f64;
        let mut tl = 0u64;
        let mut ch = 0u64;
        let mut bh = 0u64;
        for r in &self.records {
            ti += r.tokens_in;
            to += r.tokens_out;
            tc += r.cost_usd;
            tl += r.latency_ms;
            if r.cached { ch += 1; }
            if r.boosted { bh += 1; }
        }
        let n = self.records.len() as u64;
        let hr = (ch as f64 / n as f64) * 100.0;
        TelemetrySnapshot {
            total_requests: n, total_tokens_in: ti, total_tokens_out: to,
            total_cost_usd: (tc * 10000.0).round() / 10000.0,
            total_saved_by_cache: ch, total_saved_by_booster: bh,
            avg_latency_ms: tl / n,
            cache_hit_rate: format!("{hr:.1}%"),
        }
    }

    /// Reset all telemetry data.
    pub fn reset(&mut self) { self.records.clear(); }
}

impl Default for Telemetry {
    fn default() -> Self { Self::new(10_000) }
}
