"use client";

import { useState, useEffect } from "react";
import { Menu, X, Download, Zap, Shield, Users } from "lucide-react";
// import { Button } from '@/components/ui/Button'
import Link from "next/link";

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navigation = [
    { name: "Features", href: "#features" },
    { name: "Pricing", href: "#pricing" },
    { name: "Downloads", href: "/downloads" },
    { name: "Documentation", href: "/docs" },
    { name: "Blog", href: "/blog" },
    { name: "About", href: "/about" },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md border-b border-gray-200"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span
              className={`text-xl font-bold ${isScrolled ? "text-gray-900" : "text-gray-900"}`}
            >
              QueryFlux
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-black ${
                  isScrolled ? "text-gray-600" : "text-gray-700"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="inline-flex items-center justify-center px-3 py-1.5 text-sm text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all duration-200">
              Sign In
            </button>
            <button className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-black text-white rounded-xl hover:bg-gray-800 font-medium transition-all duration-200">
              Download Free
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 pb-2 border-t border-gray-200">
                <div className="px-3 space-y-2">
                  <button className="inline-flex items-center justify-center w-full px-3 py-1.5 text-sm text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all duration-200">
                    Sign In
                  </button>
                  <button className="inline-flex items-center justify-center w-full px-3 py-1.5 text-sm bg-black text-white rounded-xl hover:bg-gray-800 font-medium transition-all duration-200">
                    <Download className="w-4 h-4 mr-2" />
                    Download Free
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
