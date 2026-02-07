// =============================================
// Fleet System
// Manages player fleet ships, control groups, commands
// =============================================

import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { FleetShip } from '../entities/FleetShip.js';

export class FleetSystem {
    constructor(game) {
        this.game = game;

        // Control groups (1-5) -> Set of fleetIds
        this.controlGroups = new Map();
        for (let i = 1; i <= 5; i++) {
            this.controlGroups.set(i, new Set());
        }

        // AI update throttle
        this.aiUpdateTimer = 0;
        this.aiUpdateInterval = 0.5; // seconds

        // Max fleet size
        this.maxFleetSize = CONFIG.FLEET?.MAX_SIZE || 10;
    }

    /**
     * Get all fleet ships
     */
    getShips() {
        return this.game.fleet.ships;
    }

    /**
     * Add a ship to the fleet
     * @param {string} shipClass - Ship class ID from database
     * @param {object|null} pilot - Pilot object or null
     * @returns {FleetShip|null} The created fleet ship
     */
    addShip(shipClass, pilot = null) {
        if (this.game.fleet.ships.length >= this.maxFleetSize) {
            this.game.ui?.log('Fleet is at maximum capacity', 'system');
            this.game.ui?.toast('Fleet full (max ' + this.maxFleetSize + ')', 'warning');
            return null;
        }

        const shipConfig = SHIP_DATABASE[shipClass] || CONFIG.SHIPS[shipClass];
        if (!shipConfig) {
            console.warn(`Unknown ship class: ${shipClass}`);
            return null;
        }

        // Spawn near player or station
        const player = this.game.player;
        const spawnX = player ? player.x + (Math.random() - 0.5) * 500 : CONFIG.SECTOR_SIZE / 2;
        const spawnY = player ? player.y + (Math.random() - 0.5) * 500 : CONFIG.SECTOR_SIZE / 2;

        const fleetShip = new FleetShip(this.game, {
            shipClass,
            x: spawnX,
            y: spawnY,
            pilot,
        });

        // Add to fleet registry
        this.game.fleet.ships.push(fleetShip);

        // Add to current sector
        this.game.currentSector?.addEntity(fleetShip);

        this.game.ui?.log(`${fleetShip.name} joined the fleet`, 'system');
        this.game.ui?.toast(`${fleetShip.name} added to fleet`, 'success');
        this.game.events.emit('fleet:ship-added', fleetShip);

        return fleetShip;
    }

    /**
     * Remove a ship from the fleet
     */
    removeShip(fleetId) {
        const index = this.game.fleet.ships.findIndex(s => s.fleetId === fleetId);
        if (index === -1) return;

        const ship = this.game.fleet.ships[index];

        // Remove from control groups
        for (const [, group] of this.controlGroups) {
            group.delete(fleetId);
        }

        // Unassign pilot
        if (ship.pilot) {
            ship.pilot.assignedShipId = null;
        }

        // Remove from fleet registry
        this.game.fleet.ships.splice(index, 1);

        // Destroy the entity
        if (ship.alive) {
            ship.destroy();
        }

        this.game.ui?.log(`${ship.name} removed from fleet`, 'system');
        this.game.events.emit('fleet:ship-removed', ship);
    }

    /**
     * Command a control group
     * @param {number} groupId - Group number 1-5
     * @param {string} command - AI state command
     * @param {Entity|null} target - Target entity
     */
    commandGroup(groupId, command, target = null) {
        const group = this.controlGroups.get(groupId);
        if (!group || group.size === 0) return;

        for (const fleetId of group) {
            const ship = this.game.fleet.ships.find(s => s.fleetId === fleetId);
            if (ship && ship.alive) {
                ship.setCommand(command, target);
            }
        }

        const commandNames = {
            following: 'Follow',
            orbiting: 'Orbit',
            mining: 'Mine',
            attacking: 'Attack',
            defending: 'Defend',
        };
        this.game.ui?.log(`Group ${groupId}: ${commandNames[command] || command}`, 'system');
    }

    /**
     * Assign ships to a control group
     * @param {number} groupId - Group number 1-5
     * @param {Array<number>} fleetIds - Array of fleet IDs to assign
     */
    assignToGroup(groupId, fleetIds) {
        const group = this.controlGroups.get(groupId);
        if (!group) return;

        // Clear existing group
        group.clear();

        // Add ships
        for (const id of fleetIds) {
            const ship = this.game.fleet.ships.find(s => s.fleetId === id);
            if (ship) {
                // Remove from old group
                for (const [gid, g] of this.controlGroups) {
                    if (gid !== groupId) g.delete(id);
                }
                group.add(id);
                ship.groupId = groupId;
            }
        }

        this.game.ui?.log(`Assigned ${fleetIds.length} ships to Group ${groupId}`, 'system');
    }

    /**
     * Get ships in a control group
     */
    getGroupShips(groupId) {
        const group = this.controlGroups.get(groupId);
        if (!group) return [];

        return [...group]
            .map(id => this.game.fleet.ships.find(s => s.fleetId === id))
            .filter(s => s && s.alive);
    }

    /**
     * Teleport all fleet ships to player position when jumping gates
     */
    followThroughGate() {
        const player = this.game.player;
        if (!player) return;

        for (const ship of this.game.fleet.ships) {
            if (!ship.alive) continue;

            // Remove from old sector entities (if still there)
            // Position near player in new sector
            const offsetX = (Math.random() - 0.5) * 600;
            const offsetY = (Math.random() - 0.5) * 600;
            ship.x = player.x + offsetX;
            ship.y = player.y + offsetY;
            ship.velocity.set(0, 0);
            ship.currentSpeed = 0;

            // Add to new sector
            this.game.currentSector?.addEntity(ship);
        }
    }

    /**
     * Command all fleet ships
     */
    commandAll(command, target = null) {
        for (const ship of this.game.fleet.ships) {
            if (ship.alive) {
                ship.setCommand(command, target);
            }
        }
    }

    /**
     * Update fleet system
     */
    update(dt) {
        // Throttled AI updates
        this.aiUpdateTimer += dt;
        if (this.aiUpdateTimer >= this.aiUpdateInterval) {
            this.aiUpdateTimer = 0;
            this.updateFleetAI(this.aiUpdateInterval);
        }

        // Clean up dead ships
        this.cleanDeadShips();
    }

    /**
     * Update AI for all fleet ships (throttled)
     */
    updateFleetAI(dt) {
        for (const ship of this.game.fleet.ships) {
            if (ship.alive) {
                ship.aiUpdate(dt);
            }
        }
    }

    /**
     * Remove dead ships from fleet registry
     */
    cleanDeadShips() {
        const ships = this.game.fleet.ships;
        for (let i = ships.length - 1; i >= 0; i--) {
            if (!ships[i].alive) {
                const dead = ships[i];

                // Remove from control groups
                for (const [, group] of this.controlGroups) {
                    group.delete(dead.fleetId);
                }

                // Unassign pilot (pilot survives)
                if (dead.pilot) {
                    dead.pilot.assignedShipId = null;
                }

                ships.splice(i, 1);
            }
        }
    }

    /**
     * Get fleet summary for UI
     */
    getFleetSummary() {
        return this.game.fleet.ships.map(ship => ({
            fleetId: ship.fleetId,
            name: ship.name,
            shipClass: ship.shipClass,
            pilot: ship.pilot?.name || 'No Pilot',
            aiState: ship.aiState,
            groupId: ship.groupId,
            hullPercent: Math.round((ship.hull / ship.maxHull) * 100),
            shieldPercent: Math.round((ship.shield / ship.maxShield) * 100),
            armorPercent: Math.round((ship.armor / ship.maxArmor) * 100),
            alive: ship.alive,
        }));
    }
}
