import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

const cards = [
  {
    title: 'Curb Your CI — Quote Card',
    desc: 'The classic Larry David moment when you realize you\'ve been paying to run npm test.',
    preview: '/social/og-curb.html',
    svg: '/social/og-curb.svg',
    tweet: 'So you\'re telling me I\'ve been paying... to run npm test... on a computer in Virginia?\n\nPretty, pretty, pretty... expensive.\n\npushci.dev',
  },
  {
    title: 'VS Comparison — Meme Card',
    desc: 'Side-by-side: GitHub Actions ($14/mo, 50 lines YAML) vs PushCI ($0, zero config).',
    preview: '/social/og-meme.html',
    tweet: '😤 GitHub Actions: 50 lines of YAML, $14/mo\n😎 PushCI: Zero config, $0 forever\n\nThe math isn\'t hard. pushci.dev',
  },
  {
    title: 'Curb Your CI Bill — Comic',
    desc: 'Before/after cartoon: stressed dev paying for CI vs happy dev using PushCI.',
    preview: '/social/og-cartoon.html',
    tweet: 'Before: $47/month to run npm test on someone else\'s computer 😤\n\nAfter: pushci init → works instantly → $0 forever 😎\n\nCurb Your CI Bill. pushci.dev',
  },
]

export default function SocialCards() {
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <div className="pt-28 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <h1 className="text-3xl font-bold text-t1">Social Share Cards</h1>
          <p className="mt-3 text-t3 max-w-lg">
            Ready-to-share images for Twitter/X, LinkedIn, Reddit, and Product Hunt.
            Open the preview, screenshot, and post.
          </p>

          <div className="mt-12 space-y-12">
            {cards.map(card => (
              <div key={card.title} className="rounded-2xl border border-border-base bg-surface p-6">
                <h2 className="text-lg font-bold text-t1">{card.title}</h2>
                <p className="text-sm text-t3 mt-1">{card.desc}</p>

                {/* Preview iframe */}
                <div className="mt-4 rounded-xl overflow-hidden border border-border-base" style={{ aspectRatio: '1200/630' }}>
                  <iframe src={card.preview} className="w-full h-full border-0" title={card.title} />
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={card.preview} target="_blank" rel="noopener"
                    className="rounded-lg bg-raised border border-border-base px-4 py-2 text-sm text-t2 hover:text-t1 hover:border-border-em transition-all">
                    Open full size (screenshot this)
                  </a>
                  {card.svg && (
                    <a href={card.svg} download className="rounded-lg bg-raised border border-border-base px-4 py-2 text-sm text-t2 hover:text-t1 hover:border-border-em transition-all">
                      Download SVG
                    </a>
                  )}
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(card.tweet)}`} target="_blank" rel="noopener"
                    className="rounded-lg bg-accent/10 border border-accent/20 px-4 py-2 text-sm text-accent hover:bg-accent/20 transition-all">
                    Share on Twitter/X
                  </a>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://pushci.dev')}`} target="_blank" rel="noopener"
                    className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/20 transition-all">
                    Share on LinkedIn
                  </a>
                </div>

                {/* Copy tweet text */}
                <div className="mt-3">
                  <button onClick={() => { navigator.clipboard.writeText(card.tweet); }}
                    className="text-xs text-t3 hover:text-t2 transition-colors">
                    Copy tweet text
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-16 rounded-xl border border-border-base bg-surface p-6">
            <h2 className="text-lg font-bold text-t1">Sharing Tips</h2>
            <ul className="mt-4 space-y-2 text-sm text-t2">
              <li>Open the full-size preview, take a screenshot (1200x630), and attach it to your post</li>
              <li>Twitter/X shows images 2x better than text-only posts</li>
              <li>LinkedIn posts with images get 2.3x more engagement</li>
              <li>Tag relevant hashtags: #DevOps #CICD #GitHub #OpenSource</li>
              <li>Post during peak hours: Tue-Thu, 9-11am your audience's timezone</li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
