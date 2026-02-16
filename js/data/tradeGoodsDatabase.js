// =============================================
// Trade Goods Database
// Commodities traded between stations
// Each station specializes in producing certain goods
// and consuming others, creating trade routes
// =============================================

// Station specialties - what each station produces and needs
export const STATION_SPECIALTIES = {
    hub: {
        name: 'Central Hub',
        specialty: 'administration',
        produces: ['bureaucratic-documents', 'navigation-charts', 'trade-licenses', 'security-codes', 'pos-kit-basic'],
        consumes: ['luxury-food', 'medical-supplies', 'consumer-electronics', 'exotic-textiles'],
        description: 'Administrative center - produces permits and documentation, imports luxury goods',
    },
    'sector-1': {
        name: 'Mining Fields Alpha',
        specialty: 'mining',
        produces: ['refined-minerals', 'industrial-alloys', 'crystal-composites', 'heavy-metals'],
        consumes: ['mining-equipment', 'industrial-coolant', 'hull-plating', 'drone-parts'],
        description: 'Heavy mining operation - produces refined materials, needs industrial supplies',
    },
    'sector-2': {
        name: 'Mining Fields Beta',
        specialty: 'agriculture',
        produces: ['luxury-food', 'organic-compounds', 'bio-cultures', 'hydroponic-nutrients'],
        consumes: ['agri-drones', 'water-purifiers', 'greenhouse-panels', 'fertilizer-compounds'],
        description: 'Hydroponic farms - produces food and organics, needs farming equipment',
    },
    'sector-3': {
        name: 'Frontier Zone',
        specialty: 'technology',
        produces: ['consumer-electronics', 'sensor-arrays', 'quantum-processors', 'shield-capacitors'],
        consumes: ['refined-minerals', 'crystal-composites', 'rare-earth-elements', 'superconductors'],
        description: 'Tech manufacturing hub - produces electronics, needs raw materials',
    },
    'sector-4': {
        name: 'Pirate Territory',
        specialty: 'black-market',
        produces: ['contraband-weapons', 'hacked-firmware', 'stolen-cargo', 'forged-documents'],
        consumes: ['medical-supplies', 'combat-stimulants', 'security-codes', 'encryption-keys'],
        description: 'Black market outpost - trades in illicit goods and stolen tech',
    },
    'sector-5': {
        name: 'The Abyss',
        specialty: 'military',
        produces: ['hull-plating', 'weapon-components', 'combat-stimulants', 'encryption-keys'],
        consumes: ['heavy-metals', 'industrial-alloys', 'quantum-processors', 'refined-minerals'],
        description: 'Military garrison - produces armaments, needs industrial feedstock',
    },
    'sector-6': {
        name: 'Nebula Expanse',
        specialty: 'research',
        produces: ['rare-earth-elements', 'superconductors', 'experimental-compounds', 'nebula-gas-samples'],
        consumes: ['sensor-arrays', 'navigation-charts', 'quantum-processors', 'bio-cultures'],
        description: 'Research station - harvests nebula resources, needs scientific equipment',
    },
    'mw-alpha': {
        name: 'Sol Gateway',
        specialty: 'military-hub',
        produces: ['hull-plating', 'weapon-components', 'shield-capacitors', 'encryption-keys'],
        consumes: ['tritanium-ingots', 'pyerite-ingots', 'heavy-metals', 'industrial-alloys'],
        description: 'Military manufacturing hub - produces warship components, needs refined metals',
    },
    'mw-bravo': {
        name: 'Orion Refinery',
        specialty: 'mining-refinery',
        produces: ['tritanium-ingots', 'pyerite-ingots', 'refined-minerals', 'industrial-alloys'],
        consumes: ['mining-equipment', 'industrial-coolant', 'drone-parts', 'hull-plating'],
        description: 'Deep-space mining and refinery complex - processes ore into ingots and alloys',
    },
    'mw-charlie': {
        name: 'Cygnus Forge',
        specialty: 'mining-refinery',
        produces: ['mexallon-ingots', 'isogen-ingots', 'crystal-composites', 'nocxium-ingots'],
        consumes: ['mining-equipment', 'water-purifiers', 'hull-plating', 'industrial-coolant'],
        description: 'Advanced mineral forge - refines rare ores into high-grade ingots',
    },
    'mw-delta': {
        name: 'Vega Outpost',
        specialty: 'mercenary-hub',
        produces: ['contraband-weapons', 'combat-stimulants', 'hacked-firmware', 'stolen-cargo'],
        consumes: ['weapon-components', 'medical-supplies', 'encryption-keys', 'luxury-food'],
        description: 'Mercenary outpost - combat contracts and black market trading',
    },
    'mw-echo': {
        name: 'Sirius Station',
        specialty: 'military-hub',
        produces: ['weapon-components', 'encryption-keys', 'combat-stimulants', 'shield-capacitors'],
        consumes: ['mexallon-ingots', 'isogen-ingots', 'quantum-processors', 'heavy-metals'],
        description: 'Military garrison - produces advanced weapons systems, needs high-grade materials',
    },
    'mw-foxtrot': {
        name: 'Arcturus Landing',
        specialty: 'mercenary-hub',
        produces: ['stolen-cargo', 'forged-documents', 'hacked-firmware', 'contraband-weapons'],
        consumes: ['combat-stimulants', 'medical-supplies', 'luxury-food', 'consumer-electronics'],
        description: 'Mercenary haven - black market hub for illicit goods and services',
    },
};

// Trade goods categories and items
export const TRADE_GOODS = {
    // =============================================
    // RAW MATERIALS (from mining/harvesting)
    // =============================================
    'refined-minerals': {
        name: 'Refined Minerals',
        category: 'raw-materials',
        basePrice: 120,
        volume: 0.5,
        icon: '\u2B23', // hexagon
        description: 'Processed mineral compounds used in manufacturing',
    },
    'industrial-alloys': {
        name: 'Industrial Alloys',
        category: 'raw-materials',
        basePrice: 250,
        volume: 0.8,
        icon: '\u2B23',
        description: 'High-strength alloys for construction and shipbuilding',
    },
    'crystal-composites': {
        name: 'Crystal Composites',
        category: 'raw-materials',
        basePrice: 400,
        volume: 0.3,
        icon: '\u2B20', // diamond
        description: 'Crystalline structures used in optics and electronics',
    },
    'heavy-metals': {
        name: 'Heavy Metals',
        category: 'raw-materials',
        basePrice: 180,
        volume: 1.2,
        icon: '\u2B23',
        description: 'Dense metallic elements for armor and reactors',
    },
    'rare-earth-elements': {
        name: 'Rare Earth Elements',
        category: 'raw-materials',
        basePrice: 600,
        volume: 0.2,
        icon: '\u2B20',
        description: 'Exotic elements essential for advanced technology',
    },
    'superconductors': {
        name: 'Superconductors',
        category: 'raw-materials',
        basePrice: 550,
        volume: 0.3,
        icon: '\u26A1',
        description: 'Zero-resistance conductors for power systems',
    },
    'tritanium-ingots': {
        name: 'Tritanium Ingots',
        category: 'raw-materials',
        basePrice: 200,
        volume: 0.3,
        icon: '\u2B23',
        description: 'Refined metal ingots from veldspar ore. Essential for hull construction.',
    },
    'pyerite-ingots': {
        name: 'Pyerite Ingots',
        category: 'raw-materials',
        basePrice: 400,
        volume: 0.4,
        icon: '\u2B23',
        description: 'Volatile crystalline ingots from scordite. Used in weapons manufacturing.',
    },
    'mexallon-ingots': {
        name: 'Mexallon Ingots',
        category: 'raw-materials',
        basePrice: 650,
        volume: 0.5,
        icon: '\u2B23',
        description: 'Dense metallic ingots from pyroxeres. Required for advanced components.',
    },
    'isogen-ingots': {
        name: 'Isogen Ingots',
        category: 'raw-materials',
        basePrice: 1000,
        volume: 0.6,
        icon: '\u2B23',
        description: 'Rare isotope ingots from plagioclase. Used in shield technology.',
    },
    'nocxium-ingots': {
        name: 'Nocxium Ingots',
        category: 'raw-materials',
        basePrice: 1800,
        volume: 0.7,
        icon: '\u2B23',
        description: 'Ultra-dense ingots from omber ore. Critical for capital ship components.',
    },
    'zydrine-ingots': {
        name: 'Zydrine Ingots',
        category: 'raw-materials',
        basePrice: 3500,
        volume: 0.8,
        icon: '\u2B23',
        description: 'Exceedingly rare crystalline ingots from kernite. The most valuable refined material.',
    },

    // =============================================
    // FOOD & ORGANICS
    // =============================================
    'luxury-food': {
        name: 'Luxury Foodstuffs',
        category: 'food-organics',
        basePrice: 200,
        volume: 0.6,
        icon: '\u2615', // hot beverage
        description: 'Premium food products for station personnel',
    },
    'organic-compounds': {
        name: 'Organic Compounds',
        category: 'food-organics',
        basePrice: 150,
        volume: 0.4,
        icon: '\u2698', // alembic
        description: 'Bio-derived chemical compounds for medicine and industry',
    },
    'bio-cultures': {
        name: 'Bio-Cultures',
        category: 'food-organics',
        basePrice: 350,
        volume: 0.2,
        icon: '\u2698',
        description: 'Living microbial cultures for research and production',
    },
    'hydroponic-nutrients': {
        name: 'Hydroponic Nutrients',
        category: 'food-organics',
        basePrice: 100,
        volume: 0.7,
        icon: '\u2698',
        description: 'Concentrated nutrient solution for farm stations',
    },

    // =============================================
    // ELECTRONICS & TECHNOLOGY
    // =============================================
    'consumer-electronics': {
        name: 'Consumer Electronics',
        category: 'electronics',
        basePrice: 300,
        volume: 0.3,
        icon: '\u2699', // gear
        description: 'Personal devices and entertainment systems',
    },
    'sensor-arrays': {
        name: 'Sensor Arrays',
        category: 'electronics',
        basePrice: 500,
        volume: 0.5,
        icon: '\u2699',
        description: 'Long-range detection and scanning equipment',
    },
    'quantum-processors': {
        name: 'Quantum Processors',
        category: 'electronics',
        basePrice: 800,
        volume: 0.1,
        icon: '\u2699',
        description: 'Ultra-fast processing units for navigation and targeting',
    },
    'shield-capacitors': {
        name: 'Shield Capacitors',
        category: 'electronics',
        basePrice: 450,
        volume: 0.4,
        icon: '\u26A1',
        description: 'Energy storage units for shield systems',
    },

    // =============================================
    // INDUSTRIAL SUPPLIES
    // =============================================
    'mining-equipment': {
        name: 'Mining Equipment',
        category: 'industrial',
        basePrice: 280,
        volume: 1.0,
        icon: '\u2692', // hammer and pick
        description: 'Drill bits, extraction tools, and processing gear',
    },
    'industrial-coolant': {
        name: 'Industrial Coolant',
        category: 'industrial',
        basePrice: 160,
        volume: 0.8,
        icon: '\u2744', // snowflake
        description: 'Thermal management fluids for heavy machinery',
    },
    'drone-parts': {
        name: 'Drone Components',
        category: 'industrial',
        basePrice: 350,
        volume: 0.4,
        icon: '\u2699',
        description: 'Replacement parts and assemblies for mining drones',
    },
    'hull-plating': {
        name: 'Hull Plating',
        category: 'industrial',
        basePrice: 320,
        volume: 1.5,
        icon: '\u2B23',
        description: 'Armored panels for ship and station construction',
    },

    // =============================================
    // AGRICULTURAL SUPPLIES
    // =============================================
    'agri-drones': {
        name: 'Agricultural Drones',
        category: 'agriculture',
        basePrice: 400,
        volume: 0.6,
        icon: '\u2699',
        description: 'Automated farming and harvesting drones',
    },
    'water-purifiers': {
        name: 'Water Purifiers',
        category: 'agriculture',
        basePrice: 220,
        volume: 0.5,
        icon: '\u2744',
        description: 'Filtration systems for recycling station water',
    },
    'greenhouse-panels': {
        name: 'Greenhouse Panels',
        category: 'agriculture',
        basePrice: 180,
        volume: 1.0,
        icon: '\u2B23',
        description: 'Transparent radiation-shielded growing panels',
    },
    'fertilizer-compounds': {
        name: 'Fertilizer Compounds',
        category: 'agriculture',
        basePrice: 130,
        volume: 0.8,
        icon: '\u2698',
        description: 'Chemical nutrients for hydroponic systems',
    },

    // =============================================
    // MILITARY & SECURITY
    // =============================================
    'weapon-components': {
        name: 'Weapon Components',
        category: 'military',
        basePrice: 500,
        volume: 0.4,
        icon: '\u2694', // swords
        description: 'Precision-machined parts for weapon systems',
    },
    'combat-stimulants': {
        name: 'Combat Stimulants',
        category: 'military',
        basePrice: 350,
        volume: 0.1,
        icon: '\u2695', // caduceus
        description: 'Performance-enhancing compounds for pilots',
    },
    'encryption-keys': {
        name: 'Encryption Keys',
        category: 'military',
        basePrice: 600,
        volume: 0.05,
        icon: '\u26BF', // key
        description: 'Quantum encryption modules for secure communications',
    },

    // =============================================
    // MEDICAL & SCIENCE
    // =============================================
    'medical-supplies': {
        name: 'Medical Supplies',
        category: 'medical',
        basePrice: 250,
        volume: 0.3,
        icon: '\u2695',
        description: 'Pharmaceuticals, surgical tools, and nano-medicine',
    },
    'experimental-compounds': {
        name: 'Experimental Compounds',
        category: 'medical',
        basePrice: 700,
        volume: 0.15,
        icon: '\u2698',
        description: 'Cutting-edge chemical compounds from nebula research',
    },
    'nebula-gas-samples': {
        name: 'Nebula Gas Samples',
        category: 'medical',
        basePrice: 450,
        volume: 0.4,
        icon: '\u2601', // cloud
        description: 'Rare gas specimens collected from nebula clouds',
    },

    // =============================================
    // ADMINISTRATION & LUXURY
    // =============================================
    'bureaucratic-documents': {
        name: 'Bureaucratic Documents',
        category: 'administration',
        basePrice: 80,
        volume: 0.1,
        icon: '\u2709', // envelope
        description: 'Permits, certifications, and official records',
    },
    'navigation-charts': {
        name: 'Navigation Charts',
        category: 'administration',
        basePrice: 300,
        volume: 0.1,
        icon: '\u2609', // sun/star
        description: 'Updated star charts and route data',
    },
    'trade-licenses': {
        name: 'Trade Licenses',
        category: 'administration',
        basePrice: 200,
        volume: 0.05,
        icon: '\u2709',
        description: 'Official permits for inter-station commerce',
    },
    'security-codes': {
        name: 'Security Codes',
        category: 'administration',
        basePrice: 400,
        volume: 0.05,
        icon: '\u26BF',
        description: 'Access codes and clearance documentation',
    },
    'exotic-textiles': {
        name: 'Exotic Textiles',
        category: 'luxury',
        basePrice: 350,
        volume: 0.3,
        icon: '\u2B20',
        description: 'Fine fabrics and designer materials for station elites',
    },

    // =============================================
    // BLACK MARKET (Pirate Territory)
    // =============================================
    'contraband-weapons': {
        name: 'Contraband Weapons',
        category: 'contraband',
        basePrice: 700,
        volume: 0.5,
        icon: '\u2620', // skull
        description: 'Illegally modified weapon systems',
    },
    'hacked-firmware': {
        name: 'Hacked Firmware',
        category: 'contraband',
        basePrice: 500,
        volume: 0.05,
        icon: '\u2620',
        description: 'Cracked software for bypassing security systems',
    },
    'stolen-cargo': {
        name: 'Stolen Cargo',
        category: 'contraband',
        basePrice: 300,
        volume: 1.0,
        icon: '\u2620',
        description: 'Hijacked goods of questionable origin',
    },
    'forged-documents': {
        name: 'Forged Documents',
        category: 'contraband',
        basePrice: 250,
        volume: 0.1,
        icon: '\u2620',
        description: 'Convincing forgeries of official documents',
    },

    // =============================================
    // INDUSTRIAL - POS KITS
    // =============================================
    'pos-kit-basic': {
        name: 'POS Assembly Kit (Basic)',
        category: 'industrial',
        basePrice: 500000,
        volume: 20000,
        icon: '\u2B21',
        description: 'Compact station assembly kit. Requires capital hauler for transport. Deploys to Basic POS.',
    },
    'pos-kit-advanced': {
        name: 'POS Assembly Kit (Advanced)',
        category: 'industrial',
        basePrice: 1500000,
        volume: 25000,
        icon: '\u2B22',
        description: 'Premium station assembly kit with enhanced hull and turret hardpoints. Capital hauler required.',
    },
};

// Category display info
export const TRADE_CATEGORIES = {
    'raw-materials':    { name: 'Raw Materials',    color: '#88aacc' },
    'food-organics':    { name: 'Food & Organics',  color: '#44ff88' },
    'electronics':      { name: 'Electronics',      color: '#44aaff' },
    'industrial':       { name: 'Industrial',       color: '#ffaa44' },
    'agriculture':      { name: 'Agriculture',      color: '#88ff44' },
    'military':         { name: 'Military',         color: '#ff4444' },
    'medical':          { name: 'Medical',          color: '#ff88ff' },
    'administration':   { name: 'Administration',   color: '#cccccc' },
    'luxury':           { name: 'Luxury Goods',     color: '#ffdd44' },
    'contraband':       { name: 'Contraband',       color: '#ff6600' },
};

/**
 * Dynamic market state - tracks supply levels that shift prices.
 * Supply > 0 means oversupply (prices drop), supply < 0 means shortage (prices rise).
 * Supply decays toward 0 over time.
 */
const _marketState = {};

/**
 * Get the supply modifier for a good at a station.
 * Returns a multiplier (e.g., 0.85 means 15% cheaper, 1.2 means 20% more expensive).
 */
function getSupplyModifier(goodId, sectorId) {
    const key = `${sectorId}:${goodId}`;
    const supply = _marketState[key] || 0;
    // Each unit of supply shifts price by ~2%, clamped to +-40%
    return Math.max(0.6, Math.min(1.4, 1 - supply * 0.02));
}

/**
 * Record a trade that shifts supply. Called when player buys or sells.
 * buying = true means player bought (station supply decreased)
 * buying = false means player sold (station supply increased)
 */
export function recordTrade(goodId, sectorId, quantity, buying) {
    const key = `${sectorId}:${goodId}`;
    if (!_marketState[key]) _marketState[key] = 0;
    // Buying removes supply (prices rise), selling adds supply (prices drop)
    _marketState[key] += buying ? -quantity : quantity;
    // Clamp to prevent extreme swings
    _marketState[key] = Math.max(-20, Math.min(20, _marketState[key]));
}

/**
 * Decay all market supply levels toward 0 (call periodically, e.g. every 30s)
 */
export function decayMarketState() {
    for (const key of Object.keys(_marketState)) {
        if (Math.abs(_marketState[key]) < 0.1) {
            delete _marketState[key];
        } else {
            _marketState[key] *= 0.92; // 8% decay per tick
        }
    }
}

/**
 * Get/set raw market state for save/load
 */
export function getMarketState() { return { ..._marketState }; }
export function loadMarketState(data) {
    for (const key of Object.keys(_marketState)) delete _marketState[key];
    if (data) Object.assign(_marketState, data);
}

/**
 * Get buy/sell prices for a trade good at a specific station
 * Stations sell produced goods cheap and buy consumed goods at premium
 * Prices shift based on dynamic supply/demand from player trading
 */
export function getStationPrice(goodId, sectorId) {
    const good = TRADE_GOODS[goodId];
    if (!good) return { buy: 0, sell: 0 };

    const station = STATION_SPECIALTIES[sectorId];
    if (!station) return { buy: good.basePrice, sell: Math.floor(good.basePrice * 0.8) };

    let buyMultiplier = 1.0;  // Price player pays to buy from station
    let sellMultiplier = 0.8; // Price player gets when selling to station

    // Station produces this good -> sells cheap (player buys cheap)
    if (station.produces.includes(goodId)) {
        buyMultiplier = 0.6;
        sellMultiplier = 0.3; // They don't want to buy back what they make
    }
    // Station consumes this good -> buys at premium (player sells high)
    else if (station.consumes.includes(goodId)) {
        buyMultiplier = 1.4;   // More expensive to buy here (high demand)
        sellMultiplier = 1.2;  // Player gets premium for bringing what they need
    }

    // Apply dynamic supply/demand modifier
    const supplyMod = getSupplyModifier(goodId, sectorId);
    buyMultiplier *= supplyMod;
    sellMultiplier *= supplyMod;

    return {
        buy: Math.floor(good.basePrice * buyMultiplier),
        sell: Math.floor(good.basePrice * sellMultiplier),
    };
}

/**
 * Get the best trade route profit for a good from source to any destination
 */
export function getBestTradeRoute(goodId, sourceSectorId) {
    const sourcePrice = getStationPrice(goodId, sourceSectorId);
    let bestProfit = 0;
    let bestDest = null;

    for (const [sectorId, station] of Object.entries(STATION_SPECIALTIES)) {
        if (sectorId === sourceSectorId) continue;
        const destPrice = getStationPrice(goodId, sectorId);
        const profit = destPrice.sell - sourcePrice.buy;
        if (profit > bestProfit) {
            bestProfit = profit;
            bestDest = sectorId;
        }
    }

    return { profit: bestProfit, destination: bestDest };
}
