// =============================================
// StarField
// Procedural background stars with parallax
// =============================================

import { CONFIG } from '../config.js';
import { SeededRandom } from '../utils/random.js';

export class StarField {
    constructor(game) {
        this.game = game;
        this.mesh = new THREE.Group();

        // Star layers for parallax effect
        this.layers = [];
        this.layerCount = 3;

        this.generate();
    }

    /**
     * Generate starfield layers
     */
    generate() {
        const random = new SeededRandom(42);

        for (let layer = 0; layer < this.layerCount; layer++) {
            const layerGroup = new THREE.Group();
            const starCount = Math.floor(CONFIG.STAR_COUNT / (layer + 1));
            const depth = layer * 0.3; // Parallax factor

            // Create star geometry
            const positions = [];
            const colors = [];
            const sizes = [];

            for (let i = 0; i < starCount; i++) {
                // Position - spread across larger area for seamless scrolling
                const x = random.float(-CONFIG.SECTOR_SIZE * 2, CONFIG.SECTOR_SIZE * 3);
                const y = random.float(-CONFIG.SECTOR_SIZE * 2, CONFIG.SECTOR_SIZE * 3);
                positions.push(x, y, -50 - layer * 10);

                // Color - white with slight variation
                const brightness = random.float(0.5, 1.0);
                const tint = random.float(0.9, 1.1);
                colors.push(brightness * tint, brightness, brightness);

                // Size - back layers have smaller stars
                sizes.push(random.float(1, 3) / (layer + 1));
            }

            // Create buffer geometry
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

            // Create points material
            const material = new THREE.PointsMaterial({
                size: 2,
                vertexColors: true,
                transparent: true,
                opacity: 0.8 - layer * 0.2,
                sizeAttenuation: false,
            });

            const stars = new THREE.Points(geometry, material);
            layerGroup.add(stars);

            // Add some brighter stars with glow
            if (layer === 0) {
                const brightCount = 20;
                for (let i = 0; i < brightCount; i++) {
                    const x = random.float(0, CONFIG.SECTOR_SIZE);
                    const y = random.float(0, CONFIG.SECTOR_SIZE);

                    const glowGeometry = new THREE.CircleGeometry(random.float(3, 8), 8);
                    const glowMaterial = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: random.float(0.3, 0.6),
                    });
                    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
                    glow.position.set(x, y, -45);
                    layerGroup.add(glow);
                }
            }

            this.layers.push({
                group: layerGroup,
                parallax: depth,
                stars: stars,
            });

            this.mesh.add(layerGroup);
        }
    }

    /**
     * Update starfield parallax based on camera position
     */
    update(camera) {
        if (!camera) return;

        for (const layer of this.layers) {
            // Apply parallax offset
            layer.group.position.x = -camera.x * layer.parallax;
            layer.group.position.y = -camera.y * layer.parallax;

            // Twinkle effect for front layer
            if (layer.parallax === 0 && layer.stars) {
                const time = Date.now() * 0.001;
                layer.stars.material.opacity = 0.7 + Math.sin(time) * 0.1;
            }
        }
    }

    /**
     * Regenerate stars for new sector
     */
    regenerate(seed) {
        // Clear existing
        while (this.mesh.children.length > 0) {
            this.mesh.remove(this.mesh.children[0]);
        }
        this.layers = [];

        // Regenerate with new seed
        this.generate();
    }
}
