// =============================================
// Guild Economy System
// Orchestrates 5 autonomous guild factions that
// mine, haul, hunt, and raid across all sectors.
// Manages abstract simulation for off-screen
// sectors and materialization in player's sector.
// Includes hostile Shadow Cartel pirate faction.
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { GUILD_FACTIONS, generateShipName, resetNameCounters, PIRATE_FACTION_ID, isFactionHostile } from '../data/guildFactionDatabase.js';
import { TRADE_GOODS, STATION_SPECIALTIES, getStationPrice, getBestTradeRoute } from '../data/tradeGoodsDatabase.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { GuildShip } from '../entities/GuildShip.js';
import { formatCredits } from '../utils/math.js';

// Abstract simulation timing
const ABSTRACT_UPDATE_INTERVAL = 1.0;  // seconds
const FACTION_AI_INTERVAL = 5.0;       // seconds
const MINING_CYCLE_TIME = 12;          // seconds per mining cycle
const HAULER_GATE_TIME = 7;            // seconds per gate jump
const RATTER_HUNT_TIME = 35;           // seconds per hunt cycle
const RESTOCK_INTERVAL = 60;           // seconds between station restocks
const PIRATE_RAID_INTERVAL = 45;       // seconds between pirate raid checks
const PIRATE_PLUNDER_VALUE = 500;      // credits stolen per successful raid cycle
const PIRATE_RAID_DAMAGE_CHANCE = 0.4; // chance of pirate taking damage during raid

export class GuildEconomySystem {
    constructor(game) {
        this.game = game;

        // Faction data: id -> { config, treasury, income, expenses, ships[] }
        this.factions = new Map();

        // Abstract ships (off-screen): guildId -> abstract state object
        this.abstractShips = new Map();

        // Materialized ships (in player's sector): guildId -> GuildShip entity
        this.materializedShips = new Map();

        // Sector graph for pathfinding
        this.sectorGraph = new Map();

        // Throttling
        this.abstractTimer = 0;
        this.factionAITimer = 0;
        this.restockTimer = 0;
        this.pirateRaidTimer = 0;

        // Stats tracking
        this.totalShipsSpawned = 0;

        // Recent raid events (for UI/notifications)
        this.recentRaidEvents = [];

        this.init();
    }

    // =========================================
    // INITIALIZATION
    // =========================================

    init() {
        this.buildSectorGraph();

        // Try to load saved state first
        if (!this.loadState()) {
            // No save - create fresh factions
            this.createFactions();
        }
    }

    buildSectorGraph() {
        // Build adjacency list from UNIVERSE_LAYOUT gates
        for (const sector of UNIVERSE_LAYOUT.sectors) {
            this.sectorGraph.set(sector.id, []);
        }
        for (const gate of UNIVERSE_LAYOUT.gates) {
            this.sectorGraph.get(gate.from)?.push(gate.to);
            this.sectorGraph.get(gate.to)?.push(gate.from);
        }
    }

    createFactions() {
        resetNameCounters();

        for (const [factionId, config] of Object.entries(GUILD_FACTIONS)) {
            const faction = {
                id: factionId,
                config: config,
                treasury: config.startingTreasury,
                income: 0,        // Credits earned this tracking period
                expenses: 0,      // Credits spent this tracking period
                incomeRate: 0,    // Per-hour estimate
                expenseRate: 0,
                shipCount: 0,
                shipsLost: 0,
                lastTrackTime: Date.now(),
            };

            this.factions.set(factionId, faction);

            // Spawn starting ships as abstract
            for (const shipDef of config.startingShips) {
                for (let i = 0; i < shipDef.count; i++) {
                    this.spawnAbstractShip(factionId, shipDef.role, shipDef.shipClass);
                }
            }

            faction.shipCount = this.getShipsForFaction(factionId).length;
        }
    }

    spawnAbstractShip(factionId, role, shipClass) {
        const config = GUILD_FACTIONS[factionId];
        if (!config) return null;

        const shipConfig = SHIP_DATABASE[shipClass] || CONFIG.SHIPS[shipClass] || CONFIG.SHIPS.frigate;
        const name = generateShipName(factionId, role);
        const guildId = `${factionId}-${++this.totalShipsSpawned}`;

        // Start at home station (pirates have no home - spawn in random dangerous sector)
        const startSector = config.homeStation || (['sector-4', 'sector-5'][Math.floor(Math.random() * 2)]);
        const sectorSize = CONFIG.SECTOR_SIZE;

        const abs = {
            guildId,
            factionId,
            factionColor: config.color,
            role,
            shipClass,
            name,
            sectorId: startSector,
            homeStation: config.homeStation, // null for pirates
            x: sectorSize / 2 + (Math.random() - 0.5) * 2000,
            y: sectorSize / 2 + (Math.random() - 0.5) * 2000,
            aiState: 'idle',
            currentTask: null,

            // HP
            shield: shipConfig.shield || 100,
            armor: shipConfig.armor || 50,
            hull: shipConfig.hull || 100,
            maxShield: shipConfig.shield || 100,
            maxArmor: shipConfig.armor || 50,
            maxHull: shipConfig.hull || 100,

            // Cargo
            tradeGoods: {},
            cargo: {},
            cargoUsed: 0,
            cargoCapacity: shipConfig.cargoCapacity || 200,

            // Navigation
            sectorPath: [],
            pathIndex: 0,

            // Stats
            creditsEarned: 0,
            killCount: 0,
            oreMinedValue: 0,
        };

        this.abstractShips.set(guildId, abs);
        return abs;
    }

    // =========================================
    // MAIN UPDATE LOOP
    // =========================================

    update(dt) {
        // Abstract simulation (1s interval)
        this.abstractTimer += dt;
        if (this.abstractTimer >= ABSTRACT_UPDATE_INTERVAL) {
            this.abstractTimer = 0;
            this.updateAbstractShips(ABSTRACT_UPDATE_INTERVAL);
        }

        // Faction AI (5s interval)
        this.factionAITimer += dt;
        if (this.factionAITimer >= FACTION_AI_INTERVAL) {
            this.factionAITimer = 0;
            this.updateFactionAI();
        }

        // Station restocking (60s interval)
        this.restockTimer += dt;
        if (this.restockTimer >= RESTOCK_INTERVAL) {
            this.restockTimer = 0;
            this.restockStations();
        }

        // Pirate raid evaluation
        this.pirateRaidTimer += dt;
        if (this.pirateRaidTimer >= PIRATE_RAID_INTERVAL) {
            this.pirateRaidTimer = 0;
            this.evaluatePirateRaids();
        }

        // Update materialized ship AI (0.5s, handled by throttle in loop)
        this.updateMaterializedShips(dt);

        // Clean old raid events (keep last 30 seconds)
        const now = Date.now();
        this.recentRaidEvents = this.recentRaidEvents.filter(e => now - e.time < 30000);

        // Auto-save periodically
        this.saveTimer = (this.saveTimer || 0) + dt;
        if (this.saveTimer >= 30) {
            this.saveTimer = 0;
            this.saveState();
        }
    }

    // =========================================
    // ABSTRACT SIMULATION
    // =========================================

    updateAbstractShips(dt) {
        for (const [guildId, ship] of this.abstractShips) {
            this.simulateAbstractShip(ship, dt);
        }
    }

    simulateAbstractShip(ship, dt) {
        if (ship.aiState === 'idle' || ship.aiState === 'docking') return;

        switch (ship.aiState) {
            case 'traveling':
                this.simTravel(ship, dt);
                break;
            case 'mining':
                this.simMining(ship, dt);
                break;
            case 'returning':
                this.simReturning(ship, dt);
                break;
            case 'trading-buy':
                this.simTradingBuy(ship, dt);
                break;
            case 'trading-sell':
                this.simTradingSell(ship, dt);
                break;
            case 'ratting':
                this.simRatting(ship, dt);
                break;
            case 'raiding':
                this.simRaiding(ship, dt);
                break;
            case 'fleeing':
                this.simFleeing(ship, dt);
                break;
            case 'surveying':
                this.simSurveying(ship, dt);
                break;
            case 'repairing':
                this.simRepairing(ship, dt);
                break;
        }
    }

    simTravel(ship, dt) {
        if (!ship.sectorPath || ship.pathIndex >= ship.sectorPath.length) {
            // Arrived
            this.simArrived(ship);
            return;
        }

        ship._travelProgress = (ship._travelProgress || 0) + dt / HAULER_GATE_TIME;
        if (ship._travelProgress >= 1.0) {
            ship._travelProgress = 0;
            ship.sectorId = ship.sectorPath[ship.pathIndex];
            ship.pathIndex++;

            // Randomize position in new sector
            ship.x = CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 4000;
            ship.y = CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 4000;

            if (ship.pathIndex >= ship.sectorPath.length) {
                this.simArrived(ship);
            }
        }
    }

    simArrived(ship) {
        ship.sectorPath = [];
        ship.pathIndex = 0;
        ship._travelProgress = 0;

        if (!ship.currentTask) {
            ship.aiState = 'idle';
            return;
        }

        switch (ship.currentTask.type) {
            case 'mine':
                ship.aiState = 'mining';
                break;
            case 'haul':
                ship.aiState = ship.currentTask.stage === 'go-to-buy' ? 'trading-buy' : 'trading-sell';
                break;
            case 'hunt':
                ship.aiState = 'ratting';
                break;
            case 'raid':
                ship.aiState = 'raiding';
                break;
            case 'survey':
                ship.aiState = 'surveying';
                break;
            case 'support':
                ship.aiState = 'repairing';
                break;
            default:
                ship.aiState = 'idle';
        }
    }

    simMining(ship, dt) {
        ship._miningProgress = (ship._miningProgress || 0) + dt / MINING_CYCLE_TIME;

        if (ship._miningProgress >= 1.0) {
            ship._miningProgress = 0;

            // Yield ore
            const oreTypes = ['veldspar', 'scordite', 'pyroxeres'];
            const oreType = oreTypes[Math.floor(Math.random() * oreTypes.length)];
            const oreConfig = CONFIG.ASTEROID_TYPES?.[oreType];
            const units = 20 + Math.floor(Math.random() * 30);
            const volume = units * (oreConfig?.volumePerUnit || 0.1);

            if (!ship.cargo[oreType]) ship.cargo[oreType] = { units: 0, volume: 0 };
            ship.cargo[oreType].units += units;
            ship.cargo[oreType].volume += volume;
            ship.cargoUsed += volume;

            // Check cargo full
            if (ship.cargoUsed >= ship.cargoCapacity * 0.9) {
                ship.aiState = 'returning';
                ship._miningProgress = 0;
            }
        }
    }

    simReturning(ship, dt) {
        // Travel to home station to sell ore
        if (ship.sectorId !== ship.homeStation) {
            const path = this.findPath(ship.sectorId, ship.homeStation);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
                // After arriving, will need to sell - set task
                ship.currentTask = { type: 'mine', stage: 'return-sell' };
            } else {
                ship.aiState = 'idle';
            }
            return;
        }

        // At home station - sell ore
        const faction = this.factions.get(ship.factionId);
        if (faction) {
            let totalValue = 0;
            for (const [oreType, data] of Object.entries(ship.cargo)) {
                const oreConfig = CONFIG.ASTEROID_TYPES?.[oreType];
                if (oreConfig) {
                    totalValue += data.units * oreConfig.value;
                }
            }
            faction.treasury += totalValue;
            faction.income += totalValue;
            ship.creditsEarned += totalValue;
            ship.oreMinedValue += totalValue;
        }

        // Clear cargo
        ship.cargo = {};
        ship.cargoUsed = 0;

        // Repair
        ship.shield = ship.maxShield;
        ship.armor = ship.maxArmor;
        ship.hull = ship.maxHull;

        // Short dock time then resume mining
        ship.aiState = 'idle'; // Will get reassigned by faction AI
    }

    simTradingBuy(ship, dt) {
        if (!ship.currentTask) { ship.aiState = 'idle'; return; }

        const task = ship.currentTask;
        const goodId = task.goodId;
        const good = TRADE_GOODS[goodId];
        if (!good) { ship.aiState = 'idle'; return; }

        // Simulate buying - get station for this sector
        const station = this.getStationInSector(ship.sectorId);
        if (station) {
            const price = getStationPrice(goodId, ship.sectorId);
            const maxAfford = Math.floor((this.factions.get(ship.factionId)?.treasury || 0) / Math.max(1, price.buy));
            const maxCargo = Math.floor((ship.cargoCapacity - ship.cargoUsed) / good.volume);
            const quantity = Math.min(task.quantity || 20, maxAfford, maxCargo, station.tradeGoods[goodId]?.stock || 0);

            if (quantity > 0) {
                const cost = price.buy * quantity;
                const faction = this.factions.get(ship.factionId);
                if (faction) {
                    faction.treasury -= cost;
                    faction.expenses += cost;
                }
                station.tradeGoods[goodId].stock -= quantity;
                ship.tradeGoods[goodId] = (ship.tradeGoods[goodId] || 0) + quantity;
                ship.cargoUsed += quantity * good.volume;
            }
        }

        // Navigate to sell destination
        task.stage = 'go-to-sell';
        const destSector = task.destSector;
        if (destSector && destSector !== ship.sectorId) {
            const path = this.findPath(ship.sectorId, destSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
                return;
            }
        }
        ship.aiState = 'trading-sell';
    }

    simTradingSell(ship, dt) {
        if (!ship.currentTask) { ship.aiState = 'idle'; return; }

        // Sell all trade goods at current station
        const station = this.getStationInSector(ship.sectorId);
        const faction = this.factions.get(ship.factionId);

        if (station && faction) {
            for (const [goodId, quantity] of Object.entries(ship.tradeGoods)) {
                if (quantity <= 0) continue;
                const price = getStationPrice(goodId, ship.sectorId);
                const value = price.sell * quantity;
                faction.treasury += value;
                faction.income += value;
                ship.creditsEarned += value;

                // Add to station stock
                if (!station.tradeGoods[goodId]) {
                    station.tradeGoods[goodId] = { stock: 0, maxStock: 100, produced: false };
                }
                station.tradeGoods[goodId].stock += quantity;
            }
        }

        ship.tradeGoods = {};
        ship.cargoUsed = 0;
        ship.currentTask = null;
        ship.aiState = 'idle';
    }

    simRatting(ship, dt) {
        ship._huntProgress = (ship._huntProgress || 0) + dt / RATTER_HUNT_TIME;

        if (ship._huntProgress >= 1.0) {
            ship._huntProgress = 0;

            // Check for pirate guild ships in same sector first (priority target)
            const pirateTarget = this.findAbstractPirateInSector(ship.sectorId);

            if (pirateTarget) {
                // Fight a pirate guild ship
                const killChance = pirateTarget.role === 'raider' ? 0.5 : 0.3; // Bombers are tougher
                if (Math.random() < killChance) {
                    // Killed the pirate
                    const bounty = 500 + Math.floor(Math.random() * 1500);
                    const faction = this.factions.get(ship.factionId);
                    if (faction) {
                        faction.treasury += bounty;
                        faction.income += bounty;
                    }
                    ship.creditsEarned = (ship.creditsEarned || 0) + bounty;
                    ship.killCount = (ship.killCount || 0) + 1;
                    this.handleAbstractShipDeath(pirateTarget);
                    this.emitRaidEvent('defended', ship, pirateTarget, bounty);
                } else {
                    // Pirate fought back - ratter takes damage
                    const damage = 40 + Math.floor(Math.random() * 80);
                    ship.hull -= damage;
                    if (ship.shield > 0) {
                        ship.shield = Math.max(0, ship.shield - damage * 0.5);
                    }
                    if (ship.hull <= 0) {
                        this.handleAbstractShipDeath(ship);
                        return;
                    }
                    if (ship.hull < ship.maxHull * 0.3) {
                        ship.aiState = 'fleeing';
                        ship._huntProgress = 0;
                    }
                }
            } else {
                // Standard NPC pirate ratting (not guild pirates)
                const sectorDiff = this.getSectorDifficulty(ship.sectorId);
                const killChance = sectorDiff === 'deadly' ? 0.6 : sectorDiff === 'dangerous' ? 0.7 : 0.8;

                if (Math.random() < killChance) {
                    const bounty = 300 + Math.floor(Math.random() * 1200);
                    const faction = this.factions.get(ship.factionId);
                    if (faction) {
                        faction.treasury += bounty;
                        faction.income += bounty;
                    }
                    ship.creditsEarned = (ship.creditsEarned || 0) + bounty;
                    ship.killCount = (ship.killCount || 0) + 1;
                } else {
                    const damage = 30 + Math.floor(Math.random() * 80);
                    ship.hull -= damage;
                    if (ship.shield > 0) {
                        ship.shield = Math.max(0, ship.shield - damage * 0.5);
                    }
                    if (ship.hull <= 0) {
                        this.handleAbstractShipDeath(ship);
                        return;
                    }
                    if (ship.hull < ship.maxHull * 0.3) {
                        ship.aiState = 'fleeing';
                        ship._huntProgress = 0;
                    }
                }
            }
        }
    }

    /**
     * Find an abstract pirate guild ship in a sector
     */
    findAbstractPirateInSector(sectorId) {
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === PIRATE_FACTION_ID && ship.sectorId === sectorId) {
                return ship;
            }
        }
        return null;
    }

    simRaiding(ship, dt) {
        ship._raidProgress = (ship._raidProgress || 0) + dt / 20; // 20s raid cycle

        if (ship._raidProgress >= 1.0) {
            ship._raidProgress = 0;

            // Find a guild ship in the same sector to attack
            const target = this.findAbstractRaidTarget(ship);

            if (target) {
                const faction = this.factions.get(ship.factionId);
                const targetFaction = this.factions.get(target.factionId);

                // Attack outcome - pirates have advantage on miners/haulers
                const isVulnerable = target.role === 'miner' || target.role === 'hauler';
                const killChance = isVulnerable ? 0.35 : 0.15;
                const plunderChance = isVulnerable ? 0.7 : 0.3;

                if (Math.random() < killChance) {
                    // Destroyed the target
                    this.handleAbstractShipDeath(target);
                    const plunder = PIRATE_PLUNDER_VALUE + Math.floor(Math.random() * 800);
                    if (faction) {
                        faction.treasury += plunder;
                        faction.income += plunder;
                    }
                    ship.creditsEarned = (ship.creditsEarned || 0) + plunder;
                    ship.killCount = (ship.killCount || 0) + 1;

                    this.emitRaidEvent('kill', ship, target, plunder);
                } else if (Math.random() < plunderChance) {
                    // Stole cargo
                    let stolen = 0;
                    if (target.cargoUsed > 0) {
                        // Steal ore cargo
                        for (const [oreType, data] of Object.entries(target.cargo)) {
                            const stolenUnits = Math.floor(data.units * (0.2 + Math.random() * 0.3));
                            if (stolenUnits > 0) {
                                const oreConfig = CONFIG.ASTEROID_TYPES?.[oreType];
                                stolen += stolenUnits * (oreConfig?.value || 10);
                                data.units -= stolenUnits;
                                data.volume -= stolenUnits * (oreConfig?.volumePerUnit || 0.1);
                                target.cargoUsed = Math.max(0, target.cargoUsed - stolenUnits * (oreConfig?.volumePerUnit || 0.1));
                            }
                        }
                        // Steal trade goods
                        for (const [goodId, qty] of Object.entries(target.tradeGoods || {})) {
                            const stolenQty = Math.floor(qty * (0.2 + Math.random() * 0.3));
                            if (stolenQty > 0) {
                                const good = TRADE_GOODS[goodId];
                                stolen += stolenQty * (good?.basePrice || 50);
                                target.tradeGoods[goodId] -= stolenQty;
                                target.cargoUsed = Math.max(0, target.cargoUsed - stolenQty * (good?.volume || 1));
                            }
                        }
                    }
                    stolen = stolen || PIRATE_PLUNDER_VALUE;
                    if (faction) {
                        faction.treasury += stolen;
                        faction.income += stolen;
                    }
                    ship.creditsEarned = (ship.creditsEarned || 0) + stolen;

                    this.emitRaidEvent('plunder', ship, target, stolen);
                }

                // Pirate may take damage from escorts or target defense
                if (Math.random() < PIRATE_RAID_DAMAGE_CHANCE) {
                    const damage = 20 + Math.floor(Math.random() * 60);
                    ship.hull -= damage;
                    if (ship.hull <= 0) {
                        // Pirate destroyed by defense
                        this.handleAbstractShipDeath(ship);
                        // Award bounty to defending faction
                        if (targetFaction) {
                            const bounty = 300 + Math.floor(Math.random() * 700);
                            targetFaction.treasury += bounty;
                            targetFaction.income += bounty;
                        }
                        return;
                    }
                    if (ship.hull < ship.maxHull * 0.3) {
                        ship.aiState = 'fleeing';
                        ship._raidProgress = 0;
                    }
                }
            } else {
                // No target found in sector - go idle for reassignment
                ship.aiState = 'idle';
                ship.currentTask = null;
            }
        }
    }

    simFleeing(ship, dt) {
        // Pirates have no home station - retreat to a safe sector
        const retreatTarget = ship.homeStation || this.getPirateRetreatSector(ship);

        if (ship.sectorId !== retreatTarget) {
            const path = this.findPath(ship.sectorId, retreatTarget);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
                ship.currentTask = { type: 'repair' };
                return;
            }
        }

        // At retreat point - repair
        ship.shield = ship.maxShield;
        ship.armor = ship.maxArmor;
        ship.hull = ship.maxHull;
        ship.currentTask = null;
        ship.aiState = 'idle';
    }

    simSurveying(ship, dt) {
        // Abstract surveyor cycles: scan for 15s, then move to new sector
        ship._surveyProgress = (ship._surveyProgress || 0) + dt / 15;
        if (ship._surveyProgress >= 1.0) {
            ship._surveyProgress = 0;
            // "Scanned" a sector - go idle to get reassigned (new sector)
            ship.currentTask = null;
            ship.aiState = 'idle';
        }
    }

    simRepairing(ship, dt) {
        // Abstract logistics ships patrol their sector, "healing" other ships
        ship._repairProgress = (ship._repairProgress || 0) + dt / 10;
        if (ship._repairProgress >= 1.0) {
            ship._repairProgress = 0;
            // Heal 10% HP to all same-faction ships in this sector
            for (const ally of this.abstractShips.values()) {
                if (ally.factionId === ship.factionId && ally.sectorId === ship.sectorId && ally !== ship) {
                    ally.shield = Math.min(ally.maxShield, ally.shield + ally.maxShield * 0.1);
                    ally.armor = Math.min(ally.maxArmor, ally.armor + ally.maxArmor * 0.1);
                }
            }
        }
    }

    // =========================================
    // FACTION AI
    // =========================================

    updateFactionAI() {
        for (const [factionId, faction] of this.factions) {
            this.runFactionAI(factionId, faction);
            this.updateFactionStats(faction);
        }
    }

    runFactionAI(factionId, faction) {
        const config = GUILD_FACTIONS[factionId];
        if (!config) return;

        // Find all idle ships for this faction
        const idleShips = [];
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === factionId && ship.aiState === 'idle') {
                idleShips.push(ship);
            }
        }
        for (const ship of this.materializedShips.values()) {
            if (ship.factionId === factionId && ship.aiState === 'idle') {
                idleShips.push(ship);
            }
        }

        // Assign tasks to idle ships
        for (const ship of idleShips) {
            this.assignTask(ship, config);
        }

        // Replace lost ships
        this.replaceDeadShips(factionId, faction);
    }

    assignTask(ship, config) {
        // Check if ship is abstract or materialized
        const isAbstract = this.abstractShips.has(ship.guildId || ship.guildId);

        switch (ship.role) {
            case 'miner':
                this.assignMiningTask(ship, config, isAbstract);
                break;
            case 'hauler':
                this.assignHaulingTask(ship, config, isAbstract);
                break;
            case 'ratter':
                this.assignRattingTask(ship, config, isAbstract);
                break;
            case 'raider':
                this.assignRaidTask(ship, config, isAbstract);
                break;
            case 'bomber':
                this.assignAmbushTask(ship, config, isAbstract);
                break;
            case 'surveyor':
                this.assignSurveyTask(ship, config, isAbstract);
                break;
            case 'logistics':
                this.assignLogisticsTask(ship, config, isAbstract);
                break;
        }
    }

    assignMiningTask(ship, config, isAbstract) {
        // Pick a mining sector
        const preferred = config.aiConfig.preferredMiningSectors || [];
        const avoid = config.aiConfig.avoidSectors || [];
        let targetSector = ship.sectorId || config.homeStation;

        // Try preferred sectors
        for (const s of preferred) {
            if (!avoid.includes(s)) {
                targetSector = s;
                break;
            }
        }

        const task = { type: 'mine', targetSector };
        if (isAbstract) {
            ship.currentTask = task;
            if (ship.sectorId !== targetSector) {
                const path = this.findPath(ship.sectorId, targetSector);
                if (path && path.length > 0) {
                    ship.sectorPath = path;
                    ship.pathIndex = 0;
                    ship.aiState = 'traveling';
                } else {
                    ship.aiState = 'mining';
                }
            } else {
                ship.aiState = 'mining';
            }
        } else {
            // Materialized ship
            ship.currentTask = task;
            if (this.game.currentSector?.id !== targetSector) {
                const path = this.findPath(this.game.currentSector?.id, targetSector);
                if (path && path.length > 0) {
                    ship.sectorPath = path;
                    ship.pathIndex = 0;
                    ship.targetGate = null;
                    ship.aiState = 'traveling';
                } else {
                    ship.aiState = 'mining';
                }
            } else {
                ship.aiState = 'mining';
            }
        }
    }

    assignHaulingTask(ship, config, isAbstract) {
        // Find profitable trade route
        let bestRoute = null;
        let bestProfit = 0;

        const preferred = config.aiConfig.preferredTradeSectors || Object.keys(STATION_SPECIALTIES);
        const avoid = config.aiConfig.avoidSectors || [];

        for (const sourceSector of preferred) {
            if (avoid.includes(sourceSector)) continue;
            const specialty = STATION_SPECIALTIES[sourceSector];
            if (!specialty) continue;

            for (const goodId of specialty.produces) {
                const route = getBestTradeRoute(goodId, sourceSector);
                if (route.profit > bestProfit && !avoid.includes(route.destination)) {
                    bestProfit = route.profit;
                    bestRoute = {
                        goodId,
                        sourceSector,
                        destSector: route.destination,
                        profitPerUnit: route.profit,
                    };
                }
            }
        }

        if (!bestRoute) {
            ship.aiState = 'idle';
            return;
        }

        const maxUnits = Math.floor(ship.cargoCapacity / (TRADE_GOODS[bestRoute.goodId]?.volume || 1));
        const task = {
            type: 'haul',
            stage: 'go-to-buy',
            goodId: bestRoute.goodId,
            sourceSector: bestRoute.sourceSector,
            destSector: bestRoute.destSector,
            quantity: Math.min(maxUnits, 30 + Math.floor(Math.random() * 20)),
        };

        ship.currentTask = task;

        // Navigate to source
        const startSector = isAbstract ? ship.sectorId : (this.game.currentSector?.id || ship.homeStation);
        if (startSector !== bestRoute.sourceSector) {
            const path = this.findPath(startSector, bestRoute.sourceSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'trading-buy';
            }
        } else {
            ship.aiState = 'trading-buy';
        }

        if (!isAbstract) {
            ship.targetGate = null;
        }
    }

    assignRattingTask(ship, config, isAbstract) {
        // Pick a dangerous sector to patrol
        const huntSectors = config.aiConfig.preferredHuntSectors || ['sector-4', 'sector-5', 'sector-3'];
        const targetSector = huntSectors[Math.floor(Math.random() * huntSectors.length)];

        const task = { type: 'hunt', targetSector };
        ship.currentTask = task;

        const startSector = isAbstract ? ship.sectorId : (this.game.currentSector?.id || ship.homeStation);
        if (startSector !== targetSector) {
            const path = this.findPath(startSector, targetSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'ratting';
            }
        } else {
            ship.aiState = 'ratting';
        }

        if (!isAbstract) {
            ship.targetGate = null;
        }
    }

    assignRaidTask(ship, config, isAbstract) {
        // Raiders target sectors with guild miners and haulers
        const raidSectors = config.aiConfig.preferredRaidSectors || ['sector-1', 'sector-2', 'hub'];

        // Find sector with most guild activity (non-pirate ships)
        let bestSector = raidSectors[Math.floor(Math.random() * raidSectors.length)];
        let bestCount = 0;
        for (const sectorId of raidSectors) {
            let count = 0;
            for (const abs of this.abstractShips.values()) {
                if (abs.factionId !== PIRATE_FACTION_ID && abs.sectorId === sectorId) count++;
            }
            if (count > bestCount) {
                bestCount = count;
                bestSector = sectorId;
            }
        }

        const task = { type: 'raid', targetSector: bestSector };
        ship.currentTask = task;

        // Navigate to target sector
        const startSector = isAbstract ? ship.sectorId : (this.game.currentSector?.id || 'sector-4');
        if (startSector !== bestSector) {
            const path = this.findPath(startSector, bestSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'raiding';
            }
        } else {
            ship.aiState = 'raiding';
        }

        if (!isAbstract) {
            ship.targetGate = null;
        }
    }

    assignAmbushTask(ship, config, isAbstract) {
        // Bombers target sectors where ratters patrol (ambush hunters)
        const ambushSectors = config.aiConfig.preferredAmbushSectors || ['sector-4', 'sector-5'];
        const targetSector = ambushSectors[Math.floor(Math.random() * ambushSectors.length)];

        const task = { type: 'raid', targetSector };
        ship.currentTask = task;

        const startSector = isAbstract ? ship.sectorId : (this.game.currentSector?.id || 'sector-4');
        if (startSector !== targetSector) {
            const path = this.findPath(startSector, targetSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'raiding';
            }
        } else {
            ship.aiState = 'raiding';
        }

        if (!isAbstract) {
            ship.targetGate = null;
        }
    }

    assignSurveyTask(ship, config, isAbstract) {
        // Surveyors scan mining sectors for asteroid fields
        const miningSectors = config.aiConfig.preferredMiningSectors || ['sector-1', 'sector-2'];
        const avoid = config.aiConfig.avoidSectors || [];
        const candidates = miningSectors.filter(s => !avoid.includes(s));
        const targetSector = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : (config.homeStation || 'hub');

        const task = { type: 'survey', targetSector };
        ship.currentTask = task;

        const startSector = isAbstract ? ship.sectorId : (this.game.currentSector?.id || config.homeStation || 'hub');
        if (startSector !== targetSector) {
            const path = this.findPath(startSector, targetSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'surveying';
            }
        } else {
            ship.aiState = 'surveying';
        }
    }

    assignLogisticsTask(ship, config, isAbstract) {
        // Logistics ships follow combat fleets or patrol mining sectors
        const combatSectors = config.aiConfig.preferredHuntSectors || config.aiConfig.preferredMiningSectors || ['hub'];
        const avoid = config.aiConfig.avoidSectors || [];
        const candidates = combatSectors.filter(s => !avoid.includes(s));
        const targetSector = candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : (config.homeStation || 'hub');

        const task = { type: 'support', targetSector };
        ship.currentTask = task;

        const startSector = isAbstract ? ship.sectorId : (this.game.currentSector?.id || config.homeStation || 'hub');
        if (startSector !== targetSector) {
            const path = this.findPath(startSector, targetSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'repairing';
            }
        } else {
            ship.aiState = 'repairing';
        }
    }

    replaceDeadShips(factionId, faction) {
        const config = GUILD_FACTIONS[factionId];
        if (!config) return;

        // Count current ships by role
        const counts = { miner: 0, hauler: 0, ratter: 0, raider: 0, bomber: 0, surveyor: 0, logistics: 0 };
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === factionId && counts[ship.role] !== undefined) counts[ship.role]++;
        }
        for (const ship of this.materializedShips.values()) {
            if (ship.factionId === factionId) counts[ship.role]++;
        }

        // Compare to desired composition
        for (const shipDef of config.startingShips) {
            const desired = shipDef.count;
            const current = counts[shipDef.role] || 0;

            if (current < desired * 0.7) { // Replace when below 70%
                const cost = config.shipReplacementCosts[shipDef.role] || 10000;
                if (faction.treasury >= cost + 5000) { // Keep 5K buffer
                    faction.treasury -= cost;
                    faction.expenses += cost;
                    this.spawnAbstractShip(factionId, shipDef.role, shipDef.shipClass);
                    counts[shipDef.role]++;
                }
            }
        }

        faction.shipCount = Object.values(counts).reduce((a, b) => a + b, 0);
    }

    updateFactionStats(faction) {
        const now = Date.now();
        const elapsed = (now - faction.lastTrackTime) / 1000; // seconds
        if (elapsed > 0) {
            faction.incomeRate = Math.floor((faction.income / elapsed) * 3600); // per hour
            faction.expenseRate = Math.floor((faction.expenses / elapsed) * 3600);
        }
    }

    // =========================================
    // MATERIALIZATION
    // =========================================

    onSectorChange(newSector) {
        // Dematerialize ships from old sector
        for (const [guildId, ship] of [...this.materializedShips]) {
            this.dematerializeShip(ship);
        }

        // Materialize ships in new sector
        for (const [guildId, abs] of [...this.abstractShips]) {
            if (abs.sectorId === newSector.id) {
                this.materializeShip(abs);
            }
        }
    }

    materializeShip(abs) {
        // Create real GuildShip entity from abstract state
        const ship = GuildShip.createFromAbstract(this.game, abs);

        // Add to sector
        this.game.currentSector?.addEntity(ship);

        // Track
        this.materializedShips.set(abs.guildId, ship);
        this.abstractShips.delete(abs.guildId);
    }

    dematerializeShip(guildShip) {
        // Convert back to abstract
        const abs = guildShip.syncToAbstract();
        abs.sectorId = guildShip.game.currentSector?.id || abs.homeStation || 'sector-4';

        this.abstractShips.set(abs.guildId, abs);
        this.materializedShips.delete(abs.guildId);

        // Remove from sector (don't call destroy - ship is still "alive" in abstract)
        guildShip.alive = false;
        guildShip.visible = false;
    }

    /**
     * Update materialized ships AI (throttled)
     */
    updateMaterializedShips(dt) {
        this._matAITimer = (this._matAITimer || 0) + dt;
        if (this._matAITimer < 0.5) return;
        this._matAITimer = 0;

        for (const ship of this.materializedShips.values()) {
            if (ship.alive) {
                ship.aiUpdate(0.5);
            }
        }

        // Clean dead
        for (const [guildId, ship] of [...this.materializedShips]) {
            if (!ship.alive) {
                this.materializedShips.delete(guildId);
            }
        }
    }

    // =========================================
    // MATERIALIZED SHIP EVENT HANDLERS
    // =========================================

    /**
     * Guild ship wants to jump through a gate
     */
    handleGuildShipGateJump(guildShip, destSectorId) {
        // Convert to abstract, move to new sector
        const abs = guildShip.syncToAbstract();
        abs.sectorId = destSectorId;
        abs.pathIndex = (guildShip.pathIndex || 0) + 1;

        // Randomize position in new sector
        abs.x = CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 4000;
        abs.y = CONFIG.SECTOR_SIZE / 2 + (Math.random() - 0.5) * 4000;

        this.abstractShips.set(abs.guildId, abs);
        this.materializedShips.delete(abs.guildId);

        guildShip.alive = false;
        guildShip.visible = false;
    }

    /**
     * Guild ship docks at station (sell ore, repair)
     */
    handleGuildShipDock(guildShip, station) {
        const faction = this.factions.get(guildShip.factionId);

        // Sell ore
        if (faction) {
            let totalValue = 0;
            for (const [oreType, data] of Object.entries(guildShip.cargo)) {
                const oreConfig = CONFIG.ASTEROID_TYPES?.[oreType];
                if (oreConfig) totalValue += data.units * oreConfig.value;
            }
            if (totalValue > 0) {
                faction.treasury += totalValue;
                faction.income += totalValue;
            }
        }

        // Clear ore cargo
        guildShip.cargo = {};

        // Repair
        guildShip.shield = guildShip.maxShield;
        guildShip.armor = guildShip.maxArmor;
        guildShip.hull = guildShip.maxHull;

        // Dock briefly
        guildShip.docked = true;
        guildShip.visible = false;
        guildShip.dockingCooldown = 3 + Math.random() * 2;
        guildShip.aiState = 'docking';
    }

    /**
     * Guild ship buys trade goods at station
     */
    handleGuildShipBuy(guildShip, station) {
        const task = guildShip.currentTask;
        if (!task || !task.goodId) { guildShip.aiState = 'idle'; return; }

        const good = TRADE_GOODS[task.goodId];
        if (!good) { guildShip.aiState = 'idle'; return; }

        const faction = this.factions.get(guildShip.factionId);
        if (!faction) { guildShip.aiState = 'idle'; return; }

        const stock = station.tradeGoods[task.goodId];
        const price = station.getTradePrice(task.goodId);
        const maxAfford = Math.floor(faction.treasury / Math.max(1, price.buy));
        const maxCargo = Math.floor((guildShip.cargoCapacity - guildShip.cargoUsed) / good.volume);
        const available = stock?.stock || 0;
        const quantity = Math.min(task.quantity || 20, maxAfford, maxCargo, available);

        if (quantity > 0) {
            const cost = price.buy * quantity;
            faction.treasury -= cost;
            faction.expenses += cost;
            if (stock) stock.stock -= quantity;

            guildShip.addTradeGood(task.goodId, quantity, good.volume);
        }

        // Now travel to sell destination
        task.stage = 'go-to-sell';
        if (task.destSector && task.destSector !== this.game.currentSector?.id) {
            const path = this.findPath(this.game.currentSector?.id, task.destSector);
            if (path && path.length > 0) {
                guildShip.sectorPath = path;
                guildShip.pathIndex = 0;
                guildShip.targetGate = null;
                guildShip.aiState = 'traveling';
                return;
            }
        }
        guildShip.aiState = 'trading-sell';
    }

    /**
     * Guild ship sells trade goods at station
     */
    handleGuildShipSell(guildShip, station) {
        const faction = this.factions.get(guildShip.factionId);

        if (faction) {
            for (const [goodId, quantity] of Object.entries(guildShip.tradeGoods)) {
                if (quantity <= 0) continue;
                const price = station.getTradePrice(goodId);
                const value = price.sell * quantity;
                faction.treasury += value;
                faction.income += value;

                // Add to station stock
                if (!station.tradeGoods[goodId]) {
                    station.tradeGoods[goodId] = { stock: 0, maxStock: 100, produced: false };
                }
                station.tradeGoods[goodId].stock += quantity;

                // Notify commerce system for quest tracking
                this.game.commerceSystem?.onTradeGoodSold(goodId, quantity, station.sectorId);
            }
        }

        // Clear trade cargo
        guildShip.tradeGoods = {};
        guildShip.cargoUsed = 0;
        guildShip.currentTask = null;
        guildShip.aiState = 'idle';
    }

    /**
     * Guild ship was destroyed (materialized)
     */
    handleGuildShipDestroyed(guildShip) {
        const faction = this.factions.get(guildShip.factionId);
        if (faction) {
            faction.shipsLost++;
            faction.shipCount--;
        }
        this.materializedShips.delete(guildShip.guildId);
    }

    /**
     * Abstract ship died
     */
    handleAbstractShipDeath(ship) {
        const faction = this.factions.get(ship.factionId);
        if (faction) {
            faction.shipsLost++;
            faction.shipCount--;
        }
        this.abstractShips.delete(ship.guildId);
    }

    // =========================================
    // STATION RESTOCKING
    // =========================================

    restockStations() {
        // Produced goods slowly restock at stations
        const universe = this.game.universe;
        if (!universe) return;

        for (const sectorConfig of UNIVERSE_LAYOUT.sectors) {
            const sector = universe.getSector(sectorConfig.id);
            if (!sector?.generated) continue;

            const station = sector.getStation?.();
            if (!station) continue;

            const specialty = STATION_SPECIALTIES[sectorConfig.id];
            if (!specialty) continue;

            for (const goodId of specialty.produces) {
                const stock = station.tradeGoods[goodId];
                if (stock && stock.stock < stock.maxStock) {
                    stock.stock = Math.min(stock.maxStock, stock.stock + 2 + Math.floor(Math.random() * 3));
                }
            }
        }
    }

    // =========================================
    // PATHFINDING
    // =========================================

    findPath(fromSector, toSector) {
        if (fromSector === toSector) return [];
        if (!this.sectorGraph.has(fromSector) || !this.sectorGraph.has(toSector)) return null;

        // BFS for shortest path
        const visited = new Set([fromSector]);
        const queue = [[fromSector]];

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            for (const neighbor of (this.sectorGraph.get(current) || [])) {
                if (neighbor === toSector) {
                    // Return path excluding start (just the sectors to traverse)
                    return [...path.slice(1), neighbor];
                }
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }

        return null; // No path found
    }

    // =========================================
    // HELPERS
    // =========================================

    getShipsForFaction(factionId) {
        const ships = [];
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === factionId) ships.push(ship);
        }
        for (const ship of this.materializedShips.values()) {
            if (ship.factionId === factionId) ships.push(ship);
        }
        return ships;
    }

    getAllShips() {
        return [
            ...this.abstractShips.values(),
            ...[...this.materializedShips.values()].map(s => s.syncToAbstract()),
        ];
    }

    getStationInSector(sectorId) {
        const sector = this.game.universe?.getSector(sectorId);
        if (!sector?.generated) return null;
        return sector.getStation?.();
    }

    getSectorDifficulty(sectorId) {
        const sectorConfig = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        return sectorConfig?.difficulty || 'normal';
    }

    getSectorName(sectorId) {
        const sectorConfig = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        return sectorConfig?.name || sectorId;
    }

    /**
     * Get faction influence per sector (for strategic map overlay)
     * Returns { sectorId: { factionId: shipCount } }
     */
    getFactionInfluence() {
        const influence = {};
        for (const ship of this.abstractShips.values()) {
            const sid = ship.sectorId;
            if (!sid) continue;
            if (!influence[sid]) influence[sid] = {};
            influence[sid][ship.factionId] = (influence[sid][ship.factionId] || 0) + 1;
        }
        return influence;
    }

    // =========================================
    // PIRATE RAID SYSTEM
    // =========================================

    /**
     * Find a non-pirate guild ship in the same sector to raid
     */
    findAbstractRaidTarget(pirateShip) {
        const candidates = [];
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === PIRATE_FACTION_ID) continue;
            if (ship.sectorId !== pirateShip.sectorId) continue;
            if (ship.aiState === 'docking' || ship.aiState === 'idle') continue;
            candidates.push(ship);
        }
        if (candidates.length === 0) return null;

        // Prefer miners and haulers (easy targets)
        const vulnerable = candidates.filter(s => s.role === 'miner' || s.role === 'hauler');
        if (vulnerable.length > 0) {
            return vulnerable[Math.floor(Math.random() * vulnerable.length)];
        }
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    /**
     * Periodically evaluate and launch coordinated pirate raids
     * This creates wave-based group attacks on guild-heavy sectors
     */
    evaluatePirateRaids() {
        const pirateConfig = GUILD_FACTIONS[PIRATE_FACTION_ID];
        if (!pirateConfig) return;

        const aiConfig = pirateConfig.aiConfig;
        if (Math.random() > (aiConfig.raidChance || 0.6)) return;

        // Find idle pirate ships
        const idlePirates = [];
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === PIRATE_FACTION_ID && ship.aiState === 'idle') {
                idlePirates.push(ship);
            }
        }

        if (idlePirates.length < (aiConfig.minRaidSize || 2)) return;

        // Pick a target sector with the most guild activity
        const sectorActivity = {};
        for (const ship of this.abstractShips.values()) {
            if (ship.factionId === PIRATE_FACTION_ID) continue;
            const s = ship.sectorId;
            sectorActivity[s] = (sectorActivity[s] || 0) + 1;
        }

        let bestSector = null;
        let bestActivity = 0;
        const raidSectors = aiConfig.preferredRaidSectors || [];
        for (const sectorId of Object.keys(sectorActivity)) {
            const activity = sectorActivity[sectorId];
            // Prefer sectors in raid list
            const bonus = raidSectors.includes(sectorId) ? 2 : 0;
            if (activity + bonus > bestActivity) {
                bestActivity = activity + bonus;
                bestSector = sectorId;
            }
        }

        if (!bestSector) return;

        // Send a raid group
        const raidSize = Math.min(
            aiConfig.minRaidSize + Math.floor(Math.random() * (aiConfig.maxRaidSize - aiConfig.minRaidSize + 1)),
            idlePirates.length
        );

        const raidGroup = idlePirates.slice(0, raidSize);
        for (const ship of raidGroup) {
            ship.currentTask = { type: 'raid', targetSector: bestSector };
            const path = this.findPath(ship.sectorId, bestSector);
            if (path && path.length > 0) {
                ship.sectorPath = path;
                ship.pathIndex = 0;
                ship.aiState = 'traveling';
            } else {
                ship.aiState = 'raiding';
            }
        }

        // Emit raid event
        this.emitRaidEvent('launch', raidGroup[0], null, 0, {
            targetSector: bestSector,
            raidSize: raidSize,
        });

        // Notify player if raid targets their sector
        if (bestSector === this.game.currentSector?.id) {
            this.game.ui?.toast(`Shadow Cartel raid incoming! ${raidSize} hostiles inbound!`, 'error');
            this.game.ui?.log(`ALERT: Shadow Cartel launching raid on ${this.getSectorName(bestSector)}!`, 'combat');
            this.game.audio?.play('quest-fail');

            // Pirate radio chatter
            if (Math.random() < 0.6 && this.game.dialogueManager) {
                const chatter = [
                    "All units converge on target sector. Strip everything that moves.",
                    "Shadow Cartel operations, this is command. Green light on raid. No survivors.",
                    "Rich pickings in this sector. Mining barges are fat and slow. Move in.",
                    "Cut their comms first. I want those cargo holds before security arrives.",
                    "Remember: grab the cargo, slag the hull. We don't leave witnesses.",
                    "Intel says the guilds have miners here. Easy money, boys.",
                ];
                setTimeout(() => {
                    this.game.dialogueManager?.open({
                        name: 'Shadow Cartel',
                        title: 'Intercepted Transmission',
                        portrait: '\u2620',
                        color: '#cc2244',
                        text: chatter[Math.floor(Math.random() * chatter.length)],
                        options: [{ label: 'Close channel', action: 'close' }],
                    });
                }, 1500);
            }
        }
    }

    /**
     * Emit a raid event for UI tracking
     */
    emitRaidEvent(type, pirateShip, targetShip, value, extra = {}) {
        const event = {
            type,
            time: Date.now(),
            pirateName: pirateShip?.name || 'Unknown',
            pirateFaction: pirateShip?.factionId || PIRATE_FACTION_ID,
            targetName: targetShip?.name || '',
            targetFaction: targetShip?.factionId || '',
            targetRole: targetShip?.role || '',
            sectorId: pirateShip?.sectorId || '',
            sectorName: this.getSectorName(pirateShip?.sectorId || ''),
            value: value || 0,
            ...extra,
        };
        this.recentRaidEvents.push(event);
        this.game.events?.emit('pirate:raid', event);
    }

    /**
     * Handle fleeing for pirate ships (no home station - pick a random sector)
     */
    getPirateRetreatSector(ship) {
        const allSectors = [...this.sectorGraph.keys()];
        const currentSector = ship.sectorId;
        // Retreat to a different sector (prefer dangerous ones)
        const dangerous = ['sector-4', 'sector-5'];
        const retreat = dangerous.find(s => s !== currentSector) || allSectors.find(s => s !== currentSector) || currentSector;
        return retreat;
    }

    // =========================================
    // ADMIN DASHBOARD API
    // =========================================

    getFactionSummary(factionId) {
        const faction = this.factions.get(factionId);
        if (!faction) return null;

        const config = GUILD_FACTIONS[factionId];
        return {
            id: factionId,
            name: config?.name || factionId,
            shortName: config?.shortName || '',
            color: config?.color || '#888',
            icon: config?.icon || '',
            treasury: faction.treasury,
            incomeRate: faction.incomeRate,
            expenseRate: faction.expenseRate,
            shipCount: faction.shipCount,
            shipsLost: faction.shipsLost,
        };
    }

    getFactionShips(factionId) {
        const ships = [];

        for (const ship of this.abstractShips.values()) {
            if (ship.factionId !== factionId) continue;
            ships.push({
                guildId: ship.guildId,
                name: ship.name,
                role: ship.role,
                shipClass: ship.shipClass,
                sectorId: ship.sectorId,
                sectorName: this.getSectorName(ship.sectorId),
                aiState: ship.aiState,
                taskType: ship.currentTask?.type || 'none',
                taskDetail: this.getTaskDetail(ship),
                cargoUsed: Math.round(ship.cargoUsed),
                cargoCapacity: ship.cargoCapacity,
                hullPercent: Math.round((ship.hull / ship.maxHull) * 100),
                shieldPercent: Math.round((ship.shield / ship.maxShield) * 100),
                creditsEarned: ship.creditsEarned || 0,
                killCount: ship.killCount || 0,
                materialized: false,
            });
        }

        for (const ship of this.materializedShips.values()) {
            if (ship.factionId !== factionId) continue;
            ships.push({
                guildId: ship.guildId,
                name: ship.name,
                role: ship.role,
                shipClass: ship.shipClass,
                sectorId: this.game.currentSector?.id || 'unknown',
                sectorName: this.getSectorName(this.game.currentSector?.id),
                aiState: ship.aiState,
                taskType: ship.currentTask?.type || 'none',
                taskDetail: this.getTaskDetail(ship),
                cargoUsed: Math.round(ship.cargoUsed),
                cargoCapacity: ship.cargoCapacity,
                hullPercent: Math.round((ship.hull / ship.maxHull) * 100),
                shieldPercent: Math.round((ship.shield / ship.maxShield) * 100),
                creditsEarned: 0,
                killCount: 0,
                materialized: true,
                x: ship.x,
                y: ship.y,
            });
        }

        return ships;
    }

    getTaskDetail(ship) {
        // Show pursuit reason for pursuit-related states
        if (ship._pursuitReason && ['pursuing', 'intercepting', 'tackling', 'disengaging'].includes(ship.aiState)) {
            const targetName = ship.engagedTarget?.name || ship.aiTarget?.name || 'target';
            return `${ship._pursuitReason} (${targetName})`;
        }

        const task = ship.currentTask;
        if (!task) return '';
        switch (task.type) {
            case 'mine': return `Mining in ${this.getSectorName(task.targetSector || ship.sectorId)}`;
            case 'haul': {
                const good = TRADE_GOODS[task.goodId]?.name || task.goodId;
                return `${good}: ${this.getSectorName(task.sourceSector)} → ${this.getSectorName(task.destSector)}`;
            }
            case 'hunt': return `Hunting in ${this.getSectorName(task.targetSector || ship.sectorId)}`;
            case 'raid': return `Raiding ${this.getSectorName(task.targetSector || ship.sectorId)}`;
            case 'repair': return 'Returning for repairs';
            case 'survey': return `Surveying ${this.getSectorName(task.targetSector || ship.sectorId)}`;
            case 'support': return `Logistics in ${this.getSectorName(task.targetSector || ship.sectorId)}`;
            default: return task.type;
        }
    }

    /**
     * Jump camera to a ship's location (may switch sector)
     */
    jumpToShip(guildId) {
        // Check materialized ships first (already in player's sector)
        const matShip = this.materializedShips.get(guildId);
        if (matShip && matShip.alive) {
            this.game.camera.lookAt(matShip);
            this.game.selectTarget(matShip);
            return true;
        }

        // Check abstract ships - may need sector change
        const absShip = this.abstractShips.get(guildId);
        if (absShip) {
            const currentSector = this.game.currentSector?.id;
            if (absShip.sectorId !== currentSector) {
                // Undock player if docked
                if (this.game.dockedAt) {
                    this.game.ui?.hideStationPanel();
                    this.game.dockedAt = null;
                }

                // Switch to the ship's sector
                this.game.changeSector(absShip.sectorId);
                // Position player near the ship
                this.game.player.x = absShip.x + 500;
                this.game.player.y = absShip.y;
                this.game.player.velocity.set(0, 0);
                // Update fleet position
                this.game.fleetSystem?.followThroughGate();
            }

            // After sector change, ship should be materialized
            const newMat = this.materializedShips.get(guildId);
            if (newMat) {
                // Snap camera immediately then follow the ship
                this.game.camera.x = newMat.x;
                this.game.camera.y = newMat.y;
                this.game.camera.lookAt(newMat);
                this.game.selectTarget(newMat);
            } else {
                // Ship wasn't materialized - snap camera to abstract position
                this.game.camera.x = absShip.x;
                this.game.camera.y = absShip.y;
                this.game.camera.targetX = absShip.x;
                this.game.camera.targetY = absShip.y;
            }
            return true;
        }

        return false;
    }

    // =========================================
    // PERSISTENCE
    // =========================================

    saveState() {
        try {
            const state = {
                factions: {},
                abstractShips: [],
                totalShipsSpawned: this.totalShipsSpawned,
            };

            for (const [id, faction] of this.factions) {
                state.factions[id] = {
                    treasury: faction.treasury,
                    income: faction.income,
                    expenses: faction.expenses,
                    incomeRate: faction.incomeRate,
                    expenseRate: faction.expenseRate,
                    shipCount: faction.shipCount,
                    shipsLost: faction.shipsLost,
                    lastTrackTime: faction.lastTrackTime,
                };
            }

            // Save abstract ships + materialized ships (converted to abstract)
            for (const abs of this.abstractShips.values()) {
                state.abstractShips.push(abs);
            }
            for (const ship of this.materializedShips.values()) {
                state.abstractShips.push(ship.syncToAbstract());
            }

            localStorage.setItem('expedition-guild-economy', JSON.stringify(state));
        } catch (e) {
            // Ignore save errors
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('expedition-guild-economy');
            if (!saved) return false;

            const state = JSON.parse(saved);
            if (!state.factions || !state.abstractShips) return false;

            this.totalShipsSpawned = state.totalShipsSpawned || 0;

            // Restore factions
            for (const [factionId, config] of Object.entries(GUILD_FACTIONS)) {
                const saved_faction = state.factions[factionId];
                this.factions.set(factionId, {
                    id: factionId,
                    config: config,
                    treasury: saved_faction?.treasury ?? config.startingTreasury,
                    income: saved_faction?.income ?? 0,
                    expenses: saved_faction?.expenses ?? 0,
                    incomeRate: saved_faction?.incomeRate ?? 0,
                    expenseRate: saved_faction?.expenseRate ?? 0,
                    shipCount: saved_faction?.shipCount ?? 0,
                    shipsLost: saved_faction?.shipsLost ?? 0,
                    lastTrackTime: saved_faction?.lastTrackTime ?? Date.now(),
                });
            }

            // Restore abstract ships
            for (const abs of state.abstractShips) {
                if (abs.guildId) {
                    this.abstractShips.set(abs.guildId, abs);
                }
            }

            return true;
        } catch (e) {
            return false;
        }
    }
}
