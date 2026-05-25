import {
  Database,
  Zap,
  Code,
  Shield,
  Globe,
  Users,
  Settings,
  BarChart3,
  Terminal,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

export function Features() {
  const { theme } = useTheme();

  const featureCategories = [
    {
      title: "Database Management",
      icon: <Database className="w-8 h-8" />,
      features: [
        {
          name: "Multi-Database Support",
          description:
            "Connect to PostgreSQL, MySQL, MongoDB, Redis, SQLite, and 30+ more databases.",
          icon: <Database className="w-5 h-5" />,
        },
        {
          name: "Connection Pooling",
          description:
            "Optimize performance with intelligent connection pooling and load balancing.",
          icon: <Settings className="w-5 h-5" />,
        },
        {
          name: "Schema Introspection",
          description:
            "Automatically discover and visualize database schemas with interactive diagrams.",
          icon: <BarChart3 className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "AI-Powered Features",
      icon: <Sparkles className="w-8 h-8" />,
      features: [
        {
          name: "Natural Language to SQL",
          description:
            "Convert plain English queries into optimized SQL statements instantly.",
          icon: <Zap className="w-5 h-5" />,
        },
        {
          name: "Query Optimization",
          description:
            "Get AI-powered suggestions to improve query performance and reduce execution time.",
          icon: <Clock className="w-5 h-5" />,
        },
        {
          name: "Auto-Complete & IntelliSense",
          description:
            "Smart code completion with context-aware suggestions for tables, columns, and functions.",
          icon: <Code className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "Developer Tools",
      icon: <Code className="w-8 h-8" />,
      features: [
        {
          name: "Code Generation",
          description:
            "Generate APIs, ORMs, and client libraries in 10+ programming languages.",
          icon: <Terminal className="w-5 h-5" />,
        },
        {
          name: "Version Control Integration",
          description:
            "Seamless Git integration with automatic query and schema change tracking.",
          icon: <Users className="w-5 h-5" />,
        },
        {
          name: "VS Code Extension",
          description:
            "Full-featured VS Code extension for database management right in your editor.",
          icon: <Code className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "Enterprise Security",
      icon: <Shield className="w-8 h-8" />,
      features: [
        {
          name: "End-to-End Encryption",
          description:
            "Military-grade encryption for all data in transit and at rest.",
          icon: <Lock className="w-5 h-5" />,
        },
        {
          name: "Audit Logging",
          description:
            "Comprehensive audit trails with PCI DSS compliant logging and reporting.",
          icon: <BarChart3 className="w-5 h-5" />,
        },
        {
          name: "SSO & RBAC",
          description:
            "Enterprise SSO with role-based access control and team management.",
          icon: <Users className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "Collaboration",
      icon: <Globe className="w-8 h-8" />,
      features: [
        {
          name: "Real-time Collaboration",
          description:
            "Share queries, collaborate in real-time, and sync changes across your team.",
          icon: <Users className="w-5 h-5" />,
        },
        {
          name: "Query Library",
          description:
            "Organize, share, and reuse queries with your team through a centralized library.",
          icon: <Database className="w-5 h-5" />,
        },
        {
          name: "Team Workspaces",
          description:
            "Dedicated workspaces for different teams and projects with granular permissions.",
          icon: <Globe className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "Performance Monitoring",
      icon: <BarChart3 className="w-8 h-8" />,
      features: [
        {
          name: "Real-time Monitoring",
          description:
            "Monitor database performance, query execution times, and resource usage.",
          icon: <Clock className="w-5 h-5" />,
        },
        {
          name: "Alert System",
          description:
            "Set up custom alerts for performance issues, errors, and unusual activity.",
          icon: <Zap className="w-5 h-5" />,
        },
        {
          name: "Analytics Dashboard",
          description:
            "Comprehensive analytics for query patterns, database usage, and team productivity.",
          icon: <BarChart3 className="w-5 h-5" />,
        },
      ],
    },
  ];

  return (
    <section
      id="features"
      className="py-20 lg:py-32"
      style={{ backgroundColor: theme.colors.background }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2
            className="text-4xl lg:text-5xl font-bold mb-6"
            style={{ color: theme.colors.text }}
          >
            Everything You Need for
            <span className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Modern Database Management
            </span>
          </h2>
          <p
            className="text-xl max-w-3xl mx-auto leading-relaxed"
            style={{ color: theme.colors.textSecondary }}
          >
            QueryFlux combines powerful AI features with enterprise-grade
            security to deliver the most comprehensive database management
            experience.
          </p>
        </div>

        {/* Feature Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {featureCategories.map((category, categoryIndex) => (
            <div
              key={categoryIndex}
              className="p-8 rounded-2xl border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              }}
            >
              {/* Category Header */}
              <div className="flex items-center mb-6">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center mr-4"
                  style={{
                    backgroundColor: theme.colors.accent + "20",
                    color: theme.colors.accent,
                  }}
                >
                  {category.icon}
                </div>
                <h3
                  className="text-2xl font-bold"
                  style={{ color: theme.colors.text }}
                >
                  {category.title}
                </h3>
              </div>

              {/* Features List */}
              <div className="space-y-6">
                {category.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0"
                      style={{
                        backgroundColor: theme.colors.accent + "10",
                        color: theme.colors.accent,
                      }}
                    >
                      {feature.icon}
                    </div>
                    <div>
                      <h4
                        className="text-lg font-semibold mb-2"
                        style={{ color: theme.colors.text }}
                      >
                        {feature.name}
                      </h4>
                      <p
                        className="leading-relaxed"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="mt-20 text-center">
          <div
            className="inline-flex flex-col sm:flex-row items-center gap-4 p-8 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.accent}20, ${theme.colors.accent}10)`,
              border: `1px solid ${theme.colors.accent}30`,
            }}
          >
            <div>
              <h3
                className="text-2xl font-bold mb-2"
                style={{ color: theme.colors.text }}
              >
                Ready to Transform Your Workflow?
              </h3>
              <p
                className="text-lg"
                style={{ color: theme.colors.textSecondary }}
              >
                Join thousands of developers who've already made the switch.
              </p>
            </div>
            <button
              onClick={() => (window.location.href = "/download")}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105"
              style={{ backgroundColor: theme.colors.accent }}
            >
              Get Started Free
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
