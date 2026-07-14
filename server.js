/**
 * MarioG server.
 * Serves the static game client and exposes a small JSON API for
 * authentication (register / login) and score persistence.
 *
 * Everything here relies only on free, open-source packages.
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// A JWT secret. In production set JWT_SECRET; otherwise we generate a
// random one per process start (sessions reset on restart, which is fine
// for a hobby game).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers --------------------------------------------------------------
function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE_MS,
  });
}

// Middleware that requires a valid auth token (from cookie or Bearer header).
function requireAuth(req, res, next) {
  const bearer = req.headers.authorization;
  const token =
    (req.cookies && req.cookies.token) ||
    (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null);

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function validateCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return 'Username and password are required.';
  }
  const u = username.trim();
  if (u.length < 3 || u.length > 20) {
    return 'Username must be 3-20 characters.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return 'Username may only contain letters, numbers, and underscores.';
  }
  if (password.length < 6 || password.length > 100) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

// --- Auth routes ----------------------------------------------------------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  const validationError = validateCredentials(username, password);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const cleanName = username.trim();
  if (db.getUserByName(cleanName)) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const user = db.createUser(cleanName, hash);
  const token = signToken(user);
  setAuthCookie(res, token);

  res.status(201).json({
    user: { id: user.id, username: user.username },
    token,
    bestScore: 0,
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.getUserByName(String(username).trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);

  res.json({
    user: { id: user.id, username: user.username },
    token,
    bestScore: db.getBestScoreForUser(user.id),
  });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Returns the current user if the session cookie/token is valid.
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }
  res.json({
    user: { id: user.id, username: user.username },
    bestScore: db.getBestScoreForUser(user.id),
    recent: db.getUserScores(user.id, 5),
  });
});

// --- Score routes ---------------------------------------------------------
app.post('/api/scores', requireAuth, (req, res) => {
  let { score, coins, level } = req.body || {};

  score = Number(score);
  coins = Number(coins) || 0;
  level = Number(level) || 1;

  if (!Number.isFinite(score) || score < 0 || score > 10_000_000) {
    return res.status(400).json({ error: 'Invalid score value.' });
  }

  db.addScore(req.user.id, Math.floor(score), Math.floor(coins), Math.floor(level));
  const best = db.getBestScoreForUser(req.user.id);

  res.status(201).json({
    saved: true,
    bestScore: best,
    isNewBest: Math.floor(score) >= best,
  });
});

// Public leaderboard (top scores across all players).
app.get('/api/leaderboard', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json({ leaderboard: db.getLeaderboard(limit) });
});

// Fallback: serve the game for any unmatched GET route.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🍄 MarioG running at http://localhost:${PORT}`);
});
