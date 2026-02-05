// =============================================
// Station Class
// Dockable stations for trading and repairs
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

export class Station extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Space Station',
            radius: options.radius || 400, // Much larger default station
            color: CONFIG.COLORS.friendly,
        });

        this.type = 'station';

        // Station properties - docking range scales with size
        this.dockingRange = this.radius * 1.5;
        this.services = options.services || ['repair', 'market', 'hangar'];

        // Rotation for visual effect
        this.rotationSpeed = 0.05;

        // Shop inventory
        this.shipsForSale = Object.keys(CONFIG.SHIPS);
        this.modulesForSale = Object.keys(CONFIG.MODULES);
    }

    /**
     * Update station
     */
    update(dt) {
        super.update(dt);
        this.rotation += this.rotationSpeed * dt;
    }

    /**
     * Check if an entity can dock
     */
    canDock(entity) {
        const dist = this.distanceTo(entity);
        return dist <= this.dockingRange;
    }

    /**
     * Get repair cost for a ship
     */
    getRepairCost(ship) {
        const shieldDamage = ship.maxShield - ship.shield;
        const armorDamage = ship.maxArmor - ship.armor;
        const hullDamage = ship.maxHull - ship.hull;

        return Math.floor((shieldDamage + armorDamage * 2 + hullDamage * 3) * 0.5);
    }

    /**
     * Repair a ship
     */
    repairShip(ship) {
        const cost = this.getRepairCost(ship);
        if (this.game.spendCredits(cost)) {
            ship.shield = ship.maxShield;
            ship.armor = ship.maxArmor;
            ship.hull = ship.maxHull;
            return true;
        }
        return false;
    }

    /**
     * Create station mesh
     */
    createMesh() {
        const group = new THREE.Group();

        // Main structure - octagonal
        const mainShape = new THREE.Shape();
        const sides = 8;
        const angleStep = (Math.PI * 2) / sides;

        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;

            if (i === 0) {
                mainShape.moveTo(x, y);
            } else {
                mainShape.lineTo(x, y);
            }
        }
        mainShape.closePath();

        const mainGeometry = new THREE.ShapeGeometry(mainShape);
        const mainMaterial = new THREE.MeshBasicMaterial({
            color: 0x334455,
            transparent: true,
            opacity: 0.9,
        });
        const main = new THREE.Mesh(mainGeometry, mainMaterial);
        group.add(main);

        // Inner ring
        const innerRingGeometry = new THREE.RingGeometry(
            this.radius * 0.4,
            this.radius * 0.5,
            sides
        );
        const innerRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
        });
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        innerRing.position.z = 0.1;
        group.add(innerRing);

        // Outer ring
        const outerRingGeometry = new THREE.RingGeometry(
            this.radius * 0.9,
            this.radius * 0.95,
            sides
        );
        const outerRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x44ff44,
            transparent: true,
            opacity: 0.5,
        });
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        outerRing.position.z = 0.1;
        group.add(outerRing);

        // Docking lights
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2;
            const lightGeometry = new THREE.CircleGeometry(8, 8);
            const lightMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.8,
            });
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(
                Math.cos(angle) * this.radius * 0.7,
                Math.sin(angle) * this.radius * 0.7,
                0.2
            );
            group.add(light);
        }

        // Center core
        const coreGeometry = new THREE.CircleGeometry(this.radius * 0.15, 16);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.9,
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.z = 0.2;
        group.add(core);

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);

        // Store inner ring for animation
        this.innerRing = innerRing;

        return this.mesh;
    }

    /**
     * Update mesh with animation
     */
    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 0);
            this.mesh.visible = this.visible && this.alive;

            // Rotate inner ring opposite to station
            if (this.innerRing) {
                this.innerRing.rotation.z = -this.rotation * 2;
            }
        }
    }
}
