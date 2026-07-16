/**
 * MarioG Desktop - Standalone app logic.
 * No server required. Scores stored locally in localStorage.
 * 
 * VBUILD(TM)
 */
(function () {
  'use strict';

  // ---- Element refs -------------------------------------------------------
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');
  const gameStatus = document.getElementById('game-status');

  const hudScore = document.getElementById('hud-score');
  const hudCoins = document.getElementById('hud-coins');
  const hudLives = document.getElementById('hud-lives');
  const hudLevel = document.getElementById('hud-level');
  const hudBest = document.getElementById('hud-best');

  // ---- Local score persistence --------------------------------------------
  let bestScore = parseInt(localStorage.getItem('mariog_best') || '0', 10);
  hudBest.textContent = bestScore;

  function saveBest(score) {
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('mariog_best', String(bestScore));
      hudBest.textContent = bestScore;
      return true;
    }
    return false;
  }

  // ---- HUD ----------------------------------------------------------------
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
    gameStatus.textContent = '';
  }

  startBtn.addEventListener('click', function () {
    hideOverlay();
    MarioGame.start();
  });

  // ---- Game over handler --------------------------------------------------
  function onGameOver(result) {
    const title = result.won ? '🎉 You Win!' : '💀 Game Over';
    const summary = 'Final score: ' + result.score +
      '  •  🪙 ' + result.coins +
      '  •  Level ' + result.level;
    showOverlay(title, summary, 'Play Again');

    const isNew = saveBest(result.score);
    gameStatus.textContent = isNew
      ? '🏆 New personal best!'
      : 'Your best: ' + bestScore;
  }

  // ---- Init game engine ---------------------------------------------------
  MarioGame.init(canvas, {
    onUpdate: updateHud,
    onGameOver: onGameOver,
  });
})();
