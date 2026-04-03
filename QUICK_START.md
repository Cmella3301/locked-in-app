# 🚀 LOCK-IN Self-Hosted Setup - Quick Start

## What You Got

Your LOCK-IN app has been converted into a **production-ready self-hosted application** with:

✅ **Node.js/Express Backend** - Robust API server  
✅ **SQLite Database** - Persistent local data storage  
✅ **Docker Support** - Easy deployment anywhere  
✅ **Complete Documentation** - Setup guides for all platforms  
✅ **Automated Backups** - Never lose your data  

---

## 🎯 Quick Start (Docker - Recommended)

### Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop) or [Docker](https://docs.docker.com/engine/install/)

### Start in 3 Steps

```bash
# 1. Extract and navigate to project folder
cd lock-in-app

# 2. Start the app
docker-compose up -d

# 3. Open in browser
http://localhost:3001
```

✨ **That's it!** Your app is running.

---

## 🔧 Quick Start (No Docker)

### Prerequisites
- Node.js 16+ ([download](https://nodejs.org/))

### Start in 3 Steps

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start

# 3. Open in browser
http://localhost:3001
```

---

## 📁 Files Overview

```
├── server.js              ← Express API backend
├── package.json           ← Dependencies (run: npm install)
├── Dockerfile             ← Docker container setup
├── docker-compose.yml     ← One-command deployment
├── README.md              ← Full documentation
├── DEPLOYMENT.md          ← Deployment guides (AWS, VPS, Pi, etc.)
├── .env.example           ← Configuration template
└── lockin.db              ← Auto-created SQLite database
```

---

## 📊 What's Happening Under the Hood

```
Your Browser (React UI)
    ↓
localhost:3001 (Express Server)
    ↓
SQLite Database (lockin.db)
    ↓
Persistent Storage
```

Every action syncs automatically with the database.

---

## 🌍 Deployment Options

### Local (Your Computer)
```bash
docker-compose up -d
```

### Local Network (192.168.x.x)
```bash
# Same as above, access from any device on network
http://192.168.1.100:3001
```

### VPS / Cloud Server (AWS, DigitalOcean, Linode)
See **DEPLOYMENT.md** for step-by-step guides

### Raspberry Pi / Home Lab
See **DEPLOYMENT.md** → Option 3

### Docker Swarm / Kubernetes
Update `docker-compose.yml` as needed

---

## 💾 Data & Backups

### Automatic Backup (Docker)
```bash
docker cp lock-in-app:/app/lockin.db ./backup.db
```

### Manual Backup
```bash
cp lockin.db lockin.backup.db
```

### Restore from Backup
```bash
docker-compose down
cp lockin.backup.db lockin.db
docker-compose up -d
```

---

## 🔍 Troubleshooting

### Port 3001 Already in Use?
Edit `docker-compose.yml`:
```yaml
ports:
  - "3002:3001"  # Change 3002 to any free port
```

### Database Locked?
```bash
docker-compose down
docker-compose up -d
```

### Check if Running
```bash
# Docker
docker-compose ps

# Browser
http://localhost:3001/api/health
```

### View Logs
```bash
docker-compose logs -f lock-in
```

---

## 🛠️ Customization

### Change Theme Colors
Edit the colors in the HTML/CSS (if you have React components)

### Add Custom Rings/Goals
Use the UI to add new tracking categories - they auto-save to the database

### Enable HTTPS
Use Nginx reverse proxy (see DEPLOYMENT.md)

---

## 📚 Next Steps

1. **Read README.md** - Full feature documentation
2. **Check DEPLOYMENT.md** - Deploy to VPS/cloud
3. **Customize** - Add your own tracking rings and goals
4. **Backup** - Set up automated database backups
5. **Share** - Access from any device on your network

---

## ⚡ Common Commands

```bash
# Start app
docker-compose up -d

# Stop app
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# View status
docker-compose ps

# Backup database
docker cp lock-in-app:/app/lockin.db ./backup.db

# Update app
docker-compose pull && docker-compose up -d --build
```

---

## 🎓 Learning Resources

- **Express.js**: https://expressjs.com/
- **SQLite**: https://www.sqlite.org/
- **Docker**: https://docs.docker.com/
- **React**: https://react.dev/ (for frontend customization)

---

## 🆘 Need Help?

1. Check **README.md** for API documentation
2. Check **DEPLOYMENT.md** for your specific platform
3. Review **server.js** comments for backend logic
4. Test API: `curl http://localhost:3001/api/health`

---

## 🎉 You're All Set!

Your self-hosted LOCK-IN app is ready to use. Start tracking your habits and boost your productivity!

**Access:** http://localhost:3001

**Built with ❤️ for self-hosted excellence**
