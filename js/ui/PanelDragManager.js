// =============================================
// Panel Drag Manager
// Handles draggable & resizable UI panels
// Always-on drag by panel headers, persistent positions
// Tab grouping: drag panel onto another to stack, drag tab to tear off
// =============================================

export class PanelDragManager {
    constructor(game) {
        this.game = game;

        // Registered panels
        this.panels = new Map();

        // Drag state
        this.dragging = null;
        this.dragOffset = { x: 0, y: 0 };

        // Tab group state
        this.tabGroups = new Map();     // groupId -> { panels:[], active, element, tabBar, content }
        this.panelToGroup = new Map();  // panelId -> groupId
        this.nextGroupId = 1;
        this.mergeTarget = null;        // panelId or groupId being hovered during drag
        this.mergeHighlight = null;     // DOM element showing merge indicator
        this.groupDragging = null;      // { groupId, offsetX, offsetY }
        this.tabDragging = null;        // { groupId, panelId, startX, startY, torn }
        this.tabGhost = null;           // floating ghost element during tab tear

        // Panels that cannot be grouped (special layout)
        this.ungroupable = new Set([
            'minimap', 'ship-indicator', 'drone-bar', 'locked-targets-container',
        ]);

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
            'quest-tracker': { top: 200, left: 350 },
        };

        // Storage key - bump version to force reset when layout changes
        this.storageKey = 'expedition-panel-layout';
        this.layoutVersion = 9;
        this.versionKey = 'expedition-panel-layout-version';
        this.tabGroupStorageKey = 'expedition-tab-groups';

        // Force reset if layout version changed
        const savedVersion = parseInt(localStorage.getItem(this.versionKey) || '0');
        if (savedVersion < this.layoutVersion) {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.tabGroupStorageKey);
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

        // Create merge highlight element
        this.mergeHighlight = document.createElement('div');
        this.mergeHighlight.className = 'tab-merge-highlight hidden';
        document.body.appendChild(this.mergeHighlight);
    }

    // =============================================
    // Panel Registration & Constraining
    // =============================================

    constrainAllPanels() {
        for (const [panelId] of this.panels) {
            if (!this.panelToGroup.has(panelId)) {
                this.constrainPanel(panelId);
            }
        }
        // Also constrain tab groups
        for (const [groupId] of this.tabGroups) {
            this.constrainGroup(groupId);
        }
    }

    constrainPanel(panelId) {
        const panelData = this.panels.get(panelId);
        if (!panelData) return;
        const panel = panelData.element;
        if (!panel) return;

        // Skip panels in tab groups
        if (this.panelToGroup.has(panelId)) return;

        // Skip hidden panels - they have no valid rect
        // Note: position:fixed elements have offsetParent===null, so check display instead
        if (panel.classList.contains('hidden')) return;
        const cs = getComputedStyle(panel);
        if (cs.display === 'none') return;

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

    constrainGroup(groupId) {
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;
        const el = groupData.element;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const zoom = this.getZoom();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const minVisible = Math.min(rect.width, 100 * zoom);

        let left = rect.left;
        let top = rect.top;
        let changed = false;

        if (left > vw - minVisible) { left = vw - minVisible; changed = true; }
        if (left + minVisible < 0) { left = 0; changed = true; }
        if (top > vh - 40 * zoom) { top = vh - 40 * zoom; changed = true; }
        if (top < 0) { top = 0; changed = true; }

        if (changed) {
            el.style.left = `${Math.round(left / zoom)}px`;
            el.style.top = `${Math.round(top / zoom)}px`;
        }
    }

    onPanelShown(panelId) {
        requestAnimationFrame(() => this.constrainPanel(panelId));
    }

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

    // =============================================
    // Drag Handling (panels + groups + tabs)
    // =============================================

    handleMouseDown(e, panelId) {
        if (e.button !== 0) return;
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;

        // If panel is in a group, don't handle individual drag
        if (this.panelToGroup.has(panelId)) return;

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

    handleMouseMove(e) {
        // Tab tear-off drag
        if (this.tabDragging) {
            this._handleTabDragMove(e);
            return;
        }

        // Group drag
        if (this.groupDragging) {
            this._handleGroupDragMove(e);
            return;
        }

        // Panel drag
        if (!this.dragging) return;

        const panelData = this.panels.get(this.dragging);
        if (!panelData) return;

        const panel = panelData.element;
        const rect = panel.getBoundingClientRect();
        const zoom = this.getZoom();

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

        // Merge detection - find potential merge targets
        if (this.canGroup(this.dragging)) {
            const target = this._findMergeTarget(this.dragging, e.clientX, e.clientY);
            this._showMergeHighlight(target);
            this.mergeTarget = target;
        }
    }

    handleMouseUp(e) {
        // Tab tear-off complete
        if (this.tabDragging) {
            this._handleTabDragEnd(e);
            return;
        }

        // Group drag complete
        if (this.groupDragging) {
            this._handleGroupDragEnd(e);
            return;
        }

        if (!this.dragging) return;

        const panelData = this.panels.get(this.dragging);
        if (panelData) {
            panelData.element.classList.remove('dragging');
            if (panelData.header) {
                panelData.header.style.cursor = 'grab';
            }
        }

        // Check for merge
        if (this.mergeTarget && this.canGroup(this.dragging)) {
            const targetIsGroup = this.tabGroups.has(this.mergeTarget);
            if (targetIsGroup) {
                // Add to existing group
                this.addToTabGroup(this.mergeTarget, this.dragging);
            } else if (this.panelToGroup.has(this.mergeTarget)) {
                // Target is in a group - add to that group
                const groupId = this.panelToGroup.get(this.mergeTarget);
                this.addToTabGroup(groupId, this.dragging);
            } else {
                // Create new group from two panels
                this.createTabGroup(this.mergeTarget, this.dragging);
            }
        }

        this._hideMergeHighlight();
        this.mergeTarget = null;
        this.saveLayout();
        this.dragging = null;
    }

    // =============================================
    // Tab Group Creation & Management
    // =============================================

    canGroup(panelId) {
        return !this.ungroupable.has(panelId);
    }

    getPanelTitle(panelId) {
        const el = document.getElementById(panelId);
        if (!el) return panelId;
        const title = el.querySelector('.panel-title');
        return title?.textContent?.trim() || panelId.replace(/-/g, ' ').toUpperCase();
    }

    createTabGroup(panelId1, panelId2) {
        const groupId = `tab-group-${this.nextGroupId++}`;

        // Get position from the target panel (the one being dropped onto)
        const panel1 = document.getElementById(panelId1);
        const panel2 = document.getElementById(panelId2);
        if (!panel1 || !panel2) return null;

        const rect1 = panel1.getBoundingClientRect();
        const zoom = this.getZoom();

        // Create group container
        const group = document.createElement('div');
        group.id = groupId;
        group.className = 'tab-group';
        group.style.position = 'fixed';
        group.style.left = `${Math.round(rect1.left / zoom)}px`;
        group.style.top = `${Math.round(rect1.top / zoom)}px`;
        group.style.width = `${Math.max(Math.round(rect1.width / zoom), 280)}px`;
        group.style.zIndex = '1001';

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'tab-group-bar';
        group.appendChild(tabBar);

        // Content container
        const content = document.createElement('div');
        content.className = 'tab-group-content';
        group.appendChild(content);

        document.body.appendChild(group);

        const groupData = {
            panels: [],
            active: panelId1,
            element: group,
            tabBar: tabBar,
            content: content,
        };
        this.tabGroups.set(groupId, groupData);

        // Move panels into group
        this._addPanelToGroupDOM(groupId, panelId1);
        this._addPanelToGroupDOM(groupId, panelId2);

        // Tab bar drag handler (for the bar itself, not individual tabs)
        tabBar.addEventListener('mousedown', (e) => {
            // If clicking on a tab button, let tab handler deal with it
            if (e.target.closest('.tab-group-tab')) return;
            this._handleGroupDragStart(e, groupId);
        });

        this.renderGroupTabs(groupId);
        this.switchTab(groupId, panelId1);
        this.saveTabGroups();

        return groupId;
    }

    addToTabGroup(groupId, panelId) {
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;
        if (groupData.panels.includes(panelId)) return;

        this._addPanelToGroupDOM(groupId, panelId);
        this.renderGroupTabs(groupId);
        this.switchTab(groupId, panelId); // Switch to newly added tab
        this.saveTabGroups();
    }

    _addPanelToGroupDOM(groupId, panelId) {
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;

        const panel = document.getElementById(panelId);
        if (!panel) return;

        // Move panel into group content area
        panel.style.position = 'relative';
        panel.style.left = '0';
        panel.style.top = '0';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.width = '100%';
        panel.classList.remove('hidden');

        // Hide panel header (tab bar replaces it)
        const header = panel.querySelector('.panel-header');
        if (header) header.style.display = 'none';

        groupData.content.appendChild(panel);
        groupData.panels.push(panelId);
        this.panelToGroup.set(panelId, groupId);
    }

    removeFromTabGroup(panelId) {
        const groupId = this.panelToGroup.get(panelId);
        if (!groupId) return;

        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;

        const panel = document.getElementById(panelId);
        if (!panel) return;

        // Restore panel to body
        document.body.appendChild(panel);
        panel.style.position = 'fixed';
        panel.style.width = '';
        panel.classList.remove('hidden');
        panel.style.display = '';

        // Restore header
        const header = panel.querySelector('.panel-header');
        if (header) header.style.display = '';

        // Position near the group
        const groupRect = groupData.element.getBoundingClientRect();
        const zoom = this.getZoom();
        panel.style.left = `${Math.round((groupRect.left + 30) / zoom)}px`;
        panel.style.top = `${Math.round((groupRect.top + 30) / zoom)}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        // Remove from group
        groupData.panels = groupData.panels.filter(id => id !== panelId);
        this.panelToGroup.delete(panelId);

        // Switch active tab if needed
        if (groupData.active === panelId && groupData.panels.length > 0) {
            groupData.active = groupData.panels[0];
            // Actually show the remaining panel so it's not stuck with display:none
            this.switchTab(groupId, groupData.active);
        }

        // Dissolve group if only 1 panel left
        if (groupData.panels.length <= 1) {
            this._dissolveGroup(groupId);
        } else {
            this.renderGroupTabs(groupId);
            this.switchTab(groupId, groupData.active);
        }

        this.saveLayout();
        this.saveTabGroups();
    }

    _dissolveGroup(groupId) {
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;

        const groupRect = groupData.element.getBoundingClientRect();
        const zoom = this.getZoom();
        const groupLeft = Math.round(groupRect.left / zoom);
        const groupTop = Math.round(groupRect.top / zoom);

        for (let i = 0; i < groupData.panels.length; i++) {
            const panelId = groupData.panels[i];
            const panel = document.getElementById(panelId);
            if (!panel) continue;

            // Move panel back to body
            document.body.appendChild(panel);

            // Fully reset all styles that tab-group membership may have set
            panel.style.position = 'fixed';
            panel.style.left = `${groupLeft + i * 20}px`;
            panel.style.top = `${groupTop + i * 20}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.width = '';
            panel.style.zIndex = '';

            // Restore header visibility
            const header = panel.querySelector('.panel-header');
            if (header) {
                header.style.display = '';
                header.style.removeProperty('display');
            }

            // Force panel to be visible
            panel.classList.remove('hidden');
            panel.style.display = '';
            panel.style.removeProperty('display');

            this.panelToGroup.delete(panelId);

            // Ensure panel is constrained to viewport after a tick
            requestAnimationFrame(() => this.constrainPanel(panelId));
        }

        groupData.element.remove();
        this.tabGroups.delete(groupId);
        this.saveTabGroups();
    }

    switchTab(groupId, panelId) {
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;

        groupData.active = panelId;

        for (const id of groupData.panels) {
            const panel = document.getElementById(id);
            if (!panel) continue;
            if (id === panelId) {
                panel.classList.remove('hidden');
                panel.style.display = '';
            } else {
                panel.classList.add('hidden');
                panel.style.display = 'none';
            }
        }

        // Update tab active states
        const tabs = groupData.tabBar.querySelectorAll('.tab-group-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panel === panelId);
        });
    }

    renderGroupTabs(groupId) {
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;

        groupData.tabBar.innerHTML = '';

        for (const panelId of groupData.panels) {
            const tab = document.createElement('button');
            tab.className = 'tab-group-tab';
            if (panelId === groupData.active) tab.classList.add('active');
            tab.dataset.panel = panelId;
            tab.textContent = this.getPanelTitle(panelId);

            // Click to switch tab
            tab.addEventListener('click', () => {
                this.switchTab(groupId, panelId);
            });

            // Mousedown for tab tear-off
            tab.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                if (groupData.panels.length <= 1) return;
                e.preventDefault();
                e.stopPropagation();
                this.tabDragging = {
                    groupId,
                    panelId,
                    startX: e.clientX,
                    startY: e.clientY,
                    torn: false,
                };
            });

            groupData.tabBar.appendChild(tab);
        }
    }

    // =============================================
    // Merge Detection & Highlighting
    // =============================================

    _findMergeTarget(draggedPanelId, mouseX, mouseY) {
        // Check standalone panels
        for (const [panelId, panelData] of this.panels) {
            if (panelId === draggedPanelId) continue;
            if (!this.canGroup(panelId)) continue;
            if (this.panelToGroup.has(panelId)) continue;
            if (panelData.element.classList.contains('hidden')) continue;

            const rect = panelData.element.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right &&
                mouseY >= rect.top && mouseY <= rect.bottom) {
                return panelId;
            }
        }

        // Check tab groups
        for (const [groupId, groupData] of this.tabGroups) {
            if (this.panelToGroup.get(draggedPanelId) === groupId) continue;
            const rect = groupData.element.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right &&
                mouseY >= rect.top && mouseY <= rect.bottom) {
                return groupId;
            }
        }

        return null;
    }

    _showMergeHighlight(targetId) {
        if (!targetId) {
            this._hideMergeHighlight();
            return;
        }

        let targetEl;
        if (this.tabGroups.has(targetId)) {
            targetEl = this.tabGroups.get(targetId).element;
        } else {
            targetEl = document.getElementById(targetId);
        }
        if (!targetEl) return;

        const rect = targetEl.getBoundingClientRect();
        const hl = this.mergeHighlight;
        hl.style.left = `${rect.left}px`;
        hl.style.top = `${rect.top}px`;
        hl.style.width = `${rect.width}px`;
        hl.style.height = `${rect.height}px`;
        hl.classList.remove('hidden');
    }

    _hideMergeHighlight() {
        if (this.mergeHighlight) {
            this.mergeHighlight.classList.add('hidden');
        }
    }

    // =============================================
    // Group Dragging
    // =============================================

    _handleGroupDragStart(e, groupId) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return;

        const rect = groupData.element.getBoundingClientRect();
        const zoom = this.getZoom();

        this.groupDragging = {
            groupId,
            offsetX: (e.clientX - rect.left) / zoom,
            offsetY: (e.clientY - rect.top) / zoom,
        };
        groupData.element.classList.add('dragging');
    }

    _handleGroupDragMove(e) {
        if (!this.groupDragging) return;
        const groupData = this.tabGroups.get(this.groupDragging.groupId);
        if (!groupData) return;

        const zoom = this.getZoom();
        let newX = e.clientX / zoom - this.groupDragging.offsetX;
        let newY = e.clientY / zoom - this.groupDragging.offsetY;

        // Use CSS width (not rendered rect) to avoid border/zoom mismatch
        const cssWidth = parseFloat(groupData.element.style.width) || groupData.element.offsetWidth / zoom;
        const cssHeight = groupData.element.offsetHeight / zoom;
        const vpW = window.innerWidth / zoom;
        const vpH = window.innerHeight / zoom;

        newX = Math.max(0, Math.min(newX, vpW - cssWidth));
        newY = Math.max(0, Math.min(newY, vpH - cssHeight));

        groupData.element.style.left = `${newX}px`;
        groupData.element.style.top = `${newY}px`;
    }

    _handleGroupDragEnd() {
        if (!this.groupDragging) return;
        const groupData = this.tabGroups.get(this.groupDragging.groupId);
        if (groupData) {
            groupData.element.classList.remove('dragging');
        }
        this.groupDragging = null;
        this.saveLayout();
        this.saveTabGroups();
    }

    // =============================================
    // Tab Tear-Off Dragging
    // =============================================

    _handleTabDragMove(e) {
        if (!this.tabDragging) return;

        const dx = e.clientX - this.tabDragging.startX;
        const dy = e.clientY - this.tabDragging.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Need to drag at least 40px to tear off
        if (dist < 40 && !this.tabDragging.torn) {
            return;
        }

        if (!this.tabDragging.torn) {
            this.tabDragging.torn = true;
            // Create ghost element
            this.tabGhost = document.createElement('div');
            this.tabGhost.className = 'tab-tear-ghost';
            this.tabGhost.textContent = this.getPanelTitle(this.tabDragging.panelId);
            document.body.appendChild(this.tabGhost);
        }

        // Position ghost at cursor
        if (this.tabGhost) {
            this.tabGhost.style.left = `${e.clientX - 50}px`;
            this.tabGhost.style.top = `${e.clientY - 15}px`;
        }
    }

    _handleTabDragEnd(e) {
        if (!this.tabDragging) return;

        if (this.tabDragging.torn) {
            // Tear off the tab
            const { panelId } = this.tabDragging;
            this.removeFromTabGroup(panelId);

            // Position torn panel at mouse location
            const panel = document.getElementById(panelId);
            if (panel) {
                const zoom = this.getZoom();
                panel.style.left = `${Math.round((e.clientX - 100) / zoom)}px`;
                panel.style.top = `${Math.round((e.clientY - 20) / zoom)}px`;
            }
        } else {
            // Just a click - switch to this tab
            this.switchTab(this.tabDragging.groupId, this.tabDragging.panelId);
        }

        // Remove ghost
        if (this.tabGhost) {
            this.tabGhost.remove();
            this.tabGhost = null;
        }

        this.tabDragging = null;
    }

    // =============================================
    // Layout Persistence
    // =============================================

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
            // Skip panels that are in tab groups
            if (this.panelToGroup.has(panelId)) continue;

            const panel = panelData.element;
            if (panel.classList.contains('hidden')) continue;
            const panelCS = getComputedStyle(panel);
            if (panelCS.display === 'none') continue;

            const rect = panel.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;

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

    saveTabGroups() {
        const data = {};
        const zoom = this.getZoom();

        for (const [groupId, groupData] of this.tabGroups) {
            const rect = groupData.element.getBoundingClientRect();
            data[groupId] = {
                panels: [...groupData.panels],
                active: groupData.active,
                left: Math.round(rect.left / zoom),
                top: Math.round(rect.top / zoom),
                width: Math.round(rect.width / zoom),
            };
        }

        try {
            localStorage.setItem(this.tabGroupStorageKey, JSON.stringify(data));
        } catch { /* storage full */ }
    }

    loadTabGroups() {
        try {
            const raw = localStorage.getItem(this.tabGroupStorageKey);
            if (!raw) return;
            const groups = JSON.parse(raw);

            for (const [, groupInfo] of Object.entries(groups)) {
                if (!groupInfo.panels || groupInfo.panels.length < 2) continue;
                // Validate all panels exist and are groupable
                const validPanels = groupInfo.panels.filter(id =>
                    document.getElementById(id) && this.canGroup(id) && !this.panelToGroup.has(id)
                );
                if (validPanels.length < 2) continue;

                // Create group from first two, add rest
                const gid = this.createTabGroup(validPanels[0], validPanels[1]);
                if (!gid) continue;

                for (let i = 2; i < validPanels.length; i++) {
                    this.addToTabGroup(gid, validPanels[i]);
                }

                // Restore position
                const gData = this.tabGroups.get(gid);
                if (gData && groupInfo.left !== undefined) {
                    gData.element.style.left = `${groupInfo.left}px`;
                    gData.element.style.top = `${groupInfo.top}px`;
                    if (groupInfo.width) gData.element.style.width = `${groupInfo.width}px`;
                }

                // Restore active tab
                if (groupInfo.active && validPanels.includes(groupInfo.active)) {
                    this.switchTab(gid, groupInfo.active);
                }
            }
        } catch { /* corrupt data */ }
    }

    // =============================================
    // Reset
    // =============================================

    resetPositions() {
        // Dissolve all tab groups first
        for (const [groupId] of [...this.tabGroups]) {
            this._dissolveGroup(groupId);
        }

        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.tabGroupStorageKey);
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

    /**
     * Check if a panel is currently in a tab group
     */
    isPanelGrouped(panelId) {
        return this.panelToGroup.has(panelId);
    }

    /**
     * Get group info for a panel
     */
    getPanelGroupInfo(panelId) {
        const groupId = this.panelToGroup.get(panelId);
        if (!groupId) return null;
        const groupData = this.tabGroups.get(groupId);
        if (!groupData) return null;
        return { groupId, panels: [...groupData.panels], active: groupData.active };
    }
}
