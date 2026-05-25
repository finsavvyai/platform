# FinSavvyAI Desktop Application

A modern, cross-platform desktop application for managing the FinSavvyAI distributed AI cluster system. Built with Go backend, Rust/Tauri core, and web frontend technologies.

## 🚀 Features

### Core Functionality
- **Cluster Management**: Start, stop, and monitor your distributed AI cluster
- **Node Management**: Add, remove, and configure worker nodes dynamically
- **Real-time Monitoring**: Live cluster status with WebSocket updates
- **Model Management**: View and manage available AI models across nodes
- **Cross-platform Support**: Windows, macOS, and Linux ready

### User Interface
- **Professional Dashboard**: AWS-style interface with real-time metrics
- **Multi-tab Layout**: Dashboard, Nodes, Cluster, Monitoring sections
- **System Integration**: Tray notifications and background operation
- **Real-time Updates**: WebSocket-based live data streaming
- **Dark/Light Themes**: Professional theme switching

### Advanced Features
- **Configuration System**: AWS-style profiles and settings management
- **API Testing**: Built-in testing tools and stress testing
- **Activity Logging**: Real-time event tracking and history
- **Performance Metrics**: Response times, success rates, resource usage
- **WebSocket Communication**: Real-time bidirectional communication

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Desktop Application            │
├─────────────────────────────────────────┤
│  Frontend (HTML/CSS/JavaScript)          │
│  ┌─────────────┐ ┌─────────────────────┐ │
│  │   React UI  │ │    WebSocket       │ │
│  │ Components │ │    Client          │ │
│  └─────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────┤
│  Tauri (Rust Core)                      │
│  ┌─────────────┐ ┌─────────────────────┐ │
│  │   System    │ │   Native APIs      │ │
│  │ Integration │ │   (Menus, Tray)    │ │
│  └─────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────┤
│  Go Backend Service                     │
│  ┌─────────────┐ ┌─────────────────────┐ │
│  │   HTTP      │ │   WebSocket        │ │
│  │   Server    │ │   Server           │ │
│  └─────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────┤
│  Python Cluster API                    │
│  (Existing Backend)                     │
└─────────────────────────────────────────┘
```

## 📋 Requirements

### Development Dependencies
- **Rust** 1.70+ (with Cargo)
- **Go** 1.21+ 
- **Node.js** 18+ (with npm)
- **Python** 3.8+ (for cluster backend)

### Platform Support
- **Windows** 10/11 (x64)
- **macOS** 10.15+ (Intel & Apple Silicon)
- **Linux** (Ubuntu 20.04+, Debian 11+)

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd finsavvyai/desktop-app
```

### 2. Install Dependencies
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Go
# Visit https://golang.org/dl/

# Install Node.js
# Visit https://nodejs.org/

# Install Python 3
# Visit https://www.python.org/downloads/
```

### 3. Build and Run

#### Option A: Simple Development Mode
```bash
# Start Go backend
cd src-go
go build -o go-backend .
./go-backend &

# Start frontend
cd ../src-frontend
python3 -m http.server 3004
```

#### Option B: Using Build Scripts
```bash
# Development mode
./test.sh

# Production build
./build.sh build

# Create packages
./package.sh
```

### 4. Access the Application
Open your browser and go to: `http://localhost:3004`

- **Basic Interface**: `http://localhost:3004/simple.html`
- **Enhanced Interface**: `http://localhost:3004/enhanced.html`

## 🚀 Usage

### Starting the Application

1. **Start the Go Backend**:
   ```bash
   cd src-go && go run main.go
   ```

2. **Start the Frontend**:
   ```bash
   cd src-frontend && python3 -m http.server 3004
   ```

3. **Access the Dashboard**: `http://localhost:3004/enhanced.html`

### Basic Operations

#### Cluster Management
- **Start Cluster**: Click "Start Cluster" button
- **Stop Cluster**: Click "Stop Cluster" button
- **View Status**: Monitor cluster health and node status

#### Node Management
- **Add Node**: Fill in node details in the Nodes tab
- **Remove Node**: Click remove button on node cards
- **Monitor Status**: Real-time node status updates

#### Configuration
- **Cluster Settings**: Modify master host/port in Cluster tab
- **Application Settings**: Adjust themes and preferences
- **API Configuration**: Set timeouts and authentication

## 📊 API Reference

### Backend API (Port 8080)

#### Cluster Management
- `GET /api/cluster/status` - Get cluster status
- `GET /api/cluster/nodes` - List all nodes
- `POST /api/cluster/nodes` - Add new node
- `DELETE /api/cluster/nodes/delete?id=<node-id>` - Remove node
- `POST /api/cluster/start` - Start cluster
- `POST /api/cluster/stop` - Stop cluster

#### Configuration
- `GET /api/config` - Get application config
- `POST /api/config` - Update configuration

#### WebSocket
- `ws://localhost:8080/ws` - Real-time updates

### Request Examples

#### Add a Node
```bash
curl -X POST http://localhost:8080/api/cluster/nodes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming PC",
    "host": "192.168.1.100",
    "port": 8001,
    "models": ["gpt-3.5-turbo", "gpt-4"]
  }'
```

#### Get Cluster Status
```bash
curl http://localhost:8080/api/cluster/status
```

## 🧪 Testing

### Run Test Suite
```bash
./test.sh
```

### Manual Testing
1. **API Testing**: Use the Monitoring tab's testing tools
2. **Stress Testing**: Built-in stress testing for performance
3. **WebSocket Testing**: Test real-time communication
4. **Node Management**: Add/remove nodes and verify status

### Test Results
All tests should pass with the following metrics:
- Build time: < 5 seconds
- Binary size: < 50MB
- Memory usage: < 100MB idle
- API response time: < 100ms

## 📦 Building & Distribution

### Development Build
```bash
./build.sh dev
```

### Production Build
```bash
./build.sh build
```

### Create Packages
```bash
./package.sh
```

### Output Packages
- **macOS**: `.zip` file (universal binary)
- **Windows**: `.zip` file
- **Linux**: `.deb` and `.tar.gz` files

## 🔧 Configuration

### Application Configuration
Configuration is stored in `~/.finsavvyai/desktop-config.json`:

```json
{
  "server": {
    "host": "localhost",
    "port": 8080
  },
  "cluster": {
    "master_host": "localhost",
    "master_port": 8000,
    "api_key": "",
    "timeout": 30
  },
  "ui": {
    "theme": "dark",
    "language": "en",
    "auto_start": false,
    "minimize_to_tray": true,
    "show_notifications": true,
    "refresh_interval": 5
  }
}
```

### Environment Variables
- `PORT` - Backend server port (default: 8080)
- `FRONTEND_PORT` - Frontend server port (default: 3004)

## 🐛 Troubleshooting

### Common Issues

#### "Backend not responding"
- Check if Go server is running on port 8080
- Verify no firewall is blocking connections
- Check application logs for errors

#### "Frontend not loading"
- Ensure Python server is running on port 3004
- Check browser console for JavaScript errors
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)

#### "WebSocket connection failed"
- WebSocket connection will retry automatically
- Check if backend server is responding
- Network connectivity issues may cause disconnections

#### "Python cluster connection refused"
- This is normal when Python cluster backend is not running
- Application provides mock data in this mode
- Start Python cluster master on port 8000 for full functionality

### Debug Mode

Enable debug logging:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
window.location.reload();
```

### Performance Issues

1. **High memory usage**: 
   - Reduce auto-refresh interval
   - Close unused browser tabs
   - Restart application

2. **Slow startup**:
   - Check for conflicting processes
   - Restart development servers
   - Clear temporary files

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (`./test.sh`)
5. Submit a pull request

### Code Style
- **Go**: Follow standard Go formatting
- **Rust**: Use `rustfmt` and `clippy`
- **JavaScript**: ESLint with Prettier
- **HTML/CSS**: Follow BEM methodology

### Project Structure
```
desktop-app/
├── src-go/           # Go backend services
├── src-tauri/        # Rust/Tauri core
├── src-frontend/      # Web UI
├── docs/              # Documentation
├── build.sh          # Build script
├── test.sh           # Test suite
├── package.sh        # Package creation
└── README.md         # This file
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Documentation**: [FinSavvyAI Docs](https://docs.finsavvyai.com)
- **Issues**: [GitHub Issues](https://github.com/finsavvyai/finsavvyai-cluster/issues)
- **Discussions**: [GitHub Discussions](https://github.com/finsavvyai/finsavvyai-cluster/discussions)
- **Email**: support@finsavvyai.com

## 🔮 Roadmap

### v1.1 (Planned)
- [ ] Plugin system support
- [ ] Advanced analytics and charting
- [ ] Multi-cluster management
- [ ] Cloud provider integration
- [ ] Mobile companion app

### v1.2 (Future)
- [ ] Advanced security features
- [ ] Performance optimization
- [ ] Enhanced monitoring
- [ ] Additional language support

## 🏆 Acknowledgments

- **Tauri Team**: For the amazing cross-platform framework
- **Golang Team**: For the powerful backend language
- **Rust Community**: For performance and safety
- **AWS**: For design inspiration and UX patterns

---

**FinSavvyAI Desktop** - Making distributed AI accessible to everyone. 🚀

*Built with ❤️ using Go, Rust, and modern web technologies*  
*FinSavvyAI Desktop v1.0.0*