// =============================================
// Quest Tracker Manager
// In-game HUD showing active quest progress
// Toggled with J key
// =============================================

import { formatCredits } from '../utils/math.js';

export class QuestTrackerManager {
    constructor(game) {
        this.game = game;
        this.visible = true;
        this.panel = null;
        this.updateTimer = 0;

        this.createPanel();
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'quest-tracker';
        this.panel.className = 'panel';
        this.panel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">QUESTS</span>
                <button class="panel-close">&times;</button>
            </div>
            <div class="panel-content">
                <div id="quest-tracker-content"></div>
            </div>
        `;
        document.getElementById('ui-overlay').appendChild(this.panel);

        // Close button
        this.panel.querySelector('.panel-close').addEventListener('click', () => {
            this.panel.classList.add('hidden');
        });

        // Register with drag manager
        this.game.ui?.panelDragManager?.registerPanel('quest-tracker');
    }

    toggle() {
        this.panel.classList.toggle('hidden');
    }

    update(dt) {
        this.updateTimer += dt;
        if (this.updateTimer < 0.5) return; // Update every 500ms
        this.updateTimer = 0;

        if (this.panel.classList.contains('hidden')) return;

        const gs = this.game.guildSystem;
        const cs = this.game.commerceSystem;

        const content = this.panel.querySelector('#quest-tracker-content');
        if (!content) return;

        const guildQuests = gs?.activeQuests || [];
        const commerceQuests = cs?.activeQuests || [];
        const activeBounties = (this.game.ui?.activeBounties || []).filter(b => b.status === 'accepted');
        const allQuests = [...guildQuests, ...commerceQuests];

        if (allQuests.length === 0 && activeBounties.length === 0) {
            content.innerHTML = `
                <div class="quest-tracker-empty">
                    No active quests.<br>
                    <span class="quest-tracker-hint">Visit a station's GUILD, COMMERCE, or BOUNTY tab to accept quests.</span>
                </div>
            `;
            return;
        }

        // Render bounties first
        const bountyHtml = activeBounties.map(b => `
            <div class="qt-quest">
                <div class="qt-quest-header">
                    <span class="qt-guild-icon" style="color: #ff4444">&#x2620;</span>
                    <span class="qt-quest-title">Kill ${b.targetName}</span>
                </div>
                <div class="qt-objective">
                    <div class="qt-obj-bar" style="width: 0%"></div>
                    <span class="qt-obj-text">${b.sectorHint} &bull; ${formatCredits(b.reward)} ISK</span>
                </div>
            </div>
        `).join('');

        content.innerHTML = bountyHtml + allQuests.map(quest => {
            // Determine icon and color based on guild type
            let guildIcon, guildColor;
            if (quest.guild === 'commerce') {
                guildIcon = '\u2696';
                guildColor = '#ffaa44';
            } else if (quest.guild === 'mining') {
                guildIcon = '\u2692';
                guildColor = '#44ff88';
            } else {
                guildIcon = '\u2694';
                guildColor = '#ff4444';
            }

            // Handle both guild quest progress (array) and commerce quest progress (object)
            let objectives = '';
            if (Array.isArray(quest.progress)) {
                objectives = quest.progress.map(obj => {
                    const percent = Math.min(100, (obj.current / obj.amount) * 100);
                    const complete = obj.current >= obj.amount;
                    return `
                        <div class="qt-objective ${complete ? 'complete' : ''}">
                            <div class="qt-obj-bar" style="width: ${percent}%"></div>
                            <span class="qt-obj-text">${obj.current}/${obj.amount}</span>
                        </div>
                    `;
                }).join('');
            } else if (quest.progress?.delivered !== undefined) {
                const percent = Math.min(100, (quest.progress.delivered / quest.amount) * 100);
                const complete = quest.progress.delivered >= quest.amount;
                objectives = `
                    <div class="qt-objective ${complete ? 'complete' : ''}">
                        <div class="qt-obj-bar" style="width: ${percent}%"></div>
                        <span class="qt-obj-text">${quest.progress.delivered}/${quest.amount}</span>
                    </div>
                `;
            }

            return `
                <div class="qt-quest">
                    <div class="qt-quest-header">
                        <span class="qt-guild-icon" style="color: ${guildColor}">${guildIcon}</span>
                        <span class="qt-quest-title">${quest.title}</span>
                    </div>
                    ${objectives}
                </div>
            `;
        }).join('');
    }
}
