// =============================================
// Faction Database
// Expeditionary Force (Craig Alanson) inspired factions
// with coalition relationships and standing system
// =============================================

// Standing thresholds
export const STANDING_THRESHOLDS = {
    HOSTILE:    { name: 'Hostile',    min: -10, max: -5,  color: '#ff2222' },
    UNFRIENDLY: { name: 'Unfriendly', min: -5,  max: -2,  color: '#ff8844' },
    NEUTRAL:    { name: 'Neutral',    min: -2,  max: 2,   color: '#888888' },
    FRIENDLY:   { name: 'Friendly',   min: 2,   max: 5,   color: '#44aaff' },
    ALLIED:     { name: 'Allied',     min: 5,   max: 10,  color: '#44ff44' },
};

// Coalition definitions
export const COALITIONS = {
    rindhalu: {
        name: 'Rindhalu Coalition',
        members: ['rindhalu', 'jeraptha', 'ruhar'],
        color: '#4488ff',
        spilloverMultiplier: 0.3,
    },
    maxolhx: {
        name: 'Maxolhx Coalition',
        members: ['maxolhx', 'thuranin', 'bosphuraq', 'kristang'],
        color: '#ff4444',
        spilloverMultiplier: 0.3,
    },
    humanity: {
        name: 'Humanity',
        members: ['unef', 'mavericks', 'keepers'],
        color: '#44ffaa',
        spilloverMultiplier: 0.5,
    },
    independent: {
        name: 'Independent',
        members: ['esselgin', 'wurgalan'],
        color: '#ffaa44',
        spilloverMultiplier: 0.2,
    },
};

// Cross-coalition hostility (standing modifier when interacting with rival coalitions)
export const COALITION_RELATIONS = {
    rindhalu: { maxolhx: -0.5, humanity: 0.1, independent: 0.0 },
    maxolhx:  { rindhalu: -0.5, humanity: -0.3, independent: -0.1 },
    humanity: { rindhalu: 0.1, maxolhx: -0.3, independent: 0.1 },
    independent: { rindhalu: 0.0, maxolhx: -0.1, humanity: 0.1 },
};

// Full faction definitions
export const FACTIONS = {
    // =============================================
    // TIER 1 - Elder Races (Most Powerful)
    // =============================================
    rindhalu: {
        name: 'Rindhalu Collective',
        nickname: 'Spiders',
        tier: 1,
        coalition: 'rindhalu',
        color: '#4488ff',
        personality: 'ancient',    // AI dialogue style
        description: 'Ancient spider-like beings who lead the senior coalition. Rarely seen, immensely powerful.',
        tradeGoods: ['quantum-crystals', 'neural-matrices'],
        shipPrefix: 'RCS',
        baseStanding: 0,
        aggressionLevel: 0.1,     // Very low - rarely attack first
        techLevel: 5,
    },
    maxolhx: {
        name: 'Maxolhx Federation',
        nickname: 'Rotten Kitties',
        tier: 1,
        coalition: 'maxolhx',
        color: '#ff4444',
        personality: 'arrogant',
        description: 'Cat-like apex predators leading the junior coalition. Technologically sophisticated and deeply hostile to humans.',
        tradeGoods: ['plasma-conduits', 'stealth-alloys'],
        shipPrefix: 'MXF',
        baseStanding: -3,
        aggressionLevel: 0.6,
        techLevel: 5,
    },

    // =============================================
    // TIER 2 - Patron Races
    // =============================================
    jeraptha: {
        name: 'Jeraptha Ajackus',
        nickname: 'Beetles',
        tier: 2,
        coalition: 'rindhalu',
        color: '#44ccff',
        personality: 'mercantile',
        description: 'Beetle-like traders and warriors. Profit-driven but honorable in their own way.',
        tradeGoods: ['trade-contracts', 'shield-harmonics'],
        shipPrefix: 'JAK',
        baseStanding: 1,
        aggressionLevel: 0.3,
        techLevel: 4,
    },
    thuranin: {
        name: 'Thuranin Republic',
        nickname: 'Pin Heads',
        tier: 2,
        coalition: 'maxolhx',
        color: '#aa44ff',
        personality: 'logical',
        description: 'Small, technologically gifted species. Coldly logical and dismissive of lesser species.',
        tradeGoods: ['micro-processors', 'sensor-arrays'],
        shipPrefix: 'THR',
        baseStanding: -2,
        aggressionLevel: 0.4,
        techLevel: 4,
    },
    bosphuraq: {
        name: 'Bosphuraq Concordance',
        nickname: 'Bird Brains',
        tier: 2,
        coalition: 'maxolhx',
        color: '#ff8844',
        personality: 'aggressive',
        description: 'Avian warriors, aggressive and territorial. Patron species of the Kristang.',
        tradeGoods: ['weapons-tech', 'flight-enhancers'],
        shipPrefix: 'BSP',
        baseStanding: -2,
        aggressionLevel: 0.5,
        techLevel: 3,
    },
    esselgin: {
        name: 'Esselgin Dominion',
        nickname: 'Snakes',
        tier: 2,
        coalition: 'independent',
        color: '#88ff44',
        personality: 'cunning',
        description: 'Serpentine diplomats who play both coalitions against each other. Untrustworthy but useful.',
        tradeGoods: ['diplomatic-ciphers', 'bio-compounds'],
        shipPrefix: 'ESD',
        baseStanding: 0,
        aggressionLevel: 0.25,
        techLevel: 3,
    },

    // =============================================
    // TIER 3 - Client Races
    // =============================================
    ruhar: {
        name: 'Ruhar Federal Republic',
        nickname: 'Hamsters',
        tier: 3,
        coalition: 'rindhalu',
        color: '#ffcc44',
        personality: 'friendly',
        description: 'Hamster-like people. Friendly, democratic, and humanity\'s best alien allies.',
        tradeGoods: ['foodstuffs', 'medical-supplies'],
        shipPrefix: 'RFR',
        baseStanding: 3,
        aggressionLevel: 0.15,
        techLevel: 2,
    },
    kristang: {
        name: 'Kristang Warriors',
        nickname: 'Lizards',
        tier: 3,
        coalition: 'maxolhx',
        color: '#ff2222',
        personality: 'warrior',
        description: 'Aggressive lizard warriors. Honor-obsessed, violent, and humanity\'s primary antagonists.',
        tradeGoods: ['war-trophies', 'combat-stimulants'],
        shipPrefix: 'KRW',
        baseStanding: -4,
        aggressionLevel: 0.7,
        techLevel: 2,
    },
    wurgalan: {
        name: 'Wurgalan Enclave',
        nickname: 'Octopuses',
        tier: 3,
        coalition: 'independent',
        color: '#44ffcc',
        personality: 'cautious',
        description: 'Tentacled beings who prefer isolation. Defensive but possess unique biotech.',
        tradeGoods: ['bio-tech', 'tentacle-fiber'],
        shipPrefix: 'WGE',
        baseStanding: 0,
        aggressionLevel: 0.2,
        techLevel: 2,
    },

    // =============================================
    // HUMAN FACTIONS
    // =============================================
    unef: {
        name: 'UNEF',
        nickname: 'United Nations Expeditionary Force',
        tier: 3,
        coalition: 'humanity',
        color: '#44ff88',
        personality: 'military',
        description: 'Earth\'s military force in the galactic conflict. Disciplined, resourceful, adapting to alien tech.',
        tradeGoods: ['earth-artifacts', 'military-rations'],
        shipPrefix: 'UNE',
        baseStanding: 4,
        aggressionLevel: 0.3,
        techLevel: 1,
    },
    mavericks: {
        name: 'Mavericks',
        nickname: 'Skippy\'s Crew',
        tier: 3,
        coalition: 'humanity',
        color: '#00ffff',
        personality: 'irreverent',
        description: 'Elite pirate crew of the Flying Dutchman. Led by Joe Bishop with an ancient AI beer can named Skippy.',
        tradeGoods: ['alien-salvage', 'ancient-tech'],
        shipPrefix: 'MVK',
        baseStanding: 5,
        aggressionLevel: 0.2,
        techLevel: 3,   // Skippy's tech advantage
    },
    keepers: {
        name: 'Keepers of the Faith',
        nickname: 'Zealots',
        tier: 3,
        coalition: 'humanity',
        color: '#ffff44',
        personality: 'zealous',
        description: 'Religious human faction seeking meaning in the galactic conflict. Devoted but unpredictable.',
        tradeGoods: ['relics', 'devotional-texts'],
        shipPrefix: 'KOF',
        baseStanding: 2,
        aggressionLevel: 0.35,
        techLevel: 1,
    },
};

// =============================================
// FACTION SHIP VARIANTS
// =============================================
// Which base ships each faction produces at their stations

export const FACTION_SHIP_VARIANTS = {
    kristang:  ['slasher', 'rifter', 'thrasher', 'thorax', 'hurricane', 'maelstrom'],
    ruhar:     ['venture', 'heron', 'slasher', 'vigil', 'caracal', 'drake'],
    jeraptha:  ['heron', 'vigil', 'caracal', 'drake', 'raven', 'scorpion'],
    thuranin:  ['slasher', 'corax', 'caracal', 'ferox', 'raven', 'scorpion'],
    bosphuraq: ['slasher', 'rifter', 'thrasher', 'thorax', 'hurricane'],
    esselgin:  ['vigil', 'prospect', 'corax', 'caracal', 'naga'],
    wurgalan:  ['venture', 'procurer', 'vigil', 'drake', 'brutix'],
    maxolhx:   ['slasher', 'rifter', 'thrasher', 'corax', 'caracal', 'ferox', 'hurricane', 'drake', 'raven', 'scorpion', 'maelstrom', 'naglfar'],
    rindhalu:  ['drake', 'hurricane', 'raven', 'scorpion', 'maelstrom'],
    unef:      ['venture', 'heron', 'slasher', 'vigil', 'caracal'],
    mavericks: ['slasher', 'heron', 'vigil', 'caracal'],
    keepers:   ['venture', 'slasher', 'vigil', 'caracal'],
};

// Stat scaling per faction tier + flavor bonuses
export const FACTION_TECH_BONUSES = {
    // Tier 3 - Client Races (base power)
    kristang:  { tierScale: 1.00, shieldMult: 0.90, armorMult: 1.05, speedMult: 1.00, damageMult: 1.15, capMult: 0.95, flavor: 'Kinetic specialists' },
    ruhar:     { tierScale: 1.00, shieldMult: 1.10, armorMult: 1.00, speedMult: 1.10, damageMult: 1.00, capMult: 1.00, flavor: 'Shield & speed balanced' },
    wurgalan:  { tierScale: 1.00, shieldMult: 1.05, armorMult: 1.05, speedMult: 0.95, damageMult: 0.95, capMult: 1.10, flavor: 'Biotech drones' },
    unef:      { tierScale: 1.00, shieldMult: 1.00, armorMult: 1.00, speedMult: 1.00, damageMult: 1.00, capMult: 1.00, flavor: 'Standard human tech' },
    mavericks: { tierScale: 1.00, shieldMult: 1.00, armorMult: 0.95, speedMult: 1.15, damageMult: 1.05, capMult: 1.00, flavor: 'Skippy-enhanced' },
    keepers:   { tierScale: 1.00, shieldMult: 1.05, armorMult: 1.00, speedMult: 0.95, damageMult: 1.00, capMult: 1.05, flavor: 'Faith-hardened' },
    // Tier 2 - Patron Races (20% stronger)
    jeraptha:  { tierScale: 1.20, shieldMult: 1.10, armorMult: 1.00, speedMult: 1.05, damageMult: 1.05, capMult: 1.10, flavor: 'Trade-grade shields' },
    thuranin:  { tierScale: 1.20, shieldMult: 1.00, armorMult: 1.00, speedMult: 0.95, damageMult: 1.15, capMult: 1.10, flavor: 'Precision weapons' },
    bosphuraq: { tierScale: 1.20, shieldMult: 0.95, armorMult: 1.05, speedMult: 1.15, damageMult: 1.10, capMult: 0.95, flavor: 'Attack vectors' },
    esselgin:  { tierScale: 1.20, shieldMult: 1.00, armorMult: 1.00, speedMult: 1.10, damageMult: 1.00, capMult: 1.15, flavor: 'EWAR specialists' },
    // Tier 1 - Elder Races (40% stronger)
    maxolhx:   { tierScale: 1.40, shieldMult: 1.10, armorMult: 1.10, speedMult: 1.10, damageMult: 1.15, capMult: 1.10, flavor: 'Apex technology' },
    rindhalu:  { tierScale: 1.40, shieldMult: 1.15, armorMult: 1.05, speedMult: 1.05, damageMult: 1.10, capMult: 1.20, flavor: 'Ancient webtech' },
};

/**
 * Apply faction overlay to a base ship config, scaling stats by tier and faction bonuses.
 * Returns a new config object (doesn't mutate original).
 * @param {Object} baseShip - Ship config from SHIP_DATABASE
 * @param {string} baseShipId - Ship ID key
 * @param {string} factionId - Faction ID
 * @returns {Object} Modified ship config with faction overlay
 */
export function applyFactionOverlay(baseShip, baseShipId, factionId) {
    const faction = FACTIONS[factionId];
    const bonuses = FACTION_TECH_BONUSES[factionId];
    if (!faction || !bonuses || !baseShip) return baseShip;

    const ts = bonuses.tierScale;
    const prefix = faction.shipPrefix;

    return {
        ...baseShip,
        name: `${prefix} ${baseShip.name}`,
        factionId: factionId,
        factionVariant: true,
        basedOn: baseShipId,
        // Scale defenses
        shield: Math.round(baseShip.shield * ts * bonuses.shieldMult),
        armor: Math.round(baseShip.armor * ts * bonuses.armorMult),
        hull: Math.round(baseShip.hull * ts),
        // Scale mobility
        maxSpeed: Math.round(baseShip.maxSpeed * bonuses.speedMult),
        // Scale power
        capacitor: Math.round(baseShip.capacitor * ts * bonuses.capMult),
        capacitorRegen: +(baseShip.capacitorRegen * ts * bonuses.capMult).toFixed(1),
        // Scale price
        price: Math.round(baseShip.price * ts * 1.1),
    };
}

/**
 * Get faction-specific ship catalog for a station vendor.
 * @param {string} factionId - Faction controlling the station
 * @param {Object} shipDatabase - Full SHIP_DATABASE
 * @returns {Array<[string, Object]>} Array of [shipId, factionOverlayConfig] pairs
 */
export function getFactionShipCatalog(factionId, shipDatabase) {
    const variants = FACTION_SHIP_VARIANTS[factionId];
    if (!variants) {
        // No faction or generic: return all ships as-is
        return Object.entries(shipDatabase);
    }

    const catalog = [];
    for (const shipId of variants) {
        const base = shipDatabase[shipId];
        if (!base) continue;
        const overlaid = applyFactionOverlay(base, shipId, factionId);
        catalog.push([`${factionId}-${shipId}`, overlaid]);
    }
    return catalog;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get standing label and color for a numeric standing value
 */
export function getStandingInfo(standing) {
    for (const [key, threshold] of Object.entries(STANDING_THRESHOLDS)) {
        if (standing >= threshold.min && standing < threshold.max) {
            return { key, ...threshold };
        }
    }
    if (standing >= 5) return { key: 'ALLIED', ...STANDING_THRESHOLDS.ALLIED };
    return { key: 'HOSTILE', ...STANDING_THRESHOLDS.HOSTILE };
}

/**
 * Get the coalition a faction belongs to
 */
export function getFactionCoalition(factionId) {
    const faction = FACTIONS[factionId];
    if (!faction) return null;
    return COALITIONS[faction.coalition] || null;
}

/**
 * Get all factions in a coalition
 */
export function getCoalitionFactions(coalitionId) {
    const coalition = COALITIONS[coalitionId];
    if (!coalition) return [];
    return coalition.members.map(id => ({ id, ...FACTIONS[id] })).filter(f => f.name);
}

/**
 * Calculate standing change with coalition spillover
 * @param {string} factionId - Faction whose standing changed
 * @param {number} delta - Standing change amount
 * @returns {Object} Map of factionId -> delta (includes spillover)
 */
export function calculateStandingChanges(factionId, delta) {
    const changes = { [factionId]: delta };
    const faction = FACTIONS[factionId];
    if (!faction) return changes;

    const coalition = COALITIONS[faction.coalition];
    if (!coalition) return changes;

    // Positive spillover to coalition members
    for (const memberId of coalition.members) {
        if (memberId === factionId) continue;
        changes[memberId] = delta * coalition.spilloverMultiplier;
    }

    // Negative spillover to rival coalitions
    const relations = COALITION_RELATIONS[faction.coalition];
    if (relations) {
        for (const [rivalCoalId, hostilityMod] of Object.entries(relations)) {
            if (hostilityMod === 0) continue;
            const rivalCoal = COALITIONS[rivalCoalId];
            if (!rivalCoal) continue;
            for (const rivalId of rivalCoal.members) {
                // If delta is positive (gained standing), rivals lose standing proportionally
                // If delta is negative (lost standing), rivals gain standing proportionally
                const rivalDelta = -delta * Math.abs(hostilityMod) * 0.5;
                changes[rivalId] = (changes[rivalId] || 0) + rivalDelta;
            }
        }
    }

    return changes;
}

/**
 * Get a faction's standing-based price modifier
 * @param {number} standing - Current standing with the faction
 * @returns {number} Price multiplier (< 1.0 = discount, > 1.0 = markup)
 */
export function getStandingPriceModifier(standing) {
    if (standing >= 5) return 0.90;    // Allied: 10% discount
    if (standing >= 2) return 0.95;    // Friendly: 5% discount
    if (standing >= -2) return 1.00;   // Neutral: no change
    if (standing >= -5) return 1.10;   // Unfriendly: 10% markup
    return 1.25;                        // Hostile: 25% markup
}

/**
 * Get all factions as an array with IDs
 */
export function getAllFactions() {
    return Object.entries(FACTIONS).map(([id, faction]) => ({ id, ...faction }));
}

/**
 * Get faction by ID
 */
export function getFaction(factionId) {
    return FACTIONS[factionId] || null;
}

/**
 * Initialize default standings for a new player
 * @returns {Object} Map of factionId -> standing
 */
export function getDefaultStandings() {
    const standings = {};
    for (const [id, faction] of Object.entries(FACTIONS)) {
        standings[id] = faction.baseStanding;
    }
    return standings;
}
