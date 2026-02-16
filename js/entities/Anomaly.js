// =============================================
// Anomaly Class
// Scannable space anomalies: wormholes, combat sites, data sites
// =============================================

import { Entity } from './Entity.js';
import { CONFIG, UNIVERSE_LAYOUT_MAP } from '../config.js';

// Anomaly templates
const ANOMALY_TYPES = {
    wormhole: {
        name: 'Unstable Wormhole',
        radius: 80,
        color: 0x8844ff,
        scanDifficulty: 0.3,
        lifetime: [180, 360], // 3-6 minutes
        description: 'An unstable tear in spacetime leading to another sector',
    },
    combatSite: {
        name: 'Combat Signal',
        radius: 40,
        color: 0xff4422,
        scanDifficulty: 0.5,
        lifetime: [240, 480], // 4-8 minutes
        description: 'Hostile signatures detected - possible pirate hideout',
    },
    dataSite: {
        name: 'Data Beacon',
        radius: 35,
        color: 0x44ddff,
        scanDifficulty: 0.7,
        lifetime: [300, 600], // 5-10 minutes
        description: 'Encrypted data signals from an abandoned relay',
    },
    gasPocket: {
        name: 'Gas Cloud',
        radius: 60,
        color: 0x44ff88,
        scanDifficulty: 0.4,
        lifetime: [360, 600], // 6-10 minutes
        description: 'A concentrated pocket of harvestable gas',
    },
};

export { ANOMALY_TYPES };

export class Anomaly extends Entity {
    constructor(game, options = {}) {
        const template = ANOMALY_TYPES[options.anomalyType] || ANOMALY_TYPES.combatSite;

        super(game, {
            ...options,
            name: options.name || template.name,
            radius: template.radius,
            color: template.color,
        });

        this.type = 'anomaly';
        this.anomalyType = options.anomalyType || 'combatSite';
        this.template = template;
        this.hostility = 'neutral';

        // Scan state - anomalies must be scanned to reveal
        this.scanStrength = 0; // 0-1, reaches 1.0 = fully scanned
        this.scanDifficulty = template.scanDifficulty;
        this.scanned = false; // Becomes true when fully scanned
        this.scanLocked = false; // True while actively being scanned

        // Lifetime - anomalies despawn after a while
        const [minLife, maxLife] = template.lifetime;
        this.lifetime = minLife + Math.random() * (maxLife - minLife);
        this.age = 0;

        // Wormhole specifics
        if (this.anomalyType === 'wormhole') {
            this.destinationSectorId = options.destinationSectorId || null;
            this.activationRange = 120;
            this.wormholeStability = 1.0; // Decreases with use
        }

        // Combat site specifics
        if (this.anomalyType === 'combatSite') {
            this.cleared = false;
            this.enemyCount = options.enemyCount || 3;
            this.enemyTier = options.enemyTier || 'normal';
            this.lootCredits = options.lootCredits || 500 + Math.random() * 1500;
            this.activated = false;
        }

        // Data site specifics
        if (this.anomalyType === 'dataSite') {
            this.dataCredits = options.dataCredits || 800 + Math.random() * 2000;
            this.hackDifficulty = options.hackDifficulty || 0.5;
            this.hacked = false;
            this.hackProgress = 0;
            this.hackRange = 200;
        }

        // Gas pocket specifics
        if (this.anomalyType === 'gasPocket') {
            this.gasType = options.gasType || 'fullerite';
            this.gasAmount = options.gasAmount || 50 + Math.random() * 100;
        }

        // Visual animation
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.rotationSpeed = 0.15 + Math.random() * 0.1;
        this.description = template.description;
    }

    update(dt) {
        super.update(dt);

        this.age += dt;
        this.pulsePhase += dt * 2;
        this.rotation += this.rotationSpeed * dt;

        // Despawn check
        if (this.age >= this.lifetime) {
            this.destroy();
            return;
        }

        // Wormhole stability decay
        if (this.anomalyType === 'wormhole' && this.wormholeStability <= 0) {
            this.destroy();
        }

        // Fade out near end of life
        if (this.lifetime - this.age < 30) {
            this._fadingOut = true;
        }
    }

    /**
     * Apply scan progress from player scanning
     */
    applyScan(dt, scanPower = 1) {
        if (this.scanned) return true;

        const rate = (scanPower / (this.scanDifficulty * 5)) * dt;
        this.scanStrength = Math.min(1, this.scanStrength + rate);

        if (this.scanStrength >= 1) {
            this.scanned = true;
            this.game.events.emit('anomaly:scanned', this);
            this.game.audio?.play('scan-complete');
            this.game.ui?.showToast(`Anomaly resolved: ${this.name}`, 'system');
            return true;
        }
        return false;
    }

    /**
     * Interact with the anomaly (warp through wormhole, activate combat site, etc.)
     */
    interact(ship) {
        if (!this.scanned) {
            this.game.ui?.showToast('Anomaly not yet scanned', 'warning');
            return false;
        }

        const dist = this.distanceTo(ship);

        switch (this.anomalyType) {
            case 'wormhole':
                return this.useWormhole(ship, dist);
            case 'combatSite':
                return this.activateCombatSite(ship, dist);
            case 'dataSite':
                return this.hackDataSite(ship, dist);
            default:
                return false;
        }
    }

    useWormhole(ship, dist) {
        if (dist > this.activationRange) {
            this.game.ui?.showToast('Move closer to the wormhole', 'warning');
            return false;
        }
        if (!this.destinationSectorId) {
            this.game.ui?.showToast('Wormhole destination unstable', 'warning');
            return false;
        }

        this.wormholeStability -= 0.35;
        this.game.ui?.showToast(`Entering wormhole to ${this.destinationSectorId}...`, 'warp');
        this.game.audio?.play('jump-gate');

        // Sector change after short delay
        setTimeout(() => {
            this.game.changeSector(this.destinationSectorId);
        }, 500);
        return true;
    }

    activateCombatSite(ship, dist) {
        if (dist > 500) {
            this.game.ui?.showToast('Move closer to the combat site', 'warning');
            return false;
        }
        if (this.activated) {
            this.game.ui?.showToast('Combat site already active', 'warning');
            return false;
        }

        this.activated = true;
        this.game.ui?.showToast('Hostiles detected! Combat site activated!', 'danger');
        this.game.audio?.play('warning');

        // Spawn enemies around the anomaly
        const { EnemyShip } = this.game.constructor.entityImports || {};
        for (let i = 0; i < this.enemyCount; i++) {
            const angle = (i / this.enemyCount) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 200 + Math.random() * 300;
            const ex = this.x + Math.cos(angle) * dist;
            const ey = this.y + Math.sin(angle) * dist;

            const enemy = new (this.game._EnemyShipClass)(this.game, {
                x: ex, y: ey,
                tier: this.enemyTier,
                bounty: Math.floor(this.lootCredits / this.enemyCount * 0.5),
            });
            enemy.name = `Site Defender ${i + 1}`;
            this.game.currentSector.addEntity(enemy);
        }
        return true;
    }

    hackDataSite(ship, dist) {
        if (dist > this.hackRange) {
            this.game.ui?.showToast('Move closer to hack the data beacon', 'warning');
            return false;
        }
        if (this.hacked) return false;

        this.hacked = true;
        const credits = Math.floor(this.dataCredits);
        this.game.credits += credits;
        this.game.audio?.play('scan-complete');
        this.game.ui?.showToast(`Data extracted: +${credits} ISK`, 'success');

        if (this.game.input) {
            const screen = this.game.input.worldToScreen(this.x, this.y);
            this.game.ui?.showCreditPopup(credits, screen.x, screen.y, 'gain');
        }

        // Despawn after hacking
        setTimeout(() => this.destroy(), 3000);
        return true;
    }

    /**
     * Get description text for UI
     */
    getDescription() {
        let desc = this.description;
        if (this.anomalyType === 'wormhole' && this.destinationSectorId) {
            const layout = UNIVERSE_LAYOUT_MAP[this.destinationSectorId];
            desc += `\nDestination: ${layout?.name || this.destinationSectorId}`;
            desc += `\nStability: ${Math.round(this.wormholeStability * 100)}%`;
        }
        if (this.anomalyType === 'combatSite') {
            desc += this.activated ? '\nStatus: ACTIVE' : `\nHostiles: ~${this.enemyCount}`;
        }
        if (this.anomalyType === 'dataSite') {
            desc += this.hacked ? '\nStatus: DEPLETED' : '\nStatus: ACTIVE';
        }
        return desc;
    }

    /**
     * Create anomaly mesh
     */
    createMesh() {
        const group = new THREE.Group();

        if (this.anomalyType === 'wormhole') {
            this.createWormholeMesh(group);
        } else if (this.anomalyType === 'combatSite') {
            this.createCombatSiteMesh(group);
        } else if (this.anomalyType === 'dataSite') {
            this.createDataSiteMesh(group);
        } else if (this.anomalyType === 'gasPocket') {
            this.createGasPocketMesh(group);
        }

        // Scan progress ring (visible when not fully scanned)
        const scanRingGeo = new THREE.RingGeometry(this.radius + 8, this.radius + 10, 32);
        const scanRingMat = new THREE.MeshBasicMaterial({
            color: 0x44ffaa,
            transparent: true,
            opacity: 0.0,
        });
        this.scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
        this.scanRing.position.z = 0.2;
        group.add(this.scanRing);

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);
        return this.mesh;
    }

    createWormholeMesh(group) {
        // Swirling purple portal
        const portalGeo = new THREE.CircleGeometry(this.radius * 0.8, 32);
        const portalMat = new THREE.MeshBasicMaterial({
            color: 0x4422aa,
            transparent: true,
            opacity: 0.6,
        });
        this.portal = new THREE.Mesh(portalGeo, portalMat);
        group.add(this.portal);

        // Distortion ring
        const ringGeo = new THREE.RingGeometry(this.radius * 0.7, this.radius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x8844ff,
            transparent: true,
            opacity: 0.5,
        });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.position.z = 0.05;
        group.add(this.ring);

        // Swirl arms
        for (let i = 0; i < 3; i++) {
            const swirlGeo = new THREE.RingGeometry(
                this.radius * 0.2, this.radius * 0.65,
                32, 1, (i * Math.PI * 2) / 3, Math.PI * 0.8
            );
            const swirlMat = new THREE.MeshBasicMaterial({
                color: 0xaa66ff,
                transparent: true,
                opacity: 0.25,
                side: THREE.DoubleSide,
            });
            const swirl = new THREE.Mesh(swirlGeo, swirlMat);
            swirl.position.z = 0.1;
            group.add(swirl);
        }

        // Central bright spot
        const centerGeo = new THREE.CircleGeometry(this.radius * 0.2, 16);
        const centerMat = new THREE.MeshBasicMaterial({
            color: 0xccaaff,
            transparent: true,
            opacity: 0.9,
        });
        this.center = new THREE.Mesh(centerGeo, centerMat);
        this.center.position.z = 0.15;
        group.add(this.center);
    }

    createCombatSiteMesh(group) {
        // Red warning beacon
        const beaconGeo = new THREE.CircleGeometry(this.radius * 0.5, 6);
        const beaconMat = new THREE.MeshBasicMaterial({
            color: 0xff4422,
            transparent: true,
            opacity: 0.7,
        });
        this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
        group.add(this.beacon);

        // Danger symbol - X marks
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const lineGeo = new THREE.BufferGeometry();
            const verts = new Float32Array([
                0, 0, 0,
                Math.cos(angle) * this.radius, Math.sin(angle) * this.radius, 0,
            ]);
            lineGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            const lineMat = new THREE.LineBasicMaterial({
                color: 0xff6644,
                transparent: true,
                opacity: 0.4,
            });
            group.add(new THREE.Line(lineGeo, lineMat));
        }

        // Outer glow ring
        const glowGeo = new THREE.RingGeometry(this.radius * 0.8, this.radius, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff2200,
            transparent: true,
            opacity: 0.2,
        });
        this.glowRing = new THREE.Mesh(glowGeo, glowMat);
        this.glowRing.position.z = 0.05;
        group.add(this.glowRing);
    }

    createDataSiteMesh(group) {
        // Holographic data cube
        const cubeSize = this.radius * 0.5;
        const edges = [
            [-1,-1,-1, 1,-1,-1], [1,-1,-1, 1,1,-1], [1,1,-1, -1,1,-1], [-1,1,-1, -1,-1,-1],
            [-1,-1,1, 1,-1,1], [1,-1,1, 1,1,1], [1,1,1, -1,1,1], [-1,1,1, -1,-1,1],
            [-1,-1,-1, -1,-1,1], [1,-1,-1, 1,-1,1], [1,1,-1, 1,1,1], [-1,1,-1, -1,1,1],
        ];

        for (const edge of edges) {
            const geo = new THREE.BufferGeometry();
            const verts = new Float32Array([
                edge[0] * cubeSize, edge[1] * cubeSize, 0,
                edge[3] * cubeSize, edge[4] * cubeSize, 0,
            ]);
            geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0x44ddff,
                transparent: true,
                opacity: 0.6,
            });
            group.add(new THREE.Line(geo, mat));
        }

        // Central data point
        const dotGeo = new THREE.CircleGeometry(this.radius * 0.15, 8);
        const dotMat = new THREE.MeshBasicMaterial({
            color: 0x88eeff,
            transparent: true,
            opacity: 0.8,
        });
        this.dataCore = new THREE.Mesh(dotGeo, dotMat);
        group.add(this.dataCore);
    }

    createGasPocketMesh(group) {
        // Multiple overlapping translucent circles
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const offset = this.radius * 0.3;
            const r = this.radius * (0.4 + Math.random() * 0.3);
            const geo = new THREE.CircleGeometry(r, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x44ff88,
                transparent: true,
                opacity: 0.08 + Math.random() * 0.05,
            });
            const cloud = new THREE.Mesh(geo, mat);
            cloud.position.set(
                Math.cos(angle) * offset,
                Math.sin(angle) * offset,
                0
            );
            group.add(cloud);
        }
    }

    updateMesh() {
        if (!this.mesh) return;

        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;
        this.mesh.visible = this.visible && this.alive;

        // Fade when near end of life
        if (this._fadingOut) {
            const fade = Math.max(0, (this.lifetime - this.age) / 30);
            this.mesh.children.forEach(child => {
                if (child.material) child.material.opacity *= fade;
            });
        }

        // Scan ring visibility
        if (this.scanRing) {
            if (!this.scanned && this.scanStrength > 0) {
                this.scanRing.material.opacity = 0.3 + Math.sin(this.pulsePhase * 3) * 0.15;
                // Show partial ring based on scan progress
                this.scanRing.material.opacity *= this.scanStrength;
            } else {
                this.scanRing.material.opacity = 0;
            }
        }

        // Type-specific animations
        if (this.anomalyType === 'wormhole') {
            if (this.portal) {
                this.portal.material.opacity = 0.4 + Math.sin(this.pulsePhase * 0.7) * 0.2;
            }
            if (this.ring) {
                this.ring.material.opacity = 0.3 + Math.sin(this.pulsePhase) * 0.2;
            }
            if (this.center) {
                this.center.scale.setScalar(0.8 + Math.sin(this.pulsePhase * 1.5) * 0.2);
                this.center.material.opacity = 0.7 + Math.sin(this.pulsePhase * 2) * 0.3;
            }
        } else if (this.anomalyType === 'combatSite') {
            if (this.beacon) {
                this.beacon.material.opacity = 0.4 + Math.sin(this.pulsePhase * 1.5) * 0.3;
            }
            if (this.glowRing) {
                this.glowRing.material.opacity = 0.1 + Math.sin(this.pulsePhase) * 0.1;
                this.glowRing.scale.setScalar(1 + Math.sin(this.pulsePhase * 0.5) * 0.1);
            }
        } else if (this.anomalyType === 'dataSite') {
            if (this.dataCore) {
                this.dataCore.material.opacity = 0.5 + Math.sin(this.pulsePhase * 2) * 0.3;
            }
        }
    }
}
