// =============================================
// Fleet Panel Manager
// UI panel for viewing and commanding fleet ships
// =============================================

import { formatDistance } from '../utils/math.js';
import { FORMATION_BONUSES, DOCTRINES } from '../systems/FleetSystem.js';

export class FleetPanelManager {
    constructor(game) {
        this.game = game;
        this.selectedFleetIds = new Set();
        this.updateTimer = 0;
        this.updateInterval = 0.5; // seconds

        // Group filter: 0 = all, 1-5 = specific group
        this.activeGroupFilter = 0;

        // Sort state
        this.sortColumn = 'name';
        this.sortAscending = true;

        // Expanded detail row
        this.expandedFleetId = null;

        // Dirty-checking hash to avoid redundant renders
        this._lastRenderHash = '';

        // Sub-tab state: 'fleet' or 'aar'
        this.activeSubTab = 'fleet';

        // AAR state
        this.selectedReportId = null; // null = list view, id = detail view
        this.expandedDamageLog = false;

        // Wire sub-tab clicks
        this.initSubTabs();
    }

    /**
     * Toggle fleet panel visibility
     */
    toggle() {
        const panel = document.getElementById('fleet-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.refreshCurrentTab();
        }
    }

    /**
     * Show the panel
     */
    show() {
        document.getElementById('fleet-panel')?.classList.remove('hidden');
        this.refreshCurrentTab();
    }

    /**
     * Render whichever sub-tab is active
     */
    refreshCurrentTab() {
        if (this.activeSubTab === 'aar') {
            this.renderAAR();
        } else {
            this.render();
        }
    }

    /**
     * Hide the panel
     */
    hide() {
        document.getElementById('fleet-panel')?.classList.add('hidden');
    }

    /**
     * Update (called from UIManager at throttled rate)
     */
    update(dt) {
        const panel = document.getElementById('fleet-panel');
        if (!panel || panel.classList.contains('hidden')) return;

        this.updateTimer += dt;
        if (this.updateTimer >= this.updateInterval) {
            this.updateTimer = 0;
            if (this.activeSubTab === 'fleet') {
                this.render();
            }
            // AAR tab doesn't need periodic refresh
        }
    }

    /**
     * Select a control group (from hotkey)
     */
    selectGroup(groupId) {
        const groupShips = this.game.fleetSystem?.getGroupShips(groupId) || [];
        if (groupShips.length === 0) {
            this.game.ui?.showToast(`Group ${groupId} is empty`, 'system');
            return;
        }

        this.selectedFleetIds.clear();
        for (const ship of groupShips) {
            this.selectedFleetIds.add(ship.fleetId);
        }

        // Show the panel and filter to this group
        this.activeGroupFilter = groupId;
        this.show();
    }

    /**
     * Get filtered & sorted ships
     */
    getFilteredShips() {
        let ships = (this.game.fleet?.ships || []).filter(s => s.alive);

        // Apply group filter
        if (this.activeGroupFilter > 0) {
            ships = ships.filter(s => s.groupId === this.activeGroupFilter);
        }

        // Sort
        ships.sort((a, b) => {
            let cmp = 0;
            switch (this.sortColumn) {
                case 'name':
                    cmp = a.name.localeCompare(b.name);
                    break;
                case 'pilot':
                    cmp = (a.pilot?.name || '').localeCompare(b.pilot?.name || '');
                    break;
                case 'state':
                    cmp = a.aiState.localeCompare(b.aiState);
                    break;
                case 'hp': {
                    const hpA = (a.shield + a.armor + a.hull) / (a.maxShield + a.maxArmor + a.maxHull);
                    const hpB = (b.shield + b.armor + b.hull) / (b.maxShield + b.maxArmor + b.maxHull);
                    cmp = hpA - hpB;
                    break;
                }
                case 'group':
                    cmp = a.groupId - b.groupId;
                    break;
                case 'dist': {
                    const player = this.game.player;
                    const distA = player ? a.distanceTo(player) : 0;
                    const distB = player ? b.distanceTo(player) : 0;
                    cmp = distA - distB;
                    break;
                }
                default:
                    cmp = 0;
            }
            return this.sortAscending ? cmp : -cmp;
        });

        return ships;
    }

    /**
     * Render fleet panel content
     */
    render() {
        const container = document.getElementById('fleet-panel-body');
        if (!container) return;

        const allShips = (this.game.fleet?.ships || []).filter(s => s.alive);

        // Dirty check: skip render if fleet state hasn't changed
        const hash = allShips.map(s => s.fleetId + '|' + Math.round(s.shield + s.armor + s.hull) + '|' + s.aiState + '|' + s.groupId + '|' + s.stance).join(',')
            + '|f' + this.activeGroupFilter + '|s' + this.sortColumn + this.sortAscending + '|e' + (this.expandedFleetId || '') + '|sel' + [...this.selectedFleetIds].join('-');
        if (hash === this._lastRenderHash) return;
        this._lastRenderHash = hash;

        const ships = this.getFilteredShips();

        const stateColors = {
            following: '#4488ff',
            orbiting: '#44aaff',
            mining: '#ffcc44',
            attacking: '#ff4444',
            defending: '#ff8844',
            holding: '#aa88ff',
            docked: '#888888',
        };

        const stateIcons = {
            following: '&#9654;',
            orbiting: '&#10227;',
            mining: '&#9874;',
            attacking: '&#9876;',
            defending: '&#9711;',
            holding: '&#9632;',
            docked: '&#8999;',
        };

        let html = '';

        // Group filter tabs
        html += '<div class="fleet-group-tabs">';
        html += `<button class="fleet-group-tab ${this.activeGroupFilter === 0 ? 'active' : ''}" data-group="0">ALL (${allShips.length})</button>`;
        for (let g = 1; g <= 5; g++) {
            const count = allShips.filter(s => s.groupId === g).length;
            html += `<button class="fleet-group-tab ${this.activeGroupFilter === g ? 'active' : ''} ${count === 0 ? 'empty-group' : ''}" data-group="${g}">${g}${count > 0 ? ` (${count})` : ''}</button>`;
        }
        html += '</div>';

        // Fleet summary bar
        const totalShips = allShips.length;
        const miningCount = allShips.filter(s => s.aiState === 'mining').length;
        const combatCount = allShips.filter(s => s.aiState === 'attacking' || s.aiState === 'defending').length;
        const avgHp = totalShips > 0 ? allShips.reduce((sum, s) => sum + (s.shield + s.armor + s.hull) / (s.maxShield + s.maxArmor + s.maxHull), 0) / totalShips : 1;
        const avgHpColor = avgHp > 0.6 ? '#44ff88' : avgHp > 0.3 ? '#ffcc44' : '#ff4444';

        // Formation & doctrine info
        const formationStatus = this.game.fleetSystem?.getFormationStatus() || { inFormation: 0, total: 0 };
        const currentFormationKey = this.game.fleetSystem?.formation || 'spread';
        const formBonus = FORMATION_BONUSES[currentFormationKey];
        const doctrineKey = this.game.fleetSystem?.activeDoctrine || 'balanced';
        const doctrine = DOCTRINES[doctrineKey];

        html += `<div class="fleet-summary-bar">
            <span class="fleet-stat">${totalShips + 1} fleet</span>
            ${miningCount > 0 ? `<span class="fleet-stat mining-stat">${miningCount} mining</span>` : ''}
            ${combatCount > 0 ? `<span class="fleet-stat combat-stat">${combatCount} in combat</span>` : ''}
            <span class="fleet-stat" style="color:${avgHpColor}">${Math.round(avgHp * 100)}% avg HP</span>
        </div>`;

        // Doctrine selector + Formation status row
        html += `<div class="fleet-doctrine-bar">
            <div class="fleet-doctrine-select">
                <label style="color:#888;font-size:12px">DOCTRINE:</label>
                <select class="fleet-doctrine-dropdown">
                    ${Object.entries(DOCTRINES).map(([k, d]) =>
                        `<option value="${k}" ${k === doctrineKey ? 'selected' : ''}>${d.label}</option>`
                    ).join('')}
                </select>
                <span class="fleet-doctrine-desc" style="color:#aaa;font-size:11px">${doctrine?.description || ''}</span>
            </div>
            <div class="fleet-formation-status">
                <span style="color:#888;font-size:12px">FORMATION:</span>
                <span style="color:#66ccff">${currentFormationKey.toUpperCase()}</span>
                ${formBonus ? `<span style="color:#44ff88;font-size:11px">${formBonus.description}</span>` : ''}
                <span style="color:${formationStatus.inFormation === formationStatus.total ? '#44ff88' : '#ffcc44'};font-size:12px">${formationStatus.inFormation}/${formationStatus.total} in position</span>
            </div>
        </div>`;

        // Flagship section
        const flagship = this.game.fleetSystem?.flagship;
        if (flagship?.alive) {
            const fHp = Math.round(((flagship.shield + flagship.armor + flagship.hull) / (flagship.maxShield + flagship.maxArmor + flagship.maxHull)) * 100);
            const hangar = flagship.getHangarContents?.() || [];
            const hangarCap = flagship.hangarCapacity || 5;
            html += `<div class="flagship-section">
                <div class="flagship-header">&#9733; FLAGSHIP: ${flagship.name || 'Command Ship'}</div>
                <div style="display:flex;gap:12px;font-size:13px;color:#ccc;margin-bottom:4px">
                    <span>HP: <span style="color:${fHp > 60 ? '#44ff88' : fHp > 30 ? '#ffcc44' : '#ff4444'}">${fHp}%</span></span>
                    <span>Hangar: ${hangar.length}/${hangarCap}</span>
                    <span class="flagship-command-status">CMD Range: ${flagship.commandRange || 2000}m</span>
                </div>`;
            if (hangar.length > 0) {
                for (const h of hangar) {
                    html += `<div class="flagship-hangar-ship">
                        <span>${h.name || h.shipClass || 'Ship'}</span>
                        <button class="fleet-btn tiny" data-action="undock-hangar" data-index="${h.index || 0}" style="font-size:11px;padding:1px 6px">UNDOCK</button>
                    </div>`;
                }
            }
            html += '</div>';
        }

        // Sort direction indicator
        const sortArrow = this.sortAscending ? '&#9650;' : '&#9660;';
        const sortFor = (col) => this.sortColumn === col ? sortArrow : '';

        // Table header
        html += '<table class="fleet-table"><thead><tr>' +
            `<th class="fleet-sortable" data-sort="name">Ship ${sortFor('name')}</th>` +
            `<th class="fleet-sortable" data-sort="state">State ${sortFor('state')}</th>` +
            `<th class="fleet-sortable" data-sort="hp">HP ${sortFor('hp')}</th>` +
            `<th class="fleet-sortable" data-sort="dist">Dist ${sortFor('dist')}</th>` +
            `<th class="fleet-sortable" data-sort="group">Grp ${sortFor('group')}</th>` +
            '</tr></thead><tbody>';

        // Player commander row (always first)
        const player = this.game.player;
        if (player) {
            const pShieldPct = Math.round((player.shield / player.maxShield) * 100);
            const pHullPct = Math.round((player.hull / player.maxHull) * 100);
            const overallHp = (player.shield + player.armor + player.hull) / (player.maxShield + player.maxArmor + player.maxHull);
            const hpDotColor = overallHp > 0.6 ? '#44ff88' : overallHp > 0.3 ? '#ffcc44' : '#ff4444';
            const factionName = this.game.faction?.name || 'Fleet Commander';
            const playerState = this.game.dockedAt ? 'docked' : player.currentSpeed > 1 ? 'cruising' : 'idle';
            const stateColor = this.game.dockedAt ? '#888888' : '#44ff88';

            html += `
                <tr class="fleet-row fleet-commander-row">
                    <td class="fleet-name"><span class="fleet-hp-dot" style="background:${hpDotColor}"></span><span class="fleet-commander-icon">&#9733;</span> ${player.name || 'You'}</td>
                    <td class="fleet-state" style="color:${stateColor}">&#9670; ${playerState}</td>
                    <td class="fleet-hp">
                        <div class="fleet-hp-bars">
                            <div class="fleet-hp-bar shield" style="width:${pShieldPct}%"></div>
                            <div class="fleet-hp-bar hull" style="width:${pHullPct}%"></div>
                        </div>
                    </td>
                    <td class="fleet-dist">&mdash;</td>
                    <td class="fleet-group">CMD</td>
                </tr>
            `;
        }

        if (allShips.length === 0) {
            html += `
                <tr class="fleet-row">
                    <td colspan="5" class="fleet-empty-hint">Hire ships at stations to expand your fleet</td>
                </tr>
            `;
        }

        for (const ship of ships) {
            const selected = this.selectedFleetIds.has(ship.fleetId) ? 'selected' : '';
            const expanded = this.expandedFleetId === ship.fleetId ? 'expanded' : '';
            const hullPct = Math.round((ship.hull / ship.maxHull) * 100);
            const shieldPct = Math.round((ship.shield / ship.maxShield) * 100);
            const stateColor = stateColors[ship.aiState] || '#888';
            const stateIcon = stateIcons[ship.aiState] || '';
            const groupLabel = ship.groupId > 0 ? ship.groupId : '-';
            const overallHp = (ship.shield + ship.armor + ship.hull) / (ship.maxShield + ship.maxArmor + ship.maxHull);
            const hpDotColor = overallHp > 0.6 ? '#44ff88' : overallHp > 0.3 ? '#ffcc44' : '#ff4444';
            const stanceIcon = ship.stance === 'passive' ? '&#9679;' : '&#9733;';
            const stanceColor = ship.stance === 'passive' ? '#8888aa' : '#ffaa44';

            // Distance to player
            const player = this.game.player;
            const dist = player ? ship.distanceTo(player) : 0;
            const distStr = formatDistance(dist);

            html += `
                <tr class="fleet-row ${selected} ${expanded}" data-fleet-id="${ship.fleetId}">
                    <td class="fleet-name"><span class="fleet-hp-dot" style="background:${hpDotColor}"></span>${ship.name}</td>
                    <td class="fleet-state" style="color:${stateColor}"><span title="${ship.stance}" style="color:${stanceColor}">${stanceIcon}</span> ${stateIcon} ${ship.aiState}</td>
                    <td class="fleet-hp">
                        <div class="fleet-hp-bars">
                            <div class="fleet-hp-bar shield" style="width:${shieldPct}%"></div>
                            <div class="fleet-hp-bar hull" style="width:${hullPct}%"></div>
                        </div>
                    </td>
                    <td class="fleet-dist">${distStr}</td>
                    <td class="fleet-group">${groupLabel}</td>
                </tr>
            `;

            // Expanded detail row
            if (this.expandedFleetId === ship.fleetId) {
                const pilotName = ship.pilot?.name || 'No Pilot';
                const cargoUsed = Math.round(ship.cargoUsed || 0);
                const cargoCap = Math.round(ship.cargoCapacity || 0);
                const cargoPercent = cargoCap > 0 ? Math.round((cargoUsed / cargoCap) * 100) : 0;

                html += `
                    <tr class="fleet-detail-row" data-fleet-id="${ship.fleetId}">
                        <td colspan="5">
                            <div class="fleet-detail">
                                <div class="fleet-detail-info">
                                    <span class="fleet-detail-label">Class:</span> ${ship.shipClass}
                                    <span class="fleet-detail-sep">|</span>
                                    <span class="fleet-detail-label">Pilot:</span> ${pilotName}
                                    <span class="fleet-detail-sep">|</span>
                                    <span class="fleet-detail-label">Cargo:</span> ${cargoUsed}/${cargoCap} (${cargoPercent}%)
                                </div>
                                <div class="fleet-detail-hp">
                                    <span style="color:#4488ff">S: ${Math.round(ship.shield)}/${ship.maxShield}</span>
                                    <span style="color:#ffaa44">A: ${Math.round(ship.armor)}/${ship.maxArmor}</span>
                                    <span style="color:#ff4444">H: ${Math.round(ship.hull)}/${ship.maxHull}</span>
                                </div>
                                <div class="fleet-detail-actions">
                                    <button class="fleet-detail-btn" data-detail-cmd="following" data-fleet-id="${ship.fleetId}">Follow</button>
                                    <button class="fleet-detail-btn" data-detail-cmd="attacking" data-fleet-id="${ship.fleetId}">Attack</button>
                                    <button class="fleet-detail-btn" data-detail-cmd="mining" data-fleet-id="${ship.fleetId}">Mine</button>
                                    <button class="fleet-detail-btn" data-detail-cmd="defending" data-fleet-id="${ship.fleetId}">Defend</button>
                                    <button class="fleet-detail-btn" data-detail-cmd="holding" data-fleet-id="${ship.fleetId}">Hold</button>
                                    <button class="fleet-detail-btn fleet-stance-btn" data-detail-cmd="toggle-stance" data-fleet-id="${ship.fleetId}">${ship.stance === 'aggressive' ? 'AGG' : 'PAS'}</button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        html += '</tbody></table>';

        // Command buttons bar
        const currentFormation = this.game.fleetSystem?.formation || 'spread';
        const selCount = this.selectedFleetIds.size;
        const cmdLabel = selCount > 0 ? `(${selCount})` : '(all)';

        html += `
            <div class="fleet-commands">
                <button class="fleet-cmd-btn" data-cmd="following" title="Follow Player">Follow ${cmdLabel}</button>
                <button class="fleet-cmd-btn" data-cmd="attacking" title="Attack Target">Attack</button>
                <button class="fleet-cmd-btn" data-cmd="mining" title="Mine Nearest">Mine</button>
                <button class="fleet-cmd-btn" data-cmd="defending" title="Defend Position">Defend</button>
                <button class="fleet-cmd-btn" data-cmd="holding" title="Hold Position">Hold</button>
                <button class="fleet-cmd-btn fleet-formation-btn" data-cmd="formation" title="Cycle Formation">${currentFormation.toUpperCase()}</button>
            </div>
        `;

        container.innerHTML = html;
        this.attachListeners(container);
    }

    /**
     * Attach event listeners to fleet panel
     */
    attachListeners(container) {
        // Group filter tabs
        container.querySelectorAll('.fleet-group-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeGroupFilter = parseInt(tab.dataset.group);
                this.render();
            });
        });

        // Doctrine dropdown
        const docDropdown = container.querySelector('.fleet-doctrine-dropdown');
        if (docDropdown) {
            docDropdown.addEventListener('change', () => {
                this.game.fleetSystem?.setDoctrine(docDropdown.value);
                this.game.ui?.showToast(`Doctrine: ${DOCTRINES[docDropdown.value]?.label}`, 'system');
                this.render();
            });
        }

        // Sort headers
        container.querySelectorAll('.fleet-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.sortColumn === col) {
                    this.sortAscending = !this.sortAscending;
                } else {
                    this.sortColumn = col;
                    this.sortAscending = true;
                }
                this.render();
            });
        });

        // Row click to select
        container.querySelectorAll('.fleet-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const fleetId = parseInt(row.dataset.fleetId);
                if (e.ctrlKey || e.metaKey) {
                    // Toggle expand detail
                    this.expandedFleetId = this.expandedFleetId === fleetId ? null : fleetId;
                } else if (e.shiftKey) {
                    // Multi-select
                    if (this.selectedFleetIds.has(fleetId)) {
                        this.selectedFleetIds.delete(fleetId);
                    } else {
                        this.selectedFleetIds.add(fleetId);
                    }
                } else {
                    // Single select
                    this.selectedFleetIds.clear();
                    this.selectedFleetIds.add(fleetId);
                }
                this.render();
            });

            // Right-click for individual command
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const fleetId = parseInt(row.dataset.fleetId);
                this.selectedFleetIds.clear();
                this.selectedFleetIds.add(fleetId);
                this.showCommandMenu(e.clientX, e.clientY);
            });
        });

        // Flagship undock buttons
        container.querySelectorAll('[data-action="undock-hangar"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const flagship = this.game.fleetSystem?.flagship;
                if (flagship?.undockShip) {
                    flagship.undockShip(idx);
                    this.game.ui?.showToast('Ship launched from flagship hangar', 'success');
                    this.render();
                }
            });
        });

        // Command buttons
        container.querySelectorAll('.fleet-cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                this.commandSelected(cmd);
            });
        });

        // Detail row individual command buttons
        container.querySelectorAll('.fleet-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cmd = btn.dataset.detailCmd;
                const fleetId = parseInt(btn.dataset.fleetId);
                const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
                if (!ship || !ship.alive) return;

                if (cmd === 'toggle-stance') {
                    ship.stance = ship.stance === 'aggressive' ? 'passive' : 'aggressive';
                    this.game.ui?.showToast(`${ship.name}: ${ship.stance}`, 'system');
                } else {
                    ship.setCommand(cmd, this.game.selectedTarget);
                }
                this.game.audio?.play('click');
                this.render();
            });
        });
    }

    /**
     * Command selected fleet ships
     */
    commandSelected(command) {
        if (command === 'formation') {
            this.game.fleetSystem?.cycleFormation();
            this.render();
            return;
        }
        if (this.selectedFleetIds.size === 0) {
            // Command all
            this.game.fleetSystem?.commandAll(command, this.game.selectedTarget);
        } else {
            for (const fleetId of this.selectedFleetIds) {
                const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
                if (ship && ship.alive) {
                    ship.setCommand(command, this.game.selectedTarget);
                }
            }
        }
        this.game.audio?.play('click');
        this.render();
    }

    /**
     * Show command context menu for a fleet ship
     */
    showCommandMenu(x, y) {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        const target = this.game.selectedTarget;
        const selectedShip = this.game.fleet.ships.find(s => this.selectedFleetIds.has(s.fleetId));

        let html = '';
        html += '<div class="menu-item" data-action="fleet-follow">Follow</div>';
        html += '<div class="menu-item" data-action="fleet-defend">Defend</div>';
        html += '<div class="menu-item" data-action="fleet-hold">Hold Position</div>';

        if (target) {
            if (target.type === 'asteroid') {
                html += '<div class="menu-item" data-action="fleet-mine">Mine Target</div>';
            }
            if (target.hostility === 'hostile' || target.type === 'enemy') {
                html += '<div class="menu-item" data-action="fleet-attack">Attack Target</div>';
            }
            html += '<div class="menu-item" data-action="fleet-orbit">Orbit Target</div>';
            html += '<div class="menu-item" data-action="fleet-assist">Assist (attack my target)</div>';
        }

        html += '<div class="menu-separator"></div>';

        // Stance toggle
        if (selectedShip) {
            const nextStance = selectedShip.stance === 'aggressive' ? 'Passive' : 'Aggressive';
            html += `<div class="menu-item" data-action="fleet-toggle-stance">Set ${nextStance}</div>`;
        }

        html += '<div class="menu-separator"></div>';
        for (let g = 1; g <= 5; g++) {
            html += `<div class="menu-item" data-action="fleet-group-${g}">Assign to Group ${g}</div>`;
        }
        html += '<div class="menu-item" data-action="fleet-ungroup">Remove from Group</div>';

        menu.innerHTML = html;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Attach fleet-specific handlers
        menu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleFleetMenuAction(action);
                menu.classList.add('hidden');
            });
        });
    }

    /**
     * Handle fleet-specific context menu action
     */
    handleFleetMenuAction(action) {
        if (action.startsWith('fleet-group-')) {
            const groupId = parseInt(action.split('-')[2]);
            this.game.fleetSystem?.assignToGroup(groupId, [...this.selectedFleetIds]);
            this.render();
            return;
        }

        if (action === 'fleet-ungroup') {
            for (const fleetId of this.selectedFleetIds) {
                const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
                if (ship) {
                    // Remove from all groups
                    for (const [, group] of this.game.fleetSystem.controlGroups) {
                        group.delete(fleetId);
                    }
                    ship.groupId = 0;
                }
            }
            this.render();
            return;
        }

        if (action === 'fleet-toggle-stance') {
            for (const fleetId of this.selectedFleetIds) {
                const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
                if (ship) {
                    ship.stance = ship.stance === 'aggressive' ? 'passive' : 'aggressive';
                }
            }
            this.render();
            return;
        }

        if (action === 'fleet-assist') {
            // Attack whatever the player has locked
            const target = this.game.lockedTarget || this.game.selectedTarget;
            if (target) {
                for (const fleetId of this.selectedFleetIds) {
                    const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
                    if (ship && ship.alive) {
                        ship.setCommand('attacking', target);
                    }
                }
            }
            this.render();
            return;
        }

        const cmdMap = {
            'fleet-follow': 'following',
            'fleet-defend': 'defending',
            'fleet-mine': 'mining',
            'fleet-attack': 'attacking',
            'fleet-orbit': 'orbiting',
            'fleet-hold': 'holding',
        };

        const cmd = cmdMap[action];
        if (cmd) {
            this.commandSelected(cmd);
        }
    }

    /**
     * Assign selected ships to a control group via hotkey
     */
    assignSelectedToGroup(groupId) {
        if (this.selectedFleetIds.size === 0) {
            this.game.ui?.showToast('Select fleet ships first (F panel)', 'warning');
            return;
        }
        this.game.fleetSystem?.assignToGroup(groupId, [...this.selectedFleetIds]);
        this.game.ui?.showToast(`Assigned ${this.selectedFleetIds.size} ships to Group ${groupId}`, 'system');
        this.render();
    }

    // ==========================================
    // Sub-tab Management
    // ==========================================

    initSubTabs() {
        document.querySelectorAll('.fleet-sub-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeSubTab = tab.dataset.subtab;
                document.querySelectorAll('.fleet-sub-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const fleetBody = document.getElementById('fleet-panel-body');
                const aarBody = document.getElementById('aar-panel-body');
                if (this.activeSubTab === 'fleet') {
                    fleetBody?.classList.remove('hidden');
                    aarBody?.classList.add('hidden');
                    this.render();
                } else {
                    fleetBody?.classList.add('hidden');
                    aarBody?.classList.remove('hidden');
                    this.renderAAR();
                }
            });
        });
    }

    // ==========================================
    // AAR Rendering
    // ==========================================

    renderAAR() {
        const container = document.getElementById('aar-panel-body');
        if (!container) return;

        if (this.selectedReportId !== null) {
            this.renderAARDetail(container);
        } else {
            this.renderAARList(container);
        }
    }

    renderAARList(container) {
        const reports = this.game.engagementRecorder?.reports || [];

        let html = '<div class="aar-list">';

        if (reports.length === 0) {
            html += '<div class="aar-empty">No engagement reports yet.<br><span class="aar-hint">Combat involving your faction will be recorded automatically.</span></div>';
            html += '</div>';
            container.innerHTML = html;
            return;
        }

        html += `<div class="aar-list-header">
            <span class="aar-count">${reports.length} engagement${reports.length !== 1 ? 's' : ''}</span>
            <button class="aar-clear-btn" title="Clear all reports">CLEAR</button>
        </div>`;

        for (const report of reports) {
            const outcomeColor = report.outcome === 'victory' ? '#44ff88' :
                report.outcome === 'pyrrhic' ? '#ffcc44' :
                    report.outcome === 'defeat' ? '#ff4444' : '#888';
            const outcomeLabel = report.outcome.charAt(0).toUpperCase() + report.outcome.slice(1);
            const factionNames = Object.keys(report.factions).join(' vs ');
            const totalShips = report.ships.length;
            const totalDestroyed = report.ships.filter(s => s.destroyed).length;

            html += `
                <div class="aar-card" data-report-id="${report.id}" style="border-left: 3px solid ${outcomeColor}">
                    <div class="aar-card-header">
                        <span class="aar-stardate">${report.stardate}</span>
                        <span class="aar-outcome" style="color:${outcomeColor}">${outcomeLabel}</span>
                    </div>
                    <div class="aar-card-body">
                        <div class="aar-sector">${report.sectorName}</div>
                        <div class="aar-factions">${factionNames}</div>
                        <div class="aar-stats">
                            <span>${totalShips} ships</span>
                            <span>${totalDestroyed} destroyed</span>
                            <span>${report.duration}s</span>
                        </div>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;

        // Attach click handlers
        container.querySelectorAll('.aar-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedReportId = parseInt(card.dataset.reportId);
                this.renderAAR();
            });
        });

        // Clear button
        container.querySelector('.aar-clear-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.game.engagementRecorder?.clearReports();
            this.renderAAR();
        });
    }

    renderAARDetail(container) {
        const reports = this.game.engagementRecorder?.reports || [];
        const report = reports.find(r => r.id === this.selectedReportId);

        if (!report) {
            this.selectedReportId = null;
            this.renderAARList(container);
            return;
        }

        const outcomeColor = report.outcome === 'victory' ? '#44ff88' :
            report.outcome === 'pyrrhic' ? '#ffcc44' :
                report.outcome === 'defeat' ? '#ff4444' : '#888';
        const outcomeLabel = report.outcome.charAt(0).toUpperCase() + report.outcome.slice(1);

        let html = '<div class="aar-detail">';

        // Back button
        html += '<button class="aar-back-btn">&larr; Back to Reports</button>';

        // Header
        html += `
            <div class="aar-detail-header" style="border-left: 3px solid ${outcomeColor}">
                <div class="aar-detail-title">
                    <span class="aar-outcome-large" style="color:${outcomeColor}">${outcomeLabel}</span>
                    <span class="aar-detail-stardate">SD ${report.stardate}</span>
                </div>
                <div class="aar-detail-meta">
                    <span>${report.sectorName}</span>
                    <span>${report.duration}s duration</span>
                </div>
            </div>
        `;

        // Faction summary
        html += '<div class="aar-factions-summary">';
        for (const [name, faction] of Object.entries(report.factions)) {
            const isPlayer = faction.isPlayerFaction;
            const fColor = isPlayer ? '#00ccff' : '#ff6644';
            html += `
                <div class="aar-faction-card" style="border-color:${fColor}">
                    <div class="aar-faction-name" style="color:${fColor}">${name}</div>
                    <div class="aar-faction-stats">
                        <span>Ships: ${faction.shipsInvolved}</span>
                        <span style="color:#ff4444">Lost: ${faction.shipsLost}</span>
                    </div>
                    <div class="aar-faction-damage">
                        <span>Dealt: ${Math.round(faction.damageDealt)}</span>
                        <span>Taken: ${Math.round(faction.damageTaken)}</span>
                    </div>
                </div>
            `;
        }
        html += '</div>';

        // Ship list
        html += '<div class="aar-ships-section"><div class="aar-section-title">Ships Involved</div>';
        for (const ship of report.ships) {
            const isPlayer = report.factions[ship.faction]?.isPlayerFaction;
            const shipColor = isPlayer ? '#00ccff' : '#ff8844';
            const destroyedBadge = ship.destroyed ? '<span class="aar-destroyed-badge">DESTROYED</span>' : '';
            const killInfo = ship.destroyed && ship.killCredit ? `<span class="aar-kill-credit">by ${ship.killCredit}</span>` : '';

            html += `
                <div class="aar-ship-row ${ship.destroyed ? 'destroyed' : ''}">
                    <div class="aar-ship-name" style="color:${shipColor}">${ship.combatId} <span class="aar-ship-class">(${ship.shipClass})</span></div>
                    <div class="aar-ship-stats">
                        <span>Dealt: ${ship.damageDealt}</span>
                        <span>Taken: ${ship.damageTaken}</span>
                        ${destroyedBadge}${killInfo}
                    </div>
                </div>
            `;
        }
        html += '</div>';

        // Damage log (collapsible)
        const logEntries = report.damageLog || [];
        html += `
            <div class="aar-log-section">
                <button class="aar-log-toggle" data-expanded="${this.expandedDamageLog}">
                    Damage Log (${logEntries.length} events) ${this.expandedDamageLog ? '&#9660;' : '&#9654;'}
                </button>
        `;

        if (this.expandedDamageLog) {
            html += '<div class="aar-log-entries">';
            const displayEntries = logEntries.slice(0, 200); // cap for performance
            for (const entry of displayEntries) {
                const timeStr = entry.t.toFixed(1) + 's';
                if (entry.type === 'destroyed') {
                    html += `<div class="aar-log-entry destruction"><span class="aar-log-time">${timeStr}</span> <span class="aar-log-destroyed">${entry.tgt}</span> was destroyed by ${entry.src}</div>`;
                } else {
                    const dmgColor = entry.type === 'shield' ? '#4488ff' : entry.type === 'armor' ? '#ffaa44' : '#ff4444';
                    html += `<div class="aar-log-entry"><span class="aar-log-time">${timeStr}</span> ${entry.src} &rarr; ${entry.tgt}: <span style="color:${dmgColor}">${entry.dmg} ${entry.type}</span> (${entry.weapon})</div>`;
                }
            }
            if (logEntries.length > 200) {
                html += `<div class="aar-log-entry">... and ${logEntries.length - 200} more events</div>`;
            }
            html += '</div>';
        }
        html += '</div>';

        // Replay button
        if (report.snapshots && report.snapshots.length > 0) {
            html += '<button class="aar-replay-btn" data-report-id="' + report.id + '">&#9654; Tactical Replay</button>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Attach listeners
        container.querySelector('.aar-back-btn')?.addEventListener('click', () => {
            this.selectedReportId = null;
            this.expandedDamageLog = false;
            this.renderAAR();
        });

        container.querySelector('.aar-log-toggle')?.addEventListener('click', () => {
            this.expandedDamageLog = !this.expandedDamageLog;
            this.renderAARDetail(container);
        });

        container.querySelector('.aar-replay-btn')?.addEventListener('click', () => {
            this.game.ui?.showTacticalReplay(report);
        });
    }
}
