// =============================================
// Sector Class
// Individual playable area with procedural content
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { SeededRandom, combineSeeds } from '../utils/random.js';
import { Asteroid } from '../entities/Asteroid.js';
import { Planet } from '../entities/Planet.js';
import { Station } from '../entities/Station.js';
import { WarpGate } from '../entities/WarpGate.js';
import { EnemyShip } from '../entities/EnemyShip.js';

export class Sector {
    constructor(game, options = {}) {
        this.game = game;

        // Sector identity
        this.id = options.id || 'unknown';
        this.name = options.name || 'Unknown Sector';
        this.seed = options.seed || 0;

        // Grid position in universe
        this.gridX = options.gridX || 0;
        this.gridY = options.gridY || 0;

        // Difficulty settings
        this.difficulty = options.difficulty || 'normal';
        this.difficultyConfig = CONFIG.SECTOR_DIFFICULTY[this.difficulty];

        // Station
        this.hasStation = options.hasStation || false;

        // Entities in this sector
        this.entities = [];

        // Generation state
        this.generated = false;

        // Random generator for this sector
        this.random = new SeededRandom(this.seed);
    }

    /**
     * Generate sector content (called when entering sector)
     */
    generate() {
        if (this.generated) return;

        console.log(`Generating sector: ${this.name} (seed: ${this.seed})`);
        this.random.reset();

        // Clear any existing entities
        this.entities = [];

        // Generate celestial objects
        this.generatePlanets();
        this.generateAsteroidFields();

        // Generate station if applicable
        if (this.hasStation) {
            this.generateStation();
        }

        // Generate warp gates
        this.generateGates();

        // Generate enemies based on difficulty
        this.generateEnemies();

        this.generated = true;
        console.log(`Generated ${this.entities.length} entities in ${this.name}`);
    }

    /**
     * Generate the central planet - large dominant body at sector center
     */
    generatePlanets() {
        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        // Create the central planet - massive and in exact center
        const centralPlanet = new Planet(this.game, {
            x: centerX,
            y: centerY,
            radius: CONFIG.CENTRAL_PLANET.radius,
            name: `${this.name} Prime`,
            isCentralPlanet: true,
            hasRings: this.random.next() > 0.5, // 50% chance of rings
        });

        this.entities.push(centralPlanet);
        this.centralPlanet = centralPlanet; // Store reference for collision checks
    }

    /**
     * Generate asteroid fields - scattered clusters far from central planet
     */
    generateAsteroidFields() {
        const density = this.difficultyConfig.asteroidDensity;
        const fieldCount = Math.floor(3 + density * 4); // More fields for larger space

        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        // Minimum distance from central planet (well beyond its radius)
        const minDistFromCenter = 6000;
        const maxDistFromCenter = CONFIG.SECTOR_SIZE / 2 - 2000;

        for (let f = 0; f < fieldCount; f++) {
            // Position field at a distance from center (scattered around the planet)
            const fieldAngle = this.random.angle();
            const fieldDist = this.random.float(minDistFromCenter, maxDistFromCenter);

            const fieldX = centerX + Math.cos(fieldAngle) * fieldDist;
            const fieldY = centerY + Math.sin(fieldAngle) * fieldDist;

            const fieldRadius = this.random.float(1500, 4000); // Larger clusters
            const asteroidCount = Math.floor(15 + density * 25);

            for (let i = 0; i < asteroidCount; i++) {
                const point = this.random.pointInCircle(fieldRadius);

                // Determine asteroid type by weighted random
                const typeRoll = this.random.next();
                let asteroidType = 'veldspar';
                let cumulative = 0;

                for (const [type, config] of Object.entries(CONFIG.ASTEROID_TYPES)) {
                    cumulative += config.abundance;
                    if (typeRoll < cumulative) {
                        asteroidType = type;
                        break;
                    }
                }

                const asteroid = new Asteroid(this.game, {
                    x: fieldX + point.x,
                    y: fieldY + point.y,
                    asteroidType,
                    name: `${CONFIG.ASTEROID_TYPES[asteroidType].name}`,
                });

                this.entities.push(asteroid);
            }
        }
    }

    /**
     * Generate the station - positioned far from central planet
     */
    generateStation() {
        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        // Place station at a safe distance from central planet
        const stationAngle = this.random.angle();
        const stationDist = this.random.float(5000, 7000);

        const station = new Station(this.game, {
            x: centerX + Math.cos(stationAngle) * stationDist,
            y: centerY + Math.sin(stationAngle) * stationDist,
            name: `${this.name} Station`,
            radius: 500, // Much larger station
        });

        this.entities.push(station);
    }

    /**
     * Generate warp gates to connected sectors - positioned at outer edges
     */
    generateGates() {
        const connectedSectors = UNIVERSE_LAYOUT.gates
            .filter(g => g.from === this.id || g.to === this.id)
            .map(g => g.from === this.id ? g.to : g.from);

        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        for (let i = 0; i < connectedSectors.length; i++) {
            const destId = connectedSectors[i];
            const destSector = UNIVERSE_LAYOUT.sectors.find(s => s.id === destId);

            // Position gate based on relative direction to destination
            let angle;
            if (destSector) {
                angle = Math.atan2(
                    destSector.y - this.gridY,
                    destSector.x - this.gridX
                );
            } else {
                angle = (i / connectedSectors.length) * Math.PI * 2;
            }

            // Place gate far from center (near sector edge)
            const dist = CONFIG.SECTOR_SIZE * 0.42;
            const gate = new WarpGate(this.game, {
                x: centerX + Math.cos(angle) * dist,
                y: centerY + Math.sin(angle) * dist,
                destinationSectorId: destId,
                destinationName: destSector?.name || destId,
                name: `Gate to ${destSector?.name || destId}`,
            });

            this.entities.push(gate);
        }
    }

    /**
     * Generate enemy ships - far from central planet
     */
    generateEnemies() {
        const count = this.difficultyConfig.enemyCount;
        const centerX = CONFIG.SECTOR_SIZE / 2;
        const centerY = CONFIG.SECTOR_SIZE / 2;

        for (let i = 0; i < count; i++) {
            // Determine enemy type based on difficulty
            let enemyType = 'pirate-frigate';
            if (this.difficulty === 'dangerous' || this.difficulty === 'deadly') {
                if (this.random.next() > 0.7) {
                    enemyType = 'pirate-cruiser';
                }
            }

            // Random position well away from central planet
            const angle = this.random.angle();
            const dist = this.random.float(5000, 12000);

            const enemy = new EnemyShip(this.game, {
                x: centerX + Math.cos(angle) * dist,
                y: centerY + Math.sin(angle) * dist,
                enemyType,
                name: `Pirate ${i + 1}`,
            });

            // Set initial patrol point (nearby their spawn)
            enemy.patrolPoint = {
                x: enemy.x + this.random.float(-2000, 2000),
                y: enemy.y + this.random.float(-2000, 2000),
            };

            this.entities.push(enemy);
        }
    }

    /**
     * Update all entities in sector
     */
    update(dt) {
        for (const entity of this.entities) {
            if (entity.alive) {
                entity.update(dt);
            }
        }

        // Remove dead entities
        this.entities = this.entities.filter(e => e.alive);
    }

    /**
     * Add entity to sector
     */
    addEntity(entity) {
        this.entities.push(entity);
    }

    /**
     * Remove entity from sector
     */
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
    }

    /**
     * Get station in this sector
     */
    getStation() {
        return this.entities.find(e => e.type === 'station');
    }

    /**
     * Get all gates in this sector
     */
    getGates() {
        return this.entities.filter(e => e.type === 'gate');
    }

    /**
     * Get all asteroids in this sector
     */
    getAsteroids() {
        return this.entities.filter(e => e.type === 'asteroid');
    }

    /**
     * Get all enemies in this sector
     */
    getEnemies() {
        return this.entities.filter(e => e.type === 'enemy');
    }

    /**
     * Get entities by type
     */
    getEntitiesByType(type) {
        return this.entities.filter(e => e.type === type);
    }

    /**
     * Find nearest entity of type to position
     */
    findNearest(x, y, type = null) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const entity of this.entities) {
            if (type && entity.type !== type) continue;
            if (!entity.alive) continue;

            const dx = entity.x - x;
            const dy = entity.y - y;
            const dist = dx * dx + dy * dy;

            if (dist < nearestDist) {
                nearest = entity;
                nearestDist = dist;
            }
        }

        return nearest;
    }

    /**
     * Get entities within radius
     */
    getEntitiesInRadius(x, y, radius) {
        const radiusSq = radius * radius;
        return this.entities.filter(entity => {
            if (!entity.alive) return false;
            const dx = entity.x - x;
            const dy = entity.y - y;
            return dx * dx + dy * dy <= radiusSq;
        });
    }
}
