const AudioManager = (() => {
  const tracks = {
    menu: new Audio('Music/Menu.mp3'),
    act1: new Audio('Music/ato 1 .mp3'),
    act2: new Audio('Music/ato 2.mp3'),
    act3: new Audio('Music/ato3.mp3')
  };

  const sfx = {
    explosion: new Audio('Music/SoundFX/explosao.mp3'),
    portal_nascendo: new Audio('Music/som portal/portal_nacendo.mp3'),
    entrar_portal: new Audio('Music/som portal/entrando_no_portal.mp3'),
    crystal_activated: new Audio('Music/SoundFX/crystal_activation.mp3'),
    lightning: new Audio('Music/SoundFX/lightning.mp3'),
    impacto_solo: new Audio('Music/SoundFX/impacto_solo.mp3'),
    dash: new Audio('Music/SoundFX/dash.mp3'),
    achievement: new Audio('Music/SoundFX/Achievement.mp3')
  };

  let audioCtx = null;
  let masterGain = null;
  let lpFilter = null; // Low-pass filter para o pause
  let instLFO = null;        // Oscillador de tremolo para instabilidade
  let instLFOGain = null;    // Gain controlado pelo LFO
  let instDistortion = null; // WaveShaper para distorção

  // Gera uma curva de distorção waveshaper (0 = limpa, 400 = intensa)
  function _makeDistortionCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = amount > 0
        ? ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
        : x;
    }
    return curve;
  }

  // Configuração inicial de todas as faixas
  for (let key in tracks) {
    tracks[key].loop = true;
    tracks[key].volume = 0.5;
  }
  for (let key in sfx) {
    sfx[key].loop = false;
    sfx[key].volume = 0.8;
  }

  let currentTrackName = null;
  let currentTrack = null;
  let hasInteracted = false;
  let pendingTrack = null;

  // Browsers modernos bloqueiam autoplay até o primeiro clique/tecla
  function onFirstInteraction() {
    if (hasInteracted) return;
    hasInteracted = true;
    
    // Inicializa Web Audio API para efeitos premium
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      lpFilter = audioCtx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 22000; // Começa aberto

      // ── Nós de Instabilidade (Ato 2) ───────────────────────────────
      // Tremolo LFO: oscila o volume levemente (eco de instabilidade)
      instLFO = audioCtx.createOscillator();
      instLFO.type = 'sine';
      instLFO.frequency.value = 0; // começa parado
      instLFOGain = audioCtx.createGain();
      instLFOGain.gain.value = 0;   // sem efeito inicial
      instLFO.connect(instLFOGain);
      instLFOGain.connect(masterGain.gain);
      instLFO.start();

      // Distortion waveshaper (bitcrusher leve)
      instDistortion = audioCtx.createWaveShaper();
      instDistortion.curve = _makeDistortionCurve(0); // curva neutra
      instDistortion.oversample = '2x';

      // Cadeia final: masterGain → distortion → lpFilter → destination
      masterGain.connect(instDistortion);
      instDistortion.connect(lpFilter);
      lpFilter.connect(audioCtx.destination);
    } catch(e) { console.warn("Web Audio API não suportada."); }

    // Só toca o pendingTrack se ainda não houve outra chamada de play() depois
    if (pendingTrack && pendingTrack === currentTrackName) {
      _doPlay(pendingTrack);
    }
    pendingTrack = null;
  }

  document.addEventListener('click', onFirstInteraction, { once: true });
  document.addEventListener('keydown', onFirstInteraction, { once: true });
  document.addEventListener('touchstart', onFirstInteraction, { once: true });

  function _doPlay(trackName) {
    const track = tracks[trackName];
    if (!track) return;
    const promise = track.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // Ainda bloqueado — agenda para o próximo clique
        pendingTrack = trackName;
      });
    }
  }

  function play(trackName) {
    // Já tocando essa faixa? Nada a fazer.
    if (currentTrackName === trackName && currentTrack && !currentTrack.paused) return;

    // Para a faixa atual
    if (currentTrack) {
      currentTrack.pause();
      currentTrack.currentTime = 0;
    }

    currentTrackName = trackName;
    currentTrack = tracks[trackName];

    if (!currentTrack) return;

    if (!hasInteracted) {
      // Registra o desejo mas aguarda interação
      pendingTrack = trackName;
      return;
    }

    _doPlay(trackName);
  }

  function stop() {
    if (currentTrack) {
      currentTrack.pause();
      currentTrack.currentTime = 0;
    }
    currentTrack = null;
    currentTrackName = null;
  }

  function setVolume(vol) {
    for (let key in tracks) tracks[key].volume = Math.max(0, Math.min(1, vol));
  }

  function playFX(fxName, pan = 0, volumeScale = 1.0) {
    if (!hasInteracted) return;
    const fx = sfx[fxName];
    if (!fx) return;
    
    // Se tivermos AudioContext, usamos panning real
    if (audioCtx && audioCtx.state !== 'suspended') {
        const source = audioCtx.createMediaElementSource(fx.cloneNode());
        const panner = audioCtx.createStereoPanner();
        const gainNode = audioCtx.createGain();
        
        const baseFXVol = typeof Settings !== 'undefined' ? Settings.getFXVolume() : 0.7;
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gainNode.gain.value = baseFXVol * volumeScale;
        
        source.connect(panner);
        panner.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.mediaElement.play();
        return;
    }

    // Fallback simples
    const clone = fx.cloneNode();
    const baseFXVol = typeof Settings !== 'undefined' ? Settings.getFXVolume() : 0.7;
    clone.volume = baseFXVol * volumeScale;
    clone.play().catch(() => { });
  }

  function setPaused(paused) {
    if (!audioCtx || !lpFilter) return;
    if (paused) {
      // Abafa o som (Low-pass) e abaixa o volume
      lpFilter.frequency.setTargetAtTime(600, audioCtx.currentTime, 0.2);
      if (currentTrack) currentTrack.volume = 0.15;
    } else {
      lpFilter.frequency.setTargetAtTime(22000, audioCtx.currentTime, 0.2);
      if (currentTrack) currentTrack.volume = 0.5;
    }
  }

  // ── Instabilidade de áudio (Ato 2) ─────────────────────────────────
  // Ajusta tremolo e distorção baseados em instabilityLevel (0.0 a 1.0)
  let _lastInstability = -1;
  function setInstability(level) {
    if (!audioCtx || !instLFO || !instLFOGain || !instDistortion) return;
    if (Math.abs(level - _lastInstability) < 0.02) return; // sem mudança significativa
    _lastInstability = level;

    const t = audioCtx.currentTime;
    const smooth = 0.8; // transição suave em segundos

    // Tremolo: começa a 0, chega a sacudir 0.3x o volume na instabilidade máxima
    const lfoFreq = 0.5 + level * 8;   // Hz: 0.5 (lento) → 8.5 (agitado)
    const lfoAmt  = level * level * 0.25; // 0 a 0.25 de modulação
    instLFO.frequency.setTargetAtTime(lfoFreq, t, smooth);
    instLFOGain.gain.setTargetAtTime(lfoAmt, t, smooth);

    // Distorção waveshaper: curva neutra → pesada
    const distAmount = level * level * 180; // 0 → 180
    instDistortion.curve = _makeDistortionCurve(distAmount);

    // Filtro LP ligeiramente fechado em instabilidade alta (som abafado)
    const lpFreq = 22000 - level * level * 8000; // 22kHz → 14kHz
    lpFilter.frequency.setTargetAtTime(Math.max(lpFreq, 14000), t, smooth);
  }

  // Toca um burst de estática curto e aleatório (glitch de áudio)
  function playGlitchBurst(intensity = 0.5) {
    if (!audioCtx || !hasInteracted) return;
    try {
      const duration = 0.04 + Math.random() * 0.06; // 40-100ms
      const bufSize  = Math.floor(audioCtx.sampleRate * duration);
      const buffer   = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
      const data     = buffer.getChannelData(0);

      // White noise com envelope de fade-out
      for (let i = 0; i < bufSize; i++) {
        const fade = 1 - i / bufSize;
        data[i] = (Math.random() * 2 - 1) * fade * intensity;
      }

      const src  = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      src.buffer = buffer;
      gain.gain.value = 0.3 * intensity;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    } catch(e) { /* silencioso */ }
  }

  function fadeIn(trackName, targetVol = 0.5, duration = 2000) {
    play(trackName);
    const track = tracks[trackName];
    if (!track) return;

    track.volume = 0;
    const step = targetVol / (duration / 50);
    const interval = setInterval(() => {
      if (track.volume < targetVol) {
        track.volume = Math.min(targetVol, track.volume + step);
      } else {
        clearInterval(interval);
      }
    }, 50);
  }

  return { play, stop, setVolume, playFX, fadeIn, setPaused, setInstability, playGlitchBurst };
})();
