"""
Enhanced Glass Connection Dialog with Beautiful Database Cards
Clean implementation with proper error handling and visual feedback
"""

from typing import Optional, Dict, Any
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


class DatabaseCard(QWidget):
    """Simple, beautiful database selection card"""
    
    clicked = Signal(str)  # database type
    
    def __init__(self, db_type: str, description: str, color: str = "#007AFF"):
        super().__init__()
        self.db_type = db_type
        self.description = description
        self.color = QColor(color)
        self.is_selected = False
        self.setup_ui()
    
    def setup_ui(self):
        """Setup the card UI"""
        self.setFixedSize(140, 100)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        
        # Main layout
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(4)
        
        # Icon
        icon_label = QLabel()
        try:
            icon = DatabaseIcons.create_database_icon(self.db_type, 32)
            icon_label.setPixmap(icon.pixmap(32, 32))
        except:
            # Fallback to text if icon creation fails
            icon_label.setText("🗄️")
            icon_label.setStyleSheet("font-size: 24px;")
        
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(icon_label)
        
        # Name
        name_label = QLabel(self.db_type)
        name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name_label.setStyleSheet("""
            QLabel {
                font-size: 12px;
                font-weight: 600;
                color: #1d1d1f;
                background: transparent;
            }
        """)
        layout.addWidget(name_label)
        
        # Description
        desc_label = QLabel(self.description)
        desc_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        desc_label.setWordWrap(True)
        desc_label.setStyleSheet("""
            QLabel {
                font-size: 9px;
                color: #8E8E93;
                background: transparent;
            }
        """)
        layout.addWidget(desc_label)
    
    def set_selected(self, selected: bool):
        """Set selection state"""
        self.is_selected = selected
        self.update()
    
    def paintEvent(self, event):
        """Custom paint for glass effect"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        rect = self.rect()
        
        if self.is_selected:
            # Selected - blue glass
            gradient = QLinearGradient(0, 0, 0, rect.height())
            gradient.setColorAt(0, QColor(0, 122, 255, 200))
            gradient.setColorAt(1, QColor(0, 122, 255, 160))
            painter.setBrush(QBrush(gradient))
            painter.setPen(QPen(QColor(0, 122, 255, 180), 2))
        else:
            # Normal - white glass
            gradient = QLinearGradient(0, 0, 0, rect.height())
            gradient.setColorAt(0, QColor(255, 255, 255, 180))
            gradient.setColorAt(1, QColor(255, 255, 255, 140))
            painter.setBrush(QBrush(gradient))
            painter.setPen(QPen(QColor(255, 255, 255, 100), 1))
        
        painter.drawRoundedRect(rect.adjusted(1, 1, -1, -1), 12, 12)
    
    def mousePressEvent(self, event):
        """Handle click"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(self.db_type)
        super().mousePressEvent(event)


class SimpleConnectionTestThread(QThread):
    """Simple connection test thread"""
    
    result_ready = Signal(bool, str)
    
    def __init__(self, db_type: str, host: str, port: int, database: str, username: str, password: str):
        super().__init__()
        self.db_type = db_type
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
    
    def run(self):
        """Test connection"""
        try:
            if self.db_type == "PostgreSQL":
                import psycopg2
                conn = psycopg2.connect(
                    host=self.host, port=self.port, database=self.database,
                    user=self.username, password=self.password, connect_timeout=10
                )
                conn.close()
                self.result_ready.emit(True, "✅ PostgreSQL connection successful!")
                
            elif self.db_type == "MySQL":
                import pymysql
                conn = pymysql.connect(
                    host=self.host, port=self.port, database=self.database,
                    user=self.username, password=self.password, connect_timeout=10
                )
                conn.close()
                self.result_ready.emit(True, "✅ MySQL connection successful!")
                
            elif self.db_type == "SQLite":
                import sqlite3
                conn = sqlite3.connect(self.database, timeout=10)
                conn.close()
                self.result_ready.emit(True, "✅ SQLite connection successful!")
                
            else:
                self.result_ready.emit(True, f"✅ {self.db_type} connection configured!")
                
        except ImportError as e:
            self.result_ready.emit(False, f"❌ Missing driver: {str(e)}")
        except Exception as e:
            self.result_ready.emit(False, f"❌ Connection failed: {str(e)}")


class EnhancedConnectionDialog(QDialog):
    """Enhanced connection dialog with beautiful database cards"""
    
    connection_created = Signal(dict)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("New Database Connection - Ultimate DB Manager")
        self.setModal(True)
        self.resize(700, 400)  # Start smaller, will expand when needed
        self.selected_db_type = None
        self.test_thread = None
        
        # Set window flags for rounded corners
        self.setWindowFlags(Qt.WindowType.Dialog | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        self.setup_ui()
        self.apply_styles()
    
    def setup_ui(self):
        """Setup the user interface"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(20)
        
        # Header with close button
        header_layout = QHBoxLayout()
        
        header_label = QLabel("Connect to Database2")
        header_label.setStyleSheet("""
            QLabel {
                font-size: 24px;
                font-weight: 700;
                color: #1d1d1f;
                margin-bottom: 8px;
            }
        """)
        header_layout.addWidget(header_label)
        
        header_layout.addStretch()
        
        # Close button
        close_button = QPushButton("✕")
        close_button.setFixedSize(30, 30)
        close_button.clicked.connect(self.reject)
        close_button.setStyleSheet("""
            QPushButton {
                background: rgba(255, 59, 48, 100);
                color: white;
                border: none;
                border-radius: 15px;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: rgba(255, 59, 48, 150);
            }
            QPushButton:pressed {
                background: rgba(255, 59, 48, 200);
            }
        """)
        header_layout.addWidget(close_button)
        
        layout.addLayout(header_layout)
        
        subtitle_label = QLabel("Choose your database type and enter connection details")
        subtitle_label.setStyleSheet("""
            QLabel {
                font-size: 14px;
                color: #8E8E93;
                margin-bottom: 16px;
            }
        """)
        layout.addWidget(subtitle_label)
        
        # Database type selection
        db_group = QGroupBox("Database Type")
        db_layout = QVBoxLayout(db_group)
        
        # Cards container
        cards_scroll = QScrollArea()
        cards_scroll.setWidgetResizable(True)
        cards_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        cards_scroll.setMaximumHeight(140)
        
        cards_widget = QWidget()
        cards_grid = QGridLayout(cards_widget)
        cards_grid.setSpacing(12)
        
        # Popular Databases Section
        popular_label = QLabel("Popular Databases")
        popular_label.setStyleSheet("""
            QLabel {
                font-size: 16px;
                font-weight: 600;
                color: #1d1d1f;
                margin: 8px 0px 4px 0px;
                padding: 4px 8px;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 rgba(0, 122, 255, 50),
                    stop:1 rgba(0, 122, 255, 20));
                border-radius: 6px;
            }
        """)
        cards_grid.addWidget(popular_label, 0, 0, 1, 4)
        
        popular_db_types = [
            ("PostgreSQL", "Advanced SQL", "#336791"),
            ("MySQL", "Popular SQL", "#00758F"),
            ("MongoDB", "Document DB", "#4DB33D"),
            ("Redis", "Key-Value", "#DC382D"),
            ("SQLite", "File-based", "#003B57"),
            ("MariaDB", "MySQL Fork", "#003545"),
            ("Oracle", "Enterprise", "#F80000"),
            ("SQL Server", "Microsoft", "#CC2927")
        ]
        
        self.db_cards = {}
        
        # Add popular databases
        for i, (db_type, desc, color) in enumerate(popular_db_types):
            card = DatabaseCard(db_type, desc, color)
            card.clicked.connect(self.select_database_type)
            self.db_cards[db_type] = card
            
            row = 1 + (i // 4)  # Start from row 1
            col = i % 4
            cards_grid.addWidget(card, row, col)
        
        # Separator
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet("""
            QFrame {
                color: rgba(209, 209, 214, 150);
                background-color: rgba(209, 209, 214, 150);
                height: 1px;
                margin: 12px 0px;
            }
        """)
        cards_grid.addWidget(separator, 3, 0, 1, 4)
        
        # Advanced & Cloud Databases Section
        advanced_label = QLabel("Advanced & Cloud Databases")
        advanced_label.setStyleSheet("""
            QLabel {
                font-size: 16px;
                font-weight: 600;
                color: #1d1d1f;
                margin: 8px 0px 4px 0px;
                padding: 4px 8px;
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 rgba(175, 82, 222, 50),
                    stop:1 rgba(175, 82, 222, 20));
                border-radius: 6px;
            }
        """)
        cards_grid.addWidget(advanced_label, 4, 0, 1, 4)
        
        advanced_db_types = [
            ("DynamoDB", "AWS NoSQL", "#FF9900"),
            ("Neo4j", "Graph DB", "#008CC1"),
            ("Cloudflare D1", "Edge SQLite", "#F38020"),
            ("DocumentDB", "AWS MongoDB", "#232F3E"),
            ("CockroachDB", "Distributed SQL", "#6933FF"),
            ("ClickHouse", "Analytics", "#FFCC02"),
            ("Cassandra", "Wide Column", "#1287B1"),
            ("Elasticsearch", "Search Engine", "#005571")
        ]
        
        # Add advanced databases
        for i, (db_type, desc, color) in enumerate(advanced_db_types):
            card = DatabaseCard(db_type, desc, color)
            card.clicked.connect(self.select_database_type)
            self.db_cards[db_type] = card
            
            row = 5 + (i // 4)  # Start from row 5
            col = i % 4
            cards_grid.addWidget(card, row, col)
        
        # No default selection - user must choose
        
        cards_scroll.setWidget(cards_widget)
        db_layout.addWidget(cards_scroll)
        layout.addWidget(db_group)
        
        # Connection details (initially hidden)
        self.details_group = QGroupBox("Connection Details")
        self.details_group.setVisible(False)  # Hide initially
        details_form = QFormLayout(self.details_group)
        details_form.setSpacing(12)
        
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("My Database Connection")
        details_form.addRow("Name:", self.name_edit)
        
        self.host_edit = QLineEdit()
        self.host_edit.setText("localhost")
        details_form.addRow("Host:", self.host_edit)
        
        self.port_spin = QSpinBox()
        self.port_spin.setRange(1, 65535)
        self.port_spin.setValue(5432)
        details_form.addRow("Port:", self.port_spin)
        
        self.database_edit = QLineEdit()
        self.database_edit.setPlaceholderText("Database name")
        details_form.addRow("Database:", self.database_edit)
        
        self.username_edit = QLineEdit()
        self.username_edit.setPlaceholderText("Username")
        details_form.addRow("Username:", self.username_edit)
        
        self.password_edit = QLineEdit()
        self.password_edit.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_edit.setPlaceholderText("Password")
        details_form.addRow("Password:", self.password_edit)
        
        layout.addWidget(self.details_group)
        
        # Status
        self.status_label = QLabel()
        self.status_label.setVisible(False)
        self.status_label.setWordWrap(True)
        layout.addWidget(self.status_label)
        
        # Progress
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Buttons (initially hidden except Cancel)
        self.button_widget = QWidget()
        self.button_widget.setVisible(False)  # Hide initially
        button_layout = QHBoxLayout(self.button_widget)
        
        self.test_button = QPushButton("🔍 Test Connection")
        self.test_button.clicked.connect(self.test_connection)
        button_layout.addWidget(self.test_button)
        
        button_layout.addStretch()
        
        self.connect_button = QPushButton("Connect")
        self.connect_button.clicked.connect(self.accept_connection)
        self.connect_button.setEnabled(False)
        button_layout.addWidget(self.connect_button)
        
        layout.addWidget(self.button_widget)
        
        # Always visible cancel button
        cancel_layout = QHBoxLayout()
        cancel_layout.addStretch()
        cancel_button = QPushButton("Cancel")
        cancel_button.clicked.connect(self.reject)
        cancel_layout.addWidget(cancel_button)
        layout.addLayout(cancel_layout)
    
    def apply_styles(self):
        """Apply beautiful styles"""
        self.setStyleSheet("""
            QDialog {
                background: transparent;
                border-radius: 20px;
            }
            
            QGroupBox {
                font-weight: 600;
                border: 1px solid #D1D1D6;
                border-radius: 8px;
                margin-top: 10px;
                padding-top: 10px;
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(255, 255, 255, 200),
                    stop:1 rgba(255, 255, 255, 180));
            }
            
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 8px;
                background: rgba(255, 255, 255, 220);
                border-radius: 4px;
            }
            
            QLineEdit, QSpinBox {
                border: 1px solid #D1D1D6;
                border-radius: 6px;
                padding: 8px 12px;
                background: rgba(255, 255, 255, 200);
                selection-background-color: #007AFF;
            }
            
            QLineEdit:focus, QSpinBox:focus {
                border-color: #007AFF;
                background: rgba(255, 255, 255, 220);
            }
            
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(0, 122, 255, 220),
                    stop:1 rgba(0, 122, 255, 180));
                color: white;
                border: none;
                border-radius: 8px;
                padding: 8px 16px;
                font-weight: 500;
                min-height: 20px;
            }
            
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(0, 122, 255, 240),
                    stop:1 rgba(0, 122, 255, 200));
            }
            
            QPushButton:pressed {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(0, 122, 255, 160),
                    stop:1 rgba(0, 122, 255, 140));
            }
            
            QPushButton:disabled {
                background: rgba(226, 232, 240, 180);
                color: rgba(107, 114, 128, 255);
            }
            
            QScrollArea {
                border: none;
                background: transparent;
            }
            
            QProgressBar {
                border: none;
                border-radius: 4px;
                background: rgba(226, 232, 240, 180);
                text-align: center;
            }
            
            QProgressBar::chunk {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 rgba(0, 122, 255, 200),
                    stop:1 rgba(0, 122, 255, 180));
                border-radius: 4px;
            }
        """)
    
    def select_database_type(self, db_type: str):
        """Select database type"""
        # Deselect all
        for card in self.db_cards.values():
            card.set_selected(False)
        
        # Select chosen
        self.db_cards[db_type].set_selected(True)
        self.selected_db_type = db_type
        
        # Show the connection details form and buttons
        self.details_group.setVisible(True)
        self.button_widget.setVisible(True)
        
        # Update form for the selected database type
        self.update_form_for_database_type()
        
        # Reset status
        self.connect_button.setEnabled(False)
        self.status_label.setVisible(False)
        
        # Auto-fill connection name
        self.name_edit.setText(f"{db_type} Connection")
        
        # Resize dialog to accommodate the new content
        self.resize(700, 600)  # Expand to show all content
        
        # Animate the resize for smooth transition
        from PySide6.QtCore import QPropertyAnimation, QEasingCurve
        self.resize_animation = QPropertyAnimation(self, b"size")
        self.resize_animation.setDuration(300)
        self.resize_animation.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.resize_animation.setEndValue(self.size())
        self.resize_animation.start()
    
    def update_form_for_database_type(self):
        """Update form based on database type"""
        if self.selected_db_type == "PostgreSQL":
            self.port_spin.setValue(5432)
            self.database_edit.setPlaceholderText("postgres")
        elif self.selected_db_type == "MySQL":
            self.port_spin.setValue(3306)
            self.database_edit.setPlaceholderText("mysql")
        elif self.selected_db_type == "MongoDB":
            self.port_spin.setValue(27017)
            self.database_edit.setPlaceholderText("admin")
        elif self.selected_db_type == "Redis":
            self.port_spin.setValue(6379)
            self.database_edit.setPlaceholderText("0")
        elif self.selected_db_type == "SQLite":
            self.database_edit.setPlaceholderText("/path/to/database.db")
    
    def test_connection(self):
        """Test the connection"""
        if self.test_thread and self.test_thread.isRunning():
            return
        
        if not self.database_edit.text():
            self.show_status("❌ Please enter a database name", False)
            return
        
        # Show progress
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)
        self.status_label.setVisible(True)
        self.status_label.setText("🔍 Testing connection...")
        self.test_button.setEnabled(False)
        
        # Start test
        self.test_thread = SimpleConnectionTestThread(
            self.selected_db_type,
            self.host_edit.text() or "localhost",
            self.port_spin.value(),
            self.database_edit.text(),
            self.username_edit.text(),
            self.password_edit.text()
        )
        self.test_thread.result_ready.connect(self.on_test_result)
        self.test_thread.start()
    
    def on_test_result(self, success: bool, message: str):
        """Handle test result"""
        self.progress_bar.setVisible(False)
        self.test_button.setEnabled(True)
        self.show_status(message, success)
        self.connect_button.setEnabled(success)
    
    def show_status(self, message: str, is_success: bool):
        """Show status message"""
        self.status_label.setVisible(True)
        self.status_label.setText(message)
        
        if is_success:
            self.status_label.setStyleSheet("""
                QLabel {
                    background: rgba(52, 199, 89, 50);
                    border: 1px solid rgba(52, 199, 89, 100);
                    border-radius: 6px;
                    padding: 8px;
                    color: #1d1d1f;
                }
            """)
        else:
            self.status_label.setStyleSheet("""
                QLabel {
                    background: rgba(255, 59, 48, 50);
                    border: 1px solid rgba(255, 59, 48, 100);
                    border-radius: 6px;
                    padding: 8px;
                    color: #1d1d1f;
                }
            """)
    
    def accept_connection(self):
        """Accept and create connection"""
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
        """Custom paint event for rounded corners and glass background"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Draw rounded background with glass effect
        rect = self.rect()
        
        # Create beautiful gradient background
        gradient = QLinearGradient(0, 0, 0, rect.height())
        gradient.setColorAt(0, QColor(248, 250, 252, 250))
        gradient.setColorAt(1, QColor(241, 245, 249, 230))
        
        painter.setBrush(QBrush(gradient))
        painter.setPen(QPen(QColor(255, 255, 255, 150), 2))
        painter.drawRoundedRect(rect.adjusted(1, 1, -1, -1), 20, 20)
        
        # Add subtle inner glow
        inner_gradient = QLinearGradient(0, 0, 0, rect.height() * 0.3)
        inner_gradient.setColorAt(0, QColor(255, 255, 255, 80))
        inner_gradient.setColorAt(1, QColor(255, 255, 255, 0))
        
        painter.setBrush(QBrush(inner_gradient))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawRoundedRect(rect.adjusted(2, 2, -2, -rect.height()//2), 18, 18)
        
        super().paintEvent(event)
    
    def mousePressEvent(self, event):
        """Handle mouse press for window dragging"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_position = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()
    
    def mouseMoveEvent(self, event):
        """Handle mouse move for window dragging"""
        if event.buttons() == Qt.MouseButton.LeftButton and hasattr(self, 'drag_position'):
            self.move(event.globalPosition().toPoint() - self.drag_position)
            event.accept()