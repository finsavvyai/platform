---
name: ll-native
displayName: Luna Native
description: Generate native mobile (iOS/Android) or desktop (macOS/Windows/Linux) apps from web code or description
version: 1.0.0
category: creation
agent: luna-design-architect
parameters:
  - name: source
    type: string
    description: Web app path, URL, or plain English description
    required: true
    prompt: true
  - name: platform
    type: string
    description: "Platform: ios, android, macos, windows, linux, all"
    required: true
    prompt: true
  - name: framework
    type: string
    description: "Framework: react-native (default), expo, flutter, swift-ui, kotlin-compose, electron, tauri"
    required: false
    default: react-native
mcp_servers:
  - zai-mcp-server
  - playwright
  - fetch
  - sequential-thinking
  - ruflo
  - memory
---

# /native — Web to Native in One Command

Transform your web app into a native mobile or desktop experience. Or describe what you want and Luna builds it from scratch.

## From Web to Native

```
/native ./my-next-app --platform ios --framework expo
              │
              ▼
      ANALYZE web app
      ├── Routes → Screens
      ├── Components → Native equivalents
      ├── State management → preserved
      ├── API calls → shared service layer
      ├── Auth flow → native auth (FaceID, biometrics)
      └── Design → platform-native UI patterns
              │
              ▼
      TRANSFORM
      ├── React components → React Native components
      ├── CSS/Tailwind → StyleSheet / NativeWind
      ├── Next.js router → React Navigation
      ├── Web storage → AsyncStorage / SecureStore
      ├── Web push → Push notifications (APNs/FCM)
      └── Web camera/GPS → native APIs
              │
              ▼
      ENHANCE for native
      ├── Haptic feedback on interactions
      ├── Native gestures (swipe, long press, pinch)
      ├── Offline mode with local cache
      ├── App icon and splash screen
      ├── Deep linking configuration
      └── Platform-specific UX (iOS vs Android)
```

## Desktop Apps

```bash
/native ./web-app --platform macos --framework tauri     # Lightweight native wrapper
/native ./web-app --platform all --framework electron     # Cross-platform desktop
/native "A Notion-like editor for local markdown files" --platform macos --framework swift-ui
```

## Mobile Apps

```bash
/native ./dashboard --platform ios --framework expo       # iOS from web dashboard
/native ./dashboard --platform android                    # Android
/native "Fitness tracker with Apple Watch" --platform ios --framework swift-ui
/native "Delivery driver app with GPS tracking" --platform all --framework flutter
```

## In Pipes

```bash
/pipe native ./web-app ios >> hig >> test >> launch "App Store"
/pipe clone https://app.com >> native ios >> brand >> test >> ship
/pipe idea "my app" >> api >> go *5 >> native all >> test >> launch
```
