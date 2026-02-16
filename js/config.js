// =============================================
// EXPEDITION - Game Configuration
// =============================================

export const CONFIG = {
    // World Settings
    SECTOR_SIZE: 30000,          // 30,000 x 30,000 units (doubled for larger scale)
    UNIVERSE_SEED: 12345,        // Base seed for universe generation

    // Central Planet (dominant body in center of each sector)
    CENTRAL_PLANET: {
        radius: 2000,            // Very large - dominates the sector center
        minOrbitDistance: 2500,  // Minimum safe distance to orbit
        killRadius: 2050,        // Slightly larger than visual - instant death zone
    },

    // Camera
    CAMERA_ZOOM_MIN: 50,         // Very close to ship
    CAMERA_ZOOM_MAX: 15000,      // Almost sector map view (increased for larger sectors)
    CAMERA_ZOOM_DEFAULT: 500,
    CAMERA_ZOOM_SPEED: 0.1,
    CAMERA_PAN_SPEED: 1,

    // Player Ship Defaults (speeds reduced 50% for larger sector feel)
    PLAYER_START_CREDITS: 10000,
    PLAYER_MAX_SPEED: 100,       // Base max speed m/s
    PLAYER_ACCELERATION: 25,
    PLAYER_TURN_SPEED: 2,
    PLAYER_WARP_SPEED: 3000,     // Speed during warp
    PLAYER_WARP_ALIGN_TIME: 3,   // Seconds to align for warp

    // Hero Ship Hull Tiers (upgrade costs)
    HULL_TIERS: {
        'frigate':       { tier: 1, name: 'Frigate Hull',       cost: 0,      nextTier: 'destroyer' },
        'destroyer':     { tier: 2, name: 'Destroyer Hull',     cost: 25000,  nextTier: 'cruiser' },
        'cruiser':       { tier: 3, name: 'Cruiser Hull',       cost: 75000,  nextTier: 'battlecruiser' },
        'battlecruiser': { tier: 4, name: 'Battlecruiser Hull', cost: 200000, nextTier: 'battleship' },
        'battleship':    { tier: 5, name: 'Battleship Hull',    cost: 500000, nextTier: null },
    },

    // Component Upgrades (applied on top of ship base stats)
    COMPONENT_UPGRADES: {
        reactor:  { name: 'Reactor',  stat: 'capacitorRegen', levels: [1.0, 1.15, 1.30, 1.50], costs: [0, 5000, 15000, 40000], label: 'Cap Regen' },
        engines:  { name: 'Engines',  stat: 'maxSpeed',       levels: [1.0, 1.10, 1.20, 1.35], costs: [0, 5000, 15000, 40000], label: 'Max Speed' },
        sensors:  { name: 'Sensors',  stat: 'lockTimeBonus',  levels: [1.0, 0.90, 0.80, 0.65], costs: [0, 5000, 15000, 40000], label: 'Lock Time' },
        plating:  { name: 'Plating',  stat: 'hullBonus',      levels: [1.0, 1.15, 1.30, 1.50], costs: [0, 8000, 20000, 50000], label: 'Hull HP' },
    },

    // Combat
    WEAPON_RANGE_SHORT: 500,
    WEAPON_RANGE_MEDIUM: 1000,
    WEAPON_RANGE_LONG: 2000,
    LOCK_TIME_BASE: 2,           // Seconds to lock target

    // Mining
    MINING_RANGE: 200,
    MINING_CYCLE_TIME: 5,        // Seconds per mining cycle
    MINING_YIELD_BASE: 50,       // Credits per cycle

    // Capacitor
    CAPACITOR_MAX: 100,
    CAPACITOR_REGEN: 5,          // Per second

    // Ship Classes (speeds reduced 50% for larger sector feel)
    SHIPS: {
        frigate: {
            name: 'Starter Frigate',
            shipClass: 'frigate',
            role: 'mercenary',
            size: 'frigate',
            maxSpeed: 125,
            acceleration: 30,
            shield: 100,
            armor: 50,
            hull: 100,
            capacitor: 100,
            capacitorRegen: 3,
            signatureRadius: 30,
            highSlots: 3,
            midSlots: 2,
            lowSlots: 2,
            cargoCapacity: 200,
            droneCapacity: 2,
            droneBandwidth: 20,
            price: 5000,
            weaponSlots: 3,
        },
        cruiser: {
            name: 'Cruiser',
            maxSpeed: 75,
            acceleration: 15,
            shield: 300,
            armor: 200,
            hull: 250,
            capacitor: 200,
            capacitorRegen: 5,
            signatureRadius: 80,
            highSlots: 4,
            midSlots: 3,
            lowSlots: 3,
            cargoCapacity: 300,
            price: 50000,
        },
        battleship: {
            name: 'Battleship',
            maxSpeed: 40,
            acceleration: 8,
            shield: 800,
            armor: 600,
            hull: 500,
            capacitor: 400,
            capacitorRegen: 8,
            signatureRadius: 200,
            highSlots: 6,
            midSlots: 4,
            lowSlots: 4,
            cargoCapacity: 500,
            price: 200000,
        },
    },

    // Modules
    MODULES: {
        // High Slot - Weapons
        'small-laser': {
            name: 'Small Pulse Laser',
            slot: 'high',
            damage: 15,
            range: 500,
            cycleTime: 2,
            capacitorUse: 5,
            price: 1000,
        },
        'medium-laser': {
            name: 'Medium Pulse Laser',
            slot: 'high',
            damage: 35,
            range: 800,
            cycleTime: 3,
            capacitorUse: 12,
            price: 5000,
        },
        'mining-laser': {
            name: 'Mining Laser I',
            slot: 'high',
            miningYield: 50,
            range: 200,
            cycleTime: 5,
            capacitorUse: 8,
            price: 2000,
        },
        'mining-laser-2': {
            name: 'Mining Laser II',
            slot: 'high',
            miningYield: 100,
            range: 250,
            cycleTime: 4,
            capacitorUse: 10,
            price: 10000,
        },

        // Mid Slot
        'shield-booster': {
            name: 'Shield Booster I',
            slot: 'mid',
            shieldRepair: 30,
            cycleTime: 4,
            capacitorUse: 15,
            price: 3000,
        },
        'afterburner': {
            name: 'Afterburner I',
            slot: 'mid',
            speedBonus: 1.5, // 50% bonus
            capacitorUse: 3, // Per second when active
            price: 2500,
        },
        'warp-scrambler': {
            name: 'Warp Scrambler I',
            slot: 'mid',
            range: 300,
            warpDisrupt: 2,
            capacitorUse: 5,
            price: 8000,
        },

        // Low Slot
        'armor-repairer': {
            name: 'Armor Repairer I',
            slot: 'low',
            armorRepair: 25,
            cycleTime: 5,
            capacitorUse: 20,
            price: 4000,
        },
        'damage-mod': {
            name: 'Damage Amplifier I',
            slot: 'low',
            damageBonus: 1.1, // 10% bonus
            price: 5000,
        },
    },

    // Drones - Light/Medium/Heavy tiers for mining & combat, plus EWAR variants
    DRONES: {
        // ---- Mining Drones ----
        'mining-drone-light': {
            name: 'Mining Drone I',
            type: 'mining',
            size: 'light',
            miningYield: 3,
            miningCycleTime: 3,
            cargoCapacity: 30,
            speed: 180,
            orbitRange: 80,
            hp: 30,
            bandwidth: 5,
            price: 2000,
        },
        'mining-drone': {
            name: 'Mining Drone II',
            type: 'mining',
            size: 'medium',
            miningYield: 6,
            miningCycleTime: 3,
            cargoCapacity: 60,
            speed: 150,
            orbitRange: 100,
            hp: 50,
            bandwidth: 10,
            price: 5000,
        },
        'mining-drone-heavy': {
            name: 'Mining Drone III',
            type: 'mining',
            size: 'heavy',
            miningYield: 12,
            miningCycleTime: 4,
            cargoCapacity: 100,
            speed: 100,
            orbitRange: 120,
            hp: 100,
            bandwidth: 25,
            price: 15000,
        },
        // ---- Combat Drones ----
        'combat-drone-light': {
            name: 'Hornet I',
            type: 'combat',
            size: 'light',
            damage: 6,
            attackCycleTime: 1.5,
            speed: 280,
            orbitRange: 120,
            range: 400,
            hp: 40,
            bandwidth: 5,
            price: 4000,
        },
        'combat-drone': {
            name: 'Hammerhead II',
            type: 'combat',
            size: 'medium',
            damage: 12,
            attackCycleTime: 2,
            speed: 200,
            orbitRange: 150,
            range: 500,
            hp: 75,
            bandwidth: 10,
            price: 10000,
        },
        'combat-drone-heavy': {
            name: 'Ogre III',
            type: 'combat',
            size: 'heavy',
            damage: 25,
            attackCycleTime: 3,
            speed: 120,
            orbitRange: 200,
            range: 600,
            hp: 150,
            bandwidth: 25,
            price: 25000,
        },
        // ---- EWAR Drones ----
        'jamming-drone': {
            name: 'EC-300 Jammer',
            type: 'ewar',
            size: 'medium',
            ewarType: 'jam',
            jamStrength: 3,           // Chance to break lock per cycle (vs sensor strength)
            jamCycleTime: 8,          // Seconds between jam attempts
            speed: 220,
            orbitRange: 180,
            range: 600,
            hp: 35,
            bandwidth: 10,
            price: 12000,
        },
        'dampening-drone': {
            name: 'SD-300 Dampener',
            type: 'ewar',
            size: 'medium',
            ewarType: 'damp',
            warpDisruptStrength: 1,   // Points of warp disruption
            dampCycleTime: 5,         // Seconds between re-application
            speed: 200,
            orbitRange: 200,
            range: 500,
            hp: 40,
            bandwidth: 10,
            price: 10000,
        },
        // ---- Scout Drone (unchanged) ----
        'scout-drone': {
            name: 'Scout Drone I',
            type: 'scout',
            size: 'light',
            speed: 300,
            orbitRange: 200,
            hp: 25,
            bandwidth: 5,
            scanBonus: 1.25,
            price: 3000,
        },
    },

    // Asteroids (volumePerUnit: m³ per unit of ore)
    ASTEROID_TYPES: {
        veldspar: { name: 'Veldspar', color: 0x888888, value: 10, abundance: 0.5, volumePerUnit: 0.1 },
        scordite: { name: 'Scordite', color: 0xaa6633, value: 25, abundance: 0.3, volumePerUnit: 0.15 },
        pyroxeres: { name: 'Pyroxeres', color: 0x44aa66, value: 50, abundance: 0.15, volumePerUnit: 0.2 },
        plagioclase: { name: 'Plagioclase', color: 0x4466aa, value: 100, abundance: 0.05, volumePerUnit: 0.35 },
    },

    // Enemy Types
    ENEMIES: {
        'pirate-frigate': {
            name: 'Pirate Frigate',
            shipClass: 'frigate',
            aggression: 0.8,
            loot: { min: 100, max: 500 },
            bounty: 500,
        },
        'pirate-cruiser': {
            name: 'Pirate Cruiser',
            shipClass: 'cruiser',
            aggression: 0.6,
            loot: { min: 500, max: 2000 },
            bounty: 2000,
        },
    },

    // Sector Difficulty
    SECTOR_DIFFICULTY: {
        tutorial: { enemyCount: 0, asteroidDensity: 0.6, name: 'Training Grounds' },
        hub: { enemyCount: 0, asteroidDensity: 0.1, name: 'Hub Station' },
        safe: { enemyCount: 2, asteroidDensity: 0.3, name: 'Safe Zone' },
        tame: { enemyCount: 3, asteroidDensity: 0.4, name: 'Tame Territory' },
        normal: { enemyCount: 5, asteroidDensity: 0.5, name: 'Normal Space' },
        neutral: { enemyCount: 7, asteroidDensity: 0.45, name: 'Neutral Zone' },
        dangerous: { enemyCount: 10, asteroidDensity: 0.4, name: 'Dangerous Zone' },
        deadly: { enemyCount: 15, asteroidDensity: 0.2, name: 'Deadly Zone' },
    },

    // Ore-to-Ingot refinery conversion rates
    REFINERY_CONVERSIONS: {
        veldspar: { material: 'tritanium-ingots', rate: 0.4, name: 'Tritanium Ingots' },
        scordite: { material: 'pyerite-ingots', rate: 0.35, name: 'Pyerite Ingots' },
        pyroxeres: { material: 'mexallon-ingots', rate: 0.3, name: 'Mexallon Ingots' },
        plagioclase: { material: 'isogen-ingots', rate: 0.25, name: 'Isogen Ingots' },
        omber: { material: 'nocxium-ingots', rate: 0.2, name: 'Nocxium Ingots' },
        kernite: { material: 'zydrine-ingots', rate: 0.15, name: 'Zydrine Ingots' },
    },

    // NPC Ecosystem
    NPC_MINERS: {
        tutorial: { count: 3, shipClass: 'frigate', droneCount: 2 },
        hub: { count: 7, shipClass: 'frigate', droneCount: 2 },
        safe: { count: 5, shipClass: 'frigate', droneCount: 2 },
        tame: { count: 4, shipClass: 'frigate', droneCount: 2 },
        normal: { count: 3, shipClass: 'frigate', droneCount: 2 },
        neutral: { count: 2, shipClass: 'frigate', droneCount: 1 },
        dangerous: { count: 1, shipClass: 'frigate', droneCount: 1 },
        deadly: { count: 0, shipClass: 'frigate', droneCount: 0 },
    },
    NPC_SECURITY: {
        tutorial: { count: 2, shipClass: 'cruiser' },
        hub: { count: 5, shipClass: 'cruiser' },
        safe: { count: 4, shipClass: 'cruiser' },
        tame: { count: 3, shipClass: 'cruiser' },
        normal: { count: 3, shipClass: 'frigate' },
        neutral: { count: 2, shipClass: 'frigate' },
        dangerous: { count: 2, shipClass: 'frigate' },
        deadly: { count: 1, shipClass: 'frigate' },
    },
    NPC_PIRATE_RAIDS: {
        tutorial: { chance: 0, interval: 999, maxPirates: 0 },
        hub: { chance: 0, interval: 999, maxPirates: 0 },
        safe: { chance: 0.25, interval: 120, maxPirates: 2 },
        tame: { chance: 0.15, interval: 150, maxPirates: 1 },
        normal: { chance: 0.45, interval: 90, maxPirates: 3 },
        neutral: { chance: 0.35, interval: 100, maxPirates: 2 },
        dangerous: { chance: 0.6, interval: 60, maxPirates: 4 },
        deadly: { chance: 0.8, interval: 45, maxPirates: 5 },
    },

    // Fleet
    FLEET: {
        MAX_SIZE: 10,
    },

    // Colors
    COLORS: {
        primary: 0x00ffff,
        secondary: 0x0088ff,
        hostile: 0xff4444,
        friendly: 0x44ff44,
        neutral: 0x888888,
        miner: 0x88aacc,
        security: 0x4488ff,
        shield: 0x00aaff,
        armor: 0xffaa00,
        hull: 0xff4444,
        warp: 0x4488ff,
        nebula1: 0x220044,
        nebula2: 0x004422,
        nebula3: 0x442200,
    },

    // UI
    UI_UPDATE_RATE: 100,         // ms between UI updates
    OVERVIEW_UPDATE_RATE: 500,   // ms between overview updates
    MINIMAP_UPDATE_RATE: 200,    // ms between minimap updates

    // Audio
    AUDIO_ENABLED: true,
    MASTER_VOLUME: 0.5,

    // Graphics
    STAR_COUNT: 500,
    PARTICLE_POOL_SIZE: 500,
    MAX_VISIBLE_OBJECTS: 100,

    // Death
    DEATH_CREDIT_PENALTY: 0.1,   // Lose 10% of credits on death

    // Sector Environment Hazards
    SECTOR_HAZARDS: {
        'sector-4': {
            type: 'radiation',
            name: 'Radiation Belt',
            damagePerSecond: 2,
            interval: 3,
            warning: 'RADIATION WARNING - Hull taking damage',
            color: '#ff4444',
        },
        'sector-5': {
            type: 'ion-storm',
            name: 'Ion Storm',
            capDrainPerSecond: 8,
            interval: 2,
            warning: 'ION STORM - Capacitor destabilizing',
            color: '#8844ff',
        },
        'sector-6': {
            type: 'nebula-interference',
            name: 'Nebula Interference',
            radarReduction: 0.5,
            warning: 'NEBULA INTERFERENCE - Sensor range reduced',
            color: '#44aa88',
        },
        // Tier 3 - Kristang sectors (hostile, combat-heavy)
        'kristang-hold': {
            type: 'radiation',
            name: 'Kristang Radiation Grid',
            damagePerSecond: 3,
            interval: 3,
            warning: 'KRISTANG RADIATION GRID - Hull taking damage',
            color: '#ff6644',
        },
        'kristang-arena': {
            type: 'radiation',
            name: 'Blood Arena Fallout',
            damagePerSecond: 4,
            interval: 3,
            warning: 'ARENA FALLOUT - Intense radiation exposure',
            color: '#ff4422',
        },
        // Tier 2 - Thuranin (tech/ion storms)
        'thuranin-prime': {
            type: 'ion-storm',
            name: 'Thuranin Capacitor Drain Field',
            capDrainPerSecond: 12,
            interval: 2,
            warning: 'THURANIN DRAIN FIELD - Capacitor destabilizing',
            color: '#6644ff',
        },
        'thuranin-labs': {
            type: 'nebula-interference',
            name: 'Thuranin Research Interference',
            radarReduction: 0.6,
            warning: 'RESEARCH ARRAY INTERFERENCE - Sensors disrupted',
            color: '#5588cc',
        },
        // Tier 2 - Bosphuraq (aggressive)
        'bosphuraq-prime': {
            type: 'radiation',
            name: 'Bosphuraq Nest Radiation',
            damagePerSecond: 3,
            interval: 3,
            warning: 'NEST RADIATION - Hull taking damage',
            color: '#ff8844',
        },
        // Tier 1 - Maxolhx (extreme)
        'maxolhx-prime': {
            type: 'ion-storm',
            name: 'Maxolhx Suppression Field',
            capDrainPerSecond: 16,
            interval: 2,
            warning: 'MAXOLHX SUPPRESSION FIELD - Critical cap drain',
            color: '#aa22ff',
        },
        'maxolhx-throne': {
            type: 'radiation',
            name: 'Apex Throne Radiation',
            damagePerSecond: 6,
            interval: 2,
            warning: 'APEX THRONE RADIATION - Extreme hull damage',
            color: '#ff2222',
        },
        // Contested zones
        't2-contested-a': {
            type: 'nebula-interference',
            name: 'Shattered Expanse Debris',
            radarReduction: 0.4,
            warning: 'DEBRIS FIELD - Sensor range severely reduced',
            color: '#448888',
        },
        't1-contested': {
            type: 'ion-storm',
            name: 'Crucible Storm',
            capDrainPerSecond: 14,
            interval: 2,
            warning: 'CRUCIBLE STORM - Extreme capacitor drain',
            color: '#9944ff',
        },
    },
};

// Sector layout for hub-and-spoke universe
export const UNIVERSE_LAYOUT = {
    sectors: [
        // === RING 0 - HUMANITY CORE ===
        { id: 'tutorial', name: 'Training Grounds', x: 0, y: 2, difficulty: 'tutorial', hasStation: true, region: 'core', faction: 'unef' },
        { id: 'hub', name: 'Central Hub', x: 0, y: 0, difficulty: 'hub', hasStation: true, region: 'core', faction: 'unef' },
        { id: 'sector-1', name: 'Mining Fields Alpha', x: -1, y: 0, difficulty: 'safe', hasStation: true, region: 'core', faction: 'unef' },
        { id: 'sector-2', name: 'Mining Fields Beta', x: 1, y: 0, difficulty: 'safe', hasStation: true, region: 'core', faction: 'unef' },
        { id: 'sector-3', name: 'Frontier Zone', x: 0, y: -1, difficulty: 'normal', hasStation: true, region: 'core', faction: 'unef' },
        { id: 'sector-4', name: 'Pirate Territory', x: -1, y: -1, difficulty: 'dangerous', hasStation: true, region: 'core', faction: 'unef' },
        { id: 'sector-5', name: 'The Abyss', x: 1, y: -1, difficulty: 'deadly', hasStation: true, region: 'core', faction: 'mavericks' },
        { id: 'sector-6', name: 'Nebula Expanse', x: 0, y: 1, difficulty: 'normal', hasStation: true, region: 'core', faction: 'unef' },

        // === RING 0.5 - MILKY WAY (Human Space) ===
        { id: 'mw-alpha', name: 'Sol Gateway', x: 3, y: 0, difficulty: 'safe', hasStation: true, region: 'milkyway', stationType: 'military-hub', faction: 'unef' },
        { id: 'mw-bravo', name: 'Orion Refinery', x: 4, y: -1, difficulty: 'tame', hasStation: true, region: 'milkyway', stationType: 'mining-hub', faction: 'unef' },
        { id: 'mw-charlie', name: 'Cygnus Forge', x: 5, y: 0, difficulty: 'tame', hasStation: true, region: 'milkyway', stationType: 'mining-hub', faction: 'unef' },
        { id: 'mw-delta', name: 'Vega Outpost', x: 5, y: 1, difficulty: 'neutral', hasStation: true, region: 'milkyway', stationType: 'mercenary-hub', faction: 'unef' },
        { id: 'mw-echo', name: 'Sirius Station', x: 4, y: 1, difficulty: 'safe', hasStation: true, region: 'milkyway', stationType: 'military-hub', faction: 'unef' },
        { id: 'mw-foxtrot', name: 'Arcturus Landing', x: 3, y: 1, difficulty: 'neutral', hasStation: true, region: 'milkyway', stationType: 'mercenary-hub', faction: 'mavericks' },

        // === RING 1 - TIER 3 ZONES ===
        // Ruhar (friendly) territory
        { id: 'ruhar-prime', name: 'Ruhar Prime', x: -3, y: 3, difficulty: 'safe', hasStation: true, region: 'ruhar', faction: 'ruhar' },
        { id: 'ruhar-haven', name: 'Burrow Haven', x: -4, y: 2, difficulty: 'tame', hasStation: true, region: 'ruhar', faction: 'ruhar' },
        { id: 'ruhar-market', name: 'Hamster Market', x: -2, y: 3, difficulty: 'safe', hasStation: true, region: 'ruhar', faction: 'ruhar' },
        // Kristang (hostile) territory
        { id: 'kristang-hold', name: 'Kristang Hold', x: 3, y: -3, difficulty: 'dangerous', hasStation: true, region: 'kristang', faction: 'kristang' },
        { id: 'kristang-arena', name: 'Blood Arena', x: 4, y: -3, difficulty: 'dangerous', hasStation: true, region: 'kristang', faction: 'kristang' },
        { id: 'kristang-forge', name: 'War Forge', x: 2, y: -4, difficulty: 'neutral', hasStation: true, region: 'kristang', faction: 'kristang' },
        // Contested border
        { id: 'border-alpha', name: 'Contested Alpha', x: 0, y: -3, difficulty: 'normal', hasStation: false, region: 'border', faction: null, contested: true, contestedFactions: ['ruhar', 'kristang'] },
        { id: 'border-bravo', name: 'Scorched Plains', x: 1, y: -3, difficulty: 'normal', hasStation: false, region: 'border', faction: null, contested: true, contestedFactions: ['ruhar', 'kristang'] },
        { id: 'border-charlie', name: 'Burning Line', x: -1, y: -3, difficulty: 'normal', hasStation: false, region: 'border', faction: null, contested: true, contestedFactions: ['ruhar', 'kristang'] },
        // Keepers enclave
        { id: 'keepers-enclave', name: 'Keepers Enclave', x: -2, y: 2, difficulty: 'tame', hasStation: true, region: 'core', faction: 'keepers' },

        // === RING 2 - TIER 2 ZONES ===
        // Jeraptha (Rindhalu Coalition)
        { id: 'jeraptha-prime', name: 'Jeraptha Exchange', x: -6, y: 4, difficulty: 'neutral', hasStation: true, region: 'jeraptha', faction: 'jeraptha' },
        { id: 'jeraptha-docks', name: 'Beetle Docks', x: -5, y: 5, difficulty: 'neutral', hasStation: true, region: 'jeraptha', faction: 'jeraptha' },
        // Thuranin (Maxolhx Coalition)
        { id: 'thuranin-prime', name: 'Thuranin Nexus', x: 6, y: -5, difficulty: 'dangerous', hasStation: true, region: 'thuranin', faction: 'thuranin' },
        { id: 'thuranin-labs', name: 'Research Array', x: 7, y: -4, difficulty: 'dangerous', hasStation: true, region: 'thuranin', faction: 'thuranin' },
        // Bosphuraq (Maxolhx Coalition)
        { id: 'bosphuraq-prime', name: 'Bosphuraq Aerie', x: 5, y: -6, difficulty: 'dangerous', hasStation: true, region: 'bosphuraq', faction: 'bosphuraq' },
        { id: 'bosphuraq-nest', name: 'Raptor Nest', x: 4, y: -6, difficulty: 'dangerous', hasStation: true, region: 'bosphuraq', faction: 'bosphuraq' },
        // Esselgin (Independent)
        { id: 'esselgin-prime', name: 'Esselgin Nexus', x: -6, y: -2, difficulty: 'neutral', hasStation: true, region: 'esselgin', faction: 'esselgin' },
        { id: 'esselgin-market', name: 'Serpent Bazaar', x: -7, y: -1, difficulty: 'neutral', hasStation: true, region: 'esselgin', faction: 'esselgin' },
        // Wurgalan (Independent)
        { id: 'wurgalan-prime', name: 'Wurgalan Depths', x: 7, y: 3, difficulty: 'neutral', hasStation: true, region: 'wurgalan', faction: 'wurgalan' },
        { id: 'wurgalan-reef', name: 'Tentacle Reef', x: 6, y: 4, difficulty: 'neutral', hasStation: true, region: 'wurgalan', faction: 'wurgalan' },
        // Tier 2 Contested
        { id: 't2-contested-a', name: 'Shattered Expanse', x: 0, y: -6, difficulty: 'dangerous', hasStation: false, region: 'border', faction: null, contested: true, contestedFactions: ['thuranin', 'jeraptha'] },
        { id: 't2-contested-b', name: 'Coalition Breach', x: -3, y: -5, difficulty: 'dangerous', hasStation: false, region: 'border', faction: null, contested: true, contestedFactions: ['bosphuraq', 'jeraptha'] },

        // === RING 3 - TIER 1 ZONES ===
        // Rindhalu (Elder, Senior Coalition)
        { id: 'rindhalu-prime', name: 'Rindhalu Webway', x: -8, y: 6, difficulty: 'deadly', hasStation: true, region: 'rindhalu', faction: 'rindhalu' },
        { id: 'rindhalu-sanctum', name: 'Elder Sanctum', x: -9, y: 5, difficulty: 'deadly', hasStation: true, region: 'rindhalu', faction: 'rindhalu' },
        // Maxolhx (Elder, Junior Coalition)
        { id: 'maxolhx-prime', name: 'Maxolhx Citadel', x: 9, y: -7, difficulty: 'deadly', hasStation: true, region: 'maxolhx', faction: 'maxolhx' },
        { id: 'maxolhx-throne', name: 'Apex Throne', x: 8, y: -8, difficulty: 'deadly', hasStation: true, region: 'maxolhx', faction: 'maxolhx' },
        // Tier 1 Contested (Final battleground)
        { id: 't1-contested', name: 'The Crucible', x: 0, y: -9, difficulty: 'deadly', hasStation: false, region: 'border', faction: null, contested: true, contestedFactions: ['rindhalu', 'maxolhx'] },
    ],
    gates: [
        // === CORE GATES ===
        { from: 'tutorial', to: 'hub' },
        { from: 'hub', to: 'sector-1' },
        { from: 'hub', to: 'sector-2' },
        { from: 'hub', to: 'sector-3' },
        { from: 'hub', to: 'sector-6' },
        { from: 'sector-1', to: 'sector-4' },
        { from: 'sector-2', to: 'sector-5' },
        { from: 'sector-3', to: 'sector-4' },
        { from: 'sector-3', to: 'sector-5' },
        // === WORMHOLE GATE (Core -> Milky Way) ===
        { from: 'hub', to: 'mw-alpha', wormhole: true },
        // === MILKY WAY RING ===
        { from: 'mw-alpha', to: 'mw-bravo' },
        { from: 'mw-bravo', to: 'mw-charlie' },
        { from: 'mw-charlie', to: 'mw-delta' },
        { from: 'mw-delta', to: 'mw-echo' },
        { from: 'mw-echo', to: 'mw-foxtrot' },
        { from: 'mw-foxtrot', to: 'mw-alpha' },

        // === CORE -> TIER 3 RUHAR ===
        { from: 'sector-6', to: 'ruhar-market' },
        { from: 'sector-1', to: 'keepers-enclave' },
        { from: 'keepers-enclave', to: 'ruhar-prime' },
        { from: 'ruhar-prime', to: 'ruhar-haven' },
        { from: 'ruhar-prime', to: 'ruhar-market' },

        // === CORE -> TIER 3 KRISTANG ===
        { from: 'sector-5', to: 'kristang-forge' },
        { from: 'kristang-forge', to: 'kristang-hold' },
        { from: 'kristang-hold', to: 'kristang-arena' },

        // === TIER 3 CONTESTED BORDER ===
        { from: 'sector-3', to: 'border-alpha' },
        { from: 'sector-4', to: 'border-charlie' },
        { from: 'border-alpha', to: 'border-bravo' },
        { from: 'border-alpha', to: 'border-charlie' },
        { from: 'border-bravo', to: 'kristang-forge' },
        { from: 'border-charlie', to: 'ruhar-haven' },

        // === TIER 3 -> TIER 2 ===
        { from: 'ruhar-haven', to: 'jeraptha-prime' },
        { from: 'ruhar-prime', to: 'jeraptha-docks' },
        { from: 'jeraptha-prime', to: 'jeraptha-docks' },
        { from: 'kristang-arena', to: 'bosphuraq-prime' },
        { from: 'kristang-hold', to: 'thuranin-prime' },
        { from: 'thuranin-prime', to: 'thuranin-labs' },
        { from: 'bosphuraq-prime', to: 'bosphuraq-nest' },
        { from: 'sector-4', to: 'esselgin-prime' },
        { from: 'esselgin-prime', to: 'esselgin-market' },
        { from: 'mw-delta', to: 'wurgalan-prime' },
        { from: 'wurgalan-prime', to: 'wurgalan-reef' },

        // === TIER 2 CONTESTED ===
        { from: 'border-alpha', to: 't2-contested-a' },
        { from: 'thuranin-prime', to: 't2-contested-a' },
        { from: 'jeraptha-prime', to: 't2-contested-b' },
        { from: 'bosphuraq-nest', to: 't2-contested-b' },
        { from: 'esselgin-market', to: 't2-contested-b' },

        // === TIER 2 -> TIER 1 ===
        { from: 'jeraptha-docks', to: 'rindhalu-prime' },
        { from: 'rindhalu-prime', to: 'rindhalu-sanctum' },
        { from: 'thuranin-labs', to: 'maxolhx-prime' },
        { from: 'maxolhx-prime', to: 'maxolhx-throne' },

        // === TIER 1 CONTESTED ===
        { from: 't2-contested-a', to: 't1-contested' },
        { from: 'rindhalu-prime', to: 't1-contested', wormhole: true },
        { from: 'maxolhx-prime', to: 't1-contested', wormhole: true },

        // === CROSS-LINKS ===
        { from: 'mw-bravo', to: 'kristang-forge' },
        { from: 'mw-foxtrot', to: 'esselgin-prime' },
    ],

    // === SECRET ELDER WORMHOLES (Skippy-only shortcuts) ===
    // Unlocked progressively by defeating faction leaders
    secretWormholes: [
        {
            id: 'elder-conduit-alpha',
            from: 'hub',
            to: 'kristang-arena',
            unlockedBy: 'kristang',
            name: 'Elder Conduit Alpha',
        },
        {
            id: 'elder-conduit-beta',
            from: 'hub',
            to: 'bosphuraq-nest',
            unlockedBy: 'bosphuraq',
            name: 'Elder Conduit Beta',
        },
        {
            id: 'elder-conduit-gamma',
            from: 'ruhar-prime',
            to: 'thuranin-labs',
            unlockedBy: 'thuranin',
            name: 'Elder Conduit Gamma',
        },
        {
            id: 'elder-conduit-delta',
            from: 'hub',
            to: 'maxolhx-throne',
            unlockedBy: 'maxolhx',
            name: 'Elder Conduit Delta',
        },
        {
            id: 'elder-conduit-epsilon',
            from: 'tutorial',
            to: 'rindhalu-sanctum',
            unlockedBy: 'rindhalu',
            name: 'Elder Conduit Epsilon',
        },
    ],
};

// Quick lookup map: sectorId -> sector data (built once at load time)
export const UNIVERSE_LAYOUT_MAP = {};
for (const sector of UNIVERSE_LAYOUT.sectors) {
    UNIVERSE_LAYOUT_MAP[sector.id] = sector;
}
