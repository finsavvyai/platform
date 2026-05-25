# Hardened mode — supply-side rug-pull prevention

OpenAPI → MCP generators are a crowded space. The MCP **rug-pull** is what
makes them dangerous: a server quietly mutates a tool's description after a
user has already approved it, and the model now obeys hidden instructions.

OWASP's recommended defense is to treat tool descriptions as **immutable,
cryptographically signed artifacts**. `--hardened` makes MCPOverflow emit
servers that are provably not the source of a rug-pull. It pairs with
[OpenSyber](https://opensyber.com)'s runtime drift watcher: same team, same
buyer, two halves of one story.

| Where the rug-pull happens                                   | What catches it                                           |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| At the **source** (server publisher swaps a tool definition) | `mcpoverflow --hardened` + `mcpoverflow verify`           |
| At **runtime** (live server drifts from its signed manifest) | OpenSyber watcher (`verifyManifestAgainstTools` over MCP) |

## What hardened mode emits

Run:

```bash
mcpoverflow generate ./petstore.json \
  --output ./petstore-mcp \
  --hardened \
  --publisher "Acme Corp"
```

You get:

```
petstore-mcp/
├── tools.json              # single, frozen source of truth for the tool list
├── mcp-manifest.json       # signed manifest (Ed25519)
├── keys/
│   ├── publisher.pub       # SPKI public key (commit this)
│   └── publisher.key       # PKCS8 private key (DO NOT commit — secret mgr)
└── src/
    ├── index.ts            # MCP server; refuses to start on hash drift
    ├── tools.ts            # loads + freezes tools.json, recomputes hash
    └── executors.ts        # every fetch goes through egress allowlist
```

### 1. Signed manifest

`mcp-manifest.json` contains, in canonical JSON, signed with Ed25519:

- publisher identity
- per-tool SHA-256 over `(name + description + inputSchema)`
- aggregate SHA-256 over the full tool list
- declared egress hosts (from OpenAPI `servers`)
- declared OAuth scopes
- the Ed25519 public key
- the signature

The signature covers everything except itself. Any mutation — including a
sneaky whitespace change to a description — invalidates it.

### 2. Frozen tool list

The generated server loads tools **once** from `tools.json`, calls
`Object.freeze` on the list and each tool, and returns the identical object
on every `tools/list` call. At startup it recomputes the aggregate SHA-256
and refuses to start if it doesn't match the manifest.

If the list legitimately needs to change, publishers must:

1. Edit `tools.json` and re-sign the manifest with `mcpoverflow generate ... --hardened`.
2. The server then calls `notifyToolsListChanged()` to emit
   `notifications/tools/list_changed`. Silent swaps are not possible.

### 3. Declared egress

Allowed outbound hosts are derived from the OpenAPI `servers` block at
generation time and pinned into the manifest. The generated `executors.ts`
denies any `fetch` to a host not on the allowlist. Adding a new host
requires re-signing.

### 4. Verifier (shared format with OpenSyber)

```bash
mcpoverflow verify ./petstore-mcp
```

```
✔ Verification passed
  OK  mcp-manifest.json present
  OK  ed25519 signature
  OK  tools.json present
  OK  tool hashes match manifest
```

Tamper with a tool description and the verifier fails with a non-zero exit:

```
✖ Verification FAILED
  FAIL  tool hashes match manifest  aggregate hash drift: sha256:0cbb… → sha256:b5c3…
```

OpenSyber's runtime watcher uses the same `verifyManifestAgainstTools`
contract over a live MCP `tools/list` response, so a server that passes
build-time verification but drifts in production is caught the moment it
serves an unexpected tool.

## Programmatic use

```ts
import { generateMCPServer, verifyHardenedServer, hardened } from '@mcpoverflow/cli'

await generateMCPServer({
  name: 'petstore',
  version: '1.0.0',
  description: '',
  endpoints,
  schemas,
  outputDir: './out',
  transport: 'stdio',
  hardened: true,
  publisher: { name: 'Acme Corp', url: 'https://acme.example' },
  servers: [{ url: 'https://api.example.com' }],
  oauthScopes: ['read:pets'],
})

const report = await verifyHardenedServer('./out')
// report.checks === [{name, ok, detail?}, ...]
```

## Threat model — what hardened mode prevents

| Attack                                                       | Prevented? | How                                                        |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------------------- |
| Publisher silently rewrites a tool description after install | ✅         | Signature breaks; verify fails                             |
| Server returns different tools to different clients          | ✅         | Single frozen object; OpenSyber watcher catches divergence |
| Server starts beaconing to attacker domain                   | ✅         | Egress allowlist denies unknown host                       |
| Compromised dependency mutates `tools` at runtime            | ✅         | List is frozen; mutations throw                            |
| Stolen private key                                           | ❌         | Out of scope — use a secret manager; rotate via re-sign    |
| Malicious OpenAPI spec at generation time                    | ❌         | Out of scope — inspect spec before generating              |
