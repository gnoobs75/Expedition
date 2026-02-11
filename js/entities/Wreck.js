// =============================================
// Ship Wreck Entity
// Remains of a destroyed ship - can be salvaged
// Contains credits and random equipment
// =============================================

import { Entity } from './Entity.js';

export class Wreck extends Entity {
    constructor(game, options = {}) {
        super(game, {
            ...options,
            name: options.name || 'Ship Wreck',
            radius: options.radius || 25,
            color: 0x887766,
        });

        this.type = 'wreck';
        this.hostility = 'neutral';

        // Wreck contents
        this.credits = options.credits || 0;
        this.salvageMaterials = options.salvageMaterials || Math.floor(1 + Math.random() * 5);
        this.equipment = options.equipment || null; // random equipment drop

        // Lifetime (120s = 2 min)
        this.lifetime = options.lifetime || 120;
        this.age = 0;

        // Salvage state
        this.salvaged = false;
        this.salvageProgress = 0;
        this.salvaging = false;
        this.salvageRange = 200;
        this.salvageTime = 5; // 5 seconds to salvage

        // Source ship info
        this.sourceShipName = options.sourceShipName || 'Unknown';
        this.sourceShipClass = options.sourceShipClass || '';

        // Slow drift and spin
        const angle = Math.random() * Math.PI * 2;
        const drift = 1 + Math.random() * 3;
        this.velocity.x = Math.cos(angle) * drift;
        this.velocity.y = Math.sin(angle) * drift;
        this.spinSpeed = (Math.random() - 0.5) * 0.5;
    }

    update(dt) {
        if (!this.alive) return;

        this.age += dt;
        if (this.age >= this.lifetime) {
            this.destroy();
            return;
        }

        this.rotation += this.spinSpeed * dt;

        // Handle salvage channeling
        if (this.salvaging) {
            const player = this.game.player;
            if (!player?.alive || player.distanceTo(this) > this.salvageRange) {
                this.cancelSalvage();
            } else {
                this.salvageProgress += dt;
                if (this.salvageProgress >= this.salvageTime) {
                    this.completeSalvage(player);
                }
            }
        }

        super.update(dt);
    }

    /**
     * Start salvaging this wreck
     */
    startSalvage(ship) {
        if (this.salvaged || this.salvaging) return false;

        const dist = this.distanceTo(ship);
        if (dist > this.salvageRange) {
            this.game.ui?.showToast('Move closer to salvage', 'warning');
            return false;
        }

        this.salvaging = true;
        this.salvageProgress = 0;
        this.game.audio?.play('mining');
        this.game.ui?.showToast(`Salvaging ${this.name}...`, 'system');
        return true;
    }

    cancelSalvage() {
        this.salvaging = false;
        this.salvageProgress = 0;
        this.game.ui?.showToast('Salvage interrupted', 'warning');
    }

    completeSalvage(ship) {
        this.salvaging = false;
        this.salvaged = true;

        let totalValue = 0;

        // Credits
        if (this.credits > 0) {
            this.game.addCredits(this.credits);
            totalValue += this.credits;
        }

        // Salvage materials as credits
        const salvageValue = this.salvageMaterials * 50;
        if (salvageValue > 0) {
            this.game.addCredits(salvageValue);
            totalValue += salvageValue;
        }

        this.game.audio?.play('scan-complete');
        this.game.ui?.showToast(`Salvaged: +${totalValue} ISK`, 'success');
        this.game.ui?.log(`Salvaged wreck of ${this.sourceShipName}: +${totalValue} ISK`, 'loot');

        if (this.game.input) {
            const screen = this.game.input.worldToScreen(this.x, this.y);
            this.game.ui?.showCreditPopup(totalValue, screen.x, screen.y, 'gain');
        }

        this.game.renderer?.effects?.spawn('loot', this.x, this.y);

        // Despawn after salvage
        setTimeout(() => this.destroy(), 2000);
    }

    /**
     * Get salvage progress as percentage
     */
    getSalvagePercent() {
        if (!this.salvaging) return 0;
        return Math.min(1, this.salvageProgress / this.salvageTime);
    }

    getContentsSummary() {
        if (this.salvaged) return 'Salvaged';
        const parts = [`Wreck of ${this.sourceShipName}`];
        if (this.credits > 0) parts.push(`~${this.credits} ISK`);
        parts.push(`${this.salvageMaterials} salvage`);
        return parts.join(', ');
    }

    createMesh() {
        const group = new THREE.Group();

        // Broken hull plates - irregular shapes
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
            const dist = this.radius * 0.3;
            const size = this.radius * (0.3 + Math.random() * 0.3);

            const shape = new THREE.Shape();
            const points = 4 + Math.floor(Math.random() * 3);
            for (let j = 0; j < points; j++) {
                const a = (j / points) * Math.PI * 2;
                const r = size * (0.6 + Math.random() * 0.4);
                if (j === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            shape.closePath();

            const geo = new THREE.ExtrudeGeometry(shape, {
                depth: 2, bevelEnabled: false,
            });
            geo.center();

            const mat = new THREE.MeshStandardMaterial({
                color: 0x665544,
                emissive: 0x221100,
                emissiveIntensity: 0.1,
                roughness: 0.8,
                metalness: 0.4,
                transparent: true,
                opacity: 0.85,
            });

            const piece = new THREE.Mesh(geo, mat);
            piece.position.set(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                0
            );
            piece.rotation.z = Math.random() * Math.PI;
            group.add(piece);
        }

        // Faint smoke effect - small dark circles
        for (let i = 0; i < 3; i++) {
            const smokeGeo = new THREE.CircleGeometry(this.radius * (0.3 + Math.random() * 0.3), 8);
            const smokeMat = new THREE.MeshBasicMaterial({
                color: 0x332211,
                transparent: true,
                opacity: 0.15,
            });
            const smoke = new THREE.Mesh(smokeGeo, smokeMat);
            smoke.position.set(
                (Math.random() - 0.5) * this.radius,
                (Math.random() - 0.5) * this.radius,
                -0.1
            );
            group.add(smoke);
        }

        this.mesh = group;
        this.mesh.position.set(this.x, this.y, 0);
        return this.mesh;
    }

    updateMesh() {
        if (!this.mesh) return;
        this.mesh.position.set(this.x, this.y, 0);
        this.mesh.rotation.z = this.rotation;
        this.mesh.visible = this.visible && this.alive;

        // Fade near end of life
        const fadeStart = this.lifetime * 0.7;
        if (this.age > fadeStart) {
            const fade = 1 - (this.age - fadeStart) / (this.lifetime - fadeStart);
            this.mesh.children.forEach(child => {
                if (child.material?.opacity !== undefined) {
                    child.material.opacity = Math.min(child.material.opacity, fade);
                }
            });
        }
    }
}
