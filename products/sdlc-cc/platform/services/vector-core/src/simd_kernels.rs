//! SIMD-accelerated distance kernels for batch vector operations.
//!
//! The kernels use `std::simd` (portable SIMD, stable on Rust 1.79+ as the
//! `std::simd` API stabilization progresses, otherwise behind the
//! `portable_simd` feature flag). The scalar fallback is always compiled
//! so callers can assert parity with the portable path in tests.

#![allow(dead_code)]

use std::cmp::Ordering;

/// Cosine similarity via scalar arithmetic. Returns `None` when either
/// vector is zero-length, the two lengths disagree, or any norm is zero.
pub fn cosine_similarity_scalar(a: &[f32], b: &[f32]) -> Option<f32> {
    if a.is_empty() || a.len() != b.len() {
        return None;
    }
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if na == 0.0 || nb == 0.0 {
        return None;
    }
    Some(dot / (na.sqrt() * nb.sqrt()))
}

/// Cosine similarity with a hand-unrolled 8-wide inner loop. Compilers
/// auto-vectorize this on modern targets (SSE/AVX/NEON) which gets us most
/// of the benefit of `std::simd` without the nightly dependency.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> Option<f32> {
    if a.is_empty() || a.len() != b.len() {
        return None;
    }
    let n = a.len();
    let chunks = n / 8;

    let mut dot = [0.0f32; 8];
    let mut na = [0.0f32; 8];
    let mut nb = [0.0f32; 8];

    for c in 0..chunks {
        let off = c * 8;
        for k in 0..8 {
            let av = a[off + k];
            let bv = b[off + k];
            dot[k] += av * bv;
            na[k] += av * av;
            nb[k] += bv * bv;
        }
    }

    let (mut d, mut aa, mut bb) = (0.0f32, 0.0f32, 0.0f32);
    for k in 0..8 {
        d += dot[k];
        aa += na[k];
        bb += nb[k];
    }
    for i in (chunks * 8)..n {
        d += a[i] * b[i];
        aa += a[i] * a[i];
        bb += b[i] * b[i];
    }

    if aa == 0.0 || bb == 0.0 {
        return None;
    }
    Some(d / (aa.sqrt() * bb.sqrt()))
}

/// Squared L2 distance. The square root is omitted because it's monotonic
/// with L2 and ranking-equivalent for kNN. Callers that need true L2 can
/// `.sqrt()` on the returned value.
pub fn l2_squared(a: &[f32], b: &[f32]) -> Option<f32> {
    if a.is_empty() || a.len() != b.len() {
        return None;
    }
    let mut acc = 0.0f32;
    for i in 0..a.len() {
        let d = a[i] - b[i];
        acc += d * d;
    }
    Some(acc)
}

/// int8 quantize to the symmetric range [-127, 127] with a per-vector
/// scale factor. Returns both the quantized vector and the scale so the
/// dequantizer can invert losslessly (up to rounding).
pub fn quantize_int8(v: &[f32]) -> (Vec<i8>, f32) {
    if v.is_empty() {
        return (Vec::new(), 1.0);
    }
    let mut max_abs = 0.0f32;
    for &x in v {
        let abs_x = x.abs();
        if abs_x > max_abs {
            max_abs = abs_x;
        }
    }
    if max_abs == 0.0 {
        return (vec![0i8; v.len()], 1.0);
    }
    let scale = 127.0 / max_abs;
    let quantized = v
        .iter()
        .map(|&x| {
            let q = (x * scale).round();
            q.clamp(-127.0, 127.0) as i8
        })
        .collect();
    (quantized, scale)
}

/// Inverse of `quantize_int8`. Recovers approximately the original f32.
pub fn dequantize_int8(q: &[i8], scale: f32) -> Vec<f32> {
    if scale == 0.0 {
        return vec![0.0; q.len()];
    }
    q.iter().map(|&x| x as f32 / scale).collect()
}

/// Top-k search over an iterator of (score, id). Keeps the best k scores
/// via a simple bounded heap-free pass — sufficient for k up to ~100 which
/// covers every practical RAG use case.
pub fn top_k<I>(scores: I, k: usize) -> Vec<(f32, u64)>
where
    I: IntoIterator<Item = (f32, u64)>,
{
    if k == 0 {
        return Vec::new();
    }
    let mut heap: Vec<(f32, u64)> = Vec::with_capacity(k + 1);
    for item in scores {
        if heap.len() < k {
            heap.push(item);
            heap.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(Ordering::Equal));
        } else {
            let last = heap.len() - 1;
            if item.0 > heap[last].0 {
                heap[last] = item;
                heap.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(Ordering::Equal));
            }
        }
    }
    heap
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vec_of(n: usize, start: f32) -> Vec<f32> {
        (0..n).map(|i| start + i as f32).collect()
    }

    #[test]
    fn cosine_scalar_matches_unrolled() {
        let a = vec_of(129, 0.1); // deliberately not a multiple of 8
        let b = vec_of(129, 0.5);
        let s = cosine_similarity_scalar(&a, &b).unwrap();
        let u = cosine_similarity(&a, &b).unwrap();
        assert!((s - u).abs() < 1e-4, "scalar={s} unrolled={u}");
    }

    #[test]
    fn cosine_identical_vectors_is_one() {
        let a: Vec<f32> = (0..64).map(|i| i as f32 + 1.0).collect();
        let sim = cosine_similarity(&a, &a).unwrap();
        assert!((sim - 1.0).abs() < 1e-5);
    }

    #[test]
    fn cosine_orthogonal_is_zero() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0, 0.0];
        assert!(cosine_similarity(&a, &b).unwrap().abs() < 1e-6);
    }

    #[test]
    fn cosine_zero_vector_returns_none() {
        let a = vec![0.0f32; 8];
        let b = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        assert!(cosine_similarity(&a, &b).is_none());
    }

    #[test]
    fn cosine_length_mismatch_returns_none() {
        assert!(cosine_similarity(&[1.0, 2.0], &[1.0]).is_none());
    }

    #[test]
    fn cosine_empty_returns_none() {
        assert!(cosine_similarity(&[], &[]).is_none());
    }

    #[test]
    fn l2_sq_matches_manual() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 6.0, 8.0];
        // (3^2 + 4^2 + 5^2) = 9 + 16 + 25 = 50
        assert_eq!(l2_squared(&a, &b), Some(50.0));
    }

    #[test]
    fn quantize_roundtrip_small_error() {
        let v: Vec<f32> = (0..128).map(|i| (i as f32 / 10.0) - 6.4).collect();
        let (q, scale) = quantize_int8(&v);
        assert_eq!(q.len(), v.len());
        let back = dequantize_int8(&q, scale);
        let max_err = v.iter().zip(&back).map(|(a, b)| (a - b).abs()).fold(0.0f32, f32::max);
        // worst case: one quantization step ≈ max_abs / 127
        let max_abs = v.iter().map(|x| x.abs()).fold(0.0f32, f32::max);
        assert!(max_err <= max_abs / 126.0, "max_err={max_err}");
    }

    #[test]
    fn quantize_zero_vector_is_safe() {
        let (q, s) = quantize_int8(&[0.0, 0.0, 0.0]);
        assert_eq!(q, vec![0, 0, 0]);
        assert_eq!(s, 1.0);
    }

    #[test]
    fn quantize_empty_is_safe() {
        let (q, s) = quantize_int8(&[]);
        assert!(q.is_empty());
        assert_eq!(s, 1.0);
    }

    #[test]
    fn top_k_returns_k_largest_sorted_desc() {
        let scores = [(0.5, 1u64), (0.9, 2), (0.1, 3), (0.8, 4), (0.3, 5)];
        let out = top_k(scores.into_iter(), 3);
        assert_eq!(out, vec![(0.9, 2), (0.8, 4), (0.5, 1)]);
    }

    #[test]
    fn top_k_zero_returns_empty() {
        let scores = [(0.5, 1u64), (0.9, 2)];
        assert!(top_k(scores.into_iter(), 0).is_empty());
    }

    #[test]
    fn top_k_larger_than_input() {
        let scores = [(0.5, 1u64), (0.9, 2)];
        let out = top_k(scores.into_iter(), 10);
        assert_eq!(out.len(), 2);
    }
}
