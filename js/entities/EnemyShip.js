// =============================================
// Enemy Ship Class
// AI-controlled hostile ships
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { LootContainer } from './LootContainer.js';
import { Wreck } from './Wreck.js';

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

        // Pursuit tracking
        this._chaseStartTime = 0;
        this._pursuitReason = '';

        // Default weapon
        this.fitModule('high-1', 'small-laser');

        // Fit tackle modules based on ship class
        const shipClass = enemyConfig?.shipClass || 'frigate';
        if (shipClass === 'cruiser' || shipClass === 'battlecruiser' || shipClass === 'battleship' || shipClass === 'capital') {
            if (this.midSlots >= 1) this.fitModule('mid-1', 'warp-disruptor');
            if (this.midSlots >= 2) this.fitModule('mid-2', 'stasis-webifier');
        } else {
            // Frigates/destroyers get scrambler
            if (this.midSlots >= 1) this.fitModule('mid-1', 'warp-scrambler');
        }
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

        // Award bounty only if player or fleet made the kill
        const killer = this.lastDamageSource;
        const isPlayerKill = killer === this.game.player;
        const isFleetKill = killer?.type === 'fleet' || killer?.isFleet;
        if ((isPlayerKill || isFleetKill) && this.game.player?.alive) {
            this.game.addCredits(this.bounty);
            this.game.ui?.log(`+${this.bounty} ISK bounty`, 'combat');
            this.game.audio?.play('loot-pickup');

            // Show bounty popup
            if (this.game.input) {
                const screen = this.game.input.worldToScreen(this.x, this.y);
                this.game.ui?.showCreditPopup(this.bounty, screen.x, screen.y, 'bounty');
            }
        }

        // Drop loot container with credits
        if (lootValue > 0) {
            const container = new LootContainer(this.game, {
                x: this.x + (Math.random() - 0.5) * 50,
                y: this.y + (Math.random() - 0.5) * 50,
                name: `${this.name}'s Wreck`,
                credits: lootValue,
            });
            this.game.currentSector?.addEntity(container);
        }

        // Drop salvageable wreck
        const wreck = new Wreck(this.game, {
            x: this.x + (Math.random() - 0.5) * 30,
            y: this.y + (Math.random() - 0.5) * 30,
            name: `Wreck of ${this.name}`,
            credits: Math.floor(this.bounty * 0.3),
            salvageMaterials: Math.floor(2 + Math.random() * 4),
            sourceShipName: this.name,
            sourceShipClass: this.shipClass || this.enemyType,
        });
        this.game.currentSector?.addEntity(wreck);

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
            const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.min(size * 0.1, 6), bevelEnabled: true, bevelThickness: Math.min(size * 0.02, 1.5), bevelSize: Math.min(size * 0.015, 1), bevelSegments: 1 });
            geo.center();
            const mat = new THREE.MeshStandardMaterial({ color: 0xaa2222, emissive: 0xaa2222, emissiveIntensity: 0.15, transparent: true, opacity: 0.9, roughness: 0.5, metalness: 0.3 });
            group.add(new THREE.Mesh(geo, mat));
            this.mesh = group;
        }

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;

        // Add weapon turrets
        this.addTurretHardpoints();

        return this.mesh;
    }
}
