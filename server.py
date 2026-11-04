import http.server
import socketserver
import webbrowser
import os
import sys
import threading
import time

DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Ensure utf-8 stdout in windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        if str(path).endswith('.riv'):
            return 'application/octet-stream'
        if str(path).endswith('.wasm'):
            return 'application/wasm'
        return super().guess_type(path)

def find_available_port(start_port=5500, max_port=5520):
    import socket
    for port in range(start_port, max_port):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    return start_port

def run_server():
    port = find_available_port(5500)
    url = f"http://localhost:{port}"

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), CustomHTTPRequestHandler) as httpd:
        print("=" * 60)
        print("  [OK] SOBO Mascot Rive Viewer is running!")
        print(f"  --> Local URL: {url}")
        print("=" * 60)
        print("  Press Ctrl + C in this terminal to stop the server.\n")

        def open_browser():
            time.sleep(0.8)
            webbrowser.open(url)

        threading.Thread(target=open_browser, daemon=True).start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run_server()
