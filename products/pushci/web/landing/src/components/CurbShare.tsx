import { useState, useCallback } from 'react'
import { btnGestureSubtle } from '../styles/gestures'

const curbMessages = [
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
  "So the DevOps guy says to me 'you can't just run CI locally.' I said 'I literally just did.' He goes 'well you shouldn't.' WHY NOT? pushci.dev",
  "I asked our team how many hours we spent on CI config last quarter. Nobody could answer. Nobody wanted to answer. pushci.dev",
  "My friend tells me his CI takes 8 minutes. I said mine takes 4 seconds. He said 'that's not possible.' I said 'and yet.' pushci.dev",
  "You want to know what's criminal? Not the YAML. The YAML is bad. But paying $0.008 per minute to run YOUR OWN tests? That's criminal. pushci.dev",
  "They keep adding features to GitHub Actions. You know what I want? FEWER features. One command. That's the feature. pushci.dev",
  "A recruiter asked me about my CI/CD experience. I said 'npx pushci init.' She said 'can you elaborate?' I said 'I just did.' pushci.dev",
  "My coworker spent a whole sprint setting up CI. A whole sprint. I did it in 30 seconds. We make the same salary. pushci.dev",
  "The audacity of charging developers money to run their own tests on someone else's computer. The absolute audacity. pushci.dev",
  "I'm pushing code... why is there a meter running? What is this, a taxi? pushci.dev",
  "CI used to be a tool. Now it's a subscription. For what? For waiting? pushci.dev",
  "You ever look at your CI bill and think... I could've just bought another laptop? pushci.dev",
  "I don't mind automation. I mind being charged for it like it's a luxury service. pushci.dev",
  "It's not that I'm cheap... I just don't see why failure should be billed per minute. pushci.dev",
  "Now when builds fail, at least they fail for free. pushci.dev",
  "I had two problems: slow pipelines and expensive pipelines. Now I just have slow pipelines. pushci.dev",
  "There's something very calming about running CI locally. No invoices. Just disappointment. pushci.dev",
  "Why am I paying extra to run tests... on code I already wrote... on a machine I don't even own? pushci.dev",
  "I like my infrastructure simple: me, my code, and no one charging me per command. pushci.dev",
  "The cloud is great... until it starts acting like a landlord. pushci.dev",
  "You know what's scalable? Costs. Costs scale beautifully. pushci.dev",
  "If my code is bad, that's on me. If I'm paying for it — that's offensive. pushci.dev",
  "I cut out the middleman. The middleman was my money. pushci.dev",
  "Every failed build used to cost me. Emotionally and financially. Now just emotionally. pushci.dev",
  "I didn't build this to make money. I built this to stop losing it. pushci.dev",
  "Why is 'run tests' a premium feature? Since when did quality assurance become luxury? pushci.dev",
  "Stop renting your own CI. pushci.dev",
  "Run builds. Not up a bill. pushci.dev",
  "Your laptop is better than their pricing page. pushci.dev",
  "CI without invoices hits different. pushci.dev",
  "Local CI. Global peace of mind. pushci.dev",
  "I refuse to financially support my own build process. pushci.dev",
  "Bringing CI back to where it belongs: your machine, your problem. pushci.dev",
  "CI shouldn't feel like a SaaS negotiation. pushci.dev",
  "CI/CD, but without the 'C' for 'Cost anxiety.' pushci.dev",
  "It's not better... it's just not charging you. Which somehow makes it better. pushci.dev",

  // --- NEW: Larry David meets DevOps ---
  "My accountant called. 'Your CI costs went from $340 to $0. Did you fire someone?' No. Worse. I found pushci.dev",
  "So I'm at standup and the PM goes 'CI is down.' I said 'mine isn't.' Everyone stared. I stared back. pushci.dev",
  "I told my wife I saved $4,200 a year on CI costs. She said 'you spent $4,200 on THAT?' I had to explain everything. She still doesn't get it. pushci.dev",
  "The intern set up CI in 12 seconds with pushci.dev. The senior engineer who spent a week on GitHub Actions hasn't made eye contact since. Pretty, pretty awkward.",
  "My build failed at 2am. But at least it failed for free. There's a certain dignity in that. pushci.dev",
  "Larry David voice: so let me understand... I'm paying Microsoft... to temporarily borrow a computer in Oregon... to check if my semicolons are correct? pushci.dev",
  "I don't understand how 'run npm test' became a $14 billion industry. I genuinely do not understand this. pushci.dev",
  "A VC asked me what our monthly cloud CI spend is. I said zero. He asked again. I said zero. He asked how. I said pushci.dev. He wrote it down wrong.",
  "My CI pipeline has one step: pushci run. My competitor's has 47 steps across 3 files. We ship the same features. pushci.dev",
  "You know what I love about running CI locally? Nobody sends me an invoice for my own mistakes. pushci.dev",

  // --- NEW: Escalating absurdity ---
  "First they charge you per minute. Then per build. Then per seat. Then per breath. pushci.dev — $0 per everything.",
  "In the time it takes GitHub Actions to cold-start a VM, PushCI has already run your tests, diagnosed the failure, and suggested a fix. pushci.dev",
  "The CI industry's business model: charge you money to wait. My business model: don't. pushci.dev",
  "GitHub Actions: loading... loading... loading... starting VM... pulling image... npm install... 4 minutes later: 'npm test passed.' pushci.dev: 4 seconds. Done.",
  "I used to budget for CI like it was rent. Monthly. Recurring. Unavoidable. Then I discovered: it IS avoidable. pushci.dev",

  // --- NEW: LinkedIn professional viral ---
  "Today I reduced our engineering costs by $4,200/year without cutting headcount, reducing scope, or having a single meeting. One terminal command. pushci.dev",
  "We replaced our entire CI/CD infrastructure with one npm package. Our DevOps team's reaction was... complicated. pushci.dev",
  "I just realized we've been paying a cloud provider $0.008/minute to run a command that takes 4 seconds on any developer's laptop. The future of CI is local. pushci.dev",
]

export function CurbShare() {
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * curbMessages.length))
  const [copied, setCopied] = useState(false)
  const [spinning, setSpinning] = useState(false)

  const message = curbMessages[messageIndex]

  const regenerate = useCallback(() => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 400)
    setMessageIndex((prev) => {
      let next = Math.floor(Math.random() * curbMessages.length)
      while (next === prev) next = Math.floor(Math.random() * curbMessages.length)
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
          Curb Your CI Enthusiasm
        </span>
        <button
          onClick={regenerate}
          className={`flex items-center gap-1.5 text-[11px] text-t3 hover:text-t2 ${btnGestureSubtle}`}
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
          Pretty good. Another one.
        </button>
      </div>

      <div className="p-5">
        <p className="text-[15px] text-t1 leading-relaxed min-h-[56px]">
          {message}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
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
