/**
 * Landing Page - Code block, footer, and responsive styles;
 * closes style/head tags and opens body
 */

export const landingFooterStyles = `
        /* Code Block */
        .code-block {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin: 2rem 0;
            overflow-x: auto;
        }

        .code-block pre {
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 0.875rem;
            color: #a0aec0;
            line-height: 1.6;
        }

        .code-comment {
            color: #6b7280;
        }

        .code-keyword {
            color: #8b5cf6;
        }

        .code-string {
            color: #10b981;
        }

        /* Footer */
        footer {
            border-top: 1px solid var(--border);
            padding: 4rem 0 3rem;
            text-align: center;
        }

        .footer-title {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 1rem;
        }

        .footer-subtitle {
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }

        .tech-badges {
            display: flex;
            gap: 0.75rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 3rem;
        }

        .tech-badge {
            padding: 0.5rem 1rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            font-size: 0.8125rem;
            color: var(--text-secondary);
        }

        .copyright {
            margin-top: 3rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .nav-links {
                gap: 1rem;
            }

            .hero {
                padding: 4rem 0 3rem;
            }

            .stats {
                gap: 1.5rem;
                padding: 2rem;
            }

            .features-grid {
                grid-template-columns: 1fr;
                gap: 1.5rem;
            }

            .arch-diagram {
                font-size: 0.75rem;
            }
        }
    </style>
</head>
<body>
    <div class="grid-bg"></div>
    <div class="glow-top"></div>
`;
