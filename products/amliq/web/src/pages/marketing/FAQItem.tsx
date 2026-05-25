import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FAQItemProps {
  question: string
  answer: string
}

export default function FAQItem({ question, answer }: FAQItemProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors min-h-[44px]"
      >
        <span className="text-slate-900 font-medium text-left">{question}</span>
        <ChevronDown size={20} className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-4 text-slate-600 border-t border-slate-200">
          {answer}
        </div>
      )}
    </div>
  )
}
