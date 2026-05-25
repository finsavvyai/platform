use crate::cosine::cosine_similarity;

#[derive(Default)]
pub struct VectorStore {
    // TODO: memory-mapped store, metadata filters
    pub ids: Vec<String>,
    pub vecs: Vec<Vec<f32>>,
}

impl VectorStore {
    pub fn top_k(&self, q: &[f32], k: usize) -> Vec<(String, f32)> {
        let mut scored: Vec<(String, f32)> = self.ids.iter().zip(self.vecs.iter())
            .map(|(id, v)| (id.clone(), cosine_similarity(q, v)))
            .collect();
        scored.sort_by(|a,b| b.1.partial_cmp(&a.1).unwrap());
        scored.into_iter().take(k).collect()
    }
}
