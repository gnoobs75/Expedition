// =============================================
// Skippy Avatar - Dual Mode Wrapper
// Manages Beer Can (default) and Hologram (serious) renderers
// Same external API - SkippyManager and SplashScreen need zero changes
// =============================================

import { SkippyAvatarBeerCan } from './SkippyAvatarBeerCan.js';
import { SkippyAvatarHologram } from './SkippyAvatarHologram.js';

// Expressions that trigger hologram mode (serious/strategic)
const HOLOGRAM_EXPRESSIONS = new Set([
    'lecturing', 'concerned', 'alarmed',
]);

export class SkippyAvatar {
    constructor(container) {
        this.container = container;
        this.beerCan = null;
        this.hologram = null;
        this.activeMode = 'beercan'; // 'beercan' | 'hologram'
        this.transitioning = false;
        this.transitionOverlay = null;
        this.disposed = false;
    }

    init() {
        // Create both renderers
        this.beerCan = new SkippyAvatarBeerCan(this.container);
        this.hologram = new SkippyAvatarHologram(this.container);

        // Init both
        this.beerCan.init();
        this.hologram.init();

        // Beer can is default - hide and pause hologram
        this.hologram.hide();
        this.hologram.pause();

        // Create transition overlay canvas
        this._createTransitionOverlay();
    }

    _createTransitionOverlay() {
        this.transitionOverlay = document.createElement('canvas');
        this.transitionOverlay.className = 'skippy-transition-overlay';
        const w = this.container.clientWidth || 208;
        const h = this.container.clientHeight || 180;
        const dpr = Math.min(window.devicePixelRatio, 2);
        this.transitionOverlay.width = w * dpr;
        this.transitionOverlay.height = h * dpr;
        this.transitionOverlay.style.width = w + 'px';
        this.transitionOverlay.style.height = h + 'px';
        this.transitionOverlay.style.display = 'none';
        this.transitionOverlay.style.pointerEvents = 'none';
        this.container.appendChild(this.transitionOverlay);
    }

    _getActive() {
        return this.activeMode === 'beercan' ? this.beerCan : this.hologram;
    }

    _getInactive() {
        return this.activeMode === 'beercan' ? this.hologram : this.beerCan;
    }

    _shouldBeHologram(expression) {
        return HOLOGRAM_EXPRESSIONS.has(expression);
    }

    setExpression(type) {
        // In projection mode, forward to both renderers
        if (this.projectionMode) {
            this.beerCan?.setExpression(type);
            this.hologram?.setExpression(type);
            return;
        }

        const needsHologram = this._shouldBeHologram(type);
        const currentIsHologram = this.activeMode === 'hologram';

        // Switch mode if needed
        if (needsHologram && !currentIsHologram) {
            this._switchMode('hologram', type);
        } else if (!needsHologram && currentIsHologram) {
            this._switchMode('beercan', type);
        } else {
            // Same mode, just forward
            this._getActive().setExpression(type);
        }
    }

    _switchMode(toMode, expression) {
        if (this.transitioning || this.disposed) return;
        if (this.activeMode === toMode) return;

        this.transitioning = true;
        const fromRenderer = this._getActive();
        const toRenderer = toMode === 'beercan' ? this.beerCan : this.hologram;

        // Set expression on target before showing
        toRenderer.setExpression(expression);

        // Play transition
        this._playTransition(() => {
            // Midpoint: swap visible canvas
            fromRenderer.hide();
            fromRenderer.pause();

            this.activeMode = toMode;

            toRenderer.resume();
            toRenderer.show();
        }, () => {
            // Complete
            this.transitioning = false;
        });
    }

    _playTransition(onMidpoint, onComplete) {
        const overlay = this.transitionOverlay;
        if (!overlay) {
            onMidpoint();
            onComplete();
            return;
        }

        const ctx = overlay.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio, 2);
        const w = (this.container.clientWidth || 208);
        const h = (this.container.clientHeight || 180);

        overlay.style.display = 'block';

        const duration = 300;
        const midpoint = duration / 2;
        const start = performance.now();
        let midpointFired = false;

        const animate = () => {
            if (this.disposed) return;

            const elapsed = performance.now() - start;
            const progress = Math.min(elapsed / duration, 1);

            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            // Holographic flicker effect
            const intensity = progress < 0.5
                ? progress * 2       // ramp up to midpoint
                : (1 - progress) * 2; // ramp down after midpoint

            // Glitch bands
            const bandCount = Math.floor(intensity * 8);
            for (let i = 0; i < bandCount; i++) {
                const bandY = Math.random() * h;
                const bandH = 2 + Math.random() * 6;
                const offset = (Math.random() - 0.5) * 10 * intensity;

                ctx.fillStyle = `rgba(0,255,255,${(0.15 + intensity * 0.3).toFixed(2)})`;
                ctx.fillRect(offset, bandY, w, bandH);
            }

            // White flash at midpoint
            if (intensity > 0.8) {
                ctx.fillStyle = `rgba(200,255,255,${((intensity - 0.8) * 2.5).toFixed(2)})`;
                ctx.fillRect(0, 0, w, h);
            }

            // Scan lines overlay
            ctx.fillStyle = `rgba(0,0,0,${(0.1 * intensity).toFixed(2)})`;
            for (let ly = 0; ly < h; ly += 2) {
                ctx.fillRect(0, ly, w, 1);
            }

            ctx.restore();

            // Fire midpoint callback
            if (!midpointFired && elapsed >= midpoint) {
                midpointFired = true;
                onMidpoint();
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                overlay.style.display = 'none';
                ctx.save();
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, w, h);
                ctx.restore();
                onComplete();
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Projection mode: show beer can AND hologram side by side
     * Beer can on left, projection beam in middle, hologram on right
     * Used on splash screen for visual flair
     */
    setProjectionMode() {
        if (!this.beerCan || !this.hologram) return;

        this.projectionMode = true;

        // Show both renderers
        this.beerCan.show();
        this.beerCan.resume();
        this.hologram.show();
        this.hologram.resume();

        // Resize hologram buffer to match its display size (prevents CSS squish)
        this.hologram.resize(130, 180);

        // Add layout classes for CSS positioning
        this.container.classList.add('skippy-projection-mode');

        // Add the projection beam element
        if (!this._projectionBeam) {
            this._projectionBeam = document.createElement('div');
            this._projectionBeam.className = 'skippy-projection-beam';
            this.container.appendChild(this._projectionBeam);
        }
    }

    startTalking() {
        if (this.projectionMode) {
            this.beerCan?.startTalking();
            this.hologram?.startTalking();
        } else {
            this._getActive()?.startTalking();
        }
    }

    stopTalking() {
        if (this.projectionMode) {
            this.beerCan?.stopTalking();
            this.hologram?.stopTalking();
        } else {
            this._getActive()?.stopTalking();
        }
    }

    updateGameState(state) {
        // Forward to both so inactive stays synced
        this.beerCan?.updateGameState(state);
        this.hologram?.updateGameState(state);
    }

    dispose() {
        this.disposed = true;
        this.beerCan?.dispose();
        this.hologram?.dispose();
        if (this.transitionOverlay && this.transitionOverlay.parentNode) {
            this.transitionOverlay.remove();
        }
        if (this._projectionBeam && this._projectionBeam.parentNode) {
            this._projectionBeam.remove();
        }
        this.container?.classList.remove('skippy-projection-mode');
        this.beerCan = null;
        this.hologram = null;
        this.transitionOverlay = null;
        this._projectionBeam = null;
    }
}
