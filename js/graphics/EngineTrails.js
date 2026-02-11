// =============================================
// Engine Trails
// Fading engine wakes behind moving ships.
// Each ship gets a trail of line segments that
// fade from bright to invisible over time.
// =============================================

const MAX_TRAIL_POINTS = 20;       // Points per trail
const TRAIL_SAMPLE_INTERVAL = 0.08; // Seconds between trail samples
const TRAIL_LIFETIME = 1.5;         // Seconds before trail point fades out
const MIN_SPEED_FOR_TRAIL = 15;     // Don't draw trails for stationary ships
const MAX_TRAILS = 60;              // Max simultaneous trails

export class EngineTrails {
    constructor(game, parentGroup) {
        this.game = game;
        this.parentGroup = parentGroup;
        this.trails = new Map(); // entity -> trail data
        this.sampleTimer = 0;
        this.engineGlows = new Map(); // entity -> glow mesh
    }

    /**
     * Update all engine trails
     */
    update(dt) {
        this.sampleTimer += dt;
        const shouldSample = this.sampleTimer >= TRAIL_SAMPLE_INTERVAL;
        if (shouldSample) this.sampleTimer = 0;

        const now = performance.now() * 0.001;
        const entities = this.game.currentSector?.entities;
        if (!entities) return;

        // Collect all ships that should have trails
        const shipsWithTrails = new Set();
        for (const entity of entities) {
            if (!entity.alive) continue;
            // Skip culled entities (LOD 2)
            if (entity._lodLevel === 2) continue;
            const isShip = entity.type === 'ship' || entity.type === 'enemy' ||
                entity.type === 'npc' || entity.type === 'guild' || entity.type === 'fleet';
            if (!isShip) continue;
            if ((entity.currentSpeed || 0) < MIN_SPEED_FOR_TRAIL) continue;
            shipsWithTrails.add(entity);
        }
        // Include player
        const player = this.game.player;
        if (player?.alive && (player.currentSpeed || 0) >= MIN_SPEED_FOR_TRAIL) {
            shipsWithTrails.add(player);
        }

        // Remove trails for dead/gone entities
        for (const [entity, trail] of this.trails) {
            if (!entity.alive || !shipsWithTrails.has(entity)) {
                // Fade out remaining trail
                if (trail.points.length > 0) {
                    trail.dying = true;
                } else {
                    this.removeTrail(entity);
                }
            }
        }

        // Sample positions for active ships
        if (shouldSample) {
            for (const entity of shipsWithTrails) {
                if (this.trails.size >= MAX_TRAILS && !this.trails.has(entity)) continue;

                let trail = this.trails.get(entity);
                if (!trail) {
                    trail = this.createTrail(entity);
                    this.trails.set(entity, trail);
                }

                if (!trail.dying) {
                    // Add new point
                    trail.points.push({
                        x: entity.x,
                        y: entity.y,
                        time: now,
                        speed: entity.currentSpeed || 0,
                    });

                    // Limit trail length
                    while (trail.points.length > MAX_TRAIL_POINTS) {
                        trail.points.shift();
                    }
                }
            }
        }

        // Update engine glow flames
        this.updateEngineGlows(shipsWithTrails);

        // Update trail meshes
        for (const [entity, trail] of this.trails) {
            // Prune expired points
            while (trail.points.length > 0 && (now - trail.points[0].time) > TRAIL_LIFETIME) {
                trail.points.shift();
            }

            if (trail.points.length < 2) {
                if (trail.dying) {
                    this.removeTrail(entity);
                }
                if (trail.mesh) trail.mesh.visible = false;
                if (trail.wakeMesh) trail.wakeMesh.visible = false;
                continue;
            }

            this.updateTrailMesh(trail, now);
        }
    }

    /**
     * Create a trail for an entity
     */
    createTrail(entity) {
        // Determine trail color based on entity properties
        let color = 0x4488ff; // Default blue
        if (entity.isPlayer) {
            color = 0x00ccff;
        } else if (entity.hostility === 'hostile' || entity.isPirate) {
            color = 0xff4444;
        } else if (entity.factionId === 'ore-extraction-syndicate') {
            color = 0xffaa44;
        } else if (entity.factionId === 'stellar-logistics') {
            color = 0x44ddff;
        } else if (entity.factionId === 'void-hunters') {
            color = 0xff4466;
        } else if (entity.factionId === 'frontier-alliance') {
            color = 0x44ff88;
        } else if (entity.type === 'ship' && entity.role === 'security') {
            color = 0x4488ff;
        }

        // Create line geometry with max points pre-allocated
        const positions = new Float32Array(MAX_TRAIL_POINTS * 3);
        const opacities = new Float32Array(MAX_TRAIL_POINTS);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });

        const mesh = new THREE.Line(geometry, material);
        mesh.frustumCulled = false;
        this.parentGroup.add(mesh);

        // Wake turbulence for large ships (radius > 80 = battlecruiser+)
        let wakeMesh = null;
        let wakePositions = null;
        const shipRadius = entity.radius || 20;
        const isLargeShip = shipRadius > 80;

        if (isLargeShip) {
            wakePositions = new Float32Array(MAX_TRAIL_POINTS * 3);
            const wakeGeo = new THREE.BufferGeometry();
            wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3));

            wakeMesh = new THREE.Line(wakeGeo, new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
            }));
            wakeMesh.frustumCulled = false;
            this.parentGroup.add(wakeMesh);
        }

        return {
            entity,
            points: [],
            mesh,
            positions,
            color,
            dying: false,
            wakeMesh,
            wakePositions,
            isLargeShip,
            shipRadius,
        };
    }

    /**
     * Update the trail mesh geometry from its point list
     */
    updateTrailMesh(trail, now) {
        const { points, mesh, positions } = trail;
        if (!mesh) return;

        mesh.visible = true;

        // Update positions
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = 1; // Just above shadows
        }

        // Zero out unused positions (set to last valid point to avoid lines to origin)
        if (points.length > 0) {
            const last = points[points.length - 1];
            for (let i = points.length; i < MAX_TRAIL_POINTS; i++) {
                positions[i * 3] = last.x;
                positions[i * 3 + 1] = last.y;
                positions[i * 3 + 2] = 1;
            }
        }

        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.setDrawRange(0, points.length);

        // Opacity based on newest point's age
        const newestAge = points.length > 0 ? (now - points[points.length - 1].time) : TRAIL_LIFETIME;
        const ageFactor = 1 - Math.min(newestAge / TRAIL_LIFETIME, 1);

        // Speed-based intensity (faster = brighter trail)
        const avgSpeed = points.reduce((s, p) => s + p.speed, 0) / points.length;
        const speedFactor = Math.min(avgSpeed / 200, 1);

        mesh.material.opacity = 0.15 + speedFactor * 0.35 * ageFactor;

        // Update wake turbulence mesh for large ships
        if (trail.wakeMesh && trail.wakePositions && points.length >= 2) {
            const wakePos = trail.wakePositions;
            const wakeSpread = trail.shipRadius * 0.4;
            const time = now * 2;

            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                const age = (now - p.time) / TRAIL_LIFETIME;
                // Perpendicular offset from trail + sinusoidal wobble
                const wobble = Math.sin(time + i * 0.7) * wakeSpread * (0.5 + age * 0.5);
                // Get direction perpendicular to trail
                let perpX = 0, perpY = 0;
                if (i < points.length - 1) {
                    const dx = points[i + 1].x - p.x;
                    const dy = points[i + 1].y - p.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    perpX = -dy / len;
                    perpY = dx / len;
                } else if (i > 0) {
                    const dx = p.x - points[i - 1].x;
                    const dy = p.y - points[i - 1].y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    perpX = -dy / len;
                    perpY = dx / len;
                }
                wakePos[i * 3] = p.x + perpX * wobble;
                wakePos[i * 3 + 1] = p.y + perpY * wobble;
                wakePos[i * 3 + 2] = 0.5;
            }

            // Zero unused
            if (points.length > 0) {
                const last = points[points.length - 1];
                for (let i = points.length; i < MAX_TRAIL_POINTS; i++) {
                    wakePos[i * 3] = last.x;
                    wakePos[i * 3 + 1] = last.y;
                    wakePos[i * 3 + 2] = 0.5;
                }
            }

            trail.wakeMesh.geometry.attributes.position.needsUpdate = true;
            trail.wakeMesh.geometry.setDrawRange(0, points.length);
            trail.wakeMesh.visible = true;
            trail.wakeMesh.material.opacity = 0.08 + speedFactor * 0.12 * ageFactor;
        }
    }

    /**
     * Remove a trail
     */
    removeTrail(entity) {
        const trail = this.trails.get(entity);
        if (!trail) return;

        if (trail.mesh) {
            this.parentGroup.remove(trail.mesh);
            trail.mesh.geometry.dispose();
            trail.mesh.material.dispose();
        }
        if (trail.wakeMesh) {
            this.parentGroup.remove(trail.wakeMesh);
            trail.wakeMesh.geometry.dispose();
            trail.wakeMesh.material.dispose();
        }
        this.trails.delete(entity);
    }

    updateEngineGlows(activeShips) {
        const time = performance.now() * 0.001;

        // Remove or hide glows for entities that are gone or culled
        for (const [entity, glowData] of this.engineGlows) {
            if (!entity.alive) {
                // Dead entity - fully dispose
                if (glowData.core) { this.parentGroup.remove(glowData.core); glowData.core.geometry.dispose(); glowData.core.material.dispose(); }
                if (glowData.outer) { this.parentGroup.remove(glowData.outer); glowData.outer.geometry.dispose(); glowData.outer.material.dispose(); }
                if (glowData.bloom) { this.parentGroup.remove(glowData.bloom); glowData.bloom.geometry.dispose(); glowData.bloom.material.dispose(); }
                this.engineGlows.delete(entity);
            } else if (!activeShips.has(entity)) {
                // Still alive but LOD-culled or stopped - hide to avoid dispose/recreate churn
                if (glowData.core) glowData.core.visible = false;
                if (glowData.outer) glowData.outer.visible = false;
                if (glowData.bloom) glowData.bloom.visible = false;
            }
        }

        // Create/update glows for active ships
        for (const entity of activeShips) {
            let glowData = this.engineGlows.get(entity);
            if (!glowData) {
                let baseColor = 0x4488ff;
                if (entity.hostility === 'hostile' || entity.isPirate) baseColor = 0xff4422;
                else if (entity.isPlayer) baseColor = 0x00ccff;
                else if (entity.type === 'fleet') baseColor = 0x00ffcc;

                // Core flame (bright, white-hot center)
                const coreGeo = new THREE.CircleGeometry(1, 8);
                const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
                const core = new THREE.Mesh(coreGeo, coreMat);
                core.position.z = 4;
                this.parentGroup.add(core);

                // Outer flame (colored glow)
                const outerGeo = new THREE.CircleGeometry(1, 8);
                const outerMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0, depthWrite: false });
                const outer = new THREE.Mesh(outerGeo, outerMat);
                outer.position.z = 3.5;
                this.parentGroup.add(outer);

                // Bloom halo (large, very faint)
                const bloomGeo = new THREE.CircleGeometry(1, 12);
                const bloomMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0, depthWrite: false });
                const bloom = new THREE.Mesh(bloomGeo, bloomMat);
                bloom.position.z = 3;
                this.parentGroup.add(bloom);

                glowData = { core, outer, bloom, baseColor, particleTimer: 0 };
                this.engineGlows.set(entity, glowData);
            }

            const speed = entity.currentSpeed || 0;
            const maxSpeed = entity.maxSpeed || 200;
            const speedRatio = Math.min(speed / maxSpeed, 1);

            if (speedRatio < 0.05) {
                glowData.core.visible = false;
                glowData.outer.visible = false;
                glowData.bloom.visible = false;
                continue;
            }

            glowData.core.visible = true;
            glowData.outer.visible = true;
            glowData.bloom.visible = true;

            const r = entity.radius || 20;
            const rearDist = r * 0.7;
            const rot = entity.rotation || 0;
            const rearX = entity.x - Math.cos(rot) * rearDist;
            const rearY = entity.y - Math.sin(rot) * rearDist;

            // Check for MWD/Afterburner active by scanning active module slot IDs
            let hasMWD = false, hasAB = false;
            if (entity.activeModules && entity.modules) {
                for (const slotId of entity.activeModules) {
                    const parts = slotId.split('-');
                    const slotType = parts[0];
                    const slotIndex = parseInt(parts[1]);
                    const moduleId = entity.modules[slotType]?.[slotIndex] || '';
                    if (moduleId.startsWith('microwarpdrive')) hasMWD = true;
                    if (moduleId.startsWith('afterburner')) hasAB = true;
                }
            }
            const propBoost = hasMWD ? 2.0 : (hasAB ? 1.4 : 1.0);

            // Flicker patterns
            const flicker1 = 0.8 + Math.sin(time * 18 + entity.x * 0.02) * 0.2;
            const flicker2 = 0.85 + Math.sin(time * 25 + entity.y * 0.03) * 0.15;
            const pulseFlicker = hasMWD ? (0.7 + Math.sin(time * 8) * 0.3) : 1.0;

            // Core (white-hot, compact)
            const coreLen = r * 0.3 * (0.4 + speedRatio * 0.6) * propBoost;
            const coreWidth = r * 0.12 * (0.5 + speedRatio * 0.5);
            glowData.core.position.set(rearX - Math.cos(rot) * coreLen * 0.3, rearY - Math.sin(rot) * coreLen * 0.3, 4);
            glowData.core.scale.set(coreLen, coreWidth, 1);
            glowData.core.rotation.z = rot;
            glowData.core.material.opacity = speedRatio * 0.7 * flicker1 * pulseFlicker;
            // Shift core color for MWD (blue-white → pure white)
            glowData.core.material.color.setHex(hasMWD ? 0xccddff : 0xffffff);

            // Outer flame (colored, wider and longer)
            const outerLen = r * 0.5 * (0.3 + speedRatio * 0.7) * propBoost;
            const outerWidth = r * 0.2 * (0.5 + speedRatio * 0.5) * propBoost;
            glowData.outer.position.set(rearX - Math.cos(rot) * outerLen * 0.2, rearY - Math.sin(rot) * outerLen * 0.2, 3.5);
            glowData.outer.scale.set(outerLen, outerWidth, 1);
            glowData.outer.rotation.z = rot;
            glowData.outer.material.opacity = speedRatio * 0.45 * flicker2 * pulseFlicker;
            // MWD overdrives the color to electric blue
            if (hasMWD) {
                glowData.outer.material.color.setHex(0x2266ff);
            } else {
                glowData.outer.material.color.setHex(glowData.baseColor);
            }

            // Bloom halo (very wide, faint)
            const bloomLen = r * 0.7 * (0.2 + speedRatio * 0.8) * propBoost;
            const bloomWidth = r * 0.35 * (0.3 + speedRatio * 0.7) * propBoost;
            glowData.bloom.position.set(rearX, rearY, 3);
            glowData.bloom.scale.set(bloomLen, bloomWidth, 1);
            glowData.bloom.rotation.z = rot;
            glowData.bloom.material.opacity = speedRatio * 0.15 * pulseFlicker;

            // Spawn exhaust particles at high speed
            const dt = this.game._lastDt || 0.016;
            glowData.particleTimer = (glowData.particleTimer || 0) + dt;
            const spawnRate = hasMWD ? 0.02 : (hasAB ? 0.04 : 0.06);
            if (speedRatio > 0.3 && glowData.particleTimer >= spawnRate) {
                glowData.particleTimer = 0;
                const effects = this.game.renderer?.effects;
                if (effects) {
                    const count = hasMWD ? 3 : (speedRatio > 0.7 ? 2 : 1);
                    for (let i = 0; i < count; i++) {
                        const p = effects.getParticle();
                        if (!p) break;
                        const spread = (Math.random() - 0.5) * 0.6;
                        const ejectAngle = rot + Math.PI + spread;
                        const ejectSpeed = 30 + speedRatio * 80 + (hasMWD ? 60 : 0);
                        const sparkX = rearX + (Math.random() - 0.5) * r * 0.15;
                        const sparkY = rearY + (Math.random() - 0.5) * r * 0.15;
                        p.position.set(sparkX, sparkY, 3.5);
                        const sparkSize = (0.5 + Math.random() * 0.8) * Math.min(r / 30, 2);
                        p.scale.setScalar(sparkSize);
                        // Color: white-hot center particles, colored outer
                        const isHot = Math.random() < 0.3;
                        p.material.color.setHex(isHot ? 0xffffff : (hasMWD ? 0x4488ff : glowData.baseColor));
                        p.material.opacity = 0.6 + Math.random() * 0.3;
                        p.visible = true;
                        p.userData.active = true;
                        p.userData.vx = Math.cos(ejectAngle) * ejectSpeed + (entity.vx || 0) * 0.3;
                        p.userData.vy = Math.sin(ejectAngle) * ejectSpeed + (entity.vy || 0) * 0.3;
                        p.userData.life = 0;
                        p.userData.maxLife = 0.15 + Math.random() * 0.2;
                        p.userData.fadeOut = true;
                        p.userData.shrink = true;
                        p.userData.startScale = sparkSize;
                    }
                }
            }
        }
    }

    /**
     * Clear all trails (sector change)
     */
    clear() {
        for (const [entity] of this.trails) {
            this.removeTrail(entity);
        }
        this.trails.clear();
        for (const [entity, glowData] of this.engineGlows) {
            if (glowData.core) { this.parentGroup.remove(glowData.core); glowData.core.geometry.dispose(); glowData.core.material.dispose(); }
            if (glowData.outer) { this.parentGroup.remove(glowData.outer); glowData.outer.geometry.dispose(); glowData.outer.material.dispose(); }
            if (glowData.bloom) { this.parentGroup.remove(glowData.bloom); glowData.bloom.geometry.dispose(); glowData.bloom.material.dispose(); }
        }
        this.engineGlows.clear();
    }
}
