// 回転寿司へいお待ち
(() => {
  'use strict';

  // ===== 基本設定 =====
  const W = 960, H = 760;
  const GAME_TIME = 90;      // 秒
  const ANGRY_LIMIT = 5;     // 怒って帰った人数の上限
  const SEAT_COUNT = 5;

  const SUSHI = [
    { id: 'maguro',  name: 'マグロ',   price: 150, plate: '#c0392b', key: '1' },
    { id: 'hamachi', name: 'ハマチ',   price: 150, plate: '#2e86c1', key: '2' },
    { id: 'salmon',  name: 'サーモン', price: 120, plate: '#27ae60', key: '3' },
    { id: 'ikura',   name: 'いくら',   price: 250, plate: '#d4ac0d', key: '4' },
    { id: 'uni',     name: 'うに',     price: 300, plate: '#1c1c1c', key: '5' },
  ];

  // ===== レーン（ループ）形状 =====
  const TRACK = { x1: 130, x2: 830, yTop: 240, yBot: 420, r: 90 };
  const CY = (TRACK.yTop + TRACK.yBot) / 2;
  const STRAIGHT = TRACK.x2 - TRACK.x1;
  const ARC = Math.PI * TRACK.r;
  const L = STRAIGHT * 2 + ARC * 2;
  const SLOT_COUNT = 30;
  const SP = L / SLOT_COUNT;
  const FLY_TIME = 0.28;
  const MAX_DIST = L * 2;    // 2周で廃棄

  const mod = (a, m) => ((a % m) + m) % m;

  function posAt(s) {
    s = mod(s, L);
    const { x1, x2, yTop, yBot, r } = TRACK;
    if (s < STRAIGHT) return { x: x1 + s, y: yTop };
    s -= STRAIGHT;
    if (s < ARC) { const a = -Math.PI / 2 + s / r; return { x: x2 + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
    s -= ARC;
    if (s < STRAIGHT) return { x: x2 - s, y: yBot };
    s -= STRAIGHT;
    const a = Math.PI / 2 + s / r;
    return { x: x1 + r * Math.cos(a), y: CY + r * Math.sin(a) };
  }

  // 席（レーン上部の直線に沿って並ぶ）
  const SEATS = [];
  for (let i = 0; i < SEAT_COUNT; i++) {
    const x = 200 + i * 140;
    SEATS.push({ x, s: x - TRACK.x1, customer: null });
  }
  const CHEF = { x: 480, y: 335 };

  // 具材ボタン
  const BTN = { y: 490, h: 240, w: 172, gap: 14 };
  const BTN_X0 = (W - (BTN.w * 5 + BTN.gap * 4)) / 2;
  const buttons = SUSHI.map((s, i) => ({ sushi: s, x: BTN_X0 + i * (BTN.w + BTN.gap), y: BTN.y, w: BTN.w, h: BTN.h, press: 0 }));

  // ===== キャンバス =====
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let ratio = 1;
  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
    ratio = scale * dpr;
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
  }
  window.addEventListener('resize', resize);
  resize();

  // ===== サウンド =====
  let actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, delay = 0) {
    const a = actx; if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    tap() { tone(660, 0.08, 'triangle', 0.12); },
    serve() { tone(880, 0.12, 'sine', 0.15); tone(1320, 0.18, 'sine', 0.13, 0.08); },
    wrong() { tone(200, 0.2, 'square', 0.07); },
    angry() { tone(300, 0.2, 'sawtooth', 0.08); tone(180, 0.3, 'sawtooth', 0.08, 0.15); },
    waste() { tone(150, 0.15, 'triangle', 0.1); },
    full() { tone(120, 0.25, 'square', 0.06); },
  };

  // ===== BGM（コミカルなオリジナル曲を WebAudio で生成） =====
  const BGM = (() => {
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    // メロディ: 1小節 = 8分音符×8、0は休符
    const MEL = [
      79, 0, 76, 0, 79, 0, 76, 0,
      77, 76, 75, 76, 72, 0, 0, 0,
      74, 0, 77, 0, 74, 0, 77, 0,
      79, 78, 79, 81, 79, 0, 0, 0,
      79, 0, 76, 0, 79, 0, 84, 0,
      83, 81, 79, 77, 76, 0, 72, 0,
      74, 0, 77, 76, 74, 0, 71, 0,
      72, 0, 79, 0, 72, 0, 0, 0,
    ];
    // 各小節のコード [ルート, 3度, 5度]
    const CHORDS = [
      [48, 52, 55], [48, 52, 55], [43, 50, 53], [43, 47, 50],
      [48, 52, 55], [41, 45, 48], [43, 47, 53], [48, 52, 55],
    ];
    const STEPS = MEL.length;
    let master = null, noise = null, timer = null, step = 0, nextTime = 0, tempoFn = () => 140;
    let enabled = true;
    try { enabled = localStorage.getItem('sushi-bgm') !== 'off'; } catch (e) { /* ignore */ }

    function setup() {
      const a = actx;
      if (!a || master) return;
      master = a.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      master.connect(a.destination);
      noise = a.createBuffer(1, a.sampleRate * 0.2, a.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function osc(type, freq, t, dur, vol, { slideTo, filter } = {}) {
      const a = actx;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (filter) {
        const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
        o.connect(f); node = f;
      }
      node.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function woodblock(t, vol) {
      const a = actx;
      const s = a.createBufferSource(); s.buffer = noise;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 8;
      const g = a.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f).connect(g).connect(master);
      s.start(t); s.stop(t + 0.06);
    }
    function scheduleStep(i, t, sd) {
      const bar = Math.floor(i / 8), beat = i % 8;
      const ch = CHORDS[bar];
      // メロディ（ピコピコ木琴風・スタッカート）
      const n = MEL[i];
      if (n) {
        osc('square', midi(n), t, sd * 0.9, 0.07, { filter: 2600 });
        osc('triangle', midi(n + 12), t, sd * 0.6, 0.04);
      }
      // ブンチャッ（オンパ）ベース
      if (beat === 0) osc('triangle', midi(ch[0]), t, sd * 1.6, 0.22);
      if (beat === 4) osc('triangle', midi(ch[2] - 12), t, sd * 1.6, 0.2);
      if (beat === 2 || beat === 6) {
        ch.forEach(c => osc('square', midi(c + 12), t, sd * 0.5, 0.025, { filter: 1800 }));
      }
      // ポクポク木魚
      if (beat % 2 === 1) woodblock(t, beat === 7 ? 0.35 : 0.18);
      // 4小節目と8小節目の最後に「ひゅ〜ん」「ぼよ〜ん」
      if (bar === 3 && beat === 6) osc('sine', 600, t, sd * 2, 0.08, { slideTo: 1500 });
      if (bar === 7 && beat === 5) osc('sine', 1600, t, sd * 3, 0.09, { slideTo: 300 });
      if (bar === 7 && beat === 7) {
        const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
        o.type = 'triangle'; o.frequency.value = 110;
        lfo.frequency.value = 14; lg.gain.value = 25;
        lfo.connect(lg).connect(o.frequency);
        g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + sd * 1.8);
        o.connect(g).connect(master);
        o.start(t); lfo.start(t); o.stop(t + sd * 1.9); lfo.stop(t + sd * 1.9);
      }
    }
    function tick() {
      if (!actx) return;
      const ahead = actx.currentTime + 0.15;
      while (nextTime < ahead) {
        const sd = 60 / tempoFn() / 2;
        scheduleStep(step, nextTime, sd);
        nextTime += sd;
        step = (step + 1) % STEPS;
      }
    }
    return {
      start(fn) {
        if (!actx) return;
        setup(); this.stop();
        tempoFn = fn; step = 0; nextTime = actx.currentTime + 0.08;
        timer = setInterval(tick, 25); tick();
      },
      stop() { if (timer) { clearInterval(timer); timer = null; } },
      jingle(happy) {
        if (!actx) return;
        setup();
        const t = actx.currentTime + 0.05;
        const notes = happy ? [72, 76, 79, 84, 0, 84] : [79, 78, 77, 76];
        notes.forEach((n, i) => n && osc('square', midi(n), t + i * 0.12, happy && i === 5 ? 0.5 : 0.18, 0.08, { filter: 2600 }));
        if (!happy) osc('sine', 500, t + 0.5, 0.8, 0.1, { slideTo: 120 });
      },
      get enabled() { return enabled; },
      toggle() {
        enabled = !enabled;
        try { localStorage.setItem('sushi-bgm', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
        if (master) master.gain.setTargetAtTime(enabled ? 0.55 : 0, actx.currentTime, 0.05);
      },
    };
  })();
  const bgmTempo = () => {
    const left = GAME_TIME - elapsed;
    return left < 10 ? 176 : 138 + 26 * difficulty();
  };
  const BGM_BTN = { x: 668, y: 7, w: 64, h: 32 };

  // ===== 状態 =====
  let state = 'title';
  let elapsed, score, served, angryCount, wasted, combo, maxCombo;
  let offset, slots, spawnTimer, popups, chefShout, wrongFlash;

  function reset() {
    elapsed = 0; score = 0; served = 0; angryCount = 0; wasted = 0; combo = 0; maxCombo = 0;
    offset = 0; slots = new Array(SLOT_COUNT).fill(null);
    spawnTimer = 0.6; popups = []; chefShout = 0; wrongFlash = 0;
    SEATS.forEach(s => s.customer = null);
    buttons.forEach(b => b.press = 0);
    spawnCustomer(); spawnCustomer();
  }

  const difficulty = () => Math.min(1, elapsed / GAME_TIME);
  const beltSpeed = () => 70 + 45 * difficulty();
  const slotPos = i => mod(i * SP + offset, L);

  // ===== お客さん =====
  const SKINS = ['#f6d3b3', '#eec09a', '#d9a47a', '#f9dcc4', '#c68b5e'];
  const HAIRS = ['#2b1b10', '#4a3020', '#111', '#7a5230', '#9a9a9a', '#b5651d'];
  const SHIRTS = ['#3867d6', '#20bf6b', '#eb3b5a', '#8854d0', '#fa8231', '#4b6584', '#0fb9b1'];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  function newOrder(c) {
    c.order = pick(SUSHI);
    c.patienceMax = 22 - 9 * difficulty() + Math.random() * 3;
    c.patience = c.patienceMax;
    c.state = 'waiting';
  }

  function spawnCustomer() {
    const free = SEATS.filter(s => !s.customer);
    if (!free.length) return;
    const seat = pick(free);
    const c = {
      seat, anim: 0, state: 'arriving', plates: 0,
      skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(SHIRTS),
      style: Math.floor(Math.random() * 4), glasses: Math.random() < 0.25,
      order: null, patience: 0, patienceMax: 1, eating: null, mood: 'happy',
    };
    newOrder(c);
    c.state = 'arriving';
    seat.customer = c;
  }

  // ===== 皿を置く =====
  function serve(sushi) {
    if (state !== 'playing') return;
    audio();
    const waiting = SEATS.map(s => s.customer).filter(c => c && (c.state === 'waiting' || c.state === 'arriving'));
    const incoming = c => slots.some(p => p && p.target === c && p.sushi === c.order);

    let target = waiting
      .filter(c => c.order === sushi && !incoming(c))
      .sort((a, b) => a.patience - b.patience)[0];
    let correct = !!target;
    if (!target) {
      // 食べたい人がいない → 一番待っているお客さんの前に置かれ、そのまま流れる
      target = waiting.filter(c => !incoming(c)).sort((a, b) => a.patience - b.patience)[0] || waiting[0];
    }
    const seat = target ? target.seat : SEATS[Math.floor(SEAT_COUNT / 2)];

    // 目の前に来る（次に席を通過する）スロットを探し、埋まっていたら後ろへ
    const minD = beltSpeed() * FLY_TIME + 6;
    let k = -1, best = Infinity;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const d = mod(seat.s - slotPos(i), L);
      if (d >= minD && d < best) { best = d; k = i; }
    }
    let idx = -1;
    for (let j = 0; j < SLOT_COUNT; j++) {
      const t = mod(k - j, SLOT_COUNT);
      if (!slots[t]) { idx = t; break; }
    }
    if (idx < 0) {
      sfx.full();
      addPopup(CHEF.x, CHEF.y - 60, 'レーンがいっぱい！', '#c0392b', 22);
      return;
    }
    slots[idx] = { sushi, target, fly: 0, dist: 0, from: { x: CHEF.x, y: CHEF.y } };
    chefShout = 0.9;
    if (correct) {
      sfx.tap();
    } else {
      sfx.wrong();
      wrongFlash = 0.4;
      combo = 0;
      addPopup(CHEF.x, CHEF.y - 60, 'あっ、違った！', '#7f8c8d', 20);
    }
  }

  function addPopup(x, y, text, color, size = 24) {
    popups.push({ x, y, text, color, size, t: 0 });
  }

  // ===== 更新 =====
  function update(dt) {
    elapsed += dt;
    const d = difficulty();
    const v = beltSpeed();
    const moved = v * dt;

    chefShout = Math.max(0, chefShout - dt);
    wrongFlash = Math.max(0, wrongFlash - dt);
    buttons.forEach(b => b.press = Math.max(0, b.press - dt));

    // レーン移動 & 取る判定
    const prevOffset = offset;
    offset = mod(offset + moved, L);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const p = slots[i]; if (!p) continue;
      const prevS = mod(i * SP + prevOffset, L);
      if (p.fly < 1) { p.fly = Math.min(1, p.fly + dt / FLY_TIME); continue; }
      p.dist += moved;
      // 目の前を通過する瞬間だけ取れる
      for (const seat of SEATS) {
        const c = seat.customer;
        if (!c || c.state !== 'waiting' || c.order !== p.sushi) continue;
        const d0 = mod(seat.s - prevS, L);
        if (d0 > 0 && d0 <= moved + 0.001) {
          takePlate(c, p);
          slots[i] = null;
          break;
        }
      }
      if (slots[i] && p.dist > MAX_DIST) {
        const pos = posAt(slotPos(i));
        slots[i] = null;
        wasted++; score = Math.max(0, score - 20);
        sfx.waste();
        addPopup(pos.x, pos.y - 30, '廃棄 −20', '#7f8c8d', 20);
      }
    }

    // お客さん
    for (const seat of SEATS) {
      const c = seat.customer; if (!c) continue;
      c.anim += dt;
      if (c.state === 'arriving') {
        c.patience -= dt * 0.3;
        if (c.anim > 0.45) { c.state = 'waiting'; c.anim = 0; }
      } else if (c.state === 'waiting') {
        c.patience -= dt;
        if (c.patience <= 0) {
          c.state = 'leaving'; c.mood = 'angry'; c.anim = 0;
          angryCount++; combo = 0;
          sfx.angry();
          addPopup(seat.x, 110, 'もう帰る！', '#c0392b', 26);
        }
      } else if (c.state === 'eating') {
        if (c.anim > 1.1) {
          c.plates++;
          if (Math.random() < 0.45 && elapsed < GAME_TIME - 6) {
            newOrder(c); c.anim = 0;
          } else {
            c.state = 'leaving'; c.mood = 'happy'; c.anim = 0;
            addPopup(seat.x, 110, 'ごちそうさま！', '#a5462b', 22);
          }
        }
      } else if (c.state === 'leaving') {
        if (c.anim > 0.6) seat.customer = null;
      }
    }

    // 来店
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnCustomer();
      spawnTimer = (3.4 - 1.8 * d) * (0.7 + Math.random() * 0.6);
    }

    // ポップアップ
    popups.forEach(p => p.t += dt);
    popups = popups.filter(p => p.t < 1.2);

    if (elapsed >= GAME_TIME || angryCount >= ANGRY_LIMIT) endGame();
  }

  function takePlate(c, p) {
    const frac = Math.max(0, c.patience / c.patienceMax);
    const bonus = Math.round(frac * 10) * 10;
    combo++; maxCombo = Math.max(maxCombo, combo);
    const comboBonus = combo >= 2 ? (combo - 1) * 20 : 0;
    const gain = p.sushi.price + bonus + comboBonus;
    score += gain; served++;
    c.state = 'eating'; c.anim = 0; c.eating = p.sushi; c.mood = 'happy';
    sfx.serve();
    addPopup(c.seat.x, 120, '+' + gain, '#c0392b', 28);
    if (combo >= 2) addPopup(c.seat.x, 150, combo + ' コンボ！', '#d35400', 18);
  }

  // ===== 描画: 寿司 =====
  function ellipse(x, y, rx, ry, fill, stroke, lw = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawSushi(id, x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (id === 'ikura' || id === 'uni') {
      // 軍艦
      ellipse(0, -8, 19, 6, '#fbf8ef', '#d8d0bd');
      rrect(-20, -8, 40, 22, 6); ctx.fillStyle = '#1f2d24'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-20, -2, 40, 3);
      if (id === 'ikura') {
        const pts = [[-12, -10], [-4, -12], [4, -11], [12, -10], [-8, -15], [0, -17], [8, -15], [-2, -21], [6, -20], [-10, -19]];
        pts.forEach(([px, py]) => {
          ellipse(px, py, 4.6, 4.6, '#ff5a1f', '#c23d10', 1);
          ellipse(px - 1.4, py - 1.4, 1.4, 1.4, 'rgba(255,255,255,0.85)');
        });
      } else {
        const lobes = [[-11, -11, -0.3], [-3, -14, 0.1], [6, -12, 0.3], [12, -10, 0.5], [0, -18, 0], [-8, -17, -0.2], [8, -17, 0.2]];
        lobes.forEach(([px, py, a]) => {
          ctx.save(); ctx.translate(px, py); ctx.rotate(a);
          ellipse(0, 0, 6.5, 3.8, '#f6a623', '#c97d0c', 1);
          ctx.strokeStyle = 'rgba(160,90,0,0.5)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
          ctx.restore();
        });
      }
    } else {
      // 握り
      ellipse(0, 4, 20, 10, '#fbf8ef', '#d8d0bd');
      const colors = {
        maguro:  ['#c8102e', '#8e0b20'],
        hamachi: ['#f5dcc8', '#e7a0a0'],
        salmon:  ['#ff8a4c', '#e2622a'],
      }[id];
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.quadraticCurveTo(-22, -14, 0, -13);
      ctx.quadraticCurveTo(24, -13, 25, -2);
      ctx.quadraticCurveTo(10, 4, -24, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -14, 0, 3);
      g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = colors[1]; ctx.lineWidth = 1; ctx.stroke();
      if (id === 'salmon') {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
        for (let i = -14; i <= 14; i += 7) {
          ctx.beginPath(); ctx.moveTo(i - 3, -11); ctx.quadraticCurveTo(i + 2, -6, i - 1, 0); ctx.stroke();
        }
      } else if (id === 'hamachi') {
        ctx.strokeStyle = 'rgba(200,90,90,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-20, -6); ctx.quadraticCurveTo(0, -10, 22, -6); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14, -9); ctx.quadraticCurveTo(0, -12, 14, -9); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPlate(sushi, x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ellipse(0, 6, 32, 13, 'rgba(0,0,0,0.18)');
    ellipse(0, 2, 32, 13, sushi.plate);
    ellipse(0, 1, 25, 9, '#fdfdfd');
    ctx.restore();
    drawSushi(sushi.id, x, y - 4 * s, s * 0.95);
  }

  // ===== 描画: 背景・レーン =====
  function tracePath() {
    const { x1, x2, yTop, yBot, r } = TRACK;
    ctx.beginPath();
    ctx.moveTo(x1, yTop); ctx.lineTo(x2, yTop);
    ctx.arc(x2, CY, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x1, yBot);
    ctx.arc(x1, CY, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
  }

  function drawBackground() {
    // 壁
    const g = ctx.createLinearGradient(0, 0, 0, 200);
    g.addColorStop(0, '#f3e3c3'); g.addColorStop(1, '#e8cf9f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 205);
    // のれん風の帯
    ctx.fillStyle = '#a5462b'; ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#8c3a23';
    for (let x = 0; x < W; x += 120) ctx.fillRect(x + 118, 0, 4, 46);
    // 床/板場
    ctx.fillStyle = '#c99a62'; ctx.fillRect(0, 205, W, 285);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 215; y < 490; y += 26) ctx.fillRect(0, y, W, 2);
    // カウンター
    ctx.fillStyle = '#7a4a26'; ctx.fillRect(0, 188, W, 22);
    ctx.fillStyle = '#a0683a'; ctx.fillRect(0, 188, W, 6);
  }

  function drawBelt() {
    ctx.save();
    ctx.lineJoin = 'round';
    tracePath(); ctx.strokeStyle = '#5d6168'; ctx.lineWidth = 66; ctx.stroke();
    tracePath(); ctx.strokeStyle = '#c7ccd3'; ctx.lineWidth = 56; ctx.stroke();
    tracePath(); ctx.strokeStyle = '#aeb4bc'; ctx.lineWidth = 2;
    ctx.setLineDash([3, SP / 2 - 3]); ctx.lineDashOffset = -offset;
    ctx.lineWidth = 54; ctx.stroke();
    ctx.restore();
    // 内側の板場
    ctx.save();
    const { x1, x2, yTop, yBot } = TRACK;
    rrect(x1 - 55, yTop + 33, x2 - x1 + 110, yBot - yTop - 66, 50);
    ctx.fillStyle = '#e9d6b4'; ctx.fill();
    ctx.strokeStyle = '#b48a55'; ctx.lineWidth = 3; ctx.stroke();
    // まな板とネタ
    rrect(560, 305, 170, 55, 8); ctx.fillStyle = '#f2e2c0'; ctx.fill(); ctx.strokeStyle = '#c9a874'; ctx.stroke();
    SUSHI.forEach((s, i) => drawSushi(s.id, 585 + i * 30, 340, 0.55));
    rrect(230, 305, 170, 55, 8); ctx.fillStyle = '#5c3a1e'; ctx.fill();
    ctx.fillStyle = '#fbf8ef';
    for (let i = 0; i < 6; i++) { ellipse(255 + i * 24, 333, 9, 6, '#fbf8ef'); }
    ctx.restore();
  }

  function drawChef() {
    const { x, y } = CHEF;
    const bob = chefShout > 0 ? Math.sin(chefShout * 20) * 2 : 0;
    ctx.save(); ctx.translate(x, y + bob);
    // 体
    rrect(-30, 8, 60, 40, 14); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(-30, 30, 60, 6);
    // 頭
    ellipse(0, -6, 20, 20, '#f6d3b3', '#d9a47a');
    // はちまき
    ctx.fillStyle = '#fff'; ctx.fillRect(-21, -20, 42, 8);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.strokeRect(-21, -20, 42, 8);
    // 顔
    ctx.fillStyle = '#2b1b10';
    if (chefShout > 0) {
      ctx.beginPath(); ctx.arc(-7, -5, 3, Math.PI, 0); ctx.arc(7, -5, 3, Math.PI, 0); ctx.lineWidth = 2; ctx.strokeStyle = '#2b1b10'; ctx.stroke();
      ellipse(0, 6, 6, 5, '#8e2b1d');
    } else {
      ellipse(-7, -4, 2.2, 2.6, '#2b1b10'); ellipse(7, -4, 2.2, 2.6, '#2b1b10');
      ctx.beginPath(); ctx.arc(0, 4, 6, 0.2, Math.PI - 0.2); ctx.strokeStyle = '#2b1b10'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
    if (chefShout > 0) {
      const a = Math.min(1, chefShout * 3);
      ctx.save(); ctx.globalAlpha = a;
      rrect(x + 26, y - 58, 130, 36, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#a5462b'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 34, y - 26); ctx.lineTo(x + 22, y - 14); ctx.lineTo(x + 50, y - 24); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.fillStyle = '#c0392b'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('へいお待ち！', x + 91, y - 40);
      ctx.restore();
    }
  }

  // ===== 描画: お客さん =====
  function drawCustomer(seat) {
    const c = seat.customer; if (!c) return;
    let dy = 0, alpha = 1;
    if (c.state === 'arriving') { const t = Math.min(1, c.anim / 0.45); dy = (1 - t) * 50; alpha = t; }
    if (c.state === 'leaving') { const t = Math.min(1, c.anim / 0.6); dy = t * 60; alpha = 1 - t; }
    const frac = c.patience / c.patienceMax;
    let face = 'happy';
    if (c.state === 'waiting' || c.state === 'arriving') face = frac > 0.5 ? 'happy' : frac > 0.25 ? 'plain' : 'angry';
    if (c.state === 'eating') face = 'eat';
    if (c.state === 'leaving') face = c.mood;

    const x = seat.x, y = 148 + dy;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.rect(0, 46, W, 142); ctx.clip();
    // 体
    rrect(x - 36, y + 22, 72, 60, 22); ctx.fillStyle = c.shirt; ctx.fill();
    // 頭
    const skin = face === 'angry' ? blend(c.skin, '#ff6b6b', 0.35) : c.skin;
    ellipse(x, y, 26, 27, skin, 'rgba(0,0,0,0.15)');
    // 髪
    ctx.fillStyle = c.hair;
    if (c.style === 0) { ctx.beginPath(); ctx.arc(x, y - 4, 27, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); }
    else if (c.style === 1) { ctx.beginPath(); ctx.arc(x, y - 2, 28, Math.PI * 0.95, Math.PI * 2.05); ctx.fill(); ctx.fillRect(x - 28, y - 4, 8, 34); ctx.fillRect(x + 20, y - 4, 8, 34); }
    else if (c.style === 2) { ctx.fillStyle = c.shirt; ctx.beginPath(); ctx.arc(x, y - 10, 26, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 4, y - 14, 38, 6); }
    else { for (let i = -2; i <= 2; i++) { ellipse(x + i * 10, y - 22 + Math.abs(i) * 3, 9, 9, c.hair); } }
    // 顔
    drawFace(x, y + 4, face, c.glasses);
    // 食べている寿司
    if (c.state === 'eating' && c.eating) {
      const t = Math.min(1, c.anim / 1.1);
      if (t < 0.25) {
        const k = t / 0.25;
        drawPlate(c.eating, x, 240 - k * 60, 0.8);
      } else {
        ctx.globalAlpha = alpha * (1 - (t - 0.25) / 0.75);
        drawSushi(c.eating.id, x, y + 32, 0.8 * (1 - (t - 0.25) * 0.6));
        ctx.globalAlpha = alpha;
      }
    }
    if (face === 'angry' && c.state !== 'leaving') {
      ellipse(x + 22, y - 18, 3, 5, '#5dade2');
    }
    if (c.state === 'leaving' && c.mood === 'angry') {
      ctx.strokeStyle = '#999'; ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(x + i * 18, y - 28); ctx.quadraticCurveTo(x + i * 26, y - 40, x + i * 18, y - 50); ctx.stroke();
      }
    }
    ctx.restore();

    // 食べた皿の山
    if (c.plates > 0 && c.state !== 'leaving') {
      for (let i = 0; i < Math.min(c.plates, 6); i++) {
        ellipse(x + 48, 200 - i * 5, 14, 5, '#ddd', '#999', 1);
      }
    }

    // 吹き出し（注文）
    if (c.state === 'waiting' || c.state === 'arriving') {
      ctx.save(); ctx.globalAlpha = alpha;
      const bx = x, by = 76 + dy * 0.3;
      rrect(bx - 46, by - 28, 92, 56, 14);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = face === 'angry' ? '#c0392b' : '#a5462b'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - 8, by + 27); ctx.lineTo(bx, by + 38); ctx.lineTo(bx + 8, by + 27); ctx.fillStyle = '#fff'; ctx.fill();
      drawSushi(c.order.id, bx, by + 2, 1);
      // 待ち時間バー
      const bw = 76;
      ctx.fillStyle = '#eee'; ctx.fillRect(bx - bw / 2, by + 16, bw, 6);
      ctx.fillStyle = frac > 0.5 ? '#27ae60' : frac > 0.25 ? '#f39c12' : '#e74c3c';
      ctx.fillRect(bx - bw / 2, by + 16, bw * Math.max(0, frac), 6);
      ctx.restore();
    }
  }

  function drawFace(x, y, face, glasses) {
    ctx.strokeStyle = '#2b1b10'; ctx.fillStyle = '#2b1b10'; ctx.lineWidth = 2.2;
    if (face === 'eat' || face === 'happy') {
      ctx.beginPath(); ctx.arc(x - 9, y - 4, 3.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 9, y - 4, 3.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (face === 'angry') {
      ctx.beginPath(); ctx.moveTo(x - 14, y - 11); ctx.lineTo(x - 5, y - 7); ctx.moveTo(x + 14, y - 11); ctx.lineTo(x + 5, y - 7); ctx.stroke();
      ellipse(x - 9, y - 3, 2.2, 2.6, '#2b1b10'); ellipse(x + 9, y - 3, 2.2, 2.6, '#2b1b10');
    } else {
      ellipse(x - 9, y - 4, 2.2, 2.6, '#2b1b10'); ellipse(x + 9, y - 4, 2.2, 2.6, '#2b1b10');
    }
    if (glasses) {
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x - 9, y - 4, 7, 0, Math.PI * 2); ctx.moveTo(x + 16, y - 4); ctx.arc(x + 9, y - 4, 7, 0, Math.PI * 2);
      ctx.moveTo(x - 2, y - 4); ctx.lineTo(x + 2, y - 4); ctx.stroke();
      ctx.lineWidth = 2.2;
    }
    if (face === 'eat') {
      const o = Math.abs(Math.sin(performance.now() / 90)) * 4 + 2;
      ellipse(x, y + 9, 5, o, '#8e2b1d');
      ellipse(x - 16, y + 4, 4, 2.5, 'rgba(255,120,120,0.5)'); ellipse(x + 16, y + 4, 4, 2.5, 'rgba(255,120,120,0.5)');
    } else if (face === 'happy') {
      ctx.beginPath(); ctx.arc(x, y + 5, 7, 0.15, Math.PI - 0.15); ctx.stroke();
    } else if (face === 'angry') {
      ctx.beginPath(); ctx.arc(x, y + 14, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x - 5, y + 9); ctx.lineTo(x + 5, y + 9); ctx.stroke();
    }
  }

  function blend(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ===== 描画: 皿・ボタン・HUD =====
  function drawPlates() {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const p = slots[i]; if (!p) continue;
      const pos = posAt(slotPos(i));
      if (p.fly < 1) {
        const t = p.fly, e = 1 - (1 - t) * (1 - t);
        const x = p.from.x + (pos.x - p.from.x) * e;
        const y = p.from.y + (pos.y - p.from.y) * e - Math.sin(t * Math.PI) * 50;
        drawPlate(p.sushi, x, y, 0.8 + 0.2 * t);
      } else {
        drawPlate(p.sushi, pos.x, pos.y, 1);
      }
    }
  }

  function drawButtons() {
    ctx.fillStyle = '#5a3418'; ctx.fillRect(0, 470, W, H - 470);
    ctx.fillStyle = '#6e4220'; ctx.fillRect(0, 470, W, 8);
    for (const b of buttons) {
      const press = b.press > 0 ? 4 : 0;
      rrect(b.x, b.y + 6, b.w, b.h, 18); ctx.fillStyle = '#2e1a0b'; ctx.fill();
      rrect(b.x, b.y + press, b.w, b.h, 18);
      ctx.fillStyle = b.press > 0 ? '#fff3d6' : '#fdf6e6'; ctx.fill();
      ctx.strokeStyle = b.sushi.plate; ctx.lineWidth = 5; ctx.stroke();
      const cx = b.x + b.w / 2, cy = b.y + press;
      drawPlate(b.sushi, cx, cy + 92, 1.9);
      ctx.fillStyle = '#3a2414'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.sushi.name, cx, cy + 162);
      ctx.fillStyle = '#a5462b'; ctx.font = 'bold 18px sans-serif';
      ctx.fillText(b.sushi.price + '円', cx, cy + 192);
      ellipse(b.x + 22, cy + 22, 13, 13, '#e8d9bd');
      ctx.fillStyle = '#7a5a40'; ctx.font = 'bold 15px sans-serif';
      ctx.fillText(b.sushi.key, b.x + 22, cy + 23);
    }
  }

  function drawHUD() {
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText('売上 ' + score + ' 点', 20, 23);
    ctx.textAlign = 'center';
    const left = Math.max(0, GAME_TIME - elapsed);
    ctx.fillStyle = left < 10 ? '#ffd166' : '#fff';
    ctx.fillText('のこり ' + Math.ceil(left) + ' 秒', W / 2, 23);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    ctx.fillText('怒', W - 20 - ANGRY_LIMIT * 26 - 4, 23);
    for (let i = 0; i < ANGRY_LIMIT; i++) {
      ellipse(W - 30 - i * 26, 23, 10, 10, i < angryCount ? '#e74c3c' : 'rgba(255,255,255,0.25)');
    }
    // BGM ON/OFF ボタン
    const bb = BGM_BTN;
    rrect(bb.x, bb.y, bb.w, bb.h, 10);
    ctx.fillStyle = BGM.enabled ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = BGM.enabled ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.fillText(BGM.enabled ? '♪ ON' : '♪ OFF', bb.x + bb.w / 2, bb.y + bb.h / 2 + 1);
    ctx.restore();
  }

  function drawPopups() {
    for (const p of popups) {
      const a = 1 - p.t / 1.2;
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = `bold ${p.size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff';
      const y = p.y - p.t * 40;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
      ctx.restore();
    }
  }

  function render() {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    if (state === 'title') { offset = mod((offset || 0) + 0.6, L); }
    SEATS.forEach(drawCustomer);
    drawBelt();
    drawChef();
    if (slots) drawPlates();
    drawButtons();
    if (state !== 'title') drawHUD();
    if (popups) drawPopups();
    if (wrongFlash > 0) {
      ctx.fillStyle = `rgba(120,120,120,${wrongFlash * 0.4})`; ctx.fillRect(0, 0, W, 470);
    }
  }

  // ===== ループ =====
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state === 'playing') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ===== 入力 =====
  function pressButton(b) {
    b.press = 0.12;
    serve(b.sushi);
  }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    const bb = BGM_BTN;
    if (x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h) { audio(); BGM.toggle(); return; }
    for (const b of buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { pressButton(b); return; }
    }
  });
  window.addEventListener('keydown', e => {
    const b = buttons.find(b => b.sushi.key === e.key);
    if (b) pressButton(b);
    if ((e.key === 'Enter' || e.key === ' ') && state !== 'playing') start();
    if (e.key === 'm' || e.key === 'M') { audio(); BGM.toggle(); }
  });
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    if (!actx) return;
    if (document.hidden) actx.suspend(); else actx.resume();
  });

  // ===== 画面遷移 =====
  const titleEl = document.getElementById('title');
  const resultEl = document.getElementById('result');
  function start() {
    audio();
    reset();
    state = 'playing';
    BGM.start(bgmTempo);
    titleEl.classList.add('hidden');
    resultEl.classList.add('hidden');
  }
  function endGame() {
    state = 'result';
    const closed = angryCount >= ANGRY_LIMIT;
    BGM.stop();
    BGM.jingle(!closed);
    document.getElementById('resultTitle').textContent = closed ? 'お客さんが怒って閉店…' : '本日の営業終了！';
    document.getElementById('resultScore').textContent = score;
    document.getElementById('resultDetail').textContent =
      `提供 ${served} 皿 ／ 最大コンボ ${maxCombo} ／ 怒った客 ${angryCount} 人 ／ 廃棄 ${wasted} 皿`;
    const rank = score >= 9000 ? '称号：伝説の大将' : score >= 6000 ? '称号：大将' : score >= 3500 ? '称号：板前' : score >= 1500 ? '称号：一人前' : '称号：見習い';
    document.getElementById('resultRank').textContent = rank;
    resultEl.classList.remove('hidden');
  }
  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('retryBtn').addEventListener('click', start);

  // タイトル画面用の飾り
  slots = new Array(SLOT_COUNT).fill(null);
  offset = 0;
  [0, 4, 9, 14, 19, 24].forEach((i, n) => { slots[i] = { sushi: SUSHI[n % 5], fly: 1, dist: 0 }; });
  requestAnimationFrame(frame);
})();
