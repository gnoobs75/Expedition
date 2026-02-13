// =============================================
// Commerce System
// Commerce Guild with transportation quests,
// trade route management, and hauling economy
// =============================================

import { TRADE_GOODS, STATION_SPECIALTIES, getStationPrice, getBestTradeRoute } from '../data/tradeGoodsDatabase.js';
import { formatCredits } from '../utils/math.js';

// Commerce Guild ranks (same structure as other guilds)
export const COMMERCE_RANKS = {
    NEUTRAL:    { name: 'Neutral',       minRep: 0,    color: '#888888' },
    COURIER:    { name: 'Courier',       minRep: 100,  color: '#44aaff' },
    TRADER:     { name: 'Trader',        minRep: 500,  color: '#44ff44' },
    MERCHANT:   { name: 'Merchant',      minRep: 1500, color: '#ffaa44' },
    MAGNATE:    { name: 'Trade Magnate', minRep: 5000, color: '#ff44ff' },
};

// Transport quest templates (generated dynamically based on station needs)
const TRANSPORT_QUEST_TEMPLATES = [
    // Tier 1: Simple courier runs (NEUTRAL)
    {
        tier: 1,
        minRank: 'NEUTRAL',
        titlePattern: 'Courier Run: {good}',
        descPattern: 'Deliver {amount} units of {good} from {source} to {dest}.',
        amountRange: [5, 15],
        rewardMultiplier: 1.5,
        repReward: 50,
        dialogueOffer: "Simple delivery job. Pick up {amount} {good} from {source} and bring them here. Standard courier rate.",
        dialogueComplete: "Package received. Quick and clean. Here's your pay.",
    },
    {
        tier: 1,
        minRank: 'NEUTRAL',
        titlePattern: 'Supply Delivery: {good}',
        descPattern: 'We need {amount} units of {good}. Purchase from {source} and deliver here.',
        amountRange: [8, 20],
        rewardMultiplier: 1.4,
        repReward: 60,
        dialogueOffer: "Station's running low on {good}. {source} has it in stock. Bring us {amount} units and we'll make it worth your while.",
        dialogueComplete: "Supplies received. The station crew thanks you, capsuleer.",
    },
    // Tier 2: Medium hauls (COURIER)
    {
        tier: 2,
        minRank: 'COURIER',
        titlePattern: 'Trade Route: {good}',
        descPattern: 'Buy {amount} units of {good} at {source} and sell at {dest} for profit. Guild bonus on delivery.',
        amountRange: [15, 35],
        rewardMultiplier: 1.8,
        repReward: 120,
        dialogueOffer: "I've identified a profitable trade route. {source} is selling {good} cheap. Buy {amount} units and bring them here - the markup covers your fuel and then some.",
        dialogueComplete: "Excellent margins on that run. The Commerce Guild remembers who keeps the trade lanes flowing.",
    },
    {
        tier: 2,
        minRank: 'COURIER',
        titlePattern: 'Priority Shipment: {good}',
        descPattern: 'Urgently deliver {amount} units of {good} from {source}. Time-sensitive cargo.',
        amountRange: [10, 25],
        rewardMultiplier: 2.0,
        repReward: 150,
        dialogueOffer: "Priority contract. {amount} units of {good} from {source}, delivered here as fast as your drives can push. Premium rate for urgency.",
        dialogueComplete: "Delivered on time. That's what separates couriers from traders. Premium paid in full.",
    },
    // Tier 3: Large contracts (TRADER)
    {
        tier: 3,
        minRank: 'TRADER',
        titlePattern: 'Bulk Contract: {good}',
        descPattern: 'Transport {amount} units of {good} from {source}. Major commercial operation.',
        amountRange: [30, 60],
        rewardMultiplier: 2.2,
        repReward: 250,
        dialogueOffer: "Big contract. {amount} units of {good} from {source}. You'll need cargo space and the nerve to haul through potentially hostile territory.",
        dialogueComplete: "That's a serious haul. The Commerce Guild has contracts like these for dependable traders. You've earned your stripes.",
    },
    // Tier 4: High-value runs (MERCHANT)
    {
        tier: 4,
        minRank: 'MERCHANT',
        titlePattern: 'Caravan Contract: {good}',
        descPattern: 'Massive shipment: {amount} units of {good} from {source}. Extremely lucrative.',
        amountRange: [50, 100],
        rewardMultiplier: 2.5,
        repReward: 400,
        dialogueOffer: "Only our most trusted merchants get these contracts. {amount} units of {good} from {source}. The payout is enormous, but so is the risk. Pirates love targeting fat cargo holds.",
        dialogueComplete: "A hundred units delivered without a scratch. You're building an empire, trader. The Guild is proud to have you.",
    },
    // Tier 5: Endgame Expedition Contracts (MAGNATE)
    {
        tier: 5,
        minRank: 'MAGNATE',
        titlePattern: 'Expedition: {good} Supply Chain',
        descPattern: 'Establish a supply chain: deliver {amount} units of {good} from {source}, then return with a cargo of {returnGood} from the destination. Double payout.',
        amountRange: [80, 150],
        rewardMultiplier: 3.5,
        repReward: 600,
        isExpedition: true,
        dialogueOffer: "This is an expedition-class contract. {amount} units of {good} from {source}, but that's only half the job. On arrival, you'll pick up {returnGood} for the return leg. Double the risk, double the payout. Only Trade Magnates need apply.",
        dialogueComplete: "A full round-trip expedition completed flawlessly. The Commerce Guild's highest honor goes to those who move mountains of cargo across hostile space. Legendary work, Magnate.",
    },
    {
        tier: 5,
        minRank: 'MAGNATE',
        titlePattern: 'Fleet Logistics: {good}',
        descPattern: 'Organize fleet-scale transport of {amount} units of {good} from {source}. Requires substantial cargo capacity.',
        amountRange: [120, 200],
        rewardMultiplier: 4.0,
        repReward: 800,
        isExpedition: true,
        dialogueOffer: "Fleet-scale logistics operation. {amount} units of {good} - you'll likely need your fleet haulers for this one. {source} has the cargo ready. This is the kind of contract that builds empires.",
        dialogueComplete: "Fleet logistics at its finest. That volume of cargo moved safely through contested space... the Commerce Guild will sing your praises across every station in the sector.",
    },
];

export class CommerceSystem {
    constructor(game) {
        this.game = game;

        // Commerce Guild reputation
        this.reputation = 0;

        // Active transport quests (max 3, shared limit with other guilds)
        this.activeQuests = [];
        this.maxActiveQuests = 3;

        // Completed quest IDs
        this.completedQuests = new Set();

        // Available quests (regenerated when docking)
        this.availableQuests = [];

        // Quest ID counter
        this.questCounter = 0;

        // Trade volume tracking per sector (for strategic map overlay)
        this.tradeVolume = {}; // sectorId -> { total, recent }
        this.tradeVolumeDecayTimer = 0;

        // Event price modifiers: { sectorId: { goodId: multiplier } }
        this.eventPriceModifiers = {};

        // Load saved state
        this.loadState();
    }

    /**
     * Get event-adjusted price for a trade good
     */
    getEventPriceModifier(goodId, sectorId) {
        const mods = this.eventPriceModifiers[sectorId];
        if (!mods) return 1.0;
        return mods[goodId] || mods['*'] || 1.0;
    }

    /**
     * Set event price modifier for a sector
     */
    setEventPriceModifier(sectorId, goodId, multiplier) {
        if (!this.eventPriceModifiers[sectorId]) this.eventPriceModifiers[sectorId] = {};
        this.eventPriceModifiers[sectorId][goodId] = multiplier;
    }

    clearEventPriceModifiers(sectorId) {
        delete this.eventPriceModifiers[sectorId];
    }

    /**
     * Record trade volume for strategic map overlay
     */
    recordTradeVolume(sectorId, amount) {
        if (!this.tradeVolume[sectorId]) this.tradeVolume[sectorId] = { total: 0, recent: 0 };
        this.tradeVolume[sectorId].total += amount;
        this.tradeVolume[sectorId].recent += amount;
    }

    getTradeVolumePerSector() {
        return { ...this.tradeVolume };
    }

    /**
     * Get current Commerce Guild rank
     */
    getRank() {
        let rank = COMMERCE_RANKS.NEUTRAL;
        for (const [key, info] of Object.entries(COMMERCE_RANKS)) {
            if (this.reputation >= info.minRep) rank = { ...info, key };
        }
        return rank;
    }

    /**
     * Get next rank info
     */
    getNextRank() {
        const ranks = Object.entries(COMMERCE_RANKS);
        for (const [key, info] of ranks) {
            if (this.reputation < info.minRep) return { ...info, key };
        }
        return null;
    }

    /**
     * Generate available transport quests for a station
     */
    generateQuests(station) {
        if (!station?.sectorId) return [];

        const rank = this.getRank();
        const rankOrder = Object.keys(COMMERCE_RANKS);
        const rankIndex = rankOrder.indexOf(rank.key);
        const sectorId = station.sectorId;
        const specialty = STATION_SPECIALTIES[sectorId];
        if (!specialty) return [];

        const quests = [];

        // Generate quests based on what this station CONSUMES (needs delivered)
        for (const template of TRANSPORT_QUEST_TEMPLATES) {
            // Check rank requirement
            const reqIndex = rankOrder.indexOf(template.minRank);
            if (rankIndex < reqIndex) continue;

            // Find goods this station consumes that other stations produce
            for (const goodId of specialty.consumes) {
                const good = TRADE_GOODS[goodId];
                if (!good) continue;

                // Find a source station that produces this good
                const sourceStation = this.findProducer(goodId, sectorId);
                if (!sourceStation) continue;

                const amount = template.amountRange[0] +
                    Math.floor(Math.random() * (template.amountRange[1] - template.amountRange[0]));

                const sourcePrice = getStationPrice(goodId, sourceStation);
                const destPrice = getStationPrice(goodId, sectorId);
                const profitPerUnit = destPrice.sell - sourcePrice.buy;
                const guildBonus = Math.floor(good.basePrice * amount * (template.rewardMultiplier - 1) * 0.3);

                const sourceName = STATION_SPECIALTIES[sourceStation]?.name || sourceStation;
                const destName = specialty.name;

                const questId = `transport-${++this.questCounter}`;

                // Skip if already active
                if (this.activeQuests.find(q => q.goodId === goodId && q.destSector === sectorId)) continue;

                const quest = {
                    id: questId,
                    guild: 'commerce',
                    title: template.titlePattern
                        .replace('{good}', good.name),
                    description: template.descPattern
                        .replace('{amount}', amount)
                        .replace('{good}', good.name)
                        .replace('{source}', sourceName)
                        .replace('{dest}', destName),
                    type: 'transport',
                    tier: template.tier,
                    goodId: goodId,
                    goodName: good.name,
                    amount: amount,
                    sourceSector: sourceStation,
                    sourceName: sourceName,
                    destSector: sectorId,
                    destName: destName,
                    rewards: {
                        credits: guildBonus,
                        reputation: template.repReward,
                    },
                    tradeProfit: profitPerUnit * amount,
                    dialogue: {
                        offer: template.dialogueOffer
                            .replace('{amount}', amount)
                            .replace('{good}', good.name)
                            .replace('{source}', sourceName),
                        complete: template.dialogueComplete,
                    },
                };

                // Expedition contracts: add return leg with a different good
                if (template.isExpedition) {
                    quest.isExpedition = true;
                    const sourceSpec = STATION_SPECIALTIES[sourceStation];
                    const returnGoods = sourceSpec?.produces?.filter(g => g !== goodId) || [];
                    if (returnGoods.length > 0) {
                        const returnGoodId = returnGoods[Math.floor(Math.random() * returnGoods.length)];
                        const returnGood = TRADE_GOODS[returnGoodId];
                        if (returnGood) {
                            quest.returnGoodId = returnGoodId;
                            quest.returnGoodName = returnGood.name;
                            quest.returnAmount = Math.floor(amount * 0.6);
                            quest.returnDestSector = sectorId;
                            quest.description = quest.description
                                .replace('{returnGood}', returnGood.name);
                            quest.dialogue.offer = quest.dialogue.offer
                                .replace('{returnGood}', returnGood.name);
                            quest.rewards.credits = Math.floor(guildBonus * 1.5);
                        }
                    }
                }

                quests.push(quest);

                // Only 1 quest per good per station
                break;
            }
        }

        // Also generate quests for what this station PRODUCES (export jobs)
        for (const goodId of specialty.produces) {
            const good = TRADE_GOODS[goodId];
            if (!good) continue;

            // Find a consumer
            const destStation = this.findConsumer(goodId, sectorId);
            if (!destStation) continue;

            const tier = rankIndex >= 3 ? 4 : rankIndex >= 2 ? 3 : rankIndex >= 1 ? 2 : 1;
            const template = TRANSPORT_QUEST_TEMPLATES.find(t => t.tier === tier) || TRANSPORT_QUEST_TEMPLATES[0];

            const amount = template.amountRange[0] +
                Math.floor(Math.random() * (template.amountRange[1] - template.amountRange[0]));

            const guildBonus = Math.floor(good.basePrice * amount * 0.4);
            const destName = STATION_SPECIALTIES[destStation]?.name || destStation;

            if (this.activeQuests.find(q => q.goodId === goodId && q.sourceSector === sectorId)) continue;

            quests.push({
                id: `export-${++this.questCounter}`,
                guild: 'commerce',
                title: `Export: ${good.name}`,
                description: `Buy ${amount} ${good.name} here and deliver to ${destName}.`,
                type: 'transport',
                tier: tier,
                goodId: goodId,
                goodName: good.name,
                amount: amount,
                sourceSector: sectorId,
                sourceName: specialty.name,
                destSector: destStation,
                destName: destName,
                rewards: {
                    credits: guildBonus,
                    reputation: template.repReward,
                },
                tradeProfit: 0, // Profit comes from buy low sell high
                dialogue: {
                    offer: `We've got surplus ${good.name}. Buy ${amount} units from our market and deliver to ${destName}. They're paying premium.`,
                    complete: `Delivery confirmed. Good trade routes make good traders.`,
                },
            });

            // Max 1 export quest per good
            break;
        }

        // Limit to 4-6 available quests
        this.availableQuests = quests.slice(0, 6);
        return this.availableQuests;
    }

    /**
     * Find a station that produces a given good
     */
    findProducer(goodId, excludeSector) {
        for (const [sectorId, station] of Object.entries(STATION_SPECIALTIES)) {
            if (sectorId === excludeSector) continue;
            if (station.produces.includes(goodId)) return sectorId;
        }
        return null;
    }

    /**
     * Find a station that consumes a given good
     */
    findConsumer(goodId, excludeSector) {
        for (const [sectorId, station] of Object.entries(STATION_SPECIALTIES)) {
            if (sectorId === excludeSector) continue;
            if (station.consumes.includes(goodId)) return sectorId;
        }
        return null;
    }

    /**
     * Accept a transport quest
     */
    acceptQuest(questId) {
        const quest = this.availableQuests.find(q => q.id === questId);
        if (!quest) return false;

        // Check shared quest limit (with guild system)
        const guildActiveCount = this.game.guildSystem?.activeQuests?.length || 0;
        if (this.activeQuests.length + guildActiveCount >= 5) {
            this.game.ui?.toast('Too many active quests', 'warning');
            return false;
        }

        // Create active quest with progress tracking
        const activeQuest = {
            ...quest,
            progress: { delivered: 0 },
            acceptedAt: Date.now(),
        };

        this.activeQuests.push(activeQuest);
        this.availableQuests = this.availableQuests.filter(q => q.id !== questId);

        this.game.ui?.toast(`Transport contract accepted: ${quest.title}`, 'success');
        this.game.ui?.log(`Transport contract: Deliver ${quest.amount} ${quest.goodName} to ${quest.destName}`, 'system');
        this.game.audio?.play('quest-accept');
        this.game.events.emit('quest:accepted', activeQuest);

        this.saveState();
        return true;
    }

    /**
     * Abandon a transport quest
     */
    abandonQuest(questId) {
        const index = this.activeQuests.findIndex(q => q.id === questId);
        if (index === -1) return;

        const quest = this.activeQuests.splice(index, 1)[0];
        this.game.ui?.toast(`Contract abandoned: ${quest.title}`, 'warning');
        this.game.ui?.log(`Transport contract abandoned: ${quest.title}`, 'system');

        this.saveState();
    }

    /**
     * Check if selling trade goods at a station completes any transport quests
     */
    onTradeGoodSold(goodId, quantity, sectorId) {
        if (!sectorId) return;
        // Track trade volume for strategic overlay
        this.recordTradeVolume(sectorId, quantity);
        const completed = [];

        for (const quest of this.activeQuests) {
            // Check return leg of expedition contracts
            if (quest.isExpedition && quest.returnPhase &&
                quest.returnGoodId === goodId && quest.returnDestSector === sectorId) {
                quest.progress.returnDelivered = Math.min(
                    (quest.progress.returnDelivered || 0) + quantity, quest.returnAmount);
                if (quest.progress.returnDelivered >= quest.returnAmount) {
                    completed.push(quest);
                }
                continue;
            }

            // Normal delivery
            if (quest.goodId === goodId && quest.destSector === sectorId) {
                quest.progress.delivered = Math.min(quest.progress.delivered + quantity, quest.amount);

                if (quest.progress.delivered >= quest.amount) {
                    // Expedition contracts: transition to return phase
                    if (quest.isExpedition && quest.returnGoodId && !quest.returnPhase) {
                        quest.returnPhase = true;
                        quest.progress.returnDelivered = 0;
                        this.game.ui?.toast(`Outbound delivery complete! Pick up ${quest.returnAmount} ${quest.returnGoodName} for the return leg.`, 'success');
                        this.game.ui?.log(`Expedition outbound leg complete. Return: ${quest.returnAmount} ${quest.returnGoodName} to ${quest.destName}`, 'system');
                    } else {
                        completed.push(quest);
                    }
                }
            }
        }

        for (const quest of completed) {
            this.completeQuest(quest);
        }

        this.saveState();
    }

    /**
     * Complete a transport quest
     */
    completeQuest(quest) {
        const index = this.activeQuests.indexOf(quest);
        if (index !== -1) this.activeQuests.splice(index, 1);

        this.completedQuests.add(quest.id);

        // Give rewards
        if (quest.rewards.credits) {
            this.game.addCredits(quest.rewards.credits);
        }
        if (quest.rewards.reputation) {
            const oldRank = this.getRank();
            this.reputation += quest.rewards.reputation;
            const newRank = this.getRank();

            if (newRank.key !== oldRank.key) {
                this.game.ui?.toast(`Commerce Guild rank up: ${newRank.name}!`, 'success');
                this.game.ui?.log(`Promoted to ${newRank.name} in the Commerce Guild!`, 'system');
                this.game.audio?.play('level-up');
                if (this.game.player) {
                    this.game.renderer?.effects?.spawn('level-up', this.game.player.x, this.game.player.y, {
                        color: newRank.color ? parseInt(newRank.color.slice(1), 16) : 0xffaa44,
                    });
                }
                this.game.events.emit('guild:rankup', { guild: 'commerce', rank: newRank });
            }
        }

        this.game.ui?.toast(`Contract complete: ${quest.title}!`, 'success');
        this.game.ui?.log(`Transport contract complete! Bonus: ${formatCredits(quest.rewards.credits || 0)} ISK, +${quest.rewards.reputation || 0} commerce rep`, 'system');
        this.game.audio?.play('quest-complete');
        this.game.events.emit('quest:completed', quest);

        // Show credit popup for guild bonus
        if (quest.rewards.credits && this.game.input) {
            this.game.ui?.showCreditPopup(quest.rewards.credits, window.innerWidth / 2, window.innerHeight / 2, 'bounty');
        }

        this.saveState();
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        const state = {
            reputation: this.reputation,
            activeQuests: this.activeQuests,
            completedQuests: [...this.completedQuests],
            questCounter: this.questCounter,
        };
        localStorage.setItem('expedition-commerce-state', JSON.stringify(state));
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const saved = localStorage.getItem('expedition-commerce-state');
            if (saved) {
                const state = JSON.parse(saved);
                this.reputation = state.reputation || 0;
                this.activeQuests = state.activeQuests || [];
                this.completedQuests = new Set(state.completedQuests || []);
                this.questCounter = state.questCounter || 0;
            }
        } catch (e) {
            // Ignore corrupt saves
        }
    }

    /**
     * Update - called each frame (currently no per-frame logic needed)
     */
    update(dt) {
        // Decay recent trade volume every 60s
        this.tradeVolumeDecayTimer += dt;
        if (this.tradeVolumeDecayTimer >= 60) {
            this.tradeVolumeDecayTimer = 0;
            for (const sid of Object.keys(this.tradeVolume)) {
                this.tradeVolume[sid].recent = Math.floor(this.tradeVolume[sid].recent * 0.8);
            }
        }
    }
}
