export default function GradientOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10" aria-hidden="true">
      <div
        className="absolute w-[300px] sm:w-[500px] lg:w-[600px] h-[300px] sm:h-[500px] lg:h-[600px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, var(--accent-gold), transparent 70%)', top: '-10%', right: '-10%' }}
      />
      <div
        className="absolute w-[250px] sm:w-[400px] lg:w-[500px] h-[250px] sm:h-[400px] lg:h-[500px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #4F46E5, transparent 70%)', bottom: '10%', left: '-8%' }}
      />
    </div>
  )
}
