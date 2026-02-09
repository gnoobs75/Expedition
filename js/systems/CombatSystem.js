// =============================================
// Combat System
// Handles weapons fire, damage, and combat effects
// =============================================

import { CONFIG } from '../config.js';
import { Projectile } from '../entities/Projectile.js';

export class CombatSystem {
    constructor(game) {
        this.game = game;

        // Active projectiles
        this.projectiles = [];

        // Damage numbers queue
        this.damageNumbers = [];
    }

    /**
     * Update combat system
     */
    update(dt) {
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update(dt);

            if (!projectile.alive) {
                this.projectiles.splice(i, 1);
            }
        }

        // Process damage numbers
        this.updateDamageNumbers(dt);
    }

    /**
     * Fire a weapon from source at target
     */
    fireAt(source, target, damage, range, moduleConfig = null) {
        if (!source || !target) return;

        // Check range
        const dist = source.distanceTo(target);
        if (dist > range) {
            return;
        }

        // Calculate hit chance
        const hitChance = this.calculateHitChance(source, target, range);
        const hits = Math.random() < hitChance;

        const isMissile = moduleConfig?.category === 'missile';

        // Determine laser color based on source type
        let laserColor = 0xff4444; // Default hostile red
        if (source.isPlayer) {
            laserColor = 0x00ffff; // Player cyan
        } else if (source.type === 'npc' && source.role === 'security') {
            laserColor = 0x4488ff; // Security blue
        }

        if (isMissile) {
            // Missile: smoke trail from source to target (snapshot positions)
            const sx = source.x, sy = source.y;
            const tx = target.x, ty = target.y;
            const dx = tx - sx;
            const dy = ty - sy;
            this.game.renderer.effects.spawn('missile-trail', sx, sy);
            for (let t = 0.25; t < 1; t += 0.25) {
                const px = sx + dx * t + (Math.random() - 0.5) * 20;
                const py = sy + dy * t + (Math.random() - 0.5) * 20;
                setTimeout(() => {
                    this.game.renderer?.effects?.spawn('missile-trail', px, py);
                }, t * 200);
            }
        } else {
            // Laser: beam effect
            this.game.renderer.effects.spawn('laser', source.x, source.y, {
                target: target,
                color: laserColor,
            });
        }

        // Muzzle flash at source
        this.game.renderer.effects.spawn('hit', source.x, source.y, {
            count: isMissile ? 5 : 3,
            color: isMissile ? 0xff8800 : laserColor,
        });

        // Apply damage with slight delay (for visual sync, longer for missiles)
        const impactDelay = isMissile ? 300 : 100;
        setTimeout(() => {
            if (target.alive) {
                // Miss handling
                if (!hits) {
                    this.showMissIndicator(target.x, target.y);
                    return;
                }

                // Determine damage type for visual
                let damageType = 'hull';
                if (target.shield > 0) {
                    damageType = 'shield';
                } else if (target.armor > 0) {
                    damageType = 'armor';
                }

                // Apply damage
                target.takeDamage(damage, source);

                // Show damage number
                this.showDamageNumber(target.x, target.y, damage, damageType);

                // Spawn hit effect - missiles have bigger impact
                const effectType = damageType === 'shield' ? 'shield-hit' : 'hit';
                this.game.renderer.effects.spawn(effectType, target.x, target.y, {
                    radius: target.radius || 30,
                    count: isMissile ? 10 : undefined,
                });

                // Missile impact sound
                if (isMissile && source.isPlayer) {
                    this.game.audio?.play('missile-hit');
                }

                // Camera shake for player hit
                if (target === this.game.player) {
                    this.game.camera.shake(5, 0.2);
                }

                // Flag player as aggressive if attacking neutral NPCs
                if (source.isPlayer && target.type === 'npc' && target.hostility === 'neutral') {
                    this.game.playerAggressive = true;
                    this.game.ui?.log('Security forces alerted!', 'combat');
                    this.game.ui?.toast('You are now flagged as hostile!', 'error');
                }
            }
        }, impactDelay);
    }

    /**
     * Show floating damage number
     */
    showDamageNumber(x, y, amount, type) {
        const screen = this.game.input.worldToScreen(x, y);

        const element = document.createElement('div');
        element.className = `damage-number ${type}`;
        element.textContent = `-${Math.floor(amount)}`;
        element.style.left = `${screen.x}px`;
        element.style.top = `${screen.y}px`;

        document.getElementById('ui-overlay').appendChild(element);

        // Remove after animation
        setTimeout(() => element.remove(), 1500);
    }

    /**
     * Update damage number positions
     */
    updateDamageNumbers(dt) {
        // Damage numbers are handled by CSS animation,
        // but we could track and update positions here if needed
    }

    /**
     * Create explosion effect when entity is destroyed
     */
    createExplosion(entity) {
        const size = (entity.radius || 30) / 30;

        this.game.renderer.effects.spawn('explosion', entity.x, entity.y, {
            count: Math.floor(20 * size),
            size: size,
            color: entity.type === 'enemy' ? 0xff4400 : 0x00aaff,
        });

        // Camera shake
        if (entity.distanceTo && this.game.player) {
            const dist = entity.distanceTo(this.game.player);
            const intensity = Math.max(0, 10 - dist / 100) * size;
            if (intensity > 0) {
                this.game.camera.shake(intensity, 0.3);
            }
        }

        // Play explosion sound
        this.game.audio?.play('explosion');
    }

    /**
     * Check if source can hit target (line of sight, etc.)
     */
    canHit(source, target, range) {
        if (!source || !target) return false;
        if (!target.alive) return false;

        const dist = source.distanceTo(target);
        return dist <= range;
    }

    /**
     * Show miss indicator floating text
     */
    showMissIndicator(x, y) {
        const screen = this.game.input.worldToScreen(x, y);
        const element = document.createElement('div');
        element.className = 'damage-number miss';
        element.textContent = 'MISS';
        element.style.left = `${screen.x + (Math.random() - 0.5) * 40}px`;
        element.style.top = `${screen.y}px`;
        document.getElementById('ui-overlay').appendChild(element);
        setTimeout(() => element.remove(), 1500);
    }

    /**
     * Calculate hit chance using tracking-based formula (EVE-inspired)
     *
     * angularVelocity = targetSpeed / max(distance, 50) * targetSignature / 28
     * trackingFactor = weaponTracking / max(angularVelocity, 0.01)
     * hitChance = clamp(trackingFactor * 0.5, 0.05, 1.0) * rangeModifier
     *
     * Result: Small fast ships orbiting big ships at close range are very hard
     * to hit with large slow-tracking weapons.
     */
    calculateHitChance(source, target, range, weaponConfig = null) {
        const dist = source.distanceTo(target);
        if (dist > range) return 0;

        // Range modifier: 1.0 at close range, drops to 0.3 at max range
        const rangeFraction = dist / range;
        const rangeModifier = 1 - rangeFraction * 0.7;

        // Get weapon tracking speed (higher = better at hitting fast targets)
        let weaponTracking = 1.0;
        if (weaponConfig && weaponConfig.trackingSpeed) {
            weaponTracking = weaponConfig.trackingSpeed;
        } else {
            // Estimate from source - larger weapons track slower
            weaponTracking = source.signatureRadius ? Math.min(1.5, 40 / source.signatureRadius) : 1.0;
        }

        // Target's angular velocity relative to source
        const targetSpeed = target.currentSpeed || 0;
        const targetSig = target.signatureRadius || 30;
        const effectiveDist = Math.max(dist, 50);
        const angularVelocity = (targetSpeed / effectiveDist) * (targetSig / 28);

        // Tracking factor: how well the weapon tracks vs how fast target moves
        const trackingFactor = weaponTracking / Math.max(angularVelocity, 0.01);

        // Hit chance from tracking (capped at 1.0)
        let chance = Math.min(1.0, trackingFactor * 0.5);

        // Apply range modifier
        chance *= rangeModifier;

        // Pilot 'steady' trait bonus
        if (source.pilot?.traits?.includes('steady')) {
            chance *= 1.1;
        }

        return Math.max(0.05, Math.min(1.0, chance));
    }
}
