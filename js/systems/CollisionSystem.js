// =============================================
// Collision System
// Simple circle-based collision detection
// =============================================

import { CONFIG } from '../config.js';

export class CollisionSystem {
    constructor(game) {
        this.game = game;
    }

    /**
     * Update collision detection
     */
    update(dt) {
        const player = this.game.player;
        if (!player || !player.alive) return;

        const sector = this.game.currentSector;
        if (!sector) return;

        // Check collision with central planet (lethal)
        if (sector.centralPlanet) {
            this.checkPlanetCollision(player, sector.centralPlanet);
        }

        // Check collision with asteroids and other entities
        for (const entity of sector.entities) {
            if (!entity.alive || entity === player) continue;

            if (this.checkCollision(player, entity)) {
                this.handleCollision(player, entity);
            }
        }
    }

    /**
     * Check and handle collision with central planet
     */
    checkPlanetCollision(player, planet) {
        if (!planet.isCentralPlanet) return;

        const dist = player.distanceTo(planet);
        const killRadius = CONFIG.CENTRAL_PLANET?.killRadius || (planet.radius + 50);
        const warningRadius = killRadius + 500;

        // Danger zone warning
        if (dist < warningRadius && dist >= killRadius) {
            if (!this._planetWarned) {
                this._planetWarned = true;
                this.game.ui?.log('WARNING: Gravitational pull detected! Steer clear of the planet!', 'combat');
                this.game.audio?.play('warning');
                this.game.camera.shake(3, 0.3);
            }
        } else {
            this._planetWarned = false;
        }

        if (dist < killRadius) {
            // Instant death - player crashed into the planet
            this.game.ui?.log('COLLISION WITH PLANET - SHIP DESTROYED!', 'combat');

            // Camera shake and explosion
            this.game.camera.shake(20, 1.0);
            this.game.renderer?.effects.spawn('explosion', player.x, player.y, {
                count: 50,
                size: 3,
                color: 0xff6600,
            });

            // Kill the player
            player.hull = 0;
            player.destroy();

            // Play explosion sound
            this.game.audio?.play('explosion');
        }
    }

    /**
     * Check if two entities are colliding
     */
    checkCollision(a, b) {
        const minDist = (a.radius || 20) + (b.radius || 20);
        const distSq = a.distanceSquaredTo(b);
        return distSq < minDist * minDist;
    }

    /**
     * Handle collision between player and entity
     */
    handleCollision(player, entity) {
        switch (entity.type) {
            case 'asteroid':
                // Bump damage and push apart
                this.handleAsteroidCollision(player, entity);
                break;

            case 'enemy':
            case 'npc':
                // Ram damage
                this.handleShipCollision(player, entity);
                break;

            case 'station':
                // Check for docking
                this.handleStationCollision(player, entity);
                break;

            case 'gate':
                // Offer jump
                this.handleGateCollision(player, entity);
                break;
        }
    }

    /**
     * Handle collision with asteroid
     */
    handleAsteroidCollision(player, asteroid) {
        // Calculate collision force based on relative velocity
        const relVel = Math.abs(player.currentSpeed);

        if (relVel > 50) {
            // Take bump damage
            const damage = relVel * 0.1;
            player.takeDamage(damage, asteroid);

            // Push apart
            this.pushApart(player, asteroid);

            // Camera shake
            this.game.camera.shake(3, 0.15);

            this.game.ui?.log('Collision with asteroid!', 'combat');
        }
    }

    /**
     * Handle collision with another ship
     */
    handleShipCollision(player, enemy) {
        const relVel = Math.abs(player.currentSpeed - enemy.currentSpeed);

        if (relVel > 30) {
            // Both take ram damage
            const damage = relVel * 0.2;
            player.takeDamage(damage, enemy);
            enemy.takeDamage(damage, player);

            // Push apart
            this.pushApart(player, enemy);

            // Camera shake
            this.game.camera.shake(5, 0.2);
        }
    }

    /**
     * Handle collision with station
     */
    handleStationCollision(player, station) {
        // Just push apart, docking is handled separately
        this.pushApart(player, station);
    }

    /**
     * Handle collision with warp gate
     */
    handleGateCollision(player, gate) {
        // Just push apart, gate use is handled separately
        this.pushApart(player, gate);
    }

    /**
     * Push two entities apart
     */
    pushApart(a, b) {
        let dx = b.x - a.x;
        let dy = b.y - a.y;

        // Handle toroidal wrap
        if (dx > CONFIG.SECTOR_SIZE / 2) dx -= CONFIG.SECTOR_SIZE;
        if (dx < -CONFIG.SECTOR_SIZE / 2) dx += CONFIG.SECTOR_SIZE;
        if (dy > CONFIG.SECTOR_SIZE / 2) dy -= CONFIG.SECTOR_SIZE;
        if (dy < -CONFIG.SECTOR_SIZE / 2) dy += CONFIG.SECTOR_SIZE;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return;

        const minDist = (a.radius || 20) + (b.radius || 20);
        const overlap = minDist - dist;

        if (overlap > 0) {
            const pushX = (dx / dist) * overlap * 0.5;
            const pushY = (dy / dist) * overlap * 0.5;

            // Push based on mass (heavier objects move less)
            const massRatio = (b.mass || 1) / ((a.mass || 1) + (b.mass || 1));

            a.x -= pushX * massRatio;
            a.y -= pushY * massRatio;
            b.x += pushX * (1 - massRatio);
            b.y += pushY * (1 - massRatio);

            // Reduce velocity slightly
            a.velocity.multiplyScalar(0.9);
            b.velocity.multiplyScalar(0.9);
        }
    }

    /**
     * Check if point is inside entity
     */
    pointInEntity(x, y, entity) {
        let dx = x - entity.x;
        let dy = y - entity.y;

        // Handle toroidal wrap
        if (dx > CONFIG.SECTOR_SIZE / 2) dx -= CONFIG.SECTOR_SIZE;
        if (dx < -CONFIG.SECTOR_SIZE / 2) dx += CONFIG.SECTOR_SIZE;
        if (dy > CONFIG.SECTOR_SIZE / 2) dy -= CONFIG.SECTOR_SIZE;
        if (dy < -CONFIG.SECTOR_SIZE / 2) dy += CONFIG.SECTOR_SIZE;

        const distSq = dx * dx + dy * dy;
        const radius = entity.radius || 20;
        return distSq < radius * radius;
    }
}
