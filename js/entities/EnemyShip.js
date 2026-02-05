// =============================================
// Enemy Ship Class
// AI-controlled hostile ships
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';

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
        const group = new THREE.Group();

        // Aggressive angular shape
        const hullShape = new THREE.Shape();
        const size = this.radius;

        hullShape.moveTo(size, 0);
        hullShape.lineTo(0, size * 0.7);
        hullShape.lineTo(-size * 0.8, size * 0.3);
        hullShape.lineTo(-size * 0.6, 0);
        hullShape.lineTo(-size * 0.8, -size * 0.3);
        hullShape.lineTo(0, -size * 0.7);
        hullShape.closePath();

        const hullGeometry = new THREE.ShapeGeometry(hullShape);
        const hullMaterial = new THREE.MeshBasicMaterial({
            color: 0xaa2222,
            transparent: true,
            opacity: 0.9,
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        group.add(hull);

        // Red engine glow
        const engineGeometry = new THREE.CircleGeometry(size * 0.15, 6);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.7,
        });
        const engine = new THREE.Mesh(engineGeometry, engineMaterial);
        engine.position.set(-size * 0.6, 0, 0);
        group.add(engine);

        // Hostile indicator
        const indicatorGeometry = new THREE.RingGeometry(size * 1.3, size * 1.4, 6);
        const indicatorMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        group.add(indicator);

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;

        return this.mesh;
    }
}
