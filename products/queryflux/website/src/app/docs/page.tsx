import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - QueryFlux",
  description:
    "Complete documentation for QueryFlux AI-powered database management platform.",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen">
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-8">
            📚 Documentation
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            QueryFlux
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Documentation
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Complete guides and API documentation for the AI-powered database
            management platform.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg transition-shadow">
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                🚀 Getting Started
              </h3>
              <p className="text-gray-600 mb-4">
                Installation and quick start guides
              </p>
              <span className="text-blue-600 font-medium">Coming soon →</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg transition-shadow">
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                📖 API Reference
              </h3>
              <p className="text-gray-600 mb-4">Complete API documentation</p>
              <span className="text-blue-600 font-medium">Coming soon →</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg transition-shadow">
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                🎯 Tutorials
              </h3>
              <p className="text-gray-600 mb-4">Step-by-step tutorials</p>
              <span className="text-blue-600 font-medium">Coming soon →</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-lg transition-shadow">
              <h3 className="font-bold text-lg text-gray-900 mb-2">
                💡 Examples
              </h3>
              <p className="text-gray-600 mb-4">Code examples and patterns</p>
              <span className="text-blue-600 font-medium">Coming soon →</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
