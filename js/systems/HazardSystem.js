// =============================================
// Hazard System
// Environmental dangers per sector
// =============================================

import { CONFIG } from '../config.js';

export class HazardSystem {
    constructor(game) {
        this.game = game;
        this.activeHazard = null;
        this.timer = 0;
        this.warningShown = false;
        this.hudElement = null;

        this.createHUD();
    }

    createHUD() {
        this.hudElement = document.getElementById('hazard-warning');
    }

    /**
     * Add a temporary event-driven hazard
     */
    addTemporaryHazard(hazard, duration) {
        this._tempHazard = hazard;
        this._tempHazardTimer = duration;
        this.activeHazard = hazard;
        this.timer = 0;
        this.warningShown = false;
        if (this.hudElement) {
            this.hudElement.classList.remove('hidden');
            this.hudElement.style.borderColor = hazard.color;
            this.hudElement.querySelector('.hazard-name').textContent = hazard.name;
            this.hudElement.querySelector('.hazard-icon').style.color = hazard.color;
        }
        this.game.ui?.showToast(hazard.warning, 'warning');
    }

    removeTemporaryHazard() {
        if (!this._tempHazard) return;
        this._tempHazard = null;
        this._tempHazardTimer = 0;
        // Restore sector's base hazard
        const hazards = CONFIG.SECTOR_HAZARDS || {};
        const sectorId = this.game.currentSector?.id;
        this.activeHazard = hazards[sectorId] || null;
        if (!this.activeHazard && this.hudElement) {
            this.hudElement.classList.add('hidden');
        }
    }

    /**
     * Called when sector changes
     */
    onSectorChange(sectorId) {
        this._tempHazard = null;
        this._tempHazardTimer = 0;
        const hazards = CONFIG.SECTOR_HAZARDS || {};
        this.activeHazard = hazards[sectorId] || null;
        this.timer = 0;
        this.warningShown = false;

        // Remove nebula overlay when leaving
        const nebulaOverlay = document.getElementById('hazard-nebula-overlay');
        if (nebulaOverlay) nebulaOverlay.style.opacity = '0';

        if (this.hudElement) {
            if (this.activeHazard) {
                this.hudElement.classList.remove('hidden');
                this.hudElement.style.borderColor = this.activeHazard.color;
                this.hudElement.querySelector('.hazard-name').textContent = this.activeHazard.name;
                this.hudElement.querySelector('.hazard-icon').style.color = this.activeHazard.color;
            } else {
                this.hudElement.classList.add('hidden');
            }
        }

        // Show entry warning
        if (this.activeHazard) {
            this.game.ui?.showToast(this.activeHazard.warning, 'warning');
            this.game.ui?.log(this.activeHazard.warning, 'system');
        }
    }

    update(dt) {
        // Tick temporary hazard duration
        if (this._tempHazard && this._tempHazardTimer > 0) {
            this._tempHazardTimer -= dt;
            if (this._tempHazardTimer <= 0) this.removeTemporaryHazard();
        }
        if (!this.activeHazard) return;
        const player = this.game.player;
        if (!player?.alive) return;

        this.timer += dt;

        switch (this.activeHazard.type) {
            case 'radiation':
                this.updateRadiation(dt, player);
                break;
            case 'ion-storm':
                this.updateIonStorm(dt, player);
                break;
            case 'nebula-interference':
                this.updateNebulaInterference(dt, player);
                break;
        }
    }

    updateRadiation(dt, player) {
        const hazard = this.activeHazard;
        if (this.timer >= hazard.interval) {
            this.timer -= hazard.interval;

            // Direct hull damage (bypasses shields to represent radiation)
            const dmg = hazard.damagePerSecond * hazard.interval;
            player.hull = Math.max(0, player.hull - dmg);

            // Visual feedback - radiation sparks
            this.game.renderer?.effects?.spawn('hit', player.x, player.y, {
                count: 3,
                color: 0xff2200,
            });

            // Geiger counter click effect
            if (Math.random() < 0.6) {
                this.game.audio?.play('click', 0.3);
            }

            // Red tint overlay pulse
            this.flashRadiationOverlay();

            // Periodic warning
            if (Math.random() < 0.3) {
                this.game.ui?.log('Radiation damaging hull!', 'combat');
            }

            // Flash the hazard HUD
            this.pulseHUD();

            // Check for death
            if (player.hull <= 0) {
                player.die();
            }
        }

        // Continuous faint red shimmer on screen
        this.radiationFlicker = (this.radiationFlicker || 0) + dt;
        if (this.radiationFlicker > 0.5 && Math.random() < 0.05) {
            this.radiationFlicker = 0;
            const overlay = document.getElementById('damage-flash');
            if (overlay) {
                overlay.style.boxShadow = `inset 0 0 150px rgba(255, 30, 0, ${0.05 + Math.random() * 0.08})`;
                overlay.style.opacity = '1';
                setTimeout(() => { overlay.style.opacity = '0'; }, 200);
            }
        }
    }

    updateIonStorm(dt, player) {
        const hazard = this.activeHazard;
        if (this.timer >= hazard.interval) {
            this.timer -= hazard.interval;

            // Drain capacitor
            const drain = hazard.capDrainPerSecond * hazard.interval;
            if (player.capacitor !== undefined) {
                player.capacitor = Math.max(0, player.capacitor - drain);
            }

            // Screen interference effect
            if (Math.random() < 0.2) {
                this.flashStaticEffect();
            }

            // Periodic warning
            if (Math.random() < 0.2) {
                this.game.ui?.log('Ion storm draining capacitor!', 'system');
            }

            this.pulseHUD();
        }

        // Random lightning flash in viewport
        this.lightningTimer = (this.lightningTimer || 0) + dt;
        if (this.lightningTimer > 1.5 + Math.random() * 4) {
            this.lightningTimer = 0;
            this.flashLightning(player);
        }
    }

    updateNebulaInterference(dt, player) {
        // Persistent subtle purple vignette
        let overlay = document.getElementById('hazard-nebula-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'hazard-nebula-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10;transition:opacity 0.5s;';
            document.getElementById('ui-overlay')?.appendChild(overlay);
        }

        const t = performance.now() * 0.001;
        const pulse = 0.06 + Math.sin(t * 0.5) * 0.02;
        overlay.style.boxShadow = `inset 0 0 150px rgba(100, 40, 180, ${pulse})`;
        overlay.style.opacity = '1';

        // Occasional sensor static flicker
        this._nebulaStaticTimer = (this._nebulaStaticTimer || 0) + dt;
        if (this._nebulaStaticTimer > 5 + Math.random() * 8) {
            this._nebulaStaticTimer = 0;
            const dmgOverlay = document.getElementById('damage-flash');
            if (dmgOverlay) {
                dmgOverlay.style.boxShadow = 'inset 0 0 100px rgba(80, 30, 160, 0.15)';
                dmgOverlay.style.opacity = '1';
                setTimeout(() => { dmgOverlay.style.opacity = '0'; }, 200);
            }
            if (Math.random() < 0.3) {
                this.game.ui?.log('Sensor interference from nebula', 'system');
            }
        }
    }

    /**
     * Get radar range multiplier for current sector
     */
    getRadarMultiplier() {
        if (this.activeHazard?.type === 'nebula-interference') {
            return this.activeHazard.radarReduction;
        }
        return 1.0;
    }

    pulseHUD() {
        if (!this.hudElement) return;
        this.hudElement.classList.remove('hazard-pulse');
        void this.hudElement.offsetWidth;
        this.hudElement.classList.add('hazard-pulse');
    }

    flashRadiationOverlay() {
        const overlay = document.getElementById('damage-flash');
        if (!overlay) return;
        overlay.style.boxShadow = 'inset 0 0 120px rgba(255, 40, 0, 0.15)';
        overlay.style.opacity = '1';
        setTimeout(() => {
            overlay.style.opacity = '0';
        }, 250);
    }

    flashLightning(player) {
        // Spawn lightning particles in the viewport
        const effects = this.game.renderer?.effects;
        if (effects) {
            // Random position near player
            const angle = Math.random() * Math.PI * 2;
            const dist = 500 + Math.random() * 2000;
            const x = player.x + Math.cos(angle) * dist;
            const y = player.y + Math.sin(angle) * dist;

            effects.spawn('explosion', x, y, {
                count: 8,
                color: 0x8866ff,
                speed: 80,
                size: 4,
                life: 0.3,
            });
        }

        // Brief white flash
        const overlay = document.getElementById('damage-flash');
        if (overlay) {
            overlay.style.boxShadow = 'inset 0 0 200px rgba(150, 100, 255, 0.2)';
            overlay.style.opacity = '1';
            setTimeout(() => {
                overlay.style.opacity = '0';
            }, 80);
        }

        // Camera shake
        if (Math.random() < 0.3) {
            this.game.camera?.shake?.(3, 0.15);
        }

        // Lightning sound (reuse ewar-warning)
        this.game.audio?.play('ewar-warning', 0.3);
    }

    flashStaticEffect() {
        const overlay = document.getElementById('damage-flash');
        if (!overlay) return;
        overlay.style.boxShadow = 'inset 0 0 100px rgba(100, 60, 200, 0.3)';
        overlay.style.opacity = '1';
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.boxShadow = '';
            }, 300);
        }, 150);
    }
}
