// =============================================
// Warp Gate Class
// Portal to other sectors
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

export class WarpGate extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Warp Gate',
            radius: options.radius || 100,
            color: CONFIG.COLORS.warp,
        });

        this.type = 'gate';

        // Destination
        this.destinationSectorId = options.destinationSectorId || null;
        this.destinationName = options.destinationName || 'Unknown';

        // Gate properties
        this.activationRange = 150;
        this.warpMinRange = 100; // Minimum distance to warp to

        // Animation
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.rotationSpeed = 0.3;
    }

    /**
     * Update gate
     */
    update(dt) {
        super.update(dt);
        this.rotation += this.rotationSpeed * dt;
        this.pulsePhase += dt * 2;
    }

    /**
     * Check if entity can use this gate
     */
    canUse(entity) {
        const dist = this.distanceTo(entity);
        return dist <= this.activationRange;
    }

    /**
     * Use the gate to warp to destination sector
     */
    use(entity) {
        if (!this.destinationSectorId) {
            this.game.ui?.log('Gate destination unknown', 'system');
            return false;
        }

        if (!this.canUse(entity)) {
            this.game.ui?.log('Too far from gate', 'system');
            return false;
        }

        // Trigger sector change
        this.game.autopilot.jumpGate(this);
        return true;
    }

    /**
     * Create gate mesh
     */
    createMesh() {
        const group = new THREE.Group();

        // Outer ring structure - extruded for 3D depth
        const ringShape = new THREE.Shape();
        const ringOuter = this.radius;
        const ringInner = this.radius * 0.9;
        ringShape.absarc(0, 0, ringOuter, 0, Math.PI * 2, false);
        const ringHole = new THREE.Path();
        ringHole.absarc(0, 0, ringInner, 0, Math.PI * 2, true);
        ringShape.holes.push(ringHole);
        const outerRingGeometry = new THREE.ExtrudeGeometry(ringShape, {
            depth: Math.min(this.radius * 0.06, 6),
            bevelEnabled: false,
        });
        outerRingGeometry.center();
        const outerRingMaterial = new THREE.MeshStandardMaterial({
            color: 0x445566,
            emissive: 0x445566,
            emissiveIntensity: 0.1,
            roughness: 0.4,
            metalness: 0.6,
        });
        const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
        group.add(outerRing);

        // Inner energy ring
        const innerRingGeometry = new THREE.RingGeometry(
            this.radius * 0.7,
            this.radius * 0.85,
            32
        );
        const innerRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.7,
        });
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        innerRing.position.z = 0.1;
        group.add(innerRing);

        // Gate portal (swirling center)
        const portalGeometry = new THREE.CircleGeometry(this.radius * 0.65, 32);
        const portalMaterial = new THREE.MeshBasicMaterial({
            color: 0x2244aa,
            transparent: true,
            opacity: 0.5,
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        portal.position.z = 0.05;
        group.add(portal);

        // Swirl overlay for portal animation
        const swirlGeometry = new THREE.RingGeometry(this.radius * 0.15, this.radius * 0.55, 32, 1, 0, Math.PI * 1.2);
        const swirlMaterial = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
        });
        const swirl = new THREE.Mesh(swirlGeometry, swirlMaterial);
        swirl.position.z = 0.08;
        group.add(swirl);

        // Central glow
        const glowGeometry = new THREE.CircleGeometry(this.radius * 0.3, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x88aaff,
            transparent: true,
            opacity: 0.8,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = 0.15;
        group.add(glow);

        // Chevrons (decorative)
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const chevronGeometry = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                0, 0, 0,
                -8, -15, 0,
                8, -15, 0,
            ]);
            chevronGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            const chevronMaterial = new THREE.MeshBasicMaterial({
                color: 0x88aaff,
                transparent: true,
                opacity: 0.8,
            });
            const chevron = new THREE.Mesh(chevronGeometry, chevronMaterial);
            chevron.position.set(
                Math.cos(angle) * this.radius * 0.95,
                Math.sin(angle) * this.radius * 0.95,
                0.2
            );
            chevron.rotation.z = angle - Math.PI / 2;
            group.add(chevron);
        }

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);

        // Store for animation
        this.innerRing = innerRing;
        this.glow = glow;
        this.swirl = swirl;

        return this.mesh;
    }

    /**
     * Update mesh with animation
     */
    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 0);
            this.mesh.rotation.z = this.rotation;
            this.mesh.visible = this.visible && this.alive;

            // Pulse the inner ring
            if (this.innerRing) {
                const pulse = 0.5 + Math.sin(this.pulsePhase) * 0.3;
                this.innerRing.material.opacity = pulse;
            }

            // Pulse the glow
            if (this.glow) {
                const pulse = 0.6 + Math.sin(this.pulsePhase * 1.5) * 0.3;
                this.glow.material.opacity = pulse;
                this.glow.scale.setScalar(0.9 + Math.sin(this.pulsePhase) * 0.1);
            }

            // Rotate the swirl overlay
            if (this.swirl) {
                this.swirl.rotation.z += 0.02;
                this.swirl.material.opacity = 0.2 + Math.sin(this.pulsePhase * 0.8) * 0.15;
            }
        }
    }
}
