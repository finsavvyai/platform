import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog - QueryFlux",
  description: "Tips and insights on database management.",
};

export default function BlogPage() {
  return (
    <main className="min-h-screen">
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-8">
            📝 Blog
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            QueryFlux
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Blog
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Tips, tutorials, and insights on database management and AI-powered
            query optimization.
          </p>

          <div className="text-center mt-12">
            <p className="text-gray-500 mb-8">
              Blog content is coming soon! We're working on exciting articles
              about database management, AI optimization, and best practices.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-8 py-4 bg-black text-white rounded-xl hover:bg-gray-800 font-semibold transition-all duration-200"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
