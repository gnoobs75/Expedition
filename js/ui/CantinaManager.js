// =============================================
// Cantina Manager
// Station cantina tab for hiring/managing pilots
// =============================================

import { PilotGenerator } from '../data/PilotGenerator.js';
import { formatCredits } from '../utils/math.js';

export class CantinaManager {
    constructor(game) {
        this.game = game;
        this.availablePilots = [];
        this.station = null;
    }

    /**
     * Show cantina for a station (generates new pilots)
     */
    show(station) {
        this.station = station;
        // Generate new batch of pilots
        this.availablePilots = PilotGenerator.generate(8, 10, 85);
        this.render();
    }

    /**
     * Hide cantina
     */
    hide() {
        this.station = null;
    }

    /**
     * Render the cantina tab content
     */
    render() {
        const container = document.getElementById('cantina-content');
        if (!container) return;

        let html = '';

        // Available pilots section
        html += '<div class="cantina-section"><div class="cantina-section-title">PILOTS FOR HIRE</div>';
        html += '<div class="cantina-pilots-grid">';

        for (const pilot of this.availablePilots) {
            html += this.renderPilotCard(pilot, 'hire');
        }

        if (this.availablePilots.length === 0) {
            html += '<div class="cantina-empty">No pilots available at this station</div>';
        }

        html += '</div></div>';

        // Hired pilots section
        html += '<div class="cantina-section"><div class="cantina-section-title">YOUR PILOTS</div>';
        html += '<div class="cantina-pilots-grid">';

        const hiredPilots = this.game.fleet.hiredPilots || [];
        for (const pilot of hiredPilots) {
            html += this.renderPilotCard(pilot, 'manage');
        }

        if (hiredPilots.length === 0) {
            html += '<div class="cantina-empty">No pilots hired yet</div>';
        }

        html += '</div></div>';

        container.innerHTML = html;

        // Attach event listeners
        this.attachListeners(container);
    }

    /**
     * Render a single pilot card
     */
    renderPilotCard(pilot, mode) {
        const traits = pilot.traits.map(t => {
            const info = PilotGenerator.getTraitInfo(t);
            return `<span class="pilot-trait" style="border-color:${info.color}" title="${info.description}">${info.name}</span>`;
        }).join('');

        const avgSkill = Math.round((pilot.skills.combat + pilot.skills.mining + pilot.skills.navigation) / 3);
        const assigned = pilot.assignedShipId ? 'Assigned' : 'Unassigned';

        let actions = '';
        if (mode === 'hire') {
            actions = `<button class="cantina-btn hire-btn" data-pilot-id="${pilot.id}">HIRE (${formatCredits(pilot.hireCost)} ISK)</button>`;
        } else {
            const assignBtn = pilot.assignedShipId
                ? `<button class="cantina-btn unassign-btn" data-pilot-id="${pilot.id}">Unassign</button>`
                : `<button class="cantina-btn assign-btn" data-pilot-id="${pilot.id}">Assign to Ship</button>`;
            actions = `
                ${assignBtn}
                <button class="cantina-btn fire-btn" data-pilot-id="${pilot.id}">FIRE (Refund ${formatCredits(Math.round(pilot.hireCost * 0.5))} ISK)</button>
            `;
        }

        return `
            <div class="pilot-card" data-pilot-id="${pilot.id}">
                <div class="pilot-header">
                    <div class="pilot-name">${pilot.name}</div>
                    <div class="pilot-salary">${formatCredits(pilot.salary)} ISK/day</div>
                </div>
                <div class="pilot-skills">
                    <div class="pilot-skill">
                        <span class="skill-label">Combat</span>
                        <div class="skill-bar-bg"><div class="skill-bar combat" style="width:${pilot.skills.combat}%"></div></div>
                        <span class="skill-value">${pilot.skills.combat}</span>
                    </div>
                    <div class="pilot-skill">
                        <span class="skill-label">Mining</span>
                        <div class="skill-bar-bg"><div class="skill-bar mining" style="width:${pilot.skills.mining}%"></div></div>
                        <span class="skill-value">${pilot.skills.mining}</span>
                    </div>
                    <div class="pilot-skill">
                        <span class="skill-label">Navigation</span>
                        <div class="skill-bar-bg"><div class="skill-bar navigation" style="width:${pilot.skills.navigation}%"></div></div>
                        <span class="skill-value">${pilot.skills.navigation}</span>
                    </div>
                </div>
                <div class="pilot-traits">${traits}</div>
                ${mode === 'manage' ? `<div class="pilot-status">${assigned}</div>` : ''}
                <div class="pilot-actions">${actions}</div>
            </div>
        `;
    }

    /**
     * Attach click listeners to cantina buttons
     */
    attachListeners(container) {
        // Hire buttons
        container.querySelectorAll('.hire-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hirePilot(parseInt(btn.dataset.pilotId));
            });
        });

        // Fire buttons
        container.querySelectorAll('.fire-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.firePilot(parseInt(btn.dataset.pilotId));
            });
        });

        // Assign buttons
        container.querySelectorAll('.assign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAssignMenu(parseInt(btn.dataset.pilotId), e.target);
            });
        });

        // Unassign buttons
        container.querySelectorAll('.unassign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unassignPilot(parseInt(btn.dataset.pilotId));
            });
        });
    }

    /**
     * Hire a pilot
     */
    hirePilot(pilotId) {
        const pilotIndex = this.availablePilots.findIndex(p => p.id === pilotId);
        if (pilotIndex === -1) return;

        const pilot = this.availablePilots[pilotIndex];

        if (this.game.credits < pilot.hireCost) {
            this.game.ui?.log('Not enough credits to hire pilot', 'system');
            this.game.ui?.toast('Insufficient funds', 'error');
            return;
        }

        // Deduct credits
        this.game.spendCredits(pilot.hireCost);

        // Move pilot from available to hired
        this.availablePilots.splice(pilotIndex, 1);
        this.game.fleet.hiredPilots.push(pilot);

        this.game.ui?.log(`Hired ${pilot.name}`, 'system');
        this.game.ui?.toast(`${pilot.name} hired!`, 'success');
        this.game.audio?.play('buy');

        this.render();
    }

    /**
     * Fire a pilot (refund 50% of hire cost)
     */
    firePilot(pilotId) {
        const pilots = this.game.fleet.hiredPilots;
        const index = pilots.findIndex(p => p.id === pilotId);
        if (index === -1) return;

        const pilot = pilots[index];

        // Unassign from ship if assigned
        if (pilot.assignedShipId) {
            const ship = this.game.fleet.ships.find(s => s.fleetId === pilot.assignedShipId);
            if (ship) {
                ship.pilot = null;
            }
            pilot.assignedShipId = null;
        }

        // Refund 50%
        const refund = Math.round(pilot.hireCost * 0.5);
        this.game.addCredits(refund);

        // Remove from hired list
        pilots.splice(index, 1);

        this.game.ui?.log(`Fired ${pilot.name} (+${formatCredits(refund)} ISK refund)`, 'system');
        this.game.audio?.play('sell');

        this.render();
    }

    /**
     * Show ship assignment menu for a pilot
     */
    showAssignMenu(pilotId, anchorEl) {
        const pilot = this.game.fleet.hiredPilots.find(p => p.id === pilotId);
        if (!pilot) return;

        const fleetShips = this.game.fleet.ships.filter(s => s.alive && !s.pilot);

        if (fleetShips.length === 0) {
            this.game.ui?.toast('No uncrewed fleet ships available', 'warning');
            return;
        }

        // Build a simple dropdown
        const menu = document.createElement('div');
        menu.className = 'cantina-assign-menu';
        menu.style.position = 'absolute';

        const rect = anchorEl.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 2}px`;

        let menuHtml = '<div class="cantina-assign-title">Assign to:</div>';
        for (const ship of fleetShips) {
            menuHtml += `<div class="cantina-assign-option" data-fleet-id="${ship.fleetId}">${ship.name} (${ship.shipClass})</div>`;
        }
        menu.innerHTML = menuHtml;

        document.body.appendChild(menu);

        // Click handler
        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.cantina-assign-option');
            if (option) {
                this.assignPilotToShip(pilotId, parseInt(option.dataset.fleetId));
            }
            menu.remove();
        });

        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    }

    /**
     * Assign a pilot to a fleet ship
     */
    assignPilotToShip(pilotId, fleetId) {
        const pilot = this.game.fleet.hiredPilots.find(p => p.id === pilotId);
        const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
        if (!pilot || !ship) return;

        // Unassign from previous ship
        if (pilot.assignedShipId) {
            const oldShip = this.game.fleet.ships.find(s => s.fleetId === pilot.assignedShipId);
            if (oldShip) oldShip.pilot = null;
        }

        // Assign
        pilot.assignedShipId = fleetId;
        ship.pilot = pilot;
        ship.applyPilotSkills();

        this.game.ui?.log(`${pilot.name} assigned to ${ship.name}`, 'system');
        this.game.ui?.toast(`${pilot.name} is now captaining ${ship.name}`, 'success');

        this.render();
    }

    /**
     * Unassign a pilot from their ship
     */
    unassignPilot(pilotId) {
        const pilot = this.game.fleet.hiredPilots.find(p => p.id === pilotId);
        if (!pilot || !pilot.assignedShipId) return;

        const ship = this.game.fleet.ships.find(s => s.fleetId === pilot.assignedShipId);
        if (ship) {
            ship.pilot = null;
        }
        pilot.assignedShipId = null;

        this.game.ui?.log(`${pilot.name} unassigned`, 'system');
        this.render();
    }
}
