// =============================================
// Asteroid Class
// Mineable resource objects with 3D visuals
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { PerlinNoise } from '../utils/perlin.js';

export class Asteroid extends Entity {
    constructor(game, options = {}) {
        const asteroidType = options.asteroidType || 'veldspar';
        const typeConfig = CONFIG.ASTEROID_TYPES[asteroidType];

        // Generate radius with more variation (30-70)
        const radius = options.radius || 30 + Math.random() * 40;

        super(game, {
            ...options,
            name: options.name || `${typeConfig?.name || 'Asteroid'}`,
            radius: radius,
            color: typeConfig?.color || 0x888888,
        });

        this.type = 'asteroid';
        this.asteroidType = asteroidType;

        // Ore capacity based on size: scaled to 100-1000 range
        // radius ranges from 30-70, so normalize and scale
        const normalizedSize = (radius - 30) / 40; // 0 to 1
        this.maxOre = Math.floor(100 + normalizedSize * 900); // 100 to 1000
        this.ore = this.maxOre;
        this.value = typeConfig?.value || 10; // Credits per unit of ore
        this.volumePerUnit = typeConfig?.volumePerUnit || 0.1; // m³ per unit

        // Legacy resource property for compatibility
        this.maxResources = this.maxOre;
        this.resources = this.ore;

        // Unique seed for this asteroid's geometry
        this.seed = options.seed || Math.floor(Math.random() * 100000);
        this.perlin = new PerlinNoise(this.seed);

        // Visual variety
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.detailLevel = 1; // Icosahedron subdivision level
    }

    /**
     * Update asteroid
     */
    update(dt) {
        super.update(dt);

        // Slow rotation
        this.rotation += this.rotationSpeed * dt;
    }

    /**
     * Mine ore from this asteroid
     * @param yield_amount Units of ore to extract
     * @returns Object with { units, volume, value } extracted
     */
    mine(yield_amount) {
        const extracted = Math.min(this.ore, yield_amount);
        this.ore -= extracted;

        // Update legacy property
        this.resources = this.ore;

        if (this.ore <= 0) {
            this.destroy();
        }

        return {
            units: extracted,
            volume: extracted * this.volumePerUnit,
            value: extracted * this.value,
            type: this.asteroidType,
        };
    }

    /**
     * Get remaining ore as percentage
     */
    getResourcePercent() {
        return (this.ore / this.maxOre) * 100;
    }

    /**
     * Get ore info for UI display
     */
    getOreInfo() {
        return {
            type: this.asteroidType,
            name: CONFIG.ASTEROID_TYPES[this.asteroidType]?.name || 'Unknown',
            current: this.ore,
            max: this.maxOre,
            value: this.value,
            volumePerUnit: this.volumePerUnit,
        };
    }

    /**
     * Create 3D asteroid mesh with Perlin noise displacement
     */
    createMesh() {
        // Create icosahedron geometry for rocky appearance
        const geometry = new THREE.IcosahedronGeometry(this.radius, this.detailLevel);

        // Apply Perlin noise displacement to vertices for rocky surface
        const positions = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);

            // Normalize to get direction from center
            const normalized = vertex.clone().normalize();

            // Sample 3D Perlin noise based on vertex direction
            const noiseScale = 2.0;
            const noise = this.perlin.noise3D(
                normalized.x * noiseScale,
                normalized.y * noiseScale,
                normalized.z * noiseScale
            );

            // Displace vertex along its normal direction
            // More displacement = more rocky appearance
            const displacement = 1 + noise * 0.3;
            vertex.multiplyScalar(displacement);

            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }

        // Recompute normals for proper lighting
        geometry.computeVertexNormals();

        // Create PBR material for realistic lighting
        // Darken the base color slightly for more contrast
        const baseColor = new THREE.Color(this.color);
        const material = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true, // Faceted look for rocky appearance
        });

        const asteroidMesh = new THREE.Mesh(geometry, material);

        // Tilt slightly to show 3D depth from top-down view
        asteroidMesh.rotation.x = -Math.PI * 0.15;

        // Random rotation for variety
        asteroidMesh.rotation.y = this.seed * 0.01;
        asteroidMesh.rotation.z = this.seed * 0.007;

        this.mesh = asteroidMesh;
        this.mesh.position.set(this.x, this.y, 0);

        return this.mesh;
    }

    /**
     * Update mesh position and rotation
     */
    updateMesh() {
        if (!this.mesh) return;

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.visible = this.visible && this.alive;

        // Slow rotation on Y axis for visual interest
        this.mesh.rotation.y += this.rotationSpeed * 0.016;
    }
}
