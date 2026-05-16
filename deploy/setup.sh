#!/bin/bash
# AI Research OS - Remote Server Setup Script
# Target: Ubuntu/Debian server at 47.120.47.165
# Run as root or user with sudo

set -e

echo "=== AI Research OS Server Setup ==="
echo "Target: $(hostname)"
echo "Date: $(date)"

# 1. System updates
echo ""
echo "--- Updating system packages ---"
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Node.js 20.x
echo ""
echo "--- Installing Node.js 20.x ---"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# 3. Install MongoDB 7.x
echo ""
echo "--- Installing MongoDB ---"
if ! command -v mongod &>/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  sudo apt-get update -y
  sudo apt-get install -y mongodb-org
  sudo systemctl enable mongod
  sudo systemctl start mongod
fi
echo "MongoDB: $(mongod --version | head -1)"

# 4. Install nginx
echo ""
echo "--- Installing nginx ---"
if ! command -v nginx &>/dev/null; then
  sudo apt-get install -y nginx
  sudo systemctl enable nginx
fi

# 5. Install PM2 globally
echo ""
echo "--- Installing PM2 ---"
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
  pm2 startup systemd -u "$(whoami)" --hp "$HOME"
fi

# 6. Create app directory
APP_DIR="/opt/ai-research-os"
echo ""
echo "--- Setting up app directory: $APP_DIR ---"
sudo mkdir -p "$APP_DIR"
sudo chown "$(whoami):$(whoami)" "$APP_DIR"

# 7. Create required directories
echo "--- Creating data directories ---"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/backups"

# 8. Configure nginx reverse proxy
echo ""
echo "--- Configuring nginx ---"
sudo tee /etc/nginx/sites-available/ai-research << 'NGINX_CONF'
server {
    listen 25917;
    server_name 47.120.47.165;

    # Frontend static files
    root /opt/ai-research-os/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded files
    location /uploads/ {
        alias /opt/ai-research-os/uploads/;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/ai-research /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 9. Configure firewall (UFW)
echo ""
echo "--- Configuring firewall ---"
sudo ufw allow 22/tcp
sudo ufw allow 25917/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Manual steps remaining:"
echo "1. Copy project files: scp -r . user@47.120.47.165:/opt/ai-research-os/"
echo "2. Create .env file on server: cp .env.example .env && nano .env"
echo "3. Install dependencies: cd /opt/ai-research-os && npm ci --production"
echo "4. Build frontend: npm run build"
echo "5. Start services: pm2 start ecosystem.config.cjs && pm2 save"
echo "6. Setup SSL with certbot (optional): sudo certbot --nginx"
