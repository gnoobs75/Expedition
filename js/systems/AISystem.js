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
     * Handle idle state
     */
    handleIdleState(enemy, player, distToPlayer) {
        // Check for player in aggro range
        if (distToPlayer < enemy.aggroRange && Math.random() < enemy.aggression) {
            enemy.setAIState('chase', player);
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
        // Check for player in aggro range
        if (distToPlayer < enemy.aggroRange && Math.random() < enemy.aggression) {
            enemy.setAIState('chase', player);
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
        // Check if should flee
        if (enemy.hull < enemy.maxHull * enemy.fleeThreshold) {
            enemy.setAIState('flee', player);
            return;
        }

        // Check if player out of range
        if (distToPlayer > enemy.aggroRange * 1.5) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            return;
        }

        // Check if in attack range
        if (distToPlayer < enemy.attackRange) {
            enemy.setAIState('attack', player);
            return;
        }

        // Chase player
        if (player && player.alive) {
            enemy.setDestination(player.x, player.y);
        }
    }

    /**
     * Handle attack state
     */
    handleAttackState(enemy, player, distToPlayer) {
        // Check if should flee
        if (enemy.hull < enemy.maxHull * enemy.fleeThreshold) {
            enemy.setAIState('flee', player);
            return;
        }

        // Check if player out of range
        if (distToPlayer > enemy.attackRange * 1.2) {
            enemy.setAIState('chase', player);
            return;
        }

        // Lock and fire
        if (player && player.alive) {
            enemy.target = player;

            // Orbit the player
            const orbitAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const orbitDist = enemy.attackRange * 0.7;

            const targetX = player.x + Math.cos(orbitAngle + 0.1) * orbitDist;
            const targetY = player.y + Math.sin(orbitAngle + 0.1) * orbitDist;

            enemy.setDestination(targetX, targetY);
            enemy.desiredSpeed = enemy.maxSpeed * 0.5;

            // Activate weapons if not already
            if (!enemy.activeModules.has('high-1')) {
                enemy.activateModule('high-1');
            }
        }
    }

    /**
     * Handle flee state
     */
    handleFleeState(enemy, player, distToPlayer) {
        // Deactivate weapons
        enemy.deactivateModule('high-1');
        enemy.target = null;

        // Check if safe
        if (distToPlayer > enemy.aggroRange * 2 || enemy.hull > enemy.maxHull * 0.5) {
            enemy.setAIState('idle');
            return;
        }

        // Run away from player
        if (player && player.alive) {
            const fleeAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
            const fleeDist = 1000;

            enemy.setDestination(
                enemy.x + Math.cos(fleeAngle) * fleeDist,
                enemy.y + Math.sin(fleeAngle) * fleeDist
            );
            enemy.desiredSpeed = enemy.maxSpeed;
        }
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
