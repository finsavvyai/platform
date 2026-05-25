/**
 * Pricing Page with LemonSqueezy Integration
 * Assembles HTML from split sections
 */

import { pricingStyles } from './styles';
import { pricingCardsHTML } from './pricing-cards';
import { comparisonSectionHTML } from './comparison-section';
import { faqSectionHTML } from './faq-section';
import { pricingScripts } from './scripts';

export const pricingPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pricing - AutoBoot Framework</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>${pricingStyles}
    </style>
</head>
<body>
    <div class="pricing-container">
        <!-- Header -->
        <div class="header">
            <div class="logo">AutoBoot</div>
            <h1>Choose Your Plan</h1>
            <p class="subtitle">
                Authentication, billing, and customer management for modern SaaS applications.
                <strong>Compete with Clerk at half the price.</strong>
            </p>
        </div>

        <!-- Billing Toggle -->
        <div class="billing-toggle">
            <button id="monthly-btn" class="active" onclick="toggleBilling('monthly')">Monthly</button>
            <button id="annual-btn" onclick="toggleBilling('annual')">
                Annual <span class="save-badge">Save 20%</span>
            </button>
        </div>

${pricingCardsHTML}

${comparisonSectionHTML}

${faqSectionHTML}
    </div>

    <script>
${pricingScripts}
    </script>
</body>
</html>`;
