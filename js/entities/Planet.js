// =============================================
// Planet Class
// Celestial bodies - includes central planets and decorative ones
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

export class Planet extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Planet',
            radius: options.radius || 200 + Math.random() * 300,
        });

        this.type = 'planet';

        // Central planet flag - these are massive and deadly
        this.isCentralPlanet = options.isCentralPlanet || false;

        // Visual properties
        this.planetColor = options.planetColor || this.randomPlanetColor();
        this.hasRings = options.hasRings !== undefined ? options.hasRings : Math.random() > 0.6;
        this.ringColor = options.ringColor || 0x888888;
        this.atmosphere = options.atmosphere !== undefined ? options.atmosphere : Math.random() > 0.5;
        this.atmosphereColor = options.atmosphereColor || this.randomAtmosphereColor();

        // Central planets always have atmosphere and potentially rings
        if (this.isCentralPlanet) {
            this.atmosphere = true;
            this.hasRings = options.hasRings !== undefined ? options.hasRings : Math.random() > 0.4;
            // Grander colors for central planets
            this.planetColor = options.planetColor || this.randomCentralPlanetColor();
        }

        // Slow rotation
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }

    /**
     * Generate random color for central planets (more dramatic)
     */
    randomCentralPlanetColor() {
        const colors = [
            0x5577cc, // Deep blue
            0xcc8855, // Orange gas giant
            0x77aa77, // Green
            0xbb6666, // Red/Mars-like
            0xddbb77, // Saturn-like tan
            0x8888aa, // Grey-purple
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Generate random planet color
     */
    randomPlanetColor() {
        const colors = [
            0x4488aa, // Blue
            0x88aa44, // Green
            0xaa6644, // Brown/Red
            0xccaa66, // Tan
            0x6666aa, // Purple
            0xaa8866, // Orange
            0x888899, // Grey
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Generate random atmosphere color
     */
    randomAtmosphereColor() {
        const colors = [
            0x4488ff, // Blue
            0x44ffaa, // Teal
            0xffaa44, // Orange
            0xff8888, // Red
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Update planet
     */
    update(dt) {
        super.update(dt);
        this.rotation += this.rotationSpeed * dt;
    }

    /**
     * Create planet mesh
     */
    createMesh() {
        const group = new THREE.Group();

        // Main planet body - flat disc with PBR material for subtle 3D shading
        // SphereGeometry can't be used: planets have radius up to 2000,
        // which would extend far beyond the camera at z=100
        const planetGeometry = new THREE.CircleGeometry(this.radius, 64);
        const planetMaterial = new THREE.MeshStandardMaterial({
            color: this.planetColor,
            roughness: 0.8,
            metalness: 0.1,
        });
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        group.add(planet);

        // Surface details (darker patches)
        const patchCount = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < patchCount; i++) {
            const patchSize = this.radius * (0.1 + Math.random() * 0.2);
            const patchGeometry = new THREE.CircleGeometry(patchSize, 16);
            const patchMaterial = new THREE.MeshBasicMaterial({
                color: this.planetColor,
                transparent: true,
                opacity: 0.3,
            });
            const patch = new THREE.Mesh(patchGeometry, patchMaterial);

            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.radius * 0.6;
            patch.position.set(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                0.1
            );
            group.add(patch);
        }

        // Atmosphere glow
        if (this.atmosphere) {
            const atmosGeometry = new THREE.RingGeometry(
                this.radius,
                this.radius * 1.15,
                32
            );
            const atmosMaterial = new THREE.MeshBasicMaterial({
                color: this.atmosphereColor,
                transparent: true,
                opacity: 0.2,
            });
            const atmos = new THREE.Mesh(atmosGeometry, atmosMaterial);
            atmos.position.z = -0.1;
            group.add(atmos);
        }

        // Rings
        if (this.hasRings) {
            const ringGeometry = new THREE.RingGeometry(
                this.radius * 1.3,
                this.radius * 1.8,
                64
            );
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: this.ringColor,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI * 0.3; // Tilt the rings
            ring.position.z = -0.2;
            group.add(ring);
        }

        // Gravitational lens ring — faint shimmer beyond atmosphere
        const lensInner = this.atmosphere ? this.radius * 1.16 : this.radius * 1.02;
        const lensOuter = lensInner + this.radius * 0.06;
        const lensGeo = new THREE.RingGeometry(lensInner, lensOuter, 64);
        const lensMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
        });
        const lensRing = new THREE.Mesh(lensGeo, lensMat);
        lensRing.position.z = -0.3;
        group.add(lensRing);
        this.lensRing = lensRing;

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, -1); // Behind other objects

        return this.mesh;
    }

    /**
     * Update mesh with animation
     */
    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, -1);
            this.mesh.visible = this.visible && this.alive;

            // Subtle gravitational lens shimmer
            if (this.lensRing) {
                const t = performance.now() * 0.001;
                this.lensRing.material.opacity = 0.04 + Math.sin(t * 0.8 + this.x * 0.01) * 0.03;
                this.lensRing.scale.setScalar(1.0 + Math.sin(t * 0.3) * 0.01);
            }
        }
    }
}
