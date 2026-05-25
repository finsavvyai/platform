/**
 * Pricing Page - Base & Layout CSS Styles
 */

export const baseStyles = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0a0b14;
            --bg-secondary: #141520;
            --bg-card: #1c1d2e;
            --bg-card-hover: #24253a;
            --text-primary: #ffffff;
            --text-secondary: #a0a0b8;
            --accent: #4361ee;
            --accent-hover: #3451d1;
            --success: #10b981;
            --border: rgba(255, 255, 255, 0.1);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }

        .pricing-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 60px 24px;
        }

        .header {
            text-align: center;
            margin-bottom: 60px;
        }

        .logo {
            display: inline-block;
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent), var(--success));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 24px;
        }

        h1 {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 16px;
            letter-spacing: -0.02em;
        }

        .subtitle {
            font-size: 20px;
            color: var(--text-secondary);
            max-width: 600px;
            margin: 0 auto;
        }

        .billing-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin: 40px 0;
            padding: 8px;
            background: var(--bg-secondary);
            border-radius: 12px;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
        }

        .billing-toggle button {
            padding: 12px 32px;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            border-radius: 8px;
            transition: all 0.2s;
        }

        .billing-toggle button.active {
            background: var(--accent);
            color: white;
        }

        .save-badge {
            background: var(--success);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .pricing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
            max-width: 1200px;
            margin: 0 auto;
        }`;
