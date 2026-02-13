// =============================================
// Three.js Renderer
// Handles all rendering with orthographic camera
// 3D-enhanced with dynamic lights and shadows
// =============================================

import { CONFIG } from '../config.js';
import { StarField } from './StarField.js';
import { Nebula } from './Nebula.js';
import { SpaceDust } from './SpaceDust.js';
import { Effects } from './Effects.js';
import { LightPool } from './LightPool.js';
import { EngineTrails } from './EngineTrails.js';
import { StatusEffects } from './StatusEffects.js';

export class Renderer {
    constructor(game) {
        this.game = game;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Render groups
        this.backgroundGroup = null;
        this.entityGroup = null;
        this.effectsGroup = null;
        this.uiGroup = null;

        // Special effects
        this.starField = null;
        this.nebula = null;
        this.spaceDust = null;
        this.effects = null;
        this.lightPool = null;
        this.engineTrails = null;
        this.statusEffects = null;
        this.beltDustMeshes = [];

        // Speed lines (streaks when moving fast)
        this.speedLines = null;
        this.speedLineCount = 40;

        // Entity mesh tracking
        this.entityMeshes = new Map();

        // Shadow tracking
        this.entityShadows = new Map();

        // Selection indicator
        this.selectionMesh = null;
        this.lockMesh = null;

        // Orbit ring visualization
        this.orbitRingMesh = null;

        // Weapon range ring
        this.weaponRangeMesh = null;
        this.weaponRangeTimer = 0;
        this.weaponRangePersist = false; // toggle with key

        // Mining progress ring
        this.miningRingMesh = null;

        // Target lead indicator
        this.leadIndicatorMesh = null;

        // Sensor sweep
        this.sensorSweepEnabled = false;
        this.sensorSweepAngle = 0;
        this.sensorSweepMesh = null;
        this.sensorSweepPings = [];

        // Velocity vector line
        this.velocityVectorMesh = null;
        this.velocityVectorTip = null;

        // Fleet formation lines
        this.fleetLines = [];

        // Docking tractor beam
        this.tractorBeamMesh = null;

        // Distance marker rings
        this.distanceRings = null;

        // Lighting
        this.hemisphereLight = null;
        this.directionalLight = null;

    }

    /**
     * Initialize the renderer
     */
    async init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000811);

        // Create orthographic camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = CONFIG.CAMERA_ZOOM_DEFAULT;

        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect,
            frustumSize * aspect,
            frustumSize,
            -frustumSize,
            0.1,
            1000
        );
        this.camera.position.z = 100;

        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Color space for correct output — NO tone mapping since this scene mixes
        // MeshBasicMaterial (nebula, particles, UI) with MeshStandardMaterial (ships, stations).
        // ACES tone mapping washes out the BasicMaterial colors.
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Add to DOM
        const container = document.getElementById('game-container');
        container.appendChild(this.renderer.domElement);

        // Create render groups
        this.backgroundGroup = new THREE.Group();
        this.entityGroup = new THREE.Group();
        this.effectsGroup = new THREE.Group();
        this.uiGroup = new THREE.Group();

        this.scene.add(this.backgroundGroup);
        this.scene.add(this.entityGroup);
        this.scene.add(this.effectsGroup);
        this.scene.add(this.uiGroup);

        // Create starfield
        this.starField = new StarField(this.game);
        this.backgroundGroup.add(this.starField.mesh);

        // Create nebula
        this.nebula = new Nebula(this.game);
        this.backgroundGroup.add(this.nebula.mesh);

        // Create ambient space dust
        this.spaceDust = new SpaceDust(this.game);
        this.backgroundGroup.add(this.spaceDust.mesh);

        // Create dynamic light pool
        this.lightPool = new LightPool(this.scene);

        // Create effects manager (pass lightPool for dynamic illumination)
        this.effects = new Effects(this.game, this.effectsGroup, this.lightPool);

        // Create engine trails
        this.engineTrails = new EngineTrails(this.game, this.entityGroup);

        // Create status effects (EWAR beams, shield flashes, prop flares)
        this.statusEffects = new StatusEffects(this.game, this.effectsGroup);

        // Create speed lines
        this.createSpeedLines();

        // Create selection indicators
        this.createSelectionIndicators();

        // Setup lighting for 3D objects
        this.setupLighting();

        // Create vignette overlay
        this.createVignette();

        // Handle window resize
        window.addEventListener('resize', this.onResize.bind(this));
    }

    /**
     * Create selection and lock indicator meshes
     */
    createSelectionIndicators() {
        // Selection brackets
        const bracketGroup = new THREE.Group();
        const bracketMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
        });

        // Create bracket corners
        const corners = [
            // Top-left
            [[-1, 1], [-1, 0.7], [-1, 1], [-0.7, 1]],
            // Top-right
            [[1, 1], [1, 0.7], [1, 1], [0.7, 1]],
            // Bottom-left
            [[-1, -1], [-1, -0.7], [-1, -1], [-0.7, -1]],
            // Bottom-right
            [[1, -1], [1, -0.7], [1, -1], [0.7, -1]],
        ];

        for (const corner of corners) {
            for (let i = 0; i < 2; i++) {
                const points = [
                    new THREE.Vector3(corner[i * 2][0] * 30, corner[i * 2][1] * 30, 0),
                    new THREE.Vector3(corner[i * 2 + 1][0] * 30, corner[i * 2 + 1][1] * 30, 0),
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, bracketMaterial);
                bracketGroup.add(line);
            }
        }

        this.selectionMesh = bracketGroup;
        this.selectionMesh.visible = false;
        this.uiGroup.add(this.selectionMesh);

        // Lock indicator (spinning circle)
        const lockGeometry = new THREE.RingGeometry(35, 40, 32, 1, 0, Math.PI * 1.5);
        const lockMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
        });
        this.lockMesh = new THREE.Mesh(lockGeometry, lockMaterial);
        this.lockMesh.visible = false;
        this.uiGroup.add(this.lockMesh);

        // Orbit ring visualization (dashed circle)
        const orbitRingGeometry = new THREE.RingGeometry(0.95, 1.0, 64);
        const orbitRingMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
        });
        this.orbitRingMesh = new THREE.Mesh(orbitRingGeometry, orbitRingMaterial);
        this.orbitRingMesh.visible = false;
        this.uiGroup.add(this.orbitRingMesh);

        // Orbit position marker (small dot on orbit ring)
        const markerGeometry = new THREE.CircleGeometry(4, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
        });
        this.orbitMarkerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
        this.orbitMarkerMesh.visible = false;
        this.uiGroup.add(this.orbitMarkerMesh);

        // Weapon range ring (dashed circle around player)
        const rangeRingGeo = new THREE.RingGeometry(0.97, 1.0, 64);
        const rangeRingMat = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.weaponRangeMesh = new THREE.Mesh(rangeRingGeo, rangeRingMat);
        this.weaponRangeMesh.visible = false;
        this.uiGroup.add(this.weaponRangeMesh);

        // Mining progress ring (arc that fills as mining cycle progresses)
        const miningArcGeo = new THREE.RingGeometry(1.0, 1.15, 32, 1, 0, Math.PI * 2);
        const miningArcMat = new THREE.MeshBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this.miningRingMesh = new THREE.Mesh(miningArcGeo, miningArcMat);
        this.miningRingMesh.visible = false;
        this.uiGroup.add(this.miningRingMesh);

        // Target lead indicator (crosshair at predicted position)
        const leadGroup = new THREE.Group();
        const leadMat = new THREE.LineBasicMaterial({
            color: 0xff6644,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });
        // Cross shape
        const cross = [
            [[-6, 0, 0], [6, 0, 0]],
            [[0, -6, 0], [0, 6, 0]],
        ];
        for (const [a, b] of cross) {
            const pts = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            leadGroup.add(new THREE.Line(geo, leadMat));
        }
        // Small diamond outline
        const diamondPts = [
            new THREE.Vector3(0, 8, 0),
            new THREE.Vector3(8, 0, 0),
            new THREE.Vector3(0, -8, 0),
            new THREE.Vector3(-8, 0, 0),
            new THREE.Vector3(0, 8, 0),
        ];
        const diamondGeo = new THREE.BufferGeometry().setFromPoints(diamondPts);
        leadGroup.add(new THREE.Line(diamondGeo, leadMat.clone()));
        this.leadIndicatorMesh = leadGroup;
        this.leadIndicatorMesh.visible = false;
        this.uiGroup.add(this.leadIndicatorMesh);

        // Velocity vector line (shows movement direction + speed)
        const velLinePositions = new Float32Array(6); // 2 points * 3 components
        const velGeo = new THREE.BufferGeometry();
        velGeo.setAttribute('position', new THREE.BufferAttribute(velLinePositions, 3));
        const velMat = new THREE.LineBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
        });
        this.velocityVectorMesh = new THREE.Line(velGeo, velMat);
        this.velocityVectorMesh.visible = false;
        this.velocityVectorMesh.frustumCulled = false;
        this.uiGroup.add(this.velocityVectorMesh);

        // Small chevron at tip
        const tipPts = [
            new THREE.Vector3(-4, -3, 0),
            new THREE.Vector3(0, 4, 0),
            new THREE.Vector3(4, -3, 0),
        ];
        const tipGeo = new THREE.BufferGeometry().setFromPoints(tipPts);
        const tipMat = new THREE.LineBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });
        this.velocityVectorTip = new THREE.Line(tipGeo, tipMat);
        this.velocityVectorTip.visible = false;
        this.uiGroup.add(this.velocityVectorTip);
    }

    /**
     * Setup lighting for 3D objects
     */
    setupLighting() {
        // Hemisphere light for ambient base — moderate so MeshStandardMaterial
        // colors stay close to their assigned hex values
        this.hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x222244, 0.4);
        this.scene.add(this.hemisphereLight);

        // Directional light from upper-right — angled to shade extruded side faces
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.directionalLight.position.set(200, 300, 500);
        this.scene.add(this.directionalLight);
    }

    /**
     * Create vignette overlay mesh (darkened edges for atmospheric depth)
     */
    createVignette() {
        // Use a screen-space quad with radial gradient texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(256, 256, 100, 256, 256, 360);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.85, 'rgba(0, 4, 12, 0.3)');
        gradient.addColorStop(1.0, 'rgba(0, 4, 12, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        this._vignetteTexture = new THREE.CanvasTexture(canvas);

        // Use a CSS overlay instead — cheaper and resolution-independent
        const vignetteEl = document.createElement('div');
        vignetteEl.id = 'vignette-overlay';
        vignetteEl.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
            box-shadow: inset 0 0 120px 30px rgba(0, 4, 12, 0.25);
            z-index: 1;
        `;
        document.getElementById('game-container').appendChild(vignetteEl);
    }

    /**
     * Create speed line streaks for high-velocity visual feedback
     */
    createSpeedLines() {
        this.speedLines = [];
        for (let i = 0; i < this.speedLineCount; i++) {
            const geo = new THREE.BufferGeometry();
            const positions = new Float32Array(6); // 2 points * xyz
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0x88ccff,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            });
            const line = new THREE.Line(geo, mat);
            line.frustumCulled = false;
            this.effectsGroup.add(line);
            this.speedLines.push({
                mesh: line,
                offsetX: 0,
                offsetY: 0,
                length: 30 + Math.random() * 60,
                drift: (Math.random() - 0.5) * 0.2,
            });
        }
    }

    /**
     * Update speed lines based on player velocity
     */
    updateSpeedLines(dt) {
        const player = this.game.player;
        if (!player?.alive || !this.speedLines) return;

        const speed = player.currentSpeed || 0;
        const maxSpeed = player.maxSpeed || 200;
        const isWarping = this.game.autopilot?.warping || false;
        const speedRatio = isWarping ? 3.0 : speed / maxSpeed;

        // Only show at > 70% speed (or always during warp)
        const threshold = isWarping ? 0 : 0.7;
        const intensity = isWarping ? 1.0 : Math.max(0, (speedRatio - threshold) / (1 - threshold));

        if (intensity <= 0) {
            for (const sl of this.speedLines) {
                sl.mesh.material.opacity = 0;
            }
            return;
        }

        const vx = isWarping ? Math.cos(player.rotation || 0) * 2000 : player.velocity.x;
        const vy = isWarping ? Math.sin(player.rotation || 0) * 2000 : player.velocity.y;
        const heading = Math.atan2(vy, vx);
        const viewHeight = 1000000 / (this.game.camera?.zoom || 100);
        const spread = viewHeight * (isWarping ? 0.6 : 0.4);

        for (let i = 0; i < this.speedLines.length; i++) {
            const sl = this.speedLines[i];

            // Respawn line if off-screen
            const respawnRate = isWarping ? 0.08 : 0.02;
            if (sl.mesh.material.opacity <= 0.01 || Math.random() < respawnRate) {
                // Place ahead and to sides of player
                const perp = heading + Math.PI / 2;
                const sideOffset = (Math.random() - 0.5) * spread * 2;
                const forwardOffset = (Math.random() - 0.3) * spread;
                sl.offsetX = Math.cos(heading) * forwardOffset + Math.cos(perp) * sideOffset;
                sl.offsetY = Math.sin(heading) * forwardOffset + Math.sin(perp) * sideOffset;
                sl.mesh.material.opacity = isWarping ? (0.3 + Math.random() * 0.4) : (0.15 + Math.random() * 0.25);
                sl.mesh.material.color.setHex(
                    isWarping ? (Math.random() > 0.5 ? 0xccddff : 0xffffff) :
                    (Math.random() > 0.3 ? 0x88ccff : 0xaaddff)
                );
            }

            // Move lines opposite to travel direction (streaking effect)
            const moveScale = isWarping ? 5.0 : 1.5;
            sl.offsetX -= vx * dt * moveScale;
            sl.offsetY -= vy * dt * moveScale;

            const x = player.x + sl.offsetX;
            const y = player.y + sl.offsetY;
            const lineLen = sl.length * intensity * (isWarping ? 4.0 : (0.5 + speedRatio));
            const ex = x - Math.cos(heading) * lineLen;
            const ey = y - Math.sin(heading) * lineLen;

            const positions = sl.mesh.geometry.attributes.position.array;
            positions[0] = x; positions[1] = y; positions[2] = 2;
            positions[3] = ex; positions[4] = ey; positions[5] = 2;
            sl.mesh.geometry.attributes.position.needsUpdate = true;

            // Fade based on distance from player
            const distSq = sl.offsetX * sl.offsetX + sl.offsetY * sl.offsetY;
            const maxDistSq = spread * spread;
            const distFade = Math.max(0, 1 - distSq / maxDistSq);
            const baseOpacity = isWarping ? (0.25 + Math.random() * 0.15) : (0.15 + Math.random() * 0.05);
            sl.mesh.material.opacity = intensity * distFade * baseOpacity;
        }
    }

    /**
     * Update spinning debris pieces from explosions
     */
    updateDebris(dt) {
        if (!this._debrisList || this._debrisList.length === 0) return;

        for (let i = this._debrisList.length - 1; i >= 0; i--) {
            const mesh = this._debrisList[i];
            const d = mesh.userData;
            d.life += dt;

            if (d.life >= d.maxLife) {
                this.effectsGroup.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                this._debrisList.splice(i, 1);
                continue;
            }

            // Move
            mesh.position.x += d.vx * dt;
            mesh.position.y += d.vy * dt;
            // Slow down
            d.vx *= 0.99;
            d.vy *= 0.99;
            // Spin
            mesh.rotation.z += d.spin * dt;
            // Fade
            const progress = d.life / d.maxLife;
            mesh.material.opacity = 0.9 * (1 - progress * progress);
        }
    }

    toggleWeaponRange() {
        this.weaponRangePersist = !this.weaponRangePersist;
        return this.weaponRangePersist;
    }

    toggleSensorSweep() {
        this.sensorSweepEnabled = !this.sensorSweepEnabled;
        if (!this.sensorSweepEnabled) {
            // Clean up
            if (this.sensorSweepMesh) {
                this.uiGroup.remove(this.sensorSweepMesh);
                this.sensorSweepMesh.geometry.dispose();
                this.sensorSweepMesh.material.dispose();
                this.sensorSweepMesh = null;
            }
            for (const ping of this.sensorSweepPings) {
                this.effectsGroup.remove(ping);
                ping.geometry.dispose();
                ping.material.dispose();
            }
            this.sensorSweepPings = [];
        }
        return this.sensorSweepEnabled;
    }

    updateSensorSweep(dt) {
        if (!this.sensorSweepEnabled) return;
        const player = this.game.player;
        if (!player) return;

        const sweepRadius = 2000;
        const sweepArc = Math.PI / 4; // 45-degree cone
        const rotSpeed = 1.2; // radians per second

        this.sensorSweepAngle += rotSpeed * dt;
        if (this.sensorSweepAngle > Math.PI * 2) this.sensorSweepAngle -= Math.PI * 2;

        // Create sweep mesh if needed
        if (!this.sensorSweepMesh) {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            const segments = 20;
            for (let i = 0; i <= segments; i++) {
                const a = -sweepArc / 2 + (sweepArc * i / segments);
                shape.lineTo(Math.cos(a) * sweepRadius, Math.sin(a) * sweepRadius);
            }
            shape.lineTo(0, 0);
            const geo = new THREE.ShapeGeometry(shape);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.06,
                side: THREE.DoubleSide,
            });
            this.sensorSweepMesh = new THREE.Mesh(geo, mat);
            this.sensorSweepMesh.position.z = 5;
            this.uiGroup.add(this.sensorSweepMesh);
        }

        // Position sweep on player
        this.sensorSweepMesh.position.x = player.x;
        this.sensorSweepMesh.position.y = player.y;
        this.sensorSweepMesh.rotation.z = this.sensorSweepAngle;

        // Check entities in sweep cone and spawn pings
        const sector = this.game.currentSector;
        if (sector) {
            for (const entity of sector.entities) {
                if (entity === player || !entity.alive) continue;
                const dx = entity.x - player.x;
                const dy = entity.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > sweepRadius || dist < 30) continue;

                // Check if entity is within sweep cone
                const entityAngle = Math.atan2(dy, dx);
                let angleDiff = entityAngle - this.sensorSweepAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                if (Math.abs(angleDiff) < sweepArc / 2 && Math.abs(angleDiff) > sweepArc / 4) {
                    // Spawn a brief ping circle
                    const pingGeo = new THREE.RingGeometry(8, 12, 12);
                    const pingColor = entity.hostility === 'hostile' ? 0xff4444 :
                        (entity.type === 'asteroid' ? 0xffaa00 : 0x00ffaa);
                    const pingMat = new THREE.MeshBasicMaterial({
                        color: pingColor,
                        transparent: true,
                        opacity: 0.7,
                    });
                    const pingMesh = new THREE.Mesh(pingGeo, pingMat);
                    pingMesh.position.set(entity.x, entity.y, 12);
                    pingMesh.userData = { life: 0, maxLife: 1.5 };
                    this.effectsGroup.add(pingMesh);
                    this.sensorSweepPings.push(pingMesh);
                }
            }
        }

        // Update pings
        for (let i = this.sensorSweepPings.length - 1; i >= 0; i--) {
            const ping = this.sensorSweepPings[i];
            ping.userData.life += dt;
            if (ping.userData.life >= ping.userData.maxLife) {
                this.effectsGroup.remove(ping);
                ping.geometry.dispose();
                ping.material.dispose();
                this.sensorSweepPings.splice(i, 1);
                continue;
            }
            const t = ping.userData.life / ping.userData.maxLife;
            ping.material.opacity = 0.7 * (1 - t);
            const s = 1 + t * 0.5;
            ping.scale.setScalar(s);
        }
    }

    /**
     * Update fleet formation lines connecting fleet ships in same control group
     */
    updateFleetFormation() {
        // Clear old lines
        for (const line of this.fleetLines) {
            this.uiGroup.remove(line);
            line.geometry.dispose();
            line.material.dispose();
        }
        this.fleetLines = [];

        const fleet = this.game.fleetSystem;
        if (!fleet?.controlGroups) return;
        const player = this.game.player;
        if (!player?.alive) return;

        // Group colors
        const groupColors = [0, 0x44ffaa, 0x44aaff, 0xffaa44, 0xff44aa, 0xaaff44];

        for (const [groupId, memberIds] of fleet.controlGroups) {
            if (memberIds.size < 1) continue;

            const ships = [];
            const allFleetShips = this.game.fleet?.ships || [];
            for (const id of memberIds) {
                const ship = allFleetShips.find(s => s.fleetId === id);
                if (ship?.alive) {
                    ships.push(ship);
                }
            }
            if (ships.length < 1) continue;

            const color = groupColors[groupId] || 0x88ff88;

            // Draw lines from player to each fleet ship in this group
            for (const ship of ships) {
                const points = [
                    new THREE.Vector3(player.x, player.y, 2),
                    new THREE.Vector3(ship.x, ship.y, 2),
                ];
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const mat = new THREE.LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.08,
                    depthWrite: false,
                });
                const line = new THREE.Line(geo, mat);
                line.frustumCulled = false;
                this.uiGroup.add(line);
                this.fleetLines.push(line);
            }

            // Small group number badge (as a text sprite would be complex, use a dot instead)
            for (const ship of ships) {
                const dotGeo = new THREE.CircleGeometry(3, 6);
                const dotMat = new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.5,
                    depthWrite: false,
                });
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.position.set(ship.x, ship.y + (ship.radius || 20) + 8, 5);
                this.uiGroup.add(dot);
                this.fleetLines.push(dot); // reuse array for cleanup
            }
        }
    }

    /**
     * Load a sector's entities into the scene
     */
    loadSector(sector) {
        // Update nebula for this sector
        this.nebula.setSeed(sector.seed);

        // Update space dust for sector theme
        this.spaceDust.regenerate(sector.id);

        // Create asteroid belt dust clouds
        this.createBeltDustClouds(sector);

        // Create meshes for all entities
        for (const entity of sector.entities) {
            this.addEntityMesh(entity);
        }

        // Add player mesh
        if (this.game.player) {
            this.addEntityMesh(this.game.player);
        }
    }

    /**
     * Clear all sector entities from scene
     */
    clearSector() {
        // Remove all entity meshes and dispose GPU resources
        for (const [entity, mesh] of this.entityMeshes) {
            this.entityGroup.remove(mesh);
            this.disposeMesh(mesh);
        }
        this.entityMeshes.clear();

        // Remove all shadows
        for (const [entity, shadow] of this.entityShadows) {
            this.entityGroup.remove(shadow);
            shadow.geometry.dispose();
            shadow.material.dispose();
        }
        this.entityShadows.clear();

        // Clear asteroid belt dust clouds
        this.clearBeltDustClouds();

        // Clear effects, lights, trails, and status effects
        this.effects.clear();
        this.lightPool.clear();
        this.engineTrails.clear();
        this.statusEffects.clear();
    }

    /**
     * Add mesh for an entity
     */
    addEntityMesh(entity) {
        if (this.entityMeshes.has(entity)) return;

        const mesh = entity.createMesh();
        if (mesh) {
            this.entityGroup.add(mesh);
            this.entityMeshes.set(entity, mesh);

            // Create shadow for ships, stations, and asteroids
            this.createEntityShadow(entity);
        }
    }

    /**
     * Create a shadow beneath an entity
     */
    createEntityShadow(entity) {
        if (this.entityShadows.has(entity)) return;

        const r = entity.radius || 20;
        // Elliptical shadow - wider than tall to match tilt perspective
        const shadowGeo = new THREE.CircleGeometry(r * 1.2, 16);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.position.set(entity.x, entity.y - r * 0.15, -0.5);
        shadow.scale.y = 0.6; // Squash vertically for perspective shadow
        shadow.renderOrder = -1;
        this.entityGroup.add(shadow);
        this.entityShadows.set(entity, shadow);
    }

    /**
     * Remove mesh for an entity
     */
    removeEntityMesh(entity) {
        const mesh = this.entityMeshes.get(entity);
        if (mesh) {
            this.entityGroup.remove(mesh);
            this.disposeMesh(mesh);
            this.entityMeshes.delete(entity);
        }

        // Remove shadow too
        const shadow = this.entityShadows.get(entity);
        if (shadow) {
            this.entityGroup.remove(shadow);
            shadow.geometry.dispose();
            shadow.material.dispose();
            this.entityShadows.delete(entity);
        }
    }

    /**
     * Dispose of a mesh's geometry and materials to free GPU memory
     */
    disposeMesh(mesh) {
        mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    /**
     * Create dust cloud visuals for asteroid belt fields
     */
    createBeltDustClouds(sector) {
        this.beltDustMeshes = [];

        if (!sector.asteroidFields) return;

        for (const field of sector.asteroidFields) {
            const group = new THREE.Group();
            group.position.set(field.x, field.y, -1);

            // Main dust cloud - large, soft circle
            const mainGeo = new THREE.CircleGeometry(field.radius * 0.9, 32);
            const mainMat = new THREE.MeshBasicMaterial({
                color: 0x8899aa,
                transparent: true,
                opacity: 0.04,
                depthWrite: false,
            });
            group.add(new THREE.Mesh(mainGeo, mainMat));

            // Inner glow - slightly brighter core
            const innerGeo = new THREE.CircleGeometry(field.radius * 0.5, 24);
            const innerMat = new THREE.MeshBasicMaterial({
                color: 0x99aabb,
                transparent: true,
                opacity: 0.06,
                depthWrite: false,
            });
            group.add(new THREE.Mesh(innerGeo, innerMat));

            // Scatter a few micro-dust particles for texture
            const dustCount = 8 + field.seed * 3;
            for (let i = 0; i < dustCount; i++) {
                const angle = (i / dustCount) * Math.PI * 2 + field.seed * 0.5;
                const dist = field.radius * (0.2 + Math.abs(Math.sin(i * 2.7 + field.seed)) * 0.7);
                const dotSize = 20 + Math.abs(Math.sin(i * 1.3 + field.seed * 2)) * 80;

                const dotGeo = new THREE.CircleGeometry(dotSize, 8);
                const dotMat = new THREE.MeshBasicMaterial({
                    color: 0x667788,
                    transparent: true,
                    opacity: 0.03 + Math.abs(Math.sin(i * 3.1)) * 0.04,
                    depthWrite: false,
                });
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.position.set(
                    Math.cos(angle) * dist,
                    Math.sin(angle) * dist,
                    0
                );
                group.add(dot);
            }

            this.backgroundGroup.add(group);
            this.beltDustMeshes.push(group);
        }
    }

    /**
     * Clear asteroid belt dust clouds
     */
    clearBeltDustClouds() {
        if (!this.beltDustMeshes) return;
        for (const mesh of this.beltDustMeshes) {
            this.backgroundGroup.remove(mesh);
            this.disposeMesh(mesh);
        }
        this.beltDustMeshes = [];
    }

    /**
     * Main render function
     */
    render() {
        // Update camera from game camera
        this.updateCamera();

        // Update entity meshes
        this.updateEntityMeshes();

        // Update entity shadows
        this.updateEntityShadows();

        // Update selection indicators
        this.updateSelectionIndicators();

        // Update starfield parallax
        this.starField.update(this.game.camera);

        // Update nebula animation
        this.nebula.update(1 / 60);

        // Update ambient space dust
        this.spaceDust.update(1 / 60, this.game.camera);

        // Update engine trails
        this.engineTrails.update(1 / 60);

        // Update status effects (EWAR beams, shield flashes, etc.)
        this.statusEffects.update(1 / 60);

        // Update speed lines
        this.updateSpeedLines(1 / 60);

        // Update debris pieces
        this.updateDebris(1 / 60);

        // Update sensor sweep
        this.updateSensorSweep(1 / 60);

        // Update fleet formation lines
        this.updateFleetFormation();

        // Station ambient particles — occasional dock sparks and energy wisps
        this._stationParticleTimer = (this._stationParticleTimer || 0) + 1/60;
        if (this._stationParticleTimer > 0.3) {
            this._stationParticleTimer = 0;
            const entities = this.game.currentSector?.entities || [];
            for (const e of entities) {
                if ((e.type === 'station' || e.type === 'player-station') && e.alive && e.visible) {
                    if (Math.random() < 0.4) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = e.radius * (0.5 + Math.random() * 0.5);
                        const px = e.x + Math.cos(angle) * dist;
                        const py = e.y + Math.sin(angle) * dist;
                        this.effects.spawn('hit', px, py, {
                            count: 1,
                            color: Math.random() < 0.5 ? 0x44ffaa : 0x4488ff,
                            speed: 8,
                            size: 1.5,
                            life: 1.5,
                        });
                    }
                }
            }
        }

        // Update effects
        this.effects.update(1 / 60);

        // Update dynamic lights
        this.lightPool.update(1 / 60);

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Update Three.js camera from game camera
     */
    updateCamera() {
        const gameCamera = this.game.camera;
        if (!gameCamera) return;

        const pos = gameCamera.getPosition();
        const zoom = gameCamera.zoom;
        const aspect = window.innerWidth / window.innerHeight;

        // Update orthographic frustum based on zoom
        const viewHeight = 1000000 / zoom;
        const viewWidth = viewHeight * aspect;

        this.camera.left = -viewWidth / 2;
        this.camera.right = viewWidth / 2;
        this.camera.top = viewHeight / 2;
        this.camera.bottom = -viewHeight / 2;

        this.camera.position.x = pos.x;
        this.camera.position.y = pos.y;

        this.camera.updateProjectionMatrix();
    }

    /**
     * Update all entity meshes
     */
    updateEntityMeshes() {
        // Compute LOD pixel scale once per frame
        const zoom = this.game.camera?.zoom || 100;
        const viewHeight = 1000000 / zoom;
        const screenHeight = window.innerHeight;
        const pixelScale = screenHeight / viewHeight;

        // Gather override targets (never fully cull these)
        const player = this.game.player;
        const selected = this.game.selectedTarget;
        const locked = this.game.lockedTarget;
        const locking = this.game.lockingTarget;

        // Update existing entities
        for (const [entity, mesh] of this.entityMeshes) {
            if (!entity.alive) {
                this.removeEntityMesh(entity);
                continue;
            }

            // Compute screen size and assign LOD level
            const screenSize = (entity.radius || 20) * 2 * pixelScale;
            let lodLevel;
            if (screenSize >= 15) {
                lodLevel = 0; // Full detail
            } else if (screenSize >= 2) {
                lodLevel = 1; // Simplified
            } else {
                lodLevel = 2; // Culled
            }

            // Overrides: player always full detail
            if (entity === player) {
                lodLevel = 0;
            }
            // Selected/locked/locking targets never fully culled
            if (lodLevel === 2 && (entity === selected || entity === locked || entity === locking)) {
                lodLevel = 1;
            }

            entity._lodLevel = lodLevel;

            if (lodLevel === 2) {
                // Fully culled - hide mesh and shadow, skip updateMesh
                mesh.visible = false;
                const shadow = this.entityShadows.get(entity);
                if (shadow) shadow.visible = false;
                continue;
            }

            // Call updateMesh for LOD 0 and LOD 1
            entity.updateMesh();

            if (lodLevel === 1) {
                // Simplified: hide shadow, hide extra ship children (turrets, etc.)
                const shadow = this.entityShadows.get(entity);
                if (shadow) shadow.visible = false;

                // For ships with children (shield overlay at [0], turrets at [1+])
                // Keep hull mesh visible but hide children beyond index 0
                if (mesh.children && mesh.children.length > 1) {
                    for (let i = 1; i < mesh.children.length; i++) {
                        mesh.children[i].visible = false;
                    }
                    entity._lodSimplified = true;
                }
            } else if (lodLevel === 0 && entity._lodSimplified) {
                // Restore previously hidden children
                if (mesh.children) {
                    for (let i = 0; i < mesh.children.length; i++) {
                        mesh.children[i].visible = true;
                    }
                }
                entity._lodSimplified = false;
            }
        }

        // Add meshes for new entities
        if (this.game.currentSector) {
            for (const entity of this.game.currentSector.entities) {
                if (entity.alive && !this.entityMeshes.has(entity)) {
                    this.addEntityMesh(entity);
                }
            }
        }
    }

    /**
     * Update shadow positions to follow entities
     */
    updateEntityShadows() {
        for (const [entity, shadow] of this.entityShadows) {
            if (!entity.alive) continue;
            // Skip shadow update for LOD 1+ (already hidden by updateEntityMeshes)
            if (entity._lodLevel >= 1) continue;
            const r = entity.radius || 20;
            // Shadow offset slightly below entity to simulate light from upper-front
            shadow.position.set(entity.x, entity.y - r * 0.15, -0.5);
            shadow.visible = entity.visible && entity.alive;
        }
    }

    /**
     * Update selection and lock indicators
     */
    updateSelectionIndicators() {
        // Track animation time
        this._animTime = (this._animTime || 0) + 0.016;

        // Selection brackets
        const selected = this.game.selectedTarget;
        if (selected && selected.alive) {
            this.selectionMesh.visible = true;
            this.selectionMesh.position.set(selected.x, selected.y, 5);

            // Scale with breathing pulse
            const baseScale = (selected.radius || 30) / 30;
            const pulse = 1.0 + Math.sin(this._animTime * 3) * 0.08;
            this.selectionMesh.scale.setScalar(baseScale * pulse);

            // Pulsing opacity
            const bracketOpacity = 0.6 + Math.sin(this._animTime * 3) * 0.3;
            this.selectionMesh.children.forEach(child => {
                if (child.material) child.material.opacity = bracketOpacity;
            });

            // Rotate slowly
            this.selectionMesh.rotation.z += 0.01;
        } else {
            this.selectionMesh.visible = false;
        }

        // Lock indicator
        const locked = this.game.lockedTarget;
        if (locked && locked.alive) {
            this.lockMesh.visible = true;
            this.lockMesh.position.set(locked.x, locked.y, 5);

            // Scale with pulse
            const baseScale = (locked.radius || 30) / 30;
            const lockPulse = 1.0 + Math.sin(this._animTime * 4) * 0.05;
            this.lockMesh.scale.setScalar(baseScale * lockPulse);

            // Pulsing opacity
            this.lockMesh.material.opacity = 0.6 + Math.sin(this._animTime * 4) * 0.3;

            // Rotate
            this.lockMesh.rotation.z -= 0.03;
        } else {
            this.lockMesh.visible = false;
        }

        // Orbit ring visualization
        const autopilot = this.game.autopilot;
        if (autopilot?.command === 'orbit' && autopilot.target?.alive && this.orbitRingMesh) {
            const orbitTarget = autopilot.target;
            const orbitRadius = autopilot.distance || 300;
            const tiltFactor = this.game.player?.orbitTilt || 0.7;

            this.orbitRingMesh.visible = true;
            this.orbitRingMesh.position.set(orbitTarget.x, orbitTarget.y, 2);
            this.orbitRingMesh.scale.set(orbitRadius, orbitRadius * tiltFactor, 1);

            // Pulsing opacity
            this.orbitRingMesh.material.opacity = 0.1 + Math.sin(this._animTime * 2) * 0.05;

            // Player position marker on orbit ring
            if (this.game.player && this.orbitMarkerMesh) {
                this.orbitMarkerMesh.visible = true;
                const phase = this.game.player.orbitPhase || 0;
                const mx = orbitTarget.x + Math.cos(phase) * orbitRadius;
                const my = orbitTarget.y + Math.sin(phase) * orbitRadius * tiltFactor;
                this.orbitMarkerMesh.position.set(mx, my, 3);
                this.orbitMarkerMesh.material.opacity = 0.4 + Math.sin(this._animTime * 5) * 0.3;
            }
        } else {
            if (this.orbitRingMesh) this.orbitRingMesh.visible = false;
            if (this.orbitMarkerMesh) this.orbitMarkerMesh.visible = false;
        }

        // Weapon range ring (shows when player is firing)
        if (this.weaponRangeMesh) {
            const player = this.game.player;
            let showRange = false;
            let maxRange = 0;

            if (player?.alive && player.activeModules?.size > 0) {
                for (const slotId of player.activeModules) {
                    const [slotType, idx] = player.parseSlotId?.(slotId) || [];
                    if (slotType === undefined) continue;
                    const moduleId = player.modules[slotType]?.[idx];
                    if (!moduleId) continue;
                    const config = player.getModuleConfig?.(moduleId);
                    if (config?.damage || config?.type === 'weapon') {
                        showRange = true;
                        maxRange = Math.max(maxRange, config.range || config.attackRange || 400);
                    }
                }
            }

            // Persistent weapon range display
            if (this.weaponRangePersist && player?.alive) {
                let wpnRange = 0;
                for (const [slotType, slots] of Object.entries(player.modules || {})) {
                    if (slotType !== 'high') continue;
                    for (const moduleId of slots) {
                        if (!moduleId) continue;
                        const cfg = player.getModuleConfig?.(moduleId);
                        if (cfg?.damage || cfg?.type === 'weapon') {
                            wpnRange = Math.max(wpnRange, cfg.range || cfg.attackRange || 400);
                        }
                    }
                }
                if (wpnRange > 0) maxRange = Math.max(maxRange, wpnRange);
                showRange = true;
            }

            if (showRange && maxRange > 0) {
                this.weaponRangeTimer = 2.0;
                this.weaponRangeMesh.visible = true;
                this.weaponRangeMesh.position.set(player.x, player.y, 1);
                this.weaponRangeMesh.scale.set(maxRange, maxRange, 1);
                const baseOpacity = this.weaponRangePersist ? 0.06 : 0.08;
                this.weaponRangeMesh.material.opacity = baseOpacity + Math.sin(this._animTime * 3) * 0.03;
            } else if (this.weaponRangeTimer > 0) {
                this.weaponRangeTimer -= 0.016;
                const player2 = this.game.player;
                if (player2?.alive) {
                    this.weaponRangeMesh.position.set(player2.x, player2.y, 1);
                }
                this.weaponRangeMesh.material.opacity = Math.max(0, this.weaponRangeTimer * 0.05);
            } else {
                this.weaponRangeMesh.visible = false;
            }
        }

        // Mining progress ring
        if (this.miningRingMesh) {
            const miningData = this.game.mining?.activeMining?.get(this.game.player);
            if (miningData?.asteroid?.alive) {
                const asteroid = miningData.asteroid;
                const r = (asteroid.radius || 20) + 8;

                // Find mining module cycle progress
                let progress = 0;
                const player3 = this.game.player;
                if (player3) {
                    for (const slotId of player3.activeModules) {
                        const [slotType, idx] = player3.parseSlotId?.(slotId) || [];
                        if (slotType === undefined) continue;
                        const moduleId = player3.modules[slotType]?.[idx];
                        if (!moduleId || !moduleId.includes('mining')) continue;
                        const cooldown = player3.moduleCooldowns?.get(slotId) || 0;
                        const config = player3.getModuleConfig?.(moduleId);
                        if (config?.cycleTime) {
                            progress = Math.max(progress, 1 - cooldown / config.cycleTime);
                        }
                    }
                }

                // Only recreate geometry when arc or radius changes significantly
                const arc = Math.max(0.01, progress) * Math.PI * 2;
                if (!this._lastMiningArc || Math.abs(arc - this._lastMiningArc) > 0.05 || Math.abs(r - (this._lastMiningRingR || 0)) > 1) {
                    this.miningRingMesh.geometry.dispose();
                    this.miningRingMesh.geometry = new THREE.RingGeometry(r, r + 3, 32, 1, 0, arc);
                    this._lastMiningArc = arc;
                    this._lastMiningRingR = r;
                }
                this.miningRingMesh.visible = true;
                this.miningRingMesh.position.set(asteroid.x, asteroid.y, 3);
                this.miningRingMesh.rotation.z = -Math.PI / 2; // Start from top
                this.miningRingMesh.material.opacity = 0.3 + progress * 0.3;
            } else {
                this.miningRingMesh.visible = false;
                this._lastMiningArc = 0;
                this._lastMiningRingR = 0;
            }
        }

        // Target lead indicator
        if (this.leadIndicatorMesh) {
            const locked2 = this.game.lockedTarget;
            if (locked2?.alive && locked2.velocity && this.game.player?.alive) {
                const vx = locked2.velocity.x || 0;
                const vy = locked2.velocity.y || 0;
                const speed2 = Math.sqrt(vx * vx + vy * vy);

                if (speed2 > 5) {
                    // Predict position 1.5 seconds ahead
                    const leadTime = 1.5;
                    const px = locked2.x + vx * leadTime;
                    const py = locked2.y + vy * leadTime;

                    this.leadIndicatorMesh.visible = true;
                    this.leadIndicatorMesh.position.set(px, py, 6);
                    this.leadIndicatorMesh.rotation.z += 0.02;
                    // Pulse opacity
                    const opc = 0.25 + Math.sin(this._animTime * 4) * 0.15;
                    this.leadIndicatorMesh.children.forEach(c => {
                        if (c.material) c.material.opacity = opc;
                    });
                } else {
                    this.leadIndicatorMesh.visible = false;
                }
            } else {
                this.leadIndicatorMesh.visible = false;
            }
        }

        // Lock progress ring (while locking target)
        if (!this.lockProgressMesh) {
            const lpGeo = new THREE.RingGeometry(0.95, 1.0, 32, 1, 0, Math.PI * 2);
            const lpMat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            this.lockProgressMesh = new THREE.Mesh(lpGeo, lpMat);
            this.lockProgressMesh.visible = false;
            this.uiGroup.add(this.lockProgressMesh);
        }

        const lockTarget = this.game.lockingTarget;
        if (lockTarget?.alive && this.game.lockingStartTime) {
            const elapsed = performance.now() - this.game.lockingStartTime;
            const progress = Math.min(elapsed / this.game.lockingDuration, 1);
            const r = (lockTarget.radius || 30) + 12;

            // Only recreate geometry when arc or radius changes significantly
            const arc = Math.max(0.01, progress) * Math.PI * 2;
            if (!this._lastLockArc || Math.abs(arc - this._lastLockArc) > 0.05 || Math.abs(r - (this._lastLockRingR || 0)) > 1) {
                this.lockProgressMesh.geometry.dispose();
                this.lockProgressMesh.geometry = new THREE.RingGeometry(r - 2, r, 32, 1, 0, arc);
                this._lastLockArc = arc;
                this._lastLockRingR = r;
            }
            this.lockProgressMesh.visible = true;
            this.lockProgressMesh.position.set(lockTarget.x, lockTarget.y, 6);
            this.lockProgressMesh.rotation.z = -Math.PI / 2; // Start from top
            this.lockProgressMesh.material.opacity = 0.3 + progress * 0.4;
        } else {
            this.lockProgressMesh.visible = false;
            this._lastLockArc = 0;
            this._lastLockRingR = 0;
        }

        // Velocity vector line (movement direction from player ship)
        if (this.velocityVectorMesh) {
            const p = this.game.player;
            if (p?.alive && (p.currentSpeed || 0) > 10) {
                const vx = p.velocity?.x || 0;
                const vy = p.velocity?.y || 0;
                const speed = Math.sqrt(vx * vx + vy * vy);
                if (speed > 10) {
                    // Line length scales with speed (30-150 units)
                    const lineLen = Math.min(30 + speed * 0.5, 150);
                    const nx = vx / speed;
                    const ny = vy / speed;

                    // Start slightly ahead of ship
                    const startOff = (p.radius || 20) + 5;
                    const sx = p.x + nx * startOff;
                    const sy = p.y + ny * startOff;
                    const ex = p.x + nx * (startOff + lineLen);
                    const ey = p.y + ny * (startOff + lineLen);

                    const positions = this.velocityVectorMesh.geometry.attributes.position;
                    positions.setXYZ(0, sx, sy, 4);
                    positions.setXYZ(1, ex, ey, 4);
                    positions.needsUpdate = true;
                    this.velocityVectorMesh.visible = true;

                    // Speed-based opacity (faster = more visible)
                    const speedFactor = Math.min(speed / 200, 1);
                    this.velocityVectorMesh.material.opacity = 0.15 + speedFactor * 0.25;

                    // Position chevron tip at end, rotated to face direction
                    this.velocityVectorTip.position.set(ex, ey, 4);
                    this.velocityVectorTip.rotation.z = Math.atan2(ny, nx) - Math.PI / 2;
                    this.velocityVectorTip.visible = true;
                    this.velocityVectorTip.material.opacity = 0.2 + speedFactor * 0.3;
                } else {
                    this.velocityVectorMesh.visible = false;
                    this.velocityVectorTip.visible = false;
                }
            } else {
                this.velocityVectorMesh.visible = false;
                this.velocityVectorTip.visible = false;
            }
        }

        // Distance marker rings centered on player when target is selected
        {
            const p = this.game.player;
            const tgt = this.game.selectedTarget || this.game.lockedTarget;
            if (p?.alive && tgt?.alive) {
                if (!this.distanceRings) {
                    this.distanceRings = [];
                    const distances = [250, 500, 1000];
                    for (const d of distances) {
                        const geo = new THREE.RingGeometry(d - 1, d + 1, 64);
                        const mat = new THREE.MeshBasicMaterial({
                            color: 0x446688,
                            transparent: true,
                            opacity: 0.06,
                            side: THREE.DoubleSide,
                        });
                        const ring = new THREE.Mesh(geo, mat);
                        ring.frustumCulled = false;
                        ring.position.z = 0.5;
                        this.uiGroup.add(ring);
                        this.distanceRings.push({ mesh: ring, dist: d });
                    }
                }
                for (const r of this.distanceRings) {
                    r.mesh.position.set(p.x, p.y, 0.5);
                    r.mesh.visible = true;
                    r.mesh.material.opacity = 0.04 + Math.sin(this._animTime * 1.5 + r.dist * 0.01) * 0.02;
                }
            } else if (this.distanceRings) {
                for (const r of this.distanceRings) r.mesh.visible = false;
            }
        }

        // Docking tractor beam — green beam from station to player when in dock range
        const player = this.game.player;
        if (player?.alive) {
            const entities = this.game.currentSector?.entities || [];
            let nearStation = null;
            for (const e of entities) {
                if ((e.type === 'station' || e.type === 'player-station') && e.alive) {
                    const dx = player.x - e.x;
                    const dy = player.y - e.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < e.dockingRange) {
                        nearStation = e;
                        break;
                    }
                }
            }

            if (nearStation) {
                if (!this.tractorBeamMesh) {
                    const beamGeo = new THREE.BufferGeometry();
                    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0], 3));
                    const beamMat = new THREE.LineBasicMaterial({
                        color: 0x44ff88,
                        transparent: true,
                        opacity: 0.3,
                    });
                    this.tractorBeamMesh = new THREE.Line(beamGeo, beamMat);
                    this.tractorBeamMesh.frustumCulled = false;
                    this.uiGroup.add(this.tractorBeamMesh);
                }
                const positions = this.tractorBeamMesh.geometry.attributes.position;
                positions.setXYZ(0, nearStation.x, nearStation.y, 3);
                positions.setXYZ(1, player.x, player.y, 3);
                positions.needsUpdate = true;
                const pulse = 0.15 + Math.sin(this._animTime * 5) * 0.1;
                this.tractorBeamMesh.material.opacity = pulse;
                this.tractorBeamMesh.visible = true;
            } else if (this.tractorBeamMesh) {
                this.tractorBeamMesh.visible = false;
            }
        } else if (this.tractorBeamMesh) {
            this.tractorBeamMesh.visible = false;
        }
    }

    /**
     * Add a visual effect
     */
    addEffect(type, x, y, options = {}) {
        return this.effects.spawn(type, x, y, options);
    }

    /**
     * Handle window resize
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        this.updateCamera();
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

        const vector = new THREE.Vector3(ndcX, ndcY, 0);
        vector.unproject(this.camera);
        return { x: vector.x, y: vector.y };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        const vector = new THREE.Vector3(worldX, worldY, 0);
        vector.project(this.camera);

        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: (vector.x + 1) / 2 * rect.width + rect.left,
            y: -(vector.y - 1) / 2 * rect.height + rect.top,
        };
    }
}
