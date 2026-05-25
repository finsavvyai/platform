//! ClawPipe SDK -- The intelligent AI pipeline.
//!
//! ```no_run
//! use clawpipe_ai::ClawPipe;
//!
//! #[tokio::main]
//! async fn main() {
//!     let pipe = ClawPipe::new("cp_xxx", "my-app");
//!     let result = pipe.prompt("Calculate 42 * 2", None).await.unwrap();
//!     println!("{}", result.text);
//! }
//! ```

pub mod booster;
pub mod cache;
pub mod gateway;
pub mod packer;
pub mod router;
pub mod telemetry;
pub mod types;

use cache::Cache;
use gateway::Gateway;
use packer::Packer;
use router::Router;
use std::sync::Mutex;
use telemetry::Telemetry;
use types::*;

const DEFAULT_GATEWAY: &str = "https://api.clawpipe.ai/v1";

/// ClawPipe client -- runs the full pipeline on every prompt.
pub struct ClawPipe {
    gateway: Gateway,
    cache: Cache,
    router: Mutex<Router>,
    packer: Packer,
    telemetry: Mutex<Telemetry>,
    enable_booster: bool,
    enable_packer: bool,
    enable_cache: bool,
}

impl ClawPipe {
    /// Create a new ClawPipe client with API key and project ID.
    pub fn new(api_key: &str, project_id: &str) -> Self {
        Self::with_config(ClawPipeConfig {
            api_key: api_key.to_string(),
            project_id: project_id.to_string(),
            gateway_url: None,
            cache_ttl_ms: None,
            enable_booster: None,
            enable_packer: None,
            enable_cache: None,
            budget_cap_usd: None,
        })
    }

    /// Create a new ClawPipe client with full configuration.
    pub fn with_config(config: ClawPipeConfig) -> Self {
        let gw_url = config.gateway_url.as_deref().unwrap_or(DEFAULT_GATEWAY);
        let ttl = config.cache_ttl_ms.unwrap_or(300_000);
        Self {
            gateway: Gateway::new(gw_url, &config.api_key, &config.project_id),
            cache: Cache::new(ttl, 10_000),
            router: Mutex::new(Router::new()),
            packer: Packer::new(None),
            telemetry: Mutex::new(Telemetry::default()),
            enable_booster: config.enable_booster.unwrap_or(true),
            enable_packer: config.enable_packer.unwrap_or(true),
            enable_cache: config.enable_cache.unwrap_or(true),
        }
    }

    /// Send a prompt through the full pipeline.
    pub async fn prompt(
        &self, input: &str, options: Option<PromptOptions>,
    ) -> Result<PipelineResult, ClawPipeError> {
        let start = std::time::Instant::now();
        let opts = options.unwrap_or_default();
        let mut meta = PipelineMeta::default_meta();

        // Stage 1: Booster
        if self.enable_booster {
            if let Some(boosted) = booster::try_resolve(input) {
                meta.boosted = true;
                meta.latency_ms = start.elapsed().as_millis() as u64;
                self.record_telemetry(&meta);
                return Ok(PipelineResult { text: boosted, meta });
            }
        }

        // Stage 2: Packer
        let packed = if self.enable_packer {
            let result = self.packer.pack(input, opts.system.as_deref());
            meta.packed = true;
            meta.context_savings = result.savings;
            result.packed
        } else {
            input.to_string()
        };

        // Stage 3: Cache
        if self.enable_cache {
            let cache_key = self.cache.key(&packed, "{}");
            if let Some(cached) = self.cache.get(&cache_key) {
                meta.cached = true;
                meta.latency_ms = start.elapsed().as_millis() as u64;
                self.record_telemetry(&meta);
                return Ok(PipelineResult { text: cached, meta });
            }
        }

        // Stage 4: Route
        let route = {
            let router = self.router.lock().unwrap();
            router.route(&packed, opts.model.as_deref(), opts.provider.as_deref())
        };
        meta.route = route.provider.clone();
        meta.model = route.model.clone();

        // Stage 5: Call gateway
        let response = self.gateway.call(&packed, &opts, &route).await?;
        meta.tokens_in = response.tokens_in;
        meta.tokens_out = response.tokens_out;

        // Learn from outcome
        {
            let mut router = self.router.lock().unwrap();
            router.learn(&route, response.latency_ms, response.tokens_out);
        }

        // Cache the response
        if self.enable_cache {
            let cache_key = self.cache.key(&packed, "{}");
            self.cache.set(&cache_key, &response.text);
        }

        meta.latency_ms = start.elapsed().as_millis() as u64;
        let cost = {
            let tel = self.telemetry.lock().unwrap();
            tel.estimate_cost(&meta.route, &meta.model, meta.tokens_in, meta.tokens_out)
        };
        meta.estimated_cost_usd = cost;
        self.record_telemetry(&meta);

        Ok(PipelineResult { text: response.text, meta })
    }

    /// Get telemetry snapshot.
    pub fn stats(&self) -> TelemetrySnapshot {
        self.telemetry.lock().unwrap().snapshot()
    }

    /// Get cache stats.
    pub fn cache_stats(&self) -> cache::CacheStats {
        self.cache.stats()
    }

    fn record_telemetry(&self, meta: &PipelineMeta) {
        let mut tel = self.telemetry.lock().unwrap();
        tel.record(
            &meta.route, &meta.model, meta.tokens_in, meta.tokens_out,
            meta.latency_ms, meta.estimated_cost_usd, meta.cached, meta.boosted,
        );
    }
}
