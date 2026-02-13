// =============================================
// Guild Ship Entity
// Autonomous faction ships that mine, haul, and
// hunt pirates across sectors. Materializes as a
// full Ship entity when in the player's sector.
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { TRADE_GOODS } from '../data/tradeGoodsDatabase.js';
import { PIRATE_FACTION_ID, isFactionHostile } from '../data/guildFactionDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { wrappedDistance, wrappedDirection } from '../utils/math.js';
import { Wreck } from './Wreck.js';
import { evaluatePursuit, calculateInterceptPoint, activateTackleModules } from '../utils/PursuitAI.js';

let guildIdCounter = 0;

export class GuildShip extends Ship {
    constructor(game, options = {}) {
        const shipClass = options.shipClass || 'venture';
        const shipConfig = SHIP_DATABASE[shipClass] || CONFIG.SHIPS[shipClass] || CONFIG.SHIPS.frigate;

        super(game, {
            ...shipConfig,
            ...options,
            name: options.name || 'Guild Ship',
            color: options.factionColor ? parseInt(options.factionColor.slice(1), 16) : CONFIG.COLORS.neutral,
            highSlots: shipConfig.weaponSlots || shipConfig.highSlots || 3,
            midSlots: shipConfig.moduleSlots || shipConfig.midSlots || 2,
            lowSlots: shipConfig.subsystemSlots || shipConfig.lowSlots || 2,
        });

        this.type = 'guild';
        this.isPlayer = false;
        this.shipClass = shipClass;

        // Guild identity
        this.guildId = options.guildId || `guild-${++guildIdCounter}`;
        this.factionId = options.factionId || '';
        this.factionColor = options.factionColor || '#888888';
        this.role = options.role || 'miner'; // miner, hauler, ratter, raider, bomber
        this.isPirate = this.factionId === PIRATE_FACTION_ID;
        this.hostility = this.isPirate ? 'hostile' : 'neutral';

        // AI state
        this.aiState = options.aiState || 'idle';
        this.currentTask = options.currentTask || null;
        this.homeStation = options.homeStation !== undefined ? options.homeStation : 'hub';

        // Cross-sector navigation
        this.sectorPath = [];
        this.pathIndex = 0;
        this.targetGate = null;

        // Combat
        this.aggroRange = 1500;
        this.attackRange = 600;
        this.engagedTarget = null;
        this.fleeThreshold = 0.20;

        // Pursuit tracking
        this._chaseStartTime = 0;
        this._pursuitReason = '';

        // Mining
        this.miningTarget = null;

        // Trade cargo (trade goods, separate from ore)
        // Ship.js already has this.tradeGoods = {}

        // Docking
        this.dockingCooldown = 0;
        this.docked = false;

        // Bounty/loot - pirates have bounties based on ship value
        if (this.isPirate) {
            const shipData = SHIP_DATABASE[this.shipClass];
            const baseValue = shipData?.price || 5000;
            this.bounty = Math.floor(baseValue * (0.15 + Math.random() * 0.15));
        } else {
            this.bounty = 0;
        }
        this.lootValue = { min: 50, max: 300 };

        // Setup loadout
        this.setupLoadout();
    }

    setupLoadout() {
        switch (this.role) {
            case 'miner':
                this.fitModule('high-1', 'mining-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'mining-laser');
                this.fitModule('mid-1', 'shield-booster');
                break;
            case 'hauler':
                this.fitModule('high-1', 'small-laser');
                this.fitModule('mid-1', 'shield-booster');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'afterburner');
                break;
            case 'ratter':
                this.fitModule('high-1', 'small-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'small-laser');
                if (this.highSlots >= 3) this.fitModule('high-3', 'small-laser');
                this.fitModule('mid-1', 'shield-booster');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'warp-disruptor');
                break;
            case 'raider':
                this.fitModule('high-1', 'small-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'small-laser');
                this.fitModule('mid-1', 'microwarpdrive');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'warp-scrambler');
                if (this.midSlots >= 3) this.fitModule('mid-3', 'stasis-webifier');
                break;
            case 'bomber':
                this.fitModule('high-1', 'small-laser');
                if (this.highSlots >= 2) this.fitModule('high-2', 'small-laser');
                if (this.highSlots >= 3) this.fitModule('high-3', 'small-laser');
                this.fitModule('mid-1', 'shield-booster');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'stasis-webifier');
                this.fitModule('low-1', 'damage-mod');
                break;
            case 'surveyor':
                this.fitModule('mid-1', 'survey-scanner-1');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'afterburner');
                if (this.highSlots >= 1) this.fitModule('high-1', 'small-laser');
                break;
            case 'logistics':
                this.fitModule('mid-1', 'remote-shield-repairer');
                if (this.midSlots >= 2) this.fitModule('mid-2', 'remote-armor-repairer');
                if (this.midSlots >= 3) this.fitModule('mid-3', 'afterburner');
                this.fitModule('high-1', 'small-laser');
                break;
        }
    }

    /**
     * Create a GuildShip from abstract state data
     */
    static createFromAbstract(game, abs) {
        const ship = new GuildShip(game, {
            x: abs.x,
            y: abs.y,
            guildId: abs.guildId,
            factionId: abs.factionId,
            factionColor: abs.factionColor,
            role: abs.role,
            shipClass: abs.shipClass,
            name: abs.name,
            aiState: abs.aiState,
            currentTask: abs.currentTask,
            homeStation: abs.homeStation,
        });

        // Restore HP
        ship.shield = abs.shield;
        ship.armor = abs.armor;
        ship.hull = abs.hull;

        // Restore trade cargo
        if (abs.tradeGoods) {
            ship.tradeGoods = { ...abs.tradeGoods };
            // Recalculate cargoUsed from trade goods
            let used = 0;
            for (const [goodId, qty] of Object.entries(ship.tradeGoods)) {
                const good = TRADE_GOODS[goodId];
                if (good) used += qty * good.volume;
            }
            ship.cargoUsed = used;
        }

        // Restore ore cargo
        if (abs.cargo) {
            ship.cargo = { ...abs.cargo };
            for (const data of Object.values(ship.cargo)) {
                ship.cargoUsed += data.volume || 0;
            }
        }

        // Restore sector path
        if (abs.sectorPath) {
            ship.sectorPath = [...abs.sectorPath];
            ship.pathIndex = abs.pathIndex || 0;
        }

        return ship;
    }

    /**
     * Sync current state to abstract representation
     */
    syncToAbstract() {
        return {
            guildId: this.guildId,
            factionId: this.factionId,
            factionColor: this.factionColor,
            role: this.role,
            shipClass: this.shipClass,
            name: this.name,
            sectorId: this.game.currentSector?.id || this.homeStation || 'sector-4',
            x: this.x,
            y: this.y,
            aiState: ['pursuing', 'intercepting', 'tackling', 'disengaging'].includes(this.aiState)
                ? 'engaging'
                : this.aiState === 'traveling-to-gate' ? 'traveling' : this.aiState,
            currentTask: this.currentTask,
            homeStation: this.homeStation,
            shield: this.shield,
            armor: this.armor,
            hull: this.hull,
            maxShield: this.maxShield,
            maxArmor: this.maxArmor,
            maxHull: this.maxHull,
            tradeGoods: { ...this.tradeGoods },
            cargo: { ...this.cargo },
            cargoUsed: this.cargoUsed,
            cargoCapacity: this.cargoCapacity,
            sectorPath: [...this.sectorPath],
            pathIndex: this.pathIndex,
        };
    }

    update(dt) {
        if (!this.alive) return;
        super.update(dt);

        if (this.dockingCooldown > 0) {
            this.dockingCooldown -= dt;
        }
    }

    /**
     * AI tick - called by GuildEconomySystem at throttled rate
     */
    aiUpdate(dt) {
        if (!this.alive || this.docked) return;

        // Check for critical HP - flee
        const hullPercent = this.hull / this.maxHull;
        if (hullPercent <= this.fleeThreshold && this.aiState !== 'fleeing') {
            this.aiState = 'fleeing';
            this.engagedTarget = null;
            this.target = null;
            this.deactivateAllModules();
        }

        switch (this.aiState) {
            case 'idle':
                // Wait for task assignment from faction AI
                this.desiredSpeed = 0;
                break;
            case 'traveling':
            case 'traveling-to-gate':
                this.aiTravel();
                break;
            case 'mining':
                this.aiMine();
                break;
            case 'trading-buy':
                this.aiTradeBuy();
                break;
            case 'trading-sell':
                this.aiTradeSell();
                break;
            case 'returning':
                this.aiReturn();
                break;
            case 'ratting':
                this.aiRat();
                break;
            case 'raiding':
                this.aiRaid();
                break;
            case 'engaging':
                this.aiEngage();
                break;
            case 'pursuing':
                this.aiPursue();
                break;
            case 'intercepting':
                this.aiIntercept();
                break;
            case 'tackling':
                this.aiTackle();
                break;
            case 'disengaging':
                this.aiDisengage();
                break;
            case 'surveying':
                this.aiSurvey();
                break;
            case 'repairing':
                this.aiRepairAlly();
                break;
            case 'docking':
                this.aiDock();
                break;
            case 'fleeing':
                this.aiFlee();
                break;
        }
    }

    // =========================================
    // AI STATES
    // =========================================

    /**
     * Navigate toward gate for cross-sector travel
     */
    aiTravel() {
        if (!this.sectorPath || this.pathIndex >= this.sectorPath.length) {
            // Arrived at destination sector - execute task
            this.onArrivedAtDestination();
            return;
        }

        const nextSector = this.sectorPath[this.pathIndex];

        // Find gate to next sector
        if (!this.targetGate) {
            const gates = this.game.currentSector?.getGates?.() || [];
            for (const gate of gates) {
                if (gate.destinationSectorId === nextSector) {
                    this.targetGate = gate;
                    break;
                }
            }
        }

        if (!this.targetGate) {
            // Can't find gate - go idle
            this.aiState = 'idle';
            this.currentTask = null;
            return;
        }

        const dist = this.distanceTo(this.targetGate);
        if (dist < 200) {
            // At gate - jump through (dematerialization handled by GuildEconomySystem)
            this.game.guildEconomySystem?.handleGuildShipGateJump(this, nextSector);
        } else {
            this.setDestination(this.targetGate.x, this.targetGate.y);
            this.desiredSpeed = this.maxSpeed;
        }
    }

    /**
     * Called when ship arrives at its destination sector
     */
    onArrivedAtDestination() {
        this.sectorPath = [];
        this.pathIndex = 0;
        this.targetGate = null;

        if (!this.currentTask) {
            this.aiState = 'idle';
            return;
        }

        switch (this.currentTask.type) {
            case 'mine':
                this.aiState = 'mining';
                break;
            case 'haul':
                if (this.currentTask.stage === 'go-to-buy') {
                    this.aiState = 'trading-buy';
                } else {
                    this.aiState = 'trading-sell';
                }
                break;
            case 'hunt':
                this.aiState = 'ratting';
                break;
            case 'raid':
                this.aiState = 'raiding';
                break;
            default:
                this.aiState = 'idle';
        }
    }

    /**
     * Mine asteroids in current sector
     */
    aiMine() {
        // Check cargo full -> return home
        if (this.cargoUsed >= this.cargoCapacity * 0.9) {
            this.aiState = 'returning';
            this.miningTarget = null;
            this.deactivateAllModules();
            return;
        }

        // Find asteroid to mine
        if (!this.miningTarget || !this.miningTarget.alive || this.miningTarget.ore <= 0) {
            const asteroids = this.game.currentSector?.getAsteroids?.() || [];
            let closest = null;
            let closestDist = Infinity;
            for (const ast of asteroids) {
                if (ast.ore <= 0) continue;
                const d = this.distanceTo(ast);
                if (d < closestDist) { closest = ast; closestDist = d; }
            }
            this.miningTarget = closest;
            if (!closest) {
                // No asteroids - go idle
                this.aiState = 'idle';
                this.currentTask = null;
                return;
            }
        }

        const dist = this.distanceTo(this.miningTarget);
        if (dist > CONFIG.MINING_RANGE) {
            this.setDestination(this.miningTarget.x, this.miningTarget.y);
            this.desiredSpeed = this.maxSpeed * 0.7;
        } else {
            this.desiredSpeed = 0;
            this.target = this.miningTarget;
            // Activate mining lasers
            for (let i = 0; i < this.highSlots; i++) {
                const slotId = `high-${i + 1}`;
                const moduleId = this.modules.high[i];
                if (moduleId && moduleId.includes('mining')) {
                    if (!this.activeModules.has(slotId)) {
                        this.activateModule(slotId);
                    }
                }
            }
        }
    }

    /**
     * Navigate to station and buy trade goods
     */
    aiTradeBuy() {
        const station = this.game.currentSector?.getStation?.();
        if (!station) { this.aiState = 'idle'; return; }

        const dist = this.distanceTo(station);
        if (dist < station.dockingRange) {
            // At station - buy goods
            this.game.guildEconomySystem?.handleGuildShipBuy(this, station);
        } else {
            this.setDestination(station.x, station.y);
            this.desiredSpeed = this.maxSpeed;
        }
    }

    /**
     * Navigate to station and sell trade goods
     */
    aiTradeSell() {
        const station = this.game.currentSector?.getStation?.();
        if (!station) { this.aiState = 'idle'; return; }

        const dist = this.distanceTo(station);
        if (dist < station.dockingRange) {
            // At station - sell goods
            this.game.guildEconomySystem?.handleGuildShipSell(this, station);
        } else {
            this.setDestination(station.x, station.y);
            this.desiredSpeed = this.maxSpeed;
        }
    }

    /**
     * Return to home station (sell ore, repair)
     */
    aiReturn() {
        const station = this.game.currentSector?.getStation?.();
        if (!station) {
            // Need to travel to home sector
            const sys = this.game.guildEconomySystem;
            if (sys) {
                const path = sys.findPath(this.game.currentSector?.id, this.homeStation);
                if (path && path.length > 0) {
                    this.sectorPath = path;
                    this.pathIndex = 0;
                    this.targetGate = null;
                    this.aiState = 'traveling';
                    return;
                }
            }
            this.aiState = 'idle';
            return;
        }

        const dist = this.distanceTo(station);
        if (dist < station.dockingRange) {
            // Dock - sell ore, repair
            this.game.guildEconomySystem?.handleGuildShipDock(this, station);
        } else {
            this.setDestination(station.x, station.y);
            this.desiredSpeed = this.maxSpeed;
        }
    }

    /**
     * Hunt pirates in current sector (also targets pirate guild ships)
     */
    aiRat() {
        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.engagedTarget = null;
            this.target = null;

            const entities = this.game.getEntities();
            let closest = null;
            let closestDist = Infinity;
            for (const e of entities) {
                if (!e.alive) continue;
                // Target enemy ships AND hostile guild ships (pirates)
                const isHostile = e.type === 'enemy' ||
                    (e.type === 'guild' && e.isPirate && e.factionId !== this.factionId);
                if (!isHostile) continue;
                const d = this.distanceTo(e);
                if (d < this.aggroRange && d < closestDist) {
                    closest = e;
                    closestDist = d;
                }
            }

            if (closest) {
                this.engagedTarget = closest;
                this.aiState = 'engaging';
            } else {
                // Patrol
                if (!this._patrolTarget || wrappedDistance(this.x, this.y, this._patrolTarget.x, this._patrolTarget.y, CONFIG.SECTOR_SIZE) < 500) {
                    this._patrolTarget = {
                        x: 5000 + Math.random() * (CONFIG.SECTOR_SIZE - 10000),
                        y: 5000 + Math.random() * (CONFIG.SECTOR_SIZE - 10000),
                    };
                }
                this.setDestination(this._patrolTarget.x, this._patrolTarget.y);
                this.desiredSpeed = this.maxSpeed * 0.5;
            }
        } else {
            this.aiState = 'engaging';
        }
    }

    /**
     * Pirate raid AI - hunt guild miners, haulers, and the player
     */
    aiRaid() {
        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.engagedTarget = null;
            this.target = null;

            const entities = this.game.getEntities();
            let bestTarget = null;
            let bestPriority = -1;
            let bestDist = Infinity;

            for (const e of entities) {
                if (!e.alive || e === this) continue;

                let priority = -1;
                // Target guild miners/haulers (high priority)
                if (e.type === 'guild' && !e.isPirate) {
                    if (e.role === 'miner') priority = 3;
                    else if (e.role === 'hauler') priority = 2;
                    else if (e.role === 'ratter') priority = 1; // Avoid ratters unless nothing else
                }
                // Target NPC miners
                if (e.type === 'npc' && e.role === 'miner') priority = 3;
                // Target player (medium priority)
                if (e.isPlayer) priority = 2;

                if (priority < 0) continue;

                const d = this.distanceTo(e);
                if (d < this.aggroRange && (priority > bestPriority || (priority === bestPriority && d < bestDist))) {
                    bestTarget = e;
                    bestPriority = priority;
                    bestDist = d;
                }
            }

            if (bestTarget) {
                this.engagedTarget = bestTarget;
                this.aiState = 'engaging';
            } else {
                // Prowl - wander around looking for targets
                if (!this._patrolTarget || wrappedDistance(this.x, this.y, this._patrolTarget.x, this._patrolTarget.y, CONFIG.SECTOR_SIZE) < 500) {
                    this._patrolTarget = {
                        x: 5000 + Math.random() * (CONFIG.SECTOR_SIZE - 10000),
                        y: 5000 + Math.random() * (CONFIG.SECTOR_SIZE - 10000),
                    };
                }
                this.setDestination(this._patrolTarget.x, this._patrolTarget.y);
                this.desiredSpeed = this.maxSpeed * 0.7;
            }
        } else {
            this.aiState = 'engaging';
        }
    }

    /**
     * Engage a hostile target
     */
    aiEngage() {
        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.engagedTarget = null;
            this.target = null;
            this.deactivateAllModules();
            this._chaseStartTime = 0;
            // Return to previous activity
            if (this.currentTask?.type === 'hunt') this.aiState = 'ratting';
            else if (this.currentTask?.type === 'raid') this.aiState = 'raiding';
            else this.aiState = 'idle';
            return;
        }

        this.target = this.engagedTarget;
        const dist = this.distanceTo(this.engagedTarget);

        // If target is far, transition to pursuit
        if (dist > this.attackRange * 1.5) {
            this._chaseStartTime = this._chaseStartTime || (Date.now() / 1000);
            this.aiState = 'pursuing';
            return;
        }

        // Activate tackle modules
        activateTackleModules(this);

        if (dist > this.attackRange) {
            // Approach
            const angle = this.directionTo(this.engagedTarget);
            this.desiredRotation = angle;
            this.desiredSpeed = this.maxSpeed;
        } else {
            // Orbit and fire
            const currentAngle = wrappedDirection(
                this.engagedTarget.x, this.engagedTarget.y,
                this.x, this.y, CONFIG.SECTOR_SIZE
            );
            const tangent = currentAngle + Math.PI / 2;
            this.desiredRotation = tangent;
            this.desiredSpeed = this.maxSpeed * 0.5;

            // Activate weapons
            for (let i = 0; i < this.highSlots; i++) {
                const slotId = `high-${i + 1}`;
                const moduleId = this.modules.high[i];
                if (moduleId && moduleId.includes('laser') && !moduleId.includes('mining')) {
                    if (!this.activeModules.has(slotId)) {
                        this.activateModule(slotId);
                    }
                }
            }

            // Activate shield booster if damaged
            if (this.shield < this.maxShield * 0.7 && !this.activeModules.has('mid-1')) {
                this.activateModule('mid-1');
            }
        }
    }

    /**
     * Dock at a station (invisible while docked)
     */
    aiDock() {
        if (this.dockingCooldown <= 0) {
            // Undock
            this.docked = false;
            this.visible = true;
            const station = this.game.currentSector?.getStation?.();
            if (station) {
                const angle = Math.random() * Math.PI * 2;
                this.x = station.x + Math.cos(angle) * (station.radius + 150);
                this.y = station.y + Math.sin(angle) * (station.radius + 150);
            }
            // Resume task or go idle
            if (this.currentTask) {
                this.onArrivedAtDestination();
            } else {
                this.aiState = 'idle';
            }
        }
    }

    /**
     * Flee to nearest station, using sector warp if not pointed
     */
    aiFlee() {
        const station = this.game.currentSector?.getStation?.();
        if (station) {
            const dist = this.distanceTo(station);
            if (dist < station.dockingRange) {
                // Dock for repairs
                this.game.guildEconomySystem?.handleGuildShipDock(this, station);
                return;
            }

            // Try to warp to station if not pointed and far enough
            if (!this.isPointed && dist > 1000 && this.sectorWarpState === 'none' && this.sectorWarpCooldown <= 0) {
                this.initSectorWarp(station.x, station.y);
            }

            this.setDestination(station.x, station.y);
        } else {
            // No station - flee to random safe point
            if (!this._fleeTarget) {
                const angle = Math.random() * Math.PI * 2;
                const fleeDist = 5000 + Math.random() * 5000;
                this._fleeTarget = {
                    x: Math.max(1000, Math.min(CONFIG.SECTOR_SIZE - 1000, this.x + Math.cos(angle) * fleeDist)),
                    y: Math.max(1000, Math.min(CONFIG.SECTOR_SIZE - 1000, this.y + Math.sin(angle) * fleeDist)),
                };
            }
            this.setDestination(this._fleeTarget.x, this._fleeTarget.y);
        }

        // Activate MWD if fitted and pointed (can't warp, go fast instead)
        if (this.isPointed) {
            for (let i = 0; i < this.midSlots; i++) {
                const moduleId = this.modules.mid[i];
                if (moduleId && moduleId.startsWith('microwarpdrive')) {
                    const slotId = `mid-${i + 1}`;
                    if (!this.activeModules.has(slotId)) {
                        this.activateModule(slotId);
                    }
                    break;
                }
            }
        }

        this.desiredSpeed = this.maxSpeed;
    }

    // =========================================
    // SURVEYOR & LOGISTICS AI
    // =========================================

    /**
     * Surveyor AI: Fly to asteroid fields, activate survey scanner, report results
     */
    aiSurvey() {
        // Find nearest asteroid cluster to scan
        if (!this._surveyTarget) {
            const entities = this.game.currentSector?.entities || [];
            let closest = null;
            let closestDist = Infinity;
            for (const e of entities) {
                if (e.type !== 'asteroid' || !e.alive) continue;
                const d = this.distanceTo(e);
                if (d < closestDist) {
                    closestDist = d;
                    closest = e;
                }
            }
            if (closest) {
                this._surveyTarget = { x: closest.x, y: closest.y };
            } else {
                // No asteroids, wander
                this._surveyTarget = {
                    x: CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 8000,
                    y: CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 8000,
                };
            }
        }

        const dx = this._surveyTarget.x - this.x;
        const dy = this._surveyTarget.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 500) {
            // In position - activate survey scanner
            this.desiredSpeed = 0;
            for (let i = 0; i < this.midSlots; i++) {
                const moduleId = this.modules.mid[i];
                if (moduleId && moduleId.includes('survey-scanner')) {
                    const slotId = `mid-${i + 1}`;
                    if (!this.activeModules.has(slotId)) {
                        this.activateModule(slotId);
                    }
                }
            }
            // After a scan completes, pick a new target
            this._surveyTimer = (this._surveyTimer || 0) + 0.016;
            if (this._surveyTimer > 15) {
                this._surveyTimer = 0;
                this._surveyTarget = null; // Find new field
            }
        } else {
            this.setDestination(this._surveyTarget.x, this._surveyTarget.y);
            this.desiredSpeed = this.maxSpeed;
        }
    }

    /**
     * Logistics AI: Find damaged allies, orbit, and activate remote repair modules
     */
    aiRepairAlly() {
        const entities = this.game.currentSector?.entities || [];
        const repairRange = 600;

        // Find most damaged friendly ship
        if (!this._repairTarget || !this._repairTarget.alive ||
            (this._repairTarget.shield >= this._repairTarget.maxShield * 0.95 &&
             this._repairTarget.armor >= this._repairTarget.maxArmor * 0.95)) {
            let bestTarget = null;
            let lowestHp = 1.0;

            for (const entity of entities) {
                if (!entity.alive || entity === this) continue;
                if (entity.hostility === 'hostile' || entity.type === 'enemy') continue;
                if (entity.type === 'asteroid' || entity.type === 'station' || entity.type === 'player-station' ||
                    entity.type === 'gate' || entity.type === 'warpgate' || entity.type === 'planet') continue;

                const hpPercent = (entity.shield + entity.armor + entity.hull) /
                    (entity.maxShield + entity.maxArmor + entity.maxHull);
                if (hpPercent >= 0.9) continue;
                if (hpPercent < lowestHp) {
                    lowestHp = hpPercent;
                    bestTarget = entity;
                }
            }
            this._repairTarget = bestTarget;
        }

        if (this._repairTarget) {
            this.target = this._repairTarget;
            const dist = this.distanceTo(this._repairTarget);

            if (dist > repairRange) {
                // Approach
                this.setDestination(this._repairTarget.x, this._repairTarget.y);
                this.desiredSpeed = this.maxSpeed;
            } else {
                // Orbit and repair
                const orbitAngle = Math.atan2(this.y - this._repairTarget.y, this.x - this._repairTarget.x);
                const orbitDist = repairRange * 0.5;
                this.setDestination(
                    this._repairTarget.x + Math.cos(orbitAngle + 0.1) * orbitDist,
                    this._repairTarget.y + Math.sin(orbitAngle + 0.1) * orbitDist
                );
                this.desiredSpeed = this.maxSpeed * 0.4;

                // Activate remote repair modules
                for (let i = 0; i < this.midSlots; i++) {
                    const moduleId = this.modules.mid[i];
                    if (moduleId && (moduleId.includes('remote-shield') || moduleId.includes('remote-armor'))) {
                        const slotId = `mid-${i + 1}`;
                        if (!this.activeModules.has(slotId)) {
                            this.activateModule(slotId);
                        }
                    }
                }
            }
        } else {
            // No one to repair - follow nearest ally or idle
            this.desiredSpeed = this.maxSpeed * 0.3;
            this._logiIdleTimer = (this._logiIdleTimer || 0) + 0.016;
            if (this._logiIdleTimer > 5) {
                this._logiIdleTimer = 0;
                // Wander near center
                this.setDestination(
                    CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 4000,
                    CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 4000
                );
            }
        }
    }

    // =========================================
    // PURSUIT AI STATES
    // =========================================

    /**
     * Pursue a fleeing target using PursuitAI decisions
     */
    aiPursue() {
        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.aiDisengage();
            return;
        }

        this.target = this.engagedTarget;

        const result = evaluatePursuit(this, this.engagedTarget, {
            chaseStartTime: this._chaseStartTime,
            currentTime: Date.now() / 1000,
            maxChaseTime: this.isPirate ? 60 : 75,
            homePoint: this._patrolTarget || null,
            maxHomeDistance: this.aggroRange * 3,
            allyCount: 0,
        });

        this._pursuitReason = result.reason;

        switch (result.decision) {
            case 'tackle':
                this.aiState = 'tackling';
                break;
            case 'intercept': {
                const intercept = calculateInterceptPoint(this, this.engagedTarget);
                if (intercept && this.initSectorWarp(intercept.x, intercept.y)) {
                    this.aiState = 'intercepting';
                } else {
                    // Can't warp — just chase
                    this.setDestination(this.engagedTarget.x, this.engagedTarget.y);
                    this.desiredSpeed = this.maxSpeed;
                }
                break;
            }
            case 'disengage':
                this.aiState = 'disengaging';
                break;
            case 'continue':
            default:
                // Activate MWD if fitted
                for (let i = 0; i < this.midSlots; i++) {
                    const moduleId = this.modules.mid[i];
                    if (moduleId && moduleId.startsWith('microwarpdrive')) {
                        const slotId = `mid-${i + 1}`;
                        if (!this.activeModules.has(slotId)) this.activateModule(slotId);
                        break;
                    }
                }
                this.setDestination(this.engagedTarget.x, this.engagedTarget.y);
                this.desiredSpeed = this.maxSpeed;

                // Check if back in engagement range
                const dist = this.distanceTo(this.engagedTarget);
                if (dist <= this.attackRange) {
                    this.aiState = 'engaging';
                    this._chaseStartTime = 0;
                }
                break;
        }
    }

    /**
     * Waiting for warp to complete during intercept
     */
    aiIntercept() {
        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.aiDisengage();
            return;
        }

        this._pursuitReason = 'Warping to intercept';

        // If warp completed, check where we are relative to target
        if (this.sectorWarpState === 'none') {
            const dist = this.distanceTo(this.engagedTarget);
            if (dist <= this.attackRange * 1.5) {
                this.aiState = 'engaging';
                this._chaseStartTime = 0;
            } else if (dist <= this.aggroRange * 2) {
                this.aiState = 'pursuing';
            } else {
                this.aiState = 'disengaging';
            }
        }
        // While spooling, approach target
        else {
            this.setDestination(this.engagedTarget.x, this.engagedTarget.y);
            this.desiredSpeed = this.maxSpeed * 0.3;
        }
    }

    /**
     * Keep tackle modules active, orbit close, fire weapons
     */
    aiTackle() {
        if (!this.engagedTarget || !this.engagedTarget.alive) {
            this.aiDisengage();
            return;
        }

        this.target = this.engagedTarget;
        this._pursuitReason = 'Tackling target';

        // Keep tackle active
        activateTackleModules(this);

        const dist = this.distanceTo(this.engagedTarget);

        // Close orbit at 0.5x attack range
        const orbitDist = this.attackRange * 0.5;
        const currentAngle = wrappedDirection(
            this.engagedTarget.x, this.engagedTarget.y,
            this.x, this.y, CONFIG.SECTOR_SIZE
        );
        const tangent = currentAngle + Math.PI / 2;
        this.desiredRotation = tangent;
        this.desiredSpeed = this.maxSpeed * 0.5;

        // Activate weapons
        for (let i = 0; i < this.highSlots; i++) {
            const slotId = `high-${i + 1}`;
            const moduleId = this.modules.high[i];
            if (moduleId && moduleId.includes('laser') && !moduleId.includes('mining')) {
                if (!this.activeModules.has(slotId)) {
                    this.activateModule(slotId);
                }
            }
        }

        // If target breaks free (e.g. we lost point), switch back to pursuing
        if (!this.engagedTarget.isPointed && dist > this.attackRange * 1.5) {
            this._chaseStartTime = Date.now() / 1000;
            this.aiState = 'pursuing';
        }
    }

    /**
     * Disengage and return to previous activity
     */
    aiDisengage() {
        this.engagedTarget = null;
        this.target = null;
        this._chaseStartTime = 0;
        this._pursuitReason = '';
        this._fleeTarget = null;
        this.deactivateAllModules();

        // Return to previous activity
        if (this.currentTask?.type === 'hunt') this.aiState = 'ratting';
        else if (this.currentTask?.type === 'raid') this.aiState = 'raiding';
        else this.aiState = 'idle';
    }

    // =========================================
    // HELPERS
    // =========================================

    deactivateAllModules() {
        for (const slotId of [...this.activeModules]) {
            this.deactivateModule(slotId);
        }
    }

    destroy() {
        // Notify guild economy system
        this.game.guildEconomySystem?.handleGuildShipDestroyed(this);

        if (this.isPirate) {
            // Pirate ship killed - award bounty to player, drop wreck for salvage
            const pirateBounty = 300 + Math.floor(Math.random() * 1200);
            if (this.game.player?.alive) {
                this.game.addCredits(pirateBounty);
                this.game.ui?.log(`Pirate destroyed! +${pirateBounty} ISK bounty`, 'combat');
                this.game.audio?.play('loot-pickup');

                if (this.game.input) {
                    const screen = this.game.input.worldToScreen(this.x, this.y);
                    this.game.ui?.showCreditPopup(pirateBounty, screen.x, screen.y, 'bounty');
                }
            }

            // Drop salvageable wreck with loot
            const loot = Math.floor(Math.random() * (this.lootValue.max - this.lootValue.min) + this.lootValue.min);
            const wreck = new Wreck(this.game, {
                x: this.x + (Math.random() - 0.5) * 30,
                y: this.y + (Math.random() - 0.5) * 30,
                name: `Wreck of ${this.name}`,
                credits: loot,
                salvageMaterials: Math.floor(3 + Math.random() * 6),
                sourceShipName: this.name,
                sourceShipClass: this.shipClass,
            });
            this.game.currentSector?.addEntity(wreck);
        } else {
            // Legitimate guild ship killed - award small salvage if player nearby
            if (this.game.player?.alive) {
                const dist = this.distanceTo(this.game.player);
                if (dist < 2000) {
                    const loot = Math.floor(Math.random() * (this.lootValue.max - this.lootValue.min) + this.lootValue.min);
                    this.game.addCredits(loot);
                    this.game.ui?.log(`+${loot} ISK salvage`, 'combat');
                }
            }
        }

        super.destroy();
    }

    createMesh() {
        const shipConfig = SHIP_DATABASE[this.shipClass] || {};
        const roleMap = { miner: 'mining', hauler: 'hauler', ratter: 'mercenary', raider: 'pirate', bomber: 'pirate' };
        const factoryRole = roleMap[this.role] || shipConfig.role || 'mercenary';
        const factorySize = shipConfig.size || 'frigate';

        try {
            this.mesh = shipMeshFactory.generateShipMesh({
                shipId: `guild-${this.factionId}-${this.shipClass}`,
                role: factoryRole,
                size: factorySize,
                detailLevel: 'low',
                factionId: this.factionId,
            });
        } catch (e) {
            // Fallback
            const shape = new THREE.Shape();
            const size = this.radius;
            shape.moveTo(size, 0);
            shape.lineTo(-size * 0.7, size * 0.5);
            shape.lineTo(-size * 0.5, 0);
            shape.lineTo(-size * 0.7, -size * 0.5);
            shape.closePath();
            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: Math.min(size * 0.1, 6), bevelEnabled: true,
                bevelThickness: Math.min(size * 0.02, 1.5),
                bevelSize: Math.min(size * 0.015, 1), bevelSegments: 1,
            });
            geometry.center();
            const color = parseInt(this.factionColor.slice(1), 16) || 0x888888;
            const material = new THREE.MeshStandardMaterial({
                color, emissive: color, emissiveIntensity: 0.15,
                transparent: true, opacity: 0.9, roughness: 0.5, metalness: 0.3,
            });
            this.mesh = new THREE.Mesh(geometry, material);
        }

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;

        // Add weapon turrets
        this.addTurretHardpoints();

        return this.mesh;
    }
}
