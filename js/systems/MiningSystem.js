// =============================================
// Mining System
// Handles asteroid mining and resource extraction
// =============================================

import { CONFIG } from '../config.js';

export class MiningSystem {
    constructor(game) {
        this.game = game;

        // Active mining operations
        this.activeMining = new Map(); // ship -> { asteroid, progress }
    }

    /**
     * Update mining system
     */
    update(dt) {
        // Visual effects for active mining
        for (const [ship, data] of this.activeMining) {
            if (!ship.alive || !data.asteroid.alive) {
                this.activeMining.delete(ship);
                continue;
            }

            // Check range
            const dist = ship.distanceTo(data.asteroid);
            if (dist > CONFIG.MINING_RANGE * 1.2) {
                this.activeMining.delete(ship);
                continue;
            }

            // Spawn mining beam effect occasionally
            data.effectTimer = (data.effectTimer || 0) + dt;
            if (data.effectTimer > 0.2) {
                data.effectTimer = 0;

                // Laser beam effect (light blue for mining laser)
                this.game.renderer.effects.spawn('laser', ship.x, ship.y, {
                    target: data.asteroid,
                    color: 0x4488ff,
                });

                // Particles at asteroid
                this.game.renderer.effects.spawn('mining', data.asteroid.x, data.asteroid.y, {
                    color: data.asteroid.color,
                });
            }
        }
    }

    /**
     * Mine an asteroid (called when mining laser cycles)
     */
    mineAsteroid(ship, asteroid, yield_amount) {
        if (!asteroid || asteroid.type !== 'asteroid') {
            return;
        }

        // Check range
        const dist = ship.distanceTo(asteroid);
        if (dist > CONFIG.MINING_RANGE * 1.2) {
            if (ship.isPlayer) this.game.ui?.log('Target out of mining range', 'system');
            return;
        }

        // Extract ore from asteroid
        const extracted = asteroid.mine(yield_amount);

        if (extracted.units > 0) {
            // Add ore to ship's cargo
            if (ship === this.game.player) {
                const added = ship.addOre(extracted.type, extracted.units, extracted.volume);

                if (added > 0) {
                    this.game.events.emit('mining:complete', {
                        units: added,
                        volume: added * (extracted.volume / extracted.units),
                        value: added * (extracted.value / extracted.units),
                        type: extracted.type,
                        asteroid,
                    });

                    // Log ore extraction
                    const oreName = CONFIG.ASTEROID_TYPES[extracted.type]?.name || extracted.type;
                    this.game.ui?.log(`+${added} ${oreName} ore`, 'mining');
                }

                // Warn if cargo is full
                if (added < extracted.units) {
                    this.game.ui?.log('Cargo hold full!', 'warning');
                    this.game.ui?.toast('Cargo hold full - dock at a station to sell ore', 'warning');
                }
            } else if (ship.type === 'npc') {
                // NPC ships also add ore to their cargo
                ship.addOre(extracted.type, extracted.units, extracted.volume);
            }

            // Track active mining for visual effects
            this.activeMining.set(ship, {
                asteroid,
                progress: 0,
                effectTimer: 0,
            });

            // Play mining sound (only if near player)
            if (ship.isPlayer) {
                this.game.audio?.play('mining');
            }
        }

        // Check if asteroid depleted
        if (!asteroid.alive) {
            this.activeMining.delete(ship);
            if (ship.isPlayer) {
                this.game.ui?.log('Asteroid depleted', 'mining');
            }
        }
    }

    /**
     * Start auto-mining an asteroid
     */
    startAutoMine(ship, asteroid) {
        // This would set up continuous mining
        // For now, handled by module activation
    }

    /**
     * Stop mining
     */
    stopMining(ship) {
        this.activeMining.delete(ship);
    }

    /**
     * Get mining progress for ship
     */
    getMiningProgress(ship) {
        const data = this.activeMining.get(ship);
        return data ? data.progress : 0;
    }
}
