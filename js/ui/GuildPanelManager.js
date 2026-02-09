// =============================================
// Guild Panel Manager
// Station tab for Mining Guild & Mercenary Guild
// Shows reputation, quests, and rewards
// =============================================

import { GUILD_RANKS, QUEST_TEMPLATES } from '../systems/GuildSystem.js';
import { formatCredits } from '../utils/math.js';

// NPC agent definitions
const GUILD_AGENTS = {
    mining: {
        name: 'Foreman Kael',
        title: 'Mining Guild Agent',
        portrait: '\u2692',
        color: '#44ff88',
        greeting: "Welcome to the Mining Guild. We supply the raw materials that keep civilization running.",
        noQuests: "You've handled everything I have for now. Check back after your next rank-up.",
    },
    mercenary: {
        name: 'Commander Vex',
        title: 'Mercenary Guild Agent',
        portrait: '\u2694',
        color: '#ff4444',
        greeting: "Mercenary Guild. We hunt pirates so others don't have to. Got the stomach for it?",
        noQuests: "No contracts available at your clearance level. Come back when you've proven yourself.",
    },
};

export class GuildPanelManager {
    constructor(game) {
        this.game = game;
        this.activeGuild = 'mining';
    }

    /**
     * Render guild content in station panel
     */
    render(container) {
        if (!container) return;

        const gs = this.game.guildSystem;
        if (!gs) return;

        container.innerHTML = `
            <div class="guild-panel">
                <div class="guild-tabs">
                    <button class="guild-tab ${this.activeGuild === 'mining' ? 'active' : ''}" data-guild="mining">
                        <span class="guild-tab-icon">\u2692</span> Mining Guild
                    </button>
                    <button class="guild-tab ${this.activeGuild === 'mercenary' ? 'active' : ''}" data-guild="mercenary">
                        <span class="guild-tab-icon">\u2694</span> Mercenary Guild
                    </button>
                </div>
                <div class="guild-content">
                    ${this.renderGuildContent(this.activeGuild)}
                </div>
            </div>
        `;

        // Wire tab clicks
        container.querySelectorAll('.guild-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeGuild = tab.dataset.guild;
                this.render(container);
                this.game.audio?.play('click');
            });
        });

        // Wire quest buttons
        this.wireQuestButtons(container);
    }

    renderGuildContent(guild) {
        const gs = this.game.guildSystem;
        const agent = GUILD_AGENTS[guild];
        const rank = gs.getRank(guild);
        const nextRank = gs.getNextRank(guild);
        const rep = gs.reputation[guild];
        const availableQuests = gs.getAvailableQuests(guild);
        const activeQuests = gs.activeQuests.filter(q => q.guild === guild);

        // Reputation bar
        const repBarPercent = nextRank
            ? ((rep - rank.minRep) / (nextRank.minRep - rank.minRep)) * 100
            : 100;

        return `
            <div class="guild-agent">
                <div class="guild-agent-portrait" style="color: ${agent.color}">${agent.portrait}</div>
                <div class="guild-agent-info">
                    <div class="guild-agent-name">${agent.name}</div>
                    <div class="guild-agent-title">${agent.title}</div>
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
                    <div class="guild-section-title">ACTIVE QUESTS</div>
                    ${activeQuests.map(q => this.renderActiveQuest(q)).join('')}
                </div>
            ` : ''}

            <div class="guild-section">
                <div class="guild-section-title">AVAILABLE QUESTS</div>
                ${availableQuests.length > 0
                    ? availableQuests.map(q => this.renderAvailableQuest(q, agent)).join('')
                    : `<div class="guild-no-quests">${agent.noQuests}</div>`
                }
            </div>
        `;
    }

    renderActiveQuest(quest) {
        const progress = quest.progress.map(obj => {
            const percent = Math.min(100, (obj.current / obj.amount) * 100);
            return `
                <div class="quest-objective">
                    <div class="quest-obj-text">${this.getObjectiveText(obj)}</div>
                    <div class="quest-progress-bar-container">
                        <div class="quest-progress-bar" style="width: ${percent}%"></div>
                        <span class="quest-progress-text">${obj.current} / ${obj.amount}</span>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="quest-card active">
                <div class="quest-header">
                    <div class="quest-title">${quest.title}</div>
                    <div class="quest-status active">IN PROGRESS</div>
                </div>
                <div class="quest-description">${quest.description}</div>
                ${progress}
                <div class="quest-rewards">
                    <span class="quest-reward-label">Rewards:</span>
                    ${quest.rewards.credits ? `<span class="quest-reward">${formatCredits(quest.rewards.credits)} ISK</span>` : ''}
                    ${quest.rewards.reputation ? `<span class="quest-reward">+${quest.rewards.reputation} REP</span>` : ''}
                    ${quest.rewards.equipment ? `<span class="quest-reward quest-reward-item">Equipment</span>` : ''}
                    ${quest.rewards.shipDiscount ? `<span class="quest-reward quest-reward-item">Ship Discount</span>` : ''}
                </div>
                <div class="quest-actions">
                    <button class="quest-btn abandon" data-quest-id="${quest.id}" data-action="abandon">ABANDON</button>
                </div>
            </div>
        `;
    }

    renderAvailableQuest(quest, agent) {
        const dialogue = quest.dialogue || {};

        return `
            <div class="quest-card available">
                <div class="quest-header">
                    <div class="quest-title">${quest.title}</div>
                    ${quest.repeatable ? '<div class="quest-badge repeatable">REPEATABLE</div>' : ''}
                </div>
                <div class="quest-description">${quest.description}</div>
                <div class="quest-rewards">
                    <span class="quest-reward-label">Rewards:</span>
                    ${quest.rewards.credits ? `<span class="quest-reward">${formatCredits(quest.rewards.credits)} ISK</span>` : ''}
                    ${quest.rewards.reputation ? `<span class="quest-reward">+${quest.rewards.reputation} REP</span>` : ''}
                    ${quest.rewards.equipment ? `<span class="quest-reward quest-reward-item">Equipment</span>` : ''}
                    ${quest.rewards.shipDiscount ? `<span class="quest-reward quest-reward-item">Ship Discount</span>` : ''}
                </div>
                <div class="quest-actions">
                    <button class="quest-btn accept" data-quest-id="${quest.id}" data-action="accept"
                            data-agent-name="${agent.name}" data-agent-portrait="${agent.portrait}"
                            data-agent-color="${agent.color}" data-agent-title="${agent.title}"
                            data-dialogue="${encodeURIComponent(dialogue.offer || '')}">
                        ACCEPT
                    </button>
                </div>
            </div>
        `;
    }

    getObjectiveText(obj) {
        switch (obj.type) {
            case 'kill-pirates': return `Destroy pirate ships${obj.minClass ? ` (${obj.minClass}+)` : ''}`;
            case 'kill-pirates-in-sector': return `Destroy pirates in dangerous space`;
            case 'sell-ore': return `Sell ${obj.oreType ? obj.oreType : 'any'} ore`;
            case 'mine-ore-in-sector': return `Mine ore in dangerous sectors`;
            default: return obj.type;
        }
    }

    wireQuestButtons(container) {
        container.querySelectorAll('.quest-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const questId = btn.dataset.questId;
                const action = btn.dataset.action;

                if (action === 'accept') {
                    // Show dialogue before accepting
                    const dialogueText = decodeURIComponent(btn.dataset.dialogue || '');
                    if (dialogueText && this.game.dialogueManager) {
                        this.game.dialogueManager.open({
                            name: btn.dataset.agentName,
                            title: btn.dataset.agentTitle,
                            portrait: btn.dataset.agentPortrait,
                            color: btn.dataset.agentColor,
                            text: dialogueText,
                            options: [
                                { label: 'Accept Quest', action: 'accept-quest', questId },
                                { label: 'Not right now', action: 'close' },
                            ],
                        });
                    } else {
                        this.game.guildSystem.acceptQuest(questId);
                        this.render(container);
                    }
                } else if (action === 'abandon') {
                    this.game.guildSystem.abandonQuest(questId);
                    this.render(container);
                }
            });
        });
    }
}
