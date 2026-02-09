// =============================================
// Admin Dashboard Manager
// Full-screen overlay showing guild faction
// economy data in spreadsheet-style tables.
// Toggle with backtick (`) key.
// =============================================

import { formatCredits } from '../utils/math.js';
import { GUILD_FACTIONS } from '../data/guildFactionDatabase.js';

export class AdminDashboardManager {
    constructor(game) {
        this.game = game;
        this.visible = false;
        this.activeFaction = Object.keys(GUILD_FACTIONS)[0];
        this.sortColumn = 'name';
        this.sortDirection = 'asc';
        this.updateInterval = null;

        this.createDOM();
        this.bindEvents();
    }

    createDOM() {
        const overlay = document.createElement('div');
        overlay.id = 'admin-dashboard';
        overlay.className = 'hidden';

        const factionTabs = Object.entries(GUILD_FACTIONS).map(([id, f]) =>
            `<button class="admin-faction-tab${id === this.activeFaction ? ' active' : ''}" data-faction="${id}" style="--faction-color: ${f.color}">
                <span class="admin-faction-icon">${f.icon}</span>
                <span class="admin-faction-name">${f.shortName}</span>
            </button>`
        ).join('');

        overlay.innerHTML = `
            <div class="admin-container">
                <div class="admin-header">
                    <div class="admin-title">
                        <span class="admin-title-icon">\u2699</span>
                        GUILD ECONOMY DASHBOARD
                    </div>
                    <div class="admin-header-right">
                        <span class="admin-hint">Press \` to close</span>
                        <button class="admin-close">\u2715</button>
                    </div>
                </div>

                <div class="admin-factions">${factionTabs}</div>

                <div class="admin-faction-header">
                    <div class="admin-faction-title" id="admin-faction-title"></div>
                </div>

                <div class="admin-summary">
                    <div class="admin-stat-card">
                        <div class="admin-stat-label">TREASURY</div>
                        <div class="admin-stat-value" id="admin-treasury">0</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-label">INCOME/HR</div>
                        <div class="admin-stat-value admin-income" id="admin-income">0</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-label">EXPENSES/HR</div>
                        <div class="admin-stat-value admin-expense" id="admin-expenses">0</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-label">ACTIVE SHIPS</div>
                        <div class="admin-stat-value" id="admin-ships">0</div>
                    </div>
                    <div class="admin-stat-card">
                        <div class="admin-stat-label">SHIPS LOST</div>
                        <div class="admin-stat-value admin-expense" id="admin-lost">0</div>
                    </div>
                </div>

                <div class="admin-table-wrap">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th data-sort="name" class="admin-sortable">Name</th>
                                <th data-sort="role" class="admin-sortable">Role</th>
                                <th data-sort="shipClass" class="admin-sortable">Ship</th>
                                <th data-sort="sectorName" class="admin-sortable">Sector</th>
                                <th data-sort="aiState" class="admin-sortable">State</th>
                                <th data-sort="taskType" class="admin-sortable">Task</th>
                                <th class="admin-task-detail">Details</th>
                                <th data-sort="cargoUsed" class="admin-sortable">Cargo</th>
                                <th data-sort="hullPercent" class="admin-sortable">HP</th>
                                <th>Jump</th>
                            </tr>
                        </thead>
                        <tbody id="admin-table-body"></tbody>
                    </table>
                </div>

                <div class="admin-raid-log" id="admin-raid-log">
                    <div class="admin-raid-log-title">\u2620 PIRATE ACTIVITY LOG</div>
                    <div class="admin-raid-log-entries" id="admin-raid-entries"></div>
                </div>

                <div class="admin-footer">
                    <span id="admin-total-ships">Total: 0 ships across all factions</span>
                    <span id="admin-total-treasury">Combined treasury: 0 ISK</span>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;
    }

    bindEvents() {
        // Close button
        this.overlay.querySelector('.admin-close').addEventListener('click', () => this.toggle());

        // Faction tabs
        this.overlay.querySelectorAll('.admin-faction-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeFaction = tab.dataset.faction;
                this.overlay.querySelectorAll('.admin-faction-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.refresh();
            });
        });

        // Sortable headers
        this.overlay.querySelectorAll('.admin-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.sortColumn === col) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = col;
                    this.sortDirection = 'asc';
                }
                // Update sort indicators
                this.overlay.querySelectorAll('.admin-sortable').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
                this.refresh();
            });
        });
    }

    toggle() {
        this.visible = !this.visible;
        if (this.visible) {
            this.overlay.classList.remove('hidden');
            this.refresh();
            this.updateInterval = setInterval(() => this.refresh(), 1000);
        } else {
            this.overlay.classList.add('hidden');
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        }
    }

    refresh() {
        if (!this.visible) return;
        const sys = this.game.guildEconomySystem;
        if (!sys) return;

        // Update faction header
        const summary = sys.getFactionSummary(this.activeFaction);
        if (!summary) return;

        const titleEl = document.getElementById('admin-faction-title');
        if (titleEl) {
            titleEl.innerHTML = `<span style="color:${summary.color}">${summary.icon}</span> ${summary.name}`;
        }

        // Update summary cards
        this.setText('admin-treasury', formatCredits(summary.treasury));
        this.setText('admin-income', `+${formatCredits(summary.incomeRate)}`);
        this.setText('admin-expenses', `-${formatCredits(summary.expenseRate)}`);
        this.setText('admin-ships', summary.shipCount);
        this.setText('admin-lost', summary.shipsLost);

        // Update ship table
        const ships = sys.getFactionShips(this.activeFaction);
        this.renderTable(ships);

        // Update footer
        let totalShips = 0;
        let totalTreasury = 0;
        for (const fid of Object.keys(GUILD_FACTIONS)) {
            const fs = sys.getFactionSummary(fid);
            if (fs) {
                totalShips += fs.shipCount;
                totalTreasury += fs.treasury;
            }
        }
        this.setText('admin-total-ships', `Total: ${totalShips} ships across ${Object.keys(GUILD_FACTIONS).length} factions`);
        this.setText('admin-total-treasury', `Combined treasury: ${formatCredits(totalTreasury)}`);

        // Update raid log
        this.renderRaidLog(sys.recentRaidEvents || []);
    }

    renderTable(ships) {
        // Sort
        ships.sort((a, b) => {
            let aVal = a[this.sortColumn] ?? '';
            let bVal = b[this.sortColumn] ?? '';
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const tbody = document.getElementById('admin-table-body');
        if (!tbody) return;

        const roleIcons = { miner: '\u2692', hauler: '\u2696', ratter: '\u2694', raider: '\u2620', bomber: '\uD83D\uDCA3' };
        const stateColors = {
            idle: '#888', traveling: '#44aaff', mining: '#ffaa44',
            'trading-buy': '#44ff88', 'trading-sell': '#44ff88',
            ratting: '#ff4444', engaging: '#ff4444', fleeing: '#ff8844',
            returning: '#aaaaff', docking: '#666',
            raiding: '#cc2244',
            pursuing: '#ff6622', intercepting: '#ff44ff',
            tackling: '#ff2200', disengaging: '#aa8844',
            patrol: '#5588cc', responding: '#ff8844',
        };

        tbody.innerHTML = ships.map(ship => {
            const hpColor = ship.hullPercent > 60 ? '#44ff88' : ship.hullPercent > 30 ? '#ffaa44' : '#ff4444';
            const stateColor = stateColors[ship.aiState] || '#888';
            const cargoPercent = ship.cargoCapacity > 0 ? Math.round((ship.cargoUsed / ship.cargoCapacity) * 100) : 0;
            const matBadge = ship.materialized ? '<span class="admin-mat-badge">LIVE</span>' : '';

            return `<tr class="admin-row" data-guild-id="${ship.guildId}">
                <td class="admin-name">${ship.name} ${matBadge}</td>
                <td><span class="admin-role-icon">${roleIcons[ship.role] || ''}</span> ${ship.role}</td>
                <td class="admin-dim">${ship.shipClass}</td>
                <td>${ship.sectorName}</td>
                <td><span class="admin-state-dot" style="background:${stateColor}"></span>${ship.aiState}</td>
                <td>${ship.taskType}</td>
                <td class="admin-task-detail admin-dim">${ship.taskDetail}</td>
                <td><div class="admin-cargo-bar"><div class="admin-cargo-fill" style="width:${cargoPercent}%"></div></div><span class="admin-cargo-text">${ship.cargoUsed}/${ship.cargoCapacity}</span></td>
                <td style="color:${hpColor}">${ship.hullPercent}%</td>
                <td><button class="admin-jump-btn" data-guild-id="${ship.guildId}">\u279C</button></td>
            </tr>`;
        }).join('');

        // Bind jump buttons
        tbody.querySelectorAll('.admin-jump-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const guildId = btn.dataset.guildId;
                this.game.guildEconomySystem?.jumpToShip(guildId);
                this.toggle(); // Close dashboard
            });
        });

        // Row click also jumps
        tbody.querySelectorAll('.admin-row').forEach(row => {
            row.addEventListener('click', () => {
                const guildId = row.dataset.guildId;
                this.game.guildEconomySystem?.jumpToShip(guildId);
                this.toggle();
            });
        });
    }

    renderRaidLog(events) {
        const container = document.getElementById('admin-raid-entries');
        if (!container) return;

        if (events.length === 0) {
            container.innerHTML = '<div class="admin-raid-entry admin-dim">No recent pirate activity</div>';
            return;
        }

        // Show most recent events first (max 8)
        const recent = events.slice(-8).reverse();
        container.innerHTML = recent.map(e => {
            const age = Math.round((Date.now() - e.time) / 1000);
            const ageStr = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;
            let icon, msg, color;

            switch (e.type) {
                case 'kill':
                    icon = '\u2620';
                    msg = `${e.pirateName} destroyed ${e.targetName} (${e.targetRole}) in ${e.sectorName}`;
                    color = '#ff4466';
                    break;
                case 'plunder':
                    icon = '\uD83D\uDCB0';
                    msg = `${e.pirateName} plundered ${e.targetName} for ${formatCredits(e.value)}`;
                    color = '#ffaa44';
                    break;
                case 'launch':
                    icon = '\u26A0';
                    msg = `Raid launched: ${e.raidSize} pirates targeting ${this.game.guildEconomySystem?.getSectorName(e.targetSector) || e.targetSector}`;
                    color = '#ff6644';
                    break;
                case 'defended':
                    icon = '\u2694';
                    msg = `${e.pirateName} eliminated pirate ${e.targetName} (+${formatCredits(e.value)} bounty)`;
                    color = '#44ff88';
                    break;
                default:
                    icon = '\u2022';
                    msg = `${e.type}: ${e.pirateName}`;
                    color = '#888';
            }

            return `<div class="admin-raid-entry" style="border-left-color:${color}">
                <span class="admin-raid-icon">${icon}</span>
                <span class="admin-raid-msg">${msg}</span>
                <span class="admin-raid-time">${ageStr}</span>
            </div>`;
        }).join('');
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }
}
