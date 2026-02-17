// =============================================
// NPC System
// Manages NPC miners, security patrols, and pirate raids
// =============================================

import { CONFIG, UNIVERSE_LAYOUT_MAP } from '../config.js';
import { NPCShip } from '../entities/NPCShip.js';
import { EnemyShip } from '../entities/EnemyShip.js';
import { evaluatePursuit, calculateInterceptPoint, activateTackleModules } from '../utils/PursuitAI.js';
import { FACTIONS, FACTION_TECH_BONUSES, applyFactionOverlay } from '../data/factionDatabase.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';

// Sector faction pools - fallback for sectors without explicit faction
const SECTOR_FACTIONS = {
    tutorial:  ['unef'],
    hub:       ['unef'],
    safe:      ['ruhar', 'unef', 'mavericks'],
    tame:      ['ruhar', 'unef', 'keepers'],
    normal:    ['jeraptha', 'ruhar', 'unef', 'esselgin'],
    neutral:   ['jeraptha', 'esselgin', 'wurgalan'],
    dangerous: ['thuranin', 'bosphuraq', 'kristang', 'wurgalan'],
    deadly:    ['maxolhx', 'thuranin', 'kristang'],
};

// Pick a sector's controlling faction from layout data, or fallback to difficulty pool
function getSectorFaction(sectorId, difficulty) {
    const layoutData = UNIVERSE_LAYOUT_MAP[sectorId];
    if (layoutData?.faction) return layoutData.faction;
    // Fallback: pick from difficulty pool
    const pool = SECTOR_FACTIONS[difficulty] || SECTOR_FACTIONS.medium;
    return pool[Math.floor(Math.random() * pool.length)];
}

// Get the ship class for NPC security based on faction tier
function getFactionSecurityClass(factionId) {
    const bonuses = FACTION_TECH_BONUSES[factionId];
    if (!bonuses) return 'frigate';
    if (bonuses.tierScale >= 1.4) return 'battlecruiser';
    if (bonuses.tierScale >= 1.2) return 'cruiser';
    return 'cruiser';
}

export class NPCSystem {
    constructor(game) {
        this.game = game;

        // AI decision throttling
        this.decisionInterval = 0.5;
        this.decisionTimer = 0;

        // Pirate raid timer
        this.raidTimer = 0;
        this.raidActive = false;

        // Track NPC ships for this sector
        this.miners = [];
        this.security = [];

        // Track which sectors have had NPCs spawned
        this.spawnedSectors = new Set();

        // Track pending timeouts for cleanup on sector change
        this._pendingTimeouts = [];

        // Clear pending timeouts on sector change
        this.game.events.on('sector:change', () => {
            this._pendingTimeouts.forEach(id => clearTimeout(id));
            this._pendingTimeouts = [];
        });
    }

    /**
     * Called when entering a new sector - spawn NPCs
     */
    onSectorEnter(sector) {
        this.miners = [];
        this.security = [];
        this.raidTimer = 0;
        this.raidActive = false;

        // Only spawn NPCs once per sector
        if (!this.spawnedSectors.has(sector.id)) {
            this.spawnedSectors.add(sector.id);
            this.spawnMiners(sector);
            this.spawnSecurity(sector);
        } else {
            // Re-entering sector - find existing NPCs
            for (const entity of sector.entities) {
                if (entity.type === 'npc' && entity.alive) {
                    if (entity.role === 'miner') this.miners.push(entity);
                    if (entity.role === 'security') this.security.push(entity);
                }
            }
        }
    }

    /**
     * Spawn miner NPCs for the sector
     */
    spawnMiners(sector) {
        const config = CONFIG.NPC_MINERS[sector.difficulty];
        if (!config || config.count === 0) return;

        const station = sector.getStation();
        const asteroids = sector.getAsteroids();
        if (asteroids.length === 0) return;

        // Pick faction for this sector's NPCs
        const sectorFaction = sector.controllingFaction || getSectorFaction(sector.id, sector.difficulty);
        if (!sector.controllingFaction) sector.controllingFaction = sectorFaction;
        const factionData = FACTIONS[sectorFaction];
        const prefix = factionData?.shipPrefix || 'NPC';

        for (let i = 0; i < config.count; i++) {
            // Pick a random asteroid field to start near
            const targetAsteroid = asteroids[Math.floor(Math.random() * asteroids.length)];

            const miner = new NPCShip(this.game, {
                x: targetAsteroid.x + (Math.random() - 0.5) * 500,
                y: targetAsteroid.y + (Math.random() - 0.5) * 500,
                role: 'miner',
                shipClass: config.shipClass,
                droneCount: config.droneCount,
                homeStation: station,
                name: `${prefix} Mining ${i + 1}`,
                faction: sectorFaction,
            });

            sector.addEntity(miner);
            this.miners.push(miner);

            // Start in mining state
            miner.aiState = 'mining';
        }
    }

    /**
     * Spawn security patrol NPCs
     */
    spawnSecurity(sector) {
        const config = CONFIG.NPC_SECURITY[sector.difficulty];
        if (!config || config.count === 0) return;

        const station = sector.getStation();
        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        for (let i = 0; i < config.count; i++) {
            // Spread security around the sector
            const angle = (i / config.count) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 4000 + Math.random() * 4000;

            const secFaction = sector.controllingFaction || getSectorFaction(sector.id, sector.difficulty);
            const secFactionData = FACTIONS[secFaction];
            const secPrefix = secFactionData?.shipPrefix || 'SEC';

            const sec = new NPCShip(this.game, {
                x: centerX + Math.cos(angle) * dist,
                y: centerY + Math.sin(angle) * dist,
                role: 'security',
                shipClass: config.shipClass,
                homeStation: station,
                name: `${secPrefix} Patrol ${i + 1}`,
                faction: secFaction,
            });

            // Set patrol center
            sec.patrolCenter = { x: sec.x, y: sec.y };

            // Fit tackle modules
            if (sec.midSlots >= 2) sec.fitModule('mid-2', 'warp-scrambler');
            if (sec.midSlots >= 3) sec.fitModule('mid-3', 'stasis-webifier');

            sector.addEntity(sec);
            this.security.push(sec);

            // Start patrolling
            sec.aiState = 'patrol';
        }
    }

    /**
     * Main update loop
     */
    update(dt) {
        const sector = this.game.currentSector;
        if (!sector) return;

        // Clean dead NPCs (in-place to avoid per-frame array allocation)
        for (let i = this.miners.length - 1; i >= 0; i--) {
            if (!this.miners[i].alive) this.miners.splice(i, 1);
        }
        for (let i = this.security.length - 1; i >= 0; i--) {
            if (!this.security[i].alive) this.security.splice(i, 1);
        }

        // Throttle decisions
        this.decisionTimer += dt;
        const makeDecision = this.decisionTimer >= this.decisionInterval;
        if (makeDecision) {
            this.decisionTimer = 0;
        }

        // Update miners
        for (const miner of this.miners) {
            if (!miner.alive) continue;
            if (makeDecision) {
                this.updateMinerAI(miner, dt);
            }
            this.updateMinerMovement(miner, dt);
        }

        // Update security
        for (const sec of this.security) {
            if (!sec.alive) continue;
            if (makeDecision) {
                this.updateSecurityAI(sec, dt);
            }
            this.updateNPCMovement(sec, dt);
        }

        // Pirate raid timer
        this.updateRaidTimer(dt, sector);
    }

    // =========================================
    // MINER AI
    // =========================================

    updateMinerAI(miner, dt) {
        switch (miner.aiState) {
            case 'mining':
                this.minerMiningState(miner);
                break;
            case 'returning':
                this.minerReturningState(miner);
                break;
            case 'docked':
                this.minerDockedState(miner);
                break;
            case 'fleeing':
                this.minerFleeingState(miner);
                break;
            case 'idle':
            default:
                miner.aiState = 'mining';
                break;
        }
    }

    /**
     * Miner is looking for/mining asteroids
     */
    minerMiningState(miner) {
        // Check for threats
        if (this.checkMinerThreats(miner)) return;

        // Launch drones if not already
        if (!miner.dronesLaunched && miner.droneBay.drones.length > 0) {
            miner.launchAllDrones();
            miner.dronesLaunched = true;
            // Command drones to mine
            this._pendingTimeouts.push(setTimeout(() => {
                if (miner.alive) {
                    miner.commandDrones('mine');
                }
            }, 500));
        }

        // Check if cargo is full - return to station
        if (miner.cargoUsed >= miner.cargoCapacity * 0.9) {
            miner.aiState = 'returning';
            // Recall drones before heading back
            miner.recallAllDrones();
            miner.dronesLaunched = false;
            return;
        }

        // Find an asteroid to mine
        if (!miner.miningTarget || !miner.miningTarget.alive || miner.miningTarget.ore <= 0) {
            const asteroids = this.game.currentSector?.getAsteroids() || [];
            let closest = null;
            let closestDist = Infinity;

            for (const ast of asteroids) {
                if (ast.ore <= 0) continue;
                const d = miner.distanceTo(ast);
                if (d < closestDist) {
                    closest = ast;
                    closestDist = d;
                }
            }

            miner.miningTarget = closest;
            if (!closest) {
                // No asteroids - just idle
                miner.aiState = 'idle';
                return;
            }
        }

        // Navigate to asteroid
        const dist = miner.distanceTo(miner.miningTarget);
        if (dist > CONFIG.MINING_RANGE) {
            miner.setDestination(miner.miningTarget.x, miner.miningTarget.y);
        } else {
            // In range - slow down and mine
            miner.desiredSpeed = 0;

            // Lock target and activate mining laser
            miner.target = miner.miningTarget;
            if (!miner.activeModules.has('high-1')) {
                miner.activateModule('high-1');
            }
        }
    }

    /**
     * Miner is returning to station to sell ore
     */
    minerReturningState(miner) {
        // Check for threats
        if (this.checkMinerThreats(miner)) return;

        const station = miner.homeStation;
        if (!station || !station.alive) {
            // No station - just clear cargo and resume mining
            miner.clearCargo();
            miner.aiState = 'mining';
            return;
        }

        const dist = miner.distanceTo(station);

        if (dist < station.dockingRange) {
            // Arrived at station - "dock" (sell ore, repair)
            miner.aiState = 'docked';
            miner.dockingCooldown = 3 + Math.random() * 2; // 3-5s docked
            miner.desiredSpeed = 0;

            // Sell ore
            const value = miner.getCargoValue();
            if (value > 0) {
                miner.clearCargo();
            }

            // Repair
            miner.shield = miner.maxShield;
            miner.armor = miner.maxArmor;
            miner.hull = miner.maxHull;

            // Make miner invisible while docked
            miner.visible = false;
        } else {
            // Navigate to station
            miner.setDestination(station.x, station.y);
        }
    }

    /**
     * Miner is docked at station (waiting to undock)
     */
    minerDockedState(miner) {
        if (miner.dockingCooldown <= 0) {
            // Undock and go back to mining
            miner.visible = true;

            // Position outside station
            if (miner.homeStation) {
                const angle = Math.random() * Math.PI * 2;
                miner.x = miner.homeStation.x + Math.cos(angle) * (miner.homeStation.radius + 100);
                miner.y = miner.homeStation.y + Math.sin(angle) * (miner.homeStation.radius + 100);
            }

            miner.miningTarget = null;
            miner.aiState = 'mining';
        }
    }

    /**
     * Miner is fleeing from threats
     */
    minerFleeingState(miner) {
        // Deactivate mining
        miner.deactivateModule('high-1');
        miner.target = null;

        // Recall drones
        if (miner.dronesLaunched) {
            miner.recallAllDrones();
            miner.dronesLaunched = false;
        }

        // Check if threat is gone
        const threats = this.findThreatsNear(miner, 2000);
        if (threats.length === 0) {
            // Safe - return to mining
            miner.aiState = 'mining';
            return;
        }

        // Flee toward station
        const station = miner.homeStation;
        if (station && station.alive) {
            miner.setDestination(station.x, station.y);
            miner.desiredSpeed = miner.maxSpeed;

            // If at station, dock
            if (miner.distanceTo(station) < station.dockingRange) {
                miner.aiState = 'returning';
            }
        } else {
            // No station - flee away from threats
            const threat = threats[0];
            const fleeAngle = Math.atan2(miner.y - threat.y, miner.x - threat.x);
            miner.setDestination(
                miner.x + Math.cos(fleeAngle) * 2000,
                miner.y + Math.sin(fleeAngle) * 2000
            );
            miner.desiredSpeed = miner.maxSpeed;
        }
    }

    /**
     * Check for threats near a miner, transition to fleeing if found
     */
    checkMinerThreats(miner) {
        const threats = this.findThreatsNear(miner, 1200);
        if (threats.length > 0) {
            miner.aiState = 'fleeing';
            return true;
        }
        return false;
    }

    /**
     * Update miner per-frame movement (engine trail, etc)
     */
    updateMinerMovement(miner, dt) {
        if (miner.currentSpeed > 10 && Math.random() < 0.15) {
            const trailX = miner.x - Math.cos(miner.rotation) * miner.radius;
            const trailY = miner.y - Math.sin(miner.rotation) * miner.radius;
            this.game.renderer?.effects.spawn('trail', trailX, trailY, {
                color: 0x88ccff,
                size: 1,
                lifetime: 0.3,
            });
        }
    }

    // =========================================
    // SECURITY AI
    // =========================================

    updateSecurityAI(sec, dt) {
        switch (sec.aiState) {
            case 'patrol':
                this.securityPatrolState(sec);
                break;
            case 'responding':
                this.securityRespondingState(sec);
                break;
            case 'engaging':
                this.securityEngagingState(sec);
                break;
            case 'pursuing':
                this.securityPursuingState(sec);
                break;
            case 'intercepting':
                this.securityInterceptingState(sec);
                break;
            case 'tackling':
                this.securityTacklingState(sec);
                break;
            case 'disengaging':
                this.securityDisengagingState(sec);
                break;
            case 'returning':
                this.securityReturningState(sec);
                break;
            default:
                sec.aiState = 'patrol';
                break;
        }
    }

    /**
     * Security is patrolling its area
     */
    securityPatrolState(sec) {
        // Scan for hostiles
        const hostiles = this.findHostilesNear(sec, sec.aggroRange);
        if (hostiles.length > 0) {
            sec.aiTarget = hostiles[0];
            sec.aiState = 'responding';
            return;
        }

        // Check if player has attacked any NPCs (aggro check)
        if (this.isPlayerAggressive(sec)) {
            sec.aiTarget = this.game.player;
            sec.aiState = 'responding';
            return;
        }

        // Move along patrol route
        if (!sec.patrolPoint || this.distSq(sec, sec.patrolPoint) < 10000) {
            this.setSecurityPatrolPoint(sec);
        }

        sec.setDestination(sec.patrolPoint.x, sec.patrolPoint.y);
    }

    /**
     * Security is responding to a threat (moving to engage)
     */
    securityRespondingState(sec) {
        if (!sec.aiTarget || !sec.aiTarget.alive) {
            sec.aiState = 'returning';
            sec.aiTarget = null;
            return;
        }

        const dist = sec.distanceTo(sec.aiTarget);

        if (dist < sec.attackRange) {
            sec.aiState = 'engaging';
        } else if (dist > sec.aggroRange * 1.5) {
            // Target is far — switch to pursuit mode
            sec._chaseStartTime = sec._chaseStartTime || (Date.now() / 1000);
            sec.aiState = 'pursuing';
        } else {
            sec.setDestination(sec.aiTarget.x, sec.aiTarget.y);
            sec.desiredSpeed = sec.maxSpeed;
        }
    }

    /**
     * Security is actively engaging a hostile
     */
    securityEngagingState(sec) {
        if (!sec.aiTarget || !sec.aiTarget.alive) {
            sec.aiTarget = null;
            sec.aiState = 'returning';
            sec.deactivateModule('high-1');
            sec.target = null;
            sec._chaseStartTime = 0;
            return;
        }

        // Check if should flee
        if (sec.hull < sec.maxHull * 0.15) {
            sec.aiState = 'returning';
            sec.deactivateModule('high-1');
            sec.target = null;
            return;
        }

        const dist = sec.distanceTo(sec.aiTarget);

        if (dist > sec.attackRange * 1.5) {
            // Target getting away — transition to pursuit
            sec._chaseStartTime = sec._chaseStartTime || (Date.now() / 1000);
            sec.aiState = 'pursuing';
            return;
        }

        // Orbit and fire
        sec.target = sec.aiTarget;

        // Activate tackle modules
        activateTackleModules(sec);

        const orbitAngle = Math.atan2(sec.y - sec.aiTarget.y, sec.x - sec.aiTarget.x);
        const orbitDist = sec.attackRange * 0.7;
        sec.setDestination(
            sec.aiTarget.x + Math.cos(orbitAngle + 0.1) * orbitDist,
            sec.aiTarget.y + Math.sin(orbitAngle + 0.1) * orbitDist
        );
        sec.desiredSpeed = sec.maxSpeed * 0.5;

        // Activate weapons
        if (!sec.activeModules.has('high-1')) {
            sec.activateModule('high-1');
        }

        // Activate shield booster when damaged
        if (sec.shield < sec.maxShield * 0.7 && !sec.activeModules.has('mid-1')) {
            sec.activateModule('mid-1');
        }
    }

    /**
     * Security is pursuing a fleeing target
     */
    securityPursuingState(sec) {
        if (!sec.aiTarget || !sec.aiTarget.alive) {
            sec.aiState = 'returning';
            sec.aiTarget = null;
            sec._chaseStartTime = 0;
            return;
        }

        if (sec.hull < sec.maxHull * 0.15) {
            sec.aiState = 'returning';
            sec._chaseStartTime = 0;
            return;
        }

        sec.target = sec.aiTarget;
        const result = evaluatePursuit(sec, sec.aiTarget, {
            chaseStartTime: sec._chaseStartTime || 0,
            currentTime: Date.now() / 1000,
            maxChaseTime: 90, // Security is more persistent
            homePoint: sec.patrolCenter,
            maxHomeDistance: (sec.patrolRadius || 3000) * 2,
            allyCount: this.security.filter(s => s.alive && s !== sec).length,
        });

        sec._pursuitReason = result.reason;

        switch (result.decision) {
            case 'tackle':
                sec.aiState = 'tackling';
                break;
            case 'intercept': {
                const intercept = calculateInterceptPoint(sec, sec.aiTarget);
                if (intercept && sec.initSectorWarp(intercept.x, intercept.y)) {
                    sec.aiState = 'intercepting';
                } else {
                    sec.setDestination(sec.aiTarget.x, sec.aiTarget.y);
                    sec.desiredSpeed = sec.maxSpeed;
                }
                break;
            }
            case 'disengage':
                sec.aiState = 'disengaging';
                break;
            case 'continue':
            default:
                sec.setDestination(sec.aiTarget.x, sec.aiTarget.y);
                sec.desiredSpeed = sec.maxSpeed;
                if (sec.distanceTo(sec.aiTarget) < sec.attackRange) {
                    sec.aiState = 'engaging';
                    sec._chaseStartTime = 0;
                }
                break;
        }
    }

    /**
     * Security waiting for warp intercept to complete
     */
    securityInterceptingState(sec) {
        if (!sec.aiTarget || !sec.aiTarget.alive) {
            sec.aiState = 'returning';
            sec._chaseStartTime = 0;
            return;
        }

        sec._pursuitReason = 'Warping to intercept';

        if (sec.sectorWarpState === 'none') {
            const dist = sec.distanceTo(sec.aiTarget);
            if (dist <= sec.attackRange * 1.5) {
                sec.aiState = 'engaging';
                sec._chaseStartTime = 0;
            } else if (dist <= sec.aggroRange * 2) {
                sec.aiState = 'pursuing';
            } else {
                sec.aiState = 'disengaging';
            }
        } else {
            sec.setDestination(sec.aiTarget.x, sec.aiTarget.y);
            sec.desiredSpeed = sec.maxSpeed * 0.3;
        }
    }

    /**
     * Security tackling a hostile — orbit close with point + weapons
     */
    securityTacklingState(sec) {
        if (!sec.aiTarget || !sec.aiTarget.alive) {
            sec.aiState = 'returning';
            sec.aiTarget = null;
            sec._chaseStartTime = 0;
            return;
        }

        if (sec.hull < sec.maxHull * 0.15) {
            sec.aiState = 'returning';
            return;
        }

        sec.target = sec.aiTarget;
        sec._pursuitReason = 'Tackling target';

        activateTackleModules(sec);

        const orbitAngle = Math.atan2(sec.y - sec.aiTarget.y, sec.x - sec.aiTarget.x);
        const orbitDist = sec.attackRange * 0.5;
        sec.setDestination(
            sec.aiTarget.x + Math.cos(orbitAngle + 0.1) * orbitDist,
            sec.aiTarget.y + Math.sin(orbitAngle + 0.1) * orbitDist
        );
        sec.desiredSpeed = sec.maxSpeed * 0.5;

        if (!sec.activeModules.has('high-1')) {
            sec.activateModule('high-1');
        }

        // If target breaks free
        const dist = sec.distanceTo(sec.aiTarget);
        if (!sec.aiTarget.isPointed && dist > sec.attackRange * 1.5) {
            sec._chaseStartTime = Date.now() / 1000;
            sec.aiState = 'pursuing';
        }
    }

    /**
     * Security disengaging — return to patrol
     */
    securityDisengagingState(sec) {
        sec.deactivateModule('high-1');
        sec.target = null;
        sec.aiTarget = null;
        sec._chaseStartTime = 0;
        sec._pursuitReason = '';
        sec.aiState = 'returning';
    }

    /**
     * Security is returning to patrol area after engagement
     */
    securityReturningState(sec) {
        sec.deactivateModule('high-1');
        sec.target = null;

        // Check for new threats on the way back
        const hostiles = this.findHostilesNear(sec, sec.aggroRange);
        if (hostiles.length > 0) {
            sec.aiTarget = hostiles[0];
            sec.aiState = 'responding';
            return;
        }

        // Head back to patrol center
        const dist = this.distSq(sec, sec.patrolCenter);
        if (dist < 250000) { // 500 units
            sec.aiState = 'patrol';
        } else {
            sec.setDestination(sec.patrolCenter.x, sec.patrolCenter.y);
        }
    }

    /**
     * Update NPC movement per-frame (engine trails)
     */
    updateNPCMovement(npc, dt) {
        if (npc.currentSpeed > 10 && Math.random() < 0.2) {
            const trailX = npc.x - Math.cos(npc.rotation) * npc.radius;
            const trailY = npc.y - Math.sin(npc.rotation) * npc.radius;
            this.game.renderer?.effects.spawn('trail', trailX, trailY, {
                color: npc.role === 'security' ? 0x4488ff : 0x88ccff,
                size: 1,
                lifetime: 0.3,
            });
        }
    }

    // =========================================
    // PIRATE RAIDS
    // =========================================

    updateRaidTimer(dt, sector) {
        const raidConfig = CONFIG.NPC_PIRATE_RAIDS[sector.difficulty];
        if (!raidConfig || raidConfig.chance === 0) return;

        this.raidTimer += dt;

        if (this.raidTimer >= raidConfig.interval) {
            this.raidTimer = 0;

            // Chance-based raid spawn
            if (Math.random() < raidConfig.chance) {
                this.spawnPirateRaid(sector, raidConfig);
            }
        }
    }

    /**
     * Spawn a pirate raid targeting miners
     */
    spawnPirateRaid(sector, raidConfig) {
        const aliveMiners = this.miners.filter(m => m.alive && m.visible);
        if (aliveMiners.length === 0) return;

        // Pick a random miner as the target
        const targetMiner = aliveMiners[Math.floor(Math.random() * aliveMiners.length)];

        // Spawn 1-maxPirates pirates near the miner
        const count = 1 + Math.floor(Math.random() * raidConfig.maxPirates);
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnDist = 2000 + Math.random() * 1000;

        this.game.ui?.log(`Pirate activity detected on sensors!`, 'combat');
        this.game.ui?.toast('Pirate raid detected!', 'error');
        this.broadcastSecurityAlert(targetMiner);

        // Pirate radio chatter (random chance)
        if (Math.random() < 0.5 && this.game.dialogueManager) {
            const chatter = [
                "All units, move in on that miner. Strip the cargo and scrap the hull.",
                "Easy pickings today, boys. That mining barge doesn't stand a chance.",
                "Intel says security is spread thin. Hit 'em fast, grab what you can.",
                "Target acquired. Remember - leave no witnesses.",
            ];
            this._pendingTimeouts.push(setTimeout(() => {
                this.game.dialogueManager.open({
                    name: 'Pirate Comms',
                    title: 'Intercepted Transmission',
                    portrait: '☠',
                    color: '#ff4444',
                    text: chatter[Math.floor(Math.random() * chatter.length)],
                    options: [{ label: 'Close channel', action: 'close' }],
                });
            }, 1000));
        }

        for (let i = 0; i < count; i++) {
            const angle = spawnAngle + (i - count / 2) * 0.3;
            const enemyType = Math.random() > 0.8 ? 'pirate-cruiser' : 'pirate-frigate';

            // Assign hostile faction to pirates
            const pirateFactions = ['kristang', 'bosphuraq', 'thuranin'];
            const pirateFaction = pirateFactions[Math.floor(Math.random() * pirateFactions.length)];
            const piratePrefix = FACTIONS[pirateFaction]?.shipPrefix || 'PIR';

            const pirate = new EnemyShip(this.game, {
                x: targetMiner.x + Math.cos(angle) * spawnDist,
                y: targetMiner.y + Math.sin(angle) * spawnDist,
                enemyType,
                name: `${piratePrefix} Raider ${i + 1}`,
                faction: pirateFaction,
            });

            // Set AI to chase the miner (or player if nearby)
            pirate.aiState = 'chase';
            pirate.aiTarget = targetMiner;

            sector.addEntity(pirate);
        }
    }

    /**
     * Spawn a large-scale battle event for stress testing
     * 25 security vs 25 pirates in an asteroid belt, fighting to the death
     */
    spawnBattleEvent() {
        const sector = this.game.currentSector;
        if (!sector) return;

        // Find an asteroid belt away from the station
        const asteroids = sector.getAsteroids();
        if (asteroids.length === 0) return;

        // Pick a cluster of asteroids to use as the battle site
        const battleCenter = asteroids[Math.floor(Math.random() * asteroids.length)];
        const bx = battleCenter.x;
        const by = battleCenter.y;

        this.game.ui?.log('[SYSTEM EVENT] Large-scale engagement initiated!', 'system');
        this.game.ui?.toast('BATTLE EVENT: 25 Security vs 25 Pirates spawned!', 'warning');
        this.broadcastSecurityAlert(battleCenter);

        const station = sector.getStation();
        const securityTypes = ['frigate', 'cruiser'];
        const pirateTypes = ['pirate-frigate', 'pirate-cruiser'];
        const spawnedSecurity = [];
        const spawnedPirates = [];

        // Spawn 25 security ships on one side
        for (let i = 0; i < 25; i++) {
            const angle = (i / 25) * Math.PI * 2;
            const dist = 800 + Math.random() * 600;
            const shipClass = securityTypes[Math.random() < 0.4 ? 1 : 0]; // 40% cruiser, 60% frigate

            const sec = new NPCShip(this.game, {
                x: bx - 1500 + Math.cos(angle) * dist,
                y: by + Math.sin(angle) * dist,
                role: 'security',
                shipClass,
                homeStation: station,
                name: `Task Force ${i + 1}`,
            });
            sec.patrolCenter = { x: bx, y: by };
            sec.aiState = 'patrol';
            sector.addEntity(sec);
            this.security.push(sec);
            spawnedSecurity.push(sec);
        }

        // Spawn 25 pirate ships on the other side
        for (let i = 0; i < 25; i++) {
            const angle = (i / 25) * Math.PI * 2;
            const dist = 800 + Math.random() * 600;
            const enemyType = pirateTypes[Math.random() < 0.3 ? 1 : 0]; // 30% cruiser, 70% frigate

            const pirate = new EnemyShip(this.game, {
                x: bx + 1500 + Math.cos(angle) * dist,
                y: by + Math.sin(angle) * dist,
                enemyType,
                name: `Raider ${i + 1}`,
            });

            // Target the nearest security ship
            pirate.aiState = 'chase';
            pirate.aiTarget = spawnedSecurity[i % spawnedSecurity.length];
            pirate.aggroRange = 5000;

            sector.addEntity(pirate);
            spawnedPirates.push(pirate);
        }

        // Point security at the pirate group
        for (let i = 0; i < spawnedSecurity.length; i++) {
            const sec = spawnedSecurity[i];
            sec.aiState = 'responding';
            sec.aiTarget = spawnedPirates[i % spawnedPirates.length];
        }
    }

    /**
     * Broadcast a security alert about pirate activity
     */
    broadcastSecurityAlert(nearEntity) {
        const alerts = [
            'SECURITY ALERT: Hostile contacts detected. All vessels exercise caution.',
            'CONCORD ADVISORY: Pirate activity reported. Security forces responding.',
            'LOCAL SECURITY: Multiple hostiles on scan. Mining vessels advised to dock.',
            'SYSTEM BROADCAST: Unauthorized combat signatures detected. Patrol units dispatched.',
            'SECURITY NOTICE: Hostile fleet activity in asteroid belt. Stay alert.',
        ];
        const msg = alerts[Math.floor(Math.random() * alerts.length)];
        this.game.ui?.toast(msg, 'warning');
        this.game.ui?.log(`[LOCAL] ${msg}`, 'system');
    }

    // =========================================
    // HELPERS
    // =========================================

    /**
     * Find hostile entities (pirates/enemies) near a position
     */
    findHostilesNear(entity, range) {
        const entities = this.game.currentSector?.entities || [];
        const rangeSq = range * range;
        const hostiles = [];

        for (const e of entities) {
            if (!e.alive) continue;
            // Enemy ships and pirate guild ships are both hostile
            const isHostile = e.type === 'enemy' || (e.type === 'guild' && e.isPirate);
            if (!isHostile) continue;
            const dx = e.x - entity.x;
            const dy = e.y - entity.y;
            if (dx * dx + dy * dy < rangeSq) {
                hostiles.push(e);
            }
        }

        return hostiles;
    }

    /**
     * Find threats (enemies) near an entity
     */
    findThreatsNear(entity, range) {
        return this.findHostilesNear(entity, range);
    }

    /**
     * Check if the player has recently attacked any NPC
     * Uses a simple flag on the game object
     */
    isPlayerAggressive(sec) {
        if (!this.game.playerAggressive) return false;
        if (!this.game.player?.alive) return false;

        const dist = sec.distanceTo(this.game.player);
        return dist < sec.aggroRange;
    }

    /**
     * Set a patrol point for security within their patrol radius
     */
    setSecurityPatrolPoint(sec) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * sec.patrolRadius;

        sec.patrolPoint = {
            x: sec.patrolCenter.x + Math.cos(angle) * dist,
            y: sec.patrolCenter.y + Math.sin(angle) * dist,
        };

        // Clamp to sector bounds
        sec.patrolPoint.x = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, sec.patrolPoint.x));
        sec.patrolPoint.y = Math.max(500, Math.min(CONFIG.SECTOR_SIZE - 500, sec.patrolPoint.y));
    }

    /**
     * Squared distance helper
     */
    distSq(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }
}
