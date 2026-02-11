// =============================================
// Fleet Panel Manager
// UI panel for viewing and commanding fleet ships
// =============================================

import { formatDistance } from '../utils/math.js';

export class FleetPanelManager {
    constructor(game) {
        this.game = game;
        this.selectedFleetIds = new Set();
        this.updateTimer = 0;
        this.updateInterval = 0.5; // seconds
    }

    /**
     * Toggle fleet panel visibility
     */
    toggle() {
        const panel = document.getElementById('fleet-panel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            this.render();
        }
    }

    /**
     * Show the panel
     */
    show() {
        document.getElementById('fleet-panel')?.classList.remove('hidden');
        this.render();
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
            this.render();
        }
    }

    /**
     * Render fleet panel content
     */
    render() {
        const container = document.getElementById('fleet-panel-body');
        if (!container) return;

        const ships = this.game.fleet?.ships || [];

        if (ships.length === 0) {
            container.innerHTML = `
                <div class="fleet-empty">
                    <div>No fleet ships</div>
                    <div class="fleet-hint">Buy ships at stations and add them to your fleet</div>
                </div>
            `;
            return;
        }

        const stateColors = {
            following: '#4488ff',
            orbiting: '#44aaff',
            mining: '#ffcc44',
            attacking: '#ff4444',
            defending: '#ff8844',
            docked: '#888888',
        };

        const stateIcons = {
            following: '&#9654;',
            orbiting: '&#10227;',
            mining: '&#9874;',
            attacking: '&#9876;',
            defending: '&#9711;',
            docked: '&#9632;',
        };

        let html = '<table class="fleet-table"><thead><tr>' +
            '<th>Ship</th><th>Pilot</th><th>State</th><th>HP</th><th>Grp</th>' +
            '</tr></thead><tbody>';

        for (const ship of ships) {
            if (!ship.alive) continue;

            const selected = this.selectedFleetIds.has(ship.fleetId) ? 'selected' : '';
            const hullPct = Math.round((ship.hull / ship.maxHull) * 100);
            const shieldPct = Math.round((ship.shield / ship.maxShield) * 100);
            const stateColor = stateColors[ship.aiState] || '#888';
            const stateIcon = stateIcons[ship.aiState] || '';
            const pilotName = ship.pilot?.name || '<span class="dim">---</span>';
            const groupLabel = ship.groupId > 0 ? ship.groupId : '-';
            const overallHp = (ship.shield + ship.armor + ship.hull) / (ship.maxShield + ship.maxArmor + ship.maxHull);
            const hpDotColor = overallHp > 0.6 ? '#44ff88' : overallHp > 0.3 ? '#ffcc44' : '#ff4444';

            html += `
                <tr class="fleet-row ${selected}" data-fleet-id="${ship.fleetId}">
                    <td class="fleet-name"><span class="fleet-hp-dot" style="background:${hpDotColor}"></span>${ship.name}</td>
                    <td class="fleet-pilot">${pilotName}</td>
                    <td class="fleet-state" style="color:${stateColor}">${stateIcon} ${ship.aiState}</td>
                    <td class="fleet-hp">
                        <div class="fleet-hp-bars">
                            <div class="fleet-hp-bar shield" style="width:${shieldPct}%"></div>
                            <div class="fleet-hp-bar hull" style="width:${hullPct}%"></div>
                        </div>
                    </td>
                    <td class="fleet-group">${groupLabel}</td>
                </tr>
            `;
        }

        html += '</tbody></table>';

        // Command buttons
        const currentFormation = this.game.fleetSystem?.formation || 'spread';
        html += `
            <div class="fleet-commands">
                <button class="fleet-cmd-btn" data-cmd="following" title="Follow Player">Follow</button>
                <button class="fleet-cmd-btn" data-cmd="attacking" title="Attack Target">Attack</button>
                <button class="fleet-cmd-btn" data-cmd="mining" title="Mine Nearest">Mine</button>
                <button class="fleet-cmd-btn" data-cmd="defending" title="Defend Position">Defend</button>
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
        // Row click to select
        container.querySelectorAll('.fleet-row').forEach(row => {
            row.addEventListener('click', (e) => {
                const fleetId = parseInt(row.dataset.fleetId);
                if (e.shiftKey) {
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

        // Command buttons
        container.querySelectorAll('.fleet-cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                this.commandSelected(cmd);
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
        let html = '';
        html += '<div class="menu-item" data-action="fleet-follow">Follow</div>';
        html += '<div class="menu-item" data-action="fleet-defend">Defend</div>';

        if (target) {
            if (target.type === 'asteroid') {
                html += '<div class="menu-item" data-action="fleet-mine">Mine Target</div>';
            }
            if (target.hostility === 'hostile' || target.type === 'enemy') {
                html += '<div class="menu-item" data-action="fleet-attack">Attack Target</div>';
            }
            html += '<div class="menu-item" data-action="fleet-orbit">Orbit Target</div>';
        }

        html += '<div class="menu-separator"></div>';
        for (let g = 1; g <= 5; g++) {
            html += `<div class="menu-item" data-action="fleet-group-${g}">Assign to Group ${g}</div>`;
        }

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
            return;
        }

        const cmdMap = {
            'fleet-follow': 'following',
            'fleet-defend': 'defending',
            'fleet-mine': 'mining',
            'fleet-attack': 'attacking',
            'fleet-orbit': 'orbiting',
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
        if (this.selectedFleetIds.size === 0) return;
        this.game.fleetSystem?.assignToGroup(groupId, [...this.selectedFleetIds]);
        this.render();
    }
}
