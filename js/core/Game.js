// =============================================
// Main Game Controller
// Orchestrates all game systems
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { Wreck } from '../entities/Wreck.js';
import { Renderer } from '../graphics/Renderer.js';
import { InputManager } from './InputManager.js';
import { Camera } from './Camera.js';
import { Universe } from '../universe/Universe.js';
import { PlayerShip } from '../entities/PlayerShip.js';
import { EnemyShip } from '../entities/EnemyShip.js';
import { Anomaly } from '../entities/Anomaly.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { MiningSystem } from '../systems/MiningSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { NPCSystem } from '../systems/NPCSystem.js';
import { AutopilotSystem } from '../systems/AutopilotSystem.js';
import { FleetSystem } from '../systems/FleetSystem.js';
import { GuildSystem } from '../systems/GuildSystem.js';
import { CommerceSystem } from '../systems/CommerceSystem.js';
import { GuildEconomySystem } from '../systems/GuildEconomySystem.js';
import { TackleSystem } from '../systems/TackleSystem.js';
import { SurveySystem } from '../systems/SurveySystem.js';
import { LogisticsSystem } from '../systems/LogisticsSystem.js';
import { SkillGainSystem } from '../systems/SkillGainSystem.js';
import { SkillTreeSystem } from '../systems/SkillTreeSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { HazardSystem } from '../systems/HazardSystem.js';
import { EngagementRecorder } from '../systems/EngagementRecorder.js';
import { ManufacturingSystem } from '../systems/ManufacturingSystem.js';
import { AnomalySystem } from '../systems/AnomalySystem.js';
import { SectorEventSystem } from '../systems/SectorEventSystem.js';
import { BountySystem } from '../systems/BountySystem.js';
import { IntelSystem } from '../systems/IntelSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { CoalitionWarSystem } from '../systems/CoalitionWarSystem.js';
import { PlayerStationDefenseSystem } from '../systems/PlayerStationDefenseSystem.js';
import { PlayerStation } from '../entities/PlayerStation.js';
import { AdminDashboardManager } from '../ui/AdminDashboardManager.js';
import { EncyclopediaManager } from '../ui/EncyclopediaManager.js';
import { SkippyManager } from '../ui/SkippyManager.js';
import { SkillTreeRenderer } from '../ui/SkillTreeRenderer.js';
import { SkillFlashManager } from '../ui/SkillFlashManager.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';
import { EventBus } from './EventBus.js';
import { decayMarketState, getMarketState, loadMarketState, getOrderBookState, loadOrderBookState } from '../data/tradeGoodsDatabase.js';
import { formatCredits } from '../utils/math.js';
import { FACTIONS, getDefaultStandings, calculateStandingChanges, getStandingInfo, getStandingPriceModifier } from '../data/factionDatabase.js';
import { setFleetIdCounter } from '../entities/FleetShip.js';

export class Game {
    constructor() {
        // Core state
        this.running = false;
        this.paused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 60;

        // Event system
        this.events = new EventBus();

        // Player state
        this.player = null;
        this.credits = CONFIG.PLAYER_START_CREDITS;
        this.currentSector = null;
        this.dockedAt = null;
        this.lockedTarget = null;       // Primary locked target (backward compat, synced with lockedTargets[0])
        this.lockedTargets = [];        // All locked targets (multi-lock)
        this.selectedTarget = null;

        // Bookmarks (persisted)
        this.bookmarks = this.loadBookmarks();

        // Fleet state (persists across sectors)
        this.fleet = { ships: [], hiredPilots: [] };

        // Player faction
        this.faction = { name: 'Unnamed Faction', color: '#00ccff', treasury: 0 };

        // Faction standings (ExForce lore factions)
        this.factionStandings = getDefaultStandings();

        // Player-owned stations (POS)
        this.playerStations = [];

        // Secret Elder Wormhole unlocks (Set of faction keys)
        this.unlockedSecretWormholes = new Set();

        // Insurance state
        this.insurance = this.loadInsurance();

        // Player statistics
        this.stats = this.loadStats();

        // Power routing (weapons/shields/engines) - percentages summing to 100
        this.powerRouting = { weapons: 33, shields: 33, engines: 34 };

        // Systems will be initialized in init()
        this.renderer = null;
        this.input = null;
        this.camera = null;
        this.universe = null;
        this.combat = null;
        this.mining = null;
        this.collision = null;
        this.ai = null;
        this.npcSystem = null;
        this.autopilot = null;
        this.fleetSystem = null;
        this.guildSystem = null;
        this.commerceSystem = null;
        this.guildEconomySystem = null;
        this.tackleSystem = null;
        this.surveySystem = null;
        this.logisticsSystem = null;
        this.skillSystem = null;        // legacy alias → skillGainSystem
        this.skillGainSystem = null;
        this.skillTreeSystem = null;
        this.skillTreeRenderer = null;
        this.skillFlashManager = null;
        this.achievementSystem = null;
        this.adminDashboard = null;
        this.encyclopedia = null;
        this.skippy = null;
        this.dialogueManager = null;
        this.playerAggressive = false;
        this.timeScale = 1.0;
        this.engagementRecorder = null;

        // DPS tracking for UI
        this.dpsTracker = {
            incomingLog: [],  // [{time, damage, source}]
            outgoingLog: [],  // [{time, damage, target}]
            threats: new Map(), // entity -> { totalDamage, lastTime }
            incomingDPS: 0,
            outgoingDPS: 0,
            window: 5000,     // 5 second rolling window
        };

        // Tractor beam / auto-loot state
        this.tractorTargets = new Map(); // entity -> { timer }
        this.tractorRange = 250;    // detection range
        this.tractorPullSpeed = 200; // units/s pull toward player
        this.autoScoopRange = 40;   // scoop happens at this distance

        this.ui = null;
        this.audio = null;
        this.saveManager = null;
    }

    /**
     * Initialize all game systems
     */
    async init() {
        console.log('Initializing Expedition...');

        // Expose FACTIONS globally for UI lookups
        window.__FACTIONS = FACTIONS;

        // Create renderer first
        this.renderer = new Renderer(this);
        await this.renderer.init();

        // Create camera
        this.camera = new Camera(this);

        // Create input manager
        this.input = new InputManager(this);

        // Create audio manager
        this.audio = new AudioManager(this);

        // Store entity class refs for dynamic spawning
        this._EnemyShipClass = EnemyShip;
        this._AnomalyClass = Anomaly;

        // Create universe
        this.universe = new Universe(this);
        this.universe.generate(CONFIG.UNIVERSE_SEED);

        // Create player ship
        this.createPlayer();

        // Create game systems
        this.combat = new CombatSystem(this);
        this.mining = new MiningSystem(this);
        this.collision = new CollisionSystem(this);
        this.ai = new AISystem(this);
        this.npcSystem = new NPCSystem(this);
        this.autopilot = new AutopilotSystem(this);
        this.fleetSystem = new FleetSystem(this);
        this.guildSystem = new GuildSystem(this);
        this.commerceSystem = new CommerceSystem(this);
        this.guildEconomySystem = new GuildEconomySystem(this);
        this.tackleSystem = new TackleSystem(this);
        this.surveySystem = new SurveySystem(this);
        this.logisticsSystem = new LogisticsSystem(this);
        this.skillGainSystem = new SkillGainSystem(this);
        this.skillTreeSystem = new SkillTreeSystem(this);
        this.skillSystem = this.skillGainSystem; // legacy alias
        this.achievementSystem = new AchievementSystem(this);
        this.hazardSystem = new HazardSystem(this);
        this.engagementRecorder = new EngagementRecorder(this);
        this.manufacturingSystem = new ManufacturingSystem(this);
        this.anomalySystem = new AnomalySystem(this);
        this.sectorEventSystem = new SectorEventSystem(this);
        this.bountySystem = new BountySystem(this);
        this.intelSystem = new IntelSystem(this);
        this.missionSystem = new MissionSystem(this);
        this.coalitionWarSystem = new CoalitionWarSystem(this);
        this.posDefenseSystem = new PlayerStationDefenseSystem(this);

        // Create UI manager (last, needs other systems)
        this.ui = new UIManager(this);

        // Create admin dashboard (after UI)
        this.adminDashboard = new AdminDashboardManager(this);

        // Create encyclopedia (after UI)
        this.encyclopedia = new EncyclopediaManager(this);

        // Create Skippy AI advisor (after UI)
        this.skippy = new SkippyManager(this);
        this.skippy.init();

        // Create skill tree UI (after Skippy)
        this.skillTreeRenderer = new SkillTreeRenderer(this);
        this.skillFlashManager = new SkillFlashManager(this);

        // Apply skill bonuses to player
        this.skillGainSystem.applyBonuses();

        // Start in tutorial sector for new games
        this.changeSector('tutorial');

        // Position player at station (far from central planet)
        const station = this.currentSector.getStation();
        if (station) {
            this.player.x = station.x + station.radius + 100;
            this.player.y = station.y;
        } else {
            // Safe fallback - away from center
            this.player.x = CONFIG.SECTOR_SIZE / 2 + 6000;
            this.player.y = CONFIG.SECTOR_SIZE / 2;
        }

        // Set up save manager
        this.saveManager = new SaveManager(this);
        this.saveManager.enableAutoSave(60000);

        // Set up event listeners
        this.setupEvents();

        console.log('Expedition initialized!');

        return this;
    }

    /**
     * Create player ship with default loadout
     */
    createPlayer() {
        // Use hero ship from SHIP_DATABASE, fall back to CONFIG.SHIPS.frigate
        const heroShip = SHIP_DATABASE['hero-frigate'];
        const shipConfig = heroShip || CONFIG.SHIPS.frigate;

        this.player = new PlayerShip(this, {
            x: CONFIG.SECTOR_SIZE / 2,
            y: CONFIG.SECTOR_SIZE / 2,
            ...shipConfig,
            shipClass: 'frigate',
            shipSize: 'frigate',
            modelId: 'hero-frigate',
        });

        // Default modules: 1 Laser + 1 Railgun + 1 Mining Laser
        this.player.fitModule('high-1', 'small-pulse-laser');
        this.player.fitModule('high-2', 'small-railgun');
        this.player.fitModule('high-3', 'mining-laser');
        this.player.fitModule('mid-1', 'shield-booster');
        this.player.fitModule('mid-2', 'afterburner');
        this.player.fitModule('low-1', 'damage-mod');
        // low-2 left empty - buy armor repairer (mid slot) from station
    }

    /**
     * Set up game event listeners
     */
    setupEvents() {
        // Auto-save hooks
        this.events.on('station:docked', () => {
            setTimeout(() => this.saveManager?.autoSaveNow(), 500);
        });
        this.events.on('sector:change', () => {
            setTimeout(() => this.saveManager?.autoSaveNow(), 2000);
        });

        // Player death
        this.events.on('player:death', () => this.handlePlayerDeath());

        // Target destroyed
        this.events.on('entity:destroyed', (entity) => {
            // Remove from locked targets array
            const lockIdx = this.lockedTargets.indexOf(entity);
            if (lockIdx >= 0) {
                entity.locked = false;
                this.lockedTargets.splice(lockIdx, 1);
                this.lockedTarget = this.lockedTargets[0] || null;
            }
            if (entity === this.selectedTarget) {
                this.selectedTarget = null;
            }
        });

        // Sector change
        this.events.on('sector:change', (sectorId) => {
            this.ui.log(`Entering ${this.currentSector.name}`, 'warp');
            this.ui?.addShipLogEntry(`Jumped to ${this.currentSector.name}`, 'nav');
            this.ui?.showSectorBanner(this.currentSector);
            this.stats.jumps++;
            if (!this.stats.sectorsVisited.includes(sectorId)) {
                this.stats.sectorsVisited.push(sectorId);
            }
            // Encyclopedia discovery: sector
            this.encyclopedia?.discoverItem('sectors', sectorId);
        });

        // Combat events
        this.events.on('combat:hit', (data) => {
            const now = performance.now();
            if (data.target === this.player) {
                this.audio.play('hit');
                // Screen flash based on damage severity
                const totalHp = this.player.shield + this.player.armor + this.player.hull;
                const totalMaxHp = this.player.maxShield + this.player.maxArmor + this.player.maxHull;
                const hpPercent = totalMaxHp > 0 ? totalHp / totalMaxHp : 1;
                if (hpPercent < 0.5) {
                    this.ui?.damageFlash(0.4);
                } else if (data.damage > totalMaxHp * 0.1) {
                    this.ui?.damageFlash(0.2);
                }
                // Directional damage indicator
                if (data.source) {
                    this.ui?.showDamageDirection(data.source);
                }
                this.stats.damageTaken += data.damage || 0;
                // Track incoming DPS
                this.dpsTracker.incomingLog.push({ time: now, damage: data.damage, source: data.source });
                if (data.source) {
                    const threat = this.dpsTracker.threats.get(data.source) || { totalDamage: 0, lastTime: 0 };
                    threat.totalDamage += data.damage;
                    threat.lastTime = now;
                    this.dpsTracker.threats.set(data.source, threat);
                }
            }
            if (data.source === this.player) {
                this.stats.damageDealt += data.damage || 0;
                // Track outgoing DPS
                this.dpsTracker.outgoingLog.push({ time: now, damage: data.damage, target: data.target });
            }
        });

        // Combat log (detailed per-action) + floating damage popups
        this.events.on('combat:action', (data) => {
            if (data.source === this.player || data.target === this.player) {
                this.ui?.addCombatLogEntry(data);
            }
            // Floating damage popups for player-involved combat
            if (data.type === 'hit' && this.input) {
                if (data.target === this.player) {
                    const screen = this.input.worldToScreen(this.player.x, this.player.y);
                    this.ui?.showDamagePopup(Math.floor(data.damage), screen.x, screen.y, data.damageType || 'hull');
                } else if (data.source === this.player) {
                    const screen = this.input.worldToScreen(data.target.x, data.target.y);
                    this.ui?.showDamagePopup(Math.floor(data.damage), screen.x, screen.y, data.damageType || 'hull');
                }
            }
        });

        // Miss popup
        this.events.on('combat:miss', (data) => {
            if (!this.input) return;
            if (data.source === this.player || data.target === this.player) {
                const screen = this.input.worldToScreen(data.target.x, data.target.y);
                this.ui?.showDamagePopup(0, screen.x, screen.y, 'miss');
            }
        });

        // Repair popups
        this.events.on('combat:repair', (data) => {
            if (!this.input || data.ship !== this.player) return;
            this.ui?.showDamagePopup(Math.floor(data.amount), data.ship.x, data.ship.y, 'repair', true);
        });

        // Kill/death events for combat log
        this.events.on('entity:destroyed', (entity) => {
            if (entity.lastDamageSource === this.player) {
                this.ui?.addCombatLogEntry({
                    type: 'kill',
                    source: this.player,
                    target: entity,
                    damage: 0,
                    bounty: entity.bounty || 0,
                });
            }
        });

        // Visual feedback on enemy kill - only for player or fleet kills
        this.events.on('entity:destroyed', (entity) => {
            if (entity.bounty && entity.bounty > 0 && this.player?.alive) {
                // Check if player or player's fleet was the killer
                const killer = entity.lastDamageSource;
                const isPlayerKill = killer === this.player;
                const isFleetKill = killer?.type === 'fleet' || killer?.isFleet;
                if (!isPlayerKill && !isFleetKill) {
                    // Not our kill - skip stats/camera/audio
                    return;
                }

                this.audio?.play('target-destroyed');
                // Credit popup is shown by entity destroy() - no duplicate here
                // Kill mail log entry
                this.ui?.logKillMail(entity);

                // Cinematic kill camera - brief slowdown + zoom (only for player direct kills)
                if (isPlayerKill) {
                    this.timeScale = 0.3;
                    const savedZoom = this.camera.zoom;
                    this.camera.zoom = Math.min(savedZoom * 1.15, savedZoom + 50);
                    setTimeout(() => {
                        this.timeScale = 1.0;
                        this.camera.zoom = savedZoom;
                    }, 400);
                }

                // Track kill statistics
                this.stats.kills++;
                this.stats.bountyEarned += entity.bounty || 0;
                const shipClass = entity.enemyType || entity.shipClass || 'unknown';
                this.stats.killsByType[shipClass] = (this.stats.killsByType[shipClass] || 0) + 1;
                this.saveStats();

                // Ship log entry
                this.ui?.addShipLogEntry(
                    `Destroyed ${entity.name} (+${entity.bounty} ISK)`,
                    'combat'
                );

                // Check bounty board completion
                this.ui?.checkBountyCompletion(entity);

                // Faction standing change on kill
                if (entity.faction && FACTIONS[entity.faction]) {
                    const standingDelta = entity.type === 'enemy' ? 0.1 : -0.3; // Pirates give +, NPCs give -
                    this.modifyStanding(entity.faction, standingDelta);
                }

                // Check for secret Elder Wormhole unlock (faction boss kill)
                // Boss = battleship or capital class ship with a faction
                if (entity.faction && (entity.shipClass === 'battleship' || entity.shipClass === 'capital'
                    || entity.size === 'battleship' || entity.size === 'capital')) {
                    this.unlockSecretWormhole(entity.faction);
                }
            }

            // Spawn wreck for ship-type entities
            if ((entity.type === 'enemy' || entity.type === 'guild' || entity.type === 'npc')
                && this.currentSector) {
                const wreckCredits = Math.floor((entity.bounty || 50) * (0.3 + Math.random() * 0.5));
                const wreck = new Wreck(this, {
                    x: entity.x,
                    y: entity.y,
                    name: `Wreck: ${entity.name}`,
                    sourceShipName: entity.name,
                    sourceShipClass: entity.shipClass || entity.role || '',
                    credits: wreckCredits,
                    salvageMaterials: Math.floor(1 + Math.random() * (entity.radius / 10)),
                    radius: Math.min(entity.radius * 0.8, 40),
                });
                this.currentSector.addEntity(wreck);
            }
        });

        // Mining events (ore now goes to cargo, not direct credits)
        this.events.on('mining:complete', (data) => {
            // Track mining stats
            this.stats.oreMined += data.units || 0;
        });

        // Encyclopedia discovery: ship switched
        this.events.on('ship:switched', (data) => {
            if (data.shipClass) this.encyclopedia?.discoverItem('ships', data.shipClass);
        });
    }

    /**
     * Handle player death
     */
    handlePlayerDeath() {
        // Prevent re-entrant death handling
        if (this._playerDeathPending) return;
        this._playerDeathPending = true;

        this.ui?.log('Ship destroyed!', 'combat');
        this.audio?.play('explosion');
        this.ui?.damageFlash(0.6);
        this.camera?.shake(15, 0.5);

        // Track death
        this.stats.deaths++;
        this.saveStats();
        this.ui?.addShipLogEntry('Ship destroyed!', 'combat');
        this.ui?.addCombatLogEntry({
            type: 'death',
            source: this.player?.lastDamageSource,
            target: this.player,
            damage: 0,
        });

        // Lose credits
        const loss = Math.floor(this.credits * CONFIG.DEATH_CREDIT_PENALTY);
        this.credits -= loss;
        this.ui?.log(`Lost ${loss} ISK`, 'combat');
        this.ui?.showCreditPopup(loss, window.innerWidth / 2, window.innerHeight / 2, 'loss');

        // Insurance payout
        if (this.insurance.active) {
            const shipId = this.player?.shipClass || 'frigate';
            const shipData = SHIP_DATABASE[shipId];
            const shipValue = shipData?.price || CONFIG.SHIPS.frigate?.price || 5000;
            const payout = Math.floor(shipValue * this.insurance.payoutRate);
            if (payout > 0) {
                this.credits += payout;
                this.ui?.log(`Insurance payout: +${payout} ISK (${this.insurance.tierName})`, 'system');
                this.ui?.addShipLogEntry(`Insurance payout: +${payout} ISK`, 'trade');
                this.audio?.play('sell');
                setTimeout(() => {
                    this.ui?.showCreditPopup(payout, window.innerWidth / 2, window.innerHeight / 2 - 40, 'gain');
                }, 500);
            }
            this.insurance = { active: false, tier: null, tierName: null, payoutRate: 0, premium: 0, shipInsured: null };
            this.saveInsurance();
        }

        // Show death screen with options
        this.showDeathScreen();
    }

    /**
     * Show death screen with respawn / main menu options
     */
    showDeathScreen() {
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

        // Create death overlay
        let overlay = document.getElementById('death-screen');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'death-screen';
            document.body.appendChild(overlay);
        }

        const creditsLost = esc(formatCredits(Math.floor((this.credits / (1 - CONFIG.DEATH_CREDIT_PENALTY)) * CONFIG.DEATH_CREDIT_PENALTY)));

        overlay.innerHTML = `
            <div class="death-screen-content">
                <div class="death-title">SHIP DESTROYED</div>
                <div class="death-subtitle">Your capsule has been recovered</div>
                <div class="death-stats">
                    <div>Credits lost: ${creditsLost} ISK</div>
                    ${this.insurance.active ? '' : '<div class="death-no-insurance">No insurance coverage</div>'}
                </div>
                <div class="death-buttons">
                    <button class="death-btn death-respawn-btn" id="death-respawn">RESPAWN AT STATION</button>
                    <button class="death-btn death-reload-btn" id="death-reload">RELOAD LAST SAVE</button>
                    <button class="death-btn death-menu-btn" id="death-menu">MAIN MENU</button>
                </div>
            </div>
        `;
        overlay.classList.add('visible');

        // Wire buttons
        document.getElementById('death-respawn')?.addEventListener('click', () => {
            this.dismissDeathScreen();
            this.respawnPlayer();
        });
        document.getElementById('death-reload')?.addEventListener('click', () => {
            this.dismissDeathScreen();
            // Try loading the most recent save
            const lastSave = this.saveManager?.getMostRecentSave();
            if (lastSave) {
                this.loadFromSave(lastSave);
                this.ui?.toast('Save loaded', 'success');
            } else {
                this.ui?.toast('No save found - respawning instead', 'warning');
                this.respawnPlayer();
            }
        });
        document.getElementById('death-menu')?.addEventListener('click', () => {
            this.dismissDeathScreen();
            location.reload();
        });
    }

    /**
     * Dismiss the death screen overlay
     */
    dismissDeathScreen() {
        const overlay = document.getElementById('death-screen');
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.remove();
        }
        this._playerDeathPending = false;
    }

    /**
     * Respawn player at hub
     */
    respawnPlayer() {
        this._playerDeathPending = false;

        // Recreate player ship
        this.createPlayer();

        // Move to hub
        this.changeSector('hub');

        // Position at station (far from central planet)
        const station = this.currentSector?.getStation();
        if (station) {
            this.player.x = station.x + station.radius + 100;
            this.player.y = station.y;
        } else {
            this.player.x = CONFIG.SECTOR_SIZE / 2 + 6000;
            this.player.y = CONFIG.SECTOR_SIZE / 2;
        }

        this.player.velocity.set(0, 0);
        this.player.alive = true;

        // Re-apply skill bonuses to new ship
        this.skillSystem?.applyBonuses();

        this.ui?.log('Ship reconstructed. Welcome back, capsuleer.', 'system');
    }

    /**
     * Change to a different sector
     */
    changeSector(sectorId) {
        const sector = this.universe.getSector(sectorId);
        if (!sector) {
            console.error(`Sector ${sectorId} not found`);
            return;
        }

        // Clear old sector entities from renderer
        if (this.currentSector) {
            this.renderer.clearSector();
        }

        this.currentSector = sector;
        this.playerAggressive = false;

        // Generate sector content if not already done
        sector.generate();

        // Add sector entities to renderer
        this.renderer.loadSector(sector);

        // Spawn NPCs for this sector
        this.npcSystem.onSectorEnter(sector);

        // Materialize/dematerialize guild ships for this sector
        this.guildEconomySystem?.onSectorChange(sector);

        // Notify hazard system
        this.hazardSystem?.onSectorChange(sectorId);

        // End any active engagement recording on sector change
        this.engagementRecorder?.forceEnd();

        // Add player-owned stations in this sector
        for (const pos of this.playerStations) {
            if (pos.sectorId === sectorId && pos.alive) {
                sector.entities.push(pos);
            }
        }

        // Cinematic zoom on sector arrival
        this.camera?.sectorArrivalZoom();

        // Fire event
        this.events.emit('sector:change', sectorId);
    }

    /**
     * Deploy a Player Owned Station (POS) in the current sector
     */
    deployPlayerStation(posKitType) {
        if (!this.player || !this.currentSector) return false;

        // Check player has the kit in trade goods cargo
        const kitId = posKitType || 'pos-kit-basic';
        const tradeGoods = this.player.tradeGoods || {};
        const hasKit = tradeGoods[kitId]?.quantity > 0;
        if (!hasKit) {
            this.ui?.toast('No POS assembly kit in cargo', 'error');
            return false;
        }

        // Check no existing POS in this sector
        const existing = this.playerStations.find(p => p.sectorId === this.currentSector.id && p.alive);
        if (existing) {
            this.ui?.toast('A station already exists in this sector', 'error');
            return false;
        }

        // Remove kit from trade goods
        if (this.player.removeTradeGood) {
            this.player.removeTradeGood(kitId, 1);
        } else {
            tradeGoods[kitId].quantity -= 1;
            if (tradeGoods[kitId].quantity <= 0) delete tradeGoods[kitId];
        }

        // Create POS near player position
        const station = new PlayerStation(this, {
            x: this.player.x + 500,
            y: this.player.y,
            name: `${this.faction.name} Station`,
            owner: { name: this.faction.name, color: this.faction.color },
            sectorId: this.currentSector.id,
        });

        this.playerStations.push(station);
        this.currentSector.entities.push(station);

        this.events.emit('pos:deployed', { station, sectorId: this.currentSector.id });
        this.ui?.toast(`POS deployed in ${this.currentSector.name}!`, 'success');
        this.ui?.log(`Deployed ${station.name} at current position`, 'system');

        return true;
    }

    /**
     * Get player station in the current sector (if any)
     */
    getPlayerStationInSector(sectorId) {
        const sid = sectorId || this.currentSector?.id;
        return this.playerStations?.find(p => p.sectorId === sid && p.alive) || null;
    }

    /**
     * Select a target
     */
    selectTarget(entity) {
        if (this.selectedTarget) {
            this.selectedTarget.selected = false;
        }
        this.selectedTarget = entity;
        if (entity) {
            entity.selected = true;
            this.events.emit('target:selected', entity);

            // Encyclopedia discovery: ships by class, factions by guild ship encounter
            if (entity.shipClass && this.encyclopedia) {
                this.encyclopedia.discoverItem('ships', entity.shipClass);
            }
            if (entity.factionId && this.encyclopedia) {
                this.encyclopedia.discoverItem('factions', entity.factionId);
            }
        }
    }

    /**
     * Get maximum number of simultaneous target locks
     * Based on ship class + skill bonuses + module bonuses
     */
    getMaxLockTargets() {
        const player = this.player;
        if (!player) return 1;

        // Base by ship size
        const baseLocks = {
            'frigate': 2, 'destroyer': 3, 'cruiser': 4,
            'battlecruiser': 5, 'battleship': 6, 'capital': 8,
        };
        const size = player.shipSize || player.shipClass || 'frigate';
        let maxLocks = baseLocks[size] || 2;

        // Skill bonus: gunnery gives +1 at levels 3 and 5
        if (this.skillSystem?.skills?.gunnery) {
            const gunneryLevel = this.skillSystem.skills.gunnery.level || 0;
            if (gunneryLevel >= 3) maxLocks += 1;
            if (gunneryLevel >= 5) maxLocks += 1;
        }

        // Module bonus: sensor booster gives +1 lock
        if (player.modules) {
            for (let i = 0; i < player.midSlots; i++) {
                const modId = player.modules.mid[i];
                if (modId && (modId === 'sensor-booster' || modId.startsWith('sensor-booster'))) {
                    maxLocks += 1;
                }
            }
        }

        return maxLocks;
    }

    /**
     * Lock target for combat/mining (multi-lock support)
     */
    lockTarget(entity) {
        if (!entity) return;

        // Already locked?
        if (this.lockedTargets.includes(entity)) return;

        // Check max locks
        if (this.lockedTargets.length >= this.getMaxLockTargets()) {
            this.ui?.showToast(`Max targets locked (${this.getMaxLockTargets()})`, 'warning');
            return;
        }

        // Start lock timer using game-time accumulator (not setTimeout)
        const lockTime = CONFIG.LOCK_TIME_BASE;

        this.ui?.log(`Locking ${entity.name}...`, 'system');
        this.audio?.play('lock-start');

        // Track locking progress for visual feedback and game-time completion
        this.lockingTarget = entity;
        this.lockProgress = 0;
        this.lockDuration = lockTime; // seconds (game time)
        // Keep these for renderer compatibility (lock progress ring)
        this.lockingStartTime = performance.now();
        this.lockingDuration = lockTime * 1000;
    }

    /**
     * Update lock progress using game-time delta (called from update loop)
     */
    updateLockProgress(dt) {
        if (!this.lockingTarget) return;

        // Cancel if target died or player died
        if (!this.lockingTarget.alive || !this.player?.alive) {
            this.lockingTarget = null;
            this.lockProgress = 0;
            return;
        }

        this.lockProgress += dt;

        // Keep renderer's lockingStartTime in sync so the visual progress ring works
        // Renderer uses: progress = (performance.now() - lockingStartTime) / lockingDuration
        // We rewrite lockingStartTime so it matches our game-time progress
        this.lockingStartTime = performance.now() - (this.lockProgress / this.lockDuration) * this.lockingDuration;

        if (this.lockProgress >= this.lockDuration) {
            const entity = this.lockingTarget;
            this.lockedTargets.push(entity);
            this.lockedTarget = this.lockedTargets[0];
            entity.locked = true;
            this.events.emit('target:locked', entity);
            this.ui?.log(`Target locked: ${entity.name}`, 'system');
            this.audio?.play('lock-complete');
            this.lockingTarget = null;
            this.lockProgress = 0;
        }
    }

    /**
     * Unlock most recent target, or a specific target
     */
    unlockTarget(entity) {
        if (entity) {
            const idx = this.lockedTargets.indexOf(entity);
            if (idx >= 0) {
                entity.locked = false;
                this.lockedTargets.splice(idx, 1);
            }
        } else if (this.lockedTargets.length > 0) {
            // Unlock most recent
            const last = this.lockedTargets.pop();
            if (last) last.locked = false;
        }
        this.lockedTarget = this.lockedTargets[0] || null;
        this.events.emit('target:unlocked');
    }

    // ==========================================
    // Manual Flight Controls (WASD)
    // ==========================================

    /**
     * Poll WASD keys each frame for direct flight control.
     * Overrides autopilot desiredSpeed/desiredRotation when any WASD key is held.
     */
    updateManualFlight(dt) {
        if (!this.player?.alive || this.dockedAt) return;
        const input = this.input;
        if (!input) return;

        const w = input.isKeyDown('KeyW');
        const s = input.isKeyDown('KeyS');
        const a = input.isKeyDown('KeyA');
        const d = input.isKeyDown('KeyD');

        if (!w && !s && !a && !d) {
            this._manualFlightActive = false;
            return;
        }

        // Cancel autopilot command when WASD takes over
        if (!this._manualFlightActive) {
            this.autopilot?.stop();
            this._manualFlightActive = true;
        }

        // Throttle: W increases, S decreases
        if (w) {
            this.player.desiredSpeed = this.player.maxSpeed;
        } else if (s) {
            this.player.desiredSpeed = 0;
        }

        // Rotation: A turns left, D turns right
        if (a || d) {
            const turnAmount = this.player.turnSpeed * dt;
            if (a) {
                this.player.rotation += turnAmount;
            }
            if (d) {
                this.player.rotation -= turnAmount;
            }
            // Keep desiredRotation in sync so Ship.updateRotation doesn't fight us
            this.player.desiredRotation = this.player.rotation;
        }
    }

    // ==========================================
    // Weapon Groups
    // ==========================================

    /**
     * Fire all modules in a weapon group
     */
    fireWeaponGroup(groupNum) {
        if (!this.player?.alive) return;
        const groups = this.player.weaponGroups;
        if (!groups) return;

        const slotIds = groups[groupNum];
        if (!slotIds || slotIds.length === 0) return;

        // Need at least one locked target to fire weapons at
        const target = this.lockedTargets?.[0] || this.lockedTarget;

        for (const slotId of slotIds) {
            if (!this.player?.alive) break;
            const parsed = this.player.parseSlotId(slotId);
            if (!parsed) continue;
            const [slotType, slotIndex] = parsed;
            const moduleId = this.player.modules[slotType]?.[slotIndex];
            if (!moduleId) continue;

            // Activate the module if not already active
            if (!this.player.activeModules.has(slotId)) {
                this.player.activateModule(slotId);
            }
        }
    }

    // ==========================================
    // Propulsion Module Toggle
    // ==========================================

    /**
     * Toggle the first fitted AB or MWD module
     */
    togglePropmod() {
        if (!this.player?.alive) return;

        // Search mid slots for AB or MWD
        for (let i = 0; i < this.player.midSlots; i++) {
            const moduleId = this.player.modules.mid[i];
            if (!moduleId) continue;
            if (moduleId === 'afterburner' || moduleId.startsWith('afterburner') ||
                moduleId === 'microwarpdrive' || moduleId.startsWith('microwarpdrive')) {
                const slotId = `mid-${i + 1}`;
                if (this.player.activeModules.has(slotId)) {
                    this.player.deactivateModule(slotId);
                } else {
                    this.player.activateModule(slotId);
                }
                return;
            }
        }

        this.ui?.showToast('No propulsion module fitted', 'warning');
    }

    /**
     * Add credits
     */
    addCredits(amount) {
        this.credits += amount;
        this.events.emit('credits:changed', this.credits);
    }

    /**
     * Spend credits
     */
    spendCredits(amount) {
        if (this.credits >= amount) {
            this.credits -= amount;
            this.events.emit('credits:changed', this.credits);
            return true;
        }
        return false;
    }

    /**
     * Get current stardate from play time
     * Format: YYYY.DDD.HH  (1 real second = 1 game minute)
     * Epoch: 3301.001.00
     */
    getStardate() {
        const playSeconds = this.stats?.playTime || 0;
        const gameMinutes = playSeconds; // 1 real sec = 1 game min
        const gameHours = gameMinutes / 60;
        const gameDays = gameHours / 24;

        const epochYear = 3301;
        const totalDays = Math.floor(gameDays);
        const yearDays = 365;

        const year = epochYear + Math.floor(totalDays / yearDays);
        const dayOfYear = (totalDays % yearDays) + 1; // 1-indexed
        const hour = Math.floor(gameHours % 24);

        const ddd = String(dayOfYear).padStart(3, '0');
        const hh = String(hour).padStart(2, '0');
        return `${year}.${ddd}.${hh}`;
    }

    /**
     * Add credits to faction treasury (from fleet miners, etc.)
     */
    addFactionTreasury(amount) {
        this.faction.treasury += amount;
        this.events.emit('faction:treasury-changed', this.faction.treasury);
    }

    /**
     * Unlock a secret Elder Wormhole by defeating a faction
     */
    unlockSecretWormhole(factionKey) {
        if (this.unlockedSecretWormholes.has(factionKey)) return false;
        const wormhole = UNIVERSE_LAYOUT.secretWormholes?.find(w => w.unlockedBy === factionKey);
        if (!wormhole) return false;

        this.unlockedSecretWormholes.add(factionKey);
        this.events.emit('secret-wormhole:unlocked', { faction: factionKey, wormhole });
        return true;
    }

    isSecretWormholeUnlocked(factionKey) {
        return this.unlockedSecretWormholes.has(factionKey);
    }

    /**
     * Modify standing with a faction (with coalition spillover)
     */
    modifyStanding(factionId, delta) {
        if (!FACTIONS[factionId]) return;
        const changes = calculateStandingChanges(factionId, delta);
        for (const [id, change] of Object.entries(changes)) {
            const old = this.factionStandings[id] || 0;
            this.factionStandings[id] = Math.max(-10, Math.min(10, old + change));
        }
        this.events.emit('faction:standing-changed', { factionId, delta, standings: this.factionStandings });
    }

    /**
     * Get standing with a faction
     */
    getStanding(factionId) {
        return this.factionStandings[factionId] || 0;
    }

    /**
     * Get standing info (label, color) for a faction
     */
    getStandingInfo(factionId) {
        return getStandingInfo(this.getStanding(factionId));
    }

    /**
     * Get price modifier based on faction standing
     */
    getStandingPriceModifier(factionId) {
        return getStandingPriceModifier(this.getStanding(factionId));
    }

    /**
     * Dock at station
     */
    dockAtStation(station) {
        this.dockedAt = station;
        this.player.velocity.set(0, 0);
        this.paused = true;
        this.events.emit('station:docked', station);
        this.audio.play('dock');

        // Start station ambient + mute engine hum
        this.audio?.stopEngineHum();
        this.audio?.startStationAmbient();

        // Play docking animation then show station
        this.ui.playDockingAnimation(station.name, () => {
            this.ui.showStationPanel(station);
        });
    }

    /**
     * Undock from station
     */
    undock() {
        if (!this.dockedAt) return;

        const station = this.dockedAt;

        // Play undock animation then actually undock
        this.ui.hideStationPanel();
        this.ui.playUndockAnimation(station.name, () => {
            this.dockedAt = null;
            this.paused = false;

            // Position player outside station
            this.player.x = station.x + 300;
            this.player.y = station.y;

            this.events.emit('station:undocked');
            this.ui.log(`Undocked from ${station.name}`, 'system');
            this.audio.play('undock');
            this.audio?.stopStationAmbient();
            this.audio?.startEngineHum();
        });
    }

    /**
     * Add bookmark at current location
     */
    addBookmark(name) {
        const bookmark = {
            id: Date.now(),
            name: name || `Bookmark ${this.bookmarks.length + 1}`,
            sectorId: this.currentSector.id,
            x: this.player.x,
            y: this.player.y,
        };
        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.ui.log(`Bookmark saved: ${bookmark.name}`, 'system');
        this.ui.showToast(`Bookmark saved: ${bookmark.name}`, 'info');
        return bookmark;
    }

    /**
     * Remove bookmark
     */
    removeBookmark(id) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            this.bookmarks.splice(index, 1);
            this.saveBookmarks();
        }
    }

    loadBookmarks() {
        try {
            return JSON.parse(localStorage.getItem('expedition-bookmarks') || '[]');
        } catch { return []; }
    }

    saveBookmarks() {
        localStorage.setItem('expedition-bookmarks', JSON.stringify(this.bookmarks));
    }

    /**
     * Start the game loop
     */
    start() {
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    /**
     * Stop the game loop
     */
    stop() {
        this.running = false;
    }

    /**
     * Main game loop
     */
    loop = (currentTime) => {
        if (!this.running) return;

        // Calculate delta time
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // Calculate FPS
        this.fps = 1 / this.deltaTime;

        // Update game state
        if (!this.paused) {
            this.update(this.deltaTime * this.timeScale);
        }

        // Render
        this.render();

        // Schedule next frame
        requestAnimationFrame(this.loop);
    };

    /**
     * Safely update a system, catching errors to prevent game loop death
     */
    _safeUpdate(system, name, dt) {
        try {
            system.update(dt);
        } catch (e) {
            if (!this._errorCounts) this._errorCounts = {};
            this._errorCounts[name] = (this._errorCounts[name] || 0) + 1;
            if (this._errorCounts[name] <= 3) {
                console.error(`[${name}] update error (${this._errorCounts[name]}/3):`, e);
            }
        }
    }

    /**
     * Update game state
     */
    update(dt) {
        this._lastDt = dt;

        // Update autopilot FIRST (sets desiredSpeed/desiredRotation)
        this._safeUpdate(this.autopilot, 'Autopilot', dt);

        // WASD direct flight overrides autopilot when active
        this.updateManualFlight(dt);

        // Update player (uses desiredSpeed/desiredRotation)
        if (this.player && this.player.alive) {
            try { this.player.update(dt); } catch (e) { console.error('[Player] update error:', e); }
        }

        // Update current sector entities
        if (this.currentSector) {
            try { this.currentSector.update(dt); } catch (e) { console.error('[Sector] update error:', e); }
        }

        // Update game systems
        this._safeUpdate(this.ai, 'AI', dt);
        this._safeUpdate(this.npcSystem, 'NPC', dt);
        this._safeUpdate(this.fleetSystem, 'Fleet', dt);
        this._safeUpdate(this.guildEconomySystem, 'GuildEconomy', dt);
        this._safeUpdate(this.combat, 'Combat', dt);
        this._safeUpdate(this.tackleSystem, 'Tackle', dt);
        this._safeUpdate(this.surveySystem, 'Survey', dt);
        this._safeUpdate(this.logisticsSystem, 'Logistics', dt);
        this._safeUpdate(this.mining, 'Mining', dt);
        this._safeUpdate(this.collision, 'Collision', dt);
        this._safeUpdate(this.achievementSystem, 'Achievement', dt);
        this._safeUpdate(this.hazardSystem, 'Hazard', dt);
        if (this.engagementRecorder) this._safeUpdate(this.engagementRecorder, 'Engagement', dt);
        if (this.manufacturingSystem) this._safeUpdate(this.manufacturingSystem, 'Manufacturing', dt);
        if (this.anomalySystem) this._safeUpdate(this.anomalySystem, 'Anomaly', dt);
        if (this.sectorEventSystem) this._safeUpdate(this.sectorEventSystem, 'SectorEvent', dt);
        if (this.bountySystem) this._safeUpdate(this.bountySystem, 'Bounty', dt);
        if (this.intelSystem) this._safeUpdate(this.intelSystem, 'Intel', dt);
        if (this.posDefenseSystem) this._safeUpdate(this.posDefenseSystem, 'POSDefense', dt);
        if (this.missionSystem) this._safeUpdate(this.missionSystem, 'Mission', dt);
        if (this.coalitionWarSystem) this._safeUpdate(this.coalitionWarSystem, 'CoalitionWar', dt);

        // Update target lock progress (game-time accumulator)
        this.updateLockProgress(dt);

        // Auto-loot tractor beam
        try { this.updateTractorBeams(dt); } catch (e) { console.error('[TractorBeam] error:', e); }

        // Update engine hum volume based on player speed
        if (this.player && this.audio?.engineHumGain) {
            const speedFrac = this.player.currentSpeed / (this.player.maxSpeed || 1);
            this.audio.updateEngineHum(speedFrac);
        }

        // Market supply/demand decay (every 30s game time)
        this._marketDecayTimer = (this._marketDecayTimer || 0) + dt;
        if (this._marketDecayTimer >= 30) {
            this._marketDecayTimer = 0;
            decayMarketState();
        }

        // DPS tracking
        this.updateDPSTracker();

        // Dynamic music mode detection
        this.updateMusicMode();

        // Update camera
        this._safeUpdate(this.camera, 'Camera', dt);

        // Update Skippy advisor
        if (this.skippy) this._safeUpdate(this.skippy, 'Skippy', dt);

        // Update UI
        this._safeUpdate(this.ui, 'UI', dt);
    }

    /**
     * Calculate rolling DPS from damage logs
     */
    updateDPSTracker() {
        const now = performance.now();
        const window = this.dpsTracker.window;

        // Prune old entries using filter (O(n) instead of O(n²) splice)
        this.dpsTracker.incomingLog = this.dpsTracker.incomingLog.filter(e => now - e.time < window);
        this.dpsTracker.outgoingLog = this.dpsTracker.outgoingLog.filter(e => now - e.time < window);

        // Calculate DPS
        const inTotal = this.dpsTracker.incomingLog.reduce((sum, e) => sum + e.damage, 0);
        const outTotal = this.dpsTracker.outgoingLog.reduce((sum, e) => sum + e.damage, 0);
        this.dpsTracker.incomingDPS = Math.round(inTotal / (window / 1000));
        this.dpsTracker.outgoingDPS = Math.round(outTotal / (window / 1000));

        // Prune stale threats (>10s since last hit)
        for (const [entity, data] of this.dpsTracker.threats) {
            if (now - data.lastTime > 10000 || !entity.alive) {
                this.dpsTracker.threats.delete(entity);
            }
        }
    }

    /**
     * Detect combat/danger state and set music mode
     */
    updateMusicMode() {
        if (!this.audio?.musicStarted) return;

        // Docked at station = station music
        if (this.dockedAt) {
            this.audio.setMusicMode('station');
            return;
        }

        // Check if player is in active combat
        const inCombat = this.player?.alive && (
            // Player has locked targets that are hostile
            this.lockedTargets.some(t => t?.alive &&
                (t.hostility === 'hostile' || t.hostility === 'criminal')) ||
            // Player is being attacked (recent damage)
            (this.player._lastDamageTime && (performance.now() - this.player._lastDamageTime) < 8000) ||
            // Player has active weapon modules firing at something
            (this.player.activeModules && this.player.activeModules.size > 0 &&
                Array.from(this.player.activeModules).some(slotId => slotId.startsWith('high-')))
        );

        if (inCombat) {
            this.audio.setMusicMode('combat');
            return;
        }

        // Check sector danger level based on difficulty
        const difficulty = this.currentSector?.difficulty;
        if (difficulty) {
            const dangerLevels = { tutorial: 0, hub: 0, safe: 0.1, tame: 0.15, normal: 0.35, neutral: 0.45, dangerous: 0.7, deadly: 1.0 };
            const danger = dangerLevels[difficulty] || 0;
            if (danger >= 0.6) {
                this.audio.setMusicMode('danger');
                return;
            }
        }

        // Default: ambient
        this.audio.setMusicMode('ambient');
    }

    /**
     * Update tractor beams - auto-loot nearby containers
     */
    updateTractorBeams(dt) {
        if (!this.player?.alive || this.dockedAt) {
            this.tractorTargets.clear();
            return;
        }

        const entities = this.currentSector?.entities || [];
        const activeContainers = new Set();

        for (const entity of entities) {
            if (!entity.alive || entity.type !== 'loot') continue;

            const dist = this.player.distanceTo(entity);
            if (dist > this.tractorRange) continue;

            activeContainers.add(entity);

            // Track this container
            if (!this.tractorTargets.has(entity)) {
                this.tractorTargets.set(entity, { timer: 0 });
            }

            const data = this.tractorTargets.get(entity);
            data.timer += dt;

            // Pull container toward player
            const dx = this.player.x - entity.x;
            const dy = this.player.y - entity.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const pullSpeed = this.tractorPullSpeed * Math.min(data.timer * 2, 1); // ramp up
            entity.x += (dx / len) * pullSpeed * dt;
            entity.y += (dy / len) * pullSpeed * dt;

            // Auto-scoop when close enough
            if (dist < this.autoScoopRange) {
                entity.scoop(this.player);
                this.tractorTargets.delete(entity);
            }
        }

        // Remove stale targets
        for (const [entity] of this.tractorTargets) {
            if (!activeContainers.has(entity)) {
                this.tractorTargets.delete(entity);
            }
        }
    }

    /**
     * Render the game
     */
    render() {
        this.renderer.render();
    }

    /**
     * Get all entities in current sector
     */
    getEntities() {
        if (!this.currentSector) return [];
        return this.currentSector.entities;
    }

    /**
     * Get all visible entities for overview
     */
    getVisibleEntities() {
        const entities = this.getEntities();
        return entities.filter(e => e.alive && e.visible);
    }

    // ==========================================
    // Insurance System
    // ==========================================

    /**
     * Insurance tiers with payout rates and premium costs
     */
    static INSURANCE_TIERS = {
        basic:    { name: 'Basic',    payoutRate: 0.40, premiumRate: 0.05 },
        standard: { name: 'Standard', payoutRate: 0.60, premiumRate: 0.10 },
        platinum: { name: 'Platinum', payoutRate: 0.80, premiumRate: 0.18 },
        gold:     { name: 'Gold',     payoutRate: 1.00, premiumRate: 0.30 },
    };

    /**
     * Purchase insurance for the current ship
     */
    purchaseInsurance(tierId) {
        const tier = Game.INSURANCE_TIERS[tierId];
        if (!tier) return false;

        const shipId = this.player?.shipClass || 'frigate';
        const shipData = SHIP_DATABASE[shipId];
        const shipValue = shipData?.price || 5000;
        const premium = Math.floor(shipValue * tier.premiumRate);

        if (this.credits < premium) {
            this.ui?.log('Insufficient funds for insurance', 'system');
            return false;
        }

        this.credits -= premium;
        this.insurance = {
            active: true,
            tier: tierId,
            tierName: tier.name,
            payoutRate: tier.payoutRate,
            premium: premium,
            shipInsured: shipId,
        };
        this.saveInsurance();

        this.audio?.play('sell');
        this.ui?.log(`${tier.name} insurance purchased for ${premium} ISK`, 'system');
        this.ui?.showCreditPopup(premium, window.innerWidth / 2, window.innerHeight / 2, 'loss');
        return true;
    }

    saveInsurance() {
        try {
            localStorage.setItem('expedition-insurance', JSON.stringify(this.insurance));
        } catch (e) { /* storage full */ }
    }

    loadInsurance() {
        try {
            const data = localStorage.getItem('expedition-insurance');
            if (data) return JSON.parse(data);
        } catch (e) { /* corrupt */ }
        return { active: false, tier: null, tierName: null, payoutRate: 0, premium: 0, shipInsured: null };
    }

    // ==========================================
    // Statistics System
    // ==========================================

    static DEFAULT_STATS = {
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        damageTaken: 0,
        oreMined: 0,
        bountyEarned: 0,
        jumps: 0,
        sectorsVisited: [],
        killsByType: {},
        playTime: 0,
        sessionStart: Date.now(),
    };

    saveStats() {
        try {
            // Update play time before saving
            this.stats.playTime += (Date.now() - this.stats.sessionStart) / 1000;
            this.stats.sessionStart = Date.now();
            localStorage.setItem('expedition-stats', JSON.stringify(this.stats));
        } catch (e) { /* storage full */ }
    }

    loadStats() {
        try {
            const data = localStorage.getItem('expedition-stats');
            if (data) {
                const parsed = JSON.parse(data);
                return { ...Game.DEFAULT_STATS, ...parsed, sessionStart: Date.now() };
            }
        } catch (e) { /* corrupt */ }
        return { ...Game.DEFAULT_STATS, sessionStart: Date.now() };
    }

    // ==========================================
    // Save/Load System
    // ==========================================

    /**
     * Restore game state from a save data object.
     * Called after init() completes.
     */
    loadFromSave(data) {
        if (!data) return;

        // 1. Credits
        if (data.credits !== undefined) {
            this.credits = data.credits;
        }

        // 2. Ship class + modules + cargo
        if (data.shipClass && this.player) {
            if (data.shipClass !== this.player.shipClass) {
                this.player.switchShip(data.shipClass);
            }

            // Restore fitted modules
            if (data.shipModules) {
                // Clear first
                this.player.modules = {
                    high: new Array(this.player.highSlots).fill(null),
                    mid: new Array(this.player.midSlots).fill(null),
                    low: new Array(this.player.lowSlots).fill(null),
                };
                this.player.activeModules = new Set();

                // Re-fit saved modules
                for (const slotType of ['high', 'mid', 'low']) {
                    const mods = data.shipModules[slotType] || [];
                    for (let i = 0; i < mods.length; i++) {
                        if (mods[i]) {
                            this.player.fitModule(`${slotType}-${i + 1}`, mods[i]);
                        }
                    }
                }
            }

            // Restore cargo
            if (data.cargo) {
                this.player.cargo = { ...data.cargo };
                // Recalculate cargoUsed
                let used = 0;
                for (const key in this.player.cargo) {
                    used += this.player.cargo[key].volume || 0;
                }
                this.player.cargoUsed = used;
            }

            // Restore trade goods
            if (data.tradeGoods) {
                this.player.tradeGoods = { ...data.tradeGoods };
            }

            // Restore materials
            if (data.materials) {
                this.player.materials = { ...data.materials };
            }

            // Restore module inventory
            if (data.moduleInventory) {
                this.player.moduleInventory = [...data.moduleInventory];
            }

            // Restore drone bay
            if (data.droneBay) {
                this.player.droneBay.drones = (data.droneBay.drones || []).map(d => ({ ...d }));
                this.player.droneBay.capacity = data.droneBay.capacity || 0;
                this.player.droneBay.bandwidth = data.droneBay.bandwidth || 0;
            }

            // Restore hero ship name
            if (data.heroName) {
                this.player.heroName = data.heroName;
                this.player.name = data.heroName;
            }

            // Restore model ID for GLB loading
            if (data.modelId) {
                this.player.modelId = data.modelId;
            }

            // Restore weapon groups
            if (data.weaponGroups) {
                this.player.weaponGroups = { 1: [], 2: [], 3: [] };
                for (const g of [1, 2, 3]) {
                    if (data.weaponGroups[g]) {
                        this.player.weaponGroups[g] = [...data.weaponGroups[g]];
                    }
                }
            }

            // Restore component upgrade levels and re-apply bonuses
            if (data.componentLevels) {
                this.player.componentLevels = { ...data.componentLevels };
                this.player.applyComponentUpgrades();
            }
        }

        // 3. Fleet
        if (data.fleet) {
            // Clear current fleet
            this.fleet = { ships: [], hiredPilots: data.fleet.hiredPilots || [] };

            // Re-add fleet ships
            for (const shipData of (data.fleet.ships || [])) {
                const ship = this.fleetSystem?.addShip(
                    shipData.shipClass,
                    shipData.pilot
                );
                if (ship) {
                    ship.groupId = shipData.groupId || 0;
                    ship.stance = shipData.stance || 'aggressive';
                }
            }

            // Restore control groups from groupId already set on ships
            if (this.fleetSystem) {
                for (const [, group] of this.fleetSystem.controlGroups) {
                    group.clear();
                }
                for (const ship of this.fleet.ships) {
                    if (ship.groupId > 0) {
                        const group = this.fleetSystem.controlGroups.get(ship.groupId);
                        if (group) group.add(ship.fleetId);
                    }
                }
            }

            // Sync fleet ID counter to avoid collisions
            if (this.fleetSystem && this.fleetSystem.ships.length > 0) {
                const maxId = Math.max(...this.fleetSystem.ships.map(s => parseInt(s.fleetId) || 0));
                setFleetIdCounter(maxId + 1);
            }
        }

        // 3b. Secret Elder Wormhole unlocks
        if (data.unlockedSecretWormholes) {
            this.unlockedSecretWormholes = new Set(data.unlockedSecretWormholes);
        }

        // 3c. Faction
        if (data.faction) {
            this.faction = { ...data.faction };
        }

        // 3c. Faction standings
        if (data.factionStandings) {
            this.factionStandings = { ...data.factionStandings };
        }

        // 4. Insurance
        if (data.insurance) {
            this.insurance = { ...data.insurance };
        }

        // 5. Power routing
        if (data.powerRouting) {
            this.powerRouting = { ...data.powerRouting };
        }

        // 6. Write subsystem localStorage keys so their load() methods pick them up
        const lsMap = {
            'expedition-skills': data.skills,   // legacy
            'expedition-skill-gains': data.skillGains,
            'expedition-skill-tree': data.skillTree,
            'expedition-achievements': data.achievements,
            'expedition-guild-state': data.guildState,
            'expedition-guild-economy': data.guildEconomy,
            'expedition-commerce-state': data.commerceState,
            'expedition-discoveries': data.discoveries,
            'expedition-survey-data': data.surveyData,
            'expedition-bounties': data.bounties,
            'expedition-completed-bounties': data.completedBounties,
            'expedition-ship-log': data.shipLog,
            'expedition-bookmarks': data.bookmarks,
            'expedition-skippy': data.skippy,
            'expedition-aar-reports': data.aarReports,
            'expedition-manufacturing': data.manufacturing,
            'expedition-fitting-templates': data.fittingTemplates,
            'expedition-intel-data': data.intelData,
            'expedition-bounty-board': data.bountyBoard,
        };

        for (const [key, value] of Object.entries(lsMap)) {
            if (value !== null && value !== undefined) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        }

        // Raw string keys
        if (data.bountyCounter !== null && data.bountyCounter !== undefined) {
            localStorage.setItem('expedition-bounty-counter', String(data.bountyCounter));
        }
        if (data.bountyRefresh !== null && data.bountyRefresh !== undefined) {
            localStorage.setItem('expedition-bounty-refresh', String(data.bountyRefresh));
        }

        // 7. Reload subsystems that read from localStorage
        if (this.skillGainSystem) {
            this.skillGainSystem.skills = this.skillGainSystem.load();
            this.skillGainSystem.skillPoints = this.skillGainSystem.skills._sp || 0;
            this.skillGainSystem.applyBonuses();
        }
        if (this.skillTreeSystem) {
            this.skillTreeSystem.allocated = this.skillTreeSystem.load();
        }
        if (this.achievementSystem) {
            this.achievementSystem.unlocked = this.achievementSystem.load();
        }
        this.guildSystem?.loadState?.();
        this.guildEconomySystem?.loadState?.();
        this.commerceSystem?.loadState?.();
        this.surveySystem?.loadState?.();
        if (this.encyclopedia) {
            this.encyclopedia.discoveries = this.encyclopedia.loadDiscoveries();
        }
        this.skippy?.loadState?.();
        this.engagementRecorder?.loadReports();

        // Load new systems
        if (data.manufacturing) this.manufacturingSystem?.loadState(data.manufacturing);
        if (data.bountyBoard) this.bountySystem?.loadState(data.bountyBoard);
        if (data.intelData) this.intelSystem?.loadState(data.intelData);
        if (data.fleet?.activeDoctrine) this.fleetSystem?.setDoctrine(data.fleet.activeDoctrine);
        if (data.sectorEvents) this.sectorEventSystem?.loadState(data.sectorEvents);
        if (data.missions) this.missionSystem?.loadState(data.missions);
        if (data.coalitionWar) this.coalitionWarSystem?.loadState(data.coalitionWar);

        // Restore player stations (POS)
        if (data.playerStations && Array.isArray(data.playerStations)) {
            this.playerStations = [];
            for (const posData of data.playerStations) {
                const station = new PlayerStation(this, {
                    x: posData.x || 0,
                    y: posData.y || 0,
                    name: posData.name || 'Player Station',
                    owner: posData.owner || this.faction,
                    sectorId: posData.sectorId,
                    upgradeLevel: posData.upgradeLevel,
                    modules: posData.modules || [],
                });
                station.hull = posData.hull ?? station.maxHull;
                station.shieldHP = posData.shieldHP ?? station.maxShieldHP;
                station.storage = posData.storage || { ore: {}, tradeGoods: {}, materials: {} };
                // Restore turrets
                if (posData.turrets) {
                    for (const t of posData.turrets) {
                        station.addTurret(t.type);
                    }
                }
                // Recalculate stats with module bonuses
                station.recalculateStats();
                this.playerStations.push(station);
            }
        }

        // Bookmarks
        this.bookmarks = this.loadBookmarks();

        // Insurance
        this.insurance = data.insurance || this.insurance;

        // 8. Change sector to saved sector
        if (data.currentSectorId && data.currentSectorId !== this.currentSector?.id) {
            this.changeSector(data.currentSectorId);
        }

        // 9. Stats
        if (data.stats) {
            this.stats = { ...Game.DEFAULT_STATS, ...data.stats, sessionStart: Date.now() };
        }

        // 10. Market state
        if (data.marketState) {
            loadMarketState(data.marketState);
        }

        // 11. Order book state
        if (data.orderBookState) {
            loadOrderBookState(data.orderBookState);
        }

        console.log('Game state restored from save');
    }

    /**
     * Get market state for saving
     */
    getMarketState() {
        return getMarketState();
    }

    /**
     * Get order book state for saving
     */
    getOrderBookState() {
        return getOrderBookState();
    }
}
