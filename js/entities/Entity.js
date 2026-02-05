// =============================================
// Entity Base Class
// All game objects extend this
// =============================================

import { CONFIG } from '../config.js';
import { Vector2, wrapCoord } from '../utils/math.js';

let entityIdCounter = 0;

export class Entity {
    constructor(game, options = {}) {
        this.game = game;
        this.id = ++entityIdCounter;

        // Position and movement
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.velocity = new Vector2(options.vx || 0, options.vy || 0);
        this.rotation = options.rotation || 0;

        // Physical properties
        this.radius = options.radius || 20;
        this.mass = options.mass || 1;

        // State flags
        this.alive = true;
        this.visible = true;
        this.selected = false;
        this.locked = false;

        // Identity
        this.name = options.name || 'Unknown';
        this.type = options.type || 'entity';

        // Graphics
        this.mesh = null;
        this.color = options.color || 0xffffff;

        // Effects
        this.effects = [];
    }

    /**
     * Update entity state
     */
    update(dt) {
        if (!this.alive) return;

        // Apply velocity
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;

        // Wrap around toroidal space
        this.x = wrapCoord(this.x, CONFIG.SECTOR_SIZE);
        this.y = wrapCoord(this.y, CONFIG.SECTOR_SIZE);

        // Update effects
        this.updateEffects(dt);
    }

    /**
     * Update visual effects
     */
    updateEffects(dt) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.time -= dt;
            if (effect.time <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    /**
     * Add a temporary effect
     */
    addEffect(name, duration) {
        this.effects.push({ name, time: duration });
    }

    /**
     * Check if entity has an effect
     */
    hasEffect(name) {
        return this.effects.some(e => e.name === name);
    }

    /**
     * Called when entity takes damage
     */
    takeDamage(amount, source) {
        // Override in subclasses
    }

    /**
     * Called when entity is destroyed
     */
    destroy() {
        this.alive = false;
        this.game.events.emit('entity:destroyed', this);
    }

    /**
     * Get distance to another entity
     */
    distanceTo(other) {
        return Math.sqrt(this.distanceSquaredTo(other));
    }

    /**
     * Get squared distance (faster, no sqrt)
     */
    distanceSquaredTo(other) {
        if (!other) return Infinity;
        let dx = Math.abs(other.x - this.x);
        let dy = Math.abs(other.y - this.y);

        // Account for toroidal wrapping
        if (dx > CONFIG.SECTOR_SIZE / 2) dx = CONFIG.SECTOR_SIZE - dx;
        if (dy > CONFIG.SECTOR_SIZE / 2) dy = CONFIG.SECTOR_SIZE - dy;

        return dx * dx + dy * dy;
    }

    /**
     * Get direction to another entity (wrapped)
     */
    directionTo(other) {
        let dx = other.x - this.x;
        let dy = other.y - this.y;

        // Account for toroidal wrapping
        if (dx > CONFIG.SECTOR_SIZE / 2) dx -= CONFIG.SECTOR_SIZE;
        if (dx < -CONFIG.SECTOR_SIZE / 2) dx += CONFIG.SECTOR_SIZE;
        if (dy > CONFIG.SECTOR_SIZE / 2) dy -= CONFIG.SECTOR_SIZE;
        if (dy < -CONFIG.SECTOR_SIZE / 2) dy += CONFIG.SECTOR_SIZE;

        return Math.atan2(dy, dx);
    }

    /**
     * Check collision with another entity
     */
    collidesWith(other) {
        const minDist = this.radius + other.radius;
        return this.distanceSquaredTo(other) < minDist * minDist;
    }

    /**
     * Create Three.js mesh for this entity
     * Override in subclasses
     */
    createMesh() {
        // Default: create a simple circle
        const geometry = new THREE.CircleGeometry(this.radius, 16);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.8,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);
        return this.mesh;
    }

    /**
     * Update mesh position to match entity
     */
    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 0);
            this.mesh.rotation.z = this.rotation;
            this.mesh.visible = this.visible && this.alive;
        }
    }

    /**
     * Serialize entity state
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            alive: this.alive,
        };
    }
}
