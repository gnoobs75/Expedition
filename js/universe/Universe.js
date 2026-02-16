// =============================================
// Universe Class
// Manages all sectors and inter-sector connections
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { Sector } from './Sector.js';
import { SeededRandom } from '../utils/random.js';

export class Universe {
    constructor(game) {
        this.game = game;
        this.sectors = new Map();
        this.connections = new Map(); // sector -> [connected sectors]
        this.seed = 0;
        this.random = new SeededRandom();
    }

    /**
     * Generate the universe from config
     */
    generate(seed) {
        this.seed = seed;
        this.random.setSeed(seed);

        console.log('Generating universe with seed:', seed);

        // Create sectors from layout
        for (const sectorData of UNIVERSE_LAYOUT.sectors) {
            const sector = new Sector(this.game, {
                id: sectorData.id,
                name: sectorData.name,
                difficulty: sectorData.difficulty,
                hasStation: sectorData.hasStation,
                seed: this.random.int(0, 999999),
                gridX: sectorData.x,
                gridY: sectorData.y,
            });

            this.sectors.set(sectorData.id, sector);
            this.connections.set(sectorData.id, []);
        }

        // Create gate connections
        for (const gate of UNIVERSE_LAYOUT.gates) {
            // Add bidirectional connections
            this.connections.get(gate.from).push(gate.to);
            this.connections.get(gate.to).push(gate.from);
        }

        console.log(`Created ${this.sectors.size} sectors with ${UNIVERSE_LAYOUT.gates.length} Elder Wormhole connections`);
    }

    /**
     * Get a sector by ID
     */
    getSector(id) {
        return this.sectors.get(id);
    }

    /**
     * Get all sectors connected to a given sector
     */
    getConnectedSectors(sectorId) {
        const connectedIds = this.connections.get(sectorId) || [];
        return connectedIds.map(id => this.sectors.get(id)).filter(s => s);
    }

    /**
     * Get all sectors
     */
    getAllSectors() {
        return Array.from(this.sectors.values());
    }

    /**
     * Find the gate in a sector that leads to destination
     */
    findGateTo(fromSectorId, toSectorId) {
        const sector = this.sectors.get(fromSectorId);
        if (!sector) return null;

        return sector.entities.find(
            e => e.type === 'gate' && e.destinationSectorId === toSectorId
        );
    }

    /**
     * Get the shortest path between two sectors
     */
    findPath(fromId, toId) {
        if (fromId === toId) return [fromId];

        // BFS
        const queue = [[fromId]];
        const visited = new Set([fromId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            const connections = this.connections.get(current) || [];
            for (const next of connections) {
                if (next === toId) {
                    return [...path, next];
                }

                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push([...path, next]);
                }
            }
        }

        return null; // No path found
    }

    /**
     * Get universe map data for UI
     */
    getMapData() {
        const sectors = [];
        const connections = [];

        for (const [id, sector] of this.sectors) {
            sectors.push({
                id: sector.id,
                name: sector.name,
                x: sector.gridX,
                y: sector.gridY,
                difficulty: sector.difficulty,
                hasStation: sector.hasStation,
            });
        }

        for (const gate of UNIVERSE_LAYOUT.gates) {
            connections.push({
                from: gate.from,
                to: gate.to,
            });
        }

        return { sectors, connections };
    }
}
