# CLAUDE.md - LunaOS Mobile

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide a native mobile app for monitoring and triggering AI agent workflows on the go, with real-time execution streaming, push notifications, and biometric authentication.
- Target user: Developers and team leads who need to monitor agent runs, trigger workflows, and review execution history from their phone.
- Primary jobs to be done:
  - View and search AI agents with category filtering
  - Trigger agent execution with parameter input forms
  - Stream real-time execution output via SSE
  - Browse execution history with detail drill-down
  - Manage account settings, theme, and notifications
  - Authenticate with biometrics and secure token storage

## Product-Specific Architecture Constraints

- Runtime(s): React Native 0.76 via Expo SDK 52; EAS Build for iOS/Android distribution
- Core services:
  - `src/screens/` -- screen components (auth, agents, history, settings)
  - `src/components/` -- shared UI components (AgentCard, Button, TextInput, SearchBar, etc.)
  - `src/api/` -- API client with auth token injection and SSE support
  - `src/store/` -- Zustand stores (auth, agents, execution)
  - `src/navigation/` -- React Navigation (bottom tabs + native stack)
  - `src/services/` -- push notifications, analytics
  - `src/theme/` -- design tokens, dark mode
- Data boundaries: All data from engine API; auth tokens in expo-secure-store; no local SQLite
- Integration boundaries: Engine API, Expo push notifications, expo-haptics for feedback

### Expo/React Native Constraints

- All native module access must go through Expo SDK APIs (no bare native modules)
- Navigation must use @react-navigation/native with typed route params
- Animations must use react-native-reanimated (not Animated API)
- Secure storage must use expo-secure-store for tokens (never AsyncStorage)
- All screens must support both light and dark mode via theme tokens
- Touch targets must be minimum 44x44 points (Apple HIG)
- Max 200 lines per screen/component file

## Product-Specific Test Matrix

- Unit tests: Jest with jest-expo preset; files in `src/**/__tests__/`
- Component tests: @testing-library/react-native; custom render wrapper with NavigationContainer
- Store tests: Zustand store unit tests with act() wrapper
- API tests: MSW for HTTP mocking; SSE connection tests
- E2E/smoke tests: Detox or manual test matrix on iOS Simulator + Android Emulator
- Critical path tests (must remain 100% covered):
  - Auth token storage and retrieval (expo-secure-store)
  - Login/signup form validation and submission
  - API client auth header injection
  - Agent execution trigger and result handling
- Coverage thresholds: >=85% line, >=85% branch, >=85% function, >=85% statement

## Product-Specific Security Controls

- AuthN/AuthZ model: JWT tokens from engine API stored in expo-secure-store (hardware-backed keychain on iOS); biometric unlock optional; auto-logout on token expiry
- Secret management: No API keys in app bundle; all secrets fetched at runtime from engine; Expo env vars for non-secret config only
- Input/output validation: Zod validation on all form inputs; input length limits enforced; no eval() or dynamic code execution
- Audit logging requirements: Login/logout events sent to engine audit endpoint; no client-side logging of sensitive data
- Data retention/privacy constraints: No PII cached on device beyond auth token; execution results not persisted locally; clear all data on logout

## Product-Specific Release Checklist

- [ ] CI is green (Jest tests pass)
- [ ] Coverage thresholds met: >=85% across all metrics
- [ ] Security scans have no open Critical/High issues
- [ ] `expo doctor` reports no issues
- [ ] App runs on iOS Simulator and Android Emulator without crashes
- [ ] Dark mode renders correctly on all screens
- [ ] Touch targets >= 44x44 points verified
- [ ] EAS Build succeeds for both platforms
- [ ] TestFlight / Internal Testing track upload succeeds
- [ ] Release notes updated in app store metadata
- [ ] Rollback: previous build retained in EAS for revert

## Commands

```bash
npm start                 # Expo dev server
npm run ios               # Run on iOS Simulator
npm run android           # Run on Android Emulator
npm run test              # Jest tests
npm run lint              # ESLint
npm run typecheck         # TypeScript check
npm run build:ios         # EAS Build for iOS
npm run build:android     # EAS Build for Android
```

## Local Notes

- This file sets coverage at 85% (mobile testing is harder; matches root minimum).
- This file adds Expo-specific constraints (secure-store, reanimated, touch targets).
- This file does not weaken any root policy requirement.
- Mobile app distributed via TestFlight (iOS) and Internal Testing (Android).
