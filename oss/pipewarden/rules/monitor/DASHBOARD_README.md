# BSL Monitor Dashboard

A comprehensive monitoring dashboard for BSL interfaces with TCAD authentication (Norlys configuration).

## Features

- **Real-time Interface Monitoring**: Monitor API services, database connections, time-based monitoring, and JSON monitoring
- **TCAD Authentication**: Secure access using Norlys TCAD (Microsoft Azure AD)
- **Interactive Dashboard**: View status, execute checks, and see detailed error information
- **Modern React Frontend**: Responsive UI with real-time updates
- **Spring Boot Backend**: RESTful APIs for monitoring data

## Architecture

- **Backend**: Spring Boot 2.5.3 with Spring Security OAuth2
- **Frontend**: React 18 with Microsoft MSAL authentication
- **Authentication**: TCAD (Microsoft Azure AD) for Norlys users
- **Database**: Existing database connections (Oracle, PostgreSQL)

## Setup Instructions

### Prerequisites

- Java 8+
- Node.js 16+
- Gradle
- Access to Norlys TCAD tenant

### Configuration

1. **Frontend Configuration**:
   ```bash
   cd frontend
   cp .env.example .env
   ```
   Edit `.env` and add your Norlys TCAD client ID:
   ```
   REACT_APP_CLIENT_ID=your-norlys-client-id-here
   ```

2. **Backend Configuration**:
   The application is configured to use Norlys tenant ID in the OAuth2 settings.

### Development Setup

1. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Run in Development Mode**:
   ```bash
   ./run-dashboard.sh
   ```
   This starts both backend (port 8080) and frontend (port 3000).

3. **Access the Dashboard**:
   Open http://localhost:3000 in your browser.

### Production Build

1. **Build the Complete Application**:
   ```bash
   ./build-dashboard.sh
   ```
   This builds the React app and packages it with the Spring Boot JAR.

2. **Run the Production JAR**:
   ```bash
   java -jar build/libs/monitor-1.0.0-SNAPSHOT.jar
   ```

## API Endpoints

### Dashboard APIs (Authenticated)
- `GET /api/dashboard/status` - Get overall system status
- `GET /api/dashboard/interfaces` - Get detailed interface information
- `POST /api/dashboard/execute/{type}` - Execute specific interface checks

### Health Check (Public)
- `GET /sanity` - Basic health check endpoint

## Authentication Flow

1. User accesses the dashboard
2. If not authenticated, prompted to sign in with Norlys TCAD
3. After successful authentication, user can access the dashboard
4. JWT tokens are used for API authentication

## Dashboard Features

### Status Cards
- **API Services**: Monitor all API interface health
- **Database**: Check database connection status
- **Time-Based Monitoring**: Monitor time-based checks
- **JSON Monitoring**: Monitor JSON-based interfaces

### Interface Management
- View detailed error information
- Execute manual interface checks
- Real-time status updates (every 30 seconds)
- Tabbed interface for different monitoring types

### Error Reporting
- Detailed error messages
- Response XML/JSON viewing
- Environment and project context
- Historical error tracking

## Security

- **OAuth2 JWT**: Backend validates JWT tokens from Microsoft Azure AD
- **CORS**: Properly configured for frontend-backend communication
- **Authentication Required**: All dashboard APIs require valid authentication
- **Norlys Tenant**: Configured for Norlys TCAD tenant

## Monitoring Types

1. **API Services**: HTTP-based interface monitoring
2. **Database**: Connection health checks
3. **Time-Based**: Scheduled monitoring tasks
4. **JSON**: JSON-based interface validation

## Troubleshooting

### Common Issues

1. **Authentication Fails**:
   - Verify TCAD client ID is correct
   - Check Norlys tenant configuration
   - Ensure redirect URI is registered

2. **API Calls Fail**:
   - Check CORS configuration
   - Verify JWT token is being sent
   - Check backend OAuth2 configuration

3. **Build Issues**:
   - Ensure Node.js and npm are installed
   - Run `npm install` in frontend directory
   - Check Gradle configuration

### Logs
- Backend logs: Check Spring Boot application logs
- Frontend logs: Check browser console
- Network logs: Check browser network tab for API calls

## Development Notes

- Frontend proxies API calls to backend during development
- Production build serves React app from Spring Boot static resources
- Authentication state is managed by MSAL React library
- Real-time updates use polling (30-second intervals)

## Deployment

For production deployment, build the complete application and deploy the resulting JAR file to your application server. Ensure the following:

1. Correct TCAD client ID configuration
2. Proper SSL/TLS setup for HTTPS
3. Network access to monitored interfaces
4. Database connectivity
5. Email/SMS configuration for alerts