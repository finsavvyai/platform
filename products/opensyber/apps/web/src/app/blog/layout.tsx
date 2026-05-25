import { SiteHeader } from '@/components/SiteHeader';

export const metadata = {
  title: 'Blog — OpenSyber',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />

      <main className="pt-36 pb-24">
        <div className="mx-auto max-w-4xl px-6">{children}</div>
      </main>
    </div>
  );
}
