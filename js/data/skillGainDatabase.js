// =============================================
// Skill Gain Database - By-Use Skill Definitions
// 6 pilot skills that level 1-100 through gameplay
// =============================================

/**
 * XP required to reach a given level from the previous level.
 * Formula: Math.floor(100 * Math.pow(level, 1.5))
 * Total XP to 100 ≈ 66,500
 */
export function xpForLevel(level) {
    if (level <= 0) return 0;
    return Math.floor(100 * Math.pow(level, 1.5));
}

/** Cumulative XP required to reach a given level */
export function cumulativeXP(level) {
    let total = 0;
    for (let i = 1; i <= level; i++) total += xpForLevel(i);
    return total;
}

export const MAX_SKILL_LEVEL = 100;

/**
 * 6 by-use skills. Each gains XP from specific gameplay actions.
 * Passive bonus per level is intentionally small (0.1-0.3% per level → 10-30% at 100).
 */
export const SKILL_GAIN_DEFINITIONS = {
    gunnery: {
        name: 'Gunnery',
        description: 'Weapon damage, tracking speed, optimal range',
        color: '#ff4444',
        icon: 'gunnery', // procedural SVG key
        passivePerLevel: {
            damageBonus: 0.002,       // +0.2%/lvl → +20% at 100
            trackingBonus: 0.001,     // +0.1%/lvl → +10% at 100
        },
        xpSources: [
            { event: 'combat:hit', description: 'Land a weapon hit', xp: 2 },
            { event: 'entity:destroyed', description: 'Destroy a hostile', xp: 'bounty' },
        ],
    },
    mining: {
        name: 'Mining',
        description: 'Mining yield, cycle speed, rare ore chance',
        color: '#ffaa22',
        icon: 'mining',
        passivePerLevel: {
            miningYieldBonus: 0.002,  // +0.2%/lvl → +20% at 100
            miningSpeedBonus: 0.001,  // +0.1%/lvl → +10% at 100
        },
        xpSources: [
            { event: 'mining:complete', description: 'Complete a mining cycle', xp: 'units' },
        ],
    },
    navigation: {
        name: 'Navigation',
        description: 'Warp speed, align time, max velocity',
        color: '#44aaff',
        icon: 'navigation',
        passivePerLevel: {
            warpSpeedBonus: 0.002,    // +0.2%/lvl → +20% at 100
            maxSpeedBonus: 0.001,     // +0.1%/lvl → +10% at 100
        },
        xpSources: [
            { event: 'sector:change', description: 'Jump to a new sector', xp: 15 },
            { event: 'warp:complete', description: 'Complete a warp', xp: 5 },
        ],
    },
    engineering: {
        name: 'Engineering',
        description: 'Shield HP, capacitor, armor resist',
        color: '#44ff88',
        icon: 'engineering',
        passivePerLevel: {
            shieldBonus: 0.002,       // +0.2%/lvl → +20% at 100
            capacitorBonus: 0.001,    // +0.1%/lvl → +10% at 100
        },
        xpSources: [
            { event: 'combat:hit', description: 'Take damage (as target)', xp: 1, role: 'target' },
            { event: 'station:repair', description: 'Repair at station', xp: 10 },
        ],
    },
    trade: {
        name: 'Trade',
        description: 'Trade margins, cargo space, tax reduction',
        color: '#ffdd44',
        icon: 'trade',
        passivePerLevel: {
            priceBonus: 0.002,        // +0.2%/lvl → +20% at 100
            cargoBonus: 0.001,        // +0.1%/lvl → +10% at 100
        },
        xpSources: [
            { event: 'trade:complete', description: 'Buy or sell goods', xp: 'amount' },
            { event: 'refinery:complete', description: 'Refine ore', xp: 8 },
        ],
    },
    tactical: {
        name: 'Tactical',
        description: 'EWAR strength, fleet bonus, scan resolution',
        color: '#cc66ff',
        icon: 'tactical',
        passivePerLevel: {
            ewarBonus: 0.002,         // +0.2%/lvl → +20% at 100
            fleetBonus: 0.001,        // +0.1%/lvl → +10% at 100
        },
        xpSources: [
            { event: 'ewar:applied', description: 'Apply EWAR effect', xp: 3 },
            { event: 'fleet:command', description: 'Issue fleet command', xp: 5 },
            { event: 'scan:complete', description: 'Complete a scan', xp: 8 },
        ],
    },
};
