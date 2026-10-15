"""Point d'entrée.

Développement local :
    cd desktop/backend && python run.py

Production (Render, etc.) : le port est lu depuis la variable $PORT
et l'écoute se fait sur 0.0.0.0 (obligatoire en PaaS). Sinon, port 5000.
"""
import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    # En dev local : FLASK_DEBUG=1 python run.py  (expose 127.0.0.1:5000)
    # Sur Render   : python run.py               (expose 0.0.0.0:$PORT)
    host = "127.0.0.1" if debug else "0.0.0.0"
    app.run(host=host, port=port, debug=debug)
