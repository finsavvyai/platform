// AutoBoot Integration Hub - Base CSS styles (reset, variables, layout)

export const stylesBase = `
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0a0b14;
            --bg-secondary: #141520;
            --bg-card: #1c1d2e;
            --accent: #4361ee;
            --accent-green: #10b981;
            --accent-purple: #8b5cf6;
            --accent-orange: #f59e0b;
            --text-primary: #f8f9fa;
            --text-secondary: #9ca3af;
            --border: rgba(255, 255, 255, 0.08);
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 2rem;
        }

        /* Header */
        header {
            padding: 3rem 0;
            text-align: center;
            border-bottom: 1px solid var(--border);
        }

        h1 {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 1rem;
        }

        .gradient-text {
            background: linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .subtitle {
            font-size: 1.25rem;
            color: var(--text-secondary);
            max-width: 600px;
            margin: 0 auto;
        }

        /* Integration Cards */
        .integrations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            padding: 4rem 0;
        }

        .integration-card {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 1rem;
            padding: 2rem;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .integration-card:hover {
            border-color: var(--accent);
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(67, 97, 238, 0.2);
        }

        .integration-icon {
            width: 60px;
            height: 60px;
            background: rgba(67, 97, 238, 0.1);
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            margin-bottom: 1.5rem;
        }

        .integration-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .integration-description {
            color: var(--text-secondary);
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }

        .integration-stats {
            display: flex;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
        }

        .stat {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .stat-icon {
            color: var(--accent-green);
        }

        .setup-btn {
            width: 100%;
            padding: 0.875rem;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }

        .setup-btn:hover {
            background: #3451d1;
            transform: translateY(-1px);
        }`;
