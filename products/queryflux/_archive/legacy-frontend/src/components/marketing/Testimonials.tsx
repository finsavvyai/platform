import { Star, Quote } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function Testimonials() {
  const { theme } = useTheme();

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Senior Backend Engineer',
      company: 'TechCorp',
      avatar: 'SC',
      content: 'QueryFlux has revolutionized how our team manages databases. The AI-powered query suggestions alone have saved us hours of work every week.',
      rating: 5,
      highlight: 'AI-powered query suggestions'
    },
    {
      name: 'Marcus Rodriguez',
      role: 'DevOps Lead',
      company: 'StartupXYZ',
      avatar: 'MR',
      content: 'The real-time collaboration features are incredible. Our entire team can work on the same database simultaneously without conflicts.',
      rating: 5,
      highlight: 'Real-time collaboration'
    },
    {
      name: 'Emily Johnson',
      role: 'Full Stack Developer',
      company: 'DigitalAgency',
      avatar: 'EJ',
      content: 'As a freelancer, I need tools that are both powerful and affordable. QueryFlux delivers enterprise features at a price I can afford.',
      rating: 5,
      highlight: 'Enterprise features at affordable price'
    },
    {
      name: 'David Kim',
      role: 'Database Administrator',
      company: 'Enterprise Corp',
      avatar: 'DK',
      content: 'The security features and audit logging have made our compliance team very happy. Plus, the performance monitoring is top-notch.',
      rating: 5,
      highlight: 'Security and compliance'
    },
    {
      name: 'Lisa Anderson',
      role: 'Tech Lead',
      company: 'Innovation Labs',
      avatar: 'LA',
      content: 'The VS Code extension integrates perfectly with our workflow. I rarely need to leave my editor to manage databases now.',
      rating: 5,
      highlight: 'VS Code integration'
    },
    {
      name: 'James Wilson',
      role: 'CTO',
      company: 'ScaleUp Inc',
      avatar: 'JW',
      content: 'We migrated from multiple tools to QueryFlux and saw immediate productivity gains. It\'s now our single source of truth for database management.',
      rating: 5,
      highlight: 'Single source of truth'
    }
  ];

  return (
    <section className="py-20 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2
            className="text-4xl lg:text-5xl font-bold mb-6"
            style={{ color: theme.colors.text }}
          >
            Trusted by Thousands of
            <span
              className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
            >
              Developers Worldwide
            </span>
          </h2>
          <p
            className="text-xl max-w-3xl mx-auto leading-relaxed"
            style={{ color: theme.colors.textSecondary }}
          >
            See what our users have to say about their experience with QueryFlux.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl border relative"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }}
            >
              {/* Quote Icon */}
              <Quote
                className="absolute top-4 right-4 w-8 h-8 opacity-20"
                style={{ color: theme.colors.accent }}
              />

              {/* Rating */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Content */}
              <p
                className="mb-6 leading-relaxed relative"
                style={{ color: theme.colors.text }}
              >
                "{testimonial.content.split(testimonial.highlight)[0]}
                <span
                  className="font-semibold"
                  style={{ color: theme.colors.accent }}
                >
                  {testimonial.highlight}
                </span>
                {testimonial.content.split(testimonial.highlight)[1] || ''}"
              </p>

              {/* Author */}
              <div className="flex items-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mr-3 text-white font-semibold"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  {testimonial.avatar}
                </div>
                <div>
                  <h4
                    className="font-semibold"
                    style={{ color: theme.colors.text }}
                  >
                    {testimonial.name}
                  </h4>
                  <p
                    className="text-sm"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social Proof Stats */}
        <div className="mt-20 text-center">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { number: '10,000+', label: 'Active Users' },
              { number: '1M+', label: 'Queries Generated' },
              { number: '50+', label: 'Countries' },
              { number: '99.9%', label: 'Uptime' }
            ].map((stat, index) => (
              <div key={index}>
                <div
                  className="text-3xl lg:text-4xl font-bold mb-2"
                  style={{ color: theme.colors.accent }}
                >
                  {stat.number}
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
