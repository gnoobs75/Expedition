// =============================================
// NPC Ship Class
// Non-hostile AI ships (miners, security)
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';

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

    createMesh() {
        // Map NPC roles to ShipMeshFactory roles
        const roleMap = { miner: 'mining', security: 'police' };
        const factoryRole = roleMap[this.role] || 'mining';
        const shipClass = this.shipClass || 'frigate';

        // Determine size from CONFIG.SHIPS
        const sizeMap = { frigate: 'frigate', destroyer: 'destroyer', cruiser: 'cruiser', battlecruiser: 'battlecruiser', battleship: 'battleship', capital: 'capital' };
        const factorySize = sizeMap[shipClass] || 'frigate';

        try {
            this.mesh = shipMeshFactory.generateShipMesh({
                shipId: `npc-${this.role}-${shipClass}`,
                role: factoryRole,
                size: factorySize,
                detailLevel: 'low',
            });
        } catch (e) {
            // Fallback to simple triangle
            const shape = new THREE.Shape();
            const size = this.radius;
            shape.moveTo(size, 0);
            shape.lineTo(-size * 0.7, size * 0.5);
            shape.lineTo(-size * 0.5, 0);
            shape.lineTo(-size * 0.7, -size * 0.5);
            shape.closePath();
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.9 });
            this.mesh = new THREE.Mesh(geometry, material);
        }

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;
        return this.mesh;
    }
}
