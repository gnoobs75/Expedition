// =============================================
// Panel Drag Manager
// Handles draggable & resizable UI panels
// Always-on drag by panel headers, persistent positions
// =============================================

export class PanelDragManager {
    constructor(game) {
        this.game = game;

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
            'stats-panel': { top: 100, left: 350 },
            'achievements-panel': { top: 100, right: 10 },
            'ship-log-panel': { top: 300, right: 10 },
            'skippy-panel': { bottom: 200, right: 240 },
        };

        // Storage key - bump version to force reset when layout changes
        this.storageKey = 'expedition-panel-layout';
        this.layoutVersion = 7;
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
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * Get current UI zoom factor from CSS variable
     */
    getZoom() {
        return parseFloat(document.documentElement.style.getPropertyValue('--ui-scale')) || 1;
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
        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.saveLayout(), 300);
        });
    }

    /**
     * Constrain all panels to viewport bounds
     */
    constrainAllPanels() {
        for (const [panelId] of this.panels) {
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

        const zoom = this.getZoom();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const headerH = 40 * zoom;
        const minVisible = Math.min(rect.width, 100 * zoom);

        let left = rect.left;
        let top = rect.top;
        let changed = false;

        if (left > vw - minVisible) {
            left = vw - minVisible;
            changed = true;
        }
        if (left + minVisible < 0) {
            left = 0;
            changed = true;
        }
        if (top > vh - headerH) {
            top = vh - headerH;
            changed = true;
        }
        if (top < 0) {
            top = 0;
            changed = true;
        }

        if (changed) {
            panel.style.left = `${Math.round(left / zoom)}px`;
            panel.style.top = `${Math.round(top / zoom)}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }
    }

    /**
     * Constrain a panel when it becomes visible
     */
    onPanelShown(panelId) {
        requestAnimationFrame(() => this.constrainPanel(panelId));
    }

    /**
     * Register a panel for drag management
     */
    registerPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        // Skip docked panels
        if (panel.classList.contains('docked')) return;

        const panelData = {
            element: panel,
            header: null,
        };
        this.panels.set(panelId, panelData);

        // Apply saved position and size
        this.applyLayout(panelId);

        // Constrain to viewport immediately
        requestAnimationFrame(() => this.constrainPanel(panelId));

        // Observe size changes (CSS resize handle)
        this.resizeObserver?.observe(panel);

        // Watch for hidden class removal
        const classObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'class' && !panel.classList.contains('hidden')) {
                    requestAnimationFrame(() => this.constrainPanel(panelId));
                }
            }
        });
        classObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });

        // Find header element for drag handle
        const header = panel.querySelector('.panel-header') ||
                       panel.querySelector('#minimap-label') ||
                       null;

        if (header) {
            header.addEventListener('mousedown', (e) => this.handleMouseDown(e, panelId));
            header.style.cursor = 'grab';
            panelData.header = header;
        }
    }

    /**
     * Handle mouse down on panel header - always active (no move mode needed)
     */
    handleMouseDown(e, panelId) {
        // Only left click
        if (e.button !== 0) return;

        // Don't drag if clicking a button inside header
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;

        const panelData = this.panels.get(panelId);
        if (!panelData) return;

        e.preventDefault();
        e.stopPropagation();

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();
        const zoom = this.getZoom();

        this.dragOffset = {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom,
        };

        this.dragging = panelId;
        panel.classList.add('dragging');

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
        const rect = panel.getBoundingClientRect();
        const zoom = this.getZoom();

        // Convert screen coords to CSS coords (divide by zoom)
        let newX = e.clientX / zoom - this.dragOffset.x;
        let newY = e.clientY / zoom - this.dragOffset.y;

        const maxX = window.innerWidth / zoom - rect.width / zoom;
        const maxY = window.innerHeight / zoom - rect.height / zoom;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        panel.style.left = `${newX}px`;
        panel.style.top = `${newY}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    /**
     * Handle mouse up to end drag
     */
    handleMouseUp() {
        if (!this.dragging) return;

        const panelData = this.panels.get(this.dragging);
        if (panelData) {
            panelData.element.classList.remove('dragging');
            if (panelData.header) {
                panelData.header.style.cursor = 'grab';
            }
        }

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
            const zoom = this.getZoom();
            const w = window.innerWidth / zoom;
            const h = window.innerHeight / zoom;
            const savedW = layout.width || 200;
            const savedH = layout.height || 100;
            const offscreen =
                (layout.left !== undefined && layout.left > w - 50) ||
                (layout.top !== undefined && layout.top > h - 40) ||
                (layout.left !== undefined && layout.left < -(savedW - 50)) ||
                (layout.top !== undefined && layout.top < -10);

            if (offscreen && defaultPos) {
                this.applyDefaultPos(panel, defaultPos);
                return;
            }

            if (layout.top !== undefined) panel.style.top = `${layout.top}px`;
            if (layout.left !== undefined) panel.style.left = `${layout.left}px`;
            if (layout.right !== undefined) panel.style.right = `${layout.right}px`;
            if (layout.bottom !== undefined) panel.style.bottom = `${layout.bottom}px`;

            if (layout.width && layout.width > 0) panel.style.width = `${layout.width}px`;
            if (layout.height && layout.height > 0) panel.style.height = `${layout.height}px`;
        } else if (defaultPos) {
            this.applyDefaultPos(panel, defaultPos);
        }
    }

    applyDefaultPos(panel, defaultPos) {
        if (defaultPos.top !== undefined) panel.style.top = `${defaultPos.top}px`;
        if (defaultPos.right !== undefined) panel.style.right = `${defaultPos.right}px`;
        if (defaultPos.bottom !== undefined) panel.style.bottom = `${defaultPos.bottom}px`;
        if (defaultPos.left !== undefined) panel.style.left = `${defaultPos.left}px`;
    }

    getSavedLayout() {
        try {
            let saved = localStorage.getItem(this.storageKey);
            if (!saved) {
                saved = localStorage.getItem('expedition-panel-positions');
                if (saved) localStorage.removeItem('expedition-panel-positions');
            }
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    }

    saveLayout() {
        const layout = {};
        const zoom = this.getZoom();

        for (const [panelId, panelData] of this.panels) {
            const panel = panelData.element;
            if (panel.classList.contains('hidden') || panel.offsetParent === null) continue;

            const rect = panel.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;

            // Save in unzoomed (CSS) coordinates so positions are zoom-independent
            layout[panelId] = {
                top: Math.round(rect.top / zoom),
                left: Math.round(rect.left / zoom),
                width: Math.round(rect.width / zoom),
                height: Math.round(rect.height / zoom),
            };
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(layout));
        } catch {
            // Ignore
        }
    }

    resetPositions() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch {
            // Ignore
        }

        for (const [panelId, panelData] of this.panels) {
            panelData.element.style.width = '';
            panelData.element.style.height = '';
            this.applyLayout(panelId);
        }

        this.game.ui?.log('Panel layout reset to defaults', 'system');
    }
}
