---
name: ll-i18n
displayName: Luna Internationalization
description: Set up i18n — extract strings, generate translation keys, configure i18n library, RTL support
version: 1.0.0
category: development
agent: luna-task-executor
parameters:
  - name: locales
    type: string
    description: Comma-separated locale codes (en,he,ar,es,fr,de,ja,zh)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - scan_hardcoded_strings
  - extract_translation_keys
  - configure_i18n_library
  - generate_locale_files
  - add_rtl_support
  - update_components
  - generate_i18n_report
output:
  - .luna/{current-project}/i18n/
  - .luna/{current-project}/i18n-report.md
prerequisites: []
---

# Luna Internationalization

Extract strings and set up complete i18n support.

## What This Command Does

1. **Scan** — finds all hardcoded user-facing strings in components
2. **Extract** — generates translation keys with namespace organization
3. **Configure** — sets up next-intl / react-i18next / vue-i18n
4. **Generate** — creates locale JSON files with English defaults
5. **RTL** — adds right-to-left support for Arabic, Hebrew
6. **Update** — replaces hardcoded strings with `t('key')` calls
7. **Report** — documents all extracted strings and configuration

## Output Structure

```
locales/
  en.json            # English (source)
  he.json            # Hebrew (RTL)
  ar.json            # Arabic (RTL)
  es.json            # Spanish
  fr.json            # French
i18n.config.ts       # Library configuration
middleware.ts        # Locale detection middleware
```

## Usage

```
/i18n en,he,ar              # English + Hebrew + Arabic
/i18n en,es,fr,de,ja        # Multi-language
```

## Features

- Namespace organization (common, auth, dashboard, errors)
- Pluralization rules per locale
- Date/number formatting per locale
- RTL layout switching with `dir="rtl"`
- Language switcher component
- SEO: hreflang tags and locale-prefixed routes
