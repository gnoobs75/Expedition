// =============================================
// Key Bindings Manager
// Handles customizable key mappings with persistence
// =============================================

export const DEFAULT_BINDINGS = {
    // Navigation
    'stop': { key: 'Space', description: 'Stop Ship', category: 'Navigation' },
    'approach': { key: 'KeyQ', description: 'Approach Target', category: 'Navigation' },
    'orbit': { key: 'KeyW', description: 'Orbit Target', category: 'Navigation' },
    'keepAtRange': { key: 'KeyE', description: 'Keep at Range', category: 'Navigation' },
    'warpTo': { key: 'KeyS', description: 'Warp to Target', category: 'Navigation' },
    'centerCamera': { key: 'Home', description: 'Center Camera on Ship', category: 'Navigation' },

    // Targeting
    'lockTarget': { key: 'KeyR', description: 'Lock Target', category: 'Targeting' },
    'unlockTarget': { key: 'KeyT', description: 'Unlock Target', category: 'Targeting' },
    'cycleTargets': { key: 'Tab', description: 'Cycle Targets', category: 'Targeting' },
    'deselectTarget': { key: 'Escape', description: 'Deselect / Close Menu', category: 'Targeting' },

    // Modules (High Slots)
    'module1': { key: 'F1', description: 'Activate Module 1', category: 'Modules' },
    'module2': { key: 'F2', description: 'Activate Module 2', category: 'Modules' },
    'module3': { key: 'F3', description: 'Activate Module 3', category: 'Modules' },
    'module4': { key: 'F4', description: 'Activate Module 4', category: 'Modules' },
    'module5': { key: 'F5', description: 'Activate Module 5', category: 'Modules' },
    'module6': { key: 'F6', description: 'Activate Module 6', category: 'Modules' },
    'module7': { key: 'F7', description: 'Activate Module 7', category: 'Modules' },
    'module8': { key: 'F8', description: 'Activate Module 8', category: 'Modules' },

    // UI Panels
    'toggleDScan': { key: 'KeyV', description: 'Toggle D-Scan', category: 'UI' },
    'toggleBookmarks': { key: 'KeyB', description: 'Toggle Bookmarks', category: 'UI' },
    'addBookmark': { key: 'ctrl+KeyB', description: 'Add Bookmark', category: 'UI' },
    'toggleSettings': { key: 'Escape', description: 'Toggle Settings Menu', category: 'UI' },
    'toggleOverview': { key: 'KeyO', description: 'Toggle Overview', category: 'UI' },
    'toggleMap': { key: 'KeyM', description: 'Toggle Sector Map', category: 'UI' },
    'toggleMoveMode': { key: 'KeyZ', description: 'Toggle Panel Move Mode', category: 'UI' },
    'toggleObjectViewer': { key: 'KeyI', description: 'Toggle Object Viewer', category: 'UI' },
    'toggleShipMenu': { key: 'KeyC', description: 'Toggle Ship Menu', category: 'UI' },
    'togglePerformanceMonitor': { key: 'F3', description: 'Toggle Performance Monitor', category: 'UI' },
    'toggleModelEditor': { key: 'KeyG', description: 'Toggle Model Editor', category: 'UI' },
    'toggleFleet': { key: 'KeyF', description: 'Toggle Fleet Panel', category: 'UI' },
    'toggleQuestTracker': { key: 'KeyJ', description: 'Toggle Quest Tracker', category: 'UI' },
    'spawnBattleEvent': { key: 'KeyP', description: 'Spawn Battle Event (Stress Test)', category: 'UI' },
    'toggleAdminDashboard': { key: 'Backquote', description: 'Toggle Admin Dashboard', category: 'UI' },
};

export class KeyBindings {
    constructor() {
        this.bindings = {};
        this.reverseMap = {}; // key -> action for quick lookup
        this.listeners = new Set();

        // Load saved bindings or use defaults
        this.load();
    }

    /**
     * Load bindings from localStorage or use defaults
     */
    load() {
        const saved = localStorage.getItem('expedition_keybindings');

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults (in case new bindings were added)
                this.bindings = { ...DEFAULT_BINDINGS };
                for (const [action, data] of Object.entries(parsed)) {
                    if (this.bindings[action]) {
                        this.bindings[action].key = data.key;
                    }
                }
            } catch (e) {
                console.warn('Failed to load keybindings, using defaults:', e);
                this.bindings = { ...DEFAULT_BINDINGS };
            }
        } else {
            this.bindings = { ...DEFAULT_BINDINGS };
        }

        this.buildReverseMap();
    }

    /**
     * Save bindings to localStorage
     */
    save() {
        const toSave = {};
        for (const [action, data] of Object.entries(this.bindings)) {
            toSave[action] = { key: data.key };
        }
        localStorage.setItem('expedition_keybindings', JSON.stringify(toSave));
        console.log('Keybindings saved');
    }

    /**
     * Build reverse lookup map (key -> action)
     */
    buildReverseMap() {
        this.reverseMap = {};
        for (const [action, data] of Object.entries(this.bindings)) {
            this.reverseMap[data.key] = action;
        }
    }

    /**
     * Get the key for an action
     */
    getKey(action) {
        return this.bindings[action]?.key || null;
    }

    /**
     * Get the action for a key
     */
    getAction(key) {
        return this.reverseMap[key] || null;
    }

    /**
     * Get binding info for an action
     */
    getBinding(action) {
        return this.bindings[action] || null;
    }

    /**
     * Set a new key for an action
     */
    setKey(action, newKey) {
        if (!this.bindings[action]) {
            console.warn(`Unknown action: ${action}`);
            return false;
        }

        // Check for conflicts
        const existingAction = this.reverseMap[newKey];
        if (existingAction && existingAction !== action) {
            // Swap the keys
            const oldKey = this.bindings[action].key;
            this.bindings[existingAction].key = oldKey;
        }

        // Set the new key
        this.bindings[action].key = newKey;

        // Rebuild reverse map
        this.buildReverseMap();

        // Save to localStorage
        this.save();

        // Notify listeners
        this.notifyListeners();

        return true;
    }

    /**
     * Reset to default bindings
     */
    resetToDefaults() {
        this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
        this.buildReverseMap();
        this.save();
        this.notifyListeners();
    }

    /**
     * Reset a single binding to default
     */
    resetBinding(action) {
        if (DEFAULT_BINDINGS[action]) {
            this.bindings[action].key = DEFAULT_BINDINGS[action].key;
            this.buildReverseMap();
            this.save();
            this.notifyListeners();
        }
    }

    /**
     * Check if a key event matches an action
     */
    matches(event, action) {
        const binding = this.bindings[action];
        if (!binding) return false;

        const keyStr = this.eventToKeyString(event);
        return keyStr === binding.key;
    }

    /**
     * Convert a keyboard event to a key string
     */
    eventToKeyString(event) {
        let key = event.code;

        // Add modifiers
        const modifiers = [];
        if (event.ctrlKey) modifiers.push('ctrl');
        if (event.altKey) modifiers.push('alt');
        if (event.shiftKey) modifiers.push('shift');

        if (modifiers.length > 0) {
            key = modifiers.join('+') + '+' + key;
        }

        return key;
    }

    /**
     * Convert key string to display format
     */
    keyToDisplay(keyStr) {
        if (!keyStr) return 'Not Set';

        const parts = keyStr.split('+');
        const displayParts = parts.map(part => {
            // Handle modifiers
            if (part === 'ctrl') return 'Ctrl';
            if (part === 'alt') return 'Alt';
            if (part === 'shift') return 'Shift';

            // Handle special keys
            if (part === 'Space') return 'Space';
            if (part === 'Tab') return 'Tab';
            if (part === 'Escape') return 'Esc';
            if (part === 'Enter') return 'Enter';
            if (part === 'Backspace') return 'Backspace';

            // Handle letter keys
            if (part.startsWith('Key')) return part.slice(3);

            // Handle digit keys
            if (part.startsWith('Digit')) return part.slice(5);

            // Handle function keys
            if (part.match(/^F\d+$/)) return part;

            // Handle numpad
            if (part.startsWith('Numpad')) return 'Num ' + part.slice(6);

            // Handle arrow keys
            if (part.startsWith('Arrow')) return part.slice(5) + ' Arrow';

            return part;
        });

        return displayParts.join(' + ');
    }

    /**
     * Get all bindings grouped by category
     */
    getBindingsByCategory() {
        const categories = {};

        for (const [action, data] of Object.entries(this.bindings)) {
            const category = data.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({
                action,
                key: data.key,
                description: data.description,
                isDefault: data.key === DEFAULT_BINDINGS[action]?.key,
            });
        }

        return categories;
    }

    /**
     * Add a change listener
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of changes
     */
    notifyListeners() {
        for (const listener of this.listeners) {
            try {
                listener(this.bindings);
            } catch (e) {
                console.error('Keybinding listener error:', e);
            }
        }
    }

    /**
     * Export bindings as JSON string
     */
    export() {
        return JSON.stringify(this.bindings, null, 2);
    }

    /**
     * Import bindings from JSON string
     */
    import(jsonStr) {
        try {
            const imported = JSON.parse(jsonStr);
            for (const [action, data] of Object.entries(imported)) {
                if (this.bindings[action] && data.key) {
                    this.bindings[action].key = data.key;
                }
            }
            this.buildReverseMap();
            this.save();
            this.notifyListeners();
            return true;
        } catch (e) {
            console.error('Failed to import keybindings:', e);
            return false;
        }
    }
}

// Singleton instance
export const keyBindings = new KeyBindings();
