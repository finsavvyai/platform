/**
 * Landing Page - Navigation and hero section HTML
 */

export const landingNavHeroHTML = `
    <nav>
        <div class="container">
            <div class="nav-content">
                <div class="logo">AutoBoot</div>
                <div class="nav-links">
                    <a href="#features" class="nav-link">Features</a>
                    <a href="#architecture" class="nav-link">Architecture</a>
                    <a href="/pricing" class="nav-link">Pricing</a>
                    <a href="/api/v1/docs" class="nav-link">Docs</a>
                    <a href="/auth/login" class="nav-link" style="color: var(--text-secondary);">Sign In</a>
                    <a href="/auth/register" class="btn btn-primary" style="padding: 0.625rem 1.25rem; font-size: 0.875rem;">Get Started</a>
                </div>
            </div>
        </div>
    </nav>

    <div class="container">
        <section class="hero">
            <div class="badge">
                <span class="status-indicator"></span>
                <span>Production Ready</span>
            </div>
            <h1>
                Ship products <span class="gradient">10× faster</span><br>
                with shared infrastructure
            </h1>
            <p class="lead">
                Stop rebuilding auth, billing, and infrastructure for every product. AutoBoot provides battle-tested foundation so you can focus on what makes your product unique.
            </p>
            <div class="cta-buttons">
                <a href="/early-access" class="btn btn-primary">Request Access</a>
                <a href="/api/v1/docs" class="btn btn-secondary">View Documentation</a>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-value">10×</div>
                    <div class="stat-label">Faster Launch</div>
                </div>
                <div class="stat">
                    <div class="stat-value">8</div>
                    <div class="stat-label">Products Deployed</div>
                </div>
                <div class="stat">
                    <div class="stat-value">99.9%</div>
                    <div class="stat-label">Uptime SLA</div>
                </div>
                <div class="stat">
                    <div class="stat-value">300+</div>
                    <div class="stat-label">Edge Locations</div>
                </div>
            </div>
        </section>
`;
