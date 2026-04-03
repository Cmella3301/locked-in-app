const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
});

// Routes

// Get all data
app.get('/api/data', (req, res) => {
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for any unknown routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LOCK-IN server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) console.error(err);
    process.exit(0);
  });
});
