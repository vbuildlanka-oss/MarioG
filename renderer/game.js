/**
 * MarioG - a small side-scrolling platformer on HTML5 Canvas.
 *
 * Vanilla JS, no libraries. Exposes a global `MarioGame` object with
 * start()/stop() and callback hooks so app.js can wire up the HUD and
 * score saving.
 */
(function () {
  'use strict';

  // ---- Tunable constants --------------------------------------------------
  const GRAVITY = 0.6;
  const MOVE_SPEED = 3.4;
  const JUMP_VELOCITY = -12.5;
  const TILE = 40;
  const VIEW_W = 800;
  const VIEW_H = 400;

  // ---- Level definitions --------------------------------------------------
  // Each level is described by rows of characters:
  //   'X' ground/brick, '?' coin block, '=' floating platform,
  //   'C' coin, 'E' enemy (goomba), 'P' player start, 'F' flag/goal.
  // Everything else is empty air.
  const LEVELS = [
    [
      '                                                                        ',
      '                                                                        ',
      '                                                                       F',
      '                        ?         C C C                                F',
      '                                          =====                        F',
      '            C C                                        C  C            F',
      '                     ===            ?                =====             F',
      '   P            E              C C           E              E          F',
      'XXXXXXXX   XXXXXXXXXXXX   XXXXXXXXXXXX   XXXXXXXXX   XXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXX   XXXXXXXXXXXX   XXXXXXXXXXXX   XXXXXXXXX   XXXXXXXXXXXXXXXXXXXX',
    ],
    [
      '                                                                            ',
      '                        C C C                                              F',
      '            ?                       ?           C C C                      F',
      '                    ====                                  ====             F',
      '       C C                     E E            ?                            F',
      '     =====        C                     =========            E   E         F',
      '              E              C  C                                          F',
      '  P      E            ===              E        C C          ===           F',
      'XXXXXX     XXXXXXXX      XXXXXXXX   XXXXXXXXXX      XXXXXXX      XXXXXXXXXXXXX',
      'XXXXXX     XXXXXXXX      XXXXXXXX   XXXXXXXXXX      XXXXXXX      XXXXXXXXXXXXX',
    ],
    [
      '                                                                                ',
      '     C C C            ?             C C C            E E E                       F',
      '                  =======                       ==========                      F',
      '          E                   C C C                              ?              F',
      '     ===              ?                    ===          C C C                   F',
      '            C C C                 E E            ?                 ====          F',
      '   P    E          ====      E            ===         E E E              E       F',
      '  XXXX     XXXXX       XXXXX      XXXX        XXXXXX        XXXXX      XXXXXXXXXXXXX',
      'XXXXXX     XXXXX       XXXXX      XXXX        XXXXXX        XXXXX      XXXXXXXXXXXXX',
      'XXXXXX     XXXXX       XXXXX      XXXX        XXXXXX        XXXXX      XXXXXXXXXXXXX',
    ],
  ];

  // ---- Module state -------------------------------------------------------
  let canvas, ctx;
  let keys = {};
  let rafId = null;
  let running = false;

  let state = null; // full game state, see resetGame()

  let hooks = {
    onUpdate: function () {}, // called with {score, coins, lives, level}
    onGameOver: function () {}, // called with {score, coins, level, won}
  };

  // ---- Level parsing ------------------------------------------------------
  function buildLevel(index) {
    const rows = LEVELS[index % LEVELS.length];
    const solids = [];
    const coins = [];
    const enemies = [];
    let start = { x: 60, y: 60 };
    let flag = null;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        const x = c * TILE;
        const y = r * TILE;
        switch (ch) {
          case 'X':
          case '=':
          case '?':
            solids.push({ x, y, w: TILE, h: TILE, type: ch === '?' ? 'coinblock' : 'block', used: false });
            if (ch === '?') {
              // a coin block also awards a coin when hit from below (handled in physics)
            }
            break;
          case 'C':
            coins.push({ x: x + TILE / 2, y: y + TILE / 2, r: 9, taken: false });
            break;
          case 'E':
            enemies.push({ x, y: y + TILE - 30, w: 30, h: 30, vx: -1.1, alive: true });
            break;
          case 'P':
            start = { x, y };
            break;
          case 'F':
            if (!flag) flag = { x: x, y: 0, w: 12, h: rows.length * TILE };
            break;
        }
      }
    }

    const worldWidth = (rows[0] ? rows[0].length : 20) * TILE;
    return { solids, coins, enemies, start, flag, worldWidth };
  }

  function resetGame() {
    const level = buildLevel(0);
    state = {
      levelIndex: 0,
      level,
      player: {
        x: level.start.x,
        y: level.start.y,
        w: 28,
        h: 36,
        vx: 0,
        vy: 0,
        onGround: false,
        facing: 1,
        invuln: 0,
      },
      camera: 0,
      score: 0,
      coins: 0,
      lives: 3,
      finished: false,
    };
  }

  function loadNextLevel() {
    state.levelIndex += 1;
    if (state.levelIndex >= LEVELS.length) {
      // Beat the whole game.
      endGame(true);
      return;
    }
    const level = buildLevel(state.levelIndex);
    state.level = level;
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.camera = 0;
    state.score += 500; // level clear bonus
    emitUpdate();
  }

  // ---- Collision helpers --------------------------------------------------
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  // ---- Physics & game logic ----------------------------------------------
  function update() {
    const p = state.player;
    const lvl = state.level;

    // Horizontal input
    p.vx = 0;
    if (keys.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
    if (keys.right) { p.vx = MOVE_SPEED; p.facing = 1; }

    // Jump
    if (keys.jump && p.onGround) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
    }

    // Gravity
    p.vy += GRAVITY;
    if (p.vy > 16) p.vy = 16;

    // --- Move X and resolve ---
    p.x += p.vx;
    if (p.x < 0) p.x = 0;
    for (const s of lvl.solids) {
      if (rectsOverlap(p, s)) {
        if (p.vx > 0) p.x = s.x - p.w;
        else if (p.vx < 0) p.x = s.x + s.w;
      }
    }

    // --- Move Y and resolve ---
    p.y += p.vy;
    p.onGround = false;
    for (const s of lvl.solids) {
      if (rectsOverlap(p, s)) {
        if (p.vy > 0) {
          // landing on top
          p.y = s.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          // bonking head
          p.y = s.y + s.h;
          p.vy = 0;
          // coin block payout
          if (s.type === 'coinblock' && !s.used) {
            s.used = true;
            state.coins += 1;
            state.score += 200;
            emitUpdate();
          }
        }
      }
    }

    if (p.invuln > 0) p.invuln--;

    // --- Coins ---
    for (const coin of lvl.coins) {
      if (coin.taken) continue;
      const cbox = { x: coin.x - coin.r, y: coin.y - coin.r, w: coin.r * 2, h: coin.r * 2 };
      if (rectsOverlap(p, cbox)) {
        coin.taken = true;
        state.coins += 1;
        state.score += 100;
        emitUpdate();
      }
    }

    // --- Enemies ---
    for (const e of lvl.enemies) {
      if (!e.alive) continue;
      e.x += e.vx;
      // patrol: flip at edges of solids or when hitting a wall
      let onSolid = false;
      for (const s of lvl.solids) {
        // wall check
        if (rectsOverlap({ x: e.x, y: e.y, w: e.w, h: e.h }, s)) {
          if (e.vx > 0) e.x = s.x - e.w;
          else e.x = s.x + s.w;
          e.vx *= -1;
        }
        // ground-ahead check
        const probe = { x: e.x + (e.vx > 0 ? e.w + 2 : -2), y: e.y + e.h + 2, w: 2, h: 4 };
        if (rectsOverlap(probe, s)) onSolid = true;
      }
      if (!onSolid) e.vx *= -1; // turn around at ledges

      // collision with player
      if (rectsOverlap(p, e)) {
        const stomping = p.vy > 0 && p.y + p.h - e.y < 18;
        if (stomping) {
          e.alive = false;
          p.vy = JUMP_VELOCITY * 0.6; // bounce
          state.score += 300;
          emitUpdate();
        } else if (p.invuln === 0) {
          hurtPlayer();
        }
      }
    }

    // --- Fall into pit ---
    if (p.y > VIEW_H + 200) {
      hurtPlayer(true);
    }

    // --- Reach flag / goal ---
    if (lvl.flag && p.x + p.w >= lvl.flag.x) {
      loadNextLevel();
      return;
    }

    // --- Camera follows player ---
    const target = p.x - VIEW_W / 2 + p.w / 2;
    state.camera = Math.max(0, Math.min(target, lvl.worldWidth - VIEW_W));
  }

  function hurtPlayer(fell) {
    const p = state.player;
    state.lives -= 1;
    emitUpdate();
    if (state.lives <= 0) {
      endGame(false);
      return;
    }
    // respawn at level start
    p.x = state.level.start.x;
    p.y = state.level.start.y;
    p.vx = 0;
    p.vy = 0;
    p.invuln = fell ? 40 : 80;
  }

  function endGame(won) {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    state.finished = true;
    hooks.onGameOver({
      score: state.score,
      coins: state.coins,
      level: state.levelIndex + 1,
      won: won,
    });
  }

  function emitUpdate() {
    hooks.onUpdate({
      score: state.score,
      coins: state.coins,
      lives: state.lives,
      level: state.levelIndex + 1,
    });
  }

  // ---- Rendering ----------------------------------------------------------
  function draw() {
    const cam = state.camera;
    const lvl = state.level;

    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#5c94fc');
    g.addColorStop(1, '#8fc0ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Parallax clouds
    drawClouds(cam);
    // Distant hills
    drawHills(cam);

    ctx.save();
    ctx.translate(-cam, 0);

    // Solids
    for (const s of lvl.solids) {
      if (s.x + s.w < cam || s.x > cam + VIEW_W) continue;
      if (s.type === 'coinblock') {
        drawCoinBlock(s);
      } else {
        drawBlock(s);
      }
    }

    // Flag
    if (lvl.flag) drawFlag(lvl.flag);

    // Coins
    for (const coin of lvl.coins) {
      if (coin.taken) continue;
      drawCoin(coin);
    }

    // Enemies
    for (const e of lvl.enemies) {
      if (!e.alive) continue;
      drawGoomba(e);
    }

    // Player
    drawPlayer(state.player);

    ctx.restore();
  }

  function drawBlock(s) {
    const isGround = s.type === 'block';
    ctx.fillStyle = '#c84c0c';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#e06a1c';
    ctx.fillRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
    // brick lines
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + s.h / 2);
    ctx.lineTo(s.x + s.w, s.y + s.h / 2);
    ctx.stroke();
  }

  function drawCoinBlock(s) {
    if (s.used) {
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#6b451f';
      ctx.fillRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8);
      return;
    }
    ctx.fillStyle = '#f2a900';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#ffcf33';
    ctx.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
    ctx.fillStyle = '#7a4b00';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', s.x + s.w / 2, s.y + s.h / 2 + 9);
    ctx.textAlign = 'left';
  }

  function drawCoin(coin) {
    const t = Date.now() / 150;
    const squish = Math.abs(Math.cos(t)); // fake spin
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.scale(squish * 0.6 + 0.4, 1);
    ctx.beginPath();
    ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fbd000';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c79100';
    ctx.stroke();
    ctx.restore();
  }

  function drawGoomba(e) {
    // body
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(e.x, e.y + 8, e.w, e.h - 8);
    ctx.beginPath();
    ctx.arc(e.x + e.w / 2, e.y + 10, e.w / 2, Math.PI, 0);
    ctx.fill();
    // feet
    ctx.fillStyle = '#3a1d0a';
    ctx.fillRect(e.x + 1, e.y + e.h - 5, 10, 5);
    ctx.fillRect(e.x + e.w - 11, e.y + e.h - 5, 10, 5);
    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x + 6, e.y + 10, 6, 8);
    ctx.fillRect(e.x + e.w - 12, e.y + 10, 6, 8);
    ctx.fillStyle = '#000';
    ctx.fillRect(e.x + 8, e.y + 12, 3, 5);
    ctx.fillRect(e.x + e.w - 10, e.y + 12, 3, 5);
  }

  function drawFlag(f) {
    ctx.fillStyle = '#2e8b57';
    ctx.fillRect(f.x, 0, 6, f.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(f.x - 40, 30, 40, 26);
    ctx.fillStyle = '#e60012';
    ctx.beginPath();
    ctx.arc(f.x - 20, 43, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(p) {
    // Flicker while invulnerable
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) return;

    const x = p.x, y = p.y, w = p.w, h = p.h;
    // overalls / body (blue)
    ctx.fillStyle = '#1560bd';
    ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
    // shirt (red)
    ctx.fillStyle = '#e52521';
    ctx.fillRect(x, y + h * 0.28, w, h * 0.2);
    // arms
    ctx.fillRect(x - 3, y + h * 0.32, 4, h * 0.2);
    ctx.fillRect(x + w - 1, y + h * 0.32, 4, h * 0.2);
    // face
    ctx.fillStyle = '#ffcc99';
    ctx.fillRect(x + 3, y + h * 0.1, w - 6, h * 0.22);
    // cap
    ctx.fillStyle = '#e52521';
    ctx.fillRect(x + 1, y, w - 2, h * 0.14);
    ctx.fillRect(x + (p.facing > 0 ? w - 6 : -4), y + h * 0.06, 10, h * 0.08);
    // eye
    ctx.fillStyle = '#000';
    ctx.fillRect(x + (p.facing > 0 ? w - 10 : 6), y + h * 0.16, 3, 4);
    // shoes
    ctx.fillStyle = '#5a3210';
    ctx.fillRect(x - 1, y + h - 5, w / 2, 5);
    ctx.fillRect(x + w / 2 + 1, y + h - 5, w / 2, 5);
  }

  function drawClouds(cam) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const positions = [120, 380, 640, 900, 1180, 1500];
    for (const base of positions) {
      const cx = base - (cam * 0.3) % 1600;
      const x = ((cx % 1600) + 1600) % 1600 - 100;
      cloudPuff(x, 60);
    }
  }
  function cloudPuff(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.arc(x + 20, y + 4, 22, 0, Math.PI * 2);
    ctx.arc(x + 46, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHills(cam) {
    ctx.fillStyle = '#43b047';
    const positions = [0, 500, 1000, 1500];
    for (const base of positions) {
      const x = base - (cam * 0.5) % 2000;
      const hx = ((x % 2000) + 2000) % 2000 - 200;
      ctx.beginPath();
      ctx.arc(hx, VIEW_H, 90, Math.PI, 0);
      ctx.fill();
    }
  }

  // ---- Main loop ----------------------------------------------------------
  function loop() {
    if (!running) return;
    update();
    if (!running) return; // update() may have ended the game
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ---- Input --------------------------------------------------------------
  function onKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': keys.left = true; break;
      case 'ArrowRight': case 'KeyD': keys.right = true; break;
      case 'ArrowUp': case 'KeyW': case 'Space': keys.jump = true; e.preventDefault(); break;
    }
  }
  function onKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': keys.left = false; break;
      case 'ArrowRight': case 'KeyD': keys.right = false; break;
      case 'ArrowUp': case 'KeyW': case 'Space': keys.jump = false; break;
    }
  }

  // ---- Public API ---------------------------------------------------------
  const MarioGame = {
    init: function (canvasEl, callbacks) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      hooks = Object.assign(hooks, callbacks || {});
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    },
    start: function () {
      keys = {};
      resetGame();
      emitUpdate();
      running = true;
      if (rafId) cancelAnimationFrame(rafId);
      loop();
    },
    stop: function () {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
    isRunning: function () { return running; },
  };

  window.MarioGame = MarioGame;
})();
