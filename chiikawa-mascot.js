/**
 * Chiikawa AI Mascot SDK
 * Lightweight, zero-dependency embeddable AI Mascot component.
 * Author: lienne2006
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChiikawaMascot = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // 12 Authentic Chiikawa Poses Metadata
  const POSES = {
    hello:    { id: 'hello',    title: 'Xin chào!',    icon: '👋', aura: 'rgba(244, 63, 94, 0.45)', desc: 'Bé vẫy tay nghiêng đầu cười tươi' },
    welcome:  { id: 'welcome',  title: 'Chào mừng!',   icon: '🎉', aura: 'rgba(251, 191, 36, 0.55)', desc: 'Bé dang hai tay đón chào rực rỡ' },
    start:    { id: 'start',    title: 'Bắt đầu nào!', icon: '🦸', aura: 'rgba(239, 68, 68, 0.5)',  desc: 'Bé thắt khăn đỏ, nắm tay quyết tâm' },
    loading:  { id: 'loading',  title: 'Đang tải...',  icon: '⏳', aura: 'rgba(168, 85, 247, 0.55)', desc: 'Bé chạy vòng quanh toát mồ hôi' },
    search:   { id: 'search',   title: 'Tìm kiếm...',  icon: '🔍', aura: 'rgba(56, 189, 248, 0.55)', desc: 'Bé cầm kính lúp soi dấu chân' },
    announce: { id: 'announce', title: 'Thông báo!',   icon: '📢', aura: 'rgba(249, 115, 22, 0.55)', desc: 'Bé cầm loa thông báo la to' },
    awesome:  { id: 'awesome',  title: 'Tuyệt vời!',   icon: '👍', aura: 'rgba(16, 185, 129, 0.55)', desc: 'Mắt sao lấp lánh, ngón cái khen ngợi' },
    wait:     { id: 'wait',     title: 'Chờ chút...',  icon: '🤔', aura: 'rgba(14, 165, 233, 0.5)',  desc: 'Bé ngồi chống cằm suy nghĩ' },
    success:  { id: 'success',  title: 'Thành công!',  icon: '🎊', aura: 'rgba(234, 179, 8, 0.6)',   desc: 'Bé nhảy cẫng lên mừng rỡ' },
    error:    { id: 'error',    title: 'Úi, lỗi rồi!', icon: '😭', aura: 'rgba(239, 68, 68, 0.65)', desc: 'Bé ngồi bệt quẹt nước mắt mếu máo' },
    thanks:   { id: 'thanks',   title: 'Cảm ơn!',      icon: '🙏', aura: 'rgba(244, 114, 182, 0.5)', desc: 'Bé chắp tay mắt cún con cảm ơn' },
    bye:      { id: 'bye',      title: 'Tạm biệt!',    icon: '🍂', aura: 'rgba(217, 119, 6, 0.5)',   desc: 'Bé vẫy tay quyến luyến trong gió thu' },
  };

  // Sound Synthesizer via Web Audio API (100% offline, no audio assets required)
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
    }

    play(type = 'squeak') {
      if (!this.enabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (type === 'squeak') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(700, now);
          osc.frequency.exponentialRampToValueAtTime(1250, now + 0.12);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
          osc.start(now);
          osc.stop(now + 0.16);
        } else if (type === 'poke') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(900, now);
          osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
          osc.start(now);
          osc.stop(now + 0.14);
        } else if (type === 'jump') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(950, now + 0.18);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);
        } else if (type === 'cry') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.linearRampToValueAtTime(500, now + 0.25);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
        }

        osc.connect(gain);
        gain.connect(this.ctx.destination);
      } catch (e) {
        // Audio might be blocked before first user gesture
      }
    }
  }

  // Inject styles automatically so team members only need 1 script tag
  function injectStyles() {
    if (document.getElementById('chiikawa-mascot-styles')) return;
    const style = document.createElement('style');
    style.id = 'chiikawa-mascot-styles';
    style.textContent = `
      .ck-mascot-root {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        user-select: none;
        --ck-aura-color: rgba(244, 63, 94, 0.45);
      }
      .ck-mascot-root.ck-floating {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
      }
      .ck-mascot-root.ck-floating.ck-pos-bottom-left {
        left: 24px;
        right: auto;
      }

      /* Speech Bubble */
      .ck-speech-bubble {
        position: relative;
        margin-bottom: 12px;
        background: #ffffff;
        color: #1e293b;
        padding: 10px 18px;
        border-radius: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
        border: 2.5px solid #1e293b;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        max-width: 320px;
        text-align: center;
        opacity: 1;
        transform: translateY(0);
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 10;
        word-break: break-word;
      }
      .ck-speech-bubble::after {
        content: '';
        position: absolute;
        bottom: -11px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 11px 9px 0;
        border-style: solid;
        border-color: #1e293b transparent;
        display: block;
        width: 0;
      }
      .ck-speech-bubble.ck-hidden {
        opacity: 0;
        transform: scale(0.8) translateY(10px);
        pointer-events: none;
      }

      /* Typing indicator */
      .ck-typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .ck-typing-dots span {
        width: 6px;
        height: 6px;
        background: #1e293b;
        border-radius: 50%;
        animation: ckTypingBounce 1.2s infinite ease-in-out;
      }
      .ck-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
      .ck-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes ckTypingBounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-7px); }
      }

      /* Mascot Actor Box */
      .ck-actor-box {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      /* Ambient Aura Effect */
      .ck-mascot-aura {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 110%;
        height: 110%;
        border-radius: 50%;
        background: radial-gradient(circle, var(--ck-aura-color) 0%, rgba(255, 255, 255, 0) 70%);
        filter: blur(20px);
        pointer-events: none;
        transition: background 0.4s ease;
        animation: ckAuraPulse 2.8s ease-in-out infinite;
        z-index: 1;
      }

      @keyframes ckAuraPulse {
        0%, 100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.65; }
        50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
      }

      /* Rotating Halo for Thinking/Loading */
      .ck-mascot-halo {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 105%;
        height: 105%;
        border-radius: 50%;
        border: 3px dashed rgba(255, 255, 255, 0.45);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        animation: ckHaloSpin 8s linear infinite;
        z-index: 2;
      }
      .ck-mascot-halo.ck-active {
        opacity: 0.75;
      }

      @keyframes ckHaloSpin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }

      /* Ground Shadow */
      .ck-ground-shadow {
        position: absolute;
        bottom: -6px;
        width: 70%;
        height: 20px;
        background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0) 70%);
        border-radius: 50%;
        pointer-events: none;
        transition: transform 0.2s ease;
        z-index: 3;
      }

      /* Sprite Wrapper */
      .ck-sprite-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.18));
        transform-origin: 50% 90%;
        z-index: 5;
        transition: transform 0.12s ease-out;
      }

      .ck-sprite-img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        pointer-events: none;
        display: block;
      }

      /* Floating heart FX */
      .ck-fx-heart {
        position: absolute;
        pointer-events: none;
        user-select: none;
        z-index: 15;
        animation: ckFloatParticle 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }

      @keyframes ckFloatParticle {
        0% { transform: translateY(0) scale(0.6); opacity: 1; }
        100% { transform: translateY(-70px) translateX(var(--ck-tx, 0px)) scale(1.2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Main ChiikawaMascot Component Class
  class ChiikawaMascot {
    constructor(options = {}) {
      this.options = Object.assign({
        container: null,
        mode: 'inline', // 'inline' or 'floating'
        position: 'bottom-right', // for floating: 'bottom-right' or 'bottom-left'
        assetPath: './chiikawa_poses/',
        size: 260,
        initialPose: 'hello',
        initialText: 'Xin chào! Tớ là Chiikawa, trợ lý ảo AI của bạn~! 👋',
        sound: true,
        interactive: true,
        onPoseChange: null,
        onClick: null,
      }, options);

      // Normalize assetPath trailing slash
      if (!this.options.assetPath.endsWith('/')) {
        this.options.assetPath += '/';
      }

      this.sound = new SoundFX();
      this.sound.enabled = this.options.sound;

      this.currentPose = this.options.initialPose;
      this.currentText = this.options.initialText;
      this.pokeCycle = 0;
      this.animTime = 0;
      this.mouseTilt = 0;
      this.isDestroyed = false;

      injectStyles();
      this.mount();
      this.startAnimationLoop();
    }

    mount() {
      // Determine root element
      if (this.options.mode === 'floating') {
        this.rootEl = document.createElement('div');
        this.rootEl.className = `ck-mascot-root ck-floating ck-pos-${this.options.position}`;
        document.body.appendChild(this.rootEl);
      } else {
        if (typeof this.options.container === 'string') {
          this.rootEl = document.querySelector(this.options.container);
        } else if (this.options.container instanceof HTMLElement) {
          this.rootEl = this.options.container;
        }

        if (!this.rootEl) {
          this.rootEl = document.createElement('div');
          document.body.appendChild(this.rootEl);
        }
        this.rootEl.classList.add('ck-mascot-root');
      }

      this.rootEl.style.width = `${this.options.size}px`;

      // Build DOM structure
      this.rootEl.innerHTML = `
        <div class="ck-speech-bubble" style="display: ${this.currentText ? 'block' : 'none'};">
          <span class="ck-speech-text">${this.currentText}</span>
        </div>
        <div class="ck-actor-box" style="width: ${this.options.size}px; height: ${this.options.size}px;">
          <div class="ck-mascot-aura"></div>
          <div class="ck-mascot-halo"></div>
          <div class="ck-ground-shadow"></div>
          <div class="ck-sprite-wrapper" style="width: ${this.options.size}px; height: ${this.options.size}px;">
            <img class="ck-sprite-img" src="${this.options.assetPath}${this.currentPose}.png" alt="Chiikawa AI Mascot" />
          </div>
        </div>
      `;

      // Cache DOM references
      this.speechBubble = this.rootEl.querySelector('.ck-speech-bubble');
      this.speechText = this.rootEl.querySelector('.ck-speech-text');
      this.actorBox = this.rootEl.querySelector('.ck-actor-box');
      this.auraEl = this.rootEl.querySelector('.ck-mascot-aura');
      this.haloEl = this.rootEl.querySelector('.ck-mascot-halo');
      this.groundShadow = this.rootEl.querySelector('.ck-ground-shadow');
      this.spriteWrapper = this.rootEl.querySelector('.ck-sprite-wrapper');
      this.spriteImg = this.rootEl.querySelector('.ck-sprite-img');

      // Bind interaction
      if (this.options.interactive) {
        this.actorBox.addEventListener('click', (e) => this.handlePoke(e));
      }

      // Mouse follow tilt
      this.handleMouseMove = (e) => {
        if (this.isDestroyed) return;
        const rect = this.actorBox.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        this.mouseTilt = Math.max(-1, Math.min(1, dx)) * 5;
      };
      window.addEventListener('mousemove', this.handleMouseMove);

      this.setPose(this.currentPose, this.currentText);
    }

    setPose(poseId, message = null) {
      if (!POSES[poseId]) {
        console.warn(`[ChiikawaMascot] Unknown pose: "${poseId}". Available:`, Object.keys(POSES));
        return;
      }
      this.currentPose = poseId;
      const meta = POSES[poseId];

      // Update image
      this.spriteImg.src = `${this.options.assetPath}${meta.id}.png`;

      // Update aura color & halo
      this.rootEl.style.setProperty('--ck-aura-color', meta.aura);
      if (poseId === 'loading' || poseId === 'search' || poseId === 'wait') {
        this.haloEl.classList.add('ck-active');
      } else {
        this.haloEl.classList.remove('ck-active');
      }

      // Update text
      if (message !== null) {
        this.say(message);
      }

      // Squash bounce on pose switch
      this.spriteWrapper.style.transform = 'scale(1.12, 0.9)';
      setTimeout(() => {
        if (!this.isDestroyed) this.spriteWrapper.style.transform = '';
      }, 150);

      if (typeof this.options.onPoseChange === 'function') {
        this.options.onPoseChange(poseId, message);
      }
    }

    say(text) {
      this.currentText = text;
      if (!text) {
        this.speechBubble.style.display = 'none';
        return;
      }
      this.speechBubble.style.display = 'block';
      this.speechText.innerHTML = text;
      this.speechBubble.classList.remove('ck-hidden');
    }

    // === AI Chat Lifecycle Shortcuts ===

    think(message = "Đang suy nghĩ...") {
      this.sound.play('squeak');
      this.setPose('wait', `🤔 <strong>${message}</strong>`);
    }

    load(message = "Đang tạo câu trả lời...") {
      this.setPose('loading', `<div class="ck-typing-dots"><span></span><span></span><span></span></div> <span>${message}</span>`);
    }

    search(message = "Đang tra cứu dữ liệu...") {
      this.sound.play('squeak');
      this.setPose('search', `🔍 <strong>${message}</strong>`);
    }

    answer(message) {
      this.sound.play('jump');
      this.setPose('announce', `📢 ${message}`);
    }

    success(message = "Hoàn thành!") {
      this.sound.play('jump');
      this.setPose('success', `🎉 <strong>${message}</strong>`);
    }

    error(message = "Đã xảy ra lỗi!") {
      this.sound.play('cry');
      this.setPose('error', `😭 <span style="color:#e11d48;">${message}</span>`);
    }

    // Interactive Touch / Poke
    handlePoke(e) {
      this.pokeCycle = (this.pokeCycle + 1) % 4;
      this.sound.play('poke');

      this.spawnHeartBurst(e ? e.clientX : null, e ? e.clientY : null);

      // Squish animation
      this.spriteWrapper.style.transform = 'scale(1.18, 0.82)';
      setTimeout(() => {
        if (this.isDestroyed) return;
        this.spriteWrapper.style.transform = 'scale(0.9, 1.12)';
        setTimeout(() => {
          if (!this.isDestroyed) this.spriteWrapper.style.transform = '';
        }, 120);
      }, 90);

      const pokeReactions = [
        { pose: 'awesome', msg: 'Yay! Cảm ơn bạn đã cưng tớ~! 👍💖' },
        { pose: 'thanks',  msg: 'Bé ngoan nè! Cảm ơn bạn nhiều nha~! 🙏✨' },
        { pose: 'welcome', msg: 'Hihi nhột quá à~! Chúc bạn một ngày vui vẻ! 🎉' },
        { pose: 'start',   msg: 'Tớ đã sẵn sàng giúp bạn rồi nè! Hỏi tớ đi! 🦸' },
      ];

      const r = pokeReactions[this.pokeCycle];
      this.setPose(r.pose, r.msg);

      if (typeof this.options.onClick === 'function') {
        this.options.onClick(e);
      }
    }

    poke() {
      this.handlePoke(null);
    }

    spawnHeartBurst(clientX, clientY) {
      const hearts = ['💖', '💕', '✨', '🌸', '⭐'];
      const rect = this.actorBox.getBoundingClientRect();
      const originX = clientX ? (clientX - rect.left) : (rect.width / 2);
      const originY = clientY ? (clientY - rect.top) : (rect.height / 2);

      for (let i = 0; i < 5; i++) {
        const heart = document.createElement('div');
        heart.className = 'ck-fx-heart';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = `${originX + (Math.random() - 0.5) * 50}px`;
        heart.style.top = `${originY + (Math.random() - 0.5) * 30}px`;
        heart.style.fontSize = `${18 + Math.random() * 8}px`;
        heart.style.setProperty('--ck-tx', `${(Math.random() - 0.5) * 80}px`);
        this.actorBox.appendChild(heart);
        setTimeout(() => heart.remove(), 1200);
      }
    }

    // Animation physics loop
    startAnimationLoop() {
      let lastTime = performance.now();

      const loop = (now) => {
        if (this.isDestroyed) return;
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        this.animTime += dt;

        const p = this.currentPose;

        if (p === 'hello' || p === 'awesome' || p === 'thanks') {
          const scaleY = 1 + Math.sin(this.animTime * 3) * 0.025;
          const scaleX = 1 - Math.sin(this.animTime * 3) * 0.015;
          this.spriteWrapper.style.transform = `rotate(${this.mouseTilt}deg) scale(${scaleX}, ${scaleY})`;
          this.groundShadow.style.transform = `scale(${1 / scaleX}, 1)`;
        } else if (p === 'welcome' || p === 'success') {
          const jump = Math.abs(Math.sin(this.animTime * 6)) * -24;
          const tilt = Math.sin(this.animTime * 6) * 6;
          this.spriteWrapper.style.transform = `translate(0, ${jump}px) rotate(${tilt}deg)`;
          this.groundShadow.style.transform = `scale(${Math.max(0.65, 1 + jump / 90)}, 1)`;
        } else if (p === 'start') {
          const breathe = Math.sin(this.animTime * 4) * 0.02;
          this.spriteWrapper.style.transform = `scale(${1 + breathe}, ${1 - breathe}) rotate(${Math.sin(this.animTime * 2) * 2}deg)`;
        } else if (p === 'loading') {
          const bob = Math.abs(Math.sin(this.animTime * 10)) * -14;
          const wobble = Math.sin(this.animTime * 10) * 8;
          this.spriteWrapper.style.transform = `translate(0, ${bob}px) rotate(${wobble}deg)`;
        } else if (p === 'search') {
          const lean = Math.sin(this.animTime * 3) * 7;
          const dip = Math.abs(Math.sin(this.animTime * 3)) * 6;
          this.spriteWrapper.style.transform = `translate(${lean * 1.5}px, ${dip}px) rotate(${lean}deg)`;
        } else if (p === 'announce') {
          const pulse = 1 + (Math.sin(this.animTime * 12) > 0.4 ? 0.04 : 0);
          this.spriteWrapper.style.transform = `scale(${pulse})`;
        } else if (p === 'wait') {
          const sway = Math.sin(this.animTime * 2) * 4;
          this.spriteWrapper.style.transform = `rotate(${sway}deg)`;
        } else if (p === 'error') {
          const shakeX = (Math.random() - 0.5) * 6;
          const shakeY = (Math.random() - 0.5) * 5;
          this.spriteWrapper.style.transform = `translate(${shakeX}px, ${shakeY}px) scale(0.98, 0.98)`;
        } else if (p === 'bye') {
          const wave = Math.sin(this.animTime * 4) * 5;
          this.spriteWrapper.style.transform = `translate(${Math.sin(this.animTime * 2) * 6}px, 0) rotate(${wave}deg)`;
        }

        requestAnimationFrame(loop);
      };

      requestAnimationFrame(loop);
    }

    toggleSound(enable) {
      this.sound.enabled = (typeof enable === 'boolean') ? enable : !this.sound.enabled;
      return this.sound.enabled;
    }

    destroy() {
      this.isDestroyed = true;
      window.removeEventListener('mousemove', this.handleMouseMove);
      if (this.rootEl) {
        this.rootEl.remove();
      }
    }
  }

  // Export static POSES list on class
  ChiikawaMascot.POSES = POSES;

  return ChiikawaMascot;
}));
