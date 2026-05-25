/**
 * Pricing Page - Pricing Cards HTML
 */

export const pricingCardsHTML = `
        <!-- Pricing Cards -->
        <div class="pricing-grid">
            <!-- Free Plan -->
            <div class="pricing-card">
                <h3 class="plan-name">Free</h3>
                <p class="plan-description">Perfect for side projects and testing</p>

                <div class="price">
                    <span class="price-currency">$</span>0
                </div>
                <p class="price-period">Forever free</p>
                <p class="price-annual">&nbsp;</p>

                <button class="cta-button secondary" onclick="selectPlan('free')">
                    Get Started Free
                </button>

                <ul class="features-list">
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Up to <strong>5,000 MAUs</strong></span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Email/password authentication</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">2 social providers (Google, GitHub)</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Basic dashboard</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Community support</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text muted">No credit card required</span>
                    </li>
                </ul>
            </div>

            <!-- Pro Plan (Popular) -->
            <div class="pricing-card popular">
                <div class="popular-badge">Most Popular</div>
                <h3 class="plan-name">Pro</h3>
                <p class="plan-description">For growing startups and products</p>

                <div class="price">
                    <span class="price-currency">$</span><span id="pro-price">49</span>
                </div>
                <p class="price-period">/month</p>
                <p class="price-annual" id="pro-annual">Billed monthly</p>

                <button
                    class="cta-button"
                    onclick="selectPlan('pro')"
                    data-lemonsqueezy-product-id="pro-monthly"
                >
                    Start 14-Day Free Trial
                </button>

                <ul class="features-list">
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Up to <strong>50,000 MAUs</strong></span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">All social providers (10+)</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Advanced authentication (MFA, SSO)</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Custom branding</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Analytics & insights</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">API key management</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Priority email support</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">99.9% uptime SLA</span>
                    </li>
                </ul>
            </div>

            <!-- Enterprise Plan -->
            <div class="pricing-card">
                <h3 class="plan-name">Enterprise</h3>
                <p class="plan-description">For large-scale production workloads</p>

                <div class="price">
                    <span class="price-currency">$</span><span id="enterprise-price">199</span>
                </div>
                <p class="price-period">/month</p>
                <p class="price-annual" id="enterprise-annual">Billed monthly</p>

                <button
                    class="cta-button"
                    onclick="selectPlan('enterprise')"
                    data-lemonsqueezy-product-id="enterprise-monthly"
                >
                    Contact Sales
                </button>

                <ul class="features-list">
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text"><strong>Unlimited MAUs</strong></span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Everything in Pro</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">SAML SSO</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Advanced security (IP whitelisting, audit logs)</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Dedicated account manager</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">Custom SLA (99.99%+)</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">On-premise deployment option</span>
                    </li>
                    <li>
                        <span class="check-icon">&#10003;</span>
                        <span class="feature-text">24/7 phone support</span>
                    </li>
                </ul>
            </div>
        </div>`;
