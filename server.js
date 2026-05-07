const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// AI Initialization
let model = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
} else {
  console.warn('[AI] GEMINI_API_KEY is not configured. AI features will stay offline.');
}

const app = express();
const PORT = process.env.PORT || 3001;
const publicDir = path.join(__dirname, 'public');
const authEnabled = Boolean(process.env.APP_PASSWORD);
const sessionTtlSeconds = 60 * 60 * 24 * 30;
const sessionTtlMs = sessionTtlSeconds * 1000;
const sessions = new Map();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Middleware
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS policy'));
    },
    credentials: true
  }));
}
app.use(express.json({ limit: '15mb' }));
app.use((req, res, next) => {
    // Injecting telemetry hook for Dozzle observation matrix
    if (req.url !== '/api/health') {
        console.log(`[NET-LOG] ${new Date().toLocaleTimeString()} | HTTP ${req.method} | ${req.url} | SOURCE: ${req.ip}`);
    }
    next();
});
app.use(express.static(publicDir));

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .reduce((acc, cookie) => {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = cookie.slice(0, separatorIndex);
      const value = decodeURIComponent(cookie.slice(separatorIndex + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies.lockin_session;
}

function clearExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function setSessionCookie(res, token) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `lockin_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${sessionTtlSeconds}${secureFlag}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    'lockin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
  );
}

function passwordMatches(candidate = '') {
  const expected = Buffer.from(process.env.APP_PASSWORD || '', 'utf8');
  const provided = Buffer.from(candidate, 'utf8');
  if (expected.length === 0 || expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
}

function isAuthenticated(req) {
  if (!authEnabled) return true;

  clearExpiredSessions();
  const token = getSessionToken(req);
  if (!token) return false;

  const session = sessions.get(token);
  if (!session) return false;

  session.expiresAt = Date.now() + sessionTtlMs;
  return true;
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    next();
    return;
  }

  res.status(401).json({ error: 'Authentication required', authRequired: true });
}

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
const photosDir = path.join(dataDir, 'photos');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

// Serve photos statically
app.use('/photos', requireAuth, express.static(photosDir));

// Initialize SQLite database - store in /app/data/ for volume persistence
const dbPath = path.join(dataDir, 'lockin.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database at', dbPath);
});

// Initialize database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS rings (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      goal INTEGER NOT NULL,
      color TEXT NOT NULL,
      type TEXT,
      unit TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ring_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ringId TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL NOT NULL,
      goal INTEGER NOT NULL,
      met BOOLEAN DEFAULT 0,
      color TEXT,
      FOREIGN KEY (ringId) REFERENCES rings(id),
      UNIQUE(ringId, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      ringId TEXT NOT NULL,
      value REAL NOT NULL,
      goal INTEGER NOT NULL,
      met BOOLEAN DEFAULT 0,
      color TEXT,
      xp INTEGER DEFAULT 0,
      FOREIGN KEY (ringId) REFERENCES rings(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      work TEXT,
      rel TEXT,
      goals TEXT,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      title TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id TEXT PRIMARY KEY,
      overallRank TEXT,
      overallNum INTEGER,
      xpToday INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Routes

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/auth/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    authRequired: authEnabled,
    authenticated: isAuthenticated(req)
  });
});

app.post('/api/auth/login', (req, res) => {
  if (!authEnabled) {
    res.json({ success: true, authRequired: false });
    return;
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length === 0) {
    res.status(400).json({ success: false, error: 'Password is required' });
    return;
  }

  if (!passwordMatches(password)) {
    res.status(401).json({ success: false, error: 'Invalid password' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + sessionTtlMs });
  setSessionCookie(res, token);
  res.json({ success: true, authRequired: true });
});

app.post('/api/auth/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    sessions.delete(token);
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

app.use('/api', requireAuth);

// Get Full Application State
app.get('/api/state', (req, res) => {
  db.get('SELECT data, updatedAt FROM state WHERE id = 1', (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json(null);
    const data = JSON.parse(row.data);
    data.serverUpdatedAt = row.updatedAt;
    res.json(data);
  });
});

// Save Full Application State
app.post('/api/state', (req, res) => {
  const payload = { ...req.body };
  delete payload.serverUpdatedAt;
  const data = JSON.stringify(payload);
  db.run(
    `INSERT INTO state (id, data, updatedAt) 
     VALUES (1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = CURRENT_TIMESTAMP`,
    [data],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT updatedAt FROM state WHERE id = 1', (selectErr, row) => {
        if (selectErr) return res.status(500).json({ error: selectErr.message });
        res.json({ success: true, serverUpdatedAt: row ? row.updatedAt : null });
      });
    }
  );
});

// Backward compatibility / Ring shortcuts
app.post('/api/ring/:id/:action', (req, res) => {
  const data = {};
  let completed = 0;

  // Get rings
  db.all('SELECT * FROM rings', (err, rings) => {
    if (err) return res.status(500).json({ error: err.message });
    data.rings = rings || [];

    // Get current ring values
    const today = new Date().toDateString();
    data.currentValues = {};
    
    let ringsDone = 0;
    rings.forEach(ring => {
      db.get(
        'SELECT value, goal FROM ring_values WHERE ringId = ? AND date = ?',
        [ring.id, today],
        (err, row) => {
          data.currentValues[ring.id] = row || { value: 0, goal: ring.goal };
          ringsDone++;
          if (ringsDone === rings.length) checkComplete();
        }
      );
    });
    
    if (!rings.length) checkComplete();
  });

  // Get history
  db.all(`
    SELECT date, ringId, value, goal, met, color 
    FROM history 
    ORDER BY date DESC
  `, (err, history) => {
    if (err) return res.status(500).json({ error: err.message });
    
    data.history = {};
    history.forEach(h => {
      if (!data.history[h.date]) data.history[h.date] = {};
      data.history[h.date][h.ringId] = {
        v: h.value,
        g: h.goal,
        met: h.met,
        c: h.color
      };
    });
    
    checkComplete();
  });

  // Get journal
  db.all('SELECT date, work, rel, goals FROM journal', (err, journal) => {
    if (err) return res.status(500).json({ error: err.message });
    
    data.journal = {};
    journal.forEach(j => {
      data.journal[j.date] = {
        work: j.work,
        rel: j.rel,
        goals: j.goals
      };
    });
    
    checkComplete();
  });

  // Get schedule
  db.all('SELECT id, time, title FROM schedule ORDER BY time', (err, schedule) => {
    if (err) return res.status(500).json({ error: err.message });
    data.schedule = schedule || [];
    checkComplete();
  });

  // Get stats
  db.get('SELECT overallRank, overallNum, xpToday FROM stats WHERE id = ?', ['main'], (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });
    data.stats = stats || { overallRank: 'NOVICE', overallNum: 0, xpToday: 0 };
    checkComplete();
  });

  function checkComplete() {
    completed++;
    if (completed === 6) res.json(data);
  }
});

// Update ring value
app.post('/api/ring/:ringId/value', (req, res) => {
  const { ringId } = req.params;
  const { value, goal, met, color } = req.body;
  const today = new Date().toDateString();

  db.run(
    `INSERT INTO ring_values (ringId, date, value, goal, met, color)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ringId, date) DO UPDATE SET
     value = excluded.value,
     goal = excluded.goal,
     met = excluded.met,
     color = excluded.color`,
    [ringId, today, value, goal, met ? 1 : 0, color],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Also update history
      db.run(
        `INSERT INTO history (date, ringId, value, goal, met, color)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT DO UPDATE SET
         value = excluded.value,
         goal = excluded.goal,
         met = excluded.met`,
        [today, ringId, value, goal, met ? 1 : 0, color],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        }
      );
    }
  );
});

// Create new ring
app.post('/api/rings', (req, res) => {
  const { id, label, goal, color, type, unit } = req.body;

  db.run(
    `INSERT INTO rings (id, label, goal, color, type, unit)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, label, goal, color, type || 'numeric', unit || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id });
    }
  );
});

// Delete ring
app.delete('/api/rings/:ringId', (req, res) => {
  const { ringId } = req.params;

  db.run('DELETE FROM rings WHERE id = ?', [ringId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM ring_values WHERE ringId = ?', [ringId]);
    db.run('DELETE FROM history WHERE ringId = ?', [ringId]);
    res.json({ success: true });
  });
});

// Save journal entry
app.post('/api/journal/:date', (req, res) => {
  const { date } = req.params;
  const { work, rel, goals } = req.body;

  db.run(
    `INSERT INTO journal (date, work, rel, goals)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
     work = excluded.work,
     rel = excluded.rel,
     goals = excluded.goals,
     updatedAt = CURRENT_TIMESTAMP`,
    [date, work, rel, goals],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Add schedule block
app.post('/api/schedule', (req, res) => {
  const { time, title } = req.body;

  db.run(
    `INSERT INTO schedule (time, title) VALUES (?, ?)`,
    [time, title],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Delete schedule block
app.delete('/api/schedule/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM schedule WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Upload progress photo
app.post('/api/upload-photo', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Expecting data:image/jpeg;base64,xxxx
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const filename = `photo_${Date.now()}.jpg`;
    const filePath = path.join(photosDir, filename);

    fs.writeFileSync(filePath, base64Data, 'base64');
    
    // Return the URL that can be used to view the photo
    res.json({ success: true, url: `/photos/${filename}` });
  } catch (err) {
    console.error('Photo save error:', err);
    res.status(500).json({ error: 'Failed to save photo' });
  }
});

// --- AI COACH & MEAL SCANNER ---

app.post('/api/analyze-meal', async (req, res) => {
  if (!model) {
    res.status(503).json({ error: 'AI features are not configured' });
    return;
  }

  const { image, context } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    const prompt = `You are a professional sports nutritionist. Analyze this food photo.
    Context: The user just finished a ${context.workoutType || 'general'} workout. 
    Provide the meal name and estimate its nutritional value.
    Give a 1-sentence "Coach's Tip" on how this specific meal helps their current recovery or goals.
    
    Return JSON format ONLY:
    {
      "name": "Meal Name",
      "cals": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "tip": "Coach's tip here"
    }`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
    ]);

    const response = await result.response;
    let text = response.text();
    
    // Clean JSON from possible markdown formatting
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(text);

    res.json({ success: true, analysis });
  } catch (err) {
    console.error('AI Analysis error:', err);
    res.status(500).json({ error: 'AI failed to analyze meal' });
  }
});

app.post('/api/ai-coach', async (req, res) => {
  if (!model) {
    res.status(503).json({ success: false, error: 'AI features are not configured' });
    return;
  }

  const { state, workout, history, prompt } = req.body;

  try {
    const systemPrompt = `You are an elite fitness coach in the "LOCK-IN" program.
    You have full "Direct Control" over the user's goals, foods, and workout logs. 

    Current Daily Metrics: ${JSON.stringify({cals: state.cals, protein: state.protein, water: state.water})}
    Today's Workout Plan: ${JSON.stringify(workout)}
    
    INSTRUCTIONS:
    - If the user asks to change a goal, emit a target command ('cals', 'protein', 'water') with a flat "value".
    - If the user logs a food or you analyze an image of food, emit the 'log_food' command. Estimate macros if needed.
    - If the user logs a completed workout set (e.g., "I did 8 reps of bench"), emit the 'log_workout' command! You must match "exercise" exactly from their Workout Plan. Extract "reps", "weight" (if stated), "rpe" (1-10 string), "zone" (e.g., Strength, Hypertrophy), and any coach "notes" regarding their form.
    - Be supportive, knowledgeable, and high-performance.
    - Keep responses concise.
    
    Return JSON format ONLY:
    {
      "message": "Your conversational response",
      "command": { "target": "log_workout", "data": { "exercise": "Bench press", "reps": "8", "weight": "225", "rpe": "8", "zone": "Strength", "notes": "Felt heavy." } } // (OPTIONAL)
    }
    Other valid targets: "log_food" (requires data: name, cals, protein, carbs, fat), or "cals", "protein", "water" (requires value: 2000).`;

    // Convert frontend history to Gemini format
    const geminiHistory = (history || []).map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    const chat = model.startChat({
      history: geminiHistory,
      generationConfig: { maxOutputTokens: 800 },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ]
    });

    const userMessage = prompt || "Hello Coach, give me a status update.";
    
    // Inject dynamic system context into every prompt invisibly.
    let finalPrompt = `[SYSTEM CONTEXT]\n${systemPrompt}\n\n[USER MESSAGE]\n${userMessage}`;

    let msgParts = [{ text: finalPrompt }];
    const { image, images } = req.body;
    
    // Support legacy single image or new multi-image
    const imageList = images || (image ? [image] : []);
    
    imageList.forEach(media => {
        if (media && media.startsWith('data:')) {
            const mimeType = media.split(';')[0].split(':')[1];
            const base64Data = media.split(',')[1];
            msgParts.push({
                inlineData: { data: base64Data, mimeType: mimeType }
            });
        }
    });


    const result = await chat.sendMessage(msgParts);
    const response = await result.response;
    let text = response.text();
    
    console.log(`[AI COACH] Raw Response: ${text}`);

    // Robust JSON extraction
    let advice = { message: text };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        advice = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn(`[AI COACH] JSON Parse failed, using raw text.`);
      advice = { message: text };
    }

    // Ensure there's always a message
    if (!advice.message && advice.recommendation) {
       advice.message = advice.recommendation + ": " + advice.reason;
    }

    res.json({ success: true, advice });

  } catch (err) {
    console.error('AI Coach error:', err);
    res.status(500).json({ success: false, error: 'Coach is offline' });
  }
});

// Update stats
app.post('/api/stats', (req, res) => {
  const { overallRank, overallNum, xpToday } = req.body;

  db.run(
    `INSERT INTO stats (id, overallRank, overallNum, xpToday, updatedAt)
     VALUES ('main', ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
     overallRank = excluded.overallRank,
     overallNum = excluded.overallNum,
     xpToday = excluded.xpToday,
     updatedAt = CURRENT_TIMESTAMP`,
    [overallRank, overallNum, xpToday],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Full Reset - WIPE ALL DATA
app.post('/api/reset', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM history');
    db.run('DELETE FROM ring_values');
    db.run('DELETE FROM journal');
    db.run('DELETE FROM schedule');
    db.run('DELETE FROM stats');
    db.run('DELETE FROM state');
    db.run('DELETE FROM rings');
    res.json({ success: true, message: 'All data wiped successfully' });
  });
});

// Watch Dashboard
app.get('/watch', (req, res) => {
  res.sendFile(path.join(publicDir, 'watch.html'));
});

// Serve index.html for any unknown routes (SPA fallback)
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LOCK-IN server running on http://localhost:${PORT}`);
  if (authEnabled) {
    console.log('[SECURITY] App password protection is enabled.');
  } else {
    console.warn('[SECURITY] APP_PASSWORD is not set. API protection is disabled.');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) console.error(err);
    process.exit(0);
  });
});
