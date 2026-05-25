/**
 * Landing Page - Core layer, module, and infra node styles
 */

export const landingCoreModuleStyles = `
        .core-layer {
            background: linear-gradient(135deg, rgba(67, 97, 238, 0.05) 0%, rgba(138, 80, 226, 0.05) 100%);
            border: 1px solid rgba(67, 97, 238, 0.2);
            border-radius: 1rem;
            padding: 2rem;
        }

        .core-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.25rem;
            margin-bottom: 2rem;
        }

        .core-module {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.5rem;
            transition: all 0.3s ease;
        }

        .core-module:hover {
            border-color: rgba(67, 97, 238, 0.3);
            transform: translateY(-2px);
        }

        .module-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }

        .module-icon {
            font-size: 1.75rem;
        }

        .module-name {
            font-size: 1.125rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .module-features {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .feature-tag {
            font-size: 0.75rem;
            padding: 0.25rem 0.625rem;
            background: rgba(67, 97, 238, 0.1);
            border: 1px solid rgba(67, 97, 238, 0.2);
            border-radius: 0.375rem;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .dashboard-banner {
            text-align: center;
            padding: 1rem 1.5rem;
            background: linear-gradient(90deg, rgba(67, 97, 238, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%);
            border: 1px solid rgba(67, 97, 238, 0.3);
            border-radius: 0.75rem;
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
        }

        .infra-nodes {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            max-width: 900px;
            margin: 0 auto;
        }

        .infra-node {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.75rem;
            text-align: center;
            transition: all 0.3s ease;
        }

        .infra-node:hover {
            border-color: rgba(0, 212, 255, 0.3);
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 212, 255, 0.15);
        }

        .infra-icon {
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
        }

        .infra-label {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
        }

        .infra-stat {
            font-size: 0.8125rem;
            color: var(--text-secondary);
        }
`;
