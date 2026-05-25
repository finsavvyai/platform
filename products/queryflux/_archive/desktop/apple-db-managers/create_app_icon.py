#!/usr/bin/env python3
"""
Create a beautiful app icon for Ultimate Database Manager
"""

from PySide6.QtWidgets import QApplication
from PySide6.QtGui import *
from PySide6.QtCore import *
import sys
import os

def create_app_icon():
    """Create a beautiful Apple-style app icon"""
    app = QApplication(sys.argv)

    # Create high-resolution icon (1024x1024 for retina)
    size = 1024
    pixmap = QPixmap(size, size)
    pixmap.fill(Qt.GlobalColor.transparent)

    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.RenderHint.Antialiasing)

    # Create gradient background (Apple blue to darker blue)
    gradient = QLinearGradient(0, 0, 0, size)
    gradient.setColorAt(0, QColor(0, 122, 255))    # Apple blue
    gradient.setColorAt(1, QColor(0, 64, 221))     # Darker blue

    # Draw rounded rectangle background
    rect = QRectF(20, 20, size-40, size-40)
    painter.setBrush(QBrush(gradient))
    painter.setPen(Qt.PenStyle.NoPen)
    painter.drawRoundedRect(rect, 180, 180)  # Apple-style rounded corners

    # Add subtle shadow/depth
    shadow_rect = QRectF(25, 25, size-50, size-50)
    shadow_gradient = QLinearGradient(0, 0, 0, size)
    shadow_gradient.setColorAt(0, QColor(255, 255, 255, 30))
    shadow_gradient.setColorAt(1, QColor(0, 0, 0, 30))
    painter.setBrush(QBrush(shadow_gradient))
    painter.drawRoundedRect(shadow_rect, 175, 175)

    # Draw database icon
    painter.setPen(QPen(QColor(255, 255, 255), 8))
    painter.setBrush(QBrush(QColor(255, 255, 255)))

    # Database cylinder (top)
    ellipse_top = QRectF(size*0.25, size*0.3, size*0.5, size*0.15)
    painter.drawEllipse(ellipse_top)

    # Database cylinder (body)
    body_rect = QRectF(size*0.25, size*0.375, size*0.5, size*0.35)
    painter.drawRect(body_rect)

    # Database cylinder (bottom)
    ellipse_bottom = QRectF(size*0.25, size*0.65, size*0.5, size*0.15)
    painter.drawEllipse(ellipse_bottom)

    # Add connection lines (representing network/connectivity)
    painter.setPen(QPen(QColor(255, 255, 255, 180), 6))
    # Curved lines emanating from the database
    painter.drawArc(QRectF(size*0.15, size*0.2, size*0.3, size*0.3), 0, 90*16)
    painter.drawArc(QRectF(size*0.55, size*0.2, size*0.3, size*0.3), 90*16, 90*16)
    painter.drawArc(QRectF(size*0.15, size*0.5, size*0.3, size*0.3), 270*16, 90*16)
    painter.drawArc(QRectF(size*0.55, size*0.5, size*0.3, size*0.3), 180*16, 90*16)

    painter.end()

    # Create resources directory if it doesn't exist
    os.makedirs('resources', exist_ok=True)

    # Save as PNG for development
    pixmap.save('resources/app_icon.png', 'PNG')

    # Create different sizes for the icon set
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for icon_size in sizes:
        scaled_pixmap = pixmap.scaled(icon_size, icon_size, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
        scaled_pixmap.save(f'resources/icon_{icon_size}.png', 'PNG')

    print("✅ App icon created successfully!")
    print("📁 Files created:")
    print("   - resources/app_icon.png (main icon)")
    for size in sizes:
        print(f"   - resources/icon_{size}.png")

    app.quit()

if __name__ == "__main__":
    create_app_icon()