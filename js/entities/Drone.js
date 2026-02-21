// =============================================
// Drone Entity
// Small autonomous spacecraft that assists the player
// Supports: mining (light/med/heavy), combat (light/med/heavy),
//           EWAR (jamming, dampening), scout
// =============================================

import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';

// Color palette per drone category and size
const DRONE_COLORS = {
    mining:  { light: 0x44aaff, medium: 0x2288dd, heavy: 0x1166aa },
    combat:  { light: 0xff6644, medium: 0xdd3322, heavy: 0xaa1100 },
    ewar:    { jam: 0xffdd00, damp: 0xaa44ff },
    scout:   { light: 0x00ff88 },
};

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
        this.droneCategory = config.type || 'mining'; // mining, combat, ewar, scout
        this.droneSize = config.size || 'medium';     // light, medium, heavy

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
            this.cargoCapacity = config.cargoCapacity || 50;
            this.cargo = 0;
            this.cargoOreType = null;
        } else if (this.droneCategory === 'combat') {
            this.damage = config.damage || 10;
            this.attackRange = config.range || 500;
            this.attackCycleTime = config.attackCycleTime || 2;
            this.attackTimer = 0;
        } else if (this.droneCategory === 'ewar') {
            this.ewarType = config.ewarType || 'jam'; // 'jam' or 'damp'
            this.ewarRange = config.range || 500;
            if (this.ewarType === 'jam') {
                this.jamStrength = config.jamStrength || 3;
                this.jamCycleTime = config.jamCycleTime || 8;
                this.jamTimer = 0;
            } else if (this.ewarType === 'damp') {
                this.warpDisruptStrength = config.warpDisruptStrength || 1;
                this.dampCycleTime = config.dampCycleTime || 5;
                this.dampTimer = 0;
            }
        }

        // Visual effect timers
        this.effectTimer = 0;
        this.effectInterval = 0.2;

        // State for returning to deposit ore
        this.returningToDeposit = false;
        this.previousCommand = null;
        this.previousTarget = null;

        // Movement
        this.currentSpeed = 0;
        this.acceleration = 100;

        // AI State
        this.command = 'idle'; // idle, orbit, attack, mine, jam, damp, return
        this.target = null;
        this.orbitPhase = Math.random() * Math.PI * 2;

        // Visual
        this.radius = this.droneSize === 'heavy' ? 12 : this.droneSize === 'light' ? 6 : 8;
        this.color = this._getDroneColor();
    }

    /**
     * Get color based on drone category and size/ewarType
     */
    _getDroneColor() {
        if (this.droneCategory === 'ewar') {
            return DRONE_COLORS.ewar[this.ewarType] || 0xffdd00;
        }
        const catColors = DRONE_COLORS[this.droneCategory];
        if (!catColors) return 0x00ff88;
        return catColors[this.droneSize] || Object.values(catColors)[0];
    }

    update(dt) {
        if (!this.alive) return;

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
            case 'jam':
                this.executeJam(dt);
                break;
            case 'damp':
                this.executeDamp(dt);
                break;
            case 'return':
                this.executeReturn(dt);
                break;
            case 'idle':
            default:
                this.executeIdle(dt);
                break;
        }

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
        if (this.jamTimer !== undefined) this.jamTimer = 0;
        if (this.dampTimer !== undefined) this.dampTimer = 0;
    }

    // ---- Idle ----
    executeIdle(dt) {
        if (!this.owner) return;

        this.orbitPhase += dt * 1.5;
        const targetX = this.owner.x + Math.cos(this.orbitPhase) * 80;
        const targetY = this.owner.y + Math.sin(this.orbitPhase) * 80;
        this.moveToward(targetX, targetY, dt);
    }

    // ---- Orbit ----
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

    // ---- Attack (combat drones) ----
    executeAttack(dt) {
        if (!this.target || !this.target.alive) {
            this.command = 'idle';
            return;
        }

        const dist = this.distanceTo(this.target);

        if (dist > this.attackRange * 0.8) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const targetDist = this.attackRange * 0.6;
            const targetX = this.target.x - Math.cos(angle) * targetDist;
            const targetY = this.target.y - Math.sin(angle) * targetDist;
            this.moveToward(targetX, targetY, dt);
        } else {
            this.orbitPhase += dt * 2;
            const orbitX = this.target.x + Math.cos(this.orbitPhase) * (this.attackRange * 0.5);
            const orbitY = this.target.y + Math.sin(this.orbitPhase) * (this.attackRange * 0.5);
            this.moveToward(orbitX, orbitY, dt);

            this.effectTimer += dt;
            if (this.effectTimer >= this.effectInterval) {
                this.effectTimer = 0;
                this.spawnAttackLaser();
            }

            this.attackTimer += dt;
            if (this.attackTimer >= this.attackCycleTime) {
                this.attackTimer = 0;
                this.fireAtTarget();
            }
        }
    }

    // ---- Mine (mining drones) ----
    executeMine(dt) {
        if (this.cargo >= this.cargoCapacity) {
            this.returnToDeposit();
            return;
        }

        if (!this.target || !this.target.alive || this.target.type !== 'asteroid') {
            const asteroids = this.game.currentSector?.getEntitiesByType('asteroid') || [];
            let closest = null;
            let closestDist = Infinity;
            for (const ast of asteroids) {
                if (ast.ore <= 0) continue;
                const d = this.distanceTo(ast);
                if (d < closestDist) {
                    closest = ast;
                    closestDist = d;
                }
            }
            this.target = closest;

            if (!this.target) {
                this.command = 'idle';
                return;
            }
        }

        if (this.target.ore <= 0) {
            this.target = null;
            return;
        }

        const dist = this.distanceTo(this.target);

        if (dist > this.orbitRange + 50) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const targetX = this.target.x - Math.cos(angle) * this.orbitRange;
            const targetY = this.target.y - Math.sin(angle) * this.orbitRange;
            this.moveToward(targetX, targetY, dt);
        } else {
            this.orbitPhase += dt * 1.5;
            const orbitX = this.target.x + Math.cos(this.orbitPhase) * this.orbitRange;
            const orbitY = this.target.y + Math.sin(this.orbitPhase) * this.orbitRange;
            this.moveToward(orbitX, orbitY, dt);

            this.effectTimer += dt;
            if (this.effectTimer >= this.effectInterval) {
                this.effectTimer = 0;
                this.spawnMiningLaser();
            }

            this.miningTimer += dt;
            if (this.miningTimer >= this.miningCycleTime) {
                this.miningTimer = 0;
                this.mineAsteroid();
            }
        }
    }

    // ---- Jam (jamming drones - break target locks) ----
    executeJam(dt) {
        if (!this.target || !this.target.alive) {
            this.command = 'idle';
            return;
        }

        const dist = this.distanceTo(this.target);

        if (dist > this.ewarRange * 0.8) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const targetX = this.target.x - Math.cos(angle) * (this.ewarRange * 0.6);
            const targetY = this.target.y - Math.sin(angle) * (this.ewarRange * 0.6);
            this.moveToward(targetX, targetY, dt);
        } else {
            // Orbit the target
            this.orbitPhase += dt * 1.8;
            const orbitX = this.target.x + Math.cos(this.orbitPhase) * (this.ewarRange * 0.4);
            const orbitY = this.target.y + Math.sin(this.orbitPhase) * (this.ewarRange * 0.4);
            this.moveToward(orbitX, orbitY, dt);

            // Jam beam visual
            this.effectTimer += dt;
            if (this.effectTimer >= 0.3) {
                this.effectTimer = 0;
                this.spawnEwarBeam();
            }

            // Jam cycle
            this.jamTimer += dt;
            if (this.jamTimer >= this.jamCycleTime) {
                this.jamTimer = 0;
                this.attemptJam();
            }
        }
    }

    // ---- Damp (dampening drones - prevent warp) ----
    executeDamp(dt) {
        if (!this.target || !this.target.alive) {
            this.command = 'idle';
            return;
        }

        const dist = this.distanceTo(this.target);

        if (dist > this.ewarRange * 0.8) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const targetX = this.target.x - Math.cos(angle) * (this.ewarRange * 0.6);
            const targetY = this.target.y - Math.sin(angle) * (this.ewarRange * 0.6);
            this.moveToward(targetX, targetY, dt);
        } else {
            // Orbit the target
            this.orbitPhase += dt * 1.8;
            const orbitX = this.target.x + Math.cos(this.orbitPhase) * (this.ewarRange * 0.4);
            const orbitY = this.target.y + Math.sin(this.orbitPhase) * (this.ewarRange * 0.4);
            this.moveToward(orbitX, orbitY, dt);

            // Damp beam visual
            this.effectTimer += dt;
            if (this.effectTimer >= 0.3) {
                this.effectTimer = 0;
                this.spawnEwarBeam();
            }

            // Continuously apply warp disruption
            this.dampTimer += dt;
            if (this.dampTimer >= this.dampCycleTime) {
                this.dampTimer = 0;
                this.applyDamp();
            }
        }
    }

    // ---- Return ----
    executeReturn(dt) {
        if (!this.owner) {
            this.command = 'idle';
            return;
        }

        const dist = this.distanceTo(this.owner);
        this.moveToward(this.owner.x, this.owner.y, dt);

        if (dist < 50) {
            if (this.returningToDeposit) {
                this.depositOre();
                this.returningToDeposit = false;
                if (this.previousCommand) {
                    this.command = this.previousCommand;
                    this.target = this.previousTarget;
                    this.previousCommand = null;
                    this.previousTarget = null;
                } else {
                    this.command = 'mine';
                }
            } else {
                this.owner.recallDrone(this);
            }
        }
    }

    // ---- Helpers ----

    returnToDeposit() {
        if (this.returningToDeposit) return;
        this.returningToDeposit = true;
        this.previousCommand = this.command;
        this.previousTarget = this.target;
        this.command = 'return';
    }

    depositOre() {
        if (!this.owner || this.cargo <= 0) return;

        const oreType = this.cargoOreType || 'veldspar';
        const volumePerUnit = CONFIG.ASTEROID_TYPES[oreType]?.volumePerUnit || 0.1;
        const volume = this.cargo * volumePerUnit;

        const added = this.owner.addOre(oreType, this.cargo, volume);

        if (added > 0) {
            const oreName = CONFIG.ASTEROID_TYPES[oreType]?.name || oreType;
            if (this.owner?.isPlayer) this.game.ui?.log(`${this.name} deposited ${added} ${oreName} ore`, 'mining');
        }

        this.cargo = 0;
        this.cargoOreType = null;
    }

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

        const speed = Math.min(this.maxSpeed, dist * 2);
        this.velocity.x = Math.cos(angle) * speed;
        this.velocity.y = Math.sin(angle) * speed;
    }

    fireAtTarget() {
        if (!this.target || this.droneCategory !== 'combat') return;

        const dist = this.distanceTo(this.target);
        if (dist > this.attackRange) return;

        this.game.combat?.fireAt(this, this.target, this.damage, this.attackRange, { damageType: 'thermal' });
    }

    /**
     * Attempt to break the target's locks (jamming drone)
     */
    attemptJam() {
        if (!this.target || this.ewarType !== 'jam') return;
        const dist = this.distanceTo(this.target);
        if (dist > this.ewarRange) return;

        // Jam chance: jamStrength vs target sensor strength (default 10)
        const sensorStrength = this.target.sensorStrength || 10;
        const jamChance = Math.min(0.8, this.jamStrength / sensorStrength);

        if (Math.random() < jamChance) {
            // Break target's lock
            if (this.target.target) {
                const victimName = this.target.name || 'Target';
                this.target.target = null;
                // Clear active modules (they lose lock)
                if (this.target.activeModules) {
                    this.target.activeModules.clear();
                }
                if (this.owner?.isPlayer) {
                    this.game.ui?.log(`${this.name} jammed ${victimName} - lock broken!`, 'ewar');
                }
                // Notify via event
                this.game.events?.emit('ewar:jam', { source: this, target: this.target });
            }
        } else {
            if (this.owner?.isPlayer) {
                this.game.ui?.log(`${this.name} jam attempt resisted`, 'ewar');
            }
        }
    }

    /**
     * Apply warp disruption to target (dampening drone)
     */
    applyDamp() {
        if (!this.target || this.ewarType !== 'damp') return;
        const dist = this.distanceTo(this.target);
        if (dist > this.ewarRange) return;

        this.target.isPointed = true;

        if (this.owner?.isPlayer) {
            const victimName = this.target.name || 'Target';
            this.game.ui?.log(`${this.name} disrupting ${victimName}'s warp drive`, 'ewar');
        }

        this.game.events?.emit('ewar:damp', { source: this, target: this.target });
    }

    mineAsteroid() {
        if (!this.target || !this.owner || this.droneCategory !== 'mining') return;
        if (this.target.ore <= 0) return;

        const spaceRemaining = this.cargoCapacity - this.cargo;
        const yieldAmount = Math.min(this.miningYield, spaceRemaining, this.target.ore);

        if (yieldAmount <= 0) return;

        const extracted = this.target.mine(yieldAmount);

        if (extracted.units > 0) {
            this.cargo += extracted.units;
            this.cargoOreType = extracted.type;

            this.game.renderer?.effects.spawn('mining', this.target.x, this.target.y, {
                color: this.target.color,
            });

            if (this.owner?.isPlayer) this.game.audio?.play('mining');
        }

        if (!this.target.alive) {
            if (this.owner?.isPlayer) this.game.ui?.log('Asteroid depleted', 'mining');
            this.target = null;
        }
    }

    // ---- Effect Spawners ----

    spawnMiningLaser() {
        if (!this.target || !this.game.renderer?.effects) return;
        this.game.renderer.effects.spawn('laser', this.x, this.y, {
            target: this.target,
            color: 0x44aaff,
        });
    }

    spawnAttackLaser() {
        if (!this.target || !this.game.renderer?.effects) return;
        this.game.renderer.effects.spawn('laser', this.x, this.y, {
            target: this.target,
            color: 0xff6644,
        });
    }

    spawnEwarBeam() {
        if (!this.target || !this.game.renderer?.effects) return;
        const color = this.ewarType === 'jam' ? 0xffdd00 : 0xaa44ff;
        this.game.renderer.effects.spawn('laser', this.x, this.y, {
            target: this.target,
            color: color,
        });
    }

    // ---- Health & Damage ----

    takeDamage(amount) {
        this.hp -= amount;

        if (this.hp <= 0) {
            this.hp = 0;
            this.destroy();
            this.game.ui?.log(`${this.name} destroyed!`, 'combat');

            if (this.owner?.droneBay) {
                this.owner.droneBay.deployed.delete(this.droneIndex);
                if (this.owner.droneBay.drones[this.droneIndex]) {
                    this.owner.droneBay.drones[this.droneIndex] = null;
                }
            }
        }
    }

    getHealthPercents() {
        return {
            shield: 0,
            armor: 0,
            hull: (this.hp / this.maxHp) * 100,
        };
    }

    // ---- Mesh Creation ----

    createMesh() {
        const size = this.radius;
        const group = new THREE.Group();

        // --- Category-specific hull ---
        if (this.droneCategory === 'combat') {
            this._buildCombatMesh(group, size);
        } else if (this.droneCategory === 'mining') {
            this._buildMiningMesh(group, size);
        } else if (this.droneCategory === 'ewar') {
            this._buildEwarMesh(group, size);
        } else {
            this._buildScoutMesh(group, size);
        }

        // --- Shared: Engine glow (rear thruster) ---
        const engineCore = new THREE.CircleGeometry(size * 0.18, 8);
        const engineCoreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.7,
        });
        const engineMesh = new THREE.Mesh(engineCore, engineCoreMat);
        engineMesh.position.set(-size * 0.65, 0, 0.06);
        group.add(engineMesh);

        // Engine bloom
        const bloomGeo = new THREE.CircleGeometry(size * 0.35, 10);
        const bloomMat = new THREE.MeshBasicMaterial({
            color: 0x44ccff, transparent: true, opacity: 0.2,
        });
        const bloom = new THREE.Mesh(bloomGeo, bloomMat);
        bloom.position.set(-size * 0.65, 0, 0.04);
        group.add(bloom);

        // --- Shared: Running lights (2 per side, color-coded) ---
        const lightColor = this.droneCategory === 'combat' ? 0xff4422
            : this.droneCategory === 'mining' ? 0xffaa22
            : this.droneCategory === 'ewar' ? 0xaa44ff
            : 0x22ff88;

        const lightPositions = [
            { x: size * 0.2, y: size * 0.35 },
            { x: -size * 0.3, y: size * 0.25 },
            { x: size * 0.2, y: -size * 0.35 },
            { x: -size * 0.3, y: -size * 0.25 },
        ];

        const lightGeo = new THREE.CircleGeometry(size * 0.04, 6);
        const lightHaloGeo = new THREE.CircleGeometry(size * 0.1, 8);
        for (const lp of lightPositions) {
            const lightMat = new THREE.MeshBasicMaterial({
                color: lightColor, transparent: true, opacity: 0.9,
            });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(lp.x, lp.y, 0.08);
            group.add(light);

            const haloMat = new THREE.MeshBasicMaterial({
                color: lightColor, transparent: true, opacity: 0.15,
            });
            const halo = new THREE.Mesh(lightHaloGeo, haloMat);
            halo.position.set(lp.x, lp.y, 0.07);
            group.add(halo);
        }

        group.position.set(this.x, this.y, 1);
        this.mesh = group;
        return this.mesh;
    }

    // --- Combat drone: aggressive angular hull with forward-swept wings ---
    _buildCombatMesh(group, size) {
        // Main hull - angular wedge
        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 1.1, 0);
        hullShape.lineTo(size * 0.3, size * 0.15);
        hullShape.lineTo(-size * 0.2, size * 0.5);
        hullShape.lineTo(-size * 0.5, size * 0.35);
        hullShape.lineTo(-size * 0.7, size * 0.12);
        hullShape.lineTo(-size * 0.7, -size * 0.12);
        hullShape.lineTo(-size * 0.5, -size * 0.35);
        hullShape.lineTo(-size * 0.2, -size * 0.5);
        hullShape.lineTo(size * 0.3, -size * 0.15);
        hullShape.closePath();

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
            depth: size * 0.08, bevelEnabled: true, bevelThickness: size * 0.02,
            bevelSize: size * 0.01, bevelSegments: 1,
        });
        hullGeo.center();

        const hullMat = new THREE.MeshStandardMaterial({
            color: this.color, emissive: this.color, emissiveIntensity: 0.15,
            transparent: true, opacity: 0.9, roughness: 0.35, metalness: 0.5,
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        group.add(hull);

        // Wing weapon mount nubs
        const nubGeo = new THREE.CylinderGeometry(size * 0.06, size * 0.04, size * 0.15, 6);
        const nubMat = new THREE.MeshBasicMaterial({ color: 0x554433, transparent: true, opacity: 0.7 });
        for (const side of [1, -1]) {
            const nub = new THREE.Mesh(nubGeo, nubMat);
            nub.rotation.x = Math.PI / 2;
            nub.position.set(-size * 0.15, side * size * 0.45, 0.05);
            group.add(nub);
        }

        // Armor plate overlay (center dorsal)
        const armorGeo = new THREE.PlaneGeometry(size * 0.6, size * 0.25);
        const armorMat = new THREE.MeshBasicMaterial({
            color: 0x553322, transparent: true, opacity: 0.2,
        });
        const armor = new THREE.Mesh(armorGeo, armorMat);
        armor.position.set(0, 0, 0.05);
        group.add(armor);
    }

    // --- Mining drone: compact boxy industrial hull ---
    _buildMiningMesh(group, size) {
        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 0.7, 0);
        hullShape.lineTo(size * 0.5, size * 0.45);
        hullShape.lineTo(-size * 0.5, size * 0.5);
        hullShape.lineTo(-size * 0.7, size * 0.3);
        hullShape.lineTo(-size * 0.7, -size * 0.3);
        hullShape.lineTo(-size * 0.5, -size * 0.5);
        hullShape.lineTo(size * 0.5, -size * 0.45);
        hullShape.closePath();

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
            depth: size * 0.1, bevelEnabled: true, bevelThickness: size * 0.02,
            bevelSize: size * 0.01, bevelSegments: 1,
        });
        hullGeo.center();

        const hullMat = new THREE.MeshStandardMaterial({
            color: this.color, emissive: this.color, emissiveIntensity: 0.12,
            transparent: true, opacity: 0.9, roughness: 0.5, metalness: 0.3,
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        group.add(hull);

        // Mining laser emitter arm (forward-extending)
        const armGeo = new THREE.PlaneGeometry(size * 0.5, size * 0.06);
        const armMat = new THREE.MeshBasicMaterial({ color: 0x667788, transparent: true, opacity: 0.6 });
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.set(size * 0.7, 0, 0.05);
        group.add(arm);

        // Emitter tip glow
        const tipGeo = new THREE.CircleGeometry(size * 0.08, 8);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.7 });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(size * 0.95, 0, 0.06);
        group.add(tip);

        // Cargo scoop (wide front opening indicator)
        const scoopGeo = new THREE.PlaneGeometry(size * 0.08, size * 0.35);
        const scoopMat = new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.25 });
        const scoop = new THREE.Mesh(scoopGeo, scoopMat);
        scoop.position.set(size * 0.45, 0, 0.04);
        group.add(scoop);

        // Utility conduit lines on hull
        const conduitMat = new THREE.LineBasicMaterial({ color: 0x556677, transparent: true, opacity: 0.3 });
        for (const side of [1, -1]) {
            const pts = [
                new THREE.Vector3(-size * 0.4, side * size * 0.2, 0.06),
                new THREE.Vector3(size * 0.3, side * size * 0.15, 0.06),
            ];
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(geo, conduitMat);
            group.add(line);
        }
    }

    // --- EWAR drone: hexagonal hull with sensor fins ---
    _buildEwarMesh(group, size) {
        const hullShape = new THREE.Shape();
        const sides = 6;
        for (let i = 0; i <= sides; i++) {
            const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
            const px = Math.cos(a) * size * 0.8;
            const py = Math.sin(a) * size * 0.6;
            if (i === 0) hullShape.moveTo(px, py);
            else hullShape.lineTo(px, py);
        }

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
            depth: size * 0.07, bevelEnabled: true, bevelThickness: size * 0.015,
            bevelSize: size * 0.01, bevelSegments: 1,
        });
        hullGeo.center();

        const hullMat = new THREE.MeshStandardMaterial({
            color: this.color, emissive: this.color, emissiveIntensity: 0.18,
            transparent: true, opacity: 0.9, roughness: 0.3, metalness: 0.45,
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        group.add(hull);

        // 4 sensor fin extensions (cross pattern)
        const finGeo = new THREE.PlaneGeometry(size * 0.5, size * 0.04);
        const finMat = new THREE.MeshBasicMaterial({ color: 0x6644aa, transparent: true, opacity: 0.5 });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const fin = new THREE.Mesh(finGeo, finMat);
            fin.rotation.z = angle;
            fin.position.set(
                Math.cos(angle) * size * 0.3,
                Math.sin(angle) * size * 0.3,
                0.05
            );
            group.add(fin);
        }

        // EW emitter ring (pulsing)
        const ringGeo = new THREE.RingGeometry(size * 0.35, size * 0.45, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: this.color, transparent: true, opacity: 0.3,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = 0.08;
        group.add(ring);
        this._ewarPulse = ring;

        // Rotating scan antenna on top
        const antennaGeo = new THREE.PlaneGeometry(size * 0.6, size * 0.025);
        const antennaMat = new THREE.MeshBasicMaterial({ color: 0xaa88ff, transparent: true, opacity: 0.4 });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.z = 0.09;
        group.add(antenna);
    }

    // --- Scout drone: sleek narrow dart hull ---
    _buildScoutMesh(group, size) {
        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 1.2, 0);
        hullShape.lineTo(size * 0.2, size * 0.18);
        hullShape.lineTo(-size * 0.3, size * 0.4);
        hullShape.lineTo(-size * 0.6, size * 0.25);
        hullShape.lineTo(-size * 0.7, size * 0.08);
        hullShape.lineTo(-size * 0.7, -size * 0.08);
        hullShape.lineTo(-size * 0.6, -size * 0.25);
        hullShape.lineTo(-size * 0.3, -size * 0.4);
        hullShape.lineTo(size * 0.2, -size * 0.18);
        hullShape.closePath();

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
            depth: size * 0.06, bevelEnabled: true, bevelThickness: size * 0.015,
            bevelSize: size * 0.008, bevelSegments: 1,
        });
        hullGeo.center();

        const hullMat = new THREE.MeshStandardMaterial({
            color: this.color, emissive: this.color, emissiveIntensity: 0.2,
            transparent: true, opacity: 0.9, roughness: 0.25, metalness: 0.55,
        });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        group.add(hull);

        // Swept-back sensor wings (thin, wide)
        const wingGeo = new THREE.PlaneGeometry(size * 0.35, size * 0.02);
        const wingMat = new THREE.MeshBasicMaterial({ color: 0x338866, transparent: true, opacity: 0.5 });
        for (const side of [1, -1]) {
            const wing = new THREE.Mesh(wingGeo, wingMat);
            wing.rotation.z = side * 0.4;
            wing.position.set(-size * 0.25, side * size * 0.3, 0.05);
            group.add(wing);
        }

        // Forward sensor eye
        const eyeGeo = new THREE.CircleGeometry(size * 0.08, 10);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.8 });
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(size * 0.7, 0, 0.07);
        group.add(eye);

        // Eye glow halo
        const eyeHaloGeo = new THREE.CircleGeometry(size * 0.18, 10);
        const eyeHaloMat = new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.15 });
        const eyeHalo = new THREE.Mesh(eyeHaloGeo, eyeHaloMat);
        eyeHalo.position.set(size * 0.7, 0, 0.06);
        group.add(eyeHalo);
    }
}
