// =============================================
// Mining System
// Handles asteroid mining and resource extraction
// =============================================

import { CONFIG } from '../config.js';

export class MiningSystem {
    constructor(game) {
        this.game = game;

        // Active mining operations
        this.activeMining = new Map(); // ship -> { asteroid, progress }

        // Persistent mining beam meshes
        this.miningBeams = new Map(); // ship -> { beamMesh, glowMesh, time, chunkTimer, chunks[] }
    }

    /**
     * Update mining system
     */
    update(dt) {
        const effectsGroup = this.game.renderer?.effectsGroup;

        // Visual effects for active mining
        for (const [ship, data] of this.activeMining) {
            if (!ship.alive || !data.asteroid.alive) {
                this.removeMiningBeam(ship);
                this.activeMining.delete(ship);
                continue;
            }

            // Check range
            const dist = ship.distanceTo(data.asteroid);
            if (dist > CONFIG.MINING_RANGE * 1.2) {
                this.removeMiningBeam(ship);
                this.activeMining.delete(ship);
                continue;
            }

            // Create or update persistent mining beam
            if (effectsGroup) {
                this.updateMiningBeam(ship, data.asteroid, dt);
            }

            // Mining particles at asteroid
            data.effectTimer = (data.effectTimer || 0) + dt;
            if (data.effectTimer > 0.3) {
                data.effectTimer = 0;
                this.game.renderer.effects.spawn('mining', data.asteroid.x, data.asteroid.y, {
                    color: data.asteroid.color,
                });
            }
        }

        // Clean up beams for ships no longer mining
        for (const [ship] of this.miningBeams) {
            if (!this.activeMining.has(ship)) {
                this.removeMiningBeam(ship);
            }
        }
    }

    updateMiningBeam(ship, asteroid, dt) {
        const effectsGroup = this.game.renderer?.effectsGroup;
        if (!effectsGroup) return;

        let beam = this.miningBeams.get(ship);
        if (!beam) {
            // Create beam core (white-hot center)
            const coreGeo = new THREE.PlaneGeometry(1, 1.5);
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
            });
            const coreMesh = new THREE.Mesh(coreGeo, coreMat);
            coreMesh.position.z = 9.5;
            effectsGroup.add(coreMesh);

            // Create beam body (colored)
            const beamGeo = new THREE.PlaneGeometry(1, 3);
            const beamMat = new THREE.MeshBasicMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
            });
            const beamMesh = new THREE.Mesh(beamGeo, beamMat);
            beamMesh.position.z = 9;
            effectsGroup.add(beamMesh);

            // Create outer glow
            const glowGeo = new THREE.PlaneGeometry(1, 10);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0x88bbff,
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
            });
            const glowMesh = new THREE.Mesh(glowGeo, glowMat);
            glowMesh.position.z = 8.5;
            effectsGroup.add(glowMesh);

            // Impact point glow on asteroid
            const impactGeo = new THREE.CircleGeometry(6, 12);
            const impactMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
                depthWrite: false,
            });
            const impactMesh = new THREE.Mesh(impactGeo, impactMat);
            impactMesh.position.z = 10;
            effectsGroup.add(impactMesh);

            beam = { coreMesh, beamMesh, glowMesh, impactMesh, time: 0, chunkTimer: 0, sparkTimer: 0, burstTimer: 0, chunks: [] };
            this.miningBeams.set(ship, beam);
        }

        beam.time += dt;

        // Update beam geometry to connect ship → asteroid
        const dx = asteroid.x - ship.x;
        const dy = asteroid.y - ship.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const midX = ship.x + dx / 2;
        const midY = ship.y + dy / 2;

        // Jitter - beam instability (plasma cutter wobble)
        const jitterX = Math.sin(beam.time * 35) * 1.5;
        const jitterY = Math.cos(beam.time * 28) * 1.5;

        // Pulse beam width with chaotic shimmer
        const pulse = 1 + 0.3 * Math.sin(beam.time * 8) + 0.15 * Math.sin(beam.time * 23);
        const corePulse = 1.5 * pulse;
        const bodyPulse = 3.5 * pulse;
        const glowPulse = 10 * pulse;

        // Heat color shift: blue → green → yellow → orange over 15 seconds
        const heatT = Math.min(beam.time / 15, 1);
        let beamR, beamG, beamB;
        if (heatT < 0.33) {
            const t = heatT / 0.33;
            beamR = 0x44 + (0x44 - 0x44) * t;
            beamG = 0x88 + (0xcc - 0x88) * t;
            beamB = 0xff + (0x44 - 0xff) * t;
        } else if (heatT < 0.66) {
            const t = (heatT - 0.33) / 0.33;
            beamR = 0x44 + (0xdd - 0x44) * t;
            beamG = 0xcc + (0xcc - 0xcc) * t;
            beamB = 0x44 + (0x22 - 0x44) * t;
        } else {
            const t = (heatT - 0.66) / 0.34;
            beamR = 0xdd + (0xff - 0xdd) * t;
            beamG = 0xcc + (0x88 - 0xcc) * t;
            beamB = 0x22 + (0x11 - 0x22) * t;
        }
        const heatColor = (Math.round(beamR) << 16) | (Math.round(beamG) << 8) | Math.round(beamB);
        beam.beamMesh.material.color.setHex(heatColor);
        beam.glowMesh.material.color.setHex(heatColor);

        // Update core beam (white-hot center)
        beam.coreMesh.geometry.dispose();
        beam.coreMesh.geometry = new THREE.PlaneGeometry(length, corePulse);
        beam.coreMesh.position.set(midX + jitterX * 0.5, midY + jitterY * 0.5, 9.5);
        beam.coreMesh.rotation.z = angle;
        beam.coreMesh.material.opacity = 0.7 + 0.25 * Math.sin(beam.time * 15);

        // Update beam body
        beam.beamMesh.geometry.dispose();
        beam.beamMesh.geometry = new THREE.PlaneGeometry(length, bodyPulse);
        beam.beamMesh.position.set(midX + jitterX, midY + jitterY, 9);
        beam.beamMesh.rotation.z = angle;
        beam.beamMesh.material.opacity = 0.5 + 0.3 * Math.sin(beam.time * 12);

        // Update outer glow
        beam.glowMesh.geometry.dispose();
        beam.glowMesh.geometry = new THREE.PlaneGeometry(length, glowPulse);
        beam.glowMesh.position.set(midX, midY, 8.5);
        beam.glowMesh.rotation.z = angle;
        beam.glowMesh.material.opacity = 0.1 + 0.06 * Math.sin(beam.time * 6);

        // Update impact glow on asteroid (pulsing, heat-colored)
        const impactPulse = 4 + 3 * Math.sin(beam.time * 10);
        beam.impactMesh.position.set(asteroid.x + jitterX * 2, asteroid.y + jitterY * 2, 10);
        beam.impactMesh.scale.setScalar(impactPulse);
        beam.impactMesh.material.color.setHex(heatT > 0.5 ? 0xffaa44 : heatColor);
        beam.impactMesh.material.opacity = 0.3 + 0.2 * Math.sin(beam.time * 14);

        // Spawn sparks cascading down beam from asteroid toward ship
        beam.sparkTimer = (beam.sparkTimer || 0) + dt;
        if (beam.sparkTimer > 0.04) {
            beam.sparkTimer = 0;
            const effects = this.game.renderer.effects;
            // Spark cascade along beam
            const sparkCount = 1 + (heatT > 0.5 ? 1 : 0);
            for (let i = 0; i < sparkCount; i++) {
                const p = effects.getParticle();
                if (!p) break;
                const t = Math.random();
                const sx = asteroid.x + (ship.x - asteroid.x) * t;
                const sy = asteroid.y + (ship.y - asteroid.y) * t;
                p.position.set(sx + (Math.random() - 0.5) * 6, sy + (Math.random() - 0.5) * 6, 10);
                p.scale.setScalar(0.4 + Math.random() * 0.6);
                p.material.color.setHex(Math.random() < 0.3 ? 0xffffff : heatColor);
                p.material.opacity = 0.9;
                p.visible = true;
                p.userData.active = true;
                // Move toward ship along beam
                const toShipAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
                p.userData.vx = Math.cos(toShipAngle) * (30 + Math.random() * 50);
                p.userData.vy = Math.sin(toShipAngle) * (30 + Math.random() * 50);
                p.userData.life = 0;
                p.userData.maxLife = 0.1 + Math.random() * 0.15;
                p.userData.fadeOut = true;
                p.userData.shrink = true;
                p.userData.startScale = p.scale.x;
            }
        }

        // Vaporization burst at asteroid (periodic mini-explosions)
        beam.burstTimer = (beam.burstTimer || 0) + dt;
        if (beam.burstTimer > 0.8 + Math.random() * 0.4) {
            beam.burstTimer = 0;
            const effects = this.game.renderer.effects;
            // Mini explosion burst
            for (let i = 0; i < 6; i++) {
                const p = effects.getParticle();
                if (!p) break;
                const a = Math.random() * Math.PI * 2;
                const spd = 30 + Math.random() * 60;
                p.position.set(asteroid.x + (Math.random() - 0.5) * 10, asteroid.y + (Math.random() - 0.5) * 10, 10.5);
                p.scale.setScalar(1.5 + Math.random() * 2);
                const burstColors = [0xff4400, 0xff6600, 0xffaa00, 0xffcc44];
                p.material.color.setHex(burstColors[Math.floor(Math.random() * burstColors.length)]);
                p.material.opacity = 0.9;
                p.visible = true;
                p.userData.active = true;
                p.userData.vx = Math.cos(a) * spd;
                p.userData.vy = Math.sin(a) * spd;
                p.userData.life = 0;
                p.userData.maxLife = 0.3 + Math.random() * 0.2;
                p.userData.fadeOut = true;
                p.userData.shrink = true;
                p.userData.startScale = p.scale.x;
            }
            // Flash light
            effects.lightPool?.spawn(asteroid.x, asteroid.y, 0xff6600, 1.2, 0.3, 200);
        }

        // Spawn ore chunks traveling along beam toward ship
        beam.chunkTimer += dt;
        if (beam.chunkTimer > 0.15) {
            beam.chunkTimer = 0;
            const chunk = this.createOreChunk(asteroid.x, asteroid.y, ship, asteroid.color || 0xffaa00);
            if (chunk) {
                effectsGroup.add(chunk);
                beam.chunks.push(chunk);
            }
        }

        // Update ore chunks
        for (let i = beam.chunks.length - 1; i >= 0; i--) {
            const chunk = beam.chunks[i];
            const ud = chunk.userData;
            ud.progress += dt * ud.speed;

            if (ud.progress >= 1) {
                effectsGroup.remove(chunk);
                chunk.geometry.dispose();
                chunk.material.dispose();
                beam.chunks.splice(i, 1);
                continue;
            }

            // Lerp from asteroid to ship with slight wobble
            const t = ud.progress;
            const wobble = Math.sin(t * Math.PI * 4 + ud.phase) * 8 * (1 - t);
            const perpX = -Math.sin(angle) * wobble;
            const perpY = Math.cos(angle) * wobble;

            chunk.position.x = asteroid.x + (ship.x - asteroid.x) * t + perpX;
            chunk.position.y = asteroid.y + (ship.y - asteroid.y) * t + perpY;
            chunk.rotation.z += dt * ud.spin;

            // Ore chunk glow: bright when fresh (hot), fades as it cools
            const glowFade = 1 - t;
            const baseOpacity = Math.min(1, Math.sin(t * Math.PI) * 2);
            chunk.material.opacity = baseOpacity;
            // Shift color from white-hot → ore color as it travels
            if (t < 0.3) {
                chunk.material.color.setHex(0xffddaa); // hot
            } else {
                chunk.material.color.setHex(asteroid.color || 0xffaa00);
            }
            const s = ud.baseScale * (1 - t * 0.5);
            chunk.scale.setScalar(s);
        }

        // Persistent dynamic light at mining point
        if (Math.random() < 0.15) {
            this.game.renderer.effects.lightPool?.spawn(
                asteroid.x, asteroid.y, heatColor, 0.6, 0.25, 120
            );
        }
    }

    createOreChunk(x, y, target, color) {
        const size = 1.5 + Math.random() * 2;
        const shape = new THREE.Shape();
        // Random polygon chunk
        const verts = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < verts; i++) {
            const a = (i / verts) * Math.PI * 2;
            const r = size * (0.5 + Math.random() * 0.5);
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) shape.moveTo(px, py);
            else shape.lineTo(px, py);
        }
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x + (Math.random() - 0.5) * 15, y + (Math.random() - 0.5) * 15, 10);
        mesh.userData = {
            progress: 0,
            speed: 0.8 + Math.random() * 0.6,
            spin: (Math.random() - 0.5) * 10,
            phase: Math.random() * Math.PI * 2,
            baseScale: 0.8 + Math.random() * 0.4,
        };
        return mesh;
    }

    removeMiningBeam(ship) {
        const beam = this.miningBeams.get(ship);
        if (!beam) return;
        const effectsGroup = this.game.renderer?.effectsGroup;
        if (effectsGroup) {
            const meshes = [beam.coreMesh, beam.beamMesh, beam.glowMesh, beam.impactMesh];
            for (const m of meshes) {
                if (m) {
                    effectsGroup.remove(m);
                    m.geometry.dispose();
                    m.material.dispose();
                }
            }
            for (const chunk of beam.chunks) {
                effectsGroup.remove(chunk);
                chunk.geometry.dispose();
                chunk.material.dispose();
            }
        }
        this.miningBeams.delete(ship);
    }

    /**
     * Mine an asteroid (called when mining laser cycles)
     */
    mineAsteroid(ship, asteroid, yield_amount) {
        if (!asteroid || asteroid.type !== 'asteroid') {
            return;
        }

        // Check range
        const dist = ship.distanceTo(asteroid);
        if (dist > CONFIG.MINING_RANGE * 1.2) {
            if (ship.isPlayer) this.game.ui?.log('Target out of mining range', 'system');
            return;
        }

        // Extract ore from asteroid
        const extracted = asteroid.mine(yield_amount);

        if (extracted.units > 0) {
            // Add ore to ship's cargo
            if (ship.isPlayer) {
                const added = ship.addOre(extracted.type, extracted.units, extracted.volume);

                if (added > 0) {
                    this.game.events.emit('mining:complete', {
                        units: added,
                        volume: added * (extracted.volume / extracted.units),
                        value: added * (extracted.value / extracted.units),
                        type: extracted.type,
                        asteroid,
                    });

                    // Log ore extraction
                    const oreName = CONFIG.ASTEROID_TYPES[extracted.type]?.name || extracted.type;
                    this.game.ui?.log(`+${added} ${oreName} ore`, 'mining');
                }

                // Warn if cargo is full
                if (added < extracted.units) {
                    this.game.ui?.log('Cargo hold full!', 'warning');
                    this.game.ui?.toast('Cargo hold full - dock at a station to sell ore', 'warning');
                }
            } else if (ship.type === 'npc') {
                // NPC ships also add ore to their cargo
                ship.addOre(extracted.type, extracted.units, extracted.volume);
            }

            // Track active mining for visual effects
            this.activeMining.set(ship, {
                asteroid,
                progress: 0,
                effectTimer: 0,
            });

            // Play mining sound (only if near player)
            if (ship.isPlayer) {
                this.game.audio?.play('mining');
            }
        }

        // Check if asteroid depleted
        if (!asteroid.alive) {
            this.activeMining.delete(ship);
            if (ship.isPlayer) {
                this.game.ui?.log('Asteroid depleted', 'mining');
            }
        }
    }

    /**
     * Start auto-mining an asteroid
     */
    startAutoMine(ship, asteroid) {
        // This would set up continuous mining
        // For now, handled by module activation
    }

    /**
     * Stop mining
     */
    stopMining(ship) {
        this.activeMining.delete(ship);
    }

    /**
     * Get mining progress for ship
     */
    getMiningProgress(ship) {
        const data = this.activeMining.get(ship);
        return data ? data.progress : 0;
    }
}
