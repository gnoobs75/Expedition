// =============================================
// Intel System
// Manages sector intelligence data, confidence
// decay, probe/scout management
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';

export class IntelSystem {
    constructor(game) {
        this.game = game;

        // Intel data per sector: Map<sectorId, IntelReport>
        // IntelReport: {enemies, friendlies, hazards, events, stations, asteroids, confidence, timestamp, source}
        this.intelData = new Map();

        // Active probes: [{id, sectorId, launchTime, travelTime, returnTime, returned}]
        this.activeProbes = [];
        this.nextProbeId = 1;

        // Confidence decay rate (per second)
        // ~0.12/min -> intel goes stale in ~8 minutes
        this.decayRate = 0.002;

        // Minimum confidence before auto-pruning
        this.pruneThreshold = 0.05;

        // Prune timer (check every 30s)
        this.pruneTimer = 0;
        this.pruneInterval = 30;

        // Current sector always has perfect intel
        this.game.events.on('sector:change', (data) => {
            const sectorId = typeof data === 'string' ? data : data?.sectorId || data?.id;
            if (sectorId) {
                this.gatherCurrentSectorIntel(sectorId);
            }
        });

        // Fleet ships returning can provide scout reports
        this.game.events.on('fleet:ship-returned', (data) => {
            if (data?.sectorId) {
                this.addScoutReport(data.sectorId, 0.75);
            }
        });

        // Load any persisted intel
        this.loadState();
    }

    /**
     * Update intel system each frame
     */
    update(dt) {
        // Decay all intel confidence
        for (const [sectorId, intel] of this.intelData) {
            // Current sector stays at 1.0
            if (sectorId === this.game.currentSector?.id) {
                intel.confidence = 1.0;
                intel.timestamp = Date.now();
                continue;
            }

            // Apply decay
            intel.confidence = Math.max(0, intel.confidence - this.decayRate * dt);
        }

        // Check probe return timers
        const now = Date.now();
        for (let i = this.activeProbes.length - 1; i >= 0; i--) {
            const probe = this.activeProbes[i];
            if (probe.returned) continue;

            if (now >= probe.returnTime) {
                this.processProbeReturn(probe);
                probe.returned = true;

                // Emit event for UI notification
                this.game.events.emit('intel:probe-returned', {
                    probeId: probe.id,
                    sectorId: probe.sectorId,
                });
            }
        }

        // Clean up returned probes
        this.activeProbes = this.activeProbes.filter(p => !p.returned);

        // Periodic prune
        this.pruneTimer += dt;
        if (this.pruneTimer >= this.pruneInterval) {
            this.pruneTimer = 0;
            this.pruneStaleIntel(this.pruneThreshold);
        }
    }

    // =========================================================================
    // Intel Gathering
    // =========================================================================

    /**
     * Gather intel about the current sector (automatic, 1.0 confidence).
     * Called on sector entry.
     */
    gatherCurrentSectorIntel(sectorId) {
        const sector = this.game.currentSector;
        if (!sector) return;

        const entities = this.game.getEntities();

        let enemyCount = 0;
        let friendlyCount = 0;
        let asteroidCount = 0;
        const factions = new Set();

        for (const entity of entities) {
            if (!entity.alive) continue;

            if (entity.hostility === 'hostile' || entity.type === 'enemy') {
                enemyCount++;
            }
            if (entity.hostility === 'friendly' || entity.type === 'fleet') {
                friendlyCount++;
            }
            if (entity.type === 'asteroid') {
                asteroidCount++;
            }
            if (entity.factionName) {
                factions.add(entity.factionName);
            }
        }

        // Check for sector hazards
        const hazards = [];
        const hazardConfig = CONFIG.SECTOR_HAZARDS[sectorId];
        if (hazardConfig) {
            hazards.push({
                type: hazardConfig.type,
                name: hazardConfig.name,
                severity: hazardConfig.damagePerSecond ? 'dangerous' :
                    hazardConfig.capDrainPerSecond ? 'moderate' : 'minor',
            });
        }

        // Check for active sector events
        const events = [];
        if (this.game.sectorEventSystem) {
            const activeEvents = this.game.sectorEventSystem.activeEvents || [];
            for (const evt of activeEvents) {
                if (evt.sectorId === sectorId) {
                    events.push({
                        type: evt.type,
                        name: evt.name || evt.type,
                    });
                }
            }
        }

        // Station info
        const sectorLayout = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        const hasStation = sectorLayout?.hasStation || false;

        this.intelData.set(sectorId, {
            enemies: enemyCount,
            friendlies: friendlyCount,
            factions: [...factions],
            hazards: hazards,
            events: events,
            stations: hasStation ? 1 : 0,
            asteroids: asteroidCount,
            asteroidRichness: this._estimateAsteroidRichness(sectorId),
            confidence: 1.0,
            timestamp: Date.now(),
            source: 'direct',
            sectorName: sectorLayout?.name || sectorId,
            difficulty: sectorLayout?.difficulty || 'normal',
        });

        this.game.events.emit('intel:updated', { sectorId });
    }

    // =========================================================================
    // Probes
    // =========================================================================

    /**
     * Launch a probe to a sector.
     * @param {string} sectorId - Target sector
     * @param {number} travelTime - Seconds until probe returns (default 20)
     * @returns {object|null} - Probe data or null if launch failed
     */
    launchProbe(sectorId, travelTime = 20) {
        if (!sectorId) return null;

        // Validate sector exists
        const sectorLayout = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        if (!sectorLayout) return null;

        // Check if we already have a probe en route to this sector
        const existing = this.activeProbes.find(p => p.sectorId === sectorId && !p.returned);
        if (existing) return null;

        const now = Date.now();
        const probe = {
            id: this.nextProbeId++,
            sectorId: sectorId,
            launchTime: now,
            travelTime: travelTime * 1000, // Convert to ms
            returnTime: now + (travelTime * 1000),
            returned: false,
        };

        this.activeProbes.push(probe);

        this.game.events.emit('intel:probe-launched', {
            probeId: probe.id,
            sectorId: sectorId,
            travelTime: travelTime,
        });

        this.game.ui?.showToast(`Probe launched to ${sectorLayout.name}`, 'info');

        return probe;
    }

    /**
     * Process a returning probe and generate intel data for its target sector.
     * Generates abstract intel based on UNIVERSE_LAYOUT sector config.
     */
    processProbeReturn(probe) {
        const sectorId = probe.sectorId;
        const sectorLayout = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        if (!sectorLayout) return;

        const difficulty = sectorLayout.difficulty || 'normal';
        const diffConfig = CONFIG.SECTOR_DIFFICULTY[difficulty] || CONFIG.SECTOR_DIFFICULTY.normal;

        // Estimate enemy count from difficulty (dangerLevel mapped to 3-8 range)
        const dangerLevels = { hub: 0, safe: 0.15, normal: 0.4, dangerous: 0.7, deadly: 1.0 };
        const dangerLevel = dangerLevels[difficulty] || 0.4;
        const baseEnemies = diffConfig.enemyCount || 0;
        // Add variance: +/- 30% randomness
        const enemyVariance = 0.7 + Math.random() * 0.6;
        const enemyCount = Math.round(baseEnemies * enemyVariance);

        // Estimate friendly/faction presence
        const npcMinerConfig = CONFIG.NPC_MINERS[difficulty];
        const npcSecConfig = CONFIG.NPC_SECURITY[difficulty];
        const friendlyCount = (npcMinerConfig?.count || 0) + (npcSecConfig?.count || 0);

        // Hazards
        const hazards = [];
        const hazardConfig = CONFIG.SECTOR_HAZARDS[sectorId];
        if (hazardConfig) {
            hazards.push({
                type: hazardConfig.type,
                name: hazardConfig.name,
                severity: hazardConfig.damagePerSecond ? 'dangerous' :
                    hazardConfig.capDrainPerSecond ? 'moderate' : 'minor',
            });
        }

        // Events - probes get a snapshot, may not be current
        const events = [];
        if (this.game.sectorEventSystem) {
            const activeEvents = this.game.sectorEventSystem.activeEvents || [];
            for (const evt of activeEvents) {
                if (evt.sectorId === sectorId) {
                    events.push({
                        type: evt.type,
                        name: evt.name || evt.type,
                    });
                }
            }
        }

        // Asteroid richness from layout
        const asteroidRichness = this._estimateAsteroidRichness(sectorId);
        const asteroidDensity = diffConfig.asteroidDensity || 0.3;
        const asteroidCount = Math.round(asteroidDensity * 20 * (0.8 + Math.random() * 0.4));

        // Probe intel is slightly less reliable (0.85 confidence)
        this.intelData.set(sectorId, {
            enemies: enemyCount,
            friendlies: friendlyCount,
            factions: [],
            hazards: hazards,
            events: events,
            stations: sectorLayout.hasStation ? 1 : 0,
            asteroids: asteroidCount,
            asteroidRichness: asteroidRichness,
            confidence: 0.85,
            timestamp: Date.now(),
            source: 'probe',
            sectorName: sectorLayout.name || sectorId,
            difficulty: difficulty,
        });

        this.game.ui?.showToast(`Probe returned from ${sectorLayout.name}`, 'success');
        this.game.events.emit('intel:updated', { sectorId });
    }

    /**
     * Get list of active (in-flight) probes
     */
    getActiveProbes() {
        const now = Date.now();
        return this.activeProbes.filter(p => !p.returned).map(p => ({
            id: p.id,
            sectorId: p.sectorId,
            progress: Math.min(1, (now - p.launchTime) / p.travelTime),
            remainingMs: Math.max(0, p.returnTime - now),
        }));
    }

    // =========================================================================
    // Scout Reports
    // =========================================================================

    /**
     * Add a scout report from a fleet ship or NPC.
     * Lower confidence than direct observation.
     * @param {string} sectorId
     * @param {number} confidence - Report confidence (default 0.85)
     */
    addScoutReport(sectorId, confidence = 0.85) {
        const sectorLayout = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        if (!sectorLayout) return;

        const difficulty = sectorLayout.difficulty || 'normal';
        const diffConfig = CONFIG.SECTOR_DIFFICULTY[difficulty] || CONFIG.SECTOR_DIFFICULTY.normal;

        const dangerLevels = { hub: 0, safe: 0.15, normal: 0.4, dangerous: 0.7, deadly: 1.0 };
        const dangerLevel = dangerLevels[difficulty] || 0.4;
        const baseEnemies = diffConfig.enemyCount || 0;
        const enemyVariance = 0.7 + Math.random() * 0.6;

        // Hazards
        const hazards = [];
        const hazardConfig = CONFIG.SECTOR_HAZARDS[sectorId];
        if (hazardConfig) {
            hazards.push({
                type: hazardConfig.type,
                name: hazardConfig.name,
                severity: hazardConfig.damagePerSecond ? 'dangerous' :
                    hazardConfig.capDrainPerSecond ? 'moderate' : 'minor',
            });
        }

        const existing = this.intelData.get(sectorId);

        // Only update if scout report is fresher or more confident
        if (existing && existing.confidence > confidence) return;

        this.intelData.set(sectorId, {
            enemies: Math.round(baseEnemies * enemyVariance),
            friendlies: (CONFIG.NPC_MINERS[difficulty]?.count || 0) + (CONFIG.NPC_SECURITY[difficulty]?.count || 0),
            factions: existing?.factions || [],
            hazards: hazards,
            events: existing?.events || [],
            stations: sectorLayout.hasStation ? 1 : 0,
            asteroids: Math.round((diffConfig.asteroidDensity || 0.3) * 20),
            asteroidRichness: this._estimateAsteroidRichness(sectorId),
            confidence: confidence,
            timestamp: Date.now(),
            source: 'scout',
            sectorName: sectorLayout.name || sectorId,
            difficulty: difficulty,
        });

        this.game.events.emit('intel:updated', { sectorId });
    }

    // =========================================================================
    // Queries
    // =========================================================================

    /**
     * Get intel for a sector (or null if no data).
     * Returns intel data with current confidence level.
     * @param {string} sectorId
     * @returns {object|null}
     */
    getIntel(sectorId) {
        const intel = this.intelData.get(sectorId);
        if (!intel) return null;

        // Return a copy with current confidence
        return {
            ...intel,
            confidenceColor: this.getConfidenceColor(intel.confidence),
            confidenceLabel: this.getConfidenceLabel(intel.confidence),
            age: Date.now() - intel.timestamp,
        };
    }

    /**
     * Get intel for all known sectors.
     * @returns {Map<string, object>}
     */
    getAllIntel() {
        const result = new Map();
        for (const [sectorId] of this.intelData) {
            result.set(sectorId, this.getIntel(sectorId));
        }
        return result;
    }

    /**
     * Check if we have any intel on a sector.
     * @param {string} sectorId
     * @returns {boolean}
     */
    hasIntel(sectorId) {
        const intel = this.intelData.get(sectorId);
        return intel !== undefined && intel.confidence > this.pruneThreshold;
    }

    /**
     * Get confidence color for UI display.
     * Green >0.8, Yellow >0.5, Orange >0.2, Red <=0.2
     * @param {number} confidence - 0 to 1
     * @returns {string} CSS color string
     */
    getConfidenceColor(confidence) {
        if (confidence > 0.8) return '#44ff44';
        if (confidence > 0.5) return '#ffff44';
        if (confidence > 0.2) return '#ff8844';
        return '#ff4444';
    }

    /**
     * Get confidence label for UI display.
     * @param {number} confidence
     * @returns {string}
     */
    getConfidenceLabel(confidence) {
        if (confidence > 0.8) return 'RELIABLE';
        if (confidence > 0.5) return 'MODERATE';
        if (confidence > 0.2) return 'STALE';
        return 'UNRELIABLE';
    }

    /**
     * Get threat level summary for a sector (for map overlay).
     * @param {string} sectorId
     * @returns {string} 'unknown' | 'clear' | 'low' | 'moderate' | 'high' | 'extreme'
     */
    getThreatLevel(sectorId) {
        const intel = this.intelData.get(sectorId);
        if (!intel || intel.confidence < 0.1) return 'unknown';

        const enemies = intel.enemies || 0;
        if (enemies === 0) return 'clear';
        if (enemies <= 3) return 'low';
        if (enemies <= 7) return 'moderate';
        if (enemies <= 12) return 'high';
        return 'extreme';
    }

    // =========================================================================
    // Maintenance
    // =========================================================================

    /**
     * Remove stale intel below confidence threshold.
     * @param {number} threshold
     */
    pruneStaleIntel(threshold = 0.05) {
        for (const [sectorId, intel] of this.intelData) {
            // Never prune current sector
            if (sectorId === this.game.currentSector?.id) continue;

            if (intel.confidence < threshold) {
                this.intelData.delete(sectorId);
                this.game.events.emit('intel:expired', { sectorId });
            }
        }
    }

    // =========================================================================
    // Persistence
    // =========================================================================

    /**
     * Save intel state to localStorage.
     */
    saveState() {
        try {
            const data = {};
            for (const [sectorId, intel] of this.intelData) {
                data[sectorId] = {
                    enemies: intel.enemies,
                    friendlies: intel.friendlies,
                    factions: intel.factions,
                    hazards: intel.hazards,
                    events: intel.events,
                    stations: intel.stations,
                    asteroids: intel.asteroids,
                    asteroidRichness: intel.asteroidRichness,
                    confidence: intel.confidence,
                    timestamp: intel.timestamp,
                    source: intel.source,
                    sectorName: intel.sectorName,
                    difficulty: intel.difficulty,
                };
            }

            localStorage.setItem('expedition-intel-data', JSON.stringify({
                intel: data,
                nextProbeId: this.nextProbeId,
            }));
        } catch (e) { /* ignore storage errors */ }
    }

    /**
     * Load intel state from localStorage.
     */
    loadState() {
        try {
            const saved = localStorage.getItem('expedition-intel-data');
            if (!saved) return;

            const parsed = JSON.parse(saved);

            if (parsed.intel) {
                for (const [sectorId, intel] of Object.entries(parsed.intel)) {
                    // Recalculate time-based confidence decay since save
                    const elapsed = (Date.now() - intel.timestamp) / 1000;
                    const decayedConfidence = Math.max(0, intel.confidence - this.decayRate * elapsed);

                    if (decayedConfidence > this.pruneThreshold) {
                        this.intelData.set(sectorId, {
                            ...intel,
                            confidence: decayedConfidence,
                        });
                    }
                }
            }

            if (parsed.nextProbeId) {
                this.nextProbeId = parsed.nextProbeId;
            }
        } catch (e) { /* ignore parse errors */ }
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /**
     * Estimate asteroid richness based on sector difficulty.
     * Returns a value from 0 (barren) to 1 (extremely rich).
     * @param {string} sectorId
     * @returns {number}
     */
    _estimateAsteroidRichness(sectorId) {
        const sectorLayout = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        if (!sectorLayout) return 0.3;

        const difficulty = sectorLayout.difficulty || 'normal';
        const richness = {
            hub: 0.1,
            safe: 0.6,
            normal: 0.5,
            dangerous: 0.4,
            deadly: 0.2,
        };

        return richness[difficulty] || 0.3;
    }
}
