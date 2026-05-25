const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for(
  "__cloudflare-request-context__",
);

export type CloudflareRequestContext = {
  env: CloudflareEnv;
  cf?: IncomingRequestCfProperties;
  ctx?: ExecutionContext;
};

// `@cloudflare/next-on-pages` stores the request context on a global symbol.
// Accessing it directly avoids bundling the package's Node-only runtime checks
// into edge route code.
export const getOptionalCloudflareRequestContext = () => {
  const globalWithContext = globalThis as typeof globalThis & {
    [CLOUDFLARE_REQUEST_CONTEXT_SYMBOL]?: CloudflareRequestContext;
  };

  return globalWithContext[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
};
