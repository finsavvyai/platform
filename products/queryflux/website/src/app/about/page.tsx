import { Metadata } from "next";
import {
  Users,
  Globe,
  Award,
  Target,
  Lightbulb,
  Shield,
  Zap,
  Github,
  Twitter,
  Linkedin,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
// import { Button } from '@/components/ui/Button'
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About QueryFlux - AI-Powered Database Management Platform",
  description:
    "Learn about QueryFlux's mission to revolutionize database management with AI-powered tools and real-time collaboration.",
  keywords: ["about", "company", "mission", "team", "AI database management"],
};

const team = [
  {
    name: "Sarah Chen",
    role: "CEO & Co-Founder",
    bio: "Former Senior Database Engineer at Google with 15+ years experience in distributed systems and database optimization.",
    avatar: "/images/team/sarah-chen.jpg",
    linkedin: "#",
    twitter: "#",
  },
  {
    name: "Michael Rodriguez",
    role: "CTO & Co-Founder",
    bio: "Ex-AWS Principal Engineer specializing in database services and AI/ML infrastructure. Led database teams at Netflix and Airbnb.",
    avatar: "/images/team/michael-rodriguez.jpg",
    linkedin: "#",
    twitter: "#",
  },
  {
    name: "Emily Watson",
    role: "Head of Product",
    bio: "Product leader with experience at Stripe and MongoDB. Passionate about creating intuitive database tools for developers.",
    avatar: "/images/team/emily-watson.jpg",
    linkedin: "#",
    twitter: "#",
  },
  {
    name: "David Kim",
    role: "Lead AI Engineer",
    bio: "ML specialist from OpenAI working on natural language to SQL conversion and query optimization algorithms.",
    avatar: "/images/team/david-kim.jpg",
    linkedin: "#",
    twitter: "#",
  },
];

const values = [
  {
    icon: Lightbulb,
    title: "Innovation First",
    description:
      "We push the boundaries of what's possible in database management, leveraging cutting-edge AI and machine learning.",
    color: "from-yellow-400 to-orange-500",
  },
  {
    icon: Users,
    title: "Developer-Centric",
    description:
      "Every feature is designed with developers in mind, focusing on productivity, efficiency, and developer experience.",
    color: "from-blue-400 to-purple-500",
  },
  {
    icon: Shield,
    title: "Security by Default",
    description:
      "We believe in building secure tools from the ground up, with enterprise-grade security as a core principle.",
    color: "from-green-400 to-emerald-500",
  },
  {
    icon: Zap,
    title: "Performance Obsessed",
    description:
      "We optimize every aspect of our platform for speed, from query execution to UI responsiveness.",
    color: "from-purple-400 to-pink-500",
  },
];

const stats = [
  { label: "Active Users", value: "50,000+", growth: "+25%" },
  { label: "Databases Managed", value: "1M+", growth: "+40%" },
  { label: "Queries Optimized", value: "10M+", growth: "+60%" },
  { label: "Team Members", value: "25+", growth: "+5" },
];

const milestones = [
  {
    year: "2023",
    title: "Founded",
    description:
      "QueryFlux was founded with a mission to revolutionize database management using AI.",
  },
  {
    year: "2023 Q3",
    title: "Seed Funding",
    description:
      "Raised $2.5M in seed funding from top-tier VCs to build our AI-powered platform.",
  },
  {
    year: "2024 Q1",
    title: "Beta Launch",
    description:
      "Launched private beta with 1,000+ developers and received overwhelming positive feedback.",
  },
  {
    year: "2024 Q2",
    title: "Public Launch",
    description:
      "Public launch of QueryFlux with support for 35+ database types and AI query assistant.",
  },
  {
    year: "2024 Q3",
    title: "Mobile Apps",
    description:
      "Released iOS and Android apps for database monitoring and alerts on the go.",
  },
  {
    year: "2025 Q1",
    title: "Enterprise Features",
    description:
      "Launched enterprise edition with advanced security, SSO, and compliance features.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 to-purple-600 text-white pt-16 pb-20">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='7' cy='7' r='7'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm mb-8">
              <Target className="w-4 h-4 mr-2" />
              Our Mission
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Democratizing
              <span className="block">Database Management</span>
            </h1>
            <p className="text-xl sm:text-2xl opacity-90 mb-8 max-w-3xl mx-auto leading-relaxed">
              We're building the future of database management with AI-powered
              tools that make complex data operations simple, fast, and
              accessible to everyone.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="inline-flex items-center justify-center px-8 py-4 text-lg bg-white text-blue-600 rounded-xl hover:bg-gray-100 font-semibold transition-all duration-200">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              <Link href="/careers">
                <button className="inline-flex items-center justify-center px-8 py-4 text-lg border-2 border-white text-white rounded-xl hover:bg-white hover:text-blue-600 font-semibold transition-all duration-200">
                  Join Our Team
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">
                  {stat.value}
                </div>
                <div className="text-lg text-gray-600 mb-1">{stat.label}</div>
                <div className="text-sm text-green-600 font-medium">
                  {stat.growth}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Our Mission
            </h2>
            <p className="text-xl text-gray-600">
              Making database management accessible, efficient, and intelligent
              for everyone.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
            <div className="prose prose-lg max-w-none text-gray-600">
              <p className="text-xl leading-relaxed mb-6">
                In today's data-driven world, database management remains
                unnecessarily complex and time-consuming. Developers spend
                countless hours writing, optimizing, and debugging queries while
                database administrators struggle with monitoring and maintaining
                performance across diverse systems.
              </p>
              <p className="text-xl leading-relaxed mb-6">
                QueryFlux was founded on a simple belief: that AI and modern web
                technologies can transform this experience. We're building tools
                that understand natural language, optimize queries
                automatically, and provide real-time insights—making database
                management as intuitive as using a modern code editor.
              </p>
              <p className="text-xl leading-relaxed font-semibold text-gray-900">
                Our vision is a world where anyone, from junior developers to
                senior database architects, can manage databases with
                confidence, speed, and intelligence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Our Values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={value.title} className="text-center">
                <div
                  className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${value.color} text-white mb-6`}
                >
                  <value.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {value.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Our Journey
            </h2>
            <p className="text-xl text-gray-600">
              Key milestones in our mission to transform database management.
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 h-full w-0.5 bg-gradient-to-b from-blue-600 to-purple-600"></div>

            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.year}
                  className={`relative flex items-center ${index % 2 === 0 ? "md:flex-row-reverse" : ""}`}
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 w-4 h-4 bg-blue-600 rounded-full border-4 border-white shadow-lg"></div>

                  {/* Content */}
                  <div
                    className={`ml-20 md:ml-0 md:w-5/12 ${index % 2 === 0 ? "md:mr-auto md:ml-auto md:text-right" : "md:mr-auto md:text-left"}`}
                  >
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      <div className="text-blue-600 font-bold mb-2">
                        {milestone.year}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {milestone.title}
                      </h3>
                      <p className="text-gray-600">{milestone.description}</p>
                    </div>
                  </div>

                  {/* Empty Space for Alternate Layout */}
                  <div className="hidden md:block md:w-5/12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Meet Our Team
            </h2>
            <p className="text-xl text-gray-600">
              The experts building the future of database management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member) => (
              <div key={member.name} className="text-center group">
                <div className="relative mb-6">
                  <div className="w-32 h-32 bg-gray-300 rounded-full mx-auto mb-4 group-hover:scale-105 transition-transform"></div>
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                    <a
                      href={member.linkedin}
                      className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                    <a
                      href={member.twitter}
                      className="w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors"
                    >
                      <Twitter className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {member.name}
                </h3>
                <p className="text-blue-600 font-medium mb-3">{member.role}</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <p className="text-gray-600 mb-6">
              We're always looking for talented people to join our team.
            </p>
            <Link href="/careers">
              <button className="inline-flex items-center justify-center px-8 py-4 text-lg bg-black text-white rounded-xl hover:bg-gray-800 font-semibold transition-all duration-200">
                View Open Positions
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Investors & Backers */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Backed by the Best
            </h2>
            <p className="text-xl text-gray-600">
              Supported by leading investors and advisors in technology and
              databases.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              "Sequoia Capital",
              "Andreessen Horowitz",
              "Greylock",
              "Index Ventures",
            ].map((investor) => (
              <div
                key={investor}
                className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center h-32"
              >
                <span className="text-gray-400 font-medium">{investor}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Award className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Join the Revolution?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Experience the future of database management with QueryFlux.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="inline-flex items-center justify-center px-8 py-4 text-lg bg-white text-blue-600 rounded-xl hover:bg-gray-100 font-semibold transition-all duration-200">
              Start Free Trial
            </button>
            <Link href="/contact">
              <button className="inline-flex items-center justify-center px-8 py-4 text-lg border-2 border-white text-white rounded-xl hover:bg-white hover:text-blue-600 font-semibold transition-all duration-200">
                Contact Sales
              </button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
