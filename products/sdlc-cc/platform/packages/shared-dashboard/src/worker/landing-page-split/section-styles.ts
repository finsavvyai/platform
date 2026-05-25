/**
 * Landing Page - Stats, sections, features grid, and architecture styles
 */

export const landingSectionStyles = `
        /* Stats */
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 2rem;
            padding: 2.5rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 1rem;
            margin-bottom: 6rem;
        }

        .stat {
            text-align: center;
        }

        .stat-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: #00d4ff;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.9375rem;
        }

        /* Sections */
        section {
            margin-bottom: 6rem;
        }

        h2 {
            font-size: clamp(2rem, 4vw, 2.75rem);
            font-weight: 700;
            letter-spacing: -0.02em;
            margin-bottom: 1rem;
            text-align: center;
        }

        .section-subtitle {
            text-align: center;
            color: var(--text-secondary);
            font-size: 1.125rem;
            max-width: 640px;
            margin: 0 auto 3rem;
        }

        /* Features Grid */
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }

        .feature-card {
            padding: 2rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 1rem;
            transition: all 0.3s;
        }

        .feature-card:hover {
            border-color: rgba(67, 97, 238, 0.3);
            transform: translateY(-4px);
            box-shadow: var(--shadow);
        }

        .feature-icon {
            width: 48px;
            height: 48px;
            background: rgba(67, 97, 238, 0.1);
            border-radius: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-bottom: 1.25rem;
        }

        .feature-card h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.75rem;
        }

        .feature-card p {
            color: var(--text-secondary);
            line-height: 1.7;
        }

        /* Architecture Visual */
        .architecture-visual {
            margin-top: 3rem;
            padding: 3rem 2rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 1rem;
            position: relative;
        }

        .arch-layer {
            margin-bottom: 2rem;
        }

        .layer-title {
            text-align: center;
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 1.5rem;
        }

        .product-nodes {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 1rem;
            max-width: 800px;
            margin: 0 auto;
        }

        .product-node {
            background: linear-gradient(135deg, rgba(67, 97, 238, 0.05) 0%, rgba(0, 212, 255, 0.05) 100%);
            border: 1px solid rgba(67, 97, 238, 0.2);
            border-radius: 0.75rem;
            padding: 1.25rem;
            text-align: center;
            transition: all 0.3s ease;
        }

        .product-node:hover {
            border-color: rgba(67, 97, 238, 0.4);
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(67, 97, 238, 0.15);
        }

        .node-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .node-label {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .connection-label {
            text-align: center;
            margin-top: 1.5rem;
            font-size: 0.8125rem;
            color: var(--accent);
            font-weight: 500;
            padding: 0.5rem 1rem;
            background: rgba(67, 97, 238, 0.1);
            border-radius: 100px;
            display: inline-block;
            position: relative;
            left: 50%;
            transform: translateX(-50%);
        }

        .arch-connector {
            width: 2px;
            height: 40px;
            background: linear-gradient(180deg, rgba(67, 97, 238, 0.3) 0%, rgba(67, 97, 238, 0) 100%);
            margin: 0 auto;
        }
`;
