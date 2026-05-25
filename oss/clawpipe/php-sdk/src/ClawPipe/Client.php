<?php

declare(strict_types=1);

namespace ClawPipe;

/**
 * ClawPipe Client — main entry point.
 *
 * Wires the full pipeline: Booster → Packer → Cache → Gateway.
 *
 * Usage:
 *   $pipe   = new \ClawPipe\Client(['api_key' => 'cp_xxx']);
 *   $result = $pipe->prompt('What is 2 + 2?');
 *   echo $result['text']; // "4"
 */
class Client
{
    private Booster $booster;
    private Packer  $packer;
    private Cache   $cache;
    private Gateway $gateway;

    private string $apiKey;
    private string $provider;
    private string $model;
    private string $providerApiKey;
    private bool   $boosterEnabled;
    private bool   $packerEnabled;
    private bool   $cacheEnabled;

    /**
     * @param array{
     *   api_key: string,
     *   provider?: string,
     *   model?: string,
     *   provider_api_key?: string,
     *   gateway_url?: string,
     *   booster?: bool,
     *   packer?: bool,
     *   cache?: bool,
     *   cache_ttl?: int,
     * } $config
     */
    public function __construct(array $config)
    {
        $this->apiKey         = $config['api_key'] ?? throw new \InvalidArgumentException('api_key is required');
        $this->provider       = $config['provider'] ?? 'openai';
        $this->model          = $config['model'] ?? 'gpt-4o-mini';
        $this->providerApiKey = $config['provider_api_key'] ?? '';
        $this->boosterEnabled = $config['booster'] ?? true;
        $this->packerEnabled  = $config['packer'] ?? true;
        $this->cacheEnabled   = $config['cache'] ?? true;

        $this->booster = new Booster();
        $this->packer  = new Packer();
        $this->cache   = new Cache(ttl: $config['cache_ttl'] ?? 300);
        $this->gateway = new Gateway(
            apiKey: $this->apiKey,
            gatewayUrl: $config['gateway_url'] ?? 'https://api.clawpipe.ai/v1',
        );
    }

    /**
     * Process a prompt through the full pipeline.
     *
     * @param string $prompt  The user prompt.
     * @param array  $opts    Extra gateway options (e.g. temperature, max_tokens).
     *
     * @return array{
     *   text: string,
     *   tokens_in: int,
     *   tokens_out: int,
     *   latency_ms: int,
     *   boosted: bool,
     *   cached: bool,
     *   savings_pct: float,
     * }
     */
    public function prompt(string $prompt, array $opts = []): array
    {
        // Stage 1 — Booster
        if ($this->boosterEnabled) {
            $boosted = $this->booster->boost($prompt);
            if ($boosted !== null) {
                return $this->buildResult($boosted, boosted: true, cached: false, savingsPct: 100.0);
            }
        }

        // Stage 2 — Packer
        $savingsPct = 0.0;
        $packed     = $prompt;
        if ($this->packerEnabled) {
            $packResult = $this->packer->pack($prompt);
            $packed     = $packResult['text'];
            $savingsPct = $packResult['savings_pct'];
        }

        // Stage 3 — Cache
        if ($this->cacheEnabled) {
            $cached = $this->cache->get($packed);
            if ($cached !== null) {
                return $this->buildResult($cached, boosted: false, cached: true, savingsPct: $savingsPct);
            }
        }

        // Stage 4 — Gateway
        $response = $this->gateway->call(
            prompt: $packed,
            provider: $this->provider,
            model: $this->model,
            apiKey: $this->providerApiKey,
            opts: $opts,
        );

        // Store in cache
        if ($this->cacheEnabled) {
            $this->cache->set($packed, $response['text']);
        }

        return array_merge($response, [
            'boosted'     => false,
            'cached'      => false,
            'savings_pct' => $savingsPct,
        ]);
    }

    /**
     * Access the underlying Cache for stats / manual management.
     */
    public function cache(): Cache
    {
        return $this->cache;
    }

    /**
     * Access the underlying Booster for custom rule additions (future).
     */
    public function booster(): Booster
    {
        return $this->booster;
    }

    /**
     * Build a synthetic result array for boosted/cached responses.
     *
     * @return array{text: string, tokens_in: int, tokens_out: int, latency_ms: int, boosted: bool, cached: bool, savings_pct: float}
     */
    private function buildResult(
        string $text,
        bool   $boosted,
        bool   $cached,
        float  $savingsPct,
    ): array {
        return [
            'text'        => $text,
            'tokens_in'   => 0,
            'tokens_out'  => 0,
            'latency_ms'  => 0,
            'boosted'     => $boosted,
            'cached'      => $cached,
            'savings_pct' => $savingsPct,
        ];
    }
}
