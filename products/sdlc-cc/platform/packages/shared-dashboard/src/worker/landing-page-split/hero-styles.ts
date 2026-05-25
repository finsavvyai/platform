/**
 * Landing Page - Hero section and button styles
 */

export const landingHeroStyles = `
        /* Hero */
        .hero {
            padding: 7rem 0 5rem;
            text-align: center;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 100px;
            font-size: 0.8125rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }

        .status-indicator {
            width: 6px;
            height: 6px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 8px #10b981;
        }

        h1 {
            font-size: clamp(2.5rem, 5vw, 4.5rem);
            font-weight: 800;
            letter-spacing: -0.03em;
            line-height: 1.1;
            margin-bottom: 1.5rem;
        }

        .gradient {
            background: linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .lead {
            font-size: clamp(1.125rem, 2vw, 1.25rem);
            color: var(--text-secondary);
            max-width: 640px;
            margin: 0 auto 2.5rem;
            line-height: 1.7;
        }

        .cta-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 4rem;
        }

        .btn {
            padding: 0.875rem 1.75rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 0.9375rem;
            text-decoration: none;
            transition: all 0.2s;
            display: inline-block;
        }

        .btn-primary {
            background: var(--accent);
            color: white;
            border: none;
        }

        .btn-primary:hover {
            background: var(--accent-light);
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(67, 97, 238, 0.25);
        }

        .btn-secondary {
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            background: var(--bg-secondary);
            border-color: rgba(255, 255, 255, 0.12);
        }
`;
