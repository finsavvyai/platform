# TokenForge React Native SDK

Device-bound ECDSA P-256 session security for React Native with hardware-backed key storage.

## Install

```bash
npm install @opensyber/tokenforge-react-native react-native-keychain elliptic @noble/hashes
cd ios && pod install
```

## Quick Start

```tsx
import { TokenForgeProvider, useTokenForge } from "@opensyber/tokenforge-react-native";

function App() {
  return (
    <TokenForgeProvider apiKey="tf_your_api_key">
      <MyScreen />
    </TokenForgeProvider>
  );
}
```

## Hook Usage

```tsx
function MyScreen() {
  const { isBound, deviceId, isHardwareBacked, bind, signRequest, getHeaders } = useTokenForge();

  useEffect(() => {
    bind();
  }, []);

  return (
    <View>
      <Text>Device: {deviceId}</Text>
      <Text>Bound: {isBound ? "Yes" : "No"}</Text>
      <Text>Hardware-backed: {isHardwareBacked ? "Yes" : "No"}</Text>
    </View>
  );
}
```

## Hardware-Backed Key Storage

The SDK automatically uses hardware-backed key storage when native modules are linked:

| Platform | Preferred | Fallback | Software Fallback |
|----------|-----------|----------|-------------------|
| iOS | Secure Enclave (`SecureEnclave.P256`) | CryptoKit + Keychain | `elliptic` + `react-native-keychain` |
| Android | StrongBox (dedicated SE) | TEE (Trusted Execution Environment) | `elliptic` + `react-native-keychain` |

### Requirements

- **Bare React Native** (not Expo Go) for hardware key access
- iOS 13+ for Secure Enclave P-256 support
- Android API 28+ (Pie) for StrongBox; API 23+ for TEE

### How detection works

1. On mount, the SDK calls `getNativeKeyStore()` to check for linked native modules
2. If `TokenForgeSecureEnclave` (iOS) or `TokenForgeKeyStore` (Android) is available, hardware keys are used
3. If native modules are missing, the SDK falls back to the `elliptic` JS library
4. The `isHardwareBacked` flag on the context reflects the active storage tier
5. The `bind()` payload includes `hardwareBacked: true/false` so the server knows the trust level

### Expo compatibility

Expo Go does not support custom native modules. Hardware-backed keys require:
- **Expo Dev Client** with a custom native build, or
- **Bare workflow** via `expo prebuild`

The SDK will automatically fall back to software keys in Expo Go.

## Global Fetch Interceptor

```tsx
import { useTokenForge, createFetchInterceptor } from "@opensyber/tokenforge-react-native";

function AppInit() {
  const { getHeaders } = useTokenForge();

  useEffect(() => {
    createFetchInterceptor(getHeaders);
  }, []);

  return <MainNavigator />;
}
```

Note: `getHeaders()` throws when hardware-backed keys are active because native signing is async. Use `signRequest()` or call `bind()` directly for hardware-backed flows.

## How It Works

1. Detects platform and checks for native key-store module
2. **Hardware path**: generates ECDSA P-256 keypair in Secure Enclave / Android KeyStore
3. **Software path**: generates keypair via `elliptic`, stores in `react-native-keychain`
4. Signs `{sessionId}:{nonce}:{timestamp}` with ECDSA-SHA256
5. Registers public key + `hardwareBacked` flag via `POST /v1/bind`

## API

| Export | Description |
|--------|-------------|
| `<TokenForgeProvider apiKey>` | Context provider |
| `useTokenForge()` | Hook: `{ isBound, isHardwareBacked, deviceId, sessionId, bind, signRequest, getHeaders }` |
| `createFetchInterceptor(getHeaders)` | Monkey-patch global fetch with auto-signing |
