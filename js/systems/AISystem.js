// =============================================
// AI System
// Enemy behavior and decision making
// =============================================

import { CONFIG } from '../config.js';

export class AISystem {
    constructor(game) {
        this.game = game;

        // AI update throttling
        this.updateInterval = 0.5; // Seconds between AI decisions
        this.timeSinceUpdate = 0;
    }

    /**
     * Update all AI entities
     */
    update(dt) {
        this.timeSinceUpdate += dt;

        // Throttle AI decisions
        if (this.timeSinceUpdate < this.updateInterval) {
            // Still update movement towards current goal
            this.updateMovement(dt);
            return;
        }

        this.timeSinceUpdate = 0;

        // Make decisions for each enemy
        const enemies = this.game.currentSector?.getEnemies() || [];
        const player = this.game.player;

        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            this.updateAI(enemy, player, dt);
        }
    }

    /**
     * Update AI decision for a single enemy
     */
    updateAI(enemy, player, dt) {
        // Check if player is valid target
        const playerValid = player && player.alive;

        // Get distance to player
        const distToPlayer = playerValid ? enemy.distanceTo(player) : Infinity;

        // If enemy already has an NPC target from raid spawn, keep tracking it
        const currentTarget = enemy.aiTarget;

        // State machine
        switch (enemy.aiState) {
            case 'idle':
                this.handleIdleState(enemy, player, distToPlayer);
                break;

            case 'patrol':
                this.handlePatrolState(enemy, player, distToPlayer);
                break;

            case 'chase':
                this.handleChaseState(enemy, player, distToPlayer);
                break;

            case 'attack':
                this.handleAttackState(enemy, player, distToPlayer);
                break;

            case 'flee':
                this.handleFleeState(enemy, player, distToPlayer);
                break;

            default:
                enemy.aiState = 'idle';
        }
    }

    /**
     * Find the best target for an enemy (player or NPC)
     */
    findBestTarget(enemy, player, distToPlayer) {
        // If already chasing an NPC target from raid, keep it
        if (enemy.aiTarget && enemy.aiTarget.alive && enemy.aiTarget !== player) {
            return enemy.aiTarget;
        }

        // Check if player is in aggro range
        if (player && player.alive && distToPlayer < enemy.aggroRange && Math.random() < enemy.aggression) {
            return player;
        }

        // Look for nearby NPC miners to attack
        const entities = this.game.currentSector?.entities || [];
        let closestNPC = null;
        let closestDist = enemy.aggroRange;

        for (const e of entities) {
            if (!e.alive || e.type !== 'npc') continue;
            if (e.role !== 'miner') continue;
            const d = enemy.distanceTo(e);
            if (d < closestDist) {
                closestNPC = e;
                closestDist = d;
            }
        }

        return closestNPC;
    }

    /**
     * Handle idle state
     */
    handleIdleState(enemy, player, distToPlayer) {
        // Check for any target (player or NPC)
        const target = this.findBestTarget(enemy, player, distToPlayer);
        if (target) {
            enemy.setAIState('chase', target);
            return;
        }

        // Transition to patrol
        if (Math.random() < 0.3) {
            this.setNewPatrolPoint(enemy);
            enemy.setAIState('patrol');
        }
    }

    /**
     * Handle patrol state
     */
    handlePatrolState(enemy, player, distToPlayer) {
        // Check for any target
        const target = this.findBestTarget(enemy, player, distToPlayer);
        if (target) {
            enemy.setAIState('chase', target);
            return;
        }

        // Check if reached patrol point
        if (enemy.patrolPoint) {
            const distToPatrol = Math.hypot(
                enemy.x - enemy.patrolPoint.x,
                enemy.y - enemy.patrolPoint.y
            );

            if (distToPatrol < 100) {
                // Pick new patrol point or go idle
                if (Math.random() < 0.5) {
                    this.setNewPatrolPoint(enemy);
                } else {
                    enemy.setAIState('idle');
                }
            } else {
                // Move towards patrol point
                enemy.setDestination(enemy.patrolPoint.x, enemy.patrolPoint.y);
            }
        } else {
            this.setNewPatrolPoint(enemy);
        }
    }

    /**
     * Handle chase state
     */
    handleChaseState(enemy, player, distToPlayer) {
        const target = enemy.aiTarget;

        // Check if should flee
        if (enemy.hull < enemy.maxHull * enemy.fleeThreshold) {
            enemy.setAIState('flee', target);
            return;
        }

        // Validate target
        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            return;
        }

        const distToTarget = enemy.distanceTo(target);

        // Check if target out of range
        if (distToTarget > enemy.aggroRange * 1.5) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            return;
        }

        // Check if in attack range
        if (distToTarget < enemy.attackRange) {
            enemy.setAIState('attack', target);
            return;
        }

        // Chase target
        enemy.setDestination(target.x, target.y);
    }

    /**
     * Handle attack state
     */
    handleAttackState(enemy, player, distToPlayer) {
        const target = enemy.aiTarget;

        // Check if should flee
        if (enemy.hull < enemy.maxHull * enemy.fleeThreshold) {
            enemy.setAIState('flee', target);
            return;
        }

        // Validate target
        if (!target || !target.alive) {
            enemy.aiTarget = null;
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            enemy.deactivateModule('high-1');
            enemy.target = null;
            return;
        }

        const distToTarget = enemy.distanceTo(target);

        // Check if target out of range
        if (distToTarget > enemy.attackRange * 1.2) {
            enemy.setAIState('chase', target);
            return;
        }

        // Lock and fire
        enemy.target = target;

        // Orbit the target
        const orbitAngle = Math.atan2(enemy.y - target.y, enemy.x - target.x);
        const orbitDist = enemy.attackRange * 0.7;

        const targetX = target.x + Math.cos(orbitAngle + 0.1) * orbitDist;
        const targetY = target.y + Math.sin(orbitAngle + 0.1) * orbitDist;

        enemy.setDestination(targetX, targetY);
        enemy.desiredSpeed = enemy.maxSpeed * 0.5;

        // Activate weapons if not already
        if (!enemy.activeModules.has('high-1')) {
            enemy.activateModule('high-1');
        }
    }

    /**
     * Handle flee state
     */
    handleFleeState(enemy, player, distToPlayer) {
        // Deactivate weapons
        enemy.deactivateModule('high-1');
        enemy.target = null;

        // Find what to flee from
        const fleeFrom = enemy.aiTarget || player;

        // Check if safe
        if (!fleeFrom || !fleeFrom.alive) {
            enemy.setAIState('idle');
            return;
        }

        const distToThreat = enemy.distanceTo(fleeFrom);
        if (distToThreat > enemy.aggroRange * 2 || enemy.hull > enemy.maxHull * 0.5) {
            enemy.setAIState('idle');
            return;
        }

        // Run away
        const fleeAngle = Math.atan2(enemy.y - fleeFrom.y, enemy.x - fleeFrom.x);
        const fleeDist = 1000;

        enemy.setDestination(
            enemy.x + Math.cos(fleeAngle) * fleeDist,
            enemy.y + Math.sin(fleeAngle) * fleeDist
        );
        enemy.desiredSpeed = enemy.maxSpeed;
    }

    /**
     * Set a new random patrol point
     */
    setNewPatrolPoint(enemy) {
        const range = 1500;
        enemy.patrolPoint = {
            x: enemy.x + (Math.random() - 0.5) * range * 2,
            y: enemy.y + (Math.random() - 0.5) * range * 2,
        };

        // Clamp to sector bounds
        enemy.patrolPoint.x = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, enemy.patrolPoint.x));
        enemy.patrolPoint.y = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, enemy.patrolPoint.y));
    }

    /**
     * Update movement for all enemies (runs every frame)
     */
    updateMovement(dt) {
        const enemies = this.game.currentSector?.getEnemies() || [];

        for (const enemy of enemies) {
            if (!enemy.alive) continue;

            // Engine trail effect
            if (enemy.currentSpeed > 10) {
                const trailX = enemy.x - Math.cos(enemy.rotation) * enemy.radius;
                const trailY = enemy.y - Math.sin(enemy.rotation) * enemy.radius;

                if (Math.random() < 0.3) {
                    this.game.renderer?.effects.spawn('trail', trailX, trailY, {
                        color: 0xff4444,
                        size: 1,
                        lifetime: 0.3,
                    });
                }
            }
        }
    }
}
