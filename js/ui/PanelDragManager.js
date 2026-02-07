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
            'locked-targets-container': { top: 200, left: 10 },
            'ship-indicator': { bottom: 185, left: 20 },
            'drone-bar': { bottom: 185, left: 200 },
            'fleet-panel': { top: 300, left: 10 },
        };

        // Storage key - bump version to force reset when layout changes
        this.storageKey = 'expedition-panel-layout';
        this.layoutVersion = 3;
        this.versionKey = 'expedition-panel-layout-version';

        // Force reset if layout version changed
        const savedVersion = parseInt(localStorage.getItem(this.versionKey) || '0');
        if (savedVersion < this.layoutVersion) {
            localStorage.removeItem(this.storageKey);
            localStorage.setItem(this.versionKey, String(this.layoutVersion));
        }

        // Save debounce timer (for resize observer)
        this.saveTimer = null;

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

        // Constrain all panels shortly after init in case any loaded offscreen
        setTimeout(() => this.constrainAllPanels(), 500);

        // ResizeObserver to detect CSS resize-handle usage and save sizes
        this.resizeObserver = new ResizeObserver((entries) => {
            // Debounce saves while user is actively resizing
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.saveLayout(), 300);
        });
    }

    /**
     * Constrain all panels to viewport bounds
     */
    constrainAllPanels() {
        for (const [panelId, panelData] of this.panels) {
            this.constrainPanel(panelId);
        }
    }

    constrainPanel(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;
        const panel = panelData.element;
        if (!panel) return;

        // Skip hidden panels - they have no valid rect
        if (panel.classList.contains('hidden') || panel.offsetParent === null) return;

        const rect = panel.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Ensure the panel header (top 40px) is fully visible so user can always grab it
        const headerH = 40;
        const minVisible = Math.min(rect.width, 100); // at least 100px wide visible

        let left = rect.left;
        let top = rect.top;
        let changed = false;

        // Don't let the left edge go so far right that less than minVisible is showing
        if (left > vw - minVisible) {
            left = vw - minVisible;
            changed = true;
        }
        // Don't let the right edge go past the left side
        if (left + minVisible < 0) {
            left = 0;
            changed = true;
        }
        // Don't let the top go below the viewport (header must be visible)
        if (top > vh - headerH) {
            top = vh - headerH;
            changed = true;
        }
        // Don't let it go above the viewport
        if (top < 0) {
            top = 0;
            changed = true;
        }

        if (changed) {
            panel.style.left = `${Math.round(left)}px`;
            panel.style.top = `${Math.round(top)}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }
    }

    /**
     * Constrain a panel when it becomes visible (call after removing 'hidden' class)
     */
    onPanelShown(panelId) {
        requestAnimationFrame(() => this.constrainPanel(panelId));
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

        // Apply saved position and size
        this.applyLayout(panelId);

        // Constrain to viewport immediately after applying layout
        requestAnimationFrame(() => this.constrainPanel(panelId));

        // Observe size changes (CSS resize handle)
        this.resizeObserver?.observe(panel);

        // Watch for hidden class removal so we can constrain when panel becomes visible
        const classObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'class' && !panel.classList.contains('hidden')) {
                    // Panel just became visible - constrain to viewport
                    requestAnimationFrame(() => this.constrainPanel(panelId));
                }
            }
        });
        classObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });

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

        // Save layout after drag
        this.saveLayout();

        this.dragging = null;
    }

    /**
     * Apply saved layout (position + size) to a panel
     */
    applyLayout(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        const panel = panelData.element;
        const saved = this.getSavedLayout();
        const layout = saved[panelId];
        const defaultPos = this.defaultPositions[panelId];

        // Clear all position properties first
        panel.style.top = 'auto';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = 'auto';

        if (layout) {
            // Validate saved position against current viewport with tighter bounds
            const w = window.innerWidth;
            const h = window.innerHeight;
            const savedW = layout.width || 200;
            const savedH = layout.height || 100;
            const offscreen =
                (layout.left !== undefined && layout.left > w - 50) ||
                (layout.top !== undefined && layout.top > h - 40) ||
                (layout.left !== undefined && layout.left < -(savedW - 50)) ||
                (layout.top !== undefined && layout.top < -10);

            if (offscreen && defaultPos) {
                // Saved position is off-screen, use defaults
                this.applyDefaultPos(panel, defaultPos);
                return;
            }

            // Restore saved position
            if (layout.top !== undefined) panel.style.top = `${layout.top}px`;
            if (layout.left !== undefined) panel.style.left = `${layout.left}px`;
            if (layout.right !== undefined) panel.style.right = `${layout.right}px`;
            if (layout.bottom !== undefined) panel.style.bottom = `${layout.bottom}px`;

            // Restore saved size
            if (layout.width !== undefined) panel.style.width = `${layout.width}px`;
            if (layout.height !== undefined) panel.style.height = `${layout.height}px`;
        } else if (defaultPos) {
            this.applyDefaultPos(panel, defaultPos);
        }
    }

    /**
     * Apply default position to a panel
     */
    applyDefaultPos(panel, defaultPos) {
        if (defaultPos.top !== undefined) panel.style.top = `${defaultPos.top}px`;
        if (defaultPos.right !== undefined) panel.style.right = `${defaultPos.right}px`;
        if (defaultPos.bottom !== undefined) panel.style.bottom = `${defaultPos.bottom}px`;
        if (defaultPos.left !== undefined) panel.style.left = `${defaultPos.left}px`;
    }

    /**
     * Get saved layout from localStorage
     */
    getSavedLayout() {
        try {
            // Try new key first, fall back to old key for migration
            let saved = localStorage.getItem(this.storageKey);
            if (!saved) {
                saved = localStorage.getItem('expedition-panel-positions');
                if (saved) localStorage.removeItem('expedition-panel-positions');
            }
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Save current layout (position + size) to localStorage
     */
    saveLayout() {
        const layout = {};

        for (const [panelId, panelData] of this.panels) {
            const panel = panelData.element;
            const rect = panel.getBoundingClientRect();

            layout[panelId] = {
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            };
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(layout));
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Reset all panels to default positions and sizes
     */
    resetPositions() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            // Ignore
        }

        for (const [panelId, panelData] of this.panels) {
            // Clear saved sizes back to CSS defaults
            panelData.element.style.width = '';
            panelData.element.style.height = '';
            this.applyLayout(panelId);
        }

        this.game.ui?.log('Panel layout reset to defaults', 'system');
    }

    /**
     * Check if move mode is active
     */
    isMoveModeActive() {
        return this.moveMode;
    }
}
