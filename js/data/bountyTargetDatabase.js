// =============================================
// Bounty Target Database
// Named pirate captains with unique bounties
// =============================================

export const BOUNTY_TARGETS = {
    // ---- Tier 1: Frigate-class targets (25,000 ISK) ----
    'vex_rattlebone': {
        name: 'Vex Rattlebone',
        title: 'The Scrapyard Jackal',
        tier: 1,
        shipClass: 'breacher',
        bounty: 25000,
        description: 'A cunning salvager turned pirate who preys on damaged ships limping back from combat. Known for stripping hulls clean in minutes.',
        patrolSectors: ['hub', 'mining-belt', 'frontier'],
        specialLoot: [
            { itemId: 'salvager-1', chance: 0.25 },
            { itemId: 'armor-plate-1', chance: 0.15 }
        ],
        stats: {
            shield: 1.2,
            armor: 1.1,
            hull: 1.3
        }
    },
    'kira_ashfall': {
        name: 'Kira Ashfall',
        title: 'Ember Witch',
        tier: 1,
        shipClass: 'dramiel',
        bounty: 25000,
        description: 'Former Angel Cartel courier who went rogue. Her Dramiel is dangerously fast and she fights with reckless aggression.',
        patrolSectors: ['frontier', 'nebula', 'asteroid-field'],
        specialLoot: [
            { itemId: 'afterburner-1', chance: 0.20 },
            { itemId: 'shield-booster-1', chance: 0.15 }
        ],
        stats: {
            shield: 1.1,
            armor: 1.0,
            hull: 1.2
        }
    },
    'donn_blackrig': {
        name: 'Donn Blackrig',
        title: 'Hull Breaker',
        tier: 1,
        shipClass: 'breacher',
        bounty: 25000,
        description: 'A disgraced fleet mechanic who knows exactly where to aim. His shots always seem to find the weak points in your armor.',
        patrolSectors: ['mining-belt', 'hub', 'trade-nexus'],
        specialLoot: [
            { itemId: 'mining-laser-1', chance: 0.20 },
            { itemId: 'armor-repairer-1', chance: 0.15 }
        ],
        stats: {
            shield: 1.0,
            armor: 1.3,
            hull: 1.2
        }
    },

    // ---- Tier 2: Destroyer-class targets (75,000 ISK) ----
    'soren_voidfang': {
        name: 'Soren Voidfang',
        title: 'The Gate Stalker',
        tier: 2,
        shipClass: 'svipul',
        bounty: 75000,
        description: 'Camps warp gates and ambushes travelers. His tactical destroyer shifts modes mid-fight, making him unpredictable in combat.',
        patrolSectors: ['frontier', 'dark-sector', 'deep-space'],
        specialLoot: [
            { itemId: 'warp-disruptor-1', chance: 0.20 },
            { itemId: 'autocannon-1', chance: 0.15 }
        ],
        stats: {
            shield: 1.3,
            armor: 1.2,
            hull: 1.2
        }
    },
    'mara_cinderstrike': {
        name: 'Mara Cinderstrike',
        title: 'Scorched Trail',
        tier: 2,
        shipClass: 'svipul',
        bounty: 75000,
        description: 'Leads a hit-and-run squad that targets mining convoys. She has destroyed more freighters than any other pirate in the sector.',
        patrolSectors: ['mining-belt', 'asteroid-field', 'trade-nexus'],
        specialLoot: [
            { itemId: 'missile-launcher-1', chance: 0.20 },
            { itemId: 'shield-extender-1', chance: 0.15 }
        ],
        stats: {
            shield: 1.2,
            armor: 1.3,
            hull: 1.1
        }
    },
    'rek_hollowpoint': {
        name: 'Rek Hollowpoint',
        title: 'Dead-Eye',
        tier: 2,
        shipClass: 'svipul',
        bounty: 75000,
        description: 'A former navy sharpshooter with terrifying accuracy. He modified his Svipul for maximum tracking speed and engagement range.',
        patrolSectors: ['hub', 'frontier', 'nebula'],
        specialLoot: [
            { itemId: 'railgun-1', chance: 0.20 },
            { itemId: 'tracking-computer-1', chance: 0.15 }
        ],
        stats: {
            shield: 1.1,
            armor: 1.1,
            hull: 1.4
        }
    },

    // ---- Tier 3: Cruiser-class targets (200,000 ISK) ----
    'admiral_korrath': {
        name: 'Admiral Korrath',
        title: 'The Iron Corsair',
        tier: 3,
        shipClass: 'cynabal',
        bounty: 200000,
        description: 'A self-proclaimed admiral who commands a small pirate fleet from his Cynabal. Fast, heavily armed, and dangerously smart.',
        patrolSectors: ['dark-sector', 'deep-space', 'frontier'],
        specialLoot: [
            { itemId: 'autocannon-2', chance: 0.15 },
            { itemId: 'armor-plate-2', chance: 0.12 },
            { itemId: 'afterburner-2', chance: 0.10 }
        ],
        stats: {
            shield: 1.4,
            armor: 1.3,
            hull: 1.3
        }
    },
    'whisper_nyx': {
        name: 'Whisper Nyx',
        title: 'The Phantom',
        tier: 3,
        shipClass: 'stratios',
        bounty: 200000,
        description: 'No one sees her coming. Her Stratios decloaks at point-blank range, and her drone swarm tears ships apart before they can react.',
        patrolSectors: ['nebula', 'deep-space', 'dark-sector'],
        specialLoot: [
            { itemId: 'shield-booster-2', chance: 0.15 },
            { itemId: 'salvager-2', chance: 0.12 },
            { itemId: 'drone-link-1', chance: 0.10 }
        ],
        stats: {
            shield: 1.3,
            armor: 1.4,
            hull: 1.3
        }
    },

    // ---- Tier 4: Battlecruiser-class targets (500,000 ISK) ----
    'warlord_gravus': {
        name: 'Warlord Gravus',
        title: 'The Siege Engine',
        tier: 4,
        shipClass: 'brutix',
        bounty: 500000,
        description: 'A legendary pirate warlord whose Brutix has survived hundreds of engagements. He fights up close where his blasters deal devastating damage.',
        patrolSectors: ['dark-sector', 'deep-space', 'frontier', 'asteroid-field'],
        specialLoot: [
            { itemId: 'blaster-2', chance: 0.15 },
            { itemId: 'armor-plate-2', chance: 0.12 },
            { itemId: 'armor-repairer-2', chance: 0.10 },
            { itemId: 'shield-extender-2', chance: 0.08 }
        ],
        stats: {
            shield: 1.5,
            armor: 1.5,
            hull: 1.4
        }
    },
    'duchess_venom': {
        name: 'Duchess Venom',
        title: 'Queen of the Abyss',
        tier: 4,
        shipClass: 'vindicator',
        bounty: 500000,
        description: 'Ruler of the deep space pirate cartels. Her Vindicator unleashes overwhelming firepower that can shred even the toughest battlecruiser hulls.',
        patrolSectors: ['deep-space', 'dark-sector', 'nebula', 'trade-nexus'],
        specialLoot: [
            { itemId: 'railgun-2', chance: 0.15 },
            { itemId: 'shield-booster-2', chance: 0.12 },
            { itemId: 'tracking-computer-1', chance: 0.10 },
            { itemId: 'missile-launcher-2', chance: 0.08 }
        ],
        stats: {
            shield: 1.5,
            armor: 1.4,
            hull: 1.5
        }
    }
};

export const BOUNTY_CONFIG = {
    maxActive: 3,
    boardSize: 5,
    respawnTime: 300,
    refreshInterval: 600
};
