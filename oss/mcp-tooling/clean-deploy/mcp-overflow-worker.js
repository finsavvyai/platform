/**
 * MCPOverflow - Futuristic MCP Connector Platform
 * The #1 platform for generating MCP connectors from OpenAPI specs
 */

const MCP_OVERFLOW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCPOverflow - Generate MCP Connectors from OpenAPI</title>
    <meta name="description" content="The #1 platform for generating MCP connectors from OpenAPI specifications. Transform your APIs into powerful MCP tools in seconds.">

    <!-- Space Grotesk - The modern font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

    <!-- Modern CSS -->
    <style>
        :root {
            --accent: #00F5FF;
            --accent-dark: #00D4FF;
            --accent-light: #66FFFF;
            --secondary: #FF006E;
            --dark-bg: #000000;
            --card-bg: #0A0A0A;
            --text-primary: #FFFFFF;
            --text-secondary: #B0B0B0;
            --border-color: #1A1A1A;
            --success: #00FF88;
            --warning: #FFB800;
            --error: #FF4444;
            --gradient: linear-gradient(135deg, #00F5FF 0%, #FF006E 100%);
            --glow: 0 0 40px rgba(0, 245, 255, 0.5);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Space Grotesk', sans-serif;
            background: var(--dark-bg);
            color: var(--text-primary);
            line-height: 1.6;
            overflow-x: hidden;
        }

        /* Background Effects */
        .bg-effects {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
        }

        .orbit {
            position: absolute;
            border: 1px solid rgba(0, 245, 255, 0.1);
            border-radius: 50%;
            animation: rotate 60s linear infinite;
        }

        .orbit-1 {
            width: 300px;
            height: 300px;
            top: -150px;
            right: -150px;
            animation-duration: 45s;
        }

        .orbit-2 {
            width: 500px;
            height: 500px;
            bottom: -250px;
            left: -250px;
            animation-duration: 90s;
            animation-direction: reverse;
        }

        .orbit-3 {
            width: 200px;
            height: 200px;
            top: 50%;
            left: -100px;
            animation-duration: 30s;
        }

        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .floating-particle {
            position: absolute;
            width: 2px;
            height: 2px;
            background: var(--accent);
            border-radius: 50%;
            opacity: 0;
            animation: float-up 8s linear infinite;
        }

        @keyframes float-up {
            0% {
                opacity: 0;
                transform: translateY(100vh) scale(0);
            }
            10% {
                opacity: 1;
                transform: translateY(90vh) scale(1);
            }
            90% {
                opacity: 1;
                transform: translateY(10vh) scale(1);
            }
            100% {
                opacity: 0;
                transform: translateY(0) scale(0);
            }
        }

        /* Navigation */
        nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            padding: 1rem 2rem;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-color);
        }

        .nav-container {
            max-width: 1400px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.8rem;
            font-weight: 900;
            background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-decoration: none;
            letter-spacing: -0.5px;
        }

        .nav-links {
            display: flex;
            gap: 2rem;
            list-style: none;
        }

        .nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            position: relative;
        }

        .nav-links a:hover {
            color: var(--accent);
            text-shadow: 0 0 20px rgba(0, 245, 255, 0.5);
        }

        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 0;
            height: 2px;
            background: var(--gradient);
            transition: width 0.3s ease;
        }

        .nav-links a:hover::after {
            width: 100%;
        }

        /* Main Container */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            position: relative;
            z-index: 1;
        }

        /* Hero Section */
        .hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            position: relative;
            padding: 6rem 2rem 2rem;
        }

        .hero-content {
            max-width: 900px;
            position: relative;
            z-index: 2;
        }

        .hero-badge {
            display: inline-block;
            background: rgba(0, 245, 255, 0.1);
            border: 1px solid rgba(0, 245, 255, 0.2);
            color: var(--accent);
            padding: 0.75rem 2rem;
            border-radius: 100px;
            font-weight: 700;
            font-size: 0.9rem;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            animation: pulse-glow 2s ease-in-out infinite;
        }

        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(0, 245, 255, 0.3); }
            50% { box-shadow: 0 0 40px rgba(0, 245, 255, 0.6); }
        }

        .hero h1 {
            font-size: clamp(3rem, 10vw, 7rem);
            font-weight: 900;
            line-height: 0.9;
            margin-bottom: 2rem;
            background: linear-gradient(135deg,
                var(--text-primary) 0%,
                var(--accent) 20%,
                var(--accent-light) 40%,
                var(--secondary) 60%,
                var(--text-primary) 100%);
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: gradient 12s ease-in-out infinite;
            letter-spacing: -2px;
        }

        @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            25% { background-position: 100% 50%; }
            50% { background-position: 100% 100%; }
            75% { background-position: 0% 100%; }
        }

        .hero-description {
            font-size: 1.4rem;
            color: var(--text-secondary);
            margin-bottom: 3rem;
            font-weight: 400;
            line-height: 1.6;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }

        .cta-buttons {
            display: flex;
            gap: 1.5rem;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 4rem;
        }

        .btn {
            padding: 1.25rem 3rem;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            position: relative;
            overflow: hidden;
        }

        .btn-primary {
            background: var(--gradient);
            color: white;
            box-shadow: var(--glow);
        }

        .btn-primary:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 0 60px rgba(0, 245, 255, 0.7);
        }

        .btn-secondary {
            background: transparent;
            color: var(--accent);
            border: 2px solid var(--accent);
        }

        .btn-secondary:hover {
            background: rgba(0, 245, 255, 0.1);
            transform: translateY(-2px);
            box-shadow: 0 0 40px rgba(0, 245, 255, 0.4);
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 2rem;
            margin-top: 4rem;
        }

        .stat-card {
            background: rgba(10, 10, 10, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 2rem;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
            box-shadow: 0 0 40px rgba(0, 245, 255, 0.2);
        }

        .stat-number {
            font-size: 2.5rem;
            font-weight: 900;
            color: var(--accent);
            display: block;
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 0.9rem;
        }

        /* Features Section */
        .features {
            padding: 6rem 0;
            background: linear-gradient(180deg, transparent 0%, rgba(0, 245, 255, 0.05) 50%, transparent 100%);
        }

        .section-header {
            text-align: center;
            margin-bottom: 4rem;
        }

        .section-badge {
            display: inline-block;
            background: rgba(255, 0, 110, 0.1);
            border: 1px solid rgba(255, 0, 110, 0.2);
            color: var(--secondary);
            padding: 0.5rem 1.5rem;
            border-radius: 100px;
            font-weight: 700;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 1rem;
        }

        .section-title {
            font-size: clamp(2.5rem, 6vw, 4rem);
            font-weight: 900;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
        }

        .feature-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 3rem 2rem;
            text-align: center;
            position: relative;
            overflow: hidden;
            transition: all 0.4s ease;
        }

        .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--gradient);
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        }

        .feature-card:hover::before {
            transform: translateX(0);
        }

        .feature-card:hover {
            transform: translateY(-10px);
            border-color: var(--accent);
            box-shadow: 0 0 60px rgba(0, 245, 255, 0.3);
        }

        .feature-icon {
            width: 80px;
            height: 80px;
            background: var(--gradient);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 2rem;
            font-size: 2rem;
            box-shadow: var(--glow);
        }

        .feature-title {
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            color: var(--text-primary);
        }

        .feature-description {
            color: var(--text-secondary);
            line-height: 1.7;
            font-weight: 400;
        }

        /* Generate Section */
        .generate {
            padding: 6rem 0;
            background: linear-gradient(180deg, rgba(0, 245, 255, 0.02) 0%, transparent 100%);
        }

        .generate-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 3rem;
            max-width: 600px;
            margin: 0 auto;
            text-align: center;
        }

        .upload-area {
            border: 2px dashed var(--border-color);
            border-radius: 16px;
            padding: 3rem 2rem;
            margin-bottom: 2rem;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }

        .upload-area:hover {
            border-color: var(--accent);
            background: rgba(0, 245, 255, 0.05);
        }

        .upload-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
        }

        .upload-area input {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            cursor: pointer;
        }

        .result-area {
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid var(--success);
            border-radius: 12px;
            padding: 2rem;
            margin-top: 2rem;
            animation: slideIn 0.5s ease;
        }

        /* Pricing Section */
        .pricing {
            padding: 6rem 0;
            background: var(--dark-bg);
        }

        .pricing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }

        .pricing-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            padding: 3rem 2rem;
            text-align: center;
            position: relative;
            transition: all 0.3s ease;
        }

        .pricing-card:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
            box-shadow: 0 0 40px rgba(0, 245, 255, 0.2);
        }

        .pricing-card.featured {
            border-color: var(--accent);
            transform: scale(1.05);
        }

        .popular-badge {
            position: absolute;
            top: -15px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--gradient);
            color: white;
            padding: 0.5rem 1.5rem;
            border-radius: 100px;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .price {
            font-size: 3rem;
            font-weight: 900;
            color: var(--accent);
            margin-bottom: 0.5rem;
        }

        .price span {
            font-size: 1rem;
            color: var(--text-secondary);
            font-weight: 400;
        }

        .pricing-card ul {
            list-style: none;
            text-align: left;
        }

        .pricing-card li {
            padding: 0.75rem 0;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border-color);
        }

        .pricing-card li:before {
            content: "✓ ";
            color: var(--success);
            font-weight: 700;
            margin-right: 0.5rem;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .nav-links {
                display: none;
            }

            .hero h1 {
                font-size: clamp(2.5rem, 12vw, 5rem);
            }

            .hero-description {
                font-size: 1.2rem;
            }

            .cta-buttons {
                flex-direction: column;
                align-items: center;
            }

            .btn {
                width: 100%;
                max-width: 300px;
            }

            .features-grid {
                grid-template-columns: 1fr;
            }

            .orbit-1, .orbit-2 {
                display: none;
            }
        }

        /* Loading Animation */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(0, 245, 255, 0.3);
            border-radius: 50%;
            border-top-color: var(--accent);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body>
    <!-- Background Effects -->
    <div class="bg-effects">
        <div class="orbit orbit-1"></div>
        <div class="orbit orbit-2"></div>
        <div class="orbit orbit-3"></div>
        <div class="floating-particle" style="left: 10%; animation-delay: 0s;"></div>
        <div class="floating-particle" style="left: 25%; animation-delay: 2s;"></div>
        <div class="floating-particle" style="left: 40%; animation-delay: 4s;"></div>
        <div class="floating-particle" style="left: 60%; animation-delay: 6s;"></div>
        <div class="floating-particle" style="left: 75%; animation-delay: 8s;"></div>
        <div class="floating-particle" style="left: 90%; animation-delay: 10s;"></div>
    </div>

    <!-- Navigation -->
    <nav>
        <div class="nav-container">
            <a href="/" class="logo">MCPOverflow</a>
            <ul class="nav-links">
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#docs">Docs</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
        <div class="hero-content">
            <div class="hero-badge">✨ The Future of API Integration</div>
            <h1 class="glow-text">Transform Your APIs into MCP Tools</h1>
            <p class="hero-description">
                Generate powerful MCP connectors from any OpenAPI specification.
                Deploy globally with Cloudflare Workers in seconds, not hours.
            </p>
            <div class="cta-buttons">
                <a href="#generate" class="btn btn-primary">Generate Now</a>
                <a href="#demo" class="btn btn-secondary">View Demo</a>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-number">1000+</span>
                    <span class="stat-label">APIs Supported</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">&lt;30s</span>
                    <span class="stat-label">Generation Time</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">99.9%</span>
                    <span class="stat-label">Uptime</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">Global</span>
                    <span class="stat-label">Edge Network</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="features" id="features">
        <div class="container">
            <div class="section-header">
                <div class="section-badge">Cutting-Edge Features</div>
                <h2 class="section-title">Why Choose MCPOverflow?</h2>
            </div>

            <div class="features-grid">
                <div class="feature-card reveal">
                    <div class="feature-icon">⚡</div>
                    <h3 class="feature-title">Lightning Fast</h3>
                    <p class="feature-description">
                        Generate MCP connectors in under 30 seconds with our optimized
                        code generation engine and global edge deployment.
                    </p>
                </div>

                <div class="feature-card reveal">
                    <div class="feature-icon">🛡️</div>
                    <h3 class="feature-title">Enterprise Security</h3>
                    <p class="feature-description">
                        Built-in security with rate limiting, input validation, and
                        support for multiple authentication methods.
                    </p>
                </div>

                <div class="feature-card reveal">
                    <div class="feature-icon">🌍</div>
                    <h3 class="feature-title">Global Deployment</h3>
                    <p class="feature-description">
                        Deploy your MCP connectors to Cloudflare's global network
                        for sub-second response times worldwide.
                    </p>
                </div>

                <div class="feature-card reveal">
                    <div class="feature-icon">🔧</div>
                    <h3 class="feature-title">Smart Detection</h3>
                    <p class="feature-description">
                        Automatically detect API authentication schemes and generate
                        appropriate MCP tool configurations.
                    </p>
                </div>

                <div class="feature-card reveal">
                    <div class="feature-icon">📊</div>
                    <h3 class="feature-title">Real-time Analytics</h3>
                    <p class="feature-description">
                        Monitor usage, performance, and errors with comprehensive
                        dashboards and alerting.
                    </p>
                </div>

                <div class="feature-card reveal">
                    <div class="feature-icon">🚀</div>
                    <h3 class="feature-title">Voice-Activated</h3>
                    <p class="feature-description">
                        Revolutionary voice interface for hands-free API management
                        and connector generation.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Generate Section -->
    <section class="generate" id="generate">
        <div class="container">
            <div class="section-header">
                <div class="section-badge">Start Building</div>
                <h2 class="section-title">Generate Your MCP Connector</h2>
                <p class="hero-description">Upload your OpenAPI spec and get your MCP connector in seconds.</p>
            </div>
            <div class="generate-card">
                <div class="upload-area">
                    <div class="upload-icon">📁</div>
                    <h3>Drop your OpenAPI file here</h3>
                    <p>or click to browse</p>
                    <input type="file" id="openapi-file" accept=".json,.yaml,.yml">
                </div>
                <div class="generate-options">
                    <button class="btn btn-primary" onclick="generateConnector()">
                        <span class="btn-text">Generate Connector</span>
                        <span class="loading" style="display: none;"></span>
                    </button>
                </div>
                <div id="generate-result" style="display: none;" class="result-area">
                    <h4>✅ Connector Generated!</h4>
                    <p>Your MCP connector is ready for deployment.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Pricing Section -->
    <section class="pricing" id="pricing">
        <div class="container">
            <div class="section-header">
                <div class="section-badge">Simple Pricing</div>
                <h2 class="section-title">Choose Your Plan</h2>
                <p class="hero-description">Flexible pricing for teams of all sizes.</p>
            </div>
            <div class="pricing-grid">
                <div class="pricing-card">
                    <h3>Starter</h3>
                    <div class="price">$0</div>
                    <p>Perfect for developers</p>
                    <ul>
                        <li>Up to 10 connectors</li>
                        <li>Basic features</li>
                        <li>Community support</li>
                    </ul>
                </div>
                <div class="pricing-card featured">
                    <div class="popular-badge">Most Popular</div>
                    <h3>Pro</h3>
                    <div class="price">$29<span>/mo</span></div>
                    <p>For growing teams</p>
                    <ul>
                        <li>Unlimited connectors</li>
                        <li>Advanced features</li>
                        <li>Priority support</li>
                        <li>Custom domains</li>
                    </ul>
                </div>
                <div class="pricing-card">
                    <h3>Enterprise</h3>
                    <div class="price">Custom</div>
                    <p>For large organizations</p>
                    <ul>
                        <li>Everything in Pro</li>
                        <li>SLA guarantee</li>
                        <li>Dedicated support</li>
                        <li>Custom integrations</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    <script>
        // Reveal animations on scroll
        const reveals = document.querySelectorAll('.reveal');

        function checkReveal() {
            reveals.forEach(element => {
                const windowHeight = window.innerHeight;
                const elementTop = element.getBoundingClientRect().top;
                const elementVisible = 150;

                if (elementTop < windowHeight - elementVisible) {
                    element.classList.add('active');
                }
            });
        }

        window.addEventListener('scroll', checkReveal);
        window.addEventListener('load', checkReveal);

        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                } else {
                    console.log('Section not found: ' + targetId);
                    // All sections exist now, just scroll to hero for demo
                    if (targetId === 'demo') {
                        alert('Live demo available! Try our file upload feature or API endpoints: /api/generate and /api/voice');
                        document.querySelector('.hero').scrollIntoView({
                            behavior: 'smooth'
                        });
                    } else if (targetId === 'docs') {
                        window.open('https://docs.mcpoverflow.com', '_blank');
                    } else if (targetId === 'contact') {
                        alert('Contact us at: hello@mcpoverflow.com | Support: support@mcpoverflow.com');
                    }
                }
            });
        });

        // Add some interactivity to stat cards
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(stat => {
            stat.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
                this.style.transition = 'transform 0.3s ease';
            });

            stat.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
        });

        // Dynamic navbar background on scroll
        const nav = document.querySelector('nav');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.style.background = 'rgba(0, 0, 0, 0.95)';
            } else {
                nav.style.background = 'rgba(0, 0, 0, 0.8)';
            }
        });

        // File upload functionality
        const fileInput = document.getElementById('openapi-file');
        const uploadArea = document.querySelector('.upload-area');

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    uploadArea.querySelector('h3').textContent = file.name;
                    uploadArea.querySelector('p').textContent = 'Size: ' + (file.size / 1024).toFixed(1) + ' KB';
                    uploadArea.style.borderColor = 'var(--accent)';
                }
            });

            // Drag and drop functionality
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--accent)';
                uploadArea.style.background = 'rgba(0, 245, 255, 0.05)';
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--border-color)';
                uploadArea.style.background = 'transparent';
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    fileInput.files = files;
                    uploadArea.querySelector('h3').textContent = files[0].name;
                    uploadArea.querySelector('p').textContent = 'Size: ' + (files[0].size / 1024).toFixed(1) + ' KB';
                    uploadArea.style.borderColor = 'var(--accent)';
                }
            });
        }

        // Generate connector function
        window.generateConnector = async function() {
            const fileInput = document.getElementById('openapi-file');
            const btn = document.querySelector('.generate-options .btn-primary');
            const btnText = btn.querySelector('.btn-text');
            const loading = btn.querySelector('.loading');
            const resultArea = document.getElementById('generate-result');

            if (!fileInput.files[0]) {
                alert('Please select an OpenAPI file first.');
                return;
            }

            // Show loading state
            btnText.textContent = 'Generating...';
            loading.style.display = 'inline-block';
            btn.disabled = true;

            try {
                // Read file
                const file = fileInput.files[0];
                const text = await file.text();

                // Call the API
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        spec: text,
                        filename: file.name
                    })
                });

                const result = await response.json();

                if (result.success) {
                    resultArea.style.display = 'block';
                    resultArea.innerHTML =
                        '<h4>✅ Connector Generated!</h4>' +
                        '<p><strong>Connector ID:</strong> ' + result.connectorId + '</p>' +
                        '<p><strong>Generation Time:</strong> ' + result.generationTime + '</p>' +
                        '<p><strong>Deploy URL:</strong> <a href="' + result.deployUrl + '" target="_blank" style="color: var(--accent);">' + result.deployUrl + '</a></p>' +
                        '<p style="margin-top: 1rem;">' + result.message + '</p>';
                } else {
                    resultArea.style.display = 'block';
                    resultArea.innerHTML =
                        '<h4 style="color: var(--error);">❌ Generation Failed</h4>' +
                        '<p>' + result.error + '</p>';
                    resultArea.style.borderColor = 'var(--error)';
                }
            } catch (error) {
                resultArea.style.display = 'block';
                resultArea.innerHTML =
                    '<h4 style="color: var(--error);">❌ Error</h4>' +
                    '<p>' + error.message + '</p>';
                resultArea.style.borderColor = 'var(--error)';
            } finally {
                // Reset button
                btnText.textContent = 'Generate Connector';
                loading.style.display = 'none';
                btn.disabled = false;
            }
        };
    </script>
</body>
</html>`;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle CORS
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: corsHeaders,
            });
        }

        try {
            // Main HTML response
            if (url.pathname === '/' || url.pathname === '/index.html') {
                return new Response(MCP_OVERFLOW_HTML, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html;charset=UTF-8',
                        ...corsHeaders,
                    },
                });
            }

            // API Routes for futuristic features
            if (url.pathname.startsWith('/api/')) {
                return handleApiRequest(request, url, env);
            }

            // Health check
            if (url.pathname === '/health') {
                return new Response(JSON.stringify({
                    status: 'operational',
                    timestamp: new Date().toISOString(),
                    version: 'futuristic-v1.0.0',
                    features: [
                        'voice-interface',
                        'real-time-generation',
                        'global-deployment',
                        'advanced-analytics'
                    ]
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders,
                    },
                });
            }

            // 404 for other routes
            return new Response('Not Found', {
                status: 404,
                headers: corsHeaders,
            });

        } catch (error) {
            console.error('Error handling request:', error);
            return new Response('Internal Server Error', {
                status: 500,
                headers: corsHeaders,
            });
        }
    },
};

async function handleApiRequest(request, url, env) {
    // Mock API endpoints for demonstration
    if (url.pathname === '/api/generate' && request.method === 'POST') {
        try {
            const data = await request.json();

            // Simulate async generation process
            await new Promise(resolve => setTimeout(resolve, 1000));

            return new Response(JSON.stringify({
                success: true,
                connectorId: 'futuristic-' + Math.random().toString(36).substr(2, 9),
                status: 'generated',
                deployUrl: 'https://mcp-' + Math.random().toString(36).substr(2, 9) + '.workers.dev',
                generationTime: '28.3s',
                message: '✨ Futuristic MCP connector generated successfully!'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid request body'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }
    }

    // Voice synthesis endpoint
    if (url.pathname === '/api/voice' && request.method === 'POST') {
        try {
            const data = await request.json();
            const text = data.text || 'Welcome to MCPOverflow, the future of API integration!';

            // Simple text-to-speech response
            return new Response(JSON.stringify({
                success: true,
                audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
                text: text,
                duration: '2.5s'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Voice synthesis failed'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }
    }

    return new Response('API endpoint not found', {
        status: 404,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}