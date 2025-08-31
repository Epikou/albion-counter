
# Albion Counter — Deploy Ready

Déploiement **gratuit** (backend Flask + Playwright + site statique servi par Flask).

## Option A — Render (le plus simple)
1. Crée un dépôt GitHub et push tout le dossier.
2. Sur https://dashboard.render.com → "New +" → "Web Service".
3. Choisis "Deploy an existing repo" → type **Docker** (le repo contient `Dockerfile`).
4. Laisse le port par défaut (Render définira `$PORT`). Build ≈ quelques minutes.
5. Ton site sera dispo sur `https://<ton-app>.onrender.com/` et l'API sur `https://<ton-app>.onrender.com/api/scrape`.

## Option B — Railway (gratuit)
1. Import le repo → "Deploy".
2. Il détecte le `Dockerfile`. L'URL publique s'affiche une fois déployé.

## Option C — Fly.io (gratuit)
1. Installe `flyctl` puis `fly launch` (ou utilise `fly.toml` fourni).

### Notes
- Le front appelle maintenant **`/api/scrape`** (relatif), donc aucune modif d’URL côté client.
- Playwright est configuré **`--no-sandbox`** pour les plateformes gérées.
- CORS est ouvert (`*`). Si besoin, restreins-le dans `tools/api_server.py`.

### Démarrage local (facultatif)
```bash
python -m pip install -r requirements.txt
python -m playwright install chromium
gunicorn tools.api_server:app -b 0.0.0.0:5055 --timeout 180
# Ouvre http://localhost:5055/
```
