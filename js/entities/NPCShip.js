// =============================================
// NPC Ship Class
// Non-hostile AI ships (miners, security)
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';

export class NPCShip extends Ship {
    constructor(game, options = {}) {
        const role = options.role || 'miner';
        const shipClass = options.shipClass || 'frigate';
        const shipConfig = CONFIG.SHIPS[shipClass];

        const colorMap = {
            miner: CONFIG.COLORS.miner,
            security: CONFIG.COLORS.security,
        };

        super(game, {
            ...shipConfig,
            ...options,
            name: options.name || (role === 'miner' ? 'Mining Vessel' : 'Security Patrol'),
            color: colorMap[role] || CONFIG.COLORS.neutral,
        });

        this.type = 'npc';
        this.role = role;
        this.hostility = 'neutral';

        // AI state
        this.aiState = 'idle';
        this.aiTarget = null;
        this.patrolPoint = null;
        this.homeStation = options.homeStation || null;

        // Miner-specific
        if (role === 'miner') {
            this.fitModule('high-1', 'mining-laser');
            this.miningTarget = null;
            this.dronesLaunched = false;
            this.dockingCooldown = 0;

            // Initialize mining drones
            const droneCount = options.droneCount || 2;
            this.droneBay.capacity = droneCount;
            this.droneBay.bandwidth = droneCount * 10;
            this.droneBay.drones = [];
            for (let i = 0; i < droneCount; i++) {
                this.droneBay.drones.push({
                    type: 'mining-drone',
                    hp: CONFIG.DRONES['mining-drone']?.hp || 50,
                });
            }
        }

        // Security-specific
        if (role === 'security') {
            this.fitModule('high-1', shipClass === 'cruiser' ? 'medium-laser' : 'small-laser');
            this.fitModule('mid-1', 'shield-booster');
            this.aggroRange = 3000;
            this.attackRange = shipClass === 'cruiser' ? 800 : 500;
            this.patrolRadius = 4000;
            this.patrolCenter = { x: this.x, y: this.y };
        }

        // Bounty/loot for when player attacks neutral NPCs
        this.bounty = 0;
        this.lootValue = { min: 50, max: 200 };
        if (role === 'miner') {
            this.lootValue = { min: 100, max: 500 };
        }
    }

    update(dt) {
        super.update(dt);

        if (this.role === 'miner' && this.dockingCooldown > 0) {
            this.dockingCooldown -= dt;
        }
    }

    /**
     * Called when destroyed
     */
    destroy() {
        // Recall all drones
        if (this.droneBay?.deployed?.size > 0) {
            for (const drone of this.droneBay.deployed.values()) {
                if (drone.alive) {
                    drone.alive = false;
                }
            }
            this.droneBay.deployed.clear();
        }

        // Award loot to player if player killed this
        if (this.game.player?.alive) {
            const lootValue = Math.floor(
                Math.random() * (this.lootValue.max - this.lootValue.min) + this.lootValue.min
            );
            // Only award if player was involved (nearby and aggressive)
            const dist = this.distanceTo(this.game.player);
            if (dist < 2000) {
                this.game.addCredits(lootValue);
                this.game.ui?.log(`+${lootValue} ISK salvage`, 'combat');
            }
        }

        super.destroy();
    }

    /**
     * Create miner ship mesh - industrial/boxy look
     */
    createMinerMesh() {
        const group = new THREE.Group();
        const size = this.radius;

        // Boxy industrial hull
        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 0.8, 0);
        hullShape.lineTo(size * 0.5, size * 0.5);
        hullShape.lineTo(-size * 0.7, size * 0.4);
        hullShape.lineTo(-size * 0.8, size * 0.2);
        hullShape.lineTo(-size * 0.8, -size * 0.2);
        hullShape.lineTo(-size * 0.7, -size * 0.4);
        hullShape.lineTo(size * 0.5, -size * 0.5);
        hullShape.closePath();

        const hullGeometry = new THREE.ShapeGeometry(hullShape);
        const hullMaterial = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS.miner,
            transparent: true,
            opacity: 0.85,
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        group.add(hull);

        // Cargo bay indicator (rectangle on top)
        const cargoGeometry = new THREE.PlaneGeometry(size * 0.6, size * 0.3);
        const cargoMaterial = new THREE.MeshBasicMaterial({
            color: 0x667788,
            transparent: true,
            opacity: 0.7,
        });
        const cargoBay = new THREE.Mesh(cargoGeometry, cargoMaterial);
        cargoBay.position.set(-size * 0.1, 0, 0.05);
        group.add(cargoBay);

        // Engine
        const engineGeometry = new THREE.CircleGeometry(size * 0.15, 6);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.6,
        });
        const engine = new THREE.Mesh(engineGeometry, engineMaterial);
        engine.position.set(-size * 0.75, 0, 0);
        group.add(engine);

        // Neutral indicator ring
        const indicatorGeometry = new THREE.RingGeometry(size * 1.2, size * 1.3, 16);
        const indicatorMaterial = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS.miner,
            transparent: true,
            opacity: 0.15,
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        group.add(indicator);

        return group;
    }

    /**
     * Create security ship mesh - militaristic
     */
    createSecurityMesh() {
        const group = new THREE.Group();
        const size = this.radius;

        // Sleek military hull
        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 1.1, 0);
        hullShape.lineTo(size * 0.2, size * 0.6);
        hullShape.lineTo(-size * 0.5, size * 0.5);
        hullShape.lineTo(-size * 0.7, size * 0.2);
        hullShape.lineTo(-size * 0.7, -size * 0.2);
        hullShape.lineTo(-size * 0.5, -size * 0.5);
        hullShape.lineTo(size * 0.2, -size * 0.6);
        hullShape.closePath();

        const hullGeometry = new THREE.ShapeGeometry(hullShape);
        const hullMaterial = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS.security,
            transparent: true,
            opacity: 0.9,
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        group.add(hull);

        // Wing stripes
        const stripeGeometry = new THREE.PlaneGeometry(size * 0.4, size * 0.08);
        const stripeMaterial = new THREE.MeshBasicMaterial({
            color: 0x88bbff,
            transparent: true,
            opacity: 0.6,
        });
        const stripe1 = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe1.position.set(0, size * 0.35, 0.05);
        group.add(stripe1);
        const stripe2 = stripe1.clone();
        stripe2.position.set(0, -size * 0.35, 0.05);
        group.add(stripe2);

        // Engines
        const engineGeometry = new THREE.CircleGeometry(size * 0.12, 8);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.7,
        });
        const engine1 = new THREE.Mesh(engineGeometry, engineMaterial);
        engine1.position.set(-size * 0.65, size * 0.15, 0);
        group.add(engine1);
        const engine2 = engine1.clone();
        engine2.position.set(-size * 0.65, -size * 0.15, 0);
        group.add(engine2);

        // Security indicator ring - blue
        const indicatorGeometry = new THREE.RingGeometry(size * 1.2, size * 1.3, 8);
        const indicatorMaterial = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS.security,
            transparent: true,
            opacity: 0.2,
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        group.add(indicator);

        return group;
    }

    createMesh() {
        if (this.role === 'security') {
            this.mesh = this.createSecurityMesh();
        } else {
            this.mesh = this.createMinerMesh();
        }

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;
        return this.mesh;
    }
}
