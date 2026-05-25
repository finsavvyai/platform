import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download QueryFlux - Desktop & Mobile Apps",
  description:
    "Download QueryFlux for macOS, Windows, Linux, iOS, and Android. AI-powered database management platform.",
};

export default function DownloadsPage() {
  return (
    <main className="min-h-screen">
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Download
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              QueryFlux
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Downloads are temporarily disabled during build improvements.
          </p>
          <div className="text-gray-500">
            Please check back later for the full download experience.
          </div>
        </div>
      </section>
    </main>
  );
}
