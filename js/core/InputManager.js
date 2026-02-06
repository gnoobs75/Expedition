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

        // Wheel on game container for zooming
        gameContainer.addEventListener('wheel', this.onWheel.bind(this));

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
     */
    screenToWorld(screenX, screenY) {
        const camera = this.game.camera;
        if (!camera) return { x: screenX, y: screenY };

        return {
            x: (screenX - window.innerWidth / 2) / camera.zoom + camera.x,
            y: (screenY - window.innerHeight / 2) / camera.zoom + camera.y,
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        const camera = this.game.camera;
        if (!camera) return { x: worldX, y: worldY };

        return {
            x: (worldX - camera.x) * camera.zoom + window.innerWidth / 2,
            y: (worldY - camera.y) * camera.zoom + window.innerHeight / 2,
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
        // Check if this is a game area interaction
        const isGameAreaClick = e.target.closest('#game-container') || e.target.tagName === 'CANVAS';
        const isUIClick = e.target.closest('.panel, #module-rack, #bottom-bar, .modal, #context-menu, #ship-indicator, #drone-bar, #performance-monitor, #locked-targets-container');

        if (e.button === 0) {
            this.mouse.down = true;
            this.mouse.dragStart.x = e.clientX;
            this.mouse.dragStart.y = e.clientY;
        } else if (e.button === 2) {
            this.mouse.rightDown = true;
            // Only show context menu for game area right-clicks
            if (isGameAreaClick && !isUIClick) {
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

    onClick(e) {
        console.log('onClick - target:', e.target.tagName, e.target.id, e.target.className);

        // Don't select if we were dragging
        if (this.mouse.dragging) return;

        // Check if clicking on actual UI elements that should block clicks
        const isUIClick = e.target.closest('.panel, #module-rack, #bottom-bar, .modal, #context-menu, #ship-indicator, #drone-bar, #performance-monitor, #locked-targets-container, button, .menu-item');

        if (isUIClick) {
            console.log('onClick - blocked by UI element');
            return;
        }

        // If we're clicking on ui-overlay itself (empty space) or game-container/canvas, it's a game click
        const isGameAreaClick = e.target.id === 'ui-overlay' ||
                                e.target.id === 'game-container' ||
                                e.target.closest('#game-container') ||
                                e.target.tagName === 'CANVAS';

        if (!isGameAreaClick) {
            console.log('onClick - not a game area click');
            return;
        }

        console.log('onClick - valid game area click, finding entity...');

        // Find clicked entity
        const world = this.screenToWorld(e.clientX, e.clientY);
        const entity = this.findEntityAt(world.x, world.y);

        if (entity) {
            console.log('onClick - found entity:', entity.name);
            this.game.selectTarget(entity);
        } else {
            console.log('onClick - no entity at position');
            this.game.selectTarget(null);
        }
    }

    /**
     * Handle double-click for approach
     */
    onDoubleClick(e) {
        console.log('onDoubleClick fired, target:', e.target.tagName, e.target.id, e.target.className);

        // Check if clicking on actual UI elements that should block the action
        const blockedElements = '.panel, #module-rack, #bottom-bar, .modal, #context-menu, #ship-indicator, #drone-bar, #performance-monitor, #locked-targets-container, button, .menu-item, .submenu-item';
        if (e.target.closest(blockedElements)) {
            console.log('Blocked by UI element');
            return;
        }

        // Get world position of double-click
        const world = this.screenToWorld(e.clientX, e.clientY);
        console.log('Screen click:', e.clientX, e.clientY, 'Window center:', window.innerWidth/2, window.innerHeight/2);
        console.log('Camera:', this.game.camera.x, this.game.camera.y, 'Zoom:', this.game.camera.zoom);
        console.log('World position:', world.x, world.y);

        // Check if there's an entity at this position
        const entity = this.findEntityAt(world.x, world.y);

        if (entity) {
            // Double-click on entity = select and approach
            console.log('Found entity:', entity.name);
            this.game.selectTarget(entity);
            this.game.autopilot?.approach(entity);
        } else {
            // Double-click on empty space = approach that location
            console.log('Empty space, calling approachPosition');
            this.game.autopilot?.approachPosition(world.x, world.y);
        }
    }

    /**
     * Find entity at world position
     */
    findEntityAt(x, y) {
        const entities = this.game.getVisibleEntities();
        const camera = this.game.camera;

        // Calculate click radius based on zoom
        const clickRadius = 30 / camera.zoom;

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
        // Don't show context menu on UI elements
        if (e.target.closest('.panel, #module-rack, #bottom-bar, .modal, #context-menu, #drone-bar, #performance-monitor, #locked-targets-container, button')) {
            return;
        }

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
            // Check for Escape to toggle settings
            if (e.code === 'Escape') {
                if (settingsOpen) {
                    this.game.ui?.hideSettings();
                } else {
                    // Regular escape behavior - deselect
                    this.game.selectTarget(null);
                    this.game.ui?.hideContextMenu();
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
        switch (action) {
            // Navigation
            case 'stop':
                e.preventDefault();
                this.game.autopilot.stop();
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
                if (this.game.selectedTarget && !this.game.lockedTarget) {
                    this.game.lockTarget(this.game.selectedTarget);
                }
                break;

            case 'unlockTarget':
                this.game.unlockTarget();
                break;

            case 'cycleTargets':
                e.preventDefault();
                this.cycleTargets();
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
                this.game.ui?.toggleDScan();
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
}
