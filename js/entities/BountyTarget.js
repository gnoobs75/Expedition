import { EnemyShip } from './EnemyShip.js';

export class BountyTarget extends EnemyShip {
    constructor(game, options = {}) {
        super(game, options);

        // Bounty target properties
        this.bountyTargetId = options.bountyTargetId || null;
        this.bountyName = options.bountyName || 'Unknown Pirate';
        this.bountyTitle = options.bountyTitle || '';
        this.bountyTier = options.bountyTier || 1;
        this.bountyReward = options.bountyReward || 10000;
        this.specialLoot = options.specialLoot || [];

        // Enhanced stats (bounty targets are tougher than normal)
        this.isBountyTarget = true;

        // Aggro settings - bounty targets are very aggressive
        this.aggroRange = options.aggroRange || 2000;
        this.aggression = options.aggression || 0.9;
    }

    // Override destroy to emit bounty-specific event
    destroy() {
        this.game.events.emit('bounty:target-destroyed', {
            bountyTargetId: this.bountyTargetId,
            name: this.bountyName,
            reward: this.bountyReward,
            x: this.x,
            y: this.y,
        });
        super.destroy();
    }

    // Override createMesh to add bounty indicator
    createMesh() {
        const mesh = super.createMesh();
        if (mesh) {
            // Add a bounty skull indicator ring
            const ringGeo = new THREE.RingGeometry(this.radius * 1.3, this.radius * 1.5, 6);
            const ringMat = new THREE.MeshBasicMaterial({
                color: this.bountyTier >= 3 ? 0xcc44ff : 0xff4444,
                transparent: true,
                opacity: 0.5,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.name = 'bountyRing';
            mesh.add(ring);
        }
        return mesh;
    }
}
