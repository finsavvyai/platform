export default function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10"
      aria-hidden="true">
      <div
        className="absolute w-[400px] sm:w-[700px] lg:w-[900px] h-[400px] sm:h-[700px] lg:h-[900px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(37,99,235,0.04), transparent 70%)',
          top: '-20%', right: '-10%',
        }}
      />
      <div
        className="absolute w-[300px] sm:w-[500px] lg:w-[700px] h-[300px] sm:h-[500px] lg:h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(79,70,229,0.03), transparent 70%)',
          bottom: '-5%', left: '-10%',
        }}
      />
    </div>
  )
}
