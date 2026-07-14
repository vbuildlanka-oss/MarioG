/**
 * Storage layer for MarioG.
 *
 * Uses a plain JSON file on disk (./data/mario.json) so the app needs
 * ZERO local setup: no database server, no native modules to compile,
 * no build tools. Just `npm install` (pure-JS deps) and `node server.js`.
 *
 * Writes are performed atomically (write to a temp file, then rename) to
 * avoid corrupting the data file if the process is interrupted mid-write.
 */
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'mario.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// --- In-memory state, loaded from disk on startup ------------------------
let state = { users: [], scores: [], nextUserId: 1, nextScoreId: 1 };

function load() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
        nextUserId: parsed.nextUserId || 1,
        nextScoreId: parsed.nextScoreId || 1,
      };
    }
  } catch (err) {
    console.error('Failed to read data file, starting fresh:', err.message);
  }
}

let saveTimer = null;
function persist() {
  // Debounce rapid writes into a single disk flush.
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 50);
}

function flush() {
  saveTimer = null;
  const tmp = dataFile + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, dataFile);
  } catch (err) {
    console.error('Failed to write data file:', err.message);
  }
}

load();
// Make sure any pending write is flushed on shutdown.
process.on('exit', () => saveTimer && flush());

// --- User operations ------------------------------------------------------
function createUser(username, passwordHash) {
  const user = {
    id: state.nextUserId++,
    username,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };
  state.users.push(user);
  persist();
  return { id: user.id, username: user.username };
}

function getUserByName(username) {
  const lower = String(username).toLowerCase();
  return state.users.find((u) => u.username.toLowerCase() === lower);
}

function getUserById(id) {
  return state.users.find((u) => u.id === Number(id));
}

// --- Score operations -----------------------------------------------------
function addScore(userId, score, coins, level) {
  const entry = {
    id: state.nextScoreId++,
    user_id: Number(userId),
    score: Number(score),
    coins: Number(coins) || 0,
    level: Number(level) || 1,
    created_at: new Date().toISOString(),
  };
  state.scores.push(entry);
  persist();
  return entry.id;
}

function getBestScoreForUser(userId) {
  const uid = Number(userId);
  let best = 0;
  for (const s of state.scores) {
    if (s.user_id === uid && s.score > best) best = s.score;
  }
  return best;
}

function getLeaderboard(limit = 10) {
  // Reduce to each user's best run.
  const bestByUser = new Map();
  for (const s of state.scores) {
    const cur = bestByUser.get(s.user_id);
    if (!cur || s.score > cur.score) {
      bestByUser.set(s.user_id, s);
    }
  }

  const rows = [];
  for (const [userId, s] of bestByUser) {
    const user = getUserById(userId);
    if (!user) continue;
    rows.push({
      username: user.username,
      score: s.score,
      coins: s.coins,
      level: s.level,
    });
  }

  rows.sort((a, b) => b.score - a.score || b.level - a.level);
  return rows.slice(0, limit);
}

function getUserScores(userId, limit = 5) {
  const uid = Number(userId);
  return state.scores
    .filter((s) => s.user_id === uid)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .map((s) => ({
      score: s.score,
      coins: s.coins,
      level: s.level,
      created_at: s.created_at,
    }));
}

module.exports = {
  createUser,
  getUserByName,
  getUserById,
  addScore,
  getBestScoreForUser,
  getLeaderboard,
  getUserScores,
};
