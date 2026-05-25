# Quick Start Guide - BSL Monitor Dashboard
## 🌌 Futuristic Apple Design with HDI Guidelines

Experience next-generation interface monitoring with floating 3D elements, glassmorphism effects, and dark mode aesthetics inspired by Apple's design language.

## 🚀 Getting Started

### 1. Configure TCAD Authentication

```bash
# Set up frontend environment
cd frontend
cp .env.example .env
# Edit .env and add your Norlys TCAD client ID:
# REACT_APP_CLIENT_ID=your-norlys-client-id-here
```

### 2. Development Mode (Recommended for Testing)

```bash
# Install dependencies and start both frontend and backend
./run-dashboard.sh
```

This will:
- Start Spring Boot backend on port 9098 (all environments)
- Start React frontend on port 3000
- Open http://localhost:3000 in your browser

### 3. Production Build

```bash
# Build everything into a single JAR
./build-dashboard.sh

# Run the production JAR
java -jar build/libs/monitor-1.0.0-SNAPSHOT.jar
```

## 🔐 Authentication

- Users must authenticate with Norlys TCAD credentials
- Dashboard APIs require valid JWT tokens
- Public endpoints: `/sanity`, static resources

## 🎨 Design Features

### Futuristic UI Elements
- **Glassmorphism**: Translucent cards with backdrop blur
- **3D Floating**: Cards with depth and hover animations
- **Dark Mode**: High-contrast Apple-inspired theme
- **HDI Guidelines**: Human Device Interface best practices
- **Smooth Animations**: Cubic-bezier transitions and micro-interactions

### Status Overview
- **Glowing Indicators**: Animated status dots with real-time updates
- **Color-coded Health**: Apple system colors (SF Blue, Green, Red, Orange)
- **Real-time**: Live updates every 30 seconds with pulse animations

### Interface Types
1. **🌐 API Services**: External interface monitoring with floating cards
2. **🗄️ Database**: Connection integrity with 3D hover effects  
3. **⏰ Time-Based**: Scheduled operations with animated timelines
4. **📋 JSON**: Data validation with glassmorphism panels

### Interactive Elements
- **⚡ Execute Checks**: Animated buttons with shimmer effects
- **📋 Expandable Details**: Smooth accordion interfaces
- **🔄 Auto-refresh**: Floating refresh controls with loading states

## 🛠️ Troubleshooting

### Common Issues

1. **"Sign in required"**
   - Verify TCAD client ID in `.env`
   - Check Norlys tenant configuration

2. **"API calls failing"**
   - Ensure backend is running on port 9098
   - Check browser console for errors
   - Local development allows unauthenticated API access

3. **"Build failures"**
   - Run `npm install` in frontend directory
   - Ensure Java 8+ and Node.js 16+ installed

### Check Status
```bash
# Verify backend health
curl http://localhost:9098/sanity

# Test local dashboard API (no auth required)
curl http://localhost:9098/api/dashboard/status

# Check if services are running
ps aux | grep java
ps aux | grep react

# Run complete local test
./test-local.sh
```

## 📁 Project Structure

```
monitor/
├── frontend/                 # React dashboard
│   ├── src/components/      # React components
│   ├── public/             # Static files
│   └── package.json        # Dependencies
├── src/main/java/          # Spring Boot backend
│   └── com/bsl/service/monitor/
│       ├── controller/     # REST endpoints
│       ├── config/         # Security config
│       └── service/        # Business logic
├── build-dashboard.sh      # Production build
├── run-dashboard.sh        # Development mode
└── DASHBOARD_README.md     # Full documentation
```

## 🌐 URLs

- **Development Frontend**: http://localhost:3000 (Futuristic UI)
- **Development Backend**: http://localhost:9098
- **Production (single JAR)**: http://localhost:9098
- **Health Check**: `/sanity`
- **Dashboard API**: `/api/dashboard/*`

## 📋 Next Steps

1. Configure your Norlys TCAD client ID
2. Run in development mode to test
3. Customize monitoring interfaces as needed
4. Deploy to production environment
5. Set up SSL/HTTPS for production use

For detailed information, see `DASHBOARD_README.md`.