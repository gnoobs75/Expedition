// =============================================
// Engagement Recorder
// Records combat engagements involving player faction
// for After Action Reports (AAR)
// =============================================

export class EngagementRecorder {
    constructor(game) {
        this.game = game;

        // Active engagement being recorded (or null)
        this.active = null;

        // Completed engagement reports
        this.reports = [];
        this.MAX_REPORTS = 50;

        // Timer for ending engagement after inactivity
        this.inactivityTimeout = 15; // seconds
        this.inactivityTimer = 0;

        // Snapshot interval
        this.snapshotInterval = 0.5; // seconds
        this.snapshotTimer = 0;

        // Combat ID counters for naming enemies
        this.combatIdCounters = {};

        // Subscribe to combat events
        this.setupListeners();

        // Load persisted reports
        this.loadReports();
    }

    setupListeners() {
        // Listen to all combat actions (hits and misses)
        this.game.events.on('combat:action', (data) => {
            this.onCombatAction(data);
        });

        // Listen to entity destruction
        this.game.events.on('entity:destroyed', (entity) => {
            this.onEntityDestroyed(entity);
        });
    }

    /**
     * Determine faction label for an entity
     */
    getFaction(entity) {
        if (!entity) return 'Unknown';
        if (entity.type === 'player' || entity.type === 'fleet') {
            return this.game.faction?.name || 'Player';
        }
        if (entity.type === 'enemy') {
            return entity.enemyType === 'pirate' ? 'Pirates' :
                entity.enemyType ? entity.enemyType.charAt(0).toUpperCase() + entity.enemyType.slice(1) :
                    'Hostiles';
        }
        if (entity.type === 'guild') {
            return entity.factionId || 'NPC Faction';
        }
        if (entity.type === 'npc') {
            return 'Security';
        }
        return 'Unknown';
    }

    /**
     * Check if entity belongs to player faction
     */
    isPlayerFaction(entity) {
        return entity && (entity.type === 'player' || entity.type === 'fleet');
    }

    /**
     * Check if a combat action involves the player faction
     */
    involvesPlayerFaction(data) {
        return this.isPlayerFaction(data.source) || this.isPlayerFaction(data.target);
    }

    /**
     * Get or assign a combat ID for an entity in this engagement
     */
    getCombatId(entity) {
        if (!entity) return 'Unknown';
        if (!this.active) return entity.name || 'Unknown';

        const existing = this.active.shipMap.get(entity);
        if (existing) return existing.combatId;

        // Generate a combat ID
        const faction = this.getFaction(entity);
        if (this.isPlayerFaction(entity)) {
            return entity.name || 'Fleet Ship';
        }

        // Enemy naming: "Pirate Alpha-1", "Pirate Alpha-2", etc.
        if (!this.combatIdCounters[faction]) {
            this.combatIdCounters[faction] = 0;
        }
        this.combatIdCounters[faction]++;
        const idx = this.combatIdCounters[faction];
        const greek = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'][Math.floor((idx - 1) / 9)] || 'Omega';
        const num = ((idx - 1) % 9) + 1;
        return `${faction} ${greek}-${num}`;
    }

    /**
     * Register an entity in the active engagement
     */
    registerEntity(entity) {
        if (!this.active || !entity) return;
        if (this.active.shipMap.has(entity)) return;

        const combatId = this.getCombatId(entity);
        const faction = this.getFaction(entity);
        const shipData = {
            combatId,
            faction,
            shipClass: entity.shipClass || entity.enemyType || entity.type,
            entityRef: entity,
            maxHp: (entity.maxShield || 0) + (entity.maxArmor || 0) + (entity.maxHull || 0),
            destroyed: false,
            damageDealt: 0,
            damageTaken: 0,
            killCredit: null,
        };

        this.active.shipMap.set(entity, shipData);
        this.active.ships.push(shipData);

        // Track faction
        if (!this.active.factions[faction]) {
            this.active.factions[faction] = {
                name: faction,
                shipsInvolved: 0,
                shipsLost: 0,
                damageDealt: 0,
                damageTaken: 0,
                isPlayerFaction: this.isPlayerFaction(entity),
            };
        }
        this.active.factions[faction].shipsInvolved++;
    }

    /**
     * Handle a combat action event
     */
    onCombatAction(data) {
        if (!data.source || !data.target) return;
        if (!this.involvesPlayerFaction(data)) return;

        // Start new engagement if none active
        if (!this.active) {
            this.startEngagement(data);
        }

        // Reset inactivity timer
        this.inactivityTimer = 0;

        // Register entities
        this.registerEntity(data.source);
        this.registerEntity(data.target);

        // Record damage
        if (data.type === 'hit' && data.damage > 0) {
            const sourceData = this.active.shipMap.get(data.source);
            const targetData = this.active.shipMap.get(data.target);

            if (sourceData) {
                sourceData.damageDealt += data.damage;
                if (this.active.factions[sourceData.faction]) {
                    this.active.factions[sourceData.faction].damageDealt += data.damage;
                }
            }
            if (targetData) {
                targetData.damageTaken += data.damage;
                if (this.active.factions[targetData.faction]) {
                    this.active.factions[targetData.faction].damageTaken += data.damage;
                }
            }

            // Add to damage log
            this.active.damageLog.push({
                t: this.active.elapsed,
                src: sourceData?.combatId || 'Unknown',
                tgt: targetData?.combatId || 'Unknown',
                dmg: Math.round(data.damage),
                type: data.damageType || 'hull',
                weapon: data.weapon || 'Unknown',
            });
        }
    }

    /**
     * Handle entity destruction during active engagement
     */
    onEntityDestroyed(entity) {
        if (!this.active) return;

        const shipData = this.active.shipMap.get(entity);
        if (!shipData) return;

        shipData.destroyed = true;
        if (entity.lastDamageSource) {
            const killerData = this.active.shipMap.get(entity.lastDamageSource);
            shipData.killCredit = killerData?.combatId || 'Unknown';
        }

        // Update faction losses
        const faction = this.active.factions[shipData.faction];
        if (faction) {
            faction.shipsLost++;
        }

        // Log destruction event
        this.active.damageLog.push({
            t: this.active.elapsed,
            src: shipData.killCredit || 'Unknown',
            tgt: shipData.combatId,
            dmg: 0,
            type: 'destroyed',
            weapon: 'destruction',
        });
    }

    /**
     * Start recording a new engagement
     */
    startEngagement(initialData) {
        this.combatIdCounters = {};
        this.active = {
            id: Date.now(),
            stardate: this.game.getStardate(),
            sectorId: this.game.currentSector?.id || 'unknown',
            sectorName: this.game.currentSector?.name || 'Unknown Sector',
            startTime: this.game.stats?.playTime || 0,
            elapsed: 0,
            factions: {},
            ships: [],
            shipMap: new Map(), // entity -> shipData (not serialized)
            damageLog: [],
            snapshots: [],
        };
        this.inactivityTimer = 0;
        this.snapshotTimer = 0;
    }

    /**
     * Take a position snapshot of all entities in the engagement
     */
    takeSnapshot() {
        if (!this.active) return;

        const snap = [];
        for (const [entity, shipData] of this.active.shipMap) {
            snap.push({
                id: shipData.combatId,
                x: Math.round(entity.x),
                y: Math.round(entity.y),
                faction: shipData.faction,
                alive: entity.alive !== false && !shipData.destroyed,
                hp: entity.maxHull > 0 ? Math.round(((entity.shield || 0) + (entity.armor || 0) + (entity.hull || 0)) / ((entity.maxShield || 1) + (entity.maxArmor || 1) + (entity.maxHull || 1)) * 100) : 100,
            });
        }
        this.active.snapshots.push({
            t: this.active.elapsed,
            entities: snap,
        });
    }

    /**
     * End the current engagement and finalize the report
     */
    endEngagement() {
        if (!this.active) return;

        // Don't save trivial engagements (< 2 factions or < 3 seconds)
        const factionCount = Object.keys(this.active.factions).length;
        if (factionCount < 2 || this.active.elapsed < 3) {
            this.active = null;
            return;
        }

        // Determine outcome for player faction
        const playerFactionData = Object.values(this.active.factions).find(f => f.isPlayerFaction);
        const enemyFactions = Object.values(this.active.factions).filter(f => !f.isPlayerFaction);
        const totalEnemyLost = enemyFactions.reduce((s, f) => s + f.shipsLost, 0);
        const totalEnemyShips = enemyFactions.reduce((s, f) => s + f.shipsInvolved, 0);
        const playerLost = playerFactionData?.shipsLost || 0;
        const playerShips = playerFactionData?.shipsInvolved || 0;

        let outcome = 'draw';
        if (totalEnemyLost > 0 && playerLost === 0) {
            outcome = 'victory';
        } else if (totalEnemyLost > 0 && playerLost > 0) {
            outcome = 'pyrrhic';
        } else if (playerLost > 0 && totalEnemyLost === 0) {
            outcome = 'defeat';
        }

        // Build final report (strip non-serializable data)
        const report = {
            id: this.active.id,
            stardate: this.active.stardate,
            sectorId: this.active.sectorId,
            sectorName: this.active.sectorName,
            duration: Math.round(this.active.elapsed * 10) / 10,
            outcome,
            factions: this.active.factions,
            ships: this.active.ships.map(s => ({
                combatId: s.combatId,
                faction: s.faction,
                shipClass: s.shipClass,
                maxHp: s.maxHp,
                destroyed: s.destroyed,
                damageDealt: Math.round(s.damageDealt),
                damageTaken: Math.round(s.damageTaken),
                killCredit: s.killCredit,
            })),
            damageLog: this.active.damageLog,
            snapshots: this.active.snapshots,
        };

        // Add to reports (newest first)
        this.reports.unshift(report);
        if (this.reports.length > this.MAX_REPORTS) {
            this.reports.pop();
        }

        // Persist
        this.saveReports();

        // Emit event
        this.game.events.emit('aar:new-report', report);

        this.active = null;
    }

    /**
     * Update (called each game tick)
     */
    update(dt) {
        if (!this.active) return;

        this.active.elapsed += dt;

        // Snapshot timer
        this.snapshotTimer += dt;
        if (this.snapshotTimer >= this.snapshotInterval) {
            this.snapshotTimer = 0;
            this.takeSnapshot();
        }

        // Inactivity timer
        this.inactivityTimer += dt;
        if (this.inactivityTimer >= this.inactivityTimeout) {
            this.endEngagement();
        }
    }

    /**
     * Force-end engagement (e.g., on sector change)
     */
    forceEnd() {
        if (this.active) {
            this.endEngagement();
        }
    }

    // ==========================================
    // Persistence
    // ==========================================

    saveReports() {
        try {
            localStorage.setItem('expedition-aar-reports', JSON.stringify(this.reports));
        } catch (e) {
            // Storage full - trim older reports
            if (this.reports.length > 10) {
                this.reports.length = 10;
                try {
                    localStorage.setItem('expedition-aar-reports', JSON.stringify(this.reports));
                } catch { /* give up */ }
            }
        }
    }

    loadReports() {
        try {
            const raw = localStorage.getItem('expedition-aar-reports');
            if (raw) {
                this.reports = JSON.parse(raw);
            }
        } catch {
            this.reports = [];
        }
    }

    clearReports() {
        this.reports = [];
        localStorage.removeItem('expedition-aar-reports');
    }
}
