<?php

declare(strict_types=1);

namespace ClawPipe;

/**
 * Agent Booster — deterministic transforms that skip LLM calls.
 *
 * Resolves prompts locally when the answer can be computed without AI:
 * math, date/time, UUID, uppercase, lowercase, reverse.
 */
class Booster
{
    /**
     * Attempt to resolve a prompt without calling an LLM.
     *
     * @param string $prompt The user prompt to evaluate.
     * @return string|null Resolved answer, or null if not boostable.
     */
    public function boost(string $prompt): ?string
    {
        $trimmed = trim($prompt);

        $result = $this->tryMath($trimmed);
        if ($result !== null) {
            return $result;
        }

        $result = $this->tryDate($trimmed);
        if ($result !== null) {
            return $result;
        }

        $result = $this->tryUuid($trimmed);
        if ($result !== null) {
            return $result;
        }

        $result = $this->tryUppercase($trimmed);
        if ($result !== null) {
            return $result;
        }

        $result = $this->tryLowercase($trimmed);
        if ($result !== null) {
            return $result;
        }

        $result = $this->tryReverse($trimmed);
        if ($result !== null) {
            return $result;
        }

        return null;
    }

    /**
     * Rule 1 — Math: "what is 2 + 2" → "4"
     * Supports: calculate, compute, what is, evaluate, solve
     */
    private function tryMath(string $prompt): ?string
    {
        $pattern = '/^(?:calculate|compute|what is|evaluate|solve)\s+(.+)/i';
        if (!preg_match($pattern, $prompt, $matches)) {
            return null;
        }

        $expr = trim($matches[1]);

        // Only allow safe numeric expressions
        if (!preg_match('/^[\d\s+\-*\/().,%^]+$/', $expr)) {
            return null;
        }

        // Replace ^ with ** for exponentiation (not valid PHP eval, handle manually)
        $safeExpr = str_replace('^', '**', $expr);

        try {
            // phpcs:ignore Squiz.PHP.Eval.Discouraged
            $result = @eval("return ({$safeExpr});");
            if ($result === false || $result === null) {
                return null;
            }
            // Return integer if result is whole number
            if (is_float($result) && $result == (int) $result) {
                return (string) (int) $result;
            }
            return (string) $result;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Rule 2 — Date: "what day is today" → "2026-04-22"
     */
    private function tryDate(string $prompt): ?string
    {
        if (strlen($prompt) > 60) {
            return null;
        }

        $patterns = [
            '/what(?:\'s| is) (?:the )?(?:current )?(?:date|time|day)/i',
            '/(?:today|now|current date)/i',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $prompt)) {
                return date('Y-m-d\TH:i:s\Z', time());
            }
        }

        return null;
    }

    /**
     * Rule 3 — UUID: "generate a uuid" → "550e8400-e29b-41d4-a716-446655440000"
     */
    private function tryUuid(string $prompt): ?string
    {
        if (!preg_match('/generate\s+(?:a\s+)?uuid/i', $prompt)) {
            return null;
        }

        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
        );
    }

    /**
     * Rule 4 — Uppercase: 'convert "hello" to uppercase' → "HELLO"
     */
    private function tryUppercase(string $prompt): ?string
    {
        if (!preg_match('/convert\s+"([^"]+)"\s+to\s+uppercase/i', $prompt, $m)) {
            return null;
        }
        return strtoupper($m[1]);
    }

    /**
     * Rule 5 — Lowercase: 'convert "HELLO" to lowercase' → "hello"
     */
    private function tryLowercase(string $prompt): ?string
    {
        if (!preg_match('/convert\s+"([^"]+)"\s+to\s+lowercase/i', $prompt, $m)) {
            return null;
        }
        return strtolower($m[1]);
    }

    /**
     * Rule 6 — Reverse: 'reverse "hello"' → "olleh"
     */
    private function tryReverse(string $prompt): ?string
    {
        if (!preg_match('/reverse\s+"([^"]+)"/i', $prompt, $m)) {
            return null;
        }
        return strrev($m[1]);
    }
}
