// =============================================
// POS Module Database
// Defines constructible modules for player-owned stations
// Each module requires hauling materials and contributes bonuses
// =============================================

export const POS_MAX_SLOTS = 6;

export const POS_MODULES = {
    'command-center': {
        name: 'Command Center',
        icon: '\u2318',
        description: 'Central command hub. Adds turret slots and reinforces station hull and shields.',
        materials: {
            'refined-minerals': 200,
            'consumer-electronics': 50,
        },
        bonuses: {
            turretSlots: 2,
            hull: 3000,
            shields: 2000,
        },
        category: 'defense',
    },
    'foundry': {
        name: 'Foundry',
        icon: '\u2692',
        description: 'Ore refinery module. Increases refinery yield and enables ore processing at your station.',
        materials: {
            'refined-minerals': 300,
            'drone-parts': 100,
        },
        bonuses: {
            refineryMultiplier: 1.3,
        },
        category: 'industry',
    },
    'shipyard': {
        name: 'Shipyard',
        icon: '\u2693',
        description: 'Ship manufacturing facility. Enables building ships at your station.',
        materials: {
            'refined-minerals': 400,
            'consumer-electronics': 150,
            'rare-earth-elements': 50,
        },
        bonuses: {
            shipManufacturing: true,
        },
        category: 'industry',
    },
    'equipment-lab': {
        name: 'Equipment Lab',
        icon: '\u2699',
        description: 'Module and equipment crafting laboratory.',
        materials: {
            'refined-minerals': 250,
            'consumer-electronics': 200,
            'rare-earth-elements': 30,
        },
        bonuses: {
            equipmentCrafting: true,
        },
        category: 'industry',
    },
    'cargo-bay': {
        name: 'Cargo Bay',
        icon: '\u2B1B',
        description: 'Massive storage expansion for your station.',
        materials: {
            'refined-minerals': 350,
            'drone-parts': 80,
        },
        bonuses: {
            storage: 15000,
        },
        category: 'logistics',
    },
    'shield-array': {
        name: 'Shield Array',
        icon: '\u26A1',
        description: 'Advanced shield generators with enhanced regeneration.',
        materials: {
            'refined-minerals': 200,
            'consumer-electronics': 100,
            'rare-earth-elements': 40,
        },
        bonuses: {
            shields: 5000,
            shieldRegenMultiplier: 2.0,
        },
        category: 'defense',
    },
    'missile-battery': {
        name: 'Missile Battery',
        icon: '\u2622',
        description: 'Heavy weapons platform with additional turret hardpoints.',
        materials: {
            'refined-minerals': 300,
            'drone-parts': 120,
            'rare-earth-elements': 60,
        },
        bonuses: {
            turretSlots: 4,
        },
        category: 'defense',
    },
    'docking-ring': {
        name: 'Docking Ring',
        icon: '\u25CE',
        description: 'External docking ring enables fleet auto-repair at your station.',
        materials: {
            'refined-minerals': 250,
            'drone-parts': 150,
        },
        bonuses: {
            fleetAutoRepair: true,
        },
        category: 'logistics',
    },
};

/**
 * Get the total material cost summary for a module
 */
export function getModuleTotalCost(moduleId) {
    const mod = POS_MODULES[moduleId];
    if (!mod) return null;
    return { ...mod.materials };
}

/**
 * Check if a module's materials are fully contributed
 */
export function isModuleComplete(contributed, moduleId) {
    const mod = POS_MODULES[moduleId];
    if (!mod) return false;
    for (const [matId, required] of Object.entries(mod.materials)) {
        if ((contributed[matId] || 0) < required) return false;
    }
    return true;
}

/**
 * Get completion percentage for a module under construction
 */
export function getModuleProgress(contributed, moduleId) {
    const mod = POS_MODULES[moduleId];
    if (!mod) return 0;
    let totalRequired = 0;
    let totalContributed = 0;
    for (const [matId, required] of Object.entries(mod.materials)) {
        totalRequired += required;
        totalContributed += Math.min(contributed[matId] || 0, required);
    }
    return totalRequired > 0 ? totalContributed / totalRequired : 0;
}
