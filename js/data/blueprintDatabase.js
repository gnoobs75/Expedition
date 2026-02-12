// =============================================
// Blueprint & Manufacturing Database
// Crafting materials and blueprint definitions
// =============================================

// =============================================
// MATERIAL DATABASE
// =============================================
// Base crafting materials used in blueprint manufacturing

export const MATERIAL_DATABASE = {
    'refined-minerals': {
        name: 'Refined Minerals',
        description: 'Purified ore compounds processed from raw asteroid minerals. The foundation of all manufacturing.',
        volumePerUnit: 0.1,
        basePrice: 10,
    },
    'salvage-components': {
        name: 'Salvage Components',
        description: 'Recovered mechanical and structural parts from ship wrecks. Essential for hull and module assembly.',
        volumePerUnit: 0.5,
        basePrice: 25,
    },
    'electronics': {
        name: 'Electronics',
        description: 'Precision circuitry and computational modules harvested from data sites and derelict systems.',
        volumePerUnit: 0.2,
        basePrice: 50,
    },
    'rare-alloys': {
        name: 'Rare Alloys',
        description: 'Exotic metallic compounds found only in deep anomalies and relic sites. Required for advanced manufacturing.',
        volumePerUnit: 0.3,
        basePrice: 150,
    },
};

// =============================================
// BLUEPRINT DATABASE
// =============================================
// Each blueprint defines what it produces, required materials,
// crafting time, purchase price, and acquisition source.
//
// Tiers:
//   1 - Common station modules (2000-5000 price)
//   2 - Medium modules (8000-20000 price)
//   3 - Rare/anomaly-sourced advanced gear (30000-80000 price)
//   4 - Ship blueprints (50000-200000 price)
//
// Sources:
//   station  - Purchasable from station blueprint vendors
//   quest    - Rewarded from quest completion
//   anomaly  - Found in combat/data anomalies
//   wreck    - Salvaged from destroyed NPC wrecks

export const BLUEPRINT_DATABASE = {

    // =============================================
    // TIER 1 - Common Station Modules
    // =============================================

    'bp-small-pulse-laser-2': {
        name: 'Small Pulse Laser II Blueprint',
        description: 'Manufacturing schematic for the Tech II small pulse laser.',
        outputId: 'small-pulse-laser-2',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 40,
            'salvage-components': 10,
        },
        craftTime: 60,
        price: 2000,
        source: 'station',
    },
    'bp-light-missile-2': {
        name: 'Light Missile Launcher II Blueprint',
        description: 'Manufacturing schematic for the Tech II light missile launcher.',
        outputId: 'light-missile-2',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 45,
            'salvage-components': 12,
        },
        craftTime: 60,
        price: 2500,
        source: 'station',
    },
    'bp-shield-booster': {
        name: 'Shield Booster I Blueprint',
        description: 'Manufacturing schematic for a basic shield booster module.',
        outputId: 'shield-booster',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 35,
            'electronics': 5,
        },
        craftTime: 45,
        price: 2000,
        source: 'station',
    },
    'bp-armor-repairer': {
        name: 'Armor Repairer I Blueprint',
        description: 'Manufacturing schematic for a basic armor repair module.',
        outputId: 'armor-repairer',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 40,
            'salvage-components': 8,
        },
        craftTime: 50,
        price: 2500,
        source: 'station',
    },
    'bp-afterburner': {
        name: 'Afterburner I Blueprint',
        description: 'Manufacturing schematic for a basic afterburner module.',
        outputId: 'afterburner',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 30,
            'electronics': 4,
        },
        craftTime: 40,
        price: 2000,
        source: 'station',
    },
    'bp-mining-laser': {
        name: 'Mining Laser I Blueprint',
        description: 'Manufacturing schematic for a basic mining laser.',
        outputId: 'mining-laser',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 35,
            'electronics': 3,
        },
        craftTime: 40,
        price: 2000,
        source: 'station',
    },
    'bp-damage-mod': {
        name: 'Damage Amplifier I Blueprint',
        description: 'Manufacturing schematic for a basic damage amplifier subsystem.',
        outputId: 'damage-mod',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 30,
            'salvage-components': 10,
            'electronics': 3,
        },
        craftTime: 55,
        price: 3000,
        source: 'station',
    },
    'bp-shield-extender': {
        name: 'Shield Extender I Blueprint',
        description: 'Manufacturing schematic for a passive shield extender subsystem.',
        outputId: 'shield-extender',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 25,
            'electronics': 4,
        },
        craftTime: 35,
        price: 2000,
        source: 'station',
    },
    'bp-armor-plate': {
        name: 'Armor Plate I Blueprint',
        description: 'Manufacturing schematic for a passive armor plate subsystem.',
        outputId: 'armor-plate',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 50,
            'salvage-components': 5,
        },
        craftTime: 35,
        price: 2000,
        source: 'station',
    },
    'bp-nanofiber': {
        name: 'Nanofiber Internal Structure I Blueprint',
        description: 'Manufacturing schematic for a nanofiber agility subsystem.',
        outputId: 'nanofiber',
        outputType: 'module',
        tier: 1,
        materials: {
            'refined-minerals': 20,
            'salvage-components': 8,
            'electronics': 2,
        },
        craftTime: 40,
        price: 2500,
        source: 'station',
    },

    // =============================================
    // TIER 2 - Medium Modules
    // =============================================

    'bp-medium-pulse-laser': {
        name: 'Medium Pulse Laser I Blueprint',
        description: 'Manufacturing schematic for a medium pulse laser turret.',
        outputId: 'medium-pulse-laser',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 80,
            'salvage-components': 25,
            'electronics': 10,
        },
        craftTime: 120,
        price: 8000,
        source: 'station',
    },
    'bp-shield-booster-2': {
        name: 'Shield Booster II Blueprint',
        description: 'Manufacturing schematic for an improved shield booster.',
        outputId: 'shield-booster-2',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 70,
            'electronics': 20,
            'rare-alloys': 3,
        },
        craftTime: 150,
        price: 10000,
        source: 'station',
    },
    'bp-armor-repairer-2': {
        name: 'Armor Repairer II Blueprint',
        description: 'Manufacturing schematic for an improved armor repairer.',
        outputId: 'armor-repairer-2',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 75,
            'salvage-components': 30,
            'rare-alloys': 3,
        },
        craftTime: 150,
        price: 12000,
        source: 'station',
    },
    'bp-afterburner-2': {
        name: 'Afterburner II Blueprint',
        description: 'Manufacturing schematic for an enhanced afterburner module.',
        outputId: 'afterburner-2',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 60,
            'electronics': 15,
            'rare-alloys': 2,
        },
        craftTime: 120,
        price: 8000,
        source: 'quest',
    },
    'bp-microwarpdrive': {
        name: 'Microwarpdrive I Blueprint',
        description: 'Manufacturing schematic for a microwarpdrive propulsion module.',
        outputId: 'microwarpdrive',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 90,
            'electronics': 25,
            'rare-alloys': 5,
        },
        craftTime: 180,
        price: 15000,
        source: 'quest',
    },
    'bp-damage-mod-2': {
        name: 'Damage Amplifier II Blueprint',
        description: 'Manufacturing schematic for a Tech II damage amplifier.',
        outputId: 'damage-mod-2',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 65,
            'salvage-components': 25,
            'electronics': 15,
        },
        craftTime: 130,
        price: 12000,
        source: 'station',
    },
    'bp-heavy-missile': {
        name: 'Heavy Missile Launcher I Blueprint',
        description: 'Manufacturing schematic for a heavy missile launcher.',
        outputId: 'heavy-missile',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 85,
            'salvage-components': 20,
            'electronics': 12,
        },
        craftTime: 140,
        price: 10000,
        source: 'station',
    },
    'bp-warp-scrambler': {
        name: 'Warp Scrambler I Blueprint',
        description: 'Manufacturing schematic for a warp scrambler EWAR module.',
        outputId: 'warp-scrambler',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 50,
            'electronics': 25,
            'rare-alloys': 4,
        },
        craftTime: 160,
        price: 12000,
        source: 'quest',
    },
    'bp-mining-laser-2': {
        name: 'Mining Laser II Blueprint',
        description: 'Manufacturing schematic for an enhanced mining laser.',
        outputId: 'mining-laser-2',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 70,
            'electronics': 18,
            'rare-alloys': 2,
        },
        craftTime: 120,
        price: 10000,
        source: 'station',
    },
    'bp-damage-control': {
        name: 'Damage Control I Blueprint',
        description: 'Manufacturing schematic for a damage control resistance subsystem.',
        outputId: 'damage-control',
        outputType: 'module',
        tier: 2,
        materials: {
            'refined-minerals': 55,
            'salvage-components': 20,
            'electronics': 10,
        },
        craftTime: 100,
        price: 8000,
        source: 'station',
    },

    // =============================================
    // TIER 3 - Rare / Anomaly-Sourced
    // =============================================

    'bp-medium-pulse-laser-2': {
        name: 'Medium Pulse Laser II Blueprint',
        description: 'Rare schematic for a Tech II medium energy turret. Found in combat anomalies.',
        outputId: 'medium-pulse-laser-2',
        outputType: 'module',
        tier: 3,
        materials: {
            'refined-minerals': 150,
            'salvage-components': 50,
            'electronics': 30,
            'rare-alloys': 10,
        },
        craftTime: 300,
        price: 35000,
        source: 'anomaly',
    },
    'bp-large-beam-laser': {
        name: 'Large Beam Laser I Blueprint',
        description: 'Rare schematic for a large beam laser turret. Recovered from wrecks.',
        outputId: 'large-beam-laser',
        outputType: 'module',
        tier: 3,
        materials: {
            'refined-minerals': 180,
            'salvage-components': 60,
            'electronics': 25,
            'rare-alloys': 12,
        },
        craftTime: 360,
        price: 40000,
        source: 'wreck',
    },
    'bp-heavy-missile-2': {
        name: 'Heavy Missile Launcher II Blueprint',
        description: 'Rare schematic for a Tech II heavy missile system. Found in data anomalies.',
        outputId: 'heavy-missile-2',
        outputType: 'module',
        tier: 3,
        materials: {
            'refined-minerals': 140,
            'salvage-components': 45,
            'electronics': 35,
            'rare-alloys': 8,
        },
        craftTime: 280,
        price: 38000,
        source: 'anomaly',
    },
    'bp-xl-shield-booster': {
        name: 'XL Shield Booster Blueprint',
        description: 'Rare schematic for a capital-grade shield restoration system.',
        outputId: 'xl-shield-booster',
        outputType: 'module',
        tier: 3,
        materials: {
            'refined-minerals': 200,
            'salvage-components': 40,
            'electronics': 40,
            'rare-alloys': 15,
        },
        craftTime: 400,
        price: 60000,
        source: 'anomaly',
    },
    'bp-microwarpdrive-2': {
        name: 'Microwarpdrive II Blueprint',
        description: 'Rare schematic for a capital MWD. Salvaged from anomaly wrecks.',
        outputId: 'microwarpdrive-2',
        outputType: 'module',
        tier: 3,
        materials: {
            'refined-minerals': 160,
            'electronics': 50,
            'rare-alloys': 20,
        },
        craftTime: 360,
        price: 55000,
        source: 'wreck',
    },
    'bp-damage-control-2': {
        name: 'Damage Control II Blueprint',
        description: 'Rare schematic for a Tech II damage control unit. Quest reward.',
        outputId: 'damage-control-2',
        outputType: 'module',
        tier: 3,
        materials: {
            'refined-minerals': 120,
            'salvage-components': 50,
            'electronics': 30,
            'rare-alloys': 12,
        },
        craftTime: 300,
        price: 45000,
        source: 'quest',
    },

    // =============================================
    // TIER 4 - Ship Blueprints
    // =============================================

    'bp-venture': {
        name: 'Venture Blueprint',
        description: 'Full hull schematic for the Venture mining frigate.',
        outputId: 'venture',
        outputType: 'ship',
        tier: 4,
        materials: {
            'refined-minerals': 300,
            'salvage-components': 80,
            'electronics': 30,
            'rare-alloys': 10,
        },
        craftTime: 600,
        price: 50000,
        source: 'station',
    },
    'bp-rifter': {
        name: 'Rifter Blueprint',
        description: 'Full hull schematic for the iconic Rifter combat frigate.',
        outputId: 'rifter',
        outputType: 'ship',
        tier: 4,
        materials: {
            'refined-minerals': 350,
            'salvage-components': 100,
            'electronics': 40,
            'rare-alloys': 15,
        },
        craftTime: 720,
        price: 65000,
        source: 'station',
    },
    'bp-thorax': {
        name: 'Thorax Blueprint',
        description: 'Full hull schematic for the Thorax combat cruiser. Found in anomalies.',
        outputId: 'thorax',
        outputType: 'ship',
        tier: 4,
        materials: {
            'refined-minerals': 600,
            'salvage-components': 200,
            'electronics': 80,
            'rare-alloys': 30,
        },
        craftTime: 1200,
        price: 120000,
        source: 'anomaly',
    },
    'bp-hurricane': {
        name: 'Hurricane Blueprint',
        description: 'Full hull schematic for the Hurricane assault battlecruiser. Extremely rare.',
        outputId: 'hurricane',
        outputType: 'ship',
        tier: 4,
        materials: {
            'refined-minerals': 900,
            'salvage-components': 350,
            'electronics': 120,
            'rare-alloys': 50,
        },
        craftTime: 1800,
        price: 180000,
        source: 'anomaly',
    },
    'bp-drake': {
        name: 'Drake Blueprint',
        description: 'Full hull schematic for the Drake shield battlecruiser. Recovered from wrecks.',
        outputId: 'drake',
        outputType: 'ship',
        tier: 4,
        materials: {
            'refined-minerals': 950,
            'salvage-components': 300,
            'electronics': 140,
            'rare-alloys': 55,
        },
        craftTime: 1800,
        price: 200000,
        source: 'wreck',
    },
};
