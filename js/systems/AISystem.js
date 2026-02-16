// =============================================
// AI System
// Profile-aware enemy behavior, FC coordination,
// threat assessment, and NPC chat callouts
// =============================================

import { CONFIG } from '../config.js';
import { evaluatePursuit, calculateInterceptPoint, activateTackleModules } from '../utils/PursuitAI.js';

// AI behavior profiles with parameter overrides
const AI_PROFILES = {
    brawler:  { preferredRange: 0.5,  fleeHpPct: 0.15, orbitSpeed: 0.6, aggressionMod: 1.2, style: 'close' },
    kiter:    { preferredRange: 0.8,  fleeHpPct: 0.25, orbitSpeed: 0.8, aggressionMod: 1.0, style: 'range' },
    sniper:   { preferredRange: 0.95, fleeHpPct: 0.30, orbitSpeed: 0.4, aggressionMod: 0.8, style: 'range' },
    tackler:  { preferredRange: 0.4,  fleeHpPct: 0.20, orbitSpeed: 0.9, aggressionMod: 1.3, style: 'close' },
    logi:     { preferredRange: 0.7,  fleeHpPct: 0.40, orbitSpeed: 0.5, aggressionMod: 0.3, style: 'support' },
    coward:   { preferredRange: 0.9,  fleeHpPct: 0.60, orbitSpeed: 0.7, aggressionMod: 0.1, style: 'flee' },
};

// Faction-specific combat dialogue
const FACTION_DIALOGUE = {
    kristang:  { engage: ["Your death brings honor!", "For the Kristang!"], flee: ["This isn't over!"], kill: ["Another weakling falls!"], taunt: ["You dare challenge us?"] },
    jeraptha:  { engage: ["This is bad for business..."], flee: ["A tactical withdrawal."], kill: ["A profit in every battle."], taunt: ["Nothing personal, just commerce."] },
    ruhar:     { engage: ["Sorry about this!"], flee: ["No hard feelings, right?"], kill: ["That was... unfortunate."], taunt: ["We don't want trouble!"] },
    thuranin:  { engage: ["Inferior species detected."], flee: ["Recalculating..."], kill: ["As predicted."], taunt: ["Resistance is illogical."] },
    bosphuraq: { engage: ["Prey spotted!"], flee: ["Repositioning!"], kill: ["The hunt is over."], taunt: ["You cannot escape!"] },
    unef:      { engage: ["Weapons free!"], flee: ["Fall back!"], kill: ["Target neutralized."], taunt: ["Stand down!"] },
    mavericks: { engage: ["Skippy says hi!"], flee: ["Beer run after this!"], kill: ["That's what you get!"], taunt: ["Come get some!"] },
    maxolhx:   { engage: ["Insignificant vermin."], flee: ["This changes nothing."], kill: ["As expected of lesser beings."], taunt: ["Know your place."] },
    esselgin:  { engage: ["Engaging target."], flee: ["Withdrawing."], kill: ["Efficient elimination."], taunt: ["You are outmatched."] },
    wurgalan:  { engage: ["Multiple vectors locked!"], flee: ["Disengaging!"], kill: ["Target dissolved."], taunt: ["Eight arms, no mercy!"] },
    keepers:   { engage: ["By the faith!"], flee: ["The faithful endure!"], kill: ["Divine justice!"], taunt: ["Repent!"] },
};

function getProfile(enemy) {
    return AI_PROFILES[enemy.aiProfile] || AI_PROFILES.brawler;
}

function pickDialogue(faction, category) {
    const lines = FACTION_DIALOGUE[faction]?.[category];
    if (!lines || lines.length === 0) return null;
    return lines[Math.floor(Math.random() * lines.length)];
}

export class AISystem {
    constructor(game) {
        this.game = game;

        // AI update throttling
        this.updateInterval = 0.5;
        this.timeSinceUpdate = 0;

        // FC coordination - groups of same-faction NPCs
        this._fcGroups = new Map(); // factionId -> { fc, members[], primaryTarget }
        this._fcUpdateTimer = 0;

        // Chat cooldown per entity
        this._chatCooldowns = new Map(); // entityId -> lastChatTime
    }

    /**
     * Update all AI entities
     */
    update(dt) {
        this.timeSinceUpdate += dt;

        if (this.timeSinceUpdate < this.updateInterval) {
            this.updateMovement(dt);
            return;
        }

        this.timeSinceUpdate = 0;

        const enemies = this.game.currentSector?.getEnemies() || [];
        const player = this.game.player;

        // Update FC groups every 2 seconds
        this._fcUpdateTimer += this.updateInterval;
        if (this._fcUpdateTimer >= 2.0) {
            this._fcUpdateTimer = 0;
            this._updateFCGroups(enemies);
        }

        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            this.updateAI(enemy, player, dt);
        }
    }

    /**
     * Build FC groups from same-faction enemies (3+ to elect FC)
     */
    _updateFCGroups(enemies) {
        this._fcGroups.clear();

        // Group by faction
        const factionGroups = {};
        for (const e of enemies) {
            if (!e.alive || !e.faction) continue;
            if (!factionGroups[e.faction]) factionGroups[e.faction] = [];
            factionGroups[e.faction].push(e);
        }

        for (const [faction, members] of Object.entries(factionGroups)) {
            if (members.length < 3) continue;

            // Elect FC: highest EHP ship
            let fc = members[0];
            let bestEhp = 0;
            for (const m of members) {
                const ehp = (m.getEffectiveHp ? m.getEffectiveHp() : m.maxShield + m.maxArmor + m.maxHull) || 0;
                if (ehp > bestEhp) {
                    bestEhp = ehp;
                    fc = m;
                }
            }

            // FC calls primary target - pick most damaged or most threatening
            let primary = null;
            if (fc.aiTarget && fc.aiTarget.alive) {
                primary = fc.aiTarget;
            }

            this._fcGroups.set(faction, { fc, members, primaryTarget: primary });
        }
    }

    /**
     * Get FC-called primary target for an enemy's faction
     */
    _getFCTarget(enemy) {
        const group = this._fcGroups.get(enemy.faction);
        if (!group || !group.primaryTarget?.alive) return null;
        return group.primaryTarget;
    }

    /**
     * Calculate threat level of a target relative to self
     */
    _threatLevel(self, target) {
        const selfDps = self.getDps ? self.getDps() : 20;
        const selfEhp = self.getEffectiveHp ? self.getEffectiveHp() : (self.maxShield + self.maxArmor + self.maxHull);
        const targetDps = target.getDps ? target.getDps() : 20;
        const targetEhp = target.getEffectiveHp ? target.getEffectiveHp() : (target.maxShield + target.maxArmor + target.maxHull);

        if (selfDps * selfEhp === 0) return 999;
        return (targetDps * targetEhp) / (selfDps * selfEhp);
    }

    /**
     * Emit NPC chat event with cooldown
     */
    _emitChat(enemy, category, channel = 'combat') {
        const now = Date.now();
        const lastChat = this._chatCooldowns.get(enemy.id) || 0;
        if (now - lastChat < 5000) return; // 5s cooldown

        // 10% chance per trigger
        if (Math.random() > 0.10) return;

        const text = pickDialogue(enemy.faction, category);
        if (!text) return;

        this._chatCooldowns.set(enemy.id, now);

        const factionData = window.__FACTIONS?.[enemy.faction];
        this.game.events?.emit('npc:chat', {
            entity: enemy,
            text,
            channel,
            color: factionData?.color || '#aaaaaa',
            bubble: true,
        });
    }

    /**
     * Update AI decision for a single enemy
     */
    updateAI(enemy, player, dt) {
        const playerValid = player && player.alive;
        const distToPlayer = playerValid ? enemy.distanceTo(player) : Infinity;

        // Profile-adjusted flee threshold
        const profile = getProfile(enemy);
        const fleeThreshold = profile.fleeHpPct;

        switch (enemy.aiState) {
            case 'idle':
                this.handleIdleState(enemy, player, distToPlayer);
                break;
            case 'patrol':
                this.handlePatrolState(enemy, player, distToPlayer);
                break;
            case 'chase':
                this.handleChaseState(enemy, player, distToPlayer, fleeThreshold);
                break;
            case 'attack':
                this.handleAttackState(enemy, player, distToPlayer, fleeThreshold);
                break;
            case 'flee':
                this.handleFleeState(enemy, player, distToPlayer);
                break;
            case 'pursuing':
                this.handlePursuingState(enemy, player, distToPlayer, fleeThreshold);
                break;
            case 'intercepting':
                this.handleInterceptingState(enemy, player, distToPlayer);
                break;
            case 'tackling':
                this.handleTacklingState(enemy, player, distToPlayer, fleeThreshold);
                break;
            case 'disengaging':
                this.handleDisengagingState(enemy, player, distToPlayer);
                break;
            case 'regroup':
                this.handleRegroupState(enemy, player, distToPlayer);
                break;
            default:
                enemy.aiState = 'idle';
        }
    }

    /**
     * Find the best target - with FC coordination and threat assessment
     */
    findBestTarget(enemy, player, distToPlayer) {
        const profile = getProfile(enemy);

        // Cowards don't initiate combat
        if (profile.style === 'flee') return null;

        // FC-called primary takes priority
        const fcTarget = this._getFCTarget(enemy);
        if (fcTarget && fcTarget.alive && enemy.distanceTo(fcTarget) < enemy.aggroRange * 1.5) {
            return fcTarget;
        }

        // If already chasing an NPC target from raid, keep it
        if (enemy.aiTarget && enemy.aiTarget.alive && enemy.aiTarget !== player) {
            return enemy.aiTarget;
        }

        // Check player with profile-adjusted aggression
        if (player && player.alive && distToPlayer < enemy.aggroRange) {
            const adjustedAggression = enemy.aggression * profile.aggressionMod;
            if (Math.random() < adjustedAggression) {
                // Threat check - cowardly/logi profiles avoid strong targets
                if (profile.style === 'support') return null;
                const threat = this._threatLevel(enemy, player);
                if (threat > 3.0 && profile.fleeHpPct > 0.2) return null; // Too dangerous
                return player;
            }
        }

        // Look for nearby NPCs
        const entities = this.game.currentSector?.entities || [];
        const candidates = [];

        for (const e of entities) {
            if (!e.alive || e === enemy) continue;
            const d = enemy.distanceTo(e);
            if (d > enemy.aggroRange) continue;

            if (e.type === 'npc' && (e.role === 'miner' || e.role === 'security')) {
                const priority = e.role === 'miner' ? 2 : 1;
                candidates.push({ target: e, dist: d, priority });
            }
            if (e.type === 'guild' && !e.isPirate) {
                const priority = (e.role === 'miner' || e.role === 'hauler') ? 2 : 1;
                candidates.push({ target: e, dist: d, priority });
            }
        }

        if (candidates.length === 0) return null;

        // Focus fire scoring
        const enemies = this.game.currentSector?.getEnemies() || [];
        for (const c of candidates) {
            let allyCount = 0;
            for (const ally of enemies) {
                if (ally !== enemy && ally.alive && ally.aiTarget === c.target) allyCount++;
            }
            c.focusScore = c.priority + allyCount * 3;
            const hpPct = (c.target.shield + c.target.armor + c.target.hull) /
                (c.target.maxShield + c.target.maxArmor + c.target.maxHull);
            c.focusScore += (1 - hpPct) * 2;
        }

        candidates.sort((a, b) => b.focusScore - a.focusScore || a.dist - b.dist);
        return candidates[0].target;
    }

    /**
     * Logi profile: find lowest-HP ally to heal
     */
    _findLogiTarget(enemy) {
        const group = this._fcGroups.get(enemy.faction);
        if (!group) return null;

        let lowestHpAlly = null;
        let lowestPct = 1;

        for (const ally of group.members) {
            if (ally === enemy || !ally.alive) continue;
            const hpPct = (ally.shield + ally.armor + ally.hull) /
                (ally.maxShield + ally.maxArmor + ally.maxHull);
            if (hpPct < lowestPct && hpPct < 0.7) {
                lowestPct = hpPct;
                lowestHpAlly = ally;
            }
        }
        return lowestHpAlly;
    }

    // ============================================
    // State handlers
    // ============================================

    handleIdleState(enemy, player, distToPlayer) {
        const profile = getProfile(enemy);

        // Logi looks for allies to heal
        if (profile.style === 'support') {
            const healTarget = this._findLogiTarget(enemy);
            if (healTarget) {
                enemy.aiTarget = healTarget;
                enemy.setAIState('attack', healTarget);
                return;
            }
        }

        const target = this.findBestTarget(enemy, player, distToPlayer);
        if (target) {
            enemy.setAIState('chase', target);
            this._emitChat(enemy, 'engage');
            return;
        }

        if (Math.random() < 0.3) {
            this.setNewPatrolPoint(enemy);
            enemy.setAIState('patrol');
        }
    }

    handlePatrolState(enemy, player, distToPlayer) {
        const target = this.findBestTarget(enemy, player, distToPlayer);
        if (target) {
            enemy.setAIState('chase', target);
            this._emitChat(enemy, 'engage');
            return;
        }

        if (enemy.patrolPoint) {
            const distToPatrol = Math.hypot(enemy.x - enemy.patrolPoint.x, enemy.y - enemy.patrolPoint.y);
            if (distToPatrol < 100) {
                if (Math.random() < 0.5) {
                    this.setNewPatrolPoint(enemy);
                } else {
                    enemy.setAIState('idle');
                }
            } else {
                enemy.setDestination(enemy.patrolPoint.x, enemy.patrolPoint.y);
            }
        } else {
            this.setNewPatrolPoint(enemy);
        }
    }

    handleChaseState(enemy, player, distToPlayer, fleeThreshold) {
        const target = enemy.aiTarget;

        if (enemy.hull < enemy.maxHull * fleeThreshold) {
            enemy.setAIState('flee', target);
            this._emitChat(enemy, 'flee');
            return;
        }

        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            return;
        }

        const distToTarget = enemy.distanceTo(target);

        if (distToTarget > enemy.aggroRange * 1.5) {
            enemy._chaseStartTime = enemy._chaseStartTime || (Date.now() / 1000);
            enemy.aiState = 'pursuing';
            return;
        }

        if (distToTarget < enemy.attackRange) {
            enemy.setAIState('attack', target);
            return;
        }

        enemy.setDestination(target.x, target.y);
    }

    handleAttackState(enemy, player, distToPlayer, fleeThreshold) {
        const target = enemy.aiTarget;
        const profile = getProfile(enemy);

        // FC group retreat check: >50% losses triggers regroup
        const group = this._fcGroups.get(enemy.faction);
        if (group && group.members.length >= 3) {
            const alive = group.members.filter(m => m.alive).length;
            if (alive < group.members.length * 0.5) {
                enemy.setAIState('flee', target);
                this._emitChat(enemy, 'flee');
                return;
            }
        }

        if (enemy.hull < enemy.maxHull * fleeThreshold) {
            enemy.setAIState('flee', target);
            this._emitChat(enemy, 'flee');
            return;
        }

        if (!target || !target.alive) {
            enemy.aiTarget = null;
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            enemy.deactivateModule('high-1');
            enemy.target = null;
            this._emitChat(enemy, 'kill');
            return;
        }

        const distToTarget = enemy.distanceTo(target);

        if (distToTarget > enemy.attackRange * 1.2) {
            enemy.setAIState('chase', target);
            return;
        }

        // Lock and fire
        enemy.target = target;

        // Tackle if profile is tackler, or general tackle
        if (profile.style === 'close' || enemy.aiProfile === 'tackler') {
            activateTackleModules(enemy);
        }

        // Profile-driven combat positioning
        const idealDist = enemy.attackRange * profile.preferredRange;
        const angleFromTarget = Math.atan2(enemy.y - target.y, enemy.x - target.x);

        if (profile.style === 'range') {
            // Kiter/sniper: maintain preferred range
            if (distToTarget < idealDist * 0.6) {
                enemy.setDestination(
                    enemy.x + Math.cos(angleFromTarget) * idealDist,
                    enemy.y + Math.sin(angleFromTarget) * idealDist
                );
                enemy.desiredSpeed = enemy.maxSpeed;
            } else if (distToTarget > idealDist * 1.15) {
                enemy.setDestination(
                    target.x + Math.cos(angleFromTarget) * idealDist,
                    target.y + Math.sin(angleFromTarget) * idealDist
                );
                enemy.desiredSpeed = enemy.maxSpeed * 0.7;
            } else {
                const orbitAngle = angleFromTarget + 0.08;
                enemy.setDestination(
                    target.x + Math.cos(orbitAngle) * idealDist,
                    target.y + Math.sin(orbitAngle) * idealDist
                );
                enemy.desiredSpeed = enemy.maxSpeed * profile.orbitSpeed;
            }
        } else if (profile.style === 'support') {
            // Logi: orbit ally at medium range
            const orbitAngle = angleFromTarget + 0.06;
            enemy.setDestination(
                target.x + Math.cos(orbitAngle) * idealDist,
                target.y + Math.sin(orbitAngle) * idealDist
            );
            enemy.desiredSpeed = enemy.maxSpeed * 0.5;
        } else {
            // Brawler/tackler: close orbit
            const orbitAngle = angleFromTarget + 0.1;
            const orbitDist = enemy.attackRange * profile.preferredRange;
            enemy.setDestination(
                target.x + Math.cos(orbitAngle) * orbitDist,
                target.y + Math.sin(orbitAngle) * orbitDist
            );
            enemy.desiredSpeed = enemy.maxSpeed * profile.orbitSpeed;
        }

        // Periodic taunt
        this._emitChat(enemy, 'taunt');

        if (!enemy.activeModules.has('high-1')) {
            enemy.activateModule('high-1');
        }
    }

    handleFleeState(enemy, player, distToPlayer) {
        enemy.deactivateModule('high-1');
        enemy.target = null;

        const fleeFrom = enemy.aiTarget || player;

        if (!fleeFrom || !fleeFrom.alive) {
            enemy.setAIState('idle');
            return;
        }

        const distToThreat = enemy.distanceTo(fleeFrom);
        const profile = getProfile(enemy);
        if (distToThreat > enemy.aggroRange * 2 || enemy.hull > enemy.maxHull * 0.5) {
            // Cowards stay fled, others regroup
            if (profile.style !== 'flee' && this._fcGroups.has(enemy.faction)) {
                enemy.aiState = 'regroup';
            } else {
                enemy.setAIState('idle');
            }
            return;
        }

        // Try warp if not pointed
        if (!enemy.isPointed && enemy.sectorWarpState === 'none' && enemy.sectorWarpCooldown <= 0) {
            const fleeAngle = Math.atan2(enemy.y - fleeFrom.y, enemy.x - fleeFrom.x);
            const warpDist = 3000 + Math.random() * 3000;
            const warpX = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, enemy.x + Math.cos(fleeAngle) * warpDist));
            const warpY = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, enemy.y + Math.sin(fleeAngle) * warpDist));
            enemy.initSectorWarp(warpX, warpY);
        }

        const fleeAngle = Math.atan2(enemy.y - fleeFrom.y, enemy.x - fleeFrom.x);
        enemy.setDestination(
            enemy.x + Math.cos(fleeAngle) * 1000,
            enemy.y + Math.sin(fleeAngle) * 1000
        );
        enemy.desiredSpeed = enemy.maxSpeed;
    }

    /**
     * Handle regroup state — return to FC or ally cluster
     */
    handleRegroupState(enemy, player, distToPlayer) {
        const group = this._fcGroups.get(enemy.faction);
        if (!group || !group.fc?.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            return;
        }

        const distToFC = enemy.distanceTo(group.fc);
        if (distToFC < 300) {
            // Regrouped, re-engage if FC has target
            if (group.primaryTarget?.alive) {
                enemy.setAIState('chase', group.primaryTarget);
            } else {
                enemy.setAIState('patrol');
                this.setNewPatrolPoint(enemy);
            }
        } else {
            enemy.setDestination(group.fc.x, group.fc.y);
            enemy.desiredSpeed = enemy.maxSpeed;
        }
    }

    handlePursuingState(enemy, player, distToPlayer, fleeThreshold) {
        const target = enemy.aiTarget;
        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            enemy._chaseStartTime = 0;
            return;
        }

        if (enemy.hull < enemy.maxHull * fleeThreshold) {
            enemy.setAIState('flee', target);
            this._emitChat(enemy, 'flee');
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
                if (enemy.distanceTo(target) < enemy.attackRange) {
                    enemy.setAIState('attack', target);
                    enemy._chaseStartTime = 0;
                }
                break;
        }
    }

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

    handleTacklingState(enemy, player, distToPlayer, fleeThreshold) {
        const target = enemy.aiTarget;
        if (!target || !target.alive) {
            enemy.setAIState('patrol');
            this.setNewPatrolPoint(enemy);
            enemy._chaseStartTime = 0;
            return;
        }

        if (enemy.hull < enemy.maxHull * fleeThreshold) {
            enemy.setAIState('flee', target);
            return;
        }

        enemy.target = target;
        enemy._pursuitReason = 'Tackling target';

        activateTackleModules(enemy);

        const dist = enemy.distanceTo(target);
        const orbitAngle = Math.atan2(enemy.y - target.y, enemy.x - target.x);
        const orbitDist = enemy.attackRange * 0.5;
        enemy.setDestination(
            target.x + Math.cos(orbitAngle + 0.1) * orbitDist,
            target.y + Math.sin(orbitAngle + 0.1) * orbitDist
        );
        enemy.desiredSpeed = enemy.maxSpeed * 0.5;

        if (!enemy.activeModules.has('high-1')) {
            enemy.activateModule('high-1');
        }

        if (!target.isPointed && dist > enemy.attackRange * 1.5) {
            enemy._chaseStartTime = Date.now() / 1000;
            enemy.aiState = 'pursuing';
        }
    }

    handleDisengagingState(enemy, player, distToPlayer) {
        enemy.deactivateModule('high-1');
        enemy.target = null;
        enemy.aiTarget = null;
        enemy._chaseStartTime = 0;
        enemy._pursuitReason = '';

        enemy.setAIState('patrol');
        this.setNewPatrolPoint(enemy);
    }

    setNewPatrolPoint(enemy) {
        const range = 1500;
        enemy.patrolPoint = {
            x: enemy.x + (Math.random() - 0.5) * range * 2,
            y: enemy.y + (Math.random() - 0.5) * range * 2,
        };
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
