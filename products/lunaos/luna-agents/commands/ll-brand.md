---
name: ll-brand
displayName: Luna Brand Builder
description: Generate complete brand identity from codebase — colors, logo, vision, and style guide
version: 1.0.0
category: branding
agent: luna-brand
parameters:
  - name: scope
    type: string
    description: Project or feature scope for brand generation
    required: true
    prompt: true
  - name: style
    type: string
    description: Brand style preference (modern, minimal, playful, corporate, bold, elegant)
    required: false
    prompt: true
workflow:
  - analyze_codebase_identity
  - extract_existing_colors_and_styles
  - generate_brand_foundation
  - create_color_system
  - generate_logo_specifications
  - create_typography_system
  - build_visual_identity_guide
  - generate_ai_logo_prompts
  - create_brand_report
output:
  - .luna/{current-project}/brand/
  - .luna/{current-project}/brand/brand-guide.html
  - .luna/{current-project}/brand/brand-report.md
prerequisites: []
---

# Luna Brand Builder

Generate a complete brand identity from your codebase — analyzes your project to create colors, logo specs, typography, vision statement, and a comprehensive visual identity guide.

## What This Command Does

1. **Analyzes your codebase** to extract existing visual identity signals:
   - Tailwind/CSS color tokens, design variables
   - Existing logos, favicons, icons
   - Product name, tagline, description from package.json/README
   - UI patterns, component library usage
   - Target audience from docs and marketing copy
2. **Generates brand foundation**:
   - Mission statement
   - Vision statement
   - Brand values (3-5 core values)
   - Brand voice and tone guidelines
   - Elevator pitch (30-second, 60-second)
   - Tagline options (3-5 variants)
3. **Creates complete color system**:
   - Primary, secondary, accent colors with hex/RGB/HSL
   - Semantic colors (success, warning, error, info)
   - Light and dark mode palettes
   - Contrast-checked accessibility (WCAG AA/AAA)
   - CSS custom properties and Tailwind config
4. **Generates logo specifications**:
   - Logo concept description and rationale
   - Symbol/mark guidelines
   - Wordmark typography
   - Logo variations (full, icon-only, horizontal, vertical)
   - Clear space and minimum size rules
   - Usage on light/dark backgrounds
   - AI generation prompts for DALL-E, Midjourney, and Stable Diffusion
5. **Creates typography system**:
   - Primary font (headings) and secondary font (body)
   - Font scale with rem/px values
   - Line height and letter spacing
   - Font weight usage guidelines
6. **Builds visual identity guide** (standalone HTML):
   - Interactive color swatches with copy-to-clipboard
   - Typography specimens
   - Logo usage examples
   - Spacing and layout grid
   - Component style preview
   - Do's and don'ts section

## Prerequisites

No prerequisites required. This command works on any codebase.

If you have existing Luna docs, they will enrich the analysis:
- `.luna/{current-project}/requirements.md`
- `.luna/{current-project}/design.md`

## Usage Instructions

When you run this command:
- **Scope**: Press ENTER for project-level brand or type product name
- **Style**: Choose a direction or press ENTER for auto-detect:
  - `modern` — clean lines, gradient accents, SF Pro / Inter
  - `minimal` — monochrome-forward, generous whitespace
  - `playful` — rounded shapes, vibrant palette, friendly tone
  - `corporate` — structured, trustworthy, serif + sans-serif
  - `bold` — high contrast, large type, statement colors
  - `elegant` — refined palette, thin weights, luxury feel

## Execution Steps

1. **Codebase Scan**: Reads package.json, README, CSS/Tailwind configs, existing assets
2. **Identity Extraction**: Pulls product name, description, existing colors, fonts, logos
3. **Brand Foundation**: Generates mission, vision, values, voice, taglines
4. **Color System**: Creates harmonious palette from existing colors or generates new one
5. **Logo Specs**: Defines logo concept, variations, clear space, and AI generation prompts
6. **Typography**: Selects font pairing, defines scale, weights, and spacing
7. **HTML Guide**: Builds interactive standalone brand guide page
8. **AI Prompts**: Creates detailed prompts for generating logo with DALL-E/Midjourney/SD
9. **Brand Report**: Summary document with all brand assets and usage guidelines

## Output Files

Creates in your current project:
```
.luna/{current-project}/brand/
  brand-foundation.md          # Mission, vision, values, voice
  color-system.md              # Full color palette with codes
  color-tokens.css             # CSS custom properties
  tailwind-brand.config.ts     # Tailwind color/font config
  logo-specifications.md       # Logo concept, rules, variations
  logo-prompts.md              # AI image generation prompts (DALL-E, MJ, SD)
  typography-system.md         # Font pairing, scale, spacing
  brand-guide.html             # Interactive standalone HTML brand guide
  brand-assets/
    color-palette.svg          # Visual color palette export
  brand-report.md              # Complete brand summary
```

## Next Steps in Workflow

After brand generation:
```bash
/luna-design      # Use brand tokens in technical design
/luna-hig         # Apply Apple HIG with your brand colors
/luna-auth        # Generate auth UI matching your brand
/luna-docs        # Style documentation with brand identity
```

## Tips

- Run early in the project lifecycle to establish visual consistency
- The HTML brand guide is shareable — send it to designers and stakeholders
- AI logo prompts are tuned per platform (DALL-E vs Midjourney have different syntax)
- Color system auto-checks WCAG contrast ratios for accessibility
- Tailwind config output can be dropped directly into your project
- Re-run after major design changes to keep brand guide current
- Works best when package.json has `name`, `description`, and `keywords` fields
