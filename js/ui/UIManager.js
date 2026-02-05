// =============================================
// UI Manager
// Handles all HTML/CSS UI overlays
// =============================================

import { CONFIG } from '../config.js';
import { formatDistance, formatCredits } from '../utils/math.js';
import { keyBindings } from '../core/KeyBindings.js';
import { PanelDragManager } from './PanelDragManager.js';
import { ShipMenuManager } from './ShipMenuManager.js';
import { SectorMapManager } from './SectorMapManager.js';
import { PerformanceMonitor } from '../utils/PerformanceMonitor.js';

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

        // Panel drag manager
        this.panelDragManager = new PanelDragManager(game);

        // Ship menu manager (for C key)
        this.shipMenuManager = new ShipMenuManager(game);

        // Sector map manager (for M key)
        this.sectorMapManager = new SectorMapManager(game);

        // Performance monitor
        this.performanceMonitor = new PerformanceMonitor(game);

        // Initialize UI
        this.setupEventListeners();
        this.initPanelDragManager();

        // Log messages
        this.maxLogMessages = 50;

        // Previous health values for warning flash
        this.prevHealth = { shield: 100, armor: 100, hull: 100, capacitor: 100 };

        // D-Scan state for cone visualization
        this.dscanAngle = 60;
        this.dscanRange = 10000;
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

            // Speed and credits
            speedValue: document.getElementById('speed-value'),
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

            // Drone Bar
            droneBar: document.getElementById('drone-bar'),

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

        // Context menu items (including submenu items)
        document.querySelectorAll('.menu-item, .submenu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling to parent items or document

                // Don't trigger action for submenu parent items
                if (item.classList.contains('has-submenu')) {
                    return;
                }

                const action = item.dataset.action;
                if (action) {
                    this.handleContextMenuAction(action);
                }
            });
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
                this.game.player?.toggleModule(index);
                this.game.audio?.play('click');
            });
        });

        // Station panel tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
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
            }
        });

        // Sell all ore button
        document.getElementById('sell-all-ore-btn')?.addEventListener('click', () => {
            this.sellAllOre();
        });

        // D-Scan range/angle sliders
        document.getElementById('dscan-range')?.addEventListener('input', (e) => {
            this.dscanRange = parseInt(e.target.value);
        });

        document.getElementById('dscan-angle')?.addEventListener('input', (e) => {
            this.dscanAngle = parseInt(e.target.value);
        });

        // Drone command buttons
        document.querySelectorAll('.drone-cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                this.handleDroneCommand(cmd);
            });
        });

        // Ship indicator right-click for drone launch/recall
        document.getElementById('ship-indicator')?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showShipIndicatorContextMenu(e.clientX, e.clientY);
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

        // Show menu
        const menu = this.elements.contextMenu;
        menu.innerHTML = menuHtml;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Set up click handlers
        menu.querySelectorAll('.menu-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                if (action === 'launch-drones') {
                    player.launchAllDrones();
                } else if (action === 'recall-drones') {
                    player.recallAllDrones();
                }
                this.hideContextMenu();
                this.game.audio?.play('click');
            }, { once: true });
        });
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
        this.panelDragManager.registerPanel('performance-monitor');
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
        }

        if (this.overviewTimer >= CONFIG.OVERVIEW_UPDATE_RATE / 1000) {
            this.overviewTimer = 0;
            this.updateOverview();
        }
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

        // Critical state warnings
        this.elements.hullContainer?.classList.toggle('critical', health.hull < 25);
        this.elements.capacitorContainer?.classList.toggle('critical', health.capacitor < 20);

        // Update speed
        this.elements.speedValue.textContent = Math.floor(player.currentSpeed);

        // Update credits
        this.elements.creditsValue.textContent = formatCredits(this.game.credits);

        // Update cargo display
        this.updateCargoDisplay(player);

        // Update locked targets display
        this.updateLockedTargetsDisplay();

        // Store previous health values
        this.prevHealth = { ...health };
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

        // Audio warning cues for critical states
        // Shield warning when dropping below 25%
        if (type === 'shield' && currentValue < 25 && prevValue >= 25) {
            this.game.audio?.play('shield-low');
        }

        // Hull critical warning when dropping below 25%
        if (type === 'hull' && currentValue < 25 && prevValue >= 25) {
            this.game.audio?.play('warning');
        }

        // Capacitor low warning when dropping below 20%
        if (type === 'capacitor' && currentValue < 20 && prevValue >= 20) {
            this.game.audio?.play('capacitor-low');
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
        } else if (percent >= 80) {
            this.elements.cargoBar.classList.add('warning');
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
        this.elements.targetName.textContent = target.name;
        this.elements.targetType.textContent = target.type.toUpperCase();

        // Distance
        const dist = this.game.player?.distanceTo(target) || 0;
        this.elements.targetDistance.textContent = formatDistance(dist);

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
    }

    /**
     * Update ship status indicator
     */
    updateShipIndicator() {
        const indicator = this.elements.shipIndicator;
        if (!indicator) return;

        const player = this.game.player;
        if (!player) return;

        const health = player.getHealthPercents();

        // Update ring clip-paths based on health percentages
        const shieldRing = indicator.querySelector('.ship-ring.shield');
        const armorRing = indicator.querySelector('.ship-ring.armor');
        const hullRing = indicator.querySelector('.ship-ring.hull');

        if (shieldRing) shieldRing.style.clipPath = `inset(0 ${100 - health.shield}% 0 0 round 50%)`;
        if (armorRing) armorRing.style.clipPath = `inset(0 ${100 - health.armor}% 0 0 round 50%)`;
        if (hullRing) hullRing.style.clipPath = `inset(0 ${100 - health.hull}% 0 0 round 50%)`;
    }

    /**
     * Update drone quick action bar
     */
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
                ships: ['enemy', 'ship'],
                stations: ['station'],
                asteroids: ['asteroid'],
                gates: ['gate'],
            };
            const types = typeMap[filter] || [];
            filtered = filtered.filter(e => types.includes(e.type));
        }

        // Sort by distance
        if (player) {
            filtered.sort((a, b) => {
                const distA = player.distanceTo(a);
                const distB = player.distanceTo(b);
                return distA - distB;
            });
        }

        // Limit to prevent performance issues
        filtered = filtered.slice(0, 50);

        // Build table rows
        const html = filtered.map(entity => {
            const dist = player ? formatDistance(player.distanceTo(entity)) : '-';
            const icon = this.getEntityIcon(entity);
            const hostility = entity.hostility || 'neutral';
            const selected = entity === this.game.selectedTarget ? 'selected' : '';

            // Calculate velocity
            let velocity = '-';
            let angularVel = '-';
            if (entity.velocity && player) {
                const speed = Math.sqrt(entity.velocity.x ** 2 + entity.velocity.y ** 2);
                velocity = speed > 1 ? `${Math.floor(speed)}` : '-';

                // Calculate angular velocity relative to player
                const distance = player.distanceTo(entity);
                if (distance > 0 && speed > 1) {
                    const dx = entity.x - player.x;
                    const dy = entity.y - player.y;
                    const angle = Math.atan2(dy, dx);
                    const relVelX = entity.velocity.x - (player.velocity?.x || 0);
                    const relVelY = entity.velocity.y - (player.velocity?.y || 0);
                    const transVel = Math.abs(relVelX * Math.sin(angle) - relVelY * Math.cos(angle));
                    const angVel = (transVel / distance) * 1000; // rad/s * 1000
                    angularVel = angVel > 0.01 ? angVel.toFixed(2) : '-';
                }
            }

            return `
                <tr class="${hostility} ${selected}" data-entity-id="${entity.id}">
                    <td class="col-icon overview-icon">${icon}</td>
                    <td class="col-name">${entity.name}</td>
                    <td class="col-type">${entity.type}</td>
                    <td class="col-dist">${dist}</td>
                    <td class="col-vel">${velocity}</td>
                    <td class="col-ang">${angularVel}</td>
                </tr>
            `;
        }).join('');

        this.elements.overviewBody.innerHTML = html;
    }

    /**
     * Get icon for entity type
     */
    getEntityIcon(entity) {
        const icons = {
            enemy: '&#9650;',    // Triangle
            ship: '&#9650;',
            station: '&#9632;',  // Square
            asteroid: '&#9671;', // Diamond
            gate: '&#10070;',    // Star
            planet: '&#9679;',   // Circle
            player: '&#9733;',   // Star
        };
        return icons[entity.type] || '&#9679;';
    }

    /**
     * Update module rack display
     */
    updateModuleRack() {
        const player = this.game.player;
        if (!player) return;

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

            tooltipEl.innerHTML = `
                <div class="module-tooltip-name">${config.name}</div>
                ${statsHtml}
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
        return icons[moduleId] || '&#9632;';
    }

    /**
     * Show context menu
     */
    showContextMenu(x, y, entity, worldPos = null) {
        const menu = this.elements.contextMenu;
        this.contextMenuTarget = entity;
        this.contextMenuWorldPos = worldPos; // Store world position for location-based actions

        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Update menu items based on target
        this.updateContextMenuItems(entity);
    }

    /**
     * Update context menu items based on target
     */
    updateContextMenuItems(entity) {
        const menu = this.elements.contextMenu;

        // Items that require a target
        const targetRequiredItems = [
            '.has-submenu', // Orbit and Keep at Range submenus
            '[data-action="lock"]',
            '[data-action="look-at"]',
        ];

        // Show/hide target-required items
        targetRequiredItems.forEach(selector => {
            menu.querySelectorAll(selector).forEach(item => {
                item.style.display = entity ? 'block' : 'none';
            });
        });

        // Show/hide separators based on whether target exists
        menu.querySelectorAll('.menu-separator').forEach(sep => {
            sep.style.display = entity ? 'block' : 'none';
        });

        // Show/hide dock option (only for stations)
        const dockItem = menu.querySelector('[data-action="dock"]');
        dockItem.style.display = entity?.type === 'station' ? 'block' : 'none';

        // Show/hide warp option (only if far enough)
        const warpItem = menu.querySelector('[data-action="warp"]');
        const dist = (entity && this.game.player) ? this.game.player.distanceTo(entity) : 0;
        warpItem.style.display = dist > 1000 ? 'block' : 'none';
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
            case 'look-at':
                this.game.camera.lookAt(target);
                this.game.selectTarget(target);
                break;
            case 'warp':
                this.game.autopilot.warpTo(target);
                break;
            case 'dock':
                if (target.type === 'station' && target.canDock(this.game.player)) {
                    this.game.dockAtStation(target);
                } else {
                    this.log('Too far to dock', 'system');
                }
                break;
            case 'bookmark':
                this.game.addBookmark(`Near ${target.name}`);
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
        element.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;

        container.appendChild(element);

        // Remove old messages
        while (container.children.length > this.maxLogMessages) {
            container.removeChild(container.firstChild);
        }

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Show station panel
     */
    showStationPanel(station) {
        this.elements.stationName.textContent = station.name;
        this.elements.stationPanel.classList.remove('hidden');

        // Populate shop
        this.updateShopPanel(station);

        // Populate refinery tab
        this.updateRefineryTab();
    }

    /**
     * Hide station panel
     */
    hideStationPanel() {
        this.elements.stationPanel.classList.add('hidden');
    }

    /**
     * Update shop panel content
     */
    updateShopPanel(station) {
        // Ships
        const shipsHtml = station.shipsForSale.map(shipId => {
            const config = CONFIG.SHIPS[shipId];
            return `
                <div class="shop-item">
                    <div class="item-info">
                        <div class="item-name">${config.name}</div>
                        <div class="item-desc">Speed: ${config.maxSpeed} | Shield: ${config.shield}</div>
                    </div>
                    <div class="item-price">${formatCredits(config.price)} ISK</div>
                    <button class="buy-btn" onclick="game.ui.buyShip('${shipId}')">BUY</button>
                </div>
            `;
        }).join('');
        document.getElementById('market-ships').innerHTML = shipsHtml;

        // Modules
        const modulesHtml = station.modulesForSale.map(modId => {
            const config = CONFIG.MODULES[modId];
            return `
                <div class="shop-item">
                    <div class="item-info">
                        <div class="item-name">${config.name}</div>
                        <div class="item-desc">${config.slot.toUpperCase()} slot</div>
                    </div>
                    <div class="item-price">${formatCredits(config.price)} ISK</div>
                    <button class="buy-btn" onclick="game.ui.buyModule('${modId}')">BUY</button>
                </div>
            `;
        }).join('');
        document.getElementById('market-modules').innerHTML = modulesHtml;

        // Repair cost
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

        // Clear cargo
        player.cargo = {};
        player.cargoUsed = 0;

        // Add credits
        this.game.addCredits(totalValue);

        // Log and feedback
        this.log(`Sold ${totalUnits.toLocaleString()} units of ore for ${formatCredits(totalValue)} ISK`, 'mining');
        this.game.audio?.play('buy');

        // Update display
        this.updateRefineryTab();
    }

    /**
     * Toggle D-Scan panel
     */
    toggleDScan() {
        this.elements.dscanPanel.classList.toggle('hidden');
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

        container.innerHTML = html || '<div style="color: var(--text-dim)">No bookmarks saved</div>';
    }

    /**
     * Perform directional scan
     */
    performDScan() {
        const range = parseInt(document.getElementById('dscan-range').value);
        const angle = parseInt(document.getElementById('dscan-angle').value);

        const player = this.game.player;
        if (!player) return;

        const entities = this.game.currentSector.getEntitiesInRadius(player.x, player.y, range);

        // Filter by angle (simplified - full 360 for now)
        const results = entities.filter(e => e !== player);

        const html = results.map(e => `
            <div style="padding: 5px; border-bottom: 1px solid var(--panel-border);">
                ${this.getEntityIcon(e)} ${e.name} - ${formatDistance(player.distanceTo(e))}
            </div>
        `).join('');

        document.getElementById('dscan-results').innerHTML = html || 'No objects detected';

        this.game.audio?.play('click');
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
        if (entity.type === 'station') {
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
     * Toggle panel move mode (Z key)
     */
    toggleMoveMode() {
        return this.panelDragManager.toggleMoveMode();
    }

    /**
     * Reset panel positions to defaults
     */
    resetPanelPositions() {
        this.panelDragManager.resetPositions();
    }
}

// Make UIManager globally accessible for onclick handlers
window.game = window.game || {};
