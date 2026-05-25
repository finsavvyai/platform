export default function ProxyHowItWorks(): React.ReactElement {
  return (
    <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="text-lg font-semibold mb-3">How it works</h2>
      <ol className="space-y-2 text-sm text-neutral-400">
        <li className="flex gap-2">
          <span className="text-info font-bold">1.</span>
          Enter your hostname and origin server below
        </li>
        <li className="flex gap-2">
          <span className="text-info font-bold">2.</span>
          Add the CNAME record to your DNS
        </li>
        <li className="flex gap-2">
          <span className="text-info font-bold">3.</span>
          TokenForge auto-injects the script tag and verifies every request
        </li>
      </ol>
    </div>
  );
}
