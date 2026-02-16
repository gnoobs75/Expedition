const TIER_COLORS = {
    1: '#44ff88',
    2: '#4488ff',
    3: '#cc44ff',
    4: '#ffcc44'
};

const TIER_LABELS = {
    1: 'COMMON',
    2: 'UNCOMMON',
    3: 'RARE',
    4: 'LEGENDARY'
};

const TIER_BG = {
    1: 'rgba(68, 255, 136, 0.06)',
    2: 'rgba(68, 136, 255, 0.06)',
    3: 'rgba(204, 68, 255, 0.06)',
    4: 'rgba(255, 204, 68, 0.08)'
};

export class BountyBoardManager {
    constructor(game) {
        this.game = game;
    }

    render(container) {
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding: 10px; color: #ccc; font-family: "Courier New", monospace; font-size: 13px; overflow-y: auto; max-height: 500px;';

        // Section 1: Available Bounties
        this._renderAvailableSection(wrapper);

        // Section 2: Active Bounties
        this._renderActiveSection(wrapper);

        container.appendChild(wrapper);
    }

    _renderAvailableSection(wrapper) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const header = document.createElement('div');
        header.textContent = '-- AVAILABLE BOUNTIES --';
        header.style.cssText = 'color: #ffcc44; font-size: 14px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;';
        section.appendChild(header);

        const bountySystem = this.game.bountySystem;
        const boardData = bountySystem.getBoardData();

        if (!boardData || boardData.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No bounties posted at this station. Check back later.';
            empty.style.cssText = 'color: #666; font-style: italic; padding: 8px 0;';
            section.appendChild(empty);
            wrapper.appendChild(section);
            return;
        }

        for (const bounty of boardData) {
            const card = this._createBountyCard(bounty, 'available');
            section.appendChild(card);
        }

        wrapper.appendChild(section);
    }

    _renderActiveSection(wrapper) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const header = document.createElement('div');
        header.textContent = '-- ACTIVE BOUNTIES --';
        header.style.cssText = 'color: #ff8844; font-size: 14px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;';
        section.appendChild(header);

        const bountySystem = this.game.bountySystem;
        const activeData = bountySystem.getActiveBountyData();

        if (!activeData || activeData.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No active bounties. Accept one from the board above.';
            empty.style.cssText = 'color: #666; font-style: italic; padding: 8px 0;';
            section.appendChild(empty);
            wrapper.appendChild(section);
            return;
        }

        for (const bounty of activeData) {
            const card = this._createBountyCard(bounty, 'active');
            section.appendChild(card);
        }

        wrapper.appendChild(section);
    }

    _createBountyCard(bounty, mode) {
        const tier = bounty.tier || 1;
        const tierColor = TIER_COLORS[tier] || TIER_COLORS[1];
        const tierLabel = TIER_LABELS[tier] || 'COMMON';
        const tierBg = TIER_BG[tier] || TIER_BG[1];

        const card = document.createElement('div');
        card.style.cssText = `background: ${tierBg}; border: 1px solid ${tierColor}40; border-left: 3px solid ${tierColor}; border-radius: 4px; padding: 10px 12px; margin-bottom: 8px;`;

        // Top row: target name + tier badge
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';

        const nameEl = document.createElement('span');
        nameEl.textContent = bounty.name || bounty.targetName || 'Unknown Target';
        nameEl.style.cssText = `color: #fff; font-weight: bold; font-size: 14px;`;
        topRow.appendChild(nameEl);

        const tierBadge = document.createElement('span');
        tierBadge.textContent = tierLabel;
        tierBadge.style.cssText = `color: ${tierColor}; font-size: 12px; font-weight: bold; border: 1px solid ${tierColor}60; border-radius: 3px; padding: 1px 6px; letter-spacing: 1px;`;
        topRow.appendChild(tierBadge);

        card.appendChild(topRow);

        // Title / alias
        if (bounty.title) {
            const titleEl = document.createElement('div');
            titleEl.textContent = `"${bounty.title}"`;
            titleEl.style.cssText = 'color: #aa8866; font-style: italic; font-size: 13px; margin-bottom: 4px;';
            card.appendChild(titleEl);
        }

        // Ship class
        if (bounty.shipClass) {
            const classEl = document.createElement('div');
            classEl.textContent = `Ship Class: ${bounty.shipClass}`;
            classEl.style.cssText = 'color: #999; font-size: 13px; margin-bottom: 2px;';
            card.appendChild(classEl);
        }

        // Description
        if (bounty.description) {
            const descEl = document.createElement('div');
            descEl.textContent = bounty.description;
            descEl.style.cssText = 'color: #888; font-size: 13px; margin-bottom: 6px; line-height: 1.4;';
            card.appendChild(descEl);
        }

        // Bounty amount
        const rewardRow = document.createElement('div');
        rewardRow.style.cssText = 'margin-bottom: 4px;';
        const rewardAmount = bounty.bountyAmount || bounty.reward || 0;
        rewardRow.innerHTML = `<span style="color: #aaa; font-size: 13px;">Bounty:</span> <span style="color: ${tierColor}; font-weight: bold; font-size: 13px;">${rewardAmount.toLocaleString()} CR</span>`;
        card.appendChild(rewardRow);

        // Patrol sectors / location info
        if (bounty.patrolSectors && bounty.patrolSectors.length > 0) {
            const sectorsEl = document.createElement('div');
            const sectorNames = bounty.patrolSectors.map(s => s.name || s.id || s).join(', ');
            sectorsEl.innerHTML = `<span style="color: #aaa; font-size: 13px;">Known Sectors:</span> <span style="color: #cccccc; font-size: 13px;">${sectorNames}</span>`;
            sectorsEl.style.cssText = 'margin-bottom: 4px;';
            card.appendChild(sectorsEl);
        }

        // Active bounty: last seen info
        if (mode === 'active' && bounty.lastSeen) {
            const lastSeenEl = document.createElement('div');
            lastSeenEl.innerHTML = `<span style="color: #aaa; font-size: 13px;">Last Seen:</span> <span style="color: #ffcc44; font-size: 13px;">${bounty.lastSeen}</span>`;
            lastSeenEl.style.cssText = 'margin-bottom: 4px;';
            card.appendChild(lastSeenEl);
        }

        // Action buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top: 8px; text-align: right;';

        if (mode === 'available') {
            const acceptBtn = document.createElement('button');
            acceptBtn.textContent = 'ACCEPT CONTRACT';
            acceptBtn.style.cssText = `background: ${tierColor}15; color: ${tierColor}; border: 1px solid ${tierColor}; border-radius: 3px; padding: 4px 14px; cursor: pointer; font-family: "Courier New", monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px;`;
            acceptBtn.addEventListener('click', () => this._acceptBounty(bounty));
            btnRow.appendChild(acceptBtn);
        } else if (mode === 'active') {
            const abandonBtn = document.createElement('button');
            abandonBtn.textContent = 'ABANDON';
            abandonBtn.style.cssText = 'background: #330000; color: #ff4444; border: 1px solid #ff4444; border-radius: 3px; padding: 4px 14px; cursor: pointer; font-family: "Courier New", monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px;';
            abandonBtn.addEventListener('click', () => this._abandonBounty(bounty));
            btnRow.appendChild(abandonBtn);
        }

        card.appendChild(btnRow);
        return card;
    }

    _acceptBounty(bounty) {
        const targetId = bounty.targetId || bounty.id;
        const bountySystem = this.game.bountySystem;
        const result = bountySystem.acceptBounty(targetId);

        if (result === false || (result && result.error)) {
            const msg = (result && result.error) || 'Cannot accept this bounty';
            this.game.ui?.showToast(msg, 'error');
            this.game.audio?.play('ui-error');
        } else {
            const name = bounty.name || bounty.targetName || 'target';
            this.game.ui?.showToast(`Bounty accepted: ${name}`, 'success');
            this.game.audio?.play('quest-complete');
            this.game.ui?.log(`Accepted bounty contract on ${name}`, 'combat');
            this.game.events.emit('bounty:accepted', { targetId, bounty });
            this._refresh();
        }
    }

    _abandonBounty(bounty) {
        const targetId = bounty.targetId || bounty.id;
        const bountySystem = this.game.bountySystem;
        bountySystem.abandonBounty(targetId);

        const name = bounty.name || bounty.targetName || 'target';
        this.game.ui?.showToast(`Bounty abandoned: ${name}`, 'warning');
        this.game.audio?.play('ui-click');
        this.game.ui?.log(`Abandoned bounty on ${name}`, 'combat');
        this.game.events.emit('bounty:abandoned', { targetId });
        this._refresh();
    }

    _refresh() {
        const container = document.querySelector('.station-tab-content');
        if (container) {
            this.render(container);
        }
    }
}
