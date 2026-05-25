import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { CurbShare } from '../components/CurbShare'
import { useDocumentMeta } from '../components/useDocumentMeta'
import { useReveal } from '../components/useReveal'

const episodes = [
  {
    num: '01',
    title: 'The YAML File',
    setup: 'You sit down to set up CI for a new project.',
    punchline: 'Two hours later you\'re debugging indentation in a 50-line config file you didn\'t want to write.',
    pushci: 'npx pushci init — done in 30 seconds. No file created.',
  },
  {
    num: '02',
    title: 'The Bill',
    setup: 'You open your GitHub Actions invoice.',
    punchline: '$47. For running npm test. On someone else\'s computer. Tests YOUR laptop could run for free.',
    pushci: 'PushCI runs locally. $0/month. Forever.',
  },
  {
    num: '03',
    title: 'The Outage',
    setup: 'GitHub Actions goes down. Your deploy is blocked.',
    punchline: 'Your code is done. Your tests pass locally. But you can\'t ship because a server in Virginia is having a bad day.',
    pushci: 'PushCI runs on your machine. No outage can stop you.',
  },
  {
    num: '04',
    title: 'The Lock-In',
    setup: 'You want to move from GitHub to GitLab.',
    punchline: 'Your CI config is GitHub-only. 200 lines of workflow YAML that works nowhere else. You\'re trapped.',
    pushci: 'PushCI works with GitHub, GitLab, and Bitbucket. One command.',
  },
  {
    num: '05',
    title: 'The Config Review',
    setup: 'A new hire asks to see your CI setup.',
    punchline: 'You open .github/workflows/. There are 7 YAML files. Nobody remembers what half of them do.',
    pushci: 'PushCI: zero config files. AI detects everything.',
  },
  {
    num: '06',
    title: 'The Per-Minute Pricing',
    setup: 'Your CI provider charges per build minute.',
    punchline: 'You\'re literally paying $0.008 per minute to lint code. LINT. Code that\'s already on your machine.',
    pushci: 'PushCI: your machine, your electricity, your zero dollars.',
  },
]

function Episode({ ep }: { ep: typeof episodes[0] }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="reveal rounded-xl border border-border-base bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-mono text-t3">S01E{ep.num}</span>
        <h3 className="text-lg font-semibold text-t1">"{ep.title}"</h3>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-t3 mb-1">The setup</p>
          <p className="text-sm text-t2">{ep.setup}</p>
        </div>
        <div>
          <p className="text-sm text-t3 mb-1">The frustration</p>
          <p className="text-sm text-t1 leading-relaxed">{ep.punchline}</p>
        </div>
        <div className="border-t border-border-base/60 pt-4">
          <p className="text-xs text-t3 mb-1.5">With PushCI</p>
          <p className="text-sm text-accent/80 font-mono">{ep.pushci}</p>
        </div>
      </div>
    </div>
  )
}

export default function CurbYourCI() {
  useDocumentMeta({
    title: 'Curb Your CI Enthusiasm — PushCI',
    description: 'Every frustrating CI/CD moment, explained. YAML configs, per-minute billing, vendor lock-in — and the one command that fixes it all.',
    canonical: 'https://pushci.dev/curb',
  })

  return (
    <div className="min-h-screen bg-root">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-12 px-4 sm:px-6">
        <div className="mx-auto max-w-[1080px]">
          <p className="text-sm font-medium text-accent tracking-wide font-mono">
            S01 · Now Streaming
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-2xl">
            Curb Your CI Enthusiasm
          </h1>
          <p className="mt-4 text-lg text-t2 max-w-xl leading-relaxed">
            A series of unfortunate CI/CD events. Based on true stories.
            Every developer has lived these. Most are still living them.
          </p>
          <p className="mt-6 text-sm text-t3">
            Starring: your YAML config, your CI bill, and your dwindling patience.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 pb-20">
        {/* Episodes */}
        <div className="grid gap-4 md:grid-cols-2">
          {episodes.map((ep) => (
            <Episode key={ep.num} ep={ep} />
          ))}
        </div>

        {/* The Rant */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-t1 mb-2">The rant</h2>
          <p className="text-t3 mb-6 text-sm">Season finale monologue.</p>
          <div className="rounded-xl border border-border-base bg-surface p-6 sm:p-8">
            <p className="text-t1 leading-relaxed text-[15px]">
              So let me get this straight. We — the developers — write the code.
              On our machines. We run the tests. On our machines. We lint the code.
              On our machines. And then we UPLOAD all of that to someone ELSE'S machine,
              pay them BY THE MINUTE, wait 4 minutes for them to do what we just did
              in 4 seconds, and when THEIR server goes down, WE can't ship.
            </p>
            <p className="text-t1 leading-relaxed text-[15px] mt-4">
              And we accept this. We've been accepting this for YEARS. We write
              FIFTY LINES of YAML — YAML! — just to say "hey, run npm test." That's
              the whole instruction. Run. Npm. Test. But no, you need a
              config file. With indentation. And matrix strategies. And secrets.
              And caching policies. For NPM TEST.
            </p>
            <p className="text-t2 leading-relaxed text-[15px] mt-4 font-medium">
              One command. Your machine. Zero config. Zero bills. That's it.
              That's the show.
            </p>
            <div className="mt-6 rounded-lg bg-surface border border-border-base px-5 py-3 font-mono text-sm text-t2 inline-block">
              <span className="text-t3">$</span> npx pushci init
            </div>
          </div>
        </section>

        {/* Share it */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-t1 mb-2">Share the frustration</h2>
          <p className="text-t3 mb-6 text-sm">Pretty, pretty, pretty shareable.</p>
          <div className="max-w-xl">
            <CurbShare />
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 border-t border-border-base/40 pt-12">
          <h2 className="text-2xl font-bold text-t1">End the show</h2>
          <p className="mt-2 text-t2 max-w-md leading-relaxed">
            Cancel your CI subscription. Delete your YAML.
            Run one command. Roll credits.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a
              href="/#pricing"
              className="rounded-lg bg-t1 px-6 py-3 text-sm font-semibold text-root hover:bg-t1 transition"
            >
              Get Started Free
            </a>
            <a
              href="https://pushci.dev/docs"
              className="text-sm text-t2 hover:text-t1 transition underline underline-offset-4 decoration-border-base"
            >
              Read the Docs
            </a>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
