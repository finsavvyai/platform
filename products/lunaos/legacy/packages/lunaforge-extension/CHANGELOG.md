# Change Log

## [2.5.1] - 2025-12-20

### Added
- **Dream Mode (Preview)**: The AI is now awake. `Dream: Start Session` command allows you to schedule asynchronous AI tasks directly from VS Code.
- **Backend Integration**: Extension now connects to `lunaforge-worker` for Dream job processing.
- **Interactive UI**: Dream sessions feature real-time status updates and progress notifications.
- **Client SDK**: `lunaforge-dream` package integrated for robust communication with the AI cloud.

## [2.5.0] - 2025-12-19

### Added
- **Official Website**: Launched `lunaforge.io` (Landing, Pricing, Billing).
- **URL Standardization**: Fixed all "Upgrade" and "Billing" links to point to the correct `lunaforge.io` pages, replacing broken `lunaos.ai` references.

## [2.4.9] - 2025-12-19

### Added
- **Unleashed Modes**: `activateMode` now lets you switch between Galaxy, Guardian, TimeTravel, and Zen modes.
- **Galaxy Connect**: Activating Galaxy now streams live project data to a new "Galaxy Snapshot" panel in the Control Center.
- **Guardian Dashboard**: Added a "Guardian Alerts" panel to monitor real-time architectural violations.

## [2.4.8] - 2025-12-19

### Added
- **Visible Reports**: `Analyze File` now generates and opens a Markdown report with file statistics and complexity.
- **Immediate Analysis**: `Analyze Selection` provides instant statistics and an option for a detailed report.
- **Visible Planning**: `Request Analysis Plan` now generates a visible plan document in the editor.

## [2.4.7] - 2025-12-19

### Added
- **Interactive Tour**: Added "Deep File Analysis" and "AI Analysis Plan" steps with direct action buttons.
- **Power User Tour**: New tour for advanced features like Zen Mode and Smart Refactoring.
- **Editor Context Menu**: Added `Analyze File`, `Analyze Selection`, and `Request Plan` to the editor context menu for easier access.

## [2.4.6] - 2025-12-19

### Fixed
- **Build Graph Visibility**: Fixed regression where graph build success actions were not showing.
- **Dependency Updates**: Force rebuild of core command assets.

## [2.4.5] - 2025-12-19

### Fixed
- **Documentation Mismatch**: Fixed outdated version badge in README that caused confusion.
- **Activity Bar Icon**: Included missing SVG assets in VSIX package (v2.4.2).
- **Critical Production Fixes** (v2.4.4):
  - Fixed broken `Upgrade` link pointing to correct pricing page.
  - Added timeout to license check to prevent UI hanging.
  - Improved `Build Graph` visibility with progress notifications.
  - Added missing `Refresh`, `Metrics`, and `Check License` commands to sidebar.
  - Enabled interactive onboarding tour for production users.

## [2.4.0] - 2025-12-19

### Added
- **LunaForge Aura** (Core): Repository health metrics and analysis
  - Language distribution, file count, and total size
  - Complexity score (0-100) based on nesting depth and file sizes
  - Bus factor analysis placeholder for Git blame integration
  - Dependency health: Circular dependency detection and orphan file flagging
- **LunaForge Zen** (Premium): AI-powered focus mode
  - Session tracking for focused development
  - AI-generated work summaries and "Next Best Step" recommendations
  - Worker integration via `/v1/zen` endpoint
- **Backend Worker Infrastructure**: Implemented `lunaforge-agent-brain-worker` with Cloudflare Workers
  - Universal LLM integration with multi-provider fallback (Anthropic → OpenAI → Zai)
  - Premium analysis endpoints: `/v1/dream`, `/v1/autopsy`, `/v1/prophecy`, `/v1/parallel-universe`, `/v1/zen`
  - Core services: `/v1/memory/get`, `/v1/memory/put`, `/v1/license/validate`
  - Structured JSON responses for all AI-powered features
- **Git Integration**: TimeTravel mode now connects to real Git history
  - Implemented `GitService` for local repository interaction
  - Real-time commit history and file history tracking
  - Refactored TimeTravel to use injectable `GitProvider` interface
- **EnhancedMode Architecture**: Upgraded core modes to new lifecycle pattern
  - Galaxy, Guardian, TimeTravel, Aura, and Zen now use `EnhancedMode` interface
  - Reactive `onGraphUpdate` hooks for real-time analysis
  - Better integration with VS Code configuration system
- **Pre-Deployment Validation**: Comprehensive `pre-deploy.sh` script
  - 11 validation steps including VSIX integrity checks
  - Automated package metadata verification

### Changed
- **Core Modes Polish**: Improved stability and reactivity of local features
  - Galaxy: Real-time dependency visualization updates
  - Guardian: VS Code configuration integration for custom rules
  - TimeTravel: Full Git history integration with async operations
- **Premium Mode Gating**: Enhanced early access feature flag system
  - Premium modes (Dream, Mythic, Autopsy, Prophecy, Parallel Universe, Zen) properly gated
  - Clear messaging when premium features require backend connection
- **Test Coverage**: 63 passing tests across commands, modes, and E2E workflows

### Fixed
- Resolved TypeScript compilation issues across all packages
- Fixed mode activation lifecycle and event emission patterns
- Improved error handling in LLM provider chain
- Fixed macOS path length issues in VS Code test runner

## [2.3.0] - 2025-12-08

### Changed
- **Branding Reversion**: Reverted branding from "Qestro" back to "LunaForge" across the extension.
  - Updated all command IDs to use `lunaforge` prefix.
  - Updated configuration settings to use `lunaforge` namespace.
  - Updated payment plan IDs and product metadata.
  - Updated all user-facing strings and documentation.

## [2.2.3] - 2025-12-04

### Fixed
- **Branding Consistency**: Additional improvements to ensure all references use "Qestro"
  - Updated command manager header comments
  - Changed default graph export filename from `lunaforge-graph` to `qestro-graph`
  - Updated warning message for Control Center initialization
  - Updated welcome message to consistently use "Qestro" branding

## [2.2.2] - 2025-12-04

### Fixed
- **Branding Consistency**: Updated all user-facing strings and comments from "LunaForge" to "Qestro"
  - Updated command manager header comments
  - Changed default graph export filename from `lunaforge-graph` to `qestro-graph`
  - Updated warning messages to reference Qestro instead of LunaForge
  - Updated welcome message branding
- **Configuration Namespace**: Fixed settings command to use correct 'qestro' namespace
  - Fixed `openSettings` command to open Qestro settings (not lunaforge)
  - Fixed configuration change listener to track 'qestro' namespace
- **Payment System**: Updated all payment plan IDs from `lunaforge-*` to `qestro-*`
- **Product Metadata**: Updated product identifier from 'lunaforge' to 'qestro' in payment metadata
- **Session IDs**: Updated payment session ID generation to use 'qestro' prefix


## [2.2.1] - 2025-01-XX

### Fixed
- **Command System**: Fixed all Qestro commands not working
  - Commands now initialize immediately on extension activation instead of waiting for Control Center
  - Removed duplicate command registrations that caused conflicts
  - Fixed recursive call issue in `openControlCenter` command
  - Removed problematic `setContext` command registration
  - Enhanced condition evaluation for command availability
  - Improved notification action handlers for all command types
  - Commands now gracefully handle cases where core is not yet initialized

### Changed
- Command Manager now initializes early in the activation process
- All commands are available immediately, even before core initialization
- Better error messages when commands require core but it's not available

## [2.2.0] - 2025-11-29

### Added
- **Interactive Onboarding Tour**: A step-by-step guide to help new users navigate the Control Center and understand key features.
- **Onboarding Checklist**: A gamified checklist to track your progress and ensure you get the most out of Qestro.
- **Sample Project**: A built-in sample workspace to demonstrate Qestro's capabilities without needing your own code.
- **Contextual Tooltips**: Helpful tooltips added throughout the Control Center to explain metrics and features.

### Changed
- Improved welcome experience with direct access to the tour and sample project.
- Enhanced Control Center UI with better help integration.

## [2.1.0] - 2025-11-27

### Added
- Commercial license support.
- Marketplace readiness improvements.

### Fixed
- TypeScript compilation errors.
- Test suite configuration and execution.
