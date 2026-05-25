#!/usr/bin/env python3
"""
Multi-Database Manager - Main application entry point
Modern macOS application with Apple design guidelines
"""

import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QPixmap, QIcon
from PySide6.QtWidgets import QSplashScreen, QLabel

from src.ultimate_db_manager.gui.macos_application import MacOSApplication


class ModernSplashScreen(QSplashScreen):
    """Modern splash screen with macOS design"""
    
    def __init__(self):
        # Create a modern splash screen
        pixmap = QPixmap(400, 300)
        pixmap.fill(Qt.GlobalColor.white)
        
        super().__init__(pixmap)
        
        # Setup splash screen appearance
        self.setWindowFlags(Qt.WindowType.SplashScreen | Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Add content to splash screen
        self.setup_content()
        
    def setup_content(self):
        """Setup splash screen content"""
        from PySide6.QtWidgets import QVBoxLayout, QWidget
        from PySide6.QtCore import Qt
        from PySide6.QtGui import QFont
        
        # Create content widget
        content = QWidget(self)
        layout = QVBoxLayout(content)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        # App icon (placeholder)
        icon_label = QLabel("🗄️")
        icon_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        icon_label.setStyleSheet("font-size: 64px; margin: 20px;")
        layout.addWidget(icon_label)
        
        # App name
        name_label = QLabel("Multi-Database Manager")
        name_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name_label.setFont(QFont(".AppleSystemUIFont", 24, QFont.Weight.Medium))
        name_label.setStyleSheet("color: #333; margin: 10px;")
        layout.addWidget(name_label)
        
        # Version
        version_label = QLabel("Version 2.0.0")
        version_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        version_label.setFont(QFont(".AppleSystemUIFont", 14))
        version_label.setStyleSheet("color: #666; margin: 5px;")
        layout.addWidget(version_label)
        
        # Loading message
        self.loading_label = QLabel("Loading...")
        self.loading_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.loading_label.setFont(QFont(".AppleSystemUIFont", 12))
        self.loading_label.setStyleSheet("color: #999; margin: 20px;")
        layout.addWidget(self.loading_label)
        
        content.setGeometry(0, 0, 400, 300)
        
    def show_message(self, message: str):
        """Show loading message"""
        self.loading_label.setText(message)
        self.repaint()


def main():
    """Main application entry point"""
    # Enable high DPI support
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    
    # Create application
    app = MacOSApplication(sys.argv)
    
    # Show splash screen
    splash = ModernSplashScreen()
    splash.show()
    
    # Process events to show splash screen
    app.processEvents()
    
    # Simulate loading process
    loading_steps = [
        "Initializing application...",
        "Loading design system...",
        "Setting up database adapters...",
        "Preparing user interface...",
        "Ready!"
    ]
    
    for i, message in enumerate(loading_steps):
        splash.show_message(message)
        app.processEvents()
        
        # Simulate loading time
        QTimer.singleShot(200 * (i + 1), lambda: None)
        app.processEvents()
    
    # Show main window
    app.show_main_window()
    
    # Close splash screen
    splash.finish(app.main_window)
    
    # Run application
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())