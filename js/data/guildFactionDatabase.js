// =============================================
// Guild Faction Database
// Defines the 5 autonomous guild factions that
// operate across the universe, creating a living
// economy with miners, haulers, ratters, and
// a hostile pirate cartel that raids them all.
// =============================================

export const GUILD_FACTIONS = {
    'ore-extraction-syndicate': {
        id: 'ore-extraction-syndicate',
        name: 'Ore Extraction Syndicate',
        shortName: 'OES',
        color: '#ffaa44',
        icon: '\u2692', // ⚒
        homeStation: 'sector-1',
        description: 'Industrial mining conglomerate. Extracts ore and hauls refined minerals to manufacturing hubs.',
        startingTreasury: 50000,
        startingShips: [
            { role: 'miner', shipClass: 'venture', count: 5 },
            { role: 'miner', shipClass: 'prospect', count: 3 },
            { role: 'miner', shipClass: 'retriever', count: 2 },
            { role: 'hauler', shipClass: 'wreathe', count: 3 },
            { role: 'ratter', shipClass: 'rifter', count: 2 },
            { role: 'surveyor', shipClass: 'probe', count: 1 },
            { role: 'logistics', shipClass: 'bantam', count: 1 },
        ],
        aiConfig: {
            miningPriority: 0.7,
            tradingPriority: 0.2,
            combatPriority: 0.1,
            preferredMiningSectors: ['sector-1', 'sector-2', 'hub'],
            preferredTradeSectors: ['sector-1', 'sector-3', 'sector-5'],
            avoidSectors: ['sector-5'], // Too dangerous for miners
        },
        shipReplacementCosts: { miner: 8000, hauler: 20000, ratter: 12000, surveyor: 10000, logistics: 15000 },
    },

    'stellar-logistics': {
        id: 'stellar-logistics',
        name: 'Stellar Logistics Corp',
        shortName: 'SLC',
        color: '#44ddff',
        icon: '\u2696', // ⚖
        homeStation: 'hub',
        description: 'Interstellar freight and trade network. Finds profitable routes and keeps goods flowing between stations.',
        startingTreasury: 60000,
        startingShips: [
            { role: 'hauler', shipClass: 'wreathe', count: 4 },
            { role: 'hauler', shipClass: 'mammoth', count: 3 },
            { role: 'hauler', shipClass: 'heron', count: 3 },
            { role: 'ratter', shipClass: 'merlin', count: 3 },
            { role: 'logistics', shipClass: 'inquisitor', count: 2 },
        ],
        aiConfig: {
            miningPriority: 0.0,
            tradingPriority: 0.8,
            combatPriority: 0.2,
            preferredMiningSectors: [],
            preferredTradeSectors: ['hub', 'sector-1', 'sector-2', 'sector-3', 'sector-6'],
            avoidSectors: ['sector-4', 'sector-5'],
        },
        shipReplacementCosts: { miner: 8000, hauler: 20000, ratter: 12000, logistics: 15000 },
    },

    'void-hunters': {
        id: 'void-hunters',
        name: 'Void Hunters PMC',
        shortName: 'VH',
        color: '#ff4466',
        icon: '\u2694', // ⚔
        homeStation: 'sector-5',
        description: 'Private military contractors specializing in pirate suppression and hazardous zone security.',
        startingTreasury: 55000,
        startingShips: [
            { role: 'ratter', shipClass: 'rifter', count: 5 },
            { role: 'ratter', shipClass: 'thrasher', count: 3 },
            { role: 'ratter', shipClass: 'thorax', count: 2 },
            { role: 'ratter', shipClass: 'corax', count: 2 },
            { role: 'hauler', shipClass: 'heron', count: 2 },
            { role: 'logistics', shipClass: 'osprey', count: 2 },
            { role: 'surveyor', shipClass: 'buzzard', count: 1 },
        ],
        aiConfig: {
            miningPriority: 0.0,
            tradingPriority: 0.15,
            combatPriority: 0.85,
            preferredMiningSectors: [],
            preferredTradeSectors: ['sector-5', 'hub'],
            avoidSectors: [],
            preferredHuntSectors: ['sector-4', 'sector-5', 'sector-3'],
        },
        shipReplacementCosts: { miner: 8000, hauler: 15000, ratter: 15000, surveyor: 10000, logistics: 18000 },
    },

    'frontier-alliance': {
        id: 'frontier-alliance',
        name: 'Frontier Development Alliance',
        shortName: 'FDA',
        color: '#44ff88',
        icon: '\u2606', // ☆
        homeStation: 'sector-3',
        description: 'Cooperative alliance of independent operators. Balanced approach: mining, hauling, and sector defense.',
        startingTreasury: 45000,
        startingShips: [
            { role: 'miner', shipClass: 'venture', count: 3 },
            { role: 'miner', shipClass: 'prospect', count: 2 },
            { role: 'hauler', shipClass: 'wreathe', count: 3 },
            { role: 'hauler', shipClass: 'heron', count: 2 },
            { role: 'ratter', shipClass: 'slasher', count: 2 },
            { role: 'ratter', shipClass: 'rifter', count: 2 },
            { role: 'surveyor', shipClass: 'helios', count: 1 },
            { role: 'logistics', shipClass: 'augoror', count: 1 },
        ],
        aiConfig: {
            miningPriority: 0.35,
            tradingPriority: 0.35,
            combatPriority: 0.3,
            preferredMiningSectors: ['sector-2', 'sector-6', 'sector-3'],
            preferredTradeSectors: ['sector-3', 'sector-6', 'hub', 'sector-2'],
            avoidSectors: ['sector-5'],
            preferredHuntSectors: ['sector-3', 'sector-4'],
        },
        shipReplacementCosts: { miner: 8000, hauler: 18000, ratter: 12000, surveyor: 10000, logistics: 15000 },
    },
    'shadow-cartel': {
        id: 'shadow-cartel',
        name: 'Shadow Cartel',
        shortName: 'SC',
        color: '#cc2244',
        icon: '\u2620', // ☠
        homeStation: null, // Unknown pirate haven - ships spawn from void
        isPirate: true,    // Hostile to all other factions and player
        description: 'Ruthless pirate syndicate operating from an unknown base. Launches raids across all sectors, targeting miners and haulers.',
        startingTreasury: 40000,
        startingShips: [
            { role: 'raider', shipClass: 'slasher', count: 6 },
            { role: 'raider', shipClass: 'rifter', count: 4 },
            { role: 'raider', shipClass: 'thrasher', count: 3 },
            { role: 'bomber', shipClass: 'corax', count: 2 },
            { role: 'bomber', shipClass: 'thorax', count: 1 },
        ],
        aiConfig: {
            miningPriority: 0.0,
            tradingPriority: 0.0,
            combatPriority: 1.0,
            preferredMiningSectors: [],
            preferredTradeSectors: [],
            avoidSectors: [],
            // Raiders hunt everywhere, prefer rich sectors with guild activity
            preferredRaidSectors: ['sector-1', 'sector-2', 'sector-3', 'hub', 'sector-6'],
            // Bombers hit dangerous zones where ratters patrol
            preferredAmbushSectors: ['sector-4', 'sector-5', 'sector-3'],
            // Raid timing (abstract simulation)
            raidInterval: 45,       // Seconds between raid evaluations
            raidChance: 0.6,        // Chance of launching a raid per evaluation
            minRaidSize: 2,         // Minimum ships per raid group
            maxRaidSize: 5,         // Maximum ships per raid group
        },
        shipReplacementCosts: { raider: 6000, bomber: 18000 },
    },
};

// Factions hostile to Shadow Cartel (all legitimate factions)
export const PIRATE_FACTION_ID = 'shadow-cartel';

export function isFactionHostile(factionIdA, factionIdB) {
    if (factionIdA === PIRATE_FACTION_ID || factionIdB === PIRATE_FACTION_ID) {
        return factionIdA !== factionIdB; // Pirates hostile to everyone except themselves
    }
    return false; // Legitimate factions don't fight each other
}

// Ship name prefixes per faction
const SHIP_NAMES = {
    'ore-extraction-syndicate': {
        miner: ['Digger', 'Borer', 'Drill', 'Pick', 'Sapper', 'Quarry', 'Vein', 'Seam', 'Lode', 'Shaft',
                 'Excavator', 'Grinder', 'Crusher', 'Breaker', 'Tunneler'],
        hauler: ['Mule', 'Ox', 'Loadstar', 'Freighter', 'Bulkhead', 'Carrier', 'Packhorse', 'Sledge'],
        ratter: ['Guardian', 'Shield', 'Ward', 'Bulwark', 'Sentry'],
        surveyor: ['Geode', 'Assayer', 'Prober', 'Core-Sample'],
        logistics: ['Patchwork', 'Mender', 'Welder', 'Rigger'],
    },
    'stellar-logistics': {
        hauler: ['Comet', 'Express', 'Arrow', 'Bolt', 'Courier', 'Sprint', 'Dart', 'Relay', 'Transit', 'Vector',
                 'Pathway', 'Conduit', 'Bridge', 'Link'],
        ratter: ['Escort', 'Outrider', 'Vanguard', 'Picket', 'Screen'],
        logistics: ['Lifeline', 'Medivac', 'Tender', 'Aid', 'Remedy'],
    },
    'void-hunters': {
        ratter: ['Fang', 'Razor', 'Claw', 'Talon', 'Striker', 'Reaper', 'Slayer', 'Hunter', 'Stalker', 'Predator',
                 'Viper', 'Cobra', 'Scorpion', 'Mantis', 'Raptor'],
        hauler: ['Salvage', 'Scrap', 'Haul', 'Grab'],
        logistics: ['Corpsman', 'Triage', 'Paramedic', 'Trauma'],
        surveyor: ['Tracker', 'Recon', 'Seeker'],
    },
    'frontier-alliance': {
        miner: ['Pioneer', 'Settler', 'Prospector', 'Homestead', 'Claim'],
        hauler: ['Caravan', 'Wagon', 'Supply', 'Provision', 'Trade'],
        ratter: ['Ranger', 'Scout', 'Patrol', 'Watch', 'Deputy'],
        surveyor: ['Cartographer', 'Explorer', 'Surveyor', 'Mapper'],
        logistics: ['Healer', 'Nurse', 'Savior', 'Beacon'],
    },
    'shadow-cartel': {
        raider: ['Shade', 'Wraith', 'Phantom', 'Specter', 'Ghost', 'Shadow', 'Dusk', 'Nightfall',
                 'Eclipse', 'Blackout', 'Void', 'Abyss', 'Marauder', 'Cutlass', 'Corsair'],
        bomber: ['Havoc', 'Ruin', 'Blight', 'Scourge', 'Plague', 'Devastator', 'Annihilator'],
    },
};

/**
 * Generate a unique ship name for a faction+role
 */
let nameCounters = {};
export function generateShipName(factionId, role) {
    const names = SHIP_NAMES[factionId]?.[role] || ['Ship'];
    const key = `${factionId}-${role}`;
    if (!nameCounters[key]) nameCounters[key] = 0;
    const index = nameCounters[key]++ % names.length;
    const suffix = Math.floor(nameCounters[key] / names.length);
    return suffix > 0 ? `${names[index]}-${suffix + 1}` : names[index];
}

/**
 * Reset name counters (for fresh starts)
 */
export function resetNameCounters() {
    nameCounters = {};
}
