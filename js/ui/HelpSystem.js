// =============================================
// Contextual Help System
// Provides hover tooltips throughout the UI
// =============================================

const HELP_CONTENT = {
    // HUD Elements
    'shield-bar': {
        title: 'Shield',
        text: 'Your first line of defense. Shields regenerate slowly over time. When depleted, damage hits armor.',
        keys: []
    },
    'armor-bar': {
        title: 'Armor',
        text: 'Second defense layer. Does not regenerate naturally - use an Armor Repairer module or dock at a station.',
        keys: []
    },
    'hull-bar': {
        title: 'Hull Integrity',
        text: 'Your ship\'s structural integrity. If hull reaches 0, your ship is destroyed! Dock at a station to repair.',
        keys: []
    },
    'capacitor-bar': {
        title: 'Capacitor',
        text: 'Energy powering your modules. Regenerates over time. Modules consume capacitor when activated. Warp drains all capacitor.',
        keys: []
    },
    'speed-display': {
        title: 'Ship Speed',
        text: 'Current speed in meters per second. Use autopilot commands (approach, orbit) or manual controls to move.',
        keys: [
            { key: 'Q', desc: 'Approach target' },
            { key: 'W', desc: 'Orbit target' },
            { key: 'Ctrl+Space', desc: 'Stop ship' },
        ]
    },
    'cargo-display': {
        title: 'Cargo Hold',
        text: 'Storage space for mined ore. Dock at a station and use the Refinery tab to sell ore for ISK.',
        keys: []
    },
    'credits-display': {
        title: 'ISK (Credits)',
        text: 'Your currency. Earn ISK by mining ore, defeating pirates (bounties + loot), and trading. Spend at stations on ships, equipment, and repairs.',
        keys: []
    },

    // Panels
    'overview-panel': {
        title: 'Overview',
        text: 'Lists all objects in your sector. Click to select, right-click for action menu. Filter by type using the buttons. Shows distance, speed, and angular velocity (important for tracking weapons).',
        keys: [
            { key: 'Tab', desc: 'Cycle targets' },
            { key: 'R', desc: 'Lock selected' },
            { key: 'O', desc: 'Toggle panel' },
        ]
    },
    'target-panel': {
        title: 'Selected Target',
        text: 'Shows info about your selected target. Lock a target (R) to enable weapon fire and detailed scanning.',
        keys: [
            { key: 'R', desc: 'Lock/unlock' },
            { key: 'Q', desc: 'Approach' },
            { key: 'W', desc: 'Orbit' },
            { key: 'S', desc: 'Warp to' },
        ]
    },
    'locked-targets-container': {
        title: 'Locked Targets',
        text: 'Shows your locked target with health rings (blue=shield, orange=armor, red=hull). Locking is required for weapon fire and mining.',
        keys: [
            { key: 'R', desc: 'Lock target' },
        ]
    },
    'event-log': {
        title: 'Event Log',
        text: 'Combat, mining, system messages, and warp notifications. Use the filter buttons to show specific message types.',
        keys: []
    },
    'ship-indicator': {
        title: 'Your Ship',
        text: 'Shows your ship model, name, class, and health bars. Left-click to select yourself. Right-click for drone commands.',
        keys: [
            { key: 'C', desc: 'Ship menu' },
        ]
    },
    'drone-bar': {
        title: 'Drone Control',
        text: 'Command your deployed drones. Drones can orbit, attack enemies, or mine asteroids autonomously. Mining drones auto-return when full.',
        keys: [
            { key: '&#8635;', desc: 'Orbit target' },
            { key: '&#9876;', desc: 'Attack' },
            { key: '&#9874;', desc: 'Mine' },
            { key: '&#8617;', desc: 'Return to bay' },
        ]
    },
    'fleet-panel': {
        title: 'Fleet Management',
        text: 'Manage your fleet ships. Assign control groups, issue commands (follow, attack, mine). Fleet ships follow you through Elder Wormholes.',
        keys: [
            { key: 'F', desc: 'Toggle panel' },
            { key: 'Ctrl+1-5', desc: 'Assign group' },
            { key: '1-5', desc: 'Command group' },
        ]
    },
    'dscan-panel': {
        title: 'Directional Scanner',
        text: 'Scan for objects in a cone around your ship. Useful for finding targets beyond overview range.',
        keys: [
            { key: 'D', desc: 'Toggle D-Scan' },
            { key: 'V', desc: 'Scan' },
        ]
    },
    'bookmarks-panel': {
        title: 'Bookmarks',
        text: 'Saved locations you can warp to. Right-click in space or on objects to save bookmarks.',
        keys: [
            { key: 'B', desc: 'Toggle panel' },
        ]
    },
    'object-viewer': {
        title: 'Object Viewer',
        text: 'Detailed information about your locked target including speed, transversal velocity, angular velocity, defenses, and metadata.',
        keys: [
            { key: 'I', desc: 'Toggle panel' },
        ]
    },

    // Module Rack
    'module-rack': {
        title: 'Module Rack',
        text: 'Your fitted modules. WEAPONS (top) deal damage or mine. MODULES (mid) boost shields, speed, etc. SUBSYSTEMS (low) provide passive bonuses. Click to activate/deactivate. Hover for stats.',
        keys: [
            { key: 'F1-F8', desc: 'Toggle modules' },
        ]
    },

    // Station tabs
    'tab-hangar': {
        title: 'Hangar',
        text: 'View your current ship stats and cargo contents. Your ship is automatically stored here when docked.',
        keys: []
    },
    'tab-ships': {
        title: 'Ship Market',
        text: 'Browse and buy new ships. Filter by role and size. Trade-in value is 50% of your current ship\'s price. Larger ships have more module slots but are slower.',
        keys: []
    },
    'tab-equipment': {
        title: 'Equipment Market',
        text: 'Buy modules and equipment. Filter by slot type (weapon/module/subsystem) and size. Equipment must match your ship\'s size class.',
        keys: []
    },
    'tab-fitting': {
        title: 'Ship Fitting',
        text: 'Drag equipment from your inventory to module slots. Weapons go in high slots, shield/speed mods in mid slots, passive upgrades in low slots.',
        keys: []
    },
    'tab-repair': {
        title: 'Repair Services',
        text: 'Repair all damage to shield, armor, and hull. Cost scales with damage taken.',
        keys: []
    },
    'tab-refinery': {
        title: 'Ore Refinery',
        text: 'Sell mined ore for ISK. Different ore types have different values. Rarer ores found in more dangerous sectors are worth more.',
        keys: []
    },
    'tab-cantina': {
        title: 'Cantina - Hire Pilots',
        text: 'Hire pilots for your fleet ships. Pilots have combat, mining, and navigation skills that affect performance. Traits provide unique bonuses.',
        keys: []
    },

    // General gameplay
    'bottom-bar': {
        title: 'Ship Status HUD',
        text: 'Your ship\'s vital stats at a glance. Shield \u2192 Armor \u2192 Hull is the damage order. Capacitor powers all modules.',
        keys: [
            { key: 'Esc', desc: 'Settings' },
            { key: 'M', desc: 'Sector map' },
            { key: 'C', desc: 'Ship menu' },
            { key: 'Z', desc: 'Move panels' },
        ]
    },
};

export class HelpSystem {
    constructor() {
        this.popover = null;
        this.activeIcon = null;
        this.createPopover();
    }

    /**
     * Create the shared popover element
     */
    createPopover() {
        this.popover = document.createElement('div');
        this.popover.className = 'help-popover';
        document.body.appendChild(this.popover);
    }

    /**
     * Initialize help icons throughout the UI
     */
    init() {
        // Add help icons to panel headers
        this.addHelpToPanel('overview-panel');
        this.addHelpToPanel('target-panel');
        this.addHelpToPanel('event-log');
        this.addHelpToPanel('ship-indicator');
        this.addHelpToPanel('drone-bar');
        this.addHelpToPanel('fleet-panel');
        this.addHelpToPanel('dscan-panel');
        this.addHelpToPanel('bookmarks-panel');
        this.addHelpToPanel('object-viewer');
        this.addHelpToPanel('locked-targets-container');

        // Add help icons to HUD elements
        this.addHelpToElement('speed-display');
        this.addHelpToElement('cargo-display');
        this.addHelpToElement('credits-display');

        // Add help icons to status bars
        this.addHelpToStatusBar('shield');
        this.addHelpToStatusBar('armor');
        this.addHelpToStatusBar('hull');
        this.addHelpToStatusBar('capacitor');

        // Add help icon to module rack
        this.addHelpToModuleRack();

        // Add help icons to station tabs
        this.addHelpToStationTabs();
    }

    /**
     * Add help icon to a panel's header
     */
    addHelpToPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const header = panel.querySelector('.panel-header');
        if (!header) return;

        const content = HELP_CONTENT[panelId];
        if (!content) return;

        const icon = this.createHelpIcon(content);
        // Insert before close button if present
        const closeBtn = header.querySelector('.panel-close');
        if (closeBtn) {
            header.insertBefore(icon, closeBtn);
        } else {
            header.appendChild(icon);
        }
    }

    /**
     * Add help icon to a generic element
     */
    addHelpToElement(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const content = HELP_CONTENT[elementId];
        if (!content) return;

        const icon = this.createHelpIcon(content);
        el.appendChild(icon);
    }

    /**
     * Add help to status bar labels
     */
    addHelpToStatusBar(barName) {
        const content = HELP_CONTENT[`${barName}-bar`];
        if (!content) return;

        // Find the label for this bar
        const bars = document.querySelectorAll('.status-group');
        for (const group of bars) {
            const label = group.querySelector('label');
            if (label && label.textContent.trim().toLowerCase() === barName) {
                const icon = this.createHelpIcon(content);
                label.appendChild(icon);
                break;
            }
        }
    }

    /**
     * Add help to module rack
     */
    addHelpToModuleRack() {
        const rack = document.getElementById('module-rack');
        if (!rack) return;

        const content = HELP_CONTENT['module-rack'];
        if (!content) return;

        // Add to first section label
        const firstLabel = rack.querySelector('.section-label');
        if (firstLabel) {
            const icon = this.createHelpIcon(content);
            firstLabel.appendChild(icon);
        }
    }

    /**
     * Add help icons to station tabs
     */
    addHelpToStationTabs() {
        const tabs = document.querySelectorAll('#station-panel .tab-btn');
        tabs.forEach(tab => {
            const tabId = `tab-${tab.dataset.tab}`;
            const content = HELP_CONTENT[tabId];
            if (content) {
                const icon = this.createHelpIcon(content);
                tab.appendChild(icon);
            }
        });
    }

    /**
     * Create a help icon element
     */
    createHelpIcon(content) {
        const icon = document.createElement('span');
        icon.className = 'help-icon';
        icon.textContent = '?';
        icon.setAttribute('aria-label', 'Help');

        icon.addEventListener('mouseenter', (e) => {
            this.showPopover(icon, content, e);
        });

        icon.addEventListener('mouseleave', () => {
            this.hidePopover();
        });

        return icon;
    }

    /**
     * Show the help popover
     */
    showPopover(icon, content, event) {
        this.activeIcon = icon;

        let html = '';
        if (content.title) html += `<div class="help-title">${content.title}</div>`;
        if (content.text) html += `<div class="help-text">${content.text}</div>`;
        if (content.keys && content.keys.length > 0) {
            html += '<div class="help-keys">';
            for (const k of content.keys) {
                html += `<span class="help-key">${k.key}</span><span class="help-key-desc">${k.desc}</span>`;
            }
            html += '</div>';
        }

        this.popover.innerHTML = html;
        this.popover.classList.add('visible');

        // Position near the icon
        const rect = icon.getBoundingClientRect();
        let left = rect.right + 8;
        let top = rect.top;

        // Keep on screen
        requestAnimationFrame(() => {
            const popRect = this.popover.getBoundingClientRect();
            if (left + popRect.width > window.innerWidth - 10) {
                left = rect.left - popRect.width - 8;
            }
            if (top + popRect.height > window.innerHeight - 10) {
                top = window.innerHeight - popRect.height - 10;
            }
            if (top < 10) top = 10;

            this.popover.style.left = `${left}px`;
            this.popover.style.top = `${top}px`;
        });
    }

    /**
     * Hide the help popover
     */
    hidePopover() {
        this.popover.classList.remove('visible');
        this.activeIcon = null;
    }
}
