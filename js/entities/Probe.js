import { Entity } from './Entity.js';

export class Probe extends Entity {
    constructor(game, options = {}) {
        super(game, options);
        this.type = 'probe';
        this.targetSectorId = options.targetSectorId || null;
        this.travelTime = options.travelTime || 20; // seconds to reach target
        this.returnTime = options.travelTime || 20; // seconds to return
        this.timer = 0;
        this.state = 'traveling'; // traveling | returning | complete
        this.radius = 5;
        this.alive = true;
    }

    update(dt) {
        if (!this.alive) return;
        this.timer += dt;

        if (this.state === 'traveling' && this.timer >= this.travelTime) {
            this.state = 'returning';
            this.timer = 0;
            // Intel gathered at target
            this.game.events.emit('intel:probe-scanned', { sectorId: this.targetSectorId, probe: this });
        }

        if (this.state === 'returning' && this.timer >= this.returnTime) {
            this.state = 'complete';
            this.game.events.emit('intel:probe-returned', { sectorId: this.targetSectorId, probe: this });
            this.alive = false;
        }
    }

    createMesh() {
        // Small diamond-shaped probe mesh
        const geo = new THREE.CircleGeometry(this.radius, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0x44ccff, transparent: true, opacity: 0.7 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.set(this.x, this.y, 0);
        return this.mesh;
    }

    getProgress() {
        if (this.state === 'traveling') return this.timer / this.travelTime * 0.5;
        if (this.state === 'returning') return 0.5 + this.timer / this.returnTime * 0.5;
        return 1;
    }
}
