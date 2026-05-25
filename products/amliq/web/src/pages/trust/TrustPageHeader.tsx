interface TrustPageHeaderProps {
  title: string
  subtitle: string
}

export default function TrustPageHeader({ title, subtitle }: TrustPageHeaderProps) {
  return (
    <header className="pt-24 pb-12 sm:pt-32 sm:pb-16 px-4 text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-token-fg tracking-tight">
          {title}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-token-fg-muted max-w-2xl mx-auto">
          {subtitle}
        </p>
      </div>
    </header>
  )
}
