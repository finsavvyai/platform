import { useState } from "react";
import {
  Menu,
  X,
  Download,
  Star,
  Users,
  Book,
  User,
  LogOut,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";

interface HeaderProps {
  currentPage: string;
  isAuthenticated: boolean;
  onNavigate: (page: string) => void;
}

export function Header({
  currentPage,
  isAuthenticated,
  onNavigate,
}: HeaderProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Home", key: "home", href: "/" },
    { name: "Features", key: "features", href: "/#features" },
    { name: "Pricing", key: "pricing", href: "/pricing" },
    { name: "Documentation", key: "docs", href: "/docs" },
  ];

  if (isAuthenticated) {
    navigation.push({ name: "Account", key: "account", href: "/account" });
  }

  const handleNavClick = (key: string) => {
    onNavigate(key);
    setIsMobileMenuOpen(false);
  };

  const handleAuthAction = () => {
    if (isAuthenticated) {
      // Handle logout
      localStorage.removeItem("queryflux_token");
      window.location.href = "/";
    } else {
      // Handle login - redirect to app login
      window.location.href = "https://app.queryflux.com/login";
    }
  };

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: theme.colors.background + "cc",
        borderColor: theme.colors.border,
        backdropFilter: "blur(12px)",
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => handleNavClick("home")}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">Q</span>
              </div>
              <span
                className="text-xl font-bold"
                style={{ color: theme.colors.text }}
              >
                QueryFlux
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavClick(item.key)}
                className={`font-medium transition-colors ${
                  currentPage === item.key ||
                  (item.key === "features" && currentPage === "home")
                    ? "text-purple-500"
                    : "hover:text-purple-500"
                }`}
                style={{
                  color:
                    currentPage === item.key ||
                    (item.key === "features" && currentPage === "home")
                      ? theme.colors.accent
                      : theme.colors.text,
                }}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={() =>
                window.open("https://github.com/queryflux/queryflux", "_blank")
              }
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              style={{ color: theme.colors.text }}
            >
              <Star className="w-5 h-5" />
            </button>

            <button
              onClick={() => (window.location.href = "/download")}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
              }}
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={handleAuthAction}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-white transition-colors"
              style={{ backgroundColor: theme.colors.accent }}
            >
              {isAuthenticated ? (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </>
              ) : (
                <>
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg"
              style={{ color: theme.colors.text }}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden py-4 border-t"
            style={{ borderColor: theme.colors.border }}
          >
            <div className="space-y-2">
              {navigation.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  className={`block w-full text-left px-3 py-2 rounded-lg font-medium ${
                    currentPage === item.key ||
                    (item.key === "features" && currentPage === "home")
                      ? "text-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  style={{
                    color:
                      currentPage === item.key ||
                      (item.key === "features" && currentPage === "home")
                        ? theme.colors.accent
                        : theme.colors.text,
                  }}
                >
                  {item.name}
                </button>
              ))}

              <div
                className="pt-4 border-t"
                style={{ borderColor: theme.colors.border }}
              >
                <div className="space-y-2">
                  <button
                    onClick={() => (window.location.href = "/download")}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium"
                    style={{
                      backgroundColor: theme.colors.background,
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                    }}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>

                  <button
                    onClick={handleAuthAction}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium text-white"
                    style={{ backgroundColor: theme.colors.accent }}
                  >
                    {isAuthenticated ? (
                      <>
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
