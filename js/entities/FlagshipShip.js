// =============================================
// Flagship Ship Class
// Capital-class command vessel with hangar bay,
// command aura, and fleet coordination AI.
// Extends Ship (NOT FleetShip).
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { wrappedDistance, wrappedDirection } from '../utils/math.js';

let flagshipIdCounter = 0;

export class FlagshipShip extends Ship {
    constructor(game, options = {}) {
        const shipClass = options.shipClass || 'flagship-bc';
        const shipConfig = SHIP_DATABASE[shipClass] || {};

        super(game, {
            ...shipConfig,
            ...options,
            name: options.name || shipConfig.name || 'Flagship',
            color: options.factionColor || CONFIG.COLORS.friendly,
            highSlots: shipConfig.weaponSlots || shipConfig.highSlots || 4,
            midSlots: shipConfig.moduleSlots || shipConfig.midSlots || 4,
            lowSlots: shipConfig.subsystemSlots || shipConfig.lowSlots || 4,
        });

        this.type = 'fleet'; // Treated as fleet for rendering/targeting
        this.hostility = 'friendly';
        this.isPlayer = false;
        this.isFlagship = true;
        this.shipClass = shipClass;

        // Hangar bay - stores fleet ship data for docked ships
        this.hangarCapacity = shipConfig.hangarCapacity || 5;
        this.hangar = []; // [{fleetId, shipClass, name, pilot, modules, shield, armor, hull}]

        // Command range for aura effects (radius in world units)
        this.commandRange = shipConfig.commandRange || 2000;

        // Command aura bonuses (applied by FleetSystem to ships in range)
        this.commandAura = {
            shieldRegenBonus: 1.10,    // +10% shield regen to nearby fleet
            damageBonus: 1.05,         // +5% damage to nearby fleet
            speedBonus: 1.05,          // +5% speed to nearby fleet
        };

        // Fleet identity
        this.fleetId = options.fleetId || ++flagshipIdCounter;
        this.groupId = options.groupId || 0;
        this.pilot = options.pilot || null;

        // Stance: flagships are passive by default
        this.stance = options.stance || 'passive';

        // AI state - follows player but stays further back
        this.aiState = 'following';
        this.commandTarget = null;
        this.followRange = 600 + Math.random() * 200;
        this.followOffset = {
            x: -400 + (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 300,
        };
        this.desiredSpeed = 0;
        this.desiredRotation = 0;

        // Combat AI
        this.aggroRange = 2000;
        this.attackRange = 800;
        this.fleeThreshold = 0.10; // Flagships are more resilient, flee later
        this.engagedTarget = null;

        // Hold position state
        this.holdPosition = false;
        this.holdX = 0;
        this.holdY = 0;

        // Bounty/loot display values
        this.bounty = 0;
        this.lootValue = { min: 0, max: 0 };

        // Default flagship loadout
        this.setupFlagshipLoadout(shipConfig);

        // Apply pilot skills if assigned
        if (this.pilot) {
            this.applyPilotSkills();
        }
    }

    /**
     * Setup default module loadout for flagship based on class.
     * Flagships prioritize command burst modules and defense.
     */
    setupFlagshipLoadout(config) {
        const shipClass = this.shipClass;

        // All flagships get shield booster + armor repairer for self-sustain
        this.fitModule('mid-1', 'shield-booster');
        if (this.midSlots >= 2) this.fitModule('mid-2', 'shield-booster');

        this.fitModule('low-1', 'armor-repairer');
        if (this.lowSlots >= 2) this.fitModule('low-2', 'damage-mod');

        // Weapon loadout varies by class
        if (shipClass === 'flagship-carrier') {
            // Carrier: fewer weapons, relies on drones and hangared ships
            this.fitModule('high-1', 'medium-maser');
            if (this.highSlots >= 2) this.fitModule('high-2', 'medium-maser');
        } else {
            // Battlecruiser: moderate weapons
            this.fitModule('high-1', 'medium-maser');
            if (this.highSlots >= 2) this.fitModule('high-2', 'medium-maser');
            if (this.highSlots >= 3) this.fitModule('high-3', 'small-maser');
        }
    }

    /**
     * Apply pilot skill multipliers to ship stats
     */
    applyPilotSkills() {
        if (!this.pilot) return;

        const combatMult = 0.5 + (this.pilot.skills.combat / 100) * 1.0;
        const navMult = 0.5 + (this.pilot.skills.navigation / 100) * 1.0;

        this.maxSpeed = Math.round(this.maxSpeed * navMult);
        this.acceleration = Math.round(this.acceleration * navMult);
        this.turnSpeed *= navMult;

        // Store multiplier for combat system use
        this.pilotCombatMult = combatMult;
    }

    /**
     * Check if this ship has a capable pilot
     */
    hasCaptain() {
        return this.pilot !== null;
    }

    /**
     * Get available AI states
     */
    getAvailableStates() {
        if (this.hasCaptain()) {
            return ['following', 'holding', 'defending'];
        }
        return ['following', 'holding'];
    }

    /**
     * Set AI command
     */
    setCommand(state, target = null) {
        const available = this.getAvailableStates();
        if (!available.includes(state)) {
            state = 'following';
        }

        this.aiState = state;
        this.commandTarget = target;

        if (state === 'holding') {
            this.holdPosition = true;
            this.holdX = this.x;
            this.holdY = this.y;
        } else {
            this.holdPosition = false;
        }
    }

    // =========================================================================
    // Update Loop
    // =========================================================================

    /**
     * Update flagship state each frame
     */
    update(dt) {
        if (!this.alive) return;

        super.update(dt);

        // AI is handled by FleetSystem at throttled rate via aiUpdate()
    }

    /**
     * AI tick - called by FleetSystem at 0.5s intervals
     */
    aiUpdate(dt) {
        if (!this.alive) return;

        // Passive defense: if stance is aggressive, check threats
        if (this.stance === 'aggressive') {
            this.checkThreats();
        }

        switch (this.aiState) {
            case 'following':
                this.aiFollow();
                break;
            case 'holding':
                this.aiHold();
                break;
            case 'defending':
                this.aiDefend();
                break;
        }
    }

    /**
     * Check for nearby threats
     */
    checkThreats() {
        const hullPercent = this.hull / this.maxHull;
        if (hullPercent <= this.fleeThreshold) {
            this.aiState = 'following';
            this.engagedTarget = null;
            this.target = null;
            return;
        }

        if (this.aiState === 'defending' && this.engagedTarget?.alive) return;

        const entities = this.game.getEntities();
        for (const entity of entities) {
            if (!entity.alive) continue;
            if (entity.hostility !== 'hostile' && entity.type !== 'enemy') continue;

            const dist = this.distanceTo(entity);
            if (dist < this.aggroRange) {
                if (this.aiState === 'following') {
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
     * Follow the player - flagships are slower and stay further back
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
            // Flagships accelerate slower - cap at maxSpeed
            this.desiredSpeed = dist > 1500 ? this.maxSpeed : this.maxSpeed * 0.6;
        } else {
            // Close enough, match player speed at reduced rate
            this.desiredSpeed = player.currentSpeed * 0.5;
            if (player.currentSpeed > 10) {
                this.desiredRotation = player.rotation;
            }
        }
    }

    /**
     * Hold position
     */
    aiHold() {
        const dist = wrappedDistance(this.x, this.y, this.holdX, this.holdY, CONFIG.SECTOR_SIZE);

        if (dist > 80) {
            const angle = wrappedDirection(this.x, this.y, this.holdX, this.holdY, CONFIG.SECTOR_SIZE);
            this.desiredRotation = angle;
            this.desiredSpeed = this.maxSpeed * 0.4;
        } else {
            this.desiredSpeed = 0;
        }

        // Defend from hold position if attacked
        if (this.engagedTarget && this.engagedTarget.alive) {
            this.target = this.engagedTarget;
            const eDist = this.distanceTo(this.engagedTarget);
            if (eDist <= this.attackRange) {
                this.activateWeapons();
            }
        }
    }

    /**
     * Defend - engage threats that enter range
     */
    aiDefend() {
        if (this.engagedTarget && this.engagedTarget.alive) {
            this.target = this.engagedTarget;
            const dist = this.distanceTo(this.engagedTarget);

            if (dist > this.attackRange * 1.5) {
                // Target too far, disengage
                this.engagedTarget = null;
                this.target = null;
                this.aiState = 'following';
                this.deactivateAllModules();
                return;
            }

            if (dist <= this.attackRange) {
                // In range, fire (flagships don't chase - they hold ground)
                this.desiredSpeed = 0;
                this.desiredRotation = this.directionTo(this.engagedTarget);
                this.activateWeapons();
            } else {
                // Slowly approach
                const angle = this.directionTo(this.engagedTarget);
                this.desiredRotation = angle;
                this.desiredSpeed = this.maxSpeed * 0.3;
            }
        } else {
            this.engagedTarget = null;
            this.target = null;
            this.aiState = 'following';
            this.deactivateAllModules();
        }
    }

    /**
     * Activate weapon modules
     */
    activateWeapons() {
        for (let i = 0; i < this.highSlots; i++) {
            const slotId = `high-${i + 1}`;
            const moduleId = this.modules.high[i];
            if (!moduleId) continue;

            if (moduleId.includes('maser') || moduleId.includes('railgun') || moduleId.includes('missile') || moduleId.includes('torpedo') || (moduleId.includes('laser') && !moduleId.includes('mining'))) {
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

    // =========================================================================
    // Hangar Management
    // =========================================================================

    /**
     * Dock a fleet ship into the hangar bay.
     * Stores ship data and removes it from the sector.
     * @param {FleetShip} fleetShip
     * @returns {boolean} Success
     */
    dockShip(fleetShip) {
        if (this.hangar.length >= this.hangarCapacity) {
            this.game.ui?.showToast('Flagship hangar full', 'warning');
            return false;
        }

        if (!fleetShip || !fleetShip.alive) return false;

        // Store ship data
        const shipData = {
            fleetId: fleetShip.fleetId,
            shipClass: fleetShip.shipClass,
            name: fleetShip.name,
            pilot: fleetShip.pilot,
            modules: {
                high: [...fleetShip.modules.high],
                mid: [...fleetShip.modules.mid],
                low: [...fleetShip.modules.low],
            },
            shield: fleetShip.shield,
            armor: fleetShip.armor,
            hull: fleetShip.hull,
            cargo: { ...fleetShip.cargo },
            cargoUsed: fleetShip.cargoUsed,
            groupId: fleetShip.groupId,
            stance: fleetShip.stance,
        };

        this.hangar.push(shipData);

        // Remove the fleet ship from the sector
        fleetShip.alive = false;
        if (fleetShip.mesh) {
            fleetShip.mesh.visible = false;
        }

        this.game.events.emit('flagship:ship-docked', {
            flagship: this,
            shipData: shipData,
            hangarCount: this.hangar.length,
        });

        this.game.ui?.showToast(`${shipData.name} docked in flagship`, 'success');
        return true;
    }

    /**
     * Undock a fleet ship from the hangar.
     * Recreates a FleetShip from stored data and adds it to the sector.
     * @param {number} index - Hangar slot index
     * @returns {object|null} The recreated FleetShip or null
     */
    undockShip(index) {
        if (index < 0 || index >= this.hangar.length) return null;

        const shipData = this.hangar[index];
        this.hangar.splice(index, 1);

        // Emit event so FleetSystem can recreate the actual FleetShip entity
        this.game.events.emit('flagship:ship-undocked', {
            flagship: this,
            shipData: shipData,
            position: { x: this.x, y: this.y },
            hangarCount: this.hangar.length,
        });

        this.game.ui?.showToast(`${shipData.name} undocked from flagship`, 'info');
        return shipData;
    }

    /**
     * Get hangar contents for UI display.
     * @returns {Array} Array of ship data summaries
     */
    getHangarContents() {
        return this.hangar.map((ship, index) => ({
            index: index,
            fleetId: ship.fleetId,
            shipClass: ship.shipClass,
            name: ship.name,
            pilot: ship.pilot?.name || 'No pilot',
            hullPercent: ship.hull / ((SHIP_DATABASE[ship.shipClass]?.hull) || 100),
        }));
    }

    /**
     * Check if hangar has space
     */
    hasHangarSpace() {
        return this.hangar.length < this.hangarCapacity;
    }

    // =========================================================================
    // Command Aura
    // =========================================================================

    /**
     * Get command aura bonuses for a ship at the given distance.
     * Returns null if ship is out of range.
     * @param {number} distance
     * @returns {object|null}
     */
    getAuraBonuses(distance) {
        if (distance > this.commandRange) return null;

        // Aura strength falls off linearly with distance
        const falloff = 1.0 - (distance / this.commandRange) * 0.3;

        return {
            shieldRegenBonus: 1.0 + (this.commandAura.shieldRegenBonus - 1.0) * falloff,
            damageBonus: 1.0 + (this.commandAura.damageBonus - 1.0) * falloff,
            speedBonus: 1.0 + (this.commandAura.speedBonus - 1.0) * falloff,
        };
    }

    // =========================================================================
    // Destroy Override
    // =========================================================================

    /**
     * Override destroy to handle flagship-specific cleanup
     */
    destroy() {
        // Eject all hangared ships as wreckage data
        if (this.hangar.length > 0) {
            this.game.events.emit('flagship:destroyed', {
                flagship: this,
                hangar: [...this.hangar],
            });
            this.hangar = [];
        }

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

    // =========================================================================
    // Mesh Creation
    // =========================================================================

    /**
     * Create mesh using ShipMeshFactory.
     * Flagships are larger and include a command aura ring visual.
     */
    createMesh() {
        const shipConfig = SHIP_DATABASE[this.shipClass] || {};

        if (shipMeshFactory) {
            try {
                this.mesh = shipMeshFactory.generateShipMesh({
                    shipId: this.shipClass,
                    role: shipConfig.role || 'military',
                    size: shipConfig.size || 'battlecruiser',
                    detailLevel: 'medium',
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

            // Add command aura ring visual
            this.addCommandAuraRing();

            // Try async GLB load to replace procedural mesh
            this._tryLoadGLB(shipConfig.role || 'military', shipConfig.size || 'battlecruiser');
        }

        return this.mesh;
    }

    /** Attempt async GLB model swap */
    _tryLoadGLB(role, size) {
        if (!shipMeshFactory || !this.mesh) return;
        const targetSize = this.radius * 2.5;
        shipMeshFactory.loadModelForRole(role, size, targetSize).then(glbGroup => {
            if (!glbGroup || !this.alive || !this.mesh) return;
            // Collect aura ring children to preserve
            const preserved = [];
            for (const child of this.mesh.children) {
                if (child.name === 'commandAura' || child.name === 'commandAuraPulse') {
                    preserved.push(child);
                }
            }
            // Remove all children
            while (this.mesh.children.length > 0) {
                const child = this.mesh.children[0];
                this.mesh.remove(child);
                if (!preserved.includes(child)) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                }
            }
            this.mesh.add(glbGroup);
            // Re-add preserved aura rings
            for (const ring of preserved) this.mesh.add(ring);
            this.mesh.scale.set(1, 1, 1);
            this.glbLoaded = true;
        });
    }

    /**
     * Add a translucent command aura ring around the flagship
     */
    addCommandAuraRing() {
        if (!this.mesh) return;

        // Scale the visual ring relative to ship radius
        // Actual command range is in world units and much larger,
        // so we show a small indicator ring for visual clarity
        const ringRadius = this.radius * 2.5;
        const ringGeo = new THREE.RingGeometry(ringRadius * 0.95, ringRadius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
        });

        const auraRing = new THREE.Mesh(ringGeo, ringMat);
        auraRing.name = 'commandAura';
        this.mesh.add(auraRing);

        // Inner pulsing ring
        const innerRingGeo = new THREE.RingGeometry(ringRadius * 0.90, ringRadius * 0.93, 32);
        const innerRingMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.25,
        });

        const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
        innerRing.name = 'commandAuraInner';
        this.mesh.add(innerRing);
    }

    /**
     * Fallback mesh if ShipMeshFactory is unavailable
     */
    createFallbackMesh() {
        const group = new THREE.Group();
        const size = this.radius;

        // Flagship hull shape - wider, more imposing than fleet ships
        const shape = new THREE.Shape();
        shape.moveTo(size * 1.2, 0);
        shape.lineTo(size * 0.4, size * 0.6);
        shape.lineTo(-size * 0.8, size * 0.7);
        shape.lineTo(-size, size * 0.3);
        shape.lineTo(-size * 0.9, 0);
        shape.lineTo(-size, -size * 0.3);
        shape.lineTo(-size * 0.8, -size * 0.7);
        shape.lineTo(size * 0.4, -size * 0.6);
        shape.closePath();

        const extrudeDepth = Math.min(size * 0.15, 8);
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: extrudeDepth,
            bevelEnabled: true,
            bevelThickness: Math.min(size * 0.03, 2),
            bevelSize: Math.min(size * 0.02, 1.5),
            bevelSegments: 2,
        });
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
            color: CONFIG.COLORS.friendly,
            emissive: CONFIG.COLORS.friendly,
            emissiveIntensity: 0.20,
            transparent: true,
            opacity: 0.95,
            roughness: 0.4,
            metalness: 0.5,
        });

        const hull = new THREE.Mesh(geometry, material);
        group.add(hull);

        // Flagship indicator ring (larger, brighter than fleet ships)
        const ringGeo = new THREE.RingGeometry(size * 1.4, size * 1.55, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.3,
        });
        group.add(new THREE.Mesh(ringGeo, ringMat));

        // Bridge section (command superstructure)
        const bridgeGeo = new THREE.BoxGeometry(size * 0.3, size * 0.2, extrudeDepth * 1.5);
        const bridgeMat = new THREE.MeshStandardMaterial({
            color: 0x88bbff,
            emissive: 0x4488cc,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9,
        });
        const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
        bridge.position.set(size * 0.2, 0, extrudeDepth * 0.5);
        group.add(bridge);

        return group;
    }
}
