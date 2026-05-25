/**
 * Landing Page - HTML head, meta, and base layout styles
 */

export const landingBaseStyles = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoBoot — Enterprise Product Infrastructure</title>
    <meta name="description" content="Ship products 10x faster with shared infrastructure. Built for product-led companies.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        :root {
            --bg-primary: #0a0b14;
            --bg-secondary: #141520;
            --bg-tertiary: #1c1d2e;
            --accent: #4361ee;
            --accent-light: #5a7bff;
            --text-primary: #f8f9fa;
            --text-secondary: #9ca3af;
            --border: rgba(255, 255, 255, 0.08);
            --shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
        }

        /* Grid Background */
        .grid-bg {
            position: fixed;
            inset: 0;
            background-image:
                linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
            background-size: 50px 50px;
            z-index: 0;
            pointer-events: none;
        }

        /* Glow Effects */
        .glow-top {
            position: fixed;
            top: -300px;
            left: 50%;
            transform: translateX(-50%);
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(67, 97, 238, 0.12) 0%, transparent 70%);
            z-index: 0;
            pointer-events: none;
        }

        /* Container */
        .container {
            max-width: 1280px;
            margin: 0 auto;
            padding: 0 2rem;
            position: relative;
            z-index: 1;
        }

        /* Navigation */
        nav {
            padding: 1.5rem 0;
            border-bottom: 1px solid var(--border);
            background: rgba(10, 11, 20, 0.8);
            backdrop-filter: blur(12px);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .nav-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.02em;
        }

        .nav-links {
            display: flex;
            gap: 2rem;
            align-items: center;
        }

        .nav-link {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 0.9375rem;
            font-weight: 500;
            transition: color 0.2s;
        }

        .nav-link:hover {
            color: var(--text-primary);
        }
`;
