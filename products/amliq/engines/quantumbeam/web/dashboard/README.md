# QuantumBeam Dashboard

Real-time analytics and monitoring dashboard for QuantumBeam fraud detection system.

## Features

### 🎯 Core Functionality
- **Real-time Fraud Detection**: Live monitoring of transaction fraud detection with quantum-enhanced algorithms
- **System Health Monitoring**: Comprehensive monitoring of quantum backends and system components
- **Interactive Analytics**: Performance comparison between quantum and classical processing methods
- **User Management**: Role-based access control and API key management
- **Alert System**: Real-time notifications for fraud alerts and system events

### 🎨 Design & UX
- **Apple HIG Design**: Modern, intuitive interface following Apple Human Interface Guidelines
- **Dark/Light Theme**: Automatic theme switching with system preference detection
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support
- **Real-time Updates**: WebSocket-powered live data streaming

### ⚡ Performance
- **Sub-100ms Response**: Optimized for real-time monitoring requirements
- **Efficient Data Handling**: Smart caching and data aggregation
- **Lazy Loading**: Code splitting and on-demand component loading
- **Memory Management**: Optimized for long-running dashboard sessions

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with Apple HIG-inspired design system
- **Zustand** for state management
- **React Query** for server state management
- **Recharts** for interactive data visualization
- **Lucide React** for consistent iconography

### Development Tools
- **ESLint** with TypeScript support
- **Jest** and Testing Library for unit testing
- **PostCSS** for CSS processing
- **TypeScript** for type safety

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the dashboard directory
3. Install dependencies

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3001`

### Production Build

Create an optimized production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, etc.)
│   ├── charts/         # Chart components
│   ├── dashboard/      # Dashboard-specific components
│   └── layout/         # Layout components (Header, Sidebar)
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and helpers
├── pages/              # Page components
├── store/              # State management (Zustand)
├── types/              # TypeScript type definitions
└── styles/             # Global styles and CSS

```

## Key Components

### Charts & Visualization
- **MetricsChart**: Reusable chart component with multiple visualization types
- **FraudRateChart**: Specialized fraud rate visualization
- **QuantumAdvantageChart**: Quantum vs classical performance comparison

### Real-time Features
- **useWebSocket**: Custom hook for WebSocket connections
- **useFraudAlerts**: Real-time fraud alert management
- **useSystemStatus**: Live system health monitoring

### UI Components
- **Button**: Consistent button component with multiple variants
- **Card**: Flexible card layout component
- **Badge**: Status and notification badges
- **DropdownMenu**: Accessible dropdown menu component

## Configuration

### Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_REAL_TIME_UPDATES=true
```

### Dashboard Configuration

The dashboard configuration is managed through Zustand store and persists in localStorage:

- Theme preferences (light/dark/auto)
- Refresh intervals
- Notification thresholds
- Chart display preferences

## API Integration

### WebSocket Endpoints

- `/ws` - Real-time metrics and alerts
- `/ws/fraud-alerts` - Fraud alert notifications
- `/ws/system-status` - System health updates

### REST Endpoints

- `/api/v1/metrics` - Dashboard metrics
- `/api/v1/system/health` - System health status
- `/api/v1/users/profile` - User profile information
- `/api/v1/alerts` - Alert history and management

## Testing

### Unit Tests

Run unit tests with coverage:

```bash
npm run test
npm run test:coverage
```

### Component Testing

Test components in isolation:

```bash
npm run test -- components/Button.test.tsx
```

## Deployment

### Docker Deployment

Build Docker image:

```bash
docker build -t quantumbeam-dashboard .
```

Run container:

```bash
docker run -p 3001:80 quantumbeam-dashboard
```

### Static Hosting

The dashboard builds to static files and can be hosted on any static hosting service:

- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages

## Security Considerations

- All API calls are authenticated with JWT tokens
- WebSocket connections use secure protocols in production
- Input validation and sanitization
- Rate limiting on API endpoints
- Content Security Policy headers

## Performance Optimization

- Code splitting at route level
- Lazy loading of heavy components
- Image optimization
- Service worker for offline capabilities
- Efficient state management with Zustand

## Accessibility

- Full keyboard navigation support
- Screen reader compatibility
- ARIA labels and descriptions
- High contrast mode support
- Focus management

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new features
3. Update documentation for API changes
4. Ensure accessibility compliance
5. Test on multiple browsers and devices

## License

© 2024 QuantumBeam Inc. All rights reserved.