import { useReveal } from './useReveal'

const quotes = [
  {
    text: "I stopped paying for CI and nothing bad happened. That worried me.",
    author: "A developer",
  },
  {
    text: "My builds fail just as often... but now it feels fair.",
    author: "Another developer",
  },
  {
    text: "I told my DevOps guy about PushCI. He said 'that can't be real.' I ran it. He watched. Long silence.",
    author: "Someone who enjoys awkward moments",
  },
]

export function CurbTestimonials() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-t1">
          Social proof <span className="text-t3 font-normal">(kind of)</span>
        </h2>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <div
              key={q.author}
              className="rounded-lg border border-border-base bg-surface p-6 card-hover"
            >
              <p className="text-t2 italic leading-relaxed">"{q.text}"</p>
              <p className="mt-4 text-body text-t3">-- {q.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
