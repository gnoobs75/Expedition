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
import { SkillSystem } from '../systems/SkillSystem.js';
import { AchievementSystem } from '../systems/AchievementSystem.js';
import { HazardSystem } from '../systems/HazardSystem.js';
import { EngagementRecorder } from '../systems/EngagementRecorder.js';
import { ManufacturingSystem } from '../systems/ManufacturingSystem.js';
import { AnomalySystem } from '../systems/AnomalySystem.js';
import { SectorEventSystem } from '../systems/SectorEventSystem.js';
import { BountySystem } from '../systems/BountySystem.js';
import { IntelSystem } from '../systems/IntelSystem.js';
import { PlayerStationDefenseSystem } from '../systems/PlayerStationDefenseSystem.js';
import { PlayerStation } from '../entities/PlayerStation.js';
import { AdminDashboardManager } from '../ui/AdminDashboardManager.js';
import { EncyclopediaManager } from '../ui/EncyclopediaManager.js';
import { SkippyManager } from '../ui/SkippyManager.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';
import { EventBus } from './EventBus.js';

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
        this.lockedTarget = null;
        this.selectedTarget = null;

        // Bookmarks (persisted)
        this.bookmarks = this.loadBookmarks();

        // Fleet state (persists across sectors)
        this.fleet = { ships: [], hiredPilots: [] };

        // Player faction
        this.faction = { name: 'Unnamed Faction', color: '#00ccff', treasury: 0 };

        // Player-owned stations (POS)
        this.playerStations = [];

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
        this.skillSystem = null;
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
        this.skillSystem = new SkillSystem(this);
        this.achievementSystem = new AchievementSystem(this);
        this.hazardSystem = new HazardSystem(this);
        this.engagementRecorder = new EngagementRecorder(this);
        this.manufacturingSystem = new ManufacturingSystem(this);
        this.anomalySystem = new AnomalySystem(this);
        this.sectorEventSystem = new SectorEventSystem(this);
        this.bountySystem = new BountySystem(this);
        this.intelSystem = new IntelSystem(this);
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

        // Apply skill bonuses to player
        this.skillSystem.applyBonuses();

        // Start in hub sector
        this.changeSector('hub');

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
        const shipConfig = CONFIG.SHIPS.frigate;

        this.player = new PlayerShip(this, {
            x: CONFIG.SECTOR_SIZE / 2,
            y: CONFIG.SECTOR_SIZE / 2,
            ...shipConfig,
        });

        // Default modules (1 attack laser + 1 mining laser)
        this.player.fitModule('high-1', 'small-laser');
        this.player.fitModule('high-2', 'mining-laser');
        // high-3 left empty
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
            if (entity === this.lockedTarget) {
                this.lockedTarget = null;
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
                const hpPercent = this.player.hp / this.player.maxHp;
                if (hpPercent < 0.5) {
                    this.ui?.damageFlash(0.4);
                } else if (data.damage > this.player.maxHp * 0.1) {
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

        // Visual feedback on enemy kill (credits already handled in EnemyShip.destroy)
        this.events.on('entity:destroyed', (entity) => {
            if (entity.bounty && entity.bounty > 0 && this.player?.alive) {
                this.audio?.play('target-destroyed');
                // Show floating credit popup at entity screen position
                if (this.input) {
                    const screen = this.input.worldToScreen(entity.x, entity.y);
                    this.ui?.showCreditPopup(entity.bounty, screen.x, screen.y, 'bounty');
                }
                // Kill mail log entry
                this.ui?.logKillMail(entity);

                // Cinematic kill camera - brief slowdown + zoom
                this.timeScale = 0.3;
                const savedZoom = this.camera.zoom;
                this.camera.zoom = Math.min(savedZoom * 1.15, savedZoom + 50);
                setTimeout(() => {
                    this.timeScale = 1.0;
                    this.camera.zoom = savedZoom;
                }, 400);

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
        this.ui.log('Ship destroyed! Respawning at hub...', 'combat');
        this.audio.play('explosion');
        this.ui?.damageFlash(0.6);
        this.camera?.shake(15, 0.5);

        // Track death
        this.stats.deaths++;
        this.saveStats();
        this.ui?.addShipLogEntry('Ship destroyed! Respawning...', 'combat');
        this.ui?.addCombatLogEntry({
            type: 'death',
            source: this.player?.lastDamageSource,
            target: this.player,
            damage: 0,
        });

        // Lose credits
        const loss = Math.floor(this.credits * CONFIG.DEATH_CREDIT_PENALTY);
        this.credits -= loss;
        this.ui.log(`Lost ${loss} ISK`, 'combat');
        this.ui?.showCreditPopup(loss, window.innerWidth / 2, window.innerHeight / 2, 'loss');

        // Insurance payout
        if (this.insurance.active) {
            const shipId = this.player?.shipClass || 'frigate';
            const shipData = SHIP_DATABASE[shipId];
            const shipValue = shipData?.price || CONFIG.SHIPS.frigate?.price || 5000;
            const payout = Math.floor(shipValue * this.insurance.payoutRate);
            if (payout > 0) {
                this.credits += payout;
                this.ui.log(`Insurance payout: +${payout} ISK (${this.insurance.tierName})`, 'system');
                this.ui?.addShipLogEntry(`Insurance payout: +${payout} ISK`, 'trade');
                this.audio?.play('sell');
                setTimeout(() => {
                    this.ui?.showCreditPopup(payout, window.innerWidth / 2, window.innerHeight / 2 - 40, 'gain');
                }, 500);
            }
            // Insurance is single-use per purchase
            this.insurance = { active: false, tier: null, tierName: null, payoutRate: 0, premium: 0, shipInsured: null };
            this.saveInsurance();
        }

        // Respawn after delay
        setTimeout(() => {
            this.respawnPlayer();
        }, 3000);
    }

    /**
     * Respawn player at hub
     */
    respawnPlayer() {
        // Recreate player ship
        this.createPlayer();

        // Move to hub
        this.changeSector('hub');

        // Position at station (far from central planet)
        const station = this.currentSector.getStation();
        if (station) {
            this.player.x = station.x + station.radius + 100;
            this.player.y = station.y;
        } else {
            // Safe fallback - away from center
            this.player.x = CONFIG.SECTOR_SIZE / 2 + 6000;
            this.player.y = CONFIG.SECTOR_SIZE / 2;
        }

        this.player.velocity.set(0, 0);
        this.player.alive = true;

        // Re-apply skill bonuses to new ship
        this.skillSystem?.applyBonuses();

        this.ui.log('Ship reconstructed. Welcome back, capsuleer.', 'system');
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

        // Check player has the kit in cargo
        const kitId = posKitType || 'pos-kit-basic';
        const hasKit = this.player.cargo[kitId]?.quantity > 0;
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

        // Remove kit from cargo
        this.player.cargo[kitId].quantity -= 1;
        if (this.player.cargo[kitId].quantity <= 0) delete this.player.cargo[kitId];

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
     * Lock target for combat/mining
     */
    lockTarget(entity) {
        if (!entity) return;

        // Start lock timer
        const lockTime = CONFIG.LOCK_TIME_BASE;

        this.ui.log(`Locking ${entity.name}...`, 'system');
        this.audio.play('lock-start');

        // Track locking progress for visual feedback
        this.lockingTarget = entity;
        this.lockingStartTime = performance.now();
        this.lockingDuration = lockTime * 1000;

        // Simulate lock time
        setTimeout(() => {
            if (entity.alive && this.player.alive) {
                this.lockedTarget = entity;
                entity.locked = true;
                this.events.emit('target:locked', entity);
                this.ui.log(`Target locked: ${entity.name}`, 'system');
                this.audio.play('lock-complete');
            }
            this.lockingTarget = null;
        }, lockTime * 1000);
    }

    /**
     * Unlock current target
     */
    unlockTarget() {
        if (this.lockedTarget) {
            this.lockedTarget.locked = false;
            this.lockedTarget = null;
            this.events.emit('target:unlocked');
        }
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
     * Update game state
     */
    update(dt) {
        this._lastDt = dt;

        // Update autopilot FIRST (sets desiredSpeed/desiredRotation)
        this.autopilot.update(dt);

        // Update player (uses desiredSpeed/desiredRotation)
        if (this.player && this.player.alive) {
            this.player.update(dt);
        }

        // Update current sector entities
        if (this.currentSector) {
            this.currentSector.update(dt);
        }

        // Update game systems
        this.ai.update(dt);
        this.npcSystem.update(dt);
        this.fleetSystem.update(dt);
        this.guildEconomySystem.update(dt);
        this.combat.update(dt);
        this.tackleSystem.update(dt);
        this.surveySystem.update(dt);
        this.logisticsSystem.update(dt);
        this.mining.update(dt);
        this.collision.update(dt);
        this.achievementSystem.update(dt);
        this.hazardSystem.update(dt);
        this.engagementRecorder?.update(dt);
        this.manufacturingSystem?.update(dt);
        this.anomalySystem?.update(dt);
        this.sectorEventSystem?.update(dt);
        this.bountySystem?.update(dt);
        this.intelSystem?.update(dt);
        this.posDefenseSystem?.update(dt);

        // Auto-loot tractor beam
        this.updateTractorBeams(dt);

        // Update engine hum volume based on player speed
        if (this.player && this.audio?.engineHumGain) {
            const speedFrac = this.player.currentSpeed / (this.player.maxSpeed || 1);
            this.audio.updateEngineHum(speedFrac);
        }

        // DPS tracking
        this.updateDPSTracker();

        // Dynamic music mode detection
        this.updateMusicMode();

        // Update camera
        this.camera.update(dt);

        // Update Skippy advisor
        this.skippy?.update(dt);

        // Update UI
        this.ui.update(dt);
    }

    /**
     * Calculate rolling DPS from damage logs
     */
    updateDPSTracker() {
        const now = performance.now();
        const window = this.dpsTracker.window;

        // Prune old entries
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
            (this.lockedTarget && this.lockedTarget.alive &&
                (this.lockedTarget.hostility === 'hostile' || this.lockedTarget.hostility === 'criminal')) ||
            // Player is being attacked (recent damage)
            (this.player._lastDamageTime && (performance.now() - this.player._lastDamageTime) < 8000) ||
            // Player has active weapon modules firing at something
            (this.player.activeModules && Array.from(this.player.activeModules.values()).some(m => m.damage > 0))
        );

        if (inCombat) {
            this.audio.setMusicMode('combat');
            return;
        }

        // Check sector danger level
        const sectorId = this.currentSector?.id;
        if (sectorId) {
            const layout = UNIVERSE_LAYOUT[sectorId];
            const danger = layout?.dangerLevel || 0;
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
        }

        // 3b. Faction
        if (data.faction) {
            this.faction = { ...data.faction };
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
            'expedition-skills': data.skills,
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
        if (this.skillSystem) {
            this.skillSystem.skills = this.skillSystem.load();
            this.skillSystem.applyBonuses();
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

        console.log('Game state restored from save');
    }
}
