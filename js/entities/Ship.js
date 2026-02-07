// =============================================
// Ship Base Class
// For all spacecraft (player and NPC)
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { Vector2, lerp, angleDifference, normalizeAngle } from '../utils/math.js';

export class Ship extends Entity {
    constructor(game, options = {}) {
        super(game, options);

        this.type = 'ship';

        // Ship stats
        this.maxSpeed = options.maxSpeed || 200;
        this.acceleration = options.acceleration || 50;
        this.turnSpeed = options.turnSpeed || 2;

        // Health pools
        this.maxShield = options.shield || 100;
        this.maxArmor = options.armor || 50;
        this.maxHull = options.hull || 100;
        this.shield = this.maxShield;
        this.armor = this.maxArmor;
        this.hull = this.maxHull;

        // Capacitor (energy)
        this.maxCapacitor = options.capacitor || 100;
        this.capacitorRegen = options.capacitorRegen || 5;
        this.capacitor = this.maxCapacitor;

        // Signature (for locking)
        this.signatureRadius = options.signatureRadius || 30;

        // Module slots
        this.highSlots = options.highSlots || 3;
        this.midSlots = options.midSlots || 2;
        this.lowSlots = options.lowSlots || 2;
        this.modules = {
            high: new Array(this.highSlots).fill(null),
            mid: new Array(this.midSlots).fill(null),
            low: new Array(this.lowSlots).fill(null),
        };
        this.activeModules = new Set();

        // Cargo (ore storage)
        this.cargoCapacity = options.cargoCapacity || 100;
        this.cargo = {}; // { oreType: { units: number, volume: number } }
        this.cargoUsed = 0;

        // Current target
        this.target = null;

        // Movement state
        this.desiredSpeed = 0;
        this.currentSpeed = 0;
        this.desiredRotation = this.rotation;

        // Timers for module cooldowns
        this.moduleCooldowns = new Map();

        // Ship class name
        this.shipClass = options.shipClass || 'frigate';

        // Drone bay
        this.droneBay = {
            capacity: options.droneCapacity || 0,
            bandwidth: options.droneBandwidth || 0,
            drones: [],           // Stored drones: [{type: 'mining-drone', hp: 50}, ...]
            deployed: new Map(),  // droneId -> Drone entity
        };

        // Initialize with mining drones if capacity > 0
        if (this.droneBay.capacity > 0) {
            for (let i = 0; i < this.droneBay.capacity; i++) {
                this.droneBay.drones.push({
                    type: 'mining-drone',
                    hp: CONFIG.DRONES['mining-drone']?.hp || 50,
                });
            }
        }

        // Current drone command
        this.droneCommand = 'idle';
    }

    /**
     * Update ship state
     */
    update(dt) {
        if (!this.alive) return;

        // Regenerate capacitor
        this.capacitor = Math.min(this.maxCapacitor, this.capacitor + this.capacitorRegen * dt);

        // Regenerate shield (passive)
        if (this.shield < this.maxShield) {
            this.shield = Math.min(this.maxShield, this.shield + 1 * dt);
        }

        // Update module cooldowns
        this.updateModuleCooldowns(dt);

        // Update active modules
        this.updateActiveModules(dt);

        // Update rotation towards desired
        this.updateRotation(dt);

        // Update velocity based on desired speed
        this.updateVelocity(dt);

        // Call parent update for position
        super.update(dt);
    }

    /**
     * Update rotation towards desired angle
     */
    updateRotation(dt) {
        const diff = angleDifference(this.rotation, this.desiredRotation);
        const maxTurn = this.turnSpeed * dt;

        if (Math.abs(diff) < maxTurn) {
            this.rotation = this.desiredRotation;
        } else {
            this.rotation += Math.sign(diff) * maxTurn;
        }

        this.rotation = normalizeAngle(this.rotation);
    }

    /**
     * Update velocity towards desired speed
     */
    updateVelocity(dt) {
        // Calculate effective max speed (with afterburner)
        let effectiveMaxSpeed = this.maxSpeed;
        if (this.isModuleActive('afterburner')) {
            effectiveMaxSpeed *= CONFIG.MODULES['afterburner'].speedBonus;
        }

        // Accelerate/decelerate towards desired speed
        const targetSpeed = Math.min(this.desiredSpeed, effectiveMaxSpeed);

        if (this.currentSpeed < targetSpeed) {
            this.currentSpeed = Math.min(targetSpeed, this.currentSpeed + this.acceleration * dt);
        } else if (this.currentSpeed > targetSpeed) {
            this.currentSpeed = Math.max(targetSpeed, this.currentSpeed - this.acceleration * 2 * dt);
        }

        // Apply speed in direction of rotation
        this.velocity.x = Math.cos(this.rotation) * this.currentSpeed;
        this.velocity.y = Math.sin(this.rotation) * this.currentSpeed;
    }

    /**
     * Update module cooldowns
     */
    updateModuleCooldowns(dt) {
        for (const [moduleId, cooldown] of this.moduleCooldowns) {
            const newCooldown = cooldown - dt;
            if (newCooldown <= 0) {
                this.moduleCooldowns.delete(moduleId);
            } else {
                this.moduleCooldowns.set(moduleId, newCooldown);
            }
        }
    }

    /**
     * Update active modules (consume capacitor, apply effects)
     */
    updateActiveModules(dt) {
        for (const slotId of this.activeModules) {
            const [slotType, slotIndex] = this.parseSlotId(slotId);
            const moduleId = this.modules[slotType][slotIndex];

            if (!moduleId) continue;

            const moduleConfig = CONFIG.MODULES[moduleId];
            if (!moduleConfig) continue;

            // Continuous capacitor drain (for afterburner, etc.)
            if (moduleConfig.capacitorUse && !moduleConfig.cycleTime) {
                if (!this.useCapacitor(moduleConfig.capacitorUse * dt)) {
                    this.deactivateModule(slotId);
                }
            }
        }
    }

    /**
     * Fit a module to a slot
     */
    fitModule(slotId, moduleId) {
        const [slotType, slotIndex] = this.parseSlotId(slotId);
        const moduleConfig = CONFIG.MODULES[moduleId];

        if (!moduleConfig) {
            console.warn(`Unknown module: ${moduleId}`);
            return false;
        }

        if (moduleConfig.slot !== slotType) {
            console.warn(`Module ${moduleId} cannot fit in ${slotType} slot`);
            return false;
        }

        if (slotIndex >= this.modules[slotType].length) {
            console.warn(`Invalid slot index: ${slotIndex}`);
            return false;
        }

        this.modules[slotType][slotIndex] = moduleId;
        return true;
    }

    /**
     * Remove a module from a slot
     */
    unfitModule(slotId) {
        const [slotType, slotIndex] = this.parseSlotId(slotId);
        const moduleId = this.modules[slotType][slotIndex];
        this.modules[slotType][slotIndex] = null;
        this.activeModules.delete(slotId);
        return moduleId;
    }

    /**
     * Parse slot ID like "high-1" into ["high", 0]
     */
    parseSlotId(slotId) {
        const parts = slotId.split('-');
        return [parts[0], parseInt(parts[1]) - 1];
    }

    /**
     * Toggle module activation
     */
    toggleModule(index) {
        // Determine which slot
        let slotId;
        if (index < this.highSlots) {
            slotId = `high-${index + 1}`;
        } else if (index < this.highSlots + this.midSlots) {
            slotId = `mid-${index - this.highSlots + 1}`;
        } else {
            slotId = `low-${index - this.highSlots - this.midSlots + 1}`;
        }

        if (this.activeModules.has(slotId)) {
            this.deactivateModule(slotId);
        } else {
            this.activateModule(slotId);
        }
    }

    /**
     * Activate a module
     */
    activateModule(slotId) {
        const [slotType, slotIndex] = this.parseSlotId(slotId);
        const moduleId = this.modules[slotType][slotIndex];

        if (!moduleId) return false;

        const moduleConfig = CONFIG.MODULES[moduleId];
        if (!moduleConfig) return false;

        // Check cooldown
        if (this.moduleCooldowns.has(slotId)) return false;

        // Check capacitor for cycle-based modules
        if (moduleConfig.cycleTime && moduleConfig.capacitorUse) {
            if (this.capacitor < moduleConfig.capacitorUse) {
                if (this.isPlayer) this.game.ui?.log('Not enough capacitor', 'system');
                return false;
            }
        }

        // Weapons need a locked target
        if (moduleConfig.damage && !this.target) {
            if (this.isPlayer) this.game.ui?.log('No target locked', 'system');
            return false;
        }

        // Mining laser needs target
        if (moduleConfig.miningYield && !this.target) {
            if (this.isPlayer) this.game.ui?.log('No target locked', 'system');
            return false;
        }

        this.activeModules.add(slotId);
        if (this.isPlayer) this.game.audio?.play('module-activate');

        // For cycle-based modules, trigger the effect immediately
        if (moduleConfig.cycleTime) {
            this.triggerModuleEffect(slotId, moduleConfig);
        }

        this.game.events.emit('module:activated', { ship: this, slotId, moduleId });
        return true;
    }

    /**
     * Deactivate a module
     */
    deactivateModule(slotId) {
        if (!this.activeModules.has(slotId)) return false;

        this.activeModules.delete(slotId);
        if (this.isPlayer) this.game.audio?.play('module-deactivate');

        const [slotType, slotIndex] = this.parseSlotId(slotId);
        const moduleId = this.modules[slotType][slotIndex];

        this.game.events.emit('module:deactivated', { ship: this, slotId, moduleId });
        return true;
    }

    /**
     * Check if a module is active
     */
    isModuleActive(moduleId) {
        for (const slotId of this.activeModules) {
            const [slotType, slotIndex] = this.parseSlotId(slotId);
            if (this.modules[slotType][slotIndex] === moduleId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Trigger a module's effect (weapons, repair, etc.)
     */
    triggerModuleEffect(slotId, moduleConfig) {
        // Use capacitor
        if (!this.useCapacitor(moduleConfig.capacitorUse)) {
            this.deactivateModule(slotId);
            return;
        }

        // Set cooldown
        this.moduleCooldowns.set(slotId, moduleConfig.cycleTime);

        // Apply effect based on module type
        if (moduleConfig.damage) {
            this.fireWeapon(slotId, moduleConfig);
        } else if (moduleConfig.miningYield) {
            this.mineTarget(slotId, moduleConfig);
        } else if (moduleConfig.shieldRepair) {
            this.repairShield(moduleConfig.shieldRepair);
        } else if (moduleConfig.armorRepair) {
            this.repairArmor(moduleConfig.armorRepair);
        }

        // Schedule next cycle if still active
        if (this.activeModules.has(slotId) && this.alive) {
            setTimeout(() => {
                if (this.activeModules.has(slotId) && this.alive) {
                    this.triggerModuleEffect(slotId, moduleConfig);
                }
            }, moduleConfig.cycleTime * 1000);
        }
    }

    /**
     * Fire a weapon at current target
     */
    fireWeapon(slotId, moduleConfig) {
        if (!this.target || !this.target.alive) {
            this.deactivateModule(slotId);
            return;
        }

        // Check range
        const dist = this.distanceTo(this.target);
        if (dist > moduleConfig.range) {
            if (this.isPlayer) this.game.ui?.log('Target out of range', 'system');
            return;
        }

        // Calculate damage with bonuses
        let damage = moduleConfig.damage;

        // Apply damage mod bonus
        for (let i = 0; i < this.lowSlots; i++) {
            const mod = this.modules.low[i];
            if (mod && CONFIG.MODULES[mod]?.damageBonus) {
                damage *= CONFIG.MODULES[mod].damageBonus;
            }
        }

        // Fire!
        this.game.combat.fireAt(this, this.target, damage, moduleConfig.range);
        if (this.isPlayer) this.game.audio?.play('laser');
    }

    /**
     * Mine a target asteroid
     */
    mineTarget(slotId, moduleConfig) {
        if (!this.target || !this.target.alive || this.target.type !== 'asteroid') {
            this.deactivateModule(slotId);
            return;
        }

        // Check range
        const dist = this.distanceTo(this.target);
        if (dist > moduleConfig.range) {
            if (this.isPlayer) this.game.ui?.log('Target out of range', 'system');
            return;
        }

        // Mine!
        this.game.mining.mineAsteroid(this, this.target, moduleConfig.miningYield);
    }

    /**
     * Repair shield
     */
    repairShield(amount) {
        this.shield = Math.min(this.maxShield, this.shield + amount);
    }

    /**
     * Repair armor
     */
    repairArmor(amount) {
        this.armor = Math.min(this.maxArmor, this.armor + amount);
    }

    /**
     * Use capacitor energy
     */
    useCapacitor(amount) {
        if (this.capacitor >= amount) {
            this.capacitor -= amount;
            return true;
        }
        return false;
    }

    /**
     * Take damage
     */
    takeDamage(amount, source) {
        let remaining = amount;

        // Damage shield first
        if (this.shield > 0) {
            const shieldDamage = Math.min(this.shield, remaining);
            this.shield -= shieldDamage;
            remaining -= shieldDamage;
            this.addEffect('shield-hit', 0.2);
        }

        // Then armor
        if (remaining > 0 && this.armor > 0) {
            const armorDamage = Math.min(this.armor, remaining);
            this.armor -= armorDamage;
            remaining -= armorDamage;
            this.addEffect('armor-hit', 0.2);
        }

        // Finally hull
        if (remaining > 0) {
            this.hull -= remaining;
            this.addEffect('hull-hit', 0.3);

            if (this.hull <= 0) {
                this.destroy();
            }
        }

        this.game.events.emit('combat:hit', { target: this, damage: amount, source });
    }

    /**
     * Set movement target (approach a point)
     */
    setDestination(x, y) {
        this.desiredRotation = Math.atan2(y - this.y, x - this.x);
        this.desiredSpeed = this.maxSpeed;
    }

    /**
     * Stop the ship
     */
    stop() {
        this.desiredSpeed = 0;
    }

    /**
     * Get speed as percentage of max
     */
    getSpeedPercent() {
        return (this.currentSpeed / this.maxSpeed) * 100;
    }

    /**
     * Get health percentages
     */
    getHealthPercents() {
        return {
            shield: (this.shield / this.maxShield) * 100,
            armor: (this.armor / this.maxArmor) * 100,
            hull: (this.hull / this.maxHull) * 100,
            capacitor: (this.capacitor / this.maxCapacitor) * 100,
        };
    }

    /**
     * Add ore to cargo
     * @param {string} oreType - Type of ore (e.g., 'veldspar')
     * @param {number} units - Number of ore units
     * @param {number} volume - Total volume of ore in m³
     * @returns {number} Number of units actually added (may be less if cargo full)
     */
    addOre(oreType, units, volume) {
        const volumePerUnit = volume / units;
        const availableSpace = this.cargoCapacity - this.cargoUsed;
        const maxUnits = Math.floor(availableSpace / volumePerUnit);
        const unitsToAdd = Math.min(units, maxUnits);

        if (unitsToAdd <= 0) return 0;

        const volumeToAdd = unitsToAdd * volumePerUnit;

        // Initialize ore type in cargo if not present
        if (!this.cargo[oreType]) {
            this.cargo[oreType] = { units: 0, volume: 0 };
        }

        this.cargo[oreType].units += unitsToAdd;
        this.cargo[oreType].volume += volumeToAdd;
        this.cargoUsed += volumeToAdd;

        this.game.events.emit('cargo:updated', { ship: this });
        return unitsToAdd;
    }

    /**
     * Remove ore from cargo
     * @param {string} oreType - Type of ore
     * @param {number} units - Number of units to remove
     * @returns {number} Number of units actually removed
     */
    removeOre(oreType, units) {
        if (!this.cargo[oreType]) return 0;

        const oreData = this.cargo[oreType];
        const unitsToRemove = Math.min(units, oreData.units);
        const volumePerUnit = oreData.volume / oreData.units;
        const volumeToRemove = unitsToRemove * volumePerUnit;

        oreData.units -= unitsToRemove;
        oreData.volume -= volumeToRemove;
        this.cargoUsed -= volumeToRemove;

        // Clean up empty ore types
        if (oreData.units <= 0) {
            delete this.cargo[oreType];
        }

        this.game.events.emit('cargo:updated', { ship: this });
        return unitsToRemove;
    }

    /**
     * Get quantity of specific ore type in cargo
     * @param {string} oreType - Type of ore
     * @returns {number} Number of units of that ore type
     */
    getOreQuantity(oreType) {
        return this.cargo[oreType]?.units || 0;
    }

    /**
     * Get available cargo space in m³
     */
    getCargoSpace() {
        return this.cargoCapacity - this.cargoUsed;
    }

    /**
     * Get cargo contents for display
     * @returns {Array} Array of { type, name, units, volume, value } objects
     */
    getCargoContents() {
        const contents = [];
        for (const [oreType, data] of Object.entries(this.cargo)) {
            const typeConfig = CONFIG.ASTEROID_TYPES[oreType];
            contents.push({
                type: oreType,
                name: typeConfig?.name || oreType,
                units: data.units,
                volume: data.volume,
                value: data.units * (typeConfig?.value || 0),
            });
        }
        return contents;
    }

    /**
     * Get total value of all cargo
     */
    getCargoValue() {
        let totalValue = 0;
        for (const [oreType, data] of Object.entries(this.cargo)) {
            const typeConfig = CONFIG.ASTEROID_TYPES[oreType];
            totalValue += data.units * (typeConfig?.value || 0);
        }
        return totalValue;
    }

    /**
     * Clear all cargo (e.g., when selling at station)
     * @returns {number} Total value of cargo cleared
     */
    clearCargo() {
        const value = this.getCargoValue();
        this.cargo = {};
        this.cargoUsed = 0;
        this.game.events.emit('cargo:updated', { ship: this });
        return value;
    }

    // =============================================
    // Drone Management
    // =============================================

    /**
     * Launch a single drone from the bay
     */
    launchDrone(index) {
        if (!this.droneBay || index >= this.droneBay.drones.length) return null;

        const droneData = this.droneBay.drones[index];
        if (!droneData) return null;

        // Check if already deployed
        if (this.droneBay.deployed.has(index)) {
            return null;
        }

        // Import Drone dynamically to avoid circular dependency
        import('./Drone.js').then(({ Drone }) => {
            const droneConfig = CONFIG.DRONES[droneData.type];
            if (!droneConfig) return;

            const drone = new Drone(this.game, {
                x: this.x + (Math.random() - 0.5) * 50,
                y: this.y + (Math.random() - 0.5) * 50,
                owner: this,
                droneType: droneData.type,
                droneIndex: index,
                hp: droneData.hp,
            });

            this.game.currentSector?.addEntity(drone);
            this.droneBay.deployed.set(index, drone);
            if (this.isPlayer) this.game.ui?.log(`Launched ${droneConfig.name}`, 'system');
        });
    }

    /**
     * Launch all drones in the bay
     */
    launchAllDrones() {
        if (!this.droneBay) return;

        for (let i = 0; i < this.droneBay.drones.length; i++) {
            if (this.droneBay.drones[i] && !this.droneBay.deployed.has(i)) {
                this.launchDrone(i);
            }
        }
    }

    /**
     * Recall a single drone back to the bay
     */
    recallDrone(droneEntity) {
        if (!this.droneBay || !droneEntity) return;

        const index = droneEntity.droneIndex;
        if (this.droneBay.deployed.has(index)) {
            // Store current HP back to bay
            this.droneBay.drones[index].hp = droneEntity.hp;
            this.droneBay.deployed.delete(index);

            // Remove from sector
            droneEntity.destroy();
            if (this.isPlayer) this.game.ui?.log(`Recalled ${droneEntity.name}`, 'system');
        }
    }

    /**
     * Recall all deployed drones
     */
    recallAllDrones() {
        if (!this.droneBay) return;

        const toRecall = [...this.droneBay.deployed.values()];
        for (const drone of toRecall) {
            this.recallDrone(drone);
        }
        this.droneCommand = 'idle';
    }

    /**
     * Send a command to all deployed drones
     */
    commandDrones(command, target = null) {
        if (!this.droneBay) return;

        this.droneCommand = command;

        for (const drone of this.droneBay.deployed.values()) {
            drone.setCommand(command, target);
        }

        const commandNames = {
            'idle': 'Idle',
            'orbit': 'Orbiting',
            'attack': 'Attacking',
            'mine': 'Mining',
            'return': 'Returning'
        };
        if (this.isPlayer) this.game.ui?.log(`Drones: ${commandNames[command] || command}`, 'system');

        // If return command, recall when they get close
        if (command === 'return') {
            this.droneCommand = 'return';
        }
    }

    /**
     * Get count of deployed drones
     */
    getDeployedDroneCount() {
        return this.droneBay?.deployed?.size || 0;
    }

    /**
     * Get list of drones in bay (not deployed)
     */
    getDronesInBay() {
        if (!this.droneBay) return [];

        return this.droneBay.drones.map((drone, index) => ({
            ...drone,
            index,
            deployed: this.droneBay.deployed.has(index),
            config: CONFIG.DRONES[drone?.type],
        })).filter(d => d.type);
    }

    /**
     * Create ship mesh
     */
    createMesh() {
        // Ship body - triangle shape
        const shape = new THREE.Shape();
        const size = this.radius;

        shape.moveTo(size, 0);
        shape.lineTo(-size * 0.7, size * 0.5);
        shape.lineTo(-size * 0.5, 0);
        shape.lineTo(-size * 0.7, -size * 0.5);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;

        return this.mesh;
    }
}
