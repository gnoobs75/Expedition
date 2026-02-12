// =============================================
// Sector Event System
// Manages sector-wide events that spawn content,
// alter economy, and create narrative moments
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { SECTOR_EVENTS, EVENT_CONFIG } from '../data/sectorEventDatabase.js';

export class SectorEventSystem {
    constructor(game) {
        this.game = game;
        this.activeEvents = []; // [{id, eventType, sectorId, startTime, duration, data, expired}]
        this.evaluateTimer = 0;
        this.nextEventId = 1;

        // Track spawned entity IDs per event so we can clean them up
        this.spawnedEntities = new Map(); // eventId -> [entityId, ...]

        // Track which sectors have event flags (mining rush, etc.)
        this.sectorFlags = new Map(); // sectorId -> Set of flag strings

        // Listen for sector changes to materialize/dematerialize
        game.events.on('sector:change', (sectorId) => this.onSectorChange(sectorId));
    }

    // ==========================================
    // Main Update Loop
    // ==========================================

    /**
     * Update sector event system each frame
     */
    update(dt) {
        // Advance evaluation timer
        this.evaluateTimer += dt;
        if (this.evaluateTimer >= EVENT_CONFIG.evaluateInterval) {
            this.evaluateTimer -= EVENT_CONFIG.evaluateInterval;
            this.evaluateNewEvent();
        }

        // Tick active events, expire old ones
        const now = performance.now() / 1000;
        for (let i = this.activeEvents.length - 1; i >= 0; i--) {
            const event = this.activeEvents[i];
            if (event.expired) continue;

            const elapsed = now - event.startTime;
            if (elapsed >= event.duration) {
                this.endEvent(event);
                event.expired = true;
            }
        }

        // Prune expired events
        for (let i = this.activeEvents.length - 1; i >= 0; i--) {
            if (this.activeEvents[i].expired) {
                this.activeEvents.splice(i, 1);
            }
        }
    }

    // ==========================================
    // Event Evaluation & Spawning
    // ==========================================

    /**
     * Evaluate whether to spawn a new sector event
     */
    evaluateNewEvent() {
        // Don't exceed max concurrent events
        const liveCount = this.activeEvents.filter(e => !e.expired).length;
        if (liveCount >= EVENT_CONFIG.maxConcurrent) return;

        // Pick a random event type
        const eventTypes = Object.keys(SECTOR_EVENTS);
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const template = SECTOR_EVENTS[eventType];
        if (!template) return;

        // Pick a random sector (exclude hub for dangerous events)
        const eligibleSectors = UNIVERSE_LAYOUT.sectors.filter(s => {
            // Don't stack same event type in the same sector
            const existing = this.activeEvents.find(
                e => !e.expired && e.sectorId === s.id && e.eventType === eventType
            );
            if (existing) return false;

            // Pirate capital and radiation storm shouldn't hit the hub
            if (s.id === 'hub' && (eventType === 'pirate_capital' || eventType === 'radiation_storm')) {
                return false;
            }

            return true;
        });

        if (eligibleSectors.length === 0) return;

        const sector = eligibleSectors[Math.floor(Math.random() * eligibleSectors.length)];
        this.startEvent(eventType, sector.id);
    }

    /**
     * Start a sector event
     */
    startEvent(eventType, sectorId) {
        const template = SECTOR_EVENTS[eventType];
        if (!template) return null;

        // Calculate duration from template range
        const [minDur, maxDur] = template.duration;
        const duration = minDur + Math.random() * (maxDur - minDur);

        const event = {
            id: this.nextEventId++,
            eventType,
            sectorId,
            startTime: performance.now() / 1000,
            duration,
            data: { ...template },
            expired: false,
            materialized: false, // Whether entities have been spawned in the current sector
        };

        this.activeEvents.push(event);
        this.spawnedEntities.set(event.id, []);

        // Apply abstract (non-entity) effects immediately
        this.applyAbstractEffects(event);

        // If the player is in this sector, materialize immediately
        if (this.game.currentSector?.id === sectorId) {
            this.materializeEvent(event);
        }

        // Notify via event bus
        this.game.events.emit('event:started', this.getEventDisplayData(event));

        // Log and toast for player awareness
        const sectorInfo = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        const sectorName = sectorInfo?.name || sectorId;
        this.game.ui?.showToast(`Event: ${template.name} in ${sectorName}`, 'warning');
        this.game.ui?.log(`Sector event: ${template.name} reported in ${sectorName}`, 'system');
        this.game.ui?.addShipLogEntry(`${template.name} in ${sectorName}`, 'nav');

        // Audio cue
        this.game.audio?.play('scan-complete', 0.4);

        return event;
    }

    /**
     * Apply abstract effects that don't require entity spawning
     * These work even when the player is in a different sector
     */
    applyAbstractEffects(event) {
        const template = SECTOR_EVENTS[event.eventType];
        if (!template) return;

        switch (event.eventType) {
            case 'trade_embargo':
                // Set price modifier on commerce system for this sector
                if (this.game.commerceSystem) {
                    if (!this.game.commerceSystem.eventPriceModifiers) {
                        this.game.commerceSystem.eventPriceModifiers = {};
                    }
                    this.game.commerceSystem.eventPriceModifiers[event.sectorId] = template.priceModifier || 1.8;
                }
                break;

            case 'mining_rush':
                // Set a flag so sector generation knows about rich asteroids
                if (!this.sectorFlags.has(event.sectorId)) {
                    this.sectorFlags.set(event.sectorId, new Set());
                }
                this.sectorFlags.get(event.sectorId).add('mining_rush');
                break;
        }
    }

    /**
     * Remove abstract effects when event ends
     */
    removeAbstractEffects(event) {
        switch (event.eventType) {
            case 'trade_embargo':
                if (this.game.commerceSystem?.eventPriceModifiers) {
                    delete this.game.commerceSystem.eventPriceModifiers[event.sectorId];
                }
                break;

            case 'mining_rush':
                if (this.sectorFlags.has(event.sectorId)) {
                    this.sectorFlags.get(event.sectorId).delete('mining_rush');
                    if (this.sectorFlags.get(event.sectorId).size === 0) {
                        this.sectorFlags.delete(event.sectorId);
                    }
                }
                break;
        }
    }

    // ==========================================
    // Materialization (entity spawning)
    // ==========================================

    /**
     * Materialize event entities when player enters the sector
     */
    materializeEvent(event) {
        if (event.materialized || event.expired) return;

        const sector = this.game.currentSector;
        if (!sector || sector.id !== event.sectorId) return;

        event.materialized = true;
        const spawned = this.spawnedEntities.get(event.id) || [];

        switch (event.eventType) {
            case 'pirate_capital':
                this.materializePirateCapital(event, sector, spawned);
                break;

            case 'wormhole':
                this.materializeWormhole(event, sector, spawned);
                break;

            case 'radiation_storm':
                this.materializeRadiationStorm(event, sector);
                break;

            case 'mining_rush':
                this.materializeMiningRush(event, sector, spawned);
                break;

            // trade_embargo is purely abstract - no entities to spawn
        }

        this.spawnedEntities.set(event.id, spawned);
    }

    /**
     * Spawn pirate dreadnought + escorts
     */
    materializePirateCapital(event, sector, spawned) {
        const spawnConfig = event.data.spawnConfig || {};
        const bountyMult = event.data.bountyMultiplier || 3;

        // Spawn position: random area away from station and central planet
        const cx = CONFIG.SECTOR_SIZE / 2;
        const cy = CONFIG.SECTOR_SIZE / 2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 5000 + Math.random() * 8000;
        const baseX = cx + Math.cos(angle) * dist;
        const baseY = cy + Math.sin(angle) * dist;

        const EnemyShipClass = this.game._EnemyShipClass;
        if (!EnemyShipClass) return;

        // Spawn dreadnought (use battleship config as base, scaled up)
        const dreadnought = new EnemyShipClass(this.game, {
            x: baseX,
            y: baseY,
            enemyType: 'pirate-cruiser',
            name: 'Pirate Dreadnought',
            shipClass: 'battleship',
        });
        // Override stats for a dreadnought-class threat
        dreadnought.shield *= 3;
        dreadnought.maxShield = dreadnought.shield;
        dreadnought.armor *= 3;
        dreadnought.maxArmor = dreadnought.armor;
        dreadnought.hull *= 3;
        dreadnought.maxHull = dreadnought.hull;
        dreadnought.bounty = (CONFIG.ENEMIES['pirate-cruiser']?.bounty || 2000) * bountyMult;
        dreadnought.radius = 60;
        dreadnought.aggroRange = 3000;
        dreadnought.sectorEventId = event.id;
        sector.addEntity(dreadnought);
        spawned.push(dreadnought.id);

        // Spawn escorts around the dreadnought
        const escortCount = spawnConfig.escorts || 4;
        for (let i = 0; i < escortCount; i++) {
            const eAngle = (Math.PI * 2 * i) / escortCount;
            const eDist = 300 + Math.random() * 200;
            const escort = new EnemyShipClass(this.game, {
                x: baseX + Math.cos(eAngle) * eDist,
                y: baseY + Math.sin(eAngle) * eDist,
                enemyType: 'pirate-cruiser',
                name: `Pirate Escort ${i + 1}`,
            });
            escort.bounty = (CONFIG.ENEMIES['pirate-cruiser']?.bounty || 2000) * bountyMult;
            escort.sectorEventId = event.id;
            sector.addEntity(escort);
            spawned.push(escort.id);
        }

        this.game.ui?.log('WARNING: Pirate capital ship detected on scanners!', 'combat');
        this.game.audio?.play('ewar-warning', 0.5);
    }

    /**
     * Spawn a wormhole anomaly
     */
    materializeWormhole(event, sector, spawned) {
        // Import Anomaly dynamically to avoid circular deps
        const Anomaly = this.game._AnomalyClass;
        if (!Anomaly) {
            // Fallback: try to create a basic marker entity
            console.warn('SectorEventSystem: No Anomaly class reference on game');
            return;
        }

        const cx = CONFIG.SECTOR_SIZE / 2;
        const cy = CONFIG.SECTOR_SIZE / 2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 3000 + Math.random() * 6000;

        // Pick a random destination sector different from current
        const otherSectors = UNIVERSE_LAYOUT.sectors.filter(s => s.id !== event.sectorId);
        const destSector = otherSectors[Math.floor(Math.random() * otherSectors.length)];

        const wormhole = new Anomaly(this.game, {
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            anomalyType: 'wormhole',
            destinationSectorId: destSector?.id || 'hub',
            name: 'Event Wormhole',
        });
        wormhole.scanned = true; // Event wormholes are pre-scanned
        wormhole.sectorEventId = event.id;
        sector.addEntity(wormhole);
        spawned.push(wormhole.id);

        this.game.ui?.log('Wormhole signature detected nearby!', 'system');
    }

    /**
     * Apply radiation storm hazard to the sector
     */
    materializeRadiationStorm(event, sector) {
        // Use hazard system if available to apply temporary radiation
        const hazardSystem = this.game.hazardSystem;
        if (!hazardSystem) return;

        // Store the original hazard so we can restore it on end
        event._originalHazard = hazardSystem.activeHazard
            ? { ...hazardSystem.activeHazard }
            : null;

        const intensity = event.data.hazardIntensity || 0.8;
        const radiationHazard = {
            type: 'radiation',
            name: 'Radiation Storm',
            color: '#44ff88',
            warning: 'RADIATION STORM - Hull taking damage!',
            damagePerSecond: 2 * intensity,
            interval: 2,
        };

        // Only apply if the player is actually in this sector
        if (this.game.currentSector?.id === event.sectorId) {
            hazardSystem.activeHazard = radiationHazard;
            hazardSystem.timer = 0;
            hazardSystem.warningShown = false;

            // Update HUD
            if (hazardSystem.hudElement) {
                hazardSystem.hudElement.classList.remove('hidden');
                hazardSystem.hudElement.style.borderColor = radiationHazard.color;
                const nameEl = hazardSystem.hudElement.querySelector('.hazard-name');
                if (nameEl) nameEl.textContent = radiationHazard.name;
                const iconEl = hazardSystem.hudElement.querySelector('.hazard-icon');
                if (iconEl) iconEl.style.color = radiationHazard.color;
            }

            this.game.ui?.showToast(radiationHazard.warning, 'warning');
        }
    }

    /**
     * Spawn rich asteroids for a mining rush
     */
    materializeMiningRush(event, sector, spawned) {
        // Spawn additional high-value asteroids in the sector
        const spawnConfig = event.data.spawnConfig || {};
        const count = spawnConfig.richAsteroids || 8;

        const cx = CONFIG.SECTOR_SIZE / 2;
        const cy = CONFIG.SECTOR_SIZE / 2;
        const clusterAngle = Math.random() * Math.PI * 2;
        const clusterDist = 4000 + Math.random() * 5000;
        const clusterX = cx + Math.cos(clusterAngle) * clusterDist;
        const clusterY = cy + Math.sin(clusterAngle) * clusterDist;

        // Determine rich ore types
        const richTypes = ['pyroxeres', 'plagioclase'];

        for (let i = 0; i < count; i++) {
            const aAngle = Math.random() * Math.PI * 2;
            const aDist = Math.random() * 800;
            const ax = clusterX + Math.cos(aAngle) * aDist;
            const ay = clusterY + Math.sin(aAngle) * aDist;

            const oreType = richTypes[Math.floor(Math.random() * richTypes.length)];
            const oreConfig = CONFIG.ASTEROID_TYPES[oreType];
            if (!oreConfig) continue;

            // Create asteroid entity inline (same pattern as Sector.js generation)
            const asteroid = {
                id: Date.now() + Math.random() * 10000 + i,
                x: ax,
                y: ay,
                velocity: { x: 0, y: 0 },
                rotation: Math.random() * Math.PI * 2,
                radius: 25 + Math.random() * 25,
                alive: true,
                visible: true,
                selected: false,
                locked: false,
                type: 'asteroid',
                name: `Rich ${oreConfig.name}`,
                color: oreConfig.color,
                oreType: oreType,
                oreAmount: 150 + Math.floor(Math.random() * 200),
                maxOre: 350,
                value: oreConfig.value,
                sectorEventId: event.id,
                mesh: null,
                update() {},
                distanceTo(other) {
                    const dx = this.x - other.x;
                    const dy = this.y - other.y;
                    return Math.sqrt(dx * dx + dy * dy);
                },
                destroy() { this.alive = false; },
            };

            sector.addEntity(asteroid);
            spawned.push(asteroid.id);
        }

        this.game.ui?.log('Rich mineral deposits detected on scanners!', 'system');
        this.game.audio?.play('scan-complete', 0.3);
    }

    // ==========================================
    // Event Ending & Cleanup
    // ==========================================

    /**
     * End an event and clean up all its effects
     */
    endEvent(event) {
        if (event.expired) return;

        // Remove abstract effects
        this.removeAbstractEffects(event);

        // Clean up spawned entities if player is in this sector
        this.dematerializeEvent(event);

        // Restore hazard state if this was a radiation storm
        if (event.eventType === 'radiation_storm') {
            this.restoreHazardState(event);
        }

        // Notify
        this.game.events.emit('event:ended', this.getEventDisplayData(event));

        const sectorInfo = UNIVERSE_LAYOUT.sectors.find(s => s.id === event.sectorId);
        const sectorName = sectorInfo?.name || event.sectorId;
        const template = SECTOR_EVENTS[event.eventType];
        this.game.ui?.showToast(`Event ended: ${template?.name || event.eventType} in ${sectorName}`, 'system');
        this.game.ui?.log(`Sector event ended: ${template?.name || event.eventType} in ${sectorName}`, 'system');

        // Clean up entity tracking
        this.spawnedEntities.delete(event.id);
    }

    /**
     * Remove spawned entities for an event from the current sector
     */
    dematerializeEvent(event) {
        const sector = this.game.currentSector;
        if (!sector || sector.id !== event.sectorId) {
            // Player not in this sector - just clear tracking
            this.spawnedEntities.delete(event.id);
            return;
        }

        const entityIds = this.spawnedEntities.get(event.id) || [];
        for (const entityId of entityIds) {
            const entity = sector.entities.find(e => e.id === entityId);
            if (entity && entity.alive) {
                entity.alive = false;
                if (entity.destroy) entity.destroy();
                sector.removeEntity(entity);
            }
        }

        event.materialized = false;
    }

    /**
     * Restore hazard system state after radiation storm ends
     */
    restoreHazardState(event) {
        const hazardSystem = this.game.hazardSystem;
        if (!hazardSystem) return;

        if (this.game.currentSector?.id === event.sectorId) {
            if (event._originalHazard) {
                hazardSystem.activeHazard = event._originalHazard;
                hazardSystem.timer = 0;
            } else {
                hazardSystem.activeHazard = null;
                if (hazardSystem.hudElement) {
                    hazardSystem.hudElement.classList.add('hidden');
                }
            }
        }
    }

    // ==========================================
    // Sector Change Handling
    // ==========================================

    /**
     * Called when player enters a new sector
     * Materialize any active events for this sector,
     * dematerialize events in the sector we left
     */
    onSectorChange(sectorId) {
        // Dematerialize all currently materialized events (player left that sector)
        for (const event of this.activeEvents) {
            if (event.materialized && event.sectorId !== sectorId && !event.expired) {
                this.dematerializeEvent(event);
            }
        }

        // Materialize events for the new sector
        for (const event of this.activeEvents) {
            if (event.sectorId === sectorId && !event.materialized && !event.expired) {
                this.materializeEvent(event);
            }
        }
    }

    // ==========================================
    // Query Methods
    // ==========================================

    /**
     * Get all active events for a specific sector
     */
    getActiveEventsForSector(sectorId) {
        return this.activeEvents.filter(e => e.sectorId === sectorId && !e.expired);
    }

    /**
     * Get all currently active events
     */
    getAllActiveEvents() {
        return this.activeEvents.filter(e => !e.expired);
    }

    /**
     * Check if a sector has a specific flag (e.g., mining_rush)
     */
    hasSectorFlag(sectorId, flag) {
        return this.sectorFlags.has(sectorId) && this.sectorFlags.get(sectorId).has(flag);
    }

    /**
     * Get display data for UI rendering
     */
    getEventDisplayData(event) {
        const template = SECTOR_EVENTS[event.eventType];
        const sectorInfo = UNIVERSE_LAYOUT.sectors.find(s => s.id === event.sectorId);
        const now = performance.now() / 1000;
        const elapsed = now - event.startTime;
        const remaining = Math.max(0, event.duration - elapsed);

        return {
            id: event.id,
            eventType: event.eventType,
            sectorId: event.sectorId,
            name: template?.name || event.eventType,
            description: template?.description || '',
            icon: template?.icon || 'event',
            color: template?.color || '#ffffff',
            timeRemaining: remaining,
            duration: event.duration,
            sectorName: sectorInfo?.name || event.sectorId,
            isActive: !event.expired,
            materialized: event.materialized,
        };
    }

    /**
     * Get display data for all active events (for UI panels)
     */
    getAllEventDisplayData() {
        return this.activeEvents
            .filter(e => !e.expired)
            .map(e => this.getEventDisplayData(e));
    }

    // ==========================================
    // Persistence
    // ==========================================

    /**
     * Save event state for serialization
     */
    saveState() {
        return {
            nextEventId: this.nextEventId,
            activeEvents: this.activeEvents.filter(e => !e.expired).map(event => ({
                id: event.id,
                eventType: event.eventType,
                sectorId: event.sectorId,
                startTime: event.startTime,
                duration: event.duration,
                expired: false,
                materialized: false, // Don't preserve materialization across saves
            })),
            sectorFlags: Object.fromEntries(
                [...this.sectorFlags.entries()].map(([k, v]) => [k, [...v]])
            ),
        };
    }

    /**
     * Load event state from save data
     */
    loadState(data) {
        if (!data) return;

        this.nextEventId = data.nextEventId || 1;
        this.activeEvents = [];
        this.spawnedEntities.clear();
        this.sectorFlags.clear();

        // Restore active events
        if (data.activeEvents) {
            for (const saved of data.activeEvents) {
                const template = SECTOR_EVENTS[saved.eventType];
                if (!template) continue;

                const event = {
                    id: saved.id,
                    eventType: saved.eventType,
                    sectorId: saved.sectorId,
                    startTime: saved.startTime,
                    duration: saved.duration,
                    data: { ...template },
                    expired: false,
                    materialized: false,
                };

                this.activeEvents.push(event);
                this.spawnedEntities.set(event.id, []);

                // Re-apply abstract effects
                this.applyAbstractEffects(event);
            }
        }

        // Restore sector flags
        if (data.sectorFlags) {
            for (const [sectorId, flags] of Object.entries(data.sectorFlags)) {
                this.sectorFlags.set(sectorId, new Set(flags));
            }
        }

        // Materialize events for current sector if applicable
        const currentSectorId = this.game.currentSector?.id;
        if (currentSectorId) {
            for (const event of this.activeEvents) {
                if (event.sectorId === currentSectorId && !event.expired) {
                    this.materializeEvent(event);
                }
            }
        }
    }
}
