// =============================================
// Logistics System
// Handles remote repair modules (shield + armor)
// and logistics AI for NPC/fleet logi ships.
// =============================================

import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';

export class LogisticsSystem {
    constructor(game) {
        this.game = game;

        // Track active remote repair beams for visual effects
        // { repairerId, targetId, type: 'shield'|'armor', timer }
        this.activeRepairs = new Map();

        // Throttle AI decisions
        this.aiTimer = 0;
        this.aiInterval = 1.0; // Check for repair targets every 1s
    }

    update(dt) {
        // Update active repair visuals
        this.updateRepairEffects(dt);

        // AI for logistics ships
        this.aiTimer += dt;
        if (this.aiTimer >= this.aiInterval) {
            this.aiTimer = 0;
            this.updateLogisticsAI();
        }
    }

    /**
     * Apply remote repair from source to target.
     * Called by triggerModuleEffect in Ship.js when a remote rep module cycles.
     */
    applyRemoteRepair(source, target, moduleId) {
        if (!source || !target || !source.alive || !target.alive) return;

        const config = EQUIPMENT_DATABASE[moduleId];
        if (!config) return;

        const dist = source.distanceTo(target);
        const range = config.range || 500;

        // Check range
        if (dist > range * 1.2) {
            if (source.isPlayer) {
                this.game.ui?.log('Target out of repair range', 'system');
            }
            return;
        }

        // Apply ship bonus to repair amount
        let repairMult = 1.0;
        if (source.bonuses?.remoteRepair) {
            repairMult = source.bonuses.remoteRepair;
        }

        if (config.remoteShieldRepair) {
            const amount = config.remoteShieldRepair * repairMult;
            const actual = Math.min(amount, target.maxShield - target.shield);
            target.shield = Math.min(target.maxShield, target.shield + amount);

            if (actual > 0) {
                this.spawnRepairBeam(source, target, 'shield');
                if (source.isPlayer) {
                    this.game.ui?.log(`Repairing ${target.name} shields +${Math.round(actual)}`, 'system');
                }
            }
        }

        if (config.remoteArmorRepair) {
            const amount = config.remoteArmorRepair * repairMult;
            const actual = Math.min(amount, target.maxArmor - target.armor);
            target.armor = Math.min(target.maxArmor, target.armor + amount);

            if (actual > 0) {
                this.spawnRepairBeam(source, target, 'armor');
                if (source.isPlayer) {
                    this.game.ui?.log(`Repairing ${target.name} armor +${Math.round(actual)}`, 'system');
                }
            }
        }
    }

    /**
     * Spawn visual repair beam between source and target
     */
    spawnRepairBeam(source, target, type) {
        const color = type === 'shield' ? 0x00aaff : 0xffaa00;
        const key = `${source.id || source.name}-${target.id || target.name}`;

        this.activeRepairs.set(key, {
            source,
            target,
            type,
            timer: 0.5, // Beam visible duration
        });

        // Spawn beam effect
        this.game.renderer?.effects.spawn('laser', source.x, source.y, {
            target,
            color,
        });

        // Spawn particles at target
        this.game.renderer?.effects.spawn('repair', target.x, target.y, {
            color,
        });
    }

    /**
     * Update repair beam visuals
     */
    updateRepairEffects(dt) {
        for (const [key, repair] of this.activeRepairs) {
            repair.timer -= dt;
            if (repair.timer <= 0 || !repair.source.alive || !repair.target.alive) {
                this.activeRepairs.delete(key);
            }
        }
    }

    /**
     * AI for logistics ships - find damaged allies and orbit+repair
     */
    updateLogisticsAI() {
        const sector = this.game.currentSector;
        if (!sector) return;

        const entities = sector.entities || [];

        for (const ship of entities) {
            if (!ship.alive) continue;

            // Only handle ships with logistics role or active remote rep modules
            const isLogi = ship.role === 'logistics' ||
                (ship.type === 'npc' && ship.role === 'logistics') ||
                (ship.type === 'fleet' && ship.role === 'logistics');

            if (!isLogi) continue;

            // Skip if player-controlled
            if (ship.isPlayer) continue;

            // Find the most damaged friendly ship in range
            this.assignRepairTarget(ship, entities);
        }
    }

    /**
     * Find and assign a repair target for a logistics ship
     */
    assignRepairTarget(logiShip, entities) {
        let bestTarget = null;
        let lowestHpPercent = 1.0;
        const repairRange = 800; // Default repair range

        for (const entity of entities) {
            if (!entity.alive || entity === logiShip) continue;

            // Only repair friendly ships
            if (entity.hostility === 'hostile') continue;
            if (entity.type === 'enemy') continue;
            if (entity.type === 'asteroid' || entity.type === 'station' ||
                entity.type === 'gate' || entity.type === 'warpgate' || entity.type === 'planet') continue;

            // Check if damaged
            const hpPercent = (entity.shield + entity.armor + entity.hull) /
                (entity.maxShield + entity.maxArmor + entity.maxHull);

            if (hpPercent >= 0.95) continue; // Not damaged enough

            const dist = logiShip.distanceTo(entity);
            if (dist > repairRange * 3) continue; // Too far to bother

            if (hpPercent < lowestHpPercent) {
                lowestHpPercent = hpPercent;
                bestTarget = entity;
            }
        }

        if (bestTarget) {
            logiShip.target = bestTarget;
            logiShip.aiTarget = bestTarget;

            const dist = logiShip.distanceTo(bestTarget);

            if (dist > repairRange) {
                // Move towards target
                logiShip.setDestination(bestTarget.x, bestTarget.y);
                logiShip.desiredSpeed = logiShip.maxSpeed;
            } else {
                // Orbit and repair
                const orbitAngle = Math.atan2(
                    logiShip.y - bestTarget.y,
                    logiShip.x - bestTarget.x
                );
                const orbitDist = repairRange * 0.6;
                logiShip.setDestination(
                    bestTarget.x + Math.cos(orbitAngle + 0.1) * orbitDist,
                    bestTarget.y + Math.sin(orbitAngle + 0.1) * orbitDist
                );
                logiShip.desiredSpeed = logiShip.maxSpeed * 0.5;

                // Activate remote repair modules
                for (const [slotId, moduleId] of Object.entries(logiShip.modules?.mid || {})) {
                    if (moduleId && typeof moduleId === 'string') {
                        const config = EQUIPMENT_DATABASE[moduleId];
                        if (config && (config.remoteShieldRepair || config.remoteArmorRepair)) {
                            if (!logiShip.activeModules.has(slotId)) {
                                logiShip.activateModule(slotId);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Check if a module is a remote repair module
     */
    isRemoteRepairModule(moduleId) {
        const config = EQUIPMENT_DATABASE[moduleId];
        return config && (config.remoteShieldRepair || config.remoteArmorRepair);
    }
}
