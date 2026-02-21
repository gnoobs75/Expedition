// =============================================
// PlayerStation Class
// Player-owned station (POS) with turrets,
// upgradeable defense/refinery/storage
// =============================================

import { Station } from './Station.js';
import { CONFIG } from '../config.js';
import { POS_MODULES, POS_MAX_SLOTS, isModuleComplete } from '../data/posModuleDatabase.js';

export const TURRET_TYPES = {
    'basic-turret': { name: 'Basic Turret', damage: 50, range: 800, cycleTime: 3, price: 5000 },
    'advanced-turret': { name: 'Advanced Turret', damage: 120, range: 1200, cycleTime: 2.5, price: 25000 },
    'pulse-maser': { name: 'Pulse Maser Battery', damage: 200, range: 1500, cycleTime: 2, price: 80000 },
};

export const UPGRADE_COSTS = {
    defense: [50000, 120000, 300000, 700000, 1500000],
    refinery: [80000, 200000, 500000, 1000000, 2000000],
    storage: [40000, 100000, 250000, 600000, 1200000],
};

const MAX_UPGRADE_LEVEL = 5;

export class PlayerStation extends Station {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Player Station',
            radius: 400,
        });

        this.type = 'player-station';

        // Faction owner
        this.owner = options.owner || { name: 'Unknown', color: '#00ccff' };

        // Upgrade levels (deep copy)
        this.upgradeLevel = options.upgradeLevel
            ? { defense: options.upgradeLevel.defense || 0, refinery: options.upgradeLevel.refinery || 0, storage: options.upgradeLevel.storage || 0 }
            : { defense: 0, refinery: 0, storage: 0 };

        // Turret system
        this.turrets = [];
        this.maxTurrets = 2 + this.upgradeLevel.defense * 2;

        // Defensive stats
        this.hull = 5000 + this.upgradeLevel.defense * 2000;
        this.maxHull = this.hull;
        this.shieldHP = 3000 + this.upgradeLevel.defense * 1500;
        this.maxShieldHP = this.shieldHP;
        this.shieldRegen = 5;

        // Modular construction slots
        this.modules = options.modules || []; // Array of { id, contributed: {}, completed: false }
        this.maxModuleSlots = POS_MAX_SLOTS;

        // Storage
        this.storage = { ore: {}, tradeGoods: {}, materials: {} };
        this.storageCapacity = 10000 + this.upgradeLevel.storage * 5000;

        // Refinery
        this.refineryBonus = 1.0 + this.upgradeLevel.refinery * 0.1;

        // Deployment
        this.sectorId = options.sectorId || null;
        this.deployed = true;

        // Track last damage source for kill attribution
        this.lastDamageSource = null;
    }

    // ----- Core Update -----

    update(dt) {
        super.update(dt);

        // Shield regeneration
        if (this.shieldHP < this.maxShieldHP) {
            this.shieldHP = Math.min(this.maxShieldHP, this.shieldHP + this.shieldRegen * dt);
        }
    }

    // ----- Damage -----

    takeDamage(amount, source) {
        if (!this.alive) return;

        this.lastDamageSource = source;

        // Shields absorb first
        if (this.shieldHP > 0) {
            if (amount <= this.shieldHP) {
                this.shieldHP -= amount;
                return;
            }
            amount -= this.shieldHP;
            this.shieldHP = 0;
        }

        // Remainder goes to hull
        this.hull -= amount;

        if (this.hull <= 0) {
            this.hull = 0;
            this.alive = false;
            this.game.events.emit('entity:destroyed', this);
        }
    }

    // ----- Turret Management -----

    addTurret(type) {
        if (this.turrets.length >= this.maxTurrets) return false;

        const template = TURRET_TYPES[type];
        if (!template) return false;

        this.turrets.push({
            type,
            name: template.name,
            damage: template.damage,
            range: template.range,
            cycleTime: template.cycleTime,
            price: template.price,
            cooldown: 0,
            target: null,
        });
        return true;
    }

    removeTurret(index) {
        if (index < 0 || index >= this.turrets.length) return false;
        this.turrets.splice(index, 1);
        return true;
    }

    // ----- Upgrades -----

    upgrade(category) {
        if (!this.upgradeLevel.hasOwnProperty(category)) return false;
        if (this.upgradeLevel[category] >= MAX_UPGRADE_LEVEL) return false;

        this.upgradeLevel[category]++;
        this.recalculateStats();
        return true;
    }

    getUpgradeCost(category) {
        if (!UPGRADE_COSTS[category]) return null;
        const level = this.upgradeLevel[category];
        if (level >= MAX_UPGRADE_LEVEL) return null;
        return UPGRADE_COSTS[category][level];
    }

    recalculateStats() {
        const mb = this.getModuleBonuses();
        this.maxHull = 5000 + this.upgradeLevel.defense * 2000 + mb.hull;
        this.maxShieldHP = 3000 + this.upgradeLevel.defense * 1500 + mb.shields;
        this.maxTurrets = 2 + this.upgradeLevel.defense * 2 + mb.turretSlots;
        this.storageCapacity = 10000 + this.upgradeLevel.storage * 5000 + mb.storage;
        this.refineryBonus = Math.max(1.0 + this.upgradeLevel.refinery * 0.1, mb.refineryMultiplier);
        this.shieldRegen = 5 * mb.shieldRegenMultiplier;
    }

    // ----- Storage -----

    getStorageUsed() {
        let total = 0;
        for (const category of ['ore', 'tradeGoods', 'materials']) {
            const bucket = this.storage[category];
            if (!bucket) continue;
            for (const id in bucket) {
                const item = bucket[id];
                total += (item.quantity || 0) * (item.volume || 1);
            }
        }
        return total;
    }

    addToStorage(type, id, quantity, volume = 1) {
        const bucket = this.storage[type];
        if (!bucket) return false;

        const used = this.getStorageUsed();
        const adding = quantity * volume;
        if (used + adding > this.storageCapacity) return false;

        if (!bucket[id]) {
            bucket[id] = { quantity: 0, volume };
        }
        bucket[id].quantity += quantity;
        return true;
    }

    removeFromStorage(type, id, quantity) {
        const bucket = this.storage[type];
        if (!bucket || !bucket[id]) return false;
        if (bucket[id].quantity < quantity) return false;

        bucket[id].quantity -= quantity;
        if (bucket[id].quantity <= 0) {
            delete bucket[id];
        }
        return true;
    }

    // ----- Module Construction -----

    /**
     * Begin construction of a new module in an empty slot.
     * Returns the slot index or -1 on failure.
     */
    installModule(moduleId) {
        if (!POS_MODULES[moduleId]) return -1;
        if (this.modules.length >= this.maxModuleSlots) return -1;
        // Prevent duplicate modules
        if (this.modules.some(m => m.id === moduleId)) return -1;

        const slot = {
            id: moduleId,
            contributed: {},
            completed: false,
        };
        this.modules.push(slot);
        return this.modules.length - 1;
    }

    /**
     * Contribute materials from POS storage to a module under construction.
     * Returns the amount actually contributed.
     */
    contributeToModule(slotIndex, materialId, amount) {
        const slot = this.modules[slotIndex];
        if (!slot || slot.completed) return 0;

        const modDef = POS_MODULES[slot.id];
        if (!modDef) return 0;

        const required = modDef.materials[materialId];
        if (!required) return 0; // This material isn't needed

        const alreadyContributed = slot.contributed[materialId] || 0;
        const remaining = required - alreadyContributed;
        if (remaining <= 0) return 0;

        const toContribute = Math.min(amount, remaining);

        // Pull from POS storage - check both tradeGoods and materials buckets
        const inTradeGoods = this.storage.tradeGoods[materialId]?.quantity || 0;
        const inMaterials = this.storage.materials[materialId]?.quantity || 0;
        const totalAvailable = inTradeGoods + inMaterials;
        const actual = Math.min(toContribute, totalAvailable);
        if (actual <= 0) return 0;

        // Remove from tradeGoods first, then materials
        let remaining2 = actual;
        if (inTradeGoods > 0 && remaining2 > 0) {
            const fromTG = Math.min(remaining2, inTradeGoods);
            this.removeFromStorage('tradeGoods', materialId, fromTG);
            remaining2 -= fromTG;
        }
        if (inMaterials > 0 && remaining2 > 0) {
            const fromMat = Math.min(remaining2, inMaterials);
            this.removeFromStorage('materials', materialId, fromMat);
        }

        // Add to contributed
        slot.contributed[materialId] = alreadyContributed + actual;

        // Check completion
        if (isModuleComplete(slot.contributed, slot.id)) {
            slot.completed = true;
            this.recalculateStats();
            this.game?.events?.emit('pos:module-completed', { station: this, moduleId: slot.id });
        }

        return actual;
    }

    /**
     * Get aggregated bonuses from all completed modules.
     */
    getModuleBonuses() {
        const bonuses = {
            turretSlots: 0,
            hull: 0,
            shields: 0,
            storage: 0,
            shieldRegenMultiplier: 1.0,
            refineryMultiplier: 1.0,
            fleetAutoRepair: false,
            shipManufacturing: false,
            equipmentCrafting: false,
        };

        for (const slot of this.modules) {
            if (!slot.completed) continue;
            const modDef = POS_MODULES[slot.id];
            if (!modDef) continue;
            const b = modDef.bonuses;
            if (b.turretSlots) bonuses.turretSlots += b.turretSlots;
            if (b.hull) bonuses.hull += b.hull;
            if (b.shields) bonuses.shields += b.shields;
            if (b.storage) bonuses.storage += b.storage;
            if (b.shieldRegenMultiplier) bonuses.shieldRegenMultiplier = Math.max(bonuses.shieldRegenMultiplier, b.shieldRegenMultiplier);
            if (b.refineryMultiplier) bonuses.refineryMultiplier = Math.max(bonuses.refineryMultiplier, b.refineryMultiplier);
            if (b.fleetAutoRepair) bonuses.fleetAutoRepair = true;
            if (b.shipManufacturing) bonuses.shipManufacturing = true;
            if (b.equipmentCrafting) bonuses.equipmentCrafting = true;
        }

        return bonuses;
    }

    // ----- Repair -----

    getRepairCost() {
        const hullDamage = this.maxHull - this.hull;
        const shieldDamage = this.maxShieldHP - this.shieldHP;
        return Math.floor(hullDamage * 2 + shieldDamage * 1);
    }

    repair() {
        const cost = this.getRepairCost();
        if (cost <= 0) return 0;
        if (!this.game?.player) return 0;
        if (this.game.credits < cost) return 0;

        this.game.credits -= cost;
        this.hull = this.maxHull;
        this.shieldHP = this.maxShieldHP;
        return cost;
    }

    // ----- Mesh -----

    createMesh() {
        const group = new THREE.Group();
        const r = this.radius;
        const sides = 8;
        const angleStep = (Math.PI * 2) / sides;

        // Parse owner color for Three.js
        const ownerColor = new THREE.Color(this.owner.color || '#00ccff');
        const ownerHex = ownerColor.getHex();

        // === OUTER HULL -- extruded octagonal ring ===
        const hullShape = new THREE.Shape();
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            i === 0 ? hullShape.moveTo(x, y) : hullShape.lineTo(x, y);
        }
        hullShape.closePath();

        const holePath = new THREE.Path();
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * r * 0.6;
            const y = Math.sin(angle) * r * 0.6;
            i === 0 ? holePath.moveTo(x, y) : holePath.lineTo(x, y);
        }
        holePath.closePath();
        hullShape.holes.push(holePath);

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
            depth: 8, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1, bevelSegments: 1,
        });
        hullGeo.center();
        const hullMat = new THREE.MeshStandardMaterial({
            color: 0x2a3a4a,
            emissive: 0x1a2a3a,
            emissiveIntensity: 0.2,
            roughness: 0.35,
            metalness: 0.6,
        });
        group.add(new THREE.Mesh(hullGeo, hullMat));

        // === INNER PLATFORM ===
        const innerShape = new THREE.Shape();
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * r * 0.55;
            const y = Math.sin(angle) * r * 0.55;
            i === 0 ? innerShape.moveTo(x, y) : innerShape.lineTo(x, y);
        }
        innerShape.closePath();
        const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 5, bevelEnabled: false });
        innerGeo.center();
        const innerMat = new THREE.MeshStandardMaterial({
            color: 0x1e2e3e,
            emissive: 0x0a1a2a,
            emissiveIntensity: 0.25,
            roughness: 0.5,
            metalness: 0.4,
        });
        const innerPlatform = new THREE.Mesh(innerGeo, innerMat);
        innerPlatform.position.z = -1;
        group.add(innerPlatform);

        // === INNER RING -- faction colored ===
        const ringGeo = new THREE.RingGeometry(r * 0.56, r * 0.62, sides * 4);
        const ringMat = new THREE.MeshBasicMaterial({
            color: ownerHex,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
        });
        const innerRing = new THREE.Mesh(ringGeo, ringMat);
        innerRing.position.z = 6;
        group.add(innerRing);

        // === OUTER TRIM -- faction colored edge lighting ===
        const trimGeo = new THREE.RingGeometry(r * 0.96, r * 1.02, sides * 4);
        const trimMat = new THREE.MeshBasicMaterial({
            color: ownerHex,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });
        const outerTrim = new THREE.Mesh(trimGeo, trimMat);
        outerTrim.position.z = 6;
        group.add(outerTrim);

        // === DOCKING ARMS -- 4 structural struts ===
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI) / 2 + Math.PI / 8;
            const armShape = new THREE.Shape();
            armShape.moveTo(-r * 0.02, 0);
            armShape.lineTo(-r * 0.02, r * 0.38);
            armShape.lineTo(r * 0.02, r * 0.38);
            armShape.lineTo(r * 0.02, 0);
            armShape.closePath();
            const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: 4, bevelEnabled: false });
            armGeo.center();
            const armMat = new THREE.MeshStandardMaterial({
                color: 0x3a4a5a,
                emissive: 0x1a2a3a,
                emissiveIntensity: 0.15,
                roughness: 0.3,
                metalness: 0.7,
            });
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.rotation.z = angle;
            arm.position.set(
                Math.cos(angle) * r * 0.58,
                Math.sin(angle) * r * 0.58,
                0
            );
            group.add(arm);
        }

        // === DOCKING LIGHTS -- 8 around perimeter ===
        for (let i = 0; i < 8; i++) {
            const angle = i * angleStep;
            const lightGeo = new THREE.CircleGeometry(r * 0.02, 8);
            const lightMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0x00ff44 : 0x00aaff,
                transparent: true,
                opacity: 0.9,
            });
            const dockLight = new THREE.Mesh(lightGeo, lightMat);
            dockLight.position.set(
                Math.cos(angle) * r * 0.78,
                Math.sin(angle) * r * 0.78,
                6
            );
            group.add(dockLight);
        }

        // === TURRET HARDPOINTS -- evenly spaced circles around the ring ===
        this.turretHardpoints = [];
        for (let i = 0; i < this.maxTurrets; i++) {
            const angle = (i / this.maxTurrets) * Math.PI * 2;
            const hpGeo = new THREE.CircleGeometry(r * 0.035, 12);
            const hpMat = new THREE.MeshBasicMaterial({
                color: ownerHex,
                transparent: true,
                opacity: 0.8,
            });
            const hardpoint = new THREE.Mesh(hpGeo, hpMat);
            hardpoint.position.set(
                Math.cos(angle) * r * 0.82,
                Math.sin(angle) * r * 0.82,
                7
            );
            group.add(hardpoint);
            this.turretHardpoints.push(hardpoint);
        }

        // === CORE -- faction colored reactor glow ===
        const coreGeo = new THREE.CircleGeometry(r * 0.12, 16);
        const coreMat = new THREE.MeshBasicMaterial({
            color: ownerHex,
            transparent: true,
            opacity: 0.9,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.z = 6;
        group.add(core);

        // Core glow halo
        const haloGeo = new THREE.CircleGeometry(r * 0.2, 16);
        const haloMat = new THREE.MeshBasicMaterial({
            color: ownerHex,
            transparent: true,
            opacity: 0.25,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.z = 5.5;
        group.add(halo);

        // === PANEL LINES ===
        const lineMat = new THREE.LineBasicMaterial({ color: 0x556677, transparent: true, opacity: 0.4 });
        for (let i = 0; i < sides; i++) {
            const a1 = i * angleStep;
            const pts = [
                new THREE.Vector3(Math.cos(a1) * r * 0.62, Math.sin(a1) * r * 0.62, 6),
                new THREE.Vector3(Math.cos(a1) * r * 0.95, Math.sin(a1) * r * 0.95, 6),
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(lineGeo, lineMat));
        }

        // Store references for animation
        this.dockingLights = [];
        group.children.forEach(child => {
            if (child.material && (child.material.color.getHex() === 0x00ff44 || child.material.color.getHex() === 0x00aaff) && child.geometry?.parameters?.radius < r * 0.05) {
                this.dockingLights.push(child);
            }
        });

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);
        this.innerRing = innerRing;
        this.coreHalo = halo;

        return this.mesh;
    }

    updateMesh() {
        super.updateMesh();

        // Pulse turret hardpoint lights when turrets are actively firing
        if (this.turretHardpoints && this.turretHardpoints.length > 0) {
            const t = Date.now() * 0.001;
            for (let i = 0; i < this.turretHardpoints.length; i++) {
                const hp = this.turretHardpoints[i];
                const turret = this.turrets[i];

                if (turret && turret.target && turret.cooldown > 0 && turret.cooldown < turret.cycleTime * 0.3) {
                    // Firing flash -- bright pulse
                    hp.material.opacity = 0.5 + Math.sin(t * 20) * 0.5;
                    hp.scale.setScalar(1.4);
                } else if (turret && turret.target) {
                    // Tracking target -- steady glow
                    hp.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
                    hp.scale.setScalar(1.1);
                } else {
                    // Idle
                    hp.material.opacity = 0.4 + Math.sin(t * 0.8 + i) * 0.1;
                    hp.scale.setScalar(1.0);
                }
            }
        }
    }

    // ----- Serialization -----

    serialize() {
        return {
            ...super.serialize(),
            name: this.name,
            owner: this.owner,
            upgradeLevel: { ...this.upgradeLevel },
            turrets: this.turrets.map(t => ({ type: t.type })),
            modules: this.modules.map(m => ({
                id: m.id,
                contributed: { ...m.contributed },
                completed: m.completed,
            })),
            hull: this.hull,
            maxHull: this.maxHull,
            shieldHP: this.shieldHP,
            maxShieldHP: this.maxShieldHP,
            storage: JSON.parse(JSON.stringify(this.storage)),
            storageCapacity: this.storageCapacity,
            refineryBonus: this.refineryBonus,
            sectorId: this.sectorId,
            deployed: this.deployed,
        };
    }
}
