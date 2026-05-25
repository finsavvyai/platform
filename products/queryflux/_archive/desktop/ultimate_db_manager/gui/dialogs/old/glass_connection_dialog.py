"""
Glass Connection Dialog with 3D Database Icons and Apple Design
Beautiful glassmorphism UI for database connections
"""

from typing import Optional, Dict, Any
from urllib.parse import urlparse, parse_qs
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QGridLayout,
    QLabel, QLineEdit, QComboBox, QSpinBox, QCheckBox,
    QPushButton, QTabWidget, QWidget, QTextEdit, QFrame,
    QGroupBox, QMessageBox, QProgressBar, QScrollArea,
    QListWidget, QListWidgetItem, QSizePolicy
)
from PySide6.QtCore import Qt, QThread, Signal, QTimer, QPropertyAnimation, QEasingCurve, QSize
from PySide6.QtGui import QIcon, QFont, QPainter, QBrush, QPen, QLinearGradient, QPixmap, QColor

from ..apple_glass_design import (
    AppleGlassColors, DatabaseIcons, AppleGlassEffects, 
    AppleGlassStyleSheet, GlassWidget, GlassButton
)
from ...adapters.base_adapter import DatabaseType


class DatabaseTypeCard(GlassWidget):
    """Beautiful 3D database type selection card"""
    
    def __init__(self, db_type: str, description: str, parent=None):
        super().__init__(parent)
        self.db_type = db_type
        self.description = description
        self.is_selected = False
        
        # Set default brand color based on database type
        color_map = {
            # SQL Databases
            "PostgreSQL": "#336791",
            "MySQL": "#00758F", 
            "SQLite": "#003B57",
            "Oracle": "#F80000",
            "SQL Server": "#CC2927",
            "MariaDB": "#003545",
            
            # NoSQL Databases
            "MongoDB": "#4DB33D",
            "Redis": "#DC382D",
            "Cassandra": "#1287B1",
            "CouchDB": "#E42528",
            "Neo4j": "#008CC1",
            
            # Cloud Databases
            "Supabase": "#3ECF8E",
            "PlanetScale": "#000000",
            "Neon": "#00E599",
            "Railway": "#0B0D0E",
            "AWS RDS": "#FF9900",
            
            # Time Series Databases
            "InfluxDB": "#22ADF6",
            "TimescaleDB": "#FDB515",
            "Prometheus": "#E6522C",
            "ClickHouse": "#FFCC02"
        }
        self.brand_color = QColor(color_map.get(db_type, "#336791"))
        
        self.setup_card()
    
    def setup_card(self):
        """Setup the database card UI"""
        self.setFixedSize(160, 120)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(15, 15, 15, 15)
        layout.setSpacing(8)
        
        # Database icon with beautiful brand color background
        icon_container = QWidget()
        icon_container.setFixedSize(48, 48)
        icon_container.setStyleSheet(f"""
            QWidget {{
                background: qradialgradient(cx:0.5, cy:0.3, radius:0.9,
                    stop:0 {self.brand_color.lighter(130).name()},
                    stop:0.6 {self.brand_color.name()},
                    stop:1 {self.brand_color.darker(110).name()});
                border-radius: 24px;
                border: 1px solid rgba(255, 255, 255, 0.4);
            }}
        """)
        
        icon_layout = QVBoxLayout(icon_container)
        icon_layout.setContentsMargins(0, 0, 0, 0)
        
        icon_label = QLabel()
        icon = DatabaseIcons.create_database_icon(self.db_type, 32)
        icon_label.setPixmap(icon.pixmap(32, 32))
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon_layout.addWidget(icon_label)
        
        # Center the icon container
        icon_container_layout = QHBoxLayout()
        icon_container_layout.addStretch()
        icon_container_layout.addWidget(icon_container)
        icon_container_layout.addStretch()
        layout.addLayout(icon_container_layout)
        
        # Database name
        name_label = QLabel(self.db_type)
        name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name_label.setStyleSheet("""
            QLabel {
                font-size: 13px;
                font-weight: 700;
                color: #333333;
                background: transparent;
                border: none;
                margin-top: 4px;
            }
        """)
        layout.addWidget(name_label)
        
        # Description (smaller and more subtle)
        desc_label = QLabel(self.description)
        desc_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        desc_label.setWordWrap(True)
        desc_label.setStyleSheet("""
            QLabel {
                font-size: 9px;
                color: #888888;
                background: transparent;
                border: none;
                line-height: 1.2;
                margin-top: 1px;
            }
        """)
        layout.addWidget(desc_label)
        
        # Setup hover animation
        self.hover_animation = QPropertyAnimation(self, b"geometry")
        self.hover_animation.setDuration(200)
        self.hover_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
    
    def set_selected(self, selected: bool):
        """Set selection state"""
        self.is_selected = selected
        self.update()
    
    def paintEvent(self, event):
        """Custom paint with clean selection highlight"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        rect = self.rect()
        
        if self.is_selected:
            # Selected state - clean blue highlight
            painter.setBrush(QBrush(QColor(0, 122, 255, 20)))
            painter.setPen(QPen(QColor(0, 122, 255, 180), 2))
        else:
            # Normal state - clean white background
            painter.setBrush(QBrush(QColor(255, 255, 255, 1.0)))
            painter.setPen(QPen(QColor(220, 220, 220, 0.8), 1))
        
        painter.drawRoundedRect(rect.adjusted(1, 1, -1, -1), 12, 12)
    
    def enterEvent(self, event):
        """Handle hover enter"""
        if not self.is_selected:
            current_rect = self.geometry()
            new_rect = current_rect.adjusted(-3, -3, 3, 3)
            
            self.hover_animation.setStartValue(current_rect)
            self.hover_animation.setEndValue(new_rect)
            self.hover_animation.start()
        
        super().enterEvent(event)
    
    def leaveEvent(self, event):
        """Handle hover leave"""
        if not self.is_selected:
            current_rect = self.geometry()
            original_rect = current_rect.adjusted(3, 3, -3, -3)
            
            self.hover_animation.setStartValue(current_rect)
            self.hover_animation.setEndValue(original_rect)
            self.hover_animation.start()
        
        super().leaveEvent(event)
    
    def mousePressEvent(self, event):
        """Handle mouse press for selection"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.parent().select_database_type(self.db_type)
        super().mousePressEvent(event)


class ConnectionTestThread(QThread):
    """Thread for testing database connections with beautiful progress"""
    
    result_ready = Signal(bool, str)  # success, message
    progress_update = Signal(str)  # status message
    
    def __init__(self, db_type: str, host: str, port: int, database: str, username: str, password: str):
        super().__init__()
        self.db_type = db_type
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        
    def run(self):
        """Test the database connection with progress updates"""
        try:
            self.progress_update.emit("🔍 Resolving hostname...")
            self.msleep(500)  # Simulate network delay
            
            self.progress_update.emit("🔌 Establishing connection...")
            self.msleep(300)
            
            if self.db_type == "PostgreSQL":
                import psycopg2
                conn = psycopg2.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.username,
                    password=self.password,
                    connect_timeout=10
                )
                
                self.progress_update.emit("✅ Verifying credentials...")
                self.msleep(200)
                
                # Test a simple query
                cursor = conn.cursor()
                cursor.execute("SELECT version();")
                version = cursor.fetchone()[0]
                cursor.close()
                conn.close()
                
                self.result_ready.emit(True, f"✅ PostgreSQL connection successful!\n\n🔗 Server: {self.host}:{self.port}\n📊 Database: {self.database}\n🏷️ Version: {version[:50]}...")
                
            elif self.db_type == "MySQL":
                import pymysql
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.username,
                    password=self.password,
                    connect_timeout=10
                )
                
                self.progress_update.emit("✅ Verifying credentials...")
                self.msleep(200)
                
                cursor = conn.cursor()
                cursor.execute("SELECT VERSION();")
                version = cursor.fetchone()[0]
                cursor.close()
                conn.close()
                
                self.result_ready.emit(True, f"✅ MySQL connection successful!\n\n🔗 Server: {self.host}:{self.port}\n📊 Database: {self.database}\n🏷️ Version: {version}")
                
            elif self.db_type == "SQLite":
                import sqlite3
                conn = sqlite3.connect(self.database, timeout=10)
                
                self.progress_update.emit("✅ Verifying database file...")
                self.msleep(200)
                
                cursor = conn.cursor()
                cursor.execute("SELECT sqlite_version();")
                version = cursor.fetchone()[0]
                cursor.close()
                conn.close()
                
                self.result_ready.emit(True, f"✅ SQLite connection successful!\n\n📁 File: {self.database}\n🏷️ SQLite Version: {version}")
                
            else:
                self.result_ready.emit(False, f"❌ {self.db_type} testing not implemented yet\n\n🚧 This database type is coming soon!")
                
        except ImportError as e:
            self.result_ready.emit(False, f"❌ Missing database driver\n\n📦 Please install the required driver:\n{str(e)}")
        except Exception as e:
            self.result_ready.emit(False, f"❌ Connection failed\n\n🔍 Error details:\n{str(e)}")


class GlassConnectionDialog(QDialog):
    """Beautiful glass connection dialog with 3D effects"""
    
    connection_created = Signal(dict)  # connection info
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("New Database Connection")
        self.setModal(True)
        self.setWindowModality(Qt.ApplicationModal)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.WindowTitleHint | Qt.WindowType.WindowCloseButtonHint)
        self.resize(900, 700)
        self.test_thread = None
        self.selected_db_type = "PostgreSQL"
        
        # Define consistent color scheme
        self.colors = {
            'primary': '#007bff',
            'success': '#28a745',
            'danger': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8',
            'light': '#f8f9fa',
            'dark': '#343a40',
            'border': '#dee2e6',
            'text': '#212529',
            'text_muted': '#6c757d'
        }
        
        # Define consistent spacing
        self.spacing = {
            'small': 8,
            'medium': 16,
            'large': 24
        }
        
        self.setup_professional_ui()
        
    def setup_professional_ui(self):
        """Setup clean, professional UI"""
        # Main layout with proper spacing
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(self.spacing['large'], self.spacing['large'],
                                     self.spacing['large'], self.spacing['large'])
        main_layout.setSpacing(self.spacing['medium'])

        # Header section - more compact
        header_widget = QWidget()
        header_layout = QVBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)
        header_layout.setSpacing(4)

        title_label = QLabel("Connect to Database1")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title_label.setStyleSheet(f"""
            QLabel {{
                font-size: 22px;
                font-weight: 600;
                color: {self.colors['text']};
                margin-bottom: 2px;
            }}
        """)
        header_layout.addWidget(title_label)

        subtitle_label = QLabel("Browse database types by category using tabs below")
        subtitle_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle_label.setStyleSheet(f"""
            QLabel {{
                font-size: 13px;
                color: {self.colors['text_muted']};
            }}
        """)
        header_layout.addWidget(subtitle_label)

        main_layout.addWidget(header_widget)
        
        # Database type selection section - no group box, just tabs
        db_selection_widget = QWidget()
        db_selection_layout = QVBoxLayout(db_selection_widget)
        db_selection_layout.setContentsMargins(0, 0, 0, 0)
        db_selection_layout.setSpacing(0)
        
        # Create tab widget for database categories
        self.db_tabs = QTabWidget()
        self.db_tabs.setTabPosition(QTabWidget.TabPosition.North)
        self.db_tabs.setMinimumHeight(320)
        self.db_tabs.setMaximumHeight(380)
        self.db_tabs.setUsesScrollButtons(True)
        self.db_tabs.setElideMode(Qt.TextElideMode.ElideNone)

        # Apply beautiful modern tab styling
        self.db_tabs.setStyleSheet("""
            QTabWidget::pane {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 0.98),
                    stop:1 rgba(248, 250, 252, 0.95));
                border: 1px solid rgba(230, 230, 230, 0.8);
                border-radius: 16px;
                margin-top: 16px;
                padding: 20px;
            }

            QTabBar {
                background: transparent;
                border: none;
            }

            QTabBar::tab {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(248, 250, 252, 0.9),
                    stop:1 rgba(241, 245, 249, 0.8));
                border: 1px solid rgba(226, 232, 240, 0.8);
                padding: 12px 24px;
                margin-right: 4px;
                border-top-left-radius: 12px;
                border-top-right-radius: 12px;
                border-bottom: none;
                font-weight: 500;
                font-size: 13px;
                color: rgba(100, 116, 139, 255);
                min-width: 80px;
                height: 18px;
            }

            QTabBar::tab:selected {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 1.0),
                    stop:1 rgba(255, 255, 255, 0.95));
                border: 1px solid rgba(59, 130, 246, 0.6);
                border-bottom: 1px solid white;
                color: rgba(59, 130, 246, 255);
                font-weight: 600;
                margin-bottom: -1px;
                z-index: 1;
            }

            QTabBar::tab:hover:!selected {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(239, 246, 255, 0.95),
                    stop:1 rgba(219, 234, 254, 0.9));
                color: rgba(59, 130, 246, 180);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-bottom: none;
            }

            QTabBar::tab:first {
                margin-left: 8px;
            }

            QTabBar::tab:last {
                margin-right: 8px;
            }
        """)
        
        # Database types organized by category
        db_categories = {
            "Popular": [
                ("PostgreSQL", "Advanced open-source\nrelational database"),
                ("MySQL", "Popular relational\ndatabase system"),
                ("MongoDB", "Document-oriented\nNoSQL database"),
                ("Redis", "In-memory data\nstructure store"),
                ("SQLite", "Lightweight embedded\ndatabase file"),
                ("MariaDB", "MySQL-compatible\ndatabase")
            ],
            "SQL": [
                ("PostgreSQL", "Advanced open-source\nrelational database"),
                ("MySQL", "Popular relational\ndatabase system"),
                ("SQLite", "Lightweight embedded\ndatabase file"),
                ("Oracle", "Enterprise database\nsystem"),
                ("SQL Server", "Microsoft database\nplatform"),
                ("MariaDB", "MySQL-compatible\ndatabase")
            ],
            "NoSQL": [
                ("MongoDB", "Document-oriented\nNoSQL database"),
                ("Redis", "In-memory data\nstructure store"),
                ("Cassandra", "Wide-column\nNoSQL database"),
                ("CouchDB", "Document database\nwith HTTP API"),
                ("Neo4j", "Graph database\nfor connected data"),
                ("DynamoDB", "Amazon's NoSQL\ndatabase service")
            ],
            "Cloud": [
                ("Supabase", "Open source Firebase\nalternative"),
                ("PlanetScale", "Serverless MySQL\nplatform"),
                ("Neon", "Serverless PostgreSQL\nwith branching"),
                ("Railway", "Cloud database\nhosting platform"),
                ("AWS RDS", "Amazon relational\ndatabase service"),
                ("Firebase", "Google's NoSQL\ndatabase platform")
            ]
        }
        
        self.db_cards = {}
        
        # Create tabs for each category
        for category, db_types in db_categories.items():
            tab_widget = QWidget()
            tab_layout = QVBoxLayout(tab_widget)
            tab_layout.setContentsMargins(self.spacing['medium'], self.spacing['medium'], 
                                        self.spacing['medium'], self.spacing['medium'])
            tab_layout.setSpacing(0)
            
            # Database cards container with proper grid layout
            cards_widget = QWidget()
            cards_widget.setStyleSheet("background: transparent;")
            cards_layout = QGridLayout(cards_widget)
            cards_layout.setContentsMargins(16, 16, 16, 16)
            cards_layout.setHorizontalSpacing(16)
            cards_layout.setVerticalSpacing(16)
            
            row, col = 0, 0
            max_cols = 3  # 3 cards per row for better spacing
            
            for db_type, description in db_types:
                card = self.create_database_card(db_type, description)
                self.db_cards[db_type] = card
                cards_layout.addWidget(card, row, col)
                
                col += 1
                if col >= max_cols:
                    col = 0
                    row += 1
            
            # Add stretch to center content
            cards_layout.setRowStretch(row + 1, 1)
            
            tab_layout.addWidget(cards_widget)
            
            # Add tab
            self.db_tabs.addTab(tab_widget, category)
        
        # Set Popular tab as default and select PostgreSQL
        self.db_tabs.setCurrentIndex(0)  # Popular tab
        if "PostgreSQL" in self.db_cards:
            self.db_cards["PostgreSQL"].is_selected = True
            if hasattr(self.db_cards["PostgreSQL"], 'update_style'):
                self.db_cards["PostgreSQL"].update_style()
        
        db_selection_layout.addWidget(self.db_tabs)

        main_layout.addWidget(db_selection_widget)
        
        # Connection details form with better layout
        details_group = QGroupBox("Connection Details")
        details_layout = QVBoxLayout(details_group)
        details_layout.setContentsMargins(20, 25, 20, 20)
        details_layout.setSpacing(15)
        
        # Add URL input section at the top
        url_section = QWidget()
        url_layout = QVBoxLayout(url_section)
        url_layout.setContentsMargins(0, 0, 0, 0)
        url_layout.setSpacing(8)
        
        url_label = QLabel("🔗 Quick Connect (Optional)")
        url_label.setStyleSheet("""
            font-weight: 600; 
            color: #555555; 
            font-size: 14px;
            margin-bottom: 4px;
        """)
        url_layout.addWidget(url_label)
        
        url_input_layout = QHBoxLayout()
        url_input_layout.setSpacing(10)
        
        self.url_edit = QLineEdit()
        self.url_edit.setPlaceholderText("postgresql://user:password@host:port/database")
        self.url_edit.textChanged.connect(self.on_url_changed)
        self.url_edit.setMinimumHeight(40)
        
        self.parse_url_button = QPushButton("Parse")
        self.parse_url_button.clicked.connect(self.parse_connection_url)
        self.parse_url_button.setEnabled(False)
        self.parse_url_button.setFixedSize(80, 40)
        
        url_input_layout.addWidget(self.url_edit, 1)
        url_input_layout.addWidget(self.parse_url_button)
        url_layout.addLayout(url_input_layout)
        
        # Add elegant separator
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setFrameShadow(QFrame.Shadow.Plain)
        separator.setStyleSheet("""
            QFrame {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 rgba(200, 200, 200, 0),
                    stop:0.5 rgba(200, 200, 200, 0.4),
                    stop:1 rgba(200, 200, 200, 0));
                border: none;
                height: 1px;
                margin: 15px 0px 10px 0px;
            }
        """)
        url_layout.addWidget(separator)
        
        details_layout.addWidget(url_section)
        
        # Form fields in a grid layout for better organization
        form_widget = QWidget()
        form_layout = QGridLayout(form_widget)
        form_layout.setContentsMargins(0, 0, 0, 0)
        form_layout.setSpacing(12)
        form_layout.setColumnStretch(1, 1)
        form_layout.setColumnStretch(3, 1)
        
        # Clean group box styling
        details_group.setStyleSheet("""
            QGroupBox {
                font-size: 15px;
                font-weight: 600;
                border: 1px solid #ddd;
                border-radius: 8px;
                margin-top: 12px;
                padding-top: 12px;
                background: white;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 6px 0 6px;
                background: white;
                color: #333;
            }
        """)
        
        # Row 0: Connection name (spans both columns)
        name_label = QLabel("Connection Name:")
        name_label.setStyleSheet("font-weight: 600; color: #555555; font-size: 13px;")
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("My Database Connection")
        self.name_edit.setMinimumHeight(36)
        
        form_layout.addWidget(name_label, 0, 0)
        form_layout.addWidget(self.name_edit, 0, 1, 1, 3)
        
        # Row 1: Host and Port
        host_label = QLabel("Host:")
        host_label.setStyleSheet("font-weight: 600; color: #555555; font-size: 13px;")
        self.host_edit = QLineEdit()
        self.host_edit.setText("localhost")
        self.host_edit.setPlaceholderText("localhost or IP address")
        self.host_edit.setMinimumHeight(36)
        
        port_label = QLabel("Port:")
        port_label.setStyleSheet("font-weight: 600; color: #555555; font-size: 13px;")
        self.port_spin = QSpinBox()
        self.port_spin.setRange(1, 65535)
        self.port_spin.setValue(5432)
        self.port_spin.setMinimumHeight(36)
        self.port_spin.setMinimumWidth(80)
        
        form_layout.addWidget(host_label, 1, 0)
        form_layout.addWidget(self.host_edit, 1, 1)
        form_layout.addWidget(port_label, 1, 2)
        form_layout.addWidget(self.port_spin, 1, 3)
        
        # Row 2: Database
        database_label = QLabel("Database:")
        database_label.setStyleSheet("font-weight: 600; color: #555555; font-size: 13px;")
        self.database_edit = QLineEdit()
        self.database_edit.setPlaceholderText("Database name")
        self.database_edit.setMinimumHeight(36)
        
        form_layout.addWidget(database_label, 2, 0)
        form_layout.addWidget(self.database_edit, 2, 1, 1, 3)
        
        # Row 3: Username and Password
        username_label = QLabel("Username:")
        username_label.setStyleSheet("font-weight: 600; color: #555555; font-size: 13px;")
        self.username_edit = QLineEdit()
        self.username_edit.setPlaceholderText("Username")
        self.username_edit.setMinimumHeight(36)
        
        password_label = QLabel("Password:")
        password_label.setStyleSheet("font-weight: 600; color: #555555; font-size: 13px;")
        self.password_edit = QLineEdit()
        self.password_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_edit.setPlaceholderText("Password")
        self.password_edit.setMinimumHeight(36)
        
        form_layout.addWidget(username_label, 3, 0)
        form_layout.addWidget(self.username_edit, 3, 1)
        form_layout.addWidget(password_label, 3, 2)
        form_layout.addWidget(self.password_edit, 3, 3)
        
        details_layout.addWidget(form_widget)
        
        # Apply beautiful input styling
        input_style = """
            QLineEdit, QSpinBox {
                padding: 8px 12px;
                border: 1px solid rgba(200, 200, 200, 0.6);
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.95);
                font-size: 13px;
                color: #333333;
            }
            QLineEdit:focus, QSpinBox:focus {
                border: 2px solid #007AFF;
                background: rgba(255, 255, 255, 1.0);
                outline: none;
            }
            QLineEdit::placeholder {
                color: #aaaaaa;
            }
        """
        
        for widget in [self.name_edit, self.host_edit, self.port_spin, 
                      self.database_edit, self.username_edit, self.password_edit, self.url_edit]:
            widget.setStyleSheet(input_style)
        
        # Style the parse URL button with glass effect
        self.parse_url_button.setStyleSheet("""
            QPushButton {
                border: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 12px;
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #007AFF,
                    stop:1 #0056CC);
                color: white;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #0056CC,
                    stop:1 #004499);
            }
            QPushButton:pressed {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #004499,
                    stop:1 #003366);
            }
            QPushButton:disabled {
                background: rgba(200, 200, 200, 0.5);
                color: #999999;
            }
        """)
        
        main_layout.addWidget(details_group)
        
        # Test connection section
        test_section = QWidget()
        test_layout = QVBoxLayout(test_section)
        test_layout.setContentsMargins(0, 10, 0, 0)
        test_layout.setSpacing(10)
        
        # Progress bar (hidden initially)
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setMinimumHeight(6)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                background: rgba(230, 230, 230, 0.8);
                border: none;
                border-radius: 3px;
            }
            QProgressBar::chunk {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #007AFF,
                    stop:1 #0056CC);
                border-radius: 3px;
            }
        """)
        test_layout.addWidget(self.progress_bar)
        
        # Status label
        self.status_label = QLabel()
        self.status_label.setVisible(False)
        self.status_label.setWordWrap(True)
        self.status_label.setMinimumHeight(60)
        self.status_label.setStyleSheet("""
            QLabel {
                background: rgba(255, 255, 255, 0.9);
                border: 1px solid rgba(220, 220, 220, 0.5);
                border-radius: 8px;
                padding: 12px;
                font-size: 13px;
                color: #333333;
            }
        """)
        test_layout.addWidget(self.status_label)
        
        main_layout.addWidget(test_section)
        
        # Buttons with better spacing and alignment
        button_layout = QHBoxLayout()
        button_layout.setSpacing(12)
        button_layout.setContentsMargins(0, 20, 0, 0)
        
        # Test Connection Button
        self.test_button = QPushButton("🔍 Test Connection")
        self.test_button.clicked.connect(self.test_connection)
        button_layout.addWidget(self.test_button)
        
        button_layout.addStretch()
        
        # Cancel Button
        self.cancel_button = QPushButton("Cancel")
        self.cancel_button.clicked.connect(self.reject)
        button_layout.addWidget(self.cancel_button)
        
        # Connect Button
        self.connect_button = QPushButton("Connect")
        self.connect_button.clicked.connect(self.accept_connection)
        self.connect_button.setEnabled(False)
        self.connect_button.setDefault(True)
        button_layout.addWidget(self.connect_button)
        
        # Beautiful button styling with glass effects
        button_base_style = """
            QPushButton {
                padding: 10px 24px;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 13px;
                min-width: 110px;
                min-height: 36px;
            }
        """
        
        self.test_button.setStyleSheet(button_base_style + """
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #007AFF,
                    stop:1 #0056CC);
                color: white;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #0056CC,
                    stop:1 #004499);
            }
            QPushButton:pressed {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #004499,
                    stop:1 #003366);
            }
        """)
        
        self.cancel_button.setStyleSheet(button_base_style + """
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(150, 150, 150, 0.8),
                    stop:1 rgba(120, 120, 120, 0.9));
                color: white;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(120, 120, 120, 0.9),
                    stop:1 rgba(100, 100, 100, 1.0));
            }
        """)
        
        self.connect_button.setStyleSheet(button_base_style + """
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #34C759,
                    stop:1 #28A745);
                color: white;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #28A745,
                    stop:1 #218838);
            }
            QPushButton:pressed {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #218838,
                    stop:1 #1e7e34);
            }
            QPushButton:disabled {
                background: rgba(200, 200, 200, 0.5);
                color: #999999;
            }
        """)
        
        main_layout.addLayout(button_layout)
        
        # Update form when database type changes
        self.update_form_for_database_type()
    
    def get_input_style(self):
        """Get consistent input field styling"""
        return """
            QLineEdit {
                font-size: 14px;
                padding: 10px 12px;
                border: 2px solid rgba(209, 213, 219, 255);
                border-radius: 6px;
                background: rgba(255, 255, 255, 255);
                color: rgba(17, 24, 39, 255);
                min-height: 16px;
            }
            QLineEdit:focus {
                border-color: rgba(59, 130, 246, 255);
                outline: none;
            }
            QLineEdit::placeholder {
                color: rgba(156, 163, 175, 255);
            }
        """
    
    def get_spinbox_style(self):
        """Get consistent spinbox styling"""
        return """
            QSpinBox {
                font-size: 14px;
                padding: 10px 12px;
                border: 2px solid rgba(209, 213, 219, 255);
                border-radius: 6px;
                background: rgba(255, 255, 255, 255);
                color: rgba(17, 24, 39, 255);
                min-height: 16px;
            }
            QSpinBox:focus {
                border-color: rgba(59, 130, 246, 255);
                outline: none;
            }
            QSpinBox::up-button, QSpinBox::down-button {
                width: 20px;
                border: none;
                background: transparent;
            }
        """
    
    def apply_glass_style(self):
        """Apply beautiful glass styling"""
        self.setStyleSheet(AppleGlassStyleSheet.get_complete_glass_style())
        
        # Set window flags for better glass effect
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
    
    def select_database_type(self, db_type: str):
        """Select a database type"""
        self.selected_db_type = db_type

        # Update form
        self.update_form_for_database_type()

        # Reset test status
        self.connect_button.setEnabled(False)
        self.status_label.setVisible(False)
    
    def create_database_card(self, name: str, description: str) -> QFrame:
        """Create a professional database card with glass effect"""
        # Get brand color for this database type
        color_map = {
            # SQL Databases
            "PostgreSQL": "#336791", "MySQL": "#00758F", "SQLite": "#003B57",
            "Oracle": "#F80000", "SQL Server": "#CC2927", "MariaDB": "#003545",
            # NoSQL Databases
            "MongoDB": "#4DB33D", "Redis": "#DC382D", "Cassandra": "#1287B1",
            "CouchDB": "#E42528", "Neo4j": "#008CC1", "DynamoDB": "#FF9900",
            # Cloud Databases
            "Supabase": "#3ECF8E", "PlanetScale": "#000000", "Neon": "#00E599",
            "Railway": "#0B0D0E", "AWS RDS": "#FF9900", "Firebase": "#FFCA28"
        }
        icon_color = color_map.get(name, self.colors['primary'])

        card = QFrame()
        card.setFixedSize(160, 140)
        card.setCursor(Qt.CursorShape.PointingHandCursor)

        # Store selection state
        card.is_selected = False

        # Apply beautiful card styling
        def update_card_style():
            if card.is_selected:
                card.setStyleSheet(f"""
                    QFrame {{
                        background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                            stop:0 rgba(255, 255, 255, 1.0),
                            stop:1 rgba(248, 250, 252, 0.98));
                        border: 2px solid {icon_color};
                        border-radius: 16px;
                        padding: 12px;
                    }}
                """)
            else:
                card.setStyleSheet(f"""
                    QFrame {{
                        background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                            stop:0 rgba(255, 255, 255, 0.98),
                            stop:1 rgba(248, 250, 252, 0.95));
                        border: 1px solid rgba(226, 232, 240, 0.6);
                        border-radius: 16px;
                        padding: 12px;
                    }}
                    QFrame:hover {{
                        background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                            stop:0 rgba(255, 255, 255, 1.0),
                            stop:1 rgba(239, 246, 255, 0.98));
                        border: 2px solid rgba(59, 130, 246, 0.4);
                        transform: translateY(-2px);
                    }}
                """)

        card.update_style = update_card_style
        update_card_style()
        
        layout = QVBoxLayout(card)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.setSpacing(10)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # Icon container with enhanced styling
        icon_container = QWidget()
        icon_container.setFixedSize(52, 52)
        icon_container.setStyleSheet(f"""
            QWidget {{
                background: qradialgradient(cx:0.5, cy:0.3, radius:0.9,
                    stop:0 {QColor(icon_color).lighter(140).name()},
                    stop:0.6 {icon_color},
                    stop:1 {QColor(icon_color).darker(120).name()});
                border-radius: 26px;
                border: 2px solid rgba(255, 255, 255, 0.8);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }}
        """)
        
        icon_layout = QVBoxLayout(icon_container)
        icon_layout.setContentsMargins(0, 0, 0, 0)
        
        icon_label = QLabel()
        icon = DatabaseIcons.create_database_icon(name, 36)
        icon_label.setPixmap(icon.pixmap(36, 36))
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon_layout.addWidget(icon_label)
        
        layout.addWidget(icon_container)
        
        # Name with better styling
        name_label = QLabel(name)
        name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name_label.setStyleSheet("""
            QLabel {
                font-weight: 600;
                font-size: 14px;
                color: rgba(30, 41, 59, 255);
                background: transparent;
                border: none;
                margin-top: 8px;
                margin-bottom: 2px;
            }
        """)
        layout.addWidget(name_label)

        # Description with refined styling
        desc_label = QLabel(description)
        desc_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        desc_label.setWordWrap(True)
        desc_label.setStyleSheet("""
            QLabel {
                font-size: 11px;
                color: rgba(100, 116, 139, 255);
                background: transparent;
                border: none;
                line-height: 1.3;
            }
        """)
        layout.addWidget(desc_label)
        
        # Add click handler with selection update
        def handle_click(event):
            if event.button() == Qt.MouseButton.LeftButton:
                # Deselect all cards across all tabs
                for db_card in self.db_cards.values():
                    if hasattr(db_card, 'is_selected'):
                        db_card.is_selected = False
                        if hasattr(db_card, 'update_style'):
                            db_card.update_style()

                # Select this card
                card.is_selected = True
                card.update_style()
                self.select_database_type(name)

        card.mousePressEvent = handle_click

        return card
    
    def get_tab_icon(self, category: str) -> QIcon:
        """Get icon for database category tab"""
        icon_map = {
            "SQL": "🗄️",
            "NoSQL": "📊", 
            "Cloud": "☁️",
            "Time Series": "📈"
        }
        
        # Create a simple text-based icon
        pixmap = QPixmap(16, 16)
        pixmap.fill(Qt.GlobalColor.transparent)
        
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Draw emoji-style icon
        font = QFont()
        font.setPointSize(12)
        painter.setFont(font)
        painter.setPen(QColor(17, 24, 39))
        painter.drawText(pixmap.rect(), Qt.AlignmentFlag.AlignCenter, icon_map.get(category, "💾"))
        
        painter.end()
        return QIcon(pixmap)
    
    def update_form_for_database_type(self):
        """Update form fields based on selected database type"""
        # SQL Databases
        if self.selected_db_type == "PostgreSQL":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("postgres")
            self.username_edit.setPlaceholderText("postgres")
        elif self.selected_db_type == "MySQL":
            self.port_spin.setValue(3306)
            self.database_edit.setPlaceholderText("mysql")
            self.username_edit.setPlaceholderText("root")
        elif self.selected_db_type == "SQLite":
            self.port_spin.setValue(0)
            self.database_edit.setPlaceholderText("/path/to/database.db")
            self.username_edit.setPlaceholderText("(not required)")
            self.password_edit.setPlaceholderText("(not required)")
        elif self.selected_db_type == "Oracle":
            self.port_spin.setValue(1521)
            self.database_edit.setPlaceholderText("XE")
            self.username_edit.setPlaceholderText("system")
        elif self.selected_db_type == "SQL Server":
            self.port_spin.setValue(1433)
            self.database_edit.setPlaceholderText("master")
            self.username_edit.setPlaceholderText("sa")
        elif self.selected_db_type == "MariaDB":
            self.port_spin.setValue(3306)
            self.database_edit.setPlaceholderText("mysql")
            self.username_edit.setPlaceholderText("root")
        
        # NoSQL Databases
        elif self.selected_db_type == "MongoDB":
            self.port_spin.setValue(27017)
            self.database_edit.setPlaceholderText("admin")
            self.username_edit.setPlaceholderText("admin")
        elif self.selected_db_type == "Redis":
            self.port_spin.setValue(6379)
            self.database_edit.setPlaceholderText("0")
            self.username_edit.setPlaceholderText("default")
        elif self.selected_db_type == "Cassandra":
            self.port_spin.setValue(9042)
            self.database_edit.setPlaceholderText("system")
            self.username_edit.setPlaceholderText("cassandra")
        elif self.selected_db_type == "CouchDB":
            self.port_spin.setValue(5984)
            self.database_edit.setPlaceholderText("_users")
            self.username_edit.setPlaceholderText("admin")
        elif self.selected_db_type == "Neo4j":
            self.port_spin.setValue(7687)
            self.database_edit.setPlaceholderText("neo4j")
            self.username_edit.setPlaceholderText("neo4j")
        elif self.selected_db_type == "DynamoDB":
            self.port_spin.setValue(8000)
            self.database_edit.setPlaceholderText("local")
            self.username_edit.setPlaceholderText("access_key")
            self.password_edit.setPlaceholderText("secret_key")
        
        # Cloud Databases
        elif self.selected_db_type == "Supabase":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("postgres")
            self.username_edit.setPlaceholderText("postgres")
        elif self.selected_db_type == "PlanetScale":
            self.port_spin.setValue(3306)
            self.database_edit.setPlaceholderText("your-database")
            self.username_edit.setPlaceholderText("your-username")
        elif self.selected_db_type == "Neon":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("neondb")
            self.username_edit.setPlaceholderText("your-username")
        elif self.selected_db_type == "Railway":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("railway")
            self.username_edit.setPlaceholderText("postgres")
        elif self.selected_db_type == "AWS RDS":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("postgres")
            self.username_edit.setPlaceholderText("postgres")
        elif self.selected_db_type == "Firebase":
            self.port_spin.setValue(443)
            self.database_edit.setPlaceholderText("project-id")
            self.username_edit.setPlaceholderText("service_account")
            self.password_edit.setPlaceholderText("private_key")
        
        # Time Series Databases
        elif self.selected_db_type == "InfluxDB":
            self.port_spin.setValue(8086)
            self.database_edit.setPlaceholderText("mydb")
            self.username_edit.setPlaceholderText("admin")
        elif self.selected_db_type == "TimescaleDB":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("postgres")
            self.username_edit.setPlaceholderText("postgres")
        elif self.selected_db_type == "Prometheus":
            self.port_spin.setValue(9090)
            self.database_edit.setPlaceholderText("prometheus")
            self.username_edit.setPlaceholderText("(not required)")
            self.password_edit.setPlaceholderText("(not required)")
        elif self.selected_db_type == "ClickHouse":
            self.port_spin.setValue(9000)
            self.database_edit.setPlaceholderText("default")
            self.username_edit.setPlaceholderText("default")
    
    def test_connection(self):
        """Test the database connection with beautiful progress"""
        if self.test_thread and self.test_thread.isRunning():
            return
        
        # Validate required fields
        if not self.database_edit.text():
            self.show_status_message("❌ Please enter a database name", False)
            return
        
        # Show progress
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)  # Indeterminate progress
        self.status_label.setVisible(True)
        self.status_label.setText("🚀 Starting connection test...")
        self.test_button.setEnabled(False)
        
        # Start test thread
        self.test_thread = ConnectionTestThread(
            self.selected_db_type,
            self.host_edit.text() or "localhost",
            self.port_spin.value(),
            self.database_edit.text(),
            self.username_edit.text(),
            self.password_edit.text()
        )
        self.test_thread.result_ready.connect(self.on_test_result)
        self.test_thread.progress_update.connect(self.on_progress_update)
        self.test_thread.start()
    
    def on_progress_update(self, message: str):
        """Handle progress updates"""
        self.status_label.setText(message)
    
    def on_test_result(self, success: bool, message: str):
        """Handle test result with beautiful styling"""
        self.progress_bar.setVisible(False)
        self.test_button.setEnabled(True)
        
        self.show_status_message(message, success)
        self.connect_button.setEnabled(success)
    
    def show_status_message(self, message: str, is_success: bool):
        """Show status message with appropriate styling"""
        self.status_label.setVisible(True)
        self.status_label.setText(message)
        
        if is_success:
            self.status_label.setStyleSheet("""
                QLabel {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 rgba(52, 199, 89, 50),
                        stop:1 rgba(52, 199, 89, 30));
                    border: 1px solid rgba(52, 199, 89, 100);
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 13px;
                    color: rgba(17, 24, 39, 255);
                }
            """)
        else:
            self.status_label.setStyleSheet("""
                QLabel {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                        stop:0 rgba(255, 59, 48, 50),
                        stop:1 rgba(255, 59, 48, 30));
                    border: 1px solid rgba(255, 59, 48, 100);
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 13px;
                    color: rgba(17, 24, 39, 255);
                }
            """)
    
    def on_url_changed(self, text: str):
        """Handle URL input changes"""
        self.parse_url_button.setEnabled(bool(text.strip()))
    
    def parse_connection_url(self):
        """Parse connection URL and populate form fields"""
        url = self.url_edit.text().strip()
        if not url:
            return
        
        try:
            parsed_info = self.parse_database_url(url)
            
            # Update database type selection
            if parsed_info['db_type'] in self.db_cards:
                # Deselect all cards
                for card in self.db_cards.values():
                    card.set_selected(False)
                
                # Select the parsed type
                self.db_cards[parsed_info['db_type']].set_selected(True)
                self.selected_db_type = parsed_info['db_type']
            
            # Populate form fields
            if parsed_info.get('name'):
                self.name_edit.setText(parsed_info['name'])
            if parsed_info.get('host'):
                self.host_edit.setText(parsed_info['host'])
            if parsed_info.get('port'):
                self.port_spin.setValue(parsed_info['port'])
            if parsed_info.get('database'):
                self.database_edit.setText(parsed_info['database'])
            if parsed_info.get('username'):
                self.username_edit.setText(parsed_info['username'])
            if parsed_info.get('password'):
                self.password_edit.setText(parsed_info['password'])
            
            # Update form for the new database type
            self.update_form_for_database_type()
            
            # Show success message
            self.show_status_message(f"✅ Successfully parsed {parsed_info['db_type']} connection URL", True)
            
        except Exception as e:
            self.show_status_message(f"❌ Failed to parse URL: {str(e)}", False)
    
    def parse_database_url(self, url: str) -> Dict[str, Any]:
        """Parse database connection URL into components"""
        parsed = urlparse(url)
        
        # Map URL schemes to database types
        scheme_to_type = {
            # SQL Databases
            'postgresql': 'PostgreSQL',
            'postgres': 'PostgreSQL',
            'mysql': 'MySQL',
            'mariadb': 'MariaDB',
            'sqlite': 'SQLite',
            'oracle': 'Oracle',
            'sqlserver': 'SQL Server',
            'mssql': 'SQL Server',
            
            # NoSQL Databases
            'mongodb': 'MongoDB',
            'mongo': 'MongoDB',
            'redis': 'Redis',
            'cassandra': 'Cassandra',
            'couchdb': 'CouchDB',
            'neo4j': 'Neo4j',
            'bolt': 'Neo4j',
            'dynamodb': 'DynamoDB',
            
            # Cloud Databases
            'supabase': 'Supabase',
            'planetscale': 'PlanetScale',
            'neon': 'Neon',
            'railway': 'Railway',
            'firebase': 'Firebase',
            
            # Time Series Databases
            'influxdb': 'InfluxDB',
            'influx': 'InfluxDB',
            'timescaledb': 'TimescaleDB',
            'timescale': 'TimescaleDB',
            'prometheus': 'Prometheus',
            'clickhouse': 'ClickHouse'
        }
        
        if not parsed.scheme:
            raise ValueError("URL must include a scheme (e.g., postgresql://)")
        
        scheme = parsed.scheme.lower()
        if scheme not in scheme_to_type:
            raise ValueError(f"Unsupported database scheme: {scheme}")
        
        db_type = scheme_to_type[scheme]
        
        # Get default port for database type
        default_ports = {
            'PostgreSQL': 5432, 'MySQL': 3306, 'SQLite': 0, 'MariaDB': 3306,
            'Oracle': 1521, 'SQL Server': 1433, 'MongoDB': 27017, 'Redis': 6379,
            'Cassandra': 9042, 'CouchDB': 5984, 'Neo4j': 7687, 'DynamoDB': 8000,
            'Supabase': 5432, 'PlanetScale': 3306, 'Neon': 5432, 'Railway': 5432,
            'Firebase': 443, 'AWS RDS': 5432
        }
        
        # Extract connection components
        result = {
            'db_type': db_type,
            'host': parsed.hostname or 'localhost',
            'port': parsed.port or default_ports.get(db_type, 5432),
            'username': parsed.username,
            'password': parsed.password,
            'database': parsed.path.lstrip('/') if parsed.path else None
        }
        
        # Handle special cases
        if db_type == 'SQLite':
            # For SQLite, the path is the database file
            result['database'] = parsed.path or url
            result['host'] = ''
            result['port'] = 0
        
        # Parse query parameters for additional options
        if parsed.query:
            query_params = parse_qs(parsed.query)
            
            # Handle SSL settings
            if 'sslmode' in query_params or 'ssl' in query_params:
                result['ssl'] = True
            
            # Handle database name in query (for some cloud providers)
            if 'database' in query_params and not result['database']:
                result['database'] = query_params['database'][0]
        
        # Generate a connection name
        if result['host'] and result['database']:
            result['name'] = f"{db_type} - {result['host']}/{result['database']}"
        elif result['host']:
            result['name'] = f"{db_type} - {result['host']}"
        else:
            result['name'] = f"{db_type} Connection"
        
        return result
    
    def accept_connection(self):
        """Accept and create the connection"""
        connection_info = {
            'name': self.name_edit.text() or f"{self.selected_db_type} Connection",
            'type': self.selected_db_type,
            'host': self.host_edit.text() or "localhost",
            'port': self.port_spin.value(),
            'database': self.database_edit.text(),
            'username': self.username_edit.text(),
            'password': self.password_edit.text()
        }
        
        self.connection_created.emit(connection_info)
        self.accept()
    
    def paintEvent(self, event):
        """Custom paint event for clean professional background"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Draw clean professional background
        rect = self.rect()
        
        # Simple clean gradient background
        gradient = QLinearGradient(0, 0, 0, rect.height())
        gradient.setColorAt(0, QColor(255, 255, 255, 1.0))
        gradient.setColorAt(1, QColor(248, 250, 252, 1.0))
        
        painter.setBrush(QBrush(gradient))
        painter.setPen(QPen(QColor(200, 200, 200, 0.8), 1))
        painter.drawRoundedRect(rect.adjusted(1, 1, -1, -1), 16, 16)
        
        super().paintEvent(event)