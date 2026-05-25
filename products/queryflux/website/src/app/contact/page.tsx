import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact QueryFlux - Get in Touch",
  description:
    "Contact the QueryFlux team for sales, support, partnerships, or general inquiries. We're here to help with your database management needs.",
  keywords: ["contact", "support", "sales", "partnerships", "QueryFlux"],
};

export default function ContactPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white pt-16">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Ccircle cx='7' cy='7' r='7'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-8">
              📞 Get in Touch
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Contact the
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                QueryFlux Team
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Whether you need help with a technical issue, want to discuss
              pricing, or explore partnership opportunities, we're here to help.
            </p>
          </div>

          {/* Contact Form */}
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="company"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Company
                </label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your company name"
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Topic *
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a topic</option>
                  <option value="sales">Sales Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tell us how we can help..."
                ></textarea>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="newsletter"
                  className="ml-2 text-sm text-gray-600"
                >
                  Send me QueryFlux updates and tips
                </label>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center px-8 py-4 text-lg bg-black text-white rounded-xl hover:bg-gray-800 font-semibold transition-all duration-200"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Other Ways to Reach Us
            </h2>
            <p className="text-xl text-gray-600">
              Choose the method that works best for you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-full mb-6">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Email</h3>
              <p className="text-gray-600 mb-4">Send us an email anytime</p>
              <a
                href="mailto:hello@queryflux.ai"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                hello@queryflux.ai
              </a>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-6">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Live Chat
              </h3>
              <p className="text-gray-600 mb-4">Chat with our team</p>
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                Start Chat
              </button>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 text-purple-600 rounded-full mb-6">
                <span className="text-2xl">🐦</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Social Media
              </h3>
              <p className="text-gray-600 mb-4">Follow us for updates</p>
              <div className="flex justify-center space-x-4">
                <a href="#" className="text-blue-600 hover:text-blue-700">
                  Twitter
                </a>
                <a href="#" className="text-blue-600 hover:text-blue-700">
                  LinkedIn
                </a>
                <a href="#" className="text-blue-600 hover:text-blue-700">
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Quick answers to common questions
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                What databases does QueryFlux support?
              </h3>
              <p className="text-gray-600">
                QueryFlux supports 35+ database types including PostgreSQL,
                MySQL, MongoDB, Redis, SQLite, and many more.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Is there a free trial available?
              </h3>
              <p className="text-gray-600">
                Yes! QueryFlux offers a free tier with basic features, perfect
                for personal projects and small teams.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                How does the AI query optimization work?
              </h3>
              <p className="text-gray-600">
                Our AI analyzes your queries and suggests optimizations based on
                best practices, indexing strategies, and execution patterns.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
