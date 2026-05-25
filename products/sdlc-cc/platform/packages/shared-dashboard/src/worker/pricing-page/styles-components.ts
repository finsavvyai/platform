/**
 * Pricing Page - Component CSS Styles
 */

export const componentStyles = `
        .pricing-card {
            background: var(--bg-card);
            border: 2px solid var(--border);
            border-radius: 16px;
            padding: 40px;
            position: relative;
            transition: all 0.3s;
        }

        .pricing-card:hover {
            background: var(--bg-card-hover);
            border-color: var(--accent);
            transform: translateY(-4px);
        }

        .pricing-card.popular {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent);
        }

        .popular-badge {
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--accent);
            color: white;
            padding: 6px 20px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .plan-name { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .plan-description { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }
        .price { font-size: 48px; font-weight: 700; margin-bottom: 8px; }
        .price-currency { font-size: 24px; color: var(--text-secondary); }
        .price-period { color: var(--text-secondary); font-size: 16px; }
        .price-annual { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }

        .cta-button {
            width: 100%;
            padding: 16px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 32px;
        }

        .cta-button:hover { background: var(--accent-hover); transform: scale(1.02); }
        .cta-button.secondary { background: transparent; border: 2px solid var(--border); }
        .cta-button.secondary:hover { border-color: var(--accent); background: rgba(67, 97, 238, 0.1); }

        .features-list { list-style: none; }
        .features-list li {
            padding: 12px 0;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            border-bottom: 1px solid var(--border);
        }
        .features-list li:last-child { border-bottom: none; }
        .check-icon { color: var(--success); font-weight: 700; flex-shrink: 0; }
        .feature-text { color: var(--text-primary); font-size: 15px; }
        .feature-text.muted { color: var(--text-secondary); }

        .comparison-section { margin-top: 80px; padding-top: 80px; border-top: 1px solid var(--border); }
        .comparison-title { font-size: 36px; font-weight: 700; text-align: center; margin-bottom: 48px; }
        .comparison-table { background: var(--bg-card); border-radius: 16px; overflow: hidden; border: 1px solid var(--border); }
        .comparison-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 24px; padding: 20px 32px; border-bottom: 1px solid var(--border); align-items: center; }
        .comparison-row.header { background: var(--bg-secondary); font-weight: 600; }
        .comparison-row:last-child { border-bottom: none; }

        .faq-section { margin-top: 80px; max-width: 800px; margin-left: auto; margin-right: auto; }
        .faq-title { font-size: 36px; font-weight: 700; text-align: center; margin-bottom: 48px; }
        .faq-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        .faq-question { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
        .faq-answer { color: var(--text-secondary); line-height: 1.8; }

        .footer { text-align: center; margin-top: 80px; padding-top: 40px; border-top: 1px solid var(--border); color: var(--text-secondary); }
        .footer a { color: var(--accent); text-decoration: none; }
        .footer a:hover { text-decoration: underline; }

        @media (max-width: 768px) {
            .pricing-grid { grid-template-columns: 1fr; }
            .comparison-row { grid-template-columns: 1fr; gap: 12px; }
            .comparison-row > div:first-child { font-weight: 600; }
            h1 { font-size: 36px; }
        }`;
