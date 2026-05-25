// CSS-only rotating 3D diamond hero — faceted geometric with emerald iridescence.

export default function DiamondHero() {
  return (
    <div className="diamond-scene" role="img" aria-label="Rotating 3D diamond graphic representing PushCI">
      <div className="diamond">
        {/* Top pyramid (4 faces) */}
        <div className="face top-front" />
        <div className="face top-right" />
        <div className="face top-back" />
        <div className="face top-left" />
        {/* Bottom pyramid (4 faces) */}
        <div className="face bot-front" />
        <div className="face bot-right" />
        <div className="face bot-back" />
        <div className="face bot-left" />
        {/* Inner glow core */}
        <div className="core" />
      </div>

      <style>{`
        .diamond-scene {
          width: 280px;
          height: 280px;
          perspective: 800px;
          perspective-origin: 50% 50%;
          position: relative;
        }

        .diamond {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: diamond-spin 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes diamond-spin {
          0%   { transform: rotateY(0deg) rotateX(-15deg); }
          100% { transform: rotateY(360deg) rotateX(-15deg); }
        }

        .face {
          position: absolute;
          width: 0;
          height: 0;
          transform-style: preserve-3d;
          backface-visibility: visible;
        }

        /* Top pyramid faces */
        .top-front {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-bottom: 100px solid rgba(16, 185, 129, 0.18);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -100%) rotateX(35deg) translateZ(0px);
          filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
        }
        .top-right {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-bottom: 100px solid rgba(16, 185, 129, 0.14);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -100%) rotateY(90deg) rotateX(35deg) translateZ(0px);
          filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.2));
        }
        .top-back {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-bottom: 100px solid rgba(16, 185, 129, 0.10);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -100%) rotateY(180deg) rotateX(35deg) translateZ(0px);
          filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.15));
        }
        .top-left {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-bottom: 100px solid rgba(16, 185, 129, 0.22);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -100%) rotateY(270deg) rotateX(35deg) translateZ(0px);
          filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.35));
        }

        /* Bottom pyramid faces (inverted) */
        .bot-front {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-top: 80px solid rgba(5, 150, 105, 0.15);
          left: 50%;
          top: 50%;
          transform: translate(-50%, 0%) rotateX(-40deg) translateZ(0px);
          filter: drop-shadow(0 0 6px rgba(5, 150, 105, 0.25));
        }
        .bot-right {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-top: 80px solid rgba(5, 150, 105, 0.12);
          left: 50%;
          top: 50%;
          transform: translate(-50%, 0%) rotateY(90deg) rotateX(-40deg) translateZ(0px);
        }
        .bot-back {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-top: 80px solid rgba(5, 150, 105, 0.08);
          left: 50%;
          top: 50%;
          transform: translate(-50%, 0%) rotateY(180deg) rotateX(-40deg) translateZ(0px);
        }
        .bot-left {
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-top: 80px solid rgba(5, 150, 105, 0.18);
          left: 50%;
          top: 50%;
          transform: translate(-50%, 0%) rotateY(270deg) rotateX(-40deg) translateZ(0px);
          filter: drop-shadow(0 0 8px rgba(5, 150, 105, 0.3));
        }

        /* Inner glow */
        .core {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 60px;
          height: 60px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%);
          animation: core-pulse 3s ease-in-out infinite alternate;
          box-shadow: 0 0 40px 15px rgba(16, 185, 129, 0.15);
        }

        @keyframes core-pulse {
          0%   { opacity: 0.6; transform: translate(-50%, -50%) scale(0.8); }
          100% { opacity: 1;   transform: translate(-50%, -50%) scale(1.2); }
        }

        /* Ambient edge glow on the scene */
        .diamond-scene::after {
          content: '';
          position: absolute;
          inset: -20%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%);
          pointer-events: none;
          animation: ambient-glow 4s ease-in-out infinite alternate;
        }

        @keyframes ambient-glow {
          0%   { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
