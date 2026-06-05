/* =============================================
   EMELIE FARREL BIBLE STUDY — games.js
   Four Bible-themed mini-games
   ============================================ */

(function () {
  'use strict';

  /* ---------- AUDIO (Web Audio API) ---------- */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, duration, type, volume) {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume || 0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function sfxJump()     { playTone(400, 0.1, 'square', 0.08); }
  function sfxCollect()  { playTone(600, 0.15, 'sine', 0.1);
                           setTimeout(() => playTone(800, 0.1, 'sine', 0.08), 80); }
  function sfxHit()      { playTone(150, 0.2, 'sawtooth', 0.1); }
  function sfxWin()      { playTone(523, 0.15, 'sine', 0.1);
                           setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 150);
                           setTimeout(() => playTone(784, 0.2, 'sine', 0.1), 300); }
  function sfxLose()     { playTone(300, 0.2, 'sawtooth', 0.08);
                           setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.08), 150); }
  function sfxThrow()    { playTone(350, 0.05, 'square', 0.06); }
  function sfxCombo()    { playTone(700, 0.1, 'sine', 0.1);
                           setTimeout(() => playTone(900, 0.1, 'sine', 0.1), 80); }
  function sfxStep()     { playTone(200, 0.03, 'square', 0.03); }

  /* ---------- CANVAS SETUP ---------- */
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  /* ---------- DOM REFS ---------- */
  const menuScreen    = document.getElementById('game-menu-screen');
  const modeScreen    = document.getElementById('game-mode-screen');
  const controlsScreen= document.getElementById('game-controls-screen');
  const canvasScreen  = document.getElementById('game-canvas-screen');
  const gameOverScreen= document.getElementById('game-over-screen');
  const gameTitleDisp = document.getElementById('game-title-display');
  const scoreDisp     = document.getElementById('game-score-display');
  const livesDisp     = document.getElementById('game-lives-display');
  const highScoreDisp = document.getElementById('game-high-score-display');
  const finalScoreVal = document.getElementById('final-score-value');
  const resultTitle   = document.getElementById('game-result-title');
  const resultMsg     = document.getElementById('game-result-message');
  const highScoreMsg  = document.getElementById('game-high-score-msg');
  const scoresDisp    = document.getElementById('scores-display');
  const pauseBtn      = document.getElementById('game-pause-btn');
  const quitBtn       = document.getElementById('game-quit-btn');
  const replayBtn     = document.getElementById('game-replay-btn');
  const menuBtn       = document.getElementById('game-menu-btn');
  const nextBtn       = document.getElementById('game-next-btn');

  /* ---------- STATE ---------- */
  let currentGame = null;
  let isMultiplayer = false;
  let isPaused = false;
  let gameRunning = false;
  let animFrameId = null;
  let keys = {};
  let prevKeys = {};
  let player1Scheme = 'wasd';
  let currentLevel = 1;
  const maxLevel = 10;

  /* ---------- INPUT ---------- */
  document.addEventListener('keydown', e => {
    if (!gameRunning && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    keys[e.key] = true; if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  function wasPressed(key) { return keys[key] && !prevKeys[key]; }

  /* ---------- PARTICLES ---------- */
  let particles = [];
  const MAX_PARTICLES = 60;

  function spawnParticles(x, y, color, count, spread) {
    const n = Math.min(count || 8, MAX_PARTICLES - particles.length);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * 6.2832;
      const speed = 1 + Math.random() * (spread || 3);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        decay: 0.03 + Math.random() * 0.04,
        size: 2 + Math.random() * 4,
        color: color || '#d4a017'
      });
    }
  }

  function spawnScorePopup(x, y, text, color) {
    if (particles.length >= MAX_PARTICLES) return;
    particles.push({
      x, y,
      vx: 0, vy: -2,
      life: 1, decay: 0.025, size: 0,
      color: color || '#d4a017',
      text: text, isText: true
    });
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= p.decay;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
      }
    }
  }

  function renderParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.globalAlpha = p.life;
      if (p.isText) {
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- SCREEN SHAKE ---------- */
  let shakeAmount = 0;
  let isShaking = false;

  function triggerShake(amount) {
    shakeAmount = Math.max(shakeAmount, amount || 4);
  }

  function applyShake() {
    if (shakeAmount > 0) {
      const sx = (Math.random() - 0.5) * shakeAmount;
      const sy = (Math.random() - 0.5) * shakeAmount;
      ctx.save();
      ctx.translate(sx, sy);
      return true;
    }
    return false;
  }

  function endShake() {
    if (shakeAmount > 0) {
      ctx.restore();
      shakeAmount *= 0.85;
      if (shakeAmount < 0.5) shakeAmount = 0;
    }
  }

  /* ---------- HIGH SCORES ---------- */
  function getHighScores() {
    try { return JSON.parse(localStorage.getItem('efbs_highscores')) || {}; } catch(e) { return {}; }
  }
  function saveHighScore(game, score) {
    const scores = getHighScores();
    if (!scores[game] || score > scores[game]) {
      scores[game] = score;
      localStorage.setItem('efbs_highscores', JSON.stringify(scores));
      return true;
    }
    return false;
  }
  function renderHighScores() {
    const scores = getHighScores();
    const names = { 'joshua-spies': 'Joshua\'s Spies', 'catch-grapes': 'Catch the Grapes', 'splat-haman': 'Splat Haman', 'royal-run': 'Royal Run' };
    let html = '';
    const sorted = Object.entries(names).sort((a, b) => (scores[b[0]] || 0) - (scores[a[0]] || 0));
    for (const [key, name] of sorted) {
      html += '<div class="score-row"><span>' + name + '</span><span>' + (scores[key] || 0) + '</span></div>';
    }
    scoresDisp.innerHTML = html || '<p>No scores yet!</p>';
  }

  /* ---------- GAME MANAGER ---------- */
  let player1Character = 'esther';
  const charPickerScreen = document.getElementById('game-char-picker-screen');

  const instructionsScreen = document.getElementById('game-instructions-screen');

  function showScreen(id) {
    [menuScreen, modeScreen, controlsScreen, canvasScreen, gameOverScreen, charPickerScreen, instructionsScreen].forEach(s => { if (s) s.classList.add('hidden'); });
    document.getElementById(id).classList.remove('hidden');
  }

  function setupCharPicker() {
    const pickerTitle = document.querySelector('#game-char-picker-screen h3');
    const btns = document.querySelectorAll('.char-btn');
    if (currentGame === 'royal-run') {
      pickerTitle.textContent = 'Player 1, choose your character';
      btns[0].dataset.char = 'vashti';
      btns[0].textContent = 'Vashti (run and jump)';
      btns[1].dataset.char = 'guard';
      btns[1].textContent = 'Guard (chase Vashti)';
    } else {
      pickerTitle.textContent = 'Player 1, choose your character';
      btns[0].dataset.char = 'esther';
      btns[0].textContent = 'Esther (throw food)';
      btns[1].dataset.char = 'haman';
      btns[1].textContent = 'Haman (run around)';
    }
  }

  // Game picker
  document.querySelectorAll('.game-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentGame = btn.dataset.game;
      currentLevel = 1;
      setupCharPicker();
      document.querySelector('.mode-btn[data-mode="multi"]').style.display = currentGame === 'catch-grapes' ? 'none' : 'inline-block';
      showScreen('game-mode-screen');
    });
  });

  // Instructions data
  const instructions = {
    'joshua-spies': '<p><strong>Goal:</strong> Help the spies reach Rahab\'s house without being caught!</p><p><strong>Controls:</strong> Move with WASD or Arrow Keys. Press W/Up to jump, S/Down to duck. Ducking (low to ground) makes you immune to guards.</p><p><strong>Tips:</strong> Time your movement between patrols. Reach the right side to win!</p>',
    'catch-grapes': '<p><strong>Goal:</strong> Catch falling grapes in your basket. Don\'t let them hit the ground!</p><p><strong>Controls:</strong> Move left/right with A/D or Arrow Keys.</p>',
    'splat-haman': '<p><strong>Goal:</strong> Hit Haman with rotten food 10 times before he hits you 5 times!</p><p><strong>Controls:</strong> Move with WASD or Arrow Keys. Press W/Up to jump, S/Down to duck. Throw food with your scheme\'s throw key: <strong>F</strong> (WASD) or <strong>Space</strong> (Arrow Keys). In 2-player mode, Player 1 uses their chosen scheme\'s throw key and Player 2 gets the opposite.</p>',
    'royal-run': '<p><strong>Goal:</strong> Escape the palace as Queen Vashti! Avoid guards and obstacles.</p><p><strong>Controls:</strong> Move left/right with A/D or Arrow Keys. Jump with W/Up, duck with S/Down. Each hit (obstacle or guard) costs 1 life with temporary invincibility after.</p><p><strong>2-Player:</strong> Player 1 picks a character (Vashti or Guard). Vashti runs and jumps, the Guard chases. Player 2 gets the opposite controls. All 5 guards respond to the Guard player\'s input.</p><p><strong>Tips:</strong> Guards start behind you and activate after the first obstacle. Guards can clip through obstacles. Stay ahead!</p>',
  };

  // Mode select
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === 'back') { showScreen('game-menu-screen'); renderHighScores(); return; }
      if (btn.dataset.mode === 'howtoplay') {
        document.getElementById('instructions-title').textContent = currentGame === 'joshua-spies' ? 'Joshua\'s Spies - How To Play' : 'How To Play';
        document.getElementById('instructions-body').innerHTML = instructions[currentGame] || 'No instructions available.';
        showScreen('game-instructions-screen');
        return;
      }
      isMultiplayer = btn.dataset.mode === 'multi';
      if (!isMultiplayer) {
        // Single player: show scheme picker for all games
        showScreen('game-controls-screen');
        document.getElementById('scheme-picker').classList.remove('hidden');
        document.getElementById('start-controls').classList.add('hidden');
        document.getElementById('controls-heading').textContent = 'Choose Controls';
      } else if (currentGame === 'splat-haman' || currentGame === 'royal-run') {
        showScreen('game-char-picker-screen');
      } else {
        // Two-player for joshua-spies, catch-grapes: show scheme picker
        showScreen('game-controls-screen');
        document.getElementById('scheme-picker').classList.remove('hidden');
        document.getElementById('start-controls').classList.add('hidden');
        document.getElementById('controls-heading').textContent = 'Choose Controls';
      }
    });
  });

  // Instructions back
  document.getElementById('instructions-back').addEventListener('click', () => showScreen('game-mode-screen'));

  // Character picker
  document.querySelectorAll('.char-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      player1Character = btn.dataset.char;
      if (currentGame === 'royal-run' || currentGame === 'splat-haman') {
        // Show controls screen so players can pick keys
        const label = currentGame === 'royal-run'
          ? (player1Character === 'guard' ? 'Guard chooses keys' : 'Vashti chooses keys')
          : (player1Character === 'haman' ? 'Haman chooses keys' : 'Esther chooses keys');
        showScreen('game-controls-screen');
        document.getElementById('scheme-picker').classList.remove('hidden');
        document.getElementById('start-controls').classList.add('hidden');
        document.getElementById('controls-heading').textContent = label;
      } else {
        startGame();
      }
    });
  });
  document.querySelector('.char-back-btn').addEventListener('click', () => showScreen('game-mode-screen'));

  // Scheme picker
  document.querySelectorAll('.scheme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      player1Scheme = btn.dataset.scheme;
      document.getElementById('scheme-picker').classList.add('hidden');
      document.getElementById('start-controls').classList.remove('hidden');
      document.getElementById('controls-heading').textContent = 'Ready!';
    });
  });

  // Start game from controls screen
  document.querySelector('.start-game-btn').addEventListener('click', startGame);
  document.querySelectorAll('.controls-back-btn').forEach(b => {
    b.addEventListener('click', () => showScreen('game-mode-screen'));
  });

  pauseBtn.addEventListener('click', () => { isPaused = !isPaused; pauseBtn.textContent = isPaused ? 'Resume' : 'Pause'; });
  quitBtn.addEventListener('click', quitToMenu);
  replayBtn.addEventListener('click', startGame);
  menuBtn.addEventListener('click', quitToMenu);
  nextBtn.addEventListener('click', () => { currentLevel++; startGame(); });

  function quitToMenu() {
    gameRunning = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    showScreen('game-menu-screen');
    renderHighScores();
  }

  // Nav "Games" link quits to game menu if a game is running
  document.addEventListener('click', function(e) {
    const link = e.target.closest('.nav-link[href="#games"]');
    if (link && gameRunning) {
      e.preventDefault();
      e.stopPropagation();
      quitToMenu();
    }
  }, true);

  function startGame() {
    showScreen('game-canvas-screen');
    isPaused = false;
    pauseBtn.textContent = 'Pause';
    const names = { 'joshua-spies': 'Joshua\'s Spies', 'catch-grapes': 'Catch the Grapes', 'splat-haman': 'Splat Haman', 'royal-run': 'Royal Run' };
    gameTitleDisp.textContent = names[currentGame] || '';
    gameRunning = true;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    prevKeys = {};

    switch (currentGame) {
      case 'joshua-spies': initJoshuaSpies(); break;
      case 'catch-grapes': initCatchGrapes(); break;
      case 'splat-haman':  initSplatHaman(); break;
      case 'royal-run':    initRoyalRun(); break;
    }
  }

  function endGame(win, score, msg) {
    gameRunning = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    const isNew = saveHighScore(currentGame, score);
    resultTitle.textContent = win ? 'Victory!' : 'Game Over';
    resultMsg.textContent = msg || (win ? 'Amazing job!' : 'Better luck next time!');
    finalScoreVal.textContent = score;
    highScoreMsg.textContent = isNew ? 'New High Score!' : 'Best: ' + (getHighScores()[currentGame] || 0);
    const gameMax = currentGame === 'royal-run' ? 5 : maxLevel;
    nextBtn.style.display = win && currentLevel < gameMax ? 'inline-block' : 'none';
    showScreen('game-over-screen');
  }

  /* ========================================
     GAME 1: JOSHUA'S SPIES
     ======================================== */
  let js = {};

  function initJoshuaSpies() {
    const lvl = currentLevel || 1;
    const lvlMul = 1 + (lvl - 1) * 0.35;
    const spyDef = { x: 60, y: 350, w: 20, h: 30, vx: 0, vy: 0, onGround: true, walkFrame: 0, squash: 0, maxSpeed: 4, accel: 0.45, friction: 0.35, jumpForce: -9.5, jumpBuffer: 0, coyoteTimer: 0, jumpHoldFrames: 0, color1: '#5c3a1e', color2: '#3e2512' };
    const spyDef2 = { x: 80, y: 350, w: 20, h: 30, vx: 0, vy: 0, onGround: true, walkFrame: 0, squash: 0, maxSpeed: 4, accel: 0.45, friction: 0.35, jumpForce: -9.5, jumpBuffer: 0, coyoteTimer: 0, jumpHoldFrames: 0, color1: '#e8c39e', color2: '#c9a076' };
    js = {
      spies: isMultiplayer ? [spyDef, spyDef2] : [spyDef],
      obstacles: [],
      guards: [],
      scrolls: [],
      coins: [],
      levers: [],
      gates: [],
      camera: 0,
      levelWidth: 1800 + lvl * 300,
      groundY: 380,
      score: 0,
      scrollsCollected: 0,
      coinsCollected: 0,
      frame: 0,
      level: lvl,
      twinkle: 0,
      gravity: 0.55,
      houseX: 0,
      bestDist: 0,
      celebrationTimer: 0
    };

    // Level-based difficulty
    const numObs = 15 + lvl * 3;
    const numGuards = 4 + lvl;
    const numScrolls = 8 + lvl * 2;
    const numCoins = 10 + lvl * 3;

    for (let i = 0; i < numObs; i++) {
      const x = 300 + i * (js.levelWidth / numObs) + Math.random() * 40;
      const h = (16 + Math.random() * 30) * (0.7 + lvl * 0.06);
      const types = ['rock', 'barrel', 'wall', 'branch', 'sign'];
      js.obstacles.push({ x, y: js.groundY - h, w: 28 + Math.random() * 10, h, type: types[i % types.length] });
    }

    for (let i = 0; i < numGuards; i++) {
      const spread = js.levelWidth / numGuards;
      js.guards.push({
        x: 350 + i * spread + Math.random() * 100,
        y: js.groundY - 30,
        w: 22, h: 30,
        speed: (1 + i * 0.12) * lvlMul,
        dir: 1,
        patrolMin: 300 + i * spread,
        patrolMax: 350 + i * spread + 50,
        caught: false, walkFrame: 0
      });
    }

    for (let i = 0; i < numScrolls; i++) {
      js.scrolls.push({
        x: 150 + i * ((js.levelWidth - 300) / numScrolls) + Math.random() * 40,
        y: js.groundY - 60 - Math.random() * 100,
        collected: false, bobOffset: Math.random() * Math.PI * 2
      });
    }

    for (let i = 0; i < numCoins; i++) {
      js.coins.push({
        x: 100 + i * ((js.levelWidth - 200) / numCoins) + Math.random() * 30,
        y: js.groundY - 50 - Math.random() * 120,
        collected: false, bobOffset: Math.random() * Math.PI * 2
      });
    }

    // Coop levers + gates (two-player areas)
    if (isMultiplayer) {
      for (let i = 0; i < 2 + lvl; i++) {
        const lx = 500 + i * ((js.levelWidth - 800) / (2 + lvl));
        js.levers.push({ x: lx, y: js.groundY - 18, w: 12, h: 18, pulled: false, gateX: lx + 120 });
        js.gates.push({ x: lx + 120, y: js.groundY - 50, w: 10, h: 50, open: false, timer: 0 });
      }
    }

    js.houseX = js.levelWidth - 160;
    js.bestDist = 0;

    particles = [];
    gameLoop(updateJoshuaSpies, renderJoshuaSpies);
  }

  function applyMarioPhysics(s, moveInput, jumpPressed, jumpHeld, duckHeld) {

    if (moveInput > 0) {
      s.vx += s.accel;
      if (s.vx > s.maxSpeed) s.vx = s.maxSpeed;
    } else if (moveInput < 0) {
      s.vx -= s.accel;
      if (s.vx < -s.maxSpeed) s.vx = -s.maxSpeed;
    } else {
      if (s.vx > 0) { s.vx -= s.friction; if (s.vx < 0) s.vx = 0; }
      else if (s.vx < 0) { s.vx += s.friction; if (s.vx > 0) s.vx = 0; }
    }

    if (duckHeld && s.onGround) { s.h = 15; s.y = js.groundY - s.h; }
    if (!duckHeld) s.h = 30;

    if (s.onGround) s.coyoteTimer = 6;
    else if (s.coyoteTimer > 0) s.coyoteTimer--;

    if (jumpPressed) s.jumpBuffer = 8;
    else if (s.jumpBuffer > 0) s.jumpBuffer--;

    if (s.jumpBuffer > 0 && s.coyoteTimer > 0) {
      s.vy = s.jumpForce;
      s.onGround = false;
      s.coyoteTimer = 0;
      s.jumpBuffer = 0;
      s.jumpHoldFrames = 0;
      s.squash = -0.3;
      sfxJump();
    }

    if (!s.onGround && s.vy < 0 && jumpHeld && s.jumpHoldFrames < 14) {
      s.jumpHoldFrames++;
      s.vy += js.gravity * 0.45;
    } else if (!s.onGround) {
      s.vy += js.gravity;
    }

      s.x += s.vx;
      s.y += s.vy;

      if (s.squash < 0) s.squash += 0.04;
      else if (s.squash > 0) s.squash *= 0.8;
      if (Math.abs(s.squash) < 0.01) s.squash = 0;

      if (s.y + s.h > js.groundY) {
        if (s.vy > 3) s.squash = 0.3;
        s.y = js.groundY - s.h; s.vy = 0; s.onGround = true;
      } else {
        s.onGround = false;
      }

      const obs = js.obstacles;
      for (let oi = 0; oi < obs.length; oi++) {
        const o = obs[oi];
        if (s.x < o.x + o.w && s.x + s.w > o.x && s.y < o.y + o.h && s.y + s.h > o.y) {
          if (s.vy > 0) { s.y = o.y - s.h; s.vy = 0; s.onGround = true; }
          else if (s.vy < 0) { s.y = o.y + o.h; s.vy = 0; }
          else {
            if (s.x + s.w / 2 < o.x + o.w / 2) s.x = o.x - s.w;
            else s.x = o.x + o.w;
            s.vx = 0;
          }
        }
      }

      const gts = js.gates;
      for (let gi = 0; gi < gts.length; gi++) {
        const g = gts[gi];
        if (!g.open && s.x < g.x + g.w && s.x + s.w > g.x && s.y < g.y + g.h && s.y + s.h > g.y) {
          if (s.x + s.w / 2 < g.x + g.w / 2) s.x = g.x - s.w;
          else s.x = g.x + g.w;
          s.vx = 0;
        }
      }

    s.x = Math.max(0, Math.min(js.levelWidth - s.w, s.x));

    if (s.onGround && Math.abs(s.vx) > 0.5) s.walkFrame += Math.abs(s.vx) * 0.06;
    else if (!s.onGround) s.walkFrame += 0.02;
    else s.walkFrame *= 0.9;
  }

  function updateJoshuaSpies() {
    if (isPaused) return;
    js.frame++;
    js.twinkle += 0.05;
    const s1 = js.spies[0];
    const s2 = js.spies[1];

    if (!isMultiplayer) {
      const moveInput = (keys['d'] || keys['ArrowRight'] ? 1 : 0) - (keys['a'] || keys['ArrowLeft'] ? 1 : 0);
      const jumpPressed = wasPressed('w') || wasPressed('ArrowUp');
      const jumpHeld = keys['w'] || keys['ArrowUp'];
      const duckHeld = keys['s'] || keys['ArrowDown'];

      applyMarioPhysics(s1, moveInput, jumpPressed, jumpHeld, duckHeld);
    } else {
      const p1Alt = player1Scheme === 'arrows';
      const p1Right = p1Alt ? 'ArrowRight' : 'd';
      const p1Left = p1Alt ? 'ArrowLeft' : 'a';
      const p1Up = p1Alt ? 'ArrowUp' : 'w';
      const p1Down = p1Alt ? 'ArrowDown' : 's';
      const p2Right = p1Alt ? 'd' : 'ArrowRight';
      const p2Left = p1Alt ? 'a' : 'ArrowLeft';
      const p2Up = p1Alt ? 'w' : 'ArrowUp';
      const p2Down = p1Alt ? 's' : 'ArrowDown';
      const move1 = (keys[p1Right] ? 1 : 0) - (keys[p1Left] ? 1 : 0);
      const move2 = (keys[p2Right] ? 1 : 0) - (keys[p2Left] ? 1 : 0);
      applyMarioPhysics(s1, move1, wasPressed(p1Up), keys[p1Up], keys[p1Down]);
      applyMarioPhysics(s2, move2, wasPressed(p2Up), keys[p2Up], keys[p2Down]);
    }

    // Camera
    const midX = s2 ? (s1.x + s2.x) / 2 : s1.x;
    js.camera = Math.max(0, Math.min(js.levelWidth - canvas.width, midX - canvas.width / 2));

    // Guards
    const guards = js.guards;
    for (let gi = 0; gi < guards.length; gi++) {
      const g = guards[gi];
      if (g.caught) continue;
      g.x += g.speed * g.dir;
      g.walkFrame += 0.1;
      if (g.x > g.patrolMax) g.dir = -1;
      else if (g.x < g.patrolMin) g.dir = 1;

      if (s1.h > 20 && s1.x < g.x + g.w && s1.x + s1.w > g.x && s1.y < g.y + g.h && s1.y + s1.h > g.y ||
          (s2 && s2.h > 20 && s2.x < g.x + g.w && s2.x + s2.w > g.x && s2.y < g.y + g.h && s2.y + s2.h > g.y)) {
        triggerShake(8);
        spawnParticles(midX, js.groundY - 40, '#c62828', 10, 4);
        sfxLose();
        gameRunning = false;
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        setTimeout(() => { currentLevel = js.level; startGame(); }, 1200);
        return;
      }
    }

    // Levers + Gates
    const levers = js.levers;
    const gates = js.gates;
    for (let li = 0; li < levers.length; li++) {
      const l = levers[li];
      if (l.pulled) continue;
      const near1 = Math.abs(s1.x + s1.w / 2 - l.x) < 25 && Math.abs(s1.y + s1.h / 2 - l.y) < 25;
      const near2 = s2 && Math.abs(s2.x + s2.w / 2 - l.x) < 25 && Math.abs(s2.y + s2.h / 2 - l.y) < 25;
      if ((near1 || near2) && (!isMultiplayer || keys['e'] || keys[' '])) {
        l.pulled = true;
        if (gates[li]) { gates[li].open = true; gates[li].timer = 300; }
        spawnParticles(l.x, l.y, '#d4a017', 6, 2);
        js.score += 30; sfxCollect();
      }
    }

    // Gate timers
    for (let gi = 0; gi < gates.length; gi++) {
      const g = gates[gi];
      if (g.open && g.timer > 0) { g.timer--; if (g.timer <= 0) g.open = false; }
    }

    // Scrolls
    const scrolls = js.scrolls;
    for (let si = 0; si < scrolls.length; si++) {
      const sc = scrolls[si];
      if (sc.collected) continue;
      if (s1.x < sc.x + 15 && s1.x + s1.w > sc.x && s1.y < sc.y + 15 && s1.y + s1.h > sc.y) {
        sc.collected = true; js.scrollsCollected++; js.score += 100;
        spawnParticles(sc.x + 7, sc.y + 5, '#d4a017', 5, 2);
        spawnScorePopup(sc.x, sc.y - 10, '+100', '#d4a017'); sfxCollect();
      } else if (s2 && s2.x < sc.x + 15 && s2.x + s2.w > sc.x && s2.y < sc.y + 15 && s2.y + s2.h > sc.y) {
        sc.collected = true; js.scrollsCollected++; js.score += 100;
        spawnParticles(sc.x + 7, sc.y + 5, '#d4a017', 5, 2);
        spawnScorePopup(sc.x, sc.y - 10, '+100', '#d4a017'); sfxCollect();
      }
    }

    // Coins
    const coins = js.coins;
    for (let ci = 0; ci < coins.length; ci++) {
      const c = coins[ci];
      if (c.collected) continue;
      const cx = c.x, cy = c.y;
      if (Math.abs(s1.x + s1.w / 2 - cx) < 16 && Math.abs(s1.y + s1.h / 2 - cy) < 16) {
        c.collected = true; js.coinsCollected++; js.score += 10;
        spawnParticles(cx, cy, '#ffd700', 3, 2);
        spawnScorePopup(cx, cy - 10, '+10', '#ffd700'); sfxCollect();
      } else if (s2 && Math.abs(s2.x + s2.w / 2 - cx) < 16 && Math.abs(s2.y + s2.h / 2 - cy) < 16) {
        c.collected = true; js.coinsCollected++; js.score += 10;
        spawnParticles(cx, cy, '#ffd700', 3, 2);
        spawnScorePopup(cx, cy - 10, '+10', '#ffd700'); sfxCollect();
      }
    }

    // Score
    const dist = Math.floor(midX / 5);
    if (dist > js.bestDist) {
      js.score += dist - js.bestDist;
      js.bestDist = dist;
    }

    // Win
    if (s1.x + s1.w >= js.houseX && (!s2 || s2.x + s2.w >= js.houseX)) {
      js.celebrationTimer++;
      if (js.celebrationTimer % 3 === 0) {
        spawnParticles(js.houseX + 30 + Math.random() * 40, js.groundY - 40 - Math.random() * 60,
          ['#d4a017', '#ffcc00', '#7B6CDE', '#ff6b6b'][Math.floor(Math.random() * 4)],
          3 + Math.random() * 4, 4 + Math.random() * 3);
      }
      if (js.celebrationTimer > 120) {
        sfxWin();
        const nextLevel = js.level + 1;
        if (nextLevel > maxLevel) {
          endGame(true, js.score, 'You beat all ' + maxLevel + ' levels! You win!');
        } else {
          endGame(true, js.score, 'Rahab\'s house! Both spies are safe! Level ' + nextLevel + ' awaits!');
        }
        return;
      }
    }

    updateParticles();
  }

  // Pre-computed star positions
  const starPositions = [];
  for (let i = 0; i < 30; i++) {
    starPositions.push({
      x: (i * 137 + 50) % 800,
      y: (i * 89 + 20) % 200,
      r: 1 + (i % 2),
      phase: i * 1.5
    });
  }

  function drawSpy(s, i) {
    ctx.save();
    const squashX = 1 + (s.squash * 0.5);
    const squashY = 1 - (s.squash * 0.5);
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.scale(squashX, squashY);
    ctx.translate(-s.w / 2, -s.h / 2);

    const ducked = s.h < 20;
    if (ducked) {
      // Crouching pose
      ctx.fillStyle = s.color2;
      ctx.fillRect(4, s.h - 4, 5, 5);
      ctx.fillRect(12, s.h - 4, 5, 5);
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(3, s.h + 1, 6, 3);
      ctx.fillRect(11, s.h + 1, 6, 3);
      ctx.fillStyle = i === 0 ? '#5c3a1e' : '#f5cba7';
      ctx.fillRect(-2, 10, 3, 7);
      ctx.fillRect(s.w - 1, 10, 3, 7);
      ctx.fillStyle = s.color1;
      ctx.fillRect(3, 8, s.w - 6, s.h - 8);
      ctx.fillStyle = i === 0 ? '#1565c0' : '#2e7d32';
      ctx.fillRect(4, 8, s.w - 8, 3);
    } else {
      if (s.onGround && Math.abs(s.vx) > 0.5) {
        const legOff = Math.sin(s.walkFrame * 3) * 3;
        ctx.fillStyle = s.color2;
        ctx.fillRect(5, s.h - 2, 4, 8 + legOff);
        ctx.fillRect(12, s.h - 2, 4, 8 - legOff);
      } else {
        ctx.fillStyle = s.color2;
        ctx.fillRect(5, s.h - 2, 4, 8);
        ctx.fillRect(12, s.h - 2, 4, 8);
      }
      ctx.fillStyle = '#3e2723';
      ctx.fillRect(4, s.h + 4, 6, 3);
      ctx.fillRect(11, s.h + 4, 6, 3);
      ctx.fillStyle = i === 0 ? '#5c3a1e' : '#f5cba7';
      const armSwing = Math.sin(s.walkFrame * 3) * 2;
      ctx.fillRect(-2, 12 + armSwing, 3, 10);
      ctx.fillRect(s.w - 1, 12 - armSwing, 3, 10);
      ctx.fillStyle = s.color1;
      ctx.fillRect(3, 8, s.w - 6, s.h - 8);
      ctx.fillStyle = i === 0 ? '#1565c0' : '#2e7d32';
      ctx.fillRect(4, 8, s.w - 8, 3);
    }
    if (!ducked) {
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(3, s.h - 14, s.w - 6, 3);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(s.w / 2 - 2, s.h - 14, 4, 3);
    }
    ctx.beginPath();
    ctx.arc(s.w / 2, 6, 7, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#5c3a1e' : '#f5cba7';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(6, 4, 3, 3);
    ctx.fillRect(12, 4, 3, 3);
    ctx.fillStyle = '#333';
    ctx.fillRect(7, 5, 1.5, 1.5);
    ctx.fillRect(13, 5, 1.5, 1.5);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.w / 2, 8, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = i === 0 ? '#3e2723' : '#4e342e';
    ctx.beginPath();
    ctx.arc(s.w / 2, 4, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(2, 2, s.w - 4, 4);

    ctx.restore();
  }

  function renderJoshuaSpies() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shaking = applyShake();

    ctx.fillStyle = '#1a1a4e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2d2d6b';
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.4);
    ctx.fillStyle = '#4a3f6b';
    ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);

    const tw = js.twinkle;
    for (let i = 0; i < 30; i++) {
      const st = starPositions[i];
      const alpha = (0.4 + 0.6 * Math.sin(tw + st.phase)) * 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x, st.y, st.r * 2, st.r * 2);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(-js.camera, 0);

    // Ground
    const gY = js.groundY;
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(0, gY, js.levelWidth, canvas.height - gY);
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(0, gY, js.levelWidth, 8);

    // Obstacles
    const obs = js.obstacles;
    for (let oi = 0; oi < obs.length; oi++) {
      const o = obs[oi];
      if (o.type === 'rock') ctx.fillStyle = '#757575';
      else if (o.type === 'barrel') ctx.fillStyle = '#795548';
      else if (o.type === 'branch' || o.type === 'sign') ctx.fillStyle = '#4e342e';
      else ctx.fillStyle = '#8d6e63';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(o.x, o.y, o.w, 1);
      if (o.type === 'branch') {
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(o.x + o.w / 2 - 2, o.y - 12, 4, 12);
      } else if (o.type === 'sign') {
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(o.x + o.w / 2 - 2, o.y - 8, 4, 8);
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(o.x - 4, o.y - 4, o.w + 8, 6);
      }
    }

    // Gates
    const gates = js.gates;
    for (let gi = 0; gi < gates.length; gi++) {
      const g = gates[gi];
      if (g.open) {
        ctx.fillStyle = 'rgba(139, 108, 222, 0.15)';
        ctx.fillRect(g.x - 20, g.y, g.w + 40, g.h - 10);
        continue;
      }
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(g.x - 2, g.y - 4, g.w + 4, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(g.x + 2, g.y + 4, g.w - 4, 4);
      ctx.fillRect(g.x + 2, g.y + 16, g.w - 4, 4);
      ctx.fillRect(g.x + 2, g.y + 28, g.w - 4, 4);
    }

    // Levers
    const levers = js.levers;
    for (let li = 0; li < levers.length; li++) {
      const l = levers[li];
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(l.x - 2, l.y + 4, l.w + 4, 4);
      ctx.fillStyle = l.pulled ? '#9e9e9e' : '#c62828';
      ctx.fillRect(l.x + 2, l.y - 6, l.w - 4, l.h + 2);
    }

    // Spies
    for (let si = 0; si < js.spies.length; si++) {
      drawSpy(js.spies[si], si);
    }
    // Label for single player: "Two Spies" above the lone spy
    if (!isMultiplayer && js.spies.length === 1) {
      const sp = js.spies[0];

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Two Spies', sp.x + sp.w / 2, sp.y - 13);
      ctx.textAlign = 'left';
    }

    // Guards
    const grds = js.guards;
    for (let gi = 0; gi < grds.length; gi++) {
      const g = grds[gi];
      if (g.caught) continue;
      const bobY = Math.sin(g.walkFrame * 2) * 2;
      // Legs
      const legSwing = Math.sin(g.walkFrame * 3) * 3;
      ctx.fillStyle = '#37474f';
      ctx.fillRect(g.x + 4, g.y + g.h - 8 + legSwing + bobY, 4, 8);
      ctx.fillRect(g.x + 14, g.y + g.h - 8 - legSwing + bobY, 4, 8);
      // Boots
      ctx.fillStyle = '#1a237e';
      ctx.fillRect(g.x + 3, g.y + g.h + legSwing + bobY, 6, 4);
      ctx.fillRect(g.x + 13, g.y + g.h - legSwing + bobY, 6, 4);
      // Body (tunic)
      ctx.fillStyle = '#c62828';
      ctx.fillRect(g.x + 2, g.y + bobY, g.w - 4, g.h - 8);
      // Belt
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(g.x + 2, g.y + g.h - 16 + bobY, g.w - 4, 3);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(g.x + g.w / 2 - 2, g.y + g.h - 16 + bobY, 4, 3);
      // Arms
      ctx.fillStyle = '#ffccbc';
      const gArm = Math.sin(g.walkFrame * 3) * 2;
      ctx.fillRect(g.x - 2, g.y + 8 + gArm + bobY, 3, 10);
      ctx.fillRect(g.x + g.w - 1, g.y + 8 - gArm + bobY, 3, 10);
      // Sword (held in the direction the guard faces)
      const sDir = g.dir;
      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(g.x + g.w / 2 - 1 + sDir * 12, g.y + 4 + bobY, 2, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(g.x + g.w / 2 - 1 + sDir * 12, g.y + 4 + bobY, 2, 12);
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(g.x + g.w / 2 - 3 + sDir * 12, g.y + 18 + bobY, 6, 3);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(g.x + g.w / 2 - 2 + sDir * 12, g.y + 17 + bobY, 4, 1);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(g.x + g.w / 2 - 2 + sDir * 12, g.y + 21 + bobY, 4, 4);
      // Head
      ctx.beginPath();
      ctx.arc(g.x + g.w / 2, g.y - 2 + bobY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffccbc';
      ctx.fill();
      // Helmet
      ctx.fillStyle = '#757575';
      ctx.beginPath();
      ctx.arc(g.x + g.w / 2, g.y - 5 + bobY, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(g.x + 2, g.y - 5 + bobY, g.w - 4, 4);
      // Helmet brim
      ctx.fillStyle = '#616161';
      ctx.fillRect(g.x, g.y + bobY, g.w, 2);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(g.x + 5, g.y - 3 + bobY, 3, 2);
      ctx.fillRect(g.x + 14, g.y - 3 + bobY, 3, 2);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(g.x + 6, g.y - 3 + bobY, 1.5, 2);
      ctx.fillRect(g.x + 15, g.y - 3 + bobY, 1.5, 2);
    }

    // Coins
    const coins = js.coins;
    const frame = js.frame;
    for (let ci = 0; ci < coins.length; ci++) {
      const c = coins[ci];
      if (c.collected) continue;
      const bobY = Math.sin(frame * 0.06 + c.bobOffset) * 3;
      const scaleX = Math.abs(Math.cos(frame * 0.04 + c.bobOffset));
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(c.x - 4 * scaleX, c.y - 4 + bobY, 8 * scaleX, 8);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(c.x - 2 * scaleX, c.y - 2 + bobY, 4 * scaleX, 4);
    }

    // Scrolls
    const scrolls = js.scrolls;
    for (let si = 0; si < scrolls.length; si++) {
      const sc = scrolls[si];
      if (sc.collected) continue;
      const bobY = Math.sin(frame * 0.05 + sc.bobOffset) * 3;
      ctx.fillStyle = '#f5deb3';
      ctx.fillRect(sc.x, sc.y + bobY, 15, 10);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(sc.x + 2, sc.y + 2 + bobY, 11, 6);
    }

    // Rahab's house
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(js.houseX, js.groundY - 80, 100, 80);
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(js.houseX + 5, js.groundY - 75, 90, 75);
    const lampGlow = 0.3 + 0.3 * Math.sin(js.frame * 0.04);
    ctx.fillStyle = `rgba(255, 200, 50, ${lampGlow})`;
    ctx.beginPath();
    ctx.arc(js.houseX + 75, js.groundY - 55, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.moveTo(js.houseX - 10, js.groundY - 80);
    ctx.lineTo(js.houseX + 50, js.groundY - 120);
    ctx.lineTo(js.houseX + 110, js.groundY - 80);
    ctx.fill();
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(js.houseX + 40, js.groundY - 30, 20, 30);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(js.houseX + 70, js.groundY - 70, 5, 25);
    ctx.restore();
    endShake();
  }

  /* ========================================
     GAME 2: CATCH THE GRAPES
     ======================================== */
  let cg = {};

  function initCatchGrapes() {
    cg = {
      player: { x: isMultiplayer ? canvas.width / 2 - 50 : canvas.width / 2 - 20, y: canvas.height - 50, w: 40, h: 30, vx: 0 },
      player2: isMultiplayer ? { x: canvas.width / 2 + 10, y: canvas.height - 50, w: 40, h: 30, vx: 0 } : null,
      grapes: [],
      score: 0,
      frame: 0,
      gameOver: false,
      fallingSpeed: 0.7,
      spawnRate: 80,
      baseSpawnRate: 80,
      accelTimer: 0,
      misses: 0,
      hits: 0,
      maxHits: 5
    };
    particles = [];
    gameLoop(updateCatchGrapes, renderCatchGrapes);
  }

  function updateCatchGrapes() {
    if (isPaused) return;
    cg.frame++;

    const p1Alt = player1Scheme === 'arrows';
    const p1Right = p1Alt ? 'ArrowRight' : 'd';
    const p1Left = p1Alt ? 'ArrowLeft' : 'a';
    const p2Right = p1Alt ? 'd' : 'ArrowRight';
    const p2Left = p1Alt ? 'a' : 'ArrowLeft';
    if (!isMultiplayer) {
      const move = ((keys[p1Right] ? 1 : 0) - (keys[p1Left] ? 1 : 0));
      cg.player.x += move * 8;
      cg.player.x = Math.max(0, Math.min(canvas.width - cg.player.w, cg.player.x));
    } else {
      const move1 = ((keys[p1Right] ? 1 : 0) - (keys[p1Left] ? 1 : 0));
      const move2 = ((keys[p2Right] ? 1 : 0) - (keys[p2Left] ? 1 : 0));
      cg.player.x += move1 * 8;
      cg.player.x = Math.max(0, Math.min(canvas.width - cg.player.w, cg.player.x));
      cg.player2.x += move2 * 8;
      cg.player2.x = Math.max(0, Math.min(canvas.width - cg.player2.w, cg.player2.x));
    }

    cg.accelTimer++;
    if (cg.accelTimer >= 1800) {
      cg.accelTimer = 0;
      cg.fallingSpeed += 0.05;
      cg.spawnRate = Math.max(50, cg.spawnRate - 5);
    }

    if (cg.frame % cg.spawnRate === 0) {
      cg.grapes.push({
        x: Math.random() * (canvas.width - 20),
        y: -10,
        r: 6,
        speed: cg.fallingSpeed + Math.random() * 0.5,
        bob: Math.random() * Math.PI * 2
      });
    }

    const gr = cg.grapes;
    for (let gi = 0; gi < gr.length; gi++) {
      const g = gr[gi];
      g.y += g.speed;
      if (g.y > canvas.height) {
        cg.misses++;
        if (cg.misses >= 5) {
          sfxLose();
          endGame(false, cg.score, 'Too many grapes missed! Try again!');
          return;
        }
        gr[gi] = gr[gr.length - 1];
        gr.pop();
        gi--;
        continue;
      }
      let caught = false;
      if (g.x > cg.player.x && g.x < cg.player.x + cg.player.w &&
          g.y > cg.player.y && g.y < cg.player.y + cg.player.h) {
        caught = true;
      } else if (isMultiplayer && cg.player2 &&
          g.x > cg.player2.x && g.x < cg.player2.x + cg.player2.w &&
          g.y > cg.player2.y && g.y < cg.player2.y + cg.player2.h) {
        caught = true;
      }
      if (caught) {
        cg.score += 10;
        spawnScorePopup(g.x, g.y - 10, '+10', '#8bc34a');
        spawnParticles(g.x, g.y, '#8bc34a', 4, 2);
        sfxCollect();
        gr[gi] = gr[gr.length - 1];
        gr.pop();
        gi--;
      }
    }

    updateParticles();
  }

  function renderCatchGrapes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyShake();

    ctx.fillStyle = '#e8f5e9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#a5d6a7';
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6);

    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(0, canvas.height - 15, canvas.width, 15);
    ctx.fillStyle = '#5d4037';
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(i * 28, canvas.height - 15, 14, 15);
    }

    // Vine
    ctx.fillStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    for (let i = 0; i < canvas.height * 0.5; i += 10) {
      ctx.lineTo(canvas.width / 2 + Math.sin(i * 0.05) * 30, i + 10);
    }
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(canvas.width / 2 + Math.sin(i * 90) * 25, i * 40 + 30, 20, 6);
    }

    // Grapes
    const gr = cg.grapes;
    for (let gi = 0; gi < gr.length; gi++) {
      const g = gr[gi];
      ctx.fillStyle = '#7b1fa2';
      ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
      ctx.fillStyle = '#6a1b9a';
      ctx.fillRect(g.x - 2, g.y - 2, 4, 4);
    }

    // Baskets
    const baskets = [cg.player];
    if (isMultiplayer && cg.player2) baskets.push(cg.player2);
    const basketColors = ['#795548', '#5D4E37'];
    for (let bi = 0; bi < baskets.length; bi++) {
      const p = baskets[bi];
      ctx.fillStyle = basketColors[bi];
      ctx.fillRect(p.x, p.y + p.h - 12, p.w, 12);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(p.x - 2, p.y + p.h - 4, p.w + 4, 4);
      ctx.fillStyle = '#a1887f';
      ctx.fillRect(p.x + 4, p.y + p.h - 12, p.w - 8, 2);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(p.x + 2, p.y + p.h - 8, p.w - 4, 4);
    }

    renderParticles();

    // HUD
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Score: ' + cg.score, 10, 25);
    ctx.fillStyle = cg.misses >= 4 ? '#e53935' : '#333';
    ctx.fillText('Misses: ' + cg.misses + '/5', 10, 45);
    endShake();
  }

  /* ========================================
     GAME 3: SPLAT HAMAN
     ======================================== */
  let sh = {};

  function initSplatHaman() {
    sh = {
      player: { x: 60, y: canvas.height - 60, w: 30, h: 40, vx: 0, vy: 0, onGround: true, squash: 0, walkFrame: 0, hasRotten: false },
      haman: { x: canvas.width - 100, y: canvas.height - 70, w: 40, h: 50, vx: 0, vy: 0, onGround: true, dir: -1, walkFrame: 0, anger: 0, shakeX: 0, shakeY: 0, shakeTime: 0, dodgeTimer: 0, moveTimer: 0, throwTimer: 0 },
      food: [],
      incoming: [],
      rottenItems: [],
      score: 0,
      frame: 0,
      gameOver: false,
      hits: 0,
      maxHits: 5,
      foodHits: 0,
      rottenHits: 0,
      foodNeeded: 0,
      rottenNeeded: 10
    };
    particles = [];
    gameLoop(updateSplatHaman, renderSplatHaman);
  }

  function updateSplatHaman() {
    if (isPaused) return;
    sh.frame++;

    // Player movement (with 2-player support)
    let hamanMoving = false;
    let hamanThrow = false;
    const p = sh.player;
    const h = sh.haman;
    let estherThrowLeft = false, estherThrowRight = false;

    let estherMove = 0;

    const p1Alt = player1Scheme === 'arrows';
    const p1Right = p1Alt ? 'ArrowRight' : 'd';
    const p1Left = p1Alt ? 'ArrowLeft' : 'a';
    const p1Up = p1Alt ? 'ArrowUp' : 'w';
    const p1Down = p1Alt ? 'ArrowDown' : 's';
    const p2Right = p1Alt ? 'd' : 'ArrowRight';
    const p2Left = p1Alt ? 'a' : 'ArrowLeft';
    const p2Up = p1Alt ? 'w' : 'ArrowUp';
    const p2Down = p1Alt ? 's' : 'ArrowDown';
    const p1Throw = player1Scheme === 'wasd' ? 'f' : ' ';
    const p2Throw = player1Scheme === 'wasd' ? ' ' : 'f';

    if (isMultiplayer) {
      if (player1Character === 'esther') {
        // P1 = Esther (chosen keys), P2 = Haman (other keys)
        if (keys[p1Left]) estherMove = -1;
        else if (keys[p1Right]) estherMove = 1;
        if (wasPressed(p1Throw)) { if (estherMove < 0) estherThrowLeft = true; else estherThrowRight = true; }
        if (wasPressed(p1Up)) {
          if (p.onGround) { p.vy = -10; p.onGround = false; p.squash = -0.3; sfxJump(); }
        }
        if (keys[p1Down]) p.h = 20; else p.h = 40;

        hamanMoving = keys[p2Left] || keys[p2Right];
        if (keys[p2Left]) h.vx = -4;
        else if (keys[p2Right]) h.vx = 4;
        if (wasPressed(p2Up) && h.onGround) { h.vy = -10; h.onGround = false; }
        if (keys[p2Down]) { if (h.onGround) h.h = 25; } else h.h = 50;
        if (wasPressed(p2Throw)) { hamanThrow = true; }
      } else {
        // P1 = Haman (chosen keys), P2 = Esther (other keys)
        hamanMoving = keys[p1Left] || keys[p1Right];
        if (keys[p1Left]) h.vx = -4;
        else if (keys[p1Right]) h.vx = 4;
        if (wasPressed(p1Up) && h.onGround) { h.vy = -10; h.onGround = false; }
        if (keys[p1Down]) { if (h.onGround) h.h = 25; } else h.h = 50;
        if (wasPressed(p1Throw)) { hamanThrow = true; }

        if (keys[p2Left]) estherMove = -1;
        else if (keys[p2Right]) estherMove = 1;
        if (wasPressed(p2Throw)) { if (estherMove < 0) estherThrowLeft = true; else estherThrowRight = true; }
        if (wasPressed(p2Up)) {
          if (p.onGround) { p.vy = -10; p.onGround = false; p.squash = -0.3; sfxJump(); }
        }
        if (keys[p2Down]) p.h = 20; else p.h = 40;
      }
    } else {
      // Single player: use chosen scheme
      if (keys[p1Left]) estherMove = -1;
      else if (keys[p1Right]) estherMove = 1;
      if (wasPressed(p1Throw)) { if (estherMove < 0) estherThrowLeft = true; else estherThrowRight = true; }
      if (wasPressed(p1Up)) {
        if (p.onGround) { p.vy = -10; p.onGround = false; p.squash = -0.3; sfxJump(); }
      }
      if (keys[p1Down]) p.h = 20; else p.h = 40;
    }

    // Apply Esther movement
    p.x += estherMove * 4;
    p.x = Math.max(0, Math.min(canvas.width - p.w, p.x));
    if (Math.abs(estherMove) > 0 && p.onGround) p.walkFrame += 0.15;
    else p.walkFrame *= 0.9;

    if (!hamanMoving) h.vx *= 0.9;
    if (Math.abs(h.vx) < 0.1) h.vx = 0;
    h.dir = h.vx > 0.5 ? 1 : h.vx < -0.5 ? -1 : h.dir;

    p.vy += 0.6;
    p.y += p.vy;
    if (p.y + p.h > canvas.height - 20) {
      if (p.vy > 3) p.squash = 0.3;
      p.y = canvas.height - 20 - p.h;
      p.vy = 0;
      p.onGround = true;
    }
    if (p.squash < 0) p.squash += 0.04;
    if (p.squash > 0) p.squash *= 0.85;
    if (Math.abs(p.squash) < 0.01) p.squash = 0;

    if (estherThrowLeft || estherThrowRight) {
      sfxThrow();
      const dir = estherThrowLeft ? -1 : 1;
      sh.food.push({
        x: sh.player.x + sh.player.w / 2,
        y: sh.player.y + 10,
        vx: dir * 7,
        vy: -3,
        w: 10, h: 10,
        isRotten: sh.player.hasRotten,
        rotation: 0, rotSpeed: dir * 0.3
      });
      sh.player.hasRotten = false;
    }

    // Haman throw (2-player mode - press Space)
    if (hamanThrow) {
      sfxThrow();
      h.throwTimer = 10;
      const dx = p.x + p.w / 2 - h.x;
      const dy = p.y + p.h / 2 - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const handX = h.x + (h.dir > 0 ? h.w + 5 : -5);
      const handY = h.y + 14;
      sh.incoming.push({
        x: handX,
        y: handY,
        vx: dx / dist * 5,
        vy: dy / dist * 5 - 2,
        r: 8,
        rotation: 0,
        rotSpeed: h.dir * 0.3
      });
    }

    // Spawn rotten food pickups
    if (sh.frame % 180 === 0) {
      sh.rottenItems.push({
        x: 30 + Math.random() * (canvas.width - 60),
        y: canvas.height - 20,
        collected: false,
        bob: Math.random() * Math.PI * 2
      });
    }
    const rotItems = sh.rottenItems;
    for (let ri = 0; ri < rotItems.length; ri++) {
      const r = rotItems[ri];
      if (r.collected) continue;
      if (!sh.player.hasRotten && Math.abs(sh.player.x + sh.player.w / 2 - r.x) < 25 &&
          Math.abs(sh.player.y + sh.player.h / 2 - r.y) < 25) {
        r.collected = true;
        sh.player.hasRotten = true;
        spawnParticles(r.x, r.y, '#4caf50', 5, 2);
        spawnScorePopup(r.x, r.y - 15, 'Rotten Food!', '#4caf50');
        sfxCollect();
      }
    }
    for (let ri = rotItems.length - 1; ri >= 0; ri--) {
      if (rotItems[ri].collected) rotItems.splice(ri, 1);
    }

    // Haman AI (only when Haman is not player-controlled)
    const inc = sh.incoming;
    if (!isMultiplayer) {
      // Change direction/movement periodically
      h.moveTimer--;
      if (h.moveTimer <= 0) {
        h.moveTimer = 20 + Math.floor(Math.random() * 40);
        const distToPlayer = p.x - h.x;
        if (Math.abs(distToPlayer) < 80) {
          h.vx = distToPlayer > 0 ? -3 : 3;
        } else {
          h.vx = distToPlayer > 0 ? 2 + Math.random() * 1.5 : -2 - Math.random() * 1.5;
        }
        h.dir = h.vx > 0 ? 1 : -1;
        if (h.onGround && Math.random() < 0.5) {
          h.vy = -11;
          h.onGround = false;
          h.vx += distToPlayer > 0 ? 3 : -3;
        }
      }

      // Dodge incoming food
      for (let ii = 0; ii < inc.length; ii++) {
        const f = inc[ii];
        if (f.hit) continue;
        const dx = f.x - h.x;
        const dy = f.y - h.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100 && Math.abs(dy) < 40) {
          if (h.onGround && Math.random() < 0.04) {
            h.vy = -10;
            h.onGround = false;
          }
          if (dx < 0) { h.vx = 4; h.dir = 1; }
          else { h.vx = -4; h.dir = -1; }
        }
      }
    }

    // Haman physics (always runs)
    h.vy += 0.55;
    h.x += h.vx;
    h.y += h.vy;
    if (h.x < 0) { h.x = 0; h.vx = Math.abs(h.vx); h.dir = 1; }
    if (h.x + h.w > canvas.width) { h.x = canvas.width - h.w; h.vx = -Math.abs(h.vx); h.dir = -1; }
    if (h.y + h.h > canvas.height - 20) {
      h.y = canvas.height - 20 - h.h;
      h.vy = 0;
      h.onGround = true;
    }
    if (Math.abs(h.vx) < 0.1) h.vx = 0;
    if (Math.abs(h.vx) > 0.3) h.walkFrame += 0.15; else h.walkFrame *= 0.9;

    // Player food hitting Haman
    const food = sh.food;
    for (let fi = 0; fi < food.length; fi++) {
      const f = food[fi];
      f.y += f.vy; f.x += f.vx; f.vy += 0.25; f.rotation += f.rotSpeed;
      if (f.hit) continue;
      if (f.x > h.x && f.x < h.x + h.w &&
          f.y > h.y && f.y < h.y + h.h) {
        f.hit = true;
        sh.score += f.isRotten ? 10 : 5;
        if (f.isRotten) sh.rottenHits++; else sh.foodHits++;
        if (sh.foodHits >= sh.foodNeeded && sh.rottenHits >= sh.rottenNeeded) {
          endGame(true, sh.score, 'Haman is on the gallows! You win!');
          return;
        }
        h.anger = Math.min(100, h.anger + 10);
        h.shakeTime = 10;
        spawnParticles(f.x, f.y, f.isRotten ? '#4caf50' : '#ff9800', 6, 3);
        spawnScorePopup(f.x, f.y - 15, '+' + (f.isRotten ? 10 : 5), '#d4a017');
        sfxCollect();
      }
    }
    for (let fi = food.length - 1; fi >= 0; fi--) {
      const f = food[fi];
      if (f.hit || f.y < -20 || f.x < -20 || f.x > canvas.width + 20) {
        food[fi] = food[food.length - 1];
        food.pop();
      }
    }

    // Haman shake
    if (h.shakeTime > 0) {
      h.shakeX = (Math.random() - 0.5) * h.shakeTime * 0.8;
      h.shakeY = (Math.random() - 0.5) * h.shakeTime * 0.8;
      h.shakeTime--;
    } else {
      h.shakeX = 0;
      h.shakeY = 0;
    }

    // Haman throws food (AI only - single player)
    if (!isMultiplayer) {
      const throwSpeed = 3 + Math.floor(sh.frame / 600) * 0.3;
      const throwRate = Math.max(20, 55 - h.anger * 0.3);
      if (sh.frame % Math.floor(throwRate) === 0) {
        h.throwTimer = 10;
        const dx = p.x + p.w / 2 - h.x;
        const dy = p.y + p.h / 2 - h.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const handX = h.x + (h.dir > 0 ? h.w + 5 : -5);
        const handY = h.y + 14;
        sh.incoming.push({
          x: handX,
          y: handY,
          vx: dx / dist * throwSpeed + h.dir * 1.5,
          vy: dy / dist * throwSpeed - 1.5,
          r: 8,
          rotation: 0,
          rotSpeed: h.dir * 0.3
        });
      }
    }

    if (h.throwTimer > 0) h.throwTimer--;
    // Incoming hit detection against player (Esther)
    for (let ii = 0; ii < inc.length; ii++) {
      const f = inc[ii];
      f.x += f.vx; f.y += f.vy; f.rotation += f.rotSpeed;
      if (f.hit) continue;
      const estherDuck = isMultiplayer ? (player1Character === 'esther' ? keys['s'] : keys['ArrowDown']) : (keys['s'] || keys['ArrowDown']);
      if (estherDuck) continue;
      if (f.x > p.x && f.x < p.x + p.w &&
          f.y > p.y && f.y < p.y + p.h) {
        f.hit = true;
        sh.hits++;
        triggerShake(5);
        spawnParticles(f.x, f.y, '#795548', 5, 2);
        sfxHit();
        if (sh.hits >= sh.maxHits) {
          sfxLose();
          endGame(false, sh.score, 'Haman got you! Better luck next time!');
        }
      }
    }
    for (let ii = inc.length - 1; ii >= 0; ii--) {
      const f = inc[ii];
      if (f.hit || f.x < -20 || f.x > canvas.width + 20 || f.y > canvas.height + 20) {
        inc[ii] = inc[inc.length - 1];
        inc.pop();
      }
    }

    updateParticles();
  }

  function renderSplatHaman() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyShake();

    // Palace background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#f5e6d3');
    grad.addColorStop(0.3, '#faf0e6');
    grad.addColorStop(1, '#d4c4a8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Haman capture progress (over pillars)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(250, 12, 300, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(260, 17, (280 * Math.min(sh.rottenHits, sh.rottenNeeded)) / sh.rottenNeeded, 14);
    ctx.fillStyle = '#fff';
    ctx.fillText('Rotten Food: ' + sh.rottenHits + '/' + sh.rottenNeeded, 265, 29);

    // Pillars
    ctx.fillStyle = '#bcaaa4';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(60 + i * 140, 0, 20, canvas.height - 20);
    }
    ctx.fillStyle = '#d7ccc8';
    ctx.fillRect(0, 0, canvas.width, 15);

    // Rotten food pickups on ground
    const rotItems = sh.rottenItems;
    for (let ri = 0; ri < rotItems.length; ri++) {
      const r = rotItems[ri];
      if (r.collected) continue;
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(r.x - 5, r.y - 10 + Math.sin(sh.frame * 0.08 + r.bob) * 3, 10, 10);
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(r.x - 3, r.y - 8 + Math.sin(sh.frame * 0.08 + r.bob) * 3, 3, 3);
    }

    // Floor
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    ctx.fillStyle = '#6d4c41';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(i * 45 + (sh.frame % 2), canvas.height - 20, 22, 20);
    }

    // Haman with run animation
    const h = sh.haman;
    ctx.save();
    ctx.translate(h.x + h.w / 2 + h.shakeX, h.y + h.shakeY);
    const angerPulse = h.anger > 70 ? 1 + 0.05 * Math.sin(sh.frame * 0.2) : 1;
    ctx.scale(angerPulse * h.dir, 1);

    ctx.fillStyle = h.anger > 70 ? '#c62828' : h.anger > 40 ? '#e53935' : '#4e342e';
    ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h);
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath();
    ctx.arc(0, -h.h / 2 - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(-10, -h.h / 2 - 20, 20, 8);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-8 + i * 8, -h.h / 2 - 20);
      ctx.lineTo(-4 + i * 8, -h.h / 2 - 28);
      ctx.lineTo(i * 8, -h.h / 2 - 20);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -h.h / 2 - 8, 4, 3);
    ctx.fillRect(3, -h.h / 2 - 8, 4, 3);
    ctx.fillStyle = '#333';
    ctx.fillRect(-5, -h.h / 2 - 7, 2, 2);
    ctx.fillRect(4, -h.h / 2 - 7, 2, 2);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -h.h / 2 - 13);
    ctx.lineTo(-2, -h.h / 2 - 10);
    ctx.moveTo(8, -h.h / 2 - 13);
    ctx.lineTo(2, -h.h / 2 - 10);
    ctx.stroke();
    // Arms and hands
    {
      const armY = -h.h / 2 + 14;
      const armSwing = Math.sin(h.walkFrame * 2) * 3;
      const isThrowing = h.throwTimer > 0;
      // Sleeves
      ctx.fillStyle = h.anger > 70 ? '#b71c1c' : h.anger > 40 ? '#c62828' : '#3e2723';
      ctx.fillRect(-h.w / 2 - 4, armY - 4, 8, 8);
      ctx.fillRect(h.w / 2 - 4, armY - 4, 8, 8);
      // Arms (skin)
      ctx.strokeStyle = '#ffccbc';
      ctx.lineWidth = 4;
      // Left arm
      ctx.beginPath();
      ctx.moveTo(-h.w / 2 + 2, armY);
      ctx.lineTo(-h.w / 2 - 6 + armSwing, armY + 10);
      ctx.stroke();
      // Left hand
      const lhx = -h.w / 2 - 6 + armSwing;
      const lhy = armY + 10;
      ctx.fillStyle = '#ffccbc';
      ctx.beginPath();
      ctx.arc(lhx, lhy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0a080';
      ctx.fillRect(lhx - 3, lhy - 7, 2, 3);
      ctx.fillRect(lhx + 1, lhy - 7, 2, 3);
      ctx.strokeStyle = '#ffccbc';
      ctx.lineWidth = 4;
      // Right arm
      ctx.beginPath();
      ctx.moveTo(h.w / 2 - 2, armY);
      if (isThrowing) {
        const armProgress = h.throwTimer / 10;
        const armExt = 12 + (1 - armProgress) * 30;
        ctx.lineTo(h.w / 2 + armExt, armY - 4);
        ctx.stroke();
        const rhx = h.w / 2 + armExt + 3;
        const rhy = armY - 4;
        ctx.fillStyle = '#ffccbc';
        ctx.beginPath();
        ctx.arc(rhx, rhy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0a080';
        ctx.fillRect(rhx - 3, rhy - 7, 2, 3);
        ctx.fillRect(rhx + 1, rhy - 7, 2, 3);
        if (armProgress > 0.3) {
          const foodAngle = (1 - armProgress) * 1.2;
          const fx = rhx + Math.cos(foodAngle) * 8;
          const fy = rhy - Math.sin(foodAngle) * 6;
          ctx.fillStyle = '#795548';
          ctx.fillRect(fx - 3, fy - 3, 6, 6);
        }
      } else {
        ctx.lineTo(h.w / 2 + 6 - armSwing, armY + 10);
        ctx.stroke();
        const rhx = h.w / 2 + 6 - armSwing;
        const rhy = armY + 10;
        ctx.fillStyle = '#ffccbc';
        ctx.beginPath();
        ctx.arc(rhx, rhy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0a080';
        ctx.fillRect(rhx - 3, rhy - 7, 2, 3);
        ctx.fillRect(rhx + 1, rhy - 7, 2, 3);
      }
    }
    // Run legs
    {
      const legSwing = Math.sin(h.walkFrame * 3) * 4;
      const legTop = h.h / 2 - 4;
      const legH = Math.min(16, (canvas.height - 20) - (h.y + h.shakeY) - legTop);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(-8, legTop + legSwing, 6, legH);
      ctx.fillRect(2, legTop - legSwing, 6, legH);
    }
    ctx.restore();

    // Player
    const p = sh.player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.scale(1 + p.squash * 0.4, 1 - p.squash * 0.4);
    ctx.translate(-p.w / 2, -p.h / 2);
    const legSwing = Math.sin(p.walkFrame * 3) * 3;
    ctx.fillStyle = '#c62828';
    ctx.fillRect(3, 8, p.w - 6, p.h - 8);
    if (p.onGround && Math.abs(p.walkFrame) > 0.1) {
      ctx.fillStyle = '#8b1a1a';
      ctx.fillRect(4, p.h - 4 + legSwing, 4, 6);
      ctx.fillRect(14, p.h - 4 - legSwing, 4, 6);
    }
    ctx.beginPath();
    ctx.arc(p.w / 2, 6, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffccbc';
    ctx.fill();
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(2, -2, p.w - 4, 5);
    if (p.hasRotten) {
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(-4, -6, 8, 6);
      ctx.fillStyle = '#2e7d32';
      ctx.fillRect(-2, -4, 3, 3);
    }
    ctx.restore();

    // Thrown food
    const food = sh.food;
    for (let fi = 0; fi < food.length; fi++) {
      const f = food[fi];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      ctx.fillStyle = f.isRotten ? '#4caf50' : '#ff9800';
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-f.w / 4, -f.h / 4, f.w / 3, f.h / 3);
      ctx.restore();
    }

    // Incoming food
    const inc = sh.incoming;
    for (let ii = 0; ii < inc.length; ii++) {
      const f = inc[ii];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);
      ctx.fillStyle = '#795548';
      ctx.fillRect(-f.r, -f.r, f.r * 2, f.r * 2);
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(-f.r * 0.5, -f.r * 0.5, f.r, f.r);
      ctx.restore();
    }

    renderParticles();

    // HUD
    ctx.fillStyle = '#d4a017';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Score: ' + sh.score, 10, 30);
    ctx.fillText('Hits: ' + sh.hits + '/' + sh.maxHits, 10, 50);
    if (sh.player.hasRotten) {
      ctx.fillStyle = '#4caf50';
      ctx.fillText('Rotten food ready!', canvas.width / 2 - 65, 50);
    }
    endShake();
  }

  /* ========================================
     GAME 4: ROYAL RUN — 5 Levels
     ======================================== */
  let rr = {};

   const rrLevels = {
    1: { // Level 1
      name: 'The Banquet Hall', width: 3000, guardCount: 5, tableCount: 8, jewelCount: 10, crownCount: 3,
      guardSpeed: 1.5, speedMul: 1, groundColor1: '#8d6e63', groundColor2: '#6d4c41',
      bgTop: '#bbdefb', bgMid: '#e3f2fd', bgBot: '#90caf9', exitMsg: 'Queen Vashti escaped to freedom!'
    },
    2: {
      name: 'The Courtyard', width: 3200, guardCount: 5, tableCount: 10, jewelCount: 12, crownCount: 4,
      guardSpeed: 1.7, speedMul: 1.1, groundColor1: '#6d4c41', groundColor2: '#5d4037',
      bgTop: '#b3e5fc', bgMid: '#e1f5fe', bgBot: '#81d4fa', exitMsg: 'Through the courtyard!'
    },
    3: {
      name: 'The Gardens', width: 3400, guardCount: 5, tableCount: 12, jewelCount: 14, crownCount: 5,
      guardSpeed: 1.9, speedMul: 1.2, groundColor1: '#4caf50', groundColor2: '#388e3c',
      bgTop: '#c8e6c9', bgMid: '#e8f5e9', bgBot: '#a5d6a7', exitMsg: 'The gardens are behind you!'
    },
    4: {
      name: 'The Throne Room', width: 3600, guardCount: 5, tableCount: 14, jewelCount: 16, crownCount: 6,
      guardSpeed: 2.1, speedMul: 1.3, groundColor1: '#795548', groundColor2: '#5d4037',
      bgTop: '#ffe0b2', bgMid: '#fff3e0', bgBot: '#ffcc80', exitMsg: 'Past the throne! Almost there!'
    },
    5: {
      name: 'The Escape', width: 3800, guardCount: 5, tableCount: 16, jewelCount: 18, crownCount: 7,
      guardSpeed: 2.3, speedMul: 1.4, groundColor1: '#66bb6a', groundColor2: '#43a047',
      bgTop: '#bbdefb', bgMid: '#e3f2fd', bgBot: '#90caf9', exitMsg: 'Freedom at last!'
    }
  };

  function initRoyalRun() {
    const lvl = Math.min(Math.max(currentLevel || 1, 1), 5);
    const cfg = rrLevels[lvl];
    const gY = 385;

    rr = {
      player: { x: 100, y: 350, w: 25, h: 35, vx: 0, vy: 0, onGround: true, runFrame: 0, squash: 0, dressSway: 0, invincible: 0 },
      player2: null,
      guards: [],
      tables: [],
      obstacles: [],
      jewels: [],
      crowns: [],
      camera: 0,
      levelWidth: cfg.width,
      groundY: gY,
      score: 0,
      jewelsCollected: 0,
      gameOver: false,
      frame: 0,
      hits: 0,
      maxHits: 5,
      speed: 0,
      reachedExit: false,
      exitX: 0,
      level: lvl,
      cfg: cfg,
      levelTitleTimer: 120
    };

    // Tables
    if (cfg.tableCount > 0) {
      for (let i = 0; i < cfg.tableCount; i++) {
        const x = 350 + i * ((cfg.width - 600) / cfg.tableCount) + Math.random() * 30;
        rr.tables.push({ x, y: gY - 25, w: 60, h: 25, knocked: false, wobble: 0 });
      }
    }

    // Find first obstacle position
    let firstObsX = 300;
    if (lvl === 2) {
      for (let i = 0; i < 6; i++) {
        const wx = 400 + i * 480;
        rr.obstacles.push({ x: wx, y: gY - 50, w: 12, h: 50, type: 'wall' });
        rr.obstacles.push({ x: wx + 200, y: gY - 30, w: 12, h: 30, type: 'wall' });
      }
      firstObsX = 400;
    } else if (lvl === 3) {
      for (let i = 0; i < 8; i++) {
        const hx = 350 + i * 440;
        rr.obstacles.push({ x: hx, y: gY - 28, w: 50, h: 28, type: 'hedge' });
      }
      firstObsX = 350;
    } else if (lvl === 4) {
      for (let i = 0; i < 5; i++) {
        const cx = 400 + i * 500 + Math.random() * 80;
        rr.obstacles.push({ x: cx, y: gY - 35, w: 40, h: 35, type: 'crate' });
        rr.obstacles.push({ x: cx + 200, y: gY - 30, w: 50, h: 30, type: 'cart' });
      }
      firstObsX = 400;
    } else if (lvl === 5) {
      for (let i = 0; i < 6; i++) {
        const rx = 400 + i * 700 + Math.random() * 200;
        rr.obstacles.push({ x: rx, y: gY - 25, w: 30, h: 25, type: 'rock' });
      }
      firstObsX = 400;
    }
    rr.firstObstacleX = firstObsX;
    rr.obstaclePassed = false;

    // Guards (start behind player, chase after first obstacle)
    const guardCount = isMultiplayer ? 1 : cfg.guardCount;
    for (let i = 0; i < guardCount; i++) {
      rr.guards.push({
        x: i * 15, y: gY - 30, w: 22, h: 30,
        speed: cfg.guardSpeed + i * 0.25 + (lvl - 1) * 0.15,
        dir: 1,
        caught: false, runFrame: 0
      });
    }

    // Jewels
    for (let i = 0; i < cfg.jewelCount; i++) {
      rr.jewels.push({
        x: 150 + i * ((cfg.width - 300) / cfg.jewelCount) + Math.random() * 30,
        y: gY - 80 - Math.random() * 80,
        collected: false, bobOffset: Math.random() * Math.PI * 2,
        sparkle: Math.random() * Math.PI * 2
      });
    }

    // Crowns
    for (let i = 0; i < cfg.crownCount; i++) {
      rr.crowns.push({
        x: 350 + i * ((cfg.width - 500) / cfg.crownCount),
        y: gY - 130 - Math.random() * 40,
        collected: false, bobOffset: Math.random() * Math.PI * 2
      });
    }

    rr.exitX = cfg.width - 200;
    particles = [];
    gameLoop(updateRoyalRun, renderRoyalRun);
  }

  function updateRoyalRun() {
    if (isPaused) return;
    rr.frame++;
    if (rr.levelTitleTimer > 0) rr.levelTitleTimer--;

    let moveInput = 0;
    const players = [rr.player];
    const p1Alt = isMultiplayer ? player1Scheme === 'arrows' : player1Scheme === 'arrows';
    const p1Right = p1Alt ? 'ArrowRight' : 'd';
    const p1Left = p1Alt ? 'ArrowLeft' : 'a';
    const p1Up = p1Alt ? 'ArrowUp' : 'w';
    const p1Down = p1Alt ? 'ArrowDown' : 's';
    const p2Right = p1Alt ? 'd' : 'ArrowRight';
    const p2Left = p1Alt ? 'a' : 'ArrowLeft';
    const p2Up = p1Alt ? 'w' : 'ArrowUp';
    const p2Down = p1Alt ? 's' : 'ArrowDown';
    if (!isMultiplayer) {
      moveInput = (keys[p1Right] ? 1 : 0) - (keys[p1Left] ? 1 : 0);
      applyPlayerPhysics(rr.player, moveInput, wasPressed(p1Up), keys[p1Down]);
    } else {
      // Two-player: character picker determines who controls Vashti
      const vashtiP1 = player1Character === 'vashti';
      const vashtiMove = vashtiP1
        ? (keys[p1Right] ? 1 : 0) - (keys[p1Left] ? 1 : 0)
        : (keys[p2Right] ? 1 : 0) - (keys[p2Left] ? 1 : 0);
      const vashtiJump = vashtiP1 ? wasPressed(p1Up) : wasPressed(p2Up);
      const vashtiDuck = vashtiP1 ? keys[p1Down] : keys[p2Down];
      applyPlayerPhysics(rr.player, vashtiMove, vashtiJump, vashtiDuck);
    }

    function applyPlayerPhysics(p, move, jumpPressed, duckHeld) {
      p.vy += 0.5;
      p.y += p.vy;
      if (p.y + p.h > rr.groundY) {
        if (p.vy > 3) p.squash = 0.3;
        p.y = rr.groundY - p.h;
        p.vy = 0;
        p.onGround = true;
      }
      if (p.squash < 0) p.squash += 0.04;
      if (p.squash > 0) p.squash *= 0.85;
      if (Math.abs(p.squash) < 0.01) p.squash = 0;
      p.x += move * 4;
      if (move !== 0) p.runFrame += Math.abs(move) * 4 * 0.05;
      else p.runFrame *= 0.9;
      p.dressSway = Math.sin(p.runFrame * 2) * 3;
      p.x = Math.max(0, Math.min(rr.levelWidth - p.w, p.x));
      if (jumpPressed && p.onGround) { p.vy = -12; p.onGround = false; p.squash = -0.3; sfxJump(); }
      if (duckHeld) p.h = 16; else p.h = 35;
    }

    // Obstacle collision (costs a life)
    for (let pi = 0; pi < players.length; pi++) {
      const p = players[pi];
      if (p.invincible > 0) p.invincible--;
      for (let oi = 0; oi < rr.obstacles.length; oi++) {
        const o = rr.obstacles[oi];
        if (p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h && p.y + p.h > o.y) {
          p.x = Math.max(0, o.x - p.w);
          if (p.invincible <= 0) {
            p.invincible = 30;
            rr.hits++;
            triggerShake(6);
            spawnParticles(o.x + o.w / 2, o.y + o.h / 2, '#8d6e63', 6, 3);
            sfxHit();
            if (rr.hits >= rr.maxHits) {
              sfxLose();
              endGame(false, rr.score, 'You crashed into obstacles too many times!');
            }
          }
        }
      }
    }

    rr.camera = Math.max(0, Math.min(rr.levelWidth - canvas.width, rr.player.x - canvas.width / 3));

    // Tables
    for (let ti = 0; ti < rr.tables.length; ti++) {
      const t = rr.tables[ti];
      if (t.knocked) { if (t.wobble > 0) t.wobble *= 0.8; continue; }
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (p.x < t.x + t.w && p.x + p.w > t.x && p.y < t.y + t.h && p.y + p.h > t.y) {
          t.knocked = true; t.wobble = 1; rr.score += 50;
          spawnParticles(t.x + t.w / 2, t.y + t.h / 2, '#795548', 6, 3);
          spawnScorePopup(t.x + t.w / 2, t.y - 10, '+50', '#d4a017');
          sfxCollect();
          for (let gi = 0; gi < rr.guards.length; gi++) {
            if (rr.guards[gi].x > t.x - 50 && rr.guards[gi].x < t.x + 100) rr.guards[gi].speed *= 0.7;
          }
          break;
        }
      }
    }

    // Activate guards after player passes first obstacle
    if (!rr.obstaclePassed && rr.player.x >= rr.firstObstacleX) rr.obstaclePassed = true;

    // Guards (AI chase or player-controlled)
    const guardP1 = isMultiplayer && player1Character === 'guard';
    for (let gi = 0; gi < rr.guards.length; gi++) {
      const g = rr.guards[gi];
      if (g.caught) continue;
      if (!rr.obstaclePassed) continue;
      if (isMultiplayer) {
        // Player-controlled guard uses the opposite key set from Vashti
        const gRight = guardP1 ? p1Right : p2Right;
        const gLeft = guardP1 ? p1Left : p2Left;
        const gMove = (keys[gRight] ? 1 : 0) - (keys[gLeft] ? 1 : 0);
        g.x += gMove * g.speed * 2;
        g.dir = gMove > 0 ? 1 : gMove < 0 ? -1 : g.dir;
        g.runFrame += g.speed * 0.08;
      } else {
        // AI chase Vashti
        const distToPlayer = rr.player.x - g.x;
        g.dir = distToPlayer > 0 ? 1 : -1;
        g.x += g.speed * g.dir * 1.5;
        g.runFrame += g.speed * 0.08;
      }
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (p.invincible > 0) continue;
        if (g.x > p.x - 20 && g.x < p.x + p.w + 20 && Math.abs(g.y - p.y) < 40) {
          g.caught = true; rr.hits++;
          p.invincible = 30;
          triggerShake(6);
          spawnParticles(g.x + g.w / 2, g.y + g.h / 2, '#1b5e20', 6, 3);
          sfxHit();
          if (rr.hits >= rr.maxHits) {
            sfxLose();
            endGame(false, rr.score, 'The guards caught you! Escape again!');
          }
          break;
        }
      }
    }

    // Jewels
    for (let ji = 0; ji < rr.jewels.length; ji++) {
      const j = rr.jewels[ji];
      if (j.collected) continue;
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (Math.abs(p.x + p.w / 2 - j.x) < 20 && Math.abs(p.y + p.h / 2 - j.y) < 20) {
          j.collected = true; rr.jewelsCollected++; rr.score += 25;
          spawnParticles(j.x, j.y, '#e53935', 5, 2);
          spawnScorePopup(j.x, j.y - 10, '+25', '#e53935');
          sfxCollect();
          break;
        }
      }
    }

    // Crowns
    for (let ci = 0; ci < rr.crowns.length; ci++) {
      const c = rr.crowns[ci];
      if (c.collected) continue;
      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        if (Math.abs(p.x + p.w / 2 - c.x) < 20 && Math.abs(p.y + p.h / 2 - c.y) < 20) {
          c.collected = true; rr.score += 100;
          spawnParticles(c.x, c.y, '#d4a017', 8, 3);
          spawnScorePopup(c.x, c.y - 10, '+100', '#d4a017');
          sfxCombo();
          break;
        }
      }
    }

    // Win (Vashti reaches exit)
    if (rr.player.x >= rr.exitX) {
      spawnParticles(rr.exitX + 30, rr.groundY - 40, '#d4a017', 30, 6);
      spawnParticles(rr.exitX + 30, rr.groundY - 40, '#ffcc00', 20, 5);
      sfxWin();
      const next = rr.level + 1;
      const msg = next > 5 ? 'You escaped all levels! Queen Vashti is free!' : rr.cfg.exitMsg;
      endGame(true, rr.score, msg);
    }

    updateParticles();
    updateDisplay(rr.score, rr.maxHits - rr.hits);
  }

  function renderRoyalRun() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyShake();

    const cfg = rr.cfg;
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, cfg.bgTop);
    grad.addColorStop(0.5, cfg.bgMid);
    grad.addColorStop(1, cfg.bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Level title
    if (rr.levelTitleTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, rr.levelTitleTimer / 40);
      ctx.fillStyle = '#4e342e';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.name, canvas.width / 2, 120);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#6d4c41';
      ctx.fillText('Level ' + rr.level, canvas.width / 2, 155);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    ctx.save();
    ctx.translate(-rr.camera, 0);

    // Ground
    ctx.fillStyle = cfg.groundColor1;
    ctx.fillRect(0, rr.groundY, rr.levelWidth, canvas.height - rr.groundY);
    ctx.fillStyle = cfg.groundColor2;
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(i * 60, rr.groundY, 28, 8);
    }

    // Background decorations
    if (rr.level === 1) {
      // Banquet hall arches
      ctx.fillStyle = '#d7ccc8';
      for (let i = 0; i < 14; i++) {
        const ax = i * 240;
        ctx.fillRect(ax, 0, 10, rr.groundY);
        ctx.fillRect(ax + 230, 0, 10, rr.groundY);
        ctx.beginPath();
        ctx.arc(ax + 120, 0, 120, Math.PI, 0);
        ctx.fill();
      }
    } else if (rr.level === 2) {
      // Corridor torches
      ctx.fillStyle = '#4e342e';
      for (let i = 0; i < 16; i++) {
        const tx = i * 250 + 30;
        ctx.fillRect(tx, rr.groundY - 140, 6, 40);
        ctx.fillStyle = `rgba(255, 160, 0, ${0.4 + 0.3 * Math.sin(rr.frame * 0.05 + i)})`;
        ctx.beginPath();
        ctx.arc(tx + 3, rr.groundY - 145, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4e342e';
      }
    } else if (rr.level === 3) {
      // Garden flowers
      for (let i = 0; i < 20; i++) {
        const fx = i * 220 + (i % 3) * 40;
        ctx.fillStyle = ['#e91e63', '#ff9800', '#9c27b0'][i % 3];
        ctx.fillRect(fx, rr.groundY - 12, 6, 12);
        ctx.fillRect(fx + 3, rr.groundY - 18, 2, 8);
      }
    } else if (rr.level === 4) {
      // City buildings in background
      ctx.fillStyle = '#8d6e63';
      for (let i = 0; i < 12; i++) {
        const bx = i * 350;
        const bh = 80 + (i % 3) * 40;
        ctx.fillRect(bx, rr.groundY - bh, 160, bh);
        ctx.fillStyle = '#a1887f';
        ctx.fillRect(bx + 10, rr.groundY - bh + 10, 20, 20);
        ctx.fillRect(bx + 50, rr.groundY - bh + 10, 20, 20);
        ctx.fillRect(bx + 100, rr.groundY - bh + 10, 20, 20);
        ctx.fillStyle = '#8d6e63';
      }
    } else if (rr.level === 5) {
      // Sky with clouds
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 10; i++) {
        const cx = i * 550 + Math.sin(i * 2.7) * 100;
        ctx.beginPath();
        ctx.arc(cx, 40 + (i % 3) * 30, 25 + (i % 2) * 15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Obstacles
    for (let oi = 0; oi < rr.obstacles.length; oi++) {
      const o = rr.obstacles[oi];
      if (o.type === 'wall') {
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#795548';
        ctx.fillRect(o.x - 2, o.y, o.w + 4, 4);
      } else if (o.type === 'hedge') {
        ctx.fillStyle = '#388e3c';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 6);
        ctx.fillRect(o.x + 4, o.y + 10, o.w - 8, 6);
        ctx.fillRect(o.x + 2, o.y + 18, o.w - 4, 6);
      } else if (o.type === 'crate') {
        ctx.fillStyle = '#8d6e63';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 2);
        ctx.fillRect(o.x + 4, o.y + o.h / 2, o.w - 8, 2);
      } else if (o.type === 'cart') {
        ctx.fillStyle = '#4e342e';
        ctx.fillRect(o.x, o.y + 5, o.w, o.h - 5);
        ctx.fillStyle = '#795548';
        ctx.fillRect(o.x - 4, o.y, o.w + 8, 6);
        ctx.fillStyle = '#ff9800';
        ctx.fillRect(o.x + 10, o.y - 4, 8, 8);
        ctx.fillRect(o.x + 30, o.y - 4, 8, 8);
      } else if (o.type === 'rock') {
        ctx.fillStyle = '#757575';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#9e9e9e';
        ctx.fillRect(o.x + 4, o.y + 2, o.w - 8, 4);
      }
    }

    // Tables
    for (let ti = 0; ti < rr.tables.length; ti++) {
      const t = rr.tables[ti];
      if (t.knocked) {
        ctx.fillStyle = '#795548';
        ctx.fillRect(t.x, t.y + 15, t.w, 8);
        continue;
      }
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(t.x, t.y + 5, t.w, t.h - 5);
      ctx.fillStyle = '#795548';
      ctx.fillRect(t.x - 5, t.y, t.w + 10, 6);
      ctx.fillStyle = '#ff9800';
      ctx.fillRect(t.x + 12, t.y - 5, 10, 10);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(t.x + 37, t.y - 4, 8, 8);
    }

    // Guards (Joshua's Spies style)
    for (let gi = 0; gi < rr.guards.length; gi++) {
      const g = rr.guards[gi];
      if (g.caught) continue;
      const bobY = Math.sin(g.runFrame * 2) * 2;
      // Direction based on movement (always running right = chasing player)
      const sDir = g.dir;
      // Legs
      const legSwing = Math.sin(g.runFrame * 3) * 3;
      ctx.fillStyle = '#37474f';
      ctx.fillRect(g.x + 4, g.y + g.h - 8 + legSwing + bobY, 4, 8);
      ctx.fillRect(g.x + 14, g.y + g.h - 8 - legSwing + bobY, 4, 8);
      // Boots
      ctx.fillStyle = '#1a237e';
      ctx.fillRect(g.x + 3, g.y + g.h + legSwing + bobY, 6, 4);
      ctx.fillRect(g.x + 13, g.y + g.h - legSwing + bobY, 6, 4);
      // Body (tunic)
      ctx.fillStyle = '#c62828';
      ctx.fillRect(g.x + 2, g.y + bobY, g.w - 4, g.h - 8);
      // Belt
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(g.x + 2, g.y + g.h - 16 + bobY, g.w - 4, 3);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(g.x + g.w / 2 - 2, g.y + g.h - 16 + bobY, 4, 3);
      // Arms
      ctx.fillStyle = '#ffccbc';
      const gArm = Math.sin(g.runFrame * 3) * 2;
      ctx.fillRect(g.x - 2, g.y + 8 + gArm + bobY, 3, 10);
      ctx.fillRect(g.x + g.w - 1, g.y + 8 - gArm + bobY, 3, 10);
      // Sword
      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(g.x + g.w / 2 - 1 + sDir * 12, g.y + 4 + bobY, 2, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(g.x + g.w / 2 - 1 + sDir * 12, g.y + 4 + bobY, 2, 12);
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(g.x + g.w / 2 - 3 + sDir * 12, g.y + 18 + bobY, 6, 3);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(g.x + g.w / 2 - 2 + sDir * 12, g.y + 17 + bobY, 4, 1);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(g.x + g.w / 2 - 2 + sDir * 12, g.y + 21 + bobY, 4, 4);
      // Head
      ctx.beginPath();
      ctx.arc(g.x + g.w / 2, g.y - 2 + bobY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffccbc';
      ctx.fill();
      // Helmet
      ctx.fillStyle = '#757575';
      ctx.beginPath();
      ctx.arc(g.x + g.w / 2, g.y - 5 + bobY, 9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(g.x + 2, g.y - 5 + bobY, g.w - 4, 4);
      ctx.fillStyle = '#616161';
      ctx.fillRect(g.x, g.y + bobY, g.w, 2);
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(g.x + 5, g.y - 3 + bobY, 3, 2);
      ctx.fillRect(g.x + 14, g.y - 3 + bobY, 3, 2);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(g.x + 6, g.y - 3 + bobY, 1.5, 2);
      ctx.fillRect(g.x + 15, g.y - 3 + bobY, 1.5, 2);
    }
    // Label for two-player: "Five Guards" above the single guard
    if (isMultiplayer && rr.guards.length === 1 && !rr.guards[0].caught) {
      const g = rr.guards[0];
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Five Guards', g.x + g.w / 2, g.y - 18);
      ctx.textAlign = 'left';
    }

    // Jewels
    for (let ji = 0; ji < rr.jewels.length; ji++) {
      const j = rr.jewels[ji];
      if (j.collected) continue;
      const bobY = Math.sin(rr.frame * 0.05 + j.bobOffset) * 3;
      ctx.fillStyle = '#e53935';
      ctx.fillRect(j.x - 5, j.y + bobY - 5, 10, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(j.x - 2, j.y + bobY - 2, 3, 3);
    }

    // Crowns
    for (let ci = 0; ci < rr.crowns.length; ci++) {
      const c = rr.crowns[ci];
      if (c.collected) continue;
      const bobY = Math.sin(rr.frame * 0.04 + c.bobOffset) * 4;
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(c.x - 10, c.y + bobY, 20, 6);
      ctx.fillRect(c.x - 5, c.y - 5 + bobY, 10, 5);
      for (let pi = 0; pi < 3; pi++) {
        ctx.fillRect(c.x - 5 + pi * 7, c.y - 8 + bobY, 4, 4);
      }
    }

    // Exit
    const exitGlow = 0.3 + 0.3 * Math.sin(rr.frame * 0.05);
    ctx.fillStyle = `rgba(198, 40, 40, ${exitGlow * 0.3})`;
    ctx.beginPath();
    ctx.arc(rr.exitX + 30, rr.groundY - 40, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c62828';
    ctx.fillRect(rr.exitX, rr.groundY - 80, 60, 80);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(rr.exitX + 5, rr.groundY - 75, 50, 75);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('EXIT', rr.exitX + 8, rr.groundY - 35);

    // Players
    function drawRoyalRunPlayer(p, color1, color2) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.scale(1 + p.squash * 0.4, 1 - p.squash * 0.4);
      ctx.translate(-p.w / 2, -p.h / 2);
      const dressSwing = p.dressSway;
      const bounce = Math.sin(p.runFrame * 2) * 1.5;
      ctx.fillStyle = color1 || '#c62828';
      ctx.beginPath();
      ctx.moveTo(0, p.h);
      ctx.lineTo(dressSwing - 5, p.h + 10 + bounce);
      ctx.lineTo(p.w + dressSwing + 5, p.h + 10 + bounce);
      ctx.lineTo(p.w, p.h);
      ctx.fill();
      ctx.fillStyle = color2 || '#8b1a1a';
      ctx.fillRect(3, 8, p.w - 6, p.h - 8);
      ctx.beginPath();
      ctx.arc(p.w / 2, 6 + bounce * 0.3, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffccbc';
      ctx.fill();
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(5, -4 + bounce * 0.3, p.w - 10, 5);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(5 + i * 5, -4 + bounce * 0.3);
        ctx.lineTo(7 + i * 5, -10 + bounce * 0.3);
        ctx.lineTo(9 + i * 5, -4 + bounce * 0.3);
        ctx.fill();
      }
      ctx.restore();
    }
    drawRoyalRunPlayer(rr.player, '#c62828', '#8b1a1a');

    renderParticles();
    endShake();

    // HUD
    ctx.fillStyle = '#333';
    ctx.font = '16px sans-serif';
    ctx.fillText('Score: ' + rr.score, 10, 30);
    ctx.fillText('Level ' + rr.level + ': ' + rr.cfg.name, 10, 52);
    ctx.fillText('Lives: ' + (rr.maxHits - rr.hits), canvas.width - 120, 30);

    const progress = Math.min(1, rr.player.x / rr.exitX);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(10, canvas.height - 20, canvas.width - 20, 12);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(10, canvas.height - 20, (canvas.width - 20) * progress, 12);
  }

  /* ---------- GAME LOOP ---------- */
  function gameLoop(update, render) {
    if (!gameRunning) return;

    update();
    render();

    prevKeys = { ...keys };
    animFrameId = requestAnimationFrame(() => gameLoop(update, render));
  }

  /* ---------- DISPLAY UPDATE ---------- */
  function updateDisplay(score, lives) {
    scoreDisp.textContent = 'Score: ' + score;
    livesDisp.textContent = 'Lives: ' + lives;
    const hs = getHighScores()[currentGame] || 0;
    highScoreDisp.textContent = 'Best: ' + hs;
  }

  /* ---------- TOUCH CONTROLS ---------- */
  (function initTouchControls() {
    let touchStartX = 0, touchStartY = 0;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (dx < -20) { keys['a'] = true; keys['d'] = false; keys['ArrowLeft'] = true; keys['ArrowRight'] = false; }
      else if (dx > 20) { keys['a'] = false; keys['d'] = true; keys['ArrowLeft'] = false; keys['ArrowRight'] = true; }
      else { keys['a'] = false; keys['d'] = false; keys['ArrowLeft'] = false; keys['ArrowRight'] = false; }
      if (dy < -30) { keys['w'] = true; keys['ArrowUp'] = true; }
      if (dy > 30) { keys['s'] = true; keys['ArrowDown'] = true; }
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      keys['a'] = keys['d'] = keys['w'] = keys['s'] = false;
      keys['ArrowLeft'] = keys['ArrowRight'] = keys['ArrowUp'] = keys['ArrowDown'] = false;
      keys[' '] = false;
    }, { passive: false });
  })();

  /* ---------- INIT ---------- */
  renderHighScores();

})();
