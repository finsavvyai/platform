import { Quote } from 'lucide-react'

interface TestimonialCardProps {
  quote: string
  author: string
  title: string
  company: string
}

function Initials({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2)
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A96E] to-[#C9A96E]-dark flex items-center justify-center text-[#0F172A] text-sm font-bold shrink-0">
      {initials}
    </div>
  )
}

export default function TestimonialCard({ quote, author, title, company }: TestimonialCardProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 h-full flex flex-col">
      <Quote size={20} className="text-token-gold/40 mb-4 shrink-0" />
      <p className="text-sm text-slate-600 leading-relaxed flex-1 mb-4">{quote}</p>
      <div className="flex items-center gap-3">
        <Initials name={author} />
        <div>
          <p className="text-sm font-semibold text-slate-900">{author}</p>
          <p className="text-xs text-slate-600">{title}, {company}</p>
        </div>
      </div>
    </div>
  )
}
