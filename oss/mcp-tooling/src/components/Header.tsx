import { Link } from 'react-router-dom';
import { Code2, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

export function Header() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-3 text-xl font-bold text-gray-900 hover:text-blue-600 transition-all duration-300 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="tracking-tight">{t('header.brand')}</span>
          </Link>

          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-700 hover:text-blue-600 font-semibold transition-colors px-3 py-2"
                >
                  {t('header.dashboard')}
                </Link>
                <Link
                  to="/generate"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-xl hover:shadow-elevated font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  {t('header.generate')}
                </Link>
                <ThemeSwitcher />
                <LanguageSwitcher />
                <Link
                  to="/settings"
                  className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center text-gray-700 hover:text-blue-600 hover:bg-white transition-all duration-300"
                  title={t('header.settings')}
                >
                  <SettingsIcon className="w-5 h-5" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blue-600 font-semibold transition-colors px-3 py-2"
                >
                  {t('header.signIn')}
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-xl hover:shadow-elevated font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  {t('header.signUp')}
                </Link>
                <ThemeSwitcher />
                <LanguageSwitcher />
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
