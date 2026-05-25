use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};

// Placeholder bench: measures allocation cost of random embeddings. Real
// embedding benches land once the embeddings module exposes a stable pub API.
fn random_vec(len: usize) -> Vec<f32> {
    (0..len).map(|i| (i as f32).sin()).collect()
}

fn bench_alloc_512(c: &mut Criterion) {
    let mut group = c.benchmark_group("embedding_alloc");
    group.throughput(Throughput::Elements(1));
    group.bench_function("dim=512", |b| {
        b.iter(|| black_box(random_vec(512)))
    });
    group.bench_function("dim=1024", |b| {
        b.iter(|| black_box(random_vec(1024)))
    });
    group.bench_function("dim=1536", |b| {
        b.iter(|| black_box(random_vec(1536)))
    });
    group.finish();
}

criterion_group!(benches, bench_alloc_512);
criterion_main!(benches);
