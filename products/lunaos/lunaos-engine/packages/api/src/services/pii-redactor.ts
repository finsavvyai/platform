/**
 * Automatic PII Redaction Middleware
 * 
 * Scrubs Personal Identifiable Information (Emails, CC numbers, SSNs)
 * from text before it is sent to external LLMs.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CC_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;
const SSN_REGEX = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;
// Basic phone number regex (US format mostly, but catches many)
const PHONE_REGEX = /\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g;

export function redactPII(text: string): string {
    if (!text) return text;

    let redacted = text;

    // Redact Emails
    redacted = redacted.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');

    // Redact Credit Cards (basic Luhn-like length check via regex)
    redacted = redacted.replace(CC_REGEX, (match) => {
        // Only strip if it really looks like a CC (all digits/spaces/dashes, 13-16 digits)
        const digitsOnly = match.replace(/[\s-]/g, '');
        if (digitsOnly.length >= 13 && digitsOnly.length <= 16) {
            return '[REDACTED_CC]';
        }
        return match;
    });

    // Redact SSNs
    redacted = redacted.replace(SSN_REGEX, '[REDACTED_SSN]');

    // Redact Phones
    redacted = redacted.replace(PHONE_REGEX, '[REDACTED_PHONE]');

    return redacted;
}
