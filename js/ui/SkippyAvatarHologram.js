// =============================================
// Skippy Avatar - Holographic Admiral Sprite
// Sprite-based with animated holographic effects
// Used for serious/strategic expressions (lecturing, concerned, alarmed)
// =============================================

export class SkippyAvatarHologram {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.img = null;
        this.imgLoaded = false;
        this.animFrameId = null;
        this.disposed = false;
        this.paused = false;

        // Sprite layout
        this.spriteX = 0;
        this.spriteY = 0;
        this.spriteW = 0;
        this.spriteH = 0;

        // State
        this.expression = 'idle';
        this.isTalking = false;
        this.talkTimer = 0;
        this.gameState = {
            inCombat: false,
            shieldPct: 1,
            isWarping: false,
            isDocked: false,
            isSpeaking: false,
        };

        // Animation accumulators
        this.time = 0;
        this.lastFrame = 0;

        // Glitch state
        this.nextGlitch = 2000 + Math.random() * 4000;
        this.glitchActive = false;
        this.glitchEnd = 0;
        this.glitchSlices = [];

        // Flicker state
        this.flickerActive = false;
        this.flickerOffsetX = 0;
        this.flickerOpacity = 1;

        // Expression tint colors
        this.tintColors = {
            idle:             'rgba(0,255,255,0.07)',
            talking:          'rgba(0,255,255,0.10)',
            smug:             'rgba(0,255,170,0.08)',
            alarmed:          'rgba(255,30,0,0.12)',
            annoyed:          'rgba(255,136,0,0.10)',
            laughing:         'rgba(68,255,68,0.10)',
            excited:          'rgba(255,255,0,0.08)',
            bored:            'rgba(100,130,130,0.10)',
            concerned:        'rgba(255,170,0,0.08)',
            impressed:        'rgba(0,200,255,0.08)',
            disappointed:     'rgba(130,130,130,0.08)',
            mildlyImpressed:  'rgba(0,220,170,0.07)',
            lecturing:        'rgba(136,136,255,0.08)',
            neutral:          'rgba(0,220,220,0.06)',
        };

        // Offscreen canvas for chromatic aberration
        this._offscreen = null;
        this._offCtx = null;
    }

    init() {
        const width = this.container.clientWidth || 208;
        const height = this.container.clientHeight || 180;
        const dpr = Math.min(window.devicePixelRatio, 2);

        this.canvas = document.createElement('canvas');
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.className = 'skippy-hologram-canvas';
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(dpr, dpr);
        this.displayW = width;
        this.displayH = height;

        // Offscreen for compositing tricks
        this._offscreen = document.createElement('canvas');
        this._offscreen.width = width * dpr;
        this._offscreen.height = height * dpr;
        this._offCtx = this._offscreen.getContext('2d');
        this._offCtx.scale(dpr, dpr);

        // Load sprite
        this.img = new Image();
        this.img.onload = () => {
            this.imgLoaded = true;
            this._computeSpriteLayout();
        };
        this.img.src = 'assets/art/Skippy.png';

        this.lastFrame = performance.now();
        this.animate();
    }

    /**
     * Resize the canvas buffer to new dimensions (fixes CSS squish)
     */
    resize(width, height) {
        if (!this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio, 2);

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(dpr, dpr);
        this.displayW = width;
        this.displayH = height;

        this._offscreen.width = width * dpr;
        this._offscreen.height = height * dpr;
        this._offCtx = this._offscreen.getContext('2d');
        this._offCtx.scale(dpr, dpr);

        if (this.imgLoaded) this._computeSpriteLayout();
    }

    _computeSpriteLayout() {
        if (!this.img) return;
        const iw = this.img.naturalWidth;
        const ih = this.img.naturalHeight;
        const cw = this.displayW;
        const ch = this.displayH;

        const margin = 4;
        const aw = cw - margin * 2;
        const ah = ch - margin * 2;
        const scale = Math.min(aw / iw, ah / ih);

        this.spriteW = iw * scale;
        this.spriteH = ih * scale;
        this.spriteX = (cw - this.spriteW) / 2;
        this.spriteY = (ch - this.spriteH) / 2;
    }

    show() {
        if (this.canvas) this.canvas.style.display = 'block';
    }

    hide() {
        if (this.canvas) this.canvas.style.display = 'none';
    }

    pause() {
        this.paused = true;
    }

    resume() {
        if (!this.paused) return;
        this.paused = false;
        this.lastFrame = performance.now();
        if (!this.animFrameId && !this.disposed) {
            this.animate();
        }
    }

    setExpression(type) {
        this.expression = type;
    }

    startTalking() {
        this.isTalking = true;
        this.talkTimer = 0;
    }

    stopTalking() {
        this.isTalking = false;
    }

    updateGameState(state) {
        if (state) {
            Object.assign(this.gameState, state);
        }
    }

    // ---- Main render loop ----
    animate = () => {
        if (this.disposed) return;
        if (this.paused) {
            this.animFrameId = null;
            return;
        }
        this.animFrameId = requestAnimationFrame(this.animate);

        const now = performance.now();
        const dt = (now - this.lastFrame) / 1000;
        this.lastFrame = now;
        this.time += dt;
        if (this.isTalking) this.talkTimer += dt;

        const ctx = this.ctx;
        const w = this.displayW;
        const h = this.displayH;
        const t = this.time;
        const combat = this.gameState.inCombat;

        // 1. Background
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
        bgGrad.addColorStop(0, '#000d1a');
        bgGrad.addColorStop(1, '#000308');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        if (!this.imgLoaded) return;

        // Bob offset
        const bobSpeed = combat ? 3.0 : (this.gameState.isDocked ? 0.8 : 1.5);
        const bobAmp = combat ? 3.0 : (this.gameState.isDocked ? 1.0 : 1.8);
        const bobY = Math.sin(t * bobSpeed) * bobAmp;

        // Flicker check
        const flickerChance = combat ? 0.03 : 0.012;
        if (Math.random() < flickerChance) {
            this.flickerActive = true;
            this.flickerOffsetX = (Math.random() - 0.5) * 3;
            this.flickerOpacity = 0.4 + Math.random() * 0.4;
            setTimeout(() => {
                this.flickerActive = false;
                this.flickerOffsetX = 0;
                this.flickerOpacity = 1;
            }, 30 + Math.random() * 50);
        }

        // Glitch timing
        const nowMs = now;
        if (nowMs > this.nextGlitch && !this.glitchActive) {
            this.glitchActive = true;
            this.glitchEnd = nowMs + 50 + Math.random() * 80;
            this.glitchSlices = this._generateGlitchSlices();
            const interval = combat ? (1000 + Math.random() * 2000) : (2000 + Math.random() * 6000);
            this.nextGlitch = nowMs + this.glitchEnd - nowMs + interval;
        }
        if (this.glitchActive && nowMs > this.glitchEnd) {
            this.glitchActive = false;
        }

        // Sprite draw position with bob and flicker
        const sx = this.spriteX + (this.flickerActive ? this.flickerOffsetX : 0);
        const sy = this.spriteY + bobY;
        const sw = this.spriteW;
        const sh = this.spriteH;
        const globalAlpha = this.flickerActive ? this.flickerOpacity : 1;

        ctx.save();
        ctx.globalAlpha = globalAlpha;

        // 2. Edge glow
        ctx.save();
        ctx.shadowColor = combat ? 'rgba(255,60,60,0.5)' : 'rgba(0,255,255,0.45)';
        ctx.shadowBlur = this.isTalking ? 18 : 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.drawImage(this.img, sx, sy, sw, sh);
        ctx.restore();

        // 3. Base sprite
        ctx.drawImage(this.img, sx, sy, sw, sh);

        // 4. Chromatic aberration
        const caOffset = combat ? 2.0 : 1.2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighten';
        ctx.globalAlpha = 0.12;
        this._drawTintedSprite(ctx, sx + caOffset, sy, sw, sh, 'rgba(255,0,0,0.5)');
        this._drawTintedSprite(ctx, sx - caOffset, sy, sw, sh, 'rgba(0,80,255,0.5)');
        ctx.restore();

        // 5. Expression tint overlay
        const tintColor = this.tintColors[this.expression] || this.tintColors.idle;
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = tintColor;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Combat red shift overlay
        if (combat) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255,0,0,0.06)';
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        // 6. Glitch slices
        if (this.glitchActive && this.glitchSlices.length > 0) {
            this._drawGlitchSlices(ctx, sx, sy, sw, sh);
        }

        ctx.restore(); // restore globalAlpha

        // 7. Scan lines
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let ly = 0; ly < h; ly += 3) {
            ctx.fillRect(0, ly, w, 1);
        }
        ctx.restore();

        // 8. Sweep line
        const sweepCycle = combat ? 1.5 : 3.0;
        const sweepPos = ((t % sweepCycle) / sweepCycle) * h;
        ctx.save();
        const sweepGrad = ctx.createLinearGradient(0, sweepPos - 6, 0, sweepPos + 6);
        sweepGrad.addColorStop(0, 'rgba(0,255,255,0)');
        sweepGrad.addColorStop(0.5, combat ? 'rgba(255,100,100,0.18)' : 'rgba(0,255,255,0.18)');
        sweepGrad.addColorStop(1, 'rgba(0,255,255,0)');
        ctx.fillStyle = sweepGrad;
        ctx.fillRect(0, sweepPos - 6, w, 12);
        ctx.restore();

        // 9. Static noise
        this._drawStaticNoise(ctx, w, h, combat);

        // 10. Talking glow pulse
        if (this.isTalking) {
            const talkPulse = 0.5 + Math.abs(Math.sin(this.talkTimer * 8)) * 0.5;
            ctx.save();
            ctx.globalCompositeOperation = 'lighten';
            const mouthY = sy + sh * 0.55;
            const mouthH = sh * 0.35;
            const talkGrad = ctx.createRadialGradient(
                sx + sw / 2, mouthY + mouthH / 2, 0,
                sx + sw / 2, mouthY + mouthH / 2, sw * 0.4
            );
            const glowAlpha = (0.06 + talkPulse * 0.08).toFixed(3);
            talkGrad.addColorStop(0, `rgba(0,255,255,${glowAlpha})`);
            talkGrad.addColorStop(1, 'rgba(0,255,255,0)');
            ctx.fillStyle = talkGrad;
            ctx.fillRect(sx, mouthY, sw, mouthH);
            ctx.restore();
        }

        // 11. Combat beacon
        if (combat) {
            const beaconOn = Math.sin(t * 4) > 0.3;
            if (beaconOn) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighten';
                const beaconGrad = ctx.createRadialGradient(w / 2, 6, 0, w / 2, 6, 20);
                beaconGrad.addColorStop(0, 'rgba(255,30,0,0.35)');
                beaconGrad.addColorStop(1, 'rgba(255,0,0,0)');
                ctx.fillStyle = beaconGrad;
                ctx.fillRect(0, 0, w, 30);
                ctx.restore();
            }
        }

        // 12. Vignette
        ctx.save();
        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.7);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // 13. Border glow
        ctx.save();
        ctx.strokeStyle = combat ? 'rgba(255,50,50,0.25)' : 'rgba(0,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        ctx.restore();
    };

    _drawTintedSprite(ctx, x, y, w, h, tint) {
        const oc = this._offCtx;
        const cw = this.displayW;
        const ch = this.displayH;
        oc.clearRect(0, 0, cw, ch);
        oc.globalCompositeOperation = 'source-over';
        oc.globalAlpha = 1;
        oc.drawImage(this.img, x, y, w, h);
        oc.globalCompositeOperation = 'source-atop';
        oc.fillStyle = tint;
        oc.fillRect(0, 0, cw, ch);
        ctx.drawImage(this._offscreen, 0, 0, this._offscreen.width, this._offscreen.height, 0, 0, cw, ch);
    }

    _generateGlitchSlices() {
        const sliceCount = 3 + Math.floor(Math.random() * 4);
        const slices = [];
        for (let i = 0; i < sliceCount; i++) {
            slices.push({
                yPct: Math.random(),
                hPct: 0.02 + Math.random() * 0.06,
                offset: (Math.random() - 0.5) * 12,
            });
        }
        return slices;
    }

    _drawGlitchSlices(ctx, sx, sy, sw, sh) {
        ctx.save();
        for (const slice of this.glitchSlices) {
            const sliceY = sy + slice.yPct * sh;
            const sliceH = slice.hPct * sh;
            const srcY = slice.yPct * this.img.naturalHeight;
            const srcH = slice.hPct * this.img.naturalHeight;
            ctx.drawImage(
                this.img,
                0, srcY, this.img.naturalWidth, srcH,
                sx + slice.offset, sliceY, sw, sliceH
            );
            ctx.globalCompositeOperation = 'lighten';
            ctx.fillStyle = 'rgba(0,255,255,0.08)';
            ctx.fillRect(sx + slice.offset, sliceY, sw, sliceH);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
    }

    _drawStaticNoise(ctx, w, h, combat) {
        const density = combat ? 35 : 18;
        ctx.save();
        for (let i = 0; i < density; i++) {
            const nx = Math.random() * w;
            const ny = Math.random() * h;
            const brightness = 150 + Math.floor(Math.random() * 105);
            ctx.fillStyle = `rgba(${brightness},${brightness + 30},${brightness + 50},${(0.15 + Math.random() * 0.25).toFixed(2)})`;
            ctx.fillRect(nx, ny, 1, 1);
        }
        ctx.restore();
    }

    dispose() {
        this.disposed = true;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.remove();
        }
        this._offscreen = null;
        this._offCtx = null;
        this.img = null;
    }
}
