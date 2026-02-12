// =============================================
// Save/Load Manager
// Handles game state persistence across sessions
// =============================================

export class SaveManager {
    constructor(game) {
        this.game = game;
        this.autoSaveTimer = null;
        this.SAVE_VERSION = 2;
        this.SLOT_PREFIX = 'expedition-save-';
        this.AUTO_SLOT = 'auto';
    }

    // ==========================================
    // Slot Operations
    // ==========================================

    /**
     * Save current game state to a slot
     */
    save(slotKey) {
        try {
            const data = this.gatherSaveData();
            data.slotName = this.getSlotName(slotKey);
            localStorage.setItem(
                this.SLOT_PREFIX + slotKey,
                JSON.stringify(data)
            );
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    }

    /**
     * Load save data from a slot (returns parsed object, does NOT apply it)
     */
    load(slotKey) {
        try {
            const raw = localStorage.getItem(this.SLOT_PREFIX + slotKey);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !data.version) return null;
            return data;
        } catch (e) {
            console.error('Load failed:', e);
            return null;
        }
    }

    /**
     * Delete a save slot
     */
    delete(slotKey) {
        localStorage.removeItem(this.SLOT_PREFIX + slotKey);
    }

    /**
     * List all save slots with summary info
     */
    listSlots() {
        const slots = [];
        const keys = ['slot-1', 'slot-2', 'slot-3', this.AUTO_SLOT];

        for (const key of keys) {
            const raw = localStorage.getItem(this.SLOT_PREFIX + key);
            if (raw) {
                try {
                    const data = JSON.parse(raw);
                    slots.push({
                        key,
                        name: data.slotName || (key === this.AUTO_SLOT ? 'Auto Save' : key),
                        timestamp: data.timestamp || 0,
                        playtime: data.playtime || 0,
                        shipClass: data.shipClass || 'frigate',
                        sectorId: data.currentSectorId || 'hub',
                        credits: data.credits || 0,
                        factionName: data.faction?.name || null,
                    });
                } catch {
                    // corrupt slot, skip
                }
            } else {
                slots.push({ key, name: null, timestamp: 0, empty: true });
            }
        }

        return slots;
    }

    /**
     * Get display name for a slot
     */
    getSlotName(slotKey) {
        if (slotKey === this.AUTO_SLOT) return 'Auto Save';
        const existing = this.load(slotKey);
        if (existing?.slotName && existing.slotName !== slotKey) return existing.slotName;
        const num = slotKey.replace('slot-', '');
        return `Slot ${num}`;
    }

    /**
     * Rename a save slot
     */
    renameSlot(slotKey, newName) {
        const data = this.load(slotKey);
        if (!data) return false;
        data.slotName = newName;
        localStorage.setItem(this.SLOT_PREFIX + slotKey, JSON.stringify(data));
        return true;
    }

    // ==========================================
    // File Export/Import
    // ==========================================

    /**
     * Export a save slot as a downloadable .expedition JSON file
     */
    exportToFile(slotKey) {
        const data = this.load(slotKey);
        if (!data) return;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expedition-${slotKey}-${Date.now()}.expedition`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import a save file from disk
     * @returns {Promise<object>} Parsed save data
     */
    importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data || !data.version) {
                        reject(new Error('Invalid save file: missing version'));
                        return;
                    }
                    if (data.version > this.SAVE_VERSION) {
                        reject(new Error(`Save file version ${data.version} is newer than supported (${this.SAVE_VERSION})`));
                        return;
                    }
                    resolve(data);
                } catch (err) {
                    reject(new Error('Invalid save file: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Import data and save to a specific slot
     */
    importToSlot(data, slotKey) {
        try {
            localStorage.setItem(this.SLOT_PREFIX + slotKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Import to slot failed:', e);
            return false;
        }
    }

    // ==========================================
    // Gather Game State
    // ==========================================

    /**
     * Collect all game state into a serializable object
     */
    gatherSaveData() {
        const game = this.game;
        const player = game.player;

        // Update playtime before saving
        const now = Date.now();
        if (game.stats.sessionStart) {
            game.stats.playTime += (now - game.stats.sessionStart) / 1000;
            game.stats.sessionStart = now;
        }

        const data = {
            version: this.SAVE_VERSION,
            timestamp: now,
            slotName: '',
            playtime: game.stats.playTime || 0,

            // Player
            credits: game.credits,
            shipClass: player?.shipClass || 'frigate',
            shipModules: player ? {
                high: [...player.modules.high],
                mid: [...player.modules.mid],
                low: [...player.modules.low],
            } : { high: [], mid: [], low: [] },
            cargo: player ? { ...player.cargo } : {},
            tradeGoods: player ? { ...player.tradeGoods } : {},
            moduleInventory: player?.moduleInventory ? [...player.moduleInventory] : [],
            droneBay: player ? {
                drones: player.droneBay.drones.map(d => ({ type: d.type, hp: d.hp })),
                capacity: player.droneBay.capacity,
                bandwidth: player.droneBay.bandwidth,
            } : { drones: [], capacity: 0, bandwidth: 0 },
            currentSectorId: game.currentSector?.id || 'hub',
            powerRouting: { ...game.powerRouting },

            // Fleet
            fleet: {
                ships: game.fleet.ships.map(s => ({
                    shipClass: s.shipClass || 'frigate',
                    pilot: s.pilot ? {
                        name: s.pilot.name || s.pilot,
                        id: s.pilot.id || s.fleetId,
                    } : null,
                    fleetId: s.fleetId,
                    groupId: s.groupId || 0,
                    stance: s.stance || 'aggressive',
                })),
                hiredPilots: [...(game.fleet.hiredPilots || [])],
                controlGroups: this.serializeControlGroups(),
            },

            // Faction
            faction: game.faction ? { ...game.faction } : { name: 'Unnamed Faction', color: '#00ccff', treasury: 0 },

            // Insurance
            insurance: { ...game.insurance },

            // Stats
            stats: {
                kills: game.stats.kills || 0,
                deaths: game.stats.deaths || 0,
                damageDealt: game.stats.damageDealt || 0,
                damageTaken: game.stats.damageTaken || 0,
                oreMined: game.stats.oreMined || 0,
                bountyEarned: game.stats.bountyEarned || 0,
                jumps: game.stats.jumps || 0,
                sectorsVisited: [...(game.stats.sectorsVisited || [])],
                killsByType: { ...(game.stats.killsByType || {}) },
                playTime: game.stats.playTime || 0,
            },

            // Subsystem localStorage keys - read directly
            skills: this.readLocalStorage('expedition-skills'),
            achievements: this.readLocalStorage('expedition-achievements'),
            guildState: this.readLocalStorage('expedition-guild-state'),
            guildEconomy: this.readLocalStorage('expedition-guild-economy'),
            commerceState: this.readLocalStorage('expedition-commerce-state'),
            discoveries: this.readLocalStorage('expedition-discoveries'),
            surveyData: this.readLocalStorage('expedition-survey-data'),
            bounties: this.readLocalStorage('expedition-bounties'),
            completedBounties: this.readLocalStorage('expedition-completed-bounties'),
            bountyCounter: this.readLocalStorageRaw('expedition-bounty-counter'),
            bountyRefresh: this.readLocalStorageRaw('expedition-bounty-refresh'),
            shipLog: this.readLocalStorage('expedition-ship-log'),
            bookmarks: this.readLocalStorage('expedition-bookmarks'),
            skippy: this.readLocalStorage('expedition-skippy'),
            aarReports: this.readLocalStorage('expedition-aar-reports'),
        };

        return data;
    }

    /**
     * Serialize control groups for save data
     */
    serializeControlGroups() {
        const groups = {};
        const fleetSystem = this.game.fleetSystem;
        if (!fleetSystem) return groups;

        for (const [groupId, fleetIds] of fleetSystem.controlGroups) {
            if (fleetIds.size > 0) {
                groups[groupId] = [...fleetIds];
            }
        }
        return groups;
    }

    /**
     * Read and parse a localStorage key (JSON)
     */
    readLocalStorage(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    /**
     * Read a localStorage key as raw string
     */
    readLocalStorageRaw(key) {
        return localStorage.getItem(key) || null;
    }

    // ==========================================
    // Auto-save
    // ==========================================

    /**
     * Enable periodic auto-save
     */
    enableAutoSave(intervalMs = 60000) {
        this.disableAutoSave();
        this.autoSaveTimer = setInterval(() => {
            this.autoSaveNow();
        }, intervalMs);
    }

    /**
     * Disable auto-save
     */
    disableAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Perform an auto-save immediately
     */
    autoSaveNow() {
        if (!this.game.player?.alive) return;
        if (this.game.dockedAt) {
            // Always safe to save when docked
        }
        this.save(this.AUTO_SLOT);
    }
}
