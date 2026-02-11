// =============================================
// Loot Container Entity
// Floating cargo that can be scooped by ships.
// Created from ship destruction or cargo jettison.
// Despawns after 5 minutes.
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

export class LootContainer extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Cargo Container',
            radius: 12,
            color: 0xffcc44,
        });

        this.type = 'loot';
        this.hostility = 'neutral';

        // Container contents
        this.credits = options.credits || 0;
        this.ore = options.ore || {};        // { oreType: { units, volume } }
        this.tradeGoods = options.tradeGoods || {}; // { goodId: { quantity, volumePerUnit } }

        // Lifetime (300s = 5 min)
        this.lifetime = options.lifetime || 300;
        this.age = 0;

        // Slow drift
        const angle = Math.random() * Math.PI * 2;
        const drift = 3 + Math.random() * 5;
        this.velocity.x = Math.cos(angle) * drift;
        this.velocity.y = Math.sin(angle) * drift;

        // Spin
        this.spinSpeed = (Math.random() - 0.5) * 2;
    }

    update(dt) {
        if (!this.alive) return;

        this.age += dt;
        if (this.age >= this.lifetime) {
            this.destroy();
            return;
        }

        // Slow spin
        this.rotation += this.spinSpeed * dt;

        super.update(dt);
    }

    /**
     * Scoop this container into a ship
     * @param {Ship} ship - The scooping ship
     * @returns {boolean} True if something was scooped
     */
    scoop(ship) {
        let scooped = false;

        // Credits
        if (this.credits > 0) {
            this.game.addCredits(this.credits);
            this.game.ui?.log(`Scooped ${this.credits} ISK`, 'loot');
            this.game.audio?.play('loot-pickup');
            if (this.game.input) {
                const screen = this.game.input.worldToScreen(this.x, this.y);
                this.game.ui?.showCreditPopup(this.credits, screen.x, screen.y, 'gain');
            }
            scooped = true;
        }

        // Ore
        for (const [oreType, data] of Object.entries(this.ore)) {
            if (data.units > 0) {
                const added = ship.addOre(oreType, data.units, data.volume);
                if (added > 0) {
                    this.game.ui?.log(`Scooped ${added} ${oreType}`, 'loot');
                    this.game.ui?.showToast(`${oreType} x${added} scooped`, 'loot');
                    scooped = true;
                }
            }
        }

        // Trade goods
        for (const [goodId, data] of Object.entries(this.tradeGoods)) {
            if (data.quantity > 0) {
                const added = ship.addTradeGood(goodId, data.quantity, data.volumePerUnit);
                if (added > 0) {
                    this.game.ui?.log(`Scooped ${added}x ${goodId}`, 'loot');
                    this.game.ui?.showToast(`${goodId} x${added} collected`, 'loot');
                    scooped = true;
                }
            }
        }

        if (scooped) {
            this.game.renderer?.effects?.spawn('loot', this.x, this.y);
            if (!this.credits) this.game.audio?.play('loot-pickup');
        }

        this.destroy();
        return scooped;
    }

    /**
     * Get a summary string of contents
     */
    getContentsSummary() {
        const parts = [];
        if (this.credits > 0) parts.push(`${this.credits} ISK`);
        for (const [oreType, data] of Object.entries(this.ore)) {
            if (data.units > 0) parts.push(`${data.units} ${oreType}`);
        }
        for (const [goodId, data] of Object.entries(this.tradeGoods)) {
            if (data.quantity > 0) parts.push(`${data.quantity}x ${goodId}`);
        }
        return parts.join(', ') || 'Empty';
    }

    createMesh() {
        const group = new THREE.Group();

        // Box shape
        const boxShape = new THREE.Shape();
        const s = this.radius * 0.8;
        boxShape.moveTo(-s, -s * 0.6);
        boxShape.lineTo(s, -s * 0.6);
        boxShape.lineTo(s, s * 0.6);
        boxShape.lineTo(-s, s * 0.6);
        boxShape.closePath();

        const geo = new THREE.ExtrudeGeometry(boxShape, {
            depth: 3, bevelEnabled: true,
            bevelThickness: 1, bevelSize: 0.5, bevelSegments: 1,
        });
        geo.center();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xddaa33,
            emissive: 0xffcc44,
            emissiveIntensity: 0.2,
            roughness: 0.4,
            metalness: 0.6,
            transparent: true,
            opacity: 0.9,
        });

        group.add(new THREE.Mesh(geo, mat));

        // Glow ring
        const ringGeo = new THREE.RingGeometry(this.radius * 1.1, this.radius * 1.3, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffcc44,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = -0.5;
        group.add(ring);

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;
        return this.mesh;
    }

    updateMesh() {
        if (this.mesh) {
            this.mesh.position.set(this.x, this.y, 0);
            this.mesh.rotation.z = this.rotation;
            this.mesh.visible = this.visible && this.alive;

            // Pulsing glow as despawn approaches
            const fadeStart = this.lifetime * 0.8;
            if (this.age > fadeStart) {
                const fade = 1 - (this.age - fadeStart) / (this.lifetime - fadeStart);
                const pulse = 0.5 + Math.sin(this.age * 6) * 0.5;
                this.mesh.children?.[0]?.material && (this.mesh.children[0].material.opacity = 0.9 * fade * pulse);
            }
        }
    }
}
