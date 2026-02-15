// =============================================
// Combat Log Manager
// Extracted from UIManager - handles detailed combat event logging
// =============================================

export class CombatLogManager {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;

        this.combatLog = [];
        this.maxCombatLogEntries = 200;
        this.combatLogFilter = 'all';
        this.combatLogStats = {
            totalDealt: 0, totalTaken: 0,
            hits: 0, misses: 0,
            kills: 0, deaths: 0,
        };
    }

    /**
     * Add detailed combat log entry
     */
    addEntry(data) {
        const entry = {
            time: Date.now(),
            type: data.type,         // 'hit', 'miss', 'kill', 'death'
            direction: 'neutral',    // 'outgoing', 'incoming', 'neutral'
            sourceName: data.source?.name || 'Unknown',
            targetName: data.target?.name || 'Unknown',
            damage: data.damage || 0,
            damageType: data.damageType || '',
            weapon: data.weapon || '',
            hitChance: data.hitChance || 0,
            bounty: data.bounty || 0,
        };

        const player = this.game.player;
        if (data.source === player) entry.direction = 'outgoing';
        else if (data.target === player) entry.direction = 'incoming';

        // Update stats
        if (data.type === 'hit') {
            if (entry.direction === 'outgoing') {
                this.combatLogStats.totalDealt += data.damage;
                this.combatLogStats.hits++;
            } else if (entry.direction === 'incoming') {
                this.combatLogStats.totalTaken += data.damage;
            }
        } else if (data.type === 'miss') {
            if (entry.direction === 'outgoing') {
                this.combatLogStats.misses++;
            }
        } else if (data.type === 'kill') {
            this.combatLogStats.kills++;
        } else if (data.type === 'death') {
            this.combatLogStats.deaths++;
        }

        this.combatLog.unshift(entry);
        if (this.combatLog.length > this.maxCombatLogEntries) {
            this.combatLog.pop();
        }

        // Update if combat tab is visible
        const combatTab = document.getElementById('log-combat-tab');
        if (combatTab && combatTab.classList.contains('active')) {
            this.render();
        }
    }

    /**
     * Toggle combat log panel
     */
    toggle() {
        // Show the event log panel and switch to combat tab
        const eventLogPanel = document.getElementById('event-log');
        if (!eventLogPanel) return;

        // If panel is hidden, show it
        if (eventLogPanel.classList.contains('hidden')) {
            eventLogPanel.classList.remove('hidden');
        }

        // Switch to combat tab
        document.querySelectorAll('.log-tab-btn').forEach(b => b.classList.remove('active'));
        const combatTabBtn = document.querySelector('.log-tab-btn[data-log-tab="combat"]');
        if (combatTabBtn) combatTabBtn.classList.add('active');

        document.querySelectorAll('.log-tab-content').forEach(tc => tc.classList.remove('active'));
        const combatTab = document.getElementById('log-combat-tab');
        if (combatTab) combatTab.classList.add('active');

        this.render();
    }

    /**
     * Render combat log panel
     */
    render() {
        const summary = document.getElementById('combat-log-summary');
        const container = document.getElementById('combat-log-entries');
        if (!container) return;

        // Summary bar
        if (summary) {
            const s = this.combatLogStats;
            const accuracy = s.hits + s.misses > 0
                ? Math.round((s.hits / (s.hits + s.misses)) * 100) : 0;
            summary.innerHTML = `
                <div class="clog-stat">
                    <div class="clog-stat-label">DEALT</div>
                    <div class="clog-stat-value out">${this.formatCompact(s.totalDealt)}</div>
                </div>
                <div class="clog-stat">
                    <div class="clog-stat-label">TAKEN</div>
                    <div class="clog-stat-value in">${this.formatCompact(s.totalTaken)}</div>
                </div>
                <div class="clog-stat">
                    <div class="clog-stat-label">KILLS</div>
                    <div class="clog-stat-value kills">${s.kills}</div>
                </div>
                <div class="clog-stat">
                    <div class="clog-stat-label">ACCURACY</div>
                    <div class="clog-stat-value accuracy">${accuracy}%</div>
                </div>
            `;
        }

        // Filter entries
        let filtered = this.combatLog;
        if (this.combatLogFilter === 'outgoing') {
            filtered = filtered.filter(e => e.direction === 'outgoing');
        } else if (this.combatLogFilter === 'incoming') {
            filtered = filtered.filter(e => e.direction === 'incoming');
        } else if (this.combatLogFilter === 'kills') {
            filtered = filtered.filter(e => e.type === 'kill' || e.type === 'death');
        }

        if (filtered.length === 0) {
            container.innerHTML = '<div class="clog-empty">No combat events recorded</div>';
            return;
        }

        let html = '';
        for (const entry of filtered.slice(0, 80)) {
            const ago = this.ui.formatTimeAgo(entry.time);
            const cls = this.getEntryClass(entry);
            const icon = this.getIcon(entry);
            const msg = this.getMessage(entry);
            const dmg = entry.type === 'kill'
                ? (entry.bounty > 0 ? `+${entry.bounty}` : '')
                : (entry.damage > 0 ? `-${Math.floor(entry.damage)}` : '');

            html += `<div class="clog-entry ${cls}">`;
            html += `<span class="clog-time">${ago}</span>`;
            html += `<span class="clog-icon">${icon}</span>`;
            html += `<span class="clog-msg">${msg}</span>`;
            if (dmg) html += `<span class="clog-dmg">${dmg}</span>`;
            html += `</div>`;
        }

        container.innerHTML = html;
    }

    getEntryClass(entry) {
        if (entry.type === 'kill') return 'kill';
        if (entry.type === 'death') return 'death';
        if (entry.type === 'miss') return `miss ${entry.direction}`;
        return `${entry.direction} ${entry.damageType}`;
    }

    getIcon(entry) {
        if (entry.type === 'kill') return '\u2620';     // skull
        if (entry.type === 'death') return '\u2620';
        if (entry.type === 'miss') return '\u25CB';      // circle
        if (entry.direction === 'outgoing') return '\u25B6'; // right arrow
        return '\u25C0';  // left arrow
    }

    getMessage(entry) {
        if (entry.type === 'kill') {
            return `Destroyed ${entry.targetName}`;
        }
        if (entry.type === 'death') {
            return `Destroyed by ${entry.sourceName}`;
        }
        if (entry.type === 'miss') {
            if (entry.direction === 'outgoing') {
                return `${entry.weapon} missed ${entry.targetName}`;
            }
            return `${entry.sourceName} missed you`;
        }
        // hit
        if (entry.direction === 'outgoing') {
            return `${entry.weapon} hit ${entry.targetName}`;
        }
        return `${entry.sourceName} hit you`;
    }

    formatCompact(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return Math.floor(n).toString();
    }
}
