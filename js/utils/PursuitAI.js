// =============================================
// Pursuit AI Utility
// Shared chase decision framework for all AI
// systems (enemies, NPCs, guild ships)
// =============================================

import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';

/**
 * Evaluate whether a pursuer should continue chasing a target
 * @param {Ship} pursuer
 * @param {Ship} target
 * @param {Object} context - { chaseStartTime, currentTime, maxChaseTime, homePoint, maxHomeDistance, allyCount }
 * @returns {{ decision: string, reason: string }}
 */
export function evaluatePursuit(pursuer, target, context = {}) {
    const {
        chaseStartTime = 0,
        currentTime = Date.now() / 1000,
        maxChaseTime = 75,
        homePoint = null,
        maxHomeDistance = 5000,
        allyCount = 0,
    } = context;

    const dist = pursuer.distanceTo(target);
    const pursuerSpeed = pursuer.getEffectiveMaxSpeed();
    const targetSpeed = target.getEffectiveMaxSpeed();

    // 1. Target is pointed — we have them locked down
    if (target.isPointed) {
        return { decision: 'tackle', reason: 'Target pointed' };
    }

    // 2. In tackle module range — go for the point
    const tackleRange = getTackleRange(pursuer);
    if (tackleRange > 0 && dist < tackleRange * 1.2) {
        return { decision: 'tackle', reason: 'In tackle range' };
    }

    // 3. Chase timeout
    if (chaseStartTime > 0 && (currentTime - chaseStartTime) > maxChaseTime) {
        return { decision: 'disengage', reason: 'Chase timeout' };
    }

    // 4. Too far from home
    if (homePoint) {
        const dx = pursuer.x - homePoint.x;
        const dy = pursuer.y - homePoint.y;
        const homeDist = Math.sqrt(dx * dx + dy * dy);
        if (homeDist > maxHomeDistance) {
            return { decision: 'disengage', reason: 'Too far from home' };
        }
    }

    // 5. Low HP and few allies
    const hullPct = pursuer.hull / pursuer.maxHull;
    if (hullPct < 0.3 && allyCount < 2) {
        return { decision: 'disengage', reason: 'Low HP' };
    }

    // 6. Pursuer much faster — just chase
    if (pursuerSpeed > targetSpeed * 1.2) {
        return { decision: 'continue', reason: 'Faster than target' };
    }

    // 7. Similar speed + warp available + far enough to warp
    if (pursuerSpeed <= targetSpeed * 1.2 && dist > 1000 &&
        pursuer.sectorWarpState === 'none' && pursuer.sectorWarpCooldown <= 0 && !pursuer.isPointed) {
        return { decision: 'intercept', reason: 'Warp intercept' };
    }

    // 8. Slower and no warp available
    if (pursuerSpeed < targetSpeed * 0.9 && (pursuer.sectorWarpCooldown > 0 || pursuer.isPointed)) {
        return { decision: 'disengage', reason: 'Cannot catch target' };
    }

    // Default — keep chasing
    return { decision: 'continue', reason: 'Pursuing' };
}

/**
 * Calculate an intercept point ahead of a moving target
 * @param {Ship} pursuer
 * @param {Ship} target
 * @returns {{ x: number, y: number }|null}
 */
export function calculateInterceptPoint(pursuer, target) {
    // Check target is actually moving
    const tvx = target.velocity.x;
    const tvy = target.velocity.y;
    const tSpeed = Math.sqrt(tvx * tvx + tvy * tvy);

    if (tSpeed < 10) return null; // Target barely moving

    // Predict position 5 seconds ahead
    const predictTime = 5;
    let px = target.x + tvx * predictTime;
    let py = target.y + tvy * predictTime;

    // Add 500 units overshoot along heading
    const heading = Math.atan2(tvy, tvx);
    px += Math.cos(heading) * 500;
    py += Math.sin(heading) * 500;

    return { x: px, y: py };
}

/**
 * Activate all tackle modules on a ship (targeting its current target)
 * @param {Ship} ship
 * @returns {string[]} List of activated module slot IDs
 */
export function activateTackleModules(ship) {
    const activated = [];
    if (!ship.target || !ship.target.alive) return activated;

    for (let i = 0; i < ship.midSlots; i++) {
        const slotId = `mid-${i + 1}`;
        const moduleId = ship.modules.mid[i];
        if (!moduleId) continue;

        const config = EQUIPMENT_DATABASE[moduleId];
        if (!config) continue;

        // Activate EWAR modules (warp disruptors, scramblers, webs)
        if (config.warpDisrupt || config.speedReduction) {
            if (!ship.activeModules.has(slotId)) {
                ship.activateModule(slotId);
            }
            activated.push(slotId);
        }
    }
    return activated;
}

/**
 * Check if a ship has a tackle module fitted
 * @param {Ship} ship
 * @param {string} moduleId - e.g. 'warp-disruptor'
 * @returns {boolean}
 */
export function hasTackleModule(ship, moduleId) {
    for (let i = 0; i < ship.midSlots; i++) {
        if (ship.modules.mid[i] === moduleId) return true;
    }
    return false;
}

/**
 * Get the longest-range tackle module on a ship
 * @param {Ship} ship
 * @returns {number} Range in units, 0 if no tackle fitted
 */
function getTackleRange(ship) {
    let maxRange = 0;
    for (let i = 0; i < ship.midSlots; i++) {
        const moduleId = ship.modules.mid[i];
        if (!moduleId) continue;
        const config = EQUIPMENT_DATABASE[moduleId];
        if (config && (config.warpDisrupt || config.speedReduction)) {
            maxRange = Math.max(maxRange, config.range || 0);
        }
    }
    return maxRange;
}
