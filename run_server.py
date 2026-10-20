"""
=============================================================================
PROYECTO CAYETINO 2 - SERVIDOR LOCAL CON UV (run_server.py)
Servidor HTTP liviano con soporte CORS, no-cache y apertura de navegador
=============================================================================
"""

import http.server
import socketserver
import webbrowser
import threading
import sys
import os

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class CayetinoHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Cabeceras útiles para desarrollo local y Web Serial
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        # Mensajes limpios en consola
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")


def open_browser():
    webbrowser.open(f"http://localhost:{PORT}")


def main():
    print("=" * 66)
    print("  ⚡ CAYETINO 2 - SERVIDOR WEB LOCAL (UV)")
    print(f"  Dirección: http://localhost:{PORT}")
    print("  Directorio raíz:", DIRECTORY)
    print("  Web Serial API habilitada para http://localhost")
    print("  Presiona Ctrl+C para detener el servidor.")
    print("=" * 66)

    # Abrir navegador automáticamente tras 1 segundo
    timer = threading.Timer(1.0, open_browser)
    timer.daemon = True
    timer.start()

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CayetinoHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido correctamente.")
        sys.exit(0)
    except OSError as e:
        if "address already in use" in str(e).lower() or e.errno == 98 or e.errno == 10048:
            print(f"\n⚠️ El puerto {PORT} ya está ocupado. Intentando en http://localhost:{PORT + 1} ...")
            with socketserver.TCPServer(("", PORT + 1), CayetinoHTTPRequestHandler) as httpd:
                webbrowser.open(f"http://localhost:{PORT + 1}")
                httpd.serve_forever()
        else:
            raise e


if __name__ == "__main__":
    main()
