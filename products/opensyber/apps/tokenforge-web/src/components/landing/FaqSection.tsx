'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'What happens if Web Crypto API is unavailable?',
    answer:
      'TokenForge gracefully degrades. If the browser does not support Web Crypto API (extremely rare in modern browsers), the SDK skips device binding entirely rather than breaking your application. Sessions continue to work as normal cookies — you just lose the cryptographic protection layer.',
  },
  {
    question: 'Does TokenForge replace authentication?',
    answer:
      'No. TokenForge is a post-authentication security layer. It works alongside your existing auth provider (Clerk, Auth.js, NextAuth, Firebase, or custom JWT). Authentication verifies who you are. TokenForge verifies you are on the same device that authenticated.',
  },
  {
    question: 'How does the trust score work?',
    answer:
      'Every request is evaluated against 7 weighted signals: signature validity (40pts), IP consistency (15pts), geo consistency (15pts), device fingerprint (10pts), request velocity (10pts), time pattern (5pts), and nonce freshness (5pts). The total score (0-100) determines if the request is allowed, challenged, or blocked.',
  },
  {
    question: 'Can I use TokenForge with my existing auth provider?',
    answer:
      'Yes. TokenForge is auth-provider agnostic. It works with Microsoft Entra ID (Azure AD), Clerk, Auth.js, NextAuth, Firebase Auth, Supabase Auth, Okta, or any custom JWT/OAuth system. The SDK intercepts fetch requests and adds cryptographic signatures — no changes to your auth flow required.',
  },
  {
    question: 'What data does TokenForge store?',
    answer:
      'TokenForge stores public keys, device fingerprints (hashed), trust scores, and nonce records. Private keys are generated as non-extractable and never leave the device. No personal data, passwords, or session tokens are stored by TokenForge.',
  },
  {
    question: 'How do I integrate TokenForge?',
    answer:
      'Add one script tag to your HTML with your API key. That\'s it for the client — it auto-generates device keys and signs every request. On the server, add one line of middleware with the same API key to verify requests. Choose your framework: Express, Next.js, Fastify, or Hono. Or skip code entirely with our zero-code DNS proxy on the Team plan.',
  },
  {
    question: 'Does TokenForge work behind a VPN or firewall?',
    answer:
      'Yes. The script tag loads from our public CDN and works in any browser. Your server just needs outbound HTTPS access to tokenforge-api.opensyber.cloud to verify requests. Most corporate networks and VPNs allow outbound HTTPS. The only feature that requires a public-facing origin is the zero-code DNS proxy (Team plan). For fully air-gapped environments, contact us for a dedicated on-premise deployment.',
  },
  {
    question: 'Does TokenForge actually block attacks or just alert?',
    answer:
      'Both. TokenForge actively blocks attacks in real time. When a request fails signature verification (stolen cookie without the device key), the middleware returns HTTP 401 — the attacker never reaches your backend. If the trust score drops below 40, the session is revoked immediately. Alerts are sent in parallel to your email, webhook, or SIEM so your security team has visibility. It is active defense, not just monitoring.',
  },
  {
    question: 'Can I forward events to my SIEM (Splunk, Sentinel, Elastic, Trellix, Cyrebro)?',
    answer:
      'Yes. Every webhook alert includes a structured JSON payload with severity levels (1-9), event categories, and a CEF (Common Event Format) string that SIEMs auto-parse. Set up a webhook alert rule in the dashboard, point it at your SIEM HTTP ingest endpoint, and events flow automatically. We have setup guides for Splunk, Microsoft Sentinel, Elastic, Datadog, Trellix, and Cyrebro.',
  },
  {
    question: 'What happens if a user switches devices?',
    answer:
      'The new device generates a fresh key pair and binds to the session. The old device binding remains valid until it expires or is revoked. Users can have multiple bound devices simultaneously. If you want single-device enforcement, configure your alert rules to trigger on new device bindings.',
  },
  {
    question: 'Does TokenForge add latency to requests?',
    answer:
      'The script tag adds zero latency — signing happens locally in the browser using Web Crypto API (sub-millisecond). Server-side verification adds one API call to TokenForge (typically 10-30ms from Cloudflare edge). For the zero-code DNS proxy, the proxy adds similar latency. All verification runs on Cloudflare\'s global edge network, so the nearest data center handles the request.',
  },
  {
    question: 'What if TokenForge goes down?',
    answer:
      'The middleware degrades gracefully. If the verification API is unreachable, requests pass through without device binding — your app keeps working. No single point of failure. The trust score is set to 0 and the request is marked as unbound, so you can still enforce policies based on binding status.',
  },
  {
    question: 'Is TokenForge compliant with SOC2 and ISO 27001?',
    answer:
      'TokenForge helps you meet session security controls required by SOC2 (CC6.1 - Logical Access Security) and ISO 27001 (A.9.4 - System Access Control). The compliance report in your dashboard generates a monthly summary of verifications, threats blocked, and trust scores that you can attach to audit evidence. We do not store personal data — only public keys, hashed fingerprints, and trust scores.',
  },
  {
    question: 'Is the code that runs in my users\' browsers safe?',
    answer:
      'The browser SDK only does two things: generate a non-extractable ECDSA key pair and sign requests. No data collection, no tracking, no external calls except to your own API. The script tag (sdk.js) is served from our CDN and can be inspected at any time. The npm package @opensyber/tokenforge is also available for teams that want to review or vendor the client code. All verification and trust scoring runs server-side through the TokenForge API — nothing sensitive happens in the browser.',
  },
  {
    question: 'Does TokenForge work with mobile apps?',
    answer:
      'Yes. Native SDKs are available for iOS (Swift with Keychain-backed keys), Android (Kotlin with Keystore-backed keys), and React Native. The signing protocol is the same across all platforms — only the secure key storage is platform-native. Install the SDK, initialize with your API key, and every API call is signed automatically.',
  },
  {
    question: 'Can AI agents use TokenForge?',
    answer:
      'Yes, three ways: Python SDK for LangChain/CrewAI agents, Go SDK for cloud-native agents, or MCP server for Claude/Cursor/Claude Code agents. The MCP server is the easiest — just add it to your MCP config and every tool call is signed. All three use the same trust scoring engine and the same API key as your web and mobile clients.',
  },
];

function FaqAccordion({ item, index }: { item: FaqItem; index: number }): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.4, ease }}
      className="border-b border-border/50"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left hover:text-info transition-colors"
      >
        <span className="text-sm font-medium pr-4">{item.question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
          >
            <p className="pb-5 text-sm text-text-secondary leading-relaxed">{item.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FaqSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            FAQ
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">Frequently Asked Questions</h2>
        </motion.div>

        <div className="divide-y divide-border/50 border-t border-border/50">
          {faqs.map((faq, i) => (
            <FaqAccordion key={faq.question} item={faq} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
