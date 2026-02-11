// =============================================
// Survey System
// Handles survey scanner modules that reveal
// asteroid field composition and yield data.
// =============================================

import { CONFIG } from '../config.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';

export class SurveySystem {
    constructor(game) {
        this.game = game;

        // Survey data persists per sector
        // { sectorId: { scannerId: { asteroids: [...], timestamp, scannerPos } } }
        this.surveyData = {};

        // Active scan animations
        this.activeScans = [];

        // Load saved survey data
        this.loadState();
    }

    update(dt) {
        // Animate active scans
        for (let i = this.activeScans.length - 1; i >= 0; i--) {
            const scan = this.activeScans[i];
            scan.elapsed += dt;
            scan.radius = (scan.elapsed / scan.duration) * scan.maxRadius;

            if (scan.elapsed >= scan.duration) {
                // Scan complete - collect results
                this.completeScan(scan);
                this.activeScans.splice(i, 1);
            }
        }
    }

    /**
     * Initiate a survey scan from a ship
     * Called when survey scanner module cycles
     */
    initiateScan(ship, moduleId) {
        const config = EQUIPMENT_DATABASE[moduleId];
        if (!config || !config.scanRange) return;

        const sectorId = this.game.currentSector?.id;
        if (!sectorId) return;

        // Apply ship scan bonuses
        let scanRange = config.scanRange;
        if (ship.bonuses?.scanRange) {
            scanRange *= ship.bonuses.scanRange;
        }

        const scan = {
            ship,
            sectorId,
            x: ship.x,
            y: ship.y,
            maxRadius: scanRange,
            radius: 0,
            elapsed: 0,
            duration: 2.0, // Visual sweep duration
            moduleId,
        };

        this.activeScans.push(scan);

        // Visual pulse effect
        this.game.renderer?.effects.spawn('survey-pulse', ship.x, ship.y, {
            color: 0x00ff88,
            maxRadius: scanRange,
        });

        if (ship.isPlayer) {
            this.game.audio?.play('scan');
            this.game.ui?.log('Survey scan initiated...', 'system');
        }
    }

    /**
     * Complete a scan - gather asteroid data in range
     */
    completeScan(scan) {
        const sector = this.game.currentSector;
        if (!sector || sector.id !== scan.sectorId) return;

        const asteroids = [];
        const entities = sector.entities || [];

        for (const entity of entities) {
            if (!entity.alive || entity.type !== 'asteroid') continue;

            const dx = entity.x - scan.x;
            const dy = entity.y - scan.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= scan.maxRadius) {
                asteroids.push({
                    x: entity.x,
                    y: entity.y,
                    oreType: entity.oreType,
                    oreRemaining: entity.oreRemaining ?? entity.oreAmount ?? 0,
                    oreCapacity: entity.oreAmount ?? entity.oreCapacity ?? 0,
                    radius: entity.radius,
                    distance: Math.round(dist),
                    value: CONFIG.ASTEROID_TYPES[entity.oreType]?.value || 0,
                });
            }
        }

        // Store results
        if (!this.surveyData[scan.sectorId]) {
            this.surveyData[scan.sectorId] = {};
        }

        const scanId = `scan-${Date.now()}`;
        this.surveyData[scan.sectorId][scanId] = {
            asteroids,
            timestamp: Date.now(),
            scannerPos: { x: scan.x, y: scan.y },
            scanRadius: scan.maxRadius,
        };

        // Clean old scans (keep max 5 per sector)
        const sectorScans = this.surveyData[scan.sectorId];
        const scanIds = Object.keys(sectorScans).sort();
        while (scanIds.length > 5) {
            delete sectorScans[scanIds.shift()];
        }

        // Emit event for UI
        const summary = this.summarizeScan(asteroids);
        this.game.events.emit('survey:complete', {
            sectorId: scan.sectorId,
            scanId,
            summary,
            asteroidCount: asteroids.length,
        });

        if (scan.ship.isPlayer) {
            this.game.audio?.play('scan-complete');
            this.game.ui?.log(
                `Survey complete: ${asteroids.length} asteroids found | ` +
                `Total value: ${this.formatValue(summary.totalValue)} ISK`,
                'system'
            );
            this.game.ui?.toast(
                `Survey: ${asteroids.length} asteroids | ${summary.oreBreakdown.map(o => `${o.name}: ${o.units}`).join(', ')}`,
                'success'
            );
        }

        this.saveState();
    }

    /**
     * Summarize scan results
     */
    summarizeScan(asteroids) {
        const byType = {};
        let totalValue = 0;

        for (const a of asteroids) {
            if (!byType[a.oreType]) {
                const config = CONFIG.ASTEROID_TYPES[a.oreType];
                byType[a.oreType] = {
                    name: config?.name || a.oreType,
                    color: config?.color || 0x888888,
                    units: 0,
                    value: 0,
                    count: 0,
                };
            }
            byType[a.oreType].units += a.oreRemaining;
            byType[a.oreType].value += a.oreRemaining * a.value;
            byType[a.oreType].count++;
            totalValue += a.oreRemaining * a.value;
        }

        const oreBreakdown = Object.values(byType).sort((a, b) => b.value - a.value);

        return { totalValue, oreBreakdown, totalAsteroids: asteroids.length };
    }

    /**
     * Get survey data for current sector (for map overlay)
     */
    getCurrentSectorSurvey() {
        const sectorId = this.game.currentSector?.id;
        if (!sectorId) return null;
        return this.surveyData[sectorId] || null;
    }

    /**
     * Get all surveyed asteroids for a sector (merged from all scans)
     */
    getMergedSurveyData(sectorId) {
        const scans = this.surveyData[sectorId];
        if (!scans) return [];

        const merged = new Map();
        for (const scan of Object.values(scans)) {
            for (const a of scan.asteroids) {
                const key = `${Math.round(a.x)},${Math.round(a.y)}`;
                merged.set(key, a);
            }
        }

        return Array.from(merged.values());
    }

    formatValue(v) {
        if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
        if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
        return v.toString();
    }

    saveState() {
        try {
            // Only save asteroid positions, not full data
            const lite = {};
            for (const [sid, scans] of Object.entries(this.surveyData)) {
                lite[sid] = {};
                for (const [scanId, scan] of Object.entries(scans)) {
                    lite[sid][scanId] = {
                        timestamp: scan.timestamp,
                        scannerPos: scan.scannerPos,
                        scanRadius: scan.scanRadius,
                        asteroidCount: scan.asteroids.length,
                        summary: this.summarizeScan(scan.asteroids),
                    };
                }
            }
            localStorage.setItem('expedition-survey-data', JSON.stringify(lite));
        } catch (e) { /* ignore */ }
    }

    loadState() {
        // Survey data is mostly transient - just load summaries
        try {
            const saved = localStorage.getItem('expedition-survey-data');
            if (saved) {
                // We keep the format but asteroids will be re-scanned
                // Just init the structure
            }
        } catch (e) { /* ignore */ }
    }
}
