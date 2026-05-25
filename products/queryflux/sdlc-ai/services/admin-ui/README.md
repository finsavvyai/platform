# SDLC.ai Admin UI

A comprehensive Next.js 14 admin interface for the SDLC.ai platform, built with TypeScript, Tailwind CSS, and modern React patterns.

## 🚀 Features

- **Modern Tech Stack**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Authentication**: NextAuth.js with multiple providers (Google, GitHub, Credentials)
- **State Management**: Zustand with persistence
- **UI Components**: Radix UI primitives with custom styling
- **Responsive Design**: Mobile-first approach with breakpoints
- **Dark Mode**: Built-in theme switching with system preference detection
- **Component Documentation**: Storybook for component development and documentation
- **Testing**: Jest and Testing Library setup with comprehensive coverage
- **Development Tools**: ESLint, Prettier, TypeScript strict mode
- **Performance**: Optimized builds with code splitting and bundle analysis

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes
│   ├── dashboard/         # Dashboard page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── layout/            # Layout components (Header, Sidebar)
│   ├── navigation/        # Navigation components
│   ├── providers/         # React providers
│   └── ui/               # Reusable UI components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and constants
├── store/                # Zustand state management
├── types/                # TypeScript type definitions
└── __tests__/            # Test files
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL (for production)
- Redis (optional, for sessions)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd services/admin-ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Configure your environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-here
   
   # Optional: OAuth providers
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Development

1. **Build and run with Docker Compose**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

2. **Access services**
   - Admin UI: http://localhost:3000
   - Storybook: http://localhost:6006
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

## 📚 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run format` - Format code with Prettier
- `npm run storybook` - Start Storybook development server
- `npm run build-storybook` - Build Storybook for production
- `npm run analyze` - Analyze bundle size

## 🎨 Component Development

### Storybook

Explore and develop components in isolation:

```bash
npm run storybook
```

Visit [http://localhost:6006](http://localhost:6006) to view the component library.

### Creating Components

1. **UI Component Example**:
   ```tsx
   // src/components/ui/my-component.tsx
   import { cn } from '@/lib/utils'
   
   export interface MyComponentProps {
     className?: string
     children: React.ReactNode
   }
   
   export function MyComponent({ className, children }: MyComponentProps) {
     return (
       <div className={cn('p-4 border rounded-lg', className)}>
         {children}
       </div>
     )
   }
   ```

2. **Add Story**:
   ```tsx
   // src/components/ui/my-component.stories.tsx
   import type { Meta, StoryObj } from '@storybook/react'
   import { MyComponent } from './my-component'
   
   const meta: Meta<typeof MyComponent> = {
     title: 'UI/MyComponent',
     component: MyComponent,
   }
   
   export default meta
   type Story = StoryObj<typeof meta>
   
   export const Default: Story = {
     args: {
       children: 'Hello World',
     },
   }
   ```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

```tsx
// src/__tests__/components/my-component.test.tsx
import { render, screen } from '@testing-library/react'
import { MyComponent } from '@/components/ui/my-component'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent>Hello World</MyComponent>)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
```

## 🎯 State Management

### Zustand Stores

```tsx
// Example usage
import { useAuthStore } from '@/store/auth'

function MyComponent() {
  const { user, login, logout } = useAuthStore()
  
  return (
    <div>
      {user ? (
        <button onClick={logout}>Logout</button>
      ) : (
        <button onClick={() => login('user@example.com', 'password')}>
          Login
        </button>
      )}
    </div>
  )
}
```

## 🔐 Authentication

### NextAuth Configuration

The app uses NextAuth.js for authentication with support for:

- **Credentials** (Email/Password)
- **Google OAuth**
- **GitHub OAuth**

### Protected Routes

Routes are protected using middleware in `src/auth/middleware.ts`. Role-based access control is implemented through permissions.

## 🎨 Theming

### Dark Mode

The app supports automatic dark mode based on system preferences or manual selection:

```tsx
import { useTheme } from 'next-themes'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  )
}
```

### Custom Themes

Extend the theme system in `src/app/globals.css` by modifying CSS custom properties.

## 📱 Responsive Design

The app uses a mobile-first approach with Tailwind CSS breakpoints:

- **Mobile**: Default styles
- **Tablet**: `md:` prefix (768px+)
- **Desktop**: `lg:` prefix (1024px+)
- **Large Desktop**: `xl:` prefix (1280px+)

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

Ensure these are set in production:

```env
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=production-secret
DATABASE_URL=your-production-database-url
```

### Docker Production

```bash
# Build production image
docker build -t sdlc-admin-ui .

# Run container
docker run -p 3000:3000 sdlc-admin-ui
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write tests for new components and features
- Update Storybook stories for UI components

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the [documentation](./docs/)
- Review existing components in Storybook

## 🗺️ Roadmap

- [ ] Advanced analytics dashboard
- [ ] Real-time collaboration features
- [ ] Advanced user management
- [ ] Integration with third-party services
- [ ] Mobile app companion
- [ ] Advanced security features
- [ ] Performance monitoring
- [ ] A/B testing framework

---

Built with ❤️ for the SDLC.ai platform