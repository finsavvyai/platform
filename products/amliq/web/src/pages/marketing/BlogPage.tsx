export default function BlogPage() {
  return (
    <div style={{ background: 'var(--text)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-24">
        <p className="section-eyebrow mb-4">Blog</p>
        <h1 className="text-4xl font-bold tracking-tight mb-6" style={{ color: 'var(--bg-elevated)', letterSpacing: '-0.02em' }}>
          Insights & Updates
        </h1>
        <p className="text-lg mb-16" style={{ color: '#5C5852' }}>
          Compliance news, product updates, and industry perspectives from the AMLIQ team.
        </p>
        <div className="space-y-10">
          {[
            {
              date: 'April 2026', tag: 'Product',
              title: 'Introducing Real-Time Adverse Media Monitoring',
              desc: 'Stay ahead of reputational risk with automated adverse media alerts covering 50,000+ news sources in 40 languages.',
            },
            {
              date: 'March 2026', tag: 'Compliance',
              title: 'OFAC Updates SDN List: Key Changes and What They Mean',
              desc: 'A breakdown of the latest OFAC SDN additions and how financial institutions should respond to maintain compliance.',
            },
            {
              date: 'February 2026', tag: 'Engineering',
              title: 'How We Achieve Sub-Millisecond Screening at Scale',
              desc: "A deep dive into the infrastructure choices behind AMLIQ's <1ms average screening latency.",
            },
          ].map(post => (
            <div key={post.title} className="pb-10" style={{ borderBottom: '1px solid #E8E5DF' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--accent-gold-light)', color: 'var(--accent-gold)' }}>
                  {post.tag}
                </span>
                <span className="text-xs" style={{ color: '#9E9A94' }}>{post.date}</span>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--bg-elevated)', letterSpacing: '-0.01em' }}>
                {post.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#5C5852' }}>{post.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
