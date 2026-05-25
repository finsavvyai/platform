import { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

export function MarketingRedirect() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  useEffect(() => {
    // Redirect to marketing website
    window.location.href = 'https://queryflux.com';
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: theme.colors.background }}
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: theme.colors.text }}>
          Redirecting to QueryFlux...
        </h1>
        <p style={{ color: theme.colors.textSecondary }}>
          Taking you to our secure desktop application
        </p>
        <a
          href="https://queryflux.com"
          className="inline-block mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
          style={{ color: 'white' }}
        >
          Click here if not redirected
        </a>
      </div>
    </div>
  );
}