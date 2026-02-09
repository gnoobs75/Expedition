// =============================================
// AI System
// Enemy behavior and decision making
// =============================================

import { CONFIG } from '../config.js';
import { evaluatePursuit, calculateInterceptPoint, activateTackleModules } from '../utils/PursuitAI.js';

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

            case 'pursuing':
                this.handlePursuingState(enemy, player, distToPlayer);
                break;

            case 'intercepting':
                this.handleInterceptingState(enemy, player, distToPlayer);
                break;

            case 'tackling':
                this.handleTacklingState(enemy, player, distToPlayer);
                break;

            case 'disengaging':
                this.handleDisengagingState(enemy, player, distToPlayer);
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

        // Look for nearby NPCs and non-pirate guild ships to attack
        const entities = this.game.currentSector?.entities || [];
        let closestMiner = null;
        let closestMinerDist = enemy.aggroRange;
        let closestNPC = null;
        let closestNPCDist = enemy.aggroRange;

        for (const e of entities) {
            if (!e.alive) continue;

            // Target NPC miners and security
            if (e.type === 'npc') {
                const d = enemy.distanceTo(e);
                if (e.role === 'miner' && d < closestMinerDist) {
                    closestMiner = e;
                    closestMinerDist = d;
                }
                if (e.role === 'security' && d < closestNPCDist) {
                    closestNPC = e;
                    closestNPCDist = d;
                }
            }

            // Also target non-pirate guild ships (miners/haulers preferred)
            if (e.type === 'guild' && !e.isPirate) {
                const d = enemy.distanceTo(e);
                if ((e.role === 'miner' || e.role === 'hauler') && d < closestMinerDist) {
                    closestMiner = e;
                    closestMinerDist = d;
                } else if (e.role === 'ratter' && d < closestNPCDist) {
                    closestNPC = e;
                    closestNPCDist = d;
                }
            }
        }

        // Prefer miners/haulers, fall back to security/ratters
        return closestMiner || closestNPC;
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

        // If target exceeds leash range, transition to pursuit instead of giving up
        if (distToTarget > enemy.aggroRange * 1.5) {
            enemy._chaseStartTime = enemy._chaseStartTime || (Date.now() / 1000);
            enemy.aiState = 'pursuing';
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

        // Activate tackle modules
        activateTackleModules(enemy);

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

        // Try to warp away if not pointed
        if (!enemy.isPointed && enemy.sectorWarpState === 'none' && enemy.sectorWarpCooldown <= 0) {
            const fleeAngle = Math.atan2(enemy.y - fleeFrom.y, enemy.x - fleeFrom.x);
            const warpDist = 3000 + Math.random() * 3000;
            const warpX = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, enemy.x + Math.cos(fleeAngle) * warpDist));
            const warpY = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, enemy.y + Math.sin(fleeAngle) * warpDist));
            enemy.initSectorWarp(warpX, warpY);
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
     * Handle pursuing state — use PursuitAI to decide next action
     */
    handlePursuingState(enemy, player, distToPlayer) {
        const target = enemy.aiTarget;
        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            enemy._chaseStartTime = 0;
            return;
        }

        if (enemy.hull < enemy.maxHull * enemy.fleeThreshold) {
            enemy.setAIState('flee', target);
            return;
        }

        enemy.target = target;
        const result = evaluatePursuit(enemy, target, {
            chaseStartTime: enemy._chaseStartTime || 0,
            currentTime: Date.now() / 1000,
            maxChaseTime: 60,
            homePoint: enemy.patrolPoint,
            maxHomeDistance: enemy.aggroRange * 3,
            allyCount: 0,
        });

        enemy._pursuitReason = result.reason;

        switch (result.decision) {
            case 'tackle':
                enemy.aiState = 'tackling';
                break;
            case 'intercept': {
                const intercept = calculateInterceptPoint(enemy, target);
                if (intercept && enemy.initSectorWarp(intercept.x, intercept.y)) {
                    enemy.aiState = 'intercepting';
                } else {
                    enemy.setDestination(target.x, target.y);
                    enemy.desiredSpeed = enemy.maxSpeed;
                }
                break;
            }
            case 'disengage':
                enemy.aiState = 'disengaging';
                break;
            case 'continue':
            default:
                enemy.setDestination(target.x, target.y);
                enemy.desiredSpeed = enemy.maxSpeed;
                // Back in attack range?
                if (enemy.distanceTo(target) < enemy.attackRange) {
                    enemy.setAIState('attack', target);
                    enemy._chaseStartTime = 0;
                }
                break;
        }
    }

    /**
     * Handle intercepting state — waiting for warp to complete
     */
    handleInterceptingState(enemy, player, distToPlayer) {
        const target = enemy.aiTarget;
        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            return;
        }

        enemy._pursuitReason = 'Warping to intercept';

        if (enemy.sectorWarpState === 'none') {
            const dist = enemy.distanceTo(target);
            if (dist <= enemy.attackRange * 1.5) {
                enemy.setAIState('attack', target);
                enemy._chaseStartTime = 0;
            } else if (dist <= enemy.aggroRange * 2) {
                enemy.aiState = 'pursuing';
            } else {
                enemy.aiState = 'disengaging';
            }
        } else {
            enemy.setDestination(target.x, target.y);
            enemy.desiredSpeed = enemy.maxSpeed * 0.3;
        }
    }

    /**
     * Handle tackling state — keep point on target, orbit close, fire
     */
    handleTacklingState(enemy, player, distToPlayer) {
        const target = enemy.aiTarget;
        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            enemy._chaseStartTime = 0;
            return;
        }

        if (enemy.hull < enemy.maxHull * enemy.fleeThreshold) {
            enemy.setAIState('flee', target);
            return;
        }

        enemy.target = target;
        enemy._pursuitReason = 'Tackling target';

        // Activate tackle modules
        activateTackleModules(enemy);

        const dist = enemy.distanceTo(target);

        // Close orbit
        const orbitAngle = Math.atan2(enemy.y - target.y, enemy.x - target.x);
        const orbitDist = enemy.attackRange * 0.5;
        enemy.setDestination(
            target.x + Math.cos(orbitAngle + 0.1) * orbitDist,
            target.y + Math.sin(orbitAngle + 0.1) * orbitDist
        );
        enemy.desiredSpeed = enemy.maxSpeed * 0.5;

        // Fire weapons
        if (!enemy.activeModules.has('high-1')) {
            enemy.activateModule('high-1');
        }

        // If target breaks free and gets far, go back to pursuing
        if (!target.isPointed && dist > enemy.attackRange * 1.5) {
            enemy._chaseStartTime = Date.now() / 1000;
            enemy.aiState = 'pursuing';
        }
    }

    /**
     * Handle disengaging state — give up chase and return to patrol
     */
    handleDisengagingState(enemy, player, distToPlayer) {
        enemy.deactivateModule('high-1');
        enemy.target = null;
        enemy.aiTarget = null;
        enemy._chaseStartTime = 0;
        enemy._pursuitReason = '';

        enemy.setAIState('patrol');
        this.setNewPatrolPoint(enemy);
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
