// =============================================
// Autopilot System
// Handles approach, orbit, keep-at-range, warp
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { wrappedDirection, wrappedDistance } from '../utils/math.js';
import { ObstacleAvoidance } from '../utils/ObstacleAvoidance.js';

export class AutopilotSystem {
    constructor(game) {
        this.game = game;

        // Current autopilot command
        this.command = null; // 'approach', 'orbit', 'keepAtRange', 'warp'
        this.target = null;
        this.distance = 0;

        // Warp state
        this.warping = false;
        this.warpTarget = null;
        this.alignTimer = 0;
        this.aligning = false;
        this.alignTimeTotal = 0;

        // Multi-sector route
        this.route = [];        // Array of sector IDs to traverse
        this.routeIndex = 0;    // Current position in route

        // Autopilot capacitor threshold (for tiered speed)
        this.capThreshold = 0.50; // Default: Standard (50%)
        this._capWaitTimer = null;
    }

    /**
     * Update autopilot
     */
    update(dt) {
        const player = this.game.player;
        if (!player || !player.alive) return;

        // Handle warping
        if (this.warping) {
            this.updateWarp(dt);
            return;
        }

        // Handle alignment before warp
        if (this.aligning) {
            this.updateAlignment(dt);
            return;
        }

        // Handle normal autopilot commands
        if (!this.command) {
            // Engine trail when moving
            this.updateEngineTrail(player, dt);
            return;
        }

        // For commands that require a target (not approachPosition), check target validity
        if (this.command !== 'approachPosition') {
            if (!this.target) {
                this.updateEngineTrail(player, dt);
                return;
            }
            // Check if target still valid
            if (!this.target.alive) {
                this.game.ui?.log('Target lost - autopilot disengaged', 'system');
                this.stop();
                return;
            }
        }

        switch (this.command) {
            case 'approach':
                this.updateApproach(player, dt);
                break;
            case 'approachPosition':
                this.updateApproachPosition(player, dt);
                break;
            case 'orbit':
                this.updateOrbit(player, dt);
                break;
            case 'keepAtRange':
                this.updateKeepAtRange(player, dt);
                break;
        }

        // Engine trail
        this.updateEngineTrail(player, dt);
    }

    /**
     * Update approach command
     */
    updateApproach(player, dt) {
        const dist = wrappedDistance(
            player.x, player.y,
            this.target.x, this.target.y,
            CONFIG.SECTOR_SIZE
        );

        // Stop when close enough
        const minDist = (this.target.radius || 30) + player.radius + 50;
        if (dist < minDist) {
            player.stop();
            return;
        }

        // Set destination
        const angle = wrappedDirection(
            player.x, player.y,
            this.target.x, this.target.y,
            CONFIG.SECTOR_SIZE
        );

        // Apply obstacle avoidance
        const entities = this.game.currentSector?.entities || [];
        const avoidance = ObstacleAvoidance.getAvoidance(player, angle, entities);

        player.desiredRotation = avoidance.angle;
        player.desiredSpeed = player.maxSpeed * avoidance.speedMultiplier;
    }

    /**
     * Update approach to position (no target entity)
     */
    updateApproachPosition(player, dt) {
        if (!this.targetPosition) {
            this.stop();
            return;
        }

        const dist = wrappedDistance(
            player.x, player.y,
            this.targetPosition.x, this.targetPosition.y,
            CONFIG.SECTOR_SIZE
        );

        // Stop when very close to destination
        const stopDistance = player.radius + 5;
        if (dist < stopDistance) {
            player.stop();
            this.command = null;
            this.targetPosition = null;
            return;
        }

        // Set destination
        const angle = wrappedDirection(
            player.x, player.y,
            this.targetPosition.x, this.targetPosition.y,
            CONFIG.SECTOR_SIZE
        );

        // Apply obstacle avoidance
        const entities = this.game.currentSector?.entities || [];
        const avoidance = ObstacleAvoidance.getAvoidance(player, angle, entities);

        player.desiredRotation = avoidance.angle;
        player.desiredSpeed = player.maxSpeed * avoidance.speedMultiplier;

    }

    /**
     * Update orbit command - true circular path at specified distance
     */
    updateOrbit(player, dt) {
        const dist = wrappedDistance(
            player.x, player.y,
            this.target.x, this.target.y,
            CONFIG.SECTOR_SIZE
        );

        const orbitRadius = this.distance;

        // Safety: break orbit if player drifts near planet
        const sector = this.game.currentSector;
        if (sector?.centralPlanet) {
            const pDist = wrappedDistance(player.x, player.y,
                sector.centralPlanet.x, sector.centralPlanet.y, CONFIG.SECTOR_SIZE);
            if (pDist < CONFIG.CENTRAL_PLANET.minOrbitDistance + 200) {
                this.denyOrder('Breaking orbit - too close to planet');
                this.stop();
                // Steer away from planet
                player.desiredRotation = wrappedDirection(
                    sector.centralPlanet.x, sector.centralPlanet.y,
                    player.x, player.y, CONFIG.SECTOR_SIZE
                );
                player.desiredSpeed = player.maxSpeed;
                return;
            }
        }

        // Calculate current angle from target to player
        const currentAngle = wrappedDirection(
            this.target.x, this.target.y,
            player.x, player.y,
            CONFIG.SECTOR_SIZE
        );

        // Angular velocity: v/r gives consistent circular speed
        const orbitSpeed = (player.maxSpeed * 0.7) / orbitRadius;
        const angularStep = orbitSpeed * dt;
        const nextAngle = currentAngle + angularStep;

        // Update player's orbit phase for visual effects (player-only)
        if (player.isPlayer) {
            player.orbitPhase += angularStep;
            if (player.orbitPhase >= Math.PI * 2) {
                player.orbitPhase -= Math.PI * 2;
            }
        }

        // Desired position on the circle (true circle, no ellipse compression)
        const goalX = this.target.x + Math.cos(nextAngle) * orbitRadius;
        const goalY = this.target.y + Math.sin(nextAngle) * orbitRadius;

        // Steer toward the goal point on the circle
        const steerAngle = wrappedDirection(
            player.x, player.y,
            goalX, goalY,
            CONFIG.SECTOR_SIZE
        );

        // Tangent direction (perpendicular to radius, counterclockwise)
        const tangentAngle = currentAngle + Math.PI / 2;

        // Radial error
        const radiusError = dist - orbitRadius;
        const radiusErrorAbs = Math.abs(radiusError);

        if (radiusErrorAbs > 150) {
            // Far from orbit — fly directly to the goal point on the circle
            player.desiredRotation = steerAngle;
        } else if (radiusErrorAbs > 5) {
            // Near orbit — blend tangent with radial correction proportionally
            const correctionWeight = Math.min(radiusErrorAbs / 150, 0.6);
            // Radial correction: inward if too far, outward if too close
            const radialAngle = radiusError > 0
                ? wrappedDirection(player.x, player.y, this.target.x, this.target.y, CONFIG.SECTOR_SIZE)
                : wrappedDirection(this.target.x, this.target.y, player.x, player.y, CONFIG.SECTOR_SIZE);
            const blendedAngle = Math.atan2(
                Math.sin(tangentAngle) * (1 - correctionWeight) + Math.sin(radialAngle) * correctionWeight,
                Math.cos(tangentAngle) * (1 - correctionWeight) + Math.cos(radialAngle) * correctionWeight
            );
            player.desiredRotation = blendedAngle;
        } else {
            // On orbit — pure tangent
            player.desiredRotation = tangentAngle;
        }

        // Apply obstacle avoidance to orbit path
        const entities = this.game.currentSector?.entities || [];
        const avoidance = ObstacleAvoidance.getAvoidance(player, player.desiredRotation, entities);
        player.desiredRotation = avoidance.angle;
        player.desiredSpeed = player.maxSpeed * 0.7 * avoidance.speedMultiplier;
    }

    /**
     * Update keep-at-range command
     */
    updateKeepAtRange(player, dt) {
        const dist = wrappedDistance(
            player.x, player.y,
            this.target.x, this.target.y,
            CONFIG.SECTOR_SIZE
        );

        const tolerance = 100;

        if (dist < this.distance - tolerance) {
            // Too close, move away
            const awayAngle = wrappedDirection(
                this.target.x, this.target.y,
                player.x, player.y,
                CONFIG.SECTOR_SIZE
            );
            player.desiredRotation = awayAngle;
            player.desiredSpeed = player.maxSpeed * 0.5;
        } else if (dist > this.distance + tolerance) {
            // Too far, move closer
            const towardsAngle = wrappedDirection(
                player.x, player.y,
                this.target.x, this.target.y,
                CONFIG.SECTOR_SIZE
            );
            player.desiredRotation = towardsAngle;
            player.desiredSpeed = player.maxSpeed * 0.5;
        } else {
            // At correct range, slow down
            player.desiredSpeed = 0;
            return; // No movement, no avoidance needed
        }

        // Apply obstacle avoidance
        const entities = this.game.currentSector?.entities || [];
        const avoidance = ObstacleAvoidance.getAvoidance(player, player.desiredRotation, entities);
        player.desiredRotation = avoidance.angle;
        player.desiredSpeed *= avoidance.speedMultiplier;
    }

    /**
     * Check if a position is safe (not inside planet kill zone or dense asteroid cluster)
     * Returns { safe: true } or { safe: false, reason: string }
     */
    checkPositionSafety(x, y) {
        const sector = this.game.currentSector;
        if (!sector) return { safe: true };

        // Check central planet kill zone
        if (sector.centralPlanet) {
            const planetDist = wrappedDistance(
                x, y,
                sector.centralPlanet.x, sector.centralPlanet.y,
                CONFIG.SECTOR_SIZE
            );
            if (planetDist < CONFIG.CENTRAL_PLANET.minOrbitDistance) {
                return { safe: false, reason: 'Too close to planet gravity well' };
            }
        }

        return { safe: true };
    }

    /**
     * Deny an order with warning beep and toast
     */
    denyOrder(reason) {
        this.game.audio?.play('warning');
        this.game.ui?.showToast(reason, 'warning');
        this.game.ui?.log(`Order denied: ${reason}`, 'system');
    }

    /**
     * Approach a target
     */
    approach(target) {
        // Safety: don't approach into planet kill zone
        const check = this.checkPositionSafety(target.x, target.y);
        if (!check.safe) {
            this.denyOrder(check.reason);
            return;
        }
        this.command = 'approach';
        this.target = target;
        this.game.ui?.log(`Approaching ${target.name}`, 'system');
    }

    /**
     * Approach a position in space (no target entity)
     */
    approachPosition(x, y) {
        const check = this.checkPositionSafety(x, y);
        if (!check.safe) {
            this.denyOrder(check.reason);
            return;
        }
        this.command = 'approachPosition';
        this.targetPosition = { x, y };
        this.target = null;
        this.game.ui?.log('Approaching location', 'system');
    }

    /**
     * Orbit a target at distance
     */
    orbit(target, distance = 500) {
        // Safety: check if orbit path intersects planet kill zone
        const orbitRadius = distance + (target.radius || 0);
        const sector = this.game.currentSector;
        if (sector?.centralPlanet) {
            const targetToPlanet = wrappedDistance(
                target.x, target.y,
                sector.centralPlanet.x, sector.centralPlanet.y,
                CONFIG.SECTOR_SIZE
            );
            // If orbit could swing inside planet safety zone
            if (targetToPlanet - orbitRadius < CONFIG.CENTRAL_PLANET.minOrbitDistance) {
                const playerToPlanet = wrappedDistance(
                    this.game.player.x, this.game.player.y,
                    sector.centralPlanet.x, sector.centralPlanet.y,
                    CONFIG.SECTOR_SIZE
                );
                // Only block if the orbit ring actually gets dangerously close
                if (targetToPlanet < CONFIG.CENTRAL_PLANET.minOrbitDistance + orbitRadius) {
                    this.denyOrder('Orbit path too close to planet gravity well');
                    return;
                }
            }
        }
        this.command = 'orbit';
        this.target = target;
        this.distance = orbitRadius;
        if (this.game.player?.isPlayer) {
            this.game.player.orbitPhase = 0;
        }
        this.game.ui?.log(`Orbiting ${target.name} at ${distance}m`, 'system');
    }

    /**
     * Keep at range from target
     */
    keepAtRange(target, distance = 1000) {
        const check = this.checkPositionSafety(target.x, target.y);
        if (!check.safe) {
            this.denyOrder(check.reason);
            return;
        }
        this.command = 'keepAtRange';
        this.target = target;
        this.distance = distance + (target.radius || 0);
        this.game.ui?.log(`Keeping ${distance}m from ${target.name}`, 'system');
    }

    /**
     * Warp to a target
     */
    warpTo(target) {
        const player = this.game.player;
        if (!player || !player.alive) return;

        // Check if warp disrupted
        if (player.warpDisrupted) {
            this.game.ui?.log('Warp drive disabled!', 'system');
            this.game.audio?.play('warning');
            return;
        }

        // Check capacitor (need at least 25% to initiate warp)
        const capPercent = (player.capacitor / player.maxCapacitor) * 100;
        if (capPercent < 25) {
            this.game.ui?.log('Insufficient capacitor for warp!', 'system');
            this.game.ui?.showToast('Capacitor too low to warp', 'warning');
            this.game.audio?.play('warning');
            return;
        }

        // Check minimum distance
        const dist = wrappedDistance(
            player.x, player.y,
            target.x, target.y,
            CONFIG.SECTOR_SIZE
        );

        if (dist < 1000) {
            this.game.ui?.log('Target too close for warp', 'system');
            return;
        }

        // Safety: check if warp destination is near planet kill zone
        const landingDist = (target.radius || 50) + 200;
        const check = this.checkPositionSafety(target.x, target.y);
        if (!check.safe) {
            this.denyOrder(check.reason);
            return;
        }

        // Start alignment - time scales with ship size (signature radius)
        this.warpTarget = target;
        this.aligning = true;
        const sigRadius = player.signatureRadius || 30;
        this.alignTimer = Math.min(12, Math.max(2, 2 + (sigRadius / 100) * 8));
        this.alignTimeTotal = this.alignTimer;

        this.game.ui?.log(`Aligning to ${target.name}...`, 'warp');
        this.game.audio?.play('warp-start');

        // Clear current command
        this.command = null;
        this.target = null;
    }

    /**
     * Update warp alignment
     */
    updateAlignment(dt) {
        const player = this.game.player;
        if (!this.warpTarget || !this.warpTarget.alive) {
            this.cancelWarp();
            return;
        }

        // Check if still disrupted
        if (player.warpDisrupted) {
            this.cancelWarp();
            this.game.ui?.log('Warp disrupted!', 'system');
            return;
        }

        // Turn towards target
        const targetAngle = wrappedDirection(
            player.x, player.y,
            this.warpTarget.x, this.warpTarget.y,
            CONFIG.SECTOR_SIZE
        );

        player.desiredRotation = targetAngle;
        const alignProgress = 1 - (this.alignTimer / (this.alignTimeTotal || 3));
        player.desiredSpeed = player.maxSpeed * (0.3 + alignProgress * 0.5);

        // Count down alignment
        this.alignTimer -= dt;

        if (this.alignTimer <= 0) {
            this.startWarp();
        }
    }

    /**
     * Start the actual warp - instant teleport with brief visual effect
     */
    startWarp() {
        const player = this.game.player;

        this.aligning = false;
        this.warping = true;

        // Show warp tunnel effect
        const tunnel = document.getElementById('warp-tunnel');
        const destLabel = document.getElementById('warp-destination');
        const warpDestText = document.getElementById('warp-destination-text');
        if (tunnel) tunnel.classList.remove('hidden');
        const warpName = this.warpTarget?.name || 'WARPING';
        if (destLabel) destLabel.textContent = warpName;
        if (warpDestText) warpDestText.textContent = `WARPING TO: ${warpName}`;
        this.game.ui?.log('Warp drive active!', 'warp');
        this.startWarpStreaks();

        // Departure effect at current position
        const warpAngle = Math.atan2(this.warpTarget.y - player.y, this.warpTarget.x - player.x);
        this.game.renderer?.effects?.spawn('warp-departure', player.x, player.y, { angle: warpAngle });

        // Drain all capacitor
        if (player.capacitor !== undefined) {
            player.capacitor = 0;
        }

        // Instant teleport to destination - pick safe landing spot
        const landingDist = (this.warpTarget.radius || 50) + 200;
        let landingAngle = Math.random() * Math.PI * 2;
        let landX = this.warpTarget.x + Math.cos(landingAngle) * landingDist;
        let landY = this.warpTarget.y + Math.sin(landingAngle) * landingDist;

        // Nudge landing away from planet and asteroids
        const sector = this.game.currentSector;
        for (let attempt = 0; attempt < 8; attempt++) {
            let blocked = false;

            // Check planet proximity
            if (sector?.centralPlanet) {
                const pDist = wrappedDistance(landX, landY,
                    sector.centralPlanet.x, sector.centralPlanet.y, CONFIG.SECTOR_SIZE);
                if (pDist < CONFIG.CENTRAL_PLANET.minOrbitDistance) blocked = true;
            }

            // Check asteroid proximity
            if (!blocked && sector?.entities) {
                for (const ent of sector.entities) {
                    if (ent.type !== 'asteroid' || !ent.alive) continue;
                    const aDist = wrappedDistance(landX, landY, ent.x, ent.y, CONFIG.SECTOR_SIZE);
                    if (aDist < (ent.radius || 30) + player.radius + 80) {
                        blocked = true;
                        break;
                    }
                }
            }

            if (!blocked) break;
            landingAngle += Math.PI / 4;
            landX = this.warpTarget.x + Math.cos(landingAngle) * landingDist;
            landY = this.warpTarget.y + Math.sin(landingAngle) * landingDist;
        }

        player.x = landX;
        player.y = landY;
        player.velocity.set(0, 0);
        player.currentSpeed = 0;

        // Brief warp tunnel display then cleanup
        setTimeout(() => {
            this.stopWarpStreaks();
            document.getElementById('warp-tunnel').classList.add('hidden');
            this.warping = false;
            this.warpTarget = null;

            this.game.ui?.log('Warp complete', 'warp');
            this.game.audio?.play('warp-end');
            // Warp arrival flash
            this.game.renderer?.effects?.spawn('warp-flash', player.x, player.y);
            // Navigation XP for warping
            this.game.skillSystem?.onWarp(landingDist);
        }, 1000);
    }

    startWarpStreaks() {
        const canvas = document.getElementById('warp-streaks-canvas');
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxR = Math.sqrt(cx * cx + cy * cy) * 1.2;

        // Generate streak particles
        this._warpStreaks = [];
        for (let i = 0; i < 120; i++) {
            const angle = Math.random() * Math.PI * 2;
            this._warpStreaks.push({
                angle,
                r: Math.random() * maxR,
                speed: 800 + Math.random() * 1200,
                length: 20 + Math.random() * 60,
                width: 0.5 + Math.random() * 1.5,
                hue: 200 + Math.random() * 40,
                alpha: 0.3 + Math.random() * 0.5,
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const dt = 0.016;
            for (const s of this._warpStreaks) {
                s.r += s.speed * dt;
                if (s.r > maxR) {
                    s.r = 20 + Math.random() * 50;
                    s.angle = Math.random() * Math.PI * 2;
                }

                const cos = Math.cos(s.angle);
                const sin = Math.sin(s.angle);
                const x1 = cx + cos * s.r;
                const y1 = cy + sin * s.r;
                const x2 = cx + cos * (s.r - s.length * (s.r / maxR));
                const y2 = cy + sin * (s.r - s.length * (s.r / maxR));

                const distFactor = s.r / maxR;
                ctx.strokeStyle = `hsla(${s.hue}, 80%, 70%, ${s.alpha * distFactor})`;
                ctx.lineWidth = s.width * (0.5 + distFactor);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            this._warpStreakRAF = requestAnimationFrame(animate);
        };
        this._warpStreakRAF = requestAnimationFrame(animate);
    }

    stopWarpStreaks() {
        if (this._warpStreakRAF) {
            cancelAnimationFrame(this._warpStreakRAF);
            this._warpStreakRAF = null;
        }
        this._warpStreaks = null;
        const canvas = document.getElementById('warp-streaks-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    /**
     * Update warp travel
     */
    updateWarp(dt) {
        // Warp is instant - this just waits for the brief visual effect to finish
        // The warping flag is cleared by the setTimeout in startWarp()
    }

    /**
     * Jump through an Elder Wormhole
     */
    jumpGate(gate) {
        if (!gate.destinationSectorId) return;

        const player = this.game.player;
        const sourceSectorId = this.game.currentSector?.id;

        // Show destination name in warp overlay
        const destSector = UNIVERSE_LAYOUT.sectors.find(s => s.id === gate.destinationSectorId);
        const destName = destSector?.name || gate.destinationSectorId;
        const destLabel = document.getElementById('warp-destination');
        if (destLabel) destLabel.textContent = destName;

        // Warp destination text overlay
        const warpDestText = document.getElementById('warp-destination-text');
        if (warpDestText) warpDestText.textContent = `WARPING TO: ${destName}`;

        // Elder Wormhole activation burst - energy particles before jump
        const effects = this.game.renderer?.effects;
        if (effects) {
            effects.spawn('explosion', gate.x, gate.y, {
                count: 20,
                color: 0x44ddff,
                speed: 60,
                size: 4,
                life: 0.8,
            });
            // Second ring of particles
            setTimeout(() => {
                effects.spawn('explosion', gate.x, gate.y, {
                    count: 15,
                    color: 0x88ffff,
                    speed: 120,
                    size: 3,
                    life: 0.5,
                });
            }, 200);
        }

        // Brief camera shake for wormhole activation
        this.game.camera?.shake(4, 0.3);

        // Show warp tunnel with phased animation
        const tunnel = document.getElementById('warp-tunnel');
        tunnel.classList.remove('hidden');
        this.game.audio?.play('jump-gate');

        // Phase 1: Entry flash + tunnel visible (0-1.5s)
        // Phase 2: Sector change happens mid-tunnel (at 1.0s)
        // Phase 3: Exit flash + hide (at 1.8s)

        setTimeout(() => {
            this.game.changeSector(gate.destinationSectorId);

            // Find the return wormhole and position player near it
            const returnGate = this.game.currentSector.entities.find(
                e => e.type === 'gate' && e.destinationSectorId === sourceSectorId
            );

            if (returnGate) {
                const offset = 200;
                player.x = returnGate.x + (Math.random() - 0.5) * offset;
                player.y = returnGate.y + (Math.random() - 0.5) * offset;
            } else {
                // Safe fallback - spawn at station or far from center (avoid planet)
                const station = this.game.currentSector.getStation();
                if (station) {
                    player.x = station.x + station.radius + 100;
                    player.y = station.y;
                } else {
                    player.x = CONFIG.SECTOR_SIZE / 2 + 6000;
                    player.y = CONFIG.SECTOR_SIZE / 2;
                }
            }

            player.velocity.set(0, 0);
            player.currentSpeed = 0;

            // Fleet ships follow through wormhole
            this.game.fleetSystem?.followThroughGate();
        }, 1000);

        // Hide tunnel after full animation
        setTimeout(() => {
            tunnel.classList.add('hidden');
            this.game.audio?.play('warp-end');
            // Arrival flash
            this.game.renderer?.effects?.spawn('warp-flash', player.x, player.y);
            // Continue multi-sector route if active
            this.onGateJumpComplete();
        }, 1800);
    }

    /**
     * Plan and start a multi-sector autopilot route
     */
    planRoute(targetSectorId) {
        const currentSectorId = this.game.currentSector?.id;
        if (!currentSectorId || currentSectorId === targetSectorId) return;

        // BFS to find shortest path
        const path = this.findPath(currentSectorId, targetSectorId);
        if (!path || path.length < 2) {
            this.game.ui?.log('No route available', 'system');
            return;
        }

        this.route = path;
        this.routeIndex = 0; // 0 is current sector
        this.game.ui?.log(`Route set: ${path.length - 1} jump${path.length > 2 ? 's' : ''} to ${UNIVERSE_LAYOUT.sectors.find(s => s.id === targetSectorId)?.name || targetSectorId}`, 'system');
        this.game.ui?.toast(`Autopilot: ${path.length - 1} jump${path.length > 2 ? 's' : ''}`, 'info');
        this.game.audio?.play('click');

        // Start navigating to the first Elder Wormhole
        this.navigateToNextGate();
    }

    /**
     * BFS pathfinding on the sector wormhole graph
     */
    findPath(fromId, toId) {
        const gates = UNIVERSE_LAYOUT.gates;
        // Build adjacency list (includes unlocked secret wormholes)
        const adj = {};
        for (const g of gates) {
            if (!adj[g.from]) adj[g.from] = [];
            if (!adj[g.to]) adj[g.to] = [];
            adj[g.from].push(g.to);
            adj[g.to].push(g.from);
        }
        for (const wh of (UNIVERSE_LAYOUT.secretWormholes || [])) {
            if (this.game.isSecretWormholeUnlocked?.(wh.unlockedBy)) {
                if (!adj[wh.from]) adj[wh.from] = [];
                if (!adj[wh.to]) adj[wh.to] = [];
                adj[wh.from].push(wh.to);
                adj[wh.to].push(wh.from);
            }
        }

        // BFS
        const visited = new Set([fromId]);
        const queue = [[fromId]];
        while (queue.length > 0) {
            const path = queue.shift();
            const node = path[path.length - 1];
            if (node === toId) return path;
            for (const neighbor of (adj[node] || [])) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }
        return null;
    }

    /**
     * Navigate to the next Elder Wormhole in the route
     */
    navigateToNextGate() {
        if (this.routeIndex >= this.route.length - 1) {
            // Route complete
            this.route = [];
            this.routeIndex = 0;
            this.game.ui?.log('Autopilot route complete', 'system');
            this.game.ui?.toast('Destination reached', 'success');
            this.game.audio?.play('quest-complete');
            return;
        }

        const nextSectorId = this.route[this.routeIndex + 1];

        // Find the Elder Wormhole to the next sector
        const gate = this.game.currentSector?.entities.find(
            e => e.type === 'gate' && e.destinationSectorId === nextSectorId
        );

        if (gate) {
            // Warp to the Elder Wormhole
            this.game.selectTarget(gate);
            this.warpTo(gate);
        } else {
            this.game.ui?.log('Route wormhole not found - autopilot cancelled', 'system');
            this.clearRoute();
        }
    }

    /**
     * Called after completing a wormhole jump to continue the route
     */
    onGateJumpComplete() {
        if (this.route.length === 0) return;

        this.routeIndex++;

        if (this.routeIndex >= this.route.length - 1) {
            // Final destination reached
            this.route = [];
            this.routeIndex = 0;
            this.game.ui?.log('Autopilot route complete', 'system');
            this.game.ui?.toast('Destination reached', 'success');
            this.game.audio?.play('quest-complete');
            return;
        }

        // Wait for capacitor to reach threshold before continuing
        const tierLabel = Math.round(this.capThreshold * 100);
        this.game.ui?.log(`Waiting for ${tierLabel}% capacitor before next jump...`, 'system');
        this.waitForCapacitor(() => this.navigateToNextGate());
    }

    /**
     * Wait for player capacitor to reach the configured threshold
     */
    waitForCapacitor(callback) {
        if (this._capWaitTimer) {
            clearTimeout(this._capWaitTimer);
            this._capWaitTimer = null;
        }

        const check = () => {
            const player = this.game.player;
            if (!player || !player.alive) return;

            // Route was cancelled
            if (this.route.length === 0) return;

            const capPct = player.maxCapacitor > 0
                ? player.capacitor / player.maxCapacitor
                : 1;

            if (capPct >= this.capThreshold) {
                this._capWaitTimer = null;
                this.game.ui?.log('Capacitor ready - continuing route', 'system');
                callback();
            } else {
                this._capWaitTimer = setTimeout(check, 500);
            }
        };

        // Brief initial delay for sector to settle
        this._capWaitTimer = setTimeout(check, 1000);
    }

    /**
     * Set autopilot capacitor threshold tier
     * @param {number} threshold - 0.25 to 1.0
     */
    setCapThreshold(threshold) {
        this.capThreshold = Math.max(0.25, Math.min(1.0, threshold));
        const pct = Math.round(this.capThreshold * 100);
        this.game.ui?.log(`Autopilot speed: ${pct}% capacitor threshold`, 'system');
    }

    /**
     * Clear the current route
     */
    clearRoute() {
        this.route = [];
        this.routeIndex = 0;
        if (this._capWaitTimer) {
            clearTimeout(this._capWaitTimer);
            this._capWaitTimer = null;
        }
    }

    /**
     * Get route info for UI display
     */
    getRouteInfo() {
        if (this.route.length === 0) return null;
        return {
            path: this.route,
            currentIndex: this.routeIndex,
            totalJumps: this.route.length - 1,
            remainingJumps: this.route.length - 1 - this.routeIndex,
            destination: this.route[this.route.length - 1],
            capThreshold: this.capThreshold,
        };
    }

    /**
     * Cancel current warp
     */
    cancelWarp() {
        this.aligning = false;
        this.warping = false;
        this.warpTarget = null;
        this.stopWarpStreaks();
        document.getElementById('warp-tunnel').classList.add('hidden');
    }

    /**
     * Stop all autopilot
     */
    stop() {
        this.command = null;
        this.target = null;
        this.targetPosition = null; // Also clear targetPosition

        // Clear multi-sector route
        if (this.route.length > 0) {
            this.clearRoute();
        }

        if (this.game.player) {
            this.game.player.stop();
            // Reset orbit visual state
            if (this.game.player.isPlayer) {
                this.game.player.orbitPhase = 0;
            }
        }

        // Don't cancel warp in progress
        if (!this.warping && !this.aligning) {
            this.game.ui?.log('Stopping ship', 'system');
        }
    }

    /**
     * Update engine trail effect
     */
    updateEngineTrail(player, dt) {
        if (player.currentSpeed > 20) {
            const trailX = player.x - Math.cos(player.rotation) * player.radius;
            const trailY = player.y - Math.sin(player.rotation) * player.radius;

            if (Math.random() < player.currentSpeed / player.maxSpeed) {
                this.game.renderer?.effects.spawn('trail', trailX, trailY, {
                    color: 0x00ffff,
                    size: 1 + player.currentSpeed / player.maxSpeed,
                    lifetime: 0.4,
                    vx: -player.velocity.x,
                    vy: -player.velocity.y,
                });
            }
        }
    }

    /**
     * Get current autopilot status
     */
    getStatus() {
        if (this.warping) return 'warping';
        if (this.aligning) return 'aligning';
        if (this.command) return this.command;
        return 'idle';
    }
}
