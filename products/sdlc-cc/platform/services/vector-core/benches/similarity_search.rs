use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};

// Benches for the SIMD-accelerated distance kernels. Run:
//   cargo bench --bench similarity_search
//
// These keep the kernel impls honest: auto-vectorized unrolled version
// should beat the pure-scalar one on any target with SSE2 or NEON.
#[path = "../src/simd_kernels.rs"]
mod simd_kernels;

use simd_kernels::{cosine_similarity, cosine_similarity_scalar, l2_squared, quantize_int8};

fn make_pair(n: usize) -> (Vec<f32>, Vec<f32>) {
    let a: Vec<f32> = (0..n).map(|i| (i as f32).sin()).collect();
    let b: Vec<f32> = (0..n).map(|i| (i as f32).cos()).collect();
    (a, b)
}

fn bench_cosine(c: &mut Criterion) {
    for &dim in &[128usize, 512, 1536] {
        let (a, b) = make_pair(dim);
        let mut group = c.benchmark_group(format!("cosine_dim_{}", dim));
        group.throughput(Throughput::Elements(1));
        group.bench_function("scalar", |bn| {
            bn.iter(|| black_box(cosine_similarity_scalar(&a, &b)))
        });
        group.bench_function("unrolled", |bn| {
            bn.iter(|| black_box(cosine_similarity(&a, &b)))
        });
        group.finish();
    }
}

fn bench_l2(c: &mut Criterion) {
    let (a, b) = make_pair(1536);
    c.bench_function("l2_squared_dim_1536", |bn| {
        bn.iter(|| black_box(l2_squared(&a, &b)))
    });
}

fn bench_quantize(c: &mut Criterion) {
    let (a, _) = make_pair(1536);
    c.bench_function("quantize_int8_dim_1536", |bn| {
        bn.iter(|| black_box(quantize_int8(&a)))
    });
}

criterion_group!(benches, bench_cosine, bench_l2, bench_quantize);
criterion_main!(benches);
