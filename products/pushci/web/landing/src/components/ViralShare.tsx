import { useState, useCallback } from 'react'

const viralMessages = [
  // Deadpan / absurd (Seinfeld energy)
  "What's the deal with CI config files? I write 50 lines of YAML just to run npm test. That's not automation, that's a cry for help. pushci.dev",
  "My CI config has more lines than my actual app. I don't have a deployment pipeline. I have a YAML novel. pushci.dev",
  "People say YAML is readable. These are the same people who put pineapple on pizza. pushci.dev — one command, zero debates.",
  "I spent 2 hours debugging a CI pipeline. The bug? An extra space. One space. I'm switching to pushci.dev before I lose it.",
  "You know what the best CI config is? No CI config. That's the whole tweet. pushci.dev",

  // Dramatic tension (Breaking Bad energy)
  "I am the one who deploys. One command. No YAML. No cloud bills. pushci.dev",
  "Say my pipeline name. PushCI. You're goddamn right. Zero config, runs locally. pushci.dev",
  "I used to write YAML. Then I chose to be free. pushci.dev — one command, everything detected.",
  "CI charges per minute. I charge per sanity point lost. Both cost too much. pushci.dev is free.",
  "Every line of YAML you write is a choice. Today I chose differently. pushci.dev",

  // Escape / freedom (Prison Break energy)
  "I just broke out of YAML prison. The escape plan? One command: npx pushci init. pushci.dev",
  "50 lines of config. 3 cloud services. $47/month. The walls were closing in. Then I found pushci.dev",
  "They said you can't escape vendor lock-in. They were wrong. pushci.dev — runs on your machine, works everywhere.",
  "My CI pipeline was a cage. GitHub Actions was the warden. pushci.dev was the tunnel. I'm out.",
  "The plan is simple: delete the YAML, run one command, deploy for free. pushci.dev",

  // Awkward cringe (The Office energy)
  "Me explaining to my boss that our CI config is just one command. Him staring at me. Both of us staring at the deploy succeeding. pushci.dev",
  "I would rather debug YAML for 6 hours than have another conversation about CI pricing. Actually no. pushci.dev",
  "Told my team I automated our entire CI in 30 seconds. HR scheduled a meeting to discuss my 'attitude.' pushci.dev",
  "My coworker spent 3 days on a GitHub Actions workflow. I set up PushCI during his code review. We don't talk about it. pushci.dev",
  "The look on a DevOps engineer's face when you show them one command replacing their 200-line YAML. Priceless. pushci.dev",
  "I accidentally deleted our CI config. Builds still passed. Turns out we never needed it. pushci.dev",

  // Petty frustration (Curb Your Enthusiasm energy)
  "So you're telling me I've been paying $0.008 per minute for something that runs free on my own laptop. Pretty, pretty, pretty dumb. pushci.dev",
  "You know what drives me crazy? YAML indentation. You know what I did about it? Eliminated YAML entirely. pushci.dev",
  "I don't trust anyone who says they enjoy writing CI config. Those people are lying. To themselves. pushci.dev",
  "My CI bill was $47 last month. For what? Running npm test? On SOMEONE ELSE'S computer? I could've done that HERE. pushci.dev",
  "Every CI tool: 'easy setup in minutes!' The minutes: 47 of them, all spent on YAML. pushci.dev — actually one command.",
  "I showed a junior dev our old CI config. He thought it was the codebase. It was the config. For ONE repo. pushci.dev",
  "Let me get this straight. You WROTE a config file. To TELL a computer. To run a TEST. That YOUR computer could run. For FREE. pushci.dev",
  "A guy at work told me he likes writing YAML. I said 'oh really? You LIKE it?' He couldn't look me in the eye. pushci.dev",
  "I'm at a tech conference. Guy next to me is bragging about his 300-line CI pipeline. I showed him one command. He hasn't spoken since. pushci.dev",
  "You're paying per MINUTE? Per minute?! I run my CI on my laptop for zero dollars. ZERO. What are we doing here? pushci.dev",
  "My CTO asked why our CI bill dropped to zero. I said I found a tool that respects our intelligence. He didn't follow up. pushci.dev",
  "So I'm looking at our GitHub Actions bill and I go — wait. We're paying... to LINT? We're paying someone to run eslint? pushci.dev",
  "I told my DevOps guy about PushCI. He said 'that can't be real.' I ran it. He watched. Long silence. 'Well this is embarrassing.' pushci.dev",
  "GitHub Actions went down for 20 minutes on Tuesday. Know who wasn't affected? Me. Because my CI runs HERE. On MY machine. pushci.dev",
  "Somebody explain to me why I need 50 lines of YAML and a cloud account to run 'go test ./...' — explain it to me like I'm five. pushci.dev",
  "I switched to PushCI and my CI bill went to zero. My accountant called to ask if I shut down the company. pushci.dev",

  // Cringe-relatable dev life
  "Me: I'll set up CI real quick. Also me, 3 hours later: why is line 47 of my YAML broken. pushci.dev",
  "GitHub Actions bill this month: $47. Money spent on CI with PushCI: $0. Tacos bought with savings: many. pushci.dev",
  "My CI runs locally in 4 seconds. My old CI took 4 minutes + my will to live. pushci.dev",
  "POV: you just saved 45 minutes of CI setup and your boss thinks you're a wizard. pushci.dev",

  // Spicy takes
  "Hot take: if your CI tool needs a config file, it's already lost. pushci.dev",
  "Unpopular opinion: YAML was a mistake and we all just agreed to pretend it's fine. pushci.dev",
  "Paying for CI in 2026 is like paying for email in 2006. It's your machine. Use it. pushci.dev",
  "The entire CI/CD industry is a $14B solution to a problem that's one command: pushci.dev",

  // Pure chaotic energy
  "I deleted all my CI config files and nothing bad happened. Everything got better actually. pushci.dev",
  "My new CI pipeline: npx pushci init. That's it. That's the pipeline. My ops team is confused but impressed. pushci.dev",
  "Day 1 without YAML: birds are singing, code is deploying, life has meaning again. pushci.dev",
  "Interviewer: what's your CI/CD setup? Me: one command. Interviewer: no really. Me: pushci.dev",
  "Just showed my intern pushci.dev. He asked 'where's the YAML?' I said 'exactly.' He's still processing.",

  // Deeper Curb — awkwardly honest, neurotic, self-aware
  "So I built a CI/CD platform... because apparently I enjoy suffering, just not paying for it. pushci.dev",
  "You know what's fun? Debugging pipelines. You know what's not fun? Paying for them. pushci.dev",
  "It's like GitHub Actions, but without the monthly emotional damage. pushci.dev",
  "I didn't want to optimize my CI costs... I wanted them gone. Completely gone. pushci.dev",
  "Every time I saw the CI bill, I took it personally. This is my revenge. pushci.dev",
  "Running CI locally is not only cheaper — it's also quieter. No one arguing with you except yourself. pushci.dev",
  "Your laptop should suffer, not your wallet. pushci.dev",
  "You ever pay for CI and think... what exactly am I renting here? Air? Electricity? Regret? pushci.dev",
  "I just wanted to push code. Suddenly I'm negotiating with a billing system. pushci.dev",
  "This is what happens when a developer gets annoyed and has just enough time to do something about it. pushci.dev",
  "No cloud, no nonsense, no invoice showing up like a surprise guest. pushci.dev",
  "It's CI/CD... but you're in control. Which is great, unless you don't trust yourself. pushci.dev",
  "I built this so I could stop explaining to finance why 'build minutes' are a thing. pushci.dev",
  "You don't realize how much you hate CI costs... until you stop paying them. pushci.dev",

  // --- 2026 VIRAL FORMATS ---

  // Thread hooks (first tweet of a thread — drives engagement)
  "I just saved my startup $4,200/year in CI costs with one command. Here's the 30-second version: pushci.dev (thread below)",
  "Every developer should know this: you don't need to pay for CI. Your laptop is literally a CI server. pushci.dev",
  "3 years of GitHub Actions. $12,000 in bills. One command to replace it all. Let me explain: pushci.dev",
  "The CI/CD industry doesn't want you to know this: your own machine runs tests faster than their cloud. pushci.dev",

  // Contrarian takes (algorithm loves debate)
  "Controversial: GitHub Actions is the most expensive way to run npm test ever invented. pushci.dev",
  "If you're still writing YAML in 2026 you're not a DevOps engineer, you're a YAML engineer. pushci.dev",
  "The best infrastructure is no infrastructure. The best config is no config. The best CI bill is $0. pushci.dev",
  "Your CI/CD should detect your stack automatically. If it can't, it's not AI-native, it's a config file with extra steps. pushci.dev",
  "There are two types of developers: those who pay for CI, and those who've discovered pushci.dev",

  // Storytelling (LinkedIn gold)
  "Last month our CI bill hit $340. I set up PushCI in 12 seconds. This month: $0. My manager asked if I got a raise. I said no, I got pushci.dev",
  "A senior engineer told me 'you can't just run CI locally.' I said watch me. 12 seconds later his face changed. pushci.dev",
  "My co-founder and I were arguing about CI costs. I opened a terminal, typed one command, and we never argued again. pushci.dev",
  "True story: our CI pipeline had more YAML than our actual application code. That's when I knew something was broken. pushci.dev",

  // Rage bait (engagement magnets)
  "Stop paying for CI. Just stop. Your laptop is sitting right there. pushci.dev",
  "GitHub Actions is free for 2000 minutes then charges you. PushCI is free for infinite minutes because it's YOUR computer. pushci.dev",
  "I refuse to pay a cloud provider to run eslint. I have standards. Low ones, but standards. pushci.dev",
  "Imagine explaining to a non-tech person that you pay money for a computer in Virginia to test your code when you have a computer right here. pushci.dev",

  // Flex / flex-humble (Twitter loves these)
  "Deployed to production. Zero CI cost. Zero config files. Zero cloud minutes. Just vibes and pushci.dev",
  "Me: sets up entire CI/CD pipeline in 12 seconds. The guy who spent 3 days on GitHub Actions: 👁️👄👁️ pushci.dev",
  "Updated my LinkedIn title to 'Engineer who doesn't pay for CI.' DMs are open. pushci.dev",
  "My CI pipeline: one command. My CI bill: $0. My smugness: immeasurable. pushci.dev",

  // Educational (Reddit/HN upvote bait)
  "TIL your laptop runs npm test 5x faster than a GitHub Actions shared runner. The cold start alone is 45 seconds of wasted money. pushci.dev",
  "If you have 100 CI runs/month at 3 min avg, GitHub Actions costs $14.40. PushCI costs $0. The math is not complicated. pushci.dev",
  "You don't need Kubernetes, Docker, or cloud runners to run your tests. You need: pushci init. That's it. pushci.dev",
  "Discovered that AI can auto-detect your stack, generate your pipeline, and diagnose failures. No YAML required. Been using pushci.dev for a week now.",

  // Meme templates
  "Nobody:\nAbsolutely nobody:\nGitHub Actions: that'll be $0.008 per minute please\nMe: *laughs in pushci.dev*",
  "GitHub Actions: 'here's your bill'\nMe: 'for what'\nGH: 'running npm test'\nMe: 'on whose computer'\nGH: 'ours'\nMe: 'I have a computer'\nGH: '...'\npushci.dev",
  "Stages of CI grief:\n1. Denial (it's only $5/mo)\n2. Anger (WHY IS YAML)\n3. Bargaining (maybe CircleCI is cheaper)\n4. Depression (200 lines of config)\n5. Acceptance (pushci.dev)",
  "2024: writes 50 lines of YAML\n2025: pays $47/mo for cloud CI\n2026: npx pushci init\n\nCharacter development. pushci.dev",
  "Senior dev: 'You need to understand CI/CD deeply'\nMe: pushci init\nSenior dev: 'No not like that'\nMe: *all tests passing in 4 seconds*\npushci.dev",

  // Short punchy (high retweet energy)
  "CI should be one command, not one career. pushci.dev",
  "YAML is a config language pretending to be a programming language. pushci.dev said no more.",
  "Your laptop > their cloud. pushci.dev",
  "Free CI that just works. No catch. No credit card. pushci.dev",
  "One command. Every language. Zero dollars. pushci.dev",
  "AI detects your stack. Tests run locally. $0. pushci.dev",
  "The CI bill is $0 and the vibes are immaculate. pushci.dev",

  // Release feature — Curb energy
  "So you're telling me I've been paying GitHub to run go build on THEIR computer when MY computer is sitting right here doing nothing? pushci.dev/release",
  "Let me get this straight. We're paying per minute. To zip files. And upload them. To a website we own. pushci release. $0. pushci.dev",
  "A release with 6 matrix builds costs $0.96 on GitHub Actions. On my laptop it costs electricity I'm already paying for. pushci.dev/release",
  "My coworker asked why I run releases locally. I said because I have a computer. He looked at me like I was crazy. I looked at our bill. pushci.dev",
  "GitHub Actions charges $0.008/min to run go build. My M1 does it in 30 seconds for free. What are we DOING here? pushci.dev/release",
  "I told finance our release pipeline costs $0 now. They asked what changed. I said I remembered I own a computer. pushci.dev/release",
  "$50/year to compile Go binaries on someone else's machine. Fifty dollars. To run go build. I can't even talk about it. pushci.dev/release",
  "The release took 47 seconds on my laptop. On GitHub Actions it takes 18 minutes. And they CHARGE for those 18 minutes. pushci.dev/release",
  "pushci release: 6 platforms, GitHub Release, Homebrew tap, npm publish. One command. From my machine. $0. I'm not going back. pushci.dev",
  "So we've got 52 releases a year at $0.96 each. That's $50 to repeatedly run go build on a rented computer. Pretty, pretty, pretty dumb. pushci.dev/release",
]

interface ViralShareProps {
  context?: string // optional context like "savings" amount or competitor name
}

export function ViralShare({ context }: ViralShareProps) {
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * viralMessages.length))
  const [copied, setCopied] = useState(false)
  const [spinning, setSpinning] = useState(false)

  const message = viralMessages[messageIndex]

  const regenerate = useCallback(() => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 400)
    setMessageIndex((prev) => {
      let next = Math.floor(Math.random() * viralMessages.length)
      while (next === prev) next = Math.floor(Math.random() * viralMessages.length)
      return next
    })
  }, [])

  const copyMessage = useCallback(() => {
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message])

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://pushci.dev')}`
  const redditTitle = encodeURIComponent(message.replace(/pushci\.dev.*$/, '').trim())
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent('https://pushci.dev')}&title=${redditTitle}`

  return (
    <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
      <div className="border-b border-border-base/60 px-4 py-2.5 flex items-center justify-between">
        <span className="text-[11px] font-mono text-t3">
          {context || 'Share the vibes'}
        </span>
        <button
          onClick={regenerate}
          className="flex items-center gap-1.5 text-[11px] text-t3 hover:text-t2 transition"
          aria-label="Generate new message"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${spinning ? 'animate-spin' : ''}`}
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Another one
        </button>
      </div>

      <div className="p-4">
        <p className="text-sm text-t2 leading-relaxed min-h-[48px] italic">
          {message}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Twitter/X */}
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-raised border border-border-base px-3 py-1.5 text-xs text-t2 hover:border-border-em hover:text-t1 transition"
          >
            <svg className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post
          </a>

          {/* LinkedIn */}
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-raised border border-border-base px-3 py-1.5 text-xs text-t2 hover:border-border-em hover:text-t1 transition"
          >
            <svg className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Share
          </a>

          {/* Reddit */}
          <a
            href={redditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-raised border border-border-base px-3 py-1.5 text-xs text-t2 hover:border-border-em hover:text-t1 transition"
          >
            <svg className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 014.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 000-.462.342.342 0 00-.462 0c-.545.533-1.684.73-2.512.73-.828 0-1.953-.21-2.498-.742a.327.327 0 00-.22-.083z" />
            </svg>
            Post
          </a>

          {/* Copy */}
          <button
            onClick={copyMessage}
            className="flex items-center gap-1.5 rounded-lg bg-raised border border-border-base px-3 py-1.5 text-xs text-t2 hover:border-border-em hover:text-t1 transition"
            aria-label={copied ? 'Copied' : 'Copy message'}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-accent" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Copied
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
