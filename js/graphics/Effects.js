// =============================================
// Effects Manager
// Particle effects, explosions, trails, etc.
// =============================================

import { CONFIG } from '../config.js';

export class Effects {
    constructor(game, group) {
        this.game = game;
        this.group = group;

        // Active effects
        this.effects = [];

        // Particle pool for reuse
        this.particlePool = [];
        this.poolSize = CONFIG.PARTICLE_POOL_SIZE;

        this.initPool();
    }

    /**
     * Initialize particle pool
     */
    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const geometry = new THREE.CircleGeometry(3, 6);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 1,
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.visible = false;
            particle.userData = {
                active: false,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 1,
                fadeOut: true,
                shrink: true,
                startScale: 1,
            };

            this.group.add(particle);
            this.particlePool.push(particle);
        }
    }

    /**
     * Get a particle from the pool
     */
    getParticle() {
        for (const particle of this.particlePool) {
            if (!particle.userData.active) {
                return particle;
            }
        }
        return null; // Pool exhausted
    }

    /**
     * Spawn an effect
     */
    spawn(type, x, y, options = {}) {
        switch (type) {
            case 'explosion':
                this.spawnExplosion(x, y, options);
                break;
            case 'hit':
                this.spawnHit(x, y, options);
                break;
            case 'shield-hit':
                this.spawnShieldHit(x, y, options);
                break;
            case 'trail':
                this.spawnTrail(x, y, options);
                break;
            case 'warp':
                this.spawnWarpEffect(x, y, options);
                break;
            case 'mining':
                this.spawnMiningEffect(x, y, options);
                break;
            case 'laser':
                this.spawnLaserEffect(x, y, options);
                break;
        }
    }

    /**
     * Spawn explosion particles
     */
    spawnExplosion(x, y, options = {}) {
        const count = options.count || 20;
        const color = options.color || 0xff6600;
        const size = options.size || 1;

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) break;

            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 200;

            particle.position.set(x, y, 10);
            particle.scale.setScalar(size * (1 + Math.random()));
            particle.material.color.setHex(color);
            particle.material.opacity = 1;
            particle.visible = true;

            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle) * speed;
            particle.userData.vy = Math.sin(angle) * speed;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.5 + Math.random() * 0.5;
            particle.userData.fadeOut = true;
            particle.userData.shrink = true;
            particle.userData.startScale = particle.scale.x;
        }

        // Add central flash
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 11);
            flash.scale.setScalar(size * 5);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 1;
            flash.visible = true;

            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.2;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = size * 5;
        }

        // Add expanding shockwave ring
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.5,
            size: size,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(size * 5, size * 5 + 4, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 10);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);
    }

    /**
     * Spawn hit effect
     */
    spawnHit(x, y, options = {}) {
        const count = options.count || 5;
        const color = options.color || 0xffaa00;

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) break;

            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 100;

            particle.position.set(x, y, 10);
            particle.scale.setScalar(0.5 + Math.random() * 0.5);
            particle.material.color.setHex(color);
            particle.material.opacity = 1;
            particle.visible = true;

            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle) * speed;
            particle.userData.vy = Math.sin(angle) * speed;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.3;
            particle.userData.fadeOut = true;
            particle.userData.shrink = false;
            particle.userData.startScale = particle.scale.x;
        }
    }

    /**
     * Spawn shield hit effect (ring ripple)
     */
    spawnShieldHit(x, y, options = {}) {
        const effect = {
            type: 'shield-ripple',
            x, y,
            radius: options.radius || 30,
            maxRadius: options.maxRadius || 60,
            life: 0,
            maxLife: 0.3,
            mesh: null,
        };

        // Create ring mesh
        const geometry = new THREE.RingGeometry(effect.radius, effect.radius + 3, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.8,
        });
        effect.mesh = new THREE.Mesh(geometry, material);
        effect.mesh.position.set(x, y, 10);
        this.group.add(effect.mesh);

        this.effects.push(effect);
    }

    /**
     * Spawn engine trail particle
     */
    spawnTrail(x, y, options = {}) {
        const particle = this.getParticle();
        if (!particle) return;

        particle.position.set(x, y, 5);
        particle.scale.setScalar(options.size || 2);
        particle.material.color.setHex(options.color || 0x00ffff);
        particle.material.opacity = 0.5;
        particle.visible = true;

        particle.userData.active = true;
        particle.userData.vx = (options.vx || 0) * 0.3;
        particle.userData.vy = (options.vy || 0) * 0.3;
        particle.userData.life = 0;
        particle.userData.maxLife = options.lifetime || 0.5;
        particle.userData.fadeOut = true;
        particle.userData.shrink = true;
        particle.userData.startScale = particle.scale.x;
    }

    /**
     * Spawn warp effect
     */
    spawnWarpEffect(x, y, options = {}) {
        const angle = options.angle || 0;
        const count = 30;

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) break;

            const spread = (Math.random() - 0.5) * 0.5;
            const speed = 500 + Math.random() * 500;

            particle.position.set(x, y, 8);
            particle.scale.setScalar(1 + Math.random() * 2);
            particle.material.color.setHex(0x4488ff);
            particle.material.opacity = 0.8;
            particle.visible = true;

            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle + spread) * speed;
            particle.userData.vy = Math.sin(angle + spread) * speed;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.8;
            particle.userData.fadeOut = true;
            particle.userData.shrink = false;
            particle.userData.startScale = particle.scale.x;
        }
    }

    /**
     * Spawn mining effect
     */
    spawnMiningEffect(x, y, options = {}) {
        const count = 3;

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) break;

            particle.position.set(
                x + (Math.random() - 0.5) * 30,
                y + (Math.random() - 0.5) * 30,
                8
            );
            particle.scale.setScalar(2 + Math.random() * 2);
            particle.material.color.setHex(options.color || 0xffaa00);
            particle.material.opacity = 0.6;
            particle.visible = true;

            particle.userData.active = true;
            particle.userData.vx = (Math.random() - 0.5) * 20;
            particle.userData.vy = (Math.random() - 0.5) * 20;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.5;
            particle.userData.fadeOut = true;
            particle.userData.shrink = true;
            particle.userData.startScale = particle.scale.x;
        }
    }

    /**
     * Spawn laser beam effect
     */
    spawnLaserEffect(x, y, options = {}) {
        const target = options.target;
        if (!target) return;

        const effect = {
            type: 'laser',
            x, y,
            targetX: target.x,
            targetY: target.y,
            life: 0,
            maxLife: 0.15,
            mesh: null,
        };

        // Calculate beam geometry
        const dx = target.x - x;
        const dy = target.y - y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const geometry = new THREE.PlaneGeometry(length, 3);
        const material = new THREE.MeshBasicMaterial({
            color: options.color || 0x00ffff,
            transparent: true,
            opacity: 0.9,
        });

        effect.mesh = new THREE.Mesh(geometry, material);
        effect.mesh.position.set(
            x + dx / 2,
            y + dy / 2,
            9
        );
        effect.mesh.rotation.z = angle;

        this.group.add(effect.mesh);
        this.effects.push(effect);
    }

    /**
     * Update all effects
     */
    update(dt) {
        // Update pooled particles
        for (const particle of this.particlePool) {
            if (!particle.userData.active) continue;

            const data = particle.userData;
            data.life += dt;

            // Move
            particle.position.x += data.vx * dt;
            particle.position.y += data.vy * dt;

            // Progress
            const progress = data.life / data.maxLife;

            // Fade out
            if (data.fadeOut) {
                particle.material.opacity = 1 - progress;
            }

            // Shrink
            if (data.shrink) {
                particle.scale.setScalar(data.startScale * (1 - progress));
            }

            // Expire
            if (data.life >= data.maxLife) {
                particle.visible = false;
                data.active = false;
            }
        }

        // Update complex effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life += dt;

            const progress = effect.life / effect.maxLife;

            switch (effect.type) {
                case 'shield-ripple':
                    if (effect.mesh) {
                        // Expand and fade
                        const radius = effect.radius + (effect.maxRadius - effect.radius) * progress;
                        effect.mesh.scale.setScalar(1 + progress);
                        effect.mesh.material.opacity = 0.8 * (1 - progress);
                    }
                    break;

                case 'laser':
                    if (effect.mesh) {
                        effect.mesh.material.opacity = 0.9 * (1 - progress);
                    }
                    break;

                case 'shockwave':
                    if (effect.mesh) {
                        // Expand rapidly and fade
                        const expandScale = 1 + progress * 8;
                        effect.mesh.scale.setScalar(expandScale);
                        effect.mesh.material.opacity = 0.6 * (1 - progress);
                    }
                    break;
            }

            // Remove expired effects
            if (effect.life >= effect.maxLife) {
                if (effect.mesh) {
                    this.group.remove(effect.mesh);
                    effect.mesh.geometry.dispose();
                    effect.mesh.material.dispose();
                }
                this.effects.splice(i, 1);
            }
        }
    }

    /**
     * Clear all effects
     */
    clear() {
        // Reset all pooled particles
        for (const particle of this.particlePool) {
            particle.visible = false;
            particle.userData.active = false;
        }

        // Remove complex effects
        for (const effect of this.effects) {
            if (effect.mesh) {
                this.group.remove(effect.mesh);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
            }
        }
        this.effects = [];
    }
}
