import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ClawPipe Chatbot',
  description: 'AI chatbot powered by ClawPipe intelligent pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
