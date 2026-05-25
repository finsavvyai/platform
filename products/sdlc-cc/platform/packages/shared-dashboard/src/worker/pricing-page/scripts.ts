/**
 * Pricing Page - Client-Side Scripts
 */

export const pricingScripts = `
        let currentBilling = 'monthly';

        // Pricing data
        const pricing = {
            monthly: {
                pro: { price: 49, annual: 'Billed monthly' },
                enterprise: { price: 199, annual: 'Billed monthly' }
            },
            annual: {
                pro: { price: 39, annual: '$468 billed annually (save $120/year)' },
                enterprise: { price: 159, annual: '$1,908 billed annually (save $480/year)' }
            }
        };

        function toggleBilling(type) {
            currentBilling = type;

            // Update button states
            document.getElementById('monthly-btn').classList.toggle('active', type === 'monthly');
            document.getElementById('annual-btn').classList.toggle('active', type === 'annual');

            // Update prices
            const data = pricing[type];
            document.getElementById('pro-price').textContent = data.pro.price;
            document.getElementById('pro-annual').textContent = data.pro.annual;
            document.getElementById('enterprise-price').textContent = data.enterprise.price;
            document.getElementById('enterprise-annual').textContent = data.enterprise.annual;
        }

        async function selectPlan(plan) {
            // Check if user is logged in
            const token = localStorage.getItem('access_token') || localStorage.getItem('pending_token');

            if (plan === 'free') {
                // Free plan - just redirect to register or dashboard
                if (token) {
                    window.location.href = '/dashboard';
                } else {
                    window.location.href = '/auth/register';
                }
                return;
            }

            if (plan === 'enterprise') {
                // Enterprise - contact sales
                window.location.href = 'mailto:hello@sdlc.cc?subject=Enterprise Plan Inquiry';
                return;
            }

            // Pro plan - initiate LemonSqueezy checkout
            try {
                const planId = currentBilling === 'monthly' ? 'pro-monthly' : 'pro-annual';

                const response = await fetch('/api/v1/billing/checkout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? \\\`Bearer \\\${token}\\\` : ''
                    },
                    body: JSON.stringify({
                        plan: planId,
                        billingCycle: currentBilling
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    // Redirect to LemonSqueezy checkout
                    window.location.href = data.checkoutUrl;
                } else {
                    const error = await response.json();
                    alert(error.message || 'Failed to initiate checkout. Please try again.');
                }
            } catch (error) {
                console.error('Checkout error:', error);
                alert('An error occurred. Please try again or contact support.');
            }
        }

        // Check if user just registered and show welcome message
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('welcome') === 'true') {
            const welcomeMessage = document.createElement('div');
            welcomeMessage.style.cssText = \\\`
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: var(--success);
                color: white;
                padding: 16px 32px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 1000;
                font-weight: 600;
            \\\`;
            welcomeMessage.textContent = 'Account created! Choose a plan to get started.';
            document.body.appendChild(welcomeMessage);

            setTimeout(() => {
                welcomeMessage.style.transition = 'opacity 0.3s';
                welcomeMessage.style.opacity = '0';
                setTimeout(() => welcomeMessage.remove(), 300);
            }, 5000);
        }`;
