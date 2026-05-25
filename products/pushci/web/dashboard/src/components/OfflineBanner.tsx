import { useOnline } from '../hooks/useOnline';

export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 backdrop-blur-sm"
    >
      <span aria-hidden="true" className="font-mono">!</span>
      <span>Offline. Changes won't sync until your connection returns.</span>
    </div>
  );
}
