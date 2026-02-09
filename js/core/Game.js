// =============================================
// Main Game Controller
// Orchestrates all game systems
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { Renderer } from '../graphics/Renderer.js';
import { InputManager } from './InputManager.js';
import { Camera } from './Camera.js';
import { Universe } from '../universe/Universe.js';
import { PlayerShip } from '../entities/PlayerShip.js';
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
import { AdminDashboardManager } from '../ui/AdminDashboardManager.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from './AudioManager.js';
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

        // Bookmarks
        this.bookmarks = [];

        // Fleet state (persists across sectors)
        this.fleet = { ships: [], hiredPilots: [] };

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
        this.adminDashboard = null;
        this.dialogueManager = null;
        this.playerAggressive = false;
        this.ui = null;
        this.audio = null;
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

        // Create UI manager (last, needs other systems)
        this.ui = new UIManager(this);

        // Create admin dashboard (after UI)
        this.adminDashboard = new AdminDashboardManager(this);

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
        });

        // Combat events
        this.events.on('combat:hit', (data) => {
            if (data.target === this.player) {
                this.audio.play('hit');
                // Screen flash based on damage severity
                const hpPercent = this.player.hp / this.player.maxHp;
                if (hpPercent < 0.5) {
                    this.ui?.damageFlash(0.4);
                } else if (data.damage > this.player.maxHp * 0.1) {
                    this.ui?.damageFlash(0.2);
                }
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
            }
        });

        // Mining events (ore now goes to cargo, not direct credits)
        this.events.on('mining:complete', (data) => {
            // Log is handled by MiningSystem when ore is added to cargo
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

        // Lose credits
        const loss = Math.floor(this.credits * CONFIG.DEATH_CREDIT_PENALTY);
        this.credits -= loss;
        this.ui.log(`Lost ${loss} ISK`, 'combat');
        this.ui?.showCreditPopup(loss, window.innerWidth / 2, window.innerHeight / 2, 'loss');

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

        // Fire event
        this.events.emit('sector:change', sectorId);
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

        // Simulate lock time
        setTimeout(() => {
            if (entity.alive && this.player.alive) {
                this.lockedTarget = entity;
                entity.locked = true;
                this.events.emit('target:locked', entity);
                this.ui.log(`Target locked: ${entity.name}`, 'system');
                this.audio.play('lock-complete');
            }
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
     * Dock at station
     */
    dockAtStation(station) {
        this.dockedAt = station;
        this.player.velocity.set(0, 0);
        this.paused = true;
        this.events.emit('station:docked', station);
        this.ui.showStationPanel(station);
        this.audio.play('dock');
    }

    /**
     * Undock from station
     */
    undock() {
        if (!this.dockedAt) return;

        const station = this.dockedAt;
        this.dockedAt = null;
        this.paused = false;

        // Position player outside station
        this.player.x = station.x + 300;
        this.player.y = station.y;

        this.events.emit('station:undocked');
        this.ui.hideStationPanel();
        this.ui.log(`Undocked from ${station.name}`, 'system');
        this.audio.play('undock');
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
        this.ui.log(`Bookmark saved: ${bookmark.name}`, 'system');
        return bookmark;
    }

    /**
     * Remove bookmark
     */
    removeBookmark(id) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            this.bookmarks.splice(index, 1);
        }
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
            this.update(this.deltaTime);
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
        this.mining.update(dt);
        this.collision.update(dt);

        // Update camera
        this.camera.update(dt);

        // Update UI
        this.ui.update(dt);
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
}
