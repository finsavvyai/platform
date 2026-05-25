#!/usr/bin/env python3
"""
Ultimate Apple Database Manager
Modern, glassmorphism-styled database management application for macOS
"""

import sys
from pathlib import Path

# Add the lib directory to the Python path
lib_path = Path(__file__).parent.parent / 'lib'
sys.path.insert(0, str(lib_path))

from PySide6.QtWidgets import (QApplication, QMainWindow, QVBoxLayout, QHBoxLayout,
                               QWidget, QPushButton, QLabel,
                               QTabWidget, QSplitter, QFrame, QScrollArea,
                               QGridLayout, QLineEdit, QComboBox, QSpinBox, QCheckBox,
                               QMessageBox, QProgressBar, QStatusBar,
                               QGroupBox, QFormLayout, QDialog, QDialogButtonBox)
from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QAction

# Import our database managers
try:
    from database_adapters import DatabaseAdapterFactory
    from connection_manager import ConnectionManager
    from docker_manager import DockerManager
    from import_export_manager import ImportExportManager
except ImportError as e:
    print(f"Warning: Could not import some modules: {e}")
    # Create placeholder classes for development
    class DatabaseAdapterFactory:
        @staticmethod
        def create_adapter(db_type): return None
    class ConnectionManager:
        def __init__(self): pass
    class DockerManager:
        def __init__(self): pass
    class ImportExportManager:
        def __init__(self): pass


class ModernButton(QPushButton):
    """Custom button with modern styling"""

    def __init__(self, text="", parent=None):
        super().__init__(text, parent)
        self.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 0.15),
                    stop:1 rgba(255, 255, 255, 0.05));
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 12px 24px;
                font-size: 14px;
                font-weight: 600;
                color: #333333;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 0.25),
                    stop:1 rgba(255, 255, 255, 0.15));
                border: 1px solid rgba(0, 123, 255, 0.5);
            }
            QPushButton:pressed {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(0, 123, 255, 0.4),
                    stop:1 rgba(0, 123, 255, 0.2));
            }
            QPushButton:disabled {
                background: rgba(128, 128, 128, 0.1);
                color: #999999;
            }
        """)


class DatabaseCard(QFrame):
    """Modern database connection card with modern styling"""

    def __init__(self, db_type, name, status="Disconnected", parent=None):
        super().__init__(parent)
        self.db_type = db_type
        self.name = name
        self.status = status

        self.setMinimumSize(280, 180)
        self.setMaximumWidth(300)
        self.setup_ui()
        self.setup_styling()
    
    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Database type and icon
        header_layout = QHBoxLayout()
        
        # Database icon (placeholder)
        icon_label = QLabel("🗄️")
        icon_label.setStyleSheet("font-size: 32px;")
        header_layout.addWidget(icon_label)
        
        # Database info
        info_layout = QVBoxLayout()
        
        type_label = QLabel(self.db_type)
        type_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #333333;")
        info_layout.addWidget(type_label)
        
        name_label = QLabel(self.name)
        name_label.setStyleSheet("font-size: 14px; color: #666666;")
        info_layout.addWidget(name_label)
        
        header_layout.addLayout(info_layout)
        header_layout.addStretch()
        
        layout.addLayout(header_layout)
        
        # Status
        status_label = QLabel(f"Status: {self.status}")
        status_color = "#28a745" if self.status == "Connected" else "#dc3545"
        status_label.setStyleSheet(f"font-size: 12px; color: {status_color}; font-weight: 500;")
        layout.addWidget(status_label)
        
        layout.addStretch()
        
        # Action buttons
        button_layout = QHBoxLayout()
        
        connect_btn = ModernButton("Connect")
        connect_btn.setFixedHeight(36)
        button_layout.addWidget(connect_btn)
        
        manage_btn = ModernButton("Manage")
        manage_btn.setFixedHeight(36)
        button_layout.addWidget(manage_btn)
        
        layout.addLayout(button_layout)
    
    def setup_styling(self):
        self.setStyleSheet("""
            DatabaseCard {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(255, 255, 255, 0.15),
                    stop:1 rgba(255, 255, 255, 0.05));
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
            }
            DatabaseCard:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(255, 255, 255, 0.25),
                    stop:1 rgba(255, 255, 255, 0.15));
                border: 1px solid rgba(0, 123, 255, 0.4);
            }
        """)


class ConnectionDialog(QDialog):
    """Modern connection dialog with enhanced styling"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("New Database Connection")
        self.setFixedSize(600, 500)
        self.setup_ui()
        self.setup_styling()
    
    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(30, 30, 30, 30)
        
        # Title
        title = QLabel("Create New Connection")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: #333333; margin-bottom: 10px;")
        layout.addWidget(title)
        
        # Database type selection
        db_group = QGroupBox("Database Type")
        db_layout = QGridLayout(db_group)
        
        self.db_type = QComboBox()
        self.db_type.addItems(["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Oracle"])
        db_layout.addWidget(self.db_type, 0, 0, 1, 2)
        
        layout.addWidget(db_group)
        
        # Connection details
        details_group = QGroupBox("Connection Details")
        details_layout = QFormLayout(details_group)
        
        self.name_field = QLineEdit()
        self.name_field.setPlaceholderText("My Database Connection")
        details_layout.addRow("Connection Name:", self.name_field)
        
        self.host_field = QLineEdit()
        self.host_field.setPlaceholderText("localhost")
        details_layout.addRow("Host:", self.host_field)
        
        self.port_field = QSpinBox()
        self.port_field.setRange(1, 65535)
        self.port_field.setValue(5432)
        details_layout.addRow("Port:", self.port_field)
        
        self.database_field = QLineEdit()
        self.database_field.setPlaceholderText("database_name")
        details_layout.addRow("Database:", self.database_field)
        
        self.username_field = QLineEdit()
        self.username_field.setPlaceholderText("username")
        details_layout.addRow("Username:", self.username_field)
        
        self.password_field = QLineEdit()
        self.password_field.setEchoMode(QLineEdit.Password)
        self.password_field.setPlaceholderText("password")
        details_layout.addRow("Password:", self.password_field)
        
        self.ssl_checkbox = QCheckBox("Use SSL")
        details_layout.addRow("Security:", self.ssl_checkbox)
        
        layout.addWidget(details_group)
        
        # Buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def setup_styling(self):
        self.setStyleSheet("""
            QDialog {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(240, 248, 255, 0.95),
                    stop:1 rgba(230, 240, 255, 0.95));
                border-radius: 20px;
            }
            QGroupBox {
                font-weight: bold;
                border: 2px solid rgba(0, 123, 255, 0.3);
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
            }
            QLineEdit, QSpinBox, QComboBox {
                padding: 8px 12px;
                border: 1px solid rgba(0, 123, 255, 0.3);
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.8);
                font-size: 13px;
            }
            QLineEdit:focus, QSpinBox:focus, QComboBox:focus {
                border: 2px solid rgba(0, 123, 255, 0.6);
                background: rgba(255, 255, 255, 0.95);
            }
        """)


class UltimateAppleDatabaseManager(QMainWindow):
    """Main application window with modern glassmorphism design"""
    
    def __init__(self):
        super().__init__()
        
        self.setWindowTitle("Ultimate Database Manager")
        self.setMinimumSize(1400, 900)
        
        # Initialize managers
        self.connection_manager = ConnectionManager()
        self.docker_manager = DockerManager()
        self.import_export_manager = ImportExportManager()
        
        # Theme state
        self.current_theme = "light"  # Default theme
        
        # Setup UI
        self.setup_menu_bar()
        self.setup_status_bar()
        self.setup_ui()
        self.setup_styling()
        
        # Show welcome message
        QTimer.singleShot(500, self.show_welcome_message)
    
    def setup_ui(self):
        """Setup the main UI layout"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main horizontal splitter
        main_splitter = QSplitter(Qt.Horizontal)
        central_widget_layout = QVBoxLayout(central_widget)
        central_widget_layout.addWidget(main_splitter)
        
        # Left sidebar
        self.setup_sidebar(main_splitter)
        
        # Right content area
        self.setup_content_area(main_splitter)
        
        # Set splitter proportions
        main_splitter.setSizes([300, 900])
    
    def setup_sidebar(self, parent):
        """Setup the left sidebar with connections"""
        sidebar_frame = QFrame()
        sidebar_frame.setMinimumWidth(320)
        sidebar_frame.setMaximumWidth(350)
        sidebar_layout = QVBoxLayout(sidebar_frame)
        sidebar_layout.setSpacing(16)
        sidebar_layout.setContentsMargins(20, 20, 20, 20)

        # Sidebar title
        self.sidebar_title = QLabel("Database Connections")
        self.sidebar_title.setStyleSheet("font-size: 18px; font-weight: bold; margin-bottom: 10px;")
        sidebar_layout.addWidget(self.sidebar_title)

        # Add connection button
        add_btn = ModernButton("+ New Connection")
        add_btn.clicked.connect(self.show_connection_dialog)
        sidebar_layout.addWidget(add_btn)

        # Connections scroll area
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)

        connections_widget = QWidget()
        self.connections_layout = QVBoxLayout(connections_widget)
        self.connections_layout.setSpacing(12)
        self.connections_layout.setContentsMargins(0, 0, 0, 0)

        # Add sample database cards
        self.add_sample_connections()

        scroll_area.setWidget(connections_widget)
        sidebar_layout.addWidget(scroll_area, 1)

        parent.addWidget(sidebar_frame)
    
    def setup_content_area(self, parent):
        """Setup the main content area with tabs"""
        content_frame = QFrame()
        content_layout = QVBoxLayout(content_frame)
        content_layout.setContentsMargins(20, 20, 20, 20)
        
        # Tab widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabsClosable(True)
        self.tab_widget.tabCloseRequested.connect(self.close_tab)
        
        # Welcome tab
        self.add_welcome_tab()
        
        content_layout.addWidget(self.tab_widget)
        parent.addWidget(content_frame)
    
    def add_welcome_tab(self):
        """Add the welcome tab with statistics and getting started info"""
        welcome_widget = QWidget()
        welcome_layout = QVBoxLayout(welcome_widget)
        welcome_layout.setSpacing(30)
        welcome_layout.setContentsMargins(40, 40, 40, 40)
        
        # Welcome title
        title = QLabel("Welcome to Ultimate Database Manager")
        title.setStyleSheet("""
            font-size: 32px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 20px;
        """)
        title.setAlignment(Qt.AlignCenter)
        welcome_layout.addWidget(title)
        
        # Statistics cards
        stats_layout = QHBoxLayout()
        
        # Active connections card
        active_card = self.create_stat_card("Active Connections", "0", "#28a745")
        stats_layout.addWidget(active_card)
        
        # Total connections card
        total_card = self.create_stat_card("Total Connections", "0", "#007bff")
        stats_layout.addWidget(total_card)
        
        # Database types card
        types_card = self.create_stat_card("Database Types", "12+", "#17a2b8")
        stats_layout.addWidget(types_card)
        
        welcome_layout.addLayout(stats_layout)
        
        # Getting started section
        getting_started = QLabel("""
        <h3>Getting Started</h3>
        <p>• Click <strong>"+ New Connection"</strong> to add your first database connection</p>
        <p>• Supports PostgreSQL, MySQL, SQLite, MongoDB, Redis, and more</p>
        <p>• Modern glassmorphism design with Apple-inspired aesthetics</p>
        <p>• Docker integration for easy database deployment</p>
        <p>• Advanced import/export capabilities</p>
        """)
        getting_started.setStyleSheet("""
            font-size: 14px;
            color: #666666;
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                stop:0 rgba(255, 255, 255, 0.15),
                stop:1 rgba(255, 255, 255, 0.05));
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 20px;
            margin-top: 20px;
        """)
        welcome_layout.addWidget(getting_started)
        
        welcome_layout.addStretch()
        
        self.tab_widget.addTab(welcome_widget, "Welcome")
    
    def create_stat_card(self, title, value, color):
        """Create a statistics card widget"""
        card = QFrame()
        card.setFixedSize(200, 120)
        
        layout = QVBoxLayout(card)
        layout.setAlignment(Qt.AlignCenter)
        
        value_label = QLabel(value)
        value_label.setStyleSheet(f"font-size: 36px; font-weight: bold; color: {color};")
        value_label.setAlignment(Qt.AlignCenter)
        
        title_label = QLabel(title)
        title_label.setStyleSheet("font-size: 14px; color: #666666; font-weight: 500;")
        title_label.setAlignment(Qt.AlignCenter)
        
        layout.addWidget(value_label)
        layout.addWidget(title_label)
        
        card.setStyleSheet(f"""
            QFrame {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(255, 255, 255, 0.15),
                    stop:1 rgba(255, 255, 255, 0.05));
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 16px;
            }}
            QFrame:hover {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(255, 255, 255, 0.25),
                    stop:1 rgba(255, 255, 255, 0.15));
                border: 1px solid {color};
            }}
        """)
        
        return card
    
    def add_sample_connections(self):
        """Add sample database connection cards"""
        sample_connections = [
            ("PostgreSQL", "Local PostgreSQL", "Connected"),
            ("MySQL", "Production MySQL", "Connected"),
            ("MongoDB", "Atlas Cluster", "Disconnected"),
            ("Redis", "Cache Server", "Connected"),
            ("SQLite", "Local Database", "Connected"),
            ("Oracle", "Enterprise DB", "Disconnected"),
        ]

        for db_type, name, status in sample_connections:
            card = DatabaseCard(db_type, name, status)
            self.connections_layout.addWidget(card)

        self.connections_layout.addStretch()
    
    def change_theme(self, theme_name):
        """Change the application theme"""
        self.current_theme = theme_name
        self.setup_styling()

        # Force update all child widgets
        self.updateGeometry()
        self.repaint()

        # Update all database cards with new theme
        for i in range(self.connections_layout.count()):
            widget = self.connections_layout.itemAt(i).widget()
            if widget and isinstance(widget, DatabaseCard):
                widget.setup_styling()
                widget.updateGeometry()
                widget.repaint()

        # Update buttons
        for button in self.findChildren(ModernButton):
            button.updateGeometry()
            button.repaint()

        self.status_bar.showMessage(f"Theme changed to: {theme_name.title()}", 3000)
    
    def get_theme_colors(self):
        """Get color scheme based on current theme"""
        themes = {
            'light': {
                'bg_gradient_start': 'rgba(240, 248, 255, 1.0)',
                'bg_gradient_mid': 'rgba(230, 240, 255, 1.0)',
                'bg_gradient_end': 'rgba(220, 235, 255, 1.0)',
                'frame_bg': 'rgba(255, 255, 255, 0.15)',
                'frame_bg_end': 'rgba(255, 255, 255, 0.05)',
                'frame_border': 'rgba(200, 200, 220, 0.5)',
                'text_color': '#333333',
                'text_secondary': '#666666',
                'accent_color': '#007bff',
                'accent_hover': '#0056b3',
                'button_bg': 'rgba(255, 255, 255, 0.15)',
                'button_bg_end': 'rgba(255, 255, 255, 0.05)',
                'button_hover': 'rgba(255, 255, 255, 0.25)',
                'button_hover_end': 'rgba(255, 255, 255, 0.15)',
                'input_bg': 'rgba(255, 255, 255, 0.8)'
            },
            'dark': {
                'bg_gradient_start': 'rgba(15, 15, 25, 1.0)',
                'bg_gradient_mid': 'rgba(20, 20, 35, 1.0)',
                'bg_gradient_end': 'rgba(25, 25, 45, 1.0)',
                'frame_bg': 'rgba(40, 40, 60, 0.4)',
                'frame_bg_end': 'rgba(30, 30, 50, 0.3)',
                'frame_border': 'rgba(100, 100, 150, 0.4)',
                'text_color': '#E0E0E0',
                'text_secondary': '#B0B0B0',
                'accent_color': '#00D9FF',
                'accent_hover': '#00B8E6',
                'button_bg': 'rgba(60, 60, 90, 0.5)',
                'button_bg_end': 'rgba(50, 50, 80, 0.4)',
                'button_hover': 'rgba(80, 80, 120, 0.6)',
                'button_hover_end': 'rgba(70, 70, 110, 0.5)',
                'input_bg': 'rgba(40, 40, 60, 0.8)'
            },
            'blue': {
                'bg_gradient_start': 'rgba(10, 25, 47, 1.0)',
                'bg_gradient_mid': 'rgba(15, 35, 70, 1.0)',
                'bg_gradient_end': 'rgba(20, 45, 90, 1.0)',
                'frame_bg': 'rgba(30, 60, 100, 0.4)',
                'frame_bg_end': 'rgba(20, 50, 90, 0.3)',
                'frame_border': 'rgba(70, 130, 180, 0.5)',
                'text_color': '#E8F4F8',
                'text_secondary': '#A0C8E0',
                'accent_color': '#00BFFF',
                'accent_hover': '#009FDF',
                'button_bg': 'rgba(40, 80, 130, 0.5)',
                'button_bg_end': 'rgba(30, 70, 120, 0.4)',
                'button_hover': 'rgba(60, 100, 160, 0.6)',
                'button_hover_end': 'rgba(50, 90, 150, 0.5)',
                'input_bg': 'rgba(30, 60, 100, 0.8)'
            }
        }
        return themes.get(self.current_theme, themes['light'])
    
    def setup_styling(self):
        """Apply modern styling to the application"""
        colors = self.get_theme_colors()

        self.setStyleSheet(f"""
            QMainWindow {{
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 {colors['bg_gradient_start']},
                    stop:0.5 {colors['bg_gradient_mid']},
                    stop:1 {colors['bg_gradient_end']});
            }}
            QFrame {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {colors['frame_bg']},
                    stop:1 {colors['frame_bg_end']});
                border: 1px solid {colors['frame_border']};
                border-radius: 12px;
            }}
            QTabWidget::pane {{
                border: 1px solid {colors['frame_border']};
                border-radius: 8px;
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {colors['frame_bg']},
                    stop:1 {colors['frame_bg_end']});
            }}
            QTabBar::tab {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {colors['button_bg']},
                    stop:1 {colors['button_bg_end']});
                border: 1px solid {colors['frame_border']};
                color: {colors['text_color']};
                padding: 8px 16px;
                margin-right: 2px;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }}
            QTabBar::tab:selected {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {colors['button_hover']},
                    stop:1 {colors['button_hover_end']});
                border-bottom: 2px solid {colors['accent_color']};
            }}
            QTabBar::tab:hover {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 {colors['button_hover']},
                    stop:1 {colors['button_hover_end']});
            }}
            QScrollArea {{
                border: none;
                background: transparent;
            }}
            QScrollBar:vertical {{
                background: {colors['frame_bg']};
                width: 12px;
                border-radius: 6px;
                margin: 0px;
            }}
            QScrollBar::handle:vertical {{
                background: {colors['accent_color']};
                border-radius: 6px;
                min-height: 30px;
            }}
            QScrollBar::handle:vertical:hover {{
                background: {colors['accent_hover']};
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0px;
            }}
            QLabel {{
                color: {colors['text_color']};
                background: transparent;
            }}
            QMenuBar {{
                background: {colors['frame_bg']};
                color: {colors['text_color']};
                padding: 4px;
            }}
            QMenuBar::item {{
                padding: 4px 8px;
                border-radius: 4px;
            }}
            QMenuBar::item:selected {{
                background: {colors['button_hover']};
            }}
            QMenu {{
                background: {colors['frame_bg']};
                color: {colors['text_color']};
                border: 1px solid {colors['frame_border']};
                padding: 4px;
            }}
            QMenu::item {{
                padding: 6px 24px;
                border-radius: 4px;
            }}
            QMenu::item:selected {{
                background: {colors['button_hover']};
            }}
            QStatusBar {{
                background: {colors['frame_bg']};
                color: {colors['text_color']};
                border-top: 1px solid {colors['frame_border']};
            }}
        """)

        # Update all child widgets to reflect theme change
        self.update()
    
    def setup_menu_bar(self):
        """Setup the application menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu('File')
        
        new_connection_action = QAction('New Connection...', self)
        new_connection_action.setShortcut('Cmd+N')
        new_connection_action.triggered.connect(self.show_connection_dialog)
        file_menu.addAction(new_connection_action)
        
        file_menu.addSeparator()
        
        import_action = QAction('Import Data...', self)
        import_action.setShortcut('Cmd+I')
        file_menu.addAction(import_action)
        
        export_action = QAction('Export Data...', self)
        export_action.setShortcut('Cmd+E')
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        quit_action = QAction('Quit', self)
        quit_action.setShortcut('Cmd+Q')
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)
        
        # View menu
        view_menu = menubar.addMenu('View')
        
        # Theme submenu
        theme_menu = view_menu.addMenu('Theme')
        
        light_theme_action = QAction('Light Theme', self)
        light_theme_action.triggered.connect(lambda: self.change_theme('light'))
        theme_menu.addAction(light_theme_action)
        
        dark_theme_action = QAction('Dark Theme', self)
        dark_theme_action.triggered.connect(lambda: self.change_theme('dark'))
        theme_menu.addAction(dark_theme_action)
        
        blue_theme_action = QAction('Blue Theme', self)
        blue_theme_action.triggered.connect(lambda: self.change_theme('blue'))
        theme_menu.addAction(blue_theme_action)
        
        # Tools menu
        tools_menu = menubar.addMenu('Tools')
        
        docker_action = QAction('Docker Manager', self)
        tools_menu.addAction(docker_action)
        
        preferences_action = QAction('Preferences...', self)
        preferences_action.setShortcut('Cmd+,')
        tools_menu.addAction(preferences_action)
        
        # Help menu
        help_menu = menubar.addMenu('Help')
        
        about_action = QAction('About Ultimate Database Manager', self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
    
    def setup_status_bar(self):
        """Setup the status bar"""
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        
        # Connection status
        self.connection_status = QLabel("Ready")
        self.status_bar.addWidget(self.connection_status)
        
        # Progress bar for operations
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.status_bar.addPermanentWidget(self.progress_bar)
    
    def show_connection_dialog(self):
        """Show the new connection dialog"""
        dialog = ConnectionDialog(self)
        if dialog.exec() == QDialog.Accepted:
            # Get connection details and create new connection
            connection_data = {
                'type': dialog.db_type.currentText(),
                'name': dialog.name_field.text(),
                'host': dialog.host_field.text(),
                'port': dialog.port_field.value(),
                'database': dialog.database_field.text(),
                'username': dialog.username_field.text(),
                'password': dialog.password_field.text(),
                'ssl': dialog.ssl_checkbox.isChecked()
            }
            
            # Add new connection card
            card = DatabaseCard(
                connection_data['type'], 
                connection_data['name'], 
                "Disconnected"
            )
            self.connections_layout.insertWidget(self.connections_layout.count() - 1, card)
            
            self.status_bar.showMessage(f"Added connection: {connection_data['name']}", 3000)
    
    def close_tab(self, index):
        """Close a tab"""
        if self.tab_widget.count() > 1:  # Keep at least one tab
            self.tab_widget.removeTab(index)
    
    def show_about(self):
        """Show about dialog"""
        QMessageBox.about(self, "About Ultimate Database Manager", 
                         """
                         <h3>Ultimate Database Manager v3.0.0</h3>
                         <p>Modern, Apple-inspired database management tool</p>
                         <p>Features:</p>
                         <ul>
                         <li>Multi-database support (PostgreSQL, MySQL, MongoDB, Redis, etc.)</li>
                         <li>Modern glassmorphism UI design</li>
                         <li>Docker integration</li>
                         <li>Advanced import/export capabilities</li>
                         <li>Real-time monitoring</li>
                         </ul>
                         <p>© 2024 Ultimate DB Tools</p>
                         """)
    
    def show_welcome_message(self):
        """Show welcome message in status bar"""
        self.status_bar.showMessage("Welcome to Ultimate Database Manager! Click '+ New Connection' to get started.", 5000)


def main():
    """Main application entry point"""
    app = QApplication(sys.argv)
    
    # Set application properties
    app.setApplicationName("Ultimate Database Manager")
    app.setApplicationVersion("3.0.0")
    app.setOrganizationName("Ultimate DB Tools")
    
    # Set application icon (if available)
    try:
        icon_path = Path(__file__).parent.parent / 'resources' / 'app_icon.icns'
        if icon_path.exists():
            app.setWindowIcon(QIcon(str(icon_path)))
    except:
        pass
    
    # Create and show main window
    window = UltimateAppleDatabaseManager()
    window.show()
    
    # Start event loop
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
