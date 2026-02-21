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

        // Tick-based pending damage queue (replaces setTimeout)
        this.pendingDamage = [];

        // DOM element pool for damage numbers / miss indicators
        this.damageNumberPool = [];
        this.POOL_SIZE = 30;
        this.initDamagePool();
    }

    /**
     * Pre-create pooled DOM elements for damage numbers
     */
    initDamagePool() {
        const overlay = document.getElementById('ui-overlay');
        if (!overlay) return;
        for (let i = 0; i < this.POOL_SIZE; i++) {
            const el = document.createElement('div');
            el.style.display = 'none';
            el.style.position = 'absolute';
            el.dataset.active = 'false';
            overlay.appendChild(el);
            this.damageNumberPool.push(el);
        }
    }

    /**
     * Get an inactive element from the damage number pool
     */
    getDamageElement() {
        for (let i = 0; i < this.damageNumberPool.length; i++) {
            if (this.damageNumberPool[i].dataset.active !== 'true') {
                const el = this.damageNumberPool[i];
                el.dataset.active = 'true';
                el.style.display = '';
                el.className = '';
                el.textContent = '';
                el.style.fontSize = '';
                return el;
            }
        }
        return null; // All pool elements in use
    }

    /**
     * Release a pooled damage element back to inactive state
     */
    releaseDamageElement(el) {
        el.style.display = 'none';
        el.dataset.active = 'false';
        el.className = '';
        el.textContent = '';
    }

    /**
     * Update combat system
     */
    update(dt) {
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update(dt);

            // Point Defense System: intercept incoming missiles
            if (projectile.alive && projectile._isMissile && !projectile._pdsChecked && projectile.target?.alive) {
                const pdsRange = this.game.config?.PDS_RANGE || CONFIG?.PDS_RANGE || 150;
                const dist = projectile.distanceTo(projectile.target);
                if (dist <= pdsRange) {
                    projectile._pdsChecked = true;
                    const pdsChance = projectile.target.getPdsChance?.() || 0;
                    if (pdsChance > 0 && Math.random() < pdsChance) {
                        // Intercepted!
                        this.game.renderer?.effects?.spawn('pds-intercept', projectile.x, projectile.y, {
                            targetX: projectile.target.x,
                            targetY: projectile.target.y,
                        });
                        this.game.audio?.play('pds-intercept');
                        if (projectile.target.isPlayer || projectile.source?.isPlayer) {
                            this.game.events?.emit('combat:action', {
                                type: 'pds-intercept',
                                source: projectile.target,
                                target: projectile.source,
                                weapon: 'Point Defense',
                            });
                        }
                        projectile.destroy();
                    }
                }
            }

            if (!projectile.alive) {
                // Clean up mesh from scene
                if (projectile.mesh && this.game.renderer?.scene) {
                    this.game.renderer.scene.remove(projectile.mesh);
                    // Dispose geometry/materials
                    projectile.mesh.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                    projectile.mesh = null;
                }
                this.projectiles.splice(i, 1);
            } else {
                // Sync mesh position with entity
                projectile.updateMesh();
            }
        }

        // Process pending damage queue (tick-based, replaces setTimeout)
        for (let i = this.pendingDamage.length - 1; i >= 0; i--) {
            const pd = this.pendingDamage[i];
            pd.elapsed += dt;
            if (pd.elapsed >= pd.delay) {
                // Check sector hasn't changed
                if (this.game.currentSector?.id !== pd.sectorId) {
                    this.pendingDamage.splice(i, 1);
                    continue;
                }
                // Apply the pending damage callback if target still exists and is alive
                if (pd.target && pd.target.alive && !pd.target.destroyed) {
                    pd.apply();
                }
                this.pendingDamage.splice(i, 1);
            }
        }

        // Process damage numbers
        this.updateDamageNumbers(dt);
    }

    /**
     * Remove all active projectiles and their meshes (e.g. on sector change)
     */
    clearProjectiles() {
        for (const projectile of this.projectiles) {
            if (projectile.mesh && this.game.renderer?.scene) {
                this.game.renderer.scene.remove(projectile.mesh);
                projectile.mesh.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
                projectile.mesh = null;
            }
            projectile.alive = false;
        }
        this.projectiles.length = 0;
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

        const isMissile = moduleConfig?.category === 'missile';

        // Missiles always hit (guided projectiles) — damage reduced by explosion mechanics
        // Turrets use tracking-based hit chance
        const hitChance = isMissile ? 1.0 : this.calculateHitChance(source, target, range, moduleConfig);
        const hits = isMissile ? true : Math.random() < hitChance;

        // Determine beam color based on source type
        let beamColor = 0xff4444; // Default hostile red
        if (source.isPlayer) {
            beamColor = 0x00ffff; // Player cyan
        } else if (source.type === 'npc' && source.role === 'security') {
            beamColor = 0x4488ff; // Security blue
        }

        // Capture sector for stale-timer guards
        const combatSectorId = this.game.currentSector?.id;

        if (isMissile) {
            // Missile: create actual projectile entity that flies to target
            const missileSpeed = moduleConfig?.missileSpeed || 300;
            const missile = new Projectile(this.game, {
                x: source.x,
                y: source.y,
                source: source,
                target: target,
                damage: 0, // Damage handled below on impact
                speed: missileSpeed,
                lifetime: (range * 1.5) / missileSpeed, // Enough time to reach max range
                color: 0xff6600,
                length: 12,
                radius: 4,
            });
            missile.damageType = moduleConfig?.damageType || 'explosive';
            missile._isMissile = true;
            missile._hitChance = hitChance;
            missile._hits = hits;
            missile._actualDamage = damage;
            missile._moduleConfig = moduleConfig;
            missile._combatSectorId = combatSectorId;
            missile._combatSystem = this;

            // Override hit() to use combat system damage pipeline
            missile.hit = () => {
                if (this.game.currentSector?.id !== missile._combatSectorId) {
                    missile.destroy();
                    return;
                }
                // Missile impact VFX
                this.game.renderer?.effects?.spawn('missile-impact', missile.x, missile.y, {
                    color: 0xff6600, count: 8,
                });
                this.game.renderer?.effects?.spawn('explosion', missile.x, missile.y, {
                    count: 6, color: 0xff8800,
                });
                this.game.audio?.play('missile-explosion');

                // Missile damage application — explosion radius vs target signature
                const explosionRadius = moduleConfig?.explosionRadius || 100;
                const explosionVelocity = moduleConfig?.explosionVelocity || 100;
                const targetSig = target.signatureRadius || 30;
                const targetSpeed = target.currentSpeed || 0;

                // EVE-style: damage = base * min(1, sig/expRadius, (sig/expRadius * expVel/speed))
                // If target sig >= explosion radius: full damage
                // If target is smaller: reduced by sig/radius ratio
                // If target is also fast: further reduced by velocity ratio
                const sigFactor = Math.min(1.0, targetSig / explosionRadius);
                const velFactor = targetSpeed > 0
                    ? Math.min(1.0, (targetSig / explosionRadius) * (explosionVelocity / targetSpeed))
                    : 1.0;
                const damageApplication = Math.min(sigFactor, velFactor);
                const appliedDamage = Math.max(1, Math.round(missile._actualDamage * damageApplication));

                let damageType = 'hull';
                if (target.shield > 0) damageType = 'shield';
                else if (target.armor > 0) damageType = 'armor';

                const dmgType = moduleConfig?.damageProfile || moduleConfig?.damageType || 'explosive';
                target.takeDamage(appliedDamage, source, dmgType);

                const weaponName = moduleConfig?.name || 'Missile';
                this.game.events.emit('combat:action', {
                    type: 'hit', source, target, damage: appliedDamage,
                    damageType, weaponDamageType: dmgType,
                    weapon: weaponName, hitChance: 1.0,
                    damageApplication, // 0-1 factor for UI/analytics
                });

                // Impact VFX at target
                this.game.renderer?.effects?.spawn('hit', target.x, target.y, {
                    count: 6, color: 0xff8800, damageType: dmgType,
                });
                if (source.isPlayer || target.isPlayer) {
                    this.game.audio?.play('weapon-hit');
                }

                // Damage number
                this.showDamageNumber(target.x, target.y, appliedDamage, damageType);
                missile.destroy();
            };

            // Smoke trail spawner on each update
            const origUpdate = missile.update.bind(missile);
            missile._trailTimer = 0;
            missile.update = (dt) => {
                origUpdate(dt);
                missile._trailTimer += dt;
                if (missile._trailTimer > 0.08 && missile.alive) {
                    missile._trailTimer = 0;
                    this.game.renderer?.effects?.spawn('missile-trail', missile.x, missile.y);
                }
            };

            this.projectiles.push(missile);
            // Add mesh to scene
            if (this.game.renderer?.scene) {
                const mesh = missile.createMesh();
                if (mesh) this.game.renderer.scene.add(mesh);
            }

            // Muzzle flash at source
            this.game.renderer?.effects?.spawn('hit', source.x, source.y, {
                count: 5, color: 0xff8800,
            });
            if (source.isPlayer) this.game.audio?.play('missile-launch');

            // Missile incoming warning for player
            if (target === this.game.player) {
                this.game.ui?.showDamageDirection(source, 'missile');
                this.game.ui?.toast('Incoming missile!', 'danger');
            }
            return; // Skip the rest of the damage pipeline - missile handles it on impact
        } else {
            // Maser/railgun: beam effect (uses 'laser' effect type for backward compat)
            this.game.renderer.effects.spawn('laser', source.x, source.y, {
                target: target,
                color: beamColor,
            });
        }

        // Muzzle flash at source
        this.game.renderer.effects.spawn('hit', source.x, source.y, {
            count: 3,
            color: beamColor,
        });

        // Apply damage with tick-based delay (for visual sync)
        const impactDelay = 0.1; // seconds
        this.pendingDamage.push({
            target,
            delay: impactDelay,
            elapsed: 0,
            sectorId: combatSectorId,
            apply: () => {
                // Miss handling
                if (!hits) {
                    this.showMissIndicator(target.x, target.y);
                    // Emit miss event for combat log
                    const weaponName = moduleConfig?.name || 'Maser';
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

                // Power routing removed — damage at full rate
                let finalDamage = damage;

                // Apply damage (with damage profile from weapon config)
                const dmgProfile = moduleConfig?.damageProfile || null;
                const dmgType = dmgProfile || moduleConfig?.damageType || 'em';
                target.takeDamage(finalDamage, source, dmgType);

                // Emit hit event for combat log
                const weaponName = moduleConfig?.name || 'Maser';
                this.game.events.emit('combat:action', {
                    type: 'hit',
                    source, target, damage: finalDamage, damageType, weaponDamageType: dmgType,
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
                    sourceAngle,
                });

                // Shield bubble flash on shield hits
                if (damageType === 'shield') {
                    this.game.renderer.statusEffects?.spawnShieldFlash(target, source);
                }

                // Damage-type-specific impact sounds
                if (source.isPlayer || target === this.game.player) {
                    if (damageType === 'shield') {
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
        });
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
     * Show floating damage number (uses pooled DOM elements)
     */
    showDamageNumber(x, y, amount, type) {
        const element = this.getDamageElement();
        if (!element) return; // Pool exhausted

        const screen = this.game.input.worldToScreen(x, y);

        // Random spread so numbers don't stack
        const spreadX = (Math.random() - 0.5) * 60;
        const spreadY = (Math.random() - 0.5) * 30;

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

        setTimeout(() => this.releaseDamageElement(element), 1500);
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
     * Show miss indicator floating text (uses pooled DOM elements)
     */
    showMissIndicator(x, y) {
        const element = this.getDamageElement();
        if (!element) return; // Pool exhausted

        const screen = this.game.input.worldToScreen(x, y);
        element.className = 'damage-number miss';
        element.textContent = 'MISS';
        element.style.left = `${screen.x + (Math.random() - 0.5) * 40}px`;
        element.style.top = `${screen.y}px`;

        setTimeout(() => this.releaseDamageElement(element), 1500);
    }

    /**
     * Calculate hit chance using tracking-based formula (EVE-inspired).
     * Used for turrets only — missiles always hit but use explosion radius
     * vs target signature for damage application instead.
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

        // Optimal + falloff range modifier (EVE-style)
        // Within optimal: no range penalty. Beyond optimal: exponential drop per falloff distance
        const optimal = weaponConfig?.optimalRange || (range * 0.6);
        const falloff = weaponConfig?.falloff || (range * 0.25);
        let rangeModifier = 1.0;
        if (dist > optimal && falloff > 0) {
            const overshoot = (dist - optimal) / falloff;
            rangeModifier = Math.pow(0.5, overshoot * overshoot);
        }

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
