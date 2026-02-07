// =============================================
// Player Ship Class
// The player-controlled spacecraft
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';

export class PlayerShip extends Ship {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Your Ship',
            color: CONFIG.COLORS.primary,
        });

        this.type = 'player';
        this.isPlayer = true;

        // Player-specific state
        this.warpDisrupted = false;
        this.inWarp = false;

        // Warnings state
        this.lowShieldWarned = false;
        this.lowCapacitorWarned = false;

        // Orbit visual effect state
        this.orbitPhase = 0;      // Current angle in orbit (radians, 0-2π)
        this.orbitTilt = 0.7;     // Tilt factor for ellipse perspective (0.7 = ~35° visual tilt)
    }

    /**
     * Update player ship
     */
    update(dt) {
        super.update(dt);

        // Update target from game state
        this.target = this.game.lockedTarget;

        // Check for warnings
        this.checkWarnings();
    }

    /**
     * Check for low resource warnings
     */
    checkWarnings() {
        // Low shield warning (below 25%)
        if (this.shield < this.maxShield * 0.25) {
            if (!this.lowShieldWarned) {
                this.game.audio?.play('shield-low');
                this.game.ui?.log('Warning: Shields critical!', 'combat');
                this.game.ui?.toast('Shields critical!', 'error');
                this.lowShieldWarned = true;
            }
        } else {
            this.lowShieldWarned = false;
        }

        // Low capacitor warning (below 20%)
        if (this.capacitor < this.maxCapacitor * 0.2) {
            if (!this.lowCapacitorWarned) {
                this.game.audio?.play('capacitor-low');
                this.game.ui?.log('Warning: Capacitor low!', 'system');
                this.lowCapacitorWarned = true;
            }
        } else {
            this.lowCapacitorWarned = false;
        }
    }

    /**
     * Override destroy for player death handling
     */
    destroy() {
        super.destroy();
        this.game.events.emit('player:death');
    }

    /**
     * Calculate scale and z-offset based on orbit phase for 3D illusion
     * Returns { scale, zOffset } where:
     * - scale: 0.8 (behind target) to 1.2 (in front of target)
     * - zOffset: negative (behind) to positive (in front)
     */
    calculateOrbitVisuals() {
        // Map orbit phase to depth using cosine
        // Phase 0 = right side (neutral), π/2 = top (front), π = left (neutral), 3π/2 = bottom (back)
        // We use sin(phase) so that top of orbit = front, bottom = back
        const depthFactor = Math.sin(this.orbitPhase);

        // Scale: 0.8 at back, 1.0 at sides, 1.2 at front
        // depthFactor ranges from -1 (back) to +1 (front)
        const scale = 1.0 + depthFactor * 0.2;

        // Z-offset: lower when behind target, higher when in front
        // Range from -0.5 to +0.5 (relative to base z of 1)
        const zOffset = depthFactor * 0.5;

        return { scale, zOffset };
    }

    /**
     * Create player ship mesh with extra visual flair
     */
    createMesh() {
        const group = new THREE.Group();

        // Main hull
        const hullShape = new THREE.Shape();
        const size = this.radius;

        hullShape.moveTo(size * 1.2, 0);
        hullShape.lineTo(-size * 0.6, size * 0.6);
        hullShape.lineTo(-size * 0.3, 0);
        hullShape.lineTo(-size * 0.6, -size * 0.6);
        hullShape.closePath();

        const hullGeometry = new THREE.ShapeGeometry(hullShape);
        const hullMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.9,
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        group.add(hull);

        // Cockpit
        const cockpitGeometry = new THREE.CircleGeometry(size * 0.25, 8);
        const cockpitMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(size * 0.2, 0, 0.1);
        group.add(cockpit);

        // Engine glow
        const engineGeometry = new THREE.CircleGeometry(size * 0.2, 8);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
        });
        const engine1 = new THREE.Mesh(engineGeometry, engineMaterial);
        engine1.position.set(-size * 0.5, size * 0.3, 0);
        group.add(engine1);

        const engine2 = engine1.clone();
        engine2.position.set(-size * 0.5, -size * 0.3, 0);
        group.add(engine2);

        // Wing details
        const wingGeometry = new THREE.PlaneGeometry(size * 0.1, size * 0.4);
        const wingMaterial = new THREE.MeshBasicMaterial({
            color: 0x0066aa,
            transparent: true,
            opacity: 0.7,
        });
        const wing1 = new THREE.Mesh(wingGeometry, wingMaterial);
        wing1.position.set(-size * 0.2, size * 0.5, 0);
        wing1.rotation.z = 0.3;
        group.add(wing1);

        const wing2 = wing1.clone();
        wing2.position.set(-size * 0.2, -size * 0.5, 0);
        wing2.rotation.z = -0.3;
        group.add(wing2);

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 1); // Higher z for player
        this.mesh.rotation.z = this.rotation;

        // Store engine meshes for animation
        this.engineMeshes = [engine1, engine2];

        return this.mesh;
    }

    /**
     * Update mesh with engine effects and orbit visual transformation
     */
    updateMesh() {
        if (this.mesh) {
            // Check if currently orbiting
            const isOrbiting = this.game.autopilot?.command === 'orbit' &&
                              this.game.autopilot?.target?.alive;

            if (isOrbiting) {
                // Apply 3D orbit visual effect
                const { scale, zOffset } = this.calculateOrbitVisuals();
                this.mesh.scale.setScalar(scale);
                this.mesh.position.set(this.x, this.y, 1 + zOffset);
            } else {
                // Normal rendering - reset any orbit effects
                this.mesh.scale.setScalar(1.0);
                this.mesh.position.set(this.x, this.y, 1);
                // Note: orbitPhase is reset in AutopilotSystem.stop() and orbit()
            }

            this.mesh.rotation.z = this.rotation;
            this.mesh.visible = this.visible && this.alive;

            // Animate engine glow based on speed
            if (this.engineMeshes) {
                const intensity = 0.3 + (this.currentSpeed / this.maxSpeed) * 0.7;
                for (const engine of this.engineMeshes) {
                    engine.material.opacity = intensity;
                    engine.scale.setScalar(0.8 + (this.currentSpeed / this.maxSpeed) * 0.4);
                }
            }
        }
    }

    /**
     * Get all fitted modules for UI
     */
    getFittedModules() {
        const fitted = [];

        for (let i = 0; i < this.highSlots; i++) {
            const moduleId = this.modules.high[i];
            fitted.push({
                slotId: `high-${i + 1}`,
                slotType: 'high',
                moduleId,
                config: moduleId ? CONFIG.MODULES[moduleId] : null,
                active: this.activeModules.has(`high-${i + 1}`),
                cooldown: this.moduleCooldowns.get(`high-${i + 1}`) || 0,
            });
        }

        for (let i = 0; i < this.midSlots; i++) {
            const moduleId = this.modules.mid[i];
            fitted.push({
                slotId: `mid-${i + 1}`,
                slotType: 'mid',
                moduleId,
                config: moduleId ? CONFIG.MODULES[moduleId] : null,
                active: this.activeModules.has(`mid-${i + 1}`),
                cooldown: this.moduleCooldowns.get(`mid-${i + 1}`) || 0,
            });
        }

        for (let i = 0; i < this.lowSlots; i++) {
            const moduleId = this.modules.low[i];
            fitted.push({
                slotId: `low-${i + 1}`,
                slotType: 'low',
                moduleId,
                config: moduleId ? CONFIG.MODULES[moduleId] : null,
                active: this.activeModules.has(`low-${i + 1}`),
                cooldown: this.moduleCooldowns.get(`low-${i + 1}`) || 0,
            });
        }

        return fitted;
    }
}
