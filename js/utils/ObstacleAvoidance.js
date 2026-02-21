// =============================================
// Obstacle Avoidance Utility
// Provides steering adjustments to avoid collisions
// =============================================

import { wrappedDirection, wrappedDistance } from './math.js';
import { CONFIG } from '../config.js';

export class ObstacleAvoidance {
    /**
     * Get an adjusted heading that avoids obstacles in the forward path.
     * Returns { angle, speedMultiplier } where angle is the adjusted desired heading
     * and speedMultiplier is 0.0-1.0 for braking near obstacles.
     *
     * @param {Object} ship - The ship entity (x, y, radius, rotation, currentSpeed)
     * @param {number} targetAngle - The desired heading toward destination
     * @param {Array} entities - All sector entities to check
     * @param {Object} options - { avoidTypes: ['asteroid','planet','station'], lookAhead: 800, corridorWidth: 100 }
     */
    static getAvoidance(ship, targetAngle, entities, options = {}) {
        const avoidTypes = options.avoidTypes || ['asteroid', 'planet', 'station'];
        const lookAhead = options.lookAhead || Math.max(400, ship.currentSpeed * 4);
        const corridorWidth = options.corridorWidth || (ship.radius * 3 + 30);

        // Scan forward corridor for obstacles
        const obstacles = [];
        for (const entity of entities) {
            if (entity === ship) continue;
            if (!entity.alive) continue;
            if (!avoidTypes.includes(entity.type)) continue;

            const dist = wrappedDistance(ship.x, ship.y, entity.x, entity.y, CONFIG.SECTOR_SIZE);
            if (dist > lookAhead + (entity.radius || 30)) continue;

            // Check if entity is roughly ahead (within +/-90 degrees of heading)
            const angleToEntity = wrappedDirection(ship.x, ship.y, entity.x, entity.y, CONFIG.SECTOR_SIZE);
            let angleDiff = angleToEntity - targetAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > Math.PI / 2) continue;

            // Check if entity is within the forward corridor
            const perpDist = Math.abs(Math.sin(angleDiff) * dist);
            const clearance = corridorWidth + (entity.radius || 30);
            if (perpDist < clearance) {
                obstacles.push({
                    entity,
                    dist,
                    angleDiff,
                    perpDist,
                    clearance,
                });
            }
        }

        if (obstacles.length === 0) {
            return { angle: targetAngle, speedMultiplier: 1.0 };
        }

        // Sort by distance - closest first
        obstacles.sort((a, b) => a.dist - b.dist);
        const nearest = obstacles[0];

        // Calculate weighted avoidance considering ALL nearby obstacles
        let leftWeight = 0;   // obstacles on the left (positive angleDiff)
        let rightWeight = 0;  // obstacles on the right (negative angleDiff)
        for (const obs of obstacles) {
            const weight = 1.0 / Math.max(50, obs.dist);
            if (obs.angleDiff > 0) {
                leftWeight += weight;
            } else {
                rightWeight += weight;
            }
        }

        // Steer toward the side with fewer/farther obstacles
        const avoidSign = leftWeight > rightWeight ? -1 : 1;
        const urgency = 1.0 - Math.min(1.0, nearest.dist / lookAhead);
        const steerStrength = urgency * Math.PI * 0.5; // Max 90 degrees of avoidance

        const adjustedAngle = targetAngle + avoidSign * steerStrength;

        // Slow down based on proximity
        const brakeDist = nearest.clearance * 4;
        let speedMultiplier = 1.0;
        if (nearest.dist < brakeDist) {
            speedMultiplier = Math.max(0.15, nearest.dist / brakeDist);
        }

        return { angle: adjustedAngle, speedMultiplier };
    }
}
