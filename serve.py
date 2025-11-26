#!/usr/bin/env python3
"""
Simple HTTP server for local development
Usage: python serve.py [port]
Default port: 3000
"""

import sys
import http.server
import socketserver


def main():
    PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 3000

    class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Add CORS headers for local development
            self.send_header('Access-Control-Allow-Origin', '*')
            super().end_headers()

    Handler = MyHTTPRequestHandler

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n🎮 POK Scorer Development Server")
        print(f"\n📡 Server running at:")
        print(f"   http://localhost:{PORT}/")
        print(f"\n✨ Press Ctrl+C to stop\n")
        httpd.serve_forever()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nServer stopped by user")