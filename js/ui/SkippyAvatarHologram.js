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

        // Face feature animation state (holographic overlay on sprite)
        this.faceState = {
            eyeGlow: 0,          // 0-1 intensity
            eyeColor: { r: 0, g: 255, b: 255 },
            targetEyeColor: { r: 0, g: 255, b: 255 },
            eyeScaleX: 1.0,
            eyeScaleY: 1.0,
            targetEyeScaleX: 1.0,
            targetEyeScaleY: 1.0,
            browAngle: 0,
            targetBrowAngle: 0,
            mouthOpen: 0,        // 0-1
            mouthWidth: 1.0,
            blinkTimer: 0,
            blinkInterval: 3 + Math.random() * 4,
            isBlinking: false,
            blinkPhase: 0,
        };

        // Expression face configs (matches beer can expressions)
        this.faceExpressions = {
            idle:             { eyeColor: { r: 0, g: 255, b: 255 }, scaleX: 1.0, scaleY: 1.0, browAngle: 0 },
            talking:          { eyeColor: { r: 0, g: 255, b: 255 }, scaleX: 1.0, scaleY: 1.0, browAngle: 0 },
            smug:             { eyeColor: { r: 0, g: 255, b: 170 }, scaleX: 0.8, scaleY: 0.7, browAngle: 0.15 },
            laughing:         { eyeColor: { r: 68, g: 255, b: 68 }, scaleX: 1.2, scaleY: 0.5, browAngle: 0.2 },
            annoyed:          { eyeColor: { r: 255, g: 136, b: 0 }, scaleX: 0.9, scaleY: 0.6, browAngle: -0.3 },
            excited:          { eyeColor: { r: 255, g: 255, b: 0 }, scaleX: 1.3, scaleY: 1.3, browAngle: 0.25 },
            bored:            { eyeColor: { r: 100, g: 136, b: 136 }, scaleX: 1.0, scaleY: 0.5, browAngle: 0 },
            impressed:        { eyeColor: { r: 0, g: 200, b: 255 }, scaleX: 1.2, scaleY: 1.2, browAngle: 0.2 },
            disappointed:     { eyeColor: { r: 136, g: 136, b: 136 }, scaleX: 0.8, scaleY: 0.8, browAngle: -0.1 },
            mildlyImpressed:  { eyeColor: { r: 0, g: 220, b: 170 }, scaleX: 1.1, scaleY: 1.05, browAngle: 0.1 },
            neutral:          { eyeColor: { r: 0, g: 220, b: 220 }, scaleX: 1.0, scaleY: 1.0, browAngle: 0 },
            alarmed:          { eyeColor: { r: 255, g: 50, b: 0 }, scaleX: 1.4, scaleY: 1.4, browAngle: -0.35 },
            concerned:        { eyeColor: { r: 255, g: 170, b: 0 }, scaleX: 1.1, scaleY: 1.1, browAngle: -0.2 },
            lecturing:        { eyeColor: { r: 136, g: 136, b: 255 }, scaleX: 0.9, scaleY: 0.9, browAngle: -0.15 },
        };

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

        // Update face animation state
        this._updateFaceState(dt);

        // 1. Background (subtle transparent - hologram floats over game)
        ctx.save();
        ctx.clearRect(0, 0, w, h);
        const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
        bgGrad.addColorStop(0, 'rgba(0,8,18,0.4)');
        bgGrad.addColorStop(1, 'rgba(0,2,6,0.15)');
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

        // 5b. Face features (holographic eyes, brows, mouth)
        this._drawFaceFeatures(ctx, sx, sy, sw, sh);

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

        // 13. Border glow (removed - floating hologram has no frame)
    };

    _updateFaceState(dt) {
        const fs = this.faceState;
        const expr = this.faceExpressions[this.expression] || this.faceExpressions.idle;
        const lerpSpeed = 5 * dt;

        // Lerp eye color
        fs.eyeColor.r += (expr.eyeColor.r - fs.eyeColor.r) * lerpSpeed;
        fs.eyeColor.g += (expr.eyeColor.g - fs.eyeColor.g) * lerpSpeed;
        fs.eyeColor.b += (expr.eyeColor.b - fs.eyeColor.b) * lerpSpeed;

        // Lerp eye scale
        fs.eyeScaleX += (expr.scaleX - fs.eyeScaleX) * lerpSpeed;
        fs.eyeScaleY += (expr.scaleY - fs.eyeScaleY) * lerpSpeed;

        // Lerp brow angle
        fs.browAngle += (expr.browAngle - fs.browAngle) * lerpSpeed;

        // Blink logic
        fs.blinkTimer += dt;
        if (!fs.isBlinking && fs.blinkTimer > fs.blinkInterval) {
            fs.isBlinking = true;
            fs.blinkPhase = 0;
            fs.blinkTimer = 0;
            fs.blinkInterval = 2.5 + Math.random() * 4;
        }
        if (fs.isBlinking) {
            fs.blinkPhase += dt * 8;
            if (fs.blinkPhase > Math.PI) {
                fs.isBlinking = false;
                fs.blinkPhase = 0;
            }
        }

        // Mouth animation
        if (this.isTalking) {
            const talkFreq = 8;
            fs.mouthOpen = 0.3 + Math.abs(Math.sin(this.talkTimer * talkFreq)) * 0.7;
            fs.mouthWidth = 1.0 + Math.sin(this.talkTimer * talkFreq * 0.7) * 0.15;
        } else {
            fs.mouthOpen *= 0.85; // smooth close
            fs.mouthWidth += (1.0 - fs.mouthWidth) * lerpSpeed;
        }

        // Eye glow pulsing
        fs.eyeGlow = 0.6 + Math.sin(this.time * 2.5) * 0.15;
        if (this.gameState.inCombat) fs.eyeGlow += 0.2;
    }

    _drawFaceFeatures(ctx, sx, sy, sw, sh) {
        const fs = this.faceState;
        const combat = this.gameState.inCombat;

        // Face position offsets relative to sprite
        // Large hat ends ~28%, tiny face 29-38%, eyes ~33%, mouth ~37%
        const eyeY = sy + sh * 0.33;
        const eyeSpacing = sw * 0.065;
        const eyeCenterX = sx + sw * 0.44; // face center slightly left
        const mouthY = sy + sh * 0.375;

        const er = Math.round(fs.eyeColor.r);
        const eg = Math.round(fs.eyeColor.g);
        const eb = Math.round(fs.eyeColor.b);
        const eyeColorStr = `${er},${eg},${eb}`;

        // Scale features to sprite size (face is small relative to full body)
        const faceScale = sw / 130; // normalize to expected sprite width
        // Blink factor: 1 = open, 0 = closed
        const blinkFactor = fs.isBlinking ? Math.max(0, Math.cos(fs.blinkPhase)) : 1;
        const eyeH = 2.5 * faceScale * fs.eyeScaleY * blinkFactor;
        const eyeW = 3 * faceScale * fs.eyeScaleX;

        // Draw holographic eyes (glowing ellipses)
        ctx.save();
        ctx.globalCompositeOperation = 'lighten';

        for (const side of [-1, 1]) {
            const ex = eyeCenterX + side * eyeSpacing;

            // Outer glow
            const eyeGrad = ctx.createRadialGradient(ex, eyeY, 0, ex, eyeY, eyeW * 1.5);
            eyeGrad.addColorStop(0, `rgba(${eyeColorStr},${(fs.eyeGlow * 0.2).toFixed(2)})`);
            eyeGrad.addColorStop(1, `rgba(${eyeColorStr},0)`);
            ctx.fillStyle = eyeGrad;
            ctx.fillRect(ex - eyeW * 1.8, eyeY - eyeW * 1.8, eyeW * 3.6, eyeW * 3.6);

            // Eye core
            if (eyeH > 0.5) {
                ctx.beginPath();
                ctx.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${eyeColorStr},${(fs.eyeGlow * 0.7).toFixed(2)})`;
                ctx.fill();

                // Bright pupil center
                ctx.beginPath();
                ctx.ellipse(ex, eyeY, eyeW * 0.35, eyeH * 0.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${(fs.eyeGlow * 0.5).toFixed(2)})`;
                ctx.fill();
            }

            // Brow line (holographic)
            ctx.save();
            ctx.translate(ex, eyeY - eyeH - 2.5 * faceScale);
            ctx.rotate(side * fs.browAngle);
            ctx.fillStyle = `rgba(${eyeColorStr},${(fs.eyeGlow * 0.3).toFixed(2)})`;
            ctx.fillRect(-eyeW * 0.7, -0.5, eyeW * 1.4, 1.2 * faceScale);
            ctx.restore();
        }

        // Mouth (holographic arc/line)
        if (fs.mouthOpen > 0.05) {
            const mouthW = sw * 0.04 * fs.mouthWidth;
            const mouthH = (1.0 + fs.mouthOpen * 3) * faceScale;
            const mouthGrad = ctx.createRadialGradient(
                eyeCenterX, mouthY, 0,
                eyeCenterX, mouthY, mouthW * 1.5
            );
            mouthGrad.addColorStop(0, `rgba(${eyeColorStr},${(fs.eyeGlow * 0.4).toFixed(2)})`);
            mouthGrad.addColorStop(1, `rgba(${eyeColorStr},0)`);
            ctx.fillStyle = mouthGrad;
            ctx.fillRect(eyeCenterX - mouthW * 1.5, mouthY - mouthH, mouthW * 3, mouthH * 2);

            // Mouth shape
            ctx.beginPath();
            ctx.ellipse(eyeCenterX, mouthY, mouthW, mouthH * 0.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${eyeColorStr},${(fs.eyeGlow * 0.45).toFixed(2)})`;
            ctx.fill();
        } else {
            // Subtle closed mouth line
            ctx.fillStyle = `rgba(${eyeColorStr},${(fs.eyeGlow * 0.2).toFixed(2)})`;
            const mouthW = sw * 0.035;
            ctx.fillRect(eyeCenterX - mouthW, mouthY - 0.5, mouthW * 2, 1);
        }

        ctx.restore();
    }

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
