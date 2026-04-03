# LOCK-IN Deployment Guide

## Option 1: Docker (Local/VPS)

### Quick Start
```bash
docker-compose up -d
```

Access at: `http://localhost:3001`

### Update the app
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### View logs
```bash
docker-compose logs -f lock-in
```

### Backup database
```bash
docker cp lock-in-app:/app/lockin.db ./lockin.backup.db
```

---

## Option 2: Linux Server (Ubuntu/Debian)

### Prerequisites
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Deploy
```bash
# Clone/extract project
cd lock-in-app

# Start
docker-compose up -d

# Enable auto-restart
docker-compose up -d --restart=always
```

### With Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS with Let's Encrypt:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Option 3: Raspberry Pi / Home Lab

### Prerequisites
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh | sh
sudo usermod -aG docker $USER
```

### Deploy
```bash
# Extract project
tar -xzf lock-in-app.tar.gz
cd lock-in-app

# Start
docker-compose up -d
```

### Create systemd service for auto-start
```bash
sudo nano /etc/systemd/system/lock-in.service
```

```ini
[Unit]
Description=LOCK-IN Productivity App
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/home/pi/lock-in-app
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable lock-in
sudo systemctl start lock-in
```

---

## Option 4: AWS EC2

### 1. Launch EC2 Instance
- AMI: Ubuntu 22.04 LTS
- Instance: t3.micro (free tier eligible)
- Security Group: Allow HTTP (80), HTTPS (443), SSH (22)

### 2. Connect and Setup
```bash
ssh -i your-key.pem ubuntu@your-instance-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Clone project
git clone https://github.com/yourusername/lock-in-app.git
cd lock-in-app

# Start
docker-compose up -d
```

### 3. Use Elastic IP + Route 53
- Assign Elastic IP to instance
- Create Route 53 DNS record pointing to Elastic IP
- Use Nginx with Let's Encrypt (see Linux section)

---

## Option 5: DigitalOcean App Platform

### 1. Prepare Repository
Push to GitHub with Dockerfile

### 2. Create App
- Connect GitHub repo
- Select Dockerfile
- Configure environment:
  - PORT: 3001
  - NODE_ENV: production

### 3. Deploy
- DigitalOcean auto-builds and deploys
- Custom domain: Settings → Domains

---

## Option 6: Local Network (192.168.x.x)

### Setup
```bash
# Get local IP
hostname -I

# Start app
docker-compose up -d

# Access from other devices
http://192.168.1.100:3001
```

### mDNS (optional, requires avahi)
```bash
sudo apt-get install avahi-daemon

# Access as
http://lock-in.local:3001
```

---

## Monitoring & Maintenance

### Check Status
```bash
docker-compose ps
docker-compose logs -f
```

### Resource Usage
```bash
docker stats lock-in-app
```

### Update Container
```bash
docker-compose pull
docker-compose up -d
```

### Prune Old Data
```bash
# Clean up images
docker image prune -a

# Clean up volumes (⚠️ backup first!)
docker volume prune
```

---

## Backup Strategy

### Automated Backup (cron)
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * docker cp lock-in-app:/app/lockin.db /backups/lockin-$(date +\%Y\%m\%d).db

# Keep last 30 days
0 3 * * * find /backups -name "lockin-*.db" -mtime +30 -delete
```

### Manual Backup
```bash
docker cp lock-in-app:/app/lockin.db ./lockin-backup-$(date +%Y%m%d).db
```

### Restore from Backup
```bash
docker-compose down
cp lockin-backup-20240101.db lockin.db
docker-compose up -d
```

---

## Troubleshooting

### Port already in use
```bash
# Change in docker-compose.yml
# From: "3001:3001"
# To: "3002:3001"
```

### Out of disk space
```bash
docker system prune -a --volumes
```

### Database corruption
```bash
# Restore from backup
docker-compose down
cp lockin.backup.db lockin.db
docker-compose up -d
```

### High memory usage
```bash
docker stats lock-in-app
docker-compose restart
```

---

## Production Checklist

- [ ] Database backups automated
- [ ] Firewall configured (only necessary ports)
- [ ] SSL/HTTPS enabled
- [ ] Regular updates scheduled
- [ ] Logs monitored
- [ ] Disk space monitored
- [ ] Reverse proxy configured
- [ ] Health checks working

---

For additional help, check the main README.md
