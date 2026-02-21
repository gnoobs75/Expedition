// =============================================
// Player Ship Class
// The player-controlled spacecraft
// =============================================

import { Ship } from './Ship.js';
import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';

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

        // Module inventory (purchased but not fitted)
        this.moduleInventory = [];

        // Weapon groups (1-3): maps group number to array of slotIds
        this.weaponGroups = { 1: [], 2: [], 3: [] };

        // Hero ship name (persisted)
        this.heroName = options.heroName || options.name || 'Your Ship';

        // Model ID override for GLB loading (separate from shipClass for hull tier compat)
        this.modelId = options.modelId || null;

        // Component upgrade levels (0 = base, up to 3)
        this.componentLevels = options.componentLevels || {
            reactor: 0,
            engines: 0,
            sensors: 0,
            plating: 0,
        };

        // Paint scheme customization
        this.paintScheme = options.paintScheme || null; // null = default role palette

        // Decals on ship hull
        this.decals = options.decals || []; // [{id, position}]

        // Orbit visual effect state
        this.orbitPhase = 0;      // Current angle in orbit (radians, 0-2π)
        this.orbitTilt = 0.7;     // Tilt factor for ellipse perspective (0.7 = ~35° visual tilt)
    }

    /**
     * Update player ship
     */
    update(dt) {
        super.update(dt);

        // Update target from game state (active locked target)
        this.target = this.game.activeLockedTarget || this.game.lockedTargets?.[0] || this.game.lockedTarget;

        // Sync EWAR state for AutopilotSystem compatibility
        this.warpDisrupted = this.isPointed;

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
        // Create procedural mesh immediately (shown until GLB loads)
        const group = this.createProceduralMesh();

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 1);
        this.mesh.rotation.z = this.rotation;

        // Add shield overlay mesh
        const shieldGeo = new THREE.CircleGeometry(this.radius * 1.5, 32);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
        });
        this.shieldOverlay = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldOverlay.position.z = 2;
        this.mesh.add(this.shieldOverlay);

        // Add weapon turrets
        this.addTurretHardpoints();

        // Try loading GLB model async - swap in when ready
        this.loadGLBMesh();

        return this.mesh;
    }

    /**
     * Rebuild the ship mesh in-place (for customization changes like paint/decals)
     */
    rebuildMesh() {
        if (!this.mesh) return;

        // Save position/rotation
        const pos = this.mesh.position.clone();
        const rot = this.mesh.rotation.z;

        // Dispose all children
        while (this.mesh.children.length > 0) {
            const child = this.mesh.children[0];
            this.mesh.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }

        // Rebuild procedural mesh contents
        const newMesh = this.createProceduralMesh();
        // Transfer children from new mesh into existing mesh group
        while (newMesh.children.length > 0) {
            this.mesh.add(newMesh.children[0]);
        }

        // Re-add shield overlay
        const shieldGeo = new THREE.CircleGeometry(this.radius * 1.5, 32);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
        });
        this.shieldOverlay = new THREE.Mesh(shieldGeo, shieldMat);
        this.shieldOverlay.position.z = 2;
        this.mesh.add(this.shieldOverlay);

        // Re-add turrets
        this.addTurretHardpoints();

        // Restore position/rotation
        this.mesh.position.copy(pos);
        this.mesh.rotation.z = rot;

        // Try GLB async
        this.glbLoaded = false;
        this.loadGLBMesh();
    }

    /**
     * Create the procedural fallback mesh using ShipMeshFactory
     */
    createProceduralMesh() {
        const shipId = this.shipClass || 'frigate';
        const dbConfig = SHIP_DATABASE[shipId];

        if (dbConfig) {
            try {
                const mesh = shipMeshFactory.generateShipMesh({
                    shipId,
                    role: dbConfig.role || 'mercenary',
                    size: dbConfig.size || 'frigate',
                    detailLevel: 'low',
                    paintScheme: this.paintScheme || null,
                    decals: this.decals || [],
                });
                this.engineMeshes = null;
                return mesh;
            } catch (e) {
                // Fall through to simple fallback
            }
        }

        // Simple fallback for unknown ship classes
        const group = new THREE.Group();
        const size = this.radius;

        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 1.2, 0);
        hullShape.lineTo(-size * 0.6, size * 0.6);
        hullShape.lineTo(-size * 0.3, 0);
        hullShape.lineTo(-size * 0.6, -size * 0.6);
        hullShape.closePath();

        const geo = new THREE.ExtrudeGeometry(hullShape, { depth: Math.min(size * 0.1, 6), bevelEnabled: true, bevelThickness: Math.min(size * 0.02, 1.5), bevelSize: Math.min(size * 0.015, 1), bevelSegments: 1 });
        geo.center();
        const mat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 0.15, transparent: true, opacity: 0.9, roughness: 0.5, metalness: 0.3 });
        group.add(new THREE.Mesh(geo, mat));
        this.engineMeshes = null;
        return group;
    }

    /**
     * Load GLB model and swap into the scene when ready
     */
    loadGLBMesh() {
        const shipId = this.modelId || this.shipClass || 'frigate';

        shipMeshFactory.loadModel(shipId, this.radius * 2.5).then(glbGroup => {
            if (!glbGroup || !this.alive) return;

            // Replace mesh contents - keep the same group reference
            // so the renderer doesn't lose track
            if (this.mesh) {
                // Remove all procedural children
                while (this.mesh.children.length > 0) {
                    const child = this.mesh.children[0];
                    this.mesh.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }

                // Add GLB group as child (preserves its centering position + scale)
                this.mesh.add(glbGroup);

                // Reset outer mesh scale - GLB group handles its own scale
                this.mesh.scale.set(1, 1, 1);

                // Clear engine meshes since GLB doesn't have them
                this.engineMeshes = null;
                this.glbLoaded = true;
            }
        });
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
                if (!this.glbLoaded) this.mesh.scale.setScalar(scale);
                this.mesh.position.set(this.x, this.y, 1 + zOffset);
            } else {
                // Normal rendering - reset any orbit effects
                if (!this.glbLoaded) this.mesh.scale.setScalar(1.0);
                this.mesh.position.set(this.x, this.y, 1);
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

            this.updateDamageVisuals();
        }
    }

    /**
     * Auto-assign all high-slot weapons to weapon group 1
     */
    autoAssignWeaponGroups() {
        this.weaponGroups = { 1: [], 2: [], 3: [] };
        for (let i = 0; i < this.highSlots; i++) {
            if (this.modules.high[i]) {
                this.weaponGroups[1].push(`high-${i + 1}`);
            }
        }
    }

    /**
     * Assign a slot to a weapon group (toggles)
     */
    assignToWeaponGroup(groupNum, slotId) {
        if (groupNum < 1 || groupNum > 3) return;
        const group = this.weaponGroups[groupNum];
        const idx = group.indexOf(slotId);
        if (idx >= 0) {
            group.splice(idx, 1);
        } else {
            group.push(slotId);
        }
    }

    /**
     * Switch to a new ship class
     */
    switchShip(newShipClass) {
        const shipConfig = SHIP_DATABASE[newShipClass] || CONFIG.SHIPS[newShipClass];
        if (!shipConfig) return;

        this.shipClass = newShipClass;

        // Update stats from config
        this.maxSpeed = shipConfig.maxSpeed;
        this.acceleration = shipConfig.acceleration;
        this.turnSpeed = shipConfig.turnSpeed || 2;
        this.maxShield = shipConfig.shield;
        this.maxArmor = shipConfig.armor;
        this.maxHull = shipConfig.hull;
        this.maxCapacitor = shipConfig.capacitor;
        this.capacitorRegen = shipConfig.capacitorRegen;
        this.signatureRadius = shipConfig.signatureRadius || 30;
        this.cargoCapacity = shipConfig.cargoCapacity;

        // Snapshot base stats for component upgrades (prevents multiplicative compounding)
        this._baseStats = {
            maxSpeed: this.maxSpeed,
            maxHull: this.maxHull,
            capacitorRegen: this.capacitorRegen,
        };

        // Update slot counts
        this.highSlots = shipConfig.weaponSlots || shipConfig.highSlots || 3;
        this.midSlots = shipConfig.moduleSlots || shipConfig.midSlots || 2;
        this.lowSlots = shipConfig.subsystemSlots || shipConfig.lowSlots || 2;

        // Restore to full health
        this.shield = this.maxShield;
        this.armor = this.maxArmor;
        this.hull = this.maxHull;
        this.capacitor = this.maxCapacitor;

        // Clear fitted modules
        this.modules = {
            high: new Array(this.highSlots).fill(null),
            mid: new Array(this.midSlots).fill(null),
            low: new Array(this.lowSlots).fill(null),
        };
        this.activeModules = new Set();

        // Update drone bay
        if (shipConfig.droneCapacity) {
            this.droneBay = {
                capacity: shipConfig.droneCapacity,
                bandwidth: shipConfig.droneBandwidth || 0,
                drones: [],
                deployed: new Map(),
            };
            // Populate with mining drones (same as Ship constructor)
            for (let i = 0; i < shipConfig.droneCapacity; i++) {
                this.droneBay.drones.push({
                    type: 'mining-drone',
                    hp: CONFIG.DRONES['mining-drone']?.hp || 50,
                });
            }
        } else {
            this.droneBay = { capacity: 0, bandwidth: 0, drones: [], deployed: new Map() };
        }

        // Reset GLB state before recreating mesh
        this.glbLoaded = false;
        this.engineMeshes = null;

        // Recreate mesh
        if (this.mesh && this.game.renderer) {
            this.game.renderer.scene.remove(this.mesh);
            this.mesh = this.createMesh();
            this.game.renderer.scene.add(this.mesh);
        }

        // Apply component upgrades on top of base stats
        this.applyComponentUpgrades();

        // Preserve hero name
        this.name = this.heroName || shipConfig.name;

        this.game.ui?.log(`Upgraded to ${shipConfig.name}`, 'system');
        this.game.events.emit('ship:switched', { ship: this, shipClass: newShipClass });
    }

    /**
     * Apply component upgrade bonuses to current ship stats
     */
    applyComponentUpgrades() {
        let upgrades;
        try {
            upgrades = CONFIG.COMPONENT_UPGRADES;
        } catch {
            return;
        }
        if (!upgrades || !this.componentLevels) return;

        // Store base stats if not yet captured (e.g. called from loadFromSave before switchShip)
        if (!this._baseStats) {
            this._baseStats = {
                maxSpeed: this.maxSpeed,
                maxHull: this.maxHull,
                capacitorRegen: this.capacitorRegen,
            };
        }

        // Always recompute from base stats to prevent multiplicative compounding
        this.maxSpeed = this._baseStats.maxSpeed;
        this.maxHull = this._baseStats.maxHull;
        this.capacitorRegen = this._baseStats.capacitorRegen;

        for (const [comp, def] of Object.entries(upgrades)) {
            const level = this.componentLevels[comp] || 0;
            if (level <= 0) continue;
            const multiplier = def.levels[level] || 1.0;

            switch (def.stat) {
                case 'capacitorRegen':
                    this.capacitorRegen *= multiplier;
                    break;
                case 'maxSpeed':
                    this.maxSpeed *= multiplier;
                    break;
                case 'hullBonus':
                    this.maxHull *= multiplier;
                    this.hull = this.maxHull;
                    break;
                // lockTimeBonus is applied in Game.getMaxLockTargets/lockTarget
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
                config: moduleId ? (EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId]) : null,
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
                config: moduleId ? (EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId]) : null,
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
                config: moduleId ? (EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId]) : null,
                active: this.activeModules.has(`low-${i + 1}`),
                cooldown: this.moduleCooldowns.get(`low-${i + 1}`) || 0,
            });
        }

        return fitted;
    }
}
