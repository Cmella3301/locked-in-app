const RINGS = [
            { id: 'water', label: 'Water', color: '#2a8fff', core: true, goal: () => S.waterGoal, val: () => S.water, unit: 'ml', log: false },
            { id: 'budget', label: 'Remaining', color: '#1db87a', core: true, goal: () => S.monthlyIncome || 0, val: () => Math.max(0, (S.monthlyIncome || 0) - ((S.transactions || []).filter(t => { const d = new Date(t.date), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && t.type === 'expense'; }).reduce((a, t) => a + t.amount, 0))), unit: '$', log: false },
            { id: 'cals', label: 'Calories', color: '#ffaa22', core: true, goal: () => S.calGoal, val: () => S.foods.reduce((a, f) => a + f.cals, 0), unit: 'kcal', log: false },
            { id: 'xp', label: 'XP today', color: '#7c6fff', core: true, goal: () => S.xpGoal, val: () => S.xpToday, unit: 'xp', log: false },
            { id: 'habits', label: 'Habits', color: '#ff5e1a', core: true, goal: () => S.habits.length, val: () => S.habits.filter(h => h.done).length, unit: '', log: false },
            { id: 'sleep', label: 'Sleep', color: '#d44e8a', core: false, goal: () => 8, val: () => S.sleep || 0, unit: 'hrs', log: true, logLabel: 'Hours slept', logStep: '0.5', logMax: 12 },
            { id: 'steps', label: 'Steps', color: '#ffaa22', core: false, goal: () => 8000, val: () => S.steps || 0, unit: '', log: true, logLabel: 'Steps today', logStep: '500', logMax: 30000 },
            { id: 'study', label: 'SC-300', color: '#1db87a', core: false, goal: () => 60, val: () => S.studyMins || 0, unit: 'min', log: true, logLabel: 'Study mins', logStep: '5', logMax: 300 },
            { id: 'protein', label: 'Protein', color: '#ff7b7b', core: false, goal: () => 180, val: () => S.foods.reduce((a, f) => a + f.protein, 0), unit: 'g', log: false },
            { id: 'vitamins', label: 'Vitamins', color: '#5DCAA5', core: false, goal: () => 1, val: () => S.vitaminsTaken ? 1 : 0, unit: '', log: false },
        ];

        let S = JSON.parse(localStorage.getItem('lockin_v3') || 'null') || {
            water: 0, waterGoal: 2500, foods: [], calGoal: 2800,
            habits: [
                { id: 3, name: 'Night prayer', xp: 25, done: false },
                { id: 4, name: 'Brush teeth - morning', xp: 10, done: false },
                { id: 5, name: 'Brush teeth - afternoon', xp: 10, done: false },
                { id: 6, name: 'Brush teeth - night', xp: 10, done: false },
                { id: 7, name: 'Floss', xp: 15, done: false },
                { id: 8, name: 'Drink water', xp: 20, done: false },
                { id: 9, name: 'Log breakfast', xp: 20, done: false },
                { id: 10, name: 'Log lunch', xp: 20, done: false },
                { id: 11, name: 'Log dinner', xp: 20, done: false },
                { id: 12, name: 'Workout', xp: 50, done: false },
                { id: 13, name: 'Study SC-300', xp: 40, done: false },
                { id: 14, name: 'Take vitamins', xp: 15, done: false },
            ],
            todos: [], xpToday: 0, xpGoal: 700, totalXp: 0,
            streak: 1, bestStreak: 0, weekXp: [0, 0, 0, 0, 0, 0, 0],
            currentSplit: 'push', lastDate: new Date().toDateString(),
            visibleRings: ['water', 'budget', 'cals', 'xp', 'habits', 'sleep', 'steps', 'study', 'protein', 'vitamins'],
            sleep: 0, steps: 0, studyMins: 0, vitaminsTaken: false,
            xpBreakdown: { habits: 0, food: 0, water: 0, todos: 0 }, waterHabitDone: false,
            progressPhotos: [], customRings: [], transactions: [], budgetGoal: 3000, monthlyIncome: 0,
            history: {}, journal: {}, schedule: [], longTermGoals: [], aiChatHistory: [],
            workoutLogs: [], currentWorkoutDate: new Date().toDateString()
        };

        if (!S.transactions) S.transactions = [];
        if (!S.monthlyIncome) S.monthlyIncome = 0;
        if (!S.visibleRings.includes('budget')) S.visibleRings.push('budget');
        if (!S.history) S.history = {};
        if (!S.journal) S.journal = {};
        if (!S.schedule) S.schedule = [];
        if (!S.aiChatHistory) S.aiChatHistory = [];
        if (!S.workoutLogs) S.workoutLogs = [];
        if (!S.currentWorkoutDate) S.currentWorkoutDate = new Date().toDateString();
        if (!S.longTermGoals || S.longTermGoals.length === 0) {
            S.longTermGoals = [
                { id: 1, title: 'Make $10,000', deadline: 'September 8, 2025', current: 10000, target: 10000, prefix: '$', suffix: '', color: '#1db87a' },
                { id: 2, title: 'Lose 30 pounds', deadline: 'October 27, 2025', current: 20.7, target: 30, prefix: '', suffix: ' lbs', color: '#2a8fff' }
            ];
        }

        // SYNC: Load from Server OR LocalStorage fallback
        async function loadState() {
            try {
                // Use a timestamp to force a fresh fetch from the server
                const res = await fetch(`/api/state?t=${Date.now()}`, { cache: 'no-store' });
                const data = await res.json();
                if (data) {
                    // Critical merge: If server data is present, it's our sync source
                    // But we merge gently to avoid losing very recent local wins
                    if (data.streak >= S.streak) S.streak = data.streak;
                    if (data.totalXp >= S.totalXp) S.totalXp = data.totalXp;
                    
                    // Always pull history and journal from server as it's the gold source
                    if (data.history) S.history = data.history;
                    if (data.journal) S.journal = data.journal;
                    if (data.schedule) S.schedule = data.schedule;

                    // If server data is from today, it's the source of truth for current progress
                    const today = new Date().toDateString();
                    if (data.lastDate === today) {
                        // Merge server progress with local progress
                        S = { ...S, ...data };
                    }
                    renderAll();
                    console.log("State synced from server successfully.");
                }
            } catch (e) {
                console.warn("Sync failed, using offline cache.");
                // LocalStorage is already loaded into S at the top, so we just use it
            }
        }

        async function save() {
            localStorage.setItem('lockin_v3', JSON.stringify(S));
            
            // Show a visual hint that we are syncing
            console.log("Syncing to server...");
            
            try {
                const res = await fetch('/api/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(S)
                });
                if (!res.ok) throw new Error(`Server responded with ${res.status}`);
                console.log("Sync complete.");
            } catch (e) { 
                console.error("Sync save failed:", e);
                // Hint: If this happens, the JSON might still be too large or network is down
            }
        }

        // Helper to compress images before saving to state
        async function compressImage(base64Str, maxWidth = 1200, quality = 0.7) {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = base64Str;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxWidth) {
                            width *= maxWidth / height;
                            height = maxWidth;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
            });
        }

        // AUTO-SYNC: Check for updates every 10 seconds (less aggressive to avoid conflicts)
        setInterval(async () => {
            try {
                const res = await fetch(`/api/state?t=${Date.now()}`, { cache: 'no-store' });
                const data = await res.json();
                
                // Compare timestamps or hash to see if we truly need an update
                if (data && JSON.stringify(data) !== JSON.stringify(S)) {
                    // Check if server is actually "ahead" or just different
                    // If server has more XP or higher streak, or it's a new day, we update
                    const serverIsNewer = (data.totalXp > S.totalXp) || (data.streak > S.streak);
                    
                    if (serverIsNewer) {
                        console.log("Global Sync: Server has newer progress. Updating...");
                        S = { ...S, ...data };
                        renderAll();
                        localStorage.setItem('lockin_v3', JSON.stringify(S));
                    }
                }
            } catch (e) {}
        }, 10000);

        loadState();

        async function fullReset() {
            if (!confirm("Are you SURE you want to reset everything to Day 0? This will delete all history, streaks, and custom rings. This cannot be undone.")) return;
            
            try {
                // 1. Wipe server data
                const res = await fetch('/api/reset', { method: 'POST' });
                const result = await res.json();
                
                if (result.success) {
                    // 2. Reset local state to defaults
                    S = {
                        water: 0, waterGoal: 2500, foods: [], calGoal: 2800,
                        habits: [
                            { id: 3, name: 'Night prayer', xp: 25, done: false },
                            { id: 4, name: 'Brush teeth - morning', xp: 10, done: false },
                            { id: 5, name: 'Brush teeth - afternoon', xp: 10, done: false },
                            { id: 6, name: 'Brush teeth - night', xp: 10, done: false },
                            { id: 7, name: 'Floss', xp: 15, done: false },
                            { id: 8, name: 'Drink water', xp: 20, done: false },
                            { id: 9, name: 'Log breakfast', xp: 20, done: false },
                            { id: 10, name: 'Log lunch', xp: 20, done: false },
                            { id: 11, name: 'Log dinner', xp: 20, done: false },
                            { id: 12, name: 'Workout', xp: 50, done: false },
                            { id: 13, name: 'Study SC-300', xp: 40, done: false },
                            { id: 14, name: 'Take vitamins', xp: 15, done: false },
                        ],
                        todos: [], xpToday: 0, xpGoal: 700, totalXp: 0,
                        streak: 0, bestStreak: 0, weekXp: [0, 0, 0, 0, 0, 0, 0],
                        currentSplit: 'push', lastDate: new Date().toDateString(),
                        visibleRings: ['water', 'budget', 'cals', 'xp', 'habits', 'sleep', 'steps', 'study', 'protein', 'vitamins'],
                        sleep: 0, steps: 0, studyMins: 0, vitaminsTaken: false,
                        xpBreakdown: { habits: 0, food: 0, water: 0, todos: 0 }, waterHabitDone: false,
                        progressPhotos: [], customRings: [], transactions: [], budgetGoal: 3000, monthlyIncome: 0,
                        history: {}, journal: {}, schedule: [], longTermGoals: [],
                        workoutLogs: [], currentWorkoutDate: new Date().toDateString()
                    };
                    
                    // 3. Clear localStorage and re-save
                    localStorage.removeItem('lockin_v3');
                    save();
                    
                    // 4. Force reload to ensure everything is fresh
                    window.location.reload();
                } else {
                    alert("Reset failed: " + result.message);
                }
            } catch (e) {
                console.error("Reset error:", e);
                alert("An error occurred during reset.");
            }
        }

        function checkNewDay() {
            const today = new Date().toDateString();
            if (S.lastDate !== today) {
                const yest = new Date(); yest.setDate(yest.getDate() - 1);

                // Historical snapshot of rings before wipe
                if (S.lastDate) {
                    const snap = {};
                    RINGS.forEach(r => {
                        snap[r.id] = { v: r.val(), g: r.goal(), c: r.color, met: r.val() >= r.goal() };
                    });
                    snap.xp = { v: S.xpToday, g: S.xpGoal, c: '#7c6fff', met: S.xpToday >= S.xpGoal };
                    if (!S.history) S.history = {};
                    S.history[S.lastDate] = snap;

                    if (S.lastDate === yest.toDateString()) { S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); }
                    else { S.streak = 1; } // Restart at Day 1 instead of 0
                }

                S.lastDate = today; S.water = 0; S.waterHabitDone = false; S.foods = []; S.xpToday = 0;
                S.sleep = 0; S.steps = 0; S.studyMins = 0; S.vitaminsTaken = false;
                S.habits = S.habits.map(h => ({ ...h, done: false }));
                if (!S.progressPhotos) S.progressPhotos = [];
                S.weekXp = [...S.weekXp.slice(1), 0];
                S.xpBreakdown = { habits: 0, food: 0, water: 0, todos: 0 };
                S.schedule = [];
                S.aiChatHistory = []; // Clear AI Chat History for the new day
                S.workoutLogs = []; // Clear intra-workout progression
                S.currentWorkoutDate = today;
                save();
            }
        }
        checkNewDay();

        const ranks = [
            { name: 'Bronze', min: 0, color: '#cd7f32', bg: '#2d1a10', badge: `<img src="/icons/ranks/rank_01_bronze_1775240647966.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Silver', min: 500, color: '#b8b8cc', bg: '#28283a', badge: `<img src="/icons/ranks/rank_02_silver_1775240661273.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Gold', min: 1500, color: '#ffd700', bg: '#2d2a10', badge: `<img src="/icons/ranks/rank_03_gold_1775240673324.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Opal I', min: 3000, color: '#a0c4ff', bg: '#1a2040', badge: `<img src="/icons/ranks/rank_04_opal1_1775240693700.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Opal II', min: 5000, color: '#7c6fff', bg: '#2a2040', badge: `<img src="/icons/ranks/rank_05_opal2_1775240707721.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Opal III', min: 8000, color: '#c8b8ff', bg: '#2a2040', badge: `<img src="/icons/ranks/rank_06_opal3_1775240723165.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Diamond', min: 12000, color: '#88eeff', bg: '#102028', badge: `<img src="/icons/ranks/rank_07_diamond_1775240745120.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Elite', min: 20000, color: '#ff88aa', bg: '#2d1020', badge: `<img src="/icons/ranks/rank_08_elite_1775240760871.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
            { name: 'Champion', min: 35000, color: '#ffcc00', bg: '#2d2800', badge: `<img src="/icons/ranks/rank_09_champion_1775240775220.png" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,0.5));" />` },
        ];
        const getRank = () => { let r = ranks[0]; for (const rk of ranks) { if (S.totalXp >= rk.min) r = rk; } return r; };
        const getNext = () => { for (let i = 0; i < ranks.length - 1; i++) { if (S.totalXp < ranks[i + 1].min) return ranks[i + 1]; } return null; };

        const GP = 'url(#gPrim)', GS = 'url(#gSec)', GT = 'url(#gTer)';
        const splits = {
            push: {
                label: 'Push day — chest, shoulders, triceps',
                front: { 'fz-chest-l': GP, 'fz-chest-r': GP, 'fz-shoulder-l': GP, 'fz-shoulder-r': GP, 'fz-arm-l': GT, 'fz-arm-r': GT },
                back: { 'bz-shoulder-l': GS, 'bz-shoulder-r': GS, 'bz-arm-l': GP, 'bz-arm-r': GP },
                ex: [{ n: 'Bench press', s: '4×8', m: 'Chest' }, { n: 'Incline dumbbell press', s: '3×10', m: 'Upper chest' }, { n: 'Overhead press', s: '4×8', m: 'Shoulders' }, { n: 'Lateral raises', s: '3×15', m: 'Side delts' }, { n: 'Tricep pushdowns', s: '3×12', m: 'Triceps' }],
                nut: [{ i: '🥩', bg: '#2d1a10', t: 'Prioritize protein', d: 'Aim 180g+. Chicken, eggs, Greek yogurt.' }, { i: '🍚', bg: '#1a2d10', t: 'Carb up pre-workout', d: '60–80g carbs 90 mins before. Rice, oats, banana.' }, { i: '💊', bg: '#1a1a2d', t: 'Creatine + water', d: '5g creatine with 500ml water pre-workout.' }, { i: '🥤', bg: '#2d1a10', t: 'Post-workout shake', d: '30–40g whey within 30 mins of finishing.' }]
            },
            pull: {
                label: 'Pull day — back, biceps, rear delts',
                front: { 'fz-arm-l': GP, 'fz-arm-r': GP, 'fz-forearm-l': GS, 'fz-forearm-r': GS },
                back: { 'bz-lat-l': GP, 'bz-lat-r': GP, 'bz-trap': GS, 'bz-lower': GT, 'bz-shoulder-l': GS, 'bz-shoulder-r': GS },
                ex: [{ n: 'Pull-ups', s: '4×8', m: 'Lats' }, { n: 'Barbell row', s: '4×8', m: 'Mid back' }, { n: 'Cable row', s: '3×12', m: 'Lower lats' }, { n: 'Face pulls', s: '3×15', m: 'Rear delts' }, { n: 'Barbell curl', s: '3×12', m: 'Biceps' }],
                nut: [{ i: '🥩', bg: '#2d1a10', t: 'High protein day', d: '180–200g. Red meat, tuna, cottage cheese.' }, { i: '🫐', bg: '#1a1a2d', t: 'Antioxidants', d: 'Berries and leafy greens aid recovery.' }, { i: '🍌', bg: '#2d2a10', t: 'Pre-workout carbs', d: 'Banana or rice 60–90 mins before.' }, { i: '💧', bg: '#10202d', t: 'Stay hydrated', d: 'Aim 3L. Back muscles fatigue fast dehydrated.' }]
            },
            legs: {
                label: 'Leg day — quads, hamstrings, glutes, calves',
                front: { 'fz-quad-l': GP, 'fz-quad-r': GP, 'fz-calf-l': GS, 'fz-calf-r': GS, 'fz-core': GT },
                back: { 'bz-ham-l': GP, 'bz-ham-r': GP, 'bz-glute-l': GP, 'bz-glute-r': GP, 'bz-calf-l': GS, 'bz-calf-r': GS, 'bz-lower': GT },
                ex: [{ n: 'Barbell squat', s: '5×5', m: 'Quads + glutes' }, { n: 'Romanian deadlift', s: '4×10', m: 'Hamstrings' }, { n: 'Leg press', s: '3×12', m: 'Quads' }, { n: 'Walking lunges', s: '3×20', m: 'Glutes + quads' }, { n: 'Calf raises', s: '4×20', m: 'Calves' }],
                nut: [{ i: '🍠', bg: '#2d1a10', t: 'Max carbs today', d: 'Leg day needs energy. Eat 300g+ carbs.' }, { i: '🥩', bg: '#2d1a10', t: 'Extra protein', d: 'Biggest muscle group. Aim 200g protein.' }, { i: '🧂', bg: '#1a2a2d', t: 'Electrolytes', d: 'You sweat more on leg day. Add electrolytes.' }, { i: '🍒', bg: '#1a1a2d', t: 'Tart cherry juice', d: 'Reduces DOMS. Drink 1 cup post-workout.' }]
            },
            rest: {
                label: 'Rest & recovery day', front: {}, back: {},
                ex: [{ n: 'Light walk', s: '20–30 mins', m: 'Active recovery' }, { n: 'Foam rolling', s: '10 mins', m: 'Full body' }, { n: 'Stretching', s: '15 mins', m: 'Flexibility' }],
                nut: [{ i: '💧', bg: '#10202d', t: 'Hydration focus', d: 'Drink 2.5–3L to flush metabolic waste.' }, { i: '🥗', bg: '#1a2d10', t: 'Eat clean', d: 'Lower calories. Vegetables, lean protein.' }, { i: '😴', bg: '#1a1a2d', t: 'Prioritize sleep', d: 'Muscle is built at rest. Aim 8 hours.' }, { i: '🫚', bg: '#2d2a10', t: 'Healthy fats', d: 'Omega-3s reduce inflammation. Salmon, walnuts.' }]
            },
            full: {
                label: 'Full body day',
                front: { 'fz-chest-l': GS, 'fz-chest-r': GS, 'fz-shoulder-l': GS, 'fz-shoulder-r': GS, 'fz-abs': GT, 'fz-quad-l': GP, 'fz-quad-r': GP, 'fz-arm-l': GS, 'fz-arm-r': GS },
                back: { 'bz-lat-l': GS, 'bz-lat-r': GS, 'bz-trap': GS, 'bz-ham-l': GS, 'bz-ham-r': GS, 'bz-glute-l': GP, 'bz-glute-r': GP, 'bz-arm-l': GS, 'bz-arm-r': GS },
                ex: [{ n: 'Deadlift', s: '3×5', m: 'Full posterior chain' }, { n: 'Bench press', s: '3×8', m: 'Chest' }, { n: 'Squat', s: '3×8', m: 'Legs' }, { n: 'Pull-ups', s: '3×8', m: 'Back + biceps' }, { n: 'Overhead press', s: '3×10', m: 'Shoulders' }],
                nut: [{ i: '🥩', bg: '#2d1a10', t: 'Max protein', d: '180–200g protein. Every meal counts.' }, { i: '🍚', bg: '#1a2d10', t: 'Steady carbs', d: 'Spread 250g carbs across the day.' }, { i: '💊', bg: '#1a1a2d', t: 'Creatine + caffeine', d: 'Pre-workout: 5g creatine, 200mg caffeine.' }, { i: '🥑', bg: '#1a2d10', t: 'Healthy fats', d: 'Avocado and olive oil support hormones.' }]
            }
        };
        const aF = ['fz-head', 'fz-neck', 'fz-chest-l', 'fz-chest-r', 'fz-shoulder-l', 'fz-shoulder-r', 'fz-abs', 'fz-oblique-l', 'fz-oblique-r', 'fz-arm-l', 'fz-arm-r', 'fz-forearm-l', 'fz-forearm-r', 'fz-core', 'fz-quad-l', 'fz-quad-r', 'fz-calf-l', 'fz-calf-r', 'fz-foot-l', 'fz-foot-r'];
        const aB = ['bz-head', 'bz-trap', 'bz-shoulder-l', 'bz-shoulder-r', 'bz-lat-l', 'bz-lat-r', 'bz-lower', 'bz-arm-l', 'bz-arm-r', 'bz-forearm-l', 'bz-forearm-r', 'bz-glute-l', 'bz-glute-r', 'bz-ham-l', 'bz-ham-r', 'bz-calf-l', 'bz-calf-r', 'bz-foot-l', 'bz-foot-r'];

        function addWater(ml) { S.water = Math.min(S.water + ml, S.waterGoal * 1.5); if (S.water / S.waterGoal >= 1 && !S.waterHabitDone) { addXP(20, 'water'); S.waterHabitDone = true; } save(); renderAll(); }
        function resetWater() { S.water = 0; S.waterHabitDone = false; save(); renderAll(); }
        function updateWaterGoal(v) { S.waterGoal = parseInt(v); document.getElementById('water-goal-label').textContent = v + 'ml'; document.getElementById('water-goal-display').textContent = v; save(); renderAll(); }

        function addFood() {
            const n = document.getElementById('food-name').value.trim();
            const c = parseInt(document.getElementById('food-cals').value) || 0;
            const p = parseInt(document.getElementById('food-protein').value) || 0;
            const cb = parseInt(document.getElementById('food-carbs').value) || 0;
            const f = parseInt(document.getElementById('food-fat').value) || 0;
            if (!n || !c) return;
            S.foods.push({ id: Date.now(), name: n, cals: c, protein: p, carbs: cb, fat: f });
            addXP(5, 'food');
            ['food-name', 'food-cals', 'food-protein', 'food-carbs', 'food-fat'].forEach(id => document.getElementById(id).value = '');
            save(); renderAll();
        }
        function deleteFood(id) { S.foods = S.foods.filter(f => f.id !== id); save(); renderAll(); }

        function addAIFoodLog(data) {
            if (!data.name || !data.cals) return;
            S.foods.push({ 
                id: Date.now(), 
                name: data.name, 
                cals: parseInt(data.cals) || 0, 
                protein: parseInt(data.protein) || 0, 
                carbs: parseInt(data.carbs) || 0, 
                fat: parseInt(data.fat) || 0 
            });
            addXP(10, 'food'); // Bonus XP for using AI!
            save(); renderAll();
        }

        function addAIWorkoutLog(data) {
            if (!data.exercise || !data.reps) return;
            if (!S.workoutLogs) S.workoutLogs = [];
            S.workoutLogs.push({
                id: Date.now(),
                date: S.currentWorkoutDate,
                split: S.currentSplit,
                exercise: data.exercise,
                reps: data.reps,
                weight: data.weight || '',
                rpe: data.rpe || '',
                zone: data.zone || '',
                notes: data.notes || ''
            });
            addXP(15, 'todos'); // XP for logging a set
            save(); renderWorkout();
        }

        function toggleHabit(id) {
            const h = S.habits.find(h => h.id === id); if (!h) return;
            if (!h.done) { h.done = true; addXP(h.xp, 'habits'); if (id === 14) S.vitaminsTaken = true; }
            else { h.done = false; S.xpToday = Math.max(0, S.xpToday - h.xp); S.totalXp = Math.max(0, S.totalXp - h.xp); S.xpBreakdown.habits = Math.max(0, (S.xpBreakdown.habits || 0) - h.xp); if (id === 14) S.vitaminsTaken = false; }
            save(); renderAll();
        }

        function addTodo() { const v = document.getElementById('todo-input').value.trim(); if (!v) return; S.todos.push({ id: Date.now(), text: v, done: false }); document.getElementById('todo-input').value = ''; save(); renderAll(); }
        function toggleTodo(id) { const t = S.todos.find(t => t.id === id); if (!t) return; t.done = !t.done; if (t.done) addXP(10, 'todos'); save(); renderAll(); }
        function deleteTodo(id) { S.todos = S.todos.filter(t => t.id !== id); save(); renderAll(); }

        function addXP(amt, src) { S.xpToday += amt; S.totalXp += amt; S.weekXp[6] = S.xpToday; if (src) S.xpBreakdown[src] = (S.xpBreakdown[src] || 0) + amt; }

        function toggleRing(id, on) {
            if (on) { if (!S.visibleRings.includes(id)) S.visibleRings.push(id); }
            else { S.visibleRings = S.visibleRings.filter(r => r !== id); }
            save(); renderAll();
        }

        function toggleRingCreator() { const p = document.getElementById('ring-creator-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }

        function addCustomRing() {
            const label = document.getElementById('rc-name').value.trim();
            const goal = parseFloat(document.getElementById('rc-goal').value) || 10;
            const unit = document.getElementById('rc-unit').value.trim() || '';
            const color = document.getElementById('rc-color').value || '#7c6fff';
            if (!label) return;
            if (!S.customRings) S.customRings = [];
            const id = 'cr_' + Date.now();
            S.customRings.push({ id, label, goal, unit, color, val: 0 });
            S.visibleRings.push(id);
            // Add to RINGS array dynamically
            RINGS.push({ id, label, color, core: false, goal: () => goal, val: () => { const cr = (S.customRings || []).find(r => r.id === id); return cr ? cr.val || 0 : 0; }, unit, log: true, logLabel: label, logStep: '1', logMax: goal * 10 });
            document.getElementById('rc-name').value = '';
            document.getElementById('rc-goal').value = '';
            document.getElementById('rc-unit').value = '';
            save(); renderAll();
            document.getElementById('ring-creator-panel').style.display = 'none';
        }

        function logRingValue(id) {
            const el = document.getElementById('rlog-' + id); if (!el) return;
            const v = parseFloat(el.value) || 0;
            if (id === 'sleep') S.sleep = v;
            else if (id === 'steps') S.steps = v;
            else if (id === 'study') { const old = S.studyMins || 0; S.studyMins = v; if (v > old) addXP(Math.round((v - old) / 5), 'habits'); }
            else { const cr = (S.customRings || []).find(r => r.id === id); if (cr) { const old = cr.val || 0; cr.val = v; if (v > old) addXP(Math.round((v - old)), 'cr_' + id); } }
            el.value = ''; save(); renderAll();
        }

        // Muscle groups for heatmap editor
        const MUSCLE_ZONES = {
            'Chest': { front: { 'fz-chest-l': GP, 'fz-chest-r': GP }, back: {} },
            'Shoulders': { front: { 'fz-shoulder-l': GP, 'fz-shoulder-r': GP }, back: { 'bz-shoulder-l': GP, 'bz-shoulder-r': GP } },
            'Biceps': { front: { 'fz-arm-l': GP, 'fz-arm-r': GP }, back: {} },
            'Triceps': { front: {}, back: { 'bz-arm-l': GP, 'bz-arm-r': GP } },
            'Forearms': { front: { 'fz-forearm-l': GS, 'fz-forearm-r': GS }, back: { 'bz-forearm-l': GS, 'bz-forearm-r': GS } },
            'Abs': { front: { 'fz-abs': GP, 'fz-oblique-l': GS, 'fz-oblique-r': GS, 'fz-core': GP }, back: {} },
            'Lats': { front: {}, back: { 'bz-lat-l': GP, 'bz-lat-r': GP } },
            'Traps': { front: {}, back: { 'bz-trap': GP } },
            'Lower back': { front: {}, back: { 'bz-lower': GP } },
            'Quads': { front: { 'fz-quad-l': GP, 'fz-quad-r': GP }, back: {} },
            'Hamstrings': { front: {}, back: { 'bz-ham-l': GP, 'bz-ham-r': GP } },
            'Glutes': { front: {}, back: { 'bz-glute-l': GP, 'bz-glute-r': GP } },
            'Calves': { front: { 'fz-calf-l': GP, 'fz-calf-r': GP }, back: { 'bz-calf-l': GP, 'bz-calf-r': GP } },
        };

        function toggleExEditor() {
            const ed = document.getElementById('ex-editor');
            const open = ed.style.display !== 'none';
            ed.style.display = open ? 'none' : 'block';
            if (!open) renderExEditor();
        }

        function toggleNutEditor() {
            const ed = document.getElementById('nut-editor');
            const open = ed.style.display !== 'none';
            ed.style.display = open ? 'none' : 'block';
            if (!open) renderNutEditor();
        }

        function renderExEditor() {
            const d = splits[S.currentSplit];
            // Exercise list
            document.getElementById('ex-edit-list').innerHTML = d.ex.map((e, i) => `
    <div class="ex-edit-row">
      <span class="ex-edit-name">${e.n}</span>
      <span class="ex-edit-sets">${e.s} · ${e.m}</span>
      <button class="habit-del-btn" onclick="deleteExercise(${i})">Remove</button>
    </div>`).join('');
            // Muscle checkboxes
            const currentMuscles = d.customMuscles || Object.keys(MUSCLE_ZONES).filter(m => {
                const z = MUSCLE_ZONES[m];
                return Object.keys({ ...z.front, ...z.back }).some(k => d.front[k] || d.back[k]);
            });
            document.getElementById('muscle-checkboxes').innerHTML = Object.keys(MUSCLE_ZONES).map(m => `
    <label class="muscle-cb">
      <input type="checkbox" ${currentMuscles.includes(m) ? 'checked' : ''} onchange="toggleMuscle('${m}',this.checked)"/>
      ${m}
    </label>`).join('');
        }

        function renderNutEditor() {
            const d = splits[S.currentSplit];
            document.getElementById('nut-edit-list').innerHTML = d.nut.map((n, i) => `
    <div class="ex-edit-row">
      <span style="font-size:16px;">${n.i}</span>
      <span class="ex-edit-name" style="font-size:12px;">${n.t}</span>
      <button class="habit-del-btn" onclick="deleteNutTip(${i})">Remove</button>
    </div>`).join('');
        }

        function deleteExercise(i) {
            splits[S.currentSplit].ex.splice(i, 1);
            renderExEditor(); renderWorkout();
        }

        function addExercise() {
            const n = document.getElementById('ex-add-name').value.trim();
            const s = document.getElementById('ex-add-sets').value.trim() || '3×10';
            const m = document.getElementById('ex-add-muscle').value.trim() || 'General';
            if (!n) return;
            splits[S.currentSplit].ex.push({ n, s, m });
            document.getElementById('ex-add-name').value = '';
            document.getElementById('ex-add-sets').value = '';
            document.getElementById('ex-add-muscle').value = '';
            renderExEditor(); renderWorkout();
        }

        function toggleMuscle(muscle, on) {
            const d = splits[S.currentSplit];
            if (!d.customMuscles) d.customMuscles = Object.keys(MUSCLE_ZONES).filter(m => {
                const z = MUSCLE_ZONES[m]; return Object.keys({ ...z.front, ...z.back }).some(k => d.front[k] || d.back[k]);
            });
            if (on) { if (!d.customMuscles.includes(muscle)) d.customMuscles.push(muscle); }
            else { d.customMuscles = d.customMuscles.filter(m => m !== muscle); }
            // Rebuild front/back from selected muscles
            d.front = {}; d.back = {};
            d.customMuscles.forEach(m => {
                const z = MUSCLE_ZONES[m];
                Object.assign(d.front, z.front);
                Object.assign(d.back, z.back);
            });
            renderWorkout();
        }

        function deleteNutTip(i) {
            splits[S.currentSplit].nut.splice(i, 1);
            renderNutEditor(); renderWorkout();
        }

        function addNutTip() {
            const i = document.getElementById('nut-add-emoji').value.trim() || '💡';
            const t = document.getElementById('nut-add-title').value.trim();
            const d = document.getElementById('nut-add-desc').value.trim();
            if (!t) return;
            splits[S.currentSplit].nut.push({ i, t, d, bg: '#1a1a2d' });
            document.getElementById('nut-add-emoji').value = '';
            document.getElementById('nut-add-title').value = '';
            document.getElementById('nut-add-desc').value = '';
            renderNutEditor(); renderWorkout();
        }

        function togglePanel() { const p = document.getElementById('toggle-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; }
        function toggleHabitManager() { const p = document.getElementById('habit-manager-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; renderAll(); }

        function addHabit() {
            const name = document.getElementById('new-habit-name').value.trim();
            const xp = parseInt(document.getElementById('new-habit-xp').value) || 10;
            if (!name) return;
            const id = Date.now();
            S.habits.push({ id, name, xp, done: false });
            document.getElementById('new-habit-name').value = '';
            document.getElementById('new-habit-xp').value = '';
            save(); renderAll();
        }

        function deleteHabit(id) {
            const h = S.habits.find(h => h.id === id);
            if (h && h.done) { S.xpToday = Math.max(0, S.xpToday - h.xp); S.totalXp = Math.max(0, S.totalXp - h.xp); S.xpBreakdown.habits = Math.max(0, (S.xpBreakdown.habits || 0) - h.xp); }
            S.habits = S.habits.filter(h => h.id !== id);
            save(); renderAll();
        }

        async function uploadProgressPhoto(event) {
            const file = event.target.files[0]; if (!file) return;
            const week = parseInt(document.getElementById('photo-week-select').value) || 1;
            
            console.log("Processing and uploading photo...");
            
            const reader = new FileReader();
            reader.onload = async function (e) {
                if (!S.progressPhotos) S.progressPhotos = [];
                const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                
                // 1. Compress the image locally first
                const compressed = await compressImage(e.target.result);
                
                try {
                    // 2. Upload the compressed image to the server
                    const res = await fetch('/api/upload-photo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image: compressed })
                    });
                    const result = await res.json();
                    
                    if (result.success) {
                        // 3. Store only the URL return from the server
                        S.progressPhotos.push({ 
                            id: Date.now(), 
                            src: result.url, // This is a tiny URL instead of a huge Base64 string!
                            date, 
                            week 
                        });
                        
                        save(); 
                        renderPhotos();
                        console.log("Photo persisted to server disk.");
                    } else {
                        throw new Error(result.error || "Upload failed");
                    }
                } catch (err) {
                    console.error("Photo persistent upload failed:", err);
                    alert("Could not save photo to server. Check your connection.");
                }
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }

        function deletePhoto(id) {
            S.progressPhotos = (S.progressPhotos || []).filter(p => p.id !== id);
            save(); renderPhotos();
        }

        function toggleWeek(w) {
            if (!window._expandedWeeks) window._expandedWeeks = {};
            const body = document.getElementById('week-body-' + w);
            const isOpen = body.style.display !== 'none';
            window._expandedWeeks[w] = !isOpen;
            body.style.display = isOpen ? 'none' : 'grid';
            // rotate arrow
            const arrow = body.previousElementSibling.querySelector('span:last-child');
            if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        }

        function toggleDrawer(w, btn) {
            const drawer = document.getElementById('drawer-' + w);
            const arrow = document.getElementById('drawer-arrow-' + w);
            if (!drawer) return;
            const isOpen = drawer.style.display !== 'none';
            drawer.style.display = isOpen ? 'none' : 'block';
            if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }

        function renderPhotos() {
            const container = document.getElementById('photos-by-week'); if (!container) return;
            const photos = S.progressPhotos || [];
            if (photos.length === 0) { container.innerHTML = '<div class="no-photos">📷 No photos yet — select a week and upload your first progress photo!</div>'; return; }

            // Group by week
            const groups = {};
            photos.forEach(p => { const w = p.week || 1; if (!groups[w]) groups[w] = []; groups[w].push(p); });
            const weeks = Object.keys(groups).map(Number).sort((a, b) => a - b);

            container.innerHTML = `<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;align-items:flex-start;">
    ${weeks.map(w => {
                const wPhotos = groups[w].sort((a, b) => a.id - b.id);
                const main = wPhotos[0];
                const extras = wPhotos.slice(1);
                return `<div style="flex:0 0 auto;width:180px;">
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span class="week-group-title">Week ${w}</span>
          <span class="week-group-count">${wPhotos.length} photo${wPhotos.length !== 1 ? 's' : ''}</span>
        </div>
        <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);">
          <div style="position:relative;">
            <img src="${main.src}" alt="Week ${w}" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;"/>
            <div style="position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(8,8,16,0.7);">
              <span style="font-size:10px;color:var(--muted);">${main.date}</span>
              <button class="photo-del" onclick="deletePhoto(${main.id})">×</button>
            </div>
          </div>
          ${extras.length > 0 ? `
          <button onclick="toggleDrawer(${w},this)" style="width:100%;background:var(--bg3);border:none;border-top:1px solid var(--border);color:var(--purple);font-size:11px;font-weight:600;padding:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            <span id="drawer-arrow-${w}" style="transition:transform 0.2s;display:inline-block;">▼</span>
            <span>+${extras.length} more photo${extras.length !== 1 ? 's' : ''}</span>
          </button>
          <div id="drawer-${w}" style="display:none;">
            ${extras.map(p => `
              <div style="position:relative;border-top:1px solid var(--border);">
                <img src="${p.src}" alt="extra" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;"/>
                <div style="position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(8,8,16,0.7);">
                  <span style="font-size:10px;color:var(--muted);">${p.date}</span>
                  <button class="photo-del" onclick="deletePhoto(${p.id})">×</button>
                </div>
              </div>`).join('')}
          </div>`: ''}
        </div>
      </div>`;
            }).join('')}
  </div>`;
        }
        // AI COACH & MEAL SCANNER LOGIC
        function triggerMealScan() {
            document.getElementById('meal-camera-input').click();
        }

        async function analyzeMeal(event) {
            const file = event.target.files[0]; if (!file) return;
            
            // Show global loading if needed, or just console context
            console.log("Analyzing meal with Gemini...");
            const originalText = document.querySelector('.ai-btn-scan').innerHTML;
            document.querySelector('.ai-btn-scan').innerHTML = '<div class="ai-spinner" style="width:12px;height:12px;margin:0;"></div> Analyzing...';

            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const res = await fetch('/api/analyze-meal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            image: e.target.result,
                            context: { workoutType: S.currentSplit }
                        })
                    });
                    const data = await res.json();
                    
                    if (data.success) {
                        const a = data.analysis;
                        document.getElementById('food-name').value = a.name;
                        document.getElementById('food-cals').value = a.cals;
                        document.getElementById('food-protein').value = a.protein;
                        document.getElementById('food-carbs').value = a.carbs;
                        document.getElementById('food-fat').value = a.fat;
                        
                        // Show the tip in a nice way
                        alert("🍕 AI Breakdown: " + a.tip);
                    }
                } catch (err) {
                    console.error("AI Analysis failed:", err);
                    alert("Gemini couldn't see that meal clearly. Try again?");
                } finally {
                    document.querySelector('.ai-btn-scan').innerHTML = originalText;
                    event.target.value = '';
                }
            };
            reader.readAsDataURL(file);
        }

        // AI COACH CONVERSATIONAL LOGIC
        function renderChat() {
            const container = document.getElementById('chat-container');
            if (!container) return;
            const history = S.aiChatHistory || [];
            
            if (history.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px 20px;">
                        <div style="font-size:40px; margin-bottom:12px;">💪</div>
                        <div style="font-size:18px; font-weight:700; color:var(--text); margin-bottom:8px;">Ready to lock in?</div>
                        <div style="font-size:13px; color:var(--muted);">I'm your Gemini Coach. Ask me about your progress, weight goals, or what to eat after your ${S.currentSplit} workout.</div>
                    </div>
                `;
                return;
            }

            container.innerHTML = history.map(m => {
                let imgHtml = '';
                if (m.images && m.images.length > 0) {
                    imgHtml = `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">` +
                        m.images.map(img => `<img src="${img}" style="max-height:100px; border-radius:8px; border: 1px solid rgba(255,255,255,0.1);" />`).join('')
                        + `</div>`;
                } else if (m.image) {
                    imgHtml = `<br><img src="${m.image}" style="max-width:100%; max-height:150px; border-radius:8px; margin-top:8px; border: 1px solid rgba(255,255,255,0.1);" />`;
                }
                
                return `
                <div class="chat-bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-coach'}">
                    ${m.text}
                    ${imgHtml}
                </div>
                `;
            }).join('');
            
            container.scrollTop = container.scrollHeight;
        }

        function autoExpand(el) {
            el.style.height = 'inherit';
            el.style.height = (el.scrollHeight) + 'px';
        }

        function clearChat() {
            S.aiChatHistory = [];
            save();
            renderChat();
        }

        let currentChatImages = [];

        function clearChatImage() {
            currentChatImages = [];
            document.getElementById('chat-file-input').value = "";
            document.getElementById('chat-image-preview-container').style.display = 'none';
            document.getElementById('chat-image-preview-container').innerHTML = '';
        }

        function handleChatImageUpload(e) {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            Array.from(files).forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const max_dim = 800; // Compress dynamically

                        if (width > height && width > max_dim) {
                            height *= max_dim / width;
                            width = max_dim;
                        } else if (height > max_dim) {
                            width *= max_dim / height;
                            height = max_dim;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const b64 = canvas.toDataURL('image/jpeg', 0.8);
                        currentChatImages.push(b64);
                        
                        refreshPreviewUI();
                    }
                    img.src = event.target.result;
                }
                reader.readAsDataURL(file);
            });
        }
        
        function refreshPreviewUI() {
            const container = document.getElementById('chat-image-preview-container');
            container.innerHTML = '';
            if (currentChatImages.length === 0) {
                container.style.display = 'none';
                return;
            }
            container.style.display = 'flex';
            currentChatImages.forEach((src, i) => {
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'position:relative; display:inline-block; flex-shrink:0;';
                
                if (src.startsWith('data:audio/')) {
                    const audioIcon = document.createElement('div');
                    audioIcon.innerHTML = '<span style="font-size:24px; margin-bottom:4px;">🎤</span><br>Voice Memo';
                    audioIcon.style.cssText = 'height: 80px; width: 80px; padding: 10px; background: var(--purple2); color: white; border-radius: 8px; font-size: 10px; font-weight: bold; border: 1px solid var(--border); box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;';
                    wrapper.appendChild(audioIcon);
                } else {
                    const img = document.createElement('img');
                    img.src = src;
                    img.style.cssText = 'max-height: 80px; max-width:120px; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: block; object-fit:cover;';
                    wrapper.appendChild(img);
                }
                
                const btn = document.createElement('button');
                btn.innerHTML = '✕';
                btn.style.cssText = 'position:absolute; top: -5px; right: -5px; background: #ff4444; color: #fff; border:none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display:flex; align-items:center; justify-content:center; font-size:10px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);';
                btn.onclick = () => {
                    currentChatImages.splice(i, 1);
                    refreshPreviewUI();
                };
                
                wrapper.appendChild(btn);
                container.appendChild(wrapper);
            });
        }

        function handleChatKey(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        }

        function handleAudioUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                currentChatImages.push(event.target.result);
                refreshPreviewUI();
                const input = document.getElementById('chat-input');
                if(!input.value.trim()) input.value = "Analyze this voice memo";
            };
            reader.readAsDataURL(file);
            document.getElementById('chat-audio-input').value = ""; // Reset
        }

        async function sendChatMessage() {
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (!text && currentChatImages.length === 0) return;

            // Reset height after send
            input.style.height = 'inherit';

            // Add user message to state
            const payloadImages = [...currentChatImages];
            S.aiChatHistory.push({ role: 'user', text: text || "[Sent images]", images: payloadImages });
            input.value = '';
            clearChatImage();
            renderChat();
            save();

            // Add a temporary "Typing..." bubble
            const container = document.getElementById('chat-container');
            const typingId = 'typing-' + Date.now();
            const typingBubble = document.createElement('div');
            typingBubble.id = typingId;
            typingBubble.className = 'chat-bubble bubble-coach';
            typingBubble.innerHTML = '<div class="ai-spinner" style="width:12px;height:12px;display:inline-block;margin:0;"></div> Coach is thinking...';
            container.appendChild(typingBubble);
            container.scrollTop = container.scrollHeight;

            try {
                const res = await fetch('/api/ai-coach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        state: S,
                        workout: splits[S.currentSplit],
                        history: S.aiChatHistory.slice(0, -1), // Everything except the latest message
                        prompt: text || "Please analyze these images.", // The actual new message to process
                        images: payloadImages
                    })
                });
                const data = await res.json();

                // Remove typing bubble
                const tb = document.getElementById(typingId);
                if (tb) tb.remove();

                if (data.success && data.advice) {
                    const advice = data.advice;
                    S.aiChatHistory.push({ role: 'model', text: advice.message || "Coach processed your request." });
                    
                    if (advice.command) {
                        const cmd = advice.command;
                        if (cmd.target === 'cals') { S.calGoal = cmd.value; S.aiChatHistory.push({ role: 'model', text: `🛡️ <i>Goal updated: ${cmd.target} is now ${cmd.value}.</i>` }); }
                        else if (cmd.target === 'protein') { S.proteinGoal = cmd.value; S.aiChatHistory.push({ role: 'model', text: `🛡️ <i>Goal updated: ${cmd.target} is now ${cmd.value}.</i>` }); }
                        else if (cmd.target === 'water') { S.waterGoal = cmd.value; S.aiChatHistory.push({ role: 'model', text: `🛡️ <i>Goal updated: ${cmd.target} is now ${cmd.value}.</i>` }); }
                        else if (cmd.target === 'log_food') {
                            addAIFoodLog(cmd.data);
                            S.aiChatHistory.push({ role: 'model', text: `🍔 <i>Logged Food: ${cmd.data.name} (${cmd.data.cals} kcal).</i>` });
                        }
                        else if (cmd.target === 'log_workout') {
                            addAIWorkoutLog(cmd.data);
                            S.aiChatHistory.push({ role: 'model', text: `🏋️‍♂️ <i>Logged Set: ${cmd.data.exercise} (${cmd.data.reps} reps).</i>` });
                        }
                        save();
                        renderAll();
                    }
                } else {
                    S.aiChatHistory.push({ role: 'model', text: "⚠️ Coach is momentarily out of breath. Try again in a second!" });
                }
                renderChat();
                save();
            } catch (err) {
                console.error("AI Coach failed:", err);
                const tb = document.getElementById(typingId);
                if (tb) tb.remove();
                S.aiChatHistory.push({ role: 'model', text: "⚠️ Connection lost. Ensure your server is running and try again." });
                renderChat();
                save();
            }
        }

        function showScreen(n, b) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            document.getElementById('screen-' + n).classList.add('active');
            if (b) b.classList.add('active');
            
            if (n === 'ai-coach') renderChat();
        }
        function setSplit(k) { S.currentSplit = k; save(); renderWorkout(); document.querySelectorAll('.split-btn').forEach(b => b.classList.toggle('active', b.dataset.split === k)); }

        function ring(r, sz = 60) {
            const pct = Math.min(r.goal() > 0 ? r.val() / r.goal() : 0, 1);
            const rad = sz * 0.38, circ = 2 * Math.PI * rad, off = circ * (1 - pct), cx = sz / 2, sw = sz * 0.11;
            return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><circle cx="${cx}" cy="${cx}" r="${rad}" fill="none" stroke="#1e1e2a" stroke-width="${sw}"/><circle cx="${cx}" cy="${cx}" r="${rad}" fill="none" stroke="${r.color}" stroke-width="${sw}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cx})" style="transition:stroke-dashoffset 0.6s"/></svg>`;
        }

        function renderAll() {
            const hr = new Date().getHours();
            document.getElementById('time-greeting').textContent = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
            const d = S.streak;
            document.getElementById('day-greeting').textContent = d === 0 ? 'Day 0 — start today.' : d === 1 ? 'Day 1 — you started.' : d > 10 ? `Day ${d} — locked in.` : `Day ${d} — keep going.`;
            document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

            document.getElementById('streak-nav').textContent = S.streak;
            const rk = getRank(), nrk = getNext();
            document.getElementById('ovr-badge-icon').innerHTML = rk.badge;
            const rankSvg = document.querySelector('#ovr-badge-icon img') || document.querySelector('#ovr-badge-icon svg');
            if (rankSvg) rankSvg.style.filter = `drop-shadow(0 0 6px ${rk.color}40)`;
            document.getElementById('rank-nav').textContent = rk.name;
            document.getElementById('ovr-nav').textContent = Math.min(99, Math.round(50 + S.totalXp / 600));

            // rings
            document.getElementById('rings-grid').innerHTML = RINGS.filter(r => S.visibleRings.includes(r.id)).map(r => {
                const pct = r.goal() > 0 ? Math.round(Math.min(r.val() / r.goal(), 1) * 100) : 0;
                const sub = r.id === 'habits' ? `${r.val()}/${r.goal()}` : r.id === 'vitamins' ? (r.val() ? 'Done' : '–') : `${r.val()}${r.unit ? ' ' + r.unit : ''}`;
                return `<div class="ring-card">${ring(r, 60)}<div class="ring-label">${r.label}</div><div class="ring-pct" style="color:${r.color}">${pct}%</div><div class="ring-sub">${sub}</div></div>`;
            }).join('');

            // toggles
            document.getElementById('toggle-list').innerHTML = RINGS.filter(r => !r.core).map(r => {
                const on = S.visibleRings.includes(r.id);
                return `<div class="toggle-row"><span class="toggle-label" style="color:${on ? r.color : 'var(--text)'}">${r.label}</span><button class="tog-btn ${on ? 'on' : ''}" onclick="toggleRing('${r.id}',${!on})">${on ? 'Visible' : 'Hidden'}</button></div>`;
            }).join('');

            // log inputs
            const logRings = RINGS.filter(r => r.log && S.visibleRings.includes(r.id));
            const logCard = document.getElementById('log-card');
            logCard.style.display = logRings.length ? 'block' : 'none';
            document.getElementById('ring-log-inputs').innerHTML = logRings.map(r => `
    <div class="ring-log-item">
      <div class="ring-log-label" style="color:${r.color}">${r.logLabel}</div>
      <div class="ring-log-row">
        <input type="number" id="rlog-${r.id}" placeholder="${r.unit || 'value'}" step="${r.logStep}" max="${r.logMax}" min="0"/>
        <button onclick="logRingValue('${r.id}')" style="background:${r.color}22;border:1px solid ${r.color}55;border-radius:8px;color:${r.color};font-size:12px;padding:7px 10px;cursor:pointer;white-space:nowrap;">Log</button>
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;">Now: ${r.val()} ${r.unit} · Goal: ${r.goal()} ${r.unit}</div>
    </div>`).join('');

            // habits
            const dc = S.habits.filter(h => h.done).length;
            document.getElementById('habits-progress').textContent = `${dc}/${S.habits.length} done`;
            document.getElementById('habits-list').innerHTML = S.habits.map(h => `
    <div class="habit-row">
      <div class="habit-left">
        <div class="hcheck ${h.done ? 'done' : ''}" onclick="toggleHabit(${h.id})">
          ${h.done ? '<svg width="11" height="11" viewBox="0 0 11 11"><polyline points="1.5,5.5 4.5,8.5 9.5,2.5" fill="none" stroke="white" stroke-width="1.8"/></svg>' : ''}
        </div>
        <span class="habit-name ${h.done ? 'done' : ''}">${h.name}</span>
      </div>
      <span class="xp-pill">+${h.xp} XP</span>
    </div>`).join('');

            // habit manager list
            const mgr = document.getElementById('habit-manage-list');
            if (mgr) mgr.innerHTML = S.habits.length === 0 ? '<div style="color:var(--muted);font-size:13px;padding:8px 0;">No habits yet — add one below.</div>' : S.habits.map(h => `
    <div class="habit-manage-row">
      <div>
        <span style="font-size:13px;">${h.name}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:8px;">+${h.xp} XP</span>
      </div>
      <button class="habit-del-btn" onclick="deleteHabit(${h.id})">Remove</button>
    </div>`).join('');

            // week bars
            const mx = Math.max(...S.weekXp, 1);
            const dayNamesArr = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            const dn = [];
            const currentDayNum = new Date().getDay();
            for (let i = 6; i >= 0; i--) {
                let d = currentDayNum - i;
                if (d < 0) d += 7;
                dn.push(dayNamesArr[d]);
            }
            document.getElementById('week-bars').innerHTML = S.weekXp.map((v, i) => `<div class="wbar-wrap"><div class="wbar ${i === 6 ? 'today' : ''}" style="height:${Math.max(Math.round(v / mx * 100), v > 0 ? 4 : 0)}%"></div></div>`).join('');
            document.getElementById('week-days').innerHTML = dn.map((d, i) => `<div style="flex:1;text-align:center;font-size:9px;color:${i === 6 ? 'var(--purple)' : 'var(--muted)'};">${d}</div>`).join('');

            document.getElementById('streak-display').innerHTML = `${S.streak} <span style="font-size:14px;">days</span>`;
            document.getElementById('best-streak').textContent = S.bestStreak;
            document.getElementById('total-xp-display').textContent = S.totalXp.toLocaleString();

            document.getElementById('rank-badges-grid').innerHTML = ranks.map(r => {
                const unlocked = S.totalXp >= r.min;
                const cur = r.name === rk.name;
                return `<div class="rank-badge ${unlocked ? 'unlocked' : ''} ${cur ? 'current' : ''}" style="color:${r.color};">
      <div class="rank-badge-icon">${r.badge}</div>
      <div class="rank-badge-name" style="color:${unlocked ? r.color : 'var(--muted)'};">${r.name}</div>
      <div class="rank-badge-xp">${r.min === 0 ? 'Start' : r.min.toLocaleString() + ' XP'}</div>
    </div>`;
            }).join('');
            if (nrk) { const p = (S.totalXp - rk.min) / (nrk.min - rk.min); document.getElementById('rank-bar').style.width = Math.round(p * 100) + '%'; document.getElementById('rank-progress-label').textContent = `Progress to ${nrk.name}`; document.getElementById('rank-xp-label').textContent = `${S.totalXp - rk.min} / ${nrk.min - rk.min} XP needed`; }

            if (typeof VanillaTilt !== 'undefined') {
                VanillaTilt.init(document.querySelectorAll(".rank-badge-icon img"), {
                    max: 35,
                    speed: 400,
                    glare: true,
                    "max-glare": 0.4,
                    scale: 1.15
                });
                VanillaTilt.init(document.querySelectorAll("#ovr-badge-icon img"), {
                    max: 20,
                    speed: 400,
                    glare: true,
                    "max-glare": 0.3,
                    scale: 1.2
                });
            }

            // dynamic XP breakdown — built from all rings + standard categories
            const bd = S.xpBreakdown || {};
            const allRingXp = RINGS.filter(r => r.id !== 'habits').map(r => `<div class="xp-row"><span style="color:var(--muted)">${r.label}</span><span style="color:${r.color}">${bd[r.id] || 0} XP</span></div>`).join('');
            const customXp = (S.customRings || []).map(r => `<div class="xp-row"><span style="color:var(--muted)">${r.label}</span><span style="color:${r.color}">${bd[r.id] || 0} XP</span></div>`).join('');
            document.getElementById('xp-breakdown').innerHTML = `<div class="xp-row"><span style="color:var(--muted)">Habits</span><span style="color:var(--purple)">${bd.habits || 0} XP</span></div>${allRingXp}${customXp}<div class="xp-row"><span style="color:var(--muted)">Todos done</span><span style="color:var(--purple)">${bd.todos || 0} XP</span></div>`;
            document.getElementById('xp-total-display').textContent = S.xpToday + ' XP';

            // custom ring goals
            const crg = document.getElementById('custom-ring-goals');
            if (crg) crg.innerHTML = (S.customRings || []).map(r => `<div class="prog-row"><div class="prog-head"><span style="color:${r.color}">${r.label}</span><span>${r.val || 0} / ${r.goal} ${r.unit}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(Math.round((r.val || 0) / r.goal * 100), 100)}%;background:${r.color};"></div></div></div>`).join('');

            const sb = (id, pct, lid, lbl) => { document.getElementById(id).style.width = Math.min(Math.round(pct * 100), 100) + '%'; document.getElementById(lid).textContent = lbl; };
            sb('prog-xp', S.xpToday / S.xpGoal, 'prog-xp-label', `${S.xpToday} / ${S.xpGoal}`);
            sb('prog-water', S.water / S.waterGoal, 'prog-water-label', `${S.water} / ${S.waterGoal}ml`);
            const tc = S.foods.reduce((a, f) => a + f.cals, 0), tp = S.foods.reduce((a, f) => a + f.protein, 0);
            sb('prog-cals', tc / S.calGoal, 'prog-cals-label', `${tc} / ${S.calGoal} kcal`);
            sb('prog-protein', tp / 180, 'prog-protein-label', `${tp} / 180g`);
            sb('prog-study', (S.studyMins || 0) / 60, 'prog-study-label', `${S.studyMins || 0} / 60 mins`);
            sb('prog-sleep', (S.sleep || 0) / 8, 'prog-sleep-label', `${S.sleep || 0} / 8 hrs`);
            sb('prog-steps', (S.steps || 0) / 8000, 'prog-steps-label', `${(S.steps || 0).toLocaleString()} / 8,000`);

            document.getElementById('water-display').textContent = S.water.toLocaleString();
            document.getElementById('water-goal-display').textContent = S.waterGoal.toLocaleString();
            document.getElementById('water-bar').style.width = Math.min(S.water / S.waterGoal * 100, 100) + '%';
            document.getElementById('water-pct').textContent = Math.round(S.water / S.waterGoal * 100) + '% of daily goal';
            const sl = document.getElementById('water-goal-slider'); if (sl) { sl.value = S.waterGoal; document.getElementById('water-goal-label').textContent = S.waterGoal + 'ml'; }

            document.getElementById('cals-display').textContent = tc.toLocaleString();
            document.getElementById('cal-goal-display').textContent = S.calGoal.toLocaleString();
            document.getElementById('cals-bar').style.width = Math.min(tc / S.calGoal * 100, 100) + '%';
            document.getElementById('protein-display').textContent = tp + 'g';
            document.getElementById('carbs-display').textContent = S.foods.reduce((a, f) => a + f.carbs, 0) + 'g';
            document.getElementById('fat-display').textContent = S.foods.reduce((a, f) => a + f.fat, 0) + 'g';
            document.getElementById('food-list').innerHTML = S.foods.length === 0 ? '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0;">No food logged yet</div>' : S.foods.map(f => `<div class="food-item"><div><div style="font-weight:500;">${f.name}</div><div style="font-size:11px;color:var(--muted);">${f.protein}g P · ${f.carbs}g C · ${f.fat}g F</div></div><div style="display:flex;align-items:center;gap:8px;"><span class="food-cals">${f.cals} kcal</span><button class="del-btn" onclick="deleteFood(${f.id})">×</button></div></div>`).join('');

            const td = S.todos.filter(t => t.done).length;
            document.getElementById('todo-count').textContent = `${td} / ${S.todos.length}`;
            document.getElementById('todo-bar').style.width = S.todos.length ? Math.round(td / S.todos.length * 100) + '%' : '0%';
            document.getElementById('todo-list').innerHTML = S.todos.length === 0 ? '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0;">No tasks yet</div>' : S.todos.map(t => `<div class="todo-item"><div class="todo-check ${t.done ? 'done' : ''}" onclick="toggleTodo(${t.id})">${t.done ? '<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" fill="none" stroke="white" stroke-width="1.8"/></svg>' : ''}</div><span class="todo-text ${t.done ? 'done' : ''}">${t.text}</span><button class="del-btn" onclick="deleteTodo(${t.id})">×</button></div>`).join('');

            renderWorkout();
            renderPhotos();
            renderBudget();
            renderTracking();
            renderTrophyRoom();
        }

        function renderTrophyRoom() {
            const grid = document.getElementById('trophies-grid');
            if(!grid) return;
            
            grid.innerHTML = ranks.map(r => {
                const unlocked = S.totalXp >= r.min;
                return `<div class="trophy-card ${unlocked ? 'unlocked' : 'locked'}" style="${unlocked ? '--glow-color: '+r.color+'33;' : ''}">
                    <div class="trophy-badge">
                        ${r.badge}
                    </div>
                    <div class="trophy-lock-overlay">🔒</div>
                    <div class="trophy-name" style="color: ${unlocked ? r.color : '#888'}">${unlocked ? r.name : '???'}</div>
                    <div class="trophy-req">${r.min === 0 ? 'Starter Badge' : r.min.toLocaleString() + ' XP to unlock'}</div>
                </div>`;
            }).join('');
            
            if (typeof VanillaTilt !== 'undefined') {
                VanillaTilt.init(document.querySelectorAll("#trophies-grid .unlocked .trophy-badge img"), {
                    max: 35,
                    speed: 400,
                    glare: true,
                    "max-glare": 0.5,
                    scale: 1.25,
                    perspective: 800
                });
            }
        }

        const rxBg = { 'Housing': '#1e253c', 'Food': '#3c221e', 'Transport': '#3c311e', 'Health': '#1e3c23', 'Entertainment': '#3c1e34', 'Shopping': '#261e3c', 'Savings': '#193d25', 'Other': '#2a2a3a', 'Salary': '#193d25' };
        const rxIcon = { 'Housing': '🏠', 'Food': '🛒', 'Transport': '⛽', 'Health': '💪', 'Entertainment': '🍿', 'Shopping': '🛍️', 'Savings': '📈', 'Other': '📊', 'Salary': '💼' };

        function updateCatOptions() {
            const typ = document.getElementById('tx-type').value;
            const cat = document.getElementById('tx-cat');
            if (typ === 'income') {
                cat.innerHTML = '<option value="Salary">💼 Salary / Paycheck</option><option value="Other">📊 Other Income</option>';
            } else {
                cat.innerHTML = '<option value="Housing">🏠 Housing / Rent</option><option value="Food">🛒 Food / Groceries</option><option value="Transport">⛽ Transport</option><option value="Health">💪 Health / Fitness</option><option value="Entertainment">🍿 Entertainment</option><option value="Shopping">🛍️ Shopping</option><option value="Savings">📈 Savings / Investments</option><option value="Other">📊 Other / Misc</option>';
            }
        }

        function editBudgetGoal() {
            const val = prompt('Enter your monthly budget goal (e.g. 3000):', S.budgetGoal || 3000);
            if (val !== null && !isNaN(parseFloat(val))) {
                S.budgetGoal = parseFloat(val);
                save(); renderAll();
            }
        }

        function toggleIncomeEdit() {
            const panel = document.getElementById('income-edit-panel');
            const btn = document.getElementById('income-edit-btn');
            const isOpen = panel.style.display === 'flex';
            panel.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) {
                const inp = document.getElementById('income-input');
                inp.value = S.monthlyIncome || '';
                inp.focus();
            }
        }

        function saveIncome() {
            const val = parseFloat(document.getElementById('income-input').value);
            if (!isNaN(val) && val >= 0) {
                S.monthlyIncome = val;
                save(); renderAll();
            }
            document.getElementById('income-edit-panel').style.display = 'none';
        }

        function addTransaction() {
            const amt = parseFloat(document.getElementById('tx-amount').value);
            const typ = document.getElementById('tx-type').value;
            const nm = document.getElementById('tx-name').value.trim();
            const cat = document.getElementById('tx-cat').value;
            if (!amt || amt <= 0) return;
            S.transactions.push({ id: Date.now(), amount: amt, type: typ, name: nm || cat, category: cat, date: new Date().toISOString() });
            document.getElementById('tx-amount').value = '';
            document.getElementById('tx-name').value = '';
            // Add a small XP reward for logging expenses tracking
            if (typ === 'expense') addXP(5, 'habits');
            save(); renderAll();
        }

        function deleteTransaction(id) {
            S.transactions = S.transactions.filter(t => t.id !== id);
            save(); renderAll();
        }

        function renderBudget() {
            const now = new Date();
            document.getElementById('budget-month-label').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' BUDGET';

            const thisMonth = S.transactions.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });

            // Total income = fixed monthly income + any income transactions logged
            const txIncome = thisMonth.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
            const monthlyIncome = S.monthlyIncome || 0;
            const totalIncome = monthlyIncome + txIncome;
            const expense = thisMonth.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

            // Update income display
            const incomeEl = document.getElementById('budget-income-display');
            if (incomeEl) incomeEl.textContent = '$' + totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

            // Update the "out of" label to reflect income
            const goalDisplay = document.getElementById('budget-goal-display');
            if (goalDisplay) goalDisplay.textContent = '$' + totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

            // Remaining = income - expenses
            const remaining = totalIncome - expense;
            const balanceEl = document.getElementById('budget-net-balance');
            balanceEl.textContent = remaining < 0 ? '-$' + Math.abs(remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            balanceEl.style.color = remaining < 0 ? '#ff5e1a' : 'var(--text)';

            document.getElementById('budget-spent-lbl').textContent = '$' + expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' spent';
            document.getElementById('budget-total-lbl').textContent = totalIncome > 0 ? '$' + totalIncome.toLocaleString() + ' income' : 'Set your income ↑';

            const pct = totalIncome > 0 ? Math.min(expense / totalIncome * 100, 100) : 0;
            const bar = document.getElementById('budget-bar');
            bar.style.width = pct + '%';
            bar.classList.toggle('over', expense > totalIncome);

            // Top categories
            const cats = {};
            thisMonth.filter(t => t.type === 'expense').forEach(t => {
                cats[t.category] = (cats[t.category] || 0) + t.amount;
            });
            const topCats = Object.keys(cats).map(k => ({ k, v: cats[k] })).sort((a, b) => b.v - a.v).slice(0, 6);
            document.getElementById('budget-categories').innerHTML = topCats.length === 0 ? '<div style="grid-column:1/4;text-align:center;color:var(--muted);font-size:13px;padding:8px; border:1px dashed var(--border); border-radius:12px;">No spending this month.</div>' : topCats.map(c => `
                <div class="b-cat-card">
                    <div class="cat-icon" style="background:${rxBg[c.k] || rxBg['Other']}">${rxIcon[c.k] || rxIcon['Other']}</div>
                    <div class="b-cat-amt">$${c.v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div class="b-cat-name">${c.k}</div>
                </div>
            `).join('');

            // Tx list
            let sorted = [...thisMonth].sort((a, b) => new Date(b.date) - new Date(a.date));
            document.getElementById('transaction-list').innerHTML = sorted.length === 0 ? '<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px 0;">No transactions yet. Start logging!</div>' : sorted.map(t => {
                const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `
                <div class="tx-row">
                    <div class="tx-l">
                        <div class="cat-icon" style="background:${rxBg[t.category] || '#2a2a3a'}">${rxIcon[t.category] || '💳'}</div>
                        <div>
                            <div class="tx-title">${t.name}</div>
                            <div class="tx-cat-subRow">${t.category} • ${dateStr}</div>
                        </div>
                    </div>
                    <div class="tx-r">
                        <div class="tx-amount ${t.type === 'expense' ? 'exp' : 'inc'}">${t.type === 'expense' ? '-' : '+'} $${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <button class="del-btn" style="font-size:20px; padding:0; margin-top:2px;" onclick="deleteTransaction(${t.id})">×</button>
                    </div>
                </div>
            `}).join('');
        }

        function renderWorkout() {
            const d = splits[S.currentSplit];
            document.getElementById('workout-day-label').textContent = 'Today: ' + d.label;
            aF.forEach(id => { const el = document.getElementById(id); if (!el) return; const g = d.front[id]; el.setAttribute('fill', g || '#1e2d3a'); });
            aB.forEach(id => { const el = document.getElementById(id); if (!el) return; const g = d.back[id]; el.setAttribute('fill', g || '#1e2d3a'); });
            document.getElementById('split-btns').innerHTML = Object.keys(splits).map(k => `<button class="split-btn ${k === S.currentSplit ? 'active' : ''}" data-split="${k}" onclick="setSplit('${k}')">${k.charAt(0).toUpperCase() + k.slice(1)}</button>`).join('');
            
            // Dynamic Set/Rep UI Rendering
            document.getElementById('exercise-list').innerHTML = d.ex.map((e, index) => {
                let sNum = 3; // Default 3 sets
                if(e.s.includes('×')) sNum = parseInt(e.s.split('×')[0]) || 3;
                else if(e.s.includes('x')) sNum = parseInt(e.s.split('x')[0]) || 3;
                
                const exLogs = (S.workoutLogs || []).filter(l => l.exercise.toLowerCase() === e.n.toLowerCase() && l.date === S.currentWorkoutDate);

                let nodesHTML = '';
                for(let i=0; i<sNum; i++) {
                    const log = exLogs[i]; // get the log for set i
                    if (log) {
                        nodesHTML += `<div class="set-node completed" title="RPE: ${log.rpe || '-'}, Zone: ${log.zone || '-'} | ${log.notes || ''}" style="background:#7c6fff; border-color:#7c6fff; color:#fff;" onclick="alert('Set ${i+1}: ${log.reps} reps @ ${log.weight || 'BW'}\\nRPE: ${log.rpe || '-'}\\nZone: ${log.zone || '-'}\\nNotes: ${log.notes || 'None'}')">✓</div>`;
                    } else {
                        nodesHTML += `<div class="set-node" onclick="alert('Tap the Microphone (🎤) in the AI Coach tab to hands-free log this set!')"></div>`;
                    }
                }

                let logsHTML = exLogs.map((log, i) => `
                    <div style="font-size:11px; color:var(--muted); margin-top:4px; padding-left:12px; border-left: 2px solid #7c6fff; margin-bottom:4px;">
                        Set ${i+1}: ${log.reps} reps${log.weight ? ' @ '+log.weight : ''} 
                        <span style="background:var(--bg3); padding:2px 6px; border-radius:4px; font-size:9px; margin-left:6px; color:#fff; border:1px solid #333;">RPE ${log.rpe || '-'}</span>
                        <span style="background:var(--bg3); padding:2px 6px; border-radius:4px; font-size:9px; margin-left:4px; color:#fff; border:1px solid #333;">Zone ${log.zone || '-'}</span>
                        ${log.notes ? `<br><span style="color:#a090ff; display:inline-block; margin-top:4px;">↳ Coach Note: ${log.notes}</span>` : ''}
                    </div>
                `).join('');

                return `
                <div class="ex-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <div>
                            <div style="font-size:14px;font-weight:600;">${e.n}</div>
                            <div style="font-size:11px;color:var(--muted);">${e.m} · Target: ${e.s}</div>
                        </div>
                        <div style="display:flex; gap:6px;">
                            ${nodesHTML}
                        </div>
                    </div>
                    ${logsHTML}
                </div>`;
            }).join('');
            document.getElementById('workout-nutrition').innerHTML = d.nut.map(n => `<div class="tip-row"><div class="tip-icon" style="background:${n.bg};">${n.i}</div><div><div style="font-size:13px;font-weight:500;">${n.t}</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">${n.d}</div></div></div>`).join('');
        }

        let activeCalDay = new Date().toDateString();

        function renderTracking() {
            const sel = document.getElementById('cal-ring-select');
            if (sel && sel.options.length === 0) {
                sel.innerHTML = RINGS.map(r => `<option value="${r.id}">${r.label}</option>`).join('');
            }
            renderCalendar();
            // loadJournal is handled by selectCalDay
            const tl = document.getElementById('timeline-body');
            if (tl) {
                if (!S.schedule || S.schedule.length === 0) {
                    tl.innerHTML = `<div style="text-align:center; padding:44px 0; color:var(--muted); font-size:13px;">Your schedule is empty.<br>Block out your day above!</div>`;
                } else {
                    tl.innerHTML = S.schedule.map(s => {
                        const h = parseInt(s.time.split(':')[0]);
                        const m = s.time.split(':')[1];
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const fH = h % 12 || 12;
                        return `
                        <div class="tl-row">
                            <div class="tl-time">${fH}:${m} ${ampm}</div>
                            <div class="tl-content">
                                <div class="tl-block">
                                    <span>${s.title}</span>
                                    <button class="tl-btn-del" onclick="delScheduleBlock(${s.id})">×</button>
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }

            renderGoals();
            const hs = document.getElementById('heatmap-select');
            if (hs && hs.options.length === 0) {
                hs.innerHTML = RINGS.map(r => `<option value="${r.id}">${r.label}</option>`).join('');
                hs.value = 'water'; // default visual pop
            }
            renderHeatmaps();
        }

        function addGoal() {
            const title = prompt('Goal Title (e.g. "Lose 30 pounds"):');
            if (!title) return;
            const target = parseFloat(prompt('Target number (e.g. 30):') || 100);
            const deadline = prompt('Deadline Date (e.g. "October 27, 2025"):') || 'Dec 31, 2025';

            let colorInput = prompt('Color name (e.g. blue, green, red, purple, orange):') || 'purple';
            colorInput = colorInput.toLowerCase().trim();
            const colorMap = {
                'blue': '#2a8fff', 'green': '#1db87a', 'red': '#ff7b7b',
                'purple': '#7c6fff', 'orange': '#ffaa22', 'yellow': '#ffaa22',
                'pink': '#d44e8a', 'white': '#ffffff'
            };
            const color = colorMap[colorInput] || (colorInput.startsWith('#') ? colorInput : '#7c6fff');

            const prefix = prompt('Prefix? (e.g. "$", leave blank for none):') || '';
            const suffix = prompt('Suffix? (e.g. " lbs", leave blank for none):') || '';

            if (!S.longTermGoals) S.longTermGoals = [];
            S.longTermGoals.push({ id: Date.now(), title, deadline, current: 0, target, prefix, suffix, color });
            save(); renderGoals();
        }

        function editGoal(id) {
            const g = S.longTermGoals.find(x => x.id === id);
            if (!g) return;
            const v = prompt(`Update current progress for "${g.title}" (Target: ${g.target}). Type 'delete' to erase.`, g.current);
            if (v && v.trim().toLowerCase() === 'delete') {
                S.longTermGoals = S.longTermGoals.filter(x => x.id !== id);
                save(); renderGoals();
            } else if (v !== null && !isNaN(parseFloat(v))) {
                g.current = parseFloat(v);
                save(); renderGoals();
            }
        }

        function deleteGoal(id) {
            if (confirm("Are you sure you want to delete this goal?")) {
                S.longTermGoals = S.longTermGoals.filter(x => x.id !== id);
                save(); renderGoals();
            }
        }

        function renderGoals() {
            const list = document.getElementById('long-term-goals-list');
            if (!list) return;
            if (!S.longTermGoals || S.longTermGoals.length === 0) {
                list.innerHTML = `<div style="text-align:center; padding:32px 0; color:var(--muted); font-size:13px;">No goals set.<br>Click + to add a life goal.</div>`;
                return;
            }
            list.innerHTML = S.longTermGoals.map(g => {
                const pct = Math.min(Math.round((g.current / g.target) * 100), 100);
                const isComplete = pct >= 100;
                const badgeBg = isComplete ? `${g.color}33` : `${g.color}20`;
                const badgeTxt = isComplete ? `${g.color}` : `${g.color}`;
                return `
                <div class="ltg-card" onclick="editGoal(${g.id})">
                    <div class="ltg-top">
                        <div>
                            <div class="ltg-title">${g.title}</div>
                            <div class="ltg-date">${g.deadline}</div>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <div class="ltg-badge" style="background:${badgeBg}; color:${badgeTxt}; box-shadow:0 0 12px ${badgeBg};">
                                ${pct}% Complete
                            </div>
                            <button onclick="event.stopPropagation(); deleteGoal(${g.id})" style="background:none; border:none; color:var(--muted); font-size:18px; cursor:pointer;" title="Delete Goal">×</button>
                        </div>
                    </div>
                    <div class="ltg-bar-track">
                        <div class="ltg-bar-fill" style="width:${pct}%; background:${g.color}; color:${g.color};"></div>
                    </div>
                </div>`;
            }).join('');
        }

        function renderHeatmaps() {
            const container = document.getElementById('heatmap-container');
            if (!container) return;
            const rId = document.getElementById('heatmap-select').value;
            const rObj = RINGS.find(r => r.id === rId) || RINGS[0];

            const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const DAY_LABEL_TEXTS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
            const NUM_COLS = 52;
            const now = new Date();

            // Step 1: build a flat array of 52*7 dates, oldest first (index 0) → newest last (index 363)
            // col = Math.floor(i / 7), row = i % 7
            // col 0 = oldest week (right side), col 51 = this week (left side)
            // We want Mar (today) on LEFT, so col 0 must be today's week and col 51 the oldest.
            // Build newest-first: index 0 = today, index 363 = ~1yr ago
            const totalDays = NUM_COLS * 7;
            const dates = []; // dates[i] where i = col*7 + row, col 0 = leftmost = today's week
            for (let i = 0; i < totalDays; i++) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                dates.push(d);
            }
            // dates[0] = today (col 0, row 0 = Sunday of this week)
            // dates[i] where col = floor(i/7), row = i%7

            // Step 2: calculate month labels. col 0 is leftmost.
            // For each col, check what month dates[col*7] is in.
            let hitCount = 0;
            let monthLabels = [];
            let lastMonth = -1;
            for (let c = 0; c < NUM_COLS; c++) {
                const d = dates[c * 7];
                const m = d.getMonth();
                if (m !== lastMonth) {
                    monthLabels.push({ label: MONTHS[m], col: c });
                    lastMonth = m;
                }
            }

            // Step 3: build grid cells. CSS grid-auto-flow:column means cells fill top-to-bottom
            // then left-to-right. So we emit all 7 rows of col 0, then col 1, etc.
            // col 0 = leftmost = today's week. col 51 = rightmost = oldest week.
            let gridHtml = '';
            for (let c = 0; c < NUM_COLS; c++) {
                for (let r = 0; r < 7; r++) {
                    const d = dates[c * 7 + r];
                    const iterDate = d.toDateString();
                    let pct = 0, isHit = false;

                    if (iterDate === now.toDateString()) {
                        const curVal = rObj.val(), curGoal = rObj.goal();
                        pct = curGoal > 0 ? Math.min(curVal / curGoal, 1) : (curVal > 0 ? 1 : 0);
                        isHit = pct >= 1;
                    } else if (S.history?.[iterDate]?.[rId]) {
                        const h = S.history[iterDate][rId];
                        isHit = h.met;
                        pct = (h.v !== undefined && h.g !== undefined)
                            ? (h.g > 0 ? Math.min(h.v / h.g, 1) : (h.v > 0 ? 1 : 0))
                            : (isHit ? 1 : 0);
                    }
                    if (isHit) hitCount++;

                    const scale = Math.floor(pct * 100);
                    const bg = pct > 0
                        ? `color-mix(in srgb, ${rObj.color} ${Math.max(20, scale)}%, var(--bg3))`
                        : 'var(--bg3)';
                    const shade = isHit ? `box-shadow:0 0 8px ${rObj.color}80;` : '';
                    gridHtml += `<div class="heat-cell${isHit ? ' active' : ''}" style="background:${bg};${shade}" title="${iterDate} — ${scale}%${isHit ? ' 🔥' : ''}"></div>`;
                }
            }
            // Day label column (col 52 = rightmost)
            for (let r = 0; r < 7; r++) {
                gridHtml += `<div class="heat-day-label-cell">${DAY_LABEL_TEXTS[r]}</div>`;
            }

            // Step 4: month row — flex divs proportional to column spans, + spacer for day-label col
            let monthRowHtml = '';
            for (let i = 0; i < monthLabels.length; i++) {
                const span = ((i + 1 < monthLabels.length) ? monthLabels[i + 1].col : NUM_COLS) - monthLabels[i].col;
                monthRowHtml += `<div class="heat-month-label" style="flex:${span} 0 0;min-width:0">${monthLabels[i].label}</div>`;
            }
            monthRowHtml += `<div style="width:32px;flex-shrink:0"></div>`;

            const totalTracked = S.history ? Object.keys(S.history).length + 1 : 1;

            container.innerHTML = `
            <div class="heat-wrap">
                <div class="heat-header">
                    <div class="heat-title" style="color:${rObj.color}">${rObj.label}</div>
                    <div class="heat-stat">🔥 <span style="font-size:12px;font-weight:700;color:var(--text)">${hitCount}</span></div>
                </div>
                <div class="heat-graph-wrap">
                    <div class="heat-body-row">
                        <div class="heat-grid" style="flex:1;grid-template-columns:repeat(52,1fr) 32px">${gridHtml}</div>
                    </div>
                </div>
                <div class="heat-labels">
                    <span>${Math.round(hitCount / Math.max(1, totalTracked) * 100)}% (${hitCount}/${totalTracked})</span>
                    <span style="display:flex;align-items:center;gap:4px">Less <div class="heat-cell" style="width:10px;height:10px;background:var(--bg3)"></div><div class="heat-cell" style="width:10px;height:10px;background:${rObj.color};box-shadow:0 0 6px ${rObj.color}80"></div> More</span>
                </div>
            </div>`;
        }

        function renderCalendar() {
            const rId = document.getElementById('cal-ring-select').value;
            const rObj = RINGS.find(r => r.id === rId) || RINGS[0];
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            document.getElementById('cal-month-label').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let html = '';
            for (let i = 0; i < firstDay; i++) { html += `<div class="cal-cell cal-cell-empty"></div>`; }

            const todayStr = now.toDateString();

            for (let d = 1; d <= daysInMonth; d++) {
                const iterDate = new Date(year, month, d).toDateString();
                const dObj = new Date(year, month, d);
                // Prevent predicting future days unless it's today
                if (dObj > now && dObj.toDateString() !== todayStr) {
                    html += `<div class="cal-cell" style="opacity:0.3;">${d}</div>`;
                    continue;
                }

                const isToday = iterDate === todayStr;
                const isSelected = iterDate === activeCalDay;

                let glow = false;
                let ccolor = rObj.color;

                if (isToday) {
                    glow = rObj.val() >= rObj.goal();
                } else if (S.history && S.history[iterDate] && S.history[iterDate][rId]) {
                    glow = S.history[iterDate][rId].met;
                    ccolor = S.history[iterDate][rId].c || ccolor;
                }

                let sty = `style="color:${ccolor}; ${isSelected ? 'background:rgba(255,255,255,0.1); border-color:#fff;' : ''}"`;
                let cls = `cal-cell ${isToday ? 'today' : ''} ${glow ? 'active' : ''}`;

                html += `<div class="${cls}" ${sty} onclick="selectCalDay('${iterDate}')">${d}</div>`;
            }
            document.getElementById('cal-grid-body').innerHTML = html;
        }

        function selectCalDay(dateStr) {
            activeCalDay = dateStr;
            renderCalendar();

            const isToday = dateStr === new Date().toDateString();
            let sumHtml = `<div style="font-size:14px; font-weight:700; color:var(--text); margin-bottom:12px;">${new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>`;

            if (isToday) {
                sumHtml += `<div style="color:var(--purple); font-size:18px; font-weight:800; margin-bottom:16px;">Currently living it! Earned ${S.xpToday.toLocaleString()} XP</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:left; padding:0 20px;">`;
                RINGS.forEach(r => {
                    sumHtml += `<div style="font-size:12px; background:var(--bg3); padding:8px 12px; border-radius:8px; border:1px solid var(--border); overflow:hidden; white-space:nowrap; text-overflow:ellipsis;"><span style="color:${r.color}; margin-right:6px; font-size:14px;">●</span><span style="color:var(--text); font-weight:600;">${r.val()}</span> / ${r.goal()} <span style="color:var(--muted); font-size:10px; margin-left:4px;">${r.label}</span></div>`;
                });
                sumHtml += `</div>`;
            } else if (S.history && S.history[dateStr]) {
                const snap = S.history[dateStr];
                const xp = snap.xp ? snap.xp.v : 0;
                sumHtml += `<div style="color:var(--purple); font-size:18px; font-weight:800; margin-bottom:16px;">Earned ${xp.toLocaleString()} XP</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:left; padding:0 20px;">`;
                for (const k in snap) {
                    if (k === 'xp') continue;
                    const c = snap[k];
                    const label = (RINGS.find(r => r.id === k) || { label: k }).label;
                    sumHtml += `<div style="font-size:12px; background:var(--bg3); padding:8px 12px; border-radius:8px; border:1px solid var(--border); overflow:hidden; white-space:nowrap; text-overflow:ellipsis;"><span style="color:${c.c}; margin-right:6px; font-size:14px;">●</span><span style="color:var(--text); font-weight:600;">${c.v}</span> / ${c.g} <span style="color:var(--muted); font-size:10px; margin-left:4px;">${label}</span></div>`;
                }
                sumHtml += `</div>`;
            } else {
                sumHtml += `No historical data for this date.`;
            }
            document.getElementById('cal-day-summary').innerHTML = sumHtml;
            loadJournal(dateStr);
        }

        function saveJournal() {
            if (!S.journal) S.journal = {};
            S.journal[activeCalDay] = {
                work: document.getElementById('j-work').value,
                rel: document.getElementById('j-rel').value,
                goals: document.getElementById('j-goals').value
            };
            save();
            const btn = document.querySelector('.j-btn');
            const old = btn.textContent;
            btn.textContent = 'Saved!';
            btn.style.background = 'var(--green)';
            setTimeout(() => { btn.textContent = old; btn.style.background = ''; }, 2000);
        }

        function loadJournal(dateStr) {
            document.getElementById('journal-date-label').textContent = dateStr === new Date().toDateString() ? 'Today' : new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const j = (S.journal || {})[dateStr] || { work: '', rel: '', goals: '' };
            document.getElementById('j-work').value = j.work;
            document.getElementById('j-rel').value = j.rel;
            document.getElementById('j-goals').value = j.goals;
        }

        function addScheduleBlock() {
            const time = document.getElementById('tl-time-input').value;
            const title = document.getElementById('tl-title-input').value.trim();
            if (!time || !title) return;
            if (!S.schedule) S.schedule = [];
            S.schedule.push({ id: Date.now(), time, title });
            S.schedule.sort((a, b) => a.time.localeCompare(b.time));
            document.getElementById('tl-title-input').value = '';
            save(); renderTracking();
        }

        function delScheduleBlock(id) {
            S.schedule = S.schedule.filter(s => s.id !== id);
            save(); renderTracking();
        }

        // Initialize active day summary on load
        setTimeout(() => selectCalDay(activeCalDay), 100);

        // 3D Coin Flip Logic
        document.addEventListener('click', e => {
            const badge = e.target.closest('.rank-badge') || e.target.closest('.trophy-card.unlocked');
            if (badge) {
                const iconContainer = badge.querySelector('.rank-badge-icon') || badge.querySelector('.trophy-badge');
                if (iconContainer && !iconContainer.classList.contains('coin-flip-anim')) {
                    iconContainer.classList.add('coin-flip-anim');
                    iconContainer.style.transformStyle = 'preserve-3d'; 
                    setTimeout(() => iconContainer.classList.remove('coin-flip-anim'), 850);
                }
            }
            
            if (e.target.closest('#ovr-badge-icon')) {
                const iconContainer = document.getElementById('ovr-badge-icon');
                if (iconContainer && !iconContainer.classList.contains('coin-flip-anim')) {
                    iconContainer.classList.add('coin-flip-anim');
                    iconContainer.style.transformStyle = 'preserve-3d';
                    setTimeout(() => iconContainer.classList.remove('coin-flip-anim'), 850);
                }
            }
        });

        renderAll();