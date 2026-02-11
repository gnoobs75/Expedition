// =============================================
// Station Class
// Dockable stations for trading and repairs
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { TRADE_GOODS, STATION_SPECIALTIES, getStationPrice } from '../data/tradeGoodsDatabase.js';

export class Station extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Space Station',
            radius: options.radius || 400, // Much larger default station
            color: CONFIG.COLORS.friendly,
        });

        this.type = 'station';

        // Station properties - docking range scales with size
        this.dockingRange = this.radius * 1.5;
        this.services = options.services || ['repair', 'market', 'hangar'];

        // Rotation for visual effect
        this.rotationSpeed = 0.05;

        // Shop inventory (uses new databases with fallback to CONFIG)
        this.shipsForSale = Object.keys(SHIP_DATABASE).length > 0 ? Object.keys(SHIP_DATABASE) : Object.keys(CONFIG.SHIPS);
        this.modulesForSale = Object.keys(EQUIPMENT_DATABASE).length > 0 ? Object.keys(EQUIPMENT_DATABASE) : Object.keys(CONFIG.MODULES);

        // Trade goods - sector-based specialty
        this.sectorId = options.sectorId || 'hub';
        this.specialty = STATION_SPECIALTIES[this.sectorId] || null;

        // Trade goods stock (produced goods are always available, others may be limited)
        this.tradeGoods = {};
        this.initTradeGoods();
    }

    /**
     * Initialize trade goods inventory
     */
    initTradeGoods() {
        if (!this.specialty) return;

        // Stock produced goods heavily
        for (const goodId of this.specialty.produces) {
            this.tradeGoods[goodId] = {
                stock: 50 + Math.floor(Math.random() * 50), // 50-100 units
                maxStock: 200,
                produced: true,
            };
        }

        // Stock consumed goods lightly (they get used up)
        for (const goodId of this.specialty.consumes) {
            this.tradeGoods[goodId] = {
                stock: Math.floor(Math.random() * 10), // 0-10 units
                maxStock: 100,
                produced: false,
            };
        }

        // Some random other goods in small quantities
        const otherGoods = Object.keys(TRADE_GOODS).filter(
            id => !this.specialty.produces.includes(id) && !this.specialty.consumes.includes(id)
        );
        for (const goodId of otherGoods) {
            if (Math.random() < 0.3) { // 30% chance to stock random goods
                this.tradeGoods[goodId] = {
                    stock: Math.floor(Math.random() * 15),
                    maxStock: 50,
                    produced: false,
                };
            }
        }
    }

    /**
     * Get price for a trade good at this station
     */
    getTradePrice(goodId) {
        return getStationPrice(goodId, this.sectorId);
    }

    /**
     * Buy trade goods from station (player buys)
     */
    buyTradeGood(goodId, quantity) {
        const stock = this.tradeGoods[goodId];
        if (!stock || stock.stock < quantity) return false;

        const price = this.getTradePrice(goodId);
        const totalCost = price.buy * quantity;

        if (!this.game.spendCredits(totalCost)) return false;

        stock.stock -= quantity;
        return { cost: totalCost, price: price.buy };
    }

    /**
     * Sell trade goods to station (player sells)
     */
    sellTradeGood(goodId, quantity) {
        const price = this.getTradePrice(goodId);
        const totalValue = price.sell * quantity;

        // Add to station stock
        if (!this.tradeGoods[goodId]) {
            this.tradeGoods[goodId] = { stock: 0, maxStock: 100, produced: false };
        }
        this.tradeGoods[goodId].stock += quantity;

        this.game.addCredits(totalValue);
        return { value: totalValue, price: price.sell };
    }

    /**
     * Update station
     */
    update(dt) {
        super.update(dt);
        this.rotation += this.rotationSpeed * dt;
    }

    /**
     * Check if an entity can dock
     */
    canDock(entity) {
        const dist = this.distanceTo(entity);
        return dist <= this.dockingRange;
    }

    /**
     * Get repair cost for a ship
     */
    getRepairCost(ship) {
        const shieldDamage = ship.maxShield - ship.shield;
        const armorDamage = ship.maxArmor - ship.armor;
        const hullDamage = ship.maxHull - ship.hull;

        return Math.floor((shieldDamage + armorDamage * 2 + hullDamage * 3) * 0.5);
    }

    /**
     * Repair a ship
     */
    repairShip(ship) {
        const cost = this.getRepairCost(ship);
        if (this.game.spendCredits(cost)) {
            ship.shield = ship.maxShield;
            ship.armor = ship.maxArmor;
            ship.hull = ship.maxHull;
            return true;
        }
        return false;
    }

    /**
     * Create station mesh — multi-layered 3D structure
     */
    createMesh() {
        const group = new THREE.Group();
        const r = this.radius;
        const sides = 8;
        const angleStep = (Math.PI * 2) / sides;

        // === OUTER HULL — extruded octagonal ring with hole ===
        const hullShape = new THREE.Shape();
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            i === 0 ? hullShape.moveTo(x, y) : hullShape.lineTo(x, y);
        }
        hullShape.closePath();
        // Cut out inner area to make a ring-shaped hull
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

        // === INNER PLATFORM — smaller octagon filling the hole ===
        const innerShape = new THREE.Shape();
        for (let i = 0; i < sides; i++) {
            const angle = i * angleStep;
            const x = Math.cos(angle) * r * 0.55;
            const y = Math.sin(angle) * r * 0.55;
            i === 0 ? innerShape.moveTo(x, y) : innerShape.lineTo(x, y);
        }
        innerShape.closePath();
        const innerGeo = new THREE.ExtrudeGeometry(innerShape, {
            depth: 5, bevelEnabled: false,
        });
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

        // === ROTATING RING — glowing energy ring between hull and inner platform ===
        const ringGeo = new THREE.RingGeometry(r * 0.56, r * 0.62, sides * 4);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
        });
        const innerRing = new THREE.Mesh(ringGeo, ringMat);
        innerRing.position.z = 6;
        group.add(innerRing);

        // === OUTER TRIM — green edge lighting ===
        const trimGeo = new THREE.RingGeometry(r * 0.96, r * 1.02, sides * 4);
        const trimMat = new THREE.MeshBasicMaterial({
            color: 0x44ff88,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
        });
        const outerTrim = new THREE.Mesh(trimGeo, trimMat);
        outerTrim.position.z = 6;
        group.add(outerTrim);

        // === DOCKING ARMS — 4 structural struts ===
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

        // === DOCKING LIGHTS — 8 lights around the perimeter ===
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

        // === CORE — bright central reactor ===
        const coreGeo = new THREE.CircleGeometry(r * 0.12, 16);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0x44ddff,
            transparent: true,
            opacity: 0.9,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.z = 6;
        group.add(core);

        // Core glow halo
        const haloGeo = new THREE.CircleGeometry(r * 0.2, 16);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.25,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.z = 5.5;
        group.add(halo);

        // === PANEL LINES — structural detail ===
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

        // Store docking lights for approach animation
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

    /**
     * Update mesh with animation
     */
    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 0);
            this.mesh.visible = this.visible && this.alive;

            // Rotate inner ring opposite to station
            if (this.innerRing) {
                this.innerRing.rotation.z = -this.rotation * 2;
            }

            const t = Date.now() * 0.001;

            // Pulse core halo
            if (this.coreHalo) {
                this.coreHalo.material.opacity = 0.2 + Math.sin(t * 2) * 0.1;
                this.coreHalo.scale.setScalar(1.0 + Math.sin(t * 1.5) * 0.08);
            }

            // Approach guide lights - blink faster as player gets closer
            if (this.dockingLights.length > 0 && this.game.player?.alive) {
                const dist = this.game.player.distanceTo(this);
                const dockRange = this.radius * 3;

                if (dist < dockRange) {
                    // Proximity factor: 0 at max range, 1 at docking distance
                    const proximity = 1 - Math.min(dist / dockRange, 1);
                    // Blink speed: 1Hz far, 4Hz close
                    const blinkSpeed = 1 + proximity * 3;
                    for (let i = 0; i < this.dockingLights.length; i++) {
                        // Sequential chase pattern
                        const phase = (t * blinkSpeed + i * 0.3) % 1;
                        const blink = phase < 0.5 ? 1 : 0.2;
                        this.dockingLights[i].material.opacity = blink * (0.5 + proximity * 0.5);
                        // Scale up slightly when active
                        this.dockingLights[i].scale.setScalar(1 + proximity * 0.5);
                    }
                } else {
                    // Default steady glow when far
                    for (const light of this.dockingLights) {
                        light.material.opacity = 0.5 + Math.sin(t * 0.5) * 0.1;
                        light.scale.setScalar(1);
                    }
                }
            }
        }
    }
}
