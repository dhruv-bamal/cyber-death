/* ══════════════════════════════════════════
   HELIOS PROTOCOL — main.js
   ══════════════════════════════════════════ */

(function () {

  /* ─────────────────────────────────────────
     SOUND ENGINE
     Generates sci-fi click sounds via Web Audio API
     (no external files needed)
  ───────────────────────────────────────── */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioCtx();
    return audioCtx;
  }

  /* ─────────────────────────────────────────
     SUSPENSEFUL AMBIENT MUSIC ENGINE
     Pure Web Audio — zero external files.

     6 simultaneous layers:
       1. Deep drone   — two detuned sines with slow LFO tremolo
       2. Noise pad    — bandpass-filtered noise, slow cutoff sweep
       3. Sub pulse    — slow rhythmic low thump (every ~3s)
       4. Shimmer      — sparse high eerie chime tones
       5. Tension swell— slow sawtooth swell that rises and fades
       6. Heartbeat    — quiet double-thump that triggers every ~8s
  ───────────────────────────────────────── */
  let musicNodes = [];
  let musicPlaying = false;
  let musicMaster = null;
  let musicCtx = null;
  let subPulseTimer = null;
  let shimmerTimer = null;
  let heartbeatTimer = null;
  let swellTimer = null;

  function stopAllTimers() {
    [subPulseTimer, shimmerTimer, heartbeatTimer, swellTimer].forEach(function(t){ if(t) clearTimeout(t); });
    subPulseTimer = shimmerTimer = heartbeatTimer = swellTimer = null;
  }

  function fadeOutAndStop(gainNode, ctx, onDone) {
    if (!gainNode) { if(onDone) onDone(); return; }
    gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.8);
    setTimeout(function(){ if(onDone) onDone(); }, 2000);
  }

  function stopMusic(immediate) {
    stopAllTimers();
    musicNodes.forEach(function(n){ try{ n.stop(); }catch(e){} });
    musicNodes = [];
    if (!immediate && musicMaster) {
      try { musicMaster.gain.linearRampToValueAtTime(0, musicCtx.currentTime + 1.5); } catch(e){}
    }
    musicMaster = null;
  }

  function startMusic() {
    if (musicPlaying) return;
    musicPlaying = true;

    try {
      if (!audioCtx) audioCtx = new AudioCtx();
      musicCtx = audioCtx;
      const ctx = musicCtx;
      if (ctx.state === 'suspended') ctx.resume();

      stopMusic(true); // clean slate

      /* Master bus with slow fade-in */
      musicMaster = ctx.createGain();
      musicMaster.gain.setValueAtTime(0, ctx.currentTime);
      musicMaster.gain.linearRampToValueAtTime(0.68, ctx.currentTime + 5);
      musicMaster.connect(ctx.destination);

      /* ── LAYER 1: Deep drone — two slightly detuned oscillators ── */
      function makeDrone(freq, detune, volMax) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;

        lfo.type = 'sine';
        lfo.frequency.value = 0.09 + Math.random() * 0.06;
        lfoGain.gain.value = volMax * 0.45;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        gain.gain.setValueAtTime(volMax * 0.55, ctx.currentTime);
        osc.connect(gain);
        gain.connect(musicMaster);

        osc.start();
        lfo.start();
        musicNodes.push(osc, lfo);
      }
      makeDrone(38, 0,   0.38);
      makeDrone(38, 8,   0.28);
      makeDrone(57, -4,  0.18);
      makeDrone(76, 0,   0.10);

      /* ── LAYER 2: Noise pad — low-pass filtered white noise ── */
      (function makeNoisePad() {
        const bufLen = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.setValueAtTime(120, ctx.currentTime);
        lpf.frequency.linearRampToValueAtTime(280, ctx.currentTime + 18);
        lpf.frequency.linearRampToValueAtTime(90, ctx.currentTime + 36);
        lpf.Q.value = 1.2;

        const gain = ctx.createGain();
        gain.gain.value = 0.14;

        src.connect(lpf);
        lpf.connect(gain);
        gain.connect(musicMaster);
        src.start();
        musicNodes.push(src);
      })();

      /* ── LAYER 3: Sub pulse — rhythmic low thump every ~3s ── */
      function schedSubPulse() {
        try {
          const ctx2 = musicCtx;
          if (!ctx2 || !musicPlaying || !musicMaster) return;

          const osc = ctx2.createOscillator();
          const gain = ctx2.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(48, ctx2.currentTime);
          osc.frequency.exponentialRampToValueAtTime(28, ctx2.currentTime + 0.35);
          gain.gain.setValueAtTime(0.52, ctx2.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(musicMaster);
          osc.start(ctx2.currentTime);
          osc.stop(ctx2.currentTime + 0.5);

          const interval = 2800 + Math.random() * 1400;
          subPulseTimer = setTimeout(schedSubPulse, interval);
        } catch(e) {}
      }
      schedSubPulse();

      /* ── LAYER 4: Shimmer — sparse high eerie tones ── */
      const shimmerFreqs = [392, 440, 523, 587, 659, 784, 880, 1047];
      function schedShimmer() {
        try {
          const ctx2 = musicCtx;
          if (!ctx2 || !musicPlaying || !musicMaster) return;

          const freq = shimmerFreqs[Math.floor(Math.random() * shimmerFreqs.length)];
          const osc = ctx2.createOscillator();
          const gain = ctx2.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.001, ctx2.currentTime);
          gain.gain.linearRampToValueAtTime(0.055, ctx2.currentTime + 0.8);
          gain.gain.linearRampToValueAtTime(0.001, ctx2.currentTime + 3.5);
          osc.connect(gain);
          gain.connect(musicMaster);
          osc.start(ctx2.currentTime);
          osc.stop(ctx2.currentTime + 4);

          const interval = 1800 + Math.random() * 3200;
          shimmerTimer = setTimeout(schedShimmer, interval);
        } catch(e) {}
      }
      setTimeout(schedShimmer, 2000);

      /* ── LAYER 5: Tension swell — slow rising sawtooth swell ── */
      function schedSwell() {
        try {
          const ctx2 = musicCtx;
          if (!ctx2 || !musicPlaying || !musicMaster) return;

          const osc = ctx2.createOscillator();
          const gain = ctx2.createGain();
          const lpf = ctx2.createBiquadFilter();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(28, ctx2.currentTime);
          osc.frequency.linearRampToValueAtTime(56, ctx2.currentTime + 9);
          osc.frequency.linearRampToValueAtTime(28, ctx2.currentTime + 18);
          lpf.type = 'lowpass';
          lpf.frequency.value = 180;
          lpf.Q.value = 0.5;
          gain.gain.setValueAtTime(0.001, ctx2.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, ctx2.currentTime + 5);
          gain.gain.linearRampToValueAtTime(0.001, ctx2.currentTime + 18);
          osc.connect(lpf);
          lpf.connect(gain);
          gain.connect(musicMaster);
          osc.start(ctx2.currentTime);
          osc.stop(ctx2.currentTime + 19);

          swellTimer = setTimeout(schedSwell, 22000 + Math.random() * 6000);
        } catch(e) {}
      }
      setTimeout(schedSwell, 4000);

      /* ── LAYER 6: Heartbeat — quiet double-thump ── */
      function schedHeartbeat() {
        try {
          const ctx2 = musicCtx;
          if (!ctx2 || !musicPlaying || !musicMaster) return;

          function thump(delay) {
            const o = ctx2.createOscillator();
            const g = ctx2.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(60, ctx2.currentTime + delay);
            o.frequency.exponentialRampToValueAtTime(30, ctx2.currentTime + delay + 0.18);
            g.gain.setValueAtTime(0.001, ctx2.currentTime + delay);
            g.gain.linearRampToValueAtTime(0.3, ctx2.currentTime + delay + 0.03);
            g.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + delay + 0.2);
            o.connect(g);
            g.connect(musicMaster);
            o.start(ctx2.currentTime + delay);
            o.stop(ctx2.currentTime + delay + 0.25);
          }
          thump(0);
          thump(0.22);

          heartbeatTimer = setTimeout(schedHeartbeat, 7000 + Math.random() * 5000);
        } catch(e) {}
      }
      setTimeout(schedHeartbeat, 6000);

    } catch(e) {
      musicPlaying = false;
      console.warn('Music engine error:', e);
    }
  }

  function toggleMusic() {
    const btn = document.getElementById('music-btn');
    const lbl = document.getElementById('music-label');
    const ico = document.getElementById('music-icon');

    if (!musicPlaying) {
      startMusic();
      if (btn) btn.classList.remove('muted');
      if (lbl) lbl.textContent = 'MUSIC ON';
      if (ico) ico.textContent = '♪';
    } else {
      stopAllTimers();
      fadeOutAndStop(musicMaster, musicCtx || audioCtx, function(){
        musicNodes.forEach(function(n){ try{ n.stop(); }catch(e){} });
        musicNodes = [];
        musicMaster = null;
      });
      musicPlaying = false;
      if (btn) btn.classList.add('muted');
      if (lbl) lbl.textContent = 'MUSIC OFF';
      if (ico) ico.textContent = '✕';
    }
  }

  /* Wire up music button */
  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('music-btn');
    if (btn) btn.addEventListener('click', toggleMusic);
  });
  /* Also handle if DOM already loaded */
  if (document.readyState !== 'loading') {
    const btn = document.getElementById('music-btn');
    if (btn) btn.addEventListener('click', toggleMusic);
  }

  /* Auto-start music on first user interaction (browser policy) */
  let musicAutoStarted = false;
  function autoStartMusic() {
    if (musicAutoStarted) return;
    musicAutoStarted = true;
    document.removeEventListener('click', autoStartMusic);
    document.removeEventListener('keydown', autoStartMusic);
    setTimeout(startMusic, 600);
  }
  document.addEventListener('click', autoStartMusic);
  document.addEventListener('keydown', autoStartMusic);

  /* ─────────────────────────────────────────
     CLICK SOUND FX
  ───────────────────────────────────────── */
  /**
   * Play a layered sci-fi click sound.
   * @param {'default'|'danger'|'confirm'} type
   */
  function playClick(type) {
    try {
      const ctx = getAudioCtx();

      // ── Tick transient (high-frequency burst) ──
      const tickOsc = ctx.createOscillator();
      const tickGain = ctx.createGain();
      tickOsc.connect(tickGain);
      tickGain.connect(ctx.destination);
      tickOsc.type = 'square';

      if (type === 'danger') {
        tickOsc.frequency.setValueAtTime(280, ctx.currentTime);
        tickOsc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
        tickGain.gain.setValueAtTime(0.22, ctx.currentTime);
        tickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      } else if (type === 'confirm') {
        tickOsc.frequency.setValueAtTime(660, ctx.currentTime);
        tickOsc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
        tickGain.gain.setValueAtTime(0.15, ctx.currentTime);
        tickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      } else {
        // default — crisp cyber click
        tickOsc.frequency.setValueAtTime(1200, ctx.currentTime);
        tickOsc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
        tickGain.gain.setValueAtTime(0.18, ctx.currentTime);
        tickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      }

      tickOsc.start(ctx.currentTime);
      tickOsc.stop(ctx.currentTime + 0.15);

      // ── Sub thud (body of the click) ──
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.type = 'sine';

      if (type === 'danger') {
        subOsc.frequency.setValueAtTime(55, ctx.currentTime);
        subGain.gain.setValueAtTime(0.28, ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      } else {
        subOsc.frequency.setValueAtTime(90, ctx.currentTime);
        subGain.gain.setValueAtTime(0.14, ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      }

      subOsc.start(ctx.currentTime);
      subOsc.stop(ctx.currentTime + 0.2);

      // ── Noise burst (texture) ──
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = type === 'danger' ? 600 : 2400;
      noiseFilter.Q.value = 0.8;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(type === 'danger' ? 0.12 : 0.08, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(ctx.currentTime);

    } catch (e) {
      // AudioContext unavailable or blocked — fail silently
    }
  }

  /**
   * Determine click type from button element.
   */
  function getSoundType(btn) {
    if (!btn) return 'default';
    if (btn.classList.contains('db') || btn.classList.contains('red-btn')) return 'danger';
    if (btn.classList.contains('ctabtn')) return 'confirm';
    return 'default';
  }

  /**
   * Attach click-sound listeners to all interactive buttons.
   * Uses event delegation on document so it works after scene clones.
   */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.cbtn, .ctabtn');
    if (btn) playClick(getSoundType(btn));
  });

  /* Hover blip — very subtle */
  document.addEventListener('mouseover', function (e) {
    const btn = e.target.closest('.cbtn, .ctabtn');
    if (btn) {
      try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.03);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      } catch (e) { /* silent */ }
    }
  });


  /* ─────────────────────────────────────────
     CONSTANTS & STATE
  ───────────────────────────────────────── */
  const TOTAL = 22;
  let cur = 0;
  let cdSec = 43200; // 12 hours in seconds
  let cdTick = null;
  let started = false;


  /* ─────────────────────────────────────────
     CUSTOM CURSOR
  ───────────────────────────────────────── */
  const curEl = document.getElementById('cursor');
  const cdotEl = document.getElementById('cdot');
  let mx = 0, my = 0, cx2 = 0, cy2 = 0;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
    cdotEl.style.left = mx + 'px';
    cdotEl.style.top = my + 'px';
  });

  (function animateCursor() {
    cx2 += (mx - cx2) * 0.18;
    cy2 += (my - cy2) * 0.18;
    curEl.style.left = cx2 + 'px';
    curEl.style.top = cy2 + 'px';
    requestAnimationFrame(animateCursor);
  })();


  /* ─────────────────────────────────────────
     STARS (prologue scene)
  ───────────────────────────────────────── */
  const sw = document.getElementById('stars-wrap');
  if (sw) {
    for (let i = 0; i < 160; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const sz = Math.random() < 0.85 ? 1 : 2;
      s.style.cssText = `
        left:${Math.random() * 100}%;
        top:${Math.random() * 100}%;
        width:${sz}px;height:${sz}px;
        --d:${2 + Math.random() * 5}s;
        --dy:${Math.random() * 5}s;
        opacity:${0.1 + Math.random() * 0.9}
      `;
      sw.appendChild(s);
    }
  }


  /* ─────────────────────────────────────────
     NAVIGATION DOTS
  ───────────────────────────────────────── */
  const pdEl = document.getElementById('pdots');
  for (let i = 0; i < TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'pd';
    d.id = 'pd' + i;
    pdEl.appendChild(d);
  }

  function upDots(i) {
    document.querySelectorAll('.pd').forEach(function (d, j) {
      d.classList.toggle('on', j === i);
    });
  }


  /* ─────────────────────────────────────────
     GLITCH CANVAS TRANSITION
  ───────────────────────────────────────── */
  const gcEl = document.getElementById('gc');
  const tov = document.getElementById('tov');

  function resGC() {
    gcEl.width = window.innerWidth;
    gcEl.height = window.innerHeight;
  }
  resGC();
  window.addEventListener('resize', resGC);

  function glitchFlash(cb, isDeathTransition) {
    const ctx = gcEl.getContext('2d');
    gcEl.classList.add('on');
    tov.classList.add('in');
    let f = 0;

    (function draw() {
      ctx.clearRect(0, 0, gcEl.width, gcEl.height);
      const n = isDeathTransition ? 12 : 5 + Math.floor(Math.random() * 7);
      for (let i = 0; i < n; i++) {
        const y = Math.random() * gcEl.height;
        const h = 1 + Math.random() * (isDeathTransition ? 8 : 5);
        const w = (0.1 + Math.random() * 0.9) * gcEl.width;
        const x = Math.random() * (gcEl.width - w);
        const isRed = isDeathTransition ? (Math.random() > 0.25) : (Math.random() > 0.5);
        ctx.fillStyle = isRed ? 'rgba(255,34,68,.55)' : 'rgba(0,229,255,.45)';
        ctx.fillRect(x, y, w, h);
      }
      f++;
      if (f < (isDeathTransition ? 14 : 9)) {
        requestAnimationFrame(draw);
      } else {
        gcEl.classList.remove('on');
        if (cb) cb();
        setTimeout(function () { tov.classList.remove('in'); }, 400);
      }
    })();
  }


  /* ─────────────────────────────────────────
     SHOW SCENE
  ───────────────────────────────────────── */
  function showScene(idx) {
    document.querySelectorAll('.scene').forEach(function (s) {
      s.classList.remove('active');
    });

    const el = document.getElementById('s' + idx);
    if (!el) return;

    // Clone to re-trigger CSS animations
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    clone.classList.add('active');

    cur = idx;
    upDots(idx);

    if (idx === 1 && !started) {
      started = true;
      startCountdown();
      document.getElementById('hud-cd').classList.add('on');
    }

    if (idx === 16 || idx === 18 || idx === 20 || idx === 21) {
      document.getElementById('hud-cd').classList.remove('on');
    }
  }


  /* ─────────────────────────────────────────
     PUBLIC NAVIGATION — called by HTML onclick
  ───────────────────────────────────────── */
  window.go = function (i) {
    if (i === 14) {
      launchMiniGame();
      return;
    }
    const isDeath = (i === 16 || i === 21);
    glitchFlash(function () { showScene(i); }, isDeath);
  };


  /* ─────────────────────────────────────────
     MINI-GAME — SHOOT MAYACHEN
     Flow: instruction (2s) → countdown 3→2→1 → 3s challenge → result
  ───────────────────────────────────────── */
  function launchMiniGame() {
    const overlay   = document.getElementById('mg-overlay');
    const phaseInst = document.getElementById('mg-instruction');
    const phaseCd   = document.getElementById('mg-countdown');
    const phaseShoot= document.getElementById('mg-shoot');
    const phaseRes  = document.getElementById('mg-result');
    const cdNum     = document.getElementById('mg-cdnum');
    const ring      = document.getElementById('mg-ring');
    const shotsEl   = document.getElementById('mg-shots');
    const progBar   = document.getElementById('mg-progbar');
    const timebar   = document.getElementById('mg-timebar');
    const timeleft  = document.getElementById('mg-timeleft');
    const hitflash  = document.getElementById('mg-hitflash');
    const resIcon   = document.getElementById('mg-result-icon');
    const resTxt    = document.getElementById('mg-result-text');

    const GOAL      = 30;
    const DURATION  = 3000; // ms
    let shots       = 0;
    let mgKeyListener = null;
    let challengeTimer = null;
    let timebarTimer   = null;

    // Reset state
    shots = 0;
    shotsEl.textContent = '0';
    progBar.style.width = '0%';
    timebar.style.width = '100%';
    timeleft.textContent = '3.0s';
    [phaseInst, phaseCd, phaseShoot, phaseRes].forEach(function(p){ p.style.display = 'none'; });

    // Show overlay
    overlay.style.display = 'flex';

    // ── PHASE 1: Instruction (2s) ──
    phaseInst.style.display = 'block';
    phaseInst.style.opacity = '0';
    phaseInst.style.animation = 'fuv .5s ease forwards';

    // Glitch/pulse animation on instruction text
    const instText = document.getElementById('mg-insttext');
    instText.style.animation = 'mgpulse 0.7s ease-in-out infinite alternate';

    setTimeout(function() {
      // ── PHASE 2: Countdown ──
      phaseInst.style.display = 'none';
      phaseCd.style.display   = 'block';

      const circumference = 439.8;
      let count = 3;

      function showCount(n) {
        cdNum.textContent = n;
        cdNum.style.animation = 'none';
        void cdNum.offsetWidth; // reflow
        cdNum.style.animation = 'mgpop .25s ease forwards';
        // Drain the ring over 1 second
        ring.style.transition = 'stroke-dashoffset .95s linear';
        ring.style.strokeDashoffset = String(circumference * (1 - (n - 1) / 3));
      }

      // Reset ring
      ring.style.transition = 'none';
      ring.style.strokeDashoffset = '0';
      void ring.offsetWidth;

      showCount(3);

      const cdInterval = setInterval(function() {
        count--;
        if (count > 0) {
          showCount(count);
        } else {
          clearInterval(cdInterval);
          // ── PHASE 3: Shooting challenge ──
          phaseCd.style.display    = 'none';
          phaseShoot.style.display = 'block';

          const startTime = Date.now();

          // Key listener
          mgKeyListener = function(e) {
            if (e.key !== 's' && e.key !== 'S') return;
            e.preventDefault();
            shots++;
            shots = Math.min(shots, GOAL);
            shotsEl.textContent = shots;
            progBar.style.width = (shots / GOAL * 100) + '%';

            // Hit flash
            hitflash.style.opacity = '1';
            setTimeout(function(){ hitflash.style.opacity = '0'; }, 60);

            // Gun click sound
            playGunClick();
          };
          document.addEventListener('keydown', mgKeyListener);

          // Time bar drain
          const tbInterval = setInterval(function() {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, DURATION - elapsed);
            timebar.style.width = (remaining / DURATION * 100) + '%';
            timeleft.textContent = (remaining / 1000).toFixed(1) + 's';
            if (remaining <= 0) clearInterval(tbInterval);
          }, 50);
          timebarTimer = tbInterval;

          // End after 3s
          challengeTimer = setTimeout(function() {
            document.removeEventListener('keydown', mgKeyListener);
            clearInterval(tbInterval);
            phaseShoot.style.display = 'none';
            phaseRes.style.display   = 'block';

            const won = shots >= GOAL;

            if (won) {
              resIcon.textContent = '🔫';
              resTxt.style.color = '#c050ff';
              resTxt.style.textShadow = '0 0 40px rgba(180,80,255,.7)';
              resTxt.textContent = 'SHOT FIRED';
            } else {
              resIcon.textContent = '💀';
              resTxt.style.color  = 'var(--red)';
              resTxt.style.textShadow = '0 0 40px rgba(255,34,68,.7)';
              resTxt.textContent = 'TOO SLOW';
            }

            // Fade out overlay then go to scene
            setTimeout(function() {
              overlay.style.transition = 'opacity .6s ease';
              overlay.style.opacity = '0';
              setTimeout(function() {
                overlay.style.display   = 'none';
                overlay.style.opacity   = '1';
                overlay.style.transition = '';
                const dest = won ? 21 : 16;
                glitchFlash(function(){ showScene(dest); }, true);
              }, 650);
            }, 1000);

          }, DURATION);
        }
      }, 1000);

    }, 2000);
  }

  /* Quick gun-click sound */
  function playGunClick() {
    try {
      const ctx = getAudioCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.35;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch(e) {}
  }


  /* ─────────────────────────────────────────
     COUNTDOWN TIMER
  ───────────────────────────────────────── */
  function fmtTime(s) {
    return [
      Math.floor(s / 3600),
      Math.floor((s % 3600) / 60),
      s % 60
    ].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }

  function startCountdown() {
    cdTick = setInterval(function () {
      if (cdSec > 0) cdSec--;
      const t = fmtTime(cdSec);
      const hudEl = document.getElementById('hud-cd');
      if (hudEl) hudEl.textContent = '⏱ ' + t + ' REMAINING';
      const cdS1 = document.getElementById('cd-s1');
      if (cdS1) cdS1.textContent = t;
      if (cdSec <= 0) clearInterval(cdTick);
    }, 1000);
  }


  /* ─────────────────────────────────────────
     RESTART
  ───────────────────────────────────────── */
  window.restart = function () {
    clearInterval(cdTick);
    cdTick = null;
    cdSec = 43200;
    started = false;
    const hudEl = document.getElementById('hud-cd');
    hudEl.classList.remove('on');
    hudEl.textContent = '';
    glitchFlash(function () { showScene(0); }, false);
  };


  /* ─────────────────────────────────────────
     LOADING SEQUENCE
  ───────────────────────────────────────── */
  const loadingMsgs = [
    'ESTABLISHING CONNECTION...',
    'DECRYPTING HELIOS FILES...',
    'LOADING NEURAL NETWORK...',
    'BYPASSING SECURITY LAYER 3...',
    'RECONSTRUCTING MEMORY BANKS...',
    'WELCOME, AGENT CARTER.'
  ];

  const lstEl = document.getElementById('lst');
  let si = 0;

  const stepInterval = setInterval(function () {
    si++;
    if (si < loadingMsgs.length && lstEl) lstEl.textContent = loadingMsgs[si];
    if (si >= loadingMsgs.length - 1) clearInterval(stepInterval);
  }, 480);

  setTimeout(function () {
    const ld = document.getElementById('loading');
    ld.classList.add('out');
    setTimeout(function () {
      ld.style.display = 'none';
      showScene(0);
    }, 1200);
  }, 3200);

})();
