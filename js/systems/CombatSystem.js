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
    fireAt(source, target, damage, range) {
        if (!source || !target) return;

        // Check range
        const dist = source.distanceTo(target);
        if (dist > range) {
            return;
        }

        // Create laser effect
        this.game.renderer.effects.spawn('laser', source.x, source.y, {
            target: target,
            color: source.isPlayer ? 0x00ffff : 0xff4444,
        });

        // Apply damage with slight delay (for visual sync)
        setTimeout(() => {
            if (target.alive) {
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

                // Spawn hit effect
                const effectType = damageType === 'shield' ? 'shield-hit' : 'hit';
                this.game.renderer.effects.spawn(effectType, target.x, target.y, {
                    radius: target.radius || 30,
                });

                // Camera shake for player hit
                if (target === this.game.player) {
                    this.game.camera.shake(5, 0.2);
                }
            }
        }, 100);
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
     * Calculate hit chance based on signature, range, etc.
     */
    calculateHitChance(source, target, range) {
        const dist = source.distanceTo(target);
        if (dist > range) return 0;

        // Base hit chance
        let chance = 1.0;

        // Reduce for distance
        chance *= 1 - (dist / range) * 0.3;

        // Reduce for small targets
        if (target.signatureRadius) {
            chance *= Math.min(1, target.signatureRadius / 50);
        }

        // Reduce for fast targets
        if (target.currentSpeed) {
            chance *= 1 - Math.min(0.3, target.currentSpeed / 500);
        }

        return Math.max(0.1, Math.min(1, chance));
    }
}
