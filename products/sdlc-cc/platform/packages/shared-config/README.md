# @shared/config

Shared configuration for all Enterprise AI Stack products.

## Features

- LemonSqueezy product definitions with prefixes
- Bundle configurations
- Pricing tiers
- Feature flags

## LemonSqueezy Store Configuration

**Store ID:** 214097  
**Product Name Format:** `[PREFIX]_ProductName_PlanName`

### Product Prefixes

| Product | Prefix | Example |
|---------|--------|---------|
| SDLC | `SDLC` | `SDLC_Enterprise` |
| MCPOverflow | `MCP` | `MCP_Pro` |
| QueryFlux | `QF` | `QF_Professional` |
| PipeWarden | `PW` | `PW_Team` |
| FinTech | `FT` | `FT_Enterprise` |
| Qestro | `QS` | `QS_Pro` |
| Bundles | `BUNDLE` | `BUNDLE_Enterprise` |

## Usage

```typescript
import { PRODUCTS, BUNDLES, LEMONSQUEEZY_CONFIG } from '@shared/config';

// Get SDLC product configuration
const sdlc = PRODUCTS.sdlc;
console.log(sdlc.plans.enterprise.name); // "SDLC_Enterprise"

// Get Enterprise Bundle
const bundle = BUNDLES.enterprise;
console.log(bundle.includedProducts); // ['sdlc', 'mcpoverflow', ...]

// Get all LemonSqueezy product names
import { getAllLemonSqueezyProductNames } from '@shared/config';
const allProducts = getAllLemonSqueezyProductNames();
```

## Creating Products in LemonSqueezy

When creating products in your LemonSqueezy store, use these exact names:

### SDLC Products
- `SDLC_Starter` - $99/month
- `SDLC_Professional` - $499/month
- `SDLC_Enterprise` - $2,499/month

### MCPOverflow Products
- `MCP_Free` - $0/month
- `MCP_Pro` - $49/month
- `MCP_Team` - $199/month

### QueryFlux Products
- `QF_Starter` - $29/month
- `QF_Professional` - $99/month
- `QF_Enterprise` - $299/month

### PipeWarden Products
- `PW_Free` - $0/month
- `PW_Pro` - $29/month
- `PW_Team` - $99/month

### FinTech Products
- `FT_Starter` - $99/month
- `FT_Professional` - $299/month
- `FT_Enterprise` - $999/month

### Qestro Products
- `QS_Free` - $0/month
- `QS_Pro` - $49/month
- `QS_Team` - $149/month

### Bundle Products
- `BUNDLE_Professional` - $399/month (includes QF, PW, QS)
- `BUNDLE_Enterprise` - $999/month (includes all 6 products)

## Environment Variables

```bash
LEMONSQUEEZY_API_KEY=your_api_key
LEMONSQUEEZY_SIGNING_SECRET=your_signing_secret
```

These are already configured in your `.zshrc` file.
