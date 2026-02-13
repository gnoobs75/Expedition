// =============================================
// UI Manager
// Handles all HTML/CSS UI overlays
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { SKILL_DEFINITIONS } from '../systems/SkillSystem.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { formatDistance, formatCredits } from '../utils/math.js';
import { keyBindings } from '../core/KeyBindings.js';
import { PanelDragManager } from './PanelDragManager.js';
import { ShipMenuManager } from './ShipMenuManager.js';
import { SectorMapManager } from './SectorMapManager.js';
import { StationVendorManager } from './StationVendorManager.js';
import { ModelEditorManager } from './ModelEditorManager.js';
import { FleetPanelManager } from './FleetPanelManager.js';
import { CantinaManager } from './CantinaManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';
import { HelpSystem } from './HelpSystem.js';
import { DialogueManager } from './DialogueManager.js';
import { GuildPanelManager } from './GuildPanelManager.js';
import { CommercePanelManager } from './CommercePanelManager.js';
import { QuestTrackerManager } from './QuestTrackerManager.js';
import { LootContainer } from '../entities/LootContainer.js';
import { TRADE_GOODS } from '../data/tradeGoodsDatabase.js';
import { TacticalReplay } from './TacticalReplay.js';
import { ManufacturingPanelManager } from './ManufacturingPanelManager.js';
import { FittingTemplateManager } from './FittingTemplateManager.js';
import { HackingMinigame } from './HackingMinigame.js';
import { BountyBoardManager } from './BountyBoardManager.js';

export class UIManager {
    constructor(game) {
        this.game = game;

        // UI update timers
        this.hudTimer = 0;
        this.overviewTimer = 0;

        // Cached DOM elements
        this.elements = {};
        this.cacheElements();

        // Context menu state
        this.contextMenuTarget = null;

        // Object viewer update timer
        this.objectViewerTimer = 0;

        // Proximity warning cooldowns (entity -> timestamp)
        this.proximityAlerted = new Map();

        // Panel drag manager
        this.panelDragManager = new PanelDragManager(game);

        // Ship menu manager (for C key)
        this.shipMenuManager = new ShipMenuManager(game);

        // Sector map manager (for M key)
        this.sectorMapManager = new SectorMapManager(game);

        // Station vendor manager
        this.vendorManager = new StationVendorManager(game);

        // Model editor manager (for G key)
        this.modelEditorManager = new ModelEditorManager(game);

        // Fleet panel manager
        this.fleetPanelManager = new FleetPanelManager(game);

        // Cantina manager
        this.cantinaManager = new CantinaManager(game);

        // Performance monitor
        this.performanceMonitor = new PerformanceMonitor(game);

        // Help system
        this.helpSystem = new HelpSystem();

        // Dialogue manager
        this.dialogueManager = new DialogueManager(game);
        game.dialogueManager = this.dialogueManager;

        // Guild panel manager
        this.guildPanelManager = new GuildPanelManager(game);

        // Commerce panel manager
        this.commercePanelManager = new CommercePanelManager(game);

        // Quest tracker
        this.questTracker = new QuestTrackerManager(game);

        // Tactical replay viewer
        this.tacticalReplay = new TacticalReplay(game);

        // Manufacturing panel manager (station tab)
        this.manufacturingPanelManager = new ManufacturingPanelManager(game);

        // Fitting template manager
        this.fittingTemplateManager = new FittingTemplateManager(game);

        // Hacking minigame (data anomalies)
        this.hackingMinigame = new HackingMinigame(game);

        // Bounty board manager (station tab)
        this.bountyBoardManager = new BountyBoardManager(game);

        // Ship indicator 3D viewer state
        this.shipViewerScene = null;
        this.shipViewerCamera = null;
        this.shipViewerRenderer = null;
        this.shipViewerMesh = null;
        this.shipViewerInitialized = false;

        // Initialize UI
        this.setupEventListeners();
        this.initPanelDragManager();
        this.helpSystem.init();
        this.initShipIndicatorViewer();
        this.initPowerRouting();

        // Listen for ship switch to update 3D viewer
        game.events.on('ship:switched', () => this.updateShipViewerMesh());

        // Quest/guild visual effects
        game.events.on('quest:completed', () => {
            if (game.player) {
                game.renderer?.effects?.spawn('quest-complete', game.player.x, game.player.y);
            }
        });

        game.events.on('target:destroyed', () => {
            if (game.player) {
                game.renderer?.effects?.spawn('loot', game.player.x, game.player.y);
            }
        });

        // Sector event banner
        game.events.on('event:started', (data) => this.showEventBanner(data));
        game.events.on('event:ended', (data) => this.hideEventBanner(data));

        // Log messages
        this.maxLogMessages = 50;
        this.logFilter = 'all';

        // Ship log (persistent important events)
        this.shipLog = this.loadShipLog();
        this.maxShipLogEntries = 100;
        this.shipLogFilter = 'all';

        // Combat log (session-only detailed combat events)
        this.combatLog = [];
        this.maxCombatLogEntries = 200;
        this.combatLogFilter = 'all';
        this.combatLogStats = {
            totalDealt: 0, totalTaken: 0,
            hits: 0, misses: 0,
            kills: 0, deaths: 0,
        };

        // Bounty board state
        this.activeBounties = this.loadBounties();   // {id, targetName, targetShipClass, factionName, reward, sectorHint, status, acceptedAt, expiresAt}
        this.completedBountyIds = new Set(JSON.parse(localStorage.getItem('expedition-completed-bounties') || '[]'));
        this.bountyIdCounter = parseInt(localStorage.getItem('expedition-bounty-counter') || '0');
        this.lastBountyRefresh = parseInt(localStorage.getItem('expedition-bounty-refresh') || '0');

        // Overview sorting
        this.overviewSortColumn = 'dist';
        this.overviewSortAsc = true;

        // Previous health values for warning flash
        this.prevHealth = { shield: 100, armor: 100, hull: 100, capacitor: 100 };

        // Breach warning flags (reset when shield recovers above 50%)
        this.breachFlags = { shieldDown: false, armorBreach: false, hullCritical: false };

        // Kill streak tracking
        this.killStreak = 0;
        this.killStreakTimer = null;

        // D-Scan state for cone visualization
        this.dscanAngle = 60;
        this.dscanRange = 10000;

        // Minimap scan pulse state
        this.scanPulse = null; // { startTime, duration, range, results }

        // Station ambient particles
        this.stationAmbientCanvas = document.getElementById('station-ambient-canvas');
        this.stationAmbientCtx = null;
        this.stationAmbientParticles = [];
        this.stationAmbientRAF = null;

        // Tactical overlay state
        this.tacticalEnabled = false;
        this.tacticalContainer = document.getElementById('tactical-overlay');
        this._tacPool = []; // DOM element pool for recycling

        // Hull alarm state
        this._hullAlarmActive = false;
        this._hullAlarmInterval = null;

        // Repair popup throttle (entity id -> last popup timestamp)
        this._repairPopupThrottle = new Map();

        // Gate label pool
        this._gateLabelPool = [];

        // Global tooltip state
        this._globalTooltipTarget = null;

        // Confirmation dialog state
        this._confirmCallback = null;
        this._confirmCancelCallback = null;

        // Previous credit value for pulse detection
        this._prevCredits = 0;
    }

    /**
     * Cache frequently accessed DOM elements
     */
    cacheElements() {
        this.elements = {
            // Status bars
            shieldBar: document.getElementById('shield-bar'),
            armorBar: document.getElementById('armor-bar'),
            hullBar: document.getElementById('hull-bar'),
            capacitorBar: document.getElementById('capacitor-bar'),
            shieldText: document.getElementById('shield-text'),
            armorText: document.getElementById('armor-text'),
            hullText: document.getElementById('hull-text'),
            capacitorText: document.getElementById('capacitor-text'),

            // Bar containers (for warning effects)
            shieldContainer: document.getElementById('shield-bar')?.parentElement,
            armorContainer: document.getElementById('armor-bar')?.parentElement,
            hullContainer: document.getElementById('hull-bar')?.parentElement,
            capacitorContainer: document.getElementById('capacitor-bar')?.parentElement,

            // Speed, heading, and credits
            speedValue: document.getElementById('speed-value'),
            headingDegrees: document.getElementById('heading-degrees'),
            headingCardinal: document.getElementById('heading-cardinal'),
            compassNeedle: document.getElementById('compass-needle'),
            compassTargetBearing: document.getElementById('compass-target-bearing'),
            creditsValue: document.getElementById('credits-value'),

            // Cargo display
            cargoBar: document.getElementById('cargo-bar'),
            cargoText: document.getElementById('cargo-text'),

            // Locked targets
            lockedTargetsContainer: document.getElementById('locked-targets-container'),

            // Target panel
            targetPanel: document.getElementById('target-panel'),
            targetName: document.getElementById('target-name'),
            targetType: document.getElementById('target-type'),
            targetDistance: document.getElementById('target-distance'),
            targetShieldBar: document.getElementById('target-shield-bar'),
            targetArmorBar: document.getElementById('target-armor-bar'),
            targetHullBar: document.getElementById('target-hull-bar'),

            // Overview
            overviewBody: document.getElementById('overview-body'),
            overviewFilters: document.getElementById('overview-filters'),

            // Module rack
            moduleRack: document.getElementById('module-rack'),

            // Event log
            logMessages: document.getElementById('log-messages'),

            // Ship Indicator
            shipIndicator: document.getElementById('ship-indicator'),
            shipIndicatorCanvas: document.getElementById('ship-indicator-canvas'),
            shipIndicatorName: document.getElementById('ship-indicator-name'),
            shipIndicatorClass: document.getElementById('ship-indicator-class'),
            shipShieldBar: document.getElementById('ship-shield-bar'),
            shipArmorBar: document.getElementById('ship-armor-bar'),
            shipHullBar: document.getElementById('ship-hull-bar'),

            // Drone Bar
            droneBar: document.getElementById('drone-bar'),

            // Autopilot Indicator
            autopilotIndicator: document.getElementById('autopilot-indicator'),
            autopilotStatusText: document.getElementById('autopilot-status-text'),

            // Context menu
            contextMenu: document.getElementById('context-menu'),

            // Station panel
            stationPanel: document.getElementById('station-panel'),
            stationName: document.getElementById('station-name'),

            // D-Scan
            dscanPanel: document.getElementById('dscan-panel'),

            // Bookmarks
            bookmarksPanel: document.getElementById('bookmarks-panel'),

            // Object Viewer
            objectViewer: document.getElementById('object-viewer'),
            objectViewerContent: document.getElementById('object-viewer-content'),

            // Settings
            settingsPanel: document.getElementById('settings-panel'),
            settingsBtn: document.getElementById('settings-btn'),
            settingsClose: document.getElementById('settings-close'),
            keybindingsList: document.getElementById('keybindings-list'),
            resetAllBindings: document.getElementById('reset-all-bindings'),

            // Overview panel
            overviewPanel: document.getElementById('overview-panel'),

            // Damage popups container
            damagePopups: document.getElementById('damage-popups'),

            // Gate labels container
            gateLabels: document.getElementById('gate-labels'),

            // Ship indicator capacitor bar
            shipCapBar: document.getElementById('ship-cap-bar'),
            shipCapPct: document.getElementById('ship-cap-pct'),

            // Target combat info
            targetDpsOut: document.getElementById('target-dps-out'),
            targetSpeedVal: document.getElementById('target-speed-val'),
            targetAngularVal: document.getElementById('target-angular-val'),

            // Hull warning elements
            hullWarningText: document.getElementById('hull-warning-text'),
            hullVignette: document.getElementById('hull-vignette'),

            // Global tooltip
            globalTooltip: document.getElementById('global-tooltip'),

            // Confirmation dialog
            confirmDialog: document.getElementById('confirm-dialog'),
            confirmTitle: document.getElementById('confirm-title'),
            confirmMessage: document.getElementById('confirm-message'),
            confirmYesBtn: document.getElementById('confirm-yes-btn'),
            confirmNoBtn: document.getElementById('confirm-no-btn'),

            // Damage direction
            damageDirectionContainer: document.getElementById('damage-direction-container'),
        };
    }

    /**
     * Set up UI event listeners
     */
    setupEventListeners() {
        // Overview filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.updateOverview();
            });
        });

        // Overview column sorting
        document.querySelectorAll('#overview-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.overviewSortColumn === col) {
                    this.overviewSortAsc = !this.overviewSortAsc;
                } else {
                    this.overviewSortColumn = col;
                    this.overviewSortAsc = col === 'name' || col === 'type'; // alpha default asc, numeric default asc
                }
                // Update header classes
                document.querySelectorAll('#overview-table th.sortable').forEach(h => {
                    h.classList.remove('active-sort', 'sort-asc', 'sort-desc');
                });
                th.classList.add('active-sort', this.overviewSortAsc ? 'sort-asc' : 'sort-desc');
                this.updateOverview();
            });
        });

        // Overview row hover tooltips
        const overviewBody = document.getElementById('overview-body');
        if (overviewBody) {
            let tipEl = null;
            overviewBody.addEventListener('mouseover', (e) => {
                const row = e.target.closest('tr[data-tip-name]');
                if (!row) return;
                if (tipEl) tipEl.remove();
                tipEl = document.createElement('div');
                tipEl.className = 'overview-tooltip';
                const parts = [];
                const name = row.dataset.tipName;
                const cls = row.dataset.tipClass;
                const hp = row.dataset.tipHp;
                const bounty = row.dataset.tipBounty;
                const faction = row.dataset.tipFaction;
                const role = row.dataset.tipRole;
                const threat = row.dataset.tipThreat;
                const sizeComp = row.dataset.tipSize;
                parts.push(`<div class="ov-tip-name">${name}</div>`);
                if (cls) parts.push(`<div class="ov-tip-row">Class: ${cls}</div>`);
                if (sizeComp) parts.push(`<div class="ov-tip-row ov-tip-size">${sizeComp}</div>`);
                if (role) parts.push(`<div class="ov-tip-row">Role: ${role}</div>`);
                if (faction) parts.push(`<div class="ov-tip-row">Faction: ${faction}</div>`);
                if (hp) parts.push(`<div class="ov-tip-row">${hp}</div>`);
                if (bounty) parts.push(`<div class="ov-tip-row">Bounty: ${bounty}</div>`);
                if (threat) parts.push(`<div class="ov-tip-row ov-tip-threat">Threat: ${threat}</div>`);
                tipEl.innerHTML = parts.join('');
                const rect = row.getBoundingClientRect();
                tipEl.style.left = `${rect.right + 8}px`;
                tipEl.style.top = `${rect.top}px`;
                document.body.appendChild(tipEl);
            });
            overviewBody.addEventListener('mouseout', (e) => {
                if (!e.target.closest('tr[data-tip-name]')) return;
                if (tipEl) { tipEl.remove(); tipEl = null; }
            });
        }

        // Log filter buttons
        document.querySelectorAll('.log-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.logFilter = btn.dataset.logFilter;
                this.applyLogFilter();
            });
        });

        // Ship log filter buttons
        document.querySelectorAll('[data-ship-log]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-ship-log]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.shipLogFilter = btn.dataset.shipLog;
                this.renderShipLog();
            });
        });

        // Combat log filter buttons
        document.querySelectorAll('[data-clog]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-clog]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.combatLogFilter = btn.dataset.clog;
                this.renderCombatLog();
            });
        });

        // Context menu - event delegation (handles dynamically built menus)
        this.elements.contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.menu-item, .submenu-item');
            if (!item) return;
            if (item.classList.contains('has-submenu')) return;
            if (item.classList.contains('disabled')) return;

            const action = item.dataset.action;
            if (action) {
                this.handleContextMenuAction(action);
            }
        });

        // Close context menu on click elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#context-menu')) {
                this.hideContextMenu();
            }
        });

        // Module slot clicks
        document.querySelectorAll('.module-slot').forEach((slot, index) => {
            slot.addEventListener('click', () => {
                const player = this.game.player;
                if (!player) return;
                // Determine slot id to check active state before toggle
                let slotId;
                if (index < player.highSlots) slotId = `high-${index + 1}`;
                else if (index < player.highSlots + player.midSlots) slotId = `mid-${index - player.highSlots + 1}`;
                else slotId = `low-${index - player.highSlots - player.midSlots + 1}`;
                const wasActive = player.activeModules.has(slotId);
                player.toggleModule(index);
                this.game.audio?.play(wasActive ? 'module-deactivate' : 'module-activate');
            });
        });

        // Station panel tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Find parent modal to scope tab switching
                const parentModal = btn.closest('.modal-content');
                if (parentModal) {
                    parentModal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    parentModal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                } else {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                }
                btn.classList.add('active');
                const tabEl = document.getElementById(`tab-${btn.dataset.tab}`);
                if (tabEl) tabEl.classList.add('active');

                // Notify vendor manager of tab change
                if (['hangar', 'ships', 'equipment', 'fitting'].includes(btn.dataset.tab)) {
                    this.vendorManager?.updateTab(btn.dataset.tab);
                }
                // Update refinery when switching to it
                if (btn.dataset.tab === 'refinery') {
                    this.updateRefineryTab();
                }
                // Update cantina when switching to it
                if (btn.dataset.tab === 'cantina') {
                    this.cantinaManager?.show(this.game.dockedAt);
                }
                // Update guild when switching to it
                if (btn.dataset.tab === 'guild') {
                    this.guildPanelManager?.render(document.getElementById('guild-content'));
                }
                // Update commerce when switching to it
                if (btn.dataset.tab === 'commerce') {
                    this.commercePanelManager?.render(document.getElementById('commerce-content'), this.game.dockedAt);
                }
                // Update insurance when switching to it
                if (btn.dataset.tab === 'insurance') {
                    this.updateInsuranceTab();
                }
                // Update bounty board when switching to it
                if (btn.dataset.tab === 'bounty') {
                    this.updateBountyTab();
                }
                // Update skills when switching to it
                if (btn.dataset.tab === 'skills') {
                    this.updateSkillsTab();
                }
            });
        });

        // Undock button
        document.getElementById('undock-btn')?.addEventListener('click', () => {
            this.game.undock();
        });

        // D-Scan button
        document.getElementById('dscan-scan')?.addEventListener('click', () => {
            this.performDScan();
        });

        // Panel close buttons
        document.querySelectorAll('.panel-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.panel').classList.add('hidden');
            });
        });

        // Overview row click handling (delegated)
        this.elements.overviewBody?.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row && row.dataset.entityId) {
                const entity = this.findEntityById(parseInt(row.dataset.entityId));
                if (entity) {
                    this.game.selectTarget(entity);
                }
            }
        });

        // Overview row right-click (delegated)
        this.elements.overviewBody?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const row = e.target.closest('tr');
            if (row && row.dataset.entityId) {
                const entity = this.findEntityById(parseInt(row.dataset.entityId));
                if (entity) {
                    this.game.selectTarget(entity);
                    this.showContextMenu(e.clientX, e.clientY, entity);
                }
            }
        });

        // Settings button
        this.elements.settingsBtn?.addEventListener('click', () => {
            this.toggleSettings();
        });

        // Settings close button
        this.elements.settingsClose?.addEventListener('click', () => {
            this.hideSettings();
        });

        // Reset all keybindings button
        this.elements.resetAllBindings?.addEventListener('click', () => {
            keyBindings.resetToDefaults();
            this.updateKeybindingsPanel();
            this.game.audio?.play('click');
        });

        // Settings panel tab handling
        document.querySelectorAll('#settings-panel .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#settings-panel .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('#settings-panel .tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Audio settings
        document.getElementById('master-volume')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('volume-value').textContent = `${value}%`;
            if (this.game.audio) {
                this.game.audio.setMasterVolume(value / 100);
            }
        });

        document.getElementById('sfx-enabled')?.addEventListener('change', (e) => {
            if (this.game.audio) {
                this.game.audio.enabled = e.target.checked;
                this.game.audio.saveSettings();
            }
        });

        // Music settings
        document.getElementById('music-volume')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('music-volume-value').textContent = `${value}%`;
            if (this.game.audio) {
                this.game.audio.setMusicVolume(value / 100);
            }
        });

        document.getElementById('music-enabled')?.addEventListener('change', (e) => {
            if (this.game.audio) {
                if (e.target.checked) {
                    this.game.audio.musicEnabled = true;
                    this.game.audio.startMusic();
                } else {
                    this.game.audio.stopMusic();
                    this.game.audio.musicEnabled = false;
                }
            }
        });

        // Sell all ore button (with confirmation for large amounts)
        document.getElementById('sell-all-ore-btn')?.addEventListener('click', () => {
            const player = this.game.player;
            if (!player?.cargo) return;
            let totalUnits = 0;
            for (const data of Object.values(player.cargo)) totalUnits += data.units || 0;
            if (totalUnits > 100) {
                this.showConfirmDialog('Sell All Ore', `Sell ${totalUnits.toLocaleString()} units of ore?`, () => this.sellAllOre());
            } else {
                this.sellAllOre();
            }
        });

        // Refine all ore button
        document.getElementById('refine-all-ore-btn')?.addEventListener('click', () => {
            this.refineAllOre();
        });

        // D-Scan range/angle sliders with value display
        document.getElementById('dscan-range')?.addEventListener('input', (e) => {
            this.dscanRange = parseInt(e.target.value);
            const valEl = document.getElementById('dscan-range-val');
            if (valEl) valEl.textContent = formatDistance(this.dscanRange);
        });

        document.getElementById('dscan-angle')?.addEventListener('input', (e) => {
            this.dscanAngle = parseInt(e.target.value);
            const valEl = document.getElementById('dscan-angle-val');
            if (valEl) valEl.textContent = `${this.dscanAngle}\u00B0`;
        });

        // D-Scan angle presets
        for (const preset of [360, 180, 60, 15]) {
            document.getElementById(`dscan-${preset}`)?.addEventListener('click', () => {
                this.dscanAngle = preset;
                const slider = document.getElementById('dscan-angle');
                if (slider) slider.value = preset;
                const valEl = document.getElementById('dscan-angle-val');
                if (valEl) valEl.textContent = `${preset}\u00B0`;
            });
        }

        // Drone command buttons
        document.querySelectorAll('.drone-cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                this.handleDroneCommand(cmd);
            });
        });

        // Autopilot cancel button
        document.getElementById('autopilot-cancel-btn')?.addEventListener('click', () => {
            this.game.autopilot?.stop();
            this.game.autopilot?.cancelWarp();
            this.game.audio?.play('click');
        });

        // Ship indicator right-click - show standard context menu for player ship
        document.getElementById('ship-indicator')?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.game.player) {
                this.showContextMenu(e.clientX, e.clientY, this.game.player);
            }
        });

        // Ship indicator left-click to select own ship
        document.getElementById('ship-indicator')?.addEventListener('click', () => {
            if (this.game.player) {
                this.game.selectTarget(this.game.player);
            }
        });

        // Target panel right-click - show standard context menu for selected target
        document.getElementById('target-panel')?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const target = this.game.selectedTarget;
            if (target) {
                this.showContextMenu(e.clientX, e.clientY, target);
            }
        });

        // Global tooltip delegation on status bar elements
        this.setupStatusBarTooltips();

        // Global tooltip delegation via data-tooltip attribute
        document.addEventListener('mouseenter', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) this.showGlobalTooltip(target);
        }, true);
        document.addEventListener('mouseleave', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) this.hideGlobalTooltip();
        }, true);

        // Confirmation dialog buttons
        this.elements.confirmYesBtn?.addEventListener('click', () => {
            const cb = this._confirmCallback;
            this.hideConfirmDialog();
            if (cb) cb();
        });
        this.elements.confirmNoBtn?.addEventListener('click', () => {
            const cb = this._confirmCancelCallback;
            this.hideConfirmDialog();
            if (cb) cb();
        });
        // Close confirm on overlay click (outside dialog box)
        this.elements.confirmDialog?.addEventListener('click', (e) => {
            if (e.target === this.elements.confirmDialog) {
                const cb = this._confirmCancelCallback;
                this.hideConfirmDialog();
                if (cb) cb();
            }
        });
    }

    /**
     * Handle drone command from action bar
     */
    handleDroneCommand(command) {
        const player = this.game.player;
        if (!player || !player.droneBay) return;

        // Update active button state
        document.querySelectorAll('.drone-cmd-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cmd === command);
        });

        // Send command to player's drones
        player.commandDrones(command, this.game.selectedTarget);
        this.game.audio?.play('click');
    }

    /**
     * Show context menu for ship indicator (drone controls)
     */
    showShipIndicatorContextMenu(x, y) {
        const player = this.game.player;
        if (!player || !player.droneBay) return;

        const deployed = player.droneBay.deployed?.size || 0;
        const inBay = player.droneBay.drones?.filter(d => d !== null).length || 0;

        // Build menu items based on drone state
        let menuHtml = '';
        if (inBay > 0 && deployed < (player.droneBay.capacity || 0)) {
            menuHtml += `<div class="menu-item" data-action="launch-drones">Launch Drones</div>`;
        }
        if (deployed > 0) {
            menuHtml += `<div class="menu-item" data-action="recall-drones">Recall Drones</div>`;
        }

        if (!menuHtml) {
            menuHtml = `<div class="menu-item disabled">No Drones Available</div>`;
        }

        // Show menu using shared context menu (delegation handles clicks)
        const menu = this.elements.contextMenu;
        this.contextMenuTarget = null;
        this.contextMenuWorldPos = null;
        menu.innerHTML = menuHtml;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');
    }

    /**
     * Initialize panel drag manager
     */
    initPanelDragManager() {
        this.panelDragManager.init();

        // Register all draggable panels
        this.panelDragManager.registerPanel('target-panel');
        this.panelDragManager.registerPanel('overview-panel');
        this.panelDragManager.registerPanel('event-log');
        this.panelDragManager.registerPanel('dscan-panel');
        this.panelDragManager.registerPanel('bookmarks-panel');
        this.panelDragManager.registerPanel('object-viewer');
        this.panelDragManager.registerPanel('locked-targets-container');
        this.panelDragManager.registerPanel('ship-indicator');
        this.panelDragManager.registerPanel('drone-bar');
        this.panelDragManager.registerPanel('fleet-panel');
        this.panelDragManager.registerPanel('minimap');
        this.panelDragManager.registerPanel('stats-panel');
        this.panelDragManager.registerPanel('achievements-panel');
        this.panelDragManager.registerPanel('ship-log-panel');
        this.panelDragManager.registerPanel('combat-log-panel');

        // Setup minimap range buttons
        document.querySelectorAll('.minimap-range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.minimap-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.minimapRange = parseInt(btn.dataset.range) || 5000;
            });
        });
        this.minimapRange = 5000;
        this.minimapExpanded = false;
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas?.getContext('2d');

        // Minimap scroll wheel zoom
        const minimapEl = document.getElementById('minimap');
        if (minimapEl) {
            minimapEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                const ranges = [1000, 2000, 3000, 5000, 8000, 10000, 15000, 25000];
                let idx = ranges.indexOf(this.minimapRange);
                if (idx === -1) idx = ranges.findIndex(r => r >= this.minimapRange) || 3;
                idx += e.deltaY > 0 ? 1 : -1;
                idx = Math.max(0, Math.min(ranges.length - 1, idx));
                this.minimapRange = ranges[idx];
                // Update range button highlight
                document.querySelectorAll('.minimap-range-btn').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.range) === this.minimapRange);
                });
            }, { passive: false });
        }

        // Minimap expand toggle
        const expandBtn = document.getElementById('minimap-expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.toggleMinimapExpand());
        }

        // Constrain all panels to viewport after loading saved positions
        requestAnimationFrame(() => this.panelDragManager.constrainAllPanels());
    }

    /**
     * Update all UI elements
     */
    update(dt) {
        // Throttle updates for performance
        this.hudTimer += dt;
        this.overviewTimer += dt;

        // Update performance monitor every frame
        this.performanceMonitor?.update();

        if (this.hudTimer >= CONFIG.UI_UPDATE_RATE / 1000) {
            this.hudTimer = 0;
            this.updateHUD();
            this.updateTargetPanel();
            this.updateModuleRack();
            this.updateObjectViewer();
            this.updateShipIndicator();
            this.updateDroneBar();
            this.updateAutopilotIndicator();
            this.updateMinimap();
            this.updateTacticalOverlay();
            this.updateGateLabels();
            this.checkProximityWarnings();
            this.updateOffscreenThreats();
            this.checkAsteroidFieldEntry();
        }

        if (this.overviewTimer >= CONFIG.OVERVIEW_UPDATE_RATE / 1000) {
            this.overviewTimer = 0;
            this.updateOverview();
        }

        // Credit change pulse detection
        const currentCredits = this.game.credits || 0;
        if (this._prevCredits > 0 && currentCredits !== this._prevCredits) {
            this.pulseCreditsDisplay(currentCredits > this._prevCredits);
        }
        this._prevCredits = currentCredits;

        // Update fleet panel
        this.fleetPanelManager?.update(dt);

        // Update quest tracker
        this.questTracker?.update(dt);

        // Update salvage progress bar (every frame for smooth display)
        this.updateSalvageProgressBar();
    }

    /**
     * Update HUD (status bars, speed, credits, cargo)
     */
    updateHUD() {
        const player = this.game.player;
        if (!player) return;

        const health = player.getHealthPercents();

        // Warning flash when taking damage
        this.checkWarningFlash('shield', health.shield);
        this.checkWarningFlash('armor', health.armor);
        this.checkWarningFlash('hull', health.hull);
        this.checkWarningFlash('capacitor', health.capacitor);

        // Update bars
        this.elements.shieldBar.style.width = `${health.shield}%`;
        this.elements.armorBar.style.width = `${health.armor}%`;
        this.elements.hullBar.style.width = `${health.hull}%`;
        this.elements.capacitorBar.style.width = `${health.capacitor}%`;

        // Update text
        this.elements.shieldText.textContent = `${Math.floor(health.shield)}%`;
        this.elements.armorText.textContent = `${Math.floor(health.armor)}%`;
        this.elements.hullText.textContent = `${Math.floor(health.hull)}%`;
        this.elements.capacitorText.textContent = `${Math.floor(health.capacitor)}%`;

        // HP value tooltips on hover
        const shieldContainer = this.elements.shieldBar?.parentElement;
        const armorContainer = this.elements.armorBar?.parentElement;
        const hullContainer2 = this.elements.hullBar?.parentElement;
        const capContainer2 = this.elements.capacitorBar?.parentElement;
        if (shieldContainer) shieldContainer.title = `Shield: ${Math.floor(player.shield)} / ${Math.floor(player.maxShield)}`;
        if (armorContainer) armorContainer.title = `Armor: ${Math.floor(player.armor)} / ${Math.floor(player.maxArmor)}`;
        if (hullContainer2) hullContainer2.title = `Hull: ${Math.floor(player.hull)} / ${Math.floor(player.maxHull)}`;
        if (capContainer2) capContainer2.title = `Capacitor: ${Math.floor(player.capacitor)} / ${Math.floor(player.maxCapacitor)}`;

        // Critical state warnings
        this.elements.hullContainer?.classList.toggle('critical', health.hull < 25);
        this.elements.capacitorContainer?.classList.toggle('critical', health.capacitor < 20);

        // Update capacitor ring SVG
        const capRingFill = document.getElementById('cap-ring-fill');
        if (capRingFill) {
            const circumference = 2 * Math.PI * 19; // r=19
            const offset = circumference * (1 - health.capacitor / 100);
            capRingFill.style.strokeDashoffset = offset;
            capRingFill.classList.toggle('low', health.capacitor < 30 && health.capacitor >= 10);
            capRingFill.classList.toggle('critical', health.capacitor < 10);
        }

        // Update speed
        this.elements.speedValue.textContent = Math.floor(player.currentSpeed);

        // Update heading compass
        this.updateHeading(player);

        // Update velocity compass
        this.updateVelocityCompass(player);

        // Update dock prompt
        this.updateDockPrompt(player);

        // Update credits
        this.elements.creditsValue.textContent = formatCredits(this.game.credits);

        // Update faction treasury
        const treasuryEl = document.getElementById('faction-treasury-value');
        if (treasuryEl) {
            treasuryEl.textContent = formatCredits(this.game.faction?.treasury || 0);
        }

        // Update stardate
        const stardateEl = document.getElementById('stardate-value');
        if (stardateEl) {
            stardateEl.textContent = this.game.getStardate();
        }

        // Update cargo display
        this.updateCargoDisplay(player);

        // Update locked targets display
        this.updateLockedTargetsDisplay();

        // Update autopilot route indicator
        this.updateRouteIndicator(player);

        // Status bar pulse on significant changes (>5%)
        for (const type of ['shield', 'armor', 'hull', 'capacitor']) {
            const diff = health[type] - this.prevHealth[type];
            if (Math.abs(diff) > 5) {
                this.pulseStatusBar(type, diff > 0);
            }
        }

        // Store previous health values
        this.prevHealth = { ...health };
    }

    /**
     * Update compass heading display
     */
    updateHeading(player) {
        // Calculate heading from velocity or facing angle
        let headingRad = 0;
        if (player.velocity && (Math.abs(player.velocity.x) > 0.5 || Math.abs(player.velocity.y) > 0.5)) {
            headingRad = Math.atan2(player.velocity.x, -player.velocity.y); // N=0, E=90
        } else if (player.rotation !== undefined) {
            headingRad = player.rotation;
        }

        // Convert to degrees (0-360, N=0, clockwise)
        let degrees = ((headingRad * 180 / Math.PI) + 360) % 360;
        const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const cardinal = cardinals[Math.round(degrees / 45) % 8];

        if (this.elements.headingDegrees) {
            this.elements.headingDegrees.textContent = String(Math.round(degrees)).padStart(3, '0');
        }
        if (this.elements.headingCardinal) {
            this.elements.headingCardinal.textContent = cardinal;
        }

        // Rotate compass needle
        if (this.elements.compassNeedle) {
            this.elements.compassNeedle.setAttribute('transform', `rotate(${degrees}, 22, 22)`);
        }

        // Target bearing indicator
        const target = this.game.selectedTarget;
        if (target && this.elements.compassTargetBearing) {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const bearingRad = Math.atan2(dx, -dy);
            const bearingDeg = ((bearingRad * 180 / Math.PI) + 360) % 360;
            this.elements.compassTargetBearing.setAttribute('transform', `rotate(${bearingDeg}, 22, 22)`);
            this.elements.compassTargetBearing.setAttribute('opacity', '0.7');
        } else if (this.elements.compassTargetBearing) {
            this.elements.compassTargetBearing.setAttribute('opacity', '0');
        }
    }

    /**
     * Update velocity compass - shows heading arrow and speed
     */
    updateVelocityCompass(player) {
        const canvas = document.getElementById('velocity-compass-canvas');
        const label = document.getElementById('velocity-speed-label');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const W = 50, H = 50;
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;
        const cx = W / 2, cy = H / 2;

        ctx.clearRect(0, 0, W, H);

        // Outer ring
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, Math.PI * 2);
        ctx.stroke();

        // Cardinal tick marks
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const inner = i % 2 === 0 ? 18 : 20;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
            ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
            ctx.stroke();
        }

        // Speed fraction for arrow length
        const speed = player.currentSpeed || 0;
        const maxSpeed = player.maxSpeed || 1;
        const frac = Math.min(speed / maxSpeed, 1);

        if (speed > 1) {
            // Heading angle (game uses math convention, we need screen convention)
            const vx = player.velocity?.x || 0;
            const vy = player.velocity?.y || 0;
            const angle = Math.atan2(-vy, vx) - Math.PI / 2; // Convert to screen coords (N=up)

            const arrowLen = 6 + frac * 14;

            // Speed color (cyan -> yellow -> red)
            let r, g, b;
            if (frac < 0.5) {
                r = Math.floor(frac * 2 * 255);
                g = 255;
                b = Math.floor((1 - frac * 2) * 255);
            } else {
                r = 255;
                g = Math.floor((1 - (frac - 0.5) * 2) * 255);
                b = 0;
            }

            // Arrow body
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            const tipX = cx + Math.cos(angle) * arrowLen;
            const tipY = cy + Math.sin(angle) * arrowLen;
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // Arrowhead
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
            ctx.beginPath();
            const headLen = 5;
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX + Math.cos(angle + 2.5) * headLen, tipY + Math.sin(angle + 2.5) * headLen);
            ctx.lineTo(tipX + Math.cos(angle - 2.5) * headLen, tipY + Math.sin(angle - 2.5) * headLen);
            ctx.closePath();
            ctx.fill();

            // Glow at tip
            ctx.beginPath();
            ctx.arc(tipX, tipY, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
            ctx.fill();
        } else {
            // Stationary dot
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(cx, cy, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Speed label
        if (label) {
            label.textContent = `${Math.floor(speed)} m/s`;
        }
    }

    /**
     * Check and trigger warning flash on damage
     */
    checkWarningFlash(type, currentValue) {
        const prevValue = this.prevHealth[type];
        if (currentValue < prevValue - 1) {
            const bar = this.elements[`${type}Bar`];
            if (bar) {
                bar.classList.remove('warning-flash');
                void bar.offsetWidth; // Force reflow
                bar.classList.add('warning-flash');
            }
        }

        // Reset breach flags when shield recovers
        if (type === 'shield' && currentValue > 50) {
            this.breachFlags.shieldDown = false;
            this.breachFlags.armorBreach = false;
            this.breachFlags.hullCritical = false;
        }

        // Audio warning cues for critical states
        // Shield warning when dropping below 25%
        if (type === 'shield' && currentValue < 25 && prevValue >= 25) {
            this.game.audio?.play('shield-low');
        }

        // SHIELDS DOWN - shield hits 0%
        if (type === 'shield' && currentValue <= 0 && prevValue > 0 && !this.breachFlags.shieldDown) {
            this.breachFlags.shieldDown = true;
            this.showBreachWarning('SHIELDS DOWN', '#4488ff', 'shield');
        }

        // Armor warning when dropping below 25%
        if (type === 'armor' && currentValue < 25 && prevValue >= 25) {
            this.game.audio?.play('warning');
        }

        // ARMOR BREACH - armor hits 0%
        if (type === 'armor' && currentValue <= 0 && prevValue > 0 && !this.breachFlags.armorBreach) {
            this.breachFlags.armorBreach = true;
            this.showBreachWarning('ARMOR BREACH', '#ff8844', 'armor');
        }

        // Hull critical warning when dropping below 25%
        if (type === 'hull' && currentValue < 25 && prevValue >= 25) {
            this.game.audio?.play('hull-critical');
        }

        // HULL CRITICAL - hull below 25%
        if (type === 'hull' && currentValue < 25 && prevValue >= 25 && !this.breachFlags.hullCritical) {
            this.breachFlags.hullCritical = true;
            this.showBreachWarning('HULL CRITICAL', '#ff2222', 'hull');
        }

        // Capacitor low warning when dropping below 20%
        if (type === 'capacitor' && currentValue < 20 && prevValue >= 20) {
            this.game.audio?.play('capacitor-low');
            this.showToast('CAPACITOR LOW - modules may deactivate', 'warning');
            this.showScreenFlash?.('nos');
        }

        // Capacitor empty warning when dropping below 5%
        if (type === 'capacitor' && currentValue < 5 && prevValue >= 5) {
            this.game.audio?.play('hull-critical');
            this.showToast('CAPACITOR EMPTY', 'error');
        }

        // Capacitor recharge milestones (going up)
        if (type === 'capacitor') {
            const milestones = [25, 50, 75, 100];
            for (const m of milestones) {
                if (currentValue >= m && prevValue < m) {
                    this.game.audio?.play('scan-complete');
                    break;
                }
            }
        }
    }

    /**
     * Update autopilot route indicator
     */
    updateRouteIndicator(player) {
        const indicator = document.getElementById('route-indicator');
        if (!indicator) return;

        const routeInfo = this.game.autopilot?.getRouteInfo();
        if (!routeInfo || routeInfo.remainingJumps <= 0) {
            indicator.classList.add('hidden');
            return;
        }

        indicator.classList.remove('hidden');

        // Update destination name
        const destEl = document.getElementById('route-dest-name');
        const jumpEl = document.getElementById('route-jump-count');
        const sectors = UNIVERSE_LAYOUT?.sectors || [];
        const destSector = sectors.find(s => s.id === routeInfo.destination);
        if (destEl) destEl.textContent = destSector?.name || routeInfo.destination;
        if (jumpEl) jumpEl.textContent = `${routeInfo.remainingJumps} jump${routeInfo.remainingJumps > 1 ? 's' : ''} remaining`;

        // Point arrow toward next gate
        const nextSectorId = routeInfo.path[routeInfo.currentIndex + 1];
        const sector = this.game.currentSector;
        if (sector && player) {
            const gate = sector.entities.find(e => e.type === 'gate' && e.destinationSectorId === nextSectorId);
            if (gate) {
                const dx = gate.x - player.x;
                const dy = gate.y - player.y;
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const arrow = indicator.querySelector('.route-arrow');
                if (arrow) arrow.style.transform = `rotate(${angle}deg)`;
            }
        }
    }

    /**
     * Update cargo display
     */
    updateCargoDisplay(player) {
        if (!this.elements.cargoBar || !this.elements.cargoText) return;

        const cargoUsed = player.cargoUsed || 0;
        const cargoCapacity = player.cargoCapacity || 200;
        const percent = (cargoUsed / cargoCapacity) * 100;

        this.elements.cargoBar.style.width = `${percent}%`;
        this.elements.cargoText.textContent = `${Math.floor(cargoUsed)} / ${cargoCapacity} m³`;

        // Visual warnings for cargo state
        this.elements.cargoBar.classList.remove('warning', 'full');
        if (percent >= 100) {
            this.elements.cargoBar.classList.add('full');
            if (!this._cargoFullWarned) {
                this.toast('Cargo hold full!', 'warning');
                this.game.audio?.play('warning');
                this._cargoFullWarned = true;
            }
        } else if (percent >= 80) {
            this.elements.cargoBar.classList.add('warning');
            this._cargoFullWarned = false;
        } else {
            this._cargoFullWarned = false;
        }

        // Update HUD cargo bar below module rack
        const hudBar = document.getElementById('cargo-hud-bar');
        const hudFill = document.getElementById('cargo-hud-fill');
        const hudText = document.getElementById('cargo-hud-text');
        if (hudFill) {
            hudFill.style.width = `${Math.min(100, percent)}%`;
        }
        if (hudBar) {
            hudBar.classList.toggle('cargo-warning', percent >= 80 && percent < 100);
            hudBar.classList.toggle('cargo-full', percent >= 100);
        }
        if (hudText) {
            hudText.textContent = `${Math.floor(cargoUsed)}/${cargoCapacity} m³`;
        }
    }

    /**
     * Update locked targets display (Eve-style circular icons)
     */
    updateLockedTargetsDisplay() {
        const container = this.elements.lockedTargetsContainer;
        if (!container) return;

        const contentArea = container.querySelector('.locked-targets-content');
        if (!contentArea) return;

        const locked = this.game.lockedTarget;
        const selected = this.game.selectedTarget;
        const player = this.game.player;

        // For now, we only support one locked target
        // Could be expanded to support multiple
        if (!locked || !locked.alive) {
            contentArea.innerHTML = '';
            return;
        }

        const dist = player ? formatDistance(player.distanceTo(locked)) : '-';
        const icon = this.getEntityIcon(locked);
        const isSelected = locked === selected;

        // Check if target is an asteroid - show ore instead of health
        if (locked.type === 'asteroid') {
            const oreInfo = locked.getOreInfo?.() || { current: 0, max: 1 };
            const orePercent = Math.round((oreInfo.current / oreInfo.max) * 100);

            contentArea.innerHTML = `
                <div class="locked-target-icon asteroid ${isSelected ? 'selected' : ''}" data-entity-id="${locked.id}">
                    <div class="locked-target-distance">${dist}</div>
                    <div class="locked-target-ring asteroid-outline"></div>
                    <div class="locked-target-ore-amount">${oreInfo.current}</div>
                    <div class="locked-target-name">${locked.name}</div>
                </div>
            `;
        } else {
            const health = locked.getHealthPercents?.() || { shield: 100, armor: 100, hull: 100 };

            contentArea.innerHTML = `
                <div class="locked-target-icon ${isSelected ? 'selected' : ''}" data-entity-id="${locked.id}">
                    <div class="locked-target-distance">${dist}</div>
                    <div class="locked-target-ring shield" style="clip-path: inset(0 ${100 - health.shield}% 0 0 round 50%);"></div>
                    <div class="locked-target-ring armor" style="clip-path: inset(0 ${100 - health.armor}% 0 0 round 50%);"></div>
                    <div class="locked-target-ring hull" style="clip-path: inset(0 ${100 - health.hull}% 0 0 round 50%);"></div>
                    <div class="locked-target-center">${icon}</div>
                    <div class="locked-target-name">${locked.name}</div>
                </div>
            `;
        }

        // Add click handler
        contentArea.querySelector('.locked-target-icon')?.addEventListener('click', () => {
            this.game.selectTarget(locked);
        });
    }

    /**
     * Update target panel
     */
    updateTargetPanel() {
        const target = this.game.selectedTarget;

        if (!target) {
            this.elements.targetPanel.classList.add('hidden');
            return;
        }

        this.elements.targetPanel.classList.remove('hidden');
        this.panelDragManager?.constrainPanel('target-panel');
        this.elements.targetName.textContent = target.name;

        // Type line - show role, faction, ship class
        let typeStr = (target.type === 'npc' ? target.role : target.type).toUpperCase();
        if (target.shipClass && target.type !== 'asteroid') {
            typeStr += ` \u2022 ${target.shipClass.toUpperCase()}`;
        }
        if (target.factionId) {
            const fShort = target.factionId === 'shadow-cartel' ? 'SC' :
                target.factionId === 'ore-extraction-syndicate' ? 'OES' :
                target.factionId === 'stellar-logistics' ? 'SLC' :
                target.factionId === 'void-hunters' ? 'VH' :
                target.factionId === 'frontier-alliance' ? 'FDA' : '';
            if (fShort) typeStr += ` [${fShort}]`;
        }
        this.elements.targetType.textContent = typeStr;

        // Distance + warp indicator
        const player = this.game.player;
        const dist = player?.distanceTo(target) || 0;
        let distText = formatDistance(dist);
        if (dist >= 1000 && player) {
            const capPct = Math.round((player.capacitor / player.maxCapacitor) * 100);
            const canWarp = capPct >= 25 && !player.warpDisrupted;
            distText += canWarp ? '  \u25B6 WARP' : '';
        }
        this.elements.targetDistance.textContent = distText;

        // Health bars (if applicable)
        if (target.shield !== undefined) {
            const health = target.getHealthPercents?.() || { shield: 100, armor: 100, hull: 100 };
            this.elements.targetShieldBar.style.width = `${health.shield}%`;
            this.elements.targetArmorBar.style.width = `${health.armor}%`;
            this.elements.targetHullBar.style.width = `${health.hull}%`;
            document.getElementById('target-health-bars').style.display = 'flex';
        } else {
            document.getElementById('target-health-bars').style.display = 'none';
        }

        // Target combat info (DPS, speed, angular)
        this.updateTargetCombatInfo(target, player, dist);

        // Scanner readout (ships and loot containers)
        const scannerEl = document.getElementById('target-scanner');
        if (!scannerEl) return;

        // Loot containers get minimal scanner
        if (target.type === 'loot') {
            scannerEl.style.display = 'block';
            document.getElementById('scan-speed').textContent = '--';
            document.getElementById('scan-heading').textContent = '--';
            document.getElementById('scan-transversal').textContent = '--';
            document.getElementById('scan-angular').textContent = '--';
            document.getElementById('scan-signature').textContent = '--';
            const cEl = document.getElementById('scan-cargo');
            if (cEl) {
                cEl.textContent = target.getContentsSummary?.() || '--';
                cEl.style.color = '#ffcc44';
            }
            document.getElementById('scan-ewar').innerHTML = '';
            document.getElementById('scan-modules').innerHTML = '';
            return;
        }

        // Wreck scanner info
        if (target.type === 'wreck') {
            scannerEl.style.display = 'block';
            document.getElementById('scan-speed').textContent = target.salvaged ? 'SALVAGED' : target.salvaging ? `${Math.round(target.getSalvagePercent() * 100)}%` : 'INTACT';
            document.getElementById('scan-heading').textContent = target.sourceShipClass || '--';
            document.getElementById('scan-transversal').textContent = '--';
            document.getElementById('scan-angular').textContent = `${Math.round(target.lifetime - target.age)}s left`;
            document.getElementById('scan-signature').textContent = '--';
            const cEl = document.getElementById('scan-cargo');
            if (cEl) {
                cEl.textContent = target.getContentsSummary?.() || '--';
                cEl.style.color = '#887766';
            }
            document.getElementById('scan-ewar').innerHTML = target.salvaging
                ? '<span class="ewar-badge" style="background:rgba(136,119,102,0.3);border-color:rgba(136,119,102,0.6);color:#bbaa99;">SALVAGING</span>'
                : '';
            document.getElementById('scan-modules').innerHTML = '';
            return;
        }

        // Anomaly scanner info
        if (target.type === 'anomaly') {
            scannerEl.style.display = 'block';
            const scanPct = Math.round(target.scanStrength * 100);
            document.getElementById('scan-speed').textContent = target.scanned ? 'RESOLVED' : `${scanPct}% scanned`;
            document.getElementById('scan-heading').textContent = target.anomalyType.replace(/([A-Z])/g, ' $1').trim();
            document.getElementById('scan-transversal').textContent = '--';
            document.getElementById('scan-angular').textContent = `${Math.round(target.lifetime - target.age)}s left`;
            document.getElementById('scan-signature').textContent = `${Math.round(target.scanDifficulty * 100)}%`;
            const cEl = document.getElementById('scan-cargo');
            if (cEl) {
                cEl.textContent = target.scanned ? target.getDescription().split('\n').pop() : '???';
                cEl.style.color = target.scanned ? '#aa88ff' : '#666';
            }
            document.getElementById('scan-ewar').innerHTML = target.scanned
                ? `<span class="ewar-badge" style="background:rgba(136,68,255,0.3);border-color:rgba(136,68,255,0.6);color:#cc99ff;">SCANNED</span>`
                : `<span class="ewar-badge" style="background:rgba(100,100,100,0.3);border-color:rgba(100,100,100,0.6);color:#999;">UNRESOLVED</span>`;
            document.getElementById('scan-modules').innerHTML = '';
            return;
        }

        // Asteroid info overlay
        if (target.type === 'asteroid') {
            scannerEl.style.display = 'block';
            const oreConfig = CONFIG.ASTEROID_TYPES[target.asteroidType] || {};
            const orePct = target.maxOre > 0 ? Math.round((target.ore / target.maxOre) * 100) : 0;
            const estValue = Math.round(target.ore * (oreConfig.value || 10));
            document.getElementById('scan-speed').textContent = `${oreConfig.name || target.asteroidType}`;
            document.getElementById('scan-heading').textContent = `${orePct}% remaining`;
            document.getElementById('scan-transversal').textContent = `${target.ore}/${target.maxOre} units`;
            document.getElementById('scan-angular').textContent = `~${formatCredits(estValue)} ISK`;
            document.getElementById('scan-signature').textContent = `${Math.round(target.radius)}m`;
            const cEl = document.getElementById('scan-cargo');
            if (cEl) {
                cEl.textContent = `${(oreConfig.volumePerUnit || 0.1)} m\u00B3/unit`;
                cEl.style.color = '';
            }
            // Show depletion badge
            const ewarEl = document.getElementById('scan-ewar');
            if (ewarEl) {
                if (target.ore <= 0) {
                    ewarEl.innerHTML = '<span class="ewar-badge" style="background:rgba(100,80,60,0.3);border-color:rgba(100,80,60,0.6);color:#aa8866;">DEPLETED</span>';
                } else if (orePct < 25) {
                    ewarEl.innerHTML = '<span class="ewar-badge" style="background:rgba(255,170,0,0.2);border-color:rgba(255,170,0,0.4);color:#ffaa44;">LOW ORE</span>';
                } else {
                    ewarEl.innerHTML = '';
                }
            }
            document.getElementById('scan-modules').innerHTML = '';
            return;
        }

        if (!target.currentSpeed && target.currentSpeed !== 0) {
            scannerEl.style.display = 'none';
            return;
        }
        scannerEl.style.display = 'block';

        // Speed
        const speedEl = document.getElementById('scan-speed');
        if (speedEl) speedEl.textContent = `${Math.round(target.currentSpeed)} m/s`;

        // Heading (degrees)
        const headingEl = document.getElementById('scan-heading');
        if (headingEl) {
            const deg = ((target.rotation * 180 / Math.PI) % 360 + 360) % 360;
            headingEl.textContent = `${Math.round(deg)}\u00B0`;
        }

        // Transversal velocity (component perpendicular to line-of-sight)
        const transEl = document.getElementById('scan-transversal');
        const angEl = document.getElementById('scan-angular');
        if (transEl && player && dist > 0) {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const losAngle = Math.atan2(dy, dx);
            const vx = (target.velocity?.x || 0) - (player.velocity?.x || 0);
            const vy = (target.velocity?.y || 0) - (player.velocity?.y || 0);
            const transversal = Math.abs(vx * Math.sin(losAngle) - vy * Math.cos(losAngle));
            transEl.textContent = `${Math.round(transversal)} m/s`;
            // Angular velocity
            if (angEl) {
                const angVel = dist > 10 ? (transversal / dist) : 0;
                angEl.textContent = `${angVel.toFixed(3)} r/s`;
            }
        }

        // Signature radius
        const sigEl = document.getElementById('scan-signature');
        if (sigEl && target.signatureRadius !== undefined) {
            sigEl.textContent = `${Math.round(target.signatureRadius)}m`;
        }

        // Cargo
        const cargoEl = document.getElementById('scan-cargo');
        if (cargoEl) {
            if (target.cargoCapacity !== undefined) {
                cargoEl.textContent = `${target.cargoUsed || 0}/${target.cargoCapacity} m\u00B3`;
            } else {
                cargoEl.textContent = '--';
            }
        }

        // Loot container contents display
        if (target.type === 'loot' && target.getContentsSummary) {
            const contents = target.getContentsSummary();
            cargoEl.textContent = contents;
            cargoEl.style.color = '#ffcc44';
        } else if (cargoEl) {
            cargoEl.style.color = '';
        }

        // EWAR status badges
        const ewarEl = document.getElementById('scan-ewar');
        if (ewarEl) {
            let badges = '';
            if (target.isPointed) badges += '<span class="ewar-badge pointed">POINTED</span>';
            if (target.isWebbed) badges += `<span class="ewar-badge webbed">WEBBED ${Math.round((1 - target.webSpeedFactor) * 100)}%</span>`;
            if (target.isNosed) badges += '<span class="ewar-badge drained">DRAINED</span>';
            if (target.sectorWarpState === 'spooling') badges += '<span class="ewar-badge warping">WARPING</span>';
            ewarEl.innerHTML = badges;
        }

        // Fitted modules
        const modsEl = document.getElementById('scan-modules');
        if (modsEl && target.modules) {
            let modHtml = '';
            for (const rack of ['high', 'mid', 'low']) {
                const slots = target.modules[rack];
                if (!slots) continue;
                for (let i = 0; i < slots.length; i++) {
                    const moduleId = slots[i];
                    if (!moduleId) continue;
                    const slotId = `${rack}-${i + 1}`;
                    const isActive = target.activeModules?.has(slotId);
                    const config = EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId];
                    const name = config?.name || moduleId;
                    modHtml += `<div class="scanner-module-row">
                        <span class="scanner-module-dot ${isActive ? 'active' : 'inactive'}"></span>
                        ${name}
                    </div>`;
                }
            }
            modsEl.innerHTML = modHtml;
        }

        // DPS readout
        const dps = this.game.dpsTracker;
        const inDpsEl = document.getElementById('scan-dps-incoming');
        const outDpsEl = document.getElementById('scan-dps-outgoing');
        if (inDpsEl) inDpsEl.textContent = `${dps.incomingDPS} DPS`;
        if (outDpsEl) outDpsEl.textContent = `${dps.outgoingDPS} DPS`;

        // Threat list
        const threatList = document.getElementById('threat-list');
        const threatBody = document.getElementById('threat-list-body');
        if (threatList && threatBody) {
            if (dps.threats.size > 0) {
                threatList.classList.remove('hidden');
                const now = performance.now();
                let html = '';
                // Sort threats by recent damage
                const sorted = [...dps.threats.entries()]
                    .filter(([e]) => e.alive)
                    .sort((a, b) => b[1].totalDamage - a[1].totalDamage);
                for (const [entity, data] of sorted.slice(0, 5)) {
                    // Calculate per-entity DPS from recent hits
                    const recentHits = dps.incomingLog.filter(e => e.source === entity);
                    const eDps = recentHits.reduce((s, e) => s + e.damage, 0) / (dps.window / 1000);
                    const name = entity.name || entity.type;
                    html += `<div class="threat-row" data-entity-id="${entity.id || ''}">
                        <span class="threat-name">${name}</span>
                        <span class="threat-dps">${Math.round(eDps)} DPS</span>
                    </div>`;
                }
                threatBody.innerHTML = html;

                // Click to select threat
                threatBody.querySelectorAll('.threat-row').forEach(row => {
                    row.addEventListener('click', () => {
                        const entityId = row.dataset.entityId;
                        const entities = this.game.currentSector?.entities || [];
                        const found = entities.find(e => String(e.id) === entityId);
                        if (found) {
                            this.game.selectedTarget = found;
                            this.game.audio?.play('click');
                        }
                    });
                });
            } else {
                threatList.classList.add('hidden');
            }
        }
    }

    /**
     * Initialize the 3D ship viewer for the ship indicator panel
     */
    initPowerRouting() {
        document.querySelectorAll('.power-channel').forEach(ch => {
            ch.addEventListener('click', () => {
                const channel = ch.dataset.channel;
                const pr = this.game.powerRouting;
                if (!pr) return;

                // Increase clicked channel by 10, decrease others proportionally
                const step = 10;
                const others = Object.keys(pr).filter(k => k !== channel);
                const available = others.reduce((s, k) => s + Math.min(pr[k], step / 2), 0);
                if (available < step) return;

                pr[channel] = Math.min(100, pr[channel] + step);
                // Take from others evenly
                let remaining = step;
                for (const other of others) {
                    const take = Math.min(pr[other], Math.ceil(remaining / 2));
                    pr[other] -= take;
                    remaining -= take;
                }
                // Ensure sums to 100
                const total = pr.weapons + pr.shields + pr.engines;
                if (total !== 100) pr[others[0]] += 100 - total;

                this.updatePowerRoutingUI();
                this.game.audio?.play('click');
            });
        });
        this.updatePowerRoutingUI();
    }

    updatePowerRoutingUI() {
        const pr = this.game.powerRouting;
        if (!pr) return;
        for (const channel of ['weapons', 'shields', 'engines']) {
            const fill = document.getElementById(`power-${channel}-fill`);
            const val = document.getElementById(`power-${channel}-val`);
            if (fill) fill.style.height = `${pr[channel]}%`;
            if (val) val.textContent = pr[channel];
        }
    }

    initShipIndicatorViewer() {
        const canvas = this.elements.shipIndicatorCanvas;
        if (!canvas || this.shipViewerInitialized) return;

        const width = 140;
        const height = 120;
        canvas.width = width;
        canvas.height = height;

        this.shipViewerScene = new THREE.Scene();
        this.shipViewerScene.background = new THREE.Color(0x000a14);

        this.shipViewerCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
        this.shipViewerCamera.position.set(0, 15, 70);
        this.shipViewerCamera.lookAt(0, 0, 0);
        this.shipViewerAngle = 0;

        this.shipViewerRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.shipViewerRenderer.setSize(width, height);
        this.shipViewerRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // PBR settings for GLB models
        this.shipViewerRenderer.outputEncoding = THREE.sRGBEncoding;
        this.shipViewerRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.shipViewerRenderer.toneMappingExposure = 2.5;

        // Lighting - bright enough for PBR GLB models
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        this.shipViewerScene.add(ambient);
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
        keyLight.position.set(3, 5, 5);
        this.shipViewerScene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0x88bbff, 0.8);
        fillLight.position.set(-4, 2, -3);
        this.shipViewerScene.add(fillLight);
        const rimLight = new THREE.DirectionalLight(0x00aaff, 0.5);
        rimLight.position.set(0, -3, -4);
        this.shipViewerScene.add(rimLight);

        this.shipViewerInitialized = true;
        this.updateShipViewerMesh();
    }

    /**
     * Update the ship mesh in the indicator 3D viewer
     */
    updateShipViewerMesh() {
        if (!this.shipViewerScene) return;

        const player = this.game.player;
        if (!player) return;

        const shipConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        if (!shipConfig) return;

        // Update name/class text immediately
        if (this.elements.shipIndicatorName) {
            this.elements.shipIndicatorName.textContent = shipConfig.name || 'Your Ship';
        }
        if (this.elements.shipIndicatorClass) {
            const role = shipConfig.role ? shipConfig.role.toUpperCase() : '';
            const size = shipConfig.size ? shipConfig.size.toUpperCase() : '';
            this.elements.shipIndicatorClass.textContent = role && size ? `${role} - ${size}` : '';
        }

        // Load mesh async (GLB if available, procedural fallback)
        shipMeshFactory.generateShipMeshAsync({
            shipId: player.shipClass,
            role: shipConfig.role || 'mercenary',
            size: shipConfig.size || 'small',
            detailLevel: 'high',
        }).then(mesh => {
            if (!mesh) return;
            // Remove old mesh
            this.removeShipViewerMesh();
            // Stand the ship upright: rotate so top-down model faces camera nicely
            // Game model lies flat in XY plane; rotate to stand up along Y
            mesh.rotation.x = -Math.PI / 2;
            this.shipViewerMesh = mesh;
            this.shipViewerScene.add(this.shipViewerMesh);
        });
    }

    /**
     * Remove current ship viewer mesh and dispose resources
     */
    removeShipViewerMesh() {
        if (this.shipViewerMesh && this.shipViewerScene) {
            this.shipViewerScene.remove(this.shipViewerMesh);
            this.shipViewerMesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.shipViewerMesh = null;
        }
    }

    /**
     * Fallback ship mesh if ShipMeshFactory fails
     */
    createFallbackShipMesh() {
        const group = new THREE.Group();
        const size = 25;
        const shape = new THREE.Shape();
        shape.moveTo(size * 1.2, 0);
        shape.lineTo(-size * 0.6, size * 0.6);
        shape.lineTo(-size * 0.3, 0);
        shape.lineTo(-size * 0.6, -size * 0.6);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 8, bevelEnabled: true, bevelThickness: 2, bevelSize: 1, bevelSegments: 2 });
        const mat = new THREE.MeshPhongMaterial({ color: 0x00aaff, transparent: true, opacity: 0.9, shininess: 50, specular: 0x00ffff });
        const hull = new THREE.Mesh(geo, mat);
        hull.position.z = -4;
        group.add(hull);
        this.shipViewerMesh = group;
        this.shipViewerScene.add(this.shipViewerMesh);
    }

    /**
     * Update ship status indicator
     */
    updateShipIndicator() {
        const player = this.game.player;
        if (!player) return;

        const health = player.getHealthPercents();

        // Update health bars
        if (this.elements.shipShieldBar) this.elements.shipShieldBar.style.width = `${health.shield}%`;
        if (this.elements.shipArmorBar) this.elements.shipArmorBar.style.width = `${health.armor}%`;
        if (this.elements.shipHullBar) this.elements.shipHullBar.style.width = `${health.hull}%`;

        // Update percentage labels
        const sp = document.getElementById('ship-shield-pct');
        const ap = document.getElementById('ship-armor-pct');
        const hp = document.getElementById('ship-hull-pct');
        if (sp) sp.textContent = `${Math.round(health.shield)}%`;
        if (ap) ap.textContent = `${Math.round(health.armor)}%`;
        if (hp) hp.textContent = `${Math.round(health.hull)}%`;

        // Capacitor bar in ship indicator
        if (this.elements.shipCapBar) {
            this.elements.shipCapBar.style.width = `${health.capacitor}%`;
            this.elements.shipCapBar.classList.toggle('cap-low', health.capacitor < 25);
        }
        if (this.elements.shipCapPct) {
            this.elements.shipCapPct.textContent = `${Math.round(health.capacitor)}%`;
        }

        // Hull warning escalation system
        const shipIndicator = document.getElementById('ship-indicator');
        if (shipIndicator) {
            shipIndicator.classList.toggle('shield-down', health.shield <= 0);

            // Escalating hull warnings
            const hullEmergency = health.hull > 0 && health.hull <= 10;
            const hullCritical = health.hull > 0 && health.hull <= 25;
            const hullWarning = health.hull > 0 && health.hull <= 50;

            shipIndicator.classList.toggle('hull-critical', hullCritical);
            shipIndicator.classList.toggle('hull-warning', hullWarning && !hullCritical);

            // HULL CRITICAL text overlay
            if (this.elements.hullWarningText) {
                this.elements.hullWarningText.classList.toggle('hidden', !hullCritical);
            }

            // Emergency vignette at 10%
            if (this.elements.hullVignette) {
                this.elements.hullVignette.classList.toggle('active', hullEmergency);
            }

            // Structural alarm audio
            const alarmCadence = hullEmergency ? 1500 : 3000;
            if (hullCritical && !this.game.dockedAt) {
                if (!this._hullAlarmActive || this._hullAlarmEmergency !== hullEmergency) {
                    // Start or restart alarm with appropriate cadence
                    if (this._hullAlarmInterval) clearInterval(this._hullAlarmInterval);
                    this._hullAlarmActive = true;
                    this._hullAlarmEmergency = hullEmergency;
                    this.game.audio?.play('structural-alarm');
                    this._hullAlarmInterval = setInterval(() => {
                        if (this._hullAlarmActive && !this.game.dockedAt) {
                            this.game.audio?.play('structural-alarm');
                        }
                    }, alarmCadence);
                }
            } else if (this._hullAlarmActive) {
                this._hullAlarmActive = false;
                this._hullAlarmEmergency = false;
                if (this._hullAlarmInterval) {
                    clearInterval(this._hullAlarmInterval);
                    this._hullAlarmInterval = null;
                }
            }
        }

        // Update cargo bar
        const cargoBar = document.getElementById('ship-cargo-bar');
        const cargoLabel = document.getElementById('ship-cargo-label');
        if (cargoBar) {
            const used = player.cargoUsed || 0;
            const cap = player.cargoCapacity || 1;
            const pct = Math.min((used / cap) * 100, 100);
            cargoBar.style.width = `${pct}%`;
            cargoBar.classList.toggle('warning', pct >= 70 && pct < 95);
            cargoBar.classList.toggle('full', pct >= 95);
            if (cargoLabel) cargoLabel.textContent = `${Math.round(used)}/${cap}`;
        }

        // Update EWAR status indicators
        this.updateEwarStatus(player);

        // Animate 3D viewer - orbit camera around ship standing upright
        if (this.shipViewerMesh && this.shipViewerRenderer && this.shipViewerScene) {
            this.shipViewerAngle += 0.006;
            const r = 70;
            this.shipViewerCamera.position.set(
                r * Math.cos(this.shipViewerAngle),
                15,
                r * Math.sin(this.shipViewerAngle)
            );
            this.shipViewerCamera.lookAt(0, 0, 0);
            this.shipViewerRenderer.render(this.shipViewerScene, this.shipViewerCamera);
        }
    }

    /**
     * Update EWAR status indicators on the HUD
     */
    updateEwarStatus(player) {
        const container = document.getElementById('ewar-status');
        if (!container) return;

        const effects = [];

        if (player.isPointed) {
            effects.push('<span class="ewar-badge ewar-pointed" title="Warp Disrupted">DISRUPTED</span>');
            // Alert on transition to pointed
            if (!this._wasPointed) {
                this.game.audio?.play('warning');
                this.game.camera?.shake(8, 0.3);
                this.showToast('WARP DISRUPTED!', 'danger');
                // Red screen flash
                this.showScreenFlash('scramble');
                // Warp disrupt effect around player
                if (this.game.player) {
                    this.game.renderer?.effects?.spawn('tackle-warning', this.game.player.x, this.game.player.y);
                }
            }
        }
        this._wasPointed = player.isPointed;
        if (player.isWebbed) {
            const webPct = Math.round((1 - player.webSpeedFactor) * 100);
            effects.push(`<span class="ewar-badge ewar-webbed" title="Stasis Webified (-${webPct}% speed)">WEBBED -${webPct}%</span>`);
            if (!this._wasWebbed) {
                this.showScreenFlash('web');
                this.showToast(`Stasis webified! -${webPct}% speed`, 'danger');
            }
        }
        this._wasWebbed = player.isWebbed;
        if (player.isNosed) {
            effects.push('<span class="ewar-badge ewar-drained" title="Capacitor being drained">CAP DRAIN</span>');
            if (!this._wasNosed) {
                this.showToast('Energy vampire detected!', 'danger');
            }
        }
        this._wasNosed = player.isNosed;
        if (player.sectorWarpState === 'spooling') {
            const pct = Math.round((1 - player.sectorWarpTimer / player.sectorWarpSpoolTime) * 100);
            effects.push(`<span class="ewar-badge ewar-warp-spool" title="Sector warp spooling">WARP ${pct}%</span>`);
        }
        if (player.sectorWarpCooldown > 0 && player.sectorWarpState === 'none') {
            effects.push(`<span class="ewar-badge ewar-warp-cd" title="Sector warp cooldown">${Math.ceil(player.sectorWarpCooldown)}s</span>`);
        }

        // Check for active EWAR modules player is using
        for (const slotId of player.activeModules) {
            const [slotType, idx] = player.parseSlotId(slotId);
            const moduleId = player.modules[slotType]?.[idx];
            if (!moduleId) continue;
            const config = EQUIPMENT_DATABASE[moduleId];
            if (config?.warpDisrupt) {
                effects.push('<span class="ewar-badge ewar-pointing" title="Warp Disrupting target">POINTING</span>');
            }
            if (config?.speedReduction) {
                effects.push('<span class="ewar-badge ewar-webbing" title="Webifying target">WEBBING</span>');
            }
            if (config?.capacitorDrain) {
                effects.push('<span class="ewar-badge ewar-draining" title="Draining target capacitor">DRAINING</span>');
            }
        }

        // Tractor beam indicator
        if (this.game.tractorTargets?.size > 0) {
            const count = this.game.tractorTargets.size;
            effects.push(`<span class="ewar-badge ewar-tractor" title="Tractor beam active">LOOTING${count > 1 ? ' x' + count : ''}</span>`);
        }

        container.innerHTML = effects.join('');
        container.style.display = effects.length > 0 ? 'flex' : 'none';
    }

    /**
     * Update drone quick action bar
     */
    updateDockPrompt(player) {
        const prompt = document.getElementById('dock-prompt');
        if (!prompt) return;

        if (!player?.alive || this.game.dockedAt) {
            prompt.classList.add('hidden');
            return;
        }

        const entities = this.game.currentSector?.entities || [];
        let nearStation = null;
        let nearGate = null;

        for (const entity of entities) {
            if (!entity.alive) continue;
            const dist = player.distanceTo(entity);
            if ((entity.type === 'station' || entity.type === 'player-station') && dist < 300) {
                nearStation = entity;
            }
            if (entity.type === 'gate' && entity.destinationSectorId && dist < 100) {
                nearGate = entity;
            }
        }

        // Auto-jump when touching a gate (within 100m)
        if (nearGate && !this._gateJumpCooldown) {
            this._gateJumpCooldown = true;
            nearGate.use(player);
            // Cooldown prevents re-triggering during warp animation
            setTimeout(() => { this._gateJumpCooldown = false; }, 3000);
            prompt.classList.add('hidden');
            return;
        }

        if (nearStation) {
            prompt.classList.remove('hidden');
        } else {
            prompt.classList.add('hidden');
        }
    }

    checkProximityWarnings() {
        const player = this.game.player;
        if (!player?.alive || this.game.dockedAt) return;

        const entities = this.game.currentSector?.entities || [];
        const now = Date.now();
        const alertRange = 1500;
        const cooldown = 20000; // 20s cooldown

        // Count nearby hostiles
        let nearbyHostiles = [];
        for (const entity of entities) {
            if (!entity.alive || entity.hostility !== 'hostile') continue;
            const dist = player.distanceTo(entity);
            if (dist <= alertRange) nearbyHostiles.push({ entity, dist });
        }

        if (nearbyHostiles.length === 0) return;

        // Sort by distance
        nearbyHostiles.sort((a, b) => a.dist - b.dist);
        const closest = nearbyHostiles[0];

        // Check cooldown on closest
        const lastAlert = this.proximityAlerted.get(closest.entity);
        if (lastAlert && now - lastAlert < cooldown) return;

        this.proximityAlerted.set(closest.entity, now);
        this.game.audio?.play('warning');

        // Enhanced alert message with count
        const count = nearbyHostiles.length;
        if (count === 1) {
            this.showToast(`Hostile detected: ${closest.entity.name} (${Math.round(closest.dist)}m)`, 'danger');
        } else {
            this.showToast(`${count} hostiles nearby! Closest: ${closest.entity.name} (${Math.round(closest.dist)}m)`, 'danger');
        }

        // Directional indicator pointing at closest hostile
        this.showDamageDirection(closest.entity, 'hostile');

        // Flash border - intensity based on count
        const overlay = document.getElementById('ui-overlay');
        if (overlay) {
            overlay.classList.add('proximity-flash');
            setTimeout(() => overlay.classList.remove('proximity-flash'), count > 3 ? 1000 : 600);
        }

        // Cleanup old entries
        if (this.proximityAlerted.size > 50) {
            for (const [e, t] of this.proximityAlerted) {
                if (now - t > cooldown * 2) this.proximityAlerted.delete(e);
            }
        }
    }

    updateOffscreenThreats() {
        const player = this.game.player;
        if (!player?.alive || this.game.dockedAt) {
            this._clearThreatArrows();
            return;
        }

        // Get container or create it
        let container = document.getElementById('threat-arrows');
        if (!container) {
            container = document.createElement('div');
            container.id = 'threat-arrows';
            container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;';
            document.getElementById('ui-overlay')?.appendChild(container);
        }

        const entities = this.game.currentSector?.entities || [];
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const margin = 30;

        // Collect off-screen hostiles
        const threats = [];
        for (const entity of entities) {
            if (!entity.alive || entity.hostility !== 'hostile') continue;
            const dist = player.distanceTo(entity);
            if (dist > 3000) continue; // Only nearby threats

            const screen = this.game.input.worldToScreen(entity.x, entity.y);
            if (screen.x >= margin && screen.x <= viewW - margin &&
                screen.y >= margin && screen.y <= viewH - margin) continue; // On screen

            threats.push({ entity, screen, dist });
        }

        // Limit to 6 nearest
        threats.sort((a, b) => a.dist - b.dist);
        const showThreats = threats.slice(0, 6);

        // Update arrows
        while (container.children.length > showThreats.length) {
            container.removeChild(container.lastChild);
        }
        while (container.children.length < showThreats.length) {
            const arrow = document.createElement('div');
            arrow.className = 'threat-arrow';
            arrow.style.cssText = 'position:absolute;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:12px solid #ff4444;filter:drop-shadow(0 0 4px rgba(255,68,68,0.6));transition:left 0.15s,top 0.15s;';
            container.appendChild(arrow);
        }

        for (let i = 0; i < showThreats.length; i++) {
            const { screen, dist } = showThreats[i];
            const arrow = container.children[i];

            // Clamp to screen edge
            const cx = viewW / 2;
            const cy = viewH / 2;
            const dx = screen.x - cx;
            const dy = screen.y - cy;
            const angle = Math.atan2(dy, dx);

            // Find intersection with screen edge
            const edgeX = Math.max(margin, Math.min(viewW - margin, cx + Math.cos(angle) * (viewW / 2 - margin)));
            const edgeY = Math.max(margin, Math.min(viewH - margin, cy + Math.sin(angle) * (viewH / 2 - margin)));

            arrow.style.left = `${edgeX - 6}px`;
            arrow.style.top = `${edgeY - 6}px`;
            arrow.style.transform = `rotate(${angle + Math.PI / 2}rad)`;

            // Distance-based opacity (closer = brighter)
            const opacity = Math.max(0.3, 1 - dist / 3000);
            arrow.style.opacity = opacity;
        }
    }

    _clearThreatArrows() {
        const container = document.getElementById('threat-arrows');
        if (container) container.innerHTML = '';
    }

    checkAsteroidFieldEntry() {
        const player = this.game.player;
        if (!player?.alive || this.game.dockedAt) return;

        const fields = this.game.currentSector?.asteroidFields || [];
        let inField = false;

        for (const field of fields) {
            const dx = player.x - field.x;
            const dy = player.y - field.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < field.radius) {
                inField = true;
                break;
            }
        }

        if (inField && !this._inAsteroidField) {
            this._inAsteroidField = true;
            this.showToast('Entering asteroid field', 'warning');
            // Amber border flash
            const overlay = document.getElementById('ui-overlay');
            if (overlay) {
                overlay.style.boxShadow = 'inset 0 0 80px rgba(255,170,0,0.2)';
                setTimeout(() => {
                    if (overlay) overlay.style.boxShadow = '';
                }, 1500);
            }
        } else if (!inField && this._inAsteroidField) {
            this._inAsteroidField = false;
        }
    }

    updateDroneBar() {
        const droneBar = this.elements.droneBar;
        if (!droneBar) return;

        const player = this.game.player;
        if (!player || !player.droneBay) {
            droneBar.classList.add('hidden');
            return;
        }

        const deployed = player.droneBay.deployed?.size || 0;
        const total = player.droneBay.drones?.length || 0;

        // Show bar only if there are deployed drones
        if (deployed > 0) {
            droneBar.classList.remove('hidden');
            const countEl = droneBar.querySelector('.drone-count');
            if (countEl) countEl.textContent = `${deployed}/${total}`;

            // Update status text based on drone command
            const statusEl = droneBar.querySelector('.drone-status');
            if (statusEl && player.droneCommand) {
                const commandNames = {
                    'idle': 'Idle',
                    'orbit': 'Orbiting',
                    'attack': 'Attacking',
                    'mine': 'Mining',
                    'return': 'Returning'
                };
                statusEl.textContent = commandNames[player.droneCommand] || 'Idle';
            }
        } else {
            droneBar.classList.add('hidden');
        }
    }

    /**
     * Update overview panel
     */
    updateOverview() {
        const entities = this.game.getVisibleEntities();
        const player = this.game.player;
        const filter = this.currentFilter || 'all';

        // Filter entities
        let filtered = entities.filter(e => e !== player);

        if (filter !== 'all') {
            const typeMap = {
                ships: ['enemy', 'ship', 'npc', 'guild', 'fleet'],
                stations: ['station'],
                asteroids: ['asteroid', 'loot', 'wreck'],
                gates: ['gate'],
                anomalies: ['anomaly'],
            };
            const types = typeMap[filter] || [];
            filtered = filtered.filter(e => types.includes(e.type));
        }

        // Pre-compute sortable values for each entity
        const enriched = filtered.map(entity => {
            const dist = player ? player.distanceTo(entity) : 0;
            let speed = 0;
            let angVel = 0;
            if (entity.velocity && player) {
                speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
                if (dist > 0 && speed > 1) {
                    const dx = entity.x - player.x;
                    const dy = entity.y - player.y;
                    const angle = Math.atan2(dy, dx);
                    const relVelX = entity.velocity.x - (player.velocity?.x || 0);
                    const relVelY = entity.velocity.y - (player.velocity?.y || 0);
                    const transVel = Math.abs(relVelX * Math.sin(angle) - relVelY * Math.cos(angle));
                    angVel = (transVel / dist) * 1000;
                }
            }
            const typeLabel = entity.type === 'npc' ? entity.role : entity.type === 'guild' ? (entity.role || 'guild') : entity.type === 'loot' ? 'wreck' : entity.type;
            return { entity, dist, speed, angVel, typeLabel };
        });

        // Sort by selected column
        const col = this.overviewSortColumn;
        const dir = this.overviewSortAsc ? 1 : -1;
        enriched.sort((a, b) => {
            switch (col) {
                case 'name': return dir * a.entity.name.localeCompare(b.entity.name);
                case 'type': return dir * a.typeLabel.localeCompare(b.typeLabel);
                case 'dist': return dir * (a.dist - b.dist);
                case 'vel': return dir * (a.speed - b.speed);
                case 'ang': return dir * (a.angVel - b.angVel);
                default: return dir * (a.dist - b.dist);
            }
        });

        // Limit to prevent performance issues
        const display = enriched.slice(0, 50);

        // Build table rows
        const html = display.map(({ entity, dist, speed, angVel, typeLabel }) => {
            const distStr = player ? formatDistance(dist) : '-';
            const icon = this.getEntityIcon(entity);
            const hostility = entity.hostility || 'neutral';
            const selected = entity === this.game.selectedTarget ? 'selected' : '';
            const velocity = speed > 1 ? `${Math.floor(speed)}` : '-';
            const angularVel = angVel > 0.01 ? angVel.toFixed(2) : '-';

            // Threat assessment
            const threat = this.assessThreat(entity, player);

            // Tooltip info
            const shipClass = entity.shipClass || entity.size || '';
            const hpPct = entity.maxShield ? `S:${Math.floor(entity.shield/entity.maxShield*100)}% A:${Math.floor(entity.armor/entity.maxArmor*100)}% H:${Math.floor(entity.hull/entity.maxHull*100)}%` : '';
            const tooltipParts = [entity.name];
            if (shipClass) tooltipParts.push(shipClass);
            if (hpPct) tooltipParts.push(hpPct);
            if (threat.label) tooltipParts.push(`Threat: ${threat.label}`);
            const tooltip = tooltipParts.join(' | ');

            // Rich tooltip data attributes
            const bountyVal = entity.bounty ? `${entity.bounty} ISK` : '';
            const factionName = entity.factionName || '';
            const roleName = entity.role || '';

            // Size comparison to player
            let sizeCompare = '';
            if (player && entity.size && player.size) {
                const sizeOrder = ['frigate','destroyer','cruiser','battlecruiser','battleship','capital'];
                const ei = sizeOrder.indexOf(entity.size);
                const pi = sizeOrder.indexOf(player.size);
                if (ei >= 0 && pi >= 0) {
                    const diff = ei - pi;
                    if (diff > 1) sizeCompare = 'Much larger';
                    else if (diff === 1) sizeCompare = 'Larger';
                    else if (diff === 0) sizeCompare = 'Same class';
                    else if (diff === -1) sizeCompare = 'Smaller';
                    else sizeCompare = 'Much smaller';
                }
            }

            return `
                <tr class="${hostility} ${selected}" data-entity-id="${entity.id}"
                    data-tip-name="${entity.name}" data-tip-class="${shipClass}" data-tip-hp="${hpPct}"
                    data-tip-bounty="${bountyVal}" data-tip-faction="${factionName}" data-tip-role="${roleName}"
                    data-tip-threat="${threat.label || ''}" data-tip-size="${sizeCompare}">
                    <td class="col-icon overview-icon"><span class="threat-dot ${threat.cls}"></span>${icon}</td>
                    <td class="col-name">${entity.name}</td>
                    <td class="col-type">${typeLabel}</td>
                    <td class="col-dist">${distStr}</td>
                    <td class="col-vel">${velocity}</td>
                    <td class="col-ang">${angularVel}</td>
                </tr>
            `;
        }).join('');

        this.elements.overviewBody.innerHTML = html;

        // Flash new hostile rows
        const currentHostileIds = new Set();
        for (const { entity } of enriched) {
            if (entity.hostility === 'hostile') currentHostileIds.add(entity.id);
        }
        if (this._prevHostileIds) {
            for (const id of currentHostileIds) {
                if (!this._prevHostileIds.has(id)) {
                    const row = this.elements.overviewBody.querySelector(`tr[data-entity-id="${id}"]`);
                    if (row) {
                        row.classList.add('overview-new-hostile');
                        setTimeout(() => row.classList.remove('overview-new-hostile'), 1500);
                    }
                }
            }
        }
        this._prevHostileIds = currentHostileIds;
    }

    /**
     * Get icon for entity type
     */
    getEntityIcon(entity) {
        // Ship class-specific icons for combat entities
        const isShipType = ['enemy', 'ship', 'npc', 'guild', 'fleet'].includes(entity.type);
        if (isShipType && entity.size) {
            const sizeIcons = {
                frigate: '&#9670;',       // Small diamond
                destroyer: '&#9668;',     // Left triangle
                cruiser: '&#9632;',       // Square
                battlecruiser: '&#11044;', // Large circle
                battleship: '&#9733;',    // Star
                capital: '&#10038;',      // Six-pointed star
            };
            return sizeIcons[entity.size] || '&#9650;';
        }

        const icons = {
            enemy: '&#9650;',    // Triangle
            ship: '&#9650;',
            npc: '&#9650;',      // Triangle (same as ship)
            guild: '&#9650;',    // Triangle (faction ships)
            fleet: '&#9650;',    // Triangle (fleet ships)
            station: '&#9632;',  // Square
            asteroid: '&#9671;', // Diamond
            gate: '&#10070;',    // Star
            planet: '&#9679;',   // Circle
            player: '&#9733;',   // Star
            loot: '&#9830;',     // Diamond (loot container)
            drone: '&#8226;',    // Bullet (small)
            anomaly: '&#10059;', // Sparkle star (anomaly)
            wreck: '&#9674;',    // Lozenge (wreck)
        };
        return icons[entity.type] || '&#9679;';
    }

    /**
     * Assess threat level of an entity relative to the player
     */
    assessThreat(entity, player) {
        // Non-combat entities
        if (!entity.maxHull || entity.type === 'asteroid' || entity.type === 'station' || entity.type === 'player-station' ||
            entity.type === 'gate' || entity.type === 'planet' || entity.type === 'wreck' ||
            entity.type === 'loot' || entity.type === 'drone') {
            return { level: 0, cls: 'threat-none', label: '' };
        }

        // Friendly entities
        if (entity.type === 'fleet' || (entity.type === 'npc' && entity.hostility !== 'hostile') ||
            (entity.type === 'guild' && !entity.isPirate)) {
            return { level: 0, cls: 'threat-friendly', label: 'Friendly' };
        }

        if (!player) return { level: 1, cls: 'threat-low', label: 'Unknown' };

        // Calculate relative combat power
        const entityHP = (entity.shield || 0) + (entity.armor || 0) + (entity.hull || 0);
        const playerHP = (player.shield || 0) + (player.armor || 0) + (player.hull || 0);
        const hpRatio = playerHP > 0 ? entityHP / playerHP : 999;

        // Estimate DPS from equipped modules (rough)
        const SIZE_POWER = { small: 1, medium: 2, large: 4, xlarge: 8 };
        const entitySize = SIZE_POWER[entity.size] || SIZE_POWER[entity.shipSize] || 1;
        const playerSize = SIZE_POWER[player.size] || SIZE_POWER[player.shipSize] || 1;
        const sizeRatio = entitySize / playerSize;

        // Combined threat score
        const threat = (hpRatio * 0.6 + sizeRatio * 0.4);

        if (threat > 2.5) return { level: 4, cls: 'threat-skull', label: 'Overwhelming' };
        if (threat > 1.5) return { level: 3, cls: 'threat-high', label: 'Dangerous' };
        if (threat > 0.8) return { level: 2, cls: 'threat-med', label: 'Comparable' };
        if (threat > 0.3) return { level: 1, cls: 'threat-low', label: 'Weak' };
        return { level: 0, cls: 'threat-trivial', label: 'Trivial' };
    }

    /**
     * Rebuild module rack HTML when ship slot counts change
     */
    rebuildModuleRack() {
        const player = this.game.player;
        if (!player) return;

        let globalIndex = 0;
        const buildSlots = (prefix, count) => {
            let html = '';
            for (let i = 1; i <= count; i++) {
                const keyHint = prefix === 'high' ? `F${globalIndex + 1}` : '';
                html += `<div class="module-slot" data-slot="${prefix}-${i}">
                    <div class="module-icon"></div>
                    <div class="module-cooldown"></div>
                    <div class="module-cooldown-text"></div>
                    ${keyHint ? `<div class="module-slot-keybind">${keyHint}</div>` : ''}
                </div>`;
                globalIndex++;
            }
            return html;
        };

        const highContainer = document.getElementById('high-slots');
        const midContainer = document.getElementById('mid-slots');
        const lowContainer = document.getElementById('low-slots');

        if (highContainer) highContainer.innerHTML = buildSlots('high', player.highSlots);
        if (midContainer) midContainer.innerHTML = buildSlots('mid', player.midSlots);
        if (lowContainer) lowContainer.innerHTML = buildSlots('low', player.lowSlots);

        // Re-attach click handlers
        document.querySelectorAll('.module-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const slotData = slot.dataset.slot;
                if (slotData) {
                    const parts = slotData.split('-');
                    const slotType = parts[0];
                    const slotNum = parseInt(parts[1]);

                    let index;
                    if (slotType === 'high') index = slotNum - 1;
                    else if (slotType === 'mid') index = player.highSlots + slotNum - 1;
                    else index = player.highSlots + player.midSlots + slotNum - 1;

                    const wasActive = player.activeModules.has(slotData);
                    player.toggleModule(index);
                    this.game.audio?.play(wasActive ? 'module-deactivate' : 'module-activate');
                }
            });
        });
    }

    /**
     * Update module rack display
     */
    updateModuleRack() {
        const player = this.game.player;
        if (!player) return;

        // Rebuild rack if slot counts changed (ship switch)
        const slotKey = `${player.highSlots}-${player.midSlots}-${player.lowSlots}`;
        if (this._lastSlotKey !== slotKey) {
            this._lastSlotKey = slotKey;
            this.rebuildModuleRack();
        }

        const modules = player.getFittedModules();

        modules.forEach((mod, index) => {
            const slotElement = document.querySelector(`[data-slot="${mod.slotId}"]`);
            if (!slotElement) return;

            // Update active state
            slotElement.classList.toggle('active', mod.active);

            // Update cooldown display
            const cooldownEl = slotElement.querySelector('.module-cooldown');
            if (mod.cooldown > 0 && mod.config) {
                const percent = (mod.cooldown / mod.config.cycleTime) * 100;
                cooldownEl.style.height = `${percent}%`;
            } else {
                cooldownEl.style.height = '0%';
            }

            // Update icon
            const iconEl = slotElement.querySelector('.module-icon');
            if (mod.config) {
                iconEl.innerHTML = this.getModuleIcon(mod.moduleId);
            } else {
                iconEl.innerHTML = '';
            }

            // Add/update cycle ring for active modules
            this.updateModuleCycleRing(slotElement, mod);

            // Cap warning glow on active modules
            const capPct = player.maxCapacitor > 0 ? player.capacitor / player.maxCapacitor : 1;
            if (mod.active && mod.config?.capacitorCost > 0 && capPct < 0.35) {
                slotElement.classList.add('cap-warning');
                // Intensity scales with cap depletion
                const severity = 1 - (capPct / 0.35);
                const r = Math.round(255 * severity);
                const g = Math.round(140 * (1 - severity));
                slotElement.style.setProperty('--cap-warn-color', `rgba(${r},${g},0,${0.3 + severity * 0.5})`);
            } else {
                slotElement.classList.remove('cap-warning');
            }

            // Out-of-range dimming for weapons/miners with range
            const target = this.game.selectedTarget;
            if (mod.config?.range && target && target !== player) {
                const dx = target.x - player.x;
                const dy = target.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                slotElement.classList.toggle('out-of-range', dist > mod.config.range);
            } else {
                slotElement.classList.remove('out-of-range');
            }

            // Cooldown percentage text
            const cdTextEl = slotElement.querySelector('.module-cooldown-text');
            if (cdTextEl) {
                if (mod.cooldown > 0 && mod.config?.cycleTime) {
                    const pct = Math.ceil((mod.cooldown / mod.config.cycleTime) * 100);
                    cdTextEl.textContent = `${pct}%`;
                    cdTextEl.style.display = '';
                } else {
                    cdTextEl.textContent = '';
                    cdTextEl.style.display = 'none';
                }
            }

            // Add/update tooltip
            this.updateModuleTooltip(slotElement, mod);
        });
    }

    /**
     * Update module cycle ring (circular progress indicator)
     */
    updateModuleCycleRing(slotElement, mod) {
        let ringEl = slotElement.querySelector('.module-cycle-ring');

        if (mod.active && mod.config) {
            // Create ring if it doesn't exist
            if (!ringEl) {
                ringEl = document.createElement('div');
                ringEl.className = 'module-cycle-ring';
                ringEl.innerHTML = `
                    <svg viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r="23"></circle>
                    </svg>
                `;
                slotElement.appendChild(ringEl);
            }

            // Set cycle time for CSS animation
            slotElement.style.setProperty('--cycle-time', `${mod.config.cycleTime}s`);

            // Update stroke based on cycle progress
            const circle = ringEl.querySelector('circle');
            if (circle && mod.cooldown > 0) {
                const progress = 1 - (mod.cooldown / mod.config.cycleTime);
                const circumference = 2 * Math.PI * 23;
                circle.style.strokeDasharray = `${circumference}`;
                circle.style.strokeDashoffset = `${circumference * (1 - progress)}`;
            }
        } else if (ringEl) {
            ringEl.remove();
        }
    }

    /**
     * Update module tooltip
     */
    updateModuleTooltip(slotElement, mod) {
        let tooltipEl = slotElement.querySelector('.module-tooltip');

        if (mod.config) {
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'module-tooltip';
                slotElement.appendChild(tooltipEl);
            }

            const config = mod.config;
            let statsHtml = '';

            // Add relevant stats based on module type
            if (config.damage) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Damage</span><span class="value damage">${config.damage}</span></div>`;
            }
            if (config.miningYield) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Mining Yield</span><span class="value">${config.miningYield} units</span></div>`;
            }
            if (config.shieldBoost) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Shield Boost</span><span class="value">+${config.shieldBoost}</span></div>`;
            }
            if (config.armorRepair) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Armor Repair</span><span class="value">+${config.armorRepair}</span></div>`;
            }
            if (config.speedBonus) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Speed Bonus</span><span class="value">+${config.speedBonus * 100}%</span></div>`;
            }
            if (config.damageBonus) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Damage Bonus</span><span class="value">+${config.damageBonus * 100}%</span></div>`;
            }
            if (config.cycleTime) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Cycle Time</span><span class="value">${config.cycleTime}s</span></div>`;
            }
            if (config.capacitorUse) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Capacitor Use</span><span class="value capacitor">${config.capacitorUse}</span></div>`;
            }
            if (config.range) {
                statsHtml += `<div class="module-tooltip-stat"><span class="label">Range</span><span class="value">${formatDistance(config.range)}</span></div>`;
            }

            // Determine hotkey hint from slot id
            const slotId = slotElement.dataset.slot || '';
            let hotkeyHint = '';
            if (slotId.startsWith('high-')) {
                const num = parseInt(slotId.split('-')[1]);
                hotkeyHint = `<div class="module-tooltip-stat"><span class="label">Hotkey</span><span class="value">F${num}</span></div>`;
            }

            tooltipEl.innerHTML = `
                <div class="module-tooltip-name">${config.name}</div>
                ${statsHtml}
                ${hotkeyHint}
            `;
        } else if (tooltipEl) {
            tooltipEl.remove();
        }
    }

    /**
     * Get icon for module type
     */
    getModuleIcon(moduleId) {
        const icons = {
            'small-laser': '&#9889;',
            'medium-laser': '&#9889;',
            'mining-laser': '&#9874;',
            'mining-laser-2': '&#9874;',
            'shield-booster': '&#9211;',
            'afterburner': '&#10148;',
            'warp-scrambler': '&#10006;',
            'armor-repairer': '&#10010;',
            'damage-mod': '&#9881;',
        };
        if (icons[moduleId]) return icons[moduleId];

        // Fallback: check equipment database config for new modules
        const config = EQUIPMENT_DATABASE?.[moduleId] || CONFIG.MODULES?.[moduleId];
        if (config) {
            if (config.damage) return '&#9889;';
            if (config.miningYield) return '&#9874;';
            if (config.shieldRepair) return '&#9211;';
            if (config.armorRepair) return '&#10010;';
            if (config.speedBonus) return '&#10148;';
            if (config.warpDisrupt) return '&#10006;';
            if (config.damageBonus || config.laserDamageBonus || config.missileDamageBonus) return '&#9733;';
            if (config.missileSpeed) return '&#9737;';
            if (config.salvageChance) return '&#9851;';
        }
        return '&#9632;';
    }

    /**
     * Show context menu - dynamically builds menu based on target
     */
    showContextMenu(x, y, entity, worldPos = null) {
        const menu = this.elements.contextMenu;
        this.contextMenuTarget = entity;
        this.contextMenuWorldPos = worldPos;

        // Build menu HTML dynamically
        menu.innerHTML = this.buildContextMenuHTML(entity);

        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Keep menu on screen
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = `${window.innerWidth - rect.width - 5}px`;
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = `${window.innerHeight - rect.height - 5}px`;
            }
        });
    }

    /**
     * Build context menu HTML based on entity
     */
    buildContextMenuHTML(entity) {
        const items = [];

        // Approach - always available
        items.push(`<div class="menu-item" data-action="approach">Approach</div>`);

        if (entity) {
            // Orbit submenu
            items.push(`
                <div class="menu-item has-submenu">
                    <span class="submenu-arrow">&#9666;</span>
                    Orbit
                    <div class="submenu">
                        <div class="submenu-item" data-action="orbit-100">100 m</div>
                        <div class="submenu-item" data-action="orbit-500">500 m</div>
                        <div class="submenu-item" data-action="orbit-1000">1,000 m</div>
                        <div class="submenu-item" data-action="orbit-2500">2,500 m</div>
                        <div class="submenu-item" data-action="orbit-5000">5,000 m</div>
                    </div>
                </div>`);

            // Keep at Range submenu
            items.push(`
                <div class="menu-item has-submenu">
                    <span class="submenu-arrow">&#9666;</span>
                    Keep at Range
                    <div class="submenu">
                        <div class="submenu-item" data-action="keep-range-100">100 m</div>
                        <div class="submenu-item" data-action="keep-range-500">500 m</div>
                        <div class="submenu-item" data-action="keep-range-1000">1,000 m</div>
                        <div class="submenu-item" data-action="keep-range-2500">2,500 m</div>
                        <div class="submenu-item" data-action="keep-range-5000">5,000 m</div>
                    </div>
                </div>`);

            items.push(`<div class="menu-separator"></div>`);

            // Lock / Unlock target
            if (entity === this.game.lockedTarget) {
                items.push(`<div class="menu-item" data-action="unlock">Unlock Target</div>`);
            } else {
                items.push(`<div class="menu-item" data-action="lock">Lock Target</div>`);
            }
            items.push(`<div class="menu-item" data-action="look-at">Look At</div>`);

            // Warp (only if far enough)
            const dist = this.game.player ? this.game.player.distanceTo(entity) : 0;
            if (dist > 1000) {
                items.push(`<div class="menu-separator"></div>`);
                items.push(`<div class="menu-item" data-action="warp">Warp To</div>`);
            }

            // Dock (only for stations and player stations)
            if (entity.type === 'station' || entity.type === 'player-station') {
                const canDock = entity.canDock?.(this.game.player);
                const dockClass = canDock ? '' : ' disabled';
                items.push(`<div class="menu-item${dockClass}" data-action="dock">Dock</div>`);
            }

            // Jump (only for gates)
            if (entity.type === 'gate' && entity.destinationSectorId) {
                const canJump = entity.canUse?.(this.game.player);
                const jumpClass = canJump ? '' : ' disabled';
                const destName = entity.destinationName || entity.destinationSectorId;
                items.push(`<div class="menu-item${jumpClass}" data-action="jump-gate">Jump to ${destName}</div>`);
            }

            // Hail NPC ships
            if (entity.isNPC && entity.role) {
                items.push(`<div class="menu-item" data-action="hail">Hail</div>`);
            }

            // Scan Cargo (any ship with cargo capacity)
            if (entity.cargoCapacity !== undefined && entity !== this.game.player) {
                const scanDist = this.game.player ? this.game.player.distanceTo(entity) : Infinity;
                const canScan = scanDist < 500;
                items.push(`<div class="menu-item${canScan ? '' : ' disabled'}" data-action="scan-cargo">Scan Cargo</div>`);
            }

            // Scoop loot containers
            if (entity.type === 'loot') {
                const canScoop = this.game.player && this.game.player.distanceTo(entity) < 200;
                const scoopClass = canScoop ? '' : ' disabled';
                items.push(`<div class="menu-item${scoopClass}" data-action="scoop">Scoop</div>`);
            }

            // Salvage wrecks
            if (entity.type === 'wreck') {
                const canSalvage = this.game.player && this.game.player.distanceTo(entity) < 200;
                const salvClass = canSalvage ? '' : ' disabled';
                const label = entity.salvaged ? 'Already Salvaged' : 'Salvage';
                items.push(`<div class="menu-item${salvClass}${entity.salvaged ? ' disabled' : ''}" data-action="salvage">${label}</div>`);
            }

            // Anomaly interactions
            if (entity.type === 'anomaly') {
                items.push(`<div class="menu-separator"></div>`);
                if (!entity.scanned) {
                    items.push(`<div class="menu-item" data-action="scan-anomaly">Scan Anomaly</div>`);
                } else {
                    const actionLabel = entity.anomalyType === 'wormhole' ? 'Enter Wormhole' :
                        entity.anomalyType === 'combatSite' ? 'Activate Site' :
                        entity.anomalyType === 'dataSite' ? 'Hack Beacon' : 'Harvest Gas';
                    items.push(`<div class="menu-item" data-action="interact-anomaly">${actionLabel}</div>`);
                }
            }
        }

        // Jettison cargo (only when player has cargo)
        const player = this.game.player;
        if (player && (player.cargoUsed > 0)) {
            items.push(`<div class="menu-separator"></div>`);
            items.push(`<div class="menu-item" data-action="jettison">Jettison Cargo</div>`);
        }

        // Deploy POS (when player has pos-kit in cargo)
        if (player) {
            const hasBasicKit = player.cargo['pos-kit-basic']?.quantity > 0;
            const hasAdvancedKit = player.cargo['pos-kit-advanced']?.quantity > 0;
            if (hasBasicKit || hasAdvancedKit) {
                const existing = this.game.playerStations?.find(p => p.sectorId === this.game.currentSector?.id && p.alive);
                if (!existing) {
                    items.push(`<div class="menu-separator"></div>`);
                    if (hasBasicKit) items.push(`<div class="menu-item" data-action="deploy-pos-basic">Deploy POS (Basic)</div>`);
                    if (hasAdvancedKit) items.push(`<div class="menu-item" data-action="deploy-pos-advanced">Deploy POS (Advanced)</div>`);
                }
            }
        }

        // Bookmark - always available
        items.push(`<div class="menu-separator"></div>`);
        items.push(`<div class="menu-item" data-action="bookmark">Save Location</div>`);

        return items.join('');
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        this.elements.contextMenu.classList.add('hidden');
        this.contextMenuTarget = null;
        this.contextMenuWorldPos = null;
    }

    /**
     * Handle context menu action
     */
    handleContextMenuAction(action) {
        const target = this.contextMenuTarget;
        const worldPos = this.contextMenuWorldPos;
        this.hideContextMenu();

        // Handle approach - works with or without target
        if (action === 'approach') {
            if (target) {
                this.game.autopilot.approach(target);
            } else if (worldPos) {
                this.game.autopilot.approachPosition(worldPos.x, worldPos.y);
            }
            this.game.audio?.play('click');
            return;
        }

        // Drone actions (from ship indicator menu)
        if (action === 'launch-drones') {
            this.game.player?.launchAllDrones();
            this.game.audio?.play('click');
            return;
        }
        if (action === 'recall-drones') {
            this.game.player?.recallAllDrones();
            this.game.audio?.play('click');
            return;
        }

        // Bookmark works with or without target
        if (action === 'bookmark') {
            this.game.addBookmark(target ? `Near ${target.name}` : 'Bookmark');
            this.game.audio?.play('click');
            return;
        }

        // Deploy POS
        if (action === 'deploy-pos-basic') {
            this.game.deployPlayerStation('pos-kit-basic');
            return;
        }
        if (action === 'deploy-pos-advanced') {
            this.game.deployPlayerStation('pos-kit-advanced');
            return;
        }

        // All other actions require a target
        if (!target) return;

        // Handle orbit with distance (orbit-100, orbit-500, etc.)
        if (action.startsWith('orbit-')) {
            const distance = parseInt(action.split('-')[1]);
            this.game.autopilot.orbit(target, distance);
            this.game.audio?.play('click');
            return;
        }

        // Handle keep-range with distance (keep-range-100, keep-range-500, etc.)
        if (action.startsWith('keep-range-')) {
            const distance = parseInt(action.split('-').slice(2).join(''));
            this.game.autopilot.keepAtRange(target, distance);
            this.game.audio?.play('click');
            return;
        }

        switch (action) {
            case 'lock':
                this.game.lockTarget(target);
                break;
            case 'unlock':
                this.game.unlockTarget();
                break;
            case 'look-at':
                this.game.camera.lookAt(target);
                this.game.selectTarget(target);
                break;
            case 'warp':
                this.game.autopilot.warpTo(target);
                break;
            case 'jump-gate':
                if (target.type === 'gate' && target.canUse?.(this.game.player)) {
                    target.use(this.game.player);
                } else {
                    this.log('Too far from gate - approach within activation range', 'system');
                    this.toast('Too far from gate', 'warning');
                    this.game.audio?.play('warning');
                }
                break;
            case 'dock':
                if ((target.type === 'station' || target.type === 'player-station') && target.canDock(this.game.player)) {
                    this.game.dockAtStation(target);
                } else {
                    this.log('Too far to dock', 'system');
                    this.toast('DOCKING REQUEST DENIED - approach the station', 'error');
                    this.game.audio?.play('warning');
                    // Red flash on station
                    this.game.renderer?.effects?.spawn('hit', target.x, target.y, {
                        count: 8, color: 0xff2222,
                    });
                    // Floating DENIED text
                    const screen = this.game.input?.worldToScreen(target.x, target.y);
                    if (screen) {
                        const el = document.createElement('div');
                        el.className = 'damage-number miss';
                        el.textContent = 'DENIED';
                        el.style.left = `${screen.x}px`;
                        el.style.top = `${screen.y - 20}px`;
                        el.style.color = '#ff4444';
                        el.style.fontSize = '14px';
                        document.getElementById('ui-overlay').appendChild(el);
                        setTimeout(() => el.remove(), 1500);
                    }
                }
                break;
            case 'hail':
                this.hailNPC(target);
                break;
            case 'scoop':
                if (target && target.type === 'loot' && this.game.player) {
                    const dist = this.game.player.distanceTo(target);
                    if (dist < 200) {
                        // Loot tractor beam visual
                        this.game.renderer?.effects?.spawn('loot', target.x, target.y);
                        target.scoop(this.game.player);
                    } else {
                        this.log('Too far to scoop - get within 200m', 'system');
                        this.toast('Too far to scoop', 'warning');
                    }
                }
                break;
            case 'jettison':
                this.jettisonCargo();
                break;
            case 'salvage':
                if (target && target.type === 'wreck' && !target.salvaged) {
                    target.startSalvage(this.game.player);
                }
                break;
            case 'scan-anomaly':
                if (target && target.type === 'anomaly') {
                    this.game.audio?.play('scan');
                    this.showToast(`Scanning ${target.name}...`, 'system');
                    // Progressive scan over 3 seconds
                    let scanTimer = 0;
                    const scanInterval = setInterval(() => {
                        scanTimer += 0.1;
                        if (!target.alive || target.scanned) {
                            clearInterval(scanInterval);
                            return;
                        }
                        target.applyScan(0.1, 1);
                        if (target.scanned) clearInterval(scanInterval);
                        if (scanTimer > 10) clearInterval(scanInterval);
                    }, 100);
                }
                break;
            case 'interact-anomaly':
                if (target && target.type === 'anomaly') {
                    target.interact(this.game.player);
                }
                break;
            case 'scan-cargo':
                this.scanTargetCargo(target);
                break;
        }

        this.game.audio?.play('click');
    }

    /**
     * Log a message to the event log
     */
    log(message, type = 'system') {
        const container = this.elements.logMessages;
        if (!container) return;

        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

        const element = document.createElement('div');
        element.className = `log-message ${type}`;
        element.dataset.logType = type;
        element.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

        container.appendChild(element);

        // Hide if filtered out
        if (this.logFilter !== 'all' && type !== this.logFilter) {
            element.style.display = 'none';
        }

        // Remove old messages
        while (container.children.length > this.maxLogMessages) {
            container.removeChild(container.firstChild);
        }

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Log a kill mail with detailed info
     */
    logKillMail(entity) {
        const container = this.elements.logMessages;
        if (!container) return;

        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        const shipClass = entity.shipClass ? entity.shipClass.toUpperCase() : 'UNKNOWN';
        const bountyStr = entity.bounty ? formatCredits(entity.bounty) : '0';
        const factionStr = entity.factionId ? ` [${entity.factionId.split('-').map(w => w[0]).join('').toUpperCase()}]` : '';

        const element = document.createElement('div');
        element.className = 'log-message kill';
        element.dataset.logType = 'combat';
        element.innerHTML = `
            <span class="timestamp">[${timestamp}]</span> \u2620 <b>${entity.name}</b> destroyed
            <div class="log-killmail">
                <div class="km-header">${shipClass}${factionStr}</div>
                <div class="km-bounty">Bounty: ${bountyStr} ISK</div>
            </div>
        `;

        container.appendChild(element);

        if (this.logFilter !== 'all' && this.logFilter !== 'combat') {
            element.style.display = 'none';
        }

        while (container.children.length > this.maxLogMessages) {
            container.removeChild(container.firstChild);
        }

        container.scrollTop = container.scrollHeight;

        // Show kill notification popup
        this.showKillNotification(entity);

        // Kill streak tracking
        this.killStreak++;
        clearTimeout(this.killStreakTimer);
        this.killStreakTimer = setTimeout(() => { this.killStreak = 0; }, 30000);

        const streakLabels = {
            2: 'DOUBLE KILL',
            3: 'TRIPLE KILL',
            4: 'QUAD KILL',
            5: 'MULTI KILL',
            7: 'MEGA KILL',
            10: 'RAMPAGE',
            15: 'UNSTOPPABLE',
            20: 'GODLIKE',
        };

        // Find highest matching threshold
        let streakText = null;
        for (const [threshold, label] of Object.entries(streakLabels).reverse()) {
            if (this.killStreak >= parseInt(threshold)) {
                streakText = label;
                break;
            }
        }

        if (streakText && this.killStreak >= 2) {
            this.showStreakNotification(streakText, this.killStreak);
        }
    }

    showStreakNotification(text, count) {
        const existing = document.getElementById('streak-notification');
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.id = 'streak-notification';
        el.className = 'streak-notification';
        el.innerHTML = `
            <div class="streak-text">${text}</div>
            <div class="streak-count">${count} kills</div>
        `;
        document.body.appendChild(el);
        this.game.audio?.play('level-up');
        setTimeout(() => el.remove(), 2500);
    }

    /**
     * Show a prominent kill notification popup
     */
    showKillNotification(entity) {
        const existing = document.getElementById('kill-notification');
        if (existing) existing.remove();

        const shipClass = entity.shipClass ? entity.shipClass.toUpperCase() : '';
        const bountyStr = entity.bounty ? formatCredits(entity.bounty) : '0';

        // Ship type icon color
        const typeColors = {
            enemy: '#ff4444', pirate: '#ff4444', hostile: '#ff4444',
            npc: '#44aaff', guild: '#ffaa44', fleet: '#44ff88',
        };
        const iconColor = typeColors[entity.type] || typeColors[entity.hostility] || '#ff4444';

        const popup = document.createElement('div');
        popup.id = 'kill-notification';
        popup.innerHTML = `
            <div class="kill-notif-line"></div>
            <div class="kill-notif-header">KILL CONFIRMED</div>
            <div class="kill-notif-icon" style="color:${iconColor}; text-shadow: 0 0 12px ${iconColor}">&#9670;</div>
            <div class="kill-notif-name">${entity.name}</div>
            ${shipClass ? `<div class="kill-notif-class">${shipClass}</div>` : ''}
            <div class="kill-notif-bounty">+${bountyStr} ISK</div>
            <div class="kill-notif-line"></div>
        `;
        document.getElementById('ui-overlay').appendChild(popup);

        setTimeout(() => popup.remove(), 3000);
    }

    /**
     * Apply current log filter to all messages
     */
    applyLogFilter() {
        const container = this.elements.logMessages;
        if (!container) return;

        // Group related log types under filter categories
        const filterGroups = {
            combat: ['combat', 'kill', 'ewar', 'danger'],
            mining: ['mining', 'scan'],
            trade: ['trade', 'loot', 'guild', 'fleet'],
            system: ['system', 'warp'],
        };

        for (const msg of container.children) {
            const msgType = msg.dataset.logType;
            if (this.logFilter === 'all') {
                msg.style.display = '';
            } else {
                const group = filterGroups[this.logFilter] || [this.logFilter];
                msg.style.display = group.includes(msgType) ? '' : 'none';
            }
        }
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Show station panel
     */
    populatePriceTicker(station) {
        const track = document.getElementById('price-ticker-track');
        if (!track || !TRADE_GOODS) return;

        const goods = Object.values(TRADE_GOODS);
        const items = goods.map(good => {
            const basePrice = good.basePrice || 100;
            // Simulate price fluctuation
            const change = (Math.random() - 0.45) * 20;
            const currentPrice = Math.max(1, Math.floor(basePrice + change));
            const changePct = ((change / basePrice) * 100).toFixed(1);
            const arrow = change > 1 ? '&#9650;' : change < -1 ? '&#9660;' : '&#9644;';
            const cls = change > 1 ? 'up' : change < -1 ? 'down' : 'flat';
            return `<span class="ticker-item"><span class="ticker-name">${good.name}</span> <span class="ticker-price">${currentPrice}</span> <span class="ticker-change ${cls}">${arrow}${Math.abs(changePct)}%</span></span>`;
        });

        // Duplicate for seamless scroll
        track.innerHTML = items.join('') + items.join('');
    }

    startStationAmbient() {
        const canvas = this.stationAmbientCanvas;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.stationAmbientCtx = canvas.getContext('2d');
        this.stationAmbientParticles = [];
        // Floating dust motes
        for (let i = 0; i < 60; i++) {
            this.stationAmbientParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 12,
                vy: -8 - Math.random() * 15,
                size: 1 + Math.random() * 2.5,
                alpha: 0.15 + Math.random() * 0.35,
                color: Math.random() < 0.7 ? 'cyan' : (Math.random() < 0.5 ? 'orange' : 'white'),
                life: Math.random(),
                lifeSpeed: 0.002 + Math.random() * 0.004,
                type: 'dust'
            });
        }
        // Occasional sparks from welding
        for (let i = 0; i < 8; i++) {
            this.stationAmbientParticles.push({
                x: Math.random() * canvas.width,
                y: canvas.height * 0.2 + Math.random() * canvas.height * 0.3,
                vx: (Math.random() - 0.5) * 40,
                vy: 20 + Math.random() * 30,
                size: 1 + Math.random() * 1.5,
                alpha: 0.6 + Math.random() * 0.4,
                color: 'spark',
                life: Math.random(),
                lifeSpeed: 0.01 + Math.random() * 0.02,
                type: 'spark'
            });
        }
        const animate = () => {
            this.updateStationAmbient();
            this.stationAmbientRAF = requestAnimationFrame(animate);
        };
        this.stationAmbientRAF = requestAnimationFrame(animate);
    }

    updateStationAmbient() {
        const ctx = this.stationAmbientCtx;
        const canvas = this.stationAmbientCanvas;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Subtle volumetric light beam from top
        const grad = ctx.createLinearGradient(canvas.width * 0.4, 0, canvas.width * 0.6, canvas.height * 0.7);
        grad.addColorStop(0, 'rgba(100, 180, 255, 0.03)');
        grad.addColorStop(0.5, 'rgba(100, 180, 255, 0.015)');
        grad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.35, 0);
        ctx.lineTo(canvas.width * 0.2, canvas.height);
        ctx.lineTo(canvas.width * 0.8, canvas.height);
        ctx.lineTo(canvas.width * 0.65, 0);
        ctx.fill();

        for (const p of this.stationAmbientParticles) {
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.life += p.lifeSpeed;
            if (p.life > 1) {
                p.life = 0;
                p.x = Math.random() * canvas.width;
                p.y = p.type === 'spark' ? (canvas.height * 0.2 + Math.random() * canvas.height * 0.3) : (canvas.height + 5);
                p.vx = p.type === 'spark' ? ((Math.random() - 0.5) * 40) : ((Math.random() - 0.5) * 12);
            }
            // Wrap horizontally
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;

            const fadeAlpha = p.alpha * Math.sin(p.life * Math.PI);
            if (p.color === 'spark') {
                ctx.fillStyle = `rgba(255, ${180 + Math.random() * 75}, 50, ${fadeAlpha})`;
                ctx.shadowColor = 'rgba(255, 150, 0, 0.4)';
                ctx.shadowBlur = 6;
            } else if (p.color === 'cyan') {
                ctx.fillStyle = `rgba(100, 220, 255, ${fadeAlpha * 0.5})`;
                ctx.shadowColor = '';
                ctx.shadowBlur = 0;
            } else if (p.color === 'orange') {
                ctx.fillStyle = `rgba(255, 180, 80, ${fadeAlpha * 0.4})`;
                ctx.shadowColor = '';
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = `rgba(200, 200, 220, ${fadeAlpha * 0.4})`;
                ctx.shadowColor = '';
                ctx.shadowBlur = 0;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    stopStationAmbient() {
        if (this.stationAmbientRAF) {
            cancelAnimationFrame(this.stationAmbientRAF);
            this.stationAmbientRAF = null;
        }
        if (this.stationAmbientCtx && this.stationAmbientCanvas) {
            this.stationAmbientCtx.clearRect(0, 0, this.stationAmbientCanvas.width, this.stationAmbientCanvas.height);
        }
        this.stationAmbientParticles = [];
    }

    startStationTraffic() {
        const logEl = document.getElementById('station-traffic-log');
        if (!logEl) return;

        const shipNames = [
            'Meridian Star', 'Cobalt Drifter', 'Iron Wake', 'Sable Horizon',
            'Quantum Rift', 'Dust Runner', 'Voidspear', 'Solar Vagrant',
            'Crimson Tide', 'Neon Fang', 'Starweaver', 'Eclipse Moth',
            'Steel Phantom', 'Dark Current', 'Pulse Nova', 'Arc Lightning',
        ];
        const shipClasses = ['Frigate', 'Destroyer', 'Cruiser', 'Hauler', 'Battlecruiser', 'Mining Barge'];

        const addEntry = () => {
            if (!this._stationTrafficActive) return;
            const isDock = Math.random() < 0.5;
            const name = shipNames[Math.floor(Math.random() * shipNames.length)];
            const cls = shipClasses[Math.floor(Math.random() * shipClasses.length)];
            const entry = document.createElement('span');
            entry.className = `traffic-entry ${isDock ? 'dock' : 'undock'}`;
            entry.innerHTML = `<span class="traffic-action">${isDock ? 'ARR' : 'DEP'}</span> <span class="traffic-ship">${name}</span> <span style="opacity:0.4">${cls}</span>`;

            // Keep max 4 entries
            while (logEl.children.length >= 4) logEl.removeChild(logEl.firstChild);
            logEl.appendChild(entry);

            // Schedule next
            this._stationTrafficTimer = setTimeout(addEntry, 3000 + Math.random() * 5000);
        };

        this._stationTrafficActive = true;
        addEntry();
    }

    stopStationTraffic() {
        this._stationTrafficActive = false;
        if (this._stationTrafficTimer) clearTimeout(this._stationTrafficTimer);
        const logEl = document.getElementById('station-traffic-log');
        if (logEl) logEl.innerHTML = '';
    }

    showStationPanel(station) {
        this.elements.stationName.textContent = station.name;
        this.elements.stationPanel.classList.remove('hidden');

        // Start station ambient particles
        this.startStationAmbient();

        // Start station traffic log
        this.startStationTraffic();

        // Populate price ticker
        this.populatePriceTicker(station);

        // Initialize vendor manager
        this.vendorManager.show(station);

        // Populate shop (uses vendor manager for market/fitting, legacy for repair)
        this.updateShopPanel(station);

        // Populate refinery tab
        this.updateRefineryTab();

        // Initialize cantina (generates pilots when docked)
        this.cantinaManager.show(station);

        // Station greeting dialogue (random chance)
        if (Math.random() < 0.3) {
            const greetings = [
                { name: 'Docking Officer', title: 'Station Control', portrait: '👨‍✈️', color: '#88aacc',
                  text: `Welcome to ${station.name}, capsuleer. All services are available. Fly safe.` },
                { name: 'Hangar Chief', title: 'Maintenance Crew', portrait: '🔧', color: '#ffaa44',
                  text: `Your ship's looking a bit roughed up, pilot. Hit the repair bay if you need us.` },
                { name: 'Intel Officer', title: 'Security Division', portrait: '🛡️', color: '#44aaff',
                  text: `Pirate activity has been increasing in the outer sectors. Watch your six out there.` },
                { name: 'Trade Broker', title: 'Market Division', portrait: '💰', color: '#44ff88',
                  text: `Ore prices are holding steady. The refineries are always buying if you've got cargo to offload.` },
            ];
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            setTimeout(() => this.dialogueManager?.open({ ...greeting, options: [{ label: 'Understood', action: 'close' }] }), 500);
        }
    }

    /**
     * Hide station panel
     */
    hideStationPanel() {
        this.elements.stationPanel.classList.add('hidden');
        this.vendorManager.hide();
        this.cantinaManager.hide();
        this.stopStationAmbient();
        this.stopStationTraffic();
        this.killStreak = 0; // Reset kill streak on dock
    }

    /**
     * Play docking animation overlay
     */
    playDockingAnimation(stationName, onComplete) {
        const overlay = document.getElementById('dock-animation');
        if (!overlay) { onComplete?.(); return; }

        const textEl = document.getElementById('dock-anim-text');
        const stationEl = document.getElementById('dock-anim-station');
        if (textEl) textEl.textContent = 'DOCKING';
        if (stationEl) stationEl.textContent = stationName;

        overlay.classList.remove('hidden', 'undocking', 'fullscreen');
        overlay.classList.add('active');

        // Cinematic bars slide in, then fullscreen fade
        setTimeout(() => overlay.classList.add('fullscreen'), 800);

        // Complete after animation
        setTimeout(() => {
            overlay.classList.remove('active', 'fullscreen');
            overlay.classList.add('hidden');
            onComplete?.();
        }, 1600);
    }

    /**
     * Play undock animation overlay
     */
    playUndockAnimation(stationName, onComplete) {
        const overlay = document.getElementById('dock-animation');
        if (!overlay) { onComplete?.(); return; }

        const textEl = document.getElementById('dock-anim-text');
        const stationEl = document.getElementById('dock-anim-station');
        if (textEl) textEl.textContent = 'UNDOCKING';
        if (stationEl) stationEl.textContent = stationName;

        overlay.classList.remove('hidden');
        overlay.classList.add('active', 'fullscreen', 'undocking');

        // Open from fullscreen
        setTimeout(() => overlay.classList.remove('fullscreen'), 400);

        // Bars retract
        setTimeout(() => overlay.classList.remove('active'), 1000);

        // Cleanup
        setTimeout(() => {
            overlay.classList.remove('undocking');
            overlay.classList.add('hidden');
            onComplete?.();
        }, 1600);
    }

    /**
     * Update shop panel content
     */
    updateShopPanel(station) {
        // Ships and Equipment tabs handled by StationVendorManager
        this.vendorManager.renderShips();
        this.vendorManager.renderEquipment();

        // Repair cost (still handled here)
        const repairCost = station.getRepairCost(this.game.player);
        document.getElementById('repair-options').innerHTML = `
            <div class="shop-item">
                <div class="item-info">
                    <div class="item-name">Full Repair</div>
                    <div class="item-desc">Restore all shield, armor, and hull</div>
                </div>
                <div class="item-price">${formatCredits(repairCost)} ISK</div>
                <button class="buy-btn" onclick="game.ui.repairShip()">REPAIR</button>
            </div>
        `;
    }

    /**
     * Update refinery tab with cargo ore contents
     */
    updateRefineryTab() {
        const player = this.game.player;
        if (!player) return;

        const oreList = document.getElementById('refinery-ore-list');
        const totalDisplay = document.getElementById('refinery-total');
        const sellBtn = document.getElementById('sell-all-ore-btn');

        if (!oreList || !totalDisplay) return;

        // Get ore from cargo
        const cargo = player.cargo || {};
        const oreTypes = Object.entries(cargo).filter(([type, data]) => data.units > 0);

        if (oreTypes.length === 0) {
            oreList.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">No ore in cargo hold</div>';
            totalDisplay.innerHTML = `
                <span class="label">TOTAL VALUE</span>
                <span class="value">0 ISK</span>
            `;
            if (sellBtn) sellBtn.disabled = true;
            return;
        }

        // Build ore list HTML
        let totalValue = 0;
        const html = oreTypes.map(([type, data]) => {
            const config = CONFIG.ASTEROID_TYPES[type] || { name: type, value: 10 };
            const value = data.units * config.value;
            totalValue += value;

            return `
                <div class="refinery-ore-item">
                    <div class="refinery-ore-info">
                        <div class="refinery-ore-name">${config.name}</div>
                        <div class="refinery-ore-amount">${data.units.toLocaleString()} units (${data.volume.toFixed(1)} m³)</div>
                    </div>
                    <div class="refinery-ore-value">${formatCredits(value)} ISK</div>
                </div>
            `;
        }).join('');

        oreList.innerHTML = html;
        totalDisplay.innerHTML = `
            <span class="label">TOTAL VALUE</span>
            <span class="value">${formatCredits(totalValue)} ISK</span>
        `;

        if (sellBtn) sellBtn.disabled = false;

        // Show ingot conversion preview
        const refineBtn = document.getElementById('refine-all-ore-btn');
        const ingotPreview = document.getElementById('refinery-ingot-preview');
        const conversions = CONFIG.REFINERY_CONVERSIONS;
        if (ingotPreview && conversions) {
            let hasConversion = false;
            let previewHtml = '<div class="ingot-preview-title">REFINE PREVIEW</div>';
            for (const [type, data] of oreTypes) {
                const conv = conversions[type];
                if (!conv) continue;
                const ingotAmount = Math.floor(data.units * conv.rate);
                if (ingotAmount <= 0) continue;
                hasConversion = true;
                previewHtml += `<div class="ingot-preview-row">
                    <span class="ingot-ore">${data.units} ${type}</span>
                    <span class="ingot-arrow">\u2192</span>
                    <span class="ingot-result">${ingotAmount} ${conv.name}</span>
                </div>`;
            }
            ingotPreview.innerHTML = hasConversion ? previewHtml : '';
            if (refineBtn) refineBtn.disabled = !hasConversion;
        }
    }

    /**
     * Repair ship at station
     */
    repairShip() {
        const station = this.game.dockedAt;
        if (!station || !this.game.player) return;

        if (station.repairShip(this.game.player)) {
            this.log('Ship fully repaired', 'system');
            this.toast('Ship repaired!', 'success');
            this.game.audio?.play('repair');
            this.updateShopPanel(station);

            // Repair flash animation on ship indicator
            const indicator = document.getElementById('ship-indicator');
            if (indicator) {
                indicator.classList.add('repair-flash');
                setTimeout(() => indicator.classList.remove('repair-flash'), 1500);
            }
        } else {
            this.toast('Not enough credits', 'warning');
        }
    }

    /**
     * Sell all ore in cargo hold
     */
    sellAllOre() {
        const player = this.game.player;
        if (!player || !player.cargo) return;

        let totalValue = 0;
        let totalUnits = 0;

        // Calculate total value and clear cargo
        for (const [type, data] of Object.entries(player.cargo)) {
            if (data.units > 0) {
                const config = CONFIG.ASTEROID_TYPES[type] || { value: 10 };
                totalValue += data.units * config.value;
                totalUnits += data.units;
            }
        }

        if (totalValue === 0) {
            this.log('No ore to sell', 'system');
            return;
        }

        // Notify guild system of ore sold BEFORE clearing cargo
        for (const [type, data] of Object.entries(player.cargo)) {
            if (data.units > 0) {
                this.game.guildSystem?.onOreSold(type, data.units);
            }
        }

        // Clear cargo
        player.cargo = {};
        player.cargoUsed = 0;

        // Add credits
        this.game.addCredits(totalValue);

        // Award trade XP
        this.game.skillSystem?.onTrade(totalValue);

        // Log and feedback
        this.log(`Sold ${totalUnits.toLocaleString()} units of ore for ${formatCredits(totalValue)} ISK`, 'mining');
        this.toast(`Sold ore for ${formatCredits(totalValue)} ISK`, 'success');
        this.game.audio?.play('sell');
        // Floating credit popup
        this.showCreditPopup(totalValue, window.innerWidth / 2, window.innerHeight / 2, 'gain');
        // Ship log
        this.addShipLogEntry(`Sold ore for ${formatCredits(totalValue)} ISK`, 'trade');

        // Update display
        this.updateRefineryTab();
    }

    /**
     * Refine all ore into ingots using REFINERY_CONVERSIONS
     */
    refineAllOre() {
        const player = this.game.player;
        if (!player || !player.cargo) return;

        const conversions = CONFIG.REFINERY_CONVERSIONS;
        if (!conversions) {
            this.toast('Refinery conversions not configured', 'error');
            return;
        }

        let totalRefined = 0;
        const results = [];

        for (const [oreType, data] of Object.entries(player.cargo)) {
            if (data.units <= 0) continue;
            const conv = conversions[oreType];
            if (!conv) continue;

            const ingotAmount = Math.floor(data.units * conv.rate);
            if (ingotAmount <= 0) continue;

            // Add ingots to materials
            if (!player.materials) player.materials = {};
            if (!player.materials[conv.material]) {
                player.materials[conv.material] = 0;
            }
            player.materials[conv.material] += ingotAmount;

            results.push({ ore: oreType, units: data.units, ingot: conv.name, amount: ingotAmount });
            totalRefined += data.units;
        }

        if (totalRefined === 0) {
            this.toast('No refinable ore in cargo', 'warning');
            return;
        }

        // Clear refined ore from cargo
        for (const r of results) {
            delete player.cargo[r.ore];
        }
        // Recalculate cargo used
        let used = 0;
        for (const data of Object.values(player.cargo)) {
            used += data.volume || 0;
        }
        player.cargoUsed = used;

        // Log results
        const summary = results.map(r => `${r.amount} ${r.ingot}`).join(', ');
        this.log(`Refined ${totalRefined.toLocaleString()} units of ore into ${summary}`, 'mining');
        this.toast(`Refined ore into ingots!`, 'success');
        this.game.audio?.play('scan-complete');
        this.addShipLogEntry(`Refined ore: ${summary}`, 'industry');

        // Emit event for Skippy etc
        this.game.events?.emit('refinery:complete', { results, totalRefined });

        this.updateRefineryTab();
    }

    /**
     * Update insurance tab content
     */
    updateInsuranceTab() {
        const container = document.getElementById('insurance-content');
        if (!container) return;

        const game = this.game;
        const player = game.player;
        const shipId = player?.shipClass || 'frigate';
        const shipData = SHIP_DATABASE[shipId];
        const shipName = shipData?.name || 'Unknown Ship';
        const shipValue = shipData?.price || 5000;
        const tiers = game.constructor.INSURANCE_TIERS;
        const current = game.insurance;

        let html = `<div class="insurance-panel">`;

        // Current status
        html += `<div class="insurance-status">`;
        html += `<div class="insurance-ship-info">`;
        html += `<span class="insurance-label">INSURED VESSEL</span>`;
        html += `<span class="insurance-ship-name">${shipName}</span>`;
        html += `<span class="insurance-ship-value">Hull Value: ${formatCredits(shipValue)} ISK</span>`;
        html += `</div>`;

        if (current.active) {
            const payout = Math.floor(shipValue * current.payoutRate);
            const matchesShip = current.shipInsured === shipId;
            html += `<div class="insurance-active-badge${matchesShip ? '' : ' insurance-mismatch'}">`;
            html += `<span class="insurance-tier-name">${current.tierName} Coverage</span>`;
            html += `<span class="insurance-payout">Payout: ${formatCredits(payout)} ISK (${Math.round(current.payoutRate * 100)}%)</span>`;
            if (!matchesShip) {
                const insuredName = SHIP_DATABASE[current.shipInsured]?.name || current.shipInsured;
                html += `<span class="insurance-warning">Insured for: ${insuredName} (switch ships to match)</span>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="insurance-inactive-badge">`;
            html += `<span>NO ACTIVE COVERAGE</span>`;
            html += `<span class="insurance-warning-text">Ship loss will not be compensated</span>`;
            html += `</div>`;
        }
        html += `</div>`;

        // Tier cards
        html += `<div class="insurance-tiers">`;
        for (const [tierId, tier] of Object.entries(tiers)) {
            const premium = Math.floor(shipValue * tier.premiumRate);
            const payout = Math.floor(shipValue * tier.payoutRate);
            const isActive = current.active && current.tier === tierId && current.shipInsured === shipId;
            const canAfford = game.credits >= premium;
            const profit = payout - premium;

            html += `<div class="insurance-tier-card${isActive ? ' active' : ''}">`;
            html += `<div class="tier-header tier-${tierId}">${tier.name}</div>`;
            html += `<div class="tier-body">`;
            html += `<div class="tier-stat"><span>Premium</span><span class="tier-cost">${formatCredits(premium)} ISK</span></div>`;
            html += `<div class="tier-stat"><span>Payout</span><span class="tier-payout">${formatCredits(payout)} ISK</span></div>`;
            html += `<div class="tier-stat"><span>Coverage</span><span>${Math.round(tier.payoutRate * 100)}%</span></div>`;
            html += `<div class="tier-stat"><span>Net Gain</span><span class="${profit > 0 ? 'tier-profit' : 'tier-loss'}">${profit > 0 ? '+' : ''}${formatCredits(profit)} ISK</span></div>`;

            if (isActive) {
                html += `<button class="buy-btn insurance-btn" disabled>ACTIVE</button>`;
            } else {
                html += `<button class="buy-btn insurance-btn${canAfford ? '' : ' disabled'}" ${canAfford ? '' : 'disabled'} data-insurance-tier="${tierId}">PURCHASE</button>`;
            }

            html += `</div></div>`;
        }
        html += `</div>`;

        // Info text
        html += `<div class="insurance-info">`;
        html += `<p>Insurance provides a one-time ISK payout when your ship is destroyed. Coverage is consumed on death and must be repurchased.</p>`;
        html += `<p>Switching ships does not transfer coverage. Insure your current vessel before undocking.</p>`;
        html += `</div>`;

        html += `</div>`;
        container.innerHTML = html;

        // Add click handlers
        container.querySelectorAll('[data-insurance-tier]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tier = btn.dataset.insuranceTier;
                if (game.purchaseInsurance(tier)) {
                    this.updateInsuranceTab();
                    this.game.audio?.play('quest-accept');
                }
            });
        });
    }

    /**
     * Update skills tab content
     */
    updateSkillsTab() {
        const container = document.getElementById('skills-content');
        if (!container) return;

        const skillSystem = this.game.skillSystem;
        if (!skillSystem) {
            container.innerHTML = '<div class="skills-empty">Skills not available</div>';
            return;
        }

        const skills = skillSystem.getAllSkills();
        let html = `<div class="skills-panel">`;
        html += `<div class="skills-header">PILOT SKILLS</div>`;

        for (const s of skills) {
            const pctFill = Math.floor(s.progress * 100);
            const levelDots = Array.from({ length: 5 }, (_, i) =>
                `<span class="skill-dot ${i < s.level ? 'filled' : ''}" style="${i < s.level ? `background:${s.color}` : ''}"></span>`
            ).join('');

            let bonusText = '';
            for (const perk of s.perLevel) {
                const totalVal = (perk.value * s.level * 100).toFixed(0);
                bonusText += `<span class="skill-bonus-line">${perk.label.replace(/\+\d+%/, `+${totalVal}%`)}</span>`;
            }

            // Specialization bonuses (levels 3+)
            let specHtml = '';
            if (s.specName) {
                specHtml = `<div class="skill-spec-badge" style="color:${s.color}">${s.specName}</div>`;
            } else if (s.canSpecialize) {
                const specEntries = Object.entries(s.specializations || {});
                specHtml = `<div class="skill-spec-choose">`;
                specHtml += `<div class="skill-spec-prompt">Choose Specialization:</div>`;
                for (const [key, spec] of specEntries) {
                    specHtml += `<button class="skill-spec-btn" data-skill="${s.id}" data-spec="${key}" style="border-color:${s.color}">`;
                    specHtml += `<strong>${spec.name}</strong><br><small>${spec.description}</small>`;
                    specHtml += `<br><em>${spec.perLevel.map(p => p.label).join(', ')}</em>`;
                    specHtml += `</button>`;
                }
                specHtml += `</div>`;
            }

            html += `<div class="skill-card" style="border-left: 3px solid ${s.color}">`;
            html += `<div class="skill-card-top">`;
            html += `<span class="skill-icon" style="color:${s.color}">${s.icon}</span>`;
            html += `<div class="skill-info">`;
            html += `<div class="skill-name">${s.name} <span class="skill-level">Lv.${s.level}</span></div>`;
            html += `<div class="skill-desc">${s.description}</div>`;
            html += `</div>`;
            html += `<div class="skill-dots">${levelDots}</div>`;
            html += `</div>`;
            html += `<div class="skill-xp-bar-outer">`;
            html += `<div class="skill-xp-bar-inner" style="width:${pctFill}%;background:${s.color}"></div>`;
            html += `</div>`;
            html += `<div class="skill-card-bottom">`;
            html += `<span class="skill-xp-text">${s.maxed ? 'MAX' : `${s.xp.toLocaleString()} / ${s.nextXP.toLocaleString()} XP`}</span>`;
            html += `<span class="skill-bonuses">${bonusText}</span>`;
            html += `</div>`;
            html += specHtml;
            html += `</div>`;
        }

        // Add click handlers for spec buttons after render
        html += `</div>`;
        container.innerHTML = html;

        container.querySelectorAll('.skill-spec-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const skillId = btn.dataset.skill;
                const specKey = btn.dataset.spec;
                skillSystem.chooseSpecialization(skillId, specKey);
                this.updateSkillsTab();
            });
        });
    }

    /**
     * Toggle keyboard shortcuts overlay
     */
    toggleKeybindOverlay() {
        const overlay = document.getElementById('keybind-overlay');
        if (!overlay) return;

        if (overlay.classList.contains('hidden')) {
            // Build content from keybindings
            const grid = document.getElementById('keybind-grid');
            if (grid) {
                const categories = keyBindings.getBindingsByCategory();
                // Add extra entries not in KeyBindings
                if (!categories['Drones']) categories['Drones'] = [];
                categories['Drones'].push(
                    { description: 'Deploy/Recall Drones', key: 'UI button', action: 'drones' },
                );
                if (!categories['Fleet']) categories['Fleet'] = [];
                categories['Fleet'].push(
                    { description: 'Assign Control Group', key: 'ctrl+Digit1..5', action: 'fleetGroup' },
                    { description: 'Command Group', key: 'Digit1..5', action: 'fleetCmd' },
                );

                grid.innerHTML = Object.entries(categories).map(([cat, bindings]) => `
                    <div class="keybind-category">
                        <div class="keybind-category-title">${cat}</div>
                        ${bindings.map(b => `
                            <div class="keybind-entry">
                                <span class="keybind-desc">${b.description}</span>
                                <span class="keybind-key">${keyBindings.keyToDisplay(b.key)}</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('');
            }

            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Toggle D-Scan panel
     */
    toggleDScan() {
        this.elements.dscanPanel.classList.toggle('hidden');
    }

    /**
     * Add entry to ship log
     */
    addShipLogEntry(message, category = 'system', icon = null) {
        const ICONS = {
            combat: '\u2694',
            trade: '\u2696',
            nav: '\u26A1',
            quest: '\u2605',
            system: '\u2699',
            skill: '\u2B50',
        };

        const entry = {
            time: Date.now(),
            message,
            category,
            icon: icon || ICONS[category] || '\u2022',
        };

        this.shipLog.unshift(entry);
        if (this.shipLog.length > this.maxShipLogEntries) {
            this.shipLog.pop();
        }

        // Debounced save
        clearTimeout(this._shipLogSaveTimer);
        this._shipLogSaveTimer = setTimeout(() => this.saveShipLog(), 5000);

        // Update panel if visible
        const panel = document.getElementById('ship-log-panel');
        if (panel && !panel.classList.contains('hidden')) {
            this.renderShipLog();
        }
    }

    /**
     * Toggle ship log panel
     */
    toggleShipLog() {
        const panel = document.getElementById('ship-log-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.renderShipLog();
            this.game.panelDragManager?.onPanelShown('ship-log-panel');
        }
    }

    /**
     * Render ship log entries
     */
    renderShipLog() {
        const container = document.getElementById('ship-log-entries');
        if (!container) return;

        const filtered = this.shipLogFilter === 'all'
            ? this.shipLog
            : this.shipLog.filter(e => e.category === this.shipLogFilter);

        if (filtered.length === 0) {
            container.innerHTML = '<div class="ship-log-empty">No entries</div>';
            return;
        }

        let html = '';
        for (const entry of filtered.slice(0, 50)) {
            const ago = this.formatTimeAgo(entry.time);
            html += `<div class="ship-log-entry ship-log-${entry.category}">`;
            html += `<span class="ship-log-icon">${entry.icon}</span>`;
            html += `<span class="ship-log-msg">${entry.message}</span>`;
            html += `<span class="ship-log-time">${ago}</span>`;
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    formatTimeAgo(timestamp) {
        const diff = Math.floor((Date.now() - timestamp) / 1000);
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    }

    saveShipLog() {
        try {
            localStorage.setItem('expedition-ship-log', JSON.stringify(this.shipLog.slice(0, 50)));
        } catch (e) { /* storage full */ }
    }

    loadShipLog() {
        try {
            const data = localStorage.getItem('expedition-ship-log');
            if (data) return JSON.parse(data);
        } catch (e) { /* corrupt */ }
        return [];
    }

    // =========================================
    // Combat Log
    // =========================================

    /**
     * Add detailed combat log entry
     */
    addCombatLogEntry(data) {
        const entry = {
            time: Date.now(),
            type: data.type,         // 'hit', 'miss', 'kill', 'death'
            direction: 'neutral',    // 'outgoing', 'incoming', 'neutral'
            sourceName: data.source?.name || 'Unknown',
            targetName: data.target?.name || 'Unknown',
            damage: data.damage || 0,
            damageType: data.damageType || '',
            weapon: data.weapon || '',
            hitChance: data.hitChance || 0,
            bounty: data.bounty || 0,
        };

        const player = this.game.player;
        if (data.source === player) entry.direction = 'outgoing';
        else if (data.target === player) entry.direction = 'incoming';

        // Update stats
        if (data.type === 'hit') {
            if (entry.direction === 'outgoing') {
                this.combatLogStats.totalDealt += data.damage;
                this.combatLogStats.hits++;
            } else if (entry.direction === 'incoming') {
                this.combatLogStats.totalTaken += data.damage;
            }
        } else if (data.type === 'miss') {
            if (entry.direction === 'outgoing') {
                this.combatLogStats.misses++;
            }
        } else if (data.type === 'kill') {
            this.combatLogStats.kills++;
        } else if (data.type === 'death') {
            this.combatLogStats.deaths++;
        }

        this.combatLog.unshift(entry);
        if (this.combatLog.length > this.maxCombatLogEntries) {
            this.combatLog.pop();
        }

        // Update panel if visible
        const panel = document.getElementById('combat-log-panel');
        if (panel && !panel.classList.contains('hidden')) {
            this.renderCombatLog();
        }
    }

    /**
     * Toggle combat log panel
     */
    toggleCombatLog() {
        const panel = document.getElementById('combat-log-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.renderCombatLog();
            this.game.panelDragManager?.onPanelShown('combat-log-panel');
        }
    }

    /**
     * Render combat log panel
     */
    renderCombatLog() {
        const summary = document.getElementById('combat-log-summary');
        const container = document.getElementById('combat-log-entries');
        if (!container) return;

        // Summary bar
        if (summary) {
            const s = this.combatLogStats;
            const accuracy = s.hits + s.misses > 0
                ? Math.round((s.hits / (s.hits + s.misses)) * 100) : 0;
            summary.innerHTML = `
                <div class="clog-stat">
                    <div class="clog-stat-label">DEALT</div>
                    <div class="clog-stat-value out">${this.formatCompact(s.totalDealt)}</div>
                </div>
                <div class="clog-stat">
                    <div class="clog-stat-label">TAKEN</div>
                    <div class="clog-stat-value in">${this.formatCompact(s.totalTaken)}</div>
                </div>
                <div class="clog-stat">
                    <div class="clog-stat-label">KILLS</div>
                    <div class="clog-stat-value kills">${s.kills}</div>
                </div>
                <div class="clog-stat">
                    <div class="clog-stat-label">ACCURACY</div>
                    <div class="clog-stat-value accuracy">${accuracy}%</div>
                </div>
            `;
        }

        // Filter entries
        let filtered = this.combatLog;
        if (this.combatLogFilter === 'outgoing') {
            filtered = filtered.filter(e => e.direction === 'outgoing');
        } else if (this.combatLogFilter === 'incoming') {
            filtered = filtered.filter(e => e.direction === 'incoming');
        } else if (this.combatLogFilter === 'kills') {
            filtered = filtered.filter(e => e.type === 'kill' || e.type === 'death');
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="clog-empty">No combat events recorded</div>';
            return;
        }

        let html = '';
        for (const entry of filtered.slice(0, 80)) {
            const ago = this.formatTimeAgo(entry.time);
            const cls = this.getCombatLogEntryClass(entry);
            const icon = this.getCombatLogIcon(entry);
            const msg = this.getCombatLogMessage(entry);
            const dmg = entry.type === 'kill'
                ? (entry.bounty > 0 ? `+${entry.bounty}` : '')
                : (entry.damage > 0 ? `-${Math.floor(entry.damage)}` : '');

            html += `<div class="clog-entry ${cls}">`;
            html += `<span class="clog-time">${ago}</span>`;
            html += `<span class="clog-icon">${icon}</span>`;
            html += `<span class="clog-msg">${msg}</span>`;
            if (dmg) html += `<span class="clog-dmg">${dmg}</span>`;
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    getCombatLogEntryClass(entry) {
        if (entry.type === 'kill') return 'kill';
        if (entry.type === 'death') return 'death';
        if (entry.type === 'miss') return `miss ${entry.direction}`;
        return `${entry.direction} ${entry.damageType}`;
    }

    getCombatLogIcon(entry) {
        if (entry.type === 'kill') return '\u2620';     // skull
        if (entry.type === 'death') return '\u2620';
        if (entry.type === 'miss') return '\u25CB';      // circle
        if (entry.direction === 'outgoing') return '\u25B6'; // right arrow
        return '\u25C0';  // left arrow
    }

    getCombatLogMessage(entry) {
        if (entry.type === 'kill') {
            return `Destroyed ${entry.targetName}`;
        }
        if (entry.type === 'death') {
            return `Destroyed by ${entry.sourceName}`;
        }
        if (entry.type === 'miss') {
            if (entry.direction === 'outgoing') {
                return `${entry.weapon} missed ${entry.targetName}`;
            }
            return `${entry.sourceName} missed you`;
        }
        // hit
        if (entry.direction === 'outgoing') {
            return `${entry.weapon} hit ${entry.targetName}`;
        }
        return `${entry.sourceName} hit you`;
    }

    formatCompact(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return Math.floor(n).toString();
    }

    /**
     * Toggle achievements panel
     */
    toggleAchievements() {
        const panel = document.getElementById('achievements-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.updateAchievementsPanel();
            this.game.panelDragManager?.onPanelShown('achievements-panel');
        }
    }

    /**
     * Update achievements panel content
     */
    updateAchievementsPanel() {
        const container = document.getElementById('achievements-content');
        if (!container) return;

        const system = this.game.achievementSystem;
        if (!system) return;

        const cats = system.getByCategory();
        const unlocked = system.getUnlockedCount();
        const total = system.getTotalCount();

        let html = `<div class="achievements-summary">${unlocked} / ${total} Unlocked</div>`;

        for (const [category, achievements] of Object.entries(cats)) {
            html += `<div class="achievement-category">`;
            html += `<div class="achievement-category-title">${category}</div>`;

            for (const a of achievements) {
                const cls = a.unlocked ? 'achievement-card unlocked' : 'achievement-card locked';
                html += `<div class="${cls}">`;
                html += `<span class="achievement-icon">${a.unlocked ? a.icon : '\u2753'}</span>`;
                html += `<div class="achievement-info">`;
                html += `<div class="achievement-name">${a.unlocked ? a.name : '???'}</div>`;
                html += `<div class="achievement-desc">${a.desc}</div>`;
                html += `</div>`;
                if (a.unlocked) {
                    html += `<span class="achievement-check">\u2713</span>`;
                }
                html += `</div>`;
            }

            html += `</div>`;
        }

        container.innerHTML = html;
    }

    /**
     * Toggle statistics panel
     */
    toggleStats() {
        const panel = document.getElementById('stats-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.updateStatsPanel();
        }
    }

    /**
     * Update statistics panel content
     */
    updateStatsPanel() {
        const container = document.getElementById('stats-content');
        if (!container) return;

        const s = this.game.stats;
        // Calculate live play time
        const totalSeconds = Math.floor(s.playTime + (Date.now() - s.sessionStart) / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${secs}s`;

        const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toString();

        let html = `<div class="stats-grid">`;
        html += `<div class="stat-section"><div class="stat-section-title">COMBAT</div>`;
        html += `<div class="stat-row"><span>Kills</span><span class="stat-val">${s.kills}</span></div>`;
        html += `<div class="stat-row"><span>Deaths</span><span class="stat-val">${s.deaths}</span></div>`;
        html += `<div class="stat-row"><span>K/D Ratio</span><span class="stat-val">${kd}</span></div>`;
        html += `<div class="stat-row"><span>Damage Dealt</span><span class="stat-val">${formatCredits(Math.floor(s.damageDealt))}</span></div>`;
        html += `<div class="stat-row"><span>Damage Taken</span><span class="stat-val">${formatCredits(Math.floor(s.damageTaken))}</span></div>`;
        html += `<div class="stat-row"><span>Bounty Earned</span><span class="stat-val">${formatCredits(s.bountyEarned)} ISK</span></div>`;
        html += `</div>`;

        html += `<div class="stat-section"><div class="stat-section-title">INDUSTRY</div>`;
        html += `<div class="stat-row"><span>Ore Mined</span><span class="stat-val">${s.oreMined.toLocaleString()} units</span></div>`;
        html += `</div>`;

        html += `<div class="stat-section"><div class="stat-section-title">NAVIGATION</div>`;
        html += `<div class="stat-row"><span>Gate Jumps</span><span class="stat-val">${s.jumps}</span></div>`;
        html += `<div class="stat-row"><span>Sectors Visited</span><span class="stat-val">${s.sectorsVisited.length} / 7</span></div>`;
        html += `<div class="stat-row"><span>Play Time</span><span class="stat-val">${timeStr}</span></div>`;
        html += `</div>`;

        // Kill breakdown
        const killTypes = Object.entries(s.killsByType).sort((a, b) => b[1] - a[1]);
        if (killTypes.length > 0) {
            html += `<div class="stat-section"><div class="stat-section-title">KILL BREAKDOWN</div>`;
            for (const [type, count] of killTypes.slice(0, 8)) {
                const name = type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                html += `<div class="stat-row"><span>${name}</span><span class="stat-val">${count}</span></div>`;
            }
            html += `</div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    /**
     * Toggle bookmarks panel
     */
    toggleBookmarks() {
        this.elements.bookmarksPanel.classList.toggle('hidden');
        this.updateBookmarksList();
    }

    /**
     * Update bookmarks list
     */
    updateBookmarksList() {
        const container = document.getElementById('bookmark-list');
        if (!container) return;

        const html = this.game.bookmarks.map(bm => `
            <div class="bookmark-item" onclick="game.ui.warpToBookmark(${bm.id})">
                <span class="bookmark-name">${bm.name}</span>
                <button class="bookmark-delete" onclick="event.stopPropagation(); game.ui.deleteBookmark(${bm.id})">&times;</button>
            </div>
        `).join('');

        container.innerHTML = html || '<div class="empty-state"><div class="empty-state-icon">\u2606</div><div class="empty-state-title">No Bookmarks</div><div class="empty-state-hint">Right-click in space to save a location</div></div>';
    }

    /**
     * Perform directional scan
     */
    performDScan() {
        const range = this.dscanRange;
        const angle = this.dscanAngle;

        const player = this.game.player;
        if (!player) return;

        // Button flash animation
        const scanBtn = document.getElementById('dscan-scan');
        if (scanBtn) {
            scanBtn.classList.remove('scanning');
            void scanBtn.offsetWidth; // Force reflow
            scanBtn.classList.add('scanning');
        }

        // Play scan sound
        this.game.audio?.play('scan');

        // Get all entities in range
        const entities = this.game.currentSector.getEntitiesInRadius(player.x, player.y, range);

        // Filter by directional cone angle
        const halfAngle = (angle / 2) * (Math.PI / 180);
        const playerHeading = player.rotation;

        const results = entities.filter(e => {
            if (e === player) return false;
            if (!e.alive) return false;

            // 360 degree scan includes everything
            if (angle >= 360) return true;

            // Calculate angle from player to entity
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const angleToEntity = Math.atan2(dy, dx);

            // Angular difference (shortest path)
            let diff = angleToEntity - playerHeading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            return Math.abs(diff) <= halfAngle;
        });

        // Sort by distance
        results.sort((a, b) => player.distanceTo(a) - player.distanceTo(b));

        // Count by type
        const counts = {};
        for (const e of results) {
            const t = e.type === 'npc' ? 'ship' : e.type;
            counts[t] = (counts[t] || 0) + 1;
        }

        // Update summary
        const summaryEl = document.getElementById('dscan-summary');
        if (summaryEl) {
            const parts = Object.entries(counts).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`);
            summaryEl.textContent = results.length > 0
                ? `${results.length} results: ${parts.join(', ')}`
                : 'No objects detected';
        }

        // Build results table
        const html = results.map(e => {
            const dist = formatDistance(player.distanceTo(e));
            const icon = this.getEntityIcon(e);
            const type = e.type === 'npc' ? e.role : e.type;
            const hostClass = e.hostility === 'hostile' ? 'dscan-hostile' :
                e.hostility === 'friendly' ? 'dscan-friendly' : '';

            return `<tr class="${hostClass}" data-entity-id="${e.id}">
                <td class="dscan-icon">${icon}</td>
                <td class="dscan-name">${e.name}</td>
                <td class="dscan-type">${type}</td>
                <td class="dscan-dist">${dist}</td>
            </tr>`;
        }).join('');

        const resultsEl = document.getElementById('dscan-results');
        if (resultsEl) {
            if (html) {
                resultsEl.innerHTML = html;
            } else {
                resultsEl.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">\u{1F4E1}</div><div class="empty-state-title">No Objects Detected</div><div class="empty-state-hint">Try a wider scan angle or range</div></div></td></tr>';
            }
        }

        // Make rows clickable to select entities
        resultsEl?.querySelectorAll('tr[data-entity-id]').forEach(row => {
            row.addEventListener('click', () => {
                const entity = this.findEntityById(row.dataset.entityId);
                if (entity) this.game.selectTarget(entity);
            });
        });

        // Trigger minimap scan pulse
        this.scanPulse = {
            startTime: performance.now(),
            duration: 1500,
            range: range,
            entityPositions: results.map(e => ({
                dx: e.x - player.x,
                dy: e.y - player.y,
                type: e.type,
                hostile: e.hostility === 'hostile' || e.type === 'enemy',
            })),
            counts,
        };

        // Spawn visual cone effect
        this.spawnDScanCone(range, angle, player);

        // Expanding scan probe rings in 3D
        const effects = this.game.renderer?.effects;
        if (effects) {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    effects.spawn('explosion', player.x, player.y, {
                        count: 16,
                        color: 0x00ddff,
                        speed: 200 + i * 100,
                        size: 2,
                        life: 0.6,
                    });
                }, i * 150);
            }
        }
    }

    /**
     * Spawn a visual D-Scan cone in the game world
     */
    spawnDScanCone(range, angleDeg, player) {
        if (!this.game.renderer?.effects) return;

        // Use the effects system to create a temporary cone
        const effects = this.game.renderer.effects;
        const heading = player.rotation;
        const halfAngle = (angleDeg / 2) * (Math.PI / 180);

        if (angleDeg >= 360) {
            // Full circle scan ring
            const ringGeo = new THREE.RingGeometry(range * 0.98, range, 64);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(player.x, player.y, 2);
            effects.group.add(ring);

            // Fade out over 1.5s
            const startTime = performance.now();
            const cleanup = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > 1.5) {
                    effects.group.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                    return;
                }
                ring.material.opacity = 0.15 * (1 - elapsed / 1.5);
                ring.position.set(player.x, player.y, 2);
                requestAnimationFrame(cleanup);
            };
            requestAnimationFrame(cleanup);
        } else {
            // Directional cone
            const segments = 32;
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);

            for (let i = 0; i <= segments; i++) {
                const a = heading - halfAngle + (halfAngle * 2 * i / segments);
                shape.lineTo(Math.cos(a) * range, Math.sin(a) * range);
            }
            shape.lineTo(0, 0);

            const coneGeo = new THREE.ShapeGeometry(shape);
            const coneMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.set(player.x, player.y, 2);

            // Cone edge lines
            const edgePoints = [
                new THREE.Vector3(0, 0, 2),
                new THREE.Vector3(Math.cos(heading - halfAngle) * range, Math.sin(heading - halfAngle) * range, 2),
            ];
            const edgePoints2 = [
                new THREE.Vector3(0, 0, 2),
                new THREE.Vector3(Math.cos(heading + halfAngle) * range, Math.sin(heading + halfAngle) * range, 2),
            ];
            const edgeMat = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.25,
                depthWrite: false,
            });
            const edge1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints), edgeMat);
            const edge2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints2), edgeMat.clone());
            edge1.position.set(player.x, player.y, 0);
            edge2.position.set(player.x, player.y, 0);

            effects.group.add(cone);
            effects.group.add(edge1);
            effects.group.add(edge2);

            // Fade out
            const startTime = performance.now();
            const cleanup = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > 1.5) {
                    effects.group.remove(cone);
                    effects.group.remove(edge1);
                    effects.group.remove(edge2);
                    cone.geometry.dispose();
                    cone.material.dispose();
                    edge1.geometry.dispose();
                    edge1.material.dispose();
                    edge2.geometry.dispose();
                    edge2.material.dispose();
                    return;
                }
                const fade = 1 - elapsed / 1.5;
                cone.material.opacity = 0.08 * fade;
                edge1.material.opacity = 0.25 * fade;
                edge2.material.opacity = 0.25 * fade;
                requestAnimationFrame(cleanup);
            };
            requestAnimationFrame(cleanup);
        }
    }

    /**
     * Find entity by ID
     */
    findEntityById(id) {
        return this.game.getVisibleEntities().find(e => e.id === id);
    }

    /**
     * Show settings panel
     */
    showSettings() {
        this.elements.settingsPanel?.classList.remove('hidden');
        this.updateKeybindingsPanel();
    }

    /**
     * Hide settings panel
     */
    hideSettings() {
        this.elements.settingsPanel?.classList.add('hidden');
        this.game.input?.cancelRebind();
    }

    /**
     * Toggle settings panel
     */
    toggleSettings() {
        if (this.elements.settingsPanel?.classList.contains('hidden')) {
            this.showSettings();
        } else {
            this.hideSettings();
        }
        this.game.audio?.play('click');
    }

    /**
     * Update keybindings panel with current bindings
     */
    updateKeybindingsPanel() {
        const container = this.elements.keybindingsList;
        if (!container) return;

        const categories = keyBindings.getBindingsByCategory();
        let html = '';

        for (const [category, bindings] of Object.entries(categories)) {
            html += `<div class="keybinding-category">
                <div class="keybinding-category-title">${category}</div>`;

            for (const binding of bindings) {
                const displayKey = keyBindings.keyToDisplay(binding.key);
                const isDefault = binding.isDefault ? '' : 'modified';

                html += `
                    <div class="keybinding-row ${isDefault}" data-action="${binding.action}">
                        <span class="keybinding-description">${binding.description}</span>
                        <span class="keybinding-key" title="Click to rebind">${displayKey}</span>
                        <button class="keybinding-reset" title="Reset to default">&olarr;</button>
                    </div>`;
            }

            html += '</div>';
        }

        container.innerHTML = html;

        // Add click handlers for rebinding
        container.querySelectorAll('.keybinding-key').forEach(keyEl => {
            keyEl.addEventListener('click', (e) => {
                const action = e.target.closest('.keybinding-row').dataset.action;
                this.game.input?.startRebind(action);
                this.game.audio?.play('click');
            });
        });

        // Add click handlers for reset buttons
        container.querySelectorAll('.keybinding-reset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.target.closest('.keybinding-row').dataset.action;
                keyBindings.resetBinding(action);
                this.updateKeybindingsPanel();
                this.game.audio?.play('click');
            });
        });
    }

    /**
     * Toggle overview panel
     */
    toggleOverview() {
        this.elements.overviewPanel?.classList.toggle('hidden');
    }

    /**
     * Toggle map (full-screen sector map)
     */
    toggleMap() {
        this.sectorMapManager?.toggle();
    }

    /**
     * Toggle Ship Menu (C key)
     */
    toggleShipMenu() {
        this.shipMenuManager?.toggle();
    }

    /**
     * Toggle Object Viewer panel
     */
    toggleObjectViewer() {
        this.elements.objectViewer?.classList.toggle('hidden');
    }

    /**
     * Toggle Performance Monitor panel
     */
    togglePerformanceMonitor() {
        this.performanceMonitor?.toggle();
    }

    /**
     * Toggle Model Editor (G key)
     */
    toggleModelEditor() {
        this.modelEditorManager?.toggle();
    }

    /**
     * Toggle Fleet Panel (F key)
     */
    toggleFleet() {
        this.fleetPanelManager?.toggle();
    }

    /**
     * Show Object Viewer panel
     */
    showObjectViewer() {
        this.elements.objectViewer?.classList.remove('hidden');
    }

    /**
     * Update Object Viewer panel content
     */
    updateObjectViewer() {
        const container = this.elements.objectViewerContent;
        if (!container) return;

        const selected = this.game.selectedTarget;
        const locked = this.game.lockedTarget;

        // If nothing selected, show placeholder
        if (!selected) {
            container.innerHTML = `
                <div class="viewer-placeholder">
                    Select an object to view details
                </div>
            `;
            return;
        }

        // Build the viewer content
        const isLocked = locked === selected;
        const player = this.game.player;
        const distance = player ? formatDistance(player.distanceTo(selected)) : '-';

        let html = `
            <div class="viewer-header">
                <div class="viewer-name">
                    ${selected.name}
                    ${isLocked ? '<span class="viewer-locked-badge">LOCKED</span>' : ''}
                </div>
                <div class="viewer-type">${selected.type}</div>
            </div>
        `;

        // Basic stats section (always shown)
        html += `
            <div class="viewer-section">
                <div class="viewer-section-title">Location</div>
                <div class="viewer-stat">
                    <span class="viewer-stat-label">Distance</span>
                    <span class="viewer-stat-value">${distance}</span>
                </div>
                <div class="viewer-stat">
                    <span class="viewer-stat-label">Position</span>
                    <span class="viewer-stat-value">${Math.floor(selected.x)}, ${Math.floor(selected.y)}</span>
                </div>
            </div>
        `;

        // If locked, show full stats dump
        if (isLocked) {
            html += this.buildLockedObjectStats(selected);
        }

        container.innerHTML = html;
    }

    /**
     * Build full stats for a locked object
     */
    buildLockedObjectStats(entity) {
        let html = '';
        const player = this.game.player;

        // Movement stats (if has velocity)
        if (entity.velocity) {
            const speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
            const heading = ((entity.rotation || 0) * 180 / Math.PI).toFixed(0);

            // Calculate angular velocity (how fast target is moving relative to player)
            let angularVelocity = '-';
            let transversal = '-';
            if (player) {
                const dist = player.distanceTo(entity);
                if (dist > 0) {
                    // Transversal velocity component
                    const dx = entity.x - player.x;
                    const dy = entity.y - player.y;
                    const angle = Math.atan2(dy, dx);
                    const relVelX = entity.velocity.x - (player.velocity?.x || 0);
                    const relVelY = entity.velocity.y - (player.velocity?.y || 0);
                    const transVel = Math.abs(
                        relVelX * Math.sin(angle) - relVelY * Math.cos(angle)
                    );
                    transversal = `${transVel.toFixed(0)} m/s`;
                    angularVelocity = `${((transVel / dist) * 1000).toFixed(2)} rad/s`;
                }
            }

            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Movement</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Speed</span>
                        <span class="viewer-stat-value">${speed.toFixed(0)} m/s</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Heading</span>
                        <span class="viewer-stat-value">${heading}&deg;</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Transversal</span>
                        <span class="viewer-stat-value">${transversal}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Angular Vel</span>
                        <span class="viewer-stat-value">${angularVelocity}</span>
                    </div>
                </div>
            `;
        }

        // Health stats (if ship)
        if (entity.shield !== undefined) {
            const health = entity.getHealthPercents?.() || { shield: 100, armor: 100, hull: 100 };

            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Defenses</div>
                    <div class="viewer-bars">
                        <div class="viewer-bar-row">
                            <span class="viewer-bar-label">Shield</span>
                            <div class="viewer-bar-container">
                                <div class="viewer-bar shield" style="width: ${health.shield}%"></div>
                            </div>
                        </div>
                        <div class="viewer-bar-row">
                            <span class="viewer-bar-label">Armor</span>
                            <div class="viewer-bar-container">
                                <div class="viewer-bar armor" style="width: ${health.armor}%"></div>
                            </div>
                        </div>
                        <div class="viewer-bar-row">
                            <span class="viewer-bar-label">Hull</span>
                            <div class="viewer-bar-container">
                                <div class="viewer-bar hull" style="width: ${health.hull}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Shield HP</span>
                        <span class="viewer-stat-value">${Math.floor(entity.shield)} / ${entity.maxShield}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Armor HP</span>
                        <span class="viewer-stat-value">${Math.floor(entity.armor)} / ${entity.maxArmor}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Hull HP</span>
                        <span class="viewer-stat-value">${Math.floor(entity.hull)} / ${entity.maxHull}</span>
                    </div>
                </div>
            `;
        }

        // Combat stats (if enemy)
        if (entity.type === 'enemy' || entity.hostility === 'hostile') {
            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Threat Assessment</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Hostility</span>
                        <span class="viewer-stat-value hostile">HOSTILE</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Ship Class</span>
                        <span class="viewer-stat-value">${entity.shipType || 'Unknown'}</span>
                    </div>
                </div>
            `;
        }

        // NPC info
        if (entity.type === 'npc') {
            const roleLabel = entity.role === 'miner' ? 'Mining Vessel' : 'Security Patrol';
            const stateLabel = {
                mining: 'Mining',
                returning: 'Returning to Station',
                docked: 'Docked',
                fleeing: 'Fleeing',
                patrol: 'Patrolling',
                responding: 'Responding to Threat',
                engaging: 'Engaging Hostile',
                idle: 'Idle',
            }[entity.aiState] || entity.aiState;
            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">NPC Information</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Role</span>
                        <span class="viewer-stat-value">${roleLabel}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Activity</span>
                        <span class="viewer-stat-value">${stateLabel}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Hostility</span>
                        <span class="viewer-stat-value friendly">NEUTRAL</span>
                    </div>
                </div>
            `;
        }

        // Asteroid composition (if asteroid)
        if (entity.type === 'asteroid') {
            const oreType = entity.oreType || 'Veldspar';
            const oreAmount = entity.oreAmount || 1000;
            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Composition</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Ore Type</span>
                        <span class="viewer-stat-value">${oreType}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Volume</span>
                        <span class="viewer-stat-value">${oreAmount.toLocaleString()} m&sup3;</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Radius</span>
                        <span class="viewer-stat-value">${entity.radius || 50}m</span>
                    </div>
                </div>
            `;
        }

        // Station services (if station)
        if (entity.type === 'station' || entity.type === 'player-station') {
            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Station Services</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Docking</span>
                        <span class="viewer-stat-value friendly">Available</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Repair</span>
                        <span class="viewer-stat-value friendly">Available</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Market</span>
                        <span class="viewer-stat-value friendly">Available</span>
                    </div>
                </div>
            `;
        }

        // Gate info (if gate)
        if (entity.type === 'gate') {
            const destination = entity.destinationSectorId || 'Unknown';
            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Gate Information</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Destination</span>
                        <span class="viewer-stat-value">${destination}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Status</span>
                        <span class="viewer-stat-value friendly">Online</span>
                    </div>
                </div>
            `;
        }

        // Loot container contents
        if (entity.type === 'loot') {
            const timeLeft = Math.max(0, entity.lifetime - entity.age);
            const minutes = Math.floor(timeLeft / 60);
            const seconds = Math.floor(timeLeft % 60);
            html += `
                <div class="viewer-section">
                    <div class="viewer-section-title">Container Contents</div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Contents</span>
                        <span class="viewer-stat-value">${entity.getContentsSummary()}</span>
                    </div>
                    <div class="viewer-stat">
                        <span class="viewer-stat-label">Despawns In</span>
                        <span class="viewer-stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>
                    </div>
                </div>
            `;
        }

        // Entity metadata
        html += `
            <div class="viewer-section">
                <div class="viewer-section-title">Metadata</div>
                <div class="viewer-stat">
                    <span class="viewer-stat-label">Entity ID</span>
                    <span class="viewer-stat-value">${entity.id}</span>
                </div>
                <div class="viewer-stat">
                    <span class="viewer-stat-label">Radius</span>
                    <span class="viewer-stat-value">${entity.radius || 'N/A'}m</span>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Show a toast notification
     */
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            info: '\u2139',      // ℹ
            success: '\u2714',   // ✔
            warning: '\u26A0',   // ⚠
            danger: '\u2716',    // ✖
            error: '\u2716',
        };
        const icon = icons[type] || icons.info;
        const duration = type === 'danger' || type === 'error' ? 4000 : 3000;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${message}</span><div class="toast-progress" style="animation-duration:${duration}ms"></div>`;
        container.appendChild(toast);

        // Auto-remove after animation
        setTimeout(() => toast.remove(), duration);

        // Limit visible toasts
        while (container.children.length > 5) {
            container.removeChild(container.firstChild);
        }
    }

    // Alias for showToast calls
    showToast(message, type) { this.toast(message, type); }

    /**
     * Show sector event banner at top of screen
     */
    showEventBanner(data) {
        const banner = document.getElementById('sector-event-banner');
        if (!banner) return;
        const iconEl = document.getElementById('event-banner-icon');
        const titleEl = document.getElementById('event-banner-title');
        const descEl = document.getElementById('event-banner-desc');
        const timerEl = document.getElementById('event-banner-timer');

        const icons = {
            pirate_capital_invasion: '&#9760;',
            wormhole_opening: '&#9678;',
            trade_embargo: '&#9888;',
            radiation_storm: '&#9762;',
            mining_rush: '&#9670;',
        };
        const colors = {
            pirate_capital_invasion: '#ff4444',
            wormhole_opening: '#8844ff',
            trade_embargo: '#ffaa00',
            radiation_storm: '#ff6600',
            mining_rush: '#44ff88',
        };

        if (iconEl) { iconEl.innerHTML = icons[data.type] || '&#9733;'; iconEl.style.color = colors[data.type] || '#ffcc44'; }
        if (titleEl) titleEl.textContent = data.name || 'SECTOR EVENT';
        if (descEl) descEl.textContent = data.description || '';
        if (timerEl) {
            const dur = Math.round((data.duration || 300) / 60);
            timerEl.textContent = `~${dur}m`;
        }

        banner.classList.remove('hidden');
        banner.style.borderColor = colors[data.type] || '#ffcc44';

        // Store event ID for hide matching
        banner.dataset.eventId = data.id || '';
    }

    hideEventBanner(data) {
        const banner = document.getElementById('sector-event-banner');
        if (!banner) return;
        if (data && data.id && banner.dataset.eventId && banner.dataset.eventId !== data.id) return;
        banner.classList.add('hidden');
    }

    /**
     * Show sector arrival banner
     */
    showSectorBanner(sector) {
        const banner = document.getElementById('sector-banner');
        const nameEl = document.getElementById('sector-banner-name');
        const subtitleEl = document.getElementById('sector-banner-subtitle');
        if (!banner || !nameEl || !subtitleEl) return;

        nameEl.textContent = sector.name || 'Unknown Sector';
        const difficulty = sector.difficulty || 'normal';
        const diffNames = { hub: 'High Security', safe: 'Secure Space', normal: 'Low Security', dangerous: 'Null Security', deadly: 'Wormhole Space' };
        subtitleEl.textContent = diffNames[difficulty] || difficulty;
        subtitleEl.className = `sector-banner-subtitle ${difficulty}`;

        // Update danger level indicator
        const dangerEl = document.getElementById('danger-level');
        if (dangerEl) {
            const secLevels = { hub: '1.0', safe: '0.8', normal: '0.4', dangerous: '0.1', deadly: '0.0' };
            dangerEl.textContent = secLevels[difficulty] || '0.5';
            dangerEl.className = `danger-${difficulty}`;
        }

        // Reset animation
        banner.classList.add('hidden');
        void banner.offsetWidth;
        banner.classList.remove('hidden');

        // Auto-hide
        setTimeout(() => banner.classList.add('hidden'), 3200);
    }

    /**
     * Hail an NPC ship - open contextual dialogue
     */
    /**
     * Scan a target ship's cargo and display results
     */
    /**
     * Update salvage progress bar floating above wreck
     */
    updateSalvageProgressBar() {
        const container = document.getElementById('salvage-beam-container');
        if (!container) return;

        const entities = this.game.currentSector?.entities || [];
        let activeWreck = null;
        for (const e of entities) {
            if (e.type === 'wreck' && e.salvaging && e.alive) {
                activeWreck = e;
                break;
            }
        }

        if (!activeWreck || !this.game.input) {
            container.innerHTML = '';
            return;
        }

        const progress = activeWreck.getSalvagePercent();
        const screen = this.game.input.worldToScreen(activeWreck.x, activeWreck.y);

        // Create or reuse progress bar
        let bar = container.querySelector('.salvage-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'salvage-progress-bar';
            bar.innerHTML = '<div class="salvage-progress-fill"></div>';
            container.appendChild(bar);
        }

        bar.style.left = `${screen.x}px`;
        bar.style.top = `${screen.y - 30}px`;
        bar.querySelector('.salvage-progress-fill').style.width = `${progress * 100}%`;
    }

    scanTargetCargo(target) {
        if (!target || target.cargoCapacity === undefined) return;
        const player = this.game.player;
        if (!player) return;

        const dist = player.distanceTo(target);
        if (dist > 500) {
            this.showToast('Too far to scan cargo (max 500m)', 'warning');
            return;
        }

        this.game.audio?.play('scan');

        const lines = [`--- CARGO SCAN: ${target.name} ---`];
        lines.push(`Hold: ${Math.round(target.cargoUsed || 0)}/${target.cargoCapacity} m\u00B3`);

        let hasContents = false;

        // Ore cargo
        if (target.cargo) {
            for (const [oreType, data] of Object.entries(target.cargo)) {
                if (data.units > 0) {
                    const typeName = CONFIG.ASTEROID_TYPES[oreType]?.name || oreType;
                    lines.push(`  ${typeName}: ${data.units} units (${Math.round(data.volume)} m\u00B3)`);
                    hasContents = true;
                }
            }
        }

        // Trade goods
        if (target.tradeGoods) {
            for (const [goodId, data] of Object.entries(target.tradeGoods)) {
                const qty = typeof data === 'object' ? data.quantity : data;
                if (qty > 0) {
                    lines.push(`  ${goodId.replace(/-/g, ' ')}: ${qty} units`);
                    hasContents = true;
                }
            }
        }

        if (!hasContents) lines.push('  (empty)');

        this.log(lines.join('\n'), 'system');
        this.showToast(`Cargo scanned: ${Math.round(target.cargoUsed || 0)}/${target.cargoCapacity} m\u00B3`, 'system');

        // Scan effect
        this.game.renderer?.effects?.spawn('scan', target.x, target.y, {
            color: 0x44aaff, size: 3, count: 8,
        });
    }

    hailNPC(npc) {
        if (!npc || !this.dialogueManager) return;

        const dialogues = {
            miner: [
                { text: "Hey, capsuleer. Asteroids won't mine themselves. These fields are open to anyone - just don't bring trouble.", portrait: '⛏' },
                { text: "Watch for pirates in the outer belts. They've been raiding mining ops lately. Stick near security if you're in a hauler.", portrait: '⛏' },
                { text: "Good ore around here. I've filled my hold twice today already. The station's buying everything.", portrait: '⛏' },
                { text: "Mining Guild's hiring, if you're interested. Talk to Foreman Kael at the station. Steady work, decent pay.", portrait: '⛏' },
            ],
            security: [
                { text: "Patrol channel is clear. Keep your weapons holstered in safe space, capsuleer. We don't tolerate aggression here.", portrait: '🛡️' },
                { text: "We've been tracking pirate movements in the outer sectors. Watch yourself out there.", portrait: '🛡️' },
                { text: "Station security is maintaining perimeter. Report any suspicious activity on the emergency channel.", portrait: '🛡️' },
                { text: "Commander Vex at the Mercenary Guild is always looking for capable pilots. If you've got combat skills, talk to him.", portrait: '🛡️' },
            ],
        };

        const pool = dialogues[npc.role] || dialogues.miner;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const npcName = npc.name || `${npc.role.charAt(0).toUpperCase() + npc.role.slice(1)} Pilot`;

        this.dialogueManager.open({
            name: npcName,
            title: `NPC ${npc.role.charAt(0).toUpperCase() + npc.role.slice(1)}`,
            portrait: chosen.portrait,
            color: npc.role === 'security' ? '#44aaff' : '#44ff88',
            text: chosen.text,
            options: [{ label: 'Copy that', action: 'close' }],
        });
    }

    /**
     * Jettison all cargo into a floating container
     */
    jettisonCargo() {
        const player = this.game.player;
        if (!player || player.cargoUsed <= 0) return;

        this.showConfirmDialog(
            'Jettison Cargo',
            'All cargo will be ejected into space. This action cannot be undone. Continue?',
            () => this._doJettisonCargo()
        );
    }

    _doJettisonCargo() {
        const player = this.game.player;
        if (!player || player.cargoUsed <= 0) return;

        const container = new LootContainer(this.game, {
            x: player.x + (Math.random() - 0.5) * 100,
            y: player.y + (Math.random() - 0.5) * 100,
            name: 'Jettisoned Cargo',
            ore: { ...player.cargo },
            tradeGoods: {},
        });

        // Copy trade goods
        if (player.tradeGoods) {
            for (const [goodId, data] of Object.entries(player.tradeGoods)) {
                container.tradeGoods[goodId] = { ...data };
            }
        }

        // Add to sector
        this.game.currentSector?.addEntity(container);

        // Clear player cargo
        const contents = [];
        for (const [oreType, data] of Object.entries(player.cargo)) {
            if (data.units > 0) contents.push(`${data.units} ${oreType}`);
        }
        for (const [goodId, data] of Object.entries(player.tradeGoods || {})) {
            if (data.quantity > 0) contents.push(`${data.quantity}x ${goodId}`);
        }
        player.cargo = {};
        player.tradeGoods = {};
        player.cargoUsed = 0;
        this.game.events.emit('cargo:updated', { ship: player });

        this.log(`Jettisoned: ${contents.join(', ')}`, 'system');
        this.toast('Cargo jettisoned', 'info');
        this.game.audio?.play('sell');
    }

    /**
     * Flash screen red when player takes heavy damage
     */
    damageFlash(intensity = 0.3) {
        const flash = document.getElementById('damage-flash');
        if (!flash) return;

        flash.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(255, 0, 0, ${intensity}) 100%)`;
        flash.classList.add('active');

        setTimeout(() => {
            flash.style.transition = 'opacity 0.3s ease-out';
            flash.classList.remove('active');
            setTimeout(() => flash.style.transition = 'opacity 0.05s ease-in', 300);
        }, 50);
    }

    /**
     * Show colored screen edge flash (scramble = red edges, web = orange edges)
     */
    /**
     * Show floating damage/repair popup at screen position
     */
    showDamagePopup(amount, screenX, screenY, type, useWorldCoords = false) {
        const container = this.elements.damagePopups;
        if (!container) return;

        // Convert world coords if needed
        if (useWorldCoords && this.game.input) {
            const screen = this.game.input.worldToScreen(screenX, screenY);
            screenX = screen.x;
            screenY = screen.y;
        }

        // Repair throttle: max 1 per 0.5s
        if (type === 'repair') {
            const now = performance.now();
            const lastTime = this._repairPopupThrottle.get('player') || 0;
            if (now - lastTime < 500) return;
            this._repairPopupThrottle.set('player', now);
        }

        // Random X offset to stagger overlapping hits
        const offsetX = (Math.random() - 0.5) * 30;

        const popup = document.createElement('div');
        popup.className = `damage-popup ${type}`;

        // Scale font size by damage magnitude for hits
        if (type !== 'miss' && type !== 'repair') {
            const ratio = Math.min(amount / 30, 3);
            const isCrit = ratio >= 2;
            if (isCrit) popup.classList.add('crit');
            popup.textContent = isCrit ? `${amount}!` : `-${amount}`;
            popup.style.fontSize = `${14 + ratio * 8}px`;
        } else if (type === 'miss') {
            popup.textContent = 'MISS';
        } else if (type === 'repair') {
            popup.textContent = `+${amount}`;
        }

        popup.style.left = `${screenX + offsetX}px`;
        popup.style.top = `${screenY}px`;
        container.appendChild(popup);

        setTimeout(() => popup.remove(), 1200);

        // Limit popups
        while (container.children.length > 12) {
            container.removeChild(container.firstChild);
        }
    }

    /**
     * Update warp gate destination labels
     */
    updateGateLabels() {
        const container = this.elements.gateLabels;
        if (!container || !this.game.input || !this.game.currentSector) return;

        const entities = this.game.currentSector.entities || [];
        const gates = entities.filter(e => e.type === 'gate' && e.alive);

        // Hide excess labels
        while (this._gateLabelPool.length > gates.length) {
            const label = this._gateLabelPool.pop();
            label.remove();
        }

        // Create/update labels
        for (let i = 0; i < gates.length && i < 8; i++) {
            const gate = gates[i];
            let label = this._gateLabelPool[i];

            if (!label) {
                label = document.createElement('div');
                label.className = 'gate-label';
                container.appendChild(label);
                this._gateLabelPool[i] = label;
            }

            const screen = this.game.input.worldToScreen(gate.x, gate.y);

            // Off-screen check
            if (screen.x < -50 || screen.x > window.innerWidth + 50 ||
                screen.y < -50 || screen.y > window.innerHeight + 50) {
                label.style.display = 'none';
                continue;
            }

            label.style.display = '';
            label.style.left = `${screen.x}px`;
            label.style.top = `${screen.y - 35}px`;
            label.textContent = `\u2192 ${gate.destinationName || gate.destinationSectorId || '???'}`;
        }
    }

    /**
     * Update target combat info (DPS, speed, angular)
     */
    updateTargetCombatInfo(target, player, dist) {
        const dpsEl = this.elements.targetDpsOut;
        const speedEl = this.elements.targetSpeedVal;
        const angularEl = this.elements.targetAngularVal;

        if (!dpsEl || !speedEl || !angularEl) return;

        // DPS output toward locked target (from existing outgoingLog)
        const now = performance.now();
        const dpsWindow = 5000; // 5 second window
        const outgoing = this.game.dpsTracker?.outgoingLog || [];
        let totalDmg = 0;
        for (let i = outgoing.length - 1; i >= 0; i--) {
            const entry = outgoing[i];
            if (now - entry.time > dpsWindow) break;
            if (entry.target === target) {
                totalDmg += entry.damage;
            }
        }
        const dps = totalDmg / (dpsWindow / 1000);
        dpsEl.textContent = dps > 0 ? `${Math.round(dps)}` : '0';
        dpsEl.style.color = dps > 0 ? '#ff6644' : '#00ffcc';

        // Target speed
        if (target.currentSpeed !== undefined) {
            speedEl.textContent = `${Math.round(target.currentSpeed)} m/s`;
        } else {
            speedEl.textContent = '--';
        }

        // Angular velocity
        if (player && dist > 0 && target.currentSpeed !== undefined) {
            const angVel = (target.currentSpeed / Math.max(dist, 50)) * (180 / Math.PI);
            angularEl.textContent = `${angVel.toFixed(1)}°/s`;
        } else {
            angularEl.textContent = '--';
        }
    }

    showScreenFlash(type) {
        const flash = document.getElementById('damage-flash');
        if (!flash) return;

        const colors = {
            scramble: 'rgba(255, 20, 20, 0.4)',
            web: 'rgba(255, 170, 0, 0.3)',
            nos: 'rgba(150, 60, 255, 0.3)',
        };
        const color = colors[type] || colors.scramble;

        flash.style.background = `radial-gradient(ellipse at center, transparent 30%, ${color} 100%)`;
        flash.classList.add('active');

        setTimeout(() => {
            flash.style.transition = 'opacity 0.5s ease-out';
            flash.classList.remove('active');
            setTimeout(() => flash.style.transition = 'opacity 0.05s ease-in', 500);
        }, 100);
    }

    showBreachWarning(text, color, type) {
        // Center-screen warning text
        const el = document.createElement('div');
        el.className = 'breach-warning';
        el.textContent = text;
        el.style.color = color;
        el.style.textShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
        if (type === 'hull') {
            el.style.animation = 'breach-appear 0.15s ease-out forwards, breach-hull-pulse 0.3s ease-in-out 0.15s 4, breach-fade 0.5s ease-out 1.5s forwards';
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);

        // Screen flash
        const flash = document.getElementById('damage-flash');
        if (flash) {
            flash.style.background = `radial-gradient(ellipse at center, transparent 20%, ${color.replace(')', ', 0.35)')} 100%)`;
            flash.classList.add('active');
            setTimeout(() => {
                flash.style.transition = 'opacity 0.6s ease-out';
                flash.classList.remove('active');
                setTimeout(() => flash.style.transition = 'opacity 0.05s ease-in', 600);
            }, 150);
        }

        // Play appropriate audio
        if (type === 'shield') this.game.audio?.play('shield-low');
        else if (type === 'armor') this.game.audio?.play('warning');
        else if (type === 'hull') this.game.audio?.play('hull-critical');

        // Spawn visual effect on ship
        const player = this.game.player;
        if (player && this.game.renderer?.effects) {
            if (type === 'shield') {
                this.game.renderer.effects.spawn('shield-hit', player.x, player.y, { color: 0x4488ff });
            } else if (type === 'armor') {
                this.game.renderer.effects.spawn('explosion', player.x, player.y, { scale: 0.3, color: 0xff8844 });
            }
        }
    }

    /**
     * Show directional damage indicator pointing toward attacker
     */
    showDamageDirection(source, type = 'hit') {
        const player = this.game.player;
        if (!player || !source) return;

        const container = this.elements.damageDirectionContainer || document.getElementById('damage-direction-container');
        if (!container) return;

        // Calculate angle from player to source
        const dx = source.x - player.x;
        const dy = source.y - player.y;
        const angle = Math.atan2(dy, dx);

        // Convert to CSS rotation (0deg = top, clockwise)
        const screenAngleDeg = (angle * 180 / Math.PI) + 90;

        const indicator = document.createElement('div');
        const typeClass = type === 'missile' ? ' missile' : type === 'hostile' ? ' hostile' : '';
        indicator.className = `damage-dir-arrow${typeClass}`;
        indicator.style.setProperty('--angle', `${screenAngleDeg}deg`);
        container.appendChild(indicator);

        // Remove after animation
        const duration = type === 'missile' ? 1200 : type === 'hostile' ? 1500 : 800;
        setTimeout(() => indicator.remove(), duration);

        // Limit indicators
        while (container.children.length > 6) {
            container.firstChild.remove();
        }
    }

    // =========================================
    // Global Tooltip System
    // =========================================

    /**
     * Add data-tooltip attributes to status bar elements
     */
    setupStatusBarTooltips() {
        const bars = [
            { el: this.elements.shieldContainer, type: 'shield' },
            { el: this.elements.armorContainer, type: 'armor' },
            { el: this.elements.hullContainer, type: 'hull' },
            { el: this.elements.capacitorContainer, type: 'capacitor' },
        ];
        for (const { el, type } of bars) {
            if (el) el.setAttribute('data-tooltip', type);
        }
        // Cargo bar
        const cargoContainer = this.elements.cargoBar?.parentElement;
        if (cargoContainer) cargoContainer.setAttribute('data-tooltip', 'cargo');
        // Credits
        const creditsEl = this.elements.creditsValue?.parentElement;
        if (creditsEl) creditsEl.setAttribute('data-tooltip', 'credits');
    }

    /**
     * Show global tooltip near target element
     */
    showGlobalTooltip(target) {
        const tooltip = this.elements.globalTooltip;
        if (!tooltip) return;

        const type = target.getAttribute('data-tooltip');
        const player = this.game.player;
        let html = '';

        if (type === 'shield' && player) {
            html = `<div class="global-tooltip-title">Shield</div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">HP</span><span class="global-tooltip-value">${Math.floor(player.shield)} / ${Math.floor(player.maxShield)}</span></div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">Resist</span><span class="global-tooltip-value">${Math.round((player.shieldResist || 0) * 100)}%</span></div>
                <div class="global-tooltip-divider"></div>
                <div class="global-tooltip-hint">EM/Thermal resist layer</div>`;
        } else if (type === 'armor' && player) {
            html = `<div class="global-tooltip-title">Armor</div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">HP</span><span class="global-tooltip-value">${Math.floor(player.armor)} / ${Math.floor(player.maxArmor)}</span></div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">Resist</span><span class="global-tooltip-value">${Math.round((player.armorResist || 0) * 100)}%</span></div>
                <div class="global-tooltip-divider"></div>
                <div class="global-tooltip-hint">Explosive/Kinetic resist layer</div>`;
        } else if (type === 'hull' && player) {
            html = `<div class="global-tooltip-title">Hull</div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">HP</span><span class="global-tooltip-value">${Math.floor(player.hull)} / ${Math.floor(player.maxHull)}</span></div>
                <div class="global-tooltip-divider"></div>
                <div class="global-tooltip-hint">Ship destroyed at 0 hull</div>`;
        } else if (type === 'capacitor' && player) {
            html = `<div class="global-tooltip-title">Capacitor</div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">Energy</span><span class="global-tooltip-value">${Math.floor(player.capacitor)} / ${Math.floor(player.maxCapacitor)}</span></div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">Recharge</span><span class="global-tooltip-value">${(player.capacitorRecharge || 0).toFixed(1)}/s</span></div>
                <div class="global-tooltip-divider"></div>
                <div class="global-tooltip-hint">Powers modules &amp; warp drive</div>`;
        } else if (type === 'cargo' && player) {
            const used = player.cargoUsed || 0;
            const max = player.cargoCapacity || 0;
            html = `<div class="global-tooltip-title">Cargo Hold</div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">Used</span><span class="global-tooltip-value">${used} / ${max} m\u00B3</span></div>
                <div class="global-tooltip-divider"></div>
                <div class="global-tooltip-hint">Dock at station to sell cargo</div>`;
        } else if (type === 'credits') {
            html = `<div class="global-tooltip-title">Credits</div>
                <div class="global-tooltip-row"><span class="global-tooltip-label">Balance</span><span class="global-tooltip-value">${formatCredits(this.game.credits || 0)} ISK</span></div>
                <div class="global-tooltip-divider"></div>
                <div class="global-tooltip-hint">Earned from bounties, mining &amp; trade</div>`;
        } else {
            // Generic tooltip from data-tooltip-text attribute
            const text = target.getAttribute('data-tooltip-text') || type;
            html = `<div class="global-tooltip-title">${text}</div>`;
        }

        tooltip.innerHTML = html;

        // Position near target
        const rect = target.getBoundingClientRect();
        const tooltipW = 200;
        let left = rect.left + rect.width / 2 - tooltipW / 2;
        let top = rect.top - 8;

        // Clamp to viewport
        left = Math.max(4, Math.min(window.innerWidth - tooltipW - 4, left));
        if (top < 60) top = rect.bottom + 8; // flip below if too close to top

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.transform = 'translateY(-100%)';
        if (top === rect.bottom + 8) tooltip.style.transform = 'translateY(0)';

        tooltip.classList.remove('hidden');
        this._globalTooltipTarget = target;
    }

    /**
     * Hide global tooltip
     */
    hideGlobalTooltip() {
        const tooltip = this.elements.globalTooltip;
        if (tooltip) tooltip.classList.add('hidden');
        this._globalTooltipTarget = null;
    }

    // =========================================
    // Confirmation Dialog
    // =========================================

    /**
     * Show styled confirmation dialog
     */
    showConfirmDialog(title, message, onConfirm, onCancel) {
        this._confirmCallback = onConfirm || null;
        this._confirmCancelCallback = onCancel || null;

        if (this.elements.confirmTitle) this.elements.confirmTitle.textContent = title;
        if (this.elements.confirmMessage) this.elements.confirmMessage.innerHTML = message;
        if (this.elements.confirmDialog) this.elements.confirmDialog.classList.remove('hidden');

        this.game.audio?.play('click');
    }

    /**
     * Hide confirmation dialog
     */
    hideConfirmDialog() {
        if (this.elements.confirmDialog) this.elements.confirmDialog.classList.add('hidden');
        this._confirmCallback = null;
        this._confirmCancelCallback = null;
    }

    // =========================================
    // Status Bar Pulse Animations
    // =========================================

    /**
     * Pulse credits display on gain/loss
     */
    pulseCreditsDisplay(gained) {
        const el = this.elements.creditsValue;
        if (!el) return;
        el.classList.remove('pulse-gain', 'pulse-loss');
        void el.offsetWidth;
        el.classList.add(gained ? 'pulse-gain' : 'pulse-loss');
        setTimeout(() => el.classList.remove('pulse-gain', 'pulse-loss'), 500);
    }

    /**
     * Pulse a status bar on significant change
     */
    pulseStatusBar(type, gained) {
        const containerMap = {
            shield: this.elements.shieldContainer,
            armor: this.elements.armorContainer,
            hull: this.elements.hullContainer,
            capacitor: this.elements.capacitorContainer,
        };
        const el = containerMap[type];
        if (!el) return;
        el.classList.remove('pulse-gain', 'pulse-loss');
        void el.offsetWidth;
        el.classList.add(gained ? 'pulse-gain' : 'pulse-loss');
        setTimeout(() => el.classList.remove('pulse-gain', 'pulse-loss'), 400);
    }

    /**
     * Show floating credit popup at screen position
     */
    showCreditPopup(amount, screenX, screenY, type = 'gain') {
        const container = document.getElementById('credit-popups');
        if (!container) return;

        const popup = document.createElement('div');
        popup.className = `credit-popup ${type}`;
        popup.textContent = type === 'loss' ? `-${formatCredits(amount)} ISK` : `+${formatCredits(amount)} ISK`;
        popup.style.left = `${screenX}px`;
        popup.style.top = `${screenY}px`;
        container.appendChild(popup);

        setTimeout(() => popup.remove(), 1500);

        // Limit popups
        while (container.children.length > 8) {
            container.removeChild(container.firstChild);
        }
    }

    /**
     * Reset panel positions (Z key)
     */
    toggleMoveMode() {
        this.panelDragManager.resetPositions();
    }

    /**
     * Reset panel positions to defaults
     */
    resetPanelPositions() {
        this.panelDragManager.resetPositions();
    }

    /**
     * Update autopilot status indicator
     */
    updateAutopilotIndicator() {
        const indicator = this.elements.autopilotIndicator;
        if (!indicator) return;

        const autopilot = this.game.autopilot;
        if (!autopilot) return;

        const status = autopilot.getStatus();

        if (status === 'idle') {
            indicator.classList.add('hidden');
            return;
        }

        indicator.classList.remove('hidden');

        const statusText = this.elements.autopilotStatusText;
        if (!statusText) return;

        const targetName = autopilot.target?.name || autopilot.warpTarget?.name || '';

        const labels = {
            'approach': `Approaching ${targetName}`,
            'approachPosition': 'Approaching location',
            'orbit': `Orbiting ${targetName} at ${autopilot.distance || 0}m`,
            'keepAtRange': `Keeping ${autopilot.distance || 0}m from ${targetName}`,
            'aligning': `Aligning to ${targetName}...`,
            'warping': `Warping to ${targetName}`,
        };

        let label = labels[status] || status;

        // Append route info if multi-sector autopilot is active
        const routeInfo = this.game.autopilot?.getRouteInfo();
        if (routeInfo) {
            label += ` [${routeInfo.currentIndex}/${routeInfo.totalJumps} jumps]`;
        }

        statusText.textContent = label;
    }

    /**
     * Render the radar minimap canvas
     */
    updateMinimap() {
        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        if (!ctx || !canvas) return;

        const player = this.game.player;
        if (!player) return;

        const W = this.minimapExpanded ? 400 : 210;
        const H = this.minimapExpanded ? 400 : 210;
        const cx = W / 2;
        const cy = H / 2;
        const radarMult = this.game.hazardSystem?.getRadarMultiplier() ?? 1;
        const range = this.minimapRange * radarMult;
        const scale = (W / 2 - 10) / range; // pixels per world unit

        // Ensure canvas size matches (HiDPI not needed at this small size)
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;

        // Background - tinted by sector hazard
        ctx.clearRect(0, 0, W, H);
        const hazard = this.game.hazardSystem?.activeHazard;
        if (hazard?.type === 'radiation') {
            ctx.fillStyle = 'rgba(20, 4, 4, 0.9)';
        } else if (hazard?.type === 'ion-storm') {
            ctx.fillStyle = 'rgba(8, 4, 20, 0.9)';
        } else if (hazard?.type === 'nebula-interference') {
            ctx.fillStyle = 'rgba(4, 12, 10, 0.9)';
        } else {
            ctx.fillStyle = 'rgba(0, 8, 20, 0.9)';
        }
        ctx.fillRect(0, 0, W, H);

        // Range rings
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        for (let r = 1; r <= 3; r++) {
            const ringR = (r / 3) * (W / 2 - 10);
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Radar sweep line with fading trail
        this._radarAngle = ((this._radarAngle || 0) + 0.03) % (Math.PI * 2);
        const sweepR = W / 2 - 10;
        // Fading trail (draw gradient arc behind sweep line)
        if (ctx.createConicGradient) {
            const trailAngle = 0.5;
            const gradient = ctx.createConicGradient(this._radarAngle - trailAngle, cx, cy);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradient.addColorStop(trailAngle / (Math.PI * 2), 'rgba(0, 255, 255, 0.06)');
            gradient.addColorStop(trailAngle / (Math.PI * 2) + 0.001, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, sweepR, this._radarAngle - trailAngle, this._radarAngle);
            ctx.closePath();
            ctx.fill();
        }
        // Sweep line
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(this._radarAngle) * sweepR, cy + Math.sin(this._radarAngle) * sweepR);
        ctx.stroke();

        // Crosshair
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(cx, 5); ctx.lineTo(cx, H - 5);
        ctx.moveTo(5, cy); ctx.lineTo(W - 5, cy);
        ctx.stroke();

        // Player heading indicator line
        const headLen = 20;
        const hx = cx + Math.cos(player.rotation) * headLen;
        const hy = cy - Math.sin(player.rotation) * headLen;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        // Gather entities
        const entities = this.game.currentSector?.entities || [];
        const allEntities = [...entities];
        if (this.game.player && !allEntities.includes(this.game.player)) {
            allEntities.push(this.game.player);
        }

        // Draw entities as dots
        for (const entity of allEntities) {
            if (!entity.alive || entity === player) continue;

            const dx = entity.x - player.x;
            const dy = entity.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > range) continue;

            const sx = cx + dx * scale;
            const sy = cy - dy * scale; // Y inverted

            // Determine color and size by type
            let color, size;
            switch (entity.type) {
                case 'enemy':
                    color = '#ff4444';
                    size = 2.5;
                    break;
                case 'guild':
                    if (entity.isPirate) {
                        color = '#ff4444';
                        size = 2.5;
                    } else {
                        color = entity.factionColor || '#44aaff';
                        size = 2;
                    }
                    break;
                case 'npc':
                    color = entity.role === 'security' ? '#44ff88' : '#44aa44';
                    size = 2;
                    break;
                case 'fleet':
                    color = '#00ffff';
                    size = 2.5;
                    break;
                case 'station':
                case 'player-station':
                    color = '#ffffff';
                    size = 4;
                    break;
                case 'asteroid': {
                    // Color-code by ore type
                    const oreColors = {
                        veldspar: 'rgba(160, 160, 160, 0.5)',
                        scordite: 'rgba(180, 110, 55, 0.6)',
                        pyroxeres: 'rgba(70, 180, 110, 0.6)',
                        plagioclase: 'rgba(70, 110, 180, 0.7)',
                    };
                    color = oreColors[entity.asteroidType] || 'rgba(160, 140, 100, 0.5)';
                    // Larger dot for rarer ores
                    size = entity.asteroidType === 'plagioclase' ? 2 :
                        entity.asteroidType === 'pyroxeres' ? 1.5 : 1;
                    // Dim depleted asteroids
                    if (entity.ore <= 0) {
                        color = 'rgba(80, 70, 50, 0.3)';
                        size = 0.8;
                    }
                    break;
                }
                case 'planet':
                    color = '#8866cc';
                    size = 5;
                    break;
                case 'gate':
                case 'warpgate':
                    color = '#ffaa00';
                    size = 3.5;
                    break;
                case 'drone':
                    color = '#00dddd';
                    size = 1.5;
                    break;
                case 'wreck':
                    color = '#887766';
                    size = 2;
                    break;
                case 'anomaly':
                    if (entity.scanned) {
                        color = entity.anomalyType === 'wormhole' ? '#8844ff' :
                            entity.anomalyType === 'combatSite' ? '#ff4422' :
                            entity.anomalyType === 'dataSite' ? '#44ddff' : '#44ff88';
                        size = 3;
                    } else {
                        color = 'rgba(255, 255, 255, 0.3)';
                        size = 2;
                    }
                    break;
                default:
                    color = '#666666';
                    size = 1.5;
            }

            // Draw blip - distinct shapes by type
            ctx.fillStyle = color;
            const isHostile = entity.hostility === 'hostile' || entity.type === 'enemy' || (entity.type === 'guild' && entity.isPirate);
            if (entity.type === 'station' || entity.type === 'player-station') {
                // Diamond for stations
                ctx.beginPath();
                ctx.moveTo(sx, sy - size);
                ctx.lineTo(sx + size, sy);
                ctx.lineTo(sx, sy + size);
                ctx.lineTo(sx - size, sy);
                ctx.closePath();
                ctx.fill();
            } else if (entity.type === 'gate' || entity.type === 'warpgate') {
                // Hollow diamond for gates
                ctx.lineWidth = 1;
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.moveTo(sx, sy - size);
                ctx.lineTo(sx + size, sy);
                ctx.lineTo(sx, sy + size);
                ctx.lineTo(sx - size, sy);
                ctx.closePath();
                ctx.stroke();
            } else if (isHostile) {
                // Triangle pointing down for hostiles
                ctx.beginPath();
                ctx.moveTo(sx, sy + size);
                ctx.lineTo(sx - size, sy - size);
                ctx.lineTo(sx + size, sy - size);
                ctx.closePath();
                ctx.fill();
            } else if (entity.type === 'wreck' || entity.type === 'loot') {
                // X mark for wrecks/loot
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx - size, sy - size);
                ctx.lineTo(sx + size, sy + size);
                ctx.moveTo(sx + size, sy - size);
                ctx.lineTo(sx - size, sy + size);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Selected target highlight
            if (entity === this.game.selectedTarget) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(sx, sy, size + 3, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Hostile glow
            if (entity.hostility === 'hostile' || entity.type === 'enemy') {
                ctx.strokeStyle = color;
                ctx.lineWidth = 0.5;
                ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 300) * 0.2;
                ctx.beginPath();
                ctx.arc(sx, sy, size + 2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // Player marker (center)
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        // Small chevron pointing in heading direction
        const pr = 4;
        const pa = player.rotation;
        ctx.moveTo(cx + Math.cos(pa) * pr, cy - Math.sin(pa) * pr);
        ctx.lineTo(cx + Math.cos(pa + 2.5) * pr * 0.7, cy - Math.sin(pa + 2.5) * pr * 0.7);
        ctx.lineTo(cx + Math.cos(pa + Math.PI) * pr * 0.3, cy - Math.sin(pa + Math.PI) * pr * 0.3);
        ctx.lineTo(cx + Math.cos(pa - 2.5) * pr * 0.7, cy - Math.sin(pa - 2.5) * pr * 0.7);
        ctx.closePath();
        ctx.fill();

        // D-scan sweep line (when dscan panel is open)
        const dscanOpen = this.elements.dscanPanel && !this.elements.dscanPanel.classList.contains('hidden');
        if (dscanOpen) {
            const sweepAngle = (Date.now() / 5000) * Math.PI * 2; // 5s rotation
            const sweepLen = W / 2 - 5;

            // Sweep gradient
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-sweepAngle);
            const grad = ctx.createLinearGradient(0, 0, sweepLen, 0);
            grad.addColorStop(0, 'rgba(0, 255, 128, 0.0)');
            grad.addColorStop(0.4, 'rgba(0, 255, 128, 0.15)');
            grad.addColorStop(1, 'rgba(0, 255, 128, 0.4)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sweepLen, 0);
            ctx.stroke();

            // Fading trail arc behind sweep
            ctx.beginPath();
            ctx.arc(0, 0, sweepLen * 0.8, -0.3, 0);
            ctx.strokeStyle = 'rgba(0, 255, 128, 0.06)';
            ctx.lineWidth = 20;
            ctx.stroke();
            ctx.restore();
        }

        // Sector warp destination marker
        if (player.sectorWarpState === 'spooling' && player.sectorWarpTarget) {
            const wdx = player.sectorWarpTarget.x - player.x;
            const wdy = player.sectorWarpTarget.y - player.y;
            const wsx = cx + wdx * scale;
            const wsy = cy - wdy * scale;
            // Pulsing diamond marker
            const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
            ctx.strokeStyle = `rgba(68, 136, 255, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(wsx, wsy - 5);
            ctx.lineTo(wsx + 4, wsy);
            ctx.lineTo(wsx, wsy + 5);
            ctx.lineTo(wsx - 4, wsy);
            ctx.closePath();
            ctx.stroke();
            // Line from player to destination
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = `rgba(68, 136, 255, ${0.2 + pulse * 0.2})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(wsx, wsy);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Autopilot route marker
        if (this.game.autopilot?.warpTarget) {
            const at = this.game.autopilot.warpTarget;
            const atdx = at.x - player.x;
            const atdy = at.y - player.y;
            const atsx = cx + atdx * scale;
            const atsy = cy - atdy * scale;
            ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(atsx, atsy);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Scan pulse animation
        if (this.scanPulse) {
            const elapsed = performance.now() - this.scanPulse.startTime;
            const progress = elapsed / this.scanPulse.duration;

            if (progress > 1.2) {
                this.scanPulse = null;
            } else {
                // Expanding ring
                const ringProgress = Math.min(progress, 1.0);
                const maxRingR = (W / 2 - 10) * (this.scanPulse.range / range);
                const ringR = ringProgress * Math.min(maxRingR, W / 2 - 5);
                const ringAlpha = Math.max(0, 1 - ringProgress) * 0.5;

                ctx.strokeStyle = `rgba(0, 255, 200, ${ringAlpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
                ctx.stroke();

                // Inner glow ring
                ctx.strokeStyle = `rgba(0, 255, 200, ${ringAlpha * 0.3})`;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
                ctx.stroke();

                // Flash entity blips as the ring passes them
                const scanScale = (W / 2 - 10) / range;
                for (const ep of this.scanPulse.entityPositions) {
                    const edist = Math.sqrt(ep.dx * ep.dx + ep.dy * ep.dy);
                    const ePixelDist = edist * scanScale;
                    const diff = Math.abs(ePixelDist - ringR);

                    if (diff < 12) {
                        const flash = Math.max(0, 1 - diff / 12);
                        const esx = cx + ep.dx * scanScale;
                        const esy = cy - ep.dy * scanScale;
                        const flashColor = ep.hostile ? '255, 80, 80' : '0, 255, 200';

                        ctx.fillStyle = `rgba(${flashColor}, ${flash * 0.7})`;
                        ctx.beginPath();
                        ctx.arc(esx, esy, 4 + flash * 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Scan summary text overlay (appears after ring expands)
                if (progress > 0.6) {
                    const textAlpha = Math.min(1, (progress - 0.6) * 3) * Math.max(0, 1.2 - progress) * 3;
                    const counts = this.scanPulse.counts;
                    const total = Object.values(counts).reduce((s, c) => s + c, 0);

                    ctx.fillStyle = `rgba(0, 255, 200, ${textAlpha * 0.8})`;
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${total} CONTACT${total !== 1 ? 'S' : ''}`, cx, cy - 14);
                    ctx.font = '8px monospace';
                    ctx.fillStyle = `rgba(0, 255, 200, ${textAlpha * 0.5})`;
                    const parts = Object.entries(counts).slice(0, 3).map(([t, c]) => `${c} ${t}`);
                    ctx.fillText(parts.join(' | '), cx, cy - 4);
                }
            }
        }

        // Range label
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${(range / 1000).toFixed(0)}km`, W - 4, H - 3);
    }

    /**
     * Toggle tactical overlay on/off
     */
    toggleMinimapExpand() {
        this.minimapExpanded = !this.minimapExpanded;
        const minimap = document.getElementById('minimap');
        const btn = document.getElementById('minimap-expand-btn');
        if (minimap) minimap.classList.toggle('minimap-expanded', this.minimapExpanded);
        if (btn) btn.textContent = this.minimapExpanded ? '▾' : '▴';
    }

    toggleTacticalOverlay() {
        this.tacticalEnabled = !this.tacticalEnabled;
        if (this.tacticalContainer) {
            this.tacticalContainer.classList.toggle('hidden', !this.tacticalEnabled);
        }
        this.showToast(`Tactical overlay ${this.tacticalEnabled ? 'ON' : 'OFF'}`, 'system');
        if (!this.tacticalEnabled && this.tacticalContainer) {
            this.tacticalContainer.innerHTML = '';
            this._tacPool = [];
        }
    }

    /**
     * Update tactical overlay - entity labels, brackets, velocity vectors
     */
    updateTacticalOverlay() {
        if (!this.tacticalEnabled || !this.tacticalContainer) return;
        const player = this.game.player;
        if (!player) return;

        const entities = this.game.currentSector?.entities || [];
        const selected = this.game.selectedTarget;

        // Collect visible entities within reasonable distance
        const maxRange = 15000;
        const visible = [];
        for (const e of entities) {
            if (!e.alive || e === player || e.type === 'drone') continue;
            const dist = player.distanceTo(e);
            if (dist > maxRange) continue;
            visible.push({ entity: e, dist });
        }

        // Limit to nearest 40 for performance
        visible.sort((a, b) => a.dist - b.dist);
        const display = visible.slice(0, 40);

        // Ensure pool has enough elements (recycle DOM nodes)
        while (this._tacPool.length < display.length) {
            const wrapper = document.createElement('div');
            wrapper.className = 'tac-entry';
            wrapper.style.position = 'absolute';

            const label = document.createElement('div');
            label.className = 'tac-label';
            label.innerHTML = '<span class="tac-name"></span><span class="tac-dist"></span>';

            const bracket = document.createElement('div');
            bracket.className = 'tac-bracket';

            const vector = document.createElement('div');
            vector.className = 'tac-vector';

            this.tacticalContainer.appendChild(label);
            this.tacticalContainer.appendChild(bracket);
            this.tacticalContainer.appendChild(vector);

            this._tacPool.push({ label, bracket, vector });
        }

        // Update each visible entity
        for (let i = 0; i < this._tacPool.length; i++) {
            const pool = this._tacPool[i];

            if (i >= display.length) {
                pool.label.style.display = 'none';
                pool.bracket.style.display = 'none';
                pool.vector.style.display = 'none';
                continue;
            }

            const { entity, dist } = display[i];
            const screen = this.game.input.worldToScreen(entity.x, entity.y);

            // Clamp to viewport
            if (screen.x < -50 || screen.x > window.innerWidth + 50 ||
                screen.y < -50 || screen.y > window.innerHeight + 50) {
                pool.label.style.display = 'none';
                pool.bracket.style.display = 'none';
                pool.vector.style.display = 'none';
                continue;
            }

            // Determine hostility class
            let hClass = 'neutral';
            if (entity.type === 'station' || entity.type === 'player-station' || entity.type === 'gate') hClass = 'structure';
            else if (entity.hostility === 'hostile' || entity.type === 'enemy') hClass = 'hostile';
            else if (entity.hostility === 'friendly' || entity.type === 'fleet') hClass = 'friendly';

            const isSelected = entity === selected;

            // Bracket size based on entity radius mapped to screen
            const bSize = Math.max(12, Math.min(40, (entity.radius || 20) * 0.5));

            // Label
            pool.label.style.display = '';
            pool.label.className = `tac-label ${hClass}`;
            pool.label.children[0].textContent = entity.name || entity.type;
            pool.label.children[1].textContent = formatDistance(dist);
            pool.label.style.left = `${screen.x}px`;
            pool.label.style.top = `${screen.y - bSize / 2 - 4}px`;

            // Bracket
            pool.bracket.style.display = '';
            pool.bracket.className = `tac-bracket ${hClass}${isSelected ? ' selected' : ''}`;
            pool.bracket.style.width = `${bSize}px`;
            pool.bracket.style.height = `${bSize}px`;
            pool.bracket.style.left = `${screen.x}px`;
            pool.bracket.style.top = `${screen.y}px`;

            // Velocity vector
            if (entity.velocity) {
                const speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
                if (speed > 5) {
                    const angle = Math.atan2(-entity.velocity.y, entity.velocity.x); // screen coords
                    const vecLen = Math.min(40, speed * 0.15);
                    pool.vector.style.display = '';
                    pool.vector.className = `tac-vector ${hClass}`;
                    pool.vector.style.width = `${vecLen}px`;
                    pool.vector.style.left = `${screen.x}px`;
                    pool.vector.style.top = `${screen.y}px`;
                    pool.vector.style.transform = `rotate(${-angle}rad)`;
                } else {
                    pool.vector.style.display = 'none';
                }
            } else {
                pool.vector.style.display = 'none';
            }
        }
    }

    // =============================================
    // Bounty Board System
    // =============================================

    loadBounties() {
        try {
            return JSON.parse(localStorage.getItem('expedition-bounties') || '[]');
        } catch { return []; }
    }

    saveBounties() {
        localStorage.setItem('expedition-bounties', JSON.stringify(this.activeBounties));
        localStorage.setItem('expedition-completed-bounties', JSON.stringify([...this.completedBountyIds]));
        localStorage.setItem('expedition-bounty-counter', String(this.bountyIdCounter));
        localStorage.setItem('expedition-bounty-refresh', String(this.lastBountyRefresh));
    }

    /**
     * Generate bounties from Shadow Cartel pirate ships
     */
    generateBounties(station) {
        const now = Date.now();
        const refreshInterval = 5 * 60 * 1000; // 5 minutes

        // Only refresh if enough time passed
        if (now - this.lastBountyRefresh < refreshInterval && this.activeBounties.length > 0) return;

        const guildEconomy = this.game.guildEconomy;
        if (!guildEconomy) return;

        // Get pirate ships from Shadow Cartel
        const pirates = guildEconomy.getShipsForFaction('shadow-cartel');
        if (!pirates || pirates.length === 0) return;

        // Keep active (accepted) bounties, clear available ones
        this.activeBounties = this.activeBounties.filter(b => b.status === 'accepted');

        // Generate 3-6 new bounties from actual pirate ships
        const available = pirates.filter(p => !this.completedBountyIds.has(p.guildId));
        const count = Math.min(available.length, 3 + Math.floor(Math.random() * 4));
        const selected = this.shuffleArray([...available]).slice(0, count);

        const dangerTitles = ['WANTED', 'DEAD OR ALIVE', 'KILL ON SIGHT', 'HIGH PRIORITY', 'MOST WANTED'];
        const sectorNames = {
            'hub': 'Central Hub', 'sector-1': 'Sector 1', 'sector-2': 'Sector 2',
            'sector-3': 'Sector 3', 'sector-4': 'Sector 4', 'sector-5': 'Sector 5', 'sector-6': 'Sector 6',
        };

        for (const pirate of selected) {
            const shipData = SHIP_DATABASE[pirate.shipClass];
            const baseReward = (shipData?.price || 5000) * (0.3 + Math.random() * 0.4);
            const dangerBonus = pirate.killCount > 0 ? pirate.killCount * 200 : 0;
            const reward = Math.floor(baseReward + dangerBonus);

            this.activeBounties.push({
                id: ++this.bountyIdCounter,
                targetGuildId: pirate.guildId,
                targetName: pirate.name,
                targetShipClass: pirate.shipClass,
                targetRole: pirate.role,
                factionName: 'Shadow Cartel',
                dangerTitle: dangerTitles[Math.floor(Math.random() * dangerTitles.length)],
                reward,
                sectorHint: sectorNames[pirate.sectorId] || 'Unknown Space',
                sectorId: pirate.sectorId,
                killCount: pirate.killCount || 0,
                status: 'available', // available | accepted | completed
                acceptedAt: 0,
                expiresAt: now + 30 * 60 * 1000, // 30 min expiry
            });
        }

        this.lastBountyRefresh = now;
        this.saveBounties();
    }

    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Accept a bounty
     */
    acceptBounty(bountyId) {
        const bounty = this.activeBounties.find(b => b.id === bountyId);
        if (!bounty || bounty.status !== 'available') return;

        // Max 3 active bounties
        const activeCount = this.activeBounties.filter(b => b.status === 'accepted').length;
        if (activeCount >= 3) {
            this.toast('Maximum 3 active bounties', 'warning');
            return;
        }

        bounty.status = 'accepted';
        bounty.acceptedAt = Date.now();
        this.saveBounties();
        this.updateBountyTab();

        this.log(`Accepted bounty: ${bounty.targetName} (${formatCredits(bounty.reward)} ISK)`, 'system');
        this.toast(`Bounty accepted: ${bounty.targetName}`, 'success');
        this.game.audio?.play('quest-accept');
        this.addShipLogEntry(`Accepted bounty on ${bounty.targetName}`, 'combat');
    }

    /**
     * Abandon a bounty
     */
    abandonBounty(bountyId) {
        const bounty = this.activeBounties.find(b => b.id === bountyId);
        if (!bounty || bounty.status !== 'accepted') return;

        bounty.status = 'available';
        bounty.acceptedAt = 0;
        this.saveBounties();
        this.updateBountyTab();

        this.log(`Abandoned bounty: ${bounty.targetName}`, 'system');
        this.toast(`Bounty abandoned`, 'warning');
    }

    /**
     * Check if a destroyed entity completes a bounty
     */
    checkBountyCompletion(entity) {
        if (!entity.guildId) return;
        // Only count player kills (or player fleet kills)
        const killer = entity.lastDamageSource;
        if (!killer?.isPlayer && killer?.type !== 'fleet') return;

        const bounty = this.activeBounties.find(
            b => b.status === 'accepted' && b.targetGuildId === entity.guildId
        );
        if (!bounty) return;

        bounty.status = 'completed';
        this.completedBountyIds.add(entity.guildId);

        // Reward
        this.game.addCredits(bounty.reward);

        // Effects
        this.game.audio?.play('quest-complete');
        if (this.game.player) {
            this.game.renderer?.effects?.spawn('quest-complete', this.game.player.x, this.game.player.y);
            this.game.renderer?.effects?.spawn('level-up', this.game.player.x, this.game.player.y);
        }

        // Popup
        const screen = this.game.input?.worldToScreen(entity.x, entity.y);
        if (screen) {
            this.showCreditPopup(bounty.reward, screen.x, screen.y - 30, 'bounty');
        }

        // Feedback
        this.toast(`BOUNTY CLAIMED: ${bounty.targetName} (+${formatCredits(bounty.reward)} ISK)`, 'success');
        this.log(`Bounty complete: ${bounty.targetName} - ${formatCredits(bounty.reward)} ISK`, 'system');
        this.addShipLogEntry(`Claimed bounty on ${bounty.targetName} for ${formatCredits(bounty.reward)} ISK`, 'combat');

        // Show kill notification
        this.showBountyKillNotification(bounty);

        this.saveBounties();
    }

    /**
     * Big center-screen bounty kill notification
     */
    showBountyKillNotification(bounty) {
        const existing = document.getElementById('bounty-kill-notify');
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.id = 'bounty-kill-notify';
        el.className = 'bounty-kill-notification';
        el.innerHTML = `
            <div class="bkn-skull">&#x2620;</div>
            <div class="bkn-title">BOUNTY CLAIMED</div>
            <div class="bkn-name">${bounty.targetName}</div>
            <div class="bkn-ship">${SHIP_DATABASE[bounty.targetShipClass]?.name || bounty.targetShipClass} - ${bounty.targetRole}</div>
            <div class="bkn-reward">+${formatCredits(bounty.reward)} ISK</div>
        `;
        document.getElementById('ui-overlay').appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    /**
     * Render bounty board tab
     */
    updateBountyTab() {
        const container = document.getElementById('bounty-content');
        if (!container) return;

        // Generate bounties if needed
        this.generateBounties(this.game.dockedAt);

        const now = Date.now();
        let html = `<div class="bounty-board">`;

        // Header with summary
        const accepted = this.activeBounties.filter(b => b.status === 'accepted');
        const completed = [...this.completedBountyIds].length;
        html += `<div class="bounty-header">`;
        html += `<div class="bounty-header-left">`;
        html += `<span class="bounty-skull">&#x2620;</span>`;
        html += `<span class="bounty-header-title">WANTED CRIMINALS</span>`;
        html += `</div>`;
        html += `<div class="bounty-header-stats">`;
        html += `<span class="bounty-stat">Active: <em>${accepted.length}/3</em></span>`;
        html += `<span class="bounty-stat">Claimed: <em>${completed}</em></span>`;
        html += `</div>`;
        html += `</div>`;

        // Active bounties section
        if (accepted.length > 0) {
            html += `<div class="bounty-section-label">ACTIVE CONTRACTS</div>`;
            for (const b of accepted) {
                html += this.renderBountyCard(b, 'accepted');
            }
        }

        // Available bounties
        const available = this.activeBounties.filter(b => b.status === 'available' && b.expiresAt > now);
        if (available.length > 0) {
            html += `<div class="bounty-section-label">AVAILABLE BOUNTIES</div>`;
            for (const b of available) {
                html += this.renderBountyCard(b, 'available');
            }
        }

        // Recently completed
        const recentCompleted = this.activeBounties.filter(b => b.status === 'completed');
        if (recentCompleted.length > 0) {
            html += `<div class="bounty-section-label">RECENTLY CLAIMED</div>`;
            for (const b of recentCompleted) {
                html += this.renderBountyCard(b, 'completed');
            }
        }

        if (available.length === 0 && accepted.length === 0 && recentCompleted.length === 0) {
            html += `<div class="bounty-empty">No bounties available. Check back later.</div>`;
        }

        html += `<div class="bounty-info">`;
        html += `<p>Bounties are placed on known Shadow Cartel pirates operating in the area. Accept a contract, hunt the target, and collect your reward.</p>`;
        html += `<p>Maximum 3 active bounty contracts. Bounties expire after 30 minutes.</p>`;
        html += `</div>`;

        html += `</div>`;
        container.innerHTML = html;

        // Wire up buttons
        container.querySelectorAll('[data-bounty-accept]').forEach(btn => {
            btn.addEventListener('click', () => this.acceptBounty(parseInt(btn.dataset.bountyAccept)));
        });
        container.querySelectorAll('[data-bounty-abandon]').forEach(btn => {
            btn.addEventListener('click', () => this.abandonBounty(parseInt(btn.dataset.bountyAbandon)));
        });
    }

    renderBountyCard(bounty, status) {
        const shipData = SHIP_DATABASE[bounty.targetShipClass];
        const shipName = shipData?.name || bounty.targetShipClass;
        const size = shipData?.size || 'unknown';
        const roleName = bounty.targetRole === 'raider' ? 'Raider' : 'Bomber';
        const dangerClass = bounty.killCount > 3 ? 'extreme' : bounty.killCount > 1 ? 'high' : 'moderate';

        let html = `<div class="bounty-card bounty-${status}">`;

        // Wanted poster header
        html += `<div class="bounty-card-header">`;
        html += `<span class="bounty-danger-tag danger-${dangerClass}">${bounty.dangerTitle}</span>`;
        if (status === 'completed') {
            html += `<span class="bounty-status-tag bounty-claimed-tag">CLAIMED</span>`;
        }
        html += `</div>`;

        // Target info
        html += `<div class="bounty-card-body">`;
        html += `<div class="bounty-target-info">`;
        html += `<div class="bounty-target-name">${bounty.targetName}</div>`;
        html += `<div class="bounty-target-details">`;
        html += `<span class="bounty-detail">${shipName} (${size})</span>`;
        html += `<span class="bounty-detail">${roleName} - ${bounty.factionName}</span>`;
        html += `</div>`;
        if (bounty.killCount > 0) {
            html += `<div class="bounty-kills">Known kills: <span class="bounty-kill-count">${bounty.killCount}</span></div>`;
        }
        html += `</div>`;

        // Location & reward
        html += `<div class="bounty-meta">`;
        html += `<div class="bounty-location"><span class="bounty-label">LAST SEEN</span><span class="bounty-value">${bounty.sectorHint}</span></div>`;
        html += `<div class="bounty-reward-display"><span class="bounty-label">REWARD</span><span class="bounty-reward-amount">${formatCredits(bounty.reward)} ISK</span></div>`;
        html += `</div>`;
        html += `</div>`;

        // Action button
        html += `<div class="bounty-card-footer">`;
        if (status === 'available') {
            html += `<button class="buy-btn bounty-accept-btn" data-bounty-accept="${bounty.id}">ACCEPT CONTRACT</button>`;
        } else if (status === 'accepted') {
            html += `<button class="buy-btn bounty-abandon-btn" data-bounty-abandon="${bounty.id}">ABANDON</button>`;
            const remaining = Math.max(0, bounty.expiresAt - Date.now());
            const mins = Math.floor(remaining / 60000);
            html += `<span class="bounty-timer">${mins}m remaining</span>`;
        } else if (status === 'completed') {
            html += `<span class="bounty-claimed-text">+${formatCredits(bounty.reward)} ISK collected</span>`;
        }
        html += `</div>`;

        html += `</div>`;
        return html;
    }

    /**
     * Show tactical replay for an AAR report
     */
    showTacticalReplay(report) {
        this.tacticalReplay?.show(report);
    }
}

// Make UIManager globally accessible for onclick handlers
window.game = window.game || {};
