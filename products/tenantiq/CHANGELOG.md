# Changelog

All notable changes to TenantIQ are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Enterprise SAML/OIDC SSO** — per-org identity provider configuration with SAML and OIDC support, just-in-time provisioning, connection testing, and settings UI (`a3a8559`)
- **Copilot Readiness Assessment** — 7-category M365 Copilot readiness scoring with DB persistence, assessment history, recommendations, and HTML report export (`b3fbc39`)
- **Config Snapshot & Drift Detection** — capture M365 configuration state, compare snapshots with diff viewer, set baselines, and alert on configuration drift (`3383547`)
- **Storage Analytics & Quotas** — OneDrive and SharePoint usage scanning per user/site, quota progress bars, optimization recommendations, and unused license detection (`fa7577d`)
- **Admin Panel & Observability** — platform admin dashboard with sync job management, tenant health monitoring, performance metrics, and admin audit logs (`ae2b03d`)
- **LemonSqueezy billing integration** — checkout flow, webhook handling for subscription lifecycle events, subscription status API, and cancellation support (`4e49e01`)
- **Trial gating on Security Overview** — certificates and policies blurred behind paywall for free-tier users (`9592cab`)
- **LemonSqueezy setup guide** — copy-to-clipboard configuration fields for easy setup (`801d0c0`)

### Changed
- **Landing page v2** — dark/light theme support, fixed all navigation links, improved marketing copy (`b7ed4fd`)
- **Landing page font** — switched from Syne/DM Sans to Inter for consistency (`022b199`)
- **Responsive landing page** — sign-in card above fold on laptop screens, mobile scroll fix (`de29279`)
- **UI/UX polish** — removed layout-shift hover scales, added icon backgrounds, smooth nav transitions (`95c19bc`)

### Fixed
- Responsive layout issues on landing page at laptop and mobile breakpoints (`de29279`)
- Font inconsistency across landing page components (`022b199`)

## [0.9.0] - 2026-03-15

### Added
- Standalone marketing landing page for tenantiq.app (`12c1469`, `4cfa589`)
- Launch checklist completion at 65/65 items, readiness score 97/100 (`f2588ae`)
- CORS hardening, audit logging, accessibility improvements, documentation (`02c5c22`)
- KV caching layer, DB indexes, lazy loading, preconnect hints (`aa0b349`)
- CSP headers, accessibility audit, cookie consent banner, onboarding flow (`eed38cd`)
- Sentry error tracking, health checks, performance monitoring (`562a014`)
- Suspended user overlay and admin broadcast notifications (`b739049`)
- Suspend/activate/delete actions on admin user and org tables (`d3f2e1c`)
- Admin pages with real data, super_admin/admin role support (`9655377`)

### Fixed
- Post-launch security review issues, score improved from 55 to 72 (`a4c3497`)
- Premium UX pass: skeletons, keyboard shortcuts, transitions, meta tags (`3ae28dc`)
