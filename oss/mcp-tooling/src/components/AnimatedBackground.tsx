export function AnimatedBackground() {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-500 blob-morph mix-blend-multiply opacity-30" />
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-cyan-500 blob-morph-2 mix-blend-multiply opacity-25" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-purple-500 blob-morph-3 mix-blend-multiply opacity-20" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-pink-500 blob-morph mix-blend-multiply opacity-25" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] bg-indigo-500 blob-morph-2 mix-blend-multiply opacity-20" style={{ animationDelay: '5s' }} />
      </div>

      <div className="absolute inset-0 aurora-effect pointer-events-none" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => {
          const size = 2 + Math.random() * 4;
          return (
            <div
              key={i}
              className="absolute bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full wave-motion"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${4 + Math.random() * 6}s`,
                opacity: 0.3 + Math.random() * 0.4,
              }}
            />
          );
        })}
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`orbit-${i}`}
            className="absolute top-1/2 left-1/2 w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full particle-orbit"
            style={{
              animationDelay: `${i * 3}s`,
              animationDuration: `${15 + i * 2}s`,
              opacity: 0.5,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />
    </>
  );
}
