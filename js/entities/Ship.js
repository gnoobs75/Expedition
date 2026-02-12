// =============================================
// Ship Base Class
// For all spacecraft (player and NPC)
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { Vector2, lerp, angleDifference, normalizeAngle } from '../utils/math.js';

/**
 * Look up module config from new equipment database or legacy CONFIG.MODULES
 */
function getModuleConfig(moduleId) {
    return EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId] || null;
}

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
        this.baseSignatureRadius = this.signatureRadius;

        // EWAR status (set by TackleSystem each tick)
        this.isPointed = false;
        this.isWebbed = false;
        this.webSpeedFactor = 1.0; // 0.4 means 60% web applied

        // Intra-sector warp
        this.sectorWarpState = 'none'; // none|spooling|cooldown
        this.sectorWarpTarget = null;
        this.sectorWarpTimer = 0;
        this.sectorWarpCooldown = 0;
        this.sectorWarpSpoolTime = 4;
        this.sectorWarpCooldownTime = 30;

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
        this.tradeGoods = {}; // { goodId: { quantity: number, volumePerUnit: number } }
        this.materials = {}; // { materialId: quantity } - for manufacturing
        this.cargoUsed = 0;

        // Current target
        this.target = null;

        // Movement state
        this.desiredSpeed = 0;
        this.currentSpeed = 0;
        this.desiredRotation = this.rotation;

        // Timers for module cooldowns
        this.moduleCooldowns = new Map();

        // Ship class name and size
        this.shipClass = options.shipClass || 'frigate';
        this.shipSize = options.size || 'frigate';

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

        // Regenerate shield (passive, boosted by power routing + doctrine + formation)
        if (this.shield < this.maxShield) {
            let shieldRegenRate = 1;
            if (this.isPlayer && this.game.powerRouting) {
                shieldRegenRate *= 0.5 + (this.game.powerRouting.shields / 100) * 1.5;
            }
            // Doctrine shield regen bonus
            const dMods = this.game.fleetSystem?.getDoctrineModifiers() || {};
            if ((this.type === 'fleet' || this.isPlayer) && dMods.shieldRegen) {
                shieldRegenRate *= dMods.shieldRegen;
            }
            // Formation shield regen bonus (fleet only)
            if (this.type === 'fleet') {
                const fBonus = this.game.fleetSystem?.getFormationBonus(this) || {};
                if (fBonus.shieldRegen) shieldRegenRate *= fBonus.shieldRegen;
            }
            this.shield = Math.min(this.maxShield, this.shield + shieldRegenRate * dt);
        }

        // Update module cooldowns
        this.updateModuleCooldowns(dt);

        // Update active modules
        this.updateActiveModules(dt);

        // Update intra-sector warp
        this.updateSectorWarp(dt);

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
        const prevRotation = this.rotation;

        if (Math.abs(diff) < maxTurn) {
            this.rotation = this.desiredRotation;
        } else {
            this.rotation += Math.sign(diff) * maxTurn;
        }

        this.rotation = normalizeAngle(this.rotation);

        // Track turn rate for banking visual
        this._turnDelta = angleDifference(prevRotation, this.rotation);
    }

    /**
     * Update velocity towards desired speed
     */
    updateVelocity(dt) {
        // Calculate effective max speed (with propmod)
        let effectiveMaxSpeed = this.maxSpeed;
        let mwdActive = false;

        if (this.isModuleActive('afterburner')) {
            const abConfig = getModuleConfig('afterburner');
            if (abConfig) effectiveMaxSpeed *= abConfig.speedBonus;
        }
        // MWD check (all variants)
        for (const slotId of this.activeModules) {
            const [slotType, slotIndex] = this.parseSlotId(slotId);
            const moduleId = this.modules[slotType]?.[slotIndex];
            if (moduleId && moduleId.startsWith('microwarpdrive')) {
                const mwdConfig = getModuleConfig(moduleId);
                if (mwdConfig) {
                    effectiveMaxSpeed *= mwdConfig.speedBonus;
                    mwdActive = true;
                }
                break;
            }
        }

        // MWD signature bloom
        if (mwdActive) {
            const mwdConfig = getModuleConfig('microwarpdrive') || getModuleConfig('microwarpdrive-2');
            const bloom = mwdConfig?.signatureBloom || 5.0;
            this.signatureRadius = this.baseSignatureRadius * bloom;
        } else {
            this.signatureRadius = this.baseSignatureRadius;
        }

        // Doctrine + formation signature radius modifier
        if (this.type === 'fleet' || this.isPlayer) {
            const dSig = this.game.fleetSystem?.getDoctrineModifiers() || {};
            if (dSig.signatureRadius) this.signatureRadius *= dSig.signatureRadius;
            if (this.type === 'fleet') {
                const fSig = this.game.fleetSystem?.getFormationBonus(this) || {};
                if (fSig.signatureRadius) this.signatureRadius *= fSig.signatureRadius;
            }
        }

        // Apply web speed reduction
        effectiveMaxSpeed *= this.webSpeedFactor;

        // Apply doctrine speed modifier (fleet + player faction ships)
        const doctrineMods = this.game.fleetSystem?.getDoctrineModifiers() || {};
        if ((this.type === 'fleet' || this.isPlayer) && doctrineMods.maxSpeed) {
            effectiveMaxSpeed *= doctrineMods.maxSpeed;
        }

        // Apply formation speed bonus (fleet ships only)
        if (this.type === 'fleet') {
            const formBonus = this.game.fleetSystem?.getFormationBonus(this) || {};
            if (formBonus.maxSpeed) effectiveMaxSpeed *= formBonus.maxSpeed;
            // Flagship command aura speed bonus
            const cmdBonus = this.game.fleetSystem?.getFlagshipCommandBonuses(this) || {};
            if (cmdBonus.maxSpeed) effectiveMaxSpeed *= cmdBonus.maxSpeed;
        }

        // Power routing: engine power affects max speed for player
        if (this.isPlayer && this.game.powerRouting) {
            effectiveMaxSpeed *= 0.7 + (this.game.powerRouting.engines / 100) * 0.9;
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
     * Get effective max speed accounting for propmod + webs, without side effects
     */
    getEffectiveMaxSpeed() {
        let speed = this.maxSpeed;
        if (this.isModuleActive('afterburner')) {
            const abConfig = getModuleConfig('afterburner');
            if (abConfig) speed *= abConfig.speedBonus;
        }
        for (const slotId of this.activeModules) {
            const [slotType, slotIndex] = this.parseSlotId(slotId);
            const moduleId = this.modules[slotType]?.[slotIndex];
            if (moduleId && moduleId.startsWith('microwarpdrive')) {
                const mwdConfig = getModuleConfig(moduleId);
                if (mwdConfig) speed *= mwdConfig.speedBonus;
                break;
            }
        }
        speed *= this.webSpeedFactor;
        return speed;
    }

    /**
     * Initiate intra-sector warp to a point
     */
    initSectorWarp(x, y) {
        if (this.sectorWarpState !== 'none') return false;
        if (this.sectorWarpCooldown > 0) return false;
        if (this.isPointed) return false;

        const dx = x - this.x;
        const dy = y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1000) return false; // Too close to warp

        this.sectorWarpState = 'spooling';
        this.sectorWarpTarget = { x, y };
        this.sectorWarpTimer = this.sectorWarpSpoolTime;

        // Warp spool particles
        this.game.renderer?.effects.spawn('warp-flash', this.x, this.y, {
            color: 0x4488ff, size: 0.5, lifetime: this.sectorWarpSpoolTime,
        });

        return true;
    }

    /**
     * Update intra-sector warp state
     */
    updateSectorWarp(dt) {
        // Tick cooldown
        if (this.sectorWarpCooldown > 0) {
            this.sectorWarpCooldown -= dt;
        }

        if (this.sectorWarpState === 'spooling') {
            // Cancel if pointed
            if (this.isPointed) {
                this.sectorWarpState = 'none';
                this.sectorWarpTarget = null;
                this.sectorWarpTimer = 0;
                return;
            }

            this.sectorWarpTimer -= dt;
            if (this.sectorWarpTimer <= 0) {
                // Execute warp
                const target = this.sectorWarpTarget;
                if (target) {
                    // Dramatic departure effect at origin
                    const warpAngle = Math.atan2(target.y - this.y, target.x - this.x);
                    this.game.renderer?.effects.spawn('warp-departure', this.x, this.y, {
                        angle: warpAngle,
                    });

                    // Brief warp tunnel for player's sector warp
                    if (this.isPlayer) {
                        const tunnel = document.getElementById('warp-tunnel');
                        const destLabel = document.getElementById('warp-destination');
                        const warpDestText = document.getElementById('warp-destination-text');
                        if (tunnel) {
                            if (destLabel) destLabel.textContent = 'SECTOR WARP';
                            if (warpDestText) warpDestText.textContent = `WARPING TO: ${target.name || 'TARGET'}`;
                            tunnel.classList.remove('hidden');
                            setTimeout(() => tunnel.classList.add('hidden'), 500);
                        }
                        this.game.audio?.play('warp-start');
                    }

                    // Teleport
                    this.x = target.x;
                    this.y = target.y;
                    this.velocity.x = 0;
                    this.velocity.y = 0;
                    this.currentSpeed = 0;

                    // Flash at destination
                    this.game.renderer?.effects.spawn('warp-flash', this.x, this.y, {
                        color: 0x4488ff, size: 2, lifetime: 0.5,
                    });

                    // Drain capacitor
                    this.capacitor = Math.max(0, this.capacitor - this.maxCapacitor * 0.5);

                    // Set cooldown
                    this.sectorWarpCooldown = this.sectorWarpCooldownTime;
                }

                this.sectorWarpState = 'none';
                this.sectorWarpTarget = null;
            }
        }
    }

    /**
     * Update module cooldowns (tick-based cycling)
     * When a cooldown expires and the module is still active, re-trigger its effect
     */
    updateModuleCooldowns(dt) {
        for (const [slotId, cooldown] of this.moduleCooldowns) {
            const newCooldown = cooldown - dt;
            if (newCooldown <= 0) {
                this.moduleCooldowns.delete(slotId);
                // Re-trigger active cycle-based modules
                if (this.activeModules.has(slotId) && this.alive) {
                    const [slotType, slotIndex] = this.parseSlotId(slotId);
                    const moduleId = this.modules[slotType]?.[slotIndex];
                    if (moduleId) {
                        const moduleConfig = getModuleConfig(moduleId);
                        if (moduleConfig?.cycleTime) {
                            this.triggerModuleEffect(slotId, moduleConfig);
                        }
                    }
                }
            } else {
                this.moduleCooldowns.set(slotId, newCooldown);
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

            const moduleConfig = getModuleConfig(moduleId);
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
        const moduleConfig = getModuleConfig(moduleId);

        if (!moduleConfig) {
            console.warn(`Unknown module: ${moduleId}`);
            return false;
        }

        // Map new slot types to internal: weapon->high, module->mid, subsystem->low
        const slotMap = { weapon: 'high', module: 'mid', subsystem: 'low' };
        const internalSlot = slotMap[moduleConfig.slot] || moduleConfig.slot;

        if (internalSlot !== slotType) {
            console.warn(`Module ${moduleId} cannot fit in ${slotType} slot`);
            return false;
        }

        if (slotIndex >= this.modules[slotType].length) {
            console.warn(`Invalid slot index: ${slotIndex}`);
            return false;
        }

        // Size compatibility check (only for equipment DB items with size property)
        if (moduleConfig.size && this.shipSize) {
            if (!Ship.isEquipmentSizeCompatible(this.shipSize, moduleConfig.size)) {
                if (this.isPlayer) {
                    this.game.ui?.toast(`${moduleConfig.name} is too ${moduleConfig.size === 'xlarge' ? 'large' : moduleConfig.size} for this hull`, 'warning');
                }
                return false;
            }
        }

        this.modules[slotType][slotIndex] = moduleId;
        return true;
    }

    /**
     * Check if an equipment size fits a ship size
     * Frigates: small | Destroyers: small+medium | Cruisers: small+medium+large
     * Battlecruisers: medium+large | Battleships: large | Capitals: xlarge
     */
    static isEquipmentSizeCompatible(shipSize, equipSize) {
        const compat = {
            'frigate':       ['small'],
            'destroyer':     ['small', 'medium'],
            'cruiser':       ['small', 'medium', 'large'],
            'battlecruiser': ['medium', 'large'],
            'battleship':    ['large'],
            'capital':       ['xlarge'],
        };
        const allowed = compat[shipSize];
        if (!allowed) return true; // Unknown ship size, allow all
        return allowed.includes(equipSize);
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

        if (!moduleId) {
            if (this.isPlayer) this.game.ui?.toast('Empty slot - fit a module at a station', 'warning');
            return false;
        }

        const moduleConfig = getModuleConfig(moduleId);
        if (!moduleConfig) return false;

        // Check cooldown
        if (this.moduleCooldowns.has(slotId)) {
            if (this.isPlayer) {
                const remaining = this.moduleCooldowns.get(slotId).toFixed(1);
                this.game.ui?.toast(`${moduleConfig.name} cycling (${remaining}s)`, 'warning');
            }
            return false;
        }

        // Check capacitor for cycle-based modules
        if (moduleConfig.cycleTime && moduleConfig.capacitorUse) {
            if (this.capacitor < moduleConfig.capacitorUse) {
                if (this.isPlayer) {
                    this.game.ui?.log('Not enough capacitor', 'system');
                    this.game.ui?.toast('Not enough capacitor', 'warning');
                }
                return false;
            }
        }

        // Weapons need a locked target
        if (moduleConfig.damage && !this.target) {
            if (this.isPlayer) {
                this.game.ui?.log('No target locked', 'system');
                this.game.ui?.toast('No target locked (R to lock)', 'warning');
            }
            return false;
        }

        // Mining laser needs target
        if (moduleConfig.miningYield && !this.target) {
            if (this.isPlayer) {
                this.game.ui?.log('No target locked', 'system');
                this.game.ui?.toast('Lock an asteroid first (R)', 'warning');
            }
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
     * Called once on activation, then re-triggered by updateModuleCooldowns when cooldown expires
     */
    triggerModuleEffect(slotId, moduleConfig) {
        // Use capacitor
        if (!this.useCapacitor(moduleConfig.capacitorUse)) {
            this.deactivateModule(slotId);
            if (this.isPlayer) this.game.ui?.toast('Capacitor depleted', 'warning');
            return;
        }

        // Set cooldown - updateModuleCooldowns will call triggerModuleEffect again when it expires
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
        } else if (moduleConfig.scanRange) {
            // Survey scanner
            const moduleId = this.modules.mid?.[parseInt(slotId.split('-')[1]) - 1] ||
                             this.modules.high?.[parseInt(slotId.split('-')[1]) - 1];
            this.game.surveySystem?.initiateScan(this, moduleId || slotId);
        } else if (moduleConfig.remoteShieldRepair || moduleConfig.remoteArmorRepair) {
            // Remote repair
            const moduleId = this.modules.mid?.[parseInt(slotId.split('-')[1]) - 1];
            if (this.target && this.target.alive) {
                this.game.logisticsSystem?.applyRemoteRepair(this, this.target, moduleId || slotId);
            } else if (this.isPlayer) {
                this.game.ui?.log('No target for remote repair', 'system');
            }
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
            if (this.isPlayer) {
                this.game.ui?.log('Target out of range', 'system');
                this.game.ui?.toast(`Out of range (${Math.floor(dist)}m / ${moduleConfig.range}m)`, 'warning');
            }
            return;
        }

        // Calculate damage with bonuses
        let damage = moduleConfig.damage;

        // Apply damage mod bonus from subsystem slots
        for (let i = 0; i < this.lowSlots; i++) {
            const mod = this.modules.low[i];
            if (mod) {
                const modConfig = getModuleConfig(mod);
                if (modConfig?.damageBonus) damage *= modConfig.damageBonus;
                if (modConfig?.laserDamageBonus) damage *= modConfig.laserDamageBonus;
                if (modConfig?.missileDamageBonus && moduleConfig.category === 'missile') damage *= modConfig.missileDamageBonus;
            }
        }

        // Apply pilot skill damage bonus (player only)
        if (this.isPlayer && this.skillBonuses?.damage) {
            damage *= this.skillBonuses.damage;
        }

        // Apply doctrine damage modifier (fleet + player)
        const doctrineDmg = this.game.fleetSystem?.getDoctrineModifiers() || {};
        if ((this.type === 'fleet' || this.isPlayer) && doctrineDmg.damage) {
            damage *= doctrineDmg.damage;
        }

        // Apply formation damage bonus (fleet ships only)
        if (this.type === 'fleet') {
            const formBonus = this.game.fleetSystem?.getFormationBonus(this) || {};
            if (formBonus.damage) damage *= formBonus.damage;
            const cmdBonus = this.game.fleetSystem?.getFlagshipCommandBonuses(this) || {};
            if (cmdBonus.damage) damage *= cmdBonus.damage;
        }

        // Apply weapon range from doctrine
        let effectiveRange = moduleConfig.range;
        if ((this.type === 'fleet' || this.isPlayer) && doctrineDmg.range) {
            effectiveRange *= doctrineDmg.range;
        }

        // Fire!
        this.game.combat.fireAt(this, this.target, damage, effectiveRange, moduleConfig);
        if (this.isPlayer) {
            this.game.audio?.play(moduleConfig.category === 'missile' ? 'missile-launch' : 'laser');
        }
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
            if (this.isPlayer) {
                this.game.ui?.log('Target out of range', 'system');
                this.game.ui?.toast(`Mining range exceeded (${Math.floor(dist)}m / ${moduleConfig.range}m)`, 'warning');
            }
            return;
        }

        // Apply pilot skill mining yield bonus (player only)
        let yield_ = moduleConfig.miningYield;
        if (this.isPlayer && this.skillBonuses?.miningYield) {
            yield_ *= this.skillBonuses.miningYield;
        }

        // Mine!
        this.game.mining.mineAsteroid(this, this.target, yield_);
    }

    /**
     * Repair shield
     */
    repairShield(amount) {
        const before = this.shield;
        this.shield = Math.min(this.maxShield, this.shield + amount);
        // Visual pulse when shield booster cycles
        const repaired = this.shield - before;
        if (repaired > 0) {
            this.game.renderer?.statusEffects?.spawnRepairPulse(this, 'shield');
            this.game.events.emit('combat:repair', { ship: this, amount: repaired, type: 'shield' });
        }
    }

    /**
     * Repair armor
     */
    repairArmor(amount) {
        const before = this.armor;
        this.armor = Math.min(this.maxArmor, this.armor + amount);
        const repaired = this.armor - before;
        if (repaired > 0) {
            this.game.renderer?.statusEffects?.spawnRepairPulse(this, 'armor');
            this.game.events.emit('combat:repair', { ship: this, amount: repaired, type: 'armor' });
        }
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
        this._lastDamageTime = performance.now();
        this.lastDamageSource = source;

        // Doctrine defensive modifiers (shield/armor HP scaling = damage resistance)
        let shieldResist = 1;
        let armorResist = 1;
        if (this.type === 'fleet' || this.isPlayer) {
            const dDef = this.game.fleetSystem?.getDoctrineModifiers() || {};
            if (dDef.shield) shieldResist = 1 / dDef.shield; // +25% shield = take 80% shield dmg
            if (dDef.armor) armorResist = 1 / dDef.armor;    // -15% armor = take 118% armor dmg
        }

        let remaining = amount;

        // Damage shield first
        if (this.shield > 0) {
            const effectiveDmg = remaining * shieldResist;
            const shieldDamage = Math.min(this.shield, effectiveDmg);
            this.shield -= shieldDamage;
            remaining -= shieldDamage / shieldResist;
            this.addEffect('shield-hit', 0.2);
        }

        // Then armor
        if (remaining > 0 && this.armor > 0) {
            const effectiveDmg = remaining * armorResist;
            const armorDamage = Math.min(this.armor, effectiveDmg);
            this.armor -= armorDamage;
            remaining -= armorDamage / armorResist;
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
        this.tradeGoods = {};
        this.cargoUsed = 0;
        this.game.events.emit('cargo:updated', { ship: this });
        return value;
    }

    // =============================================
    // Trade Goods Cargo
    // =============================================

    /**
     * Add trade goods to cargo
     * @param {string} goodId - Trade good identifier
     * @param {number} quantity - Number of units
     * @param {number} volumePerUnit - Volume per unit in m³
     * @returns {number} Number of units actually added
     */
    addTradeGood(goodId, quantity, volumePerUnit) {
        if (!volumePerUnit || volumePerUnit <= 0) return 0;
        const availableSpace = this.cargoCapacity - this.cargoUsed;
        const maxUnits = Math.floor(availableSpace / volumePerUnit);
        const unitsToAdd = Math.min(quantity, maxUnits);

        if (unitsToAdd <= 0) return 0;

        if (!this.tradeGoods) this.tradeGoods = {};
        if (!this.tradeGoods[goodId]) {
            this.tradeGoods[goodId] = { quantity: 0, volumePerUnit };
        }

        this.tradeGoods[goodId].quantity += unitsToAdd;
        this.cargoUsed += unitsToAdd * volumePerUnit;

        this.game.events.emit('cargo:updated', { ship: this });
        return unitsToAdd;
    }

    /**
     * Remove trade goods from cargo
     * @returns {number} Number of units actually removed
     */
    removeTradeGood(goodId, quantity) {
        if (!this.tradeGoods?.[goodId]) return 0;

        const data = this.tradeGoods[goodId];
        const toRemove = Math.min(quantity, data.quantity);

        data.quantity -= toRemove;
        this.cargoUsed -= toRemove * data.volumePerUnit;

        if (data.quantity <= 0) {
            delete this.tradeGoods[goodId];
        }

        this.game.events.emit('cargo:updated', { ship: this });
        return toRemove;
    }

    /**
     * Get quantity of a specific trade good
     */
    getTradeGoodQuantity(goodId) {
        return this.tradeGoods?.[goodId]?.quantity || 0;
    }

    // =============================================
    // Material Cargo (Manufacturing)
    // =============================================

    /**
     * Add materials to cargo (volumeless - they don't count against cargo capacity)
     */
    addMaterial(materialId, quantity) {
        if (!this.materials) this.materials = {};
        this.materials[materialId] = (this.materials[materialId] || 0) + quantity;
        this.game.events.emit('cargo:updated', { ship: this });
        return quantity;
    }

    /**
     * Remove materials from cargo
     * @returns {number} Number actually removed
     */
    removeMaterial(materialId, quantity) {
        if (!this.materials?.[materialId]) return 0;
        const toRemove = Math.min(quantity, this.materials[materialId]);
        this.materials[materialId] -= toRemove;
        if (this.materials[materialId] <= 0) delete this.materials[materialId];
        this.game.events.emit('cargo:updated', { ship: this });
        return toRemove;
    }

    /**
     * Get quantity of a specific material
     */
    getMaterialCount(materialId) {
        return this.materials?.[materialId] || 0;
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
            // Launch burst visual effect
            this.game.renderer?.effects?.spawn('drone-launch', drone.x, drone.y, { color: 0x00ffcc });
            if (this.isPlayer) {
                this.game.ui?.log(`Launched ${droneConfig.name}`, 'system');
                this.game.audio?.play('drone-launch');
            }
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

            // Recall beam visual effect
            this.game.renderer?.effects?.spawn('drone-recall', this.x, this.y, {
                droneX: droneEntity.x, droneY: droneEntity.y,
            });
            if (this.isPlayer) {
                this.game.ui?.log(`Recalled ${droneEntity.name}`, 'system');
                this.game.audio?.play('drone-recall');
            }

            // Animate drone flying back to ship before removing
            const ship = this;
            const startX = droneEntity.x;
            const startY = droneEntity.y;
            droneEntity._recalling = true;
            droneEntity._recallTimer = 0;
            const recallDuration = 0.6;

            const origUpdate = droneEntity.update.bind(droneEntity);
            droneEntity.update = function(dt) {
                this._recallTimer += dt;
                const t = Math.min(1, this._recallTimer / recallDuration);
                const ease = t * t; // accelerate toward ship
                this.x = startX + (ship.x - startX) * ease;
                this.y = startY + (ship.y - startY) * ease;
                if (this.mesh) {
                    this.mesh.position.set(this.x, this.y, 0);
                    const scale = 1 - t * 0.7;
                    this.mesh.scale.setScalar(scale);
                    this.mesh.material && (this.mesh.material.opacity = 1 - t);
                }
                if (t >= 1) {
                    this.destroy();
                }
            };
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

        // Extrude for 3D depth — cap to prevent thick dark side faces on large ships
        const extrudeSettings = {
            depth: Math.min(size * 0.1, 6),
            bevelEnabled: true,
            bevelThickness: Math.min(size * 0.02, 1.5),
            bevelSize: Math.min(size * 0.015, 1),
            bevelSegments: 1,
        };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        const material = new THREE.MeshStandardMaterial({
            color: this.color,
            emissive: this.color,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.9,
            roughness: 0.6,
            metalness: 0.3,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;

        // Add shield overlay mesh
        const shieldGeo = new THREE.CircleGeometry(this.radius * 1.5, 32);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
        });
        this.shieldOverlay = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldOverlay.position.z = 2;
        this.mesh.add(this.shieldOverlay);

        // Add weapon turrets
        this.addTurretHardpoints();

        return this.mesh;
    }

    /**
     * Add turret hardpoint meshes to the ship mesh.
     * Call after createMesh() to mount weapon turrets.
     */
    addTurretHardpoints() {
        if (!this.mesh) return;

        // Count weapon slots with actual weapons fitted
        const weaponCount = this.highSlots;
        if (weaponCount <= 0) return;

        this.turretMeshes = [];
        const r = this.radius;
        const turretSize = Math.max(1.5, Math.min(r * 0.08, 4));

        // Distribute turrets along hull centerline, spread from front to mid
        for (let i = 0; i < Math.min(weaponCount, 6); i++) {
            // Position along ship's forward axis (local x)
            const t = weaponCount === 1 ? 0.3 : (0.6 - (i / (weaponCount - 1)) * 0.8);
            const localX = r * t;
            // Alternate above/below centerline for visual spread
            const localY = (i % 2 === 0 ? 1 : -1) * r * 0.15 * (1 + Math.floor(i / 2) * 0.3);

            const turretGroup = new THREE.Group();
            turretGroup.position.set(localX, localY, Math.min(r * 0.1, 6) + 1);

            // Base (small cylinder)
            const baseGeo = new THREE.CylinderGeometry(turretSize * 0.8, turretSize, turretSize * 0.5, 6);
            baseGeo.rotateX(Math.PI / 2);
            const baseMat = new THREE.MeshStandardMaterial({
                color: 0x556677,
                emissive: 0x223344,
                emissiveIntensity: 0.1,
                roughness: 0.4,
                metalness: 0.6,
            });
            turretGroup.add(new THREE.Mesh(baseGeo, baseMat));

            // Barrel (elongated box)
            const barrelGeo = new THREE.BoxGeometry(turretSize * 2.5, turretSize * 0.3, turretSize * 0.3);
            barrelGeo.translate(turretSize * 1.2, 0, 0);
            const barrelMat = new THREE.MeshStandardMaterial({
                color: 0x778899,
                emissive: 0x334455,
                emissiveIntensity: 0.1,
                roughness: 0.3,
                metalness: 0.7,
            });
            turretGroup.add(new THREE.Mesh(barrelGeo, barrelMat));

            this.mesh.add(turretGroup);
            this.turretMeshes.push(turretGroup);
        }
    }

    /**
     * Update turret tracking toward locked target
     */
    updateTurretTracking() {
        if (!this.turretMeshes || this.turretMeshes.length === 0) return;

        const target = this.target;
        const hasActiveWeapon = this.activeModules.size > 0;

        for (let i = 0; i < this.turretMeshes.length; i++) {
            const turret = this.turretMeshes[i];

            if (target && target.alive && hasActiveWeapon) {
                // Calculate angle to target in local space
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const worldAngle = Math.atan2(dy, dx);
                const localAngle = worldAngle - this.rotation;

                // Smooth rotation toward target
                let diff = localAngle - turret.rotation.z;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                turret.rotation.z += diff * 0.15;

                // Glow barrel tip when firing
                const barrel = turret.children[1];
                if (barrel?.material) {
                    barrel.material.emissiveIntensity = 0.3;
                }
            } else {
                // Return to forward-facing (local angle 0)
                turret.rotation.z *= 0.92;

                const barrel = turret.children[1];
                if (barrel?.material) {
                    barrel.material.emissiveIntensity = 0.1;
                }
            }
        }
    }

    /**
     * Update mesh position to match entity (override Entity.updateMesh)
     */
    updateMesh() {
        if (this.mesh) {
            // Idle bobbing when nearly stationary
            let bobX = 0, bobY = 0;
            if (this.currentSpeed < 5) {
                const t = performance.now() * 0.001;
                const bobId = (this.id || 0) * 1.37; // unique phase per ship
                bobX = Math.sin(t * 0.7 + bobId) * 1.2;
                bobY = Math.cos(t * 0.5 + bobId * 0.8) * 0.8;
            }
            this.mesh.position.set(this.x + bobX, this.y + bobY, 0);

            // Banking effect: tilt mesh on X-axis based on turn rate
            const turnRate = this._turnDelta || 0;
            const targetBank = -turnRate * 15; // scale turn delta to visual bank
            const maxBank = 0.35; // ~20 degrees max
            this._bankAngle = lerp(this._bankAngle || 0, Math.max(-maxBank, Math.min(maxBank, targetBank)), 0.12);
            this.mesh.rotation.set(this._bankAngle, 0, this.rotation);

            // Warp stretch effect for player
            if (this.isPlayer && this.game.autopilot?.warping) {
                // Stretch along heading, compress perpendicular
                const stretchFactor = 1.4 + Math.sin(performance.now() * 0.008) * 0.15;
                this.mesh.scale.set(stretchFactor, 1 / Math.sqrt(stretchFactor), 1);
            } else if (this._wasWarpStretched) {
                this.mesh.scale.set(1, 1, 1);
            }
            this._wasWarpStretched = this.isPlayer && this.game.autopilot?.warping;

            this.mesh.visible = this.visible && this.alive;
            this.updateTurretTracking();
            this.updateDamageVisuals();
        }
    }

    /**
     * Update visual damage states based on health
     */
    updateDamageVisuals() {
        if (!this.mesh) return;
        if (this._lodLevel >= 1) return;

        const shieldPct = this.shield / this.maxShield;
        const hullPct = this.hull / this.maxHull;

        // Shield glow overlay - visible when shields are up, pulses when hit
        if (this.shieldOverlay) {
            // Base opacity scales with shield percentage (0 = no shields, 0.15 = full)
            this.shieldOverlay.material.opacity = shieldPct * 0.15;
        }

        // Hull damage - tint red and add particles
        if (hullPct < 0.3 && this.alive) {
            // Spawn damage sparks
            if (Math.random() < 0.15) {
                const sparkX = this.x + (Math.random() - 0.5) * this.radius;
                const sparkY = this.y + (Math.random() - 0.5) * this.radius;
                this.game.renderer?.effects.spawn('hit', sparkX, sparkY, {
                    color: 0xff4400,
                    size: 1 + Math.random(),
                    lifetime: 0.3,
                });
            }

            // Critical hull - smoke trail
            if (hullPct < 0.15 && Math.random() < 0.3) {
                const smokeX = this.x + (Math.random() - 0.5) * this.radius;
                const smokeY = this.y + (Math.random() - 0.5) * this.radius;
                this.game.renderer?.effects.spawn('trail', smokeX, smokeY, {
                    color: 0x332211,
                    size: 2 + Math.random() * 2,
                    lifetime: 0.8,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                });
            }
        }
    }
}
