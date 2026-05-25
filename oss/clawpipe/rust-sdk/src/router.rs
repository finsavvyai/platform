//! Smart Router -- self-learning model selection.
//!
//! Classifies prompt complexity and routes to the best provider/model
//! based on cost, quality, and latency. Weights update after every call.

use crate::types::RouteDecision;
use regex::Regex;
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct ModelProfile {
    provider: String,
    model: String,
    cost_per_1k: f64,
    avg_latency_ms: u64,
    quality_score: f64,
    #[allow(dead_code)]
    max_tokens: u64,
}

#[derive(Debug, Clone)]
struct LearnedWeight {
    total_calls: u64,
    avg_latency_ms: f64,
    avg_tokens_out: f64,
    score: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TaskComplexity { Simple, Medium, Complex }

/// Self-learning model router.
pub struct Router {
    models: Vec<ModelProfile>,
    weights: HashMap<String, LearnedWeight>,
}

impl Router {
    pub fn new() -> Self {
        Self { models: default_models(), weights: HashMap::new() }
    }

    /// Route a prompt to the best provider/model.
    pub fn route(
        &self, prompt: &str,
        model: Option<&str>, provider: Option<&str>,
    ) -> RouteDecision {
        if let (Some(m), Some(p)) = (model, provider) {
            return RouteDecision {
                provider: p.to_string(), model: m.to_string(),
                score: 1.0, reason: "explicit".to_string(),
            };
        }
        let complexity = classify_complexity(prompt);
        let mut candidates = self.rank_candidates(complexity);
        for c in &mut candidates {
            let key = format!("{}:{}", c.0, c.1);
            if let Some(lw) = self.weights.get(&key) {
                c.2 += (lw.score - 0.5) * 0.2;
            }
        }
        candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap());
        let best = &candidates[0];
        RouteDecision {
            provider: best.0.clone(), model: best.1.clone(),
            score: best.2, reason: format!("complexity={complexity:?}"),
        }
    }

    /// Record outcome for self-learning.
    pub fn learn(&mut self, route: &RouteDecision, latency_ms: u64, tokens_out: u64) {
        let key = format!("{}:{}", route.provider, route.model);
        let lat = latency_ms as f64;
        let tok = tokens_out as f64;
        let entry = self.weights.entry(key).or_insert(LearnedWeight {
            total_calls: 0, avg_latency_ms: 0.0,
            avg_tokens_out: 0.0, score: 0.0,
        });
        let n = entry.total_calls + 1;
        entry.avg_latency_ms += (lat - entry.avg_latency_ms) / n as f64;
        entry.avg_tokens_out += (tok - entry.avg_tokens_out) / n as f64;
        entry.total_calls = n;
        entry.score = compute_score(entry.avg_latency_ms, entry.avg_tokens_out);
    }

    fn rank_candidates(&self, c: TaskComplexity) -> Vec<(String, String, f64)> {
        let (cw, qw) = match c {
            TaskComplexity::Simple => (0.6, 0.2),
            TaskComplexity::Medium => (0.3, 0.5),
            TaskComplexity::Complex => (0.1, 0.7),
        };
        let sw = 1.0 - cw - qw;
        self.models.iter().map(|m| {
            let cost_s = 1.0 - (m.cost_per_1k / 15.0).min(1.0);
            let qual_s = m.quality_score;
            let speed_s = 1.0 - (m.avg_latency_ms as f64 / 3000.0).min(1.0);
            let score = cw * cost_s + qw * qual_s + sw * speed_s;
            (m.provider.clone(), m.model.clone(), score)
        }).collect()
    }
}

impl Default for Router {
    fn default() -> Self { Self::new() }
}

/// Classify prompt complexity based on length and structure.
pub fn classify_complexity(prompt: &str) -> TaskComplexity {
    let tokens = (prompt.len() + 3) / 4;
    let code_re = Regex::new(r"```[\s\S]+```|function\s|class\s|const\s").unwrap();
    let multi_re = Regex::new(r"(?i)\b(then|after that|next|finally|step \d)\b").unwrap();
    let has_code = code_re.is_match(prompt);
    let has_multi = multi_re.is_match(prompt);
    if tokens > 2000 || (has_code && has_multi) { TaskComplexity::Complex }
    else if tokens > 500 || has_code || has_multi { TaskComplexity::Medium }
    else { TaskComplexity::Simple }
}

fn compute_score(latency_ms: f64, tokens_out: f64) -> f64 {
    let lat_score = 1.0 - (latency_ms / 5000.0).min(1.0);
    let eff_score = (tokens_out / 1000.0).min(1.0);
    lat_score * 0.5 + eff_score * 0.5
}

fn default_models() -> Vec<ModelProfile> {
    vec![
        mp("deepseek", "deepseek-chat", 0.14, 800, 0.82, 64000),
        mp("openai", "gpt-4o-mini", 0.15, 600, 0.85, 128000),
        mp("anthropic", "claude-3-haiku", 0.25, 500, 0.88, 200000),
        mp("openai", "gpt-4o", 2.5, 1200, 0.94, 128000),
        mp("anthropic", "claude-sonnet-4", 3.0, 1000, 0.95, 200000),
        mp("anthropic", "claude-opus-4", 15.0, 2000, 0.99, 200000),
        mp("groq", "llama-3.1-70b", 0.59, 300, 0.80, 32000),
        mp("mistral", "mistral-large", 2.0, 900, 0.90, 128000),
    ]
}

fn mp(p: &str, m: &str, c: f64, l: u64, q: f64, t: u64) -> ModelProfile {
    ModelProfile {
        provider: p.to_string(), model: m.to_string(),
        cost_per_1k: c, avg_latency_ms: l, quality_score: q, max_tokens: t,
    }
}
