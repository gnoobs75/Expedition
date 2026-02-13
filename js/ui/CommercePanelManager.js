// =============================================
// Commerce Panel Manager
// Station tab for trade goods market + transport quests
// =============================================

import { TRADE_GOODS, TRADE_CATEGORIES, STATION_SPECIALTIES, getStationPrice, getBestTradeRoute, recordTrade } from '../data/tradeGoodsDatabase.js';
import { COMMERCE_RANKS } from '../systems/CommerceSystem.js';
import { formatCredits } from '../utils/math.js';

const COMMERCE_AGENT = {
    name: 'Broker Mara',
    title: 'Commerce Guild Agent',
    portrait: '\u2696', // scales
    color: '#ffaa44',
    greeting: "Commerce Guild. We keep goods moving and profits flowing across the system.",
    noQuests: "No transport contracts available at your clearance level. Trade more to unlock bigger jobs.",
};

export class CommercePanelManager {
    constructor(game) {
        this.game = game;
        this.activeTab = 'market'; // market or contracts
        this.categoryFilter = 'all';
    }

    /**
     * Render commerce content in station panel
     */
    render(container, station) {
        if (!container || !station) return;

        const cs = this.game.commerceSystem;
        if (!cs) return;

        // Generate quests when viewing
        cs.generateQuests(station);

        container.innerHTML = `
            <div class="commerce-panel">
                <div class="commerce-tabs">
                    <button class="commerce-tab ${this.activeTab === 'market' ? 'active' : ''}" data-ctab="market">
                        TRADE GOODS
                    </button>
                    <button class="commerce-tab ${this.activeTab === 'contracts' ? 'active' : ''}" data-ctab="contracts">
                        TRANSPORT CONTRACTS
                    </button>
                </div>
                <div class="commerce-content">
                    ${this.activeTab === 'market'
                        ? this.renderMarket(station)
                        : this.renderContracts(station)}
                </div>
            </div>
        `;

        // Wire tab clicks
        container.querySelectorAll('.commerce-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.ctab;
                this.render(container, station);
                this.game.audio?.play('click');
            });
        });

        // Wire market buttons
        this.wireMarketButtons(container, station);
        this.wireContractButtons(container, station);
    }

    renderMarket(station) {
        const specialty = STATION_SPECIALTIES[station.sectorId];
        const player = this.game.player;

        // Category filter buttons
        const categories = ['all', ...new Set(Object.values(TRADE_GOODS).map(g => g.category))];

        // Get goods available at this station
        const goods = Object.entries(station.tradeGoods)
            .map(([id, data]) => ({
                id,
                ...TRADE_GOODS[id],
                stock: data.stock,
                produced: data.produced,
                price: getStationPrice(id, station.sectorId),
                bestRoute: getBestTradeRoute(id, station.sectorId),
                inCargo: player?.getTradeGoodQuantity(id) || 0,
            }))
            .filter(g => g.name) // filter out invalid entries
            .filter(g => this.categoryFilter === 'all' || g.category === this.categoryFilter);

        return `
            <div class="station-specialty">
                <span class="specialty-label">STATION SPECIALTY:</span>
                <span class="specialty-name">${specialty?.description || 'General Trade'}</span>
            </div>

            <div class="trade-category-filters">
                ${categories.map(cat => `
                    <button class="trade-cat-btn ${this.categoryFilter === cat ? 'active' : ''}" data-cat="${cat}">
                        ${cat === 'all' ? 'ALL' : (TRADE_CATEGORIES[cat]?.name || cat).toUpperCase()}
                    </button>
                `).join('')}
            </div>

            <div class="trade-goods-header">
                <span class="tg-col-name">COMMODITY</span>
                <span class="tg-col-stock">STOCK</span>
                <span class="tg-col-buy">BUY</span>
                <span class="tg-col-sell">SELL</span>
                <span class="tg-col-cargo">CARGO</span>
                <span class="tg-col-actions">ACTIONS</span>
            </div>

            <div class="trade-goods-list">
                ${goods.length > 0 ? goods.map(g => this.renderGoodRow(g, station)).join('') : `
                    <div class="trade-no-goods">No goods available in this category</div>
                `}
            </div>

            ${this.renderCargoSummary(player)}
        `;
    }

    renderGoodRow(good, station) {
        const catColor = TRADE_CATEGORIES[good.category]?.color || '#888';
        const profitHint = good.bestRoute.profit > 0
            ? `<span class="trade-profit-hint" title="Best sell: ${STATION_SPECIALTIES[good.bestRoute.destination]?.name || good.bestRoute.destination}">+${good.bestRoute.profit}/u</span>`
            : '';

        const canBuy = good.stock > 0 && this.game.credits >= good.price.buy;
        const canSell = good.inCargo > 0;

        return `
            <div class="trade-good-row ${good.produced ? 'produced' : ''}" data-good-id="${good.id}">
                <span class="tg-col-name">
                    <span class="tg-icon" style="color: ${catColor}">${good.icon || '\u25CF'}</span>
                    <span class="tg-name">${good.name}</span>
                    ${profitHint}
                </span>
                <span class="tg-col-stock">${good.stock}</span>
                <span class="tg-col-buy">${formatCredits(good.price.buy)}</span>
                <span class="tg-col-sell">${formatCredits(good.price.sell)}</span>
                <span class="tg-col-cargo">${good.inCargo || '-'}</span>
                <span class="tg-col-actions">
                    <button class="tg-btn buy ${canBuy ? '' : 'disabled'}"
                            data-action="buy" data-good="${good.id}"
                            ${canBuy ? '' : 'disabled'}>BUY</button>
                    <button class="tg-btn sell ${canSell ? '' : 'disabled'}"
                            data-action="sell" data-good="${good.id}"
                            ${canSell ? '' : 'disabled'}>SELL</button>
                </span>
            </div>
        `;
    }

    renderCargoSummary(player) {
        if (!player) return '';

        const tradeGoods = player.tradeGoods || {};
        const tradeEntries = Object.entries(tradeGoods).filter(([id, d]) => d.quantity > 0);

        if (tradeEntries.length === 0) return `
            <div class="trade-cargo-summary">
                <div class="trade-cargo-title">CARGO HOLD: ${player.cargoUsed.toFixed(1)} / ${player.cargoCapacity} m\u00B3</div>
                <div class="trade-cargo-empty">No trade goods in cargo</div>
            </div>
        `;

        return `
            <div class="trade-cargo-summary">
                <div class="trade-cargo-title">CARGO HOLD: ${player.cargoUsed.toFixed(1)} / ${player.cargoCapacity} m\u00B3</div>
                ${tradeEntries.map(([id, data]) => {
                    const good = TRADE_GOODS[id];
                    return `<div class="trade-cargo-item">
                        <span>${good?.name || id}</span>
                        <span>${data.quantity} units (${(data.quantity * data.volumePerUnit).toFixed(1)} m\u00B3)</span>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    renderContracts(station) {
        const cs = this.game.commerceSystem;
        const rank = cs.getRank();
        const nextRank = cs.getNextRank();
        const rep = cs.reputation;

        const repBarPercent = nextRank
            ? ((rep - rank.minRep) / (nextRank.minRep - rank.minRep)) * 100
            : 100;

        const activeQuests = cs.activeQuests;
        const availableQuests = cs.availableQuests;

        return `
            <div class="guild-agent">
                <div class="guild-agent-portrait" style="color: ${COMMERCE_AGENT.color}">${COMMERCE_AGENT.portrait}</div>
                <div class="guild-agent-info">
                    <div class="guild-agent-name">${COMMERCE_AGENT.name}</div>
                    <div class="guild-agent-title">${COMMERCE_AGENT.title}</div>
                </div>
            </div>

            <div class="guild-reputation">
                <div class="guild-rank-display">
                    <span class="guild-rank-label">RANK:</span>
                    <span class="guild-rank-name" style="color: ${rank.color}">${rank.name}</span>
                </div>
                <div class="guild-rep-bar-container">
                    <div class="guild-rep-bar" style="width: ${repBarPercent}%; background: ${rank.color}"></div>
                    <span class="guild-rep-text">${rep} / ${nextRank ? nextRank.minRep : 'MAX'} REP</span>
                </div>
                ${nextRank ? `<div class="guild-next-rank">Next: <span style="color: ${nextRank.color}">${nextRank.name}</span></div>` : '<div class="guild-next-rank" style="color: #ffaa44">Maximum Rank Achieved</div>'}
            </div>

            ${activeQuests.length > 0 ? `
                <div class="guild-section">
                    <div class="guild-section-title">ACTIVE CONTRACTS</div>
                    ${activeQuests.map(q => this.renderActiveContract(q)).join('')}
                </div>
            ` : ''}

            <div class="guild-section">
                <div class="guild-section-title">AVAILABLE CONTRACTS</div>
                ${availableQuests.length > 0
                    ? availableQuests.map(q => this.renderAvailableContract(q)).join('')
                    : `<div class="guild-no-quests">${COMMERCE_AGENT.noQuests}</div>`
                }
            </div>
        `;
    }

    renderActiveContract(quest) {
        const percent = Math.min(100, (quest.progress.delivered / quest.amount) * 100);

        return `
            <div class="quest-card active">
                <div class="quest-header">
                    <div class="quest-title">${quest.title}</div>
                    <div class="quest-status active">IN PROGRESS</div>
                </div>
                <div class="quest-description">${quest.description}</div>
                <div class="quest-objective">
                    <div class="quest-obj-text">Deliver ${quest.goodName} to ${quest.destName}</div>
                    <div class="quest-progress-bar-container">
                        <div class="quest-progress-bar" style="width: ${percent}%"></div>
                        <span class="quest-progress-text">${quest.progress.delivered} / ${quest.amount}</span>
                    </div>
                </div>
                <div class="quest-rewards">
                    <span class="quest-reward-label">Guild Bonus:</span>
                    <span class="quest-reward">${formatCredits(quest.rewards.credits)} ISK</span>
                    <span class="quest-reward">+${quest.rewards.reputation} REP</span>
                </div>
                <div class="quest-actions">
                    <button class="quest-btn abandon" data-quest-id="${quest.id}" data-caction="abandon">ABANDON</button>
                </div>
            </div>
        `;
    }

    renderAvailableContract(quest) {
        return `
            <div class="quest-card available">
                <div class="quest-header">
                    <div class="quest-title">${quest.title}</div>
                    <div class="quest-badge repeatable">T${quest.tier}</div>
                </div>
                <div class="quest-description">${quest.description}</div>
                <div class="quest-route-info">
                    <span class="quest-route">${quest.sourceName} \u2192 ${quest.destName}</span>
                    ${quest.tradeProfit > 0 ? `<span class="quest-trade-profit">+${formatCredits(quest.tradeProfit)} trade profit</span>` : ''}
                </div>
                <div class="quest-rewards">
                    <span class="quest-reward-label">Guild Bonus:</span>
                    <span class="quest-reward">${formatCredits(quest.rewards.credits)} ISK</span>
                    <span class="quest-reward">+${quest.rewards.reputation} REP</span>
                </div>
                <div class="quest-actions">
                    <button class="quest-btn accept" data-quest-id="${quest.id}" data-caction="accept"
                            data-dialogue="${encodeURIComponent(quest.dialogue?.offer || '')}">
                        ACCEPT CONTRACT
                    </button>
                </div>
            </div>
        `;
    }

    wireMarketButtons(container, station) {
        // Category filter
        container.querySelectorAll('.trade-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.categoryFilter = btn.dataset.cat;
                this.render(container, station);
                this.game.audio?.play('click');
            });
        });

        // Buy/sell buttons
        container.querySelectorAll('.tg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const goodId = btn.dataset.good;
                const action = btn.dataset.action;
                const good = TRADE_GOODS[goodId];
                if (!good) return;

                if (action === 'buy') {
                    this.buyGood(goodId, 1, station, container);
                } else if (action === 'sell') {
                    this.sellGood(goodId, 1, station, container);
                }
            });
        });
    }

    wireContractButtons(container, station) {
        container.querySelectorAll('.quest-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const questId = btn.dataset.questId;
                const action = btn.dataset.caction;

                if (action === 'accept') {
                    const dialogueText = decodeURIComponent(btn.dataset.dialogue || '');
                    if (dialogueText && this.game.dialogueManager) {
                        this.game.dialogueManager.open({
                            name: COMMERCE_AGENT.name,
                            title: COMMERCE_AGENT.title,
                            portrait: COMMERCE_AGENT.portrait,
                            color: COMMERCE_AGENT.color,
                            text: dialogueText,
                            options: [
                                { label: 'Accept Contract', action: 'accept-commerce-quest', questId },
                                { label: 'Not interested', action: 'close' },
                            ],
                        });
                    } else {
                        this.game.commerceSystem.acceptQuest(questId);
                        this.render(container, station);
                    }
                } else if (action === 'abandon') {
                    this.game.commerceSystem.abandonQuest(questId);
                    this.render(container, station);
                }
            });
        });
    }

    /**
     * Buy a trade good from station
     */
    buyGood(goodId, quantity, station, container) {
        const good = TRADE_GOODS[goodId];
        const player = this.game.player;
        if (!good || !player) return;

        // Check cargo space
        const spaceNeeded = good.volume * quantity;
        if (player.cargoCapacity - player.cargoUsed < spaceNeeded) {
            this.game.ui?.toast('Not enough cargo space', 'warning');
            return;
        }

        const result = station.buyTradeGood(goodId, quantity);
        if (!result) {
            this.game.ui?.toast('Cannot buy - insufficient credits or stock', 'warning');
            return;
        }

        player.addTradeGood(goodId, quantity, good.volume);

        // Shift market supply (player buying = station supply decreases)
        recordTrade(goodId, station.sectorId || this.game.currentSector?.id, quantity, true);

        this.game.ui?.log(`Bought ${quantity} ${good.name} for ${formatCredits(result.cost)} ISK`, 'system');
        this.game.ui?.toast(`Bought ${good.name}`, 'success');
        this.game.audio?.play('click');
        this.game.ui?.showCreditPopup(result.cost, window.innerWidth / 2, window.innerHeight / 2, 'loss');

        // Encyclopedia discovery
        this.game.encyclopedia?.discoverItem('tradegoods', goodId);

        this.render(container, station);
    }

    /**
     * Sell a trade good to station
     */
    sellGood(goodId, quantity, station, container) {
        const good = TRADE_GOODS[goodId];
        const player = this.game.player;
        if (!good || !player) return;

        const inCargo = player.getTradeGoodQuantity(goodId);
        if (inCargo < quantity) return;

        player.removeTradeGood(goodId, quantity);
        const result = station.sellTradeGood(goodId, quantity);

        // Shift market supply (player selling = station supply increases)
        recordTrade(goodId, station.sectorId || this.game.currentSector?.id, quantity, false);

        // Notify commerce system for quest tracking
        this.game.commerceSystem?.onTradeGoodSold(goodId, quantity, station.sectorId);

        // Award trade XP
        this.game.skillSystem?.onTrade(result.value);

        this.game.ui?.log(`Sold ${quantity} ${good.name} for ${formatCredits(result.value)} ISK`, 'system');
        this.game.ui?.toast(`Sold ${good.name} for ${formatCredits(result.value)} ISK`, 'success');
        this.game.audio?.play('sell');
        this.game.ui?.showCreditPopup(result.value, window.innerWidth / 2, window.innerHeight / 2, 'gain');

        // Encyclopedia discovery
        this.game.encyclopedia?.discoverItem('tradegoods', goodId);

        this.render(container, station);
    }
}
