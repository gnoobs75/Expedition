// =============================================
// Tackle System
// Applies EWAR effects (warp disruption, webs)
// from active modules to their targets each tick.
// Runs at 10Hz to avoid per-frame overhead.
// =============================================

import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';

export class TackleSystem {
    constructor(game) {
        this.game = game;
        this.throttleInterval = 0.1; // 10Hz
        this.timeSinceUpdate = 0;
    }

    update(dt) {
        this.timeSinceUpdate += dt;
        if (this.timeSinceUpdate < this.throttleInterval) return;
        this.timeSinceUpdate = 0;

        const entities = this.game.currentSector?.entities || [];
        const player = this.game.player;

        // Phase 1: Clear all EWAR flags
        if (player && player.alive) {
            player.isPointed = false;
            player.isWebbed = false;
            player.isNosed = false;
            player.webSpeedFactor = 1.0;
        }
        for (const e of entities) {
            if (!e.alive || e.type === 'asteroid' || e.type === 'station' || e.type === 'player-station' || e.type === 'planet' || e.type === 'gate') continue;
            e.isPointed = false;
            e.isWebbed = false;
            e.isNosed = false;
            e.webSpeedFactor = 1.0;
        }

        // Phase 2: Apply EWAR from each ship's active modules
        const allShips = [];
        if (player && player.alive) allShips.push(player);
        for (const e of entities) {
            if (e.alive && e.activeModules && e.activeModules.size > 0) {
                allShips.push(e);
            }
        }

        for (const ship of allShips) {
            if (!ship.target || !ship.target.alive) continue;

            for (const slotId of ship.activeModules) {
                const [slotType, slotIndex] = ship.parseSlotId(slotId);
                const moduleId = ship.modules[slotType]?.[slotIndex];
                if (!moduleId) continue;

                const config = EQUIPMENT_DATABASE[moduleId];
                if (!config) continue;

                const dist = ship.distanceTo(ship.target);

                // Warp disruption
                if (config.warpDisrupt && dist <= (config.range || 0)) {
                    ship.target.isPointed = true;
                }

                // Stasis web
                if (config.speedReduction && dist <= (config.range || 0)) {
                    ship.target.isWebbed = true;
                    const factor = 1 - config.speedReduction;
                    ship.target.webSpeedFactor = Math.min(ship.target.webSpeedFactor, factor);
                }

                // Energy nosferatu (cap drain)
                if (config.capacitorDrain && dist <= (config.range || 0)) {
                    const drain = config.capacitorDrain * this.throttleInterval;
                    ship.target.isNosed = true;
                    if (ship.target.capacitor !== undefined) {
                        ship.target.capacitor = Math.max(0, ship.target.capacitor - drain);
                    }
                    if (ship.capacitor !== undefined && ship.maxCapacitor) {
                        ship.capacitor = Math.min(ship.maxCapacitor, ship.capacitor + drain * 0.8);
                    }
                }
            }
        }
    }
}
