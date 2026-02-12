// =============================================
// Fleet Ship Class
// Player-owned fleet ships with AI behaviors
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { wrappedDistance, wrappedDirection } from '../utils/math.js';

let fleetIdCounter = 0;

export class FleetShip extends Ship {
    constructor(game, options = {}) {
        const shipClass = options.shipClass || 'venture';
        const shipConfig = SHIP_DATABASE[shipClass] || CONFIG.SHIPS[shipClass] || CONFIG.SHIPS.frigate;

        super(game, {
            ...shipConfig,
            ...options,
            name: options.name || shipConfig.name || 'Fleet Ship',
            color: CONFIG.COLORS.friendly,
            highSlots: shipConfig.weaponSlots || shipConfig.highSlots || 3,
            midSlots: shipConfig.moduleSlots || shipConfig.midSlots || 2,
            lowSlots: shipConfig.subsystemSlots || shipConfig.lowSlots || 2,
        });

        this.type = 'fleet';
        this.hostility = 'friendly';
        this.isPlayer = false;
        this.shipClass = shipClass;

        // Fleet identity
        this.fleetId = ++fleetIdCounter;
        this.groupId = 0; // Control group 0 = unassigned, 1-5 = groups
        this.pilot = options.pilot || null;

        // AI state machine
        this.aiState = 'following'; // following, orbiting, mining, attacking, defending, docked
        this.commandTarget = null;
        this.followRange = 300 + Math.random() * 200;
        this.followOffset = {
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
        };

        // Combat AI
        this.aggroRange = 1500;
        this.attackRange = 500;
        this.fleeThreshold = 0.15; // Flee at 15% hull
        this.engagedTarget = null;

        // Mining AI
        this.miningTarget = null;

        // Stance: 'aggressive' auto-engages, 'passive' only attacks on command
        this.stance = 'aggressive';

        // Hold position flag
        this.holdPosition = false;
        this.holdX = 0;
        this.holdY = 0;

        // Auto-cargo transfer timer
        this.cargoTransferTimer = 0;
        this.cargoTransferInterval = 5; // seconds

        // Default loadout based on ship role
        this.setupDefaultLoadout(shipConfig);

        // Apply pilot skills if assigned
        if (this.pilot) {
            this.applyPilotSkills();
        }

        // Bounty/loot for display
        this.bounty = 0;
        this.lootValue = { min: 0, max: 0 };
    }

    /**
     * Setup default module loadout based on ship role
     */
    setupDefaultLoadout(shipConfig) {
        const role = shipConfig.role || 'mercenary';

        switch (role) {
            case 'mining':
                this.fitModule('high-1', 'mining-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'mining-laser');
                this.fitModule('mid-1', 'shield-booster');
                break;
            case 'mercenary':
            case 'pirate':
            case 'military':
                this.fitModule('high-1', 'small-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'small-laser');
                if (this.highSlots >= 3) this.fitModule('high-3', 'small-laser');
                this.fitModule('mid-1', 'shield-booster');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'afterburner');
                this.fitModule('low-1', 'damage-mod');
                break;
            case 'police':
                this.fitModule('high-1', 'small-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'small-laser');
                this.fitModule('mid-1', 'shield-booster');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'afterburner');
                break;
            default:
                this.fitModule('high-1', 'small-laser');
                this.fitModule('mid-1', 'shield-booster');
                break;
        }
    }

    /**
     * Apply pilot skill multipliers to ship stats
     */
    applyPilotSkills() {
        if (!this.pilot) return;

        const combatMult = 0.5 + (this.pilot.skills.combat / 100) * 1.0;
        const miningMult = 0.5 + (this.pilot.skills.mining / 100) * 1.0;
        const navMult = 0.5 + (this.pilot.skills.navigation / 100) * 1.0;

        // Navigation affects speed/agility
        this.maxSpeed = Math.round(this.maxSpeed * navMult);
        this.acceleration = Math.round(this.acceleration * navMult);
        this.turnSpeed *= navMult;

        // Apply trait effects
        if (this.pilot.traits) {
            for (const trait of this.pilot.traits) {
                switch (trait) {
                    case 'aggressive':
                        this.aggroRange *= 1.5;
                        break;
                    case 'cautious':
                        this.fleeThreshold = 0.40;
                        break;
                    case 'hotshot':
                        this.maxSpeed = Math.round(this.maxSpeed * 1.1);
                        break;
                    case 'steady':
                        // Hit chance bonus applied in combat calculations
                        break;
                }
            }
        }

        // Store multipliers for combat/mining system use
        this.pilotCombatMult = combatMult;
        this.pilotMiningMult = miningMult;
    }

    /**
     * Check if this ship has a capable pilot (for advanced commands)
     */
    hasCaptain() {
        return this.pilot !== null;
    }

    /**
     * Get available AI states based on pilot status
     */
    getAvailableStates() {
        if (this.hasCaptain()) {
            return ['following', 'orbiting', 'mining', 'attacking', 'defending', 'holding', 'docked'];
        }
        return ['following', 'defending', 'holding'];
    }

    /**
     * Set AI command
     */
    setCommand(state, target = null) {
        const available = this.getAvailableStates();
        if (!available.includes(state)) {
            state = 'following'; // Fallback for ships without captain
        }

        this.aiState = state;
        this.commandTarget = target;

        if (state === 'attacking' && target) {
            this.engagedTarget = target;
            this.target = target;
        }
        if (state === 'mining' && target) {
            this.miningTarget = target;
        }
        if (state === 'holding') {
            this.holdPosition = true;
            this.holdX = this.x;
            this.holdY = this.y;
        } else {
            this.holdPosition = false;
        }
    }

    /**
     * Update fleet ship AI
     */
    update(dt) {
        if (!this.alive) return;

        super.update(dt);

        // AI is handled by FleetSystem.update() at throttled rate
    }

    /**
     * AI tick - called by FleetSystem at 0.5s intervals
     */
    aiUpdate(dt) {
        if (!this.alive || this.aiState === 'docked') return;

        // Check for threats (always, regardless of state) - but only if aggressive stance
        if (this.stance === 'aggressive') {
            this.checkThreats();
        }

        switch (this.aiState) {
            case 'following':
                this.aiFollow();
                break;
            case 'orbiting':
                this.aiOrbit();
                break;
            case 'mining':
                this.aiMine();
                break;
            case 'attacking':
                this.aiAttack();
                break;
            case 'defending':
                this.aiDefend();
                break;
            case 'holding':
                this.aiHold();
                break;
        }

        // Auto-cargo transfer to player when mining cargo is nearly full
        this.cargoTransferTimer += dt;
        if (this.cargoTransferTimer >= this.cargoTransferInterval) {
            this.cargoTransferTimer = 0;
            this.checkAutoCargoTransfer();
        }
    }

    /**
     * Check for nearby threats and auto-defend
     */
    checkThreats() {
        // Check if hull is critical - flee
        const hullPercent = this.hull / this.maxHull;
        if (hullPercent <= this.fleeThreshold) {
            this.aiState = 'following'; // Flee to player
            this.engagedTarget = null;
            this.target = null;
            return;
        }

        // If already attacking, don't switch
        if (this.aiState === 'attacking' && this.engagedTarget?.alive) return;

        // Look for hostile entities attacking us or the player
        const entities = this.game.getEntities();
        for (const entity of entities) {
            if (!entity.alive) continue;
            if (entity.hostility !== 'hostile' && entity.type !== 'enemy') continue;

            const dist = this.distanceTo(entity);
            if (dist < this.aggroRange) {
                // Auto-defend: engage hostile in range
                if (this.aiState === 'defending' || this.aiState === 'following') {
                    this.engagedTarget = entity;
                    this.target = entity;
                    this.aiState = 'defending';
                    this.activateWeapons();
                    return;
                }
            }
        }
    }

    /**
     * Follow the player with offset
     */
    aiFollow() {
        const player = this.game.player;
        if (!player || !player.alive) {
            this.desiredSpeed = 0;
            return;
        }

        // Rotate follow offset by player heading for formation alignment
        const cos = Math.cos(player.rotation);
        const sin = Math.sin(player.rotation);
        const rotX = this.followOffset.x * cos - this.followOffset.y * sin;
        const rotY = this.followOffset.x * sin + this.followOffset.y * cos;
        const targetX = player.x + rotX;
        const targetY = player.y + rotY;
        const dist = wrappedDistance(this.x, this.y, targetX, targetY, CONFIG.SECTOR_SIZE);

        if (dist > this.followRange) {
            const angle = wrappedDirection(this.x, this.y, targetX, targetY, CONFIG.SECTOR_SIZE);
            this.desiredRotation = angle;
            // Speed up if far away
            this.desiredSpeed = dist > 1000 ? this.maxSpeed : this.maxSpeed * 0.7;
        } else {
            // Close enough, match player speed
            this.desiredSpeed = player.currentSpeed * 0.8;
            if (player.currentSpeed > 10) {
                this.desiredRotation = player.rotation;
            }
        }
    }

    /**
     * Orbit a target
     */
    aiOrbit() {
        if (!this.commandTarget || !this.commandTarget.alive) {
            this.aiState = 'following';
            return;
        }

        const dist = wrappedDistance(this.x, this.y, this.commandTarget.x, this.commandTarget.y, CONFIG.SECTOR_SIZE);
        const orbitDist = 500 + (this.commandTarget.radius || 0);

        if (Math.abs(dist - orbitDist) > 200) {
            // Approach/retreat to orbit distance
            const angle = wrappedDirection(this.x, this.y, this.commandTarget.x, this.commandTarget.y, CONFIG.SECTOR_SIZE);
            this.desiredRotation = dist > orbitDist ? angle : angle + Math.PI;
            this.desiredSpeed = this.maxSpeed * 0.6;
        } else {
            // Orbit
            const currentAngle = wrappedDirection(this.commandTarget.x, this.commandTarget.y, this.x, this.y, CONFIG.SECTOR_SIZE);
            const tangent = currentAngle + Math.PI / 2;
            this.desiredRotation = tangent;
            this.desiredSpeed = this.maxSpeed * 0.5;
        }
    }

    /**
     * Mine a target asteroid
     */
    aiMine() {
        if (!this.hasCaptain()) {
            this.aiState = 'following';
            return;
        }

        // Find mining target if we don't have one
        if (!this.miningTarget || !this.miningTarget.alive) {
            this.miningTarget = this.findNearestAsteroid();
            if (!this.miningTarget) {
                this.aiState = 'following';
                return;
            }
        }

        // Check cargo
        if (this.cargoUsed >= this.cargoCapacity * 0.95) {
            // Cargo full, return to player
            this.aiState = 'following';
            this.miningTarget = null;
            this.deactivateAllModules();
            return;
        }

        const dist = this.distanceTo(this.miningTarget);

        if (dist > 250) {
            // Approach asteroid
            const angle = this.directionTo(this.miningTarget);
            this.desiredRotation = angle;
            this.desiredSpeed = this.maxSpeed * 0.7;
            this.deactivateAllModules();
        } else {
            // In range, mine
            this.desiredSpeed = 0;
            this.target = this.miningTarget;

            // Activate mining lasers
            for (let i = 0; i < this.highSlots; i++) {
                const slotId = `high-${i + 1}`;
                const moduleId = this.modules.high[i];
                if (moduleId && (moduleId.includes('mining') || moduleId.includes('miner'))) {
                    if (!this.activeModules.has(slotId)) {
                        this.activateModule(slotId);
                    }
                }
            }
        }
    }

    /**
     * Attack a target
     */
    aiAttack() {
        if (!this.hasCaptain()) {
            this.aiState = 'following';
            return;
        }

        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.engagedTarget = null;
            this.target = null;
            this.aiState = 'following';
            this.deactivateAllModules();
            return;
        }

        this.target = this.engagedTarget;
        const dist = this.distanceTo(this.engagedTarget);

        if (dist > this.attackRange) {
            // Approach target
            const angle = this.directionTo(this.engagedTarget);
            this.desiredRotation = angle;
            this.desiredSpeed = this.maxSpeed;
        } else {
            // In range, orbit and fire
            const currentAngle = wrappedDirection(
                this.engagedTarget.x, this.engagedTarget.y,
                this.x, this.y, CONFIG.SECTOR_SIZE
            );
            const tangent = currentAngle + Math.PI / 2;
            this.desiredRotation = tangent;
            this.desiredSpeed = this.maxSpeed * 0.6;

            this.activateWeapons();
        }
    }

    /**
     * Defend (shoot back at attackers)
     */
    aiDefend() {
        if (this.engagedTarget && this.engagedTarget.alive) {
            this.target = this.engagedTarget;
            const dist = this.distanceTo(this.engagedTarget);

            if (dist > this.attackRange * 1.5) {
                // Too far, drop engagement and follow
                this.engagedTarget = null;
                this.target = null;
                this.aiState = 'following';
                this.deactivateAllModules();
                return;
            }

            if (dist > this.attackRange) {
                // Approach to firing range
                const angle = this.directionTo(this.engagedTarget);
                this.desiredRotation = angle;
                this.desiredSpeed = this.maxSpeed * 0.8;
            } else {
                // In range, orbit and fire
                const currentAngle = wrappedDirection(
                    this.engagedTarget.x, this.engagedTarget.y,
                    this.x, this.y, CONFIG.SECTOR_SIZE
                );
                const tangent = currentAngle + Math.PI / 2;
                this.desiredRotation = tangent;
                this.desiredSpeed = this.maxSpeed * 0.5;
                this.activateWeapons();
            }
        } else {
            // No target, return to following
            this.engagedTarget = null;
            this.target = null;
            this.aiState = 'following';
            this.deactivateAllModules();
        }
    }

    /**
     * Hold position - stay at fixed coordinates and defend if attacked
     */
    aiHold() {
        const dist = wrappedDistance(this.x, this.y, this.holdX, this.holdY, CONFIG.SECTOR_SIZE);

        if (dist > 50) {
            // Return to hold position
            const angle = wrappedDirection(this.x, this.y, this.holdX, this.holdY, CONFIG.SECTOR_SIZE);
            this.desiredRotation = angle;
            this.desiredSpeed = this.maxSpeed * 0.5;
        } else {
            this.desiredSpeed = 0;
        }

        // Still defend if something attacks us (even in hold)
        if (this.engagedTarget && this.engagedTarget.alive) {
            this.target = this.engagedTarget;
            const eDist = this.distanceTo(this.engagedTarget);
            if (eDist <= this.attackRange) {
                this.activateWeapons();
            }
        }
    }

    /**
     * Auto-transfer cargo when cargo is nearly full.
     * Sells ore to faction treasury if player is far/docked; transfers to player if nearby.
     */
    checkAutoCargoTransfer() {
        if (this.aiState !== 'mining') return;
        if (this.cargoUsed < this.cargoCapacity * 0.85) return;

        const player = this.game.player;
        const CONFIG_REF = this.game.constructor.name === 'Game' ? null : null;

        // Calculate total ore value
        let totalValue = 0;
        let totalUnits = 0;
        for (const [ore, data] of Object.entries(this.cargo)) {
            if (!data || !data.units) continue;
            const oreConfig = CONFIG.ASTEROID_TYPES[ore];
            const pricePerUnit = oreConfig?.value || 10;
            totalValue += data.units * pricePerUnit;
            totalUnits += data.units;
        }

        if (totalUnits === 0) return;

        // Try to transfer to player if nearby
        if (player?.alive) {
            const dist = this.distanceTo(player);
            if (dist <= 1000) {
                let transferred = 0;
                for (const [ore, data] of Object.entries(this.cargo)) {
                    if (!data || !data.units) continue;
                    const units = data.units;
                    const vol = data.volume || units;
                    if (player.cargoUsed + vol <= player.cargoCapacity) {
                        if (!player.cargo[ore]) player.cargo[ore] = { units: 0, volume: 0 };
                        player.cargo[ore].units += units;
                        player.cargo[ore].volume += vol;
                        player.cargoUsed += vol;
                        transferred += units;
                    }
                }
                if (transferred > 0) {
                    this.cargo = {};
                    this.cargoUsed = 0;
                    this.game.ui?.showToast(`${this.name} transferred ${transferred} ore`, 'success');
                    this.game.events.emit('fleet:cargo-transferred', { ship: this, units: transferred });
                    this.game.events.emit('cargo:updated', { ship: player });
                    return;
                }
            }
        }

        // Sell ore to faction treasury (remote sale at reduced rate)
        const saleRate = 0.8; // 80% of market value for remote fleet sales
        const saleValue = Math.round(totalValue * saleRate);
        this.game.addFactionTreasury(saleValue);
        this.cargo = {};
        this.cargoUsed = 0;
        this.game.ui?.showToast(`${this.name} sold ${totalUnits} ore to ${this.game.faction?.name || 'faction'} (+${saleValue} ISK)`, 'success');
        this.game.events.emit('fleet:ore-sold', { ship: this, units: totalUnits, value: saleValue });
    }

    /**
     * Activate weapon modules
     */
    activateWeapons() {
        for (let i = 0; i < this.highSlots; i++) {
            const slotId = `high-${i + 1}`;
            const moduleId = this.modules.high[i];
            if (!moduleId) continue;

            // Only activate weapons (not mining lasers) for combat
            if (moduleId.includes('laser') && !moduleId.includes('mining')) {
                if (!this.activeModules.has(slotId) && !this.moduleCooldowns.has(slotId)) {
                    this.activateModule(slotId);
                }
            }
        }
    }

    /**
     * Deactivate all modules
     */
    deactivateAllModules() {
        for (const slotId of [...this.activeModules]) {
            this.deactivateModule(slotId);
        }
    }

    /**
     * Find nearest asteroid
     */
    findNearestAsteroid() {
        const entities = this.game.getEntities();
        let nearest = null;
        let nearestDist = Infinity;

        for (const entity of entities) {
            if (entity.type !== 'asteroid' || !entity.alive) continue;
            const dist = this.distanceTo(entity);
            if (dist < nearestDist) {
                nearest = entity;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    /**
     * Override destroy to handle fleet cleanup
     */
    destroy() {
        // Recall drones
        if (this.droneBay?.deployed?.size > 0) {
            for (const drone of this.droneBay.deployed.values()) {
                if (drone.alive) drone.alive = false;
            }
            this.droneBay.deployed.clear();
        }

        this.game.events.emit('fleet:ship-destroyed', this);
        super.destroy();
    }

    /**
     * Create mesh using ShipMeshFactory
     */
    createMesh() {
        const shipConfig = SHIP_DATABASE[this.shipClass] || {};

        // Use procedural mesh factory if available
        if (shipMeshFactory) {
            try {
                this.mesh = shipMeshFactory.generateShipMesh({
                    shipId: this.shipClass,
                    role: shipConfig.role || 'mercenary',
                    size: shipConfig.size || 'frigate',
                    detailLevel: 'low',
                });
            } catch (e) {
                this.mesh = this.createFallbackMesh();
            }
        } else {
            this.mesh = this.createFallbackMesh();
        }

        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 0);
            this.mesh.rotation.z = this.rotation;

            // Add weapon turrets
            this.addTurretHardpoints();
        }
        return this.mesh;
    }

    /**
     * Fallback mesh if factory unavailable
     */
    createFallbackMesh() {
        const group = new THREE.Group();
        const size = this.radius;

        const shape = new THREE.Shape();
        shape.moveTo(size, 0);
        shape.lineTo(-size * 0.7, size * 0.5);
        shape.lineTo(-size * 0.5, 0);
        shape.lineTo(-size * 0.7, -size * 0.5);
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.min(size * 0.1, 6), bevelEnabled: true, bevelThickness: Math.min(size * 0.02, 1.5), bevelSize: Math.min(size * 0.015, 1), bevelSegments: 1 });
        geometry.center();
        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.friendly,
            emissive: CONFIG.COLORS.friendly,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.9,
            roughness: 0.5,
            metalness: 0.3,
        });

        const hull = new THREE.Mesh(geometry, material);
        group.add(hull);

        // Friendly indicator ring
        const ringGeo = new THREE.RingGeometry(size * 1.2, size * 1.3, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS.friendly,
            transparent: true,
            opacity: 0.2,
        });
        group.add(new THREE.Mesh(ringGeo, ringMat));

        return group;
    }
}
