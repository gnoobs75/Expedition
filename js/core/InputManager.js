// =============================================
// Input Manager - Handles mouse/keyboard input
// Uses KeyBindings for customizable controls
// =============================================

import { CONFIG } from '../config.js';
import { keyBindings } from './KeyBindings.js';

export class InputManager {
    constructor(game) {
        this.game = game;

        // Mouse state
        this.mouse = {
            x: 0,
            y: 0,
            worldX: 0,
            worldY: 0,
            down: false,
            rightDown: false,
            dragging: false,
            dragStart: { x: 0, y: 0 },
        };

        // Keyboard state
        this.keys = new Map();

        // Key rebinding state
        this.rebindingAction = null;

        // Double-click tracking
        this.lastClickTime = 0;
        this.lastClickPos = { x: 0, y: 0 };
        this.doubleClickThreshold = 300; // ms

        // Bind events
        this.setupEventListeners();
    }

    setupEventListeners() {
        const gameContainer = document.getElementById('game-container');

        // Mouse events on window to capture all mouse activity
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Wheel on window for zooming (game container may be behind overlay)
        window.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Click on window for selection (will filter UI elements in handler)
        window.addEventListener('click', this.onClick.bind(this));

        // Double-click for approach
        window.addEventListener('dblclick', this.onDoubleClick.bind(this));

        // Keyboard events
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));

        // Prevent context menu globally (entire window)
        window.addEventListener('contextmenu', (e) => {
            // Only allow context menu on text inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return true;
            }
            e.preventDefault();
            e.stopPropagation();
            return false;
        });
    }

    /**
     * Convert screen coordinates to world coordinates
     * Must match Renderer.updateCamera frustum: viewHeight = 1000000 / zoom
     */
    screenToWorld(screenX, screenY) {
        const camera = this.game.camera;
        if (!camera) return { x: screenX, y: screenY };

        const viewHeight = 1000000 / camera.zoom;
        const viewWidth = viewHeight * (window.innerWidth / window.innerHeight);

        return {
            x: ((screenX - window.innerWidth / 2) / window.innerWidth) * viewWidth + camera.x,
            y: -((screenY - window.innerHeight / 2) / window.innerHeight) * viewHeight + camera.y,
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     * Inverse of screenToWorld
     */
    worldToScreen(worldX, worldY) {
        const camera = this.game.camera;
        if (!camera) return { x: worldX, y: worldY };

        const viewHeight = 1000000 / camera.zoom;
        const viewWidth = viewHeight * (window.innerWidth / window.innerHeight);

        return {
            x: ((worldX - camera.x) / viewWidth) * window.innerWidth + window.innerWidth / 2,
            y: -((worldY - camera.y) / viewHeight) * window.innerHeight + window.innerHeight / 2,
        };
    }

    onMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;

        const world = this.screenToWorld(e.clientX, e.clientY);
        this.mouse.worldX = world.x;
        this.mouse.worldY = world.y;

        // Handle dragging for camera pan
        if (this.mouse.down && !this.mouse.rightDown) {
            const dx = e.clientX - this.mouse.dragStart.x;
            const dy = e.clientY - this.mouse.dragStart.y;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                this.mouse.dragging = true;
            }
        }
    }

    onMouseDown(e) {
        if (e.button === 0) {
            this.mouse.down = true;
            this.mouse.dragStart.x = e.clientX;
            this.mouse.dragStart.y = e.clientY;
        } else if (e.button === 2) {
            this.mouse.rightDown = true;
            // Only show context menu if not clicking on UI
            if (!this.isClickOnUI(e)) {
                this.showContextMenu(e);
            }
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            this.mouse.down = false;
            this.mouse.dragging = false;
        } else if (e.button === 2) {
            this.mouse.rightDown = false;
        }
    }

    /**
     * Check if a click event is on an interactive UI element (not game world)
     */
    isClickOnUI(e) {
        if (!e.target?.closest) return false;
        return !!e.target.closest('.panel:not(.hidden), #module-rack, #bottom-bar, .modal:not(.hidden), #context-menu:not(.hidden), #ship-indicator, #drone-bar:not(.hidden), #performance-monitor, #locked-targets-container, button, .menu-item, #encyclopedia:not(.hidden), #skill-tree-modal:not(.hidden)');
    }

    onClick(e) {
        // Don't select if we were dragging
        if (this.mouse.dragging) return;

        // Block clicks on interactive UI elements
        if (this.isClickOnUI(e)) return;

        // Find clicked entity
        const world = this.screenToWorld(e.clientX, e.clientY);
        const entity = this.findEntityAt(world.x, world.y);

        if (entity) {
            this.game.selectTarget(entity);
        } else {
            this.game.selectTarget(null);
        }
    }

    /**
     * Handle double-click for approach
     */
    onDoubleClick(e) {
        // Block on interactive UI elements
        if (this.isClickOnUI(e)) return;

        // Get world position of double-click
        const world = this.screenToWorld(e.clientX, e.clientY);

        // Check if there's an entity at this position
        const entity = this.findEntityAt(world.x, world.y);

        if (entity) {
            this.game.selectTarget(entity);
            this.game.autopilot?.approach(entity);
        } else {
            this.game.autopilot?.approachPosition(world.x, world.y);
        }
    }

    /**
     * Find entity at world position
     */
    findEntityAt(x, y) {
        const entities = this.game.getVisibleEntities();
        const camera = this.game.camera;

        // Calculate click radius in world units (30 screen pixels)
        const viewHeight = 1000000 / camera.zoom;
        const pixelToWorld = viewHeight / window.innerHeight;
        const clickRadius = 30 * pixelToWorld;

        let closest = null;
        let closestDist = Infinity;

        for (const entity of entities) {
            const dx = entity.x - x;
            const dy = entity.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if within entity radius + click tolerance
            const entityRadius = (entity.radius || 20) + clickRadius;
            if (dist < entityRadius && dist < closestDist) {
                closest = entity;
                closestDist = dist;
            }
        }

        return closest;
    }

    /**
     * Show context menu for right-click
     */
    showContextMenu(e) {
        // Already filtered by onMouseDown via isClickOnUI

        // Find entity under cursor
        const world = this.screenToWorld(e.clientX, e.clientY);
        const entity = this.findEntityAt(world.x, world.y);

        // Select the entity if found (sync selection with game world click)
        if (entity) {
            this.game.selectTarget(entity);
        }

        // Show context menu via UI manager (pass world position for location-based actions)
        this.game.ui?.showContextMenu(e.clientX, e.clientY, entity, world);
    }

    onWheel(e) {
        // Don't zoom when scrolling inside UI panels
        if (this.isClickOnUI(e)) return;

        e.preventDefault();

        const zoomDelta = e.deltaY > 0 ? -1 : 1;
        this.game.camera.adjustZoom(zoomDelta);
    }

    onKeyDown(e) {
        this.keys.set(e.code, true);

        // Handle key rebinding mode
        if (this.rebindingAction) {
            this.handleRebind(e);
            return;
        }

        // Handle hotkeys using keybindings
        this.handleHotkey(e);
    }

    onKeyUp(e) {
        this.keys.set(e.code, false);
    }

    /**
     * Check if a key is currently pressed
     */
    isKeyDown(code) {
        return this.keys.get(code) === true;
    }

    /**
     * Start listening for a key rebind
     */
    startRebind(action) {
        this.rebindingAction = action;
        document.getElementById('rebind-overlay').classList.remove('hidden');
        document.getElementById('rebind-action-name').textContent =
            keyBindings.getBinding(action)?.description || action;
    }

    /**
     * Cancel key rebinding
     */
    cancelRebind() {
        this.rebindingAction = null;
        document.getElementById('rebind-overlay').classList.add('hidden');
    }

    /**
     * Handle key press during rebind mode
     */
    handleRebind(e) {
        e.preventDefault();
        e.stopPropagation();

        // Cancel on Escape
        if (e.code === 'Escape') {
            this.cancelRebind();
            return;
        }

        // Get the key string
        const keyStr = keyBindings.eventToKeyString(e);

        // Set the new binding
        keyBindings.setKey(this.rebindingAction, keyStr);

        // Update UI
        this.game.ui?.updateKeybindingsPanel();

        // End rebind mode
        this.cancelRebind();

        this.game.audio?.play('click');
    }

    /**
     * Handle keyboard hotkeys using keybindings
     */
    handleHotkey(e) {
        // Don't handle if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Don't handle if settings panel is open (except Escape)
        const settingsOpen = !document.getElementById('settings-panel').classList.contains('hidden');

        // Get the key string for this event
        const keyStr = keyBindings.eventToKeyString(e);

        // Find the action for this key
        const action = keyBindings.getAction(keyStr);

        if (!action) {
            // Enter to quick-dock when near station
            if (e.code === 'Enter' && !this.game.dockedAt) {
                const player = this.game.player;
                const entities = this.game.currentSector?.entities || [];
                for (const entity of entities) {
                    if (entity.alive && (entity.type === 'station' || entity.type === 'player-station') && player?.distanceTo(entity) < 300) {
                        this.game.dockAtStation(entity);
                        return;
                    }
                }
            }
            // Check for Escape to close context menu, settings, overlays, or deselect
            if (e.code === 'Escape') {
                const contextMenu = document.getElementById('context-menu');
                const contextMenuOpen = contextMenu && !contextMenu.classList.contains('hidden');
                const helpOpen = !document.getElementById('keybind-overlay')?.classList?.contains('hidden');

                if (contextMenuOpen) {
                    this.game.ui?.hideContextMenu();
                } else if (helpOpen) {
                    this.game.ui?.toggleKeybindOverlay();
                } else if (settingsOpen) {
                    this.game.ui?.hideSettings();
                } else {
                    this.game.selectTarget(null);
                }
            }
            return;
        }

        // If settings is open, only allow closing it
        if (settingsOpen) {
            return;
        }

        // Execute the action
        this.executeAction(action, e);
    }

    /**
     * Execute a keybinding action
     */
    executeAction(action, e) {
        // During tactical pause, only allow stop (to unpause) and targeting/UI actions
        if (this.game.tacticalPaused && action !== 'stop' && action !== 'lockTarget'
            && action !== 'unlockTarget' && action !== 'cycleTargets'
            && action !== 'nearestHostile' && action !== 'deselectTarget') {
            return;
        }

        switch (action) {
            // Navigation
            case 'stop':
                e.preventDefault();
                // Context-sensitive: tactical pause if hostiles nearby, otherwise stop ship
                if (this.game.tacticalPaused) {
                    this.game.tacticalPause?.deactivate();
                } else if (this.game.tacticalPause?.canToggle() && this.game.tacticalPause.hasNearbyHostiles()) {
                    this.game.tacticalPause.activate();
                } else {
                    this.game.autopilot.stop();
                }
                break;

            case 'approach':
                if (this.game.selectedTarget) {
                    this.game.autopilot.approach(this.game.selectedTarget);
                }
                break;

            case 'orbit':
                if (this.game.selectedTarget) {
                    this.game.autopilot.orbit(this.game.selectedTarget, 500);
                }
                break;

            case 'keepAtRange':
                if (this.game.selectedTarget) {
                    this.game.autopilot.keepAtRange(this.game.selectedTarget, 1000);
                }
                break;

            case 'warpTo':
                if (this.game.selectedTarget) {
                    this.game.autopilot.warpTo(this.game.selectedTarget);
                }
                break;

            case 'centerCamera':
                this.game.camera.centerOnPlayer();
                break;

            // Targeting
            case 'lockTarget':
                if (this.game.selectedTarget) {
                    this.game.lockTarget(this.game.selectedTarget);
                }
                break;

            case 'unlockTarget':
                // If a specific target is selected and locked, unlock it; otherwise unlock most recent
                if (this.game.selectedTarget?.locked) {
                    this.game.unlockTarget(this.game.selectedTarget);
                } else {
                    this.game.unlockTarget();
                }
                break;

            case 'cycleTargets':
                e.preventDefault();
                this.cycleTargets();
                break;

            case 'targetNearestHostile':
                this.targetNearestHostile();
                break;

            case 'deselectTarget':
                this.game.selectTarget(null);
                this.game.ui?.hideContextMenu();
                break;

            // Modules
            case 'module1':
                e.preventDefault();
                this.game.player?.toggleModule(0);
                break;
            case 'module2':
                e.preventDefault();
                this.game.player?.toggleModule(1);
                break;
            case 'module3':
                e.preventDefault();
                this.game.player?.toggleModule(2);
                break;
            case 'module4':
                e.preventDefault();
                this.game.player?.toggleModule(3);
                break;
            case 'module5':
                e.preventDefault();
                this.game.player?.toggleModule(4);
                break;
            case 'module6':
                e.preventDefault();
                this.game.player?.toggleModule(5);
                break;
            case 'module7':
                e.preventDefault();
                this.game.player?.toggleModule(6);
                break;
            case 'module8':
                e.preventDefault();
                this.game.player?.toggleModule(7);
                break;

            // UI Panels
            case 'toggleDScan':
                // If panel is visible, perform scan; otherwise toggle panel
                if (!this.game.ui?.elements?.dscanPanel?.classList?.contains('hidden')) {
                    this.game.ui?.performDScan();
                } else {
                    this.game.ui?.toggleDScan();
                }
                break;

            case 'toggleBookmarks':
                this.game.ui?.toggleBookmarks();
                break;

            case 'addBookmark':
                e.preventDefault();
                this.game.addBookmark();
                break;

            case 'toggleSettings':
                this.game.ui?.toggleSettings();
                break;

            case 'toggleOverview':
                this.game.ui?.toggleOverview();
                break;

            case 'toggleMap':
                this.game.ui?.toggleMap();
                break;

            case 'toggleMoveMode':
                this.game.ui?.toggleMoveMode();
                break;

            case 'toggleObjectViewer':
                this.game.ui?.toggleObjectViewer();
                break;

            case 'toggleShipMenu':
                this.game.ui?.toggleShipMenu();
                break;

            case 'togglePerformanceMonitor':
                e.preventDefault();
                this.game.ui?.togglePerformanceMonitor();
                break;

            case 'toggleModelEditor':
                this.game.ui?.toggleModelEditor();
                break;

            case 'toggleFleet':
                this.game.ui?.toggleFleet();
                break;

            case 'toggleQuestTracker':
                this.game.ui?.questTracker?.toggle();
                break;

            case 'spawnBattleEvent':
                this.game.npcSystem?.spawnBattleEvent();
                break;

            case 'toggleAdminDashboard':
                this.game.adminDashboard?.toggle();
                break;

            case 'toggleEncyclopedia':
                this.game.encyclopedia?.toggle();
                break;

            case 'toggleMinimap': {
                const minimap = document.getElementById('minimap');
                if (minimap) minimap.classList.toggle('hidden');
                break;
            }

            case 'toggleHelp':
                this.game.ui?.toggleKeybindOverlay();
                break;

            case 'toggleStats':
                this.game.ui?.toggleStats();
                break;

            case 'toggleAchievements':
                this.game.ui?.toggleAchievements();
                break;

            case 'toggleShipLog':
                this.game.ui?.toggleShipLog();
                break;

            case 'toggleTactical':
                this.game.ui?.toggleTacticalOverlay();
                break;

            case 'toggleCombatLog':
                this.game.ui?.toggleCombatLog();
                break;

            case 'toggleLocalChat':
                this.game.ui?.localChatManager?.toggle();
                break;

            case 'toggleSkippy':
                this.game.ui?.toggleSkippy();
                break;

            case 'toggleSkillTree':
                this.game.skillTreeRenderer?.toggle();
                break;

            case 'toggleSensorSweep': {
                const enabled = this.game.renderer?.toggleSensorSweep();
                this.game.ui?.showToast(enabled ? 'Sensor sweep active' : 'Sensor sweep disabled', 'system');
                break;
            }

            case 'toggleWeaponRange': {
                const on = this.game.renderer?.toggleWeaponRange();
                this.game.ui?.showToast(on ? 'Weapon range overlay ON' : 'Weapon range overlay OFF', 'system');
                break;
            }

            case 'quickSave': {
                e.preventDefault();
                const ok = this.game.saveManager?.save('slot-1');
                if (ok) {
                    this.game.ui?.showToast('Game saved to Slot 1', 'success');
                    this.game.audio?.play('click');
                } else {
                    this.game.ui?.showToast('Save failed', 'error');
                }
                break;
            }

            // Weapon Groups
            case 'fireGroup1':
            case 'fireGroup2':
            case 'fireGroup3': {
                const weapGroupNum = parseInt(action.replace('fireGroup', ''));
                this.game.fireWeaponGroup(weapGroupNum);
                break;
            }

            // Propulsion module toggle
            case 'activatePropmod':
                this.game.togglePropmod();
                break;

            // Fleet Control Groups - Select
            case 'selectGroup1':
            case 'selectGroup2':
            case 'selectGroup3':
            case 'selectGroup4':
            case 'selectGroup5': {
                const groupNum = parseInt(action.replace('selectGroup', ''));
                this.game.ui?.fleetPanelManager?.selectGroup(groupNum);
                this.game.audio?.play('click');
                break;
            }

            // Fleet Control Groups - Assign
            case 'assignGroup1':
            case 'assignGroup2':
            case 'assignGroup3':
            case 'assignGroup4':
            case 'assignGroup5': {
                e.preventDefault();
                const assignNum = parseInt(action.replace('assignGroup', ''));
                this.game.ui?.fleetPanelManager?.assignSelectedToGroup(assignNum);
                this.game.audio?.play('click');
                break;
            }

            // Fleet-wide Commands
            case 'fleetFollowAll':
                this.game.fleetSystem?.commandAll('following', this.game.selectedTarget);
                this.game.ui?.showToast('Fleet: Follow', 'system');
                break;
            case 'fleetAttackAll':
                this.game.fleetSystem?.commandAll('attacking', this.game.selectedTarget);
                this.game.ui?.showToast('Fleet: Attack', 'system');
                break;
            case 'fleetMineAll':
                this.game.fleetSystem?.commandAll('mining', this.game.selectedTarget);
                this.game.ui?.showToast('Fleet: Mine', 'system');
                break;
            case 'fleetDefendAll':
                this.game.fleetSystem?.commandAll('defending', this.game.selectedTarget);
                this.game.ui?.showToast('Fleet: Defend', 'system');
                break;
            case 'fleetHoldAll':
                this.game.fleetSystem?.commandAll('holding', null);
                this.game.ui?.showToast('Fleet: Hold Position', 'system');
                break;
        }
    }

    /**
     * Cycle through nearby targets
     */
    cycleTargets() {
        const entities = this.game.getVisibleEntities()
            .filter(e => e !== this.game.player)
            .sort((a, b) => {
                const distA = Math.hypot(a.x - this.game.player.x, a.y - this.game.player.y);
                const distB = Math.hypot(b.x - this.game.player.x, b.y - this.game.player.y);
                return distA - distB;
            });

        if (entities.length === 0) return;

        const currentIndex = entities.indexOf(this.game.selectedTarget);
        const nextIndex = (currentIndex + 1) % entities.length;

        this.game.selectTarget(entities[nextIndex]);
    }

    /**
     * Target the nearest hostile entity
     */
    targetNearestHostile() {
        const player = this.game.player;
        if (!player) return;

        const hostiles = this.game.getVisibleEntities()
            .filter(e => e !== player && e.alive &&
                (e.hostility === 'hostile' || e.type === 'enemy' || e.isPirate))
            .sort((a, b) => {
                const distA = Math.hypot(a.x - player.x, a.y - player.y);
                const distB = Math.hypot(b.x - player.x, b.y - player.y);
                return distA - distB;
            });

        if (hostiles.length > 0) {
            // If already targeting a hostile, cycle to next hostile
            const currentIdx = hostiles.indexOf(this.game.selectedTarget);
            const nextIdx = (currentIdx + 1) % hostiles.length;
            this.game.selectTarget(hostiles[nextIdx]);
            this.game.audio?.play('click');
        }
    }
}
