# QuantumBeam Marketing Website

A Next.js 14 marketing website showcasing the AMLIQ Fraud Engine's classical machine-learning fraud detection.

## 🌟 Features

- **Quantum-Themed Design**: Custom animations and visual effects inspired by quantum computing
- **Responsive Layout**: Mobile-first design with smooth animations using Framer Motion
- **Interactive Components**: Feature cards, pricing plans, and API documentation
- **Lead Generation**: Complete sign-up flow with form validation
- **API Documentation**: Interactive code examples and WebSocket integration
- **SEO Optimized**: Comprehensive metadata and structured data
- **TypeScript**: Full type safety throughout the application
- **Testing**: Unit tests with Vitest and React Testing Library

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/quantumbeam/marketing.git
cd marketing
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
marketing/
├── app/                    # Next.js 14 App Router
│   ├── page.tsx           # Homepage with hero section and features
│   ├── api-docs/          # API documentation page
│   ├── get-started/       # Sign-up and pricing page
│   ├── layout.tsx         # Root layout with SEO metadata
│   └── globals.css        # Global styles and quantum animations
├── components/            # Reusable React components
│   └── ui/               # Base UI components
├── lib/                  # Utility functions
├── __tests__/            # Test files
├── public/               # Static assets
├── tailwind.config.js    # Tailwind CSS configuration
├── next.config.js        # Next.js configuration
├── vitest.config.ts      # Test configuration
└── package.json          # Dependencies and scripts
```

## 🎨 Design System

### Colors

The website uses a quantum-themed color palette:

- **Quantum Blue**: Primary brand color (`#0ea5e9`)
- **Brand Purple**: Secondary accent (`#8b5cf6`)
- **Brand Pink**: Tertiary accent (`#ec4899`)
- **Brand Cyan**: Additional accent (`#06b6d4`)

### Animations

Custom animations include:

- `quantum-pulse`: Gentle pulsing effect
- `quantum-glow`: Glowing shadow effect
- `gradient-x`: Horizontal gradient animation
- `particle-float`: Floating particle animation
- `float`: Vertical floating motion

### Typography

- **Inter**: Primary font family
- **Inter Display**: Display headlines

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run export       # Build and export static site
```

## 🧪 Testing

The project uses Vitest for unit testing with React Testing Library. Test files are located in the `__tests__` directory.

### Running Tests

```bash
# Run all tests in watch mode
npm run test

# Run tests once
npm run test:run

# Run tests with visual UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Structure

- `homepage.test.tsx` - Tests for main homepage components
- `api-docs.test.tsx` - Tests for API documentation page
- `get-started.test.tsx` - Tests for sign-up and pricing page

## 📱 Pages

### Homepage (`/`)

- Hero section with quantum animations
- Quantum-themed feature showcase
- Technology explanation
- Call-to-action sections

### API Documentation (`/api-docs`)

- Authentication guide
- Interactive code examples
- WebSocket integration
- Error handling documentation
- Rate limits information

### Get Started (`/get-started`)

- Pricing plans comparison
- Lead generation form with validation
- Use cases showcase
- Sign-up flow with success state

## 🔧 Configuration

### Next.js Configuration

- **Static Export**: Configured for static hosting
- **Security Headers**: Custom security headers configuration
- **Image Optimization**: Disabled for static compatibility

### Tailwind CSS Configuration

- **Custom Colors**: Quantum-themed color palette
- **Animations**: Custom keyframes and animation utilities
- **Components**: Custom component classes
- **Responsive Design**: Mobile-first breakpoints

### TypeScript Configuration

- **Strict Mode**: Enabled for type safety
- **Path Aliases**: Configured for clean imports
- **Component Types**: Proper typing for all components

## 🚀 Deployment

### Static Export

The project is configured for static export:

```bash
npm run export
```

This generates a static `out` directory that can be deployed to any static hosting service.

### Environment Variables

Create a `.env.local` file for development:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CUSTOM_KEY=your-custom-key
```

## 📊 Performance

- **Lighthouse Score**: Optimized for 95+ scores
- **Core Web Vitals**: Within recommended thresholds
- **Bundle Size**: Optimized with code splitting
- **Image Optimization**: WebP format with lazy loading

## 🔒 Security

- **Content Security Policy**: Configured security headers
- **XSS Protection**: Built-in XSS protection
- **Frame Protection**: Clickjacking prevention
- **HTTPS Only**: Enforced secure connections

## 🌐 SEO

- **Meta Tags**: Comprehensive metadata configuration
- **Structured Data**: JSON-LD schema markup
- **Sitemap**: Auto-generated sitemap
- **Robots.txt**: Search engine directives
- **Open Graph**: Social media optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email [support@quantumbeam.io](mailto:support@quantumbeam.io) or visit our [documentation](https://docs.quantumbeam.io).

## 🔗 Links

- [Main Website](https://quantumbeam.io)
- [Documentation](https://docs.quantumbeam.io)
- [API Reference](https://api.quantumbeam.io)
- [Status Page](https://status.quantumbeam.io)

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS