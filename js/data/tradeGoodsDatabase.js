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
    // === TIER 3 - RUHAR SECTORS ===
    'ruhar-prime': {
        name: 'Ruhar Prime',
        specialty: 'agriculture',
        produces: ['luxury-food', 'bio-cultures', 'organic-compounds', 'hydroponic-nutrients'],
        consumes: ['mining-equipment', 'consumer-electronics', 'hull-plating', 'sensor-arrays'],
        description: 'Ruhar homeworld - lush agricultural output, imports industrial goods',
    },
    'ruhar-haven': {
        name: 'Burrow Haven',
        specialty: 'mining',
        produces: ['refined-minerals', 'crystal-composites', 'industrial-alloys', 'heavy-metals'],
        consumes: ['luxury-food', 'medical-supplies', 'agri-drones', 'water-purifiers'],
        description: 'Ruhar mining colony - deep underground extraction operations',
    },
    'ruhar-market': {
        name: 'Hamster Market',
        specialty: 'trade-hub',
        produces: ['trade-licenses', 'navigation-charts', 'consumer-electronics', 'exotic-textiles'],
        consumes: ['refined-minerals', 'weapon-components', 'hull-plating', 'bio-cultures'],
        description: 'Ruhar trade nexus - bustling bazaar connecting multiple supply chains',
    },
    // === TIER 3 - KRISTANG SECTORS ===
    'kristang-hold': {
        name: 'Kristang Hold',
        specialty: 'military',
        produces: ['weapon-components', 'hull-plating', 'combat-stimulants', 'heavy-metals'],
        consumes: ['refined-minerals', 'industrial-alloys', 'medical-supplies', 'luxury-food'],
        description: 'Kristang fortress - war production and weapons manufacturing',
    },
    'kristang-arena': {
        name: 'Blood Arena',
        specialty: 'military',
        produces: ['contraband-weapons', 'combat-stimulants', 'encryption-keys', 'stolen-cargo'],
        consumes: ['medical-supplies', 'hull-plating', 'weapon-components', 'heavy-metals'],
        description: 'Kristang gladiatorial outpost - combat training and black market arms dealing',
    },
    'kristang-forge': {
        name: 'War Forge',
        specialty: 'mining-refinery',
        produces: ['industrial-alloys', 'heavy-metals', 'hull-plating', 'tritanium-ingots'],
        consumes: ['mining-equipment', 'industrial-coolant', 'drone-parts', 'water-purifiers'],
        description: 'Kristang border forge - raw material processing for the war machine',
    },
    // === TIER 3 - KEEPERS ===
    'keepers-enclave': {
        name: 'Keepers Enclave',
        specialty: 'research',
        produces: ['rare-earth-elements', 'experimental-compounds', 'quantum-processors', 'sensor-arrays'],
        consumes: ['navigation-charts', 'bio-cultures', 'nebula-gas-samples', 'superconductors'],
        description: 'Keepers research enclave - ancient knowledge preservation and xenotech study',
    },
    // === TIER 3 - CONTESTED BORDER ===
    'border-alpha': {
        name: 'Contested Alpha',
        specialty: 'military',
        produces: ['weapon-components', 'hull-plating', 'combat-stimulants', 'encryption-keys'],
        consumes: ['medical-supplies', 'refined-minerals', 'industrial-alloys', 'luxury-food'],
        description: 'Contested border zone - active warfront between Ruhar and Kristang forces',
    },
    'border-bravo': {
        name: 'Scorched Plains',
        specialty: 'mining',
        produces: ['refined-minerals', 'heavy-metals', 'industrial-alloys', 'crystal-composites'],
        consumes: ['mining-equipment', 'hull-plating', 'medical-supplies', 'industrial-coolant'],
        description: 'War-scarred mining zone - rich deposits amid battlefield wreckage',
    },
    'border-charlie': {
        name: 'Burning Line',
        specialty: 'military',
        produces: ['hull-plating', 'combat-stimulants', 'weapon-components', 'shield-capacitors'],
        consumes: ['refined-minerals', 'heavy-metals', 'medical-supplies', 'luxury-food'],
        description: 'Frontline fortification - defensive emplacements and supply depots',
    },
    // === TIER 2 - JERAPTHA SECTORS ===
    'jeraptha-prime': {
        name: 'Jeraptha Exchange',
        specialty: 'trade-hub',
        produces: ['trade-licenses', 'navigation-charts', 'consumer-electronics', 'quantum-processors'],
        consumes: ['exotic-textiles', 'luxury-food', 'bio-cultures', 'nebula-gas-samples'],
        description: 'Jeraptha commercial hub - the galaxy\'s most sophisticated exchange market',
    },
    'jeraptha-docks': {
        name: 'Beetle Docks',
        specialty: 'technology',
        produces: ['sensor-arrays', 'shield-capacitors', 'quantum-processors', 'superconductors'],
        consumes: ['refined-minerals', 'crystal-composites', 'industrial-alloys', 'rare-earth-elements'],
        description: 'Jeraptha shipyard complex - advanced technology manufacturing',
    },
    // === TIER 2 - THURANIN SECTORS ===
    'thuranin-prime': {
        name: 'Thuranin Nexus',
        specialty: 'technology',
        produces: ['quantum-processors', 'encryption-keys', 'hacked-firmware', 'sensor-arrays'],
        consumes: ['refined-minerals', 'superconductors', 'rare-earth-elements', 'crystal-composites'],
        description: 'Thuranin tech nexus - cutting-edge weapons research and cyberwarfare',
    },
    'thuranin-labs': {
        name: 'Research Array',
        specialty: 'research',
        produces: ['experimental-compounds', 'superconductors', 'rare-earth-elements', 'nebula-gas-samples'],
        consumes: ['quantum-processors', 'sensor-arrays', 'bio-cultures', 'crystal-composites'],
        description: 'Thuranin research complex - classified experiments and prototype development',
    },
    // === TIER 2 - BOSPHURAQ SECTORS ===
    'bosphuraq-prime': {
        name: 'Bosphuraq Aerie',
        specialty: 'military',
        produces: ['weapon-components', 'combat-stimulants', 'hull-plating', 'contraband-weapons'],
        consumes: ['heavy-metals', 'industrial-alloys', 'refined-minerals', 'medical-supplies'],
        description: 'Bosphuraq war nest - raptor clans produce aggressive combat hardware',
    },
    'bosphuraq-nest': {
        name: 'Raptor Nest',
        specialty: 'military',
        produces: ['hull-plating', 'heavy-metals', 'weapon-components', 'industrial-alloys'],
        consumes: ['luxury-food', 'medical-supplies', 'consumer-electronics', 'bio-cultures'],
        description: 'Bosphuraq breeding grounds - heavily fortified military complex',
    },
    // === TIER 2 - ESSELGIN SECTORS ===
    'esselgin-prime': {
        name: 'Esselgin Nexus',
        specialty: 'research',
        produces: ['experimental-compounds', 'sensor-arrays', 'encryption-keys', 'quantum-processors'],
        consumes: ['refined-minerals', 'bio-cultures', 'nebula-gas-samples', 'crystal-composites'],
        description: 'Esselgin research hub - serpentine intelligence network and covert ops',
    },
    'esselgin-market': {
        name: 'Serpent Bazaar',
        specialty: 'trade-hub',
        produces: ['exotic-textiles', 'trade-licenses', 'forged-documents', 'navigation-charts'],
        consumes: ['luxury-food', 'consumer-electronics', 'weapon-components', 'medical-supplies'],
        description: 'Esselgin trade bazaar - information brokerage and exotic goods exchange',
    },
    // === TIER 2 - WURGALAN SECTORS ===
    'wurgalan-prime': {
        name: 'Wurgalan Depths',
        specialty: 'agriculture',
        produces: ['bio-cultures', 'organic-compounds', 'hydroponic-nutrients', 'luxury-food'],
        consumes: ['sensor-arrays', 'mining-equipment', 'hull-plating', 'quantum-processors'],
        description: 'Wurgalan bioworld - deep-ocean bio-engineering and aquatic farming',
    },
    'wurgalan-reef': {
        name: 'Tentacle Reef',
        specialty: 'mining',
        produces: ['refined-minerals', 'crystal-composites', 'rare-earth-elements', 'industrial-alloys'],
        consumes: ['water-purifiers', 'industrial-coolant', 'drone-parts', 'bio-cultures'],
        description: 'Wurgalan reef colony - coral-based mineral extraction and bio-mining',
    },
    // === TIER 2 - CONTESTED ===
    't2-contested-a': {
        name: 'Shattered Expanse',
        specialty: 'military',
        produces: ['weapon-components', 'hull-plating', 'stolen-cargo', 'combat-stimulants'],
        consumes: ['medical-supplies', 'refined-minerals', 'heavy-metals', 'industrial-alloys'],
        description: 'Coalition war zone - wreckage-strewn battlefield with salvage opportunities',
    },
    't2-contested-b': {
        name: 'Coalition Breach',
        specialty: 'military',
        produces: ['encryption-keys', 'weapon-components', 'combat-stimulants', 'hull-plating'],
        consumes: ['medical-supplies', 'luxury-food', 'quantum-processors', 'shield-capacitors'],
        description: 'Coalition front line - strategic chokepoint between rival powers',
    },
    // === TIER 1 - RINDHALU SECTORS ===
    'rindhalu-prime': {
        name: 'Rindhalu Webway',
        specialty: 'technology',
        produces: ['quantum-processors', 'superconductors', 'experimental-compounds', 'sensor-arrays'],
        consumes: ['rare-earth-elements', 'crystal-composites', 'nebula-gas-samples', 'bio-cultures'],
        description: 'Rindhalu elder hub - unfathomably advanced alien technology',
    },
    'rindhalu-sanctum': {
        name: 'Elder Sanctum',
        specialty: 'research',
        produces: ['rare-earth-elements', 'experimental-compounds', 'superconductors', 'nebula-gas-samples'],
        consumes: ['quantum-processors', 'sensor-arrays', 'bio-cultures', 'organic-compounds'],
        description: 'Rindhalu inner sanctum - ancient research beyond human comprehension',
    },
    // === TIER 1 - MAXOLHX SECTORS ===
    'maxolhx-prime': {
        name: 'Maxolhx Citadel',
        specialty: 'military',
        produces: ['weapon-components', 'hull-plating', 'shield-capacitors', 'encryption-keys'],
        consumes: ['heavy-metals', 'industrial-alloys', 'superconductors', 'quantum-processors'],
        description: 'Maxolhx fortress world - supreme military manufacturing complex',
    },
    'maxolhx-throne': {
        name: 'Apex Throne',
        specialty: 'military',
        produces: ['combat-stimulants', 'contraband-weapons', 'weapon-components', 'hull-plating'],
        consumes: ['refined-minerals', 'heavy-metals', 'rare-earth-elements', 'crystal-composites'],
        description: 'Maxolhx seat of power - the most heavily defended station in the galaxy',
    },
    // === TIER 1 - CONTESTED ===
    't1-contested': {
        name: 'The Crucible',
        specialty: 'military',
        produces: ['weapon-components', 'stolen-cargo', 'combat-stimulants', 'hull-plating'],
        consumes: ['medical-supplies', 'heavy-metals', 'quantum-processors', 'shield-capacitors'],
        description: 'The ultimate battleground - elder races clash for galactic supremacy',
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

// ==================================
// Order Book System
// Buy/sell limit orders per station per good
// ==================================

const _orderBooks = {}; // key: "sectorId:goodId" -> { buyOrders: [], sellOrders: [] }
const _priceHistory = {}; // key: "sectorId:goodId" -> [{price, timestamp, volume}]
let _orderIdCounter = 1;

function getOrderBookKey(sectorId, goodId) {
    return `${sectorId}:${goodId}`;
}

/**
 * Get or create order book for a station+good pair
 */
export function getOrderBook(sectorId, goodId) {
    const key = getOrderBookKey(sectorId, goodId);
    if (!_orderBooks[key]) {
        _orderBooks[key] = { buyOrders: [], sellOrders: [] };
    }
    return _orderBooks[key];
}

/**
 * Place a buy limit order (player wants to buy at this price or lower)
 */
export function placeBuyOrder(sectorId, goodId, price, quantity, playerId = 'player') {
    const book = getOrderBook(sectorId, goodId);
    const order = {
        id: `order_${_orderIdCounter++}`,
        type: 'buy',
        goodId,
        sectorId,
        price,
        quantity,
        filled: 0,
        owner: playerId,
        timestamp: Date.now(),
    };
    book.buyOrders.push(order);
    // Sort buy orders by price descending (highest first = best bid)
    book.buyOrders.sort((a, b) => b.price - a.price);
    return order;
}

/**
 * Place a sell limit order (player wants to sell at this price or higher)
 */
export function placeSellOrder(sectorId, goodId, price, quantity, playerId = 'player') {
    const book = getOrderBook(sectorId, goodId);
    const order = {
        id: `order_${_orderIdCounter++}`,
        type: 'sell',
        goodId,
        sectorId,
        price,
        quantity,
        filled: 0,
        owner: playerId,
        timestamp: Date.now(),
    };
    book.sellOrders.push(order);
    // Sort sell orders by price ascending (lowest first = best ask)
    book.sellOrders.sort((a, b) => a.price - b.price);
    return order;
}

/**
 * Cancel an order by ID
 */
export function cancelOrder(sectorId, goodId, orderId) {
    const book = getOrderBook(sectorId, goodId);
    book.buyOrders = book.buyOrders.filter(o => o.id !== orderId);
    book.sellOrders = book.sellOrders.filter(o => o.id !== orderId);
}

/**
 * Match orders in a book. Returns array of fills: [{buyOrder, sellOrder, price, quantity}]
 */
export function matchOrders(sectorId, goodId) {
    const book = getOrderBook(sectorId, goodId);
    const fills = [];

    while (book.buyOrders.length > 0 && book.sellOrders.length > 0) {
        const bestBuy = book.buyOrders[0];
        const bestSell = book.sellOrders[0];

        // Buy price must be >= sell price for a match
        if (bestBuy.price < bestSell.price) break;

        // Fill at the older order's price (price-time priority)
        const fillPrice = bestBuy.timestamp <= bestSell.timestamp ? bestBuy.price : bestSell.price;
        const buyRemaining = bestBuy.quantity - bestBuy.filled;
        const sellRemaining = bestSell.quantity - bestSell.filled;
        const fillQty = Math.min(buyRemaining, sellRemaining);

        bestBuy.filled += fillQty;
        bestSell.filled += fillQty;

        fills.push({
            buyOrder: bestBuy,
            sellOrder: bestSell,
            price: fillPrice,
            quantity: fillQty,
        });

        // Remove fully filled orders
        if (bestBuy.filled >= bestBuy.quantity) book.buyOrders.shift();
        if (bestSell.filled >= bestSell.quantity) book.sellOrders.shift();
    }

    // Record price history for fills
    if (fills.length > 0) {
        const key = getOrderBookKey(sectorId, goodId);
        if (!_priceHistory[key]) _priceHistory[key] = [];
        for (const fill of fills) {
            _priceHistory[key].push({
                price: fill.price,
                volume: fill.quantity,
                timestamp: Date.now(),
            });
        }
        // Keep last 50 data points
        if (_priceHistory[key].length > 50) {
            _priceHistory[key] = _priceHistory[key].slice(-50);
        }
    }

    return fills;
}

/**
 * Get spread (best bid/ask) for display
 */
export function getSpread(sectorId, goodId) {
    const book = getOrderBook(sectorId, goodId);
    const bestBid = book.buyOrders.length > 0 ? book.buyOrders[0].price : null;
    const bestAsk = book.sellOrders.length > 0 ? book.sellOrders[0].price : null;
    return { bid: bestBid, ask: bestAsk, spread: (bestAsk && bestBid) ? bestAsk - bestBid : null };
}

/**
 * Get price history for a good at a station
 */
export function getPriceHistory(sectorId, goodId) {
    const key = getOrderBookKey(sectorId, goodId);
    return _priceHistory[key] || [];
}

/**
 * Get all player open orders across all stations
 */
export function getPlayerOrders(playerId = 'player') {
    const orders = [];
    for (const [key, book] of Object.entries(_orderBooks)) {
        for (const o of book.buyOrders) {
            if (o.owner === playerId) orders.push(o);
        }
        for (const o of book.sellOrders) {
            if (o.owner === playerId) orders.push(o);
        }
    }
    return orders;
}

/**
 * Seed NPC orders from station supply/demand data
 */
export function seedNPCOrders(sectorId) {
    const specialty = STATION_SPECIALTIES[sectorId];
    if (!specialty) return;

    // Seed sell orders for goods the station produces
    for (const goodId of specialty.produces) {
        const good = TRADE_GOODS[goodId];
        if (!good) continue;
        const book = getOrderBook(sectorId, goodId);
        // Only seed if few NPC orders exist
        const npcSells = book.sellOrders.filter(o => o.owner === 'npc');
        if (npcSells.length < 3) {
            const basePrice = getStationPrice(goodId, sectorId).buy;
            for (let i = 0; i < 3; i++) {
                const price = Math.floor(basePrice * (0.95 + i * 0.05));
                const qty = 5 + Math.floor(Math.random() * 15);
                placeSellOrder(sectorId, goodId, price, qty, 'npc');
            }
        }
    }

    // Seed buy orders for goods the station consumes
    for (const goodId of specialty.consumes) {
        const good = TRADE_GOODS[goodId];
        if (!good) continue;
        const book = getOrderBook(sectorId, goodId);
        const npcBuys = book.buyOrders.filter(o => o.owner === 'npc');
        if (npcBuys.length < 3) {
            const basePrice = getStationPrice(goodId, sectorId).sell;
            for (let i = 0; i < 3; i++) {
                const price = Math.floor(basePrice * (1.05 - i * 0.05));
                const qty = 5 + Math.floor(Math.random() * 15);
                placeBuyOrder(sectorId, goodId, price, qty, 'npc');
            }
        }
    }
}

/**
 * Refresh NPC orders (call periodically ~60s)
 */
export function refreshNPCOrders() {
    for (const sectorId of Object.keys(STATION_SPECIALTIES)) {
        // Clean filled NPC orders
        const keys = Object.keys(_orderBooks).filter(k => k.startsWith(sectorId + ':'));
        for (const key of keys) {
            const book = _orderBooks[key];
            book.buyOrders = book.buyOrders.filter(o => o.owner !== 'npc' || (o.quantity - o.filled) > 0);
            book.sellOrders = book.sellOrders.filter(o => o.owner !== 'npc' || (o.quantity - o.filled) > 0);
        }
        seedNPCOrders(sectorId);
    }
}

/**
 * Save/load order book state
 */
export function getOrderBookState() {
    return {
        orderBooks: JSON.parse(JSON.stringify(_orderBooks)),
        priceHistory: JSON.parse(JSON.stringify(_priceHistory)),
        orderIdCounter: _orderIdCounter,
    };
}

export function loadOrderBookState(data) {
    // Clear
    for (const key of Object.keys(_orderBooks)) delete _orderBooks[key];
    for (const key of Object.keys(_priceHistory)) delete _priceHistory[key];

    if (data) {
        if (data.orderBooks) Object.assign(_orderBooks, data.orderBooks);
        if (data.priceHistory) Object.assign(_priceHistory, data.priceHistory);
        if (data.orderIdCounter) _orderIdCounter = data.orderIdCounter;
    }
}
