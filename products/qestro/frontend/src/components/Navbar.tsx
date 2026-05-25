import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X, 
  Brain, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  Sparkles,
  Zap,
  Shield,
  BarChart3
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navigation = [
    { name: 'Features', href: '/features', icon: Sparkles },
    { name: 'Pricing', href: '/pricing', icon: Zap },
  ];

  const userNavigation = isAuthenticated ? [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'AI Generation', href: '/ai-test-generation', icon: Brain },
    { name: 'Recording Studio', href: '/recording-studio', icon: Shield },
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ] : [];

  return (
    <nav 
      className="glass sticky top-0 z-50 border-b"
      style={{ 
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-separator)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 flex-shrink-0">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span 
                className="text-2xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Questro
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-2 ml-10">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    location.pathname === item.href
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  style={{
                    backgroundColor: location.pathname === item.href 
                      ? 'rgba(0, 122, 255, 0.1)' 
                      : 'transparent',
                    color: location.pathname === item.href 
                      ? 'var(--color-primary)' 
                      : 'var(--color-text-secondary)'
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg border transition-all duration-200"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="font-medium">{user?.email?.split('@')[0] || 'User'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isUserMenuOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)'
                    }}
                  >
                    <div className="py-1">
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-separator)' }}>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {user?.email}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {user?.role || 'User'}
                        </p>
                      </div>
                      
                      {userNavigation.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          className="flex items-center space-x-3 px-4 py-2 text-sm transition-colors duration-200"
                          style={{ color: 'var(--color-text-secondary)' }}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </Link>
                      ))}
                      
                      <div className="border-t" style={{ borderColor: 'var(--color-separator)' }}>
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-3 px-4 py-2 text-sm w-full text-left transition-colors duration-200"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="btn-secondary text-sm px-4 py-2"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm px-4 py-2"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)'
              }}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div 
          className="md:hidden border-t"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-separator)'
          }}
        >
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg text-base font-medium transition-colors duration-200"
                style={{
                  backgroundColor: location.pathname === item.href 
                    ? 'rgba(0, 122, 255, 0.1)' 
                    : 'transparent',
                  color: location.pathname === item.href 
                    ? 'var(--color-primary)' 
                    : 'var(--color-text-secondary)'
                }}
                onClick={() => setIsMenuOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            ))}
            
            {!isAuthenticated && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--color-separator)' }}>
                <div className="space-y-2">
                  <Link
                    to="/login"
                    className="block w-full btn-secondary text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full btn-primary text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get started
                  </Link>
                </div>
              </div>
            )}

            {isAuthenticated && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--color-separator)' }}>
                {userNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-base font-medium transition-colors duration-200"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                ))}
                
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-base font-medium w-full text-left transition-colors duration-200"
                  style={{ color: 'var(--color-error)' }}
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
