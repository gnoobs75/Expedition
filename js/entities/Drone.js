// =============================================
// Drone Entity
// Small autonomous spacecraft that assists the player
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

export class Drone extends Entity {
    constructor(game, options = {}) {
        super(game, options);

        this.type = 'drone';
        this.droneType = options.droneType || 'mining-drone';
        this.droneIndex = options.droneIndex ?? 0;
        this.owner = options.owner || null;

        // Get config
        const config = CONFIG.DRONES[this.droneType] || {};
        this.name = config.name || 'Drone';
        this.droneCategory = config.type || 'mining';

        // Stats from config
        this.maxSpeed = config.speed || 150;
        this.orbitRange = config.orbitRange || 100;
        this.maxHp = config.hp || 50;
        this.hp = options.hp ?? this.maxHp;
        this.bandwidth = config.bandwidth || 10;

        // Type-specific stats
        if (this.droneCategory === 'mining') {
            this.miningYield = config.miningYield || 5;
            this.miningCycleTime = config.miningCycleTime || 3;
            this.miningTimer = 0;
            // Drone cargo for mining drones
            this.cargoCapacity = config.cargoCapacity || 50;
            this.cargo = 0; // Current ore held
            this.cargoOreType = null; // Type of ore being carried
        } else if (this.droneCategory === 'combat') {
            this.damage = config.damage || 10;
            this.attackRange = config.range || 500;
            this.attackCycleTime = config.attackCycleTime || 2;
            this.attackTimer = 0;
        }

        // Visual effect timers
        this.effectTimer = 0;
        this.effectInterval = 0.2; // Spawn laser effect every 0.2s when active

        // State for returning to deposit ore
        this.returningToDeposit = false;
        this.previousCommand = null;
        this.previousTarget = null;

        // Movement
        this.currentSpeed = 0;
        this.acceleration = 100;

        // AI State
        this.command = 'idle'; // idle, orbit, attack, mine, return
        this.target = null;
        this.orbitPhase = Math.random() * Math.PI * 2;

        // Visual
        this.radius = 8;
        this.color = 0x00ff88;
    }

    update(dt) {
        if (!this.alive) return;

        // Execute current command
        switch (this.command) {
            case 'orbit':
                this.executeOrbit(dt);
                break;
            case 'attack':
                this.executeAttack(dt);
                break;
            case 'mine':
                this.executeMine(dt);
                break;
            case 'return':
                this.executeReturn(dt);
                break;
            case 'idle':
            default:
                this.executeIdle(dt);
                break;
        }

        // Apply movement
        super.update(dt);
    }

    /**
     * Set a new command for this drone
     */
    setCommand(command, target = null) {
        this.command = command;
        this.target = target;

        // Reset timers
        this.miningTimer = 0;
        this.attackTimer = 0;
    }

    /**
     * Idle behavior - orbit owner
     */
    executeIdle(dt) {
        if (!this.owner) return;

        this.orbitPhase += dt * 1.5;
        const targetX = this.owner.x + Math.cos(this.orbitPhase) * 80;
        const targetY = this.owner.y + Math.sin(this.orbitPhase) * 80;

        this.moveToward(targetX, targetY, dt);
    }

    /**
     * Orbit the target
     */
    executeOrbit(dt) {
        if (!this.target || !this.target.alive) {
            this.command = 'idle';
            return;
        }

        this.orbitPhase += dt * 2;
        const targetX = this.target.x + Math.cos(this.orbitPhase) * this.orbitRange;
        const targetY = this.target.y + Math.sin(this.orbitPhase) * this.orbitRange;

        this.moveToward(targetX, targetY, dt);
    }

    /**
     * Attack the target (combat drones)
     */
    executeAttack(dt) {
        if (!this.target || !this.target.alive) {
            this.command = 'idle';
            return;
        }

        const dist = this.distanceTo(this.target);

        // Move into range
        if (dist > this.attackRange * 0.8) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const targetDist = this.attackRange * 0.6;
            const targetX = this.target.x - Math.cos(angle) * targetDist;
            const targetY = this.target.y - Math.sin(angle) * targetDist;
            this.moveToward(targetX, targetY, dt);
        } else {
            // Orbit and attack
            this.orbitPhase += dt * 2;
            const orbitX = this.target.x + Math.cos(this.orbitPhase) * (this.attackRange * 0.5);
            const orbitY = this.target.y + Math.sin(this.orbitPhase) * (this.attackRange * 0.5);
            this.moveToward(orbitX, orbitY, dt);

            // Spawn attack laser effect continuously while in range
            this.effectTimer += dt;
            if (this.effectTimer >= this.effectInterval) {
                this.effectTimer = 0;
                this.spawnAttackLaser();
            }

            // Attack timer
            this.attackTimer += dt;
            if (this.attackTimer >= this.attackCycleTime) {
                this.attackTimer = 0;
                this.fireAtTarget();
            }
        }
    }

    /**
     * Mine the target asteroid (mining drones)
     */
    executeMine(dt) {
        // Check if cargo is full - need to return to deposit
        if (this.cargo >= this.cargoCapacity) {
            this.returnToDeposit();
            return;
        }

        if (!this.target || !this.target.alive || this.target.type !== 'asteroid') {
            // Find nearest asteroid with ore if no target
            const asteroids = this.game.currentSector?.getEntitiesByType('asteroid') || [];
            if (asteroids.length > 0) {
                let closest = null;
                let closestDist = Infinity;
                for (const ast of asteroids) {
                    // Only target asteroids that have ore remaining
                    if (ast.ore <= 0) continue;
                    const d = this.distanceTo(ast);
                    if (d < closestDist) {
                        closest = ast;
                        closestDist = d;
                    }
                }
                this.target = closest;
            }

            if (!this.target) {
                this.command = 'idle';
                return;
            }
        }

        // Check if current asteroid is depleted
        if (this.target.ore <= 0) {
            this.target = null;
            return;
        }

        const dist = this.distanceTo(this.target);

        // Move to mining range
        if (dist > this.orbitRange + 50) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const targetX = this.target.x - Math.cos(angle) * this.orbitRange;
            const targetY = this.target.y - Math.sin(angle) * this.orbitRange;
            this.moveToward(targetX, targetY, dt);
        } else {
            // Orbit and mine
            this.orbitPhase += dt * 1.5;
            const orbitX = this.target.x + Math.cos(this.orbitPhase) * this.orbitRange;
            const orbitY = this.target.y + Math.sin(this.orbitPhase) * this.orbitRange;
            this.moveToward(orbitX, orbitY, dt);

            // Spawn mining laser effect continuously while in range
            this.effectTimer += dt;
            if (this.effectTimer >= this.effectInterval) {
                this.effectTimer = 0;
                this.spawnMiningLaser();
            }

            // Mining timer
            this.miningTimer += dt;
            if (this.miningTimer >= this.miningCycleTime) {
                this.miningTimer = 0;
                this.mineAsteroid();
            }
        }
    }

    /**
     * Return to owner
     */
    executeReturn(dt) {
        if (!this.owner) {
            this.command = 'idle';
            return;
        }

        const dist = this.distanceTo(this.owner);

        // Move toward owner
        this.moveToward(this.owner.x, this.owner.y, dt);

        // If close enough
        if (dist < 50) {
            // If returning to deposit ore, deposit and resume mining
            if (this.returningToDeposit) {
                this.depositOre();
                this.returningToDeposit = false;
                // Resume previous command (mining)
                if (this.previousCommand) {
                    this.command = this.previousCommand;
                    this.target = this.previousTarget;
                    this.previousCommand = null;
                    this.previousTarget = null;
                } else {
                    this.command = 'mine';
                }
            } else {
                // Normal return - recall drone
                this.owner.recallDrone(this);
            }
        }
    }

    /**
     * Return to owner to deposit ore, then resume mining
     */
    returnToDeposit() {
        if (this.returningToDeposit) return; // Already returning

        this.returningToDeposit = true;
        this.previousCommand = this.command;
        this.previousTarget = this.target;
        this.command = 'return';
    }

    /**
     * Deposit ore into owner's cargo
     */
    depositOre() {
        if (!this.owner || this.cargo <= 0) return;

        const oreType = this.cargoOreType || 'veldspar';
        const volumePerUnit = CONFIG.ASTEROID_TYPES[oreType]?.volumePerUnit || 0.1;
        const volume = this.cargo * volumePerUnit;

        const added = this.owner.addOre(oreType, this.cargo, volume);

        if (added > 0) {
            const oreName = CONFIG.ASTEROID_TYPES[oreType]?.name || oreType;
            if (this.owner?.isPlayer) this.game.ui?.log(`Drone deposited ${added} ${oreName} ore`, 'mining');
        }

        // Clear drone cargo
        this.cargo = 0;
        this.cargoOreType = null;
    }

    /**
     * Move toward a position
     */
    moveToward(targetX, targetY, dt) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            this.velocity.x *= 0.9;
            this.velocity.y *= 0.9;
            return;
        }

        const angle = Math.atan2(dy, dx);
        this.rotation = angle;

        // Accelerate toward target
        const speed = Math.min(this.maxSpeed, dist * 2);
        this.velocity.x = Math.cos(angle) * speed;
        this.velocity.y = Math.sin(angle) * speed;
    }

    /**
     * Fire at target (combat drones)
     */
    fireAtTarget() {
        if (!this.target || this.droneCategory !== 'combat') return;

        const dist = this.distanceTo(this.target);
        if (dist > this.attackRange) return;

        // Deal damage
        this.game.combat?.fireAt(this, this.target, this.damage, this.attackRange);
    }

    /**
     * Mine asteroid and store in drone's cargo
     */
    mineAsteroid() {
        if (!this.target || !this.owner || this.droneCategory !== 'mining') return;
        if (this.target.ore <= 0) return;

        // Calculate how much we can mine (limited by cargo space and asteroid ore)
        const spaceRemaining = this.cargoCapacity - this.cargo;
        const yieldAmount = Math.min(this.miningYield, spaceRemaining, this.target.ore);

        if (yieldAmount <= 0) return;

        // Extract ore from asteroid
        const extracted = this.target.mine(yieldAmount);

        if (extracted.units > 0) {
            // Add to drone's cargo
            this.cargo += extracted.units;
            this.cargoOreType = extracted.type;

            // Spawn mining particles at asteroid
            this.game.renderer?.effects.spawn('mining', this.target.x, this.target.y, {
                color: this.target.color,
            });

            // Play mining sound
            if (this.owner?.isPlayer) this.game.audio?.play('mining');
        }

        // Check if asteroid depleted
        if (!this.target.alive) {
            if (this.owner?.isPlayer) this.game.ui?.log('Asteroid depleted', 'mining');
            this.target = null;
        }
    }

    /**
     * Spawn mining laser effect from drone to target asteroid
     */
    spawnMiningLaser() {
        if (!this.target || !this.game.renderer?.effects) return;

        // Light blue color for mining laser
        this.game.renderer.effects.spawn('laser', this.x, this.y, {
            target: this.target,
            color: 0x44aaff, // Mining laser blue
        });
    }

    /**
     * Spawn attack laser effect from drone to target
     */
    spawnAttackLaser() {
        if (!this.target || !this.game.renderer?.effects) return;

        // Red/orange color for attack laser
        this.game.renderer.effects.spawn('laser', this.x, this.y, {
            target: this.target,
            color: 0xff6644, // Attack laser orange-red
        });
    }

    /**
     * Take damage
     */
    takeDamage(amount) {
        this.hp -= amount;

        if (this.hp <= 0) {
            this.hp = 0;
            this.destroy();
            this.game.ui?.log(`${this.name} destroyed!`, 'combat');

            // Remove from owner's deployed list
            if (this.owner?.droneBay) {
                this.owner.droneBay.deployed.delete(this.droneIndex);
                // Mark as destroyed in bay
                if (this.owner.droneBay.drones[this.droneIndex]) {
                    this.owner.droneBay.drones[this.droneIndex] = null;
                }
            }
        }
    }

    /**
     * Get health percentage
     */
    getHealthPercents() {
        return {
            shield: 0,
            armor: 0,
            hull: (this.hp / this.maxHp) * 100,
        };
    }

    /**
     * Create drone mesh
     */
    createMesh() {
        // Small diamond shape
        const shape = new THREE.Shape();
        const size = this.radius;

        shape.moveTo(size, 0);
        shape.lineTo(0, size * 0.6);
        shape.lineTo(-size, 0);
        shape.lineTo(0, -size * 0.6);
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(this.x, this.y, 1);

        // Add glow effect
        const glowGeometry = new THREE.CircleGeometry(size * 1.5, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.2,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.z = -0.1;
        this.mesh.add(glow);

        return this.mesh;
    }
}
