import { useState, useEffect } from 'react'

const lines = [
  "I'm pushing code... why is there a meter running? What is this, a taxi?",
  "CI used to be a tool. Now it's a subscription. For what? For waiting?",
  "PushCI.dev -- because I refuse to financially support my own build process.",
  "You ever look at your CI bill and think... I could've just bought another laptop?",
  "I don't mind automation. I mind being charged for it like it's a luxury service.",
  "It's not that I'm cheap... I just don't see why failure should be billed per minute.",
  "PushCI.dev -- now when builds fail, at least they fail for free.",
  "I had two problems: slow pipelines and expensive pipelines. Now I just have slow pipelines.",
  "There's something very calming about running CI locally. No invoices. Just disappointment.",
  "Why am I paying extra to run tests... on code I already wrote... on a machine I don't even own?",
  "PushCI.dev -- bringing CI back to where it belongs: your machine, your problem.",
  "I like my infrastructure simple: me, my code, and no one charging me per command.",
  "The cloud is great... until it starts acting like a landlord.",
  "You know what's scalable? Costs. Costs scale beautifully.",
  "PushCI.dev -- because CI shouldn't feel like a SaaS negotiation.",
]

export function CurbTicker() {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex((i) => (i + 1) % lines.length)
        setFading(false)
      }, 400)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="py-6 border-t border-b border-border-base/40 overflow-hidden">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6">
        <p
          className={`text-center text-t2 italic text-sm sm:text-base leading-relaxed transition-opacity duration-400 min-h-[3rem] flex items-center justify-center ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          "{lines[index]}"
        </p>
      </div>
    </div>
  )
}
