#!/usr/bin/env python3
"""
Simple test application for UPM deployment verification
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os

class TestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "UPM Test App",
                "version": "1.0.0"
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>UPM Test App</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .success { color: #28a745; }
                    .info { background: #f8f9fa; padding: 20px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="success">🚀 UPM Deployment Successful!</h1>
                    <div class="info">
                        <h2>Universal Package Manager (UPM)</h2>
                        <p>Your UPM application is now running on Google Cloud Platform!</p>
                        <ul>
                            <li><strong>Status:</strong> <span class="success">Running</span></li>
                            <li><strong>Platform:</strong> Google Kubernetes Engine (GKE)</li>
                            <li><strong>Container:</strong> Docker</li>
                            <li><strong>Health Check:</strong> <a href="/health">/health</a></li>
                        </ul>
                    </div>
                    <p>This is a test deployment to verify that your UPM infrastructure is working correctly.</p>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Not Found')

    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    server = HTTPServer(('0.0.0.0', port), TestHandler)
    print(f"Starting UPM test server on port {port}")
    server.serve_forever()
