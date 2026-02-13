// =============================================
// PlayerStationDefenseSystem
// Handles POS turret AI: target acquisition,
// tracking, and firing for player-owned stations
// =============================================

export class PlayerStationDefenseSystem {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        const stations = this.game.playerStations;
        if (!stations || stations.length === 0) return;

        for (const station of stations) {
            if (!station.alive || station.sectorId !== this.game.currentSector?.id) continue;
            this.updateStationTurrets(station, dt);
        }
    }

    updateStationTurrets(station, dt) {
        for (const turret of station.turrets) {
            // Tick cooldown
            if (turret.cooldown > 0) {
                turret.cooldown -= dt;
            }

            // Validate current target
            if (turret.target && (!turret.target.alive || station.distanceTo(turret.target) > turret.range)) {
                turret.target = null;
            }

            // Find new target if needed
            if (!turret.target) {
                turret.target = this.findNearestHostile(station, turret.range);
            }

            // Fire if ready and target acquired
            if (turret.target && turret.cooldown <= 0) {
                this.fireTurret(station, turret);
            }
        }
    }

    /**
     * Scan sector entities for the nearest hostile within range
     */
    findNearestHostile(station, range) {
        const sector = this.game.currentSector;
        if (!sector || !sector.entities) return null;

        let nearest = null;
        let nearestDist = range;

        for (const entity of sector.entities) {
            if (!entity.alive) continue;
            if (entity.type !== 'enemy' && entity.type !== 'bounty-target') continue;

            const dist = station.distanceTo(entity);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = entity;
            }
        }

        return nearest;
    }

    /**
     * Fire a turret at its current target
     */
    fireTurret(station, turret) {
        const target = turret.target;
        if (!target || !target.alive) return;

        // Deal damage
        target.takeDamage(turret.damage, station);
        turret.cooldown = turret.cycleTime;

        // Visual effect -- laser beam from station to target
        const beamColor = station.owner?.color || '#00ccff';
        const color = new THREE.Color(beamColor).getHex();
        this.game.renderer?.effects?.spawn('laser', station.x, station.y, {
            target: target,
            color: color,
        });

        // Audio
        this.game.audio?.play('laser');

        // Emit combat event
        this.game.events?.emit('combat:action', {
            attacker: station,
            target,
            damage: turret.damage,
            type: 'turret',
        });
    }
}
