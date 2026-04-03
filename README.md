# LOCK-IN: Self-Hosted Productivity App

A powerful, self-hosted habit tracking and productivity management application built with Express.js, React, and SQLite.

## Features

✨ **Core Features**
- 🎯 Multi-ring habit tracking with goals
- 📊 GitHub-style contribution heatmap visualization
- 📅 Calendar view with historical data
- 🗒️ Daily journal entries (work, relationships, goals)
- ⏰ Daily schedule management
- 🎮 Gamification with XP system
- 📈 Comprehensive statistics and rankings

## 🤖 AI Assistant Installation (For ChatGPT/Claude)

If you use an AI assistant like Claude, ChatGPT, or Cursor, you can have it completely install and set up this app for you. Simply copy and paste the prompt below into your AI:

> **Copy & Paste this to your AI:**
> *"I want to run a self-hosted productivity app called 'locked-in-app' on my machine. Please give me the exact terminal commands to clone the repository (from Cmella3301/locked-in-app), navigate into the folder, and spin it up using Docker Compose. If I don't have Docker installed, briefly tell me how to get it for my OS first. Once the container is running, tell me what localhost port to open, and explain how I can save it as a PWA on my phone or computer."*

## Quick Start

### Option 1: Docker (Recommended)

Prerequisites:
- Docker & Docker Compose installed

**Steps:**
```bash
# Clone or extract the project
cd lock-in-app

# Build and start
docker-compose up -d

# Access the app
open http://localhost:3001
```

### Option 2: Local Node.js Setup

Prerequisites:
- Node.js 16+
- npm

**Steps:**
```bash
# Install dependencies
npm install

# Start the server
npm start

# Access the app
open http://localhost:3001
```

For development with auto-reload:
```bash
npm run dev
```

## Project Structure

```
lock-in-app/
├── server.js              # Express backend API
├── package.json           # Dependencies
├── Dockerfile            # Container image
├── docker-compose.yml    # Container orchestration
├── lockin.db            # SQLite database (created on first run)
├── public/
│   ├── index.html       # React app
│   ├── App.jsx          # Main React component
│   ├── components/      # React components
│   └── styles/          # CSS files
└── README.md            # This file
```

## Database Schema

### rings
Tracks habit definitions (goals, colors, types)

### ring_values
Current daily values for each ring

### history
Historical snapshots of all ring values

### journal
Daily journal entries (work, relationships, goals)

### schedule
Daily schedule blocks/time blocks

### stats
Overall user statistics (rank, level, daily XP)

## API Endpoints

### Data Management
- `GET /api/data` - Fetch all app data
- `POST /api/ring/:ringId/value` - Update ring value
- `POST /api/rings` - Create new ring
- `DELETE /api/rings/:ringId` - Delete ring

### Journal
- `POST /api/journal/:date` - Save journal entry

### Schedule
- `POST /api/schedule` - Add schedule block
- `DELETE /api/schedule/:id` - Remove schedule block

### Stats
- `POST /api/stats` - Update user statistics

### Health
- `GET /api/health` - Check server status

## Configuration

Environment variables (optional):
```
PORT=3001              # Server port (default: 3001)
NODE_ENV=production    # Environment (development/production)
```

## Data Persistence

All data is persisted in SQLite database:
- **Local:** `./lockin.db`
- **Docker:** Volume-mounted at `/app/data`

For Docker backups:
```bash
docker cp lock-in-app:/app/lockin.db ./backup.db
```

## Browser Compatibility

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Performance

- Lightweight SQLite database
- Efficient React component rendering
- Zero external CSS frameworks (custom Tailwind-like design)
- Optimized for mobile and desktop

## Customization

### Add New Rings
Edit `public/App.jsx` and add to the default rings array, or use the app UI to create them.

### Change Colors
Modify CSS variables in `public/styles/index.css`:
```css
:root {
    --purple: #7c6fff;
    --orange: #ff5e1a;
    /* ... etc */
}
```

### Database Backups

Manual backup:
```bash
cp lockin.db lockin.backup.db
```

Or with Docker:
```bash
docker exec lock-in-app cp /app/lockin.db /app/data/backup.db
```

## Troubleshooting

**Port already in use:**
```bash
# Change port in docker-compose.yml
# Or run on different port:
PORT=3002 npm start
```

**Database locked:**
- Restart the app
- Ensure only one instance is running

**API not responding:**
```bash
curl http://localhost:3001/api/health
```

## Development

```bash
# Install dependencies
npm install

# Start with nodemon (auto-reload)
npm run dev

# Build for production
npm run build
```

## Deployment

### VPS / Self-Hosted Server
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh | sh

# Run app
docker-compose up -d
```

### Home Lab / Raspberry Pi
```bash
# Ensure Docker is installed
docker-compose up -d
```

### Cloud Providers
- AWS EC2
- DigitalOcean
- Linode
- Heroku (with modifications)

## License

MIT

## Support

For issues or questions, check the code comments or create an issue.

---

**Made with ❤️ for productivity enthusiasts**
