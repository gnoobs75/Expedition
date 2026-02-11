// =============================================
// Achievement / Badge System
// Tracks milestones and awards badges
// =============================================

const ACHIEVEMENTS = {
    // Combat
    first_blood: {
        name: 'First Blood',
        desc: 'Destroy your first enemy',
        icon: '\u2694',
        category: 'Combat',
        check: s => s.kills >= 1,
    },
    hunter: {
        name: 'Hunter',
        desc: 'Destroy 10 enemies',
        icon: '\u2620',
        category: 'Combat',
        check: s => s.kills >= 10,
    },
    ace: {
        name: 'Ace Pilot',
        desc: 'Destroy 50 enemies',
        icon: '\u2605',
        category: 'Combat',
        check: s => s.kills >= 50,
    },
    warlord: {
        name: 'Warlord',
        desc: 'Destroy 200 enemies',
        icon: '\u265B',
        category: 'Combat',
        check: s => s.kills >= 200,
    },
    bounty_hunter: {
        name: 'Bounty Hunter',
        desc: 'Earn 10,000 ISK in bounties',
        icon: '\u2727',
        category: 'Combat',
        check: s => s.bountyEarned >= 10000,
    },
    survivor: {
        name: 'Survivor',
        desc: 'Achieve 10 kills without dying',
        icon: '\u2764',
        category: 'Combat',
        check: s => s.kills >= 10 && s.deaths === 0,
    },

    // Mining
    prospector: {
        name: 'Prospector',
        desc: 'Mine 100 units of ore',
        icon: '\u26CF',
        category: 'Mining',
        check: s => s.oreMined >= 100,
    },
    strip_miner: {
        name: 'Strip Miner',
        desc: 'Mine 1,000 units of ore',
        icon: '\u26A0',
        category: 'Mining',
        check: s => s.oreMined >= 1000,
    },
    deep_core: {
        name: 'Deep Core',
        desc: 'Mine 5,000 units of ore',
        icon: '\u2B50',
        category: 'Mining',
        check: s => s.oreMined >= 5000,
    },

    // Navigation
    first_jump: {
        name: 'Gate Jumper',
        desc: 'Jump through your first gate',
        icon: '\u26A1',
        category: 'Navigation',
        check: s => s.jumps >= 1,
    },
    frequent_flyer: {
        name: 'Frequent Flyer',
        desc: 'Jump through 20 gates',
        icon: '\u2708',
        category: 'Navigation',
        check: s => s.jumps >= 20,
    },
    explorer: {
        name: 'Explorer',
        desc: 'Visit all 7 sectors',
        icon: '\u2731',
        category: 'Navigation',
        check: s => s.sectorsVisited?.length >= 7,
    },
    speed_demon: {
        name: 'Speed Demon',
        desc: 'Jump through 50 gates',
        icon: '\u21C9',
        category: 'Navigation',
        check: s => s.jumps >= 50,
    },

    // Economy
    first_trade: {
        name: 'First Trade',
        desc: 'Earn your first credits',
        icon: '\u2696',
        category: 'Economy',
        check: (s, g) => g.credits > g.startingCredits,
    },
    wealthy: {
        name: 'Wealthy',
        desc: 'Accumulate 50,000 ISK',
        icon: '\u2742',
        category: 'Economy',
        check: (s, g) => g.credits >= 50000,
    },
    tycoon: {
        name: 'Tycoon',
        desc: 'Accumulate 500,000 ISK',
        icon: '\u2654',
        category: 'Economy',
        check: (s, g) => g.credits >= 500000,
    },

    // Progression
    veteran: {
        name: 'Veteran',
        desc: 'Play for 30 minutes',
        icon: '\u231A',
        category: 'Progression',
        check: s => (s.playTime + (Date.now() - s.sessionStart) / 1000) >= 1800,
    },
    dedicated: {
        name: 'Dedicated',
        desc: 'Play for 2 hours',
        icon: '\u2B50',
        category: 'Progression',
        check: s => (s.playTime + (Date.now() - s.sessionStart) / 1000) >= 7200,
    },
    no_insurance: {
        name: 'Risk Taker',
        desc: 'Die without insurance',
        icon: '\u2623',
        category: 'Progression',
        check: s => s.deaths >= 1,
    },

    // Milestones
    deal_damage: {
        name: 'Heavy Hitter',
        desc: 'Deal 10,000 total damage',
        icon: '\u2622',
        category: 'Combat',
        check: s => s.damageDealt >= 10000,
    },
    tank: {
        name: 'Tank',
        desc: 'Take 10,000 total damage',
        icon: '\u26E8',
        category: 'Combat',
        check: s => s.damageTaken >= 10000,
    },
};

export class AchievementSystem {
    constructor(game) {
        this.game = game;
        this.unlocked = this.load();
        this._checkTimer = 0;
    }

    /**
     * Called from game update or periodically
     */
    update(dt) {
        this._checkTimer += dt;
        if (this._checkTimer < 5) return; // Check every 5 seconds
        this._checkTimer = 0;
        this.checkAll();
    }

    checkAll() {
        const stats = this.game.stats;
        const gameCtx = {
            credits: this.game.credits,
            startingCredits: CONFIG_START_CREDITS,
        };

        for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
            if (this.unlocked[id]) continue;

            try {
                if (def.check(stats, gameCtx)) {
                    this.unlock(id, def);
                }
            } catch (e) {
                // Skip broken checks
            }
        }
    }

    unlock(id, def) {
        this.unlocked[id] = {
            unlockedAt: Date.now(),
        };
        this.save();

        // Notify player
        this.game.ui?.showToast(`Achievement: ${def.name}`, 'achievement');
        this.game.ui?.log(`Achievement unlocked: ${def.name} - ${def.desc}`, 'system');
        this.game.ui?.addShipLogEntry(`Achievement: ${def.name}`, 'quest');
        this.game.audio?.play('quest-complete');

        // Visual effect
        const p = this.game.player;
        if (p) {
            this.game.renderer?.effects?.spawnEffect?.('quest-complete', p.x, p.y);
            this.game.renderer?.effects?.spawn?.('quest-complete', p.x, p.y);
        }
    }

    /**
     * Get all achievements for display
     */
    getAll() {
        return Object.entries(ACHIEVEMENTS).map(([id, def]) => ({
            id,
            ...def,
            unlocked: !!this.unlocked[id],
            unlockedAt: this.unlocked[id]?.unlockedAt || null,
        }));
    }

    /**
     * Get achievements grouped by category
     */
    getByCategory() {
        const cats = {};
        for (const a of this.getAll()) {
            if (!cats[a.category]) cats[a.category] = [];
            cats[a.category].push(a);
        }
        return cats;
    }

    getUnlockedCount() {
        return Object.keys(this.unlocked).length;
    }

    getTotalCount() {
        return Object.keys(ACHIEVEMENTS).length;
    }

    save() {
        try {
            localStorage.setItem('expedition-achievements', JSON.stringify(this.unlocked));
        } catch (e) { /* storage full */ }
    }

    load() {
        try {
            const data = localStorage.getItem('expedition-achievements');
            if (data) return JSON.parse(data);
        } catch (e) { /* corrupt */ }
        return {};
    }
}

const CONFIG_START_CREDITS = 10000; // Mirror CONFIG.PLAYER_START_CREDITS
