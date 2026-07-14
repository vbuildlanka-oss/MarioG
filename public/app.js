/**
 * MarioG client app logic.
 * Handles authentication UI, session restoration, HUD updates,
 * leaderboard rendering, and submitting scores to the backend.
 */
(function () {
  'use strict';

  // ---- Element refs -------------------------------------------------------
  const authScreen = document.getElementById('auth-screen');
  const gameScreen = document.getElementById('game-screen');

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const authForm = document.getElementById('auth-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const authError = document.getElementById('auth-error');
  const authSubmit = document.getElementById('auth-submit');
  const authHint = document.getElementById('auth-hint');
  const switchToRegister = document.getElementById('switch-to-register');

  const hudUser = document.getElementById('hud-user');
  const hudScore = document.getElementById('hud-score');
  const hudCoins = document.getElementById('hud-coins');
  const hudLives = document.getElementById('hud-lives');
  const hudLevel = document.getElementById('hud-level');
  const hudBest = document.getElementById('hud-best');

  const logoutBtn = document.getElementById('logout-btn');
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');
  const saveStatus = document.getElementById('save-status');
  const leaderboardList = document.getElementById('leaderboard-list');

  // ---- App state ----------------------------------------------------------
  let mode = 'login'; // 'login' | 'register'
  let currentUser = null;
  let bestScore = 0;

  // ---- API helper ---------------------------------------------------------
  async function api(path, options) {
    const res = await fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    }, options));
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const msg = (data && data.error) || ('Request failed (' + res.status + ')');
      throw new Error(msg);
    }
    return data;
  }

  // ---- Auth UI ------------------------------------------------------------
  function setMode(newMode) {
    mode = newMode;
    authError.textContent = '';
    if (mode === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      authSubmit.textContent = 'Login';
      authHint.innerHTML = 'New here? <a href="#" id="switch-to-register">Create an account</a>';
    } else {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      authSubmit.textContent = 'Sign Up & Play';
      authHint.innerHTML = 'Already have an account? <a href="#" id="switch-to-register">Login instead</a>';
    }
    // rebind the (recreated) hint link
    document.getElementById('switch-to-register').addEventListener('click', function (e) {
      e.preventDefault();
      setMode(mode === 'login' ? 'register' : 'login');
    });
  }

  tabLogin.addEventListener('click', function () { setMode('login'); });
  tabRegister.addEventListener('click', function () { setMode('register'); });
  switchToRegister.addEventListener('click', function (e) {
    e.preventDefault();
    setMode('register');
  });

  authForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    authError.textContent = '';
    authSubmit.disabled = true;
    const prevLabel = authSubmit.textContent;
    authSubmit.textContent = 'Please wait…';

    const payload = {
      username: usernameInput.value.trim(),
      password: passwordInput.value,
    };

    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onLoggedIn(data.user, data.bestScore || 0);
    } catch (err) {
      authError.textContent = err.message;
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = prevLabel;
    }
  });

  logoutBtn.addEventListener('click', async function () {
    MarioGame.stop();
    try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    currentUser = null;
    bestScore = 0;
    passwordInput.value = '';
    showScreen('auth');
  });

  // ---- Screen switching ---------------------------------------------------
  function showScreen(name) {
    if (name === 'game') {
      authScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
    } else {
      gameScreen.classList.add('hidden');
      authScreen.classList.remove('hidden');
    }
  }

  function onLoggedIn(user, best) {
    currentUser = user;
    bestScore = best || 0;
    hudUser.textContent = user.username;
    hudBest.textContent = bestScore;
    showScreen('game');
    resetHud();
    showOverlay('Ready, ' + user.username + '?', 'Reach the flag 🏁 without running out of lives!', 'Start Game');
    loadLeaderboard();
  }

  // ---- HUD ----------------------------------------------------------------
  function resetHud() {
    hudScore.textContent = '0';
    hudCoins.textContent = '0';
    hudLives.textContent = '3';
    hudLevel.textContent = '1';
  }

  function updateHud(s) {
    hudScore.textContent = s.score;
    hudCoins.textContent = s.coins;
    hudLives.textContent = s.lives;
    hudLevel.textContent = s.level;
  }

  // ---- Overlay ------------------------------------------------------------
  function showOverlay(title, text, btnLabel) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startBtn.textContent = btnLabel || 'Start Game';
    overlay.classList.remove('hidden');
  }
  function hideOverlay() {
    overlay.classList.add('hidden');
    saveStatus.textContent = '';
  }

  startBtn.addEventListener('click', function () {
    hideOverlay();
    MarioGame.start();
  });

  // ---- Game over & score saving ------------------------------------------
  async function onGameOver(result) {
    const title = result.won ? '🎉 You Win!' : '💀 Game Over';
    const summary = 'Final score: ' + result.score +
      '  •  🪙 ' + result.coins +
      '  •  Level ' + result.level;
    showOverlay(title, summary, 'Play Again');
    saveStatus.textContent = 'Saving score…';

    try {
      const data = await api('/api/scores', {
        method: 'POST',
        body: JSON.stringify({
          score: result.score,
          coins: result.coins,
          level: result.level,
        }),
      });
      bestScore = data.bestScore;
      hudBest.textContent = bestScore;
      saveStatus.textContent = data.isNewBest
        ? '🏆 New personal best! Score saved.'
        : '✅ Score saved. Your best: ' + bestScore;
      loadLeaderboard();
    } catch (err) {
      saveStatus.textContent = '⚠️ Could not save score: ' + err.message;
    }
  }

  // ---- Leaderboard --------------------------------------------------------
  async function loadLeaderboard() {
    try {
      const data = await api('/api/leaderboard?limit=10', { method: 'GET' });
      renderLeaderboard(data.leaderboard || []);
    } catch (err) {
      leaderboardList.innerHTML = '<li class="lb-empty">Leaderboard unavailable</li>';
    }
  }

  function renderLeaderboard(rows) {
    if (!rows.length) {
      leaderboardList.innerHTML = '<li class="lb-empty">No scores yet — be the first!</li>';
      return;
    }
    leaderboardList.innerHTML = '';
    rows.forEach(function (row) {
      const li = document.createElement('li');
      if (currentUser && row.username === currentUser.username) {
        li.classList.add('lb-me');
      }
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = row.username;
      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = row.score + ' pts';
      li.appendChild(name);
      li.appendChild(score);
      leaderboardList.appendChild(li);
    });
  }

  // ---- Boot ---------------------------------------------------------------
  MarioGame.init(canvas, {
    onUpdate: updateHud,
    onGameOver: onGameOver,
  });

  // Try to restore an existing session (cookie-based).
  (async function restoreSession() {
    try {
      const data = await api('/api/me', { method: 'GET' });
      onLoggedIn(data.user, data.bestScore || 0);
    } catch (e) {
      showScreen('auth');
    }
  })();
})();
