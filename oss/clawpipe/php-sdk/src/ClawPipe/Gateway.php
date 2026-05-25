<?php

declare(strict_types=1);

namespace ClawPipe;

/**
 * Gateway — HTTP client for the ClawPipe gateway API.
 *
 * Uses ext-curl only (no Guzzle or other dependencies).
 */
class Gateway
{
    private const DEFAULT_GATEWAY_URL = 'https://api.clawpipe.ai/v1';
    private const TIMEOUT_SECONDS     = 60;

    private string $gatewayUrl;

    public function __construct(
        private string $apiKey,
        string $gatewayUrl = self::DEFAULT_GATEWAY_URL,
    ) {
        $this->gatewayUrl = rtrim($gatewayUrl, '/');
    }

    /**
     * Send a prompt to the ClawPipe gateway and return the structured response.
     *
     * @param string $prompt   The prompt text to send.
     * @param string $provider Provider name (e.g. "openai", "anthropic").
     * @param string $model    Model identifier (e.g. "gpt-4o").
     * @param string $apiKey   Provider API key passed to the gateway.
     * @param array  $opts     Additional options merged into the request body.
     *
     * @return array{text: string, tokens_in: int, tokens_out: int, latency_ms: int}
     *
     * @throws \RuntimeException on curl failure or HTTP error.
     */
    public function call(
        string $prompt,
        string $provider,
        string $model,
        string $apiKey,
        array $opts = [],
    ): array {
        $url     = $this->gatewayUrl . '/prompt';
        $payload = array_merge($opts, [
            'prompt'   => $prompt,
            'provider' => $provider,
            'model'    => $model,
            'api_key'  => $apiKey,
        ]);

        $startMs  = (int) (microtime(true) * 1000);
        $response = $this->post($url, $payload);
        $latencyMs = (int) (microtime(true) * 1000) - $startMs;

        $data = json_decode($response, true);
        if (!is_array($data)) {
            throw new \RuntimeException('ClawPipe gateway returned invalid JSON');
        }

        return [
            'text'       => (string) ($data['text'] ?? ''),
            'tokens_in'  => (int)    ($data['tokens_in'] ?? 0),
            'tokens_out' => (int)    ($data['tokens_out'] ?? 0),
            'latency_ms' => (int)    ($data['latency_ms'] ?? $latencyMs),
        ];
    }

    /**
     * Execute a POST request via curl.
     *
     * @param string $url     Full endpoint URL.
     * @param array  $payload Data to JSON-encode and send.
     * @return string Raw response body.
     *
     * @throws \RuntimeException on curl error or non-2xx HTTP status.
     */
    private function post(string $url, array $payload): string
    {
        $ch = curl_init($url);
        if ($ch === false) {
            throw new \RuntimeException('Failed to initialise curl handle');
        }

        $body = json_encode($payload, JSON_THROW_ON_ERROR);

        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::TIMEOUT_SECONDS,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey,
                'User-Agent: clawpipe-php/1.0',
            ],
        ]);

        $responseBody = curl_exec($ch);
        $curlError    = curl_error($ch);
        $httpStatus   = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($responseBody === false) {
            throw new \RuntimeException('curl error: ' . $curlError);
        }

        if ($httpStatus >= 400) {
            $preview = substr((string) $responseBody, 0, 200);
            throw new \RuntimeException(
                "ClawPipe gateway error: HTTP {$httpStatus} — {$preview}"
            );
        }

        return (string) $responseBody;
    }
}
