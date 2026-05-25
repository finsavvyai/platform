'use client'

import dynamic from 'next/dynamic'
import { Hero as HeroComponent } from "@/components/sections/Hero";
import { Testimonials as TestimonialsComponent } from "@/components/sections/Testimonials";
import { CTA as CTAComponent } from "@/components/sections/CTA";

// Dynamically import components to disable SSR
const Hero = dynamic(() => Promise.resolve(HeroComponent), {
  ssr: false,
  loading: () => <HeroFallback />
});

const Testimonials = dynamic(() => Promise.resolve(TestimonialsComponent), {
  ssr: false
});

const CTA = dynamic(() => Promise.resolve(CTAComponent), {
  ssr: false
});

export { Hero, Testimonials, CTA };

// Fallback for Hero component without animations
function HeroFallback() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-16">
      <div className="absolute inset-0 opacity-50" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Ccircle cx='7' cy='7' r='7'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-8">
            🚀 AI-Powered Database Management
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            The Future of
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Database Management
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            QueryFlux revolutionizes database management with AI-powered query optimization,
            real-time collaboration, and support for 35+ database types.
          </p>
        </div>
      </div>
    </section>
  );
}
