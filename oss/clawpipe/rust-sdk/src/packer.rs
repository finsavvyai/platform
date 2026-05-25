//! Context Packer -- compress context to reduce token count.
//!
//! Strategies: whitespace compression, deduplication, boilerplate strip, truncate.

use std::collections::HashSet;

/// Result of packing a prompt.
#[derive(Debug, Clone)]
pub struct PackResult {
    pub packed: String,
    pub original_tokens: usize,
    pub packed_tokens: usize,
    pub savings: String,
}

/// Configuration for the packer.
#[derive(Debug, Clone)]
pub struct PackerConfig {
    pub max_tokens: usize,
    pub deduplication: bool,
    pub strip_boilerplate: bool,
    pub compress_whitespace: bool,
}

impl Default for PackerConfig {
    fn default() -> Self {
        Self {
            max_tokens: 100_000,
            deduplication: true,
            strip_boilerplate: true,
            compress_whitespace: true,
        }
    }
}

/// Context packer that compresses prompts to reduce token count.
pub struct Packer {
    config: PackerConfig,
}

impl Packer {
    pub fn new(config: Option<PackerConfig>) -> Self {
        Self { config: config.unwrap_or_default() }
    }

    /// Pack input (and optional system message), returning compressed text.
    pub fn pack(&self, input: &str, system: Option<&str>) -> PackResult {
        let original = match system {
            Some(s) => format!("{s}\n\n{input}"),
            None => input.to_string(),
        };
        let original_tokens = estimate_tokens(&original);
        let mut packed = original;

        if self.config.compress_whitespace {
            packed = compress_whitespace(&packed);
        }
        if self.config.deduplication {
            packed = deduplicate(&packed);
        }
        if self.config.strip_boilerplate {
            packed = strip_boilerplate(&packed);
        }
        packed = truncate_to_limit(&packed, self.config.max_tokens);

        let packed_tokens = estimate_tokens(&packed);
        let savings_pct = if original_tokens > 0 {
            ((1.0 - packed_tokens as f64 / original_tokens as f64) * 100.0).round() as i32
        } else {
            0
        };
        PackResult {
            packed,
            original_tokens,
            packed_tokens,
            savings: format!("{}%", savings_pct.max(0)),
        }
    }
}

/// Rough token estimate: ~4 chars per token.
pub fn estimate_tokens(text: &str) -> usize {
    (text.len() + 3) / 4
}

fn compress_whitespace(text: &str) -> String {
    let lines: Vec<&str> = text.lines().map(|l| l.trim_end()).collect();
    let joined = lines.join("\n");
    // Collapse 3+ newlines to 2
    let re = regex::Regex::new(r"\n{3,}").unwrap();
    re.replace_all(&joined, "\n\n").trim().to_string()
}

fn deduplicate(text: &str) -> String {
    let blocks: Vec<&str> = text.split("\n\n").collect();
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for block in blocks {
        let normalized = block.trim().to_lowercase();
        if normalized.is_empty() {
            continue;
        }
        if normalized.len() > 50 && seen.contains(&normalized) {
            continue;
        }
        seen.insert(normalized);
        unique.push(block);
    }
    unique.join("\n\n")
}

fn strip_boilerplate(text: &str) -> String {
    let patterns = [
        r"(?m)^//\s*eslint-disable.*$",
        r"(?m)^//\s*@ts-(ignore|expect-error|nocheck).*$",
        r"(?m)^'use strict';?\s*$",
        r"(?m)^/\*\s*istanbul ignore (next|else)\s*\*/$",
    ];
    let mut result = text.to_string();
    for pat in &patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            result = re.replace_all(&result, "").to_string();
        }
    }
    let re = regex::Regex::new(r"\n{3,}").unwrap();
    re.replace_all(&result, "\n\n").trim().to_string()
}

fn truncate_to_limit(text: &str, max_tokens: usize) -> String {
    let max_chars = max_tokens * 4;
    if text.len() <= max_chars {
        return text.to_string();
    }
    let truncated = &text[..max_chars.min(text.len())];
    let threshold = (max_chars as f64 * 0.8) as usize;
    let cut = if let Some(nl) = truncated.rfind('\n') {
        if nl > threshold { nl } else { max_chars.min(text.len()) }
    } else {
        max_chars.min(text.len())
    };
    format!(
        "{}\n\n[Truncated -- context exceeded budget]",
        &text[..cut]
    )
}
