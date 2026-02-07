// =============================================
// Enemy Ship Class
// AI-controlled hostile ships
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';

export class EnemyShip extends Ship {
    constructor(game, options = {}) {
        const enemyType = options.enemyType || 'pirate-frigate';
        const enemyConfig = CONFIG.ENEMIES[enemyType];
        const shipConfig = CONFIG.SHIPS[enemyConfig?.shipClass || 'frigate'];

        super(game, {
            ...shipConfig,
            ...options,
            name: options.name || enemyConfig?.name || 'Hostile',
            color: CONFIG.COLORS.hostile,
        });

        this.type = 'enemy';
        this.enemyType = enemyType;
        this.hostility = 'hostile';

        // AI state
        this.aiState = 'idle'; // idle, patrol, chase, attack, flee
        this.aiTarget = null;
        this.patrolPoint = null;
        this.aggroRange = 1500;
        this.attackRange = 800;
        this.fleeThreshold = 0.2; // Flee when below 20% hull

        // AI config from enemy type
        this.aggression = enemyConfig?.aggression || 0.5;
        this.bounty = enemyConfig?.bounty || 100;
        this.lootValue = {
            min: enemyConfig?.loot?.min || 50,
            max: enemyConfig?.loot?.max || 200,
        };

        // Default weapon
        this.fitModule('high-1', 'small-laser');
    }

    /**
     * Update enemy ship (AI handled by AISystem)
     */
    update(dt) {
        super.update(dt);
    }

    /**
     * Set AI state
     */
    setAIState(state, target = null) {
        this.aiState = state;
        this.aiTarget = target;
    }

    /**
     * Called when destroyed - drop loot
     */
    destroy() {
        // Calculate loot value
        const lootValue = Math.floor(
            Math.random() * (this.lootValue.max - this.lootValue.min) + this.lootValue.min
        );

        // Award bounty and loot to player if player killed this
        if (this.game.player && this.game.player.alive) {
            this.game.addCredits(this.bounty + lootValue);
            this.game.ui?.log(`+${this.bounty} ISK bounty, +${lootValue} ISK loot`, 'combat');
        }

        super.destroy();
    }

    /**
     * Create enemy ship mesh
     */
    createMesh() {
        const enemyConfig = CONFIG.ENEMIES[this.enemyType];
        const shipClass = enemyConfig?.shipClass || 'frigate';
        const sizeMap = { frigate: 'frigate', destroyer: 'destroyer', cruiser: 'cruiser', battlecruiser: 'battlecruiser', battleship: 'battleship', capital: 'capital' };
        const factorySize = sizeMap[shipClass] || 'frigate';

        try {
            this.mesh = shipMeshFactory.generateShipMesh({
                shipId: `enemy-${this.enemyType}`,
                role: 'pirate',
                size: factorySize,
                detailLevel: 'low',
            });
        } catch (e) {
            const group = new THREE.Group();
            const size = this.radius;
            const shape = new THREE.Shape();
            shape.moveTo(size, 0);
            shape.lineTo(0, size * 0.7);
            shape.lineTo(-size * 0.8, size * 0.3);
            shape.lineTo(-size * 0.6, 0);
            shape.lineTo(-size * 0.8, -size * 0.3);
            shape.lineTo(0, -size * 0.7);
            shape.closePath();
            const geo = new THREE.ShapeGeometry(shape);
            const mat = new THREE.MeshBasicMaterial({ color: 0xaa2222, transparent: true, opacity: 0.9 });
            group.add(new THREE.Mesh(geo, mat));
            this.mesh = group;
        }

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;
        return this.mesh;
    }
}
