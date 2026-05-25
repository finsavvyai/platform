pub mod cosine;
pub mod vector_store;

use vector_store::VectorStore;

pub fn search(query_vec: Vec<f32>, k: usize) -> Vec<(String, f32)> {
    let store = VectorStore::default(); // TODO: load from mmap file
    store.top_k(&query_vec, k)
}
