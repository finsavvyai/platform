#!/usr/bin/env python3
"""
LunaOS Orchestrator GUI Server
Simple HTTP server to serve the 3D visual workflow editor
"""

import http.server
import socketserver
import os
import sys
import webbrowser
from pathlib import Path

class LunaOSGUIHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler for LunaOS GUI with CORS support"""
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        # Custom log format
        print(f"[{self.date_time_string()}] {format % args}")

def start_server(port=8080, open_browser=True):
    """Start the LunaOS GUI server"""
    
    # Change to the GUI directory
    gui_dir = Path(__file__).parent
    os.chdir(gui_dir)
    
    # Create server
    with socketserver.TCPServer(("", port), LunaOSGUIHandler) as httpd:
        print(f"🌙 LunaOS Orchestrator GUI Server")
        print(f"📡 Server running at: http://localhost:{port}")
        print(f"📁 Serving from: {gui_dir}")
        print(f"🎨 3D Visual Workflow Editor ready!")
        print(f"⏹️  Press Ctrl+C to stop the server")
        print("-" * 50)
        
        if open_browser:
            try:
                webbrowser.open(f'http://localhost:{port}')
                print(f"🌐 Opening browser...")
            except Exception as e:
                print(f"⚠️  Could not open browser: {e}")
                print(f"🌐 Please open http://localhost:{port} manually")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n🛑 Server stopped by user")
            httpd.shutdown()

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='LunaOS Orchestrator GUI Server')
    parser.add_argument('--port', '-p', type=int, default=8080, 
                       help='Port to run the server on (default: 8080)')
    parser.add_argument('--no-browser', action='store_true',
                       help='Do not open browser automatically')
    
    args = parser.parse_args()
    
    # Check if port is available
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', args.port))
    sock.close()
    
    if result == 0:
        print(f"❌ Port {args.port} is already in use")
        print(f"💡 Try a different port: python server.py --port {args.port + 1}")
        sys.exit(1)
    
    start_server(args.port, not args.no_browser)

if __name__ == '__main__':
    main()
