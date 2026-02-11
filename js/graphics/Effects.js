// =============================================
// Effects Manager
// Particle effects, explosions, trails, etc.
// =============================================

import { CONFIG } from '../config.js';

export class Effects {
    constructor(game, group, lightPool = null) {
        this.game = game;
        this.group = group;
        this.lightPool = lightPool;

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
            case 'quest-complete':
                this.spawnQuestComplete(x, y, options);
                break;
            case 'loot':
                this.spawnLootPickup(x, y, options);
                break;
            case 'missile-trail':
                this.spawnMissileTrail(x, y, options);
                break;
            case 'warp-flash':
                this.spawnWarpFlash(x, y, options);
                break;
            case 'level-up':
                this.spawnLevelUp(x, y, options);
                break;
            case 'survey-pulse':
                this.spawnSurveyPulse(x, y, options);
                break;
            case 'repair':
                this.spawnRepairEffect(x, y, options);
                break;
            case 'tackle-warning':
                this.spawnTackleWarning(x, y, options);
                break;
            case 'sector-warp':
                this.spawnSectorWarp(x, y, options);
                break;
            case 'armor-hit':
                this.spawnArmorHit(x, y, options);
                break;
            case 'hull-hit':
                this.spawnHullHit(x, y, options);
                break;
            case 'missile-impact':
                this.spawnMissileImpact(x, y, options);
                break;
            case 'drone-launch':
                this.spawnDroneLaunch(x, y, options);
                break;
            case 'drone-recall':
                this.spawnDroneRecall(x, y, options);
                break;
            case 'warp-departure':
                this.spawnWarpDeparture(x, y, options);
                break;
        }
    }

    /**
     * Spawn missile impact - localized fiery explosion with shockwave
     */
    spawnMissileImpact(x, y, options = {}) {
        // Bright initial flash
        this.lightPool?.spawn(x, y, 0xff6600, 2.5, 0.4, 500);

        // White-hot core flash
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 12);
            flash.scale.setScalar(5);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 1;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.12;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 5;
        }

        // Expanding fireball particles
        const fireColors = [0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa00];
        for (let i = 0; i < 15; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 120;
            p.position.set(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 11);
            p.scale.setScalar(1.5 + Math.random() * 2.5);
            p.material.color.setHex(fireColors[Math.floor(Math.random() * fireColors.length)]);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed;
            p.userData.vy = Math.sin(angle) * speed;
            p.userData.life = 0;
            p.userData.maxLife = 0.3 + Math.random() * 0.3;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }

        // Smoke billows
        for (let i = 0; i < 6; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 15 + Math.random() * 30;
            p.position.set(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, 9);
            p.scale.setScalar(2 + Math.random() * 3);
            p.material.color.setHex(Math.random() < 0.5 ? 0x332211 : 0x443322);
            p.material.opacity = 0.4;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed;
            p.userData.vy = Math.sin(angle) * speed;
            p.userData.life = 0;
            p.userData.maxLife = 0.8 + Math.random() * 0.6;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }

        // Small shockwave
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.4,
            size: 1,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(4, 7, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff8844,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 10);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);
    }

    /**
     * Spawn dramatic fiery explosion with multi-stage effects
     */
    spawnExplosion(x, y, options = {}) {
        const count = options.count || 20;
        const color = options.color || 0xff6600;
        const size = options.size || 1;

        // === Stage 1: Initial white-hot flash ===
        this.lightPool?.spawn(x, y, 0xffffff, 3.5 * size, 0.15, 300);
        // Delayed orange fireball light
        setTimeout(() => {
            this.lightPool?.spawn(x, y, 0xff4400, 2.5 * size, 0.6, 600 * size);
        }, 80);

        // Central flash (white-hot)
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 12);
            flash.scale.setScalar(size * 8);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 1;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.15;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = size * 8;
        }

        // === Stage 2: Fireball (expanding bright orange/red) ===
        const fireballCount = Math.floor(12 * size);
        const fireColors = [0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffcc44];
        for (let i = 0; i < fireballCount; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 120;
            p.position.set(
                x + (Math.random() - 0.5) * 10 * size,
                y + (Math.random() - 0.5) * 10 * size,
                11
            );
            p.scale.setScalar(size * (2 + Math.random() * 3));
            p.material.color.setHex(fireColors[Math.floor(Math.random() * fireColors.length)]);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed;
            p.userData.vy = Math.sin(angle) * speed;
            p.userData.life = 0;
            p.userData.maxLife = 0.4 + Math.random() * 0.4;
            p.userData.fadeOut = true;
            p.userData.shrink = false; // fire expands
            p.userData.startScale = p.scale.x;
        }

        // === Stage 3: Fast-moving spark/ember jets ===
        const sparkCount = Math.floor(count * 0.8);
        for (let i = 0; i < sparkCount; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 300;
            p.position.set(x, y, 10);
            p.scale.setScalar(size * (0.5 + Math.random() * 0.8));
            p.material.color.setHex(Math.random() < 0.3 ? 0xffcc44 : (Math.random() < 0.5 ? 0xff6600 : color));
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed;
            p.userData.vy = Math.sin(angle) * speed;
            p.userData.life = 0;
            p.userData.maxLife = 0.3 + Math.random() * 0.5;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // === Stage 4: Rolling smoke clouds (slow, expanding, dark) ===
        const smokeCount = Math.floor(8 * size);
        for (let i = 0; i < smokeCount; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 10 + Math.random() * 40;
            p.position.set(
                x + (Math.random() - 0.5) * 15 * size,
                y + (Math.random() - 0.5) * 15 * size,
                9
            );
            p.scale.setScalar(size * (2 + Math.random() * 3));
            p.material.color.setHex(Math.random() < 0.4 ? 0x332211 : 0x554433);
            p.material.opacity = 0.5;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed;
            p.userData.vy = Math.sin(angle) * speed;
            p.userData.life = Math.random() * 0.2; // stagger slightly
            p.userData.maxLife = 1.5 + Math.random() * 2.0;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }

        // === Shockwave ring ===
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.6,
            size: size,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(size * 5, size * 5 + 4, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff8844,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 10);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);

        // === Second shockwave (delayed, slower) ===
        const ring2 = {
            type: 'shockwave',
            x, y,
            life: -0.15, // delayed start
            maxLife: 0.8,
            size: size * 0.7,
            mesh: null,
        };
        const ring2Geo = new THREE.RingGeometry(size * 3, size * 3 + 3, 32);
        const ring2Mat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ring2.mesh = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2.mesh.position.set(x, y, 9.5);
        this.group.add(ring2.mesh);
        this.effects.push(ring2);

        // === Secondary detonations (delayed small explosions nearby) ===
        const secondaryCount = Math.floor(2 + size);
        for (let i = 0; i < Math.min(secondaryCount, 4); i++) {
            const delay = 100 + Math.random() * 400;
            const ox = (Math.random() - 0.5) * 40 * size;
            const oy = (Math.random() - 0.5) * 40 * size;
            setTimeout(() => {
                this.lightPool?.spawn(x + ox, y + oy, 0xff6600, 1.0 * size, 0.2, 200);
                for (let j = 0; j < 5; j++) {
                    const p = this.getParticle();
                    if (!p) break;
                    const a = Math.random() * Math.PI * 2;
                    const s = 30 + Math.random() * 80;
                    p.position.set(x + ox, y + oy, 10);
                    p.scale.setScalar(size * (1 + Math.random()));
                    p.material.color.setHex(fireColors[Math.floor(Math.random() * fireColors.length)]);
                    p.material.opacity = 0.9;
                    p.visible = true;
                    p.userData.active = true;
                    p.userData.vx = Math.cos(a) * s;
                    p.userData.vy = Math.sin(a) * s;
                    p.userData.life = 0;
                    p.userData.maxLife = 0.3 + Math.random() * 0.3;
                    p.userData.fadeOut = true;
                    p.userData.shrink = true;
                    p.userData.startScale = p.scale.x;
                }
            }, delay);
        }

        // === Hull debris chunks ===
        const debrisCount = Math.floor(8 * size);
        const debrisColors = [0x665544, 0x887766, 0x554433, 0x998877, 0x443322];
        for (let i = 0; i < debrisCount; i++) {
            const debris = this.getParticle();
            if (!debris) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 15 + Math.random() * 80;
            debris.position.set(
                x + (Math.random() - 0.5) * 20 * size,
                y + (Math.random() - 0.5) * 20 * size,
                9
            );
            debris.scale.setScalar(size * (0.5 + Math.random() * 0.8));
            debris.material.color.setHex(debrisColors[i % debrisColors.length]);
            debris.material.opacity = 0.8;
            debris.visible = true;
            debris.userData.active = true;
            debris.userData.vx = Math.cos(angle) * speed;
            debris.userData.vy = Math.sin(angle) * speed;
            debris.userData.life = 0;
            debris.userData.maxLife = 2.0 + Math.random() * 2.0;
            debris.userData.fadeOut = true;
            debris.userData.shrink = false;
            debris.userData.startScale = debris.scale.x;
        }
    }

    /**
     * Spawn hit effect
     */
    spawnHit(x, y, options = {}) {
        const count = options.count || 5;
        const color = options.color || 0xffaa00;

        // Dynamic light for impact flash
        this.lightPool?.spawn(x, y, color, 1.2, 0.2, 250);

        // Brief white-hot flash at impact point
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 11);
            flash.scale.setScalar(2.5);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 0.9;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.08;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 2.5;
        }

        // Spark spray
        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 120;
            particle.position.set(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 4, 10);
            particle.scale.setScalar(0.4 + Math.random() * 0.6);
            particle.material.color.setHex(Math.random() < 0.25 ? 0xffffff : color);
            particle.material.opacity = 1;
            particle.visible = true;
            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle) * speed;
            particle.userData.vy = Math.sin(angle) * speed;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.2 + Math.random() * 0.15;
            particle.userData.fadeOut = true;
            particle.userData.shrink = true;
            particle.userData.startScale = particle.scale.x;
        }
    }

    /**
     * Spawn shield hit effect with electrical arcs and ripple
     */
    spawnShieldHit(x, y, options = {}) {
        const radius = options.radius || 30;
        const sourceAngle = options.sourceAngle || Math.random() * Math.PI * 2;

        // Dynamic light for shield flash - brighter
        this.lightPool?.spawn(x, y, 0x44aaff, 1.8, 0.35, 350);

        // Expanding ripple ring
        const effect = {
            type: 'shield-ripple',
            x, y,
            radius: radius,
            maxRadius: radius * 2,
            life: 0,
            maxLife: 0.35,
            mesh: null,
        };
        const geometry = new THREE.RingGeometry(radius, radius + 4, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
        });
        effect.mesh = new THREE.Mesh(geometry, material);
        effect.mesh.position.set(x, y, 10);
        this.group.add(effect.mesh);
        this.effects.push(effect);

        // Electrical arc particles (crawl across shield surface)
        const arcCount = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < arcCount; i++) {
            const p = this.getParticle();
            if (!p) break;
            // Start near impact point, move along shield circumference
            const startAngle = sourceAngle + (Math.random() - 0.5) * 1.5;
            const orbR = radius * (0.7 + Math.random() * 0.5);
            p.position.set(
                x + Math.cos(startAngle) * orbR * 0.3,
                y + Math.sin(startAngle) * orbR * 0.3,
                11
            );
            p.scale.setScalar(0.4 + Math.random() * 0.6);
            p.material.color.setHex(Math.random() < 0.4 ? 0xffffff : 0x88ddff);
            p.material.opacity = 1;
            p.visible = true;
            // Move tangentially along shield surface
            const tangent = startAngle + Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1);
            const spd = 80 + Math.random() * 150;
            p.userData.active = true;
            p.userData.vx = Math.cos(tangent) * spd + (Math.random() - 0.5) * 40;
            p.userData.vy = Math.sin(tangent) * spd + (Math.random() - 0.5) * 40;
            p.userData.life = 0;
            p.userData.maxLife = 0.12 + Math.random() * 0.15;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Shield flicker flash (fills shield area briefly)
        const flickerGeo = new THREE.CircleGeometry(radius * 0.8, 16);
        const flickerMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
        });
        const flicker = new THREE.Mesh(flickerGeo, flickerMat);
        flicker.position.set(x, y, 9.5);
        this.group.add(flicker);
        this.effects.push({
            type: 'shield-flicker',
            x, y,
            life: 0,
            maxLife: 0.12,
            mesh: flicker,
        });
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
     * Spawn warp effect - elongated streaks in warp direction
     */
    spawnWarpEffect(x, y, options = {}) {
        const angle = options.angle || 0;

        this.lightPool?.spawn(x, y, 0x4488ff, 2.0, 0.3, 300);

        // Primary directional streaks
        for (let i = 0; i < 20; i++) {
            const particle = this.getParticle();
            if (!particle) break;
            const spread = (Math.random() - 0.5) * 0.5;
            const speed = 500 + Math.random() * 600;
            particle.position.set(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 8);
            particle.scale.setScalar(1.5 + Math.random() * 2);
            particle.material.color.setHex(Math.random() < 0.3 ? 0xffffff : 0x4488ff);
            particle.material.opacity = 0.8;
            particle.visible = true;
            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle + spread) * speed;
            particle.userData.vy = Math.sin(angle + spread) * speed;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.5 + Math.random() * 0.3;
            particle.userData.fadeOut = true;
            particle.userData.shrink = false;
            particle.userData.startScale = particle.scale.x;
        }

        // Reverse-direction shockwave particles
        for (let i = 0; i < 10; i++) {
            const particle = this.getParticle();
            if (!particle) break;
            const a = angle + Math.PI + (Math.random() - 0.5) * 2.0;
            const speed = 100 + Math.random() * 150;
            particle.position.set(x, y, 8);
            particle.scale.setScalar(1 + Math.random());
            particle.material.color.setHex(0x6699ff);
            particle.material.opacity = 0.5;
            particle.visible = true;
            particle.userData.active = true;
            particle.userData.vx = Math.cos(a) * speed;
            particle.userData.vy = Math.sin(a) * speed;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.4 + Math.random() * 0.2;
            particle.userData.fadeOut = true;
            particle.userData.shrink = true;
            particle.userData.startScale = particle.scale.x;
        }
    }

    /**
     * Spawn mining effect - dust cloud with rock fragments and sparks at impact
     */
    spawnMiningEffect(x, y, options = {}) {
        const color = options.color || 0xffaa00;

        // Rock fragment ejection
        for (let i = 0; i < 4; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = Math.random() * Math.PI * 2;
            const spd = 20 + Math.random() * 50;
            p.position.set(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, 9);
            p.scale.setScalar(1 + Math.random() * 1.5);
            p.material.color.setHex(color);
            p.material.opacity = 0.7;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(a) * spd;
            p.userData.vy = Math.sin(a) * spd;
            p.userData.life = 0;
            p.userData.maxLife = 0.4 + Math.random() * 0.3;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Dust cloud (lingers)
        for (let i = 0; i < 2; i++) {
            const p = this.getParticle();
            if (!p) break;
            p.position.set(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, 8);
            p.scale.setScalar(3 + Math.random() * 3);
            p.material.color.setHex(0x554433);
            p.material.opacity = 0.25;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = (Math.random() - 0.5) * 8;
            p.userData.vy = (Math.random() - 0.5) * 8;
            p.userData.life = 0;
            p.userData.maxLife = 0.7 + Math.random() * 0.4;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }

        // Bright spark at impact
        const spark = this.getParticle();
        if (spark) {
            spark.position.set(x + (Math.random() - 0.5) * 5, y + (Math.random() - 0.5) * 5, 10);
            spark.scale.setScalar(0.5 + Math.random() * 0.5);
            spark.material.color.setHex(0xffffff);
            spark.material.opacity = 1;
            spark.visible = true;
            spark.userData.active = true;
            spark.userData.vx = (Math.random() - 0.5) * 40;
            spark.userData.vy = (Math.random() - 0.5) * 40;
            spark.userData.life = 0;
            spark.userData.maxLife = 0.1;
            spark.userData.fadeOut = true;
            spark.userData.shrink = true;
            spark.userData.startScale = spark.scale.x;
        }
    }

    /**
     * Spawn laser beam effect - multi-layer glowing beam with core + halo
     */
    spawnLaserEffect(x, y, options = {}) {
        const target = options.target;
        if (!target) return;

        const color = options.color || 0x00ffff;

        // Dynamic light at muzzle point - brighter
        this.lightPool?.spawn(x, y, color, 1.2, 0.2, 250);
        // Impact light at target
        this.lightPool?.spawn(target.x, target.y, color, 0.8, 0.15, 150);

        const dx = target.x - x;
        const dy = target.y - y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const cx = x + dx / 2;
        const cy = y + dy / 2;

        // Layer 1: Wide outer glow (soft, translucent)
        const glowGeo = new THREE.PlaneGeometry(length, 14);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        glowMesh.position.set(cx, cy, 8.5);
        glowMesh.rotation.z = angle;
        this.group.add(glowMesh);

        // Layer 2: Medium beam body
        const bodyGeo = new THREE.PlaneGeometry(length, 5);
        const bodyMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(cx, cy, 9);
        bodyMesh.rotation.z = angle;
        this.group.add(bodyMesh);

        // Layer 3: Bright core (white-hot center)
        const coreGeo = new THREE.PlaneGeometry(length, 2);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        coreMesh.position.set(cx, cy, 9.5);
        coreMesh.rotation.z = angle;
        this.group.add(coreMesh);

        // Store as multi-mesh effect
        const effect = {
            type: 'laser-beam',
            x, y,
            life: 0,
            maxLife: 0.2,
            meshes: [glowMesh, bodyMesh, coreMesh],
        };
        this.effects.push(effect);

        // Muzzle flare at source
        for (let i = 0; i < 4; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = angle + (Math.random() - 0.5) * 1.2;
            const spd = 40 + Math.random() * 80;
            p.position.set(x, y, 10);
            p.scale.setScalar(1 + Math.random());
            p.material.color.setHex(color);
            p.material.opacity = 0.9;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(a) * spd;
            p.userData.vy = Math.sin(a) * spd;
            p.userData.life = 0;
            p.userData.maxLife = 0.15;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Impact sparks at target
        for (let i = 0; i < 5; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = angle + Math.PI + (Math.random() - 0.5) * 2.0;
            const spd = 50 + Math.random() * 100;
            p.position.set(target.x, target.y, 10);
            p.scale.setScalar(0.5 + Math.random() * 0.5);
            p.material.color.setHex(Math.random() < 0.3 ? 0xffffff : color);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(a) * spd;
            p.userData.vy = Math.sin(a) * spd;
            p.userData.life = 0;
            p.userData.maxLife = 0.2 + Math.random() * 0.15;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }
    }

    /**
     * Quest completion celebration effect - rising golden sparks
     */
    spawnQuestComplete(x, y, options = {}) {
        this.lightPool?.spawn(x, y, 0xffcc00, 3.0, 0.8, 800);

        // Bright central flash
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 13);
            flash.scale.setScalar(10);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 1;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.3;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 10;
        }

        // Rising gold sparkles (fountain pattern)
        const colors = [0xffcc00, 0xffdd44, 0xffaa00, 0xffffff, 0xffe066];
        for (let i = 0; i < 30; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 150;
            p.position.set(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 12);
            p.scale.setScalar(1 + Math.random() * 2);
            p.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed * 0.3;
            p.userData.vy = Math.sin(angle) * speed * 0.5 + 80;
            p.userData.life = i * 0.02;
            p.userData.maxLife = 0.8 + Math.random() * 0.6;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Golden celebration ring
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.8,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(8, 12, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 11);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);

        // Delayed second burst (starburst)
        setTimeout(() => {
            this.lightPool?.spawn(x, y, 0xffaa00, 2.0, 0.4, 400);
            for (let i = 0; i < 8; i++) {
                const p = this.getParticle();
                if (!p) break;
                const a = (i / 8) * Math.PI * 2;
                const spd = 100 + Math.random() * 80;
                p.position.set(x, y, 12);
                p.scale.setScalar(1.5 + Math.random());
                p.material.color.setHex(0xffdd44);
                p.material.opacity = 1;
                p.visible = true;
                p.userData.active = true;
                p.userData.vx = Math.cos(a) * spd;
                p.userData.vy = Math.sin(a) * spd;
                p.userData.life = 0;
                p.userData.maxLife = 0.3;
                p.userData.fadeOut = true;
                p.userData.shrink = true;
                p.userData.startScale = p.scale.x;
            }
        }, 200);
    }

    /**
     * Loot pickup sparkle - quick upward sparkle
     */
    spawnLootPickup(x, y, options = {}) {
        const color = options.color || 0x44ff88;
        this.lightPool?.spawn(x, y, color, 1.5, 0.4, 250);

        // Flash at pickup point
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 11);
            flash.scale.setScalar(5);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 0.8;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.15;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 5;
        }

        // Rising sparkles (magnetic pull toward player)
        for (let i = 0; i < 10; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = (i / 10) * Math.PI * 2;
            const radius = 10 + Math.random() * 15;
            p.position.set(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 10);
            p.scale.setScalar(0.8 + Math.random() * 0.8);
            p.material.color.setHex(Math.random() < 0.3 ? 0xffffff : color);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            // Spiral inward (converging on pickup point)
            p.userData.vx = -Math.cos(a) * 40 + Math.cos(a + Math.PI / 2) * 30;
            p.userData.vy = -Math.sin(a) * 40 + Math.sin(a + Math.PI / 2) * 30 + 20;
            p.userData.life = i * 0.02;
            p.userData.maxLife = 0.35 + Math.random() * 0.2;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Expanding collection ring
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.3,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(3, 5, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 9);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);
    }

    /**
     * Missile trail - fire + smoke plume
     */
    spawnMissileTrail(x, y, options = {}) {
        // Smoke puff (expands, lingers)
        const smoke = this.getParticle();
        if (smoke) {
            smoke.position.set(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 7);
            smoke.scale.setScalar(2 + Math.random() * 3);
            smoke.material.color.setHex(Math.random() < 0.4 ? 0x666666 : 0x444444);
            smoke.material.opacity = 0.35;
            smoke.visible = true;
            smoke.userData.active = true;
            smoke.userData.vx = (Math.random() - 0.5) * 15;
            smoke.userData.vy = (Math.random() - 0.5) * 15;
            smoke.userData.life = 0;
            smoke.userData.maxLife = 0.8 + Math.random() * 0.5;
            smoke.userData.fadeOut = true;
            smoke.userData.shrink = false;
            smoke.userData.startScale = smoke.scale.x;
        }

        // Fire core (bright, fast-fading)
        const fire = this.getParticle();
        if (fire) {
            fire.position.set(x, y, 8);
            fire.scale.setScalar(1.5 + Math.random() * 1.5);
            fire.material.color.setHex(Math.random() < 0.5 ? 0xff6622 : 0xff9944);
            fire.material.opacity = 0.8;
            fire.visible = true;
            fire.userData.active = true;
            fire.userData.vx = (Math.random() - 0.5) * 20;
            fire.userData.vy = (Math.random() - 0.5) * 20;
            fire.userData.life = 0;
            fire.userData.maxLife = 0.25;
            fire.userData.fadeOut = true;
            fire.userData.shrink = true;
            fire.userData.startScale = fire.scale.x;
        }

        // Occasional bright ember
        if (Math.random() < 0.4) {
            const ember = this.getParticle();
            if (ember) {
                ember.position.set(x, y, 9);
                ember.scale.setScalar(0.5 + Math.random() * 0.5);
                ember.material.color.setHex(0xffcc44);
                ember.material.opacity = 1;
                ember.visible = true;
                ember.userData.active = true;
                ember.userData.vx = (Math.random() - 0.5) * 40;
                ember.userData.vy = (Math.random() - 0.5) * 40;
                ember.userData.life = 0;
                ember.userData.maxLife = 0.4;
                ember.userData.fadeOut = true;
                ember.userData.shrink = true;
                ember.userData.startScale = ember.scale.x;
            }
        }
    }

    /**
     * Warp arrival flash - dramatic multi-layer burst with streaking particles
     */
    spawnWarpFlash(x, y, options = {}) {
        // Intense white flash
        this.lightPool?.spawn(x, y, 0xaaccff, 4.0, 0.5, 600);

        // Central white-hot flash
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 13);
            flash.scale.setScalar(12);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 1;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.35;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 12;
        }

        // Blue halo burst (large, slower fade)
        const halo = this.getParticle();
        if (halo) {
            halo.position.set(x, y, 12);
            halo.scale.setScalar(20);
            halo.material.color.setHex(0x4488ff);
            halo.material.opacity = 0.4;
            halo.visible = true;
            halo.userData.active = true;
            halo.userData.vx = 0;
            halo.userData.vy = 0;
            halo.userData.life = 0;
            halo.userData.maxLife = 0.6;
            halo.userData.fadeOut = true;
            halo.userData.shrink = false;
            halo.userData.startScale = 20;
        }

        // Primary expanding ring
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.7,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(10, 16, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x6699ff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 11);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);

        // Secondary ring (slightly delayed, faster)
        const ring2 = {
            type: 'shockwave',
            x, y,
            life: -0.08,
            maxLife: 0.5,
            mesh: null,
        };
        const ring2Geo = new THREE.RingGeometry(6, 10, 48);
        const ring2Mat = new THREE.MeshBasicMaterial({
            color: 0xaaddff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ring2.mesh = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2.mesh.position.set(x, y, 11.5);
        this.group.add(ring2.mesh);
        this.effects.push(ring2);

        // Streaking warp particles (radiating outward like exit from hyperspace)
        for (let i = 0; i < 20; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = (i / 20) * Math.PI * 2 + Math.random() * 0.3;
            const spd = 200 + Math.random() * 400;
            p.position.set(x, y, 11);
            p.scale.setScalar(1 + Math.random() * 1.5);
            p.material.color.setHex(Math.random() < 0.3 ? 0xffffff : 0x6699ff);
            p.material.opacity = 0.8;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(a) * spd;
            p.userData.vy = Math.sin(a) * spd;
            p.userData.life = 0;
            p.userData.maxLife = 0.25 + Math.random() * 0.15;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }
    }

    /**
     * Level up / rank up effect - spiral particles rising
     */
    spawnLevelUp(x, y, options = {}) {
        const count = 20;
        const color = options.color || 0xff44ff;
        this.lightPool?.spawn(x, y, color, 2.0, 0.8, 800);

        for (let i = 0; i < count; i++) {
            const particle = this.getParticle();
            if (!particle) break;

            const angle = (i / count) * Math.PI * 4; // Two spirals
            const radius = 20 + i * 3;

            particle.position.set(
                x + Math.cos(angle) * radius,
                y + Math.sin(angle) * radius,
                10
            );
            particle.scale.setScalar(1.5 + Math.random());
            particle.material.color.setHex(color);
            particle.material.opacity = 1;
            particle.visible = true;

            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle + Math.PI / 2) * 40;
            particle.userData.vy = Math.sin(angle + Math.PI / 2) * 40 + 30;
            particle.userData.life = i * 0.03; // Staggered start
            particle.userData.maxLife = 1.0 + Math.random() * 0.5;
            particle.userData.fadeOut = true;
            particle.userData.shrink = true;
            particle.userData.startScale = particle.scale.x;
        }
    }

    /**
     * Survey scan pulse - expanding green sonar ring
     */
    spawnSurveyPulse(x, y, options = {}) {
        const maxRadius = options.maxRadius || 2000;
        const color = options.color || 0x00ff88;

        this.lightPool?.spawn(x, y, color, 1.5, 0.4, 300);

        // Expanding ring effect
        const ringEffect = {
            type: 'survey-ring',
            x, y,
            life: 0,
            maxLife: 2.0,
            maxRadius,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(10, 14, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 8);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);

        // Center pulse particles
        for (let i = 0; i < 12; i++) {
            const particle = this.getParticle();
            if (!particle) break;
            const angle = (i / 12) * Math.PI * 2;
            particle.position.set(x, y, 9);
            particle.scale.setScalar(1.5);
            particle.material.color.setHex(color);
            particle.material.opacity = 0.8;
            particle.visible = true;
            particle.userData.active = true;
            particle.userData.vx = Math.cos(angle) * 80;
            particle.userData.vy = Math.sin(angle) * 80;
            particle.userData.life = 0;
            particle.userData.maxLife = 0.6;
            particle.userData.fadeOut = true;
            particle.userData.shrink = true;
            particle.userData.startScale = 1.5;
        }
    }

    /**
     * Repair effect - healing sparkles on target
     */
    spawnRepairEffect(x, y, options = {}) {
        const color = options.color || 0x00aaff;
        this.lightPool?.spawn(x, y, color, 0.8, 0.3, 180);

        // Welding spark cascade
        const sparkColors = [0x00aaff, 0x44ddff, 0x88ffff, 0xffffff, 0x66ccff];
        for (let i = 0; i < 8; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 25;
            p.position.set(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 10);
            p.scale.setScalar(0.5 + Math.random() * 1);
            p.material.color.setHex(sparkColors[Math.floor(Math.random() * sparkColors.length)]);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            // Rise and spiral
            p.userData.vx = Math.cos(a + Math.PI / 2) * 20 + (Math.random() - 0.5) * 15;
            p.userData.vy = 30 + Math.random() * 50;
            p.userData.life = i * 0.03;
            p.userData.maxLife = 0.4 + Math.random() * 0.3;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Healing aura pulse (faint ring)
        if (Math.random() < 0.3) {
            const ringEffect = {
                type: 'shockwave',
                x, y,
                life: 0,
                maxLife: 0.5,
                mesh: null,
            };
            const ringGeo = new THREE.RingGeometry(5, 8, 24);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00ccff,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
            ringEffect.mesh.position.set(x, y, 9);
            this.group.add(ringEffect.mesh);
            this.effects.push(ringEffect);
        }
    }

    /**
     * Tackle warning - red concentric rings pulsing inward
     */
    spawnTackleWarning(x, y, options = {}) {
        this.lightPool?.spawn(x, y, 0xff2200, 1.0, 0.3, 200);

        const ringEffect = {
            type: 'tackle-ring',
            x, y,
            life: 0,
            maxLife: 0.5,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(40, 44, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff2200,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 10);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);
    }

    /**
     * Sector warp charging effect - dramatic vortex with energy buildup
     */
    spawnSectorWarp(x, y, options = {}) {
        this.lightPool?.spawn(x, y, 0x4488ff, 2.5, 0.6, 500);

        // Inner ring of spiraling particles (tight, fast)
        for (let i = 0; i < 12; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = (i / 12) * Math.PI * 2;
            const radius = 15 + Math.random() * 10;
            p.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 9);
            p.scale.setScalar(0.8 + Math.random() * 0.5);
            p.material.color.setHex(0xaaddff);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            // Tight spiral inward
            p.userData.vx = Math.cos(angle + Math.PI * 0.6) * 80 - Math.cos(angle) * 50;
            p.userData.vy = Math.sin(angle + Math.PI * 0.6) * 80 - Math.sin(angle) * 50;
            p.userData.life = 0;
            p.userData.maxLife = 0.5 + Math.random() * 0.3;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Outer ring (wide, slow converging)
        for (let i = 0; i < 10; i++) {
            const p = this.getParticle();
            if (!p) break;
            const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.6;
            const radius = 40 + Math.random() * 25;
            p.position.set(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 8.5);
            p.scale.setScalar(1.2 + Math.random() * 0.8);
            p.material.color.setHex(0x4488ff);
            p.material.opacity = 0.7;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle + Math.PI * 0.8) * 40 - Math.cos(angle) * 25;
            p.userData.vy = Math.sin(angle + Math.PI * 0.8) * 40 - Math.sin(angle) * 25;
            p.userData.life = 0;
            p.userData.maxLife = 0.9 + Math.random() * 0.4;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Energy ring forming at center
        const ringEffect = {
            type: 'warp-charge-ring',
            x, y,
            life: 0,
            maxLife: 1.0,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(20, 24, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x6699ff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 9);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);
    }

    /**
     * Spawn armor hit effect - molten metal sparks, ricochet streaks, and brief fire
     */
    spawnArmorHit(x, y, options = {}) {
        const count = options.count || 12;
        const sourceAngle = options.sourceAngle || Math.random() * Math.PI * 2;

        this.lightPool?.spawn(x, y, 0xff8800, 1.4, 0.3, 350);

        // Molten metal spark spray (directional)
        for (let i = 0; i < count; i++) {
            const p = this.getParticle();
            if (!p) break;
            const spread = (Math.random() - 0.5) * 1.4;
            const angle = sourceAngle + Math.PI + spread;
            const speed = 80 + Math.random() * 200;
            p.position.set(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, 10);
            p.scale.setScalar(0.3 + Math.random() * 0.7);
            const isDebris = Math.random() < 0.25;
            p.material.color.setHex(isDebris ? 0x665544 : (Math.random() < 0.3 ? 0xffdd44 : (Math.random() < 0.5 ? 0xff8800 : 0xffcc22)));
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed;
            p.userData.vy = Math.sin(angle) * speed;
            p.userData.life = 0;
            p.userData.maxLife = isDebris ? 0.7 + Math.random() * 0.5 : 0.15 + Math.random() * 0.2;
            p.userData.fadeOut = true;
            p.userData.shrink = !isDebris;
            p.userData.startScale = p.scale.x;
        }

        // Brief localized fire at impact
        for (let i = 0; i < 3; i++) {
            const p = this.getParticle();
            if (!p) break;
            p.position.set(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 10.5);
            p.scale.setScalar(1.5 + Math.random() * 2);
            p.material.color.setHex(Math.random() < 0.5 ? 0xff4400 : 0xff6600);
            p.material.opacity = 0.8;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = (Math.random() - 0.5) * 15;
            p.userData.vy = (Math.random() - 0.5) * 15;
            p.userData.life = 0;
            p.userData.maxLife = 0.25 + Math.random() * 0.2;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }
    }

    /**
     * Spawn hull hit effect - penetrating damage with fire, venting atmosphere, and structural breach
     */
    spawnHullHit(x, y, options = {}) {
        const count = options.count || 14;
        const sourceAngle = options.sourceAngle || Math.random() * Math.PI * 2;

        this.lightPool?.spawn(x, y, 0xff2200, 2.0, 0.5, 500);

        // Fire jet from penetration point
        for (let i = 0; i < count; i++) {
            const p = this.getParticle();
            if (!p) break;
            const spread = (Math.random() - 0.5) * 1.8;
            const angle = sourceAngle + Math.PI + spread;
            const speed = 30 + Math.random() * 140;
            const isSmoke = Math.random() < 0.3;
            const isFire = !isSmoke;
            p.position.set(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, 10);
            p.scale.setScalar(isFire ? (1.0 + Math.random() * 1.5) : (2 + Math.random() * 3));
            p.material.color.setHex(
                isSmoke ? (Math.random() < 0.5 ? 0x332211 : 0x221100)
                    : (Math.random() < 0.3 ? 0xff1100 : (Math.random() < 0.5 ? 0xff4400 : 0xff6600))
            );
            p.material.opacity = isSmoke ? 0.5 : 0.9;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 40;
            p.userData.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 40;
            p.userData.life = 0;
            p.userData.maxLife = isSmoke ? 1.0 + Math.random() * 0.8 : 0.3 + Math.random() * 0.4;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }

        // Electrical sparks from damaged wiring
        for (let i = 0; i < 4; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 120;
            p.position.set(x, y, 11);
            p.scale.setScalar(0.3 + Math.random() * 0.4);
            p.material.color.setHex(Math.random() < 0.5 ? 0xffffff : 0xaaddff);
            p.material.opacity = 1;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(a) * spd;
            p.userData.vy = Math.sin(a) * spd;
            p.userData.life = 0;
            p.userData.maxLife = 0.1 + Math.random() * 0.1;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Small localized explosion flash
        const miniFlash = this.getParticle();
        if (miniFlash) {
            miniFlash.position.set(x, y, 11.5);
            miniFlash.scale.setScalar(3);
            miniFlash.material.color.setHex(0xff8844);
            miniFlash.material.opacity = 0.8;
            miniFlash.visible = true;
            miniFlash.userData.active = true;
            miniFlash.userData.vx = 0;
            miniFlash.userData.vy = 0;
            miniFlash.userData.life = 0;
            miniFlash.userData.maxLife = 0.12;
            miniFlash.userData.fadeOut = true;
            miniFlash.userData.shrink = true;
            miniFlash.userData.startScale = 3;
        }
    }

    /**
     * Drone launch - energy burst expanding outward from spawn point
     */
    spawnDroneLaunch(x, y, options = {}) {
        const color = options.color || 0x00ffcc;
        this.lightPool?.spawn(x, y, color, 1.5, 0.3, 200);

        // Expanding energy ring
        const ringEffect = {
            type: 'shockwave',
            x, y,
            life: 0,
            maxLife: 0.4,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(4, 7, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 9);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);

        // Bright flash at deploy point
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 10);
            flash.scale.setScalar(4);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 0.9;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.15;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 4;
        }

        // Energy sparkles radiating outward
        for (let i = 0; i < 10; i++) {
            const p = this.getParticle();
            if (!p) break;
            const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
            const spd = 50 + Math.random() * 80;
            p.position.set(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, 9.5);
            p.scale.setScalar(0.6 + Math.random() * 0.6);
            p.material.color.setHex(Math.random() < 0.3 ? 0xffffff : color);
            p.material.opacity = 0.9;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(a) * spd;
            p.userData.vy = Math.sin(a) * spd;
            p.userData.life = 0;
            p.userData.maxLife = 0.2 + Math.random() * 0.15;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }
    }

    /**
     * Drone recall - energy beam pulling inward toward ship
     */
    spawnDroneRecall(x, y, options = {}) {
        const droneX = options.droneX || x;
        const droneY = options.droneY || y;

        this.lightPool?.spawn(x, y, 0x00ccff, 1.0, 0.4, 250);

        // Particles flowing from drone position toward ship
        for (let i = 0; i < 12; i++) {
            const p = this.getParticle();
            if (!p) break;
            const t = Math.random();
            const px = droneX + (x - droneX) * t;
            const py = droneY + (y - droneY) * t;
            const angle = Math.atan2(y - droneY, x - droneX);
            const spd = 80 + Math.random() * 60;
            p.position.set(px + (Math.random() - 0.5) * 10, py + (Math.random() - 0.5) * 10, 9);
            p.scale.setScalar(0.5 + Math.random() * 0.5);
            p.material.color.setHex(Math.random() < 0.4 ? 0xffffff : 0x00ccff);
            p.material.opacity = 0.8;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle) * spd + (Math.random() - 0.5) * 20;
            p.userData.vy = Math.sin(angle) * spd + (Math.random() - 0.5) * 20;
            p.userData.life = i * 0.03;
            p.userData.maxLife = 0.3 + Math.random() * 0.2;
            p.userData.fadeOut = true;
            p.userData.shrink = true;
            p.userData.startScale = p.scale.x;
        }

        // Absorption flash at ship
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 10);
            flash.scale.setScalar(3);
            flash.material.color.setHex(0x00ffcc);
            flash.material.opacity = 0.6;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0.15;
            flash.userData.maxLife = 0.35;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 3;
        }
    }

    /**
     * Warp departure - dramatic inward-collapsing vortex followed by flash
     */
    spawnWarpDeparture(x, y, options = {}) {
        const angle = options.angle || 0;

        // Bright departure flash
        this.lightPool?.spawn(x, y, 0x4488ff, 4.0, 0.4, 500);

        // White-hot core
        const flash = this.getParticle();
        if (flash) {
            flash.position.set(x, y, 13);
            flash.scale.setScalar(15);
            flash.material.color.setHex(0xffffff);
            flash.material.opacity = 1;
            flash.visible = true;
            flash.userData.active = true;
            flash.userData.vx = 0;
            flash.userData.vy = 0;
            flash.userData.life = 0;
            flash.userData.maxLife = 0.25;
            flash.userData.fadeOut = true;
            flash.userData.shrink = true;
            flash.userData.startScale = 15;
        }

        // Directional streak particles (warp vector)
        for (let i = 0; i < 25; i++) {
            const p = this.getParticle();
            if (!p) break;
            const spread = (Math.random() - 0.5) * 0.4;
            const spd = 600 + Math.random() * 600;
            p.position.set(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, 11);
            p.scale.setScalar(1 + Math.random() * 2);
            p.material.color.setHex(Math.random() < 0.4 ? 0xffffff : 0x6699ff);
            p.material.opacity = 0.9;
            p.visible = true;
            p.userData.active = true;
            p.userData.vx = Math.cos(angle + spread) * spd;
            p.userData.vy = Math.sin(angle + spread) * spd;
            p.userData.life = Math.random() * 0.05;
            p.userData.maxLife = 0.3 + Math.random() * 0.2;
            p.userData.fadeOut = true;
            p.userData.shrink = false;
            p.userData.startScale = p.scale.x;
        }

        // Collapsing ring (contracts to nothing)
        const ringEffect = {
            type: 'tackle-ring',
            x, y,
            life: 0,
            maxLife: 0.3,
            mesh: null,
        };
        const ringGeo = new THREE.RingGeometry(25, 30, 48);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x6699ff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        ringEffect.mesh = new THREE.Mesh(ringGeo, ringMat);
        ringEffect.mesh.position.set(x, y, 10);
        this.group.add(ringEffect.mesh);
        this.effects.push(ringEffect);
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

                case 'laser-beam':
                    if (effect.meshes) {
                        // Multi-layer beam fade-out
                        const fade = 1 - progress * progress; // quick at start, slow fade
                        effect.meshes[0].material.opacity = 0.15 * fade; // outer glow
                        effect.meshes[1].material.opacity = 0.5 * fade; // body
                        effect.meshes[2].material.opacity = 0.95 * fade; // core
                    }
                    break;

                case 'shield-flicker':
                    if (effect.mesh) {
                        // Rapid on/off flicker
                        const flick = Math.sin(progress * Math.PI * 8) > 0 ? 0.25 : 0.05;
                        effect.mesh.material.opacity = flick * (1 - progress);
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

                case 'survey-ring':
                    if (effect.mesh) {
                        // Expand to max scan radius and fade
                        const scanScale = 1 + progress * (effect.maxRadius / 12);
                        effect.mesh.scale.setScalar(scanScale);
                        effect.mesh.material.opacity = 0.6 * (1 - progress * progress);
                    }
                    break;

                case 'tackle-ring':
                    if (effect.mesh) {
                        // Contract inward and flash
                        const contractScale = 1 - progress * 0.5;
                        effect.mesh.scale.setScalar(contractScale);
                        effect.mesh.material.opacity = 0.7 * (1 - progress);
                    }
                    break;

                case 'warp-charge-ring':
                    if (effect.mesh) {
                        // Contract inward (closing vortex) with pulsing brightness
                        const shrinkScale = Math.max(0.2, 1 - progress * 0.8);
                        const pulseBright = 0.5 + 0.3 * Math.sin(progress * Math.PI * 6);
                        effect.mesh.scale.setScalar(shrinkScale);
                        effect.mesh.material.opacity = pulseBright * (1 - progress * 0.5);
                        effect.mesh.rotation.z += dt * 3;
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
                // Multi-mesh cleanup (laser-beam)
                if (effect.meshes) {
                    for (const m of effect.meshes) {
                        this.group.remove(m);
                        m.geometry.dispose();
                        m.material.dispose();
                    }
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
            if (effect.meshes) {
                for (const m of effect.meshes) {
                    this.group.remove(m);
                    m.geometry.dispose();
                    m.material.dispose();
                }
            }
        }
        this.effects = [];
    }
}
