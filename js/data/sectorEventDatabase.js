// =============================================
// Sector Event Database
// Dynamic sector-wide events that affect gameplay
// =============================================

export const SECTOR_EVENTS = {
    'pirate_capital': {
        name: 'Pirate Capital Invasion',
        duration: [600, 900],
        spawnConfig: {
            dreadnought: 1,
            escorts: 4,
            tier: 'elite'
        },
        bountyMultiplier: 3,
        description: 'A pirate dreadnought has jumped into the sector with a full escort fleet. High bounties await those brave enough to engage.',
        icon: 'skull',
        color: '#ff4422'
    },
    'wormhole': {
        name: 'Wormhole Opening',
        duration: [420, 720],
        spawnConfig: {
            anomalyType: 'wormhole'
        },
        description: 'An unstable wormhole has torn open in local space. Unknown signals are emanating from the rift.',
        icon: 'portal',
        color: '#8844ff'
    },
    'trade_embargo': {
        name: 'Trade Embargo',
        duration: [600, 900],
        priceModifier: 1.8,
        affectedGoods: 'all',
        description: 'A faction dispute has triggered a trade embargo. Commodity prices have surged across all local markets.',
        icon: 'embargo',
        color: '#ffaa22'
    },
    'radiation_storm': {
        name: 'Radiation Storm',
        duration: [300, 600],
        hazardType: 'radiation',
        hazardIntensity: 0.8,
        description: 'A massive radiation storm is sweeping through the sector. Shield systems are being disrupted and hull integrity is at risk.',
        icon: 'radiation',
        color: '#44ff88'
    },
    'mining_rush': {
        name: 'Mining Rush',
        duration: [600, 900],
        spawnConfig: {
            richAsteroids: 8,
            attractMiners: true
        },
        description: 'Deep scans have revealed rich mineral deposits in the area. Miners are flocking to the sector to stake their claims.',
        icon: 'mining',
        color: '#ffdd44'
    }
};

export const EVENT_CONFIG = {
    maxConcurrent: 1,
    evaluateInterval: 300,  // 5 minutes between evaluation checks
    minDuration: 300,
    maxDuration: 900
};
