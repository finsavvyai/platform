#!/usr/bin/env python3
"""
UPM Test Application - Universal Package Manager
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os

class UPMTestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "service": "UPM Test App",
                "version": "1.0.0",
                "platform": "Universal Package Manager",
                "endpoints": {
                    "health": "/health",
                    "main": "/",
                    "api": "/api"
                }
            }
            self.wfile.write(json.dumps(response, indent=2).encode())
            
        elif self.path == '/api':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "message": "UPM API is working!",
                "service": "Universal Package Manager",
                "version": "1.0.0",
                "features": [
                    "Cross-language dependencies",
                    "Universal package management",
                    "Multi-language bridges",
                    "Cloud-native deployment"
                ]
            }
            self.wfile.write(json.dumps(response, indent=2).encode())
            
        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>UPM - Universal Package Manager</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0; 
                        padding: 40px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        min-height: 100vh;
                    }
                    .container { 
                        max-width: 800px; 
                        margin: 0 auto; 
                        background: rgba(255,255,255,0.1);
                        padding: 40px;
                        border-radius: 20px;
                        backdrop-filter: blur(10px);
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    }
                    .success { 
                        color: #4ade80; 
                        font-size: 2em;
                        margin-bottom: 20px;
                    }
                    .info { 
                        background: rgba(255,255,255,0.1); 
                        padding: 30px; 
                        border-radius: 15px; 
                        margin: 20px 0;
                        border: 1px solid rgba(255,255,255,0.2);
                    }
                    .feature {
                        background: rgba(255,255,255,0.05);
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 10px;
                        border-left: 4px solid #4ade80;
                    }
                    .endpoint {
                        background: rgba(0,0,0,0.2);
                        padding: 10px;
                        border-radius: 5px;
                        font-family: monospace;
                        margin: 5px 0;
                    }
                    a { color: #4ade80; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="success">🚀 UPM Platform Live!</h1>
                    <div class="info">
                        <h2>Universal Package Manager (UPM)</h2>
                        <p>Your UPM platform is now running on Google Cloud Platform with HTTPS!</p>
                        
                        <div class="feature">
                            <strong>✅ Status:</strong> <span class="success">Running</span>
                        </div>
                        <div class="feature">
                            <strong>🌐 Platform:</strong> Google Kubernetes Engine (GKE)
                        </div>
                        <div class="feature">
                            <strong>🔒 Security:</strong> HTTPS with SSL Certificate
                        </div>
                        <div class="feature">
                            <strong>☁️ CDN:</strong> Cloudflare Global Network
                        </div>
                        <div class="feature">
                            <strong>🐳 Container:</strong> Docker
                        </div>
                        
                        <h3>Available Endpoints:</h3>
                        <div class="endpoint">GET /health - Health check</div>
                        <div class="endpoint">GET /api - API information</div>
                        <div class="endpoint">GET / - This page</div>
                        
                        <h3>Quick Links:</h3>
                        <p>
                            <a href="/health">🔍 Health Check</a> | 
                            <a href="/api">📡 API Info</a>
                        </p>
                    </div>
                    <p><em>This is a test deployment to verify that your UPM infrastructure is working correctly.</em></p>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "error": "Not Found",
                "message": "The requested endpoint was not found",
                "available_endpoints": ["/", "/health", "/api"]
            }
            self.wfile.write(json.dumps(response, indent=2).encode())

    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    server = HTTPServer(('0.0.0.0', port), UPMTestHandler)
    print(f"Starting UPM test server on port {port}")
    server.serve_forever()


