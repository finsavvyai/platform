<?php

declare(strict_types=1);

namespace ClawPipe;

/**
 * Context Packer — compress context to reduce token count.
 *
 * Strategies: whitespace compression, duplicate block removal,
 * and budget truncation.
 */
class Packer
{
    private int $maxTokens;

    public function __construct(int $maxTokens = 100_000)
    {
        $this->maxTokens = $maxTokens;
    }

    /**
     * Pack a text string to reduce token usage.
     *
     * @param string $text The text to compress.
     * @return array{text: string, savings_pct: float, original_tokens: int, packed_tokens: int}
     */
    public function pack(string $text): array
    {
        $originalTokens = $this->estimateTokens($text);

        $packed = $this->compressWhitespace($text);
        $packed = $this->deduplicateBlocks($packed);
        $packed = $this->truncateToLimit($packed);

        $packedTokens = $this->estimateTokens($packed);
        $savingsPct = $originalTokens > 0
            ? max(0.0, round((1 - $packedTokens / $originalTokens) * 100, 1))
            : 0.0;

        return [
            'text'            => $packed,
            'savings_pct'     => $savingsPct,
            'original_tokens' => $originalTokens,
            'packed_tokens'   => $packedTokens,
        ];
    }

    /**
     * Rough token estimate: ~4 chars per token.
     */
    public function estimateTokens(string $text): int
    {
        return (int) ceil(strlen($text) / 4);
    }

    /**
     * Collapse multiple whitespace / blank lines.
     */
    private function compressWhitespace(string $text): string
    {
        // Strip trailing whitespace per line
        $lines = explode("\n", $text);
        $lines = array_map('rtrim', $lines);
        $joined = implode("\n", $lines);

        // Collapse 3+ consecutive newlines to 2
        $joined = preg_replace('/\n{3,}/', "\n\n", $joined) ?? $joined;

        return trim($joined);
    }

    /**
     * Remove duplicate paragraph blocks (>50 chars).
     */
    private function deduplicateBlocks(string $text): string
    {
        $blocks = explode("\n\n", $text);
        $seen   = [];
        $unique = [];

        foreach ($blocks as $block) {
            $normalized = strtolower(trim($block));
            if ($normalized === '') {
                continue;
            }
            if (strlen($normalized) > 50 && in_array($normalized, $seen, true)) {
                continue;
            }
            $seen[]   = $normalized;
            $unique[] = $block;
        }

        return implode("\n\n", $unique);
    }

    /**
     * Truncate to token budget.
     */
    private function truncateToLimit(string $text): string
    {
        $maxChars = $this->maxTokens * 4;
        if (strlen($text) <= $maxChars) {
            return $text;
        }

        $truncated = substr($text, 0, $maxChars);
        $lastNl    = strrpos($truncated, "\n");
        $cut       = ($lastNl !== false && $lastNl > $maxChars * 0.8) ? $lastNl : $maxChars;

        return substr($truncated, 0, $cut) . "\n\n[Truncated -- context exceeded budget]";
    }
}
