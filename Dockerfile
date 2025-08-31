
# Deploy-ready Dockerfile (Render/Railway/Fly)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1         PYTHONUNBUFFERED=1         PIP_NO_CACHE_DIR=1

# System deps for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends         wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0         libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 libdbus-1-3 libdrm2 libgbm1         libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libx11-xcb1         libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6         libxrandr2 libxrender1 libxss1 libxtst6 xvfb && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN python -m pip install --upgrade pip && pip install -r requirements.txt
# Install Playwright & Chromium
RUN python -m pip install playwright && playwright install --with-deps chromium

COPY . .

# Default to port 10000 (Render sets $PORT)
ENV PORT=10000
CMD ["bash", "-lc", "exec gunicorn tools.api_server:app -b 0.0.0.0:${PORT} --timeout 180"]
