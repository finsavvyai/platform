import { SiteHeader } from '@/components/SiteHeader';

export default function ThreatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main className="pt-14">{children}</main>
    </div>
  );
}
