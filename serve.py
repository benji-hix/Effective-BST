"""Serve the app locally with caching disabled, so edits show up on a normal reload.

Usage: python3 serve.py [port]   (default 8765, then open http://localhost:8765)
"""
import functools, http.server, pathlib, sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
app_dir = pathlib.Path(__file__).resolve().parent / 'app'
handler = functools.partial(NoCacheHandler, directory=str(app_dir))
print(f'Serving Effective BST at http://localhost:{port} (Ctrl+C to stop)')
http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
