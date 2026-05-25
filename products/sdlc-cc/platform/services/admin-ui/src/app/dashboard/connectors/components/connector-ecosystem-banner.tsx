/**
 * ConnectorEcosystemBanner — P2-Day48
 *
 * Rendered at the top of the marketplace whenever fewer than 1
 * connector has been promoted from SCAFFOLD to REAL. The honesty
 * here is the point: don't claim the ecosystem is shippable until
 * at least one vendor's OAuth flow is wired end-to-end.
 */

export function ConnectorEcosystemBanner() {
  return (
    <div
      role="status"
      className="mb-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p className="font-semibold mb-1">Connector ecosystem is in scaffold state.</p>
      <p>
        Real OAuth wiring requires per-vendor app registration. Every connector listed
        below is a contract scaffold — Authenticate / ListResources / Fetch / Search /
        Watch return a not-implemented error until a customer&rsquo;s OAuth client is
        registered with the vendor and the gateway callback is wired.
      </p>
      <p className="mt-2 text-xs">
        See <code>packages/connectors-spec/README.md</code> for the SCAFFOLD &rarr; REAL
        promotion checklist and each connector&rsquo;s <code>NOT_IMPLEMENTED.md</code>
        for the residual per-vendor work.
      </p>
    </div>
  )
}
