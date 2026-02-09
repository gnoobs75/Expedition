// =============================================
// Guild System
// Mining Guild & Mercenary Guild with reputation,
// quests, rewards, and progression
// =============================================

import { CONFIG } from '../config.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { formatCredits } from '../utils/math.js';

// Reputation thresholds
export const GUILD_RANKS = {
    NEUTRAL:    { name: 'Neutral',    minRep: 0,    color: '#888888' },
    ASSOCIATE:  { name: 'Associate',  minRep: 100,  color: '#44aaff' },
    MEMBER:     { name: 'Member',     minRep: 500,  color: '#44ff44' },
    VETERAN:    { name: 'Veteran',    minRep: 1500, color: '#ffaa44' },
    ELITE:      { name: 'Elite',      minRep: 5000, color: '#ff44ff' },
};

// Quest definitions
export const QUEST_TEMPLATES = {
    // =============================================
    // MINING GUILD QUESTS
    // =============================================
    'mg-first-haul': {
        guild: 'mining',
        title: 'First Haul',
        description: 'Mine 200 units of any ore and sell it at a station.',
        minRank: 'NEUTRAL',
        type: 'mine-and-sell',
        objectives: [{ type: 'sell-ore', amount: 200 }],
        rewards: { credits: 2000, reputation: 50 },
        repeatable: false,
        dialogue: {
            offer: "Every capsuleer starts somewhere. Bring me 200 units of ore - any kind will do. Show me you've got the grit for this line of work.",
            progress: "Still working on that haul? Keep at it, miner.",
            complete: "Not bad for a greenhorn. You've got potential. Here's your cut.",
        },
    },
    'mg-veldspar-run': {
        guild: 'mining',
        title: 'Veldspar Delivery',
        description: 'Mine and sell 500 units of Veldspar.',
        minRank: 'NEUTRAL',
        type: 'mine-and-sell',
        objectives: [{ type: 'sell-ore', oreType: 'veldspar', amount: 500 }],
        rewards: { credits: 3000, reputation: 75 },
        repeatable: true,
        dialogue: {
            offer: "We need Veldspar for the station's hull plating. 500 units. Simple job, decent pay.",
            progress: "Veldspar doesn't mine itself. Get back out there.",
            complete: "Right on schedule. The fabricators will be busy tonight.",
        },
    },
    'mg-rare-minerals': {
        guild: 'mining',
        title: 'Rare Mineral Extraction',
        description: 'Mine and sell 200 units of Pyroxeres or Plagioclase.',
        minRank: 'ASSOCIATE',
        type: 'mine-and-sell',
        objectives: [{ type: 'sell-ore', oreType: 'pyroxeres', amount: 200, altOreType: 'plagioclase' }],
        rewards: { credits: 8000, reputation: 150, equipment: 'mining-laser-upgrade-1' },
        repeatable: true,
        dialogue: {
            offer: "We've got a special order - rare minerals. Pyroxeres or Plagioclase, 200 units. The good stuff pays well.",
            progress: "Rare ores don't come easy. Check the outer fields.",
            complete: "Excellent quality. Here's a little something extra - a mining upgrade from our private stocks.",
        },
    },
    'mg-danger-mining': {
        guild: 'mining',
        title: 'Dangerous Extraction',
        description: 'Mine 300 units of ore in a dangerous or deadly sector.',
        minRank: 'MEMBER',
        type: 'mine-in-sector',
        objectives: [{ type: 'mine-ore-in-sector', amount: 300, sectorDifficulty: ['dangerous', 'deadly'] }],
        rewards: { credits: 15000, reputation: 300 },
        repeatable: true,
        dialogue: {
            offer: "The richest fields are in hostile space. 300 units from dangerous territory. Pirates won't make it easy.",
            progress: "I can see your nav logs. You haven't hit the danger zones yet.",
            complete: "You came back alive AND with ore. That's why the Guild values you.",
        },
    },
    'mg-bulk-order': {
        guild: 'mining',
        title: 'Bulk Ore Contract',
        description: 'Sell 2000 units of any ore. A massive haul for a massive payout.',
        minRank: 'VETERAN',
        type: 'mine-and-sell',
        objectives: [{ type: 'sell-ore', amount: 2000 }],
        rewards: { credits: 40000, reputation: 500, shipDiscount: 'prospector' },
        repeatable: true,
        dialogue: {
            offer: "The Guild is commissioning a capital ship. We need 2000 units of ore. Any type. This is the big leagues.",
            progress: "That's a lot of rock to move. Keep the holds full and the lasers hot.",
            complete: "Outstanding work. The Guild won't forget this. And as a token of our gratitude - a discount on our exclusive Prospector-class vessel.",
        },
    },
    'mg-scordite-specialist': {
        guild: 'mining',
        title: 'Scordite Specialist',
        description: 'Mine and sell 800 units of Scordite.',
        minRank: 'ASSOCIATE',
        type: 'mine-and-sell',
        objectives: [{ type: 'sell-ore', oreType: 'scordite', amount: 800 }],
        rewards: { credits: 12000, reputation: 200 },
        repeatable: true,
        dialogue: {
            offer: "Scordite's in demand for alloy production. 800 units would fill the quota nicely.",
            progress: "Scordite has that distinctive brown shimmer. Hard to miss.",
            complete: "Perfect grade Scordite. The refinery crews will be pleased.",
        },
    },

    // =============================================
    // MERCENARY GUILD QUESTS
    // =============================================
    'merc-first-blood': {
        guild: 'mercenary',
        title: 'First Blood',
        description: 'Destroy 3 pirate ships.',
        minRank: 'NEUTRAL',
        type: 'kill',
        objectives: [{ type: 'kill-pirates', amount: 3 }],
        rewards: { credits: 3000, reputation: 50 },
        repeatable: false,
        dialogue: {
            offer: "Pirates are a plague on these spacelanes. Take out 3 of them and we'll know you mean business.",
            progress: "Three pirates. Not three asteroids. Get shooting.",
            complete: "Clean kills. You've got the instincts. Welcome to the fight.",
        },
    },
    'merc-patrol-duty': {
        guild: 'mercenary',
        title: 'Patrol Duty',
        description: 'Destroy 5 pirate ships in any sector.',
        minRank: 'NEUTRAL',
        type: 'kill',
        objectives: [{ type: 'kill-pirates', amount: 5 }],
        rewards: { credits: 5000, reputation: 100 },
        repeatable: true,
        dialogue: {
            offer: "Standard bounty contract. Five pirates, any sector. Keep the lanes safe.",
            progress: "Five targets. Don't come back until they're debris.",
            complete: "Another day, another batch of pirates turned to scrap. Here's your bounty.",
        },
    },
    'merc-pirate-hunter': {
        guild: 'mercenary',
        title: 'Pirate Hunter',
        description: 'Destroy 10 pirate ships. Serious firepower required.',
        minRank: 'ASSOCIATE',
        type: 'kill',
        objectives: [{ type: 'kill-pirates', amount: 10 }],
        rewards: { credits: 15000, reputation: 250, equipment: 'tracking-computer-1' },
        repeatable: true,
        dialogue: {
            offer: "We've identified a pirate cell operating in force. Ten confirmed hostiles. Bring them down and earn a premium bounty.",
            progress: "That pirate cell is still operational. Keep hunting.",
            complete: "Ten confirmed kills. Impressive. Take this tracking computer - Guild issue. It'll help you find them faster.",
        },
    },
    'merc-dangerous-hunt': {
        guild: 'mercenary',
        title: 'Dangerous Territory Sweep',
        description: 'Destroy 8 pirates in dangerous or deadly sectors.',
        minRank: 'MEMBER',
        type: 'kill-in-sector',
        objectives: [{ type: 'kill-pirates-in-sector', amount: 8, sectorDifficulty: ['dangerous', 'deadly'] }],
        rewards: { credits: 25000, reputation: 400 },
        repeatable: true,
        dialogue: {
            offer: "Deep space is crawling with hostiles. We need someone with steel nerves to clear out 8 pirates from dangerous territory.",
            progress: "The hostile zones won't clean themselves. Get back in there.",
            complete: "You walked into hell and came back. The Guild salutes you.",
        },
    },
    'merc-cruiser-buster': {
        guild: 'mercenary',
        title: 'Capital Threat',
        description: 'Destroy 5 pirate cruisers or larger.',
        minRank: 'VETERAN',
        type: 'kill',
        objectives: [{ type: 'kill-pirates', amount: 5, minClass: 'cruiser' }],
        rewards: { credits: 50000, reputation: 600, shipDiscount: 'enforcer' },
        repeatable: true,
        dialogue: {
            offer: "Intel reports pirate capital movement in the region. Destroy 5 cruiser-class or larger vessels. This is no milk run.",
            progress: "Those big ships won't go down easy. Bring friends or bigger guns.",
            complete: "Five capital kills. You're a legend in the making. The Guild offers you exclusive access to the Enforcer-class destroyer.",
        },
    },
    'merc-raid-defense': {
        guild: 'mercenary',
        title: 'Raid Defense',
        description: 'Destroy 15 pirates total. Defend the sectors.',
        minRank: 'MEMBER',
        type: 'kill',
        objectives: [{ type: 'kill-pirates', amount: 15 }],
        rewards: { credits: 20000, reputation: 350 },
        repeatable: true,
        dialogue: {
            offer: "Multiple pirate raids detected across the system. We need 15 confirmed kills to stem the tide.",
            progress: "The raids haven't stopped. Keep fighting.",
            complete: "Fifteen down. You've turned the tide. The miners can breathe again.",
        },
    },
};

export class GuildSystem {
    constructor(game) {
        this.game = game;

        // Guild reputation
        this.reputation = {
            mining: 0,
            mercenary: 0,
        };

        // Active quests (max 3)
        this.activeQuests = [];
        this.maxActiveQuests = 3;

        // Completed quest history
        this.completedQuests = new Set();

        // Quest progress tracking
        this.questProgress = {};

        // Ore sold tracking (for mining quests)
        this.oreSoldThisSession = {};

        // Load saved state
        this.loadState();

        // Set up event listeners
        this.setupEvents();
    }

    setupEvents() {
        // Track pirate kills
        this.game.events.on('entity:destroyed', (entity) => {
            if (entity.hostility === 'hostile' || entity.type === 'enemy') {
                this.onPirateKilled(entity);
            }
        });

        // Track ore mining (per cycle)
        this.game.events.on('mining:complete', (data) => {
            this.onOreMined(data);
        });
    }

    /**
     * Get guild rank for a given reputation value
     */
    getRank(guild) {
        const rep = this.reputation[guild] || 0;
        let rank = GUILD_RANKS.NEUTRAL;
        for (const [key, info] of Object.entries(GUILD_RANKS)) {
            if (rep >= info.minRep) rank = { ...info, key };
        }
        return rank;
    }

    /**
     * Get next rank info
     */
    getNextRank(guild) {
        const rep = this.reputation[guild] || 0;
        const ranks = Object.entries(GUILD_RANKS);
        for (const [key, info] of ranks) {
            if (rep < info.minRep) return { ...info, key };
        }
        return null; // Max rank
    }

    /**
     * Get available quests for a guild
     */
    getAvailableQuests(guild) {
        const rank = this.getRank(guild);
        const rankOrder = Object.keys(GUILD_RANKS);
        const rankIndex = rankOrder.indexOf(rank.key);

        return Object.entries(QUEST_TEMPLATES)
            .filter(([id, quest]) => {
                if (quest.guild !== guild) return false;
                // Check rank requirement
                const reqIndex = rankOrder.indexOf(quest.minRank);
                if (rankIndex < reqIndex) return false;
                // Check if already active
                if (this.activeQuests.find(q => q.id === id)) return false;
                // Check if completed and not repeatable
                if (!quest.repeatable && this.completedQuests.has(id)) return false;
                return true;
            })
            .map(([id, quest]) => ({ id, ...quest }));
    }

    /**
     * Accept a quest
     */
    acceptQuest(questId) {
        if (this.activeQuests.length >= this.maxActiveQuests) {
            this.game.ui?.toast('Maximum active quests reached (3)', 'warning');
            return false;
        }

        const template = QUEST_TEMPLATES[questId];
        if (!template) return false;

        const quest = {
            id: questId,
            ...template,
            progress: template.objectives.map(obj => ({ ...obj, current: 0 })),
            acceptedAt: Date.now(),
        };

        this.activeQuests.push(quest);
        this.game.ui?.toast(`Quest accepted: ${template.title}`, 'success');
        this.game.ui?.log(`Quest accepted: ${template.title}`, 'system');
        this.game.audio?.play('quest-accept');
        this.game.events.emit('quest:accepted', quest);

        this.saveState();
        return true;
    }

    /**
     * Abandon a quest
     */
    abandonQuest(questId) {
        const index = this.activeQuests.findIndex(q => q.id === questId);
        if (index === -1) return;

        const quest = this.activeQuests.splice(index, 1)[0];
        this.game.ui?.toast(`Quest abandoned: ${quest.title}`, 'warning');
        this.game.ui?.log(`Quest abandoned: ${quest.title}`, 'system');

        this.saveState();
    }

    /**
     * Check and complete quests
     */
    checkQuestCompletion() {
        const completed = [];

        for (const quest of this.activeQuests) {
            const allComplete = quest.progress.every(obj => obj.current >= obj.amount);
            if (allComplete) {
                completed.push(quest);
            }
        }

        for (const quest of completed) {
            this.completeQuest(quest);
        }
    }

    /**
     * Complete a quest and give rewards
     */
    completeQuest(quest) {
        // Remove from active
        const index = this.activeQuests.indexOf(quest);
        if (index !== -1) this.activeQuests.splice(index, 1);

        // Mark completed
        this.completedQuests.add(quest.id);

        // Give rewards
        const rewards = quest.rewards;
        if (rewards.credits) {
            this.game.addCredits(rewards.credits);
        }
        if (rewards.reputation) {
            const oldRank = this.getRank(quest.guild);
            this.reputation[quest.guild] += rewards.reputation;
            const newRank = this.getRank(quest.guild);

            // Check for rank up
            if (newRank.key !== oldRank.key) {
                const guildName = quest.guild === 'mining' ? 'Mining Guild' : 'Mercenary Guild';
                this.game.ui?.toast(`${guildName} rank up: ${newRank.name}!`, 'success');
                this.game.ui?.log(`Promoted to ${newRank.name} in the ${guildName}!`, 'system');
                this.game.audio?.play('level-up');
                if (this.game.player) {
                    this.game.renderer?.effects?.spawn('level-up', this.game.player.x, this.game.player.y, { color: newRank.color ? parseInt(newRank.color.slice(1), 16) : 0xff44ff });
                }
                this.game.events.emit('guild:rankup', { guild: quest.guild, rank: newRank });
            }
        }
        if (rewards.equipment) {
            // Add equipment to player inventory
            const config = EQUIPMENT_DATABASE[rewards.equipment];
            if (config && this.game.player) {
                if (!this.game.player.moduleInventory) this.game.player.moduleInventory = [];
                this.game.player.moduleInventory.push({ id: rewards.equipment, config });
            }
        }

        this.game.ui?.toast(`Quest complete: ${quest.title}!`, 'success');
        this.game.ui?.log(`Quest complete: ${quest.title} - Reward: ${formatCredits(rewards.credits || 0)} ISK, +${rewards.reputation || 0} reputation`, 'system');
        this.game.audio?.play('quest-complete');
        this.game.events.emit('quest:completed', quest);

        this.saveState();
    }

    /**
     * Handle pirate killed event
     */
    onPirateKilled(entity) {
        const sectorDifficulty = this.game.currentSector?.difficulty;

        for (const quest of this.activeQuests) {
            for (const obj of quest.progress) {
                if (obj.type === 'kill-pirates' && obj.current < obj.amount) {
                    // Check min class requirement
                    if (obj.minClass) {
                        const classOrder = ['frigate', 'destroyer', 'cruiser', 'battlecruiser', 'battleship', 'capital'];
                        const entityClass = entity.shipClass || entity.shipType || 'frigate';
                        const entityIndex = classOrder.indexOf(entityClass);
                        const reqIndex = classOrder.indexOf(obj.minClass);
                        if (entityIndex < reqIndex) continue;
                    }
                    obj.current++;
                }
                if (obj.type === 'kill-pirates-in-sector' && obj.current < obj.amount) {
                    if (obj.sectorDifficulty && obj.sectorDifficulty.includes(sectorDifficulty)) {
                        obj.current++;
                    }
                }
            }
        }

        this.checkQuestCompletion();
        this.saveState();
    }

    /**
     * Handle ore mined event
     */
    onOreMined(data) {
        const sectorDifficulty = this.game.currentSector?.difficulty;

        for (const quest of this.activeQuests) {
            for (const obj of quest.progress) {
                if (obj.type === 'mine-ore-in-sector' && obj.current < obj.amount) {
                    if (obj.sectorDifficulty && obj.sectorDifficulty.includes(sectorDifficulty)) {
                        obj.current += data.units || 1;
                    }
                }
            }
        }

        this.saveState();
    }

    /**
     * Handle ore sold at station
     */
    onOreSold(oreType, units) {
        for (const quest of this.activeQuests) {
            for (const obj of quest.progress) {
                if (obj.type === 'sell-ore' && obj.current < obj.amount) {
                    // Check ore type requirement
                    if (obj.oreType) {
                        if (oreType !== obj.oreType && oreType !== obj.altOreType) continue;
                    }
                    obj.current += units;
                }
            }
        }

        this.checkQuestCompletion();
        this.saveState();
    }

    /**
     * Get ship discount for guild rewards
     */
    getShipDiscount(shipId) {
        // Check if any completed quest grants a discount for this ship
        for (const questId of this.completedQuests) {
            const template = QUEST_TEMPLATES[questId];
            if (template?.rewards?.shipDiscount === shipId) {
                return 0.25; // 25% discount
            }
        }
        return 0;
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        const state = {
            reputation: this.reputation,
            activeQuests: this.activeQuests,
            completedQuests: [...this.completedQuests],
        };
        localStorage.setItem('expedition-guild-state', JSON.stringify(state));
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem('expedition-guild-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.reputation = state.reputation || { mining: 0, mercenary: 0 };
                this.activeQuests = state.activeQuests || [];
                this.completedQuests = new Set(state.completedQuests || []);
            }
        } catch (e) {
            // Ignore corrupt saves
        }
    }

    /**
     * Update - called each frame
     */
    update(dt) {
        // Nothing to do per-frame currently
    }
}
