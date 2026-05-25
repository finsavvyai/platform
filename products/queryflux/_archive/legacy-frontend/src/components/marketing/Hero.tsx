import { useState } from "react";
import {
  Play,
  Download,
  ArrowRight,
  Star,
  CheckCircle,
  Zap,
  Database,
  Code,
  Shield,
  Globe,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";

export function Hero() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");

  const handleDownload = (platform: "mac" | "windows" | "vscode") => {
    const downloadUrls = {
      mac: "https://releases.queryflux.com/QueryFlux-latest.dmg",
      windows: "https://releases.queryflux.com/QueryFlux-latest.exe",
      vscode:
        "https://marketplace.visualstudio.com/items?itemName=queryflux.queryflux",
    };
    window.open(downloadUrls[platform], "_blank");
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle email newsletter signup
    console.log("Email signup:", email);
    setEmail("");
  };

  const features = [
    {
      icon: <Database className="w-6 h-6" />,
      title: "Multi-Database Support",
      description:
        "Connect to 35+ databases including PostgreSQL, MySQL, MongoDB, Redis, and more.",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "AI-Powered Queries",
      description:
        "Natural language to SQL conversion, query optimization, and intelligent suggestions.",
    },
    {
      icon: <Code className="w-6 h-6" />,
      title: "Code Generation",
      description:
        "Generate APIs, ORMs, and client libraries directly from your database schema.",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Enterprise Security",
      description:
        "End-to-end encryption, audit logging, and compliance with industry standards.",
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Real-time Collaboration",
      description:
        "Share queries, collaborate with your team, and sync changes across devices.",
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Voice Commands",
      description:
        "Execute queries and manage databases using natural voice commands.",
    },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-8"
            style={{
              backgroundColor: theme.colors.accent + "20",
              color: theme.colors.accent,
            }}
          >
            <Star className="w-4 h-4 mr-2" />
            Trusted by 10,000+ developers worldwide
          </div>

          {/* Main Heading */}
          <h1
            className="text-5xl lg:text-7xl font-bold mb-6 leading-tight"
            style={{ color: theme.colors.text }}
          >
            The Future of
            <span className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Database Management
            </span>
          </h1>

          {/* Subheading */}
          <p
            className="text-xl lg:text-2xl mb-12 max-w-3xl mx-auto leading-relaxed"
            style={{ color: theme.colors.textSecondary }}
          >
            QueryFlux is an AI-powered database management platform that helps
            you build, query, and optimize databases with lightning speed and
            precision.
          </p>

          {/* Download Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => handleDownload("mac")}
              className="flex items-center space-x-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg hover:shadow-xl"
              style={{ backgroundColor: theme.colors.accent, color: "white" }}
            >
              <Download className="w-5 h-5" />
              <span>Download for Mac</span>
            </button>

            <button
              onClick={() => handleDownload("windows")}
              className="flex items-center space-x-3 px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-all hover:scale-105"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
              }}
            >
              <Download className="w-5 h-5" />
              <span>Download for Windows</span>
            </button>

            <button
              onClick={() => handleDownload("vscode")}
              className="flex items-center space-x-3 px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-all hover:scale-105"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
              }}
            >
              <Code className="w-5 h-5" />
              <span>VS Code Extension</span>
            </button>
          </div>

          {/* Email Signup */}
          <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto mb-16">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email for updates"
                className="flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                }}
                required
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-lg font-medium transition-colors"
                style={{ backgroundColor: theme.colors.accent, color: "white" }}
              >
                Subscribe
              </button>
            </div>
          </form>

          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm">
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-4 h-4 fill-yellow-400 text-yellow-400"
                />
              ))}
              <span
                style={{ color: theme.colors.textSecondary, marginLeft: "8px" }}
              >
                4.9/5 on Product Hunt
              </span>
            </div>
            <div style={{ color: theme.colors.textSecondary }}>
              10,000+ Active Users
            </div>
            <div style={{ color: theme.colors.textSecondary }}>
              1M+ Queries Generated
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-xl border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{
                  backgroundColor: theme.colors.accent + "20",
                  color: theme.colors.accent,
                }}
              >
                {feature.icon}
              </div>
              <h3
                className="text-lg font-semibold mb-2"
                style={{ color: theme.colors.text }}
              >
                {feature.title}
              </h3>
              <p style={{ color: theme.colors.textSecondary }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Demo */}
        <div className="mt-20 text-center">
          <button
            onClick={() =>
              (window.location.href = "https://demo.queryflux.com")
            }
            className="flex items-center space-x-2 mx-auto px-6 py-3 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: "transparent",
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text,
            }}
          >
            <Play className="w-4 h-4" />
            <span>Try Live Demo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
