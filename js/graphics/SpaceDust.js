// =============================================
// SpaceDust - Ambient Space Environment
// Drifting particles, cosmic rays, and distant
// star clusters that bring the void to life.
// =============================================

import { CONFIG } from '../config.js';

// Sector color themes for ambient tinting
const SECTOR_THEMES = {
    'hub':      { dust: 0x4488cc, ray: 0x88ccff, hue: 0.58 },
    'sector-1': { dust: 0xcc8844, ray: 0xffaa66, hue: 0.08 },  // Mining - warm amber
    'sector-2': { dust: 0x44cc66, ray: 0x88ff99, hue: 0.35 },  // Agriculture - green
    'sector-3': { dust: 0x6644cc, ray: 0xaa88ff, hue: 0.72 },  // Frontier - purple
    'sector-4': { dust: 0xcc4444, ray: 0xff6666, hue: 0.0  },  // Dangerous - red
    'sector-5': { dust: 0xcc2244, ray: 0xff4466, hue: 0.95 },  // Null sec - crimson
    'sector-6': { dust: 0x44aacc, ray: 0x66ddff, hue: 0.52 },  // Research - cyan
};

export class SpaceDust {
    constructor(game) {
        this.game = game;
        this.mesh = new THREE.Group();
        this._time = 0;

        // Space dust particles (close, move with parallax)
        this.dustParticles = null;
        this.dustCount = 300;
        this.dustPositions = null;
        this.dustVelocities = [];
        this.dustOpacities = null;

        // Cosmic ray streaks
        this.cosmicRays = [];
        this.rayTimer = 0;
        this.rayInterval = 3 + Math.random() * 5; // 3-8s between rays

        // Distant star clusters (bright background blobs)
        this.clusters = [];

        // Current sector theme
        this.theme = SECTOR_THEMES['hub'];

        this.createDust();
        this.createClusters();
    }

    /**
     * Create space dust particles
     */
    createDust() {
        const positions = [];
        const colors = [];
        const sizes = [];
        this.dustOpacities = [];

        for (let i = 0; i < this.dustCount; i++) {
            // Spread around a large area centered on origin (will offset by camera)
            const x = (Math.random() - 0.5) * 8000;
            const y = (Math.random() - 0.5) * 8000;
            positions.push(x, y, -30 - Math.random() * 10);

            // Warm white tones
            const b = 0.4 + Math.random() * 0.3;
            colors.push(b * 1.1, b * 1.05, b);

            sizes.push(1 + Math.random() * 2);

            // Random drift velocity
            this.dustVelocities.push({
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
            });
            this.dustOpacities.push(0.1 + Math.random() * 0.3);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.25,
            sizeAttenuation: false,
            depthWrite: false,
        });

        this.dustParticles = new THREE.Points(geometry, material);
        this.dustPositions = this.dustParticles.geometry.attributes.position;
        this.mesh.add(this.dustParticles);
    }

    /**
     * Create distant star cluster blobs (soft glowing patches)
     */
    createClusters() {
        const clusterCount = 5 + Math.floor(Math.random() * 4);

        for (let i = 0; i < clusterCount; i++) {
            const x = Math.random() * CONFIG.SECTOR_SIZE;
            const y = Math.random() * CONFIG.SECTOR_SIZE;
            const radius = 400 + Math.random() * 1200;

            // Core glow
            const coreGeo = new THREE.CircleGeometry(radius * 0.3, 16);
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xaaccff,
                transparent: true,
                opacity: 0.06 + Math.random() * 0.04,
                depthWrite: false,
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.set(x, y, -58);

            // Outer halo
            const haloGeo = new THREE.CircleGeometry(radius, 16);
            const haloMat = new THREE.MeshBasicMaterial({
                color: 0x6688bb,
                transparent: true,
                opacity: 0.02 + Math.random() * 0.02,
                depthWrite: false,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(x, y, -59);

            // Scattered stars within cluster
            const starCount = 8 + Math.floor(Math.random() * 12);
            const starPositions = [];
            const starColors = [];
            for (let s = 0; s < starCount; s++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius * 0.7;
                starPositions.push(
                    x + Math.cos(angle) * dist,
                    y + Math.sin(angle) * dist,
                    -57
                );
                const bright = 0.7 + Math.random() * 0.3;
                starColors.push(bright * 0.9, bright * 0.95, bright);
            }

            const starGeo = new THREE.BufferGeometry();
            starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
            starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
            const starMat = new THREE.PointsMaterial({
                size: 2.5,
                vertexColors: true,
                transparent: true,
                opacity: 0.5,
                sizeAttenuation: false,
                depthWrite: false,
            });
            const stars = new THREE.Points(starGeo, starMat);

            this.clusters.push({ core, halo, stars, baseOpacity: coreMat.opacity });
            this.mesh.add(core);
            this.mesh.add(halo);
            this.mesh.add(stars);
        }
    }

    /**
     * Set sector theme (called on sector change)
     */
    setSector(sectorId) {
        this.theme = SECTOR_THEMES[sectorId] || SECTOR_THEMES['hub'];

        // Tint cluster cores with sector color
        for (const cluster of this.clusters) {
            cluster.core.material.color.setHex(this.theme.dust);
        }
    }

    /**
     * Spawn a cosmic ray streak
     */
    spawnCosmicRay(camera) {
        if (!camera) return;

        const viewHeight = 1000000 / (this.game.camera?.zoom || 500);
        const viewWidth = viewHeight * (window.innerWidth / window.innerHeight);

        // Random edge position
        const angle = Math.random() * Math.PI * 2;
        const startX = camera.x + Math.cos(angle) * viewWidth * 0.6;
        const startY = camera.y + Math.sin(angle) * viewHeight * 0.6;

        // Direction roughly toward center with randomness
        const dirAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
        const speed = 2000 + Math.random() * 3000;
        const length = 100 + Math.random() * 300;

        // Create line geometry for the ray
        const points = [
            new THREE.Vector3(startX, startY, -25),
            new THREE.Vector3(
                startX + Math.cos(dirAngle) * length,
                startY + Math.sin(dirAngle) * length,
                -25
            ),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: this.theme.ray,
            transparent: true,
            opacity: 0.6 + Math.random() * 0.3,
            depthWrite: false,
        });

        const ray = new THREE.Line(geometry, material);
        this.mesh.add(ray);

        this.cosmicRays.push({
            mesh: ray,
            vx: Math.cos(dirAngle) * speed,
            vy: Math.sin(dirAngle) * speed,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.3,
            length,
        });
    }

    /**
     * Update ambient effects
     */
    update(dt, camera) {
        if (!camera) return;
        this._time += dt;

        // --- Space dust parallax + drift ---
        if (this.dustParticles && this.dustPositions) {
            // Position dust cloud centered on camera with slow parallax
            this.dustParticles.position.x = camera.x * 0.85;
            this.dustParticles.position.y = camera.y * 0.85;

            // Subtle drift animation on individual particles
            for (let i = 0; i < this.dustCount; i++) {
                let x = this.dustPositions.getX(i);
                let y = this.dustPositions.getY(i);

                x += this.dustVelocities[i].vx * dt;
                y += this.dustVelocities[i].vy * dt;

                // Wrap around
                if (x > 4000) x -= 8000;
                if (x < -4000) x += 8000;
                if (y > 4000) y -= 8000;
                if (y < -4000) y += 8000;

                this.dustPositions.setX(i, x);
                this.dustPositions.setY(i, y);
            }
            this.dustPositions.needsUpdate = true;

            // Dust opacity subtly pulses
            this.dustParticles.material.opacity = 0.2 + Math.sin(this._time * 0.3) * 0.05;
        }

        // --- Star cluster shimmer ---
        for (const cluster of this.clusters) {
            const shimmer = Math.sin(this._time * 0.5 + cluster.core.position.x * 0.001) * 0.02;
            cluster.core.material.opacity = cluster.baseOpacity + shimmer;
        }

        // --- Cosmic ray spawning ---
        this.rayTimer += dt;
        if (this.rayTimer >= this.rayInterval) {
            this.rayTimer = 0;
            this.rayInterval = 3 + Math.random() * 5;
            this.spawnCosmicRay(camera);
        }

        // --- Update cosmic rays ---
        for (let i = this.cosmicRays.length - 1; i >= 0; i--) {
            const ray = this.cosmicRays[i];
            ray.life += dt;

            if (ray.life >= ray.maxLife) {
                this.mesh.remove(ray.mesh);
                ray.mesh.geometry.dispose();
                ray.mesh.material.dispose();
                this.cosmicRays.splice(i, 1);
                continue;
            }

            // Move the ray
            const positions = ray.mesh.geometry.attributes.position;
            for (let p = 0; p < 2; p++) {
                positions.setX(p, positions.getX(p) + ray.vx * dt);
                positions.setY(p, positions.getY(p) + ray.vy * dt);
            }
            positions.needsUpdate = true;

            // Fade out
            const progress = ray.life / ray.maxLife;
            ray.mesh.material.opacity = (1 - progress * progress) * 0.7;
        }
    }

    /**
     * Regenerate for new sector
     */
    regenerate(sectorId) {
        // Clear old clusters
        for (const cluster of this.clusters) {
            this.mesh.remove(cluster.core);
            this.mesh.remove(cluster.halo);
            this.mesh.remove(cluster.stars);
            cluster.core.geometry.dispose();
            cluster.core.material.dispose();
            cluster.halo.geometry.dispose();
            cluster.halo.material.dispose();
            cluster.stars.geometry.dispose();
            cluster.stars.material.dispose();
        }
        this.clusters = [];

        // Clear cosmic rays
        for (const ray of this.cosmicRays) {
            this.mesh.remove(ray.mesh);
            ray.mesh.geometry.dispose();
            ray.mesh.material.dispose();
        }
        this.cosmicRays = [];

        // Recreate
        this.createClusters();
        this.setSector(sectorId);
    }
}
