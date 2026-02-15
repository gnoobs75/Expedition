// =============================================
// Skill Tree Database - Allocatable Constellation Nodes
// 6 constellations with ~45 total nodes
// =============================================

/**
 * Node types:
 * - minor: 2-3 max points, small % bonuses
 * - notable: 5 max points, significant bonuses
 * - keystone: 1 point, powerful effect with trade-off
 * - start: 0 cost, always unlocked, constellation entry point
 */

export const SKILL_TREE_NODES = {
    // ==========================================
    // COMBAT CONSTELLATION (8 nodes)
    // ==========================================
    combat_start: {
        constellation: 'combat',
        name: 'Combat Training',
        type: 'start',
        maxPoints: 0,
        bonuses: {},
        tooltip: 'Entry point for combat skills',
        requires: [],
        position: { angle: 0, ring: 0 }, // center of combat constellation
    },
    precision_fire: {
        constellation: 'combat',
        name: 'Precision Fire',
        type: 'minor',
        maxPoints: 3,
        bonuses: { trackingBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% weapon tracking per point',
        requires: ['combat_start'],
        position: { angle: -20, ring: 1 },
    },
    heavy_ordnance: {
        constellation: 'combat',
        name: 'Heavy Ordnance',
        type: 'minor',
        maxPoints: 3,
        bonuses: { damageBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% weapon damage per point',
        requires: ['combat_start'],
        position: { angle: 20, ring: 1 },
    },
    rapid_reload: {
        constellation: 'combat',
        name: 'Rapid Reload',
        type: 'minor',
        maxPoints: 2,
        bonuses: { fireRateBonus: 0.03 }, // +3% per point → +6%
        tooltip: '+3% rate of fire per point',
        requires: ['precision_fire'],
        position: { angle: -30, ring: 2 },
    },
    sharpshooter: {
        constellation: 'combat',
        name: 'Sharpshooter',
        type: 'notable',
        maxPoints: 5,
        bonuses: { rangeBonus: 0.02, critChance: 0.01 }, // +2% range, +1% crit per point
        tooltip: '+2% weapon range & +1% critical hit chance per point',
        requires: ['precision_fire', 'heavy_ordnance'],
        position: { angle: 0, ring: 2 },
    },
    missile_spec: {
        constellation: 'combat',
        name: 'Missile Specialist',
        type: 'minor',
        maxPoints: 3,
        bonuses: { missileDamageBonus: 0.03 }, // +3% per point → +9%
        tooltip: '+3% missile damage per point',
        requires: ['heavy_ordnance'],
        position: { angle: 30, ring: 2 },
    },
    overload_weapons: {
        constellation: 'combat',
        name: 'Overload Weapons',
        type: 'keystone',
        maxPoints: 1,
        bonuses: { damageBonus: 0.15, capacitorDrain: 0.10 },
        tooltip: '+15% weapon damage, but +10% capacitor drain on weapons',
        requires: ['sharpshooter'],
        position: { angle: 0, ring: 3 },
    },
    drone_warfare: {
        constellation: 'combat',
        name: 'Drone Warfare',
        type: 'minor',
        maxPoints: 3,
        bonuses: { droneDamageBonus: 0.03 }, // +3% per point → +9%
        tooltip: '+3% drone damage per point',
        requires: ['combat_start'],
        position: { angle: 0, ring: 1.5 },
    },

    // ==========================================
    // MINING CONSTELLATION (7 nodes)
    // ==========================================
    mining_start: {
        constellation: 'mining',
        name: 'Mining Fundamentals',
        type: 'start',
        maxPoints: 0,
        bonuses: {},
        tooltip: 'Entry point for mining skills',
        requires: [],
        position: { angle: 0, ring: 0 },
    },
    deep_core: {
        constellation: 'mining',
        name: 'Deep Core Mining',
        type: 'minor',
        maxPoints: 3,
        bonuses: { miningYieldBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% mining yield per point',
        requires: ['mining_start'],
        position: { angle: -15, ring: 1 },
    },
    strip_mining: {
        constellation: 'mining',
        name: 'Strip Mining',
        type: 'minor',
        maxPoints: 3,
        bonuses: { miningSpeedBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% mining cycle speed per point',
        requires: ['mining_start'],
        position: { angle: 15, ring: 1 },
    },
    refinery_expert: {
        constellation: 'mining',
        name: 'Refinery Expert',
        type: 'notable',
        maxPoints: 5,
        bonuses: { refineryBonus: 0.03 }, // +3% per point → +15%
        tooltip: '+3% refinery output per point',
        requires: ['deep_core'],
        position: { angle: -20, ring: 2 },
    },
    ore_scanner: {
        constellation: 'mining',
        name: 'Ore Scanner',
        type: 'minor',
        maxPoints: 2,
        bonuses: { rareOreChance: 0.02 }, // +2% per point → +4%
        tooltip: '+2% rare ore discovery chance per point',
        requires: ['strip_mining'],
        position: { angle: 20, ring: 2 },
    },
    crystal_optimizer: {
        constellation: 'mining',
        name: 'Crystal Optimizer',
        type: 'notable',
        maxPoints: 5,
        bonuses: { miningYieldBonus: 0.02, miningSpeedBonus: 0.01 },
        tooltip: '+2% yield & +1% cycle speed per point',
        requires: ['deep_core', 'strip_mining'],
        position: { angle: 0, ring: 2 },
    },
    motherlode: {
        constellation: 'mining',
        name: 'Motherlode',
        type: 'keystone',
        maxPoints: 1,
        bonuses: { miningYieldBonus: 0.20, maxSpeedBonus: -0.10 },
        tooltip: '+20% mining yield, but -10% max speed while mining lasers active',
        requires: ['crystal_optimizer'],
        position: { angle: 0, ring: 3 },
    },

    // ==========================================
    // NAVIGATION CONSTELLATION (7 nodes)
    // ==========================================
    nav_start: {
        constellation: 'navigation',
        name: 'Astrogation Basics',
        type: 'start',
        maxPoints: 0,
        bonuses: {},
        tooltip: 'Entry point for navigation skills',
        requires: [],
        position: { angle: 0, ring: 0 },
    },
    warp_drive_opt: {
        constellation: 'navigation',
        name: 'Warp Drive Optimization',
        type: 'minor',
        maxPoints: 3,
        bonuses: { warpSpeedBonus: 0.03 }, // +3% per point → +9%
        tooltip: '+3% warp speed per point',
        requires: ['nav_start'],
        position: { angle: -15, ring: 1 },
    },
    afterburner_mastery: {
        constellation: 'navigation',
        name: 'Afterburner Mastery',
        type: 'minor',
        maxPoints: 3,
        bonuses: { maxSpeedBonus: 0.02, accelerationBonus: 0.02 },
        tooltip: '+2% max speed & +2% acceleration per point',
        requires: ['nav_start'],
        position: { angle: 15, ring: 1 },
    },
    evasive_maneuvers: {
        constellation: 'navigation',
        name: 'Evasive Maneuvers',
        type: 'notable',
        maxPoints: 5,
        bonuses: { evasionBonus: 0.02 }, // +2% per point → +10%
        tooltip: '+2% evasion chance per point',
        requires: ['afterburner_mastery'],
        position: { angle: 20, ring: 2 },
    },
    wormhole_theory: {
        constellation: 'navigation',
        name: 'Wormhole Theory',
        type: 'minor',
        maxPoints: 2,
        bonuses: { warpSpoolBonus: 0.05 }, // -5% per point → -10% spool time
        tooltip: '-5% warp spool time per point',
        requires: ['warp_drive_opt'],
        position: { angle: -20, ring: 2 },
    },
    fleet_navigator: {
        constellation: 'navigation',
        name: 'Fleet Navigator',
        type: 'notable',
        maxPoints: 5,
        bonuses: { fleetWarpBonus: 0.02 }, // +2% per point → +10%
        tooltip: '+2% fleet warp speed per point',
        requires: ['warp_drive_opt', 'afterburner_mastery'],
        position: { angle: 0, ring: 2 },
    },
    slipstream: {
        constellation: 'navigation',
        name: 'Slipstream',
        type: 'keystone',
        maxPoints: 1,
        bonuses: { maxSpeedBonus: 0.20, shieldBonus: -0.08 },
        tooltip: '+20% max speed, but -8% shield HP',
        requires: ['fleet_navigator'],
        position: { angle: 0, ring: 3 },
    },

    // ==========================================
    // ENGINEERING CONSTELLATION (8 nodes)
    // ==========================================
    eng_start: {
        constellation: 'engineering',
        name: 'Hull Engineering',
        type: 'start',
        maxPoints: 0,
        bonuses: {},
        tooltip: 'Entry point for engineering skills',
        requires: [],
        position: { angle: 0, ring: 0 },
    },
    shield_management: {
        constellation: 'engineering',
        name: 'Shield Management',
        type: 'minor',
        maxPoints: 3,
        bonuses: { shieldBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% shield HP per point',
        requires: ['eng_start'],
        position: { angle: -20, ring: 1 },
    },
    armor_plating: {
        constellation: 'engineering',
        name: 'Armor Plating',
        type: 'minor',
        maxPoints: 3,
        bonuses: { armorBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% armor HP per point',
        requires: ['eng_start'],
        position: { angle: 20, ring: 1 },
    },
    capacitor_systems: {
        constellation: 'engineering',
        name: 'Capacitor Systems',
        type: 'minor',
        maxPoints: 3,
        bonuses: { capacitorBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% capacitor capacity per point',
        requires: ['eng_start'],
        position: { angle: 0, ring: 1 },
    },
    shield_harmonics: {
        constellation: 'engineering',
        name: 'Shield Harmonics',
        type: 'notable',
        maxPoints: 5,
        bonuses: { shieldResistBonus: 0.02 }, // +2% per point → +10%
        tooltip: '+2% shield resistance per point',
        requires: ['shield_management'],
        position: { angle: -25, ring: 2 },
    },
    hull_tanking: {
        constellation: 'engineering',
        name: 'Hull Tanking',
        type: 'notable',
        maxPoints: 5,
        bonuses: { armorResistBonus: 0.01, hullBonus: 0.02 },
        tooltip: '+1% armor resist & +2% hull HP per point',
        requires: ['armor_plating'],
        position: { angle: 25, ring: 2 },
    },
    power_grid_opt: {
        constellation: 'engineering',
        name: 'Power Grid Optimization',
        type: 'minor',
        maxPoints: 2,
        bonuses: { capacitorRegenBonus: 0.03 }, // +3% per point → +6%
        tooltip: '+3% capacitor recharge rate per point',
        requires: ['capacitor_systems'],
        position: { angle: 0, ring: 2 },
    },
    reactive_armor: {
        constellation: 'engineering',
        name: 'Reactive Armor',
        type: 'keystone',
        maxPoints: 1,
        bonuses: { armorResistBonus: 0.15, maxSpeedBonus: -0.05 },
        tooltip: '+15% armor resistance, but -5% max speed',
        requires: ['shield_harmonics', 'hull_tanking'],
        position: { angle: 0, ring: 3 },
    },

    // ==========================================
    // TRADE CONSTELLATION (7 nodes)
    // ==========================================
    trade_start: {
        constellation: 'trade',
        name: 'Commerce Basics',
        type: 'start',
        maxPoints: 0,
        bonuses: {},
        tooltip: 'Entry point for trade skills',
        requires: [],
        position: { angle: 0, ring: 0 },
    },
    market_analysis: {
        constellation: 'trade',
        name: 'Market Analysis',
        type: 'minor',
        maxPoints: 3,
        bonuses: { priceBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% trade margin per point',
        requires: ['trade_start'],
        position: { angle: -15, ring: 1 },
    },
    cargo_optimization: {
        constellation: 'trade',
        name: 'Cargo Optimization',
        type: 'minor',
        maxPoints: 3,
        bonuses: { cargoBonus: 0.03 }, // +3% per point → +9%
        tooltip: '+3% cargo capacity per point',
        requires: ['trade_start'],
        position: { angle: 15, ring: 1 },
    },
    smuggling_routes: {
        constellation: 'trade',
        name: 'Smuggling Routes',
        type: 'notable',
        maxPoints: 5,
        bonuses: { priceBonus: 0.02, taxReduction: 0.02 },
        tooltip: '+2% margin & -2% station tax per point',
        requires: ['market_analysis'],
        position: { angle: -20, ring: 2 },
    },
    bulk_hauling: {
        constellation: 'trade',
        name: 'Bulk Hauling',
        type: 'notable',
        maxPoints: 5,
        bonuses: { cargoBonus: 0.02, maxSpeedBonus: 0.01 },
        tooltip: '+2% cargo & +1% speed per point',
        requires: ['cargo_optimization'],
        position: { angle: 20, ring: 2 },
    },
    insurance_fraud: {
        constellation: 'trade',
        name: 'Insurance Broker',
        type: 'minor',
        maxPoints: 2,
        bonuses: { insuranceBonus: 0.05 }, // +5% per point → +10%
        tooltip: '+5% insurance payout per point',
        requires: ['market_analysis'],
        position: { angle: 0, ring: 2 },
    },
    trade_baron: {
        constellation: 'trade',
        name: 'Trade Baron',
        type: 'keystone',
        maxPoints: 1,
        bonuses: { priceBonus: 0.15, damageBonus: -0.05 },
        tooltip: '+15% trade margins, but -5% weapon damage (you\'re a lover, not a fighter)',
        requires: ['smuggling_routes', 'bulk_hauling'],
        position: { angle: 0, ring: 3 },
    },

    // ==========================================
    // TACTICAL CONSTELLATION (8 nodes)
    // ==========================================
    tactical_start: {
        constellation: 'tactical',
        name: 'Tactical Awareness',
        type: 'start',
        maxPoints: 0,
        bonuses: {},
        tooltip: 'Entry point for tactical skills',
        requires: [],
        position: { angle: 0, ring: 0 },
    },
    ewar_proficiency: {
        constellation: 'tactical',
        name: 'EWAR Proficiency',
        type: 'minor',
        maxPoints: 3,
        bonuses: { ewarBonus: 0.03 }, // +3% per point → +9%
        tooltip: '+3% electronic warfare strength per point',
        requires: ['tactical_start'],
        position: { angle: -20, ring: 1 },
    },
    fleet_command: {
        constellation: 'tactical',
        name: 'Fleet Command',
        type: 'minor',
        maxPoints: 3,
        bonuses: { fleetBonus: 0.02 }, // +2% per point → +6%
        tooltip: '+2% fleet damage & speed per point',
        requires: ['tactical_start'],
        position: { angle: 20, ring: 1 },
    },
    scan_resolution: {
        constellation: 'tactical',
        name: 'Scan Resolution',
        type: 'minor',
        maxPoints: 2,
        bonuses: { scanBonus: 0.05 }, // +5% per point → +10%
        tooltip: '+5% scan resolution per point',
        requires: ['tactical_start'],
        position: { angle: 0, ring: 1 },
    },
    signal_suppression: {
        constellation: 'tactical',
        name: 'Signal Suppression',
        type: 'notable',
        maxPoints: 5,
        bonuses: { ewarBonus: 0.02, ewarResist: 0.02 },
        tooltip: '+2% EWAR strength & +2% EWAR resistance per point',
        requires: ['ewar_proficiency'],
        position: { angle: -25, ring: 2 },
    },
    fleet_doctrine: {
        constellation: 'tactical',
        name: 'Fleet Doctrine',
        type: 'notable',
        maxPoints: 5,
        bonuses: { fleetBonus: 0.02, fleetTankBonus: 0.01 },
        tooltip: '+2% fleet damage & +1% fleet HP per point',
        requires: ['fleet_command'],
        position: { angle: 25, ring: 2 },
    },
    probe_mastery: {
        constellation: 'tactical',
        name: 'Probe Mastery',
        type: 'minor',
        maxPoints: 3,
        bonuses: { scanBonus: 0.03, scanRange: 0.03 },
        tooltip: '+3% scan strength & range per point',
        requires: ['scan_resolution'],
        position: { angle: 0, ring: 2 },
    },
    force_multiplier: {
        constellation: 'tactical',
        name: 'Force Multiplier',
        type: 'keystone',
        maxPoints: 1,
        bonuses: { fleetBonus: 0.15, shieldBonus: -0.10 },
        tooltip: '+15% fleet-wide damage bonus, but -10% personal shield HP',
        requires: ['signal_suppression', 'fleet_doctrine'],
        position: { angle: 0, ring: 3 },
    },
};

/**
 * Constellation metadata for rendering
 */
export const CONSTELLATIONS = {
    combat: {
        name: 'Combat',
        color: '#ff4444',
        baseAngle: 0,    // degrees on the radial layout (top = 0, clockwise)
        icon: 'gunnery',
    },
    mining: {
        name: 'Mining',
        color: '#ffaa22',
        baseAngle: 60,
        icon: 'mining',
    },
    navigation: {
        name: 'Navigation',
        color: '#44aaff',
        baseAngle: 120,
        icon: 'navigation',
    },
    engineering: {
        name: 'Engineering',
        color: '#44ff88',
        baseAngle: 180,
        icon: 'engineering',
    },
    trade: {
        name: 'Trade',
        color: '#ffdd44',
        baseAngle: 240,
        icon: 'trade',
    },
    tactical: {
        name: 'Tactical',
        color: '#cc66ff',
        baseAngle: 300,
        icon: 'tactical',
    },
};

/**
 * Total points needed to fill the entire tree
 * minor: 18 nodes × avg 2.7 pts ≈ 49
 * notable: 12 nodes × 5 pts = 60
 * keystone: 6 nodes × 1 pt = 6
 * Total ≈ 115 SP to fill everything
 *
 * Players earn 1 SP per by-use skill level-up.
 * Max possible SP = 6 skills × 100 levels = 600 SP
 * So tree is easily fillable at high levels, but forces choices early/mid game.
 */
