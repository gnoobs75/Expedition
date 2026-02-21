// =============================================
// Expedition Battle Simulator
// Standalone combat testing tool
// =============================================

import { SHIP_DATABASE, SHIP_SIZES } from '../js/data/shipDatabase.js';
import { EQUIPMENT_DATABASE } from '../js/data/equipmentDatabase.js';
import { FACTIONS, FACTION_SHIP_VARIANTS, FACTION_TECH_BONUSES, applyFactionOverlay } from '../js/data/factionDatabase.js';
import { CONFIG } from '../js/config.js';
import { distance, angleBetween, angleDifference, normalizeAngle, Vector2 } from '../js/utils/math.js';
import { shipMeshFactory } from '../js/graphics/ShipMeshFactory.js';

// =============================================
// Constants
// =============================================

const ARENA_SIZE = 25000;
const ARENA_HALF = ARENA_SIZE / 2;

const PLACEMENT_ZONE_A = { xMin: -ARENA_HALF, xMax: -500 };
const PLACEMENT_ZONE_B = { xMin: 500, xMax: ARENA_HALF };
const PLACEMENT_Y_RANGE = { yMin: -ARENA_HALF, yMax: ARENA_HALF };

const SIZE_COMPAT = {
    frigate: ['small'], destroyer: ['small', 'medium'], cruiser: ['small', 'medium', 'large'],
    battlecruiser: ['medium', 'large'], battleship: ['large'], capital: ['xlarge'],
};

const AI_PROFILES = {
    aggressive: { preferredRange: 0.4, fleeHpPct: 0.05, orbitSpeed: 0.7, aggressionMod: 1.3 },
    defensive:  { preferredRange: 0.7, fleeHpPct: 0.30, orbitSpeed: 0.5, aggressionMod: 0.6 },
    kiting:     { preferredRange: 0.85, fleeHpPct: 0.20, orbitSpeed: 0.8, aggressionMod: 0.9 },
    brawler:    { preferredRange: 0.3, fleeHpPct: 0.10, orbitSpeed: 0.6, aggressionMod: 1.2 },
    sniper:     { preferredRange: 0.95, fleeHpPct: 0.25, orbitSpeed: 0.3, aggressionMod: 0.8 },
    support:    { preferredRange: 0.6, fleeHpPct: 0.35, orbitSpeed: 0.5, aggressionMod: 0.4 },
};

const PDS_BASE = CONFIG.PDS_BASE || { frigate: 0.05, destroyer: 0.08, cruiser: 0.10, battlecruiser: 0.12, battleship: 0.15, capital: 0.20 };
const PDS_RANGE = CONFIG.PDS_RANGE || 150;
const PDS_STACKING_PENALTY = [1.0, 0.87, 0.57, 0.28];

const FORMATION_OFFSETS = {
    none: () => [],
    line: (count) => Array.from({ length: count }, (_, i) => ({ x: 0, y: (i - (count - 1) / 2) * 120 })),
    wedge: (count) => Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / 2);
        const side = i % 2 === 0 ? -1 : 1;
        return { x: -row * 100, y: side * (row + 1) * 80 };
    }),
    wall: (count) => Array.from({ length: count }, (_, i) => ({ x: 0, y: (i - (count - 1) / 2) * 80 })),
    orbit: (count) => Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200 };
    }),
};

// =============================================
// Default Loadouts
// =============================================

const DEFAULT_LOADOUTS = {
    // Combat roles
    'mercenary-frigate':     { high: ['small-pulse-maser', 'small-pulse-maser', 'small-railgun'], mid: ['shield-booster', 'afterburner'], low: ['damage-mod'] },
    'mercenary-destroyer':   { high: ['small-pulse-maser', 'small-pulse-maser', 'small-railgun', 'small-railgun'], mid: ['shield-booster', 'afterburner'], low: ['damage-mod', 'damage-control'] },
    'mercenary-cruiser':     { high: ['medium-pulse-maser', 'medium-pulse-maser', 'medium-railgun', 'medium-railgun'], mid: ['shield-booster', 'afterburner', 'sensor-booster'], low: ['damage-mod', 'damage-control', 'armor-plate'] },
    'mercenary-battlecruiser': { high: ['medium-pulse-maser', 'medium-pulse-maser', 'medium-railgun', 'medium-railgun', 'medium-railgun'], mid: ['shield-booster', 'afterburner', 'sensor-booster'], low: ['damage-mod', 'gyrostabilizer', 'damage-control', 'point-defense-system'] },
    'mercenary-battleship':  { high: ['large-beam-maser', 'large-beam-maser', 'large-railgun', 'large-railgun', 'large-railgun', 'large-railgun'], mid: ['shield-booster', 'afterburner', 'sensor-booster', 'capacitor-booster'], low: ['damage-mod', 'gyrostabilizer', 'damage-control', 'point-defense-system-2', 'armor-plate'] },
    'pirate-frigate':        { high: ['small-pulse-maser', 'small-pulse-maser', 'small-pulse-maser'], mid: ['afterburner', 'warp-scrambler'], low: ['damage-mod'] },
    'pirate-destroyer':      { high: ['small-railgun', 'small-railgun', 'small-pulse-maser', 'small-pulse-maser'], mid: ['shield-booster', 'afterburner', 'stasis-webifier'], low: ['damage-mod', 'damage-control'] },
    'pirate-cruiser':        { high: ['medium-pulse-maser', 'medium-pulse-maser', 'medium-railgun', 'medium-railgun'], mid: ['shield-booster', 'afterburner', 'warp-disruptor'], low: ['damage-mod', 'damage-control', 'gyrostabilizer'] },
    'military-frigate':      { high: ['small-railgun', 'small-railgun', 'light-missile'], mid: ['shield-booster', 'afterburner'], low: ['damage-control'] },
    'military-destroyer':    { high: ['small-railgun', 'small-railgun', 'small-railgun', 'light-missile'], mid: ['shield-booster', 'afterburner', 'sensor-booster'], low: ['damage-control', 'ballistic-control'] },
    'military-cruiser':      { high: ['medium-railgun', 'medium-railgun', 'heavy-missile', 'heavy-missile'], mid: ['shield-booster', 'afterburner', 'sensor-booster'], low: ['damage-control', 'ballistic-control', 'armor-plate'] },
    'military-battlecruiser': { high: ['medium-railgun', 'medium-railgun', 'heavy-missile', 'heavy-missile', 'heavy-missile'], mid: ['shield-booster', 'afterburner', 'sensor-booster'], low: ['damage-control', 'ballistic-control', 'point-defense-system', 'shield-extender'] },
    'military-battleship':   { high: ['large-railgun', 'large-railgun', 'cruise-missile', 'cruise-missile', 'cruise-missile', 'cruise-missile'], mid: ['shield-booster', 'afterburner', 'sensor-booster', 'capacitor-booster'], low: ['damage-control', 'ballistic-control', 'point-defense-system-2', 'armor-plate', 'shield-extender'] },
    'police-frigate':        { high: ['small-pulse-maser', 'small-pulse-maser'], mid: ['warp-scrambler', 'afterburner'], low: ['damage-control'] },
    'police-destroyer':      { high: ['small-pulse-maser', 'small-pulse-maser', 'small-pulse-maser'], mid: ['warp-scrambler', 'afterburner', 'stasis-webifier'], low: ['damage-control', 'damage-mod'] },
    'police-cruiser':        { high: ['medium-pulse-maser', 'medium-pulse-maser', 'medium-pulse-maser'], mid: ['warp-disruptor', 'afterburner', 'stasis-webifier'], low: ['damage-control', 'damage-mod', 'armor-plate'] },
    // Non-combat roles (minimal weapons)
    'mining-frigate':        { high: ['mining-laser'], mid: ['shield-booster', 'afterburner'], low: ['damage-control'] },
    'mining-destroyer':      { high: ['mining-laser', 'mining-laser'], mid: ['shield-booster', 'afterburner'], low: ['damage-control', 'mining-upgrade'] },
    'mining-cruiser':        { high: ['modulated-miner', 'modulated-miner'], mid: ['shield-booster', 'afterburner'], low: ['damage-control', 'mining-upgrade', 'mining-upgrade'] },
    'hauler-frigate':        { high: ['small-pulse-maser'], mid: ['shield-booster', 'afterburner'], low: ['damage-control'] },
    'hauler-destroyer':      { high: ['small-pulse-maser', 'small-pulse-maser'], mid: ['shield-booster', 'afterburner'], low: ['damage-control', 'nanofiber'] },
    'hauler-cruiser':        { high: ['medium-pulse-maser', 'medium-pulse-maser'], mid: ['shield-booster', 'afterburner'], low: ['damage-control', 'nanofiber', 'armor-plate'] },
    'logistics-frigate':     { high: ['small-pulse-maser'], mid: ['remote-shield-repairer', 'afterburner'], low: ['damage-control'] },
    'logistics-destroyer':   { high: ['small-pulse-maser', 'small-pulse-maser'], mid: ['remote-shield-repairer', 'afterburner'], low: ['damage-control', 'capacitor-flux-coil'] },
    'logistics-cruiser':     { high: ['medium-pulse-maser', 'medium-pulse-maser'], mid: ['remote-shield-repairer', 'remote-armor-repairer', 'afterburner'], low: ['damage-control', 'capacitor-flux-coil', 'reactor-control'] },
};

function getModuleConfig(moduleId) {
    return EQUIPMENT_DATABASE[moduleId] || null;
}

// =============================================
// SimShip - Lightweight ship for simulation
// =============================================

let simIdCounter = 0;

class SimShip {
    constructor(shipId, shipConfig, team, loadout) {
        this.id = ++simIdCounter;
        this.shipId = shipId;
        this.config = shipConfig;
        this.team = team;
        this.name = shipConfig.name;
        this.shipSize = shipConfig.size;

        // Position & movement
        this.x = 0;
        this.y = 0;
        this.rotation = team === 'a' ? 0 : Math.PI;
        this.desiredRotation = this.rotation;
        this.currentSpeed = 0;
        this.desiredSpeed = 0;
        this.maxSpeed = shipConfig.maxSpeed || 100;
        this.acceleration = shipConfig.acceleration || 25;
        this.turnSpeed = shipConfig.turnSpeed || 2;

        // Health
        this.maxShield = shipConfig.shield || 100;
        this.maxArmor = shipConfig.armor || 50;
        this.maxHull = shipConfig.hull || 100;
        this.shield = this.maxShield;
        this.armor = this.maxArmor;
        this.hull = this.maxHull;
        this.alive = true;

        // Capacitor
        this.maxCapacitor = shipConfig.capacitor || 100;
        this.capacitorRegen = shipConfig.capacitorRegen || 5;
        this.capacitor = this.maxCapacitor;
        this.signatureRadius = shipConfig.signatureRadius || 30;

        // Resistances
        this.resistances = shipConfig.resistProfile || {
            shield: { em: 0, thermal: 0.2, kinetic: 0.4, explosive: 0.5 },
            armor:  { em: 0.5, thermal: 0.35, kinetic: 0.25, explosive: 0.1 },
            hull:   { em: 0, thermal: 0, kinetic: 0, explosive: 0 },
        };

        // Modules
        this.highSlots = shipConfig.weaponSlots || 3;
        this.midSlots = shipConfig.moduleSlots || 2;
        this.lowSlots = shipConfig.subsystemSlots || 2;
        this.modules = {
            high: new Array(this.highSlots).fill(null),
            mid: new Array(this.midSlots).fill(null),
            low: new Array(this.lowSlots).fill(null),
        };

        // Fit loadout
        if (loadout) {
            const slotsMap = { high: 'high', mid: 'mid', low: 'low' };
            for (const [slotType, mods] of Object.entries(loadout)) {
                for (let i = 0; i < mods.length && i < this.modules[slotType].length; i++) {
                    if (EQUIPMENT_DATABASE[mods[i]]) {
                        this.modules[slotType][i] = mods[i];
                    }
                }
            }
        }

        // Combat state
        this.target = null;
        this.moduleCooldowns = {};
        this.damageDone = 0;
        this.damageTaken = 0;
        this.kills = 0;

        // Enhanced analytics stats
        this.stats = {
            weapons: {},        // keyed by slot "high-0", "high-1" etc.
            damageDealtByLayer: { shield: 0, armor: 0, hull: 0 },
            damageReceivedByLayer: { shield: 0, armor: 0, hull: 0 },
            damageDealtByType: { em: 0, thermal: 0, kinetic: 0, explosive: 0 },
            damageReceivedByType: { em: 0, thermal: 0, kinetic: 0, explosive: 0 },
            damageAbsorbedByResist: 0,
            rawDamageReceived: 0,
            totalShots: 0,
            totalHits: 0,
            totalMisses: 0,
            overkillDamage: 0,
            capUsedOnWeapons: 0,
            capUsedOnModules: 0,
            capRegenTotal: 0,
            timeCapEmpty: 0,
            weaponsDryCycles: 0,
            shieldRepaired: 0,
            armorRepaired: 0,
            timeAlive: 0,
            timeInCombat: 0,
            firstShotTime: -1,
            deathTime: -1,
            pdsIntercepted: 0,
            pdsFired: 0,
        };

        // AI state tracking (for inspector)
        this.aiTimer = 0;
        this.aiState = 'idle';   // idle, approach, orbit, flee, engage
        this.aiIntent = '';      // human-readable description
        this.aiDesiredRange = 0;
        this.distToTarget = 0;

        // Per-weapon hit chances (updated each combat tick for inspector)
        this.weaponDetails = []; // [{name, moduleId, range, optimal, falloff, tracking, hitChance, dps, cycleTime, onCooldown}]

        // Visual
        this.mesh = null;
        this.hpBarMesh = null;
        this.deathTime = 0;
    }

    getHpPercent() {
        const total = this.maxShield + this.maxArmor + this.maxHull;
        const current = this.shield + this.armor + this.hull;
        return total > 0 ? current / total : 0;
    }

    getDps() {
        let totalDps = 0;
        for (const moduleId of this.modules.high) {
            if (!moduleId) continue;
            const config = getModuleConfig(moduleId);
            if (config?.damage && config?.cycleTime) {
                totalDps += config.damage / config.cycleTime;
            }
        }
        let damageMult = this.config.damageMultiplier || 1;
        for (const moduleId of this.modules.low) {
            if (!moduleId) continue;
            const config = getModuleConfig(moduleId);
            if (config?.damageBonus) damageMult *= config.damageBonus;
            if (config?.maserDamageBonus) damageMult *= config.maserDamageBonus;
            if (config?.missileDamageBonus) damageMult *= config.missileDamageBonus;
        }
        return totalDps * damageMult;
    }

    getPdsChance(allies) {
        const base = PDS_BASE[this.shipSize] || PDS_BASE.frigate || 0.05;

        // Module bonuses with stacking penalty
        const pdsBonuses = [];
        for (const moduleId of [...this.modules.mid, ...this.modules.low]) {
            if (!moduleId) continue;
            const config = getModuleConfig(moduleId);
            if (config?.pdsBonus) pdsBonuses.push(config.pdsBonus);
        }
        pdsBonuses.sort((a, b) => b - a);
        let moduleBonus = 0;
        for (let i = 0; i < pdsBonuses.length; i++) {
            moduleBonus += pdsBonuses[i] * (PDS_STACKING_PENALTY[i] || 0.28);
        }

        // Fleet PDS bonus from nearby allies with fleet-pds-array
        let fleetBonus = 0;
        if (allies) {
            for (const ally of allies) {
                if (ally === this || !ally.alive) continue;
                for (const moduleId of [...ally.modules.mid, ...ally.modules.low]) {
                    if (!moduleId) continue;
                    const config = getModuleConfig(moduleId);
                    if (!config?.fleetPdsBonus || !config?.fleetPdsRange) continue;
                    const dist = distance(this.x, this.y, ally.x, ally.y);
                    if (dist <= config.fleetPdsRange) {
                        fleetBonus += config.fleetPdsBonus;
                    }
                }
            }
        }

        return Math.min(0.95, base + moduleBonus + fleetBonus);
    }

    getMaxWeaponRange() {
        let maxRange = 0;
        for (const moduleId of this.modules.high) {
            if (!moduleId) continue;
            const config = getModuleConfig(moduleId);
            if (config?.range) maxRange = Math.max(maxRange, config.range);
            else if (config?.optimalRange) maxRange = Math.max(maxRange, config.optimalRange + (config.falloff || 0));
        }
        return maxRange || 500;
    }

    getEffectiveResists() {
        const result = {
            shield: { ...this.resistances.shield },
            armor: { ...this.resistances.armor },
            hull: { ...this.resistances.hull },
        };
        const bonuses = {};
        for (const slotType of ['high', 'mid', 'low']) {
            for (const moduleId of this.modules[slotType]) {
                if (!moduleId) continue;
                const config = getModuleConfig(moduleId);
                if (!config) continue;
                if (config.resistBonus) {
                    const rb = config.resistBonus;
                    const layers = rb.layer === 'all' ? ['shield', 'armor', 'hull'] : [rb.layer];
                    const types = rb.type === 'all' ? ['em', 'thermal', 'kinetic', 'explosive'] : [rb.type];
                    for (const layer of layers) {
                        for (const type of types) {
                            const key = `${layer}_${type}`;
                            if (!bonuses[key]) bonuses[key] = [];
                            bonuses[key].push(rb.amount);
                        }
                    }
                }
                // Legacy damage control resists
                for (const [prop, layer] of [['shieldResist', 'shield'], ['armorResist', 'armor'], ['hullResist', 'hull']]) {
                    if (config[prop]) {
                        for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
                            const key = `${layer}_${t}`;
                            if (!bonuses[key]) bonuses[key] = [];
                            bonuses[key].push(config[prop]);
                        }
                    }
                }
            }
        }
        for (const [key, amounts] of Object.entries(bonuses)) {
            const [layer, type] = key.split('_');
            amounts.sort((a, b) => b - a);
            let resist = result[layer][type];
            for (let i = 0; i < amounts.length; i++) {
                const penalty = Math.exp(-Math.pow((i) / 2.67, 2));
                resist = 1 - (1 - resist) * (1 - amounts[i] * penalty);
            }
            result[layer][type] = Math.min(0.85, resist);
        }
        return result;
    }

    getEffectiveHp() {
        const resists = this.getEffectiveResists();
        let ehp = 0;
        const hpMap = { shield: this.maxShield, armor: this.maxArmor, hull: this.maxHull };
        for (const layer of ['shield', 'armor', 'hull']) {
            const avg = (resists[layer].em + resists[layer].thermal + resists[layer].kinetic + resists[layer].explosive) / 4;
            ehp += hpMap[layer] / Math.max(0.15, 1 - avg);
        }
        return ehp;
    }

    takeDamage(amount, source, damageType = 'em') {
        if (!this.alive) return;

        // Capture HP before damage for overkill calculation
        const hpBeforeDamage = this.shield + this.armor + this.hull;

        let damageProfile;
        if (typeof damageType === 'object') {
            damageProfile = damageType;
        } else {
            damageProfile = { em: 0, thermal: 0, kinetic: 0, explosive: 0 };
            damageProfile[damageType] = 1.0;
        }
        const profileSum = (damageProfile.em || 0) + (damageProfile.thermal || 0) +
                          (damageProfile.kinetic || 0) + (damageProfile.explosive || 0);
        const dmgByType = {};
        for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
            dmgByType[t] = profileSum > 0 ? amount * ((damageProfile[t] || 0) / profileSum) : 0;
        }
        const resists = this.getEffectiveResists();
        let totalRemaining = amount;

        // Track raw damage before resists
        this.stats.rawDamageReceived += amount;
        for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
            this.stats.damageReceivedByType[t] += dmgByType[t];
        }

        let totalAfterResists = 0;

        // Shield
        if (this.shield > 0 && totalRemaining > 0) {
            let shieldDmg = 0;
            for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
                if (dmgByType[t] <= 0) continue;
                shieldDmg += dmgByType[t] * (1 - (resists.shield[t] || 0));
            }
            const absorbed = Math.min(this.shield, shieldDmg);
            this.shield -= absorbed;
            this.stats.damageReceivedByLayer.shield += absorbed;
            totalAfterResists += absorbed;
            totalRemaining *= (shieldDmg > 0 ? 1 - absorbed / shieldDmg : 0);
        }
        // Armor
        if (this.armor > 0 && totalRemaining > 0) {
            let armorDmg = 0;
            for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
                if (dmgByType[t] <= 0) continue;
                const ratio = dmgByType[t] / amount;
                armorDmg += totalRemaining * ratio * (1 - (resists.armor[t] || 0));
            }
            const absorbed = Math.min(this.armor, armorDmg);
            this.armor -= absorbed;
            this.stats.damageReceivedByLayer.armor += absorbed;
            totalAfterResists += absorbed;
            totalRemaining *= (armorDmg > 0 ? 1 - absorbed / armorDmg : 0);
        }
        // Hull
        if (totalRemaining > 0) {
            let hullDmg = 0;
            for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
                if (dmgByType[t] <= 0) continue;
                const ratio = dmgByType[t] / amount;
                hullDmg += totalRemaining * ratio * (1 - (resists.hull[t] || 0));
            }
            const hullAbsorbed = Math.min(this.hull, hullDmg);
            this.hull -= hullAbsorbed;
            this.stats.damageReceivedByLayer.hull += hullAbsorbed;
            totalAfterResists += hullAbsorbed;
            // Track overkill on victim
            if (hullDmg > hullAbsorbed) {
                this.stats.overkillDamage += hullDmg - hullAbsorbed;
            }
        }

        // Resist effectiveness: difference between raw and post-resist damage
        this.stats.damageAbsorbedByResist += amount - totalAfterResists;

        this.damageTaken += amount;
        if (source) source.damageDone += amount;

        if (this.hull <= 0) {
            this.alive = false;
            this.hull = 0;
            if (source) {
                source.kills++;
                // Track overkill on source: damage dealt beyond what was needed to kill
                const excess = totalAfterResists - hpBeforeDamage;
                if (excess > 0) source.stats.overkillDamage += excess;
            }
            return true; // killed
        }
        return false;
    }

    update(dt) {
        if (!this.alive) return;

        // Track time alive
        this.stats.timeAlive += dt;

        // Regen
        const capBefore = this.capacitor;
        this.capacitor = Math.min(this.maxCapacitor, this.capacitor + this.capacitorRegen * dt);
        this.stats.capRegenTotal += this.capacitor - capBefore;

        // Track time at zero cap
        if (this.capacitor <= 0.01) this.stats.timeCapEmpty += dt;

        // Passive shield regen
        if (this.shield < this.maxShield) {
            const shieldBefore = this.shield;
            this.shield = Math.min(this.maxShield, this.shield + 1 * dt);
            this.stats.shieldRepaired += this.shield - shieldBefore;
        }
        // Active mid-slot modules (shield booster, armor repairer)
        for (const moduleId of this.modules.mid) {
            if (!moduleId) continue;
            const config = getModuleConfig(moduleId);
            if (!config) continue;
            if (config.shieldRepair && this.shield < this.maxShield) {
                const capCost = config.capacitorUse || 5;
                if (this.capacitor >= capCost * dt) {
                    const shieldBefore = this.shield;
                    this.shield = Math.min(this.maxShield, this.shield + config.shieldRepair * dt * 0.3);
                    this.capacitor -= capCost * dt;
                    this.stats.capUsedOnModules += capCost * dt;
                    this.stats.shieldRepaired += this.shield - shieldBefore;
                }
            }
            if (config.armorRepair && this.armor < this.maxArmor) {
                const capCost = config.capacitorUse || 5;
                if (this.capacitor >= capCost * dt) {
                    const armorBefore = this.armor;
                    this.armor = Math.min(this.maxArmor, this.armor + config.armorRepair * dt * 0.3);
                    this.capacitor -= capCost * dt;
                    this.stats.capUsedOnModules += capCost * dt;
                    this.stats.armorRepaired += this.armor - armorBefore;
                }
            }
        }
        // Rotation
        const diff = angleDifference(this.rotation, this.desiredRotation);
        const maxTurn = this.turnSpeed * dt;
        if (Math.abs(diff) < maxTurn) {
            this.rotation = this.desiredRotation;
        } else {
            this.rotation += Math.sign(diff) * maxTurn;
        }
        this.rotation = normalizeAngle(this.rotation);
        // Velocity
        if (this.currentSpeed < this.desiredSpeed) {
            this.currentSpeed = Math.min(this.desiredSpeed, this.currentSpeed + this.acceleration * dt);
        } else if (this.currentSpeed > this.desiredSpeed) {
            this.currentSpeed = Math.max(this.desiredSpeed, this.currentSpeed - this.acceleration * 2 * dt);
        }
        // Position
        this.x += Math.cos(this.rotation) * this.currentSpeed * dt;
        this.y += Math.sin(this.rotation) * this.currentSpeed * dt;
        // Arena bounds clamping
        this.x = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, this.x));
        this.y = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, this.y));
        // Module cooldowns
        for (const key of Object.keys(this.moduleCooldowns)) {
            this.moduleCooldowns[key] -= dt;
            if (this.moduleCooldowns[key] <= 0) delete this.moduleCooldowns[key];
        }
    }
}

// =============================================
// Battle Engine
// =============================================

class BattleEngine {
    constructor() {
        this.ships = [];
        this.projectiles = [];
        this.state = 'setup'; // setup, running, paused, ended
        this.time = 0;
        this.speedMultiplier = 1;
        this.killFeed = [];
        this.dpsLog = { a: [], b: [] };

        // Teams config
        this.roster = { a: [], b: [] }; // pre-battle ship configs
        this.teamAI = { a: 'brawler', b: 'brawler' };
        this.teamFormation = { a: 'none', b: 'none' };

        // Environment
        this.environment = [];
        this.generateEnvironment();
    }

    generateEnvironment() {
        this.environment = [];
        const rng = () => Math.random();
        const spreadRange = ARENA_HALF * 0.7;

        // 4-6 asteroid clusters
        const clusterCount = 4 + Math.floor(rng() * 3);
        for (let c = 0; c < clusterCount; c++) {
            const cx = (rng() - 0.5) * 2 * spreadRange;
            const cy = (rng() - 0.5) * 2 * spreadRange;
            const asteroidCount = 5 + Math.floor(rng() * 11);
            for (let a = 0; a < asteroidCount; a++) {
                const ax = cx + (rng() - 0.5) * 1500;
                const ay = cy + (rng() - 0.5) * 1500;
                const radius = 30 + rng() * 120;
                const vertexCount = 5 + Math.floor(rng() * 4);
                const vertices = [];
                for (let v = 0; v < vertexCount; v++) {
                    const angle = (v / vertexCount) * Math.PI * 2;
                    const r = radius * (0.6 + rng() * 0.4);
                    vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
                }
                this.environment.push({ type: 'asteroid', x: ax, y: ay, radius, vertices });
            }
        }

        // 2-3 stations
        const stationCount = 2 + Math.floor(rng() * 2);
        const stationVariants = ['ring', 'cross', 'hexagon'];
        for (let s = 0; s < stationCount; s++) {
            const sx = (rng() - 0.5) * 2 * spreadRange;
            const sy = (rng() - 0.5) * 2 * spreadRange;
            const radius = 200 + rng() * 300;
            const variant = stationVariants[s % stationVariants.length];
            this.environment.push({ type: 'station', x: sx, y: sy, radius, variant });
        }
    }

    addToRoster(team, shipId, shipConfig, loadout, count = 1) {
        for (let i = 0; i < count; i++) {
            this.roster[team].push({ shipId, config: { ...shipConfig }, loadout: { ...loadout } });
        }
    }

    removeFromRoster(team, index) {
        this.roster[team].splice(index, 1);
    }

    clearRoster() {
        this.roster = { a: [], b: [] };
    }

    setupBattle(placements) {
        this.ships = [];
        this.projectiles = [];
        this.killFeed = [];
        this.dpsLog = { a: [], b: [] };
        this.time = 0;
        simIdCounter = 0;

        // Build placement lookup: "team-rosterIndex" -> {x, y, rotation}
        const placementMap = {};
        if (placements) {
            for (const p of placements) {
                placementMap[`${p.team}-${p.rosterIndex}`] = p;
            }
        }

        // Spawn Team A ships (left side)
        for (let i = 0; i < this.roster.a.length; i++) {
            const r = this.roster.a[i];
            const ship = new SimShip(r.shipId, r.config, 'a', r.loadout);
            const placed = placementMap[`a-${i}`];
            if (placed) {
                ship.x = placed.x;
                ship.y = placed.y;
                ship.rotation = placed.rotation ?? 0;
            } else {
                ship.x = -3000;
                ship.y = (i - (this.roster.a.length - 1) / 2) * 150;
                ship.rotation = 0;
            }
            ship.desiredRotation = ship.rotation;
            this.ships.push(ship);
        }
        // Spawn Team B ships (right side)
        for (let i = 0; i < this.roster.b.length; i++) {
            const r = this.roster.b[i];
            const ship = new SimShip(r.shipId, r.config, 'b', r.loadout);
            const placed = placementMap[`b-${i}`];
            if (placed) {
                ship.x = placed.x;
                ship.y = placed.y;
                ship.rotation = placed.rotation ?? Math.PI;
            } else {
                ship.x = 3000;
                ship.y = (i - (this.roster.b.length - 1) / 2) * 150;
                ship.rotation = Math.PI;
            }
            ship.desiredRotation = ship.rotation;
            this.ships.push(ship);
        }
    }

    start() {
        if (this.ships.length === 0) this.setupBattle();
        this.state = 'running';
    }

    pause() {
        this.state = 'paused';
    }

    resume() {
        this.state = 'running';
    }

    reset() {
        this.ships = [];
        this.projectiles = [];
        this.killFeed = [];
        this.dpsLog = { a: [], b: [] };
        this.time = 0;
        this.state = 'setup';
        this.generateEnvironment();
    }

    step(dt) {
        if (this.state !== 'running' && this.state !== 'paused') return;

        this.time += dt;

        // Update all ships
        for (const ship of this.ships) {
            ship.update(dt);
        }

        // AI
        this.updateAI(dt);

        // Combat
        this.updateCombat(dt);

        // Projectiles
        this.updateProjectiles(dt);

        // Check victory
        this.checkVictory();
    }

    getTeamShips(team) {
        return this.ships.filter(s => s.team === team && s.alive);
    }

    getEnemies(ship) {
        return this.ships.filter(s => s.team !== ship.team && s.alive);
    }

    updateAI(dt) {
        for (const ship of this.ships) {
            if (!ship.alive) continue;
            ship.aiTimer -= dt;
            if (ship.aiTimer > 0) continue;
            ship.aiTimer = 0.3 + Math.random() * 0.2; // 2-3 Hz

            const profile = AI_PROFILES[this.teamAI[ship.team]] || AI_PROFILES.brawler;
            const enemies = this.getEnemies(ship);

            if (enemies.length === 0) {
                ship.desiredSpeed = 0;
                ship.aiState = 'idle';
                ship.aiIntent = 'No enemies remaining';
                continue;
            }

            // Target selection: focus fire on most damaged enemy
            if (!ship.target || !ship.target.alive) {
                ship.target = enemies.reduce((best, e) => {
                    const hpPct = e.getHpPercent();
                    return !best || hpPct < best.getHpPercent() ? e : best;
                }, null);
            }

            const t = ship.target;
            if (!t) continue;

            const dist = distance(ship.x, ship.y, t.x, t.y);
            const maxRange = ship.getMaxWeaponRange();
            const desiredRange = maxRange * profile.preferredRange;
            ship.distToTarget = dist;
            ship.aiDesiredRange = desiredRange;

            // Flee check
            if (ship.getHpPercent() < profile.fleeHpPct) {
                const cx = enemies.reduce((s, e) => s + e.x, 0) / enemies.length;
                const cy = enemies.reduce((s, e) => s + e.y, 0) / enemies.length;
                const fleeAngle = angleBetween(cx, cy, ship.x, ship.y);
                ship.desiredRotation = fleeAngle;
                ship.desiredSpeed = ship.maxSpeed;
                ship.aiState = 'flee';
                ship.aiIntent = `Fleeing (HP ${(ship.getHpPercent() * 100).toFixed(0)}% < ${(profile.fleeHpPct * 100).toFixed(0)}% threshold)`;
                continue;
            }

            // Move to desired range
            if (dist > desiredRange + 100) {
                ship.desiredRotation = angleBetween(ship.x, ship.y, t.x, t.y);
                ship.desiredSpeed = ship.maxSpeed;
                ship.aiState = 'approach';
                ship.aiIntent = `Closing to ${Math.round(desiredRange)}m (currently ${Math.round(dist)}m)`;
            } else if (dist < desiredRange - 100) {
                ship.desiredRotation = angleBetween(t.x, t.y, ship.x, ship.y);
                ship.desiredSpeed = ship.maxSpeed * 0.6;
                ship.aiState = 'kite';
                ship.aiIntent = `Backing off to ${Math.round(desiredRange)}m (too close at ${Math.round(dist)}m)`;
            } else {
                const angleToTarget = angleBetween(ship.x, ship.y, t.x, t.y);
                const orbitAngle = angleToTarget + Math.PI / 2;
                ship.desiredRotation = orbitAngle;
                ship.desiredSpeed = ship.maxSpeed * profile.orbitSpeed;
                ship.aiState = 'orbit';
                ship.aiIntent = `Orbiting at ${Math.round(dist)}m (desired ${Math.round(desiredRange)}m)`;
            }

            // Formation adjustments
            const formation = this.teamFormation[ship.team];
            if (formation !== 'none') {
                const allies = this.getTeamShips(ship.team);
                const idx = allies.indexOf(ship);
                const offsets = FORMATION_OFFSETS[formation](allies.length);
                if (offsets[idx]) {
                    const leader = allies[0];
                    const formX = leader.x + offsets[idx].x;
                    const formY = leader.y + offsets[idx].y;
                    if (idx > 0) {
                        const formDist = distance(ship.x, ship.y, formX, formY);
                        if (formDist > 200) {
                            const blendAngle = angleBetween(ship.x, ship.y, formX, formY);
                            ship.desiredRotation = blendAngle;
                        }
                    }
                }
            }
        }
    }

    calculateHitChance(source, target, dist, weaponConfig) {
        const tracking = weaponConfig.trackingSpeed || 0.5;
        const optimal = weaponConfig.optimalRange || weaponConfig.range || 500;
        const falloff = weaponConfig.falloff || 150;

        // Angular velocity estimation
        const targetSpeed = target.currentSpeed || 0;
        const angVel = (targetSpeed / Math.max(dist, 50)) * (target.signatureRadius / 28);
        const trackingFactor = tracking / Math.max(angVel, 0.01);
        let hitChance = Math.min(1.0, trackingFactor * 0.5);

        // Range modifier
        if (dist > optimal) {
            const rangemod = Math.pow(0.5, Math.pow((dist - optimal) / Math.max(falloff, 1), 2));
            hitChance *= rangemod;
        }

        return Math.max(0.05, Math.min(0.95, hitChance));
    }

    updateCombat(dt) {
        for (const ship of this.ships) {
            if (!ship.alive) {
                ship.weaponDetails = [];
                continue;
            }

            const target = ship.target;
            const hasTarget = target && target.alive;
            const dist = hasTarget ? distance(ship.x, ship.y, target.x, target.y) : Infinity;
            const damageMult = ship.config.damageMultiplier || 1;

            // Track time in combat
            if (hasTarget) ship.stats.timeInCombat += dt;

            // Low-slot damage bonus
            let lowDmgMult = 1;
            for (const moduleId of ship.modules.low) {
                if (!moduleId) continue;
                const config = getModuleConfig(moduleId);
                if (config?.damageBonus) lowDmgMult *= config.damageBonus;
                if (config?.maserDamageBonus) lowDmgMult *= config.maserDamageBonus;
                if (config?.missileDamageBonus) lowDmgMult *= config.missileDamageBonus;
            }

            // Build weapon details for inspector + fire weapons
            ship.weaponDetails = [];
            for (let i = 0; i < ship.modules.high.length; i++) {
                const moduleId = ship.modules.high[i];
                if (!moduleId) continue;
                const config = getModuleConfig(moduleId);
                if (!config) continue;

                const isWeapon = config.damage && config.cycleTime;
                const cooldownKey = `high-${i}`;
                const onCooldown = (ship.moduleCooldowns[cooldownKey] || 0) > 0;
                const weaponRange = config.range || (config.optimalRange || 500) + (config.falloff || 150);
                const isMissile = config.category === 'missile';
                const hitChance = (isWeapon && hasTarget) ? (isMissile ? 1.0 : this.calculateHitChance(ship, target, dist, config)) : 0;
                const inRange = hasTarget && dist <= weaponRange * 1.1;

                // Initialize per-weapon stats entry if needed
                if (isWeapon && !ship.stats.weapons[cooldownKey]) {
                    ship.stats.weapons[cooldownKey] = {
                        moduleId,
                        name: config.name,
                        shots: 0, hits: 0, misses: 0,
                        totalDamage: 0, capUsed: 0,
                        damageByType: { em: 0, thermal: 0, kinetic: 0, explosive: 0 },
                    };
                }

                const detail = {
                    name: config.name,
                    moduleId,
                    slot: `H${i + 1}`,
                    range: weaponRange,
                    optimal: config.optimalRange || config.range || 0,
                    falloff: config.falloff || 0,
                    tracking: config.trackingSpeed || 0,
                    explosionRadius: config.explosionRadius || 0,
                    explosionVelocity: config.explosionVelocity || 0,
                    hitChance: hitChance,
                    damage: config.damage || 0,
                    dps: isWeapon ? (config.damage / config.cycleTime) * damageMult * lowDmgMult : 0,
                    cycleTime: config.cycleTime || 0,
                    capUse: config.capacitorUse || 0,
                    onCooldown,
                    cooldownRemaining: ship.moduleCooldowns[cooldownKey] || 0,
                    inRange,
                    damageType: config.damageType || config.category || 'em',
                    category: config.category || 'unknown',
                };
                ship.weaponDetails.push(detail);

                // Actually fire if ready
                if (!isWeapon || !hasTarget || !inRange || onCooldown) continue;

                const capCost = config.capacitorUse || 0;
                if (ship.capacitor < capCost) {
                    // Track dry cycle (weapon couldn't fire due to cap)
                    ship.stats.weaponsDryCycles++;
                    continue;
                }
                ship.capacitor -= capCost;
                ship.stats.capUsedOnWeapons += capCost;
                if (ship.stats.weapons[cooldownKey]) ship.stats.weapons[cooldownKey].capUsed += capCost;

                ship.moduleCooldowns[cooldownKey] = config.cycleTime;

                // Track shot
                ship.stats.totalShots++;
                if (ship.stats.weapons[cooldownKey]) ship.stats.weapons[cooldownKey].shots++;

                // PDS intercept check for missiles
                if (isMissile) {
                    const allies = this.ships.filter(s => s.team === target.team && s.alive);
                    const pdsChance = target.getPdsChance(allies);
                    target.stats.pdsFired++;
                    if (pdsChance > 0 && Math.random() < pdsChance) {
                        target.stats.pdsIntercepted++;
                        // Intercepted - still counts as a "miss" for accuracy
                        ship.stats.totalMisses++;
                        if (ship.stats.weapons[cooldownKey]) ship.stats.weapons[cooldownKey].misses++;
                        // Projectile visual (still show it, but it's intercepted)
                        this.projectiles.push({
                            sx: ship.x, sy: ship.y,
                            tx: target.x, ty: target.y,
                            life: 0.3, maxLife: 0.3,
                            team: ship.team,
                            isMissile: true,
                            intercepted: true,
                        });
                        continue; // Skip damage
                    }
                }

                if (isMissile || Math.random() < hitChance) {
                    let dmg = config.damage * damageMult * lowDmgMult;

                    // Missile explosion radius vs target signature damage application
                    if (isMissile) {
                        const expRadius = config.explosionRadius || 100;
                        const expVelocity = config.explosionVelocity || 100;
                        const tSig = target.signatureRadius || 30;
                        const tSpeed = target.currentSpeed || 0;
                        const sigFactor = Math.min(1.0, tSig / expRadius);
                        const velFactor = tSpeed > 0
                            ? Math.min(1.0, (tSig / expRadius) * (expVelocity / tSpeed))
                            : 1.0;
                        dmg *= Math.min(sigFactor, velFactor);
                        dmg = Math.max(1, Math.round(dmg));
                    }

                    const dmgProfile = config.damageProfile || (config.damageType ? { [config.damageType]: 1 } : { em: 1 });

                    // Track hit
                    ship.stats.totalHits++;
                    if (ship.stats.weapons[cooldownKey]) {
                        ship.stats.weapons[cooldownKey].hits++;
                        ship.stats.weapons[cooldownKey].totalDamage += dmg;
                        // Track damage by type for this weapon
                        const pSum = (dmgProfile.em || 0) + (dmgProfile.thermal || 0) + (dmgProfile.kinetic || 0) + (dmgProfile.explosive || 0);
                        for (const t of ['em', 'thermal', 'kinetic', 'explosive']) {
                            const typeDmg = pSum > 0 ? dmg * ((dmgProfile[t] || 0) / pSum) : 0;
                            ship.stats.weapons[cooldownKey].damageByType[t] += typeDmg;
                            ship.stats.damageDealtByType[t] += typeDmg;
                        }
                    }

                    // Track firstShotTime
                    if (ship.stats.firstShotTime < 0) ship.stats.firstShotTime = this.time;

                    // Track damage dealt by layer (check target layers before damage)
                    const preDmgShield = target.shield;
                    const preDmgArmor = target.armor;
                    const preDmgHull = target.hull;

                    const killed = target.takeDamage(dmg, ship, dmgProfile);

                    // Compute per-layer damage dealt by this source
                    ship.stats.damageDealtByLayer.shield += preDmgShield - target.shield;
                    ship.stats.damageDealtByLayer.armor += preDmgArmor - target.armor;
                    ship.stats.damageDealtByLayer.hull += preDmgHull - target.hull;

                    if (killed) {
                        target.stats.deathTime = this.time;
                        this.killFeed.push({
                            time: this.time,
                            killer: ship.name,
                            killerTeam: ship.team,
                            killed: target.name,
                            killedTeam: target.team,
                        });
                        ship.target = null;
                    }
                } else {
                    // Track miss
                    ship.stats.totalMisses++;
                    if (ship.stats.weapons[cooldownKey]) ship.stats.weapons[cooldownKey].misses++;
                }

                // Projectile visual
                this.projectiles.push({
                    sx: ship.x, sy: ship.y,
                    tx: target.x, ty: target.y,
                    life: 0.3,
                    maxLife: 0.3,
                    team: ship.team,
                    isMissile: config.category === 'missile',
                });
            }
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].life -= dt;
            if (this.projectiles[i].life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    checkVictory() {
        const teamAAlive = this.ships.filter(s => s.team === 'a' && s.alive).length;
        const teamBAlive = this.ships.filter(s => s.team === 'b' && s.alive).length;

        if (teamAAlive === 0 || teamBAlive === 0) {
            this.state = 'ended';
            this.winner = teamAAlive > 0 ? 'a' : (teamBAlive > 0 ? 'b' : 'draw');
        }
        // Time limit: 5 minutes
        if (this.time > 300 && this.state === 'running') {
            this.state = 'ended';
            const aHp = this.ships.filter(s => s.team === 'a').reduce((s, sh) => s + sh.shield + sh.armor + sh.hull, 0);
            const bHp = this.ships.filter(s => s.team === 'b').reduce((s, sh) => s + sh.shield + sh.armor + sh.hull, 0);
            this.winner = aHp > bHp ? 'a' : (bHp > aHp ? 'b' : 'draw');
        }
    }

    getTeamDps(team) {
        return this.ships
            .filter(s => s.team === team && s.alive)
            .reduce((sum, s) => sum + s.getDps(), 0);
    }

    getResults() {
        const shipResults = this.ships.map(s => {
            const st = s.stats;
            const timeInCombat = Math.max(st.timeInCombat, 0.001);
            const timeAlive = Math.max(st.timeAlive, 0.001);
            const totalShots = Math.max(st.totalShots, 1);
            const resists = s.getEffectiveResists();
            const ehp = s.getEffectiveHp();
            const capUsedTotal = st.capUsedOnWeapons + st.capUsedOnModules;

            // Build per-weapon array
            const weapons = Object.entries(st.weapons).map(([slot, w]) => ({
                slot,
                name: w.name,
                moduleId: w.moduleId,
                shots: w.shots,
                hits: w.hits,
                misses: w.misses,
                accuracy: w.shots > 0 ? w.hits / w.shots : 0,
                totalDamage: Math.round(w.totalDamage),
                dps: w.totalDamage / timeInCombat,
                capUsed: Math.round(w.capUsed),
                damageByType: { ...w.damageByType },
            }));

            return {
                name: s.name,
                shipId: s.shipId,
                team: s.team,
                alive: s.alive,
                shipSize: s.shipSize,
                role: s.config.role,
                loadout: {
                    high: [...s.modules.high],
                    mid: [...s.modules.mid],
                    low: [...s.modules.low],
                },
                hpRemaining: s.alive ? Math.round(s.shield + s.armor + s.hull) : 0,
                ehpStart: Math.round(ehp),
                effectiveResists: resists,
                damageDone: Math.round(s.damageDone),
                damageTaken: Math.round(s.damageTaken),
                dps: s.damageDone / timeInCombat,
                appliedDps: s.damageDone / timeAlive,
                totalShots: st.totalShots,
                totalHits: st.totalHits,
                totalMisses: st.totalMisses,
                accuracy: st.totalShots > 0 ? st.totalHits / st.totalShots : 0,
                weapons,
                damageDealtByLayer: { ...st.damageDealtByLayer },
                damageReceivedByLayer: { ...st.damageReceivedByLayer },
                damageDealtByType: { ...st.damageDealtByType },
                damageReceivedByType: { ...st.damageReceivedByType },
                rawDamageReceived: Math.round(st.rawDamageReceived),
                damageAbsorbedByResist: Math.round(st.damageAbsorbedByResist),
                resistEfficiency: st.rawDamageReceived > 0 ? st.damageAbsorbedByResist / st.rawDamageReceived : 0,
                capUsedTotal: Math.round(capUsedTotal),
                capUsedOnWeapons: Math.round(st.capUsedOnWeapons),
                capUsedOnModules: Math.round(st.capUsedOnModules),
                capRegenTotal: Math.round(st.capRegenTotal),
                capEfficiency: st.capRegenTotal > 0 ? capUsedTotal / st.capRegenTotal : 0,
                timeCapEmpty: +st.timeCapEmpty.toFixed(2),
                weaponsDryCycles: st.weaponsDryCycles,
                shieldRepaired: Math.round(st.shieldRepaired),
                armorRepaired: Math.round(st.armorRepaired),
                timeAlive: +st.timeAlive.toFixed(2),
                timeInCombat: +st.timeInCombat.toFixed(2),
                firstShotTime: st.firstShotTime >= 0 ? +st.firstShotTime.toFixed(2) : -1,
                deathTime: st.deathTime >= 0 ? +st.deathTime.toFixed(2) : -1,
                overkillDamage: Math.round(st.overkillDamage),
                kills: s.kills,
                pdsChance: +s.getPdsChance(this.ships.filter(sh => sh.team === s.team && sh.alive)).toFixed(3),
                pdsFired: st.pdsFired,
                pdsIntercepted: st.pdsIntercepted,
            };
        });

        // Team aggregates
        const teamStats = {};
        for (const team of ['a', 'b']) {
            const teamShips = shipResults.filter(s => s.team === team);
            const alive = teamShips.filter(s => s.alive);
            const totalDamage = teamShips.reduce((sum, s) => sum + s.damageDone, 0);
            const totalShots = teamShips.reduce((sum, s) => sum + s.totalShots, 0);
            const totalHits = teamShips.reduce((sum, s) => sum + s.totalHits, 0);
            teamStats[team] = {
                totalDps: teamShips.reduce((sum, s) => sum + s.dps, 0),
                totalEhp: teamShips.reduce((sum, s) => sum + s.ehpStart, 0),
                shipsAlive: alive.length,
                shipsTotal: teamShips.length,
                totalDamage: Math.round(totalDamage),
                avgAccuracy: totalShots > 0 ? totalHits / totalShots : 0,
                totalKills: teamShips.reduce((sum, s) => sum + s.kills, 0),
            };
        }

        return {
            winner: this.winner,
            time: +this.time.toFixed(2),
            ships: shipResults,
            teamStats,
            killFeed: this.killFeed,
        };
    }
}

// =============================================
// Three.js Renderer
// =============================================

class BattleRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050810);

        // Camera
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const viewSize = ARENA_SIZE * 0.7;
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect, viewSize * aspect,
            viewSize, -viewSize,
            -100, 100
        );
        this.camera.position.set(0, 0, 50);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Pan/zoom state
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 0.3;
        this.dragDisabled = false;

        // Apply initial zoom
        this.updateCamera();

        // Lighting for PBR ship meshes
        const ambientLight = new THREE.AmbientLight(0x446688, 1.4);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(0, 0, 50);
        this.scene.add(dirLight);

        // Grid
        this.createGrid();

        // Arena border
        this.createArenaBorder();

        // Environment meshes
        this.envMeshes = [];

        // Placement zone meshes
        this.placementZoneMeshes = [];

        // Ship meshes map
        this.shipMeshes = new Map();

        // Projectile lines
        this.projectileLines = [];

        // Explosion particles
        this.explosions = [];

        // Targeting lines (shown when paused or hovered)
        this.targetingLines = [];

        // Weapon range rings (shown for selected/hovered ship)
        this.rangeRings = [];

        // Resize handler
        this.onResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.onResize);

        // Mouse controls
        this.setupMouseControls();
    }

    createGrid() {
        // Fine sub-grid: 500-unit spacing
        const fineVerts = [];
        for (let x = -ARENA_HALF; x <= ARENA_HALF; x += 500) {
            if (x % 2500 === 0) continue; // skip major lines
            fineVerts.push(x, -ARENA_HALF, 0, x, ARENA_HALF, 0);
        }
        for (let y = -ARENA_HALF; y <= ARENA_HALF; y += 500) {
            if (y % 2500 === 0) continue;
            fineVerts.push(-ARENA_HALF, y, 0, ARENA_HALF, y, 0);
        }
        const fineGeo = new THREE.BufferGeometry();
        fineGeo.setAttribute('position', new THREE.Float32BufferAttribute(fineVerts, 3));
        const fineMat = new THREE.LineBasicMaterial({ color: 0x0a1628, transparent: true, opacity: 0.15 });
        this.scene.add(new THREE.LineSegments(fineGeo, fineMat));

        // Major grid: 2500-unit spacing
        const majorVerts = [];
        for (let x = -ARENA_HALF; x <= ARENA_HALF; x += 2500) {
            majorVerts.push(x, -ARENA_HALF, 0, x, ARENA_HALF, 0);
        }
        for (let y = -ARENA_HALF; y <= ARENA_HALF; y += 2500) {
            majorVerts.push(-ARENA_HALF, y, 0, ARENA_HALF, y, 0);
        }
        const majorGeo = new THREE.BufferGeometry();
        majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorVerts, 3));
        const majorMat = new THREE.LineBasicMaterial({ color: 0x0a1628, transparent: true, opacity: 0.5 });
        this.scene.add(new THREE.LineSegments(majorGeo, majorMat));
    }

    createArenaBorder() {
        const geo = new THREE.BufferGeometry();
        const h = ARENA_HALF;
        const verts = [-h, -h, 0, h, -h, 0, h, -h, 0, h, h, 0, h, h, 0, -h, h, 0, -h, h, 0, -h, -h, 0];
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0x1e293b });
        this.scene.add(new THREE.LineSegments(geo, mat));
    }

    createEnvironmentMeshes(environment) {
        this.clearEnvironmentMeshes();
        for (const obj of environment) {
            if (obj.type === 'asteroid') {
                const group = new THREE.Group();
                // Filled asteroid shape
                const shape = new THREE.Shape();
                const verts = obj.vertices;
                shape.moveTo(verts[0].x, verts[0].y);
                for (let i = 1; i < verts.length; i++) shape.lineTo(verts[i].x, verts[i].y);
                shape.closePath();
                const geo = new THREE.ShapeGeometry(shape);
                const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a3a, transparent: true, opacity: 0.4 });
                group.add(new THREE.Mesh(geo, mat));
                // Outline
                const pts = verts.map(v => new THREE.Vector3(v.x, v.y, 0.1));
                pts.push(pts[0].clone()); // close loop
                const outGeo = new THREE.BufferGeometry().setFromPoints(pts);
                const outMat = new THREE.LineBasicMaterial({ color: 0x4a4a5a, transparent: true, opacity: 0.3 });
                group.add(new THREE.Line(outGeo, outMat));
                group.position.set(obj.x, obj.y, -1);
                this.scene.add(group);
                this.envMeshes.push(group);
            } else if (obj.type === 'station') {
                const group = new THREE.Group();
                const r = obj.radius;
                // Hub
                const hubGeo = new THREE.CircleGeometry(r * 0.15, 16);
                const hubMat = new THREE.MeshBasicMaterial({ color: 0x3a3a4a, transparent: true, opacity: 0.5 });
                group.add(new THREE.Mesh(hubGeo, hubMat));
                // Variant structure
                if (obj.variant === 'ring') {
                    const ringGeo = new THREE.RingGeometry(r * 0.7, r * 0.8, 32);
                    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2a3a4a, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
                    group.add(new THREE.Mesh(ringGeo, ringMat));
                    // Ring outline
                    const circPts = [];
                    for (let i = 0; i <= 32; i++) {
                        const a = (i / 32) * Math.PI * 2;
                        circPts.push(new THREE.Vector3(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, 0.1));
                    }
                    const circGeo = new THREE.BufferGeometry().setFromPoints(circPts);
                    group.add(new THREE.Line(circGeo, new THREE.LineBasicMaterial({ color: 0x4a5a6a, transparent: true, opacity: 0.3 })));
                } else if (obj.variant === 'cross') {
                    for (let i = 0; i < 4; i++) {
                        const angle = (i / 4) * Math.PI * 2;
                        const armGeo = new THREE.PlaneGeometry(r * 0.1, r * 0.8);
                        const armMat = new THREE.MeshBasicMaterial({ color: 0x2a3a4a, transparent: true, opacity: 0.35 });
                        const arm = new THREE.Mesh(armGeo, armMat);
                        arm.position.set(Math.cos(angle) * r * 0.4, Math.sin(angle) * r * 0.4, 0);
                        arm.rotation.z = angle + Math.PI / 2;
                        group.add(arm);
                    }
                } else if (obj.variant === 'hexagon') {
                    const hexPts = [];
                    for (let i = 0; i <= 6; i++) {
                        const a = (i / 6) * Math.PI * 2;
                        hexPts.push(new THREE.Vector3(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 0.1));
                    }
                    const hexGeo = new THREE.BufferGeometry().setFromPoints(hexPts);
                    group.add(new THREE.Line(hexGeo, new THREE.LineBasicMaterial({ color: 0x4a5a6a, transparent: true, opacity: 0.4 })));
                    // Inner hexagon
                    const innerPts = [];
                    for (let i = 0; i <= 6; i++) {
                        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
                        innerPts.push(new THREE.Vector3(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, 0.1));
                    }
                    const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPts);
                    group.add(new THREE.Line(innerGeo, new THREE.LineBasicMaterial({ color: 0x3a4a5a, transparent: true, opacity: 0.3 })));
                }
                group.position.set(obj.x, obj.y, -1);
                this.scene.add(group);
                this.envMeshes.push(group);
            }
        }
    }

    clearEnvironmentMeshes() {
        for (const group of this.envMeshes) {
            group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.scene.remove(group);
        }
        this.envMeshes = [];
    }

    showPlacementZones(team) {
        this.hidePlacementZones();
        const zones = team === 'a'
            ? [{ zone: PLACEMENT_ZONE_A, color: 0x3b82f6 }]
            : team === 'b'
            ? [{ zone: PLACEMENT_ZONE_B, color: 0xef4444 }]
            : [{ zone: PLACEMENT_ZONE_A, color: 0x3b82f6 }, { zone: PLACEMENT_ZONE_B, color: 0xef4444 }];

        for (const { zone, color } of zones) {
            const w = zone.xMax - zone.xMin;
            const h = PLACEMENT_Y_RANGE.yMax - PLACEMENT_Y_RANGE.yMin;
            const geo = new THREE.PlaneGeometry(w, h);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.04, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(zone.xMin + w / 2, 0, -0.5);
            this.scene.add(mesh);
            this.placementZoneMeshes.push(mesh);

            // Zone border
            const borderVerts = [
                zone.xMin, PLACEMENT_Y_RANGE.yMin, -0.4,
                zone.xMax, PLACEMENT_Y_RANGE.yMin, -0.4,
                zone.xMax, PLACEMENT_Y_RANGE.yMax, -0.4,
                zone.xMin, PLACEMENT_Y_RANGE.yMax, -0.4,
                zone.xMin, PLACEMENT_Y_RANGE.yMin, -0.4,
            ];
            const borderGeo = new THREE.BufferGeometry();
            borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderVerts, 3));
            const borderMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 });
            const borderLine = new THREE.Line(borderGeo, borderMat);
            this.scene.add(borderLine);
            this.placementZoneMeshes.push(borderLine);
        }
    }

    hidePlacementZones() {
        for (const mesh of this.placementZoneMeshes) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.placementZoneMeshes = [];
    }

    createGhostMesh(shipConfig, team, opacity = 0.35) {
        const group = new THREE.Group();
        const sizeScale = {
            frigate: 1, destroyer: 1.3, cruiser: 1.7,
            battlecruiser: 2.2, battleship: 2.8, capital: 3.5
        }[shipConfig.size] || 1;

        const s = 30 * sizeScale;
        const shape = new THREE.Shape();
        shape.moveTo(s, 0);
        shape.lineTo(-s * 0.6, s * 0.5);
        shape.lineTo(-s * 0.3, 0);
        shape.lineTo(-s * 0.6, -s * 0.5);
        shape.closePath();

        const teamColor = team === 'a' ? 0x3b82f6 : 0xef4444;
        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity });
        group.add(new THREE.Mesh(geo, mat));

        // Outline
        const pts = shape.getPoints(20).map(p => new THREE.Vector3(p.x, p.y, 0.1));
        const outGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const outMat = new THREE.LineBasicMaterial({
            color: team === 'a' ? 0x60a5fa : 0xf87171,
            transparent: true, opacity: opacity * 1.5
        });
        group.add(new THREE.LineLoop(outGeo, outMat));

        group.position.set(0, 0, 5);
        this.scene.add(group);
        return group;
    }

    removeGhostMesh(ghost) {
        if (!ghost) return;
        ghost.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.scene.remove(ghost);
    }

    setupMouseControls() {
        let dragging = false;
        let lastX = 0, lastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.dragDisabled) return;
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });
        window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            const scale = (ARENA_SIZE * 1.4 / this.zoom) / this.canvas.clientHeight;
            this.panOffset.x -= dx * scale;
            this.panOffset.y += dy * scale;
            this.updateCamera();
        });
        window.addEventListener('mouseup', () => { dragging = false; });
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.85 : 1.18;
            this.zoom = Math.max(0.01, Math.min(200, this.zoom * factor));
            this.updateCamera();
        });
    }

    updateCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        const viewSize = (ARENA_SIZE * 0.7) / this.zoom;
        this.camera.left = -viewSize * aspect + this.panOffset.x;
        this.camera.right = viewSize * aspect + this.panOffset.x;
        this.camera.top = viewSize + this.panOffset.y;
        this.camera.bottom = -viewSize + this.panOffset.y;
        this.camera.updateProjectionMatrix();
    }

    handleResize() {
        const w = this.canvas.parentElement.clientWidth;
        const h = this.canvas.parentElement.clientHeight;
        this.renderer.setSize(w, h);
        this.updateCamera();
    }

    createShipMesh(ship) {
        const group = new THREE.Group();

        // Use real game ShipMeshFactory for detailed ship meshes
        const roleMap = {
            mercenary: 'mercenary', pirate: 'pirate', military: 'military',
            police: 'police', mining: 'mining', hauler: 'hauler',
            logistics: 'logistics', surveyor: 'surveyor', salvager: 'salvager',
            harvester: 'harvester',
        };
        const role = roleMap[ship.config.role] || 'mercenary';

        try {
            const realMesh = shipMeshFactory.generateShipMesh({
                shipId: ship.shipId || `sim-${ship.id}`,
                role: role,
                size: ship.shipSize || 'frigate',
                detailLevel: 'low',
            });
            if (realMesh && realMesh.children.length > 0) {
                group.add(realMesh);
            } else {
                throw new Error('generateShipMesh returned empty group');
            }
        } catch (err) {
            console.error(`[BattleSim] Ship mesh factory failed for ${ship.name} (${ship.shipId}, role=${role}, size=${ship.shipSize}):`, err);
            // Fallback: simple triangle if factory fails
            const sizeScale = {
                frigate: 1, destroyer: 1.3, cruiser: 1.7,
                battlecruiser: 2.2, battleship: 2.8, capital: 3.5
            }[ship.shipSize] || 1;
            const s = 30 * sizeScale;
            const shape = new THREE.Shape();
            shape.moveTo(s, 0);
            shape.lineTo(-s * 0.6, s * 0.5);
            shape.lineTo(-s * 0.3, 0);
            shape.lineTo(-s * 0.6, -s * 0.5);
            shape.closePath();
            const teamColor = ship.team === 'a' ? 0x3b82f6 : 0xef4444;
            group.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: teamColor })));
        }

        // Team color tint ring around ship for team identification
        const sizeRadius = {
            frigate: 22, destroyer: 40, cruiser: 75,
            battlecruiser: 115, battleship: 185, capital: 325
        }[ship.shipSize] || 22;
        const teamColor = ship.team === 'a' ? 0x3b82f6 : 0xef4444;
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(sizeRadius * 0.9, sizeRadius * 1.0, 24),
            new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        );
        ring.position.z = 0.1;
        group.add(ring);

        // ----- Floating HP bars (unrotated, always face camera) -----
        // Store in a separate group that counters parent rotation
        const hpGroup = new THREE.Group();
        const barWidth = sizeRadius * 1.8;
        const barHeight = Math.max(3, sizeRadius * 0.08);
        const barY = sizeRadius * 1.1 + 8;

        // Background
        const hpBg = new THREE.Mesh(
            new THREE.PlaneGeometry(barWidth + 2, barHeight * 3 + 4),
            new THREE.MeshBasicMaterial({ color: 0x0a0e18, transparent: true, opacity: 0.85 })
        );
        hpBg.position.set(0, barY, 0.2);
        hpGroup.add(hpBg);

        // Three separate bars: shield on top, armor middle, hull bottom
        const mkBar = (color, yOff, zOff) => {
            const m = new THREE.Mesh(
                new THREE.PlaneGeometry(barWidth, barHeight),
                new THREE.MeshBasicMaterial({ color })
            );
            m.position.set(0, barY + yOff, 0.3 + zOff);
            hpGroup.add(m);
            return m;
        };
        ship._hpBarShield = mkBar(0x3b82f6, barHeight + 1, 0);
        ship._hpBarArmor  = mkBar(0xf59e0b, 0, 0.01);
        ship._hpBarHull   = mkBar(0xef4444, -(barHeight + 1), 0.02);
        ship._hpBarWidth = barWidth;
        ship._hpBarY = barY;
        ship._hpGroup = hpGroup;

        group.add(hpGroup);

        group.position.set(ship.x, ship.y, 0);
        group.rotation.z = ship.rotation;
        this.scene.add(group);
        this.shipMeshes.set(ship.id, group);
        ship.mesh = group;
    }

    updateShipMesh(ship) {
        const group = this.shipMeshes.get(ship.id);
        if (!group) return;

        if (!ship.alive) {
            group.visible = false;
            return;
        }

        group.visible = true;
        group.position.set(ship.x, ship.y, 0);
        group.rotation.z = ship.rotation;

        // Counter-rotate HP bar group so it stays upright
        if (ship._hpGroup) {
            ship._hpGroup.rotation.z = -ship.rotation;
        }

        // Update HP bars - each bar shows its own layer as fraction of its own max
        const w = ship._hpBarWidth;

        const sPct = ship.maxShield > 0 ? ship.shield / ship.maxShield : 0;
        const aPct = ship.maxArmor > 0 ? ship.armor / ship.maxArmor : 0;
        const hPct = ship.maxHull > 0 ? ship.hull / ship.maxHull : 0;

        ship._hpBarShield.scale.x = Math.max(0.001, sPct);
        ship._hpBarShield.position.x = -w * (1 - sPct) / 2;

        ship._hpBarArmor.scale.x = Math.max(0.001, aPct);
        ship._hpBarArmor.position.x = -w * (1 - aPct) / 2;

        ship._hpBarHull.scale.x = Math.max(0.001, hPct);
        ship._hpBarHull.position.x = -w * (1 - hPct) / 2;
    }

    addProjectileLine(proj) {
        const t = proj.life / proj.maxLife;
        const cx = proj.sx + (proj.tx - proj.sx) * (1 - t);
        const cy = proj.sy + (proj.ty - proj.sy) * (1 - t);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([
            proj.sx, proj.sy, 1, cx, cy, 1
        ], 3));
        const color = proj.team === 'a' ? 0x60a5fa : 0xf87171;
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: t });
        const line = new THREE.LineSegments(geo, mat);
        this.scene.add(line);
        return line;
    }

    addExplosion(x, y) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(5, 8, 16),
            new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 1, side: THREE.DoubleSide })
        );
        ring.position.set(x, y, 2);
        this.scene.add(ring);
        this.explosions.push({ mesh: ring, life: 0.6, maxLife: 0.6, x, y });
    }

    updateExplosions(dt) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= dt;
            const t = 1 - exp.life / exp.maxLife;
            exp.mesh.scale.set(1 + t * 4, 1 + t * 4, 1);
            exp.mesh.material.opacity = 1 - t;
            if (exp.life <= 0) {
                this.scene.remove(exp.mesh);
                exp.mesh.geometry.dispose();
                exp.mesh.material.dispose();
                this.explosions.splice(i, 1);
            }
        }
    }

    worldToScreen(wx, wy) {
        const vec = new THREE.Vector3(wx, wy, 0);
        vec.project(this.camera);
        return {
            x: (vec.x + 1) / 2 * this.canvas.clientWidth,
            y: (-vec.y + 1) / 2 * this.canvas.clientHeight,
        };
    }

    screenToWorld(sx, sy) {
        const vec = new THREE.Vector3(
            (sx / this.canvas.clientWidth) * 2 - 1,
            -(sy / this.canvas.clientHeight) * 2 + 1,
            0
        );
        vec.unproject(this.camera);
        return { x: vec.x, y: vec.y };
    }

    findShipAtScreen(sx, sy, ships) {
        const world = this.screenToWorld(sx, sy);
        let closest = null;
        let closestDist = Infinity;
        // Scale pick radius with zoom so clicking works at all zoom levels
        const pickRadius = Math.max(50, 100 / this.zoom);
        for (const ship of ships) {
            if (!ship.alive) continue;
            const d = distance(world.x, world.y, ship.x, ship.y);
            if (d < pickRadius && d < closestDist) {
                closest = ship;
                closestDist = d;
            }
        }
        return closest;
    }

    updateTargetingLines(engine, highlightShip) {
        // Clear old lines
        for (const line of this.targetingLines) {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.targetingLines = [];

        // Show targeting lines: either for all ships (when paused) or just for highlighted ship
        const shipsToShow = highlightShip
            ? [highlightShip]
            : (engine.state === 'paused' ? engine.ships.filter(s => s.alive) : []);

        for (const ship of shipsToShow) {
            if (!ship.target || !ship.target.alive) continue;
            const t = ship.target;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute([
                ship.x, ship.y, 3, t.x, t.y, 3
            ], 3));
            const color = ship.team === 'a' ? 0x3b82f6 : 0xef4444;
            const mat = new THREE.LineDashedMaterial({
                color, transparent: true, opacity: 0.4,
                dashSize: 30, gapSize: 20,
            });
            const line = new THREE.LineSegments(geo, mat);
            line.computeLineDistances();
            this.scene.add(line);
            this.targetingLines.push(line);
        }
    }

    updateRangeRings(ship) {
        // Clear old rings
        for (const ring of this.rangeRings) {
            this.scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
        this.rangeRings = [];

        if (!ship || !ship.alive) return;

        // Color per weapon category
        const WEAPON_COLORS = {
            maser:   0x3b82f6,   // blue
            railgun: 0x22c55e,   // green
            missile: 0xef4444,   // red
            mining:  0xf59e0b,   // amber
            default: 0xa78bfa,   // purple
        };

        // Collect unique ranges per weapon type to avoid overlapping identical rings
        const rangeMap = new Map(); // "category-range" -> { range, optimal, falloff, color, name }
        for (const w of (ship.weaponDetails || [])) {
            if (!w.range || w.range <= 0) continue;
            let cat = 'default';
            const id = (w.moduleId || '').toLowerCase();
            if (id.includes('maser') || id.includes('beam')) cat = 'maser';
            else if (id.includes('railgun') || id.includes('cannon') || id.includes('autocannon')) cat = 'railgun';
            else if (id.includes('missile') || id.includes('torpedo') || id.includes('rocket')) cat = 'missile';
            else if (id.includes('mining') || id.includes('miner') || id.includes('laser')) cat = 'mining';

            const key = `${cat}-${w.optimal}-${w.falloff}`;
            if (!rangeMap.has(key)) {
                rangeMap.set(key, {
                    optimal: w.optimal || w.range,
                    falloff: w.falloff || 0,
                    range: w.range,
                    color: WEAPON_COLORS[cat] || WEAPON_COLORS.default,
                    name: w.name,
                });
            }
        }

        // Also check modules directly if weaponDetails not populated yet (setup phase)
        if (rangeMap.size === 0) {
            for (const moduleId of ship.modules.high) {
                if (!moduleId) continue;
                const config = getModuleConfig(moduleId);
                if (!config) continue;
                const optimal = config.optimalRange || config.range || 0;
                const falloff = config.falloff || 0;
                const range = config.range || (optimal + falloff);
                if (range <= 0) continue;

                let cat = 'default';
                const id = moduleId.toLowerCase();
                if (id.includes('maser') || id.includes('beam')) cat = 'maser';
                else if (id.includes('railgun') || id.includes('cannon')) cat = 'railgun';
                else if (id.includes('missile') || id.includes('torpedo') || id.includes('rocket')) cat = 'missile';
                else if (id.includes('mining') || id.includes('miner') || id.includes('laser')) cat = 'mining';

                const key = `${cat}-${optimal}-${falloff}`;
                if (!rangeMap.has(key)) {
                    rangeMap.set(key, { optimal, falloff, range, color: WEAPON_COLORS[cat] || WEAPON_COLORS.default, name: config.name });
                }
            }
        }

        for (const [, info] of rangeMap) {
            // Optimal range ring (solid)
            if (info.optimal > 0) {
                const optGeo = new THREE.RingGeometry(info.optimal - 2, info.optimal + 2, 64);
                const optMat = new THREE.MeshBasicMaterial({
                    color: info.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide
                });
                const optMesh = new THREE.Mesh(optGeo, optMat);
                optMesh.position.set(ship.x, ship.y, 4);
                this.scene.add(optMesh);
                this.rangeRings.push(optMesh);
            }

            // Falloff zone (faded band from optimal to optimal+falloff)
            if (info.falloff > 0 && info.optimal > 0) {
                const outerR = info.optimal + info.falloff;
                const fallGeo = new THREE.RingGeometry(info.optimal, outerR, 64);
                const fallMat = new THREE.MeshBasicMaterial({
                    color: info.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide
                });
                const fallMesh = new THREE.Mesh(fallGeo, fallMat);
                fallMesh.position.set(ship.x, ship.y, 3.9);
                this.scene.add(fallMesh);
                this.rangeRings.push(fallMesh);
            }

            // Max range ring (dashed outline) if different from optimal
            if (info.range > info.optimal + 5) {
                const maxGeo = new THREE.RingGeometry(info.range - 1, info.range + 1, 64);
                const maxMat = new THREE.MeshBasicMaterial({
                    color: info.color, transparent: true, opacity: 0.15, side: THREE.DoubleSide
                });
                const maxMesh = new THREE.Mesh(maxGeo, maxMat);
                maxMesh.position.set(ship.x, ship.y, 3.8);
                this.scene.add(maxMesh);
                this.rangeRings.push(maxMesh);
            }
        }
    }

    render(engine) {
        // Ensure all ships have meshes
        for (const ship of engine.ships) {
            if (!this.shipMeshes.has(ship.id)) {
                this.createShipMesh(ship);
            }
            this.updateShipMesh(ship);
        }

        // Clean up old projectile lines
        for (const line of this.projectileLines) {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.projectileLines = [];

        // Add current projectiles
        for (const proj of engine.projectiles) {
            const line = this.addProjectileLine(proj);
            this.projectileLines.push(line);
        }

        // Check for new deaths and add explosions
        for (const ship of engine.ships) {
            if (!ship.alive && ship.deathTime === 0) {
                ship.deathTime = engine.time;
                this.addExplosion(ship.x, ship.y);
            }
        }

        // Update explosions
        const dt = 1 / 60;
        this.updateExplosions(dt);

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        window.removeEventListener('resize', this.onResize);
        for (const ring of this.rangeRings) {
            this.scene.remove(ring);
            ring.geometry.dispose();
            ring.material.dispose();
        }
        this.rangeRings = [];
        for (const line of this.targetingLines) {
            this.scene.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.targetingLines = [];
        this.clearEnvironmentMeshes();
        this.hidePlacementZones();
        this.renderer.dispose();
    }
}

// =============================================
// UI Controller
// =============================================

class BattleSimUI {
    constructor() {
        this.engine = new BattleEngine();
        this.renderer = null;
        this.selectedTeam = 'a';
        this.selectedShipId = null;
        this.selectedConfig = null;
        this.loadoutMode = 'default';
        this.customLoadout = { high: [], mid: [], low: [] };
        this.animFrame = null;
        this.lastTime = 0;

        // Tooltip state
        this.hoveredShip = null;
        this.pinnedShip = null;
        this.tooltipEl = document.getElementById('ship-tooltip');

        // Placement state
        this.placementMode = null; // null | 'place-single' | 'place-squad'
        this.placementTeam = null;
        this.placementQueue = [];
        this.placedShips = []; // [{rosterIndex, team, x, y, rotation, mesh}]
        this.ghostMesh = null;
        this.squadGhosts = [];
        this.draggingPlacedShip = null;
        this.dragOffset = { x: 0, y: 0 };

        this.initRenderer();
        this.populateFactionFilter();
        this.renderShipCards();
        this.bindEvents();
        this.renderRoster();
        this.startRenderLoop();
    }

    initRenderer() {
        const canvas = document.getElementById('battle-canvas');
        // Wait a frame for layout
        requestAnimationFrame(() => {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            this.renderer = new BattleRenderer(canvas);
            // Show environment immediately in setup phase
            this.renderer.createEnvironmentMeshes(this.engine.environment);
        });
    }

    populateFactionFilter() {
        const select = document.getElementById('filter-faction');
        for (const [id, faction] of Object.entries(FACTIONS)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = faction.name;
            select.appendChild(opt);
        }
    }

    getFilteredShips() {
        const faction = document.getElementById('filter-faction').value;
        const size = document.getElementById('filter-size').value;
        const role = document.getElementById('filter-role').value;

        let entries;

        if (faction !== 'all') {
            // Show faction-overlaid ships
            const variants = FACTION_SHIP_VARIANTS[faction] || [];
            entries = [];
            for (const shipId of variants) {
                const base = SHIP_DATABASE[shipId];
                if (!base) continue;
                const overlaid = applyFactionOverlay(base, shipId, faction);
                entries.push([`${faction}-${shipId}`, overlaid, shipId]);
            }
        } else {
            entries = Object.entries(SHIP_DATABASE).map(([id, s]) => [id, s, id]);
        }

        return entries.filter(([, ship]) => {
            if (size !== 'all' && ship.size !== size) return false;
            if (role !== 'all' && ship.role !== role) return false;
            return true;
        });
    }

    renderShipCards() {
        const container = document.getElementById('ship-cards');
        const ships = this.getFilteredShips();

        container.innerHTML = '';
        for (const [displayId, ship, baseId] of ships) {
            const dps = this.estimateDps(ship);
            const card = document.createElement('div');
            card.className = 'ship-card' + (this.selectedShipId === displayId ? ' selected' : '');
            card.innerHTML = `
                <div class="ship-card-header">
                    <span class="ship-card-name">${ship.name}</span>
                    <span class="ship-card-size">${ship.size}</span>
                </div>
                <div class="ship-card-stats">
                    <span><span class="stat-s">S:${ship.shield}</span></span>
                    <span><span class="stat-a">A:${ship.armor}</span></span>
                    <span><span class="stat-h">H:${ship.hull}</span></span>
                    <span><span class="stat-d">D:${dps.toFixed(0)}</span></span>
                    <span>${ship.role}</span>
                </div>`;
            card.addEventListener('click', () => this.selectShip(displayId, ship, baseId));
            container.appendChild(card);
        }
    }

    estimateDps(shipConfig) {
        // Estimate DPS from default loadout
        const loadout = this.getDefaultLoadout(shipConfig);
        let dps = 0;
        for (const moduleId of (loadout.high || [])) {
            const config = getModuleConfig(moduleId);
            if (config?.damage && config?.cycleTime) {
                dps += config.damage / config.cycleTime;
            }
        }
        return dps * (shipConfig.damageMultiplier || 1);
    }

    getDefaultLoadout(shipConfig) {
        const key = `${shipConfig.role}-${shipConfig.size}`;
        const preset = DEFAULT_LOADOUTS[key];
        if (preset) return { high: [...(preset.high || [])], mid: [...(preset.mid || [])], low: [...(preset.low || [])] };

        // Fallback: auto-generate
        const loadout = { high: [], mid: [], low: [] };
        const allowedSizes = SIZE_COMPAT[shipConfig.size] || ['small'];

        // Fill high slots with matching weapons
        const weapons = Object.entries(EQUIPMENT_DATABASE)
            .filter(([, eq]) => eq.slot === 'weapon' && eq.damage && allowedSizes.includes(eq.size))
            .sort((a, b) => (b[1].damage / b[1].cycleTime) - (a[1].damage / a[1].cycleTime));
        for (let i = 0; i < (shipConfig.weaponSlots || 0); i++) {
            if (weapons[i % weapons.length]) loadout.high.push(weapons[i % weapons.length][0]);
        }

        // Mid: shield booster + afterburner
        const midMods = ['shield-booster', 'afterburner'];
        for (let i = 0; i < (shipConfig.moduleSlots || 0); i++) {
            if (midMods[i]) loadout.mid.push(midMods[i]);
        }

        // Low: damage-control
        loadout.low.push('damage-control');

        return loadout;
    }

    selectShip(displayId, config, baseId) {
        this.selectedShipId = displayId;
        this.selectedConfig = config;
        this.selectedBaseId = baseId;
        this.loadoutMode = 'default';
        this.customLoadout = this.getDefaultLoadout(config);

        // Re-render cards to show selection
        this.renderShipCards();
        this.renderShipDetail();
    }

    renderShipDetail() {
        const panel = document.getElementById('ship-detail');
        if (!this.selectedConfig) {
            panel.classList.remove('visible');
            return;
        }
        panel.classList.add('visible');
        const ship = this.selectedConfig;
        const loadout = this.loadoutMode === 'default' ? this.getDefaultLoadout(ship) : this.customLoadout;
        const teamClass = this.selectedTeam === 'a' ? 'team-a-btn' : 'team-b-btn';

        let html = `<div class="detail-name">${ship.name}</div>`;
        html += `<div class="detail-stat-grid">
            <span class="lbl">Shield</span><span class="stat-s">${ship.shield}</span>
            <span class="lbl">Armor</span><span class="stat-a">${ship.armor}</span>
            <span class="lbl">Hull</span><span class="stat-h">${ship.hull}</span>
            <span class="lbl">Speed</span><span>${ship.maxSpeed} m/s</span>
            <span class="lbl">Cap</span><span>${ship.capacitor}</span>
            <span class="lbl">Sig</span><span>${ship.signatureRadius || 30}</span>
            <span class="lbl">Slots</span><span>${ship.weaponSlots || 0}/${ship.moduleSlots || 0}/${ship.subsystemSlots || 0}</span>
            <span class="lbl">CPU/PG</span><span>${ship.cpu || 0}/${ship.powergrid || 0}</span>
        </div>`;

        // Loadout toggle
        html += `<div class="loadout-toggle">
            <button class="loadout-btn${this.loadoutMode === 'default' ? ' active' : ''}" data-mode="default">Default</button>
            <button class="loadout-btn${this.loadoutMode === 'custom' ? ' active' : ''}" data-mode="custom">Custom</button>
        </div>`;

        // Slot rows
        const allowedSizes = SIZE_COMPAT[ship.size] || ['small'];
        const slotConfigs = [
            { label: 'H', type: 'high', count: ship.weaponSlots || 0, eqSlot: 'weapon' },
            { label: 'M', type: 'mid', count: ship.moduleSlots || 0, eqSlot: 'module' },
            { label: 'L', type: 'low', count: ship.subsystemSlots || 0, eqSlot: 'subsystem' },
        ];

        for (const sc of slotConfigs) {
            html += `<div class="loadout-title">${sc.label === 'H' ? 'High' : sc.label === 'M' ? 'Mid' : 'Low'} Slots</div>`;
            for (let i = 0; i < sc.count; i++) {
                const current = loadout[sc.type]?.[i] || '';
                const currentName = current ? (getModuleConfig(current)?.name || current) : '- Empty -';

                if (this.loadoutMode === 'custom') {
                    const compatible = Object.entries(EQUIPMENT_DATABASE)
                        .filter(([, eq]) => eq.slot === sc.eqSlot && (!eq.size || allowedSizes.includes(eq.size)));

                    html += `<div class="slot-row">
                        <span class="slot-label">${sc.label}${i + 1}</span>
                        <select class="slot-select" data-slot="${sc.type}" data-index="${i}">
                            <option value="">- Empty -</option>
                            ${compatible.map(([id, eq]) => `<option value="${id}"${id === current ? ' selected' : ''}>${eq.name}</option>`).join('')}
                        </select>
                    </div>`;
                } else {
                    html += `<div class="slot-row">
                        <span class="slot-label">${sc.label}${i + 1}</span>
                        <span style="flex:1;color:var(--dim)">${currentName}</span>
                    </div>`;
                }
            }
        }

        // Add button
        html += `<div class="add-row">
            <label style="color:var(--dim);font-size:11px">Qty:</label>
            <input type="number" class="qty-input" id="add-qty" min="1" max="10" value="1">
            <button class="add-btn ${teamClass}" id="btn-add-ship">ADD TO BATTLE</button>
        </div>`;

        panel.innerHTML = html;

        // Bind loadout toggle
        panel.querySelectorAll('.loadout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.loadoutMode = btn.dataset.mode;
                if (this.loadoutMode === 'custom' && this.customLoadout.high.length === 0) {
                    this.customLoadout = this.getDefaultLoadout(this.selectedConfig);
                }
                this.renderShipDetail();
            });
        });

        // Bind slot selects
        panel.querySelectorAll('.slot-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const slotType = sel.dataset.slot;
                const idx = parseInt(sel.dataset.index);
                if (!this.customLoadout[slotType]) this.customLoadout[slotType] = [];
                this.customLoadout[slotType][idx] = sel.value || null;
            });
        });

        // Bind add button
        panel.querySelector('#btn-add-ship')?.addEventListener('click', () => {
            this.addShipToBattle();
        });
    }

    addShipToBattle() {
        if (!this.selectedConfig) return;
        const qty = parseInt(document.getElementById('add-qty')?.value || 1);
        const loadout = this.loadoutMode === 'default'
            ? this.getDefaultLoadout(this.selectedConfig)
            : { ...this.customLoadout };

        this.engine.addToRoster(this.selectedTeam, this.selectedShipId, this.selectedConfig, loadout, qty);
        this.renderRoster();
    }

    renderRoster() {
        const container = document.getElementById('roster');
        let html = '';
        const inSetup = this.engine.state === 'setup';

        for (const team of ['a', 'b']) {
            const teamLabel = team === 'a' ? 'TEAM A' : 'TEAM B';
            const teamClass = team === 'a' ? 'team-a' : 'team-b';
            const shipCount = this.engine.roster[team].length;
            const placedCount = this.placedShips.filter(p => p.team === team).length;

            html += `<div class="roster-team">
                <div class="roster-team-header ${teamClass}">
                    <span>${teamLabel}</span>
                    <span>${shipCount} ships${placedCount > 0 ? ` (${placedCount} placed)` : ''}</span>
                </div>`;

            // Placement buttons (only in setup with ships)
            if (inSetup && shipCount > 0) {
                html += `<div class="roster-place-buttons">
                    <button class="roster-place-btn ${teamClass}" data-team="${team}" data-action="place-single">PLACE SHIPS</button>
                    <button class="roster-place-btn ${teamClass}" data-team="${team}" data-action="place-squad">PLACE SQUAD</button>
                </div>`;
            }

            for (let i = 0; i < shipCount; i++) {
                const r = this.engine.roster[team][i];
                const isPlaced = this.placedShips.some(p => p.team === team && p.rosterIndex === i);
                html += `<div class="roster-item${isPlaced ? ' placed' : ''}">
                    <span class="roster-remove" data-team="${team}" data-idx="${i}">&#10005;</span>
                    <span>${r.config.name}${isPlaced ? ' <span style="color:var(--pass);font-size:10px">PLACED</span>' : ''}</span>
                </div>`;
            }
            html += '</div>';
        }

        container.innerHTML = html;

        // Bind remove buttons
        container.querySelectorAll('.roster-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const team = btn.dataset.team;
                const idx = parseInt(btn.dataset.idx);
                // Clean up any placed ship for this index
                const placedIdx = this.placedShips.findIndex(p => p.team === team && p.rosterIndex === idx);
                if (placedIdx >= 0) {
                    if (this.renderer) this.renderer.removeGhostMesh(this.placedShips[placedIdx].mesh);
                    this.placedShips.splice(placedIdx, 1);
                }
                // Re-index placed ships with higher indices
                for (const p of this.placedShips) {
                    if (p.team === team && p.rosterIndex > idx) p.rosterIndex--;
                }
                this.engine.removeFromRoster(team, idx);
                this.renderRoster();
            });
        });

        // Bind placement buttons
        container.querySelectorAll('.roster-place-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.startPlacement(btn.dataset.action, btn.dataset.team);
            });
        });
    }

    // ---- Placement Methods ----

    startPlacement(action, team) {
        // End any existing placement
        this.endPlacement();

        this.placementMode = action;
        this.placementTeam = team;

        if (!this.renderer) return;

        // Show placement zones
        this.renderer.showPlacementZones(team);
        this.renderer.dragDisabled = true;

        document.getElementById('battle-canvas').classList.add('placing');

        if (action === 'place-single') {
            // Build queue of unplaced roster indices
            this.placementQueue = [];
            for (let i = 0; i < this.engine.roster[team].length; i++) {
                if (!this.placedShips.some(p => p.team === team && p.rosterIndex === i)) {
                    this.placementQueue.push(i);
                }
            }
            if (this.placementQueue.length === 0) {
                this.endPlacement();
                return;
            }
            this.updateGhostForNextShip();
        } else if (action === 'place-squad') {
            this.createSquadGhosts(team);
        }

        this.updatePlacementStatus();
    }

    updateGhostForNextShip() {
        if (this.renderer && this.ghostMesh) {
            this.renderer.removeGhostMesh(this.ghostMesh);
            this.ghostMesh = null;
        }
        if (this.placementQueue.length === 0) {
            this.endPlacement();
            return;
        }
        const idx = this.placementQueue[0];
        const rosterEntry = this.engine.roster[this.placementTeam][idx];
        if (rosterEntry && this.renderer) {
            this.ghostMesh = this.renderer.createGhostMesh(rosterEntry.config, this.placementTeam, 0.3);
            this.ghostMesh.visible = false; // hidden until mouse moves on canvas
        }
    }

    placeSingleShip(worldX, worldY) {
        if (this.placementQueue.length === 0) return;

        const idx = this.placementQueue.shift();
        const rosterEntry = this.engine.roster[this.placementTeam][idx];
        const rotation = this.placementTeam === 'a' ? 0 : Math.PI;

        // Create a placed marker mesh (higher opacity)
        let mesh = null;
        if (this.renderer && rosterEntry) {
            mesh = this.renderer.createGhostMesh(rosterEntry.config, this.placementTeam, 0.6);
            mesh.position.set(worldX, worldY, 5);
            mesh.rotation.z = rotation;
        }

        this.placedShips.push({
            rosterIndex: idx,
            team: this.placementTeam,
            x: worldX,
            y: worldY,
            rotation,
            mesh,
        });

        this.updateGhostForNextShip();
        this.renderRoster();
        this.updatePlacementStatus();
    }

    createSquadGhosts(team) {
        this.clearSquadGhosts();
        const formation = this.engine.teamFormation[team] || 'none';
        const unplaced = [];
        for (let i = 0; i < this.engine.roster[team].length; i++) {
            if (!this.placedShips.some(p => p.team === team && p.rosterIndex === i)) {
                unplaced.push(i);
            }
        }
        if (unplaced.length === 0) {
            this.endPlacement();
            return;
        }
        this._squadUnplaced = unplaced;

        for (const idx of unplaced) {
            const rosterEntry = this.engine.roster[team][idx];
            if (rosterEntry && this.renderer) {
                const ghost = this.renderer.createGhostMesh(rosterEntry.config, team, 0.3);
                ghost.visible = false;
                this.squadGhosts.push({ mesh: ghost, rosterIndex: idx });
            }
        }
    }

    updateSquadGhostPositions(cx, cy) {
        if (this.squadGhosts.length === 0) return;
        const team = this.placementTeam;
        const formation = this.engine.teamFormation[team] || 'none';
        const count = this.squadGhosts.length;
        const offsets = FORMATION_OFFSETS[formation] ? FORMATION_OFFSETS[formation](count) : [];
        const rotation = team === 'a' ? 0 : Math.PI;

        for (let i = 0; i < this.squadGhosts.length; i++) {
            const ghost = this.squadGhosts[i];
            const off = offsets[i] || { x: 0, y: (i - (count - 1) / 2) * 150 };
            ghost.mesh.position.set(cx + off.x, cy + off.y, 5);
            ghost.mesh.rotation.z = rotation;
            ghost.mesh.visible = true;
        }
    }

    placeSquad(cx, cy) {
        if (this.squadGhosts.length === 0) return;
        const team = this.placementTeam;
        const formation = this.engine.teamFormation[team] || 'none';
        const count = this.squadGhosts.length;
        const offsets = FORMATION_OFFSETS[formation] ? FORMATION_OFFSETS[formation](count) : [];
        const rotation = team === 'a' ? 0 : Math.PI;

        for (let i = 0; i < this.squadGhosts.length; i++) {
            const ghost = this.squadGhosts[i];
            const off = offsets[i] || { x: 0, y: (i - (count - 1) / 2) * 150 };
            const x = cx + off.x;
            const y = cy + off.y;

            // Upgrade ghost to placed opacity
            ghost.mesh.traverse(child => {
                if (child.material) {
                    child.material.opacity = Math.min(1, child.material.opacity * 2);
                }
            });

            this.placedShips.push({
                rosterIndex: ghost.rosterIndex,
                team,
                x, y,
                rotation,
                mesh: ghost.mesh,
            });
        }

        this.squadGhosts = [];
        this.endPlacement();
        this.renderRoster();
    }

    clearSquadGhosts() {
        if (this.renderer) {
            for (const ghost of this.squadGhosts) {
                this.renderer.removeGhostMesh(ghost.mesh);
            }
        }
        this.squadGhosts = [];
    }

    endPlacement() {
        if (this.renderer && this.ghostMesh) {
            this.renderer.removeGhostMesh(this.ghostMesh);
            this.ghostMesh = null;
        }
        this.clearSquadGhosts();
        if (this.renderer) {
            this.renderer.hidePlacementZones();
            this.renderer.dragDisabled = false;
        }
        this.placementMode = null;
        this.placementTeam = null;
        this.placementQueue = [];
        this.draggingPlacedShip = null;
        document.getElementById('battle-canvas').classList.remove('placing', 'dragging-ship');
        this.updatePlacementStatus();
    }

    updatePlacementStatus() {
        const bar = document.getElementById('placement-status');
        if (!bar) return;
        if (!this.placementMode) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        if (this.placementMode === 'place-single') {
            const idx = this.placementQueue[0];
            const entry = idx != null ? this.engine.roster[this.placementTeam]?.[idx] : null;
            const shipName = entry ? entry.config.name : '?';
            bar.textContent = `Placing: ${shipName} (${this.placementQueue.length} remaining) | Click to place | ESC to cancel`;
        } else if (this.placementMode === 'place-squad') {
            bar.textContent = `Squad placement: Click to place all ships in formation | ESC to cancel`;
        }
    }

    isInPlacementZone(x, y, team) {
        const zone = team === 'a' ? PLACEMENT_ZONE_A : PLACEMENT_ZONE_B;
        return x >= zone.xMin && x <= zone.xMax &&
               y >= PLACEMENT_Y_RANGE.yMin && y <= PLACEMENT_Y_RANGE.yMax;
    }

    findPlacedShipAt(worldX, worldY) {
        const pickRadius = 80;
        for (let i = 0; i < this.placedShips.length; i++) {
            const p = this.placedShips[i];
            const d = Math.sqrt((p.x - worldX) ** 2 + (p.y - worldY) ** 2);
            if (d < pickRadius) return i;
        }
        return -1;
    }

    bindEvents() {
        // Team toggle
        document.querySelectorAll('.team-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedTeam = btn.dataset.team;
                this.renderShipDetail();
            });
        });

        // Filters
        document.getElementById('filter-faction').addEventListener('change', () => this.renderShipCards());
        document.getElementById('filter-size').addEventListener('change', () => this.renderShipCards());
        document.getElementById('filter-role').addEventListener('change', () => this.renderShipCards());

        // AI controls
        document.getElementById('ai-a').addEventListener('change', (e) => this.engine.teamAI.a = e.target.value);
        document.getElementById('ai-b').addEventListener('change', (e) => this.engine.teamAI.b = e.target.value);
        document.getElementById('form-a').addEventListener('change', (e) => this.engine.teamFormation.a = e.target.value);
        document.getElementById('form-b').addEventListener('change', (e) => this.engine.teamFormation.b = e.target.value);

        // Battle controls
        document.getElementById('btn-start').addEventListener('click', () => this.startBattle());
        document.getElementById('btn-pause').addEventListener('click', () => this.pauseBattle());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetBattle());
        document.getElementById('btn-step').addEventListener('click', () => this.stepBattle());

        // Speed buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.engine.speedMultiplier = parseFloat(btn.dataset.speed);
            });
        });

        // Results buttons
        document.getElementById('btn-copy-results').addEventListener('click', () => this.copyResults());
        document.getElementById('btn-new-battle').addEventListener('click', () => this.resetBattle());

        // Ship hover/click on canvas
        const canvas = document.getElementById('battle-canvas');

        canvas.addEventListener('mousemove', (e) => {
            if (!this.renderer) return;
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const world = this.renderer.screenToWorld(sx, sy);

            // Placement mode: update ghost position
            if (this.placementMode === 'place-single' && this.ghostMesh) {
                this.ghostMesh.position.set(world.x, world.y, 5);
                this.ghostMesh.rotation.z = this.placementTeam === 'a' ? 0 : Math.PI;
                this.ghostMesh.visible = true;
                return;
            }
            if (this.placementMode === 'place-squad') {
                this.updateSquadGhostPositions(world.x, world.y);
                return;
            }

            // Dragging a placed ship
            if (this.draggingPlacedShip != null) {
                const p = this.placedShips[this.draggingPlacedShip];
                if (p) {
                    p.x = world.x + this.dragOffset.x;
                    p.y = world.y + this.dragOffset.y;
                    if (p.mesh) p.mesh.position.set(p.x, p.y, 5);
                }
                return;
            }

            // Normal: tooltip hover
            if (this.pinnedShip) return;
            const ship = this.renderer.findShipAtScreen(sx, sy, this.engine.ships);
            this.hoveredShip = ship;
            if (ship) {
                this.showTooltip(ship, e.clientX, e.clientY);
            } else {
                this.hideTooltip();
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            if (!this.renderer) return;
            // Check for drag on placed ships (setup mode, no active placement)
            if (this.engine.state === 'setup' && !this.placementMode && this.placedShips.length > 0) {
                const rect = canvas.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const world = this.renderer.screenToWorld(sx, sy);
                const idx = this.findPlacedShipAt(world.x, world.y);
                if (idx >= 0) {
                    this.draggingPlacedShip = idx;
                    const p = this.placedShips[idx];
                    this.dragOffset.x = p.x - world.x;
                    this.dragOffset.y = p.y - world.y;
                    this.renderer.dragDisabled = true;
                    return;
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.draggingPlacedShip != null) {
                this.draggingPlacedShip = null;
                if (this.renderer) this.renderer.dragDisabled = false;
            }
        });

        canvas.addEventListener('click', (e) => {
            if (!this.renderer) return;
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const world = this.renderer.screenToWorld(sx, sy);

            // Placement mode: place ship
            if (this.placementMode === 'place-single') {
                this.placeSingleShip(world.x, world.y);
                return;
            }
            if (this.placementMode === 'place-squad') {
                this.placeSquad(world.x, world.y);
                return;
            }

            // Normal: pin tooltip
            const ship = this.renderer.findShipAtScreen(sx, sy, this.engine.ships);
            if (ship) {
                this.pinnedShip = ship;
                this.tooltipEl.classList.add('pinned');
                this.showTooltip(ship, e.clientX, e.clientY);
            } else if (this.pinnedShip) {
                this.pinnedShip = null;
                this.tooltipEl.classList.remove('pinned');
                this.hideTooltip();
            }
        });

        // Close pinned tooltip - use delegation on the tooltip container (handles innerHTML rebuilds)
        this.tooltipEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('tt-close-btn')) {
                e.stopPropagation();
                this.pinnedShip = null;
                this.tooltipEl.classList.remove('pinned');
                this.hideTooltip();
            }
        });

        // ESC key to cancel placement
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.placementMode) {
                this.endPlacement();
                this.renderRoster();
            }
        });
    }

    // ---- Tooltip / Ship Inspector ----

    showTooltip(ship, mouseX, mouseY) {
        const tt = this.tooltipEl;
        tt.classList.add('visible');
        tt.className = `visible ${ship.team === 'a' ? 'tt-team-a' : 'tt-team-b'}${this.pinnedShip ? ' pinned' : ''}`;
        tt.id = 'ship-tooltip';

        const profile = AI_PROFILES[this.engine.teamAI[ship.team]] || AI_PROFILES.brawler;
        const profileName = this.engine.teamAI[ship.team] || 'brawler';
        const formationName = this.engine.teamFormation[ship.team] || 'none';
        const resists = ship.getEffectiveResists();
        const ehp = ship.getEffectiveHp();
        const totalDps = ship.getDps();

        let html = `<span class="tt-close-btn">&#10005;</span>`;

        // Header
        html += `<div class="tt-header">
            <span class="tt-name">${ship.name}</span>
            <span class="tt-id">#${ship.id} | ${ship.shipSize} | Team ${ship.team.toUpperCase()}</span>
        </div>`;

        // AI State section
        const stateClass = { approach: 'approach', orbit: 'orbit', flee: 'flee', kite: 'approach', idle: 'idle' }[ship.aiState] || 'attack';
        html += `<div class="tt-section">
            <div class="tt-section-title">AI State</div>
            <div class="tt-row"><span class="lbl">Profile</span><span class="val">${profileName.toUpperCase()} (prefRange: ${(profile.preferredRange * 100).toFixed(0)}%, flee: ${(profile.fleeHpPct * 100).toFixed(0)}%)</span></div>
            <div class="tt-row"><span class="lbl">State</span><span class="val"><span class="tt-ai-intent ${stateClass}">${ship.aiState.toUpperCase()}</span></span></div>
            <div class="tt-row"><span class="lbl">Intent</span><span class="val">${ship.aiIntent || 'None'}</span></div>
            <div class="tt-row"><span class="lbl">Target</span><span class="val">${ship.target ? `${ship.target.name} #${ship.target.id} (${ship.target.alive ? (ship.target.getHpPercent() * 100).toFixed(0) + '% HP' : 'DEAD'})` : 'None'}</span></div>
            <div class="tt-row"><span class="lbl">Dist to Target</span><span class="val">${ship.distToTarget ? Math.round(ship.distToTarget) + 'm' : 'N/A'}</span></div>
            <div class="tt-row"><span class="lbl">Desired Range</span><span class="val">${ship.aiDesiredRange ? Math.round(ship.aiDesiredRange) + 'm' : 'N/A'}</span></div>
            <div class="tt-row"><span class="lbl">Formation</span><span class="val">${formationName.toUpperCase()}</span></div>
        </div>`;

        // HP Section
        const shieldPct = ship.maxShield > 0 ? (ship.shield / ship.maxShield * 100) : 0;
        const armorPct = ship.maxArmor > 0 ? (ship.armor / ship.maxArmor * 100) : 0;
        const hullPct = ship.maxHull > 0 ? (ship.hull / ship.maxHull * 100) : 0;
        const capPct = ship.maxCapacitor > 0 ? (ship.capacitor / ship.maxCapacitor * 100) : 0;

        html += `<div class="tt-section">
            <div class="tt-section-title">Health & Resources</div>
            <div class="tt-bar-row">
                <span class="tt-bar-label" style="color:var(--shield)">Shield</span>
                <div class="tt-bar-bg"><div class="tt-bar-fill shield" style="width:${shieldPct}%"></div></div>
                <span class="tt-bar-value">${Math.round(ship.shield)} / ${ship.maxShield}</span>
            </div>
            <div class="tt-bar-row">
                <span class="tt-bar-label" style="color:var(--armor)">Armor</span>
                <div class="tt-bar-bg"><div class="tt-bar-fill armor" style="width:${armorPct}%"></div></div>
                <span class="tt-bar-value">${Math.round(ship.armor)} / ${ship.maxArmor}</span>
            </div>
            <div class="tt-bar-row">
                <span class="tt-bar-label" style="color:var(--hull)">Hull</span>
                <div class="tt-bar-bg"><div class="tt-bar-fill hull" style="width:${hullPct}%"></div></div>
                <span class="tt-bar-value">${Math.round(ship.hull)} / ${ship.maxHull}</span>
            </div>
            <div class="tt-bar-row">
                <span class="tt-bar-label" style="color:#a78bfa">Cap</span>
                <div class="tt-bar-bg"><div class="tt-bar-fill cap" style="width:${capPct}%"></div></div>
                <span class="tt-bar-value">${Math.round(ship.capacitor)} / ${ship.maxCapacitor} (+${ship.capacitorRegen}/s)</span>
            </div>
            <div class="tt-grid" style="margin-top:4px">
                <div class="tt-row"><span class="lbl">EHP</span><span class="val">${Math.round(ehp)}</span></div>
                <div class="tt-row"><span class="lbl">Total DPS</span><span class="val">${totalDps.toFixed(1)}</span></div>
                <div class="tt-row"><span class="lbl">Speed</span><span class="val">${Math.round(ship.currentSpeed)} / ${ship.maxSpeed} m/s</span></div>
                <div class="tt-row"><span class="lbl">Signature</span><span class="val">${ship.signatureRadius}m</span></div>
                <div class="tt-row"><span class="lbl">Pos</span><span class="val">(${Math.round(ship.x)}, ${Math.round(ship.y)})</span></div>
                <div class="tt-row"><span class="lbl">Heading</span><span class="val">${(ship.rotation * 180 / Math.PI).toFixed(0)}°</span></div>
            </div>
        </div>`;

        // Resistances section
        html += `<div class="tt-section">
            <div class="tt-section-title">Resistances</div>
            <div class="tt-resist-grid">
                <span></span>
                <span class="tt-resist-header">EM</span>
                <span class="tt-resist-header">Therm</span>
                <span class="tt-resist-header">Kin</span>
                <span class="tt-resist-header">Exp</span>`;
        for (const layer of ['shield', 'armor', 'hull']) {
            html += `<span class="tt-resist-label">${layer.charAt(0).toUpperCase() + layer.slice(1)}</span>`;
            for (const type of ['em', 'thermal', 'kinetic', 'explosive']) {
                const val = (resists[layer][type] * 100).toFixed(0);
                const cls = val >= 40 ? 'high' : val >= 20 ? 'med' : val > 0 ? 'low' : 'none';
                html += `<span class="tt-resist-val ${cls}">${val}%</span>`;
            }
        }
        html += `</div></div>`;

        // Weapons section
        if (ship.weaponDetails.length > 0) {
            html += `<div class="tt-section">
                <div class="tt-section-title">Weapons (${ship.weaponDetails.length})</div>`;
            for (const w of ship.weaponDetails) {
                const hitCls = w.hitChance >= 0.7 ? 'tt-hit-high' : w.hitChance >= 0.4 ? 'tt-hit-med' : 'tt-hit-low';
                const cdText = w.onCooldown ? `<span style="color:var(--warn)">CD ${w.cooldownRemaining.toFixed(1)}s</span>` : '<span style="color:var(--pass)">READY</span>';
                html += `<div class="tt-weapon-row">
                    <div class="tt-weapon-name">[${w.slot}] ${w.name} ${w.inRange ? '' : '<span style="color:var(--hull)">[OUT OF RANGE]</span>'}</div>
                    <div class="tt-weapon-stats">
                        <span>Hit: <span class="${hitCls}">${(w.hitChance * 100).toFixed(1)}%</span></span>
                        <span>DPS: ${w.dps.toFixed(1)}</span>
                        <span>Dmg: ${w.damage}</span>
                        <span>Cycle: ${w.cycleTime}s</span>
                        <span>Opt: ${w.optimal}m</span>
                        <span>Fall: ${w.falloff}m</span>
                        <span>Rng: ${w.range}m</span>
                        <span>Track: ${w.tracking}</span>
                        <span>Cap: ${w.capUse}/cycle</span>
                        <span>${cdText}</span>
                        <span>Type: ${w.damageType}</span>
                    </div>
                </div>`;
            }
            html += `</div>`;
        }

        // Mid/Low modules
        const midMods = ship.modules.mid.filter(m => m).map(m => getModuleConfig(m));
        const lowMods = ship.modules.low.filter(m => m).map(m => getModuleConfig(m));
        if (midMods.length > 0 || lowMods.length > 0) {
            html += `<div class="tt-section">
                <div class="tt-section-title">Fitted Modules</div>`;
            for (let i = 0; i < ship.modules.mid.length; i++) {
                const id = ship.modules.mid[i];
                if (!id) continue;
                const c = getModuleConfig(id);
                const effects = [];
                if (c.shieldRepair) effects.push(`Shield Rep: ${c.shieldRepair}/cycle`);
                if (c.armorRepair) effects.push(`Armor Rep: ${c.armorRepair}/cycle`);
                if (c.speedBonus) effects.push(`Speed: +${((c.speedBonus - 1) * 100).toFixed(0)}%`);
                if (c.signatureBloom) effects.push(`Sig Bloom: ${c.signatureBloom}x`);
                if (c.pdsBonus) effects.push(`PDS: +${(c.pdsBonus * 100).toFixed(0)}%`);
                if (c.fleetPdsBonus) effects.push(`Fleet PDS: +${(c.fleetPdsBonus * 100).toFixed(0)}% @${c.fleetPdsRange}m`);
                if (c.capacitorUse) effects.push(`Cap: ${c.capacitorUse}/s`);
                html += `<div style="font-size:10px;color:var(--dim);padding:1px 0">[M${i + 1}] ${c.name}${effects.length ? ' - ' + effects.join(', ') : ''}</div>`;
            }
            for (let i = 0; i < ship.modules.low.length; i++) {
                const id = ship.modules.low[i];
                if (!id) continue;
                const c = getModuleConfig(id);
                const effects = [];
                if (c.damageBonus) effects.push(`Dmg: +${((c.damageBonus - 1) * 100).toFixed(0)}%`);
                if (c.maserDamageBonus) effects.push(`Maser Dmg: +${((c.maserDamageBonus - 1) * 100).toFixed(0)}%`);
                if (c.missileDamageBonus) effects.push(`Missile Dmg: +${((c.missileDamageBonus - 1) * 100).toFixed(0)}%`);
                if (c.pdsBonus) effects.push(`PDS: +${(c.pdsBonus * 100).toFixed(0)}%`);
                if (c.fleetPdsBonus) effects.push(`Fleet PDS: +${(c.fleetPdsBonus * 100).toFixed(0)}% @${c.fleetPdsRange}m`);
                if (c.shieldResist) effects.push(`Shield Res: +${(c.shieldResist * 100).toFixed(0)}%`);
                if (c.armorResist) effects.push(`Armor Res: +${(c.armorResist * 100).toFixed(0)}%`);
                if (c.hullResist) effects.push(`Hull Res: +${(c.hullResist * 100).toFixed(0)}%`);
                if (c.resistBonus) effects.push(`Resist: +${(c.resistBonus.amount * 100).toFixed(0)}% ${c.resistBonus.layer} ${c.resistBonus.type}`);
                html += `<div style="font-size:10px;color:var(--dim);padding:1px 0">[L${i + 1}] ${c.name}${effects.length ? ' - ' + effects.join(', ') : ''}</div>`;
            }
            html += `</div>`;
        }

        // Combat stats (enhanced)
        const st = ship.stats;
        const accuracy = st.totalShots > 0 ? (st.totalHits / st.totalShots * 100).toFixed(1) : '0.0';
        const combatDps = st.timeInCombat > 0.1 ? (ship.damageDone / st.timeInCombat).toFixed(1) : '0.0';
        const resistEff = st.rawDamageReceived > 0 ? (st.damageAbsorbedByResist / st.rawDamageReceived * 100).toFixed(0) : '0';
        const pdsChance = ship.getPdsChance(this.engine.ships.filter(s => s.team === ship.team && s.alive));
        const pdsIntPct = st.pdsFired > 0 ? (st.pdsIntercepted / st.pdsFired * 100).toFixed(0) : '0';

        html += `<div class="tt-section">
            <div class="tt-section-title">Combat Tally</div>
            <div class="tt-grid">
                <div class="tt-row"><span class="lbl">Damage Done</span><span class="val">${Math.round(ship.damageDone)}</span></div>
                <div class="tt-row"><span class="lbl">Damage Taken</span><span class="val">${Math.round(ship.damageTaken)}</span></div>
                <div class="tt-row"><span class="lbl">Combat DPS</span><span class="val">${combatDps}</span></div>
                <div class="tt-row"><span class="lbl">Accuracy</span><span class="val">${accuracy}% (${st.totalHits}/${st.totalShots})</span></div>
                <div class="tt-row"><span class="lbl">Kills</span><span class="val">${ship.kills}</span></div>
                <div class="tt-row"><span class="lbl">HP Remaining</span><span class="val">${(ship.getHpPercent() * 100).toFixed(1)}%</span></div>
                <div class="tt-row"><span class="lbl">PDS Chance</span><span class="val">${(pdsChance * 100).toFixed(0)}%</span></div>
                <div class="tt-row"><span class="lbl">PDS Intercepts</span><span class="val">${st.pdsIntercepted}/${st.pdsFired} (${pdsIntPct}%)</span></div>
                <div class="tt-row"><span class="lbl">Resist Efficiency</span><span class="val">${resistEff}% absorbed</span></div>
                <div class="tt-row"><span class="lbl">Shield Repaired</span><span class="val">${Math.round(st.shieldRepaired)}</span></div>
                <div class="tt-row"><span class="lbl">Armor Repaired</span><span class="val">${Math.round(st.armorRepaired)}</span></div>
                <div class="tt-row"><span class="lbl">Overkill</span><span class="val">${Math.round(st.overkillDamage)}</span></div>
                <div class="tt-row"><span class="lbl">Cap Used</span><span class="val">${Math.round(st.capUsedOnWeapons + st.capUsedOnModules)} (W:${Math.round(st.capUsedOnWeapons)} M:${Math.round(st.capUsedOnModules)})</span></div>
                <div class="tt-row"><span class="lbl">Cap Regen</span><span class="val">${Math.round(st.capRegenTotal)}${st.timeCapEmpty > 0.5 ? ` | Empty ${st.timeCapEmpty.toFixed(1)}s` : ''}${st.weaponsDryCycles > 0 ? ` | Dry ${st.weaponsDryCycles}x` : ''}</span></div>
                <div class="tt-row"><span class="lbl">Time Alive</span><span class="val">${st.timeAlive.toFixed(1)}s (combat ${st.timeInCombat.toFixed(1)}s)</span></div>
            </div>
        </div>`;

        // Per-layer damage breakdown
        if (ship.damageDone > 0 || ship.damageTaken > 0) {
            html += `<div class="tt-section">
                <div class="tt-section-title">Damage Breakdown</div>
                <div class="tt-grid" style="font-size:10px">
                    <div class="tt-row"><span class="lbl">Dealt to Shield</span><span class="val" style="color:var(--shield)">${Math.round(st.damageDealtByLayer.shield)}</span></div>
                    <div class="tt-row"><span class="lbl">Dealt to Armor</span><span class="val" style="color:var(--armor)">${Math.round(st.damageDealtByLayer.armor)}</span></div>
                    <div class="tt-row"><span class="lbl">Dealt to Hull</span><span class="val" style="color:var(--hull)">${Math.round(st.damageDealtByLayer.hull)}</span></div>
                    <div class="tt-row"><span class="lbl">Taken on Shield</span><span class="val" style="color:var(--shield)">${Math.round(st.damageReceivedByLayer.shield)}</span></div>
                    <div class="tt-row"><span class="lbl">Taken on Armor</span><span class="val" style="color:var(--armor)">${Math.round(st.damageReceivedByLayer.armor)}</span></div>
                    <div class="tt-row"><span class="lbl">Taken on Hull</span><span class="val" style="color:var(--hull)">${Math.round(st.damageReceivedByLayer.hull)}</span></div>
                </div>
            </div>`;
        }

        // Use a content wrapper to avoid re-binding close button events
        // The close button handler is bound once via event delegation in bindEvents
        tt.innerHTML = html;

        // Position tooltip near mouse but within viewport
        const mapRect = document.getElementById('battle-map').getBoundingClientRect();
        let tx = mouseX - mapRect.left + 20;
        let ty = mouseY - mapRect.top - 20;

        // Clamp to viewport
        const ttRect = tt.getBoundingClientRect();
        if (tx + 440 > mapRect.width) tx = mouseX - mapRect.left - 460;
        if (ty + ttRect.height > mapRect.height) ty = mapRect.height - ttRect.height - 10;
        if (ty < 0) ty = 10;
        if (tx < 0) tx = 10;

        tt.style.left = tx + 'px';
        tt.style.top = ty + 'px';
    }

    hideTooltip() {
        if (this.pinnedShip) return; // Don't hide if pinned
        this.tooltipEl.classList.remove('visible');
        this.tooltipEl.classList.remove('tt-team-a', 'tt-team-b');
    }

    updatePinnedTooltip() {
        if (!this.pinnedShip) return;
        if (!this.pinnedShip.alive && this.engine.time - (this.pinnedShip.deathTime || 0) > 3) {
            this.pinnedShip = null;
            this.tooltipEl.classList.remove('pinned');
            this.hideTooltip();
            return;
        }
        // Re-render tooltip content in place
        const mapRect = document.getElementById('battle-map').getBoundingClientRect();
        const screen = this.renderer.worldToScreen(this.pinnedShip.x, this.pinnedShip.y);
        this.showTooltip(this.pinnedShip, mapRect.left + screen.x, mapRect.top + screen.y);
    }

    startBattle() {
        if (this.engine.roster.a.length === 0 || this.engine.roster.b.length === 0) return;

        // End any active placement
        this.endPlacement();

        if (this.engine.state === 'setup') {
            // Pass placed positions to engine
            this.engine.setupBattle(this.placedShips);

            // Clean up all placed ship ghost meshes (real meshes will replace them)
            for (const p of this.placedShips) {
                if (this.renderer) this.renderer.removeGhostMesh(p.mesh);
            }
            this.placedShips = [];
        }
        this.engine.start();
        document.getElementById('btn-start').style.display = 'none';
        document.getElementById('btn-pause').style.display = '';
    }

    pauseBattle() {
        if (this.engine.state === 'running') {
            this.engine.pause();
            document.getElementById('btn-start').style.display = '';
            document.getElementById('btn-start').textContent = 'RESUME';
            document.getElementById('btn-pause').style.display = 'none';
        }
    }

    resetBattle() {
        // End any placement mode
        this.endPlacement();

        // Clean up placed ship ghosts
        if (this.renderer) {
            for (const p of this.placedShips) {
                this.renderer.removeGhostMesh(p.mesh);
            }
        }
        this.placedShips = [];

        this.engine.reset();

        // Clear Three.js ship meshes
        if (this.renderer) {
            for (const [, group] of this.renderer.shipMeshes) {
                group.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
                this.renderer.scene.remove(group);
            }
            this.renderer.shipMeshes.clear();
            for (const line of this.renderer.targetingLines) {
                this.renderer.scene.remove(line);
                line.geometry.dispose();
                line.material.dispose();
            }
            this.renderer.targetingLines = [];
            for (const ring of this.renderer.rangeRings) {
                this.renderer.scene.remove(ring);
                ring.geometry.dispose();
                ring.material.dispose();
            }
            this.renderer.rangeRings = [];
            for (const line of this.renderer.projectileLines) {
                this.renderer.scene.remove(line);
                line.geometry.dispose();
                line.material.dispose();
            }
            this.renderer.projectileLines = [];
            for (const exp of this.renderer.explosions) {
                this.renderer.scene.remove(exp.mesh);
                exp.mesh.geometry.dispose();
                exp.mesh.material.dispose();
            }
            this.renderer.explosions = [];

            // Refresh environment meshes
            this.renderer.clearEnvironmentMeshes();
            this.renderer.createEnvironmentMeshes(this.engine.environment);
        }

        // Clear tooltip
        this.pinnedShip = null;
        this.hoveredShip = null;
        this.tooltipEl.classList.remove('visible', 'pinned', 'tt-team-a', 'tt-team-b');

        document.getElementById('btn-start').style.display = '';
        document.getElementById('btn-start').textContent = 'START';
        document.getElementById('btn-pause').style.display = 'none';
        document.getElementById('results-overlay').classList.remove('visible');
        document.getElementById('kill-feed-entries').innerHTML = '';
        document.getElementById('hp-bars-section').innerHTML = '';
        document.getElementById('dps-a').textContent = '0';
        document.getElementById('dps-b').textContent = '0';
        document.getElementById('battle-timer').textContent = '0:00';
        this.renderRoster();
    }

    stepBattle() {
        if (this.engine.state === 'setup') {
            if (this.engine.roster.a.length === 0 || this.engine.roster.b.length === 0) return;
            this.endPlacement();
            this.engine.setupBattle(this.placedShips);
            // Clean up placed ship ghosts
            if (this.renderer) {
                for (const p of this.placedShips) this.renderer.removeGhostMesh(p.mesh);
            }
            this.placedShips = [];
            this.engine.state = 'paused';
        }
        // Step 1 second in 10 sub-steps
        for (let i = 0; i < 10; i++) {
            this.engine.step(0.1);
        }
    }

    startRenderLoop() {
        const loop = (timestamp) => {
            this.animFrame = requestAnimationFrame(loop);

            if (!this.renderer) return;

            // Simulation step
            if (this.engine.state === 'running') {
                const rawDt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0.016;
                const dt = rawDt * this.engine.speedMultiplier;
                this.engine.step(dt);
            }
            this.lastTime = timestamp;

            // Update targeting lines and range rings for inspected ship
            const inspectShip = this.pinnedShip || this.hoveredShip;
            this.renderer.updateTargetingLines(this.engine, inspectShip);
            this.renderer.updateRangeRings(inspectShip);

            // Render
            this.renderer.render(this.engine);

            // Update pinned tooltip
            if (this.pinnedShip) this.updatePinnedTooltip();

            // Update UI
            this.updateStatsUI();
            this.updateTimer();

            // Check for battle end
            if (this.engine.state === 'ended') {
                this.showResults();
            }
        };
        this.animFrame = requestAnimationFrame(loop);
    }

    updateTimer() {
        const t = Math.floor(this.engine.time);
        const min = Math.floor(t / 60);
        const sec = t % 60;
        document.getElementById('battle-timer').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
    }

    updateStatsUI() {
        // HP bars
        const hpSection = document.getElementById('hp-bars-section');
        let html = '';

        for (const team of ['a', 'b']) {
            const teamLabel = team === 'a' ? 'Team A' : 'Team B';
            const ships = this.engine.ships.filter(s => s.team === team);
            if (ships.length === 0) continue;

            html += `<div class="hp-group-label">${teamLabel}</div>`;
            for (const ship of ships) {
                const totalMax = ship.maxShield + ship.maxArmor + ship.maxHull;
                const sPct = (ship.shield / totalMax * 100).toFixed(0);
                const aPct = (ship.armor / totalMax * 100).toFixed(0);
                const hPct = (ship.hull / totalMax * 100).toFixed(0);
                const hpPct = (ship.getHpPercent() * 100).toFixed(0);
                const opacity = ship.alive ? '1' : '0.3';

                html += `<div class="hp-row" style="opacity:${opacity}">
                    <span class="hp-name">${ship.name}</span>
                    <div class="hp-bar-bg">
                        <div class="hp-seg shield" style="width:${sPct}%"></div>
                        <div class="hp-seg armor" style="width:${aPct}%"></div>
                        <div class="hp-seg hull" style="width:${hPct}%"></div>
                    </div>
                    <span class="hp-pct">${ship.alive ? hpPct + '%' : 'DEAD'}</span>
                </div>`;
            }
        }
        hpSection.innerHTML = html;

        // DPS
        document.getElementById('dps-a').textContent = this.engine.getTeamDps('a').toFixed(0);
        document.getElementById('dps-b').textContent = this.engine.getTeamDps('b').toFixed(0);

        // Kill feed
        const feedEl = document.getElementById('kill-feed-entries');
        const feedHtml = this.engine.killFeed.slice(-20).reverse().map(k => {
            const killerColor = k.killerTeam === 'a' ? 'var(--team-a)' : 'var(--team-b)';
            const killedColor = k.killedTeam === 'a' ? 'var(--team-a)' : 'var(--team-b)';
            const time = Math.floor(k.time);
            const min = Math.floor(time / 60);
            const sec = time % 60;
            return `<div class="kill-entry">
                <span style="color:var(--dim)">${min}:${sec.toString().padStart(2, '0')}</span>
                <span class="killer" style="color:${killerColor}">${k.killer}</span>
                <span style="color:var(--dim)"> &gt; </span>
                <span class="killed" style="color:${killedColor}">${k.killed}</span>
            </div>`;
        }).join('');
        feedEl.innerHTML = feedHtml;
    }

    showResults() {
        const overlay = document.getElementById('results-overlay');
        overlay.classList.add('visible');

        const winner = this.engine.winner;
        const bannerEl = document.getElementById('results-winner');
        if (winner === 'draw') {
            bannerEl.textContent = 'DRAW';
            bannerEl.className = 'results-banner';
        } else {
            bannerEl.textContent = `TEAM ${winner.toUpperCase()} WINS`;
            bannerEl.className = `results-banner team-${winner}`;
        }

        const t = Math.floor(this.engine.time);
        document.getElementById('results-time').textContent =
            `Battle duration: ${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`;

        // Results table (enhanced)
        const tableEl = document.getElementById('results-table');
        let html = '<table><tr><th>Ship</th><th>Dmg Done</th><th>Dmg Taken</th><th>DPS</th><th>Acc%</th><th>PDS</th><th>Kills</th><th>Status</th></tr>';
        for (const ship of this.engine.ships) {
            const teamClass = ship.team === 'a' ? 'team-a' : 'team-b';
            const st = ship.stats;
            const dps = st.timeInCombat > 0.1 ? (ship.damageDone / st.timeInCombat).toFixed(1) : '0';
            const acc = st.totalShots > 0 ? (st.totalHits / st.totalShots * 100).toFixed(0) : '-';
            const pds = st.pdsFired > 0 ? `${st.pdsIntercepted}/${st.pdsFired}` : '-';
            html += `<tr class="${teamClass}">
                <td>${ship.name}</td>
                <td>${Math.round(ship.damageDone)}</td>
                <td>${Math.round(ship.damageTaken)}</td>
                <td>${dps}</td>
                <td>${acc}%</td>
                <td>${pds}</td>
                <td>${ship.kills}</td>
                <td>${ship.alive ? `<span style="color:var(--pass)">${Math.round(ship.getHpPercent() * 100)}%</span>` : '<span style="color:var(--hull)">DESTROYED</span>'}</td>
            </tr>`;
        }
        html += '</table>';
        tableEl.innerHTML = html;

        document.getElementById('btn-start').style.display = 'none';
        document.getElementById('btn-pause').style.display = 'none';
    }

    copyResults() {
        const results = this.engine.getResults();
        navigator.clipboard.writeText(JSON.stringify(results, null, 2)).then(() => {
            const btn = document.getElementById('btn-copy-results');
            btn.textContent = 'COPIED!';
            setTimeout(() => btn.textContent = 'COPY JSON', 1500);
        });
    }
}

// =============================================
// Loadout Builder API
// =============================================

/**
 * Generate a loadout programmatically from a strategy preset.
 *
 * @param {string} strategy - Strategy name (see below)
 * @param {Object} shipConfig - Ship config from SHIP_DATABASE
 * @returns {{ high: string[], mid: string[], low: string[] }}
 *
 * Strategies:
 *   'max-dps-maser', 'max-dps-railgun', 'max-dps-missile',
 *   'all-em-resist', 'all-thermal-resist', 'all-kinetic-resist', 'all-explosive-resist',
 *   'omni-tank', 'max-shield-tank', 'max-armor-tank',
 *   'speed-kite', 'brawl-tank', 'custom'
 */
function generateLoadout(strategy, shipConfig, customModules) {
    if (!shipConfig) return { high: [], mid: [], low: [] };
    if (strategy === 'custom' && customModules) {
        return { high: [...(customModules.high || [])], mid: [...(customModules.mid || [])], low: [...(customModules.low || [])] };
    }

    const allowedSizes = SIZE_COMPAT[shipConfig.size] || ['small'];
    const highCount = shipConfig.weaponSlots || 0;
    const midCount = shipConfig.moduleSlots || 0;
    const lowCount = shipConfig.subsystemSlots || 0;
    const loadout = { high: [], mid: [], low: [] };

    // Helper: find best weapon by category and allowed sizes, sorted by DPS
    const findWeapons = (category) => {
        return Object.entries(EQUIPMENT_DATABASE)
            .filter(([, eq]) => eq.slot === 'weapon' && eq.damage && eq.cycleTime &&
                eq.category === category && allowedSizes.includes(eq.size))
            .sort((a, b) => (b[1].damage / b[1].cycleTime) - (a[1].damage / a[1].cycleTime));
    };

    // Helper: find equipment by slot type and id pattern
    const findModule = (id) => EQUIPMENT_DATABASE[id] ? id : null;

    // Helper: fill an array up to count from a priority list
    const fillSlots = (arr, count, items) => {
        for (let i = 0; i < count && items.length > 0; i++) {
            arr.push(items[i % items.length]);
        }
    };

    // --- Weapon strategies ---
    const weaponStrats = {
        'max-dps-maser': 'maser',
        'max-dps-railgun': 'railgun',
        'max-dps-missile': 'missile',
    };
    if (weaponStrats[strategy]) {
        const cat = weaponStrats[strategy];
        const weapons = findWeapons(cat);
        if (weapons.length > 0) {
            fillSlots(loadout.high, highCount, weapons.map(([id]) => id));
        }
        // Matching damage mods in low
        const dmgMods = {
            maser: ['heat-sink-2', 'heat-sink', 'damage-mod-2', 'damage-mod'],
            railgun: ['gyrostabilizer-2', 'gyrostabilizer', 'damage-mod-2', 'damage-mod'],
            missile: ['ballistic-control-2', 'ballistic-control', 'damage-mod-2', 'damage-mod'],
        }[cat];
        const validDmgMods = dmgMods.filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, validDmgMods);
        // Mid: shield booster + afterburner + sensor booster + cap booster
        const midPriority = ['shield-booster', 'afterburner', 'sensor-booster', 'capacitor-booster'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midPriority);
        return loadout;
    }

    // --- Resist strategies ---
    const resistStrats = {
        'all-em-resist': 'em',
        'all-thermal-resist': 'thermal',
        'all-kinetic-resist': 'kinetic',
        'all-explosive-resist': 'explosive',
    };
    if (resistStrats[strategy]) {
        const type = resistStrats[strategy];
        // Default weapons (mix)
        const defaultWeapons = [...findWeapons('maser'), ...findWeapons('railgun')].sort((a, b) =>
            (b[1].damage / b[1].cycleTime) - (a[1].damage / a[1].cycleTime));
        fillSlots(loadout.high, highCount, defaultWeapons.map(([id]) => id));
        // Mid: type-specific shield hardener + shield booster
        const shieldHardener = `${type}-shield-hardener`;
        const midList = [shieldHardener, 'shield-booster', 'afterburner', 'capacitor-booster'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midList);
        // Low: type-specific armor hardener + damage-control
        const armorHardener = `${type}-armor-hardener`;
        const lowList = [armorHardener, 'damage-control', 'armor-plate', 'shield-extender'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, lowList);
        return loadout;
    }

    // --- Tank strategies ---
    if (strategy === 'omni-tank') {
        const defaultWeapons = [...findWeapons('maser'), ...findWeapons('railgun')].sort((a, b) =>
            (b[1].damage / b[1].cycleTime) - (a[1].damage / a[1].cycleTime));
        fillSlots(loadout.high, highCount, defaultWeapons.map(([id]) => id));
        const midList = ['adaptive-invulnerability-field', 'shield-booster', 'afterburner', 'capacitor-booster'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midList);
        const lowList = ['damage-control', 'energized-adaptive-membrane', 'armor-plate', 'shield-extender'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, lowList);
        return loadout;
    }

    if (strategy === 'max-shield-tank') {
        const defaultWeapons = [...findWeapons('maser'), ...findWeapons('railgun')].sort((a, b) =>
            (b[1].damage / b[1].cycleTime) - (a[1].damage / a[1].cycleTime));
        fillSlots(loadout.high, highCount, defaultWeapons.map(([id]) => id));
        const midList = ['shield-booster', 'adaptive-invulnerability-field', 'em-shield-hardener', 'afterburner'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midList);
        const lowList = ['shield-extender', 'shield-extender', 'damage-control', 'capacitor-flux-coil'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, lowList);
        return loadout;
    }

    if (strategy === 'max-armor-tank') {
        const defaultWeapons = [...findWeapons('maser'), ...findWeapons('railgun')].sort((a, b) =>
            (b[1].damage / b[1].cycleTime) - (a[1].damage / a[1].cycleTime));
        fillSlots(loadout.high, highCount, defaultWeapons.map(([id]) => id));
        const midList = ['armor-repairer', 'afterburner', 'capacitor-booster', 'sensor-booster'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midList);
        const lowList = ['armor-plate', 'energized-adaptive-membrane', 'damage-control', 'em-armor-hardener', 'thermal-armor-hardener'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, lowList);
        return loadout;
    }

    // --- Tactical strategies ---
    if (strategy === 'speed-kite') {
        // Long-range weapons
        const longRange = [...findWeapons('railgun'), ...findWeapons('missile')].sort((a, b) => {
            const rangeA = (a[1].optimalRange || a[1].range || 0) + (a[1].falloff || 0);
            const rangeB = (b[1].optimalRange || b[1].range || 0) + (b[1].falloff || 0);
            return rangeB - rangeA;
        });
        fillSlots(loadout.high, highCount, longRange.map(([id]) => id));
        const midList = ['microwarpdrive', 'afterburner-2', 'afterburner', 'sensor-booster'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midList);
        const lowList = ['nanofiber-2', 'nanofiber', 'overdrive-injector', 'damage-mod'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, lowList);
        return loadout;
    }

    if (strategy === 'brawl-tank') {
        // Short-range weapons (masers, highest DPS)
        const shortRange = findWeapons('maser');
        fillSlots(loadout.high, highCount, shortRange.map(([id]) => id));
        const midList = ['stasis-webifier', 'warp-scrambler', 'afterburner', 'shield-booster'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.mid, midCount, midList);
        const lowList = ['armor-plate', 'damage-control', 'damage-mod', 'energized-adaptive-membrane'].filter(id => EQUIPMENT_DATABASE[id]);
        fillSlots(loadout.low, lowCount, lowList);
        return loadout;
    }

    // Fallback: default loadout
    const key = `${shipConfig.role}-${shipConfig.size}`;
    if (DEFAULT_LOADOUTS[key]) {
        const preset = DEFAULT_LOADOUTS[key];
        return { high: [...(preset.high || [])], mid: [...(preset.mid || [])], low: [...(preset.low || [])] };
    }

    // Last resort auto-fill
    const weapons = Object.entries(EQUIPMENT_DATABASE)
        .filter(([, eq]) => eq.slot === 'weapon' && eq.damage && allowedSizes.includes(eq.size))
        .sort((a, b) => (b[1].damage / (b[1].cycleTime || 1)) - (a[1].damage / (a[1].cycleTime || 1)));
    fillSlots(loadout.high, highCount, weapons.map(([id]) => id));
    fillSlots(loadout.mid, midCount, ['shield-booster', 'afterburner'].filter(id => EQUIPMENT_DATABASE[id]));
    fillSlots(loadout.low, lowCount, ['damage-control', 'damage-mod'].filter(id => EQUIPMENT_DATABASE[id]));
    return loadout;
}

// =============================================
// Headless Battle API (for programmatic/automated testing)
// =============================================

/**
 * Run a battle headlessly at maximum speed. No rendering, no DOM.
 *
 * @param {Object} config
 * @param {Array}  config.teamA - [{shipId, count?, loadout?, ai?}]
 * @param {Array}  config.teamB - [{shipId, count?, loadout?, ai?}]
 * @param {string} config.aiA   - AI profile for team A (default: 'brawler')
 * @param {string} config.aiB   - AI profile for team B (default: 'brawler')
 * @param {number} config.maxTime - Max battle duration in seconds (default: 300)
 * @param {number} config.dt     - Sim timestep per tick (default: 0.1)
 * @returns {Object} Battle results {winner, time, ships[], killFeed[]}
 *
 * Example:
 *   const result = runBattle({
 *       teamA: [{ shipId: 'mercenary-cruiser', count: 3 }],
 *       teamB: [{ shipId: 'pirate-cruiser', count: 4 }],
 *   });
 *   console.log(result.winner, result.time);
 */
function runBattle(config = {}) {
    const engine = new BattleEngine();

    const addTeam = (team, entries, ai) => {
        engine.teamAI[team] = ai || 'brawler';
        for (const entry of (entries || [])) {
            const shipId = entry.shipId;
            const baseConfig = SHIP_DATABASE[shipId];
            if (!baseConfig) {
                console.warn(`[runBattle] Unknown shipId: ${shipId}`);
                continue;
            }
            // Check for faction overlay (e.g. "solarian-dominion-mercenary-cruiser")
            let shipConfig = baseConfig;
            const factionMatch = shipId.match(/^(.+?)-(?:mercenary|pirate|military|police|mining|hauler|logistics|surveyor|salvager|harvester)-/);
            if (factionMatch && FACTIONS[factionMatch[1]]) {
                const baseId = shipId.replace(factionMatch[1] + '-', '');
                const base = SHIP_DATABASE[baseId];
                if (base) shipConfig = applyFactionOverlay(base, baseId, factionMatch[1]);
            }
            const loadoutKey = `${shipConfig.role}-${shipConfig.size}`;
            const loadout = entry.loadout || DEFAULT_LOADOUTS[loadoutKey] || {};
            const count = entry.count || 1;
            engine.addToRoster(team, shipId, shipConfig, loadout, count);
        }
    };

    addTeam('a', config.teamA, config.aiA);
    addTeam('b', config.teamB, config.aiB);

    if (engine.roster.a.length === 0 || engine.roster.b.length === 0) {
        return { winner: 'invalid', time: 0, ships: [], killFeed: [], error: 'Both teams need ships' };
    }

    engine.setupBattle();
    engine.state = 'running';

    const maxTime = config.maxTime || 300;
    const dt = config.dt || 0.1;

    while (engine.state === 'running' && engine.time < maxTime) {
        engine.step(dt);
    }

    return engine.getResults();
}

/**
 * Run N battles and return aggregate stats.
 *
 * @param {Object} config - Same as runBattle plus:
 * @param {number} config.runs - Number of battles to run (default: 10)
 * @returns {Object} { runs, wins: {a, b, draw}, avgTime, results[] }
 */
function runBattleBatch(config = {}) {
    const runs = config.runs || 10;
    const wins = { a: 0, b: 0, draw: 0 };
    const results = [];
    let totalTime = 0;

    for (let i = 0; i < runs; i++) {
        const result = runBattle(config);
        results.push(result);
        wins[result.winner] = (wins[result.winner] || 0) + 1;
        totalTime += result.time;
    }

    return {
        runs,
        wins,
        winRate: { a: (wins.a / runs * 100).toFixed(1) + '%', b: (wins.b / runs * 100).toFixed(1) + '%' },
        avgTime: (totalTime / runs).toFixed(1) + 's',
        results,
    };
}

// =============================================
// Balance Report System
// =============================================

/**
 * Get all combat-capable ship IDs grouped by size tier.
 */
function getCombatShipsBySize() {
    const combatRoles = ['mercenary', 'pirate', 'military', 'police'];
    const bySize = {};
    for (const [id, ship] of Object.entries(SHIP_DATABASE)) {
        if (!combatRoles.includes(ship.role)) continue;
        if (!bySize[ship.size]) bySize[ship.size] = [];
        bySize[ship.size].push(id);
    }
    return bySize;
}

/**
 * Run a comprehensive balance analysis.
 *
 * @param {Object} options
 * @param {boolean} options.quick - Use 3 runs instead of 10 per matchup
 * @param {boolean} options.skipMatchups - Skip 1v1 matrix
 * @param {boolean} options.skipResists - Skip resist matrix
 * @param {boolean} options.skipTiers - Skip tier scaling
 * @returns {Object} Full balance report
 */
function runBalanceReport(options = {}) {
    const runs = options.quick ? 3 : 10;
    const report = {
        matchups: { results: {}, outliers: [] },
        resistMatrix: { results: {}, analysis: '' },
        tierScaling: { results: [], analysis: '' },
        warnings: [],
        suggestions: [],
        timestamp: Date.now(),
    };

    const shipsBySize = getCombatShipsBySize();

    // ---- Matrix 1: 1v1 Ship Matchups (same size tier) ----
    if (!options.skipMatchups) {
        const winRates = {}; // shipId -> { wins, total }

        for (const [size, shipIds] of Object.entries(shipsBySize)) {
            if (shipIds.length < 2) continue;
            // Limit to reasonable count: max 8 per tier to avoid combinatorial explosion
            const testIds = shipIds.slice(0, 8);
            for (let i = 0; i < testIds.length; i++) {
                for (let j = i + 1; j < testIds.length; j++) {
                    const idA = testIds[i];
                    const idB = testIds[j];
                    const key = `${idA}-vs-${idB}`;
                    let winsA = 0, winsB = 0, totalTime = 0;

                    for (let r = 0; r < runs; r++) {
                        const result = runBattle({
                            teamA: [{ shipId: idA }],
                            teamB: [{ shipId: idB }],
                            maxTime: 120,
                        });
                        if (result.winner === 'a') winsA++;
                        else if (result.winner === 'b') winsB++;
                        totalTime += result.time;
                    }

                    report.matchups.results[key] = {
                        shipA: idA, shipB: idB, size,
                        winRateA: winsA / runs,
                        winRateB: winsB / runs,
                        avgTime: +(totalTime / runs).toFixed(1),
                    };

                    // Accumulate per-ship stats
                    if (!winRates[idA]) winRates[idA] = { wins: 0, total: 0 };
                    if (!winRates[idB]) winRates[idB] = { wins: 0, total: 0 };
                    winRates[idA].wins += winsA;
                    winRates[idA].total += runs;
                    winRates[idB].wins += winsB;
                    winRates[idB].total += runs;
                }
            }
        }

        // Find outliers
        for (const [shipId, data] of Object.entries(winRates)) {
            if (data.total < 3) continue;
            const avgWinRate = data.wins / data.total;
            if (avgWinRate > 0.70) {
                report.matchups.outliers.push({ ship: shipId, avgWinRate: +avgWinRate.toFixed(3), verdict: 'overpowered' });
                report.warnings.push(`${shipId} has ${(avgWinRate * 100).toFixed(0)}% win rate - likely overpowered`);
                report.suggestions.push(`Consider reducing ${shipId}'s damage or HP by 10-15%`);
            } else if (avgWinRate < 0.30) {
                report.matchups.outliers.push({ ship: shipId, avgWinRate: +avgWinRate.toFixed(3), verdict: 'underpowered' });
                report.warnings.push(`${shipId} has ${(avgWinRate * 100).toFixed(0)}% win rate - likely underpowered`);
                report.suggestions.push(`Consider buffing ${shipId}'s damage or HP by 10-15%`);
            }
        }
    }

    // ---- Matrix 2: Damage Type vs Resist Type ----
    if (!options.skipResists) {
        const dmgTypes = ['em', 'thermal', 'kinetic', 'explosive'];
        const resistTypes = ['em', 'thermal', 'kinetic', 'explosive', 'omni'];

        // Use cruiser-size ships for resist testing
        const testShipId = shipsBySize.cruiser?.[0] || shipsBySize.frigate?.[0] || Object.keys(SHIP_DATABASE)[0];
        const testConfig = SHIP_DATABASE[testShipId];
        if (testConfig) {
            const analysisLines = [];

            for (const dmgType of dmgTypes) {
                // Generate attacker loadout: max DPS of one damage type
                const dmgStrategy = dmgType === 'em' ? 'max-dps-maser' :
                                     dmgType === 'kinetic' ? 'max-dps-railgun' :
                                     dmgType === 'explosive' ? 'max-dps-missile' : 'max-dps-maser';

                for (const resType of resistTypes) {
                    const resStrategy = resType === 'omni' ? 'omni-tank' : `all-${resType}-resist`;
                    const attackLoadout = generateLoadout(dmgStrategy, testConfig);
                    const defendLoadout = generateLoadout(resStrategy, testConfig);

                    let totalTTK = 0, totalResistAbsorbed = 0, totalEffDps = 0;
                    for (let r = 0; r < runs; r++) {
                        const result = runBattle({
                            teamA: [{ shipId: testShipId, loadout: attackLoadout }],
                            teamB: [{ shipId: testShipId, loadout: defendLoadout }],
                            maxTime: 120,
                        });
                        totalTTK += result.time;
                        // Get defender stats
                        const defender = result.ships.find(s => s.team === 'b');
                        if (defender) {
                            totalResistAbsorbed += defender.damageAbsorbedByResist || 0;
                            totalEffDps += (defender.damageTaken || 0) / Math.max(result.time, 0.1);
                        }
                    }

                    const key = `${dmgType}-vs-${resType}-resist`;
                    report.resistMatrix.results[key] = {
                        dmgType, resType,
                        avgTTK: +(totalTTK / runs).toFixed(2),
                        resistAbsorbed: Math.round(totalResistAbsorbed / runs),
                        effectiveDps: +(totalEffDps / runs).toFixed(2),
                    };

                    if (dmgType === resType) {
                        const reduction = totalResistAbsorbed / Math.max(totalResistAbsorbed + (totalEffDps * totalTTK / runs), 1);
                        analysisLines.push(`${resType.charAt(0).toUpperCase() + resType.slice(1)} resists reduce ${dmgType} DPS by ~${(reduction * 100).toFixed(0)}%`);
                    }
                }
            }
            report.resistMatrix.analysis = analysisLines.join('. ');
        }
    }

    // ---- Matrix 3: Size Tier Scaling ----
    if (!options.skipTiers) {
        const scalingTests = [
            { big: 'battleship', small: 'frigate', label: '1 BS vs N FR', expectedN: 5 },
            { big: 'cruiser', small: 'frigate', label: '1 CR vs N FR', expectedN: 3 },
            { big: 'battlecruiser', small: 'destroyer', label: '1 BC vs N DD', expectedN: 3 },
        ];
        const analysisLines = [];

        for (const test of scalingTests) {
            const bigShipId = shipsBySize[test.big]?.[0];
            const smallShipId = shipsBySize[test.small]?.[0];
            if (!bigShipId || !smallShipId) continue;

            let balancePoint = -1;
            // Binary-ish search: try N from 1 to 10
            for (let n = 1; n <= 10; n++) {
                let bigWins = 0;
                for (let r = 0; r < runs; r++) {
                    const result = runBattle({
                        teamA: [{ shipId: bigShipId }],
                        teamB: [{ shipId: smallShipId, count: n }],
                        maxTime: 120,
                    });
                    if (result.winner === 'a') bigWins++;
                }
                const winRate = bigWins / runs;
                if (winRate <= 0.55 && balancePoint < 0) {
                    balancePoint = n;
                    break;
                }
            }
            if (balancePoint < 0) balancePoint = 10; // never lost

            report.tierScaling.results.push({
                matchup: test.label,
                bigShip: bigShipId,
                smallShip: smallShipId,
                balancePoint,
                expectedN: test.expectedN,
            });

            const efficiency = ((balancePoint / test.expectedN) * 100).toFixed(0);
            analysisLines.push(`${test.big}s are ${efficiency}% efficient vs ${test.small}s (balance at ${balancePoint}, expected ${test.expectedN})`);
        }
        report.tierScaling.analysis = analysisLines.join('. ');
    }

    return report;
}

/**
 * Compare two balance reports and flag regressions.
 */
function compareToBaseline(currentReport, baselineReport) {
    if (!currentReport || !baselineReport) {
        return { error: 'Both current and baseline reports required' };
    }

    const diff = {
        matchupChanges: [],
        newOutliers: [],
        resolvedOutliers: [],
        tierDrift: [],
        timestamp: Date.now(),
        baselineTimestamp: baselineReport.timestamp,
    };

    // Compare matchup win rates
    if (currentReport.matchups && baselineReport.matchups) {
        for (const [key, current] of Object.entries(currentReport.matchups.results)) {
            const baseline = baselineReport.matchups.results[key];
            if (!baseline) continue;
            const deltaA = Math.abs(current.winRateA - baseline.winRateA);
            if (deltaA > 0.10) {
                diff.matchupChanges.push({
                    matchup: key,
                    oldWinRateA: +baseline.winRateA.toFixed(3),
                    newWinRateA: +current.winRateA.toFixed(3),
                    delta: +(current.winRateA - baseline.winRateA).toFixed(3),
                });
            }
        }

        // New outliers
        const baselineOutlierIds = new Set((baselineReport.matchups.outliers || []).map(o => o.ship));
        const currentOutlierIds = new Set((currentReport.matchups.outliers || []).map(o => o.ship));
        for (const outlier of (currentReport.matchups.outliers || [])) {
            if (!baselineOutlierIds.has(outlier.ship)) {
                diff.newOutliers.push(outlier);
            }
        }
        for (const outlier of (baselineReport.matchups.outliers || [])) {
            if (!currentOutlierIds.has(outlier.ship)) {
                diff.resolvedOutliers.push(outlier);
            }
        }
    }

    // Compare tier scaling
    if (currentReport.tierScaling && baselineReport.tierScaling) {
        for (const current of currentReport.tierScaling.results) {
            const baseline = baselineReport.tierScaling.results.find(r => r.matchup === current.matchup);
            if (!baseline) continue;
            if (current.balancePoint !== baseline.balancePoint) {
                diff.tierDrift.push({
                    matchup: current.matchup,
                    oldBalance: baseline.balancePoint,
                    newBalance: current.balancePoint,
                });
            }
        }
    }

    return diff;
}

/**
 * Save a balance report as baseline to localStorage.
 */
function saveBaseline(report) {
    try {
        localStorage.setItem('battle-sim-baseline', JSON.stringify(report));
        return { success: true, timestamp: report.timestamp };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Load the stored baseline balance report from localStorage.
 */
function loadBaseline() {
    try {
        const data = localStorage.getItem('battle-sim-baseline');
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

// Expose to global scope for console/script access
window.runBattle = runBattle;
window.runBattleBatch = runBattleBatch;
window.generateLoadout = generateLoadout;
window.runBalanceReport = runBalanceReport;
window.compareToBaseline = compareToBaseline;
window.saveBaseline = saveBaseline;
window.loadBaseline = loadBaseline;
window.SHIP_DATABASE = SHIP_DATABASE;
window.EQUIPMENT_DATABASE = EQUIPMENT_DATABASE;
window.DEFAULT_LOADOUTS = DEFAULT_LOADOUTS;
window.SIZE_COMPAT = SIZE_COMPAT;

// =============================================
// Initialize
// =============================================

// Load Three.js from CDN
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
script.onload = () => {
    window.sim = new BattleSimUI();
};
document.head.appendChild(script);
