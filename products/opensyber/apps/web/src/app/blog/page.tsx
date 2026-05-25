import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { posts } from './blog-posts';

const categories = [...new Set(posts.map((p) => p.category))];

export default function BlogPage() {
  return (
    <div>
      <div className="relative mb-12">
        <div className="pointer-events-none absolute inset-0 -top-24 rounded-2xl bg-gradient-to-b from-signal/5 via-transparent to-transparent" />
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-signal uppercase tracking-[0.2em] mb-5">Blog</p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide">Blog</h1>
        <p className="text-lg text-text-secondary mt-3">
          Insights on AI agent security, product updates, and best practices.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <span key={cat} className="rounded-lg bg-surface border border-border px-3 py-1 text-xs text-text-secondary">
            {cat}
          </span>
        ))}
      </div>

      <div className="mt-10 space-y-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="gradient-border card-hover group block"
          >
            <div className="rounded-2xl bg-panel p-7">
              <div className="flex items-center gap-3 text-xs text-text-dim mb-4">
                <span className="rounded-lg bg-surface border border-border px-2 py-0.5 text-text-secondary">{post.category}</span>
                <span>{post.date}</span>
                <span>&middot;</span>
                <span>{post.author}</span>
                <span>&middot;</span>
                <span>{post.readingTime}</span>
              </div>
              <h2 className="text-xl font-semibold group-hover:text-signal transition">{post.title}</h2>
              <p className="mt-2 text-sm text-text-secondary">{post.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-signal group-hover:text-signal-hover">
                Read more <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
