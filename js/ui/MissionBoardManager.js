// =============================================
// Mission Board Manager
// Station UI for viewing and accepting missions
// =============================================

export class MissionBoardManager {
    constructor(game) {
        this.game = game;
        this.availableMissions = [];
    }

    /**
     * Generate and display missions for current station
     */
    show(container) {
        if (!container) return;
        const missionSystem = this.game.missionSystem;
        if (!missionSystem) {
            container.innerHTML = '<div class="mission-empty">Mission system unavailable</div>';
            return;
        }

        // Generate missions if we haven't for this dock
        const sectorFaction = this.game.currentSector?.controllingFaction || 'unef';
        const difficulty = this.game.currentSector?.difficulty || 'medium';
        this.availableMissions = missionSystem.generateMissions(sectorFaction, difficulty);

        this.render(container);
    }

    render(container) {
        const missionSystem = this.game.missionSystem;
        const active = missionSystem?.activeMissions || [];

        // Build active missions section
        const activeHtml = active.length > 0 ? active.map(m => {
            const obj = m.objective;
            const progress = obj.progress || 0;
            const total = obj.count || obj.duration || 1;
            const pct = Math.min(100, (progress / total) * 100);
            const timeLeft = m.expiresAt ? Math.max(0, Math.floor((m.expiresAt - Date.now()) / 60000)) : '?';
            
            return `
                <div class="mission-card active">
                    <div class="mission-header">
                        <span class="mission-name">${m.name}</span>
                        <span class="mission-category ${m.category}">${m.category.toUpperCase()}</span>
                    </div>
                    <div class="mission-desc">${m.description}</div>
                    <div class="mission-progress-bar">
                        <div class="mission-progress-fill" style="width:${pct}%"></div>
                        <span class="mission-progress-text">${progress}/${total}</span>
                    </div>
                    <div class="mission-footer">
                        <span class="mission-reward">+${m.reward.credits} ISK</span>
                        <span class="mission-timer">${timeLeft}m remaining</span>
                        <button class="mission-abandon-btn" data-mission-id="${m.id}">ABANDON</button>
                    </div>
                </div>
            `;
        }).join('') : '<div class="mission-empty">No active missions</div>';

        // Build available missions section  
        const availableHtml = this.availableMissions.length > 0 ? this.availableMissions.map((m, idx) => {
            const diffStars = { easy: '★', medium: '★★', hard: '★★★', deadly: '★★★★' }[m.difficulty] || '★';
            const alreadyAccepted = missionSystem.activeMissions.some(a => a.id === m.id);
            
            return `
                <div class="mission-card available ${alreadyAccepted ? 'accepted' : ''}">
                    <div class="mission-header">
                        <span class="mission-name">${m.name}</span>
                        <span class="mission-difficulty">${diffStars}</span>
                        <span class="mission-category ${m.category}">${m.category.toUpperCase()}</span>
                    </div>
                    <div class="mission-desc">${m.description}</div>
                    <div class="mission-footer">
                        <span class="mission-reward">Reward: ${m.reward.credits} ISK</span>
                        <span class="mission-standing">+${m.reward.standing.toFixed(1)} standing</span>
                        ${alreadyAccepted ? '<span class="mission-accepted-tag">ACCEPTED</span>' : `<button class="mission-accept-btn" data-mission-idx="${idx}">ACCEPT</button>`}
                    </div>
                </div>
            `;
        }).join('') : '<div class="mission-empty">No missions available</div>';

        container.innerHTML = `
            <div class="mission-board">
                <div class="mission-section">
                    <h3>ACTIVE MISSIONS (${active.length}/5)</h3>
                    <div class="mission-list">${activeHtml}</div>
                </div>
                <div class="mission-section">
                    <h3>AVAILABLE MISSIONS</h3>
                    <div class="mission-list">${availableHtml}</div>
                </div>
            </div>
        `;

        // Wire accept buttons
        container.querySelectorAll('.mission-accept-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.missionIdx);
                const mission = this.availableMissions[idx];
                if (mission && missionSystem.acceptMission(mission)) {
                    this.render(container);
                }
            });
        });

        // Wire abandon buttons
        container.querySelectorAll('.mission-abandon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                missionSystem.abandonMission(btn.dataset.missionId);
                this.render(container);
            });
        });
    }
}
