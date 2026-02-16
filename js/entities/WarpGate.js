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
            name: options.name || 'Elder Wormhole',
            radius: options.radius || 100,
            color: options.color || CONFIG.COLORS.warp,
        });

        this.type = 'gate';

        // Destination
        this.destinationSectorId = options.destinationSectorId || null;
        this.destinationName = options.destinationName || 'Unknown';

        // Wormhole gates have distinct visuals
        this.isWormhole = options.isWormhole || false;

        // Secret elder wormholes (Skippy-only shortcuts)
        this.secret = options.secret || false;

        // Gate properties
        this.activationRange = 150;
        this.warpMinRange = 100; // Minimum distance to warp to

        // Animation
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.rotationSpeed = this.isWormhole ? 0.5 : 0.3;
        this.activationLevel = 0; // 0 = idle, 1 = fully activated
        this.wasActivated = false;
        this.wobbleTime = 0;
    }

    /**
     * Update gate
     */
    update(dt) {
        super.update(dt);

        // Check player proximity for activation ramp
        const player = this.game.player;
        if (player?.alive) {
            const dist = this.distanceTo(player);
            const activationOuter = this.activationRange * 3; // Start activating at 3x range
            if (dist < activationOuter) {
                const targetLevel = Math.min(1, Math.max(0, 1 - (dist - this.activationRange) / (activationOuter - this.activationRange)));
                this.activationLevel += (targetLevel - this.activationLevel) * dt * 3;

                // Play activation sound on threshold
                if (this.activationLevel > 0.8 && !this.wasActivated) {
                    this.wasActivated = true;
                    if (player.isPlayer) this.game.audio?.play('scan-complete');
                }
            } else {
                this.activationLevel *= (1 - dt * 2);
                this.wasActivated = false;
            }
        }

        // Scale rotation speed with activation
        const speedMult = 1 + this.activationLevel * 4;
        this.rotation += this.rotationSpeed * speedMult * dt;
        this.pulsePhase += dt * (2 + this.activationLevel * 6);
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
            this.game.ui?.log('Elder Wormhole destination unknown', 'system');
            return false;
        }

        if (!this.canUse(entity)) {
            this.game.ui?.log('Too far from Elder Wormhole', 'system');
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

        // Color scheme: gold for secret, purple for wormholes, blue for normal
        const energyColor = this.secret ? 0xFFB020 : (this.isWormhole ? 0x8844ff : 0x4488ff);
        const portalColor = this.secret ? 0xCC8800 : (this.isWormhole ? 0x4422aa : 0x2244aa);
        const glowColor = this.secret ? 0xFFD040 : (this.isWormhole ? 0xaa66ff : 0x88aaff);

        // Inner energy ring
        const innerRingGeometry = new THREE.RingGeometry(
            this.radius * 0.7,
            this.radius * 0.85,
            32
        );
        const innerRingMaterial = new THREE.MeshBasicMaterial({
            color: energyColor,
            transparent: true,
            opacity: 0.7,
        });
        const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
        innerRing.position.z = 0.1;
        group.add(innerRing);

        // Gate portal (swirling center)
        const portalGeometry = new THREE.CircleGeometry(this.radius * 0.65, 32);
        const portalMaterial = new THREE.MeshBasicMaterial({
            color: portalColor,
            transparent: true,
            opacity: 0.5,
        });
        const portal = new THREE.Mesh(portalGeometry, portalMaterial);
        portal.position.z = 0.05;
        group.add(portal);

        // Swirl overlay for portal animation
        const swirlGeometry = new THREE.RingGeometry(this.radius * 0.15, this.radius * 0.55, 32, 1, 0, Math.PI * 1.2);
        const swirlMaterial = new THREE.MeshBasicMaterial({
            color: energyColor,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
        });
        const swirl = new THREE.Mesh(swirlGeometry, swirlMaterial);
        swirl.position.z = 0.08;
        group.add(swirl);

        // Second counter-rotating swirl for wormholes
        if (this.isWormhole) {
            const swirl2Geo = new THREE.RingGeometry(this.radius * 0.25, this.radius * 0.6, 32, 1, 0, Math.PI * 0.8);
            const swirl2Mat = new THREE.MeshBasicMaterial({
                color: 0xcc88ff,
                transparent: true,
                opacity: 0.2,
                side: THREE.DoubleSide,
            });
            this.swirl2 = new THREE.Mesh(swirl2Geo, swirl2Mat);
            this.swirl2.position.z = 0.09;
            group.add(this.swirl2);
        }

        // Central glow
        const glowGeometry = new THREE.CircleGeometry(this.radius * 0.3, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: glowColor,
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
                color: glowColor,
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

            const act = this.activationLevel;
            const isWH = this.isWormhole;

            // Wormhole wobble - unstable spatial distortion
            if (isWH) {
                this.wobbleTime += 0.016;
                const wobbleX = Math.sin(this.wobbleTime * 1.7) * 0.03;
                const wobbleY = Math.cos(this.wobbleTime * 2.3) * 0.03;
                this.mesh.scale.set(1 + wobbleX, 1 + wobbleY, 1);
            }

            // Pulse the inner ring - brighter when activated
            if (this.innerRing) {
                const basePulse = 0.5 + Math.sin(this.pulsePhase) * 0.3;
                this.innerRing.material.opacity = basePulse + act * 0.4;
                if (isWH) {
                    this.innerRing.material.color.setHex(act > 0.5 ? 0xaa66ff : 0x8844ff);
                } else {
                    this.innerRing.material.color.setHex(act > 0.5 ? 0x66bbff : 0x4488ff);
                }
            }

            // Pulse the glow - bigger and brighter when activated
            if (this.glow) {
                const pulse = 0.6 + Math.sin(this.pulsePhase * 1.5) * 0.3;
                this.glow.material.opacity = pulse + act * 0.3;
                const glowScale = 0.9 + Math.sin(this.pulsePhase) * 0.1 + act * 0.4;
                this.glow.scale.setScalar(isWH ? glowScale * (1 + Math.sin(this.wobbleTime * 3.1) * 0.08) : glowScale);
            }

            // Rotate the swirl overlay - faster when activated
            if (this.swirl) {
                this.swirl.rotation.z += 0.02 + act * 0.06;
                this.swirl.material.opacity = 0.2 + Math.sin(this.pulsePhase * 0.8) * 0.15 + act * 0.3;
            }

            // Counter-rotating swirl for wormholes
            if (this.swirl2) {
                this.swirl2.rotation.z -= 0.015 + act * 0.04;
                this.swirl2.material.opacity = 0.15 + Math.sin(this.pulsePhase * 1.2 + 1) * 0.1 + act * 0.2;
            }
        }
    }
}
