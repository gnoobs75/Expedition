// =============================================
// Projectile Class
// Weapons fire (lasers, missiles, etc.)
// =============================================

import { Entity } from './Entity.js';

export class Projectile extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            radius: options.radius || 3,
        });

        this.type = 'projectile';
        this.visible = true;

        // Projectile properties
        this.source = options.source || null;
        this.target = options.target || null;
        this.damage = options.damage || 10;
        this.speed = options.speed || 1500;
        this.lifetime = options.lifetime || 2;
        this.age = 0;

        // Visual
        this.color = options.color || 0x00ffff;
        this.length = options.length || 20;

        // Set initial velocity towards target
        if (this.target) {
            const angle = this.directionTo(this.target);
            this.velocity.x = Math.cos(angle) * this.speed;
            this.velocity.y = Math.sin(angle) * this.speed;
            this.rotation = angle;
        }
    }

    /**
     * Update projectile
     */
    update(dt) {
        if (!this.alive) return;

        this.age += dt;

        // Check lifetime
        if (this.age >= this.lifetime) {
            this.destroy();
            return;
        }

        // Move (don't use parent update to avoid wrapping)
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;

        // Check if hit target
        if (this.target && this.target.alive) {
            const dist = this.distanceTo(this.target);
            if (dist < this.target.radius + this.radius) {
                this.hit();
            }
        }
    }

    /**
     * Called when projectile hits target
     */
    hit() {
        if (this.target && this.target.alive) {
            this.target.takeDamage(this.damage, this.source, this.damageType || 'em');
        }
        this.destroy();
    }

    /**
     * Create projectile mesh (laser beam)
     */
    createMesh() {
        const group = new THREE.Group();

        // Main beam
        const beamGeometry = new THREE.PlaneGeometry(this.length, 2);
        const beamMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9,
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        group.add(beam);

        // Glow effect
        const glowGeometry = new THREE.PlaneGeometry(this.length, 6);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.3,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = -0.1;
        group.add(glow);

        // Tip glow
        const tipGeometry = new THREE.CircleGeometry(4, 8);
        const tipMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
        });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.position.set(this.length / 2, 0, 0.1);
        group.add(tip);

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 2); // Above other objects
        this.mesh.rotation.z = this.rotation;

        return this.mesh;
    }

    /**
     * Update mesh position
     */
    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 2);
            this.mesh.rotation.z = this.rotation;
            this.mesh.visible = this.visible && this.alive;
        }
    }
}
