// =============================================
// Status Effects Renderer
// Renders EWAR beams, shield bubbles, prop mod
// flares, and other per-ship visual indicators.
// =============================================

const BEAM_UPDATE_INTERVAL = 0.1; // 10Hz for beam updates

export class StatusEffects {
    constructor(game, parentGroup) {
        this.game = game;
        this.parentGroup = parentGroup;

        // Active beam meshes (scrambler/web beams between ships)
        this.beams = new Map(); // "source-slotId" -> { mesh, source, target }

        // Tractor beam meshes (player -> loot containers)
        this.tractorBeams = new Map(); // entity -> { line, glow }

        // Shield flash meshes (temporary, per-entity)
        this.shieldFlashes = [];

        // Propmod flare meshes (persistent while active)
        this.propFlares = new Map(); // entity -> flare mesh

        // Shield recharge shimmer mesh (player only)
        this.shieldShimmer = null;
        this.shieldShimmerActive = false;

        // Damage smoke particles (per-entity)
        this.damageSmoke = []; // { mesh, entity, life, maxLife, vx, vy }
        this.damageSmokeTimer = 0;

        // Repair nanite particles
        this.repairNanites = null; // { group, particles: [], type: 'shield'|'armor' }
        this.repairNanitesActive = false;

        // Salvage beam (player -> wreck)
        this.salvageBeam = null; // { line, glow, wreck }

        // Warp disruption bubble
        this.disruptBubble = null;
        this.disruptBubbleActive = false;

        this.updateTimer = 0;
    }

    /**
     * Update all status effect visuals
     */
    update(dt) {
        this.updateTimer += dt;
        const shouldUpdate = this.updateTimer >= BEAM_UPDATE_INTERVAL;
        if (shouldUpdate) this.updateTimer = 0;

        const entities = this.game.currentSector?.entities || [];
        const player = this.game.player;

        // Update EWAR beams
        if (shouldUpdate) {
            this.updateEWARBeams(entities, player);
        }

        // Update beam positions continuously (smooth follow)
        for (const [key, beam] of this.beams) {
            if (!beam.source?.alive || !beam.target?.alive) {
                this.removeBeam(key);
                continue;
            }
            this.updateBeamPosition(beam);
        }

        // Update prop mod flares
        if (shouldUpdate) {
            this.updatePropFlares(entities, player);
        }

        // Update prop flare positions
        for (const [entity, flare] of this.propFlares) {
            if (!entity.alive) {
                this.removeFlare(entity);
                continue;
            }
            // Position behind the ship (opposite of heading)
            const backAngle = entity.rotation + Math.PI;
            const offset = (entity.radius || 20) * 0.7;
            flare.position.set(
                entity.x + Math.cos(backAngle) * offset,
                entity.y + Math.sin(backAngle) * offset,
                3
            );
            // Pulse brightness
            const time = performance.now() * 0.005;
            flare.material.opacity = 0.4 + Math.sin(time + entity.x * 0.01) * 0.15;
            // Scale with speed
            const speedFactor = Math.min((entity.currentSpeed || 0) / (entity.maxSpeed || 200), 1.5);
            flare.scale.set(0.8 + speedFactor * 0.5, 0.6 + speedFactor * 0.3, 1);
        }

        // Update tractor beams
        this.updateTractorBeams(player, dt);

        // Update salvage beam
        this.updateSalvageBeam(player, dt);

        // Update shield recharge shimmer
        this.updateShieldShimmer(player, dt);

        // Update warp disruption bubble on player
        this.updateDisruptionBubble(player, dt);

        // Update repair nanite particles
        this.updateRepairNanites(player, dt);

        // Update damage smoke/sparks on low-hull ships
        this.updateDamageSmoke(entities, dt);

        // Update shield flashes (fade out)
        for (let i = this.shieldFlashes.length - 1; i >= 0; i--) {
            const flash = this.shieldFlashes[i];
            flash.life += dt;
            if (flash.life >= flash.maxLife) {
                this.parentGroup.remove(flash.mesh);
                flash.mesh.geometry.dispose();
                flash.mesh.material.dispose();
                this.shieldFlashes.splice(i, 1);
                continue;
            }
            const progress = flash.life / flash.maxLife;
            flash.mesh.material.opacity = 0.3 * (1 - progress);
            flash.mesh.scale.setScalar(1 + progress * 0.3);
            // Follow entity
            if (flash.entity?.alive) {
                flash.mesh.position.set(flash.entity.x, flash.entity.y, 4);
            }
        }
    }

    /**
     * Update EWAR beam visuals
     */
    updateEWARBeams(entities, player) {
        const activeBeamKeys = new Set();

        // Check all ships for active EWAR modules
        const allShips = [];
        if (player?.alive) allShips.push(player);
        for (const e of entities) {
            if (e.alive && e.activeModules?.size > 0) allShips.push(e);
        }

        for (const ship of allShips) {
            if (!ship.target?.alive) continue;

            for (const slotId of ship.activeModules) {
                const [slotType, slotIndex] = ship.parseSlotId?.(slotId) || [];
                if (slotType === undefined) continue;
                const moduleId = ship.modules[slotType]?.[slotIndex];
                if (!moduleId) continue;

                // Check if it's an EWAR module
                const isScram = moduleId.includes('warp-disruptor') || moduleId.includes('warp-scrambler');
                const isWeb = moduleId.includes('stasis-web') || moduleId.includes('webifier');
                const isNos = moduleId.includes('energy-vampire') || moduleId.includes('nosferatu');

                if (!isScram && !isWeb && !isNos) continue;

                const dist = ship.distanceTo(ship.target);
                // Only show beam if in range
                const maxRange = isScram ? 600 : isNos ? 400 : 250;
                if (dist > maxRange * 1.2) continue;

                const key = `${ship.id || ship.name}-${slotId}`;
                activeBeamKeys.add(key);

                if (!this.beams.has(key)) {
                    // Create beam
                    const color = isScram ? 0xff4444 : isNos ? 0x9944ff : 0xffaa44;
                    const type = isScram ? 'point' : isNos ? 'nos' : 'web';
                    this.createBeam(key, ship, ship.target, color, type);
                }
            }
        }

        // Remove stale beams
        for (const [key] of this.beams) {
            if (!activeBeamKeys.has(key)) {
                this.removeBeam(key);
            }
        }
    }

    /**
     * Create an EWAR beam between source and target
     */
    createBeam(key, source, target, color, type) {
        const points = [
            new THREE.Vector3(source.x, source.y, 3),
            new THREE.Vector3(target.x, target.y, 3),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Dashed line for scrambler/nos, solid for web
        let material;
        if (type === 'point') {
            material = new THREE.LineDashedMaterial({
                color: color,
                transparent: true,
                opacity: 0.5,
                dashSize: 15,
                gapSize: 10,
                depthWrite: false,
            });
        } else if (type === 'nos') {
            material = new THREE.LineDashedMaterial({
                color: color,
                transparent: true,
                opacity: 0.6,
                dashSize: 8,
                gapSize: 6,
                depthWrite: false,
            });
        } else {
            material = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.35,
                depthWrite: false,
            });
        }

        const beam = new THREE.Line(geometry, material);
        if (type === 'point') beam.computeLineDistances();
        beam.frustumCulled = false;
        this.parentGroup.add(beam);

        this.beams.set(key, { mesh: beam, source, target, type });
    }

    /**
     * Update beam position
     */
    updateBeamPosition(beam) {
        const positions = beam.mesh.geometry.attributes.position;
        positions.setXYZ(0, beam.source.x, beam.source.y, 3);
        positions.setXYZ(1, beam.target.x, beam.target.y, 3);
        positions.needsUpdate = true;

        if (beam.type === 'point' || beam.type === 'nos') beam.mesh.computeLineDistances();

        // Pulse opacity
        const time = performance.now() * 0.003;
        if (beam.type === 'nos') {
            // Faster, more aggressive pulse for nosferatu
            beam.mesh.material.opacity = 0.4 + Math.sin(time * 3) * 0.2;
            // Animate dash offset for flowing effect
            beam.mesh.material.dashSize = 8 + Math.sin(time * 2) * 3;
        } else {
            beam.mesh.material.opacity = (beam.type === 'point' ? 0.4 : 0.3) + Math.sin(time) * 0.1;
        }
    }

    /**
     * Remove a beam
     */
    removeBeam(key) {
        const beam = this.beams.get(key);
        if (!beam) return;
        this.parentGroup.remove(beam.mesh);
        beam.mesh.geometry.dispose();
        beam.mesh.material.dispose();
        this.beams.delete(key);
    }

    /**
     * Update propulsion module flares
     */
    updatePropFlares(entities, player) {
        const activeEntities = new Set();

        const allShips = [];
        if (player?.alive) allShips.push(player);
        for (const e of entities) {
            if (e.alive && e.activeModules?.size > 0) allShips.push(e);
        }

        for (const ship of allShips) {
            // Check for active propulsion mods
            let hasPropMod = false;
            for (const slotId of ship.activeModules) {
                const [slotType, slotIndex] = ship.parseSlotId?.(slotId) || [];
                if (slotType === undefined) continue;
                const moduleId = ship.modules[slotType]?.[slotIndex];
                if (!moduleId) continue;

                if (moduleId.includes('afterburner') || moduleId.includes('microwarpdrive')) {
                    hasPropMod = true;
                    break;
                }
            }

            if (hasPropMod && (ship.currentSpeed || 0) > 10) {
                activeEntities.add(ship);
                if (!this.propFlares.has(ship)) {
                    this.createPropFlare(ship);
                }
            }
        }

        // Remove inactive flares
        for (const [entity] of this.propFlares) {
            if (!activeEntities.has(entity)) {
                this.removeFlare(entity);
            }
        }
    }

    /**
     * Create a propulsion flare
     */
    createPropFlare(entity) {
        const size = Math.max((entity.radius || 20) * 0.4, 6);
        const geometry = new THREE.CircleGeometry(size, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });
        const flare = new THREE.Mesh(geometry, material);
        flare.frustumCulled = false;
        this.parentGroup.add(flare);
        this.propFlares.set(entity, flare);
    }

    /**
     * Remove a prop flare
     */
    removeFlare(entity) {
        const flare = this.propFlares.get(entity);
        if (!flare) return;
        this.parentGroup.remove(flare);
        flare.geometry.dispose();
        flare.material.dispose();
        this.propFlares.delete(entity);
    }

    /**
     * Spawn a shield impact flash with directional ripple
     */
    spawnShieldFlash(entity, source) {
        if (!entity?.alive) return;
        const radius = (entity.radius || 20) * 1.3;

        // Full ring flash
        const ringGeo = new THREE.RingGeometry(radius * 0.8, radius, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(entity.x, entity.y, 4);
        this.parentGroup.add(ringMesh);
        this.shieldFlashes.push({
            mesh: ringMesh,
            entity,
            life: 0,
            maxLife: 0.3,
        });

        // Directional impact arc (if we know the source)
        if (source) {
            const angle = Math.atan2(source.y - entity.y, source.x - entity.x);
            const arcGeo = new THREE.RingGeometry(
                radius * 0.9, radius * 1.4, 12, 1,
                angle - Math.PI * 0.3, Math.PI * 0.6
            );
            const arcMat = new THREE.MeshBasicMaterial({
                color: 0x66bbff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const arcMesh = new THREE.Mesh(arcGeo, arcMat);
            arcMesh.position.set(entity.x, entity.y, 4.5);
            this.parentGroup.add(arcMesh);
            this.shieldFlashes.push({
                mesh: arcMesh,
                entity,
                life: 0,
                maxLife: 0.4,
            });
        }
    }

    /**
     * Update shield recharge shimmer on player ship
     */
    updateShieldShimmer(player, dt) {
        if (!player?.alive) {
            this.removeShieldShimmer();
            return;
        }

        const isRecharging = player.shield < player.maxShield && player.shield > 0;

        if (isRecharging && !this.shieldShimmerActive) {
            this.createShieldShimmer(player);
        } else if (!isRecharging && this.shieldShimmerActive) {
            this.removeShieldShimmer();
            return;
        }

        if (this.shieldShimmer && this.shieldShimmerActive) {
            // Follow player
            this.shieldShimmer.position.set(player.x, player.y, 4);

            // Shimmer intensity based on how depleted shields are
            const shieldPct = player.shield / player.maxShield;
            const depleted = 1 - shieldPct; // more depleted = more visible
            const time = performance.now() * 0.004;

            // Pulsing ring
            const pulse = 0.5 + Math.sin(time) * 0.3 + Math.sin(time * 2.7) * 0.2;
            this.shieldShimmer.children[0].material.opacity = (0.08 + depleted * 0.12) * pulse;

            // Rotating sparkle ring
            this.shieldShimmer.children[1].rotation.z += dt * 0.8;
            this.shieldShimmer.children[1].material.opacity = (0.1 + depleted * 0.15) * pulse;

            // Scale breathe
            const breathe = 1 + Math.sin(time * 0.7) * 0.03;
            this.shieldShimmer.scale.set(breathe, breathe, 1);
        }
    }

    /**
     * Create shield shimmer mesh group
     */
    createShieldShimmer(player) {
        if (this.shieldShimmer) return;

        const r = (player.radius || 20) * 1.6;
        const group = new THREE.Group();

        // Outer glow ring
        const ringGeo = new THREE.RingGeometry(r * 0.85, r, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        group.add(new THREE.Mesh(ringGeo, ringMat));

        // Inner sparkle dots ring (smaller dots in a circle)
        const dotCount = 12;
        const dotGeo = new THREE.CircleGeometry(2, 4);
        const dotMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        const dotGroup = new THREE.Group();
        for (let i = 0; i < dotCount; i++) {
            const angle = (i / dotCount) * Math.PI * 2;
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.set(Math.cos(angle) * r * 0.9, Math.sin(angle) * r * 0.9, 0);
            dotGroup.add(dot);
        }
        group.add(dotGroup);

        group.position.set(player.x, player.y, 4);
        group.frustumCulled = false;
        this.parentGroup.add(group);
        this.shieldShimmer = group;
        this.shieldShimmerActive = true;
    }

    /**
     * Remove shield shimmer
     */
    removeShieldShimmer() {
        if (this.shieldShimmer) {
            this.parentGroup.remove(this.shieldShimmer);
            // Dispose all geometries/materials
            this.shieldShimmer.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.shieldShimmer = null;
        }
        this.shieldShimmerActive = false;
    }

    /**
     * Update warp disruption bubble on player when pointed
     */
    updateDisruptionBubble(player, dt) {
        if (!player?.alive) {
            this.removeDisruptionBubble();
            return;
        }

        const isPointed = player.isPointed || player.warpDisrupted;

        if (isPointed && !this.disruptBubbleActive) {
            this.createDisruptionBubble(player);
        } else if (!isPointed && this.disruptBubbleActive) {
            this.removeDisruptionBubble();
        }

        if (this.disruptBubble && this.disruptBubbleActive) {
            const time = performance.now() * 0.003;
            this.disruptBubble.position.set(player.x, player.y, 5);

            // Pulsing effect
            const pulse = 0.8 + Math.sin(time * 2) * 0.2;
            const r = (player.radius || 20) + 15;
            this.disruptBubble.scale.set(r * pulse / 30, r * pulse / 30, 1);

            // Rotate slowly
            this.disruptBubble.children.forEach((child, i) => {
                child.rotation.z += dt * (0.5 + i * 0.3) * (i % 2 === 0 ? 1 : -1);
                child.material.opacity = (0.12 + Math.sin(time * 3 + i) * 0.06);
            });
        }
    }

    createDisruptionBubble(player) {
        if (this.disruptBubble) return;

        const group = new THREE.Group();

        // Inner disruption sphere
        const innerGeo = new THREE.RingGeometry(25, 30, 32);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xff2244,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        group.add(new THREE.Mesh(innerGeo, innerMat));

        // Outer pulsing ring
        const outerGeo = new THREE.RingGeometry(28, 31, 24);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0xff4466,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        group.add(new THREE.Mesh(outerGeo, outerMat));

        // Dashed warning ring
        const dashGeo = new THREE.RingGeometry(32, 33, 16);
        const dashMat = new THREE.MeshBasicMaterial({
            color: 0xff0022,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        group.add(new THREE.Mesh(dashGeo, dashMat));

        this.parentGroup.add(group);
        this.disruptBubble = group;
        this.disruptBubbleActive = true;
    }

    removeDisruptionBubble() {
        if (this.disruptBubble) {
            this.parentGroup.remove(this.disruptBubble);
            this.disruptBubble.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.disruptBubble = null;
        }
        this.disruptBubbleActive = false;
    }

    /**
     * Update repair nanite particles when shield booster or armor repairer is active
     */
    updateRepairNanites(player, dt) {
        if (!player?.alive) {
            this.removeRepairNanites();
            return;
        }

        // Detect active repair modules
        let repairType = null;
        if (player.activeModules) {
            for (const [slotId, config] of player.activeModules) {
                if (config.shieldBoost && config.shieldBoost > 0) {
                    repairType = 'shield';
                    break;
                }
                if (config.armorRepair && config.armorRepair > 0) {
                    repairType = repairType || 'armor';
                }
            }
        }

        if (repairType && !this.repairNanitesActive) {
            this.createRepairNanites(player, repairType);
        } else if (!repairType && this.repairNanitesActive) {
            this.removeRepairNanites();
            return;
        }

        if (this.repairNanites && this.repairNanitesActive) {
            const group = this.repairNanites.group;
            group.position.set(player.x, player.y, 5);

            const time = performance.now() * 0.003;
            const particles = this.repairNanites.particles;
            const r = (player.radius || 20) * 1.2;

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                // Orbit around ship with vertical oscillation
                p.angle += p.speed * dt;
                p.offset += dt * p.floatSpeed;

                const orbitR = r * (0.7 + Math.sin(p.offset) * 0.25);
                p.mesh.position.set(
                    Math.cos(p.angle) * orbitR,
                    Math.sin(p.angle) * orbitR,
                    0
                );

                // Twinkle
                p.mesh.material.opacity = 0.15 + Math.sin(time * 3 + i) * 0.1;
                p.mesh.scale.setScalar(0.7 + Math.sin(time * 4 + i * 0.5) * 0.3);
            }
        }
    }

    createRepairNanites(player, type) {
        if (this.repairNanites) return;

        const r = (player.radius || 20) * 1.2;
        const group = new THREE.Group();
        const particles = [];

        const color = type === 'shield' ? 0x4488ff : 0xff8844;
        const count = 8;

        for (let i = 0; i < count; i++) {
            const geo = new THREE.CircleGeometry(1.5, 4);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.2,
                depthWrite: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            const angle = (i / count) * Math.PI * 2;
            mesh.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
            group.add(mesh);

            particles.push({
                mesh,
                angle,
                speed: 1.5 + Math.random() * 1.0, // rad/s
                offset: Math.random() * Math.PI * 2,
                floatSpeed: 1 + Math.random() * 0.5,
            });
        }

        group.position.set(player.x, player.y, 5);
        group.frustumCulled = false;
        this.parentGroup.add(group);
        this.repairNanites = { group, particles, type };
        this.repairNanitesActive = true;
    }

    removeRepairNanites() {
        if (this.repairNanites) {
            this.parentGroup.remove(this.repairNanites.group);
            this.repairNanites.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.repairNanites = null;
        }
        this.repairNanitesActive = false;
    }

    /**
     * Update tractor beam visuals from player to loot containers
     */
    updateTractorBeams(player, dt) {
        const targets = this.game.tractorTargets;
        if (!targets || !player?.alive) {
            this.clearTractorBeams();
            return;
        }

        const activeEntities = new Set();

        for (const [entity, data] of targets) {
            if (!entity.alive) continue;
            activeEntities.add(entity);

            if (!this.tractorBeams.has(entity)) {
                this.createTractorBeam(entity);
            }

            const tb = this.tractorBeams.get(entity);

            // Update line positions
            const positions = tb.line.geometry.attributes.position;
            positions.setXYZ(0, player.x, player.y, 5);
            positions.setXYZ(1, entity.x, entity.y, 5);
            positions.needsUpdate = true;
            tb.line.computeLineDistances();

            // Pulse opacity and intensity based on timer
            const intensity = Math.min(data.timer * 3, 1);
            const pulse = 0.4 + Math.sin(performance.now() * 0.008) * 0.15;
            tb.line.material.opacity = pulse * intensity;

            // Update glow at loot end
            tb.glow.position.set(entity.x, entity.y, 5);
            tb.glow.material.opacity = 0.3 * intensity * (0.7 + Math.sin(performance.now() * 0.01) * 0.3);
            const glowScale = 1 + Math.sin(performance.now() * 0.006) * 0.2;
            tb.glow.scale.set(glowScale, glowScale, 1);
        }

        // Remove stale tractor beams
        for (const [entity] of this.tractorBeams) {
            if (!activeEntities.has(entity)) {
                this.removeTractorBeam(entity);
            }
        }
    }

    /**
     * Create tractor beam visual to a loot container
     */
    createTractorBeam(entity) {
        // Dashed green line
        const points = [
            new THREE.Vector3(0, 0, 5),
            new THREE.Vector3(entity.x, entity.y, 5),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0x44ff88,
            transparent: true,
            opacity: 0.3,
            dashSize: 12,
            gapSize: 8,
            depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.frustumCulled = false;
        this.parentGroup.add(line);

        // Glow circle at loot end
        const glowGeo = new THREE.CircleGeometry(18, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x44ff88,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(entity.x, entity.y, 5);
        glow.frustumCulled = false;
        this.parentGroup.add(glow);

        this.tractorBeams.set(entity, { line, glow });
    }

    /**
     * Remove a tractor beam
     */
    removeTractorBeam(entity) {
        const tb = this.tractorBeams.get(entity);
        if (!tb) return;
        this.parentGroup.remove(tb.line);
        tb.line.geometry.dispose();
        tb.line.material.dispose();
        this.parentGroup.remove(tb.glow);
        tb.glow.geometry.dispose();
        tb.glow.material.dispose();
        this.tractorBeams.delete(entity);
    }

    /**
     * Clear all tractor beams
     */
    clearTractorBeams() {
        for (const [entity] of this.tractorBeams) {
            this.removeTractorBeam(entity);
        }
        this.tractorBeams.clear();
    }

    // =========================================
    // SALVAGE BEAM
    // =========================================

    /**
     * Update salvage beam visual from player to wreck being salvaged
     */
    updateSalvageBeam(player, dt) {
        // Find active salvaging wreck
        let activeWreck = null;
        const entities = this.game.currentSector?.entities || [];
        for (const e of entities) {
            if (e.type === 'wreck' && e.salvaging && e.alive) {
                activeWreck = e;
                break;
            }
        }

        if (!activeWreck || !player?.alive) {
            this.removeSalvageBeam();
            return;
        }

        // Create beam if needed
        if (!this.salvageBeam || this.salvageBeam.wreck !== activeWreck) {
            this.removeSalvageBeam();
            this.createSalvageBeam(activeWreck);
        }

        const sb = this.salvageBeam;
        if (!sb) return;

        // Update line positions
        const positions = sb.line.geometry.attributes.position;
        positions.setXYZ(0, player.x, player.y, 5);
        positions.setXYZ(1, activeWreck.x, activeWreck.y, 5);
        positions.needsUpdate = true;
        sb.line.computeLineDistances();

        // Pulse based on progress
        const progress = activeWreck.getSalvagePercent();
        const pulse = 0.3 + Math.sin(performance.now() * 0.006) * 0.15;
        sb.line.material.opacity = pulse * (0.5 + progress * 0.5);

        // Update glow at wreck end
        sb.glow.position.set(activeWreck.x, activeWreck.y, 5);
        sb.glow.material.opacity = 0.2 + progress * 0.3;
        const glowScale = 1 + Math.sin(performance.now() * 0.005) * 0.3 + progress * 0.5;
        sb.glow.scale.set(glowScale, glowScale, 1);

        // Spawn small particles flowing along beam
        if (Math.random() < 0.3) {
            const t = Math.random();
            const px = player.x + (activeWreck.x - player.x) * t;
            const py = player.y + (activeWreck.y - player.y) * t;
            this.game.renderer?.effects?.spawn('trail', px, py, {
                color: 0xbbaa88,
                size: 1 + Math.random(),
                lifetime: 0.4,
                vx: (player.x - activeWreck.x) * 0.3 * Math.random(),
                vy: (player.y - activeWreck.y) * 0.3 * Math.random(),
            });
        }
    }

    /**
     * Create salvage beam visual
     */
    createSalvageBeam(wreck) {
        const points = [
            new THREE.Vector3(0, 0, 5),
            new THREE.Vector3(wreck.x, wreck.y, 5),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0xbbaa88,
            transparent: true,
            opacity: 0.3,
            dashSize: 10,
            gapSize: 6,
            depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.frustumCulled = false;
        this.parentGroup.add(line);

        // Glow circle at wreck end
        const glowGeo = new THREE.CircleGeometry(22, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xbbaa88,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(wreck.x, wreck.y, 5);
        glow.frustumCulled = false;
        this.parentGroup.add(glow);

        this.salvageBeam = { line, glow, wreck };
    }

    /**
     * Remove salvage beam
     */
    removeSalvageBeam() {
        if (!this.salvageBeam) return;
        this.parentGroup.remove(this.salvageBeam.line);
        this.salvageBeam.line.geometry.dispose();
        this.salvageBeam.line.material.dispose();
        this.parentGroup.remove(this.salvageBeam.glow);
        this.salvageBeam.glow.geometry.dispose();
        this.salvageBeam.glow.material.dispose();
        this.salvageBeam = null;
    }

    /**
     * Clear all effects (sector change)
     */
    /**
     * Update persistent damage visuals - fire, sparks, electrical arcs, and smoke on damaged ships
     */
    updateDamageSmoke(entities, dt) {
        this.damageSmokeTimer += dt;
        if (this.damageSmokeTimer >= 0.08) { // Faster spawn rate for more particles
            this.damageSmokeTimer = 0;

            // Include player in damage smoke rendering
            const allShips = [];
            const player = this.game.player;
            if (player?.alive && player.hull !== undefined) allShips.push(player);
            for (const e of entities) {
                if (e.alive && e.hull !== undefined && e.maxHull !== undefined) allShips.push(e);
            }

            for (const entity of allShips) {
                if (entity.type === 'asteroid' || entity.type === 'loot' || entity.type === 'wreck') continue;

                const hullPct = entity.hull / entity.maxHull;
                if (hullPct >= 0.5) continue;

                const intensity = 1 - hullPct / 0.5; // 0 at 50%, 1 at 0%
                const r = entity.radius || 20;

                // === FIRE: Persistent flames on ship hull ===
                if (Math.random() < intensity * 0.6) {
                    const geo = new THREE.CircleGeometry(1.5 + Math.random() * 3 * intensity, 6);
                    const fireColors = [0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa44];
                    const mat = new THREE.MeshBasicMaterial({
                        color: fireColors[Math.floor(Math.random() * fireColors.length)],
                        transparent: true,
                        opacity: 0.7 + Math.random() * 0.3,
                        depthWrite: false,
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    // Attach to random point on hull
                    const ox = (Math.random() - 0.5) * r * 0.8;
                    const oy = (Math.random() - 0.5) * r * 0.8;
                    mesh.position.set(entity.x + ox, entity.y + oy, 7);
                    this.parentGroup.add(mesh);
                    this.damageSmoke.push({
                        mesh, entity,
                        offsetX: ox, offsetY: oy, // track relative to ship
                        life: 0,
                        maxLife: 0.2 + Math.random() * 0.3,
                        vx: (Math.random() - 0.5) * 10,
                        vy: 8 + Math.random() * 15,
                        particleType: 'fire',
                    });
                }

                // === SMOKE: Dark billowing clouds trailing behind ===
                if (Math.random() < intensity * 0.5) {
                    const geo = new THREE.CircleGeometry(2 + Math.random() * 5 * intensity, 6);
                    const mat = new THREE.MeshBasicMaterial({
                        color: Math.random() < 0.4 ? 0x332211 : 0x444444,
                        transparent: true,
                        opacity: 0.35,
                        depthWrite: false,
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    const ox = (Math.random() - 0.5) * r;
                    const oy = (Math.random() - 0.5) * r;
                    mesh.position.set(entity.x + ox, entity.y + oy, 6);
                    this.parentGroup.add(mesh);
                    // Drift opposite to ship heading (trail behind)
                    const backAngle = (entity.rotation || 0) + Math.PI;
                    this.damageSmoke.push({
                        mesh, entity,
                        offsetX: null, offsetY: null, // detached particles
                        life: 0,
                        maxLife: 0.8 + Math.random() * 1.2,
                        vx: Math.cos(backAngle) * (10 + Math.random() * 20) + (Math.random() - 0.5) * 15,
                        vy: Math.sin(backAngle) * (10 + Math.random() * 20) + 10 + Math.random() * 10,
                        particleType: 'smoke',
                    });
                }

                // === ELECTRICAL ARCS: Bright white/blue sparks that flash briefly ===
                if (hullPct < 0.35 && Math.random() < intensity * 0.35) {
                    const geo = new THREE.CircleGeometry(0.5 + Math.random() * 1, 4);
                    const mat = new THREE.MeshBasicMaterial({
                        color: Math.random() < 0.5 ? 0xffffff : 0x88ccff,
                        transparent: true,
                        opacity: 1,
                        depthWrite: false,
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    const ox = (Math.random() - 0.5) * r * 0.7;
                    const oy = (Math.random() - 0.5) * r * 0.7;
                    mesh.position.set(entity.x + ox, entity.y + oy, 8);
                    this.parentGroup.add(mesh);

                    // Arc jumps rapidly to nearby point
                    const arcAngle = Math.random() * Math.PI * 2;
                    const arcDist = 5 + Math.random() * 15;
                    this.damageSmoke.push({
                        mesh, entity,
                        offsetX: ox, offsetY: oy,
                        life: 0,
                        maxLife: 0.06 + Math.random() * 0.08, // Very brief flash
                        vx: Math.cos(arcAngle) * arcDist / 0.08,
                        vy: Math.sin(arcAngle) * arcDist / 0.08,
                        particleType: 'arc',
                    });

                    // Spawn a second linked arc particle for the "bolt" look
                    const geo2 = new THREE.CircleGeometry(0.3 + Math.random() * 0.5, 4);
                    const mat2 = new THREE.MeshBasicMaterial({
                        color: 0xaaddff,
                        transparent: true,
                        opacity: 0.9,
                        depthWrite: false,
                    });
                    const mesh2 = new THREE.Mesh(geo2, mat2);
                    mesh2.position.set(
                        entity.x + ox + Math.cos(arcAngle) * arcDist * 0.5,
                        entity.y + oy + Math.sin(arcAngle) * arcDist * 0.5,
                        8
                    );
                    this.parentGroup.add(mesh2);
                    this.damageSmoke.push({
                        mesh: mesh2, entity,
                        offsetX: ox + Math.cos(arcAngle) * arcDist * 0.5,
                        offsetY: oy + Math.sin(arcAngle) * arcDist * 0.5,
                        life: 0,
                        maxLife: 0.04 + Math.random() * 0.06,
                        vx: 0, vy: 0,
                        particleType: 'arc',
                    });
                }

                // === SPARKS: Bright embers flying off hull ===
                if (Math.random() < intensity * 0.4) {
                    const geo = new THREE.CircleGeometry(0.4 + Math.random() * 0.6, 4);
                    const sparkColors = [0xff6622, 0xffaa44, 0xffcc66, 0xffffff];
                    const mat = new THREE.MeshBasicMaterial({
                        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
                        transparent: true,
                        opacity: 1,
                        depthWrite: false,
                    });
                    const mesh = new THREE.Mesh(geo, mat);
                    const ox = (Math.random() - 0.5) * r;
                    const oy = (Math.random() - 0.5) * r;
                    mesh.position.set(entity.x + ox, entity.y + oy, 8);
                    this.parentGroup.add(mesh);

                    const sparkAngle = Math.random() * Math.PI * 2;
                    const sparkSpeed = 40 + Math.random() * 80;
                    this.damageSmoke.push({
                        mesh, entity,
                        offsetX: null, offsetY: null,
                        life: 0,
                        maxLife: 0.3 + Math.random() * 0.4,
                        vx: Math.cos(sparkAngle) * sparkSpeed,
                        vy: Math.sin(sparkAngle) * sparkSpeed,
                        particleType: 'spark',
                    });
                }
            }
        }

        // Update existing damage particles
        for (let i = this.damageSmoke.length - 1; i >= 0; i--) {
            const s = this.damageSmoke[i];
            s.life += dt;

            if (s.life >= s.maxLife || !s.entity?.alive) {
                this.parentGroup.remove(s.mesh);
                s.mesh.geometry.dispose();
                s.mesh.material.dispose();
                this.damageSmoke.splice(i, 1);
                continue;
            }

            const progress = s.life / s.maxLife;

            switch (s.particleType) {
                case 'fire':
                    // Fire follows ship, flickers, shrinks
                    if (s.offsetX !== null) {
                        s.mesh.position.x = s.entity.x + s.offsetX + s.vx * s.life;
                        s.mesh.position.y = s.entity.y + s.offsetY + s.vy * s.life;
                    }
                    s.mesh.material.opacity = (0.7 + Math.random() * 0.3) * (1 - progress);
                    s.mesh.scale.setScalar(1 + progress * 0.5); // slight expand
                    break;

                case 'smoke':
                    // Smoke detaches and drifts, expands
                    s.mesh.position.x += s.vx * dt;
                    s.mesh.position.y += s.vy * dt;
                    s.mesh.material.opacity = 0.35 * (1 - progress);
                    s.mesh.scale.setScalar(1 + progress * 3);
                    break;

                case 'arc':
                    // Electrical arcs: bright flash, jump to nearby position
                    if (s.offsetX !== null) {
                        s.mesh.position.x = s.entity.x + s.offsetX;
                        s.mesh.position.y = s.entity.y + s.offsetY;
                    }
                    // Flicker on/off rapidly
                    s.mesh.material.opacity = Math.random() > 0.3 ? 1 : 0;
                    break;

                case 'spark':
                    // Sparks fly outward, fade and shrink
                    s.mesh.position.x += s.vx * dt;
                    s.mesh.position.y += s.vy * dt;
                    s.mesh.material.opacity = 1 * (1 - progress);
                    s.mesh.scale.setScalar(Math.max(0.1, 1 - progress));
                    break;

                default:
                    // Legacy behavior
                    s.mesh.position.x += s.vx * dt;
                    s.mesh.position.y += s.vy * dt;
                    s.mesh.material.opacity = 0.4 * (1 - progress);
                    if (!s.isSpark) {
                        s.mesh.scale.setScalar(1 + progress * 2);
                    }
                    break;
            }
        }
    }

    /**
     * Spawn a brief pulse ring when shield booster or armor repairer cycles
     */
    spawnRepairPulse(entity, type) {
        if (!entity?.alive) return;
        const radius = (entity.radius || 20) * 1.2;

        // Color: shield=cyan/blue, armor=orange/gold
        const color = type === 'shield' ? 0x44ccff : 0xffaa44;
        const innerRatio = type === 'shield' ? 0.85 : 0.8;

        const geo = new THREE.RingGeometry(radius * innerRatio, radius, 20);
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(entity.x, entity.y, 3.5);
        this.parentGroup.add(mesh);

        this.shieldFlashes.push({
            mesh,
            entity,
            life: 0,
            maxLife: 0.5,
            expanding: true, // flag for repair pulse behavior
            baseRadius: radius,
            type,
        });
    }

    clear() {
        for (const [key] of this.beams) this.removeBeam(key);
        this.beams.clear();
        for (const [entity] of this.propFlares) this.removeFlare(entity);
        this.propFlares.clear();
        for (const flash of this.shieldFlashes) {
            this.parentGroup.remove(flash.mesh);
            flash.mesh.geometry.dispose();
            flash.mesh.material.dispose();
        }
        this.shieldFlashes = [];
        this.clearTractorBeams();
        this.removeSalvageBeam();
        this.removeShieldShimmer();
        this.removeDisruptionBubble();
        this.removeRepairNanites();
        for (const s of this.damageSmoke) {
            this.parentGroup.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        }
        this.damageSmoke = [];
    }
}
