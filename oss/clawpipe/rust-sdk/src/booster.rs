//! Agent Booster -- deterministic transforms that skip LLM calls.
//!
//! Resolves prompts locally when the answer can be computed without AI.
//! Implements 6 core rules: json, math, date, unit-conversion, uuid, base64.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use regex::Regex;

/// Try to resolve a prompt without an LLM. Returns `None` if no rule matches.
pub fn try_resolve(input: &str) -> Option<String> {
    let trimmed = input.trim();
    let rules: Vec<fn(&str) -> Option<String>> = vec![
        json_format_rule,
        math_rule,
        date_rule,
        unit_conversion_rule,
        uuid_rule,
        base64_rule,
    ];
    for rule in rules {
        if let Some(result) = rule(trimmed) {
            return Some(result);
        }
    }
    None
}

fn json_format_rule(input: &str) -> Option<String> {
    let lower = input.to_lowercase();
    let starts = lower.starts_with("format this json")
        || lower.starts_with("pretty print");
    if !starts || !input.contains('{') {
        return None;
    }
    let json_start = input.find('{')?;
    let json_str = &input[json_start..];
    let parsed: serde_json::Value = serde_json::from_str(json_str).ok()?;
    Some(serde_json::to_string_pretty(&parsed).ok()?)
}

fn math_rule(input: &str) -> Option<String> {
    let re = Regex::new(r"(?i)^(?:calculate|compute|what is|evaluate|solve)\s+(.+)").ok()?;
    let caps = re.captures(input)?;
    let expr = caps.get(1)?.as_str().trim();
    let safe_re = Regex::new(r"^[\d\s+\-*/().,%^]+$").ok()?;
    if !safe_re.is_match(expr) {
        return None;
    }
    let expr = expr.replace('^', "**");
    Some(eval_math(&expr)?.to_string())
}

fn date_rule(input: &str) -> Option<String> {
    let re1 = Regex::new(r"(?i)what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)").ok()?;
    let re2 = Regex::new(r"(?i)(?:today|now|current date)").ok()?;
    if input.len() >= 60 {
        return None;
    }
    if re1.is_match(input) || re2.is_match(input) {
        return Some(chrono::Utc::now().to_rfc3339());
    }
    None
}

fn unit_conversion_rule(input: &str) -> Option<String> {
    let re = Regex::new(r"(?i)convert\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)").ok()?;
    let caps = re.captures(input)?;
    let value: f64 = caps.get(1)?.as_str().parse().ok()?;
    let from = caps.get(2)?.as_str().to_lowercase();
    let to = caps.get(3)?.as_str().to_lowercase();
    let result = convert(value, &from, &to)?;
    let rounded = format!("{:.4}", result).trim_end_matches('0')
        .trim_end_matches('.').to_string();
    let r: f64 = rounded.parse().ok()?;
    Some(format!("{value} {from} = {r} {to}"))
}

fn convert(value: f64, from: &str, to: &str) -> Option<f64> {
    match (from, to) {
        ("km", "miles") => Some(value * 0.621371),
        ("km", "m") => Some(value * 1000.0),
        ("km", "ft") => Some(value * 3280.84),
        ("miles", "km") => Some(value * 1.60934),
        ("miles", "m") => Some(value * 1609.34),
        ("miles", "ft") => Some(value * 5280.0),
        ("kg", "lbs") => Some(value * 2.20462),
        ("kg", "g") => Some(value * 1000.0),
        ("kg", "oz") => Some(value * 35.274),
        ("lbs", "kg") => Some(value * 0.453592),
        ("lbs", "g") => Some(value * 453.592),
        ("lbs", "oz") => Some(value * 16.0),
        ("c", "f") => Some(value * 9.0 / 5.0 + 32.0),
        ("c", "k") => Some(value + 273.15),
        ("f", "c") => Some((value - 32.0) * 5.0 / 9.0),
        ("f", "k") => Some((value - 32.0) * 5.0 / 9.0 + 273.15),
        _ => None,
    }
}

fn uuid_rule(input: &str) -> Option<String> {
    let re = Regex::new(r"(?i)generate\s+(?:a\s+)?uuid").ok()?;
    if re.is_match(input) {
        return Some(uuid::Uuid::new_v4().to_string());
    }
    None
}

fn base64_rule(input: &str) -> Option<String> {
    let enc_re = Regex::new(r"(?i)base64\s+encode\s+(.+)").ok()?;
    if let Some(caps) = enc_re.captures(input) {
        let data = caps.get(1)?.as_str().trim();
        return Some(B64.encode(data.as_bytes()));
    }
    let dec_re = Regex::new(r"(?i)base64\s+decode\s+(.+)").ok()?;
    if let Some(caps) = dec_re.captures(input) {
        let data = caps.get(1)?.as_str().trim();
        let bytes = B64.decode(data).ok()?;
        return Some(String::from_utf8(bytes).ok()?);
    }
    None
}

/// Simple math evaluator supporting +, -, *, / and parentheses.
fn eval_math(expr: &str) -> Option<f64> {
    let expr = expr.replace("**", "^").replace(' ', "");
    let mut pos = 0;
    let result = parse_expr(&expr, &mut pos)?;
    if pos == expr.len() { Some(result) } else { None }
}

fn parse_expr(expr: &str, pos: &mut usize) -> Option<f64> {
    let mut left = parse_term(expr, pos)?;
    while *pos < expr.len() {
        let ch = expr.as_bytes()[*pos] as char;
        if ch == '+' || ch == '-' {
            *pos += 1;
            let right = parse_term(expr, pos)?;
            left = if ch == '+' { left + right } else { left - right };
        } else {
            break;
        }
    }
    Some(left)
}

fn parse_term(expr: &str, pos: &mut usize) -> Option<f64> {
    let mut left = parse_power(expr, pos)?;
    while *pos < expr.len() {
        let ch = expr.as_bytes()[*pos] as char;
        if ch == '*' || ch == '/' {
            *pos += 1;
            let right = parse_power(expr, pos)?;
            left = if ch == '*' { left * right } else { left / right };
        } else {
            break;
        }
    }
    Some(left)
}

fn parse_power(expr: &str, pos: &mut usize) -> Option<f64> {
    let base = parse_atom(expr, pos)?;
    if *pos < expr.len() && expr.as_bytes()[*pos] as char == '^' {
        *pos += 1;
        let exp = parse_power(expr, pos)?;
        Some(base.powf(exp))
    } else {
        Some(base)
    }
}

fn parse_atom(expr: &str, pos: &mut usize) -> Option<f64> {
    if *pos < expr.len() && expr.as_bytes()[*pos] as char == '(' {
        *pos += 1;
        let val = parse_expr(expr, pos)?;
        if *pos < expr.len() && expr.as_bytes()[*pos] as char == ')' {
            *pos += 1;
        }
        return Some(val);
    }
    let start = *pos;
    if *pos < expr.len() && expr.as_bytes()[*pos] as char == '-' {
        *pos += 1;
    }
    while *pos < expr.len() {
        let ch = expr.as_bytes()[*pos] as char;
        if ch.is_ascii_digit() || ch == '.' { *pos += 1; } else { break; }
    }
    expr[start..*pos].parse::<f64>().ok()
}
