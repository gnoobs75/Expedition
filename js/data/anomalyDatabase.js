// =============================================
// Anomaly Database
// Templates for procedurally generated anomalies
// =============================================

// =============================================
// ANOMALY TEMPLATES
// =============================================
// Organized by type and tier (1-4).
// Types: combat, data, relic, gas
//
// combat: Wave-based NPC encounters with loot drops
// data:   Hacking mini-game for blueprint/electronics rewards
// relic:   Timed salvage operation for crafting materials
// gas:    Harvestable gas clouds for specialized resources

export const ANOMALY_TEMPLATES = {

    // =============================================
    // COMBAT ANOMALIES
    // =============================================

    combat: {
        1: {
            name: 'Pirate Hideout',
            description: 'A small pirate encampment. Light resistance expected.',
            waves: [
                { count: 3, tier: 1, delay: 0 },
                { count: 2, tier: 1, delay: 15 },
            ],
            lootTable: [
                { itemId: 'refined-minerals', chance: 0.80, type: 'material' },
                { itemId: 'salvage-components', chance: 0.50, type: 'material' },
                { itemId: 'small-pulse-maser', chance: 0.15, type: 'module' },
                { itemId: 'shield-booster', chance: 0.10, type: 'module' },
            ],
            bountyBase: 500,
        },
        2: {
            name: 'Pirate Outpost',
            description: 'An established pirate outpost with organized defenses.',
            waves: [
                { count: 4, tier: 1, delay: 0 },
                { count: 3, tier: 2, delay: 20 },
                { count: 2, tier: 2, delay: 40 },
            ],
            lootTable: [
                { itemId: 'refined-minerals', chance: 0.90, type: 'material' },
                { itemId: 'salvage-components', chance: 0.70, type: 'material' },
                { itemId: 'electronics', chance: 0.30, type: 'material' },
                { itemId: 'medium-pulse-maser', chance: 0.12, type: 'module' },
                { itemId: 'afterburner-2', chance: 0.08, type: 'module' },
                { itemId: 'bp-shield-booster-2', chance: 0.05, type: 'blueprint' },
            ],
            bountyBase: 1500,
        },
        3: {
            name: 'Pirate Stronghold',
            description: 'A heavily fortified pirate stronghold. Bring backup.',
            waves: [
                { count: 5, tier: 2, delay: 0 },
                { count: 4, tier: 2, delay: 25 },
                { count: 3, tier: 3, delay: 50 },
                { count: 2, tier: 3, delay: 75 },
            ],
            lootTable: [
                { itemId: 'refined-minerals', chance: 1.00, type: 'material' },
                { itemId: 'salvage-components', chance: 0.85, type: 'material' },
                { itemId: 'electronics', chance: 0.55, type: 'material' },
                { itemId: 'rare-alloys', chance: 0.20, type: 'material' },
                { itemId: 'large-beam-maser', chance: 0.10, type: 'module' },
                { itemId: 'damage-control-2', chance: 0.08, type: 'module' },
                { itemId: 'bp-medium-pulse-maser-2', chance: 0.04, type: 'blueprint' },
                { itemId: 'bp-heavy-missile-2', chance: 0.04, type: 'blueprint' },
            ],
            bountyBase: 5000,
        },
        4: {
            name: 'Pirate Command Center',
            description: 'The central hub of a pirate faction. Capital-class defenses detected.',
            waves: [
                { count: 6, tier: 2, delay: 0 },
                { count: 5, tier: 3, delay: 20 },
                { count: 4, tier: 3, delay: 45 },
                { count: 3, tier: 4, delay: 70 },
                { count: 2, tier: 4, delay: 100 },
            ],
            lootTable: [
                { itemId: 'refined-minerals', chance: 1.00, type: 'material' },
                { itemId: 'salvage-components', chance: 1.00, type: 'material' },
                { itemId: 'electronics', chance: 0.80, type: 'material' },
                { itemId: 'rare-alloys', chance: 0.45, type: 'material' },
                { itemId: 'xl-shield-booster', chance: 0.08, type: 'module' },
                { itemId: 'torpedo-launcher', chance: 0.10, type: 'module' },
                { itemId: 'bp-xl-shield-booster', chance: 0.03, type: 'blueprint' },
                { itemId: 'bp-microwarpdrive-2', chance: 0.03, type: 'blueprint' },
                { itemId: 'bp-hurricane', chance: 0.02, type: 'blueprint' },
                { itemId: 'bp-drake', chance: 0.02, type: 'blueprint' },
            ],
            bountyBase: 15000,
        },
    },

    // =============================================
    // DATA ANOMALIES
    // =============================================

    data: {
        1: {
            name: 'Abandoned Relay Station',
            description: 'A decommissioned comm relay. Its databanks may still hold useful schematics.',
            hackDifficulty: 1,
            rewardTable: [
                { itemId: 'electronics', chance: 0.80, type: 'material' },
                { itemId: 'refined-minerals', chance: 0.50, type: 'material' },
                { itemId: 'bp-small-pulse-maser-2', chance: 0.15, type: 'blueprint' },
                { itemId: 'bp-shield-extender', chance: 0.12, type: 'blueprint' },
                { itemId: 'bp-nanofiber', chance: 0.10, type: 'blueprint' },
            ],
        },
        2: {
            name: 'Forgotten Research Lab',
            description: 'A mothballed research facility. Encrypted databases detected.',
            hackDifficulty: 2,
            rewardTable: [
                { itemId: 'electronics', chance: 0.90, type: 'material' },
                { itemId: 'rare-alloys', chance: 0.25, type: 'material' },
                { itemId: 'bp-afterburner-2', chance: 0.12, type: 'blueprint' },
                { itemId: 'bp-damage-mod-2', chance: 0.10, type: 'blueprint' },
                { itemId: 'bp-mining-laser-2', chance: 0.10, type: 'blueprint' },
                { itemId: 'bp-warp-scrambler', chance: 0.08, type: 'blueprint' },
            ],
        },
        3: {
            name: 'Covert Operations Archive',
            description: 'A classified intelligence archive. Military-grade encryption protects its contents.',
            hackDifficulty: 3,
            rewardTable: [
                { itemId: 'electronics', chance: 1.00, type: 'material' },
                { itemId: 'rare-alloys', chance: 0.50, type: 'material' },
                { itemId: 'bp-medium-pulse-maser-2', chance: 0.08, type: 'blueprint' },
                { itemId: 'bp-heavy-missile-2', chance: 0.08, type: 'blueprint' },
                { itemId: 'bp-microwarpdrive', chance: 0.06, type: 'blueprint' },
                { itemId: 'bp-thorax', chance: 0.03, type: 'blueprint' },
                { itemId: 'bp-rifter', chance: 0.05, type: 'blueprint' },
            ],
        },
        4: {
            name: 'Precursor Data Vault',
            description: 'Ancient data stores from a precursor civilization. Extremely advanced encryption.',
            hackDifficulty: 3,
            rewardTable: [
                { itemId: 'electronics', chance: 1.00, type: 'material' },
                { itemId: 'rare-alloys', chance: 0.75, type: 'material' },
                { itemId: 'bp-xl-shield-booster', chance: 0.06, type: 'blueprint' },
                { itemId: 'bp-microwarpdrive-2', chance: 0.06, type: 'blueprint' },
                { itemId: 'bp-damage-control-2', chance: 0.05, type: 'blueprint' },
                { itemId: 'bp-hurricane', chance: 0.03, type: 'blueprint' },
                { itemId: 'bp-drake', chance: 0.03, type: 'blueprint' },
                { itemId: 'bp-thorax', chance: 0.04, type: 'blueprint' },
            ],
        },
    },

    // =============================================
    // RELIC ANOMALIES
    // =============================================

    relic: {
        1: {
            name: 'Derelict Cargo Container',
            description: 'An abandoned cargo pod drifting in space. Salvageable materials inside.',
            salvageTime: 30,
            materialRewards: [
                { materialId: 'refined-minerals', min: 20, max: 50 },
                { materialId: 'salvage-components', min: 5, max: 15 },
            ],
        },
        2: {
            name: 'Destroyed Convoy Wreckage',
            description: 'The remains of a trade convoy. Scattered salvage across a wide debris field.',
            salvageTime: 60,
            materialRewards: [
                { materialId: 'refined-minerals', min: 40, max: 100 },
                { materialId: 'salvage-components', min: 20, max: 50 },
                { materialId: 'electronics', min: 5, max: 15 },
            ],
        },
        3: {
            name: 'Ancient Shipyard Ruins',
            description: 'Remnants of a long-abandoned shipyard. Rare alloys embedded in the hull plating.',
            salvageTime: 120,
            materialRewards: [
                { materialId: 'refined-minerals', min: 80, max: 180 },
                { materialId: 'salvage-components', min: 40, max: 90 },
                { materialId: 'electronics', min: 15, max: 35 },
                { materialId: 'rare-alloys', min: 3, max: 10 },
            ],
        },
        4: {
            name: 'Precursor Artifact Site',
            description: 'An excavation site of precursor technology. Exotic materials of immense value.',
            salvageTime: 180,
            materialRewards: [
                { materialId: 'refined-minerals', min: 150, max: 300 },
                { materialId: 'salvage-components', min: 80, max: 160 },
                { materialId: 'electronics', min: 30, max: 70 },
                { materialId: 'rare-alloys', min: 10, max: 30 },
            ],
        },
    },

    // =============================================
    // GAS ANOMALIES
    // =============================================

    gas: {
        1: {
            name: 'Thin Nebula Pocket',
            description: 'A small pocket of harvestable gas within a nebula formation.',
            gasType: 'cytoserocin',
            baseAmount: 200,
            harvestRate: 10,
        },
        2: {
            name: 'Dense Gas Cloud',
            description: 'A concentrated gas cloud rich in harvestable compounds.',
            gasType: 'fullerite-c50',
            baseAmount: 500,
            harvestRate: 15,
        },
        3: {
            name: 'Volatile Gas Reservoir',
            description: 'A volatile gas reservoir. High value but hazardous to harvest.',
            gasType: 'fullerite-c320',
            baseAmount: 800,
            harvestRate: 20,
        },
        4: {
            name: 'Primordial Gas Vent',
            description: 'A rare primordial gas vent from deep space. Extremely valuable compounds.',
            gasType: 'fullerite-c540',
            baseAmount: 1200,
            harvestRate: 25,
        },
    },
};

// =============================================
// ANOMALY SPAWN CONFIGURATION
// =============================================
// Controls how anomalies appear and respawn in sectors

export const ANOMALY_SPAWN_CONFIG = {
    // Minimum anomalies per sector at generation
    minPerSector: 1,
    // Maximum anomalies per sector at generation
    maxPerSector: 4,
    // Time in seconds before a completed anomaly respawns
    respawnTime: 300,
    // Difficulty scaling: anomaly tier = clamp(1, 4, floor(sectorDifficulty * scaleFactor))
    // sectorDifficulty is typically 1-10, so a factor of 0.4 maps:
    //   difficulty 1-2 -> tier 1, 3-5 -> tier 2, 6-7 -> tier 3, 8-10 -> tier 4
    difficultyScaling: 0.4,
};
