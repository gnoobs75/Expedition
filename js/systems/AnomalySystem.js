// =============================================
// Anomaly System
// Manages anomaly spawning, wave progression, and rewards
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { Anomaly, ANOMALY_TYPES } from '../entities/Anomaly.js';
import { LootContainer } from '../entities/LootContainer.js';

// Difficulty-to-danger mapping (matches IntelSystem convention)
const DANGER_LEVELS = {
    tutorial: 0,
    hub: 0,
    safe: 0.15,
    normal: 0.4,
    dangerous: 0.7,
    deadly: 1.0,
};

// Anomaly type weights by difficulty tier
const TYPE_WEIGHTS = {
    tutorial:  { combatSite: 0,    dataSite: 0.40, gasPocket: 0.40, relicSite: 0.20 },
    hub:       { combatSite: 0,    dataSite: 0.40, gasPocket: 0.40, relicSite: 0.20 },
    safe:      { combatSite: 0.20, dataSite: 0.30, gasPocket: 0.25, relicSite: 0.25 },
    normal:    { combatSite: 0.35, dataSite: 0.25, gasPocket: 0.20, relicSite: 0.20 },
    dangerous: { combatSite: 0.40, dataSite: 0.20, gasPocket: 0.20, relicSite: 0.20 },
    deadly:    { combatSite: 0.50, dataSite: 0.15, gasPocket: 0.15, relicSite: 0.20 },
};

// Wave definitions: each tier defines how many waves and composition per wave
const WAVE_TEMPLATES = {
    easy: {
        waves: [
            { count: 2, enemyType: 'pirate-frigate', delay: 0 },
            { count: 3, enemyType: 'pirate-frigate', delay: 8 },
        ],
        bountyMultiplier: 1.0,
        lootMultiplier: 1.0,
    },
    normal: {
        waves: [
            { count: 3, enemyType: 'pirate-frigate', delay: 0 },
            { count: 2, enemyType: 'pirate-frigate', delay: 6 },
            { count: 2, enemyType: 'pirate-cruiser', delay: 8 },
        ],
        bountyMultiplier: 1.5,
        lootMultiplier: 1.5,
    },
    hard: {
        waves: [
            { count: 3, enemyType: 'pirate-frigate', delay: 0 },
            { count: 3, enemyType: 'pirate-cruiser', delay: 5 },
            { count: 2, enemyType: 'pirate-cruiser', delay: 6 },
            { count: 1, enemyType: 'pirate-cruiser', delay: 8 },
        ],
        bountyMultiplier: 2.5,
        lootMultiplier: 2.5,
    },
    elite: {
        waves: [
            { count: 4, enemyType: 'pirate-frigate', delay: 0 },
            { count: 3, enemyType: 'pirate-cruiser', delay: 4 },
            { count: 2, enemyType: 'pirate-cruiser', delay: 5 },
            { count: 3, enemyType: 'pirate-cruiser', delay: 6 },
        ],
        bountyMultiplier: 4.0,
        lootMultiplier: 4.0,
    },
};

// Salvageable materials from relic sites
const RELIC_MATERIALS = [
    { id: 'ancient-circuits',   name: 'Ancient Circuits',   value: 300,  volumePerUnit: 0.5 },
    { id: 'decayed-alloy',      name: 'Decayed Alloy',      value: 200,  volumePerUnit: 0.8 },
    { id: 'nano-processors',    name: 'Nano Processors',    value: 500,  volumePerUnit: 0.3 },
    { id: 'crystalline-matrix', name: 'Crystalline Matrix',  value: 800,  volumePerUnit: 0.4 },
    { id: 'quantum-fragments',  name: 'Quantum Fragments',  value: 1200, volumePerUnit: 0.2 },
];

// Gas types that can be harvested
const GAS_TYPES = {
    fullerite:       { name: 'Fullerite Gas',       valuePerUnit: 15,  volumePerUnit: 0.3 },
    cytoserocin:     { name: 'Cytoserocin Gas',     valuePerUnit: 30,  volumePerUnit: 0.25 },
    mykoserocin:     { name: 'Mykoserocin Gas',     valuePerUnit: 50,  volumePerUnit: 0.2 },
};

export class AnomalySystem {
    constructor(game) {
        this.game = game;
        this.destroyed = false;

        // Periodic check timer for spawning new anomalies
        this.spawnTimer = 0;
        this.spawnInterval = 60; // Check every 60 seconds

        // Active anomalies tracked per sector
        this.activeAnomalies = new Map(); // sectorId -> [anomaly refs]

        // Completed site IDs - prevents double-rewarding
        this.completedSites = new Set();

        // Wave tracking for combat anomalies
        // anomalyId -> { anomaly, currentWave, template, spawnedEnemies: Set, enemiesRemaining, waveTimer, waveDelay, allWavesDone }
        this.activeWaves = new Map();

        // Relic salvage operations in progress
        // anomalyId -> { anomaly, ship, timer, duration, materialReward }
        this.activeSalvages = new Map();

        // Gas harvest state (light bookkeeping; actual mining is tick-based)
        // anomalyId -> { anomaly, lastHarvester }
        this.activeGasHarvests = new Map();

        // ---- Event subscriptions ----
        game.events.on('entity:destroyed', (entity) => { if (!this.destroyed) this.onEntityDestroyed(entity); });
        game.events.on('sector:change', (sectorId) => { if (!this.destroyed) this.onSectorChange(sectorId); });
    }

    destroy() {
        this.destroyed = true;
    }

    // =========================================================
    //  Main update loop - called from Game.js update(dt)
    // =========================================================
    update(dt) {
        if (!this.game.currentSector) return;

        // ---- Timer-based periodic spawn check ----
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.checkSpawnAnomalies();
        }

        // ---- Update active combat waves ----
        this.updateWaves(dt);

        // ---- Update relic salvage operations ----
        this.updateSalvages(dt);
    }

    // =========================================================
    //  Sector change handler
    // =========================================================
    onSectorChange(sectorId) {
        // Clear transient tracking from previous sector
        this.activeWaves.clear();
        this.activeSalvages.clear();
        this.activeGasHarvests.clear();

        // Ensure anomalies list for new sector
        if (!this.activeAnomalies.has(sectorId)) {
            this.activeAnomalies.set(sectorId, []);
        }

        // Try to spawn fresh anomalies if sector is under-populated
        this.checkSpawnAnomalies();
    }

    // =========================================================
    //  Spawn anomalies for the current sector
    // =========================================================
    checkSpawnAnomalies() {
        const sector = this.game.currentSector;
        if (!sector) return;

        const sectorId = sector.id;
        const difficulty = sector.difficulty || 'normal';
        const dangerLevel = DANGER_LEVELS[difficulty] || 0;

        // Count existing anomalies in the sector
        const existingCount = sector.entities.filter(e => e.type === 'anomaly' && e.alive).length;

        // Desired anomaly count scales with danger
        const maxAnomalies = this.getMaxAnomalies(difficulty);

        if (existingCount >= maxAnomalies) return;

        // Spawn enough to fill up to max
        const toSpawn = maxAnomalies - existingCount;
        for (let i = 0; i < toSpawn; i++) {
            if (Math.random() < 0.5) { // 50% chance per slot to avoid instant fill
                this.spawnAnomaly(sector, difficulty, dangerLevel);
            }
        }
    }

    /**
     * Determine maximum anomaly count for a difficulty tier
     */
    getMaxAnomalies(difficulty) {
        switch (difficulty) {
            case 'tutorial':  return 1;
            case 'hub':       return 1;
            case 'safe':      return 2;
            case 'normal':    return 3;
            case 'dangerous': return 4;
            case 'deadly':    return 5;
            default:          return 2;
        }
    }

    /**
     * Spawn a single anomaly in the given sector
     */
    spawnAnomaly(sector, difficulty, dangerLevel) {
        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        // Pick type using weighted random based on difficulty
        const weights = TYPE_WEIGHTS[difficulty] || TYPE_WEIGHTS.normal;
        const anomalyType = this.weightedRandom(weights);

        // Position: random angle, 5000-13000 from center (avoid station/planet)
        const angle = Math.random() * Math.PI * 2;
        const dist = 5000 + Math.random() * 8000;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;

        // Clamp inside sector bounds with margin
        const margin = 500;
        const clampedX = Math.max(margin, Math.min(CONFIG.SECTOR_SIZE - margin, x));
        const clampedY = Math.max(margin, Math.min(CONFIG.SECTOR_SIZE - margin, y));

        // Build options based on type
        const options = {
            x: clampedX,
            y: clampedY,
            anomalyType: anomalyType === 'relicSite' ? 'dataSite' : anomalyType,
        };

        // ---- Combat site specifics ----
        if (anomalyType === 'combatSite') {
            const tier = this.getCombatTier(dangerLevel);
            const template = WAVE_TEMPLATES[tier];
            options.enemyCount = template.waves.reduce((sum, w) => sum + w.count, 0);
            options.enemyTier = tier;
            options.lootCredits = Math.floor((500 + dangerLevel * 2000) * template.lootMultiplier);
            options.name = this.generateCombatSiteName(tier);
        }

        // ---- Data site specifics ----
        if (anomalyType === 'dataSite') {
            options.dataCredits = Math.floor(500 + dangerLevel * 3000);
            options.hackDifficulty = 0.3 + dangerLevel * 0.5;
            options.name = this.generateDataSiteName(dangerLevel);
        }

        // ---- Relic site (uses dataSite entity type with custom flag) ----
        if (anomalyType === 'relicSite') {
            options.dataCredits = 0; // Relic sites give materials, not credits
            options.hackDifficulty = 0.4 + dangerLevel * 0.4;
            options.name = this.generateRelicSiteName(dangerLevel);
        }

        // ---- Gas pocket specifics ----
        if (anomalyType === 'gasPocket') {
            const gasKeys = Object.keys(GAS_TYPES);
            const gasIdx = Math.min(
                Math.floor(dangerLevel * gasKeys.length + Math.random()),
                gasKeys.length - 1
            );
            options.gasType = gasKeys[gasIdx];
            options.gasAmount = Math.floor(50 + dangerLevel * 150 + Math.random() * 100);
            options.name = `${GAS_TYPES[options.gasType].name} Cloud`;
        }

        // Create the anomaly entity
        const anomaly = new Anomaly(this.game, options);

        // Tag relic sites with a custom flag for identification
        if (anomalyType === 'relicSite') {
            anomaly._isRelicSite = true;
            anomaly._relicTier = dangerLevel;
        }

        // Tag combat sites with their wave tier for later activation
        if (anomalyType === 'combatSite') {
            anomaly._waveTier = this.getCombatTier(dangerLevel);
        }

        // Add to sector
        sector.addEntity(anomaly);

        // Track in our active list
        if (!this.activeAnomalies.has(sector.id)) {
            this.activeAnomalies.set(sector.id, []);
        }
        this.activeAnomalies.get(sector.id).push(anomaly);

        // Notify
        this.game.ui?.log(`New signal detected: ${anomaly.name}`, 'system');

        return anomaly;
    }

    // =========================================================
    //  Combat site wave management
    // =========================================================

    /**
     * Activate a combat site - begin wave 1
     * Called when a player interacts with a combat anomaly
     */
    activateCombatSite(anomaly) {
        if (!anomaly || anomaly.anomalyType !== 'combatSite') return;
        if (this.activeWaves.has(anomaly.id)) return; // Already active
        if (this.completedSites.has(anomaly.id)) return; // Already completed

        const tier = anomaly._waveTier || 'normal';
        const template = WAVE_TEMPLATES[tier];
        if (!template) return;

        const waveState = {
            anomaly,
            currentWave: 0,
            template,
            spawnedEnemies: new Set(),
            enemiesRemaining: 0,
            waveTimer: 0,
            waveDelay: 0, // First wave spawns immediately
            waitingForNextWave: false,
            allWavesDone: false,
        };

        this.activeWaves.set(anomaly.id, waveState);

        // Spawn the first wave
        this.spawnNextWave(waveState);

        this.game.ui?.showToast(`Combat site activated! Wave 1/${template.waves.length}`, 'danger');
        this.game.audio?.play('warning');
    }

    /**
     * Spawn the next wave of enemies for a combat site
     */
    spawnNextWave(waveState) {
        const { anomaly, template } = waveState;
        const waveIdx = waveState.currentWave;

        if (waveIdx >= template.waves.length) {
            // All waves done
            waveState.allWavesDone = true;
            return;
        }

        const waveConfig = template.waves[waveIdx];
        const enemyCount = waveConfig.count;
        const enemyType = waveConfig.enemyType || 'pirate-frigate';

        const EnemyShipClass = this.game._EnemyShipClass;
        if (!EnemyShipClass) {
            console.warn('AnomalySystem: _EnemyShipClass not available');
            return;
        }

        for (let i = 0; i < enemyCount; i++) {
            const angle = (i / enemyCount) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 200 + Math.random() * 400;
            const ex = anomaly.x + Math.cos(angle) * dist;
            const ey = anomaly.y + Math.sin(angle) * dist;

            const bountyBase = enemyType === 'pirate-cruiser' ? 2000 : 500;
            const bounty = Math.floor(bountyBase * template.bountyMultiplier);

            const enemy = new EnemyShipClass(this.game, {
                x: ex,
                y: ey,
                enemyType,
                bounty,
            });
            enemy.name = `Site Guardian ${waveIdx + 1}-${i + 1}`;

            // Tag enemy so we can track kills for wave progress
            enemy._anomalyId = anomaly.id;
            enemy._waveIndex = waveIdx;

            // Set aggressive AI toward player
            const player = this.game.player;
            if (player?.alive) {
                enemy.setAIState('chase', player);
                enemy.aggroRange = 3000; // Wide aggro range for site defenders
            }

            this.game.currentSector.addEntity(enemy);
            waveState.spawnedEnemies.add(enemy.id);
        }

        waveState.enemiesRemaining = enemyCount;
        waveState.waitingForNextWave = false;

        // Notify wave number (skip for wave 1, already announced)
        if (waveIdx > 0) {
            const totalWaves = template.waves.length;
            this.game.ui?.showToast(
                `Wave ${waveIdx + 1}/${totalWaves} incoming!`, 'danger'
            );
            this.game.audio?.play('warning');
        }
    }

    /**
     * Update all active combat wave states
     */
    updateWaves(dt) {
        for (const [anomalyId, waveState] of this.activeWaves) {
            // Check if anomaly is still alive
            if (!waveState.anomaly.alive) {
                this.activeWaves.delete(anomalyId);
                continue;
            }

            // If waiting for next wave, tick the delay timer
            if (waveState.waitingForNextWave) {
                waveState.waveTimer += dt;
                if (waveState.waveTimer >= waveState.waveDelay) {
                    waveState.waveTimer = 0;
                    waveState.currentWave++;
                    this.spawnNextWave(waveState);
                }
                continue;
            }

            // If all waves are done and no enemies remain, award completion
            if (waveState.allWavesDone && waveState.enemiesRemaining <= 0) {
                this.onCombatSiteComplete(waveState);
                this.activeWaves.delete(anomalyId);
            }
        }
    }

    /**
     * Handle entity destruction - check if it was a wave enemy
     */
    onEntityDestroyed(entity) {
        if (!entity || entity.type !== 'enemy') return;

        const anomalyId = entity._anomalyId;
        if (anomalyId === undefined || anomalyId === null) return;

        const waveState = this.activeWaves.get(anomalyId);
        if (!waveState) return;

        // Verify this entity belongs to the tracked set
        if (!waveState.spawnedEnemies.has(entity.id)) return;

        waveState.spawnedEnemies.delete(entity.id);
        waveState.enemiesRemaining = Math.max(0, waveState.enemiesRemaining - 1);

        // Check if current wave is cleared
        if (waveState.enemiesRemaining <= 0 && !waveState.allWavesDone) {
            const { template } = waveState;
            const nextWaveIdx = waveState.currentWave + 1;

            this.game.events.emit('anomaly:wave-cleared', {
                anomaly: waveState.anomaly,
                wave: waveState.currentWave + 1,
                totalWaves: template.waves.length,
            });

            if (nextWaveIdx < template.waves.length) {
                // Queue next wave after delay
                const nextConfig = template.waves[nextWaveIdx];
                waveState.waveDelay = nextConfig.delay || 5;
                waveState.waveTimer = 0;
                waveState.waitingForNextWave = true;

                this.game.ui?.showToast(
                    `Wave cleared! Next wave in ${Math.round(waveState.waveDelay)}s...`, 'success'
                );
            } else {
                // Final wave cleared
                waveState.allWavesDone = true;
            }
        }
    }

    /**
     * Award rewards when all combat waves are cleared
     */
    onCombatSiteComplete(waveState) {
        const { anomaly, template } = waveState;

        if (this.completedSites.has(anomaly.id)) return;
        this.completedSites.add(anomaly.id);

        // Calculate total loot
        const baseCredits = anomaly.lootCredits || 1000;
        const totalCredits = Math.floor(baseCredits * (1 + Math.random() * 0.3));

        // Build loot container contents
        const lootOptions = {
            x: anomaly.x + (Math.random() - 0.5) * 100,
            y: anomaly.y + (Math.random() - 0.5) * 100,
            name: 'Combat Site Salvage',
            credits: totalCredits,
            lifetime: 600, // 10 minutes to pick up
        };

        // Chance for bonus trade goods at higher tiers
        const tierRoll = Math.random();
        if (template.lootMultiplier >= 2.0 && tierRoll < 0.6) {
            const mat = RELIC_MATERIALS[Math.floor(Math.random() * RELIC_MATERIALS.length)];
            lootOptions.tradeGoods = {
                [mat.id]: { quantity: 1 + Math.floor(Math.random() * 3), volumePerUnit: mat.volumePerUnit },
            };
        }

        const lootContainer = new LootContainer(this.game, lootOptions);
        this.game.currentSector.addEntity(lootContainer);

        // Visual effects at anomaly position
        this.game.renderer?.effects?.spawn('loot', anomaly.x, anomaly.y);
        this.game.renderer?.effects?.spawn('quest-complete', anomaly.x, anomaly.y);

        // Notifications
        this.game.ui?.showToast(
            `Combat site cleared! Salvage dropped: ${totalCredits} ISK`, 'success'
        );
        this.game.ui?.log(`Combat site "${anomaly.name}" cleared - ${totalCredits} ISK in salvage`, 'combat');
        this.game.audio?.play('quest-complete');

        // Stats tracking
        if (this.game.stats) {
            this.game.stats.anomaliesCompleted = (this.game.stats.anomaliesCompleted || 0) + 1;
        }

        // Emit completion event
        this.game.events.emit('anomaly:completed', {
            anomaly,
            type: 'combatSite',
            reward: totalCredits,
        });

        // Mark anomaly as cleared and start despawn
        anomaly.cleared = true;
        anomaly.lifetime = anomaly.age + 15; // Despawn in 15s
    }

    // =========================================================
    //  Data site hacking completion
    // =========================================================

    /**
     * Called when a data site hack is completed (from hacking minigame or direct interaction)
     */
    onHackComplete(anomaly) {
        if (!anomaly || anomaly.hacked) return;
        if (this.completedSites.has(anomaly.id)) return;

        this.completedSites.add(anomaly.id);
        anomaly.hacked = true;

        let rewardText;

        if (anomaly._isRelicSite) {
            // Relic site - award materials instead of credits
            this.awardRelicHackReward(anomaly);
            rewardText = 'Relic data decrypted - salvage materials acquired!';
        } else {
            // Standard data site - credits already awarded by Anomaly.hackDataSite()
            rewardText = `Data extraction complete`;
        }

        // Stats
        if (this.game.stats) {
            this.game.stats.anomaliesCompleted = (this.game.stats.anomaliesCompleted || 0) + 1;
        }

        // Event
        this.game.events.emit('anomaly:completed', {
            anomaly,
            type: anomaly._isRelicSite ? 'relicSite' : 'dataSite',
            reward: anomaly.dataCredits || 0,
        });
    }

    /**
     * Award materials for completing a relic site hack
     */
    awardRelicHackReward(anomaly) {
        const tier = anomaly._relicTier || 0.3;

        // Pick 1-3 material types based on tier
        const numMaterials = 1 + Math.floor(tier * 2 + Math.random());
        const shuffled = [...RELIC_MATERIALS].sort(() => Math.random() - 0.5);
        const chosen = shuffled.slice(0, Math.min(numMaterials, RELIC_MATERIALS.length));

        // Higher tier = rarer materials available
        const highTierIdx = Math.floor(tier * RELIC_MATERIALS.length);
        if (highTierIdx >= 2 && Math.random() < tier) {
            chosen.push(RELIC_MATERIALS[Math.min(highTierIdx, RELIC_MATERIALS.length - 1)]);
        }

        // Create loot container with materials
        const tradeGoods = {};
        let totalValue = 0;

        for (const mat of chosen) {
            const qty = 1 + Math.floor(Math.random() * (2 + tier * 3));
            tradeGoods[mat.id] = { quantity: qty, volumePerUnit: mat.volumePerUnit };
            totalValue += qty * mat.value;
        }

        const lootContainer = new LootContainer(this.game, {
            x: anomaly.x + (Math.random() - 0.5) * 80,
            y: anomaly.y + (Math.random() - 0.5) * 80,
            name: 'Relic Salvage',
            credits: Math.floor(totalValue * 0.1), // Small credit bonus
            tradeGoods,
            lifetime: 600,
        });

        this.game.currentSector.addEntity(lootContainer);

        // Effects
        this.game.renderer?.effects?.spawn('loot', anomaly.x, anomaly.y);
        this.game.audio?.play('loot-pickup');

        this.game.ui?.showToast(
            `Relic salvage recovered! ~${totalValue} ISK in materials`, 'success'
        );
        this.game.ui?.log(`Recovered relic materials worth ~${totalValue} ISK`, 'loot');
    }

    // =========================================================
    //  Relic site salvage operation (timed channel)
    // =========================================================

    /**
     * Start a timed salvage operation on a relic site
     * @param {Anomaly} anomaly - The relic anomaly
     * @param {Ship} ship - The ship performing salvage
     * @returns {boolean} True if salvage started
     */
    startRelicSalvage(anomaly, ship) {
        if (!anomaly || !ship) return false;
        if (!anomaly._isRelicSite) return false;
        if (anomaly.hacked) return false;
        if (this.activeSalvages.has(anomaly.id)) return false;

        // Range check
        const dist = anomaly.distanceTo(ship);
        const salvageRange = 250;
        if (dist > salvageRange) {
            this.game.ui?.showToast('Move closer to salvage the relic site', 'warning');
            return false;
        }

        const tier = anomaly._relicTier || 0.3;
        const duration = 8 + tier * 6; // 8-14 seconds based on tier

        this.activeSalvages.set(anomaly.id, {
            anomaly,
            ship,
            timer: 0,
            duration,
            startTime: Date.now(),
        });

        this.game.ui?.showToast(`Salvage operation started (${Math.round(duration)}s)...`, 'system');
        this.game.ui?.log('Analyzing relic structure...', 'system');
        this.game.audio?.play('scan-complete');

        return true;
    }

    /**
     * Update active salvage operations
     */
    updateSalvages(dt) {
        for (const [anomalyId, salvage] of this.activeSalvages) {
            const { anomaly, ship, duration } = salvage;

            // Abort if ship died or moved out of range
            if (!ship.alive || !anomaly.alive) {
                this.activeSalvages.delete(anomalyId);
                this.game.ui?.showToast('Salvage interrupted!', 'warning');
                continue;
            }

            const dist = anomaly.distanceTo(ship);
            if (dist > 350) { // Slight grace margin over start range
                this.activeSalvages.delete(anomalyId);
                this.game.ui?.showToast('Salvage interrupted - too far from site', 'warning');
                continue;
            }

            salvage.timer += dt;

            // Progress notification at halfway
            if (salvage.timer >= duration * 0.5 && !salvage._halfNotified) {
                salvage._halfNotified = true;
                this.game.ui?.showToast('Salvage 50% complete...', 'system');
            }

            // Completion
            if (salvage.timer >= duration) {
                this.activeSalvages.delete(anomalyId);
                this.onHackComplete(anomaly);
            }
        }
    }

    // =========================================================
    //  Gas cloud harvesting
    // =========================================================

    /**
     * Harvest gas from a gas pocket anomaly (called per tick from MiningSystem or direct)
     * @param {Anomaly} anomaly - The gas pocket anomaly
     * @param {Ship} ship - The harvesting ship
     * @param {number} dt - Delta time
     * @returns {number} Amount harvested this tick
     */
    harvestGas(anomaly, ship, dt) {
        if (!anomaly || anomaly.anomalyType !== 'gasPocket') return 0;
        if (!ship?.alive || !anomaly.alive) return 0;

        const gasType = anomaly.gasType || 'fullerite';
        const gasInfo = GAS_TYPES[gasType] || GAS_TYPES.fullerite;

        // Harvest rate: ~5 units per second base
        const harvestRate = 5;
        const harvested = harvestRate * dt;

        if (anomaly.gasAmount <= 0) {
            // Depleted
            this.onGasDepleted(anomaly);
            return 0;
        }

        // Clamp to available gas
        const actual = Math.min(harvested, anomaly.gasAmount);
        anomaly.gasAmount -= actual;

        // Add to ship cargo as trade good
        const added = ship.addTradeGood(gasType, Math.floor(actual), gasInfo.volumePerUnit);

        // Track for later reference
        this.activeGasHarvests.set(anomaly.id, { anomaly, lastHarvester: ship });

        // Check depletion
        if (anomaly.gasAmount <= 0) {
            this.onGasDepleted(anomaly);
        }

        return added;
    }

    /**
     * Handle gas pocket depletion
     */
    onGasDepleted(anomaly) {
        if (this.completedSites.has(anomaly.id)) return;
        this.completedSites.add(anomaly.id);

        this.game.ui?.showToast('Gas cloud depleted', 'system');
        this.game.ui?.log(`Gas pocket "${anomaly.name}" depleted`, 'mining');

        // Stats
        if (this.game.stats) {
            this.game.stats.anomaliesCompleted = (this.game.stats.anomaliesCompleted || 0) + 1;
        }

        this.game.events.emit('anomaly:completed', {
            anomaly,
            type: 'gasPocket',
        });

        // Despawn after brief delay
        anomaly.lifetime = anomaly.age + 10;
    }

    // =========================================================
    //  Name generators
    // =========================================================

    generateCombatSiteName(tier) {
        const prefixes = {
            easy:   ['Minor', 'Small', 'Scout'],
            normal: ['Pirate', 'Rogue', 'Bandit'],
            hard:   ['Fortified', 'Stronghold', 'Hidden'],
            elite:  ['Dread', 'Warlord', 'Abyssal'],
        };
        const suffixes = ['Hideout', 'Encampment', 'Base', 'Outpost', 'Den', 'Lair'];
        const prefix = prefixes[tier] || prefixes.normal;
        return `${prefix[Math.floor(Math.random() * prefix.length)]} ${
            suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }

    generateDataSiteName(dangerLevel) {
        const names = [
            'Abandoned Relay Station', 'Encrypted Data Cache', 'Derelict Communications Hub',
            'Ghost Signal Beacon', 'Corrupted Data Node', 'Forgotten Server Array',
            'Decryption Outpost', 'Signal Anomaly Alpha', 'Phantom Transmitter',
        ];
        return names[Math.floor(Math.random() * names.length)];
    }

    generateRelicSiteName(dangerLevel) {
        const names = [
            'Ancient Wreckage', 'Forgotten Debris Field', 'Derelict Hull Fragment',
            'Ruined Habitat Module', 'Salvageable Wreck', 'Lost Expedition Remains',
            'Abandoned Mining Rig', 'Decayed Station Fragment', 'Archaic Artifact Site',
        ];
        return names[Math.floor(Math.random() * names.length)];
    }

    // =========================================================
    //  Utility methods
    // =========================================================

    /**
     * Map danger level to combat wave tier
     */
    getCombatTier(dangerLevel) {
        if (dangerLevel >= 0.8) return 'elite';
        if (dangerLevel >= 0.55) return 'hard';
        if (dangerLevel >= 0.25) return 'normal';
        return 'easy';
    }

    /**
     * Weighted random selection from an object of { key: weight }
     */
    weightedRandom(weights) {
        const entries = Object.entries(weights);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        let roll = Math.random() * total;

        for (const [key, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return key;
        }

        // Fallback to last entry
        return entries[entries.length - 1][0];
    }

    /**
     * Get wave progress for a combat anomaly (for UI display)
     * @returns {object|null} { currentWave, totalWaves, enemiesRemaining, waitingForNextWave, waveDelay, waveTimer }
     */
    getWaveProgress(anomalyId) {
        const waveState = this.activeWaves.get(anomalyId);
        if (!waveState) return null;

        return {
            currentWave: waveState.currentWave + 1,
            totalWaves: waveState.template.waves.length,
            enemiesRemaining: waveState.enemiesRemaining,
            waitingForNextWave: waveState.waitingForNextWave,
            waveDelay: waveState.waveDelay,
            waveTimer: waveState.waveTimer,
            allWavesDone: waveState.allWavesDone,
        };
    }

    /**
     * Get salvage progress for a relic site (for UI display)
     * @returns {object|null} { progress (0-1), duration, remaining }
     */
    getSalvageProgress(anomalyId) {
        const salvage = this.activeSalvages.get(anomalyId);
        if (!salvage) return null;

        return {
            progress: salvage.timer / salvage.duration,
            duration: salvage.duration,
            remaining: salvage.duration - salvage.timer,
        };
    }

    /**
     * Check if an anomaly is an active combat site with waves
     */
    isCombatSiteActive(anomalyId) {
        return this.activeWaves.has(anomalyId);
    }

    /**
     * Check if a site has already been completed
     */
    isSiteCompleted(anomalyId) {
        return this.completedSites.has(anomalyId);
    }

    /**
     * Get all active anomalies in the current sector
     */
    getCurrentSectorAnomalies() {
        const sector = this.game.currentSector;
        if (!sector) return [];
        return sector.entities.filter(e => e.type === 'anomaly' && e.alive);
    }

    // =========================================================
    //  Save / Load
    // =========================================================

    saveState() {
        return {
            completedSites: Array.from(this.completedSites),
            spawnTimer: this.spawnTimer,
            // Active waves are transient (tied to current sector entities) and not persisted;
            // the sector will regenerate anomalies on load if needed.
            // We save per-sector anomaly counts to prevent over-spawning
            sectorAnomalyCounts: this.getSectorAnomalyCounts(),
        };
    }

    loadState(data) {
        if (!data) return;

        if (data.completedSites) {
            this.completedSites = new Set(data.completedSites);
        }
        if (typeof data.spawnTimer === 'number') {
            this.spawnTimer = data.spawnTimer;
        }
    }

    /**
     * Get a snapshot of anomaly counts per sector (for save data)
     */
    getSectorAnomalyCounts() {
        const counts = {};
        for (const [sectorId, anomalies] of this.activeAnomalies) {
            counts[sectorId] = anomalies.filter(a => a.alive).length;
        }
        return counts;
    }

    /**
     * Clean up references to dead anomalies from tracking maps
     * Called periodically or on sector change to prevent memory leaks
     */
    cleanup() {
        // Clean active anomalies list
        for (const [sectorId, anomalies] of this.activeAnomalies) {
            const alive = anomalies.filter(a => a.alive);
            if (alive.length === 0) {
                this.activeAnomalies.delete(sectorId);
            } else {
                this.activeAnomalies.set(sectorId, alive);
            }
        }

        // Clean completed sites older than threshold (prevent unbounded growth)
        // We keep a max of 200 entries
        if (this.completedSites.size > 200) {
            const arr = Array.from(this.completedSites);
            const excess = arr.length - 100;
            for (let i = 0; i < excess; i++) {
                this.completedSites.delete(arr[i]);
            }
        }
    }
}
