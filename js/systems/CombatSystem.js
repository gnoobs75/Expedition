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

        // Missile incoming warning for player
        if (isMissile && target === this.game.player) {
            this.game.ui?.showDamageDirection(source, 'missile');
            this.game.ui?.toast('Incoming missile!', 'danger');
        }

        // Apply damage with slight delay (for visual sync, longer for missiles)
        const impactDelay = isMissile ? 300 : 100;
        setTimeout(() => {
            if (target.alive) {
                // Miss handling
                if (!hits) {
                    this.showMissIndicator(target.x, target.y);
                    // Emit miss event for combat log
                    const weaponName = moduleConfig?.name || (isMissile ? 'Missile' : 'Laser');
                    this.game.events.emit('combat:action', {
                        type: 'miss',
                        source, target, damage: 0,
                        weapon: weaponName, hitChance,
                    });
                    // Emit miss event for floating damage popups
                    this.game.events.emit('combat:miss', { source, target });
                    return;
                }

                // Determine damage type for visual
                let damageType = 'hull';
                if (target.shield > 0) {
                    damageType = 'shield';
                } else if (target.armor > 0) {
                    damageType = 'armor';
                }

                // Apply power routing damage modifier for player
                let finalDamage = damage;
                if (source.isPlayer && this.game.powerRouting) {
                    finalDamage *= 0.5 + (this.game.powerRouting.weapons / 100) * 1.5;
                }

                // Apply damage
                target.takeDamage(finalDamage, source);

                // Emit hit event for combat log
                const weaponName = moduleConfig?.name || (isMissile ? 'Missile' : 'Laser');
                this.game.events.emit('combat:action', {
                    type: 'hit',
                    source, target, damage: finalDamage, damageType,
                    weapon: weaponName, hitChance,
                });

                // Show damage number
                this.showDamageNumber(target.x, target.y, finalDamage, damageType);

                // Spawn hit effect - type-specific visuals
                const effectType = damageType === 'shield' ? 'shield-hit' :
                    damageType === 'armor' ? 'armor-hit' : 'hull-hit';
                const sourceAngle = Math.atan2(source.y - target.y, source.x - target.x);
                this.game.renderer.effects.spawn(effectType, target.x, target.y, {
                    radius: target.radius || 30,
                    count: isMissile ? 16 : undefined,
                    sourceAngle,
                });

                // Missile gets an additional fiery impact explosion
                if (isMissile) {
                    this.game.renderer.effects.spawn('missile-impact', target.x, target.y);
                }

                // Shield bubble flash on shield hits
                if (damageType === 'shield') {
                    this.game.renderer.statusEffects?.spawnShieldFlash(target, source);
                }

                // Damage-type-specific impact sounds
                if (source.isPlayer || target === this.game.player) {
                    if (isMissile) {
                        this.game.audio?.play('missile-explosion');
                    } else if (damageType === 'shield') {
                        this.game.audio?.play('shield-hit');
                    } else if (damageType === 'armor') {
                        this.game.audio?.play('armor-hit');
                    } else {
                        this.game.audio?.play('hull-hit');
                    }
                }

                // Camera shake for player hit + auto-target attacker
                if (target === this.game.player) {
                    this.game.camera.shake(5, 0.2);
                    // Auto-target attacker if no target selected
                    if (!this.game.selectedTarget && source.alive) {
                        this.game.selectTarget(source);
                    }
                    // Damage direction indicator
                    this.showDamageDirection(source, target);
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
     * Show directional damage indicator on screen edge
     */
    showDamageDirection(source, target) {
        const angle = Math.atan2(source.y - target.y, source.x - target.x);
        const el = document.createElement('div');
        el.className = 'damage-direction';
        // Position on screen edge using angle
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const edgeDist = Math.min(cx, cy) - 30;
        const px = cx + Math.cos(angle) * edgeDist;
        const py = cy - Math.sin(angle) * edgeDist; // screen Y inverted
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
        el.style.transform = `translate(-50%, -50%) rotate(${-angle + Math.PI}rad)`;
        document.getElementById('ui-overlay')?.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }

    /**
     * Show floating damage number
     */
    showDamageNumber(x, y, amount, type) {
        const screen = this.game.input.worldToScreen(x, y);

        // Random spread so numbers don't stack
        const spreadX = (Math.random() - 0.5) * 60;
        const spreadY = (Math.random() - 0.5) * 30;

        const element = document.createElement('div');

        // Scale font size by damage magnitude
        const baseDmg = 30;
        const ratio = Math.min(amount / baseDmg, 3);
        const fontSize = 14 + ratio * 10;
        const isCrit = ratio >= 2;

        element.className = `damage-number ${type}${isCrit ? ' crit' : ''}`;
        element.textContent = isCrit ? `${Math.floor(amount)}!` : `-${Math.floor(amount)}`;
        element.style.left = `${screen.x + spreadX}px`;
        element.style.top = `${screen.y + spreadY}px`;
        element.style.fontSize = `${fontSize}px`;

        document.getElementById('ui-overlay').appendChild(element);

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

        // Spawn spinning debris chunks for ships
        if (entity.type === 'enemy' || entity.type === 'guild' || entity.type === 'npc' || entity.type === 'fleet') {
            this.spawnDebrisField(entity.x, entity.y, size, entity.type === 'enemy' ? 0xff4400 : 0x00aaff);
        }

        // Camera shake - scales with ship size and distance
        if (entity.distanceTo && this.game.player) {
            const dist = entity.distanceTo(this.game.player);
            const intensity = Math.max(0, 10 - dist / 100) * size;
            const duration = size > 3 ? 0.6 : (size > 1.5 ? 0.4 : 0.3);
            if (intensity > 0) {
                this.game.camera.shake(intensity, duration);
            }
        }

        // Play explosion sound
        this.game.audio?.play('explosion');
    }

    /**
     * Spawn spinning triangular debris pieces that tumble outward
     */
    spawnDebrisField(x, y, size, tintColor) {
        const renderer = this.game.renderer;
        if (!renderer?.effectsGroup) return;

        const count = Math.floor(4 + size * 3);
        const hullColors = [0x556677, 0x445566, 0x667788, 0x778899, 0x334455];

        for (let i = 0; i < count; i++) {
            // Random triangle shape
            const s = (3 + Math.random() * 8) * Math.min(size, 3);
            const shape = new THREE.Shape();
            shape.moveTo(0, s);
            shape.lineTo(-s * (0.5 + Math.random() * 0.5), -s * (0.3 + Math.random() * 0.4));
            shape.lineTo(s * (0.5 + Math.random() * 0.5), -s * (0.3 + Math.random() * 0.4));
            shape.lineTo(0, s);

            const geo = new THREE.ShapeGeometry(shape);
            const color = Math.random() > 0.3 ? hullColors[i % hullColors.length] : tintColor;
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 15 * size,
                y + (Math.random() - 0.5) * 15 * size,
                8
            );

            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 80;
            mesh.userData = {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                spin: (Math.random() - 0.5) * 6,
                life: 0,
                maxLife: 2 + Math.random() * 3,
            };

            renderer.effectsGroup.add(mesh);

            // Self-cleaning update via effect list
            if (!renderer._debrisList) renderer._debrisList = [];
            renderer._debrisList.push(mesh);
        }
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
