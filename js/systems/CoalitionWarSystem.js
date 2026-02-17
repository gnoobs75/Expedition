// =============================================
// Coalition War System
// Tracks control points in contested sectors,
// shifting based on NPC battles and player actions.
// Win condition: Rindhalu Coalition controls all
// Maxolhx Coalition strategic sectors.
// =============================================

import { UNIVERSE_LAYOUT_MAP } from '../config.js';
import { FACTIONS, COALITIONS } from '../data/factionDatabase.js';

// Strategic sectors that determine war outcome
const MAXOLHX_STRATEGIC_SECTORS = [
    'kristang-hold', 'kristang-arena', 'kristang-forge',
    'thuranin-prime', 'thuranin-labs',
    'bosphuraq-prime', 'bosphuraq-nest',
    'maxolhx-prime', 'maxolhx-throne',
];

const RINDHALU_STRATEGIC_SECTORS = [
    'ruhar-prime', 'ruhar-haven', 'ruhar-market',
    'jeraptha-prime', 'jeraptha-docks',
    'rindhalu-prime', 'rindhalu-sanctum',
];

// All contested sector IDs
const CONTESTED_SECTOR_IDS = [];
for (const sector of Object.values(UNIVERSE_LAYOUT_MAP)) {
    if (sector.contested) {
        CONTESTED_SECTOR_IDS.push(sector.id);
    }
}

export class CoalitionWarSystem {
    constructor(game) {
        this.game = game;
        this.destroyed = false;

        // Control points per contested sector: { sectorId: { factionId: 0-100 } }
        this.controlPoints = {};

        // Player contribution tracking
        this.playerContributions = {
            rindhaluKills: 0,
            maxolhxKills: 0,
            sectorsFlipped: 0,
        };

        // NPC battle timer
        this.battleTimer = 0;
        this.battleInterval = 30; // seconds between NPC control shifts

        // War state
        this.warEnded = false;
        this.winner = null;

        // Initialize control points for contested sectors
        this.initControlPoints();

        // Listen for events
        this.game.events.on('entity:destroyed', (entity) => { if (!this.destroyed) this.onEntityDestroyed(entity); });
    }

    destroy() {
        this.destroyed = true;
    }

    initControlPoints() {
        for (const sectorId of CONTESTED_SECTOR_IDS) {
            const layout = UNIVERSE_LAYOUT_MAP[sectorId];
            if (!layout?.contestedFactions || layout.contestedFactions.length < 2) continue;

            this.controlPoints[sectorId] = {};
            for (const fId of layout.contestedFactions) {
                this.controlPoints[sectorId][fId] = 50; // Start equal
            }
        }
    }

    update(dt) {
        if (this.warEnded) return;

        // NPC battle simulation
        this.battleTimer += dt;
        if (this.battleTimer >= this.battleInterval) {
            this.battleTimer = 0;
            this.simulateNPCBattles();
        }

        // Check win condition
        this.checkWinCondition();
    }

    /**
     * Simulate NPC battles shifting control in contested sectors
     */
    simulateNPCBattles() {
        for (const sectorId of Object.keys(this.controlPoints)) {
            const layout = UNIVERSE_LAYOUT_MAP[sectorId];
            if (!layout?.contestedFactions || layout.contestedFactions.length < 2) continue;

            const factions = layout.contestedFactions;
            const cp = this.controlPoints[sectorId];

            // Determine battle outcome weighted by faction tier
            let f0Power = 1.0;
            let f1Power = 1.0;
            const f0Data = FACTIONS[factions[0]];
            const f1Data = FACTIONS[factions[1]];

            // Higher tier = more powerful
            if (f0Data && f1Data) {
                const tierDiff = (f1Data.tier || 3) - (f0Data.tier || 3);
                // Tier advantage: each tier level gives 20% advantage
                f0Power = 1.0 + tierDiff * 0.2;
                f1Power = 1.0 - tierDiff * 0.2;
            }

            // Random battle outcome (small shift)
            const shift = (Math.random() * 3 + 1); // 1-4 points per tick
            if (Math.random() * (f0Power + f1Power) < f0Power) {
                // Faction 0 wins this round
                cp[factions[0]] = Math.min(100, (cp[factions[0]] || 0) + shift);
                cp[factions[1]] = Math.max(0, (cp[factions[1]] || 0) - shift);
            } else {
                // Faction 1 wins this round
                cp[factions[1]] = Math.min(100, (cp[factions[1]] || 0) + shift);
                cp[factions[0]] = Math.max(0, (cp[factions[0]] || 0) - shift);
            }
        }
    }

    /**
     * Handle player kills in contested/faction space
     */
    onEntityDestroyed(entity) {
        if (!entity) return;
        const killer = entity.lastDamageSource;
        if (!killer || !killer.isPlayer) return;

        const enemyFaction = entity.faction;
        if (!enemyFaction) return;

        const enemyFactionData = FACTIONS[enemyFaction];
        if (!enemyFactionData) return;

        // Track player coalition kills
        if (enemyFactionData.coalition === 'maxolhx') {
            this.playerContributions.maxolhxKills++;
        } else if (enemyFactionData.coalition === 'rindhalu') {
            this.playerContributions.rindhaluKills++;
        }

        // Shift control in current sector if contested
        const currentSectorId = this.game.currentSector?.id;
        if (!currentSectorId) return;
        const cp = this.controlPoints[currentSectorId];
        if (!cp) return;

        // Player kills enemy faction ship -> shift control away from that faction
        const shift = 5; // Player kills are worth more than NPC battles
        if (cp[enemyFaction] !== undefined) {
            cp[enemyFaction] = Math.max(0, cp[enemyFaction] - shift);

            // Find opposing faction and boost it
            const layout = UNIVERSE_LAYOUT_MAP[currentSectorId];
            if (layout?.contestedFactions) {
                for (const fId of layout.contestedFactions) {
                    if (fId !== enemyFaction && cp[fId] !== undefined) {
                        cp[fId] = Math.min(100, cp[fId] + shift);
                    }
                }
            }
        }
    }

    /**
     * Check if war has been won
     */
    checkWinCondition() {
        // Win: All Maxolhx strategic sectors have Rindhalu-aligned control
        // (contested sectors all favor Rindhalu coalition factions)
        // For simplicity: check if player has flipped enough contested sectors
        let rindhaluControlled = 0;
        let maxolhxControlled = 0;
        let totalContested = Object.keys(this.controlPoints).length;

        for (const [sectorId, cp] of Object.entries(this.controlPoints)) {
            const layout = UNIVERSE_LAYOUT_MAP[sectorId];
            if (!layout?.contestedFactions) continue;

            // Find which coalition has more control
            let rindhaluPoints = 0, maxolhxPoints = 0;
            for (const [fId, points] of Object.entries(cp)) {
                const fData = FACTIONS[fId];
                if (!fData) continue;
                if (fData.coalition === 'rindhalu' || fData.coalition === 'humanity') {
                    rindhaluPoints += points;
                } else if (fData.coalition === 'maxolhx') {
                    maxolhxPoints += points;
                }
            }

            if (rindhaluPoints > maxolhxPoints) rindhaluControlled++;
            else if (maxolhxPoints > rindhaluPoints) maxolhxControlled++;
        }

        // Win if Rindhalu coalition controls ALL contested sectors
        if (totalContested > 0 && rindhaluControlled >= totalContested) {
            this.warEnded = true;
            this.winner = 'rindhalu';
            this.game.events.emit('war:victory', { winner: 'rindhalu', coalition: COALITIONS.rindhalu });
            this.game.ui?.toast('VICTORY! The Rindhalu Coalition has prevailed!', 'success');
        }
    }

    /**
     * Get war progress as percentages for HUD display
     */
    getWarProgress() {
        let rindhaluTotal = 0, maxolhxTotal = 0, count = 0;

        for (const [sectorId, cp] of Object.entries(this.controlPoints)) {
            const layout = UNIVERSE_LAYOUT_MAP[sectorId];
            if (!layout?.contestedFactions) continue;

            for (const [fId, points] of Object.entries(cp)) {
                const fData = FACTIONS[fId];
                if (!fData) continue;
                if (fData.coalition === 'rindhalu' || fData.coalition === 'humanity') {
                    rindhaluTotal += points;
                } else if (fData.coalition === 'maxolhx') {
                    maxolhxTotal += points;
                }
            }
            count++;
        }

        const total = rindhaluTotal + maxolhxTotal || 1;
        return {
            rindhalu: Math.round(rindhaluTotal / total * 100),
            maxolhx: Math.round(maxolhxTotal / total * 100),
            rindhaluControlled: rindhaluTotal,
            maxolhxControlled: maxolhxTotal,
            contestedSectors: count,
            warEnded: this.warEnded,
            winner: this.winner,
        };
    }

    /**
     * Get control points for a specific sector
     */
    getSectorControl(sectorId) {
        return this.controlPoints[sectorId] || null;
    }

    /**
     * Save state for persistence
     */
    saveState() {
        return {
            controlPoints: this.controlPoints,
            playerContributions: this.playerContributions,
            warEnded: this.warEnded,
            winner: this.winner,
        };
    }

    /**
     * Load state from save data
     */
    loadState(data) {
        if (!data) return;
        if (data.controlPoints) this.controlPoints = data.controlPoints;
        if (data.playerContributions) this.playerContributions = data.playerContributions;
        if (data.warEnded !== undefined) this.warEnded = data.warEnded;
        if (data.winner !== undefined) this.winner = data.winner;
    }
}
