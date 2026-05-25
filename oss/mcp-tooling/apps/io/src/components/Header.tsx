import { Link } from 'react-router-dom';
import { Code2, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center gap-2 h-16 sm:h-20">
          <Link
            to="/"
            className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-bold text-gray-900 hover:text-blue-600 transition-all duration-300 group min-w-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="tracking-tight truncate">MCPoverflow</span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4 shrink-0">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-700 hover:text-blue-600 font-semibold transition-colors px-2 sm:px-3 py-2 whitespace-nowrap"
                >
                  Dashboard
                </Link>
                <Link
                  to="/generate"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl hover:shadow-elevated font-semibold transition-all duration-300 transform hover:scale-105 whitespace-nowrap"
                >
                  Generate
                </Link>
                <Link
                  to="/settings"
                  className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center text-gray-700 hover:text-blue-600 hover:bg-white transition-all duration-300 shrink-0"
                  title="Settings"
                  aria-label="Settings"
                >
                  <SettingsIcon className="w-5 h-5" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blue-600 font-semibold transition-colors px-2 sm:px-3 py-2 whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl hover:shadow-elevated font-semibold transition-all duration-300 transform hover:scale-105 whitespace-nowrap"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
