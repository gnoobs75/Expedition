// =============================================
// Nebula
// Procedural nebula background using noise
// =============================================

import { CONFIG } from '../config.js';
import { PerlinNoise } from '../utils/perlin.js';

export class Nebula {
    constructor(game) {
        this.game = game;
        this.mesh = new THREE.Group();

        this.seed = 0;
        this.noise = new PerlinNoise(0);

        this.generate();
    }

    /**
     * Set seed and regenerate
     */
    setSeed(seed) {
        if (this.seed === seed) return;

        this.seed = seed;
        this.noise = new PerlinNoise(seed);
        this.regenerate();
    }

    /**
     * Generate nebula clouds
     */
    generate() {
        // Create several nebula clouds
        const cloudCount = 4;
        const colors = [
            CONFIG.COLORS.nebula1,
            CONFIG.COLORS.nebula2,
            CONFIG.COLORS.nebula3,
            0x330033,
        ];

        for (let i = 0; i < cloudCount; i++) {
            const cloud = this.createNebulaCloud(
                colors[i % colors.length],
                i * 0.25
            );
            this.mesh.add(cloud);
        }
    }

    /**
     * Create a single nebula cloud layer
     */
    createNebulaCloud(color, phaseOffset) {
        const group = new THREE.Group();

        // Create multiple overlapping circles with varying opacity
        const blobCount = 15 + Math.floor(this.noise.noise2D(phaseOffset, 0) * 10);

        for (let i = 0; i < blobCount; i++) {
            // Use noise to position blobs
            const noiseX = this.noise.fbm(i * 0.5, phaseOffset, 3);
            const noiseY = this.noise.fbm(phaseOffset, i * 0.5, 3);

            const x = (noiseX * 0.5 + 0.5) * CONFIG.SECTOR_SIZE;
            const y = (noiseY * 0.5 + 0.5) * CONFIG.SECTOR_SIZE;

            // Size based on noise
            const sizeFactor = this.noise.noise2DNormalized(i * 0.3, phaseOffset * 2);
            const radius = 500 + sizeFactor * 2000;

            // Create cloud blob
            const geometry = new THREE.CircleGeometry(radius, 32);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.05 + sizeFactor * 0.08,
            });

            const blob = new THREE.Mesh(geometry, material);
            blob.position.set(x, y, -60 - i * 0.5);

            group.add(blob);
        }

        return group;
    }

    /**
     * Create canvas texture from noise (alternative method)
     */
    createNoiseTexture(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const nx = x / width;
                const ny = y / height;

                // Layer multiple noise octaves
                const n1 = this.noise.fbm(nx * 3, ny * 3, 4);
                const n2 = this.noise.turbulence(nx * 2, ny * 2, 3);

                // Combine for cloudy effect
                const value = (n1 + n2) * 0.5;
                const intensity = Math.pow(Math.max(0, value), 2);

                const i = (y * width + x) * 4;
                data[i] = 100 * intensity;     // R
                data[i + 1] = 50 * intensity;  // G
                data[i + 2] = 150 * intensity; // B
                data[i + 3] = intensity * 100; // A
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Regenerate nebula
     */
    regenerate() {
        // Clear existing
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            this.mesh.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        // Regenerate
        this.generate();
    }

    /**
     * Update nebula (subtle animation)
     */
    update(dt) {
        // Subtle drift animation could be added here
        // For performance, we keep it static
    }
}
