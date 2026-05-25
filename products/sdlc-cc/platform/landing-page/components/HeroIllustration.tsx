export default function HeroIllustration() {
  return (
    <div className="w-full flex items-center justify-center" style={{ aspectRatio: '4 / 3' }}>
      <svg
        viewBox="0 0 800 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        role="img"
        aria-label="SDLC.ai proxy architecture diagram showing data protection flow"
      >
        <defs>
          <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#1E40AF", stopOpacity: 0.12 }} />
            <stop offset="100%" style={{ stopColor: "#0EA5E9", stopOpacity: 0.12 }} />
          </linearGradient>
        </defs>

        <g transform="translate(400, 300)">
          <circle r="180" fill="url(#heroGradient)" opacity="0.3" />

          <path
            d="M 0,-150 L 100,-100 L 100,100 L 0,150 L -100,100 L -100,-100 Z"
            fill="#1E40AF"
            opacity="0.8"
            stroke="#0EA5E9"
            strokeWidth="3"
          />

          <g transform="translate(0, -20)">
            <rect x="-30" y="0" width="60" height="50" rx="5" fill="#fff" opacity="0.9" />
            <circle cx="0" cy="-15" r="20" fill="none" stroke="#fff" strokeWidth="6" opacity="0.9" />
          </g>

          <g opacity="0.6">
            <path
              d="M -200,0 L -120,0"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeDasharray="10,5"
              className="animate-pulse"
            />
            <path d="M -120,-10 L -110,0 L -120,10 Z" fill="#38bdf8" />

            <path
              d="M 120,0 L 200,0"
              stroke="#059669"
              strokeWidth="4"
              strokeDasharray="10,5"
              className="animate-pulse"
            />
            <path d="M 200,-10 L 210,0 L 200,10 Z" fill="#059669" />
          </g>

          <g transform="translate(-160, -60)">
            <rect x="0" y="0" width="40" height="6" rx="3" fill="#DC2626" opacity="0.7" />
            <text x="45" y="5" fill="#fff" fontSize="10" opacity="0.7">SSN</text>
          </g>
          <g transform="translate(-160, -40)">
            <rect x="0" y="0" width="50" height="6" rx="3" fill="#DC2626" opacity="0.7" />
            <text x="55" y="5" fill="#fff" fontSize="10" opacity="0.7">Email</text>
          </g>
          <g transform="translate(-160, -20)">
            <rect x="0" y="0" width="45" height="6" rx="3" fill="#DC2626" opacity="0.7" />
            <text x="50" y="5" fill="#fff" fontSize="10" opacity="0.7">Credit Card</text>
          </g>

          <g transform="translate(120, -60)">
            <rect x="0" y="0" width="40" height="6" rx="3" fill="#059669" opacity="0.7" />
            <text x="45" y="5" fill="#fff" fontSize="10" opacity="0.7">[REDACTED]</text>
          </g>
          <g transform="translate(120, -40)">
            <rect x="0" y="0" width="50" height="6" rx="3" fill="#059669" opacity="0.7" />
            <text x="55" y="5" fill="#fff" fontSize="10" opacity="0.7">[REDACTED]</text>
          </g>
        </g>

        <text x="150" y="550" fill="#94A3B8" fontSize="14" textAnchor="middle">Your Code</text>
        <text x="400" y="550" fill="#1E40AF" fontSize="16" fontWeight="bold" textAnchor="middle">SDLC.ai Proxy</text>
        <text x="650" y="550" fill="#94A3B8" fontSize="14" textAnchor="middle">OpenAI/Claude</text>
      </svg>
    </div>
  );
}
