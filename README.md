# LOCK-IN Habit Tracker 🐉🛡️🍿✨🚀

A professional-grade, multi-device habit and life management platform. Built for high-performance sync between Phone, Desktop, and Apple Watch.

This project uses a **server-backed sync architecture** so your progress can stay aligned across devices.

### 🏁 Features:
- **Real-Time Sync:** 5-second auto-sync between Phone and Desktop.
- **Premium Branding:** High-fidelity 3D Metallic Rank badges.
- **Wrist Hub:** Minimalist Apple Watch dashboard at `/watch`.
- **Health-Monitored:** Docker containerized with automated healthchecks.

## 🤖 AI Assistant Installation (For ChatGPT/Claude/Cursor)

If you have an AI coding assistant and want it to automatically set this project up for you, simply copy and paste the prompt below into your AI of choice:

> **Copy & Paste this to your AI:**
> *"I want to run a locally-hosted web application called 'LOCK-IN Habit Tracker' on my machine. Please give me the exact terminal commands to clone the repository (from Cmella3301/locked-in-app), navigate into the folder, and spin it up using Docker Compose. If I don't have Docker installed, briefly tell me how to get it for my OS first. Once the container is running, tell me what localhost port to open, and explain how I can save it as a PWA on my phone or computer."*

## 🔐 Environment Setup

Create a local `.env` file before you run the app:

```bash
cp .env.example .env
```

Required values:
- `GEMINI_API_KEY`
- `APP_PASSWORD`

Optional values:
- `ALLOWED_ORIGINS`
- `SESSION_SECRET`

## 🚀 Deployment (Docker)

```bash
# Launch the unified harbor
docker-compose up -d --build
```

- **Web App:** `http://localhost:3001`
- **Watch Hub:** `http://localhost:3001/watch`
- **Sync API:** `/api/state`

---

**Sync Status: 🔄 [GLOBAL] | Mastery: ✅ [LOCKED-IN]**
