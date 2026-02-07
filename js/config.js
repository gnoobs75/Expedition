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
            name: 'Frigate',
            maxSpeed: 125,
            acceleration: 30,
            shield: 100,
            armor: 50,
            hull: 100,
            capacitor: 100,
            capacitorRegen: 5,
            signatureRadius: 30,
            highSlots: 3,
            midSlots: 2,
            lowSlots: 2,
            cargoCapacity: 200,
            droneCapacity: 2,
            droneBandwidth: 20,
            price: 5000,
            modelPath: 'assets/ships/Miner/Miner.glb',
        },
        cruiser: {
            name: 'Cruiser',
            maxSpeed: 75,
            acceleration: 15,
            shield: 300,
            armor: 200,
            hull: 250,
            capacitor: 200,
            capacitorRegen: 8,
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
            capacitorRegen: 12,
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

    // Drones
    DRONES: {
        'mining-drone': {
            name: 'Mining Drone I',
            type: 'mining',
            miningYield: 5,           // Units per cycle
            miningCycleTime: 3,       // Seconds
            cargoCapacity: 50,        // Ore capacity before auto-return
            speed: 150,
            orbitRange: 100,
            hp: 50,
            bandwidth: 10,
            price: 5000,
        },
        'combat-drone': {
            name: 'Combat Drone I',
            type: 'combat',
            damage: 10,
            attackCycleTime: 2,
            speed: 200,
            orbitRange: 150,
            range: 500,
            hp: 75,
            bandwidth: 15,
            price: 10000,
        },
        'scout-drone': {
            name: 'Scout Drone I',
            type: 'scout',
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
        hub: { enemyCount: 0, asteroidDensity: 0.1, name: 'Hub Station' },
        safe: { enemyCount: 2, asteroidDensity: 0.3, name: 'Safe Zone' },
        normal: { enemyCount: 5, asteroidDensity: 0.5, name: 'Normal Space' },
        dangerous: { enemyCount: 10, asteroidDensity: 0.4, name: 'Dangerous Zone' },
        deadly: { enemyCount: 15, asteroidDensity: 0.2, name: 'Deadly Zone' },
    },

    // NPC Ecosystem
    NPC_MINERS: {
        hub: { count: 7, shipClass: 'frigate', droneCount: 2 },
        safe: { count: 5, shipClass: 'frigate', droneCount: 2 },
        normal: { count: 3, shipClass: 'frigate', droneCount: 2 },
        dangerous: { count: 1, shipClass: 'frigate', droneCount: 1 },
        deadly: { count: 0, shipClass: 'frigate', droneCount: 0 },
    },
    NPC_SECURITY: {
        hub: { count: 5, shipClass: 'cruiser' },
        safe: { count: 4, shipClass: 'cruiser' },
        normal: { count: 3, shipClass: 'frigate' },
        dangerous: { count: 2, shipClass: 'frigate' },
        deadly: { count: 1, shipClass: 'frigate' },
    },
    NPC_PIRATE_RAIDS: {
        hub: { chance: 0, interval: 999, maxPirates: 0 },
        safe: { chance: 0.25, interval: 120, maxPirates: 2 },
        normal: { chance: 0.45, interval: 90, maxPirates: 3 },
        dangerous: { chance: 0.6, interval: 60, maxPirates: 4 },
        deadly: { chance: 0.8, interval: 45, maxPirates: 5 },
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
    PARTICLE_POOL_SIZE: 200,
    MAX_VISIBLE_OBJECTS: 100,

    // Death
    DEATH_CREDIT_PENALTY: 0.1,   // Lose 10% of credits on death
};

// Sector layout for hub-and-spoke universe
export const UNIVERSE_LAYOUT = {
    sectors: [
        { id: 'hub', name: 'Central Hub', x: 0, y: 0, difficulty: 'hub', hasStation: true },
        { id: 'sector-1', name: 'Mining Fields Alpha', x: -1, y: 0, difficulty: 'safe', hasStation: false },
        { id: 'sector-2', name: 'Mining Fields Beta', x: 1, y: 0, difficulty: 'safe', hasStation: false },
        { id: 'sector-3', name: 'Frontier Zone', x: 0, y: -1, difficulty: 'normal', hasStation: false },
        { id: 'sector-4', name: 'Pirate Territory', x: -1, y: -1, difficulty: 'dangerous', hasStation: false },
        { id: 'sector-5', name: 'The Abyss', x: 1, y: -1, difficulty: 'deadly', hasStation: true },
        { id: 'sector-6', name: 'Nebula Expanse', x: 0, y: 1, difficulty: 'normal', hasStation: false },
    ],
    gates: [
        { from: 'hub', to: 'sector-1' },
        { from: 'hub', to: 'sector-2' },
        { from: 'hub', to: 'sector-3' },
        { from: 'hub', to: 'sector-6' },
        { from: 'sector-1', to: 'sector-4' },
        { from: 'sector-2', to: 'sector-5' },
        { from: 'sector-3', to: 'sector-4' },
        { from: 'sector-3', to: 'sector-5' },
    ],
};
