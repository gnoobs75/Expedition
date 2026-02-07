// =============================================
// Autopilot System
// Handles approach, orbit, keep-at-range, warp
// =============================================

import { CONFIG } from '../config.js';
import { wrappedDirection, wrappedDistance } from '../utils/math.js';

export class AutopilotSystem {
    constructor(game) {
        this.game = game;

        // Current autopilot command
        this.command = null; // 'approach', 'orbit', 'keepAtRange', 'warp'
        this.target = null;
        this.distance = 0;

        // Warp state
        this.warping = false;
        this.warpProgress = 0;
        this.warpTarget = null;
        this.warpStartPos = { x: 0, y: 0 };
        this.alignTimer = 0;
        this.aligning = false;
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

        player.desiredRotation = angle;
        player.desiredSpeed = player.maxSpeed;
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

        player.desiredRotation = angle;
        player.desiredSpeed = player.maxSpeed;

    }

    /**
     * Update orbit command with elliptical path for 3D perspective effect
     */
    updateOrbit(player, dt) {
        const dist = wrappedDistance(
            player.x, player.y,
            this.target.x, this.target.y,
            CONFIG.SECTOR_SIZE
        );

        const orbitRadius = this.distance;

        // Calculate current angle from target to player
        const currentAngle = wrappedDirection(
            this.target.x, this.target.y,
            player.x, player.y,
            CONFIG.SECTOR_SIZE
        );

        // Orbit direction (counterclockwise)
        const orbitSpeed = player.maxSpeed / orbitRadius; // Angular velocity (rad/s)
        const angularStep = orbitSpeed * dt * 5;
        const targetAngle = currentAngle + angularStep;

        // Update player's orbit phase for visual effects (player-only)
        if (player.isPlayer) {
            player.orbitPhase += angularStep;
            // Keep phase in [0, 2π] range
            if (player.orbitPhase >= Math.PI * 2) {
                player.orbitPhase -= Math.PI * 2;
            }
        }

        // Elliptical orbit path for perspective effect
        // tiltFactor < 1 compresses the Y axis, making orbit appear tilted
        const tiltFactor = player.orbitTilt || 0.7;
        const targetX = this.target.x + Math.cos(targetAngle) * orbitRadius;
        const targetY = this.target.y + Math.sin(targetAngle) * orbitRadius * tiltFactor;

        // Adjust for distance from orbit
        if (Math.abs(dist - orbitRadius) > 100) {
            // Move towards orbit radius (spiral approach)
            const adjustAngle = wrappedDirection(
                player.x, player.y,
                targetX, targetY,
                CONFIG.SECTOR_SIZE
            );
            player.desiredRotation = adjustAngle;
        } else {
            // Follow ellipse tangent
            // For an ellipse with equation x = a*cos(θ), y = b*sin(θ)
            // The tangent direction is atan2(a*cos(θ), -b*sin(θ))
            // where a = orbitRadius (X axis) and b = orbitRadius * tiltFactor (Y axis)
            const tangentAngle = Math.atan2(
                Math.cos(targetAngle),
                -Math.sin(targetAngle) * tiltFactor
            );
            player.desiredRotation = tangentAngle;
        }

        player.desiredSpeed = player.maxSpeed * 0.7;
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
        }
    }

    /**
     * Approach a target
     */
    approach(target) {
        this.command = 'approach';
        this.target = target;
        this.game.ui?.log(`Approaching ${target.name}`, 'system');
    }

    /**
     * Approach a position in space (no target entity)
     */
    approachPosition(x, y) {
        this.command = 'approachPosition';
        this.targetPosition = { x, y };
        this.target = null;
        this.game.ui?.log('Approaching location', 'system');
    }

    /**
     * Orbit a target at distance
     */
    orbit(target, distance = 500) {
        this.command = 'orbit';
        this.target = target;
        this.distance = distance;
        // Reset orbit phase when starting a new orbit (smooth transition)
        if (this.game.player?.isPlayer) {
            this.game.player.orbitPhase = 0;
        }
        this.game.ui?.log(`Orbiting ${target.name} at ${distance}m`, 'system');
    }

    /**
     * Keep at range from target
     */
    keepAtRange(target, distance = 1000) {
        this.command = 'keepAtRange';
        this.target = target;
        this.distance = distance;
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

        // Start alignment
        this.warpTarget = target;
        this.aligning = true;
        this.alignTimer = CONFIG.PLAYER_WARP_ALIGN_TIME;

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
        player.desiredSpeed = player.maxSpeed * 0.3;

        // Count down alignment
        this.alignTimer -= dt;

        if (this.alignTimer <= 0) {
            this.startWarp();
        }
    }

    /**
     * Start the actual warp
     */
    startWarp() {
        const player = this.game.player;

        this.aligning = false;
        this.warping = true;
        this.warpProgress = 0;
        this.warpStartPos = { x: player.x, y: player.y };

        // Show warp tunnel UI
        document.getElementById('warp-tunnel').classList.remove('hidden');

        this.game.ui?.log('Warp drive active!', 'warp');
    }

    /**
     * Update warp travel
     */
    updateWarp(dt) {
        const player = this.game.player;
        const warpSpeed = CONFIG.PLAYER_WARP_SPEED;

        // Calculate distance to target
        const totalDist = wrappedDistance(
            this.warpStartPos.x, this.warpStartPos.y,
            this.warpTarget.x, this.warpTarget.y,
            CONFIG.SECTOR_SIZE
        );

        // Warp progress
        this.warpProgress += (warpSpeed * dt) / totalDist;

        if (this.warpProgress >= 1) {
            this.completeWarp();
            return;
        }

        // Move player along warp path
        const angle = wrappedDirection(
            this.warpStartPos.x, this.warpStartPos.y,
            this.warpTarget.x, this.warpTarget.y,
            CONFIG.SECTOR_SIZE
        );

        const currentDist = this.warpProgress * totalDist;
        player.x = this.warpStartPos.x + Math.cos(angle) * currentDist;
        player.y = this.warpStartPos.y + Math.sin(angle) * currentDist;

        // Keep rotation aligned
        player.rotation = angle;
        player.velocity.set(0, 0);
    }

    /**
     * Complete warp travel
     */
    completeWarp() {
        const player = this.game.player;

        // Position at warp target (with offset)
        const landingDist = (this.warpTarget.radius || 50) + 200;
        const landingAngle = Math.random() * Math.PI * 2;

        player.x = this.warpTarget.x + Math.cos(landingAngle) * landingDist;
        player.y = this.warpTarget.y + Math.sin(landingAngle) * landingDist;
        player.velocity.set(0, 0);
        player.currentSpeed = 0;

        // Hide warp tunnel
        document.getElementById('warp-tunnel').classList.add('hidden');

        this.warping = false;
        this.warpTarget = null;

        this.game.ui?.log('Warp complete', 'warp');
        this.game.audio?.play('warp-end');
    }

    /**
     * Jump through a warp gate
     */
    jumpGate(gate) {
        if (!gate.destinationSectorId) return;

        const player = this.game.player;

        // Show warp effect
        document.getElementById('warp-tunnel').classList.remove('hidden');
        this.game.audio?.play('warp-start');

        // Delay for effect, then change sector
        setTimeout(() => {
            this.game.changeSector(gate.destinationSectorId);

            // Find the return gate and position player near it
            const returnGate = this.game.currentSector.entities.find(
                e => e.type === 'gate' && e.destinationSectorId === gate.game?.currentSector?.id
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
                    // Far from central planet
                    player.x = CONFIG.SECTOR_SIZE / 2 + 6000;
                    player.y = CONFIG.SECTOR_SIZE / 2;
                }
            }

            player.velocity.set(0, 0);
            player.currentSpeed = 0;

            // Hide warp tunnel
            document.getElementById('warp-tunnel').classList.add('hidden');
            this.game.audio?.play('warp-end');
        }, 1500);
    }

    /**
     * Cancel current warp
     */
    cancelWarp() {
        this.aligning = false;
        this.warping = false;
        this.warpTarget = null;
        document.getElementById('warp-tunnel').classList.add('hidden');
    }

    /**
     * Stop all autopilot
     */
    stop() {
        this.command = null;
        this.target = null;
        this.targetPosition = null; // Also clear targetPosition

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
