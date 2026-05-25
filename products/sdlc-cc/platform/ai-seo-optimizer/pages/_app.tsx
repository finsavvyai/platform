import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { Inter, Fira_Code } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-code',
  display: 'swap',
});

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <div className={`${inter.variable} ${firaCode.variable} font-sans`}>
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
}
