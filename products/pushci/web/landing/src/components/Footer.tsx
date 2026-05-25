import { Link } from 'react-router-dom'
import { BuildBadge } from './BuildBadge'
import { NewsletterCapture } from './NewsletterCapture'

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'AI Agents', href: '/ai' },
      { label: 'Skill Market', href: '/skills' },
      { label: 'Cost Calculator', href: '/tools/cost-calculator' },
      { label: 'Curb Your CI', href: '/curb' },
    ],
  },
  {
    title: 'Compare',
    links: [
      { label: 'vs GitHub Actions', href: '/vs/github-actions' },
      { label: 'vs GitLab CI', href: '/vs/gitlab-ci' },
      { label: 'vs CircleCI', href: '/vs/circleci' },
      { label: 'vs Jenkins', href: '/vs/jenkins' },
      { label: 'vs Travis CI', href: '/vs/travis-ci' },
      { label: 'vs Buildkite', href: '/vs/buildkite' },
      { label: 'vs Drone CI', href: '/vs/drone-ci' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'API Reference', href: '/docs#api' },
      { label: 'GitHub', href: 'https://github.com/finsavvyai/pushci-cli', external: true },
      { label: 'Examples', href: '/docs#examples' },
      { label: 'Status', href: '/status' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Refund Policy', href: '/refunds' },
      { label: 'Security', href: '/security' },
      { label: 'Compliance', href: '/compliance' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="section-border py-14 sm:py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Link to="/" className="text-[15px] font-bold text-t1">
              push<span className="text-accent">ci</span>
            </Link>
            <p className="mt-3 text-body text-t3 leading-relaxed max-w-xs">
              AI-native CI/CD that runs on your machine. Zero config, zero cost.
            </p>
            <div className="mt-4">
              <p className="text-xs text-t3 mb-2">Get CI tips + product updates</p>
              <NewsletterCapture />
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-body font-medium text-t2">{col.title}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => {
                  if ('external' in link && link.external) {
                    return (
                      <li key={link.href}>
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-body text-t3 hover:text-t2 transition-colors duration-200">{link.label}</a>
                      </li>
                    )
                  }
                  if (link.href.startsWith('/#')) {
                    return (
                      <li key={link.href}>
                        <a href={link.href} className="text-body text-t3 hover:text-t2 transition-colors duration-200">{link.label}</a>
                      </li>
                    )
                  }
                  return (
                    <li key={link.href}>
                      <Link to={link.href} className="text-body text-t3 hover:text-t2 transition-colors duration-200">{link.label}</Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-border-base/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-t3">
            <span>&copy; {new Date().getFullYear()} PushCI</span>
            <Link to="/terms" className="hover:text-t2 transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-t2 transition-colors">Privacy</Link>
            <Link to="/refunds" className="hover:text-t2 transition-colors">Refunds</Link>
            <Link to="/security" className="hover:text-t2 transition-colors">Security</Link>
            <Link to="/contact" className="hover:text-t2 transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <BuildBadge owner="finsavvyai" repo="pushci" style="minimal" />
            <span className="text-caption text-border-em font-mono">npx pushci init</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
