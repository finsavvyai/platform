import { useReveal } from './useReveal'

const rants = [
  {
    setup: '"Build minutes"?',
    punchline: "What is this, a gym membership? I'm pushing code, why is there a meter running?",
  },
  {
    setup: 'CI used to be a tool.',
    punchline: "Now it's a subscription. For what? For waiting? I don't mind automation. I mind being charged for it like it's a luxury service.",
  },
  {
    setup: 'I wrote the code. I wrote the tests.',
    punchline: "Now I'm paying someone else to press run. On a machine I don't even own. Why is 'run tests' a premium feature?",
  },
]

const punches = [
  "You ever look at your CI bill and think... I could've just bought another laptop?",
  "It's not that I'm cheap. I just don't see why failure should be billed per minute.",
  "You know what's scalable? Costs. Costs scale beautifully.",
  "The cloud is great... until it starts acting like a landlord.",
]

export function CurbProblem() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <p className="text-body font-medium text-t3 tracking-wide italic mb-4">
          "Let me ask you something..."
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1 max-w-2xl">
          Why am I paying...{' '}
          <span className="text-t3">to run my own code?</span>
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {rants.map((r) => (
            <div
              key={r.setup}
              className="rounded-lg border border-border-base bg-surface p-6 card-hover"
            >
              <p className="text-lg font-semibold text-t1 leading-snug">
                {r.setup}
              </p>
              <p className="mt-3 text-t2 text-body leading-relaxed">
                {r.punchline}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {punches.map((p) => (
            <p key={p} className="text-t3 text-body italic leading-relaxed pl-4 border-l-2 border-border-base">
              "{p}"
            </p>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-border-base/60 bg-surface/50 p-8 max-w-2xl">
          <p className="text-t2 leading-relaxed italic">
            There's always a moment. You open the invoice. You scroll. You stop scrolling.
            And you go:{' '}
            <span className="text-t1 font-medium not-italic">
              "...this is personal."
            </span>
          </p>
          <p className="mt-4 text-t3 text-body">
            That's when pushci.dev happens.
          </p>
        </div>
      </div>
    </section>
  )
}
