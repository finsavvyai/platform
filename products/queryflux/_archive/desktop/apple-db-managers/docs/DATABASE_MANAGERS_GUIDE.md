# 🚀 Database Managers Collection Guide

## Overview
This repository contains multiple Apple-style database management applications with different designs and features.

## 📁 File Structure & Screen Designs

### 1. **Ultimate Apple DB Manager** ⭐ (Most Feature-Rich)
- **File:** `ultimate_apple_db_manager.py`
- **Launcher:** `./launch_ultimate_apple_db.sh`
- **Screens Designed:**
  - **Database Selection Screen** (Lines 427-533): Beautiful card-based database selector with 12 database types
  - **Connection Dialog** (Lines 535-925): Two-step connection process with form validation
  - **Main Application** (Lines 927-1321): Full database management interface with themes
- **Features:**
  - 12+ database types with colored icons
  - Dark/Light theme support
  - Famous SQL editor themes (VS Code, Sublime, Atom, Monokai, Dracula)
  - Search functionality
  - Two-step connection workflow

### 2. **Beautiful Apple DB Manager** 🎨
- **File:** `beautiful_apple_db_manager.py`
- **Launcher:** `./launch_beautiful_apple_db.sh`
- **Screens Designed:**
  - **Main Window** (Lines 318-382): Clean Apple-style interface
  - **Connection Dialog** (Lines 887-975): Simple connection form
  - **Data Tables** (Lines 552-649): Beautiful data browsing
- **Features:**
  - Clean, polished Apple design
  - Focus on PostgreSQL
  - Beautiful gradients and spacing

### 3. **Apple Native DB Manager** 🍎
- **File:** `apple_native_db_manager.py`
- **Launcher:** `./launch_native_apple_db.sh`
- **Screens Designed:**
  - **Toolbar** (Lines 263-306): Native macOS-style toolbar
  - **Sidebar** (Lines 333-362): Schema and object browser
  - **Tabs Interface** (Lines 364-438): Structure, Data, Query tabs
- **Features:**
  - Native macOS appearance
  - Clean minimalist design
  - System-integrated controls

### 4. **Apple 3D DB Manager** ✨
- **File:** `apple_db_manager.py`
- **Launcher:** `./launch_apple_3d_db.sh`
- **Screens Designed:**
  - **3D Effects Theme** (Lines 17-181): Advanced styling with depth
  - **Animated Components** (Lines 184-310): Hover animations
  - **Floating Cards** (Lines 243-258): 3D shadow effects
- **Features:**
  - 3D visual effects
  - Animated buttons and transitions
  - Glassmorphism elements

### 5. **Qt Dark Apple Manager** 🌙
- **File:** `apple_qt_dark_manager.py`
- **Launcher:** `./launch_qt_dark_apple_db.sh`
- **Screens Designed:**
  - **Unified Toolbar** (Lines 119-168): macOS unified toolbar
  - **Enhanced Sidebar** (Lines 200-249): Professional navigation
  - **Query Editor** (Lines 366-421): Syntax-highlighted SQL editor
- **Features:**
  - System dark/light mode integration
  - Qt native widgets
  - Professional toolbar

## 🔧 Database Adapters System
- **File:** `db_adapters.py`
- **Purpose:** Unified database connection architecture
- **Supported Databases:**
  - PostgreSQL (Full implementation)
  - MySQL/MariaDB (Full implementation)
  - MongoDB (Full implementation)
  - Redis (Full implementation)
  - SQLite (Coming soon)
  - Oracle (Coming soon)
  - SQL Server (Coming soon)
  - ClickHouse (Coming soon)
  - Cassandra (Coming soon)
  - Elasticsearch (Coming soon)
  - InfluxDB (Coming soon)

## 🎨 Display Issues & Fixes

### Common Display Issues:
1. **Window Too Large:** Adjust in setup_window() method
2. **Font Issues:** Replace "JetBrains Mono" with "Monaco" or system font
3. **Theme Not Loading:** qdarktheme is optional, falls back to custom theme
4. **Cards Not Aligned:** Check grid layout spacing in create_database_grid()

### Quick Fixes:
```python
# In any manager file, adjust window size:
self.setGeometry(100, 100, 1200, 800)  # Reduce from 1400, 900
self.setMinimumSize(900, 600)  # Reduce from 1000, 700

# Fix font issues:
# Replace "JetBrains Mono" with "Monaco" or "Courier"
font = QFont("Monaco", 12)  # Instead of QFont("JetBrains Mono", 13)
```

## 🚀 Installation & Setup

### Prerequisites:
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install core dependencies
pip install PySide6 psycopg2-binary

# Optional dependencies for full support
pip install mysql-connector-python pymongo redis
```

### Running the Applications:

#### For Best Experience (Ultimate):
```bash
./launch_ultimate_apple_db.sh
```

#### For Clean Design (Beautiful):
```bash
./launch_beautiful_apple_db.sh
```

#### For Native Feel (Native):
```bash
./launch_native_apple_db.sh
```

## 📐 Screen Resolution Requirements

- **Minimum:** 1280x720
- **Recommended:** 1440x900 or higher
- **Optimal:** 1920x1080 (Full HD)

## 🛠️ Customization Guide

### Changing Window Size:
Edit the respective `.py` file and modify the `setup_window()` method:
```python
self.setGeometry(100, 100, WIDTH, HEIGHT)
```

### Changing Database Icons:
In `ultimate_apple_db_manager.py`, line 667-680, modify the database list:
```python
databases = [
    ("postgresql", "PostgreSQL", "Port: 5432", "🐘", "#5865BB"),
    # Add or modify entries here
]
```

### Changing Themes:
In `UltimateThemeManager` class (line 21-181), modify color schemes:
```python
'bg_primary': '#1e1e1e',  # Change background color
'accent': '#007acc',       # Change accent color
```

## 📝 Development Notes

### File Locations:
- **Main Applications:** Root directory (`/Users/shaharsolomon/dev/projects/postgres-docker/`)
- **Launchers:** Root directory (`launch_*.sh`)
- **Database Adapters:** `db_adapters.py`
- **Documentation:** This file (`DATABASE_MANAGERS_GUIDE.md`)

### Architecture:
1. **UI Layer:** PySide6 (Qt) for cross-platform GUI
2. **Database Layer:** Individual adapters for each database type
3. **Theme System:** Dynamic theme switching with fallbacks
4. **Connection Management:** Two-step process (select DB → enter credentials)

## 🐛 Troubleshooting

### Issue: Window appears off-screen
**Solution:** Reduce window size in setup_window()

### Issue: Fonts look wrong
**Solution:** Use system fonts: "-apple-system" or "SF Pro Display"

### Issue: Cards not visible
**Solution:** Check grid_layout.setSpacing(20) in create_database_grid()

### Issue: Theme not applying
**Solution:** qdarktheme is optional, custom theme always works as fallback

## 📚 Resources

- **PySide6 Documentation:** https://doc.qt.io/qtforpython/
- **PostgreSQL psycopg2:** https://www.psycopg.org/docs/
- **MySQL Connector:** https://dev.mysql.com/doc/connector-python/en/
- **MongoDB PyMongo:** https://pymongo.readthedocs.io/

## 🤝 Contributing

To add a new database type:
1. Add adapter in `db_adapters.py`
2. Add card in `ultimate_apple_db_manager.py` database list
3. Update connection logic
4. Test with launcher script

## 📄 License

This project is part of the postgres-docker repository.