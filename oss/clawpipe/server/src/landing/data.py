"""Static data for landing page: features, testimonials, pricing."""

FEATURES = [
    {
        "id": "smart-analysis",
        "title": "Smart Financial Analysis",
        "description": "AI-powered analysis of your portfolio with actionable insights",
        "icon": "chart-line",
    },
    {
        "id": "real-time-alerts",
        "title": "Real-Time Market Alerts",
        "description": "Get instant notifications on market movements and opportunities",
        "icon": "bell",
    },
    {
        "id": "portfolio-tracking",
        "title": "Portfolio Tracking",
        "description": "Monitor all your investments in one unified dashboard",
        "icon": "briefcase",
    },
    {
        "id": "risk-assessment",
        "title": "Risk Assessment",
        "description": "Understand and manage your investment risk exposure",
        "icon": "shield",
    },
    {
        "id": "tax-optimization",
        "title": "Tax Optimization",
        "description": "Strategies to minimize taxes on investment gains",
        "icon": "percent",
    },
    {
        "id": "expert-guidance",
        "title": "Expert Guidance",
        "description": "Access insights from AI-powered financial experts",
        "icon": "user-tie",
    },
]

TESTIMONIALS = [
    {
        "id": "testimonial_1",
        "author": "Sarah Chen",
        "title": "Investment Manager",
        "text": "FinSavvyAI has transformed how I manage portfolios. The insights are invaluable.",
        "rating": 5,
    },
    {
        "id": "testimonial_2",
        "author": "James Wilson",
        "title": "Retail Investor",
        "text": "Finally, an AI tool that actually understands financial markets. Highly recommend!",
        "rating": 5,
    },
    {
        "id": "testimonial_3",
        "author": "Maria Rodriguez",
        "title": "Financial Advisor",
        "text": "My clients love the clarity and actionable advice. Best investment I've made.",
        "rating": 5,
    },
]

PRICING_TIERS = [
    {
        "id": "free",
        "name": "Free",
        "price": "0",
        "currency": "USD",
        "billing_period": "month",
        "description": "Perfect for getting started",
        "features": [
            "5 financial analyses per month",
            "Basic portfolio tracking",
            "Email support",
        ],
        "call_to_action": "Get Started Free",
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": "99.99",
        "currency": "USD",
        "billing_period": "month",
        "description": "For serious investors",
        "features": [
            "Unlimited financial analyses",
            "Advanced portfolio optimization",
            "Real-time market alerts",
            "Priority email support",
            "API access",
        ],
        "call_to_action": "Start Free Trial",
        "highlighted": True,
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price": "299.99",
        "currency": "USD",
        "billing_period": "month",
        "description": "For institutions",
        "features": [
            "Everything in Pro",
            "Custom integrations",
            "Dedicated account manager",
            "24/7 phone support",
            "Custom AI models",
            "SLA guarantee",
        ],
        "call_to_action": "Contact Sales",
    },
]
