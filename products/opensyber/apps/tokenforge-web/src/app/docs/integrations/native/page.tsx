import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { CodeBlock } from '@/components/dashboard/CodeBlock';

export const metadata = {
  title: 'Native SDKs — TokenForge',
  description: 'TokenForge SDKs for iOS, Android, React Native, Python, Go, and MCP Server.',
};

const pythonCode = `pip install tokenforge

from tokenforge import TokenForge

tf = TokenForge(api_key="tf_your_api_key")

# Protect an AI agent HTTP call
response = tf.fetch("https://api.example.com/data")

# Works with LangChain / CrewAI — wrap your HTTP tool
@tf.protect
def call_api(url: str) -> dict:
    return requests.get(url).json()`;

const goCode = `go get github.com/opensyber/tokenforge-go

package main

import "github.com/opensyber/tokenforge-go"

func main() {
    tf := tokenforge.New("tf_your_api_key")
    client := tf.HTTPClient() // drop-in http.Client replacement

    resp, _ := client.Get("https://api.example.com/data")
    defer resp.Body.Close()
}`;

const mcpCode = `// Add to your MCP config (claude_desktop_config.json, .cursor/mcp.json, etc.)
{
  "mcpServers": {
    "tokenforge": {
      "command": "npx",
      "args": ["@opensyber/tokenforge-mcp"],
      "env": { "TOKENFORGE_API_KEY": "tf_your_api_key" }
    }
  }
}

// Every tool call through the MCP server is automatically signed.
// Works with Claude Desktop, Cursor, Claude Code, and any MCP client.`;

const swiftCode = `// Package.swift — add dependency
.package(url: "https://github.com/opensyber/tokenforge-swift", from: "1.0.0")

// AppDelegate.swift
import TokenForge

TokenForge.configure(apiKey: "tf_your_api_key")

// Usage — URLSession requests are signed automatically
let (data, _) = try await TokenForge.session.data(
    from: URL(string: "https://api.example.com/data")!
)
// Keys stored in Keychain (kSecAttrAccessibleAfterFirstUnlock)`;

const kotlinCode = `// build.gradle.kts
dependencies {
    implementation("cloud.opensyber:tokenforge:1.0.0")
}

// Application.kt
import cloud.opensyber.tokenforge.TokenForge

TokenForge.init(context, apiKey = "tf_your_api_key")

// Usage — OkHttp interceptor signs every request
val client = OkHttpClient.Builder()
    .addInterceptor(TokenForge.interceptor())
    .build()
// Keys stored in Android Keystore (hardware-backed)`;

const reactNativeCode = `npm install @opensyber/tokenforge-react-native

// App.tsx
import { TokenForgeProvider } from '@opensyber/tokenforge-react-native';

export default function App() {
  return (
    <TokenForgeProvider apiKey="tf_your_api_key">
      <YourApp />
    </TokenForgeProvider>
  );
}
// iOS: Keychain storage | Android: Keystore storage
// All fetch() calls signed automatically via global interceptor`;

interface GuideProps { title: string; id: string; desc: string; code: string; lang: string }

function Guide({ title, id, desc, code, lang }: GuideProps): React.ReactElement {
  return (
    <div id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-sm text-text-secondary mb-4">{desc}</p>
      <CodeBlock code={code} language={lang} />
    </div>
  );
}

const navItems = [
  'Python', 'Go', 'MCP Server', 'Swift (iOS)', 'Kotlin (Android)', 'React Native'
];

export default function NativeIntegrationsPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
          <Link href="/docs/integrations" className="text-sm text-text-secondary hover:text-text-primary transition">
            Web Frameworks &rarr;
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-36 pb-24">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
          Native SDKs
        </span>
        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-2">Mobile &amp; AI Agent SDKs</h1>
        <p className="text-text-secondary mb-4">
          Same trust scoring engine, platform-native secure key storage. One API key across every platform.
        </p>

        <nav className="mb-12 flex flex-wrap gap-2">
          {navItems.map((n) => (
            <a
              key={n}
              href={`#${n.toLowerCase().replace(/[\s()]/g, '-').replace(/-+/g, '-')}`}
              className="rounded-lg border border-border/50 px-3 py-1.5 text-xs hover:border-info/30 hover:text-info transition"
            >
              {n}
            </a>
          ))}
        </nav>

        <div className="space-y-12">
          <Guide id="python" title="Python (AI Agents)" desc="For LangChain, CrewAI, or any Python agent. Wraps requests with ECDSA signatures." code={pythonCode} lang="python" />
          <Guide id="go" title="Go (Microservices)" desc="Drop-in http.Client replacement. Signs every outbound request with device-bound keys." code={goCode} lang="go" />
          <Guide id="mcp" title="MCP Server (Claude / Cursor / Claude Code)" desc="Add to your MCP config. Every tool call is signed automatically. Zero code changes." code={mcpCode} lang="json" />
          <Guide id="swift--ios-" title="Swift (iOS)" desc="Keys stored in Keychain. URLSession requests signed automatically." code={swiftCode} lang="swift" />
          <Guide id="kotlin--android-" title="Kotlin (Android)" desc="Keys stored in hardware-backed Android Keystore. OkHttp interceptor signs all requests." code={kotlinCode} lang="kotlin" />
          <Guide id="react-native" title="React Native" desc="Unified SDK with platform-native key storage. Global fetch interceptor signs every call." code={reactNativeCode} lang="typescript" />
        </div>
      </main>
    </div>
  );
}
