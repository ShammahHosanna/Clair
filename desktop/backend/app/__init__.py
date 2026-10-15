"""Clair Desktop — backend Flask.

Lancement (développement) :
    cd desktop/backend && python run.py

En production, l'app sert aussi le build du frontend (desktop/frontend/dist) :
une seule URL, un seul port.
"""
from __future__ import annotations

import os

from flask import Flask, send_from_directory

from .api import bp

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.register_blueprint(bp)

    @app.get("/")
    def index():
        return send_from_directory(DIST_DIR, "index.html")

    @app.get("/<path:path>")
    def spa(path):
        full = os.path.join(DIST_DIR, path)
        if os.path.isfile(full):
            return send_from_directory(DIST_DIR, path)
        # SPA : toute route inconnue revient à index.html
        return send_from_directory(DIST_DIR, "index.html")

    @app.get("/api/health")
    def health_duplicate():
        return {"status": "ok"}

    return app


if __name__ == "__main__":
    import os
    from . import create_app as _c
    _app = _c()
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    host = "127.0.0.1" if debug else "0.0.0.0"
    _app.run(host=host, port=port, debug=debug)
