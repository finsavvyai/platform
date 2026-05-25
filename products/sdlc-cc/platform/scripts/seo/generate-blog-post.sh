#!/bin/bash

###############################################################################
# Blog Post Generator
# Creates SEO-optimized blog post templates
###############################################################################

set -e

echo "📝 Blog Post Generator"
echo "====================="
echo ""

# Create blog directory if it doesn't exist
BLOG_DIR="../../web-app/landing/blog"
mkdir -p "$BLOG_DIR"

echo "📁 Blog directory: $BLOG_DIR"
echo ""

# Blog post options
echo "Choose a blog post template:"
echo ""
echo "1. How to Use ChatGPT Compliantly in Healthcare (HIPAA Guide)"
echo "2. Enterprise AI Security: Complete Compliance Guide"
echo "3. GDPR Compliance for AI: What You Need to Know"
echo "4. PII Detection and Redaction: Technical Deep Dive"
echo "5. Custom topic"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
  1)
    SLUG="hipaa-compliant-chatgpt-healthcare-guide"
    TITLE="How to Use ChatGPT Compliantly in Healthcare: Complete HIPAA Guide"
    META_DESC="Learn how to use ChatGPT in healthcare while staying HIPAA compliant. Complete guide with PII redaction, audit trails, and real-world examples."
    KEYWORDS="HIPAA compliant ChatGPT, healthcare AI compliance, ChatGPT healthcare, medical AI compliance"
    ;;
  2)
    SLUG="enterprise-ai-security-compliance-guide"
    TITLE="Enterprise AI Security: The Complete Compliance Guide"
    META_DESC="Comprehensive guide to enterprise AI security and compliance. Learn about HIPAA, GDPR, PCI-DSS requirements and implementation best practices."
    KEYWORDS="enterprise AI security, AI compliance guide, ChatGPT compliance, AI security best practices"
    ;;
  3)
    SLUG="gdpr-compliance-ai-guide"
    TITLE="GDPR Compliance for AI: What You Need to Know in 2026"
    META_DESC="Complete guide to GDPR compliance for AI systems. Learn about data privacy requirements, PII handling, and compliance frameworks."
    KEYWORDS="GDPR AI compliance, AI data privacy, GDPR ChatGPT, EU AI Act compliance"
    ;;
  4)
    SLUG="pii-detection-redaction-technical-guide"
    TITLE="PII Detection and Redaction: Technical Deep Dive"
    META_DESC="Technical guide to building PII detection and redaction systems. Learn about regex patterns, ML approaches, and real-time processing."
    KEYWORDS="PII detection, PII redaction, data privacy, sensitive data detection"
    ;;
  5)
    read -p "Enter blog post slug (URL-friendly): " SLUG
    read -p "Enter title: " TITLE
    read -p "Enter meta description: " META_DESC
    read -p "Enter keywords (comma-separated): " KEYWORDS
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

FILENAME="${BLOG_DIR}/${SLUG}.html"

echo ""
echo "📄 Creating blog post:"
echo "  Slug: $SLUG"
echo "  Title: $TITLE"
echo "  File: $FILENAME"
echo ""

# Generate blog post HTML
cat > "$FILENAME" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Primary Meta Tags -->
    <title>{{TITLE}} | SDLC.ai Blog</title>
    <meta name="title" content="{{TITLE}} | SDLC.ai Blog">
    <meta name="description" content="{{META_DESC}}">
    <meta name="keywords" content="{{KEYWORDS}}">
    <meta name="robots" content="index, follow">
    <meta name="author" content="SDLC.ai">
    <meta name="published_time" content="{{DATE}}">

    <!-- Canonical URL -->
    <link rel="canonical" href="https://sdlc.cc/blog/{{SLUG}}.html">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://sdlc.cc/blog/{{SLUG}}.html">
    <meta property="og:title" content="{{TITLE}}">
    <meta property="og:description" content="{{META_DESC}}">
    <meta property="og:image" content="https://sdlc.cc/og-image.png">

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="https://sdlc.cc/blog/{{SLUG}}.html">
    <meta property="twitter:title" content="{{TITLE}}">
    <meta property="twitter:description" content="{{META_DESC}}">
    <meta property="twitter:image" content="https://sdlc.cc/twitter-image.png">

    <!-- Schema.org structured data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "{{TITLE}}",
      "description": "{{META_DESC}}",
      "author": {
        "@type": "Organization",
        "name": "SDLC.ai"
      },
      "publisher": {
        "@type": "Organization",
        "name": "SDLC.ai",
        "logo": {
          "@type": "ImageObject",
          "url": "https://sdlc.cc/logo.png"
        }
      },
      "datePublished": "{{DATE}}",
      "dateModified": "{{DATE}}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "https://sdlc.cc/blog/{{SLUG}}.html"
      }
    }
    </script>

    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f9fafb;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4rem 2rem;
            text-align: center;
        }

        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            line-height: 1.2;
        }

        .meta {
            color: rgba(255,255,255,0.9);
            font-size: 0.95rem;
        }

        article {
            background: white;
            padding: 3rem 2rem;
            margin-top: -2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        h2 {
            font-size: 1.8rem;
            margin: 2rem 0 1rem;
            color: #1a202c;
        }

        h3 {
            font-size: 1.4rem;
            margin: 1.5rem 0 0.75rem;
            color: #2d3748;
        }

        p {
            margin-bottom: 1rem;
            color: #4a5568;
        }

        ul, ol {
            margin-left: 2rem;
            margin-bottom: 1rem;
        }

        li {
            margin-bottom: 0.5rem;
            color: #4a5568;
        }

        code {
            background: #f7fafc;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        pre {
            background: #2d3748;
            color: #e2e8f0;
            padding: 1.5rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1.5rem 0;
        }

        pre code {
            background: none;
            color: #e2e8f0;
            padding: 0;
        }

        .cta {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            margin: 3rem 0;
        }

        .cta h3 {
            color: white;
            margin-top: 0;
        }

        .cta-button {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 1rem 2rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 1rem;
            transition: transform 0.2s;
        }

        .cta-button:hover {
            transform: translateY(-2px);
        }

        footer {
            text-align: center;
            padding: 2rem;
            color: #718096;
        }

        @media (max-width: 768px) {
            h1 {
                font-size: 2rem;
            }

            h2 {
                font-size: 1.5rem;
            }

            article {
                padding: 2rem 1.5rem;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>{{TITLE}}</h1>
            <div class="meta">
                Published on {{DATE_FORMATTED}} | SDLC.ai Blog
            </div>
        </div>
    </header>

    <div class="container">
        <article>
            <!-- Introduction -->
            <p><strong>TL;DR:</strong> [2-3 sentence summary of the article]</p>

            <h2>Introduction</h2>
            <p>[Write your introduction here. Explain the problem this article solves.]</p>

            <h2>The Problem</h2>
            <p>[Describe the problem in detail. Use statistics and real-world examples.]</p>

            <h3>Why This Matters</h3>
            <ul>
                <li>Point 1</li>
                <li>Point 2</li>
                <li>Point 3</li>
            </ul>

            <h2>The Solution</h2>
            <p>[Explain your solution or approach]</p>

            <h3>Step-by-Step Implementation</h3>

            <h4>Step 1: [First Step]</h4>
            <p>[Detailed explanation]</p>

            <pre><code>// Code example
const example = "Your code here";
</code></pre>

            <h4>Step 2: [Second Step]</h4>
            <p>[Detailed explanation]</p>

            <h3>Best Practices</h3>
            <ol>
                <li>Best practice 1</li>
                <li>Best practice 2</li>
                <li>Best practice 3</li>
            </ol>

            <h2>Real-World Use Cases</h2>
            <p>[Share real-world examples and case studies]</p>

            <h3>Case Study 1: Healthcare</h3>
            <p>[Specific example]</p>

            <h3>Case Study 2: Financial Services</h3>
            <p>[Specific example]</p>

            <h2>Common Pitfalls to Avoid</h2>
            <ul>
                <li><strong>Pitfall 1:</strong> Description and how to avoid</li>
                <li><strong>Pitfall 2:</strong> Description and how to avoid</li>
                <li><strong>Pitfall 3:</strong> Description and how to avoid</li>
            </ul>

            <h2>Conclusion</h2>
            <p>[Summarize key takeaways. Reinforce the value proposition.]</p>

            <div class="cta">
                <h3>Try SDLC.ai Free</h3>
                <p>Enable compliant enterprise AI in 5 minutes. One-line integration for ChatGPT, Claude, and Gemini.</p>
                <a href="https://sdlc.cc" class="cta-button">Get Started Free</a>
            </div>

            <h2>Additional Resources</h2>
            <ul>
                <li><a href="https://sdlc.cc">SDLC.ai Homepage</a></li>
                <li><a href="https://sdlc.cc/docs">Documentation</a></li>
                <li><a href="https://sdlc.cc/blog">More Blog Posts</a></li>
            </ul>
        </article>
    </div>

    <footer>
        <p>&copy; 2026 SDLC.ai. All rights reserved.</p>
        <p><a href="https://sdlc.cc">Homepage</a> | <a href="https://sdlc.cc/blog">Blog</a> | <a href="https://sdlc.cc/docs">Docs</a></p>
    </footer>
</body>
</html>
EOF

# Replace placeholders
sed -i '' "s|{{TITLE}}|${TITLE}|g" "$FILENAME"
sed -i '' "s|{{SLUG}}|${SLUG}|g" "$FILENAME"
sed -i '' "s|{{META_DESC}}|${META_DESC}|g" "$FILENAME"
sed -i '' "s|{{KEYWORDS}}|${KEYWORDS}|g" "$FILENAME"
sed -i '' "s|{{DATE}}|$(date +%Y-%m-%d)|g" "$FILENAME"
sed -i '' "s|{{DATE_FORMATTED}}|$(date +"%B %d, %Y")|g" "$FILENAME"

echo "✅ Blog post template created: $FILENAME"
echo ""
echo "📝 Next steps:"
echo "1. Edit the blog post and fill in content"
echo "2. Add at least 2,000 words for good SEO"
echo "3. Include code examples and screenshots"
echo "4. Add internal links to your landing page"
echo "5. Update sitemap.xml to include this post"
echo "6. Deploy: npm run deploy:landing"
echo ""
echo "💡 SEO Tips:"
echo "  • Target keyword density: 1-2%"
echo "  • Use keyword in first paragraph"
echo "  • Include keyword in H2 headings"
echo "  • Add alt text to images"
echo "  • Internal link to 2-3 other pages"
echo "  • External link to 2-3 authoritative sources"
echo ""
