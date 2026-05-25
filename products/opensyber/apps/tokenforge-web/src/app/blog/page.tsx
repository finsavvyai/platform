import Link from 'next/link';
import { KeyRound, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Blog — TokenForge',
  description: 'Security insights, integration guides, and product updates from the TokenForge team.',
};

const posts = [
  {
    slug: 'session-hijacking-after-mfa',
    title: 'Session Hijacking After MFA: Why Cookies Aren\'t Enough',
    excerpt: 'MFA protects login. But what protects the session after? AiTM attacks steal cookies in real time, bypassing MFA completely.',
    date: '2026-03-22',
    tag: 'Security',
  },
  {
    slug: 'microsoft-365-session-security',
    title: 'Protecting Microsoft 365 SSO Sessions with Device Binding',
    excerpt: 'How to add cryptographic session protection to apps that authenticate via Microsoft Entra ID, preventing token theft after SSO.',
    date: '2026-03-22',
    tag: 'Integration',
  },
];

export default function BlogPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-info text-void px-4 py-2 text-sm font-medium glow-info hover:brightness-110 transition"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-36 pb-24">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
          Blog
        </span>
        <h1 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-2">Blog</h1>
        <p className="text-text-secondary mb-10">
          Security insights, integration guides, and product updates.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block gradient-border card-hover"
            >
              <div className="rounded-2xl bg-panel p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="rounded-full bg-info/10 px-2.5 py-0.5 text-xs font-medium text-info">
                    {post.tag}
                  </span>
                  <span className="text-xs text-text-muted">{post.date}</span>
                </div>
                <h2 className="text-lg font-semibold mb-2">{post.title}</h2>
                <p className="text-sm text-text-secondary mb-3">{post.excerpt}</p>
                <span className="text-sm text-info flex items-center gap-1">
                  Read more <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
