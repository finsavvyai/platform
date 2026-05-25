# 🚀 SEO Automation Scripts

Automated scripts to handle all SEO and traffic generation tasks for SDLC.ai.

## 📋 Quick Start

### Option 1: Run Everything (Recommended)
```bash
cd scripts/seo
./run-all-seo-tasks.sh https://sdlc.cc
```

### Option 2: Run Individual Tasks
```bash
# 1. Generate social media images
node generate-social-images.js

# 2. Set up Google Analytics
./setup-analytics.sh G-XXXXXXXXXX

# 3. Generate social media posts
./post-to-social-media.sh https://sdlc.cc

# 4. Create blog post template
./generate-blog-post.sh

# 5. Submit to search engines
./submit-to-search-engines.sh https://sdlc.cc
```

---

## 📜 Available Scripts

### 1. `run-all-seo-tasks.sh` - Master Automation Script

**What it does**: Interactive menu to run all SEO tasks

**Usage**:
```bash
./run-all-seo-tasks.sh [SITE_URL] [GA_MEASUREMENT_ID]
```

**Example**:
```bash
./run-all-seo-tasks.sh https://sdlc.cc G-ABC123XYZ
```

**Menu Options**:
1. Generate social media images
2. Set up Google Analytics
3. Generate social media posts
4. Create blog post template
5. Submit to search engines
6. Run ALL tasks
7. Quick start (images + posts)
8. Exit

---

### 2. `generate-social-images.js` - Social Media Image Generator

**What it does**: Creates professional social media preview images

**Generates**:
- `og-image.png` (1200x630px) - Facebook/LinkedIn
- `twitter-image.png` (1200x675px) - Twitter
- `investor-og-image.png` (1200x630px) - Investor page

**Requirements**:
```bash
npm install canvas
```

**Usage**:
```bash
node generate-social-images.js
```

**Output**: `/web-app/landing/` directory

**Alternative**: If Canvas installation fails, use Canva.com (script provides instructions)

---

### 3. `setup-analytics.sh` - Google Analytics Setup

**What it does**: Adds Google Analytics tracking code to HTML files

**Usage**:
```bash
./setup-analytics.sh G-XXXXXXXXXX
```

**What it modifies**:
- `/web-app/landing/index.html`
- `/web-app/landing/investors.html`

**Features**:
- Adds GA4 tracking code
- Enables IP anonymization
- Sets cookie flags for security
- Checks if already installed (idempotent)

**Get Measurement ID**:
1. Go to https://analytics.google.com
2. Admin → Create Property
3. Copy Measurement ID (G-XXXXXXXXXX)

---

### 4. `post-to-social-media.sh` - Social Media Content Generator

**What it does**: Generates ready-to-post content for all platforms

**Generates**:
- `linkedin-post.txt` - LinkedIn post with hashtags
- `twitter-post.txt` - Twitter thread (4 tweets)
- `hackernews-post.txt` - HN Show HN post + first comment
- `reddit-machinelearning.txt` - r/MachineLearning post
- `reddit-artificial.txt` - r/artificial post
- `reddit-datascience.txt` - r/datascience post

**Usage**:
```bash
./post-to-social-media.sh https://sdlc.cc
```

**Output**: `../../social-media-posts/` directory

**Includes**:
- Ready-to-copy text
- UTM tracking parameters
- Posting time recommendations
- Expected traffic estimates

---

### 5. `generate-blog-post.sh` - Blog Post Template Generator

**What it does**: Creates SEO-optimized blog post templates

**Templates Available**:
1. How to Use ChatGPT Compliantly in Healthcare (HIPAA Guide)
2. Enterprise AI Security: Complete Compliance Guide
3. GDPR Compliance for AI: What You Need to Know
4. PII Detection and Redaction: Technical Deep Dive
5. Custom topic

**Usage**:
```bash
./generate-blog-post.sh
```

**Interactive prompts**:
- Choose template or enter custom
- Automatically generates SEO-optimized HTML
- Includes schema.org structured data
- Mobile-responsive design

**Output**: `/web-app/landing/blog/` directory

**Features**:
- SEO-optimized meta tags
- Schema.org BlogPosting markup
- Open Graph & Twitter Cards
- Responsive design
- CTA sections

---

### 6. `submit-to-search-engines.sh` - Search Engine Submission

**What it does**: Provides checklist and instructions for search engine submission

**Usage**:
```bash
./submit-to-search-engines.sh https://sdlc.cc
```

**Includes**:
- Google Search Console instructions
- Bing Webmaster Tools instructions
- Yandex Webmaster instructions
- Directory submission list
- Index status checker
- Generates checklist markdown file

**Output**: `../../SEARCH_ENGINE_SUBMISSION_CHECKLIST.md`

---

## 🎯 Recommended Workflow

### Week 1: Setup & Launch

**Day 1** (Today):
```bash
# 1. Generate images
./run-all-seo-tasks.sh
# Choose option 1 (Generate images)

# 2. Set up analytics
./run-all-seo-tasks.sh
# Choose option 2 (Setup analytics)
# Enter your GA Measurement ID

# 3. Generate social posts
./run-all-seo-tasks.sh
# Choose option 3 (Generate social posts)

# 4. Deploy
cd ../../web-app/landing
npx wrangler pages deploy . --project-name=sdlc-landing-page --commit-dirty=true
```

**Day 2**:
```bash
# 5. Submit to search engines
./submit-to-search-engines.sh https://sdlc.cc

# 6. Post on Hacker News (8-10am PST)
# Use content from ../../social-media-posts/hackernews-post.txt
```

**Day 3**:
```bash
# 7. Post on Reddit
# r/MachineLearning - use reddit-machinelearning.txt
```

**Day 4**:
```bash
# 8. Post on LinkedIn & Twitter
# Use linkedin-post.txt and twitter-post.txt
```

**Day 5**:
```bash
# 9. Generate first blog post
./generate-blog-post.sh
# Choose option 1 (HIPAA guide)
# Fill in content (2,000+ words)
```

---

## 📊 Expected Results

### Week 1
- **Traffic**: 1,000-3,000 visitors
- **Sources**: HN (50%), Reddit (30%), Social (20%)
- **Indexed**: Google within 24-48 hours

### Month 1
- **Traffic**: 50-100/month organic
- **Rankings**: 5-10 long-tail keywords
- **Backlinks**: 5-10 quality links

### Month 3
- **Traffic**: 500-1,000/month organic
- **Rankings**: 20+ keywords, Top 10 positions
- **Backlinks**: 25+ quality links
- **Domain Authority**: 20-30

---

## 🔧 Troubleshooting

### Issue: Canvas module not found

**Solution**:
```bash
npm install canvas
```

Or use Canva.com online (script provides instructions)

### Issue: Scripts not executable

**Solution**:
```bash
chmod +x scripts/seo/*.sh
```

### Issue: Google Analytics not tracking

**Check**:
1. Measurement ID is correct (format: G-XXXXXXXXXX)
2. Pages deployed after adding tracking code
3. Ad blockers disabled when testing
4. Wait 24-48 hours for data to appear

### Issue: Social media images not showing

**Check**:
1. Images uploaded to `/web-app/landing/`
2. Named correctly (og-image.png, twitter-image.png)
3. Pages redeployed after adding images
4. Clear social media cache:
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator

---

## 📁 File Structure

```
scripts/seo/
├── README.md                          # This file
├── run-all-seo-tasks.sh              # Master automation script
├── generate-social-images.js         # Image generator
├── setup-analytics.sh                # Analytics installer
├── post-to-social-media.sh           # Social content generator
├── generate-blog-post.sh             # Blog template generator
└── submit-to-search-engines.sh       # Search engine submission

Output directories:
├── ../../web-app/landing/            # Images, blog posts
├── ../../social-media-posts/         # Social media content
└── ../../SEARCH_ENGINE_SUBMISSION_CHECKLIST.md
```

---

## 🎯 Traffic Sources & Expected Results

| Source | Visitors | Effort | Best Time |
|--------|----------|--------|-----------|
| **Hacker News** | 500-2,000 | 1 hour | Tue-Thu, 8-10am PST |
| **Reddit (3 posts)** | 300-1,000 | 1.5 hours | Vary by day |
| **LinkedIn** | 50-100 | 30 min | Tue-Thu, 9am-12pm |
| **Twitter** | 20-50 | 15 min | Tue-Thu, 9am-12pm |
| **Organic Search** | 5-20 (Week 1) | Setup | Ongoing |
| **TOTAL Week 1** | **875-3,170** | **~4 hours** | - |

---

## 📝 Tips for Success

### Social Media Posting
1. **Time it right**: Tuesday-Thursday, 9am-12pm
2. **Respond fast**: Reply to every comment within 1 hour
3. **Be authentic**: Focus on problem-solving, not selling
4. **Track everything**: Use UTM parameters

### Content Marketing
1. **2,000+ words**: Longer content ranks better
2. **Keyword density**: 1-2% for target keywords
3. **Internal links**: Link to 2-3 other pages
4. **External links**: Link to 2-3 authoritative sources

### SEO
1. **Submit sitemap**: Google Search Console day 1
2. **Create content**: 1 blog post per week
3. **Build backlinks**: 5-10 per month
4. **Monitor rankings**: Check weekly

---

## 🚀 Quick Commands

```bash
# Run everything
./run-all-seo-tasks.sh https://sdlc.cc G-ABC123XYZ

# Just images and social posts (quick start)
./run-all-seo-tasks.sh https://sdlc.cc
# Choose option 7

# Deploy after changes
cd ../../web-app/landing
npx wrangler pages deploy . --project-name=sdlc-landing-page --commit-dirty=true

# Test social previews
open https://developers.facebook.com/tools/debug/
open https://cards-dev.twitter.com/validator
```

---

## 📚 Additional Resources

- [SEO_OPTIMIZATION_COMPLETE.md](../../SEO_OPTIMIZATION_COMPLETE.md) - Full SEO documentation
- [SEO_DEPLOYMENT_SUMMARY.md](../../SEO_DEPLOYMENT_SUMMARY.md) - Quick reference
- [IMMEDIATE_SEO_ACTIONS.md](../../IMMEDIATE_SEO_ACTIONS.md) - 7-day action plan

---

## 🆘 Support

Issues or questions?
1. Check troubleshooting section above
2. Review full SEO documentation
3. Test each script individually

---

**Last Updated**: January 10, 2026
**Status**: Production-Ready
**Author**: SDLC.ai Team
