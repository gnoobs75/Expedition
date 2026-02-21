// =============================================
// Equipment Database
// All purchasable weapons, modules, and subsystems
// =============================================

// Equipment categories
export const EQUIPMENT_CATEGORIES = {
    WEAPON: 'weapon',
    MODULE: 'module',
    SUBSYSTEM: 'subsystem',
};

// Equipment size tiers
export const EQUIPMENT_SIZES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    XLARGE: 'xlarge',
};

// Slot display names (internal -> display)
export const SLOT_DISPLAY_MAP = {
    high: 'Weapon',
    mid: 'Module',
    low: 'Subsystem',
};

// Slot internal mapping (display -> internal)
export const SLOT_INTERNAL_MAP = {
    weapon: 'high',
    module: 'mid',
    subsystem: 'low',
};

// Full equipment database
// Weapons use slot:'weapon' (mapped to high internally)
// Modules use slot:'module' (mapped to mid internally)
// Subsystems use slot:'subsystem' (mapped to low internally)
export const EQUIPMENT_DATABASE = {

    // =============================================
    // WEAPONS - Masers (Microwave Amplification by Stimulated Emission of Radiation)
    // =============================================

    'small-pulse-maser': {
        name: 'Small Pulse Maser I',
        slot: 'weapon',
        size: 'small',
        category: 'maser',
        damageType: 'em',
        description: 'Short-range energy turret with rapid fire rate.',
        damage: 15,
        optimalRange: 200,
        falloff: 100,
        range: 350,
        cycleTime: 2,
        capacitorUse: 5,
        trackingSpeed: 1.5,
        price: 1000,
    },
    'small-pulse-maser-2': {
        name: 'Small Pulse Maser II',
        slot: 'weapon',
        size: 'small',
        category: 'maser',
        damageType: 'em',
        description: 'Tech II small pulse maser with improved damage.',
        damage: 20,
        optimalRange: 220,
        falloff: 120,
        range: 400,
        cycleTime: 1.8,
        capacitorUse: 6,
        trackingSpeed: 1.6,
        price: 3500,
    },
    'medium-pulse-maser': {
        name: 'Medium Pulse Maser I',
        slot: 'weapon',
        size: 'medium',
        category: 'maser',
        damageType: 'em',
        description: 'Standard medium-range energy turret.',
        damage: 35,
        optimalRange: 350,
        falloff: 150,
        range: 550,
        cycleTime: 3,
        capacitorUse: 12,
        trackingSpeed: 1.2,
        price: 5000,
    },
    'medium-pulse-maser-2': {
        name: 'Medium Pulse Maser II',
        slot: 'weapon',
        size: 'medium',
        category: 'maser',
        damageType: 'em',
        description: 'Tech II medium energy turret. Enhanced output.',
        damage: 45,
        optimalRange: 380,
        falloff: 175,
        range: 600,
        cycleTime: 2.8,
        capacitorUse: 14,
        trackingSpeed: 1.3,
        price: 12000,
    },
    'large-beam-maser': {
        name: 'Large Beam Maser I',
        slot: 'weapon',
        size: 'large',
        category: 'maser',
        damageType: 'em',
        description: 'Heavy short-range energy turret. Devastating in brawls.',
        damage: 70,
        optimalRange: 600,
        falloff: 250,
        range: 900,
        cycleTime: 4,
        capacitorUse: 22,
        trackingSpeed: 0.8,
        price: 18000,
    },
    'large-beam-maser-2': {
        name: 'Large Beam Maser II',
        slot: 'weapon',
        size: 'large',
        category: 'maser',
        damageType: 'em',
        description: 'Tech II large beam maser. Devastating at close range.',
        damage: 90,
        optimalRange: 650,
        falloff: 280,
        range: 1000,
        cycleTime: 3.8,
        capacitorUse: 26,
        trackingSpeed: 0.85,
        price: 35000,
    },
    'xlarge-turbo-maser': {
        name: 'XL Turbo Maser',
        slot: 'weapon',
        size: 'xlarge',
        category: 'maser',
        damageType: 'em',
        description: 'Capital-class energy weapon. Massive damage output.',
        damage: 150,
        optimalRange: 900,
        falloff: 350,
        range: 1400,
        cycleTime: 5,
        capacitorUse: 45,
        trackingSpeed: 0.5,
        price: 80000,
    },

    // =============================================
    // WEAPONS - Railguns (Hybrid Turrets)
    // =============================================

    'small-railgun': {
        name: 'Small Railgun I',
        slot: 'weapon',
        size: 'small',
        category: 'railgun',
        damageType: 'kinetic',
        description: 'Medium-range hybrid turret. High damage per shot, slow rate of fire.',
        damage: 22,
        optimalRange: 600,
        falloff: 250,
        range: 900,
        cycleTime: 3,
        capacitorUse: 6,
        trackingSpeed: 0.8,
        price: 1500,
    },
    'small-railgun-2': {
        name: 'Small Railgun II',
        slot: 'weapon',
        size: 'small',
        category: 'railgun',
        damageType: 'kinetic',
        description: 'Tech II small railgun. Improved range and damage.',
        damage: 30,
        optimalRange: 650,
        falloff: 280,
        range: 1000,
        cycleTime: 2.8,
        capacitorUse: 7,
        trackingSpeed: 0.9,
        price: 5000,
    },
    'medium-railgun': {
        name: 'Medium Railgun I',
        slot: 'weapon',
        size: 'medium',
        category: 'railgun',
        damageType: 'kinetic',
        description: 'Standard medium hybrid turret for cruiser-class ships.',
        damage: 50,
        optimalRange: 1000,
        falloff: 400,
        range: 1500,
        cycleTime: 3.5,
        capacitorUse: 14,
        trackingSpeed: 0.6,
        price: 8000,
    },
    'medium-railgun-2': {
        name: 'Medium Railgun II',
        slot: 'weapon',
        size: 'medium',
        category: 'railgun',
        damageType: 'kinetic',
        description: 'Tech II medium railgun. Superior range and stopping power.',
        damage: 65,
        optimalRange: 1050,
        falloff: 420,
        range: 1600,
        cycleTime: 3.2,
        capacitorUse: 16,
        trackingSpeed: 0.7,
        price: 18000,
    },
    'large-railgun': {
        name: 'Large Railgun I',
        slot: 'weapon',
        size: 'large',
        category: 'railgun',
        damageType: 'kinetic',
        description: 'Heavy hybrid turret. Extreme range sniper platform.',
        damage: 95,
        optimalRange: 1600,
        falloff: 500,
        range: 2200,
        cycleTime: 4.5,
        capacitorUse: 24,
        trackingSpeed: 0.35,
        price: 25000,
    },
    'xlarge-railgun': {
        name: 'XL Railgun Battery',
        slot: 'weapon',
        size: 'xlarge',
        category: 'railgun',
        damageType: 'kinetic',
        description: 'Capital-class hybrid weapon. Devastating alpha strike capability.',
        damage: 180,
        optimalRange: 2500,
        falloff: 700,
        range: 3500,
        cycleTime: 5.5,
        capacitorUse: 50,
        trackingSpeed: 0.2,
        price: 100000,
    },

    // =============================================
    // WEAPONS - Missiles
    // =============================================

    'light-missile': {
        name: 'Light Missile Launcher I',
        slot: 'weapon',
        size: 'small',
        category: 'missile',
        damageType: 'explosive',
        description: 'Standard light missile launcher. Good vs frigates and destroyers.',
        damage: 18,
        optimalRange: 800,
        falloff: 300,
        range: 1200,
        cycleTime: 3,
        capacitorUse: 3,
        missileSpeed: 400,
        explosionRadius: 40,
        explosionVelocity: 160,
        price: 1200,
    },
    'light-missile-2': {
        name: 'Light Missile Launcher II',
        slot: 'weapon',
        size: 'small',
        category: 'missile',
        damageType: 'explosive',
        description: 'Tech II light missiles. Tighter explosion, better application.',
        damage: 24,
        optimalRange: 850,
        falloff: 330,
        range: 1300,
        cycleTime: 2.5,
        capacitorUse: 4,
        missileSpeed: 450,
        explosionRadius: 35,
        explosionVelocity: 185,
        price: 4000,
    },
    'heavy-missile': {
        name: 'Heavy Missile Launcher I',
        slot: 'weapon',
        size: 'medium',
        category: 'missile',
        damageType: 'explosive',
        description: 'Medium missiles. Full damage to cruisers, reduced vs frigates.',
        damage: 40,
        optimalRange: 1200,
        falloff: 500,
        range: 1800,
        cycleTime: 4,
        capacitorUse: 8,
        missileSpeed: 350,
        explosionRadius: 100,
        explosionVelocity: 110,
        price: 6000,
    },
    'heavy-missile-2': {
        name: 'Heavy Missile Launcher II',
        slot: 'weapon',
        size: 'medium',
        category: 'missile',
        damageType: 'explosive',
        description: 'Tech II heavy missiles. Better explosion velocity.',
        damage: 55,
        optimalRange: 1250,
        falloff: 520,
        range: 1900,
        cycleTime: 3.5,
        capacitorUse: 10,
        missileSpeed: 400,
        explosionRadius: 90,
        explosionVelocity: 130,
        price: 15000,
    },
    'cruise-missile': {
        name: 'Cruise Missile Launcher',
        slot: 'weapon',
        size: 'large',
        category: 'missile',
        damageType: 'explosive',
        description: 'Long-range battleship missiles. Poor application vs small targets.',
        damage: 80,
        optimalRange: 2000,
        falloff: 600,
        range: 2800,
        cycleTime: 5,
        capacitorUse: 15,
        missileSpeed: 300,
        explosionRadius: 200,
        explosionVelocity: 75,
        price: 22000,
    },
    'torpedo-launcher': {
        name: 'Torpedo Launcher',
        slot: 'weapon',
        size: 'large',
        category: 'missile',
        damageType: 'explosive',
        description: 'Devastating vs large ships. Huge explosion, slow — terrible vs frigates.',
        damage: 120,
        optimalRange: 500,
        falloff: 300,
        range: 900,
        cycleTime: 6,
        capacitorUse: 18,
        missileSpeed: 250,
        explosionRadius: 300,
        explosionVelocity: 55,
        price: 28000,
    },
    'xl-cruise-missile': {
        name: 'XL Cruise Missile Battery',
        slot: 'weapon',
        size: 'xlarge',
        category: 'missile',
        damageType: 'explosive',
        description: 'Capital-class missiles. Only effective against capitals and battleships.',
        damage: 160,
        optimalRange: 2500,
        falloff: 800,
        range: 3500,
        cycleTime: 6,
        capacitorUse: 35,
        missileSpeed: 350,
        explosionRadius: 400,
        explosionVelocity: 65,
        price: 90000,
    },

    // =============================================
    // WEAPONS - Mining
    // =============================================

    'mining-laser': {
        name: 'Mining Laser I',
        slot: 'weapon',
        size: 'small',
        category: 'mining',
        description: 'Basic mining laser for ore extraction.',
        miningYield: 50,
        range: 200,
        cycleTime: 5,
        capacitorUse: 8,
        price: 2000,
    },
    'mining-laser-2': {
        name: 'Mining Laser II',
        slot: 'weapon',
        size: 'small',
        category: 'mining',
        description: 'Enhanced mining laser. Higher extraction rate.',
        miningYield: 100,
        range: 250,
        cycleTime: 4,
        capacitorUse: 10,
        price: 10000,
    },
    'modulated-miner': {
        name: 'Modulated Strip Miner I',
        slot: 'weapon',
        size: 'medium',
        category: 'mining',
        description: 'Advanced modulated mining laser for cruiser hulls.',
        miningYield: 180,
        range: 300,
        cycleTime: 6,
        capacitorUse: 15,
        price: 25000,
    },
    'strip-miner': {
        name: 'Strip Miner I',
        slot: 'weapon',
        size: 'large',
        category: 'mining',
        description: 'Industrial strip mining laser. Maximum yield.',
        miningYield: 350,
        range: 350,
        cycleTime: 8,
        capacitorUse: 25,
        price: 50000,
    },

    // =============================================
    // WEAPONS - Salvagers
    // =============================================

    'salvager-1': {
        name: 'Salvager I',
        slot: 'weapon',
        size: 'small',
        category: 'salvage',
        description: 'Standard salvaging module for wreck recovery.',
        salvageChance: 0.5,
        range: 300,
        cycleTime: 5,
        capacitorUse: 6,
        price: 3000,
    },
    'salvager-2': {
        name: 'Salvager II',
        slot: 'weapon',
        size: 'small',
        category: 'salvage',
        description: 'Advanced salvager with improved success rate.',
        salvageChance: 0.7,
        range: 400,
        cycleTime: 4,
        capacitorUse: 8,
        price: 12000,
    },

    // =============================================
    // WEAPONS - Harvesters
    // =============================================

    'gas-harvester-1': {
        name: 'Gas Cloud Harvester I',
        slot: 'weapon',
        size: 'small',
        category: 'harvest',
        description: 'Collects gas cloud resources for processing.',
        harvestYield: 40,
        range: 200,
        cycleTime: 5,
        capacitorUse: 7,
        price: 4000,
    },
    'gas-harvester-2': {
        name: 'Gas Cloud Harvester II',
        slot: 'weapon',
        size: 'medium',
        category: 'harvest',
        description: 'Enhanced gas harvester with better yield.',
        harvestYield: 80,
        range: 250,
        cycleTime: 4,
        capacitorUse: 10,
        price: 15000,
    },

    // =============================================
    // MODULES - Shield
    // =============================================

    'shield-booster': {
        name: 'Shield Booster I',
        slot: 'module',
        size: 'small',
        category: 'shield',
        description: 'Active shield repair module. Cycles to restore shields.',
        shieldRepair: 30,
        cycleTime: 4,
        capacitorUse: 15,
        price: 3000,
    },
    'shield-booster-2': {
        name: 'Shield Booster II',
        slot: 'module',
        size: 'medium',
        category: 'shield',
        description: 'Improved shield booster with faster cycle time.',
        shieldRepair: 60,
        cycleTime: 3.5,
        capacitorUse: 25,
        price: 10000,
    },
    'xl-shield-booster': {
        name: 'XL Shield Booster',
        slot: 'module',
        size: 'large',
        category: 'shield',
        description: 'Capital-grade shield restoration system.',
        shieldRepair: 120,
        cycleTime: 4,
        capacitorUse: 50,
        price: 35000,
    },

    // =============================================
    // MODULES - Armor
    // =============================================

    'armor-repairer': {
        name: 'Armor Repairer I',
        slot: 'module',
        size: 'small',
        category: 'armor',
        description: 'Active armor repair module. Restores armor HP.',
        armorRepair: 25,
        cycleTime: 5,
        capacitorUse: 20,
        price: 4000,
    },
    'armor-repairer-2': {
        name: 'Armor Repairer II',
        slot: 'module',
        size: 'medium',
        category: 'armor',
        description: 'Improved armor repair with enhanced output.',
        armorRepair: 50,
        cycleTime: 4.5,
        capacitorUse: 35,
        price: 12000,
    },
    'xl-armor-repairer': {
        name: 'XL Armor Repairer',
        slot: 'module',
        size: 'large',
        category: 'armor',
        description: 'Capital-grade armor restoration system.',
        armorRepair: 100,
        cycleTime: 5,
        capacitorUse: 60,
        price: 40000,
    },

    // =============================================
    // MODULES - Propulsion
    // =============================================

    'afterburner': {
        name: 'Afterburner I',
        slot: 'module',
        size: 'small',
        category: 'propulsion',
        description: 'Increases max speed when active. Low signature bloom.',
        speedBonus: 1.5,
        capacitorUse: 3,
        price: 2500,
    },
    'afterburner-2': {
        name: 'Afterburner II',
        slot: 'module',
        size: 'medium',
        category: 'propulsion',
        description: 'Enhanced afterburner with greater speed bonus.',
        speedBonus: 1.75,
        capacitorUse: 5,
        price: 8000,
    },
    'microwarpdrive': {
        name: 'Microwarpdrive I',
        slot: 'module',
        size: 'medium',
        category: 'propulsion',
        description: 'Massive speed boost but blooms signature radius.',
        speedBonus: 3.0,
        signatureBloom: 5.0,
        capacitorUse: 8,
        price: 12000,
    },
    'microwarpdrive-2': {
        name: 'Microwarpdrive II',
        slot: 'module',
        size: 'large',
        category: 'propulsion',
        description: 'Capital MWD with extreme thrust. Heavy cap drain.',
        speedBonus: 3.5,
        signatureBloom: 4.0,
        capacitorUse: 12,
        price: 30000,
    },

    // =============================================
    // MODULES - EWAR
    // =============================================

    'warp-scrambler': {
        name: 'Warp Scrambler I',
        slot: 'module',
        size: 'small',
        category: 'ewar',
        description: 'Prevents target from warping. Short range.',
        range: 300,
        warpDisrupt: 2,
        capacitorUse: 5,
        price: 8000,
    },
    'warp-disruptor': {
        name: 'Warp Disruptor I',
        slot: 'module',
        size: 'medium',
        category: 'ewar',
        description: 'Long-range warp disruption. Single point.',
        range: 600,
        warpDisrupt: 1,
        capacitorUse: 4,
        price: 10000,
    },
    'sensor-dampener': {
        name: 'Sensor Dampener I',
        slot: 'module',
        size: 'small',
        category: 'ewar',
        description: 'Reduces target lock range and scan resolution.',
        range: 500,
        ewarStrength: 0.30,
        capacitorUse: 4,
        price: 6000,
    },

    // =============================================
    // MODULES - Utility
    // =============================================

    'capacitor-booster': {
        name: 'Capacitor Booster I',
        slot: 'module',
        size: 'small',
        category: 'utility',
        description: 'Injects capacitor energy when activated.',
        capacitorBoost: 40,
        cycleTime: 10,
        price: 5000,
    },
    'energy-vampire': {
        name: 'Energy Nosferatu I',
        slot: 'module',
        size: 'medium',
        category: 'utility',
        description: 'Drains capacitor from target and transfers to you.',
        range: 400,
        capacitorDrain: 8,
        cycleTime: 4,
        capacitorUse: 2,
        price: 9000,
    },
    'remote-shield-repairer': {
        name: 'Remote Shield Repairer I',
        slot: 'module',
        size: 'medium',
        category: 'utility',
        description: 'Repairs an ally ship\'s shields at range.',
        remoteShieldRepair: 40,
        range: 600,
        cycleTime: 4,
        capacitorUse: 18,
        price: 12000,
    },
    'remote-armor-repairer': {
        name: 'Remote Armor Repairer I',
        slot: 'module',
        size: 'medium',
        category: 'utility',
        description: 'Repairs an ally ship\'s armor at range.',
        remoteArmorRepair: 35,
        range: 500,
        cycleTime: 5,
        capacitorUse: 22,
        price: 14000,
    },
    'stasis-webifier': {
        name: 'Stasis Webifier I',
        slot: 'module',
        size: 'small',
        category: 'ewar',
        description: 'Reduces target\'s max speed by 60%. Short range.',
        speedReduction: 0.60,
        range: 250,
        capacitorUse: 4,
        price: 7000,
    },
    'sensor-booster': {
        name: 'Sensor Booster I',
        slot: 'module',
        size: 'small',
        category: 'utility',
        description: 'Increases targeting speed and lock range by 25%.',
        lockSpeedBonus: 1.25,
        lockRangeBonus: 1.25,
        capacitorUse: 3,
        price: 5000,
    },

    // =============================================
    // SUBSYSTEMS - Damage
    // =============================================

    'damage-mod': {
        name: 'Damage Amplifier I',
        slot: 'subsystem',
        size: 'small',
        category: 'damage',
        description: 'Passive module that increases weapon damage.',
        damageBonus: 1.10,
        price: 5000,
    },
    'damage-mod-2': {
        name: 'Damage Amplifier II',
        slot: 'subsystem',
        size: 'medium',
        category: 'damage',
        description: 'Tech II damage amplifier. Greater damage bonus.',
        damageBonus: 1.15,
        price: 15000,
    },
    'gyrostabilizer': {
        name: 'Gyrostabilizer I',
        slot: 'subsystem',
        size: 'small',
        category: 'damage',
        description: 'Improves tracking speed and rate of fire.',
        trackingSpeed: 1.10,
        cycleTimeBonus: 0.95,
        price: 4000,
    },
    'gyrostabilizer-2': {
        name: 'Gyrostabilizer II',
        slot: 'subsystem',
        size: 'medium',
        category: 'damage',
        description: 'Tech II gyrostabilizer. Superior tracking.',
        trackingSpeed: 1.15,
        cycleTimeBonus: 0.92,
        price: 12000,
    },
    'ballistic-control': {
        name: 'Ballistic Control System I',
        slot: 'subsystem',
        size: 'small',
        category: 'damage',
        description: 'Increases missile damage and rate of fire.',
        missileDamageBonus: 1.10,
        cycleTimeBonus: 0.95,
        price: 5000,
    },
    'ballistic-control-2': {
        name: 'Ballistic Control System II',
        slot: 'subsystem',
        size: 'medium',
        category: 'damage',
        description: 'Tech II ballistic computer. Maximum missile output.',
        missileDamageBonus: 1.15,
        cycleTimeBonus: 0.92,
        price: 16000,
    },
    'heat-sink': {
        name: 'Heat Sink I',
        slot: 'subsystem',
        size: 'small',
        category: 'damage',
        description: 'Reduces maser capacitor use and increases damage.',
        maserDamageBonus: 1.10,
        capacitorReduction: 0.92,
        price: 4500,
    },
    'heat-sink-2': {
        name: 'Heat Sink II',
        slot: 'subsystem',
        size: 'medium',
        category: 'damage',
        description: 'Tech II heat sink. Superior energy management.',
        maserDamageBonus: 1.15,
        capacitorReduction: 0.88,
        price: 14000,
    },

    // =============================================
    // SUBSYSTEMS - Point Defense
    // =============================================

    'point-defense-system': {
        name: 'Point Defense System I',
        slot: 'subsystem',
        size: 'small',
        category: 'defense',
        description: 'Automated close-in weapon system that intercepts incoming missiles.',
        pdsBonus: 0.10,
        price: 8000,
    },
    'point-defense-system-2': {
        name: 'Point Defense System II',
        slot: 'subsystem',
        size: 'small',
        category: 'defense',
        description: 'Tech II point defense. Higher intercept probability.',
        pdsBonus: 0.15,
        price: 25000,
    },
    'fleet-pds-array': {
        name: 'Fleet PDS Array',
        slot: 'subsystem',
        size: 'medium',
        category: 'defense',
        description: 'Extended-range point defense that protects nearby allies from missiles.',
        pdsBonus: 0.08,
        fleetPdsRange: 300,
        fleetPdsBonus: 0.08,
        capacitorUse: 5,
        price: 30000,
    },

    // =============================================
    // SUBSYSTEMS - Tank
    // =============================================

    'shield-extender': {
        name: 'Shield Extender I',
        slot: 'subsystem',
        size: 'small',
        category: 'tank',
        description: 'Passively increases maximum shield capacity.',
        shieldBonus: 50,
        price: 3000,
    },
    'shield-extender-2': {
        name: 'Shield Extender II',
        slot: 'subsystem',
        size: 'medium',
        category: 'tank',
        description: 'Tech II shield extender. Greater capacity boost.',
        shieldBonus: 100,
        price: 10000,
    },
    'armor-plate': {
        name: 'Armor Plate I',
        slot: 'subsystem',
        size: 'small',
        category: 'tank',
        description: 'Passively increases maximum armor HP. Reduces speed.',
        armorBonus: 40,
        speedPenalty: 0.95,
        price: 3000,
    },
    'armor-plate-2': {
        name: 'Armor Plate II',
        slot: 'subsystem',
        size: 'medium',
        category: 'tank',
        description: 'Tech II armor plate. More armor, bigger speed penalty.',
        armorBonus: 80,
        speedPenalty: 0.90,
        price: 10000,
    },
    'damage-control': {
        name: 'Damage Control I',
        slot: 'subsystem',
        size: 'small',
        category: 'tank',
        description: 'Increases all resistances. Essential defensive module.',
        shieldResist: 0.10,
        armorResist: 0.10,
        hullResist: 0.15,
        price: 6000,
    },
    'damage-control-2': {
        name: 'Damage Control II',
        slot: 'subsystem',
        size: 'medium',
        category: 'tank',
        description: 'Tech II damage control. Superior across-the-board resistance.',
        shieldResist: 0.15,
        armorResist: 0.15,
        hullResist: 0.25,
        price: 18000,
    },

    // =============================================
    // SUBSYSTEMS - Speed/Agility
    // =============================================

    'nanofiber': {
        name: 'Nanofiber Internal Structure I',
        slot: 'subsystem',
        size: 'small',
        category: 'speed',
        description: 'Increases agility and max speed at cost of hull.',
        speedBonus: 1.08,
        agilityBonus: 1.12,
        hullPenalty: 0.90,
        price: 3500,
    },
    'nanofiber-2': {
        name: 'Nanofiber Internal Structure II',
        slot: 'subsystem',
        size: 'medium',
        category: 'speed',
        description: 'Tech II nanofiber. Greater speed, greater hull loss.',
        speedBonus: 1.12,
        agilityBonus: 1.18,
        hullPenalty: 0.85,
        price: 11000,
    },
    'overdrive-injector': {
        name: 'Overdrive Injector I',
        slot: 'subsystem',
        size: 'small',
        category: 'speed',
        description: 'Maximizes engine output. Reduces cargo capacity.',
        speedBonus: 1.12,
        cargoPenalty: 0.85,
        price: 4000,
    },
    'inertial-stabilizer': {
        name: 'Inertial Stabilizer I',
        slot: 'subsystem',
        size: 'small',
        category: 'speed',
        description: 'Improves alignment and turn speed. Blooms signature.',
        agilityBonus: 1.20,
        signatureBloom: 1.10,
        price: 3000,
    },

    // =============================================
    // SUBSYSTEMS - Capacitor
    // =============================================

    'capacitor-flux-coil': {
        name: 'Capacitor Flux Coil I',
        slot: 'subsystem',
        size: 'small',
        category: 'capacitor',
        description: 'Increases capacitor recharge rate. Reduces max cap.',
        capacitorRegenBonus: 1.20,
        capacitorPenalty: 0.90,
        price: 3000,
    },
    'capacitor-power-relay': {
        name: 'Capacitor Power Relay I',
        slot: 'subsystem',
        size: 'small',
        category: 'capacitor',
        description: 'Boosts cap recharge. Reduces shield boost amount.',
        capacitorRegenBonus: 1.25,
        shieldBoostPenalty: 0.90,
        price: 3500,
    },
    'reactor-control': {
        name: 'Reactor Control Unit I',
        slot: 'subsystem',
        size: 'medium',
        category: 'capacitor',
        description: 'Increases maximum capacitor capacity.',
        capacitorBonus: 50,
        price: 6000,
    },
    'reactor-control-2': {
        name: 'Reactor Control Unit II',
        slot: 'subsystem',
        size: 'large',
        category: 'capacitor',
        description: 'Tech II reactor control. Large capacitor increase.',
        capacitorBonus: 100,
        price: 18000,
    },

    // =============================================
    // SUBSYSTEMS - Mining Enhancements
    // =============================================

    'mining-upgrade': {
        name: 'Mining Laser Upgrade I',
        slot: 'subsystem',
        size: 'small',
        category: 'mining',
        description: 'Increases mining laser yield.',
        miningYieldBonus: 1.10,
        price: 4000,
    },
    'mining-upgrade-2': {
        name: 'Mining Laser Upgrade II',
        slot: 'subsystem',
        size: 'medium',
        category: 'mining',
        description: 'Tech II mining upgrade. Superior yield.',
        miningYieldBonus: 1.15,
        price: 12000,
    },
    'ice-harvester-upgrade': {
        name: 'Ice Harvester Upgrade I',
        slot: 'subsystem',
        size: 'small',
        category: 'mining',
        description: 'Improves ice and gas harvesting cycle time.',
        harvestCycleBonus: 0.90,
        price: 5000,
    },

    // =============================================
    // SUBSYSTEMS - Drone Enhancements
    // =============================================

    'drone-damage-amp': {
        name: 'Drone Damage Amplifier I',
        slot: 'subsystem',
        size: 'small',
        category: 'drone',
        description: 'Increases drone damage output.',
        droneBonus: 1.10,
        price: 5000,
    },
    'drone-damage-amp-2': {
        name: 'Drone Damage Amplifier II',
        slot: 'subsystem',
        size: 'medium',
        category: 'drone',
        description: 'Tech II drone amplifier. Superior drone performance.',
        droneBonus: 1.18,
        price: 14000,
    },
    'drone-navigation': {
        name: 'Drone Navigation Computer I',
        slot: 'subsystem',
        size: 'small',
        category: 'drone',
        description: 'Increases drone speed and tracking.',
        droneSpeedBonus: 1.20,
        price: 4000,
    },
    'omnidirectional-tracker': {
        name: 'Omnidirectional Tracking Link I',
        slot: 'subsystem',
        size: 'medium',
        category: 'drone',
        description: 'Improves drone tracking and optimal range.',
        droneTrackingBonus: 1.15,
        droneRangeBonus: 1.15,
        price: 8000,
    },

    // =============================================
    // MODULES - Survey Scanners
    // =============================================

    'survey-scanner-1': {
        name: 'Survey Scanner I',
        slot: 'module',
        size: 'small',
        category: 'survey',
        description: 'Scans nearby asteroid fields revealing ore composition and yield. 2000u range.',
        scanRange: 2000,
        cycleTime: 10,
        capacitorUse: 15,
        price: 8000,
    },
    'survey-scanner-2': {
        name: 'Survey Scanner II',
        slot: 'module',
        size: 'medium',
        category: 'survey',
        description: 'Enhanced scanner with 3500u range and faster cycle. Reveals detailed field data.',
        scanRange: 3500,
        cycleTime: 7,
        capacitorUse: 20,
        price: 25000,
    },
    'deep-space-scanner': {
        name: 'Deep Space Scanner',
        slot: 'module',
        size: 'large',
        category: 'survey',
        description: 'Capital-grade scanner. 6000u range reveals entire asteroid fields with precision data.',
        scanRange: 6000,
        cycleTime: 12,
        capacitorUse: 30,
        price: 60000,
    },

    // =============================================
    // MODULES - Remote Repair (Enhanced)
    // =============================================

    'remote-shield-repairer-2': {
        name: 'Remote Shield Repairer II',
        slot: 'module',
        size: 'large',
        category: 'utility',
        description: 'Heavy remote shield repair. Capital-grade logistics module.',
        remoteShieldRepair: 80,
        range: 800,
        cycleTime: 3.5,
        capacitorUse: 30,
        price: 35000,
    },
    'remote-armor-repairer-2': {
        name: 'Remote Armor Repairer II',
        slot: 'module',
        size: 'large',
        category: 'utility',
        description: 'Heavy remote armor repair. Capital-grade logistics module.',
        remoteArmorRepair: 70,
        range: 700,
        cycleTime: 4,
        capacitorUse: 38,
        price: 38000,
    },

    // =============================================
    // GUILD REWARD EQUIPMENT
    // =============================================

    // Mining Guild rewards
    'mining-laser-upgrade-1': {
        name: 'Deep Core Mining Laser I',
        slot: 'weapon',
        size: 'medium',
        category: 'mining',
        description: 'Guild-issue mining laser with superior yield and range.',
        miningYield: 150,
        range: 300,
        cycleTime: 4,
        capacitorUse: 12,
        price: 25000,
        guildExclusive: 'mining',
    },
    'ore-compressor': {
        name: 'Ore Compression Module I',
        slot: 'subsystem',
        size: 'small',
        category: 'mining',
        description: 'Compresses ore in cargo hold, effectively increasing capacity.',
        cargoBonus: 1.30,
        price: 15000,
        guildExclusive: 'mining',
    },
    'mining-drone-augmentor': {
        name: 'Mining Drone Augmentor I',
        slot: 'subsystem',
        size: 'medium',
        category: 'drone',
        description: 'Guild tech that boosts mining drone yield by 25%.',
        miningYieldBonus: 1.25,
        droneMiningBonus: 1.25,
        price: 20000,
        guildExclusive: 'mining',
    },

    // Mercenary Guild rewards
    'tracking-computer-1': {
        name: 'Tracking Computer I',
        slot: 'module',
        size: 'small',
        category: 'ewar',
        description: 'Guild-issue targeting system. Improves tracking speed.',
        trackingBonus: 1.30,
        optimalRangeBonus: 1.15,
        capacitorUse: 3,
        price: 18000,
        guildExclusive: 'mercenary',
    },
    'target-painter': {
        name: 'Target Painter I',
        slot: 'module',
        size: 'medium',
        category: 'ewar',
        description: 'Increases target signature radius, making them easier to hit.',
        signatureRadiusDebuff: 1.40,
        range: 1200,
        cycleTime: 5,
        capacitorUse: 8,
        price: 22000,
        guildExclusive: 'mercenary',
    },
    'rapid-fire-mod': {
        name: 'Rapid Fire Modification I',
        slot: 'subsystem',
        size: 'small',
        category: 'damage',
        description: 'Reduces weapon cycle time at the cost of slight damage reduction.',
        cycleTimeBonus: 0.80,
        damageBonus: 0.95,
        price: 20000,
        guildExclusive: 'mercenary',
    },
    'hardened-shield-emitter': {
        name: 'Hardened Shield Emitter I',
        slot: 'subsystem',
        size: 'medium',
        category: 'tank',
        description: 'Guild-grade shield hardener. Significant shield HP boost.',
        shieldBonus: 1.25,
        shieldResistance: 0.15,
        price: 25000,
        guildExclusive: 'mercenary',
    },

    // =============================================
    // INTEL / PROBE EQUIPMENT
    // =============================================

    'probe-launcher': {
        name: 'Probe Launcher I',
        slot: 'high',
        size: 'medium',
        category: 'utility',
        description: 'Launches scanner probes to gather intel on adjacent sectors.',
        cycleTime: 60,
        capPerCycle: 30,
        probeTravelTime: 20,
        range: 0, // not a weapon
        price: 35000,
    },

    // =============================================
    // FLAGSHIP COMMAND MODULES
    // =============================================

    'fleet-repair-array': {
        name: 'Fleet Repair Array',
        slot: 'high',
        size: 'xlarge',
        category: 'support',
        description: 'Capital-class repair system. Repairs nearby fleet ships over time.',
        cycleTime: 10,
        capPerCycle: 40,
        repairAmount: 50,
        repairRange: 2000,
        price: 200000,
    },
    'command-burst-offensive': {
        name: 'Command Burst - Offensive',
        slot: 'mid',
        size: 'xlarge',
        category: 'command',
        description: 'Broadcasts an offensive command burst, boosting fleet damage and tracking.',
        cycleTime: 60,
        capPerCycle: 80,
        duration: 30,
        damageBonus: 1.10,
        trackingBonus: 1.10,
        burstRange: 2500,
        price: 250000,
    },
    'command-burst-defensive': {
        name: 'Command Burst - Defensive',
        slot: 'mid',
        size: 'xlarge',
        category: 'command',
        description: 'Broadcasts a defensive command burst, boosting fleet shield and speed.',
        cycleTime: 60,
        capPerCycle: 80,
        duration: 30,
        shieldRegenBonus: 1.15,
        speedBonus: 1.05,
        burstRange: 2500,
        price: 250000,
    },
    'fighter-bay': {
        name: 'Fighter Bay',
        slot: 'high',
        size: 'xlarge',
        category: 'hangar',
        description: 'Dedicated fighter launch bay. Allows deployment of hangar-docked ships for combat.',
        cycleTime: 30,
        capPerCycle: 50,
        price: 300000,
    },

    // =============================================
    // MODULES - Resistance Hardeners
    // =============================================

    'em-shield-hardener': {
        name: 'EM Shield Hardener I',
        slot: 'module',
        size: 'small',
        category: 'shield-hardener',
        description: 'Increases shield EM resistance when active.',
        resistBonus: { layer: 'shield', type: 'em', amount: 0.30 },
        capacitorUse: 4,
        cpu: 25,
        powergrid: 1,
        price: 5000,
    },
    'thermal-shield-hardener': {
        name: 'Thermal Shield Hardener I',
        slot: 'module',
        size: 'small',
        category: 'shield-hardener',
        description: 'Increases shield thermal resistance when active.',
        resistBonus: { layer: 'shield', type: 'thermal', amount: 0.30 },
        capacitorUse: 4,
        cpu: 25,
        powergrid: 1,
        price: 5000,
    },
    'kinetic-shield-hardener': {
        name: 'Kinetic Shield Hardener I',
        slot: 'module',
        size: 'small',
        category: 'shield-hardener',
        description: 'Increases shield kinetic resistance when active.',
        resistBonus: { layer: 'shield', type: 'kinetic', amount: 0.30 },
        capacitorUse: 4,
        cpu: 25,
        powergrid: 1,
        price: 5000,
    },
    'explosive-shield-hardener': {
        name: 'Explosive Shield Hardener I',
        slot: 'module',
        size: 'small',
        category: 'shield-hardener',
        description: 'Increases shield explosive resistance when active.',
        resistBonus: { layer: 'shield', type: 'explosive', amount: 0.30 },
        capacitorUse: 4,
        cpu: 25,
        powergrid: 1,
        price: 5000,
    },
    'em-armor-hardener': {
        name: 'EM Armor Hardener I',
        slot: 'subsystem',
        size: 'small',
        category: 'armor-hardener',
        description: 'Passively increases armor EM resistance.',
        resistBonus: { layer: 'armor', type: 'em', amount: 0.25 },
        cpu: 15,
        powergrid: 1,
        price: 5000,
    },
    'thermal-armor-hardener': {
        name: 'Thermal Armor Hardener I',
        slot: 'subsystem',
        size: 'small',
        category: 'armor-hardener',
        description: 'Passively increases armor thermal resistance.',
        resistBonus: { layer: 'armor', type: 'thermal', amount: 0.25 },
        cpu: 15,
        powergrid: 1,
        price: 5000,
    },
    'kinetic-armor-hardener': {
        name: 'Kinetic Armor Hardener I',
        slot: 'subsystem',
        size: 'small',
        category: 'armor-hardener',
        description: 'Passively increases armor kinetic resistance.',
        resistBonus: { layer: 'armor', type: 'kinetic', amount: 0.25 },
        cpu: 15,
        powergrid: 1,
        price: 5000,
    },
    'explosive-armor-hardener': {
        name: 'Explosive Armor Hardener I',
        slot: 'subsystem',
        size: 'small',
        category: 'armor-hardener',
        description: 'Passively increases armor explosive resistance.',
        resistBonus: { layer: 'armor', type: 'explosive', amount: 0.25 },
        cpu: 15,
        powergrid: 1,
        price: 5000,
    },
    'hull-energizer': {
        name: 'Hull Energizer I',
        slot: 'subsystem',
        size: 'small',
        category: 'hull-hardener',
        description: 'Reinforces hull against all damage types.',
        resistBonus: { layer: 'hull', type: 'all', amount: 0.20 },
        cpu: 10,
        powergrid: 1,
        price: 4000,
    },
    'hull-energizer-2': {
        name: 'Hull Energizer II',
        slot: 'subsystem',
        size: 'medium',
        category: 'hull-hardener',
        description: 'Advanced hull reinforcement system.',
        resistBonus: { layer: 'hull', type: 'all', amount: 0.30 },
        cpu: 20,
        powergrid: 2,
        price: 12000,
    },
    'adaptive-invulnerability-field': {
        name: 'Adaptive Invulnerability Field I',
        slot: 'module',
        size: 'medium',
        category: 'shield-hardener',
        description: 'Active module that boosts all shield resistances. Stacks with diminishing returns.',
        resistBonus: { layer: 'shield', type: 'all', amount: 0.25 },
        capacitorUse: 6,
        cpu: 35,
        powergrid: 3,
        price: 15000,
    },
    'energized-adaptive-membrane': {
        name: 'Energized Adaptive Membrane I',
        slot: 'subsystem',
        size: 'medium',
        category: 'armor-hardener',
        description: 'Passive module that boosts all armor resistances.',
        resistBonus: { layer: 'armor', type: 'all', amount: 0.20 },
        cpu: 25,
        powergrid: 2,
        price: 14000,
    },
};

// =============================================
// POST-PROCESSING: CPU/PG DEFAULTS & DAMAGE PROFILES
// =============================================

// Default CPU/PG costs by slot type and size
const EQUIP_RESOURCE_DEFAULTS = {
    weapon: { small: { cpu: 15, powergrid: 3 }, medium: { cpu: 25, powergrid: 8 }, large: { cpu: 40, powergrid: 15 }, xlarge: { cpu: 60, powergrid: 25 } },
    module: { small: { cpu: 20, powergrid: 2 }, medium: { cpu: 30, powergrid: 5 }, large: { cpu: 45, powergrid: 10 }, xlarge: { cpu: 60, powergrid: 15 } },
    subsystem: { small: { cpu: 10, powergrid: 1 }, medium: { cpu: 20, powergrid: 3 }, large: { cpu: 30, powergrid: 5 }, xlarge: { cpu: 45, powergrid: 8 } },
    high: { small: { cpu: 15, powergrid: 3 }, medium: { cpu: 25, powergrid: 8 }, large: { cpu: 40, powergrid: 15 }, xlarge: { cpu: 60, powergrid: 25 } },
    mid: { small: { cpu: 20, powergrid: 5 }, medium: { cpu: 30, powergrid: 8 }, large: { cpu: 45, powergrid: 12 }, xlarge: { cpu: 60, powergrid: 15 } },
    low: { small: { cpu: 10, powergrid: 1 }, medium: { cpu: 20, powergrid: 3 }, large: { cpu: 30, powergrid: 5 }, xlarge: { cpu: 45, powergrid: 8 } },
};

// Default damage profiles by weapon category
const WEAPON_DAMAGE_PROFILES = {
    maser:   { em: 0.5, thermal: 0.5, kinetic: 0.0, explosive: 0.0 },
    railgun: { em: 0.0, thermal: 0.0, kinetic: 0.8, explosive: 0.2 },
    missile: { em: 0.0, thermal: 0.0, kinetic: 0.2, explosive: 0.8 },
};

// Apply defaults to all equipment
for (const [id, eq] of Object.entries(EQUIPMENT_DATABASE)) {
    // CPU/PG defaults
    const slotDefaults = EQUIP_RESOURCE_DEFAULTS[eq.slot];
    const sizeDefaults = slotDefaults?.[eq.size];
    if (sizeDefaults) {
        if (eq.cpu === undefined) eq.cpu = sizeDefaults.cpu;
        if (eq.powergrid === undefined) eq.powergrid = sizeDefaults.powergrid;
    }
    // Damage profile for weapons (replace single damageType)
    if (eq.damage && eq.category && WEAPON_DAMAGE_PROFILES[eq.category]) {
        if (!eq.damageProfile) {
            eq.damageProfile = { ...WEAPON_DAMAGE_PROFILES[eq.category] };
        }
    }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get all equipment for a given slot type ('weapon', 'module', 'subsystem')
 */
export function getEquipmentBySlot(slotType) {
    return Object.entries(EQUIPMENT_DATABASE)
        .filter(([, eq]) => eq.slot === slotType)
        .reduce((acc, [id, eq]) => { acc[id] = eq; return acc; }, {});
}

/**
 * Get all equipment of a specific category
 */
export function getEquipmentByCategory(category) {
    return Object.entries(EQUIPMENT_DATABASE)
        .filter(([, eq]) => eq.category === category)
        .reduce((acc, [id, eq]) => { acc[id] = eq; return acc; }, {});
}

/**
 * Get all equipment of a specific size
 */
export function getEquipmentBySize(size) {
    return Object.entries(EQUIPMENT_DATABASE)
        .filter(([, eq]) => eq.size === size)
        .reduce((acc, [id, eq]) => { acc[id] = eq; return acc; }, {});
}

/**
 * Get equipment sorted by price
 */
export function getEquipmentByPrice(ascending = true) {
    return Object.entries(EQUIPMENT_DATABASE)
        .sort((a, b) => ascending ? a[1].price - b[1].price : b[1].price - a[1].price);
}
