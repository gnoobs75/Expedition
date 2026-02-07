// =============================================
// Panel Drag Manager
// Handles draggable UI panels with Z key toggle
// =============================================

export class PanelDragManager {
    constructor(game) {
        this.game = game;

        // Move mode state
        this.moveMode = false;

        // Registered panels
        this.panels = new Map();

        // Drag state
        this.dragging = null;
        this.dragOffset = { x: 0, y: 0 };

        // Default positions for each panel
        this.defaultPositions = {
            'target-panel': { top: 10, left: 10 },
            'overview-panel': { top: 10, right: 10 },
            'event-log': { bottom: 10, left: 10 },
            'minimap': { bottom: 10, right: 10 },
            'dscan-panel': { top: 200, right: 10 },
            'bookmarks-panel': { top: 400, right: 10 },
            'object-viewer': { top: 10, left: 310 },
        };

        // Storage key
        this.storageKey = 'expedition-panel-positions';

        // Bind methods
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * Initialize the drag manager
     */
    init() {
        // Set up global mouse listeners for drag operations
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // Keep panels in bounds on window resize
        window.addEventListener('resize', () => this.constrainAllPanels());
    }

    /**
     * Constrain all panels to viewport bounds
     */
    constrainAllPanels() {
        for (const [panelId, panelData] of this.panels) {
            const panel = panelData.element;
            if (!panel || panel.classList.contains('hidden')) continue;

            const rect = panel.getBoundingClientRect();
            let changed = false;

            if (rect.right > window.innerWidth) {
                panel.style.left = `${Math.max(0, window.innerWidth - rect.width)}px`;
                panel.style.right = 'auto';
                changed = true;
            }
            if (rect.bottom > window.innerHeight) {
                panel.style.top = `${Math.max(0, window.innerHeight - rect.height)}px`;
                panel.style.bottom = 'auto';
                changed = true;
            }
        }
    }

    /**
     * Register a panel for drag management
     */
    registerPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) {
            console.warn(`[PanelDragManager] Panel not found: ${panelId}`);
            return;
        }

        // Skip docked panels - they should not be draggable
        if (panel.classList.contains('docked')) return;

        // Store panel reference (header will be set below)
        const panelData = {
            element: panel,
            header: null,
        };
        this.panels.set(panelId, panelData);

        // Apply saved or default position
        this.applyPosition(panelId);

        // Add mousedown listener to header (or label for minimap, or entire panel as fallback)
        const header = panel.querySelector('.panel-header') ||
                       panel.querySelector('#minimap-label') ||
                       panel;
        if (header) {
            header.addEventListener('mousedown', (e) => this.handleMouseDown(e, panelId));
            header.style.cursor = 'default';
            // Store reference for cursor updates
            panelData.header = header;
        }
    }

    /**
     * Toggle move mode on/off
     */
    toggleMoveMode() {
        this.moveMode = !this.moveMode;

        // Update visual state for all panels
        for (const [panelId, panelData] of this.panels) {
            const { element, header } = panelData;

            if (this.moveMode) {
                element.classList.add('move-mode');
                if (header) {
                    header.style.cursor = 'grab';
                }
            } else {
                element.classList.remove('move-mode');
                if (header) {
                    header.style.cursor = 'default';
                }
            }
        }

        // Show indicator
        this.showModeIndicator();

        // Log status
        this.game.ui?.log(
            this.moveMode ? 'Panel move mode: ON (drag headers)' : 'Panel move mode: OFF',
            'system'
        );

        return this.moveMode;
    }

    /**
     * Show visual indicator for move mode
     */
    showModeIndicator() {
        // Remove existing indicator
        const existing = document.getElementById('move-mode-indicator');
        if (existing) {
            existing.remove();
        }

        if (this.moveMode) {
            const indicator = document.createElement('div');
            indicator.id = 'move-mode-indicator';
            indicator.textContent = 'MOVE MODE - Drag panel headers (Z to exit)';
            document.body.appendChild(indicator);
        }
    }

    /**
     * Handle mouse down on panel header
     */
    handleMouseDown(e, panelId) {
        // Only drag in move mode
        if (!this.moveMode) return;

        // Only left click
        if (e.button !== 0) return;

        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        e.preventDefault();
        e.stopPropagation();

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();

        // Calculate offset from mouse to panel corner
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };

        // Start dragging
        this.dragging = panelId;
        panel.classList.add('dragging');

        // Update cursor
        if (panelData.header) {
            panelData.header.style.cursor = 'grabbing';
        }
    }

    /**
     * Handle mouse move during drag
     */
    handleMouseMove(e) {
        if (!this.dragging) return;

        const panelData = this.panels.get(this.dragging);
        if (!panelData) return;

        const panel = panelData.element;

        // Calculate new position
        let newX = e.clientX - this.dragOffset.x;
        let newY = e.clientY - this.dragOffset.y;

        // Constrain to viewport
        const rect = panel.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        // Apply position (use left/top, clear right/bottom)
        panel.style.left = `${newX}px`;
        panel.style.top = `${newY}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    /**
     * Handle mouse up to end drag
     */
    handleMouseUp(e) {
        if (!this.dragging) return;

        const panelData = this.panels.get(this.dragging);
        if (panelData) {
            panelData.element.classList.remove('dragging');

            // Update cursor
            if (panelData.header) {
                panelData.header.style.cursor = this.moveMode ? 'grab' : 'default';
            }
        }

        // Save positions after drag
        this.savePositions();

        this.dragging = null;
    }

    /**
     * Apply position to a panel (saved or default)
     */
    applyPosition(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        const savedPositions = this.getSavedPositions();
        const position = savedPositions[panelId] || this.defaultPositions[panelId];

        if (!position) return;

        // Clear all position properties first
        panel.style.top = 'auto';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = 'auto';

        // Apply position
        if (position.top !== undefined) panel.style.top = `${position.top}px`;
        if (position.right !== undefined) panel.style.right = `${position.right}px`;
        if (position.bottom !== undefined) panel.style.bottom = `${position.bottom}px`;
        if (position.left !== undefined) panel.style.left = `${position.left}px`;
    }

    /**
     * Get saved positions from localStorage
     */
    getSavedPositions() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('[PanelDragManager] Failed to load positions:', e);
            return {};
        }
    }

    /**
     * Save current positions to localStorage
     */
    savePositions() {
        const positions = {};

        for (const [panelId, panelData] of this.panels) {
            const panel = panelData.element;
            const rect = panel.getBoundingClientRect();

            // Save as top/left
            positions[panelId] = {
                top: rect.top,
                left: rect.left,
            };
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(positions));
        } catch (e) {
            console.warn('[PanelDragManager] Failed to save positions:', e);
        }
    }

    /**
     * Reset all panels to default positions
     */
    resetPositions() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            // Ignore
        }

        for (const panelId of this.panels.keys()) {
            this.applyPosition(panelId);
        }

        this.game.ui?.log('Panel positions reset to defaults', 'system');
    }

    /**
     * Check if move mode is active
     */
    isMoveModeActive() {
        return this.moveMode;
    }
}
