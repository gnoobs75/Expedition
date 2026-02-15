// =============================================
// 3D Holographic Universe Map Renderer
// Three.js globe with sector nodes, gate connections,
// route visualization, and interactive orbit controls.
// =============================================

import { UNIVERSE_LAYOUT } from '../config.js';

// Difficulty color mapping
const DIFFICULTY_COLORS = {
    tutorial: 0x44ffaa,
    hub: 0x22dd44,
    safe: 0x44ee55,
    tame: 0x88ddaa,
    neutral: 0xddaa44,
    normal: 0xddcc22,
    dangerous: 0xee8822,
    deadly: 0xee2222,
};

// Autopilot speed tiers
export const AUTOPILOT_TIERS = {
    best:     { threshold: 0.25, label: 'Best Speed',    desc: '25% cap - fastest travel' },
    standard: { threshold: 0.50, label: 'Standard',      desc: '50% cap - balanced' },
    cautious: { threshold: 0.75, label: 'Cautious',      desc: '75% cap - safe' },
    combat:   { threshold: 1.00, label: 'Combat Ready',  desc: '100% cap - maximum safety' },
};

export class UniverseMapRenderer3D {
    constructor(game, container) {
        this.game = game;
        this.container = container;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = null;
        this.mouse = null;

        // Scene groups
        this.globeGroup = null;      // Wireframe sphere
        this.nodesGroup = null;      // Sector node meshes
        this.gatesGroup = null;      // Gate connection lines
        this.routeGroup = null;      // Route overlay
        this.labelsGroup = null;     // Sector name sprites
        this.starsGroup = null;      // Background stars

        // Sector data
        this.sectorPositions = {};   // sectorId -> THREE.Vector3
        this.sectorMeshes = {};      // sectorId -> mesh
        this.sectorData = {};        // sectorId -> config data

        // Camera orbit
        this.cameraDistance = 550;
        this.rotationX = 0.3;        // Slight tilt to see top
        this.rotationY = -0.5;
        this.autoRotateSpeed = 0.0008;
        this.isAutoRotating = true;

        // Mouse interaction
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.previousMouse = { x: 0, y: 0 };
        this.hoveredSector = null;

        // Tooltip
        this.tooltipEl = null;

        // Animation
        this.animationId = null;
        this.animTime = 0;
        this.initialized = false;

        // Route state
        this.activeRoute = null;
        this.cachedRouteKey = null;

        // Sphere config
        this.GLOBE_RADIUS = 200;
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    init() {
        if (this.initialized) return;

        // Initialize Three.js objects (must be after THREE is loaded)
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const rect = this.container.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 500;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
        this.updateCameraPosition();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000810, 1);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';

        // Insert canvas into container (hide 2D canvas)
        const existingCanvas = this.container.querySelector('canvas');
        if (existingCanvas) existingCanvas.style.display = 'none';
        this.container.appendChild(this.renderer.domElement);

        // Lighting - holographic blue ambient
        const ambient = new THREE.AmbientLight(0x4488ff, 0.4);
        this.scene.add(ambient);

        const keyLight = new THREE.PointLight(0xffffff, 1.2, 2000);
        keyLight.position.set(400, 300, 500);
        this.scene.add(keyLight);

        const fillLight = new THREE.PointLight(0x00ccff, 0.6, 2000);
        fillLight.position.set(-300, -200, 400);
        this.scene.add(fillLight);

        // Build scene
        this.createStarfield();
        this.createGlobe();
        this.createSectorNodes();
        this.createGateConnections();
        this.createTooltip();

        // Event listeners
        this.setupEventListeners();

        this.initialized = true;
    }

    // ==========================================
    // SCENE BUILDING
    // ==========================================

    createStarfield() {
        this.starsGroup = new THREE.Group();
        const starCount = 800;
        const starGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 1200 + Math.random() * 800;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            const brightness = 0.3 + Math.random() * 0.7;
            const tint = Math.random();
            colors[i * 3] = brightness * (tint > 0.7 ? 1.0 : 0.8);
            colors[i * 3 + 1] = brightness * (tint > 0.3 ? 0.9 : 0.7);
            colors[i * 3 + 2] = brightness;
        }

        starGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
        });

        this.starsGroup.add(new THREE.Points(starGeom, starMat));
        this.scene.add(this.starsGroup);
    }

    createGlobe() {
        this.globeGroup = new THREE.Group();
        const R = this.GLOBE_RADIUS;

        // Main wireframe sphere
        const sphereGeom = new THREE.SphereGeometry(R, 32, 24);
        const wireframe = new THREE.WireframeGeometry(sphereGeom);
        const wireMat = new THREE.LineBasicMaterial({
            color: 0x00aaff,
            opacity: 0.08,
            transparent: true,
        });
        this.globeGroup.add(new THREE.LineSegments(wireframe, wireMat));

        // Equator ring (brighter)
        const equatorGeom = new THREE.RingGeometry(R - 0.5, R + 0.5, 128);
        const equatorMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            opacity: 0.15,
            transparent: true,
            side: THREE.DoubleSide,
        });
        const equator = new THREE.Mesh(equatorGeom, equatorMat);
        equator.rotation.x = Math.PI / 2;
        this.globeGroup.add(equator);

        // Latitude lines
        for (const lat of [-60, -30, 30, 60]) {
            const r = R * Math.cos(lat * Math.PI / 180);
            const y = R * Math.sin(lat * Math.PI / 180);
            const ringGeom = new THREE.RingGeometry(r - 0.3, r + 0.3, 64);
            const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({
                color: 0x0066aa,
                opacity: 0.06,
                transparent: true,
                side: THREE.DoubleSide,
            }));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = y;
            this.globeGroup.add(ring);
        }

        // Longitude lines
        for (let lon = 0; lon < 360; lon += 30) {
            const curve = new THREE.EllipseCurve(0, 0, R, R, 0, Math.PI * 2, false, 0);
            const points = curve.getPoints(64);
            const geom = new THREE.BufferGeometry().setFromPoints(
                points.map(p => new THREE.Vector3(p.x, p.y, 0))
            );
            const line = new THREE.Line(geom, new THREE.LineBasicMaterial({
                color: 0x0066aa,
                opacity: 0.04,
                transparent: true,
            }));
            line.rotation.y = lon * Math.PI / 180;
            this.globeGroup.add(line);
        }

        // Subtle glow sphere behind wireframe
        const glowGeom = new THREE.SphereGeometry(R * 1.02, 32, 24);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x001133,
            opacity: 0.25,
            transparent: true,
            side: THREE.BackSide,
        });
        this.globeGroup.add(new THREE.Mesh(glowGeom, glowMat));

        this.scene.add(this.globeGroup);
    }

    /**
     * Map sector grid (x, y) to a position on the sphere surface.
     * Core sectors (region=core) go on the front/top hemisphere.
     * Milky Way sectors (region=milkyway) go on the back/bottom hemisphere.
     */
    mapToSphere(sector) {
        const R = this.GLOBE_RADIUS;
        const sectors = UNIVERSE_LAYOUT.sectors;

        // Separate by region
        const coreSectors = sectors.filter(s => s.region === 'core');
        const mwSectors = sectors.filter(s => s.region === 'milkyway');

        const isCore = sector.region === 'core';
        const group = isCore ? coreSectors : mwSectors;

        // Calculate bounds for this region
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const s of group) {
            if (s.x < minX) minX = s.x;
            if (s.x > maxX) maxX = s.x;
            if (s.y < minY) minY = s.y;
            if (s.y > maxY) maxY = s.y;
        }
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Normalize to [-1, 1]
        const nx = rangeX > 0 ? ((sector.x - minX) / rangeX) * 2 - 1 : 0;
        const ny = rangeY > 0 ? ((sector.y - minY) / rangeY) * 2 - 1 : 0;

        // Map to longitude and latitude
        // Core: front hemisphere (lon: -70 to +70, lat: +10 to +70)
        // Milky Way: back hemisphere (lon: +110 to +250, lat: -10 to -60)
        let lon, lat;
        if (isCore) {
            lon = nx * 60;                     // -60 to +60 degrees
            lat = 10 + (ny + 1) / 2 * 55;     // +10 to +65 degrees
        } else {
            lon = 180 + nx * 55;               // +125 to +235 degrees
            lat = -(10 + (ny + 1) / 2 * 50);  // -10 to -60 degrees
        }

        // Convert to radians
        const lonRad = lon * Math.PI / 180;
        const latRad = lat * Math.PI / 180;

        // Spherical to cartesian
        return new THREE.Vector3(
            R * Math.cos(latRad) * Math.sin(lonRad),
            R * Math.sin(latRad),
            R * Math.cos(latRad) * Math.cos(lonRad)
        );
    }

    createSectorNodes() {
        this.nodesGroup = new THREE.Group();
        const sectors = UNIVERSE_LAYOUT.sectors;

        for (const sector of sectors) {
            const pos = this.mapToSphere(sector);
            this.sectorPositions[sector.id] = pos;
            this.sectorData[sector.id] = sector;

            const color = DIFFICULTY_COLORS[sector.difficulty] || 0x888888;
            const isCurrent = sector.id === this.game.currentSector?.id;

            // Main node sphere
            const nodeRadius = isCurrent ? 10 : 7;
            const nodeGeom = new THREE.SphereGeometry(nodeRadius, 16, 12);
            const nodeMat = new THREE.MeshBasicMaterial({
                color: color,
                opacity: isCurrent ? 1.0 : 0.85,
                transparent: true,
            });
            const nodeMesh = new THREE.Mesh(nodeGeom, nodeMat);
            nodeMesh.position.copy(pos);
            nodeMesh.userData = {
                isNode: true,
                sectorId: sector.id,
                name: sector.name,
                difficulty: sector.difficulty,
                region: sector.region,
                hasStation: sector.hasStation,
            };

            this.nodesGroup.add(nodeMesh);
            this.sectorMeshes[sector.id] = nodeMesh;

            // Outer glow ring
            const glowGeom = new THREE.RingGeometry(nodeRadius + 2, nodeRadius + 5, 32);
            const glowMat = new THREE.MeshBasicMaterial({
                color: color,
                opacity: isCurrent ? 0.5 : 0.2,
                transparent: true,
                side: THREE.DoubleSide,
            });
            const glowMesh = new THREE.Mesh(glowGeom, glowMat);
            glowMesh.position.copy(pos);
            glowMesh.lookAt(0, 0, 0); // Face outward from sphere center
            glowMesh.userData = { isGlow: true, sectorId: sector.id };
            this.nodesGroup.add(glowMesh);

            // Current sector beacon
            if (isCurrent) {
                const beaconGeom = new THREE.RingGeometry(nodeRadius + 8, nodeRadius + 10, 32);
                const beaconMat = new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    opacity: 0.6,
                    transparent: true,
                    side: THREE.DoubleSide,
                });
                const beacon = new THREE.Mesh(beaconGeom, beaconMat);
                beacon.position.copy(pos);
                beacon.lookAt(0, 0, 0);
                beacon.userData = { isBeacon: true };
                this.nodesGroup.add(beacon);
            }

            // Text label - using a sprite with canvas texture
            const label = this.createTextSprite(sector.name, color, isCurrent);
            // Offset label outward from sphere surface
            const outDir = pos.clone().normalize();
            label.position.copy(pos).add(outDir.multiplyScalar(18));
            label.userData = { isLabel: true };
            this.nodesGroup.add(label);
        }

        this.scene.add(this.nodesGroup);
    }

    createTextSprite(text, color, isCurrent) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        ctx.clearRect(0, 0, 256, 64);
        ctx.font = `${isCurrent ? 'bold ' : ''}${isCurrent ? 18 : 14}px 'Rajdhani', 'Share Tech Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text glow
        const hexColor = '#' + new THREE.Color(color).getHexString();
        ctx.shadowColor = hexColor;
        ctx.shadowBlur = 6;
        ctx.fillStyle = isCurrent ? '#ffffff' : hexColor;
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const mat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: isCurrent ? 1.0 : 0.7,
            depthTest: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(80, 20, 1);
        return sprite;
    }

    createGateConnections() {
        this.gatesGroup = new THREE.Group();
        const gates = UNIVERSE_LAYOUT.gates;

        for (const gate of gates) {
            const fromPos = this.sectorPositions[gate.from];
            const toPos = this.sectorPositions[gate.to];
            if (!fromPos || !toPos) continue;

            const isWormhole = gate.wormhole || false;

            // Create curved line along the sphere surface (great circle arc)
            const points = this.createArcPoints(fromPos, toPos, 32);
            const geom = new THREE.BufferGeometry().setFromPoints(points);

            const color = isWormhole ? 0x8844ff : 0x00aaff;
            const mat = new THREE.LineBasicMaterial({
                color: color,
                opacity: isWormhole ? 0.35 : 0.2,
                transparent: true,
            });
            const line = new THREE.Line(geom, mat);
            line.userData = { isGate: true, from: gate.from, to: gate.to, wormhole: isWormhole };
            this.gatesGroup.add(line);

            // Animated flow dots along the connection
            const dotCount = isWormhole ? 6 : 4;
            for (let i = 0; i < dotCount; i++) {
                const dotGeom = new THREE.SphereGeometry(isWormhole ? 2.5 : 1.5, 8, 6);
                const dotMat = new THREE.MeshBasicMaterial({
                    color: color,
                    opacity: 0,
                    transparent: true,
                });
                const dot = new THREE.Mesh(dotGeom, dotMat);
                dot.userData = {
                    isDot: true,
                    dotIndex: i,
                    dotCount: dotCount,
                    wormhole: isWormhole,
                    arcPoints: points,
                };
                this.gatesGroup.add(dot);
            }
        }

        this.scene.add(this.gatesGroup);
    }

    /**
     * Create points along a great circle arc between two positions on the sphere
     */
    createArcPoints(from, to, segments) {
        const points = [];
        const R = this.GLOBE_RADIUS * 1.01; // Slightly above surface

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            // Slerp between the two directions
            const dir = new THREE.Vector3().lerpVectors(
                from.clone().normalize(),
                to.clone().normalize(),
                t
            ).normalize().multiplyScalar(R);
            points.push(dir);
        }
        return points;
    }

    createTooltip() {
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.className = 'universe-3d-tooltip hidden';
        this.tooltipEl.style.cssText = `
            position: fixed;
            background: rgba(8, 18, 38, 0.95);
            border: 1px solid rgba(0, 170, 255, 0.4);
            border-radius: 4px;
            padding: 8px 12px;
            font-family: 'Rajdhani', 'Share Tech Mono', monospace;
            font-size: 12px;
            color: #eaf2fa;
            pointer-events: none;
            z-index: 10000;
            max-width: 220px;
            box-shadow: 0 0 12px rgba(0, 100, 200, 0.3);
        `;
        document.body.appendChild(this.tooltipEl);
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    setupEventListeners() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        canvas.addEventListener('contextmenu', (e) => this.onRightClick(e));
        // Left click (non-drag)
        canvas.addEventListener('click', (e) => this.onClick(e));
    }

    onMouseDown(e) {
        if (e.button === 0) { // Left button
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.previousMouse = { x: e.clientX, y: e.clientY };
            this.isAutoRotating = false;
            this.renderer.domElement.style.cursor = 'grabbing';
        }
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.previousMouse.x;
            const dy = e.clientY - this.previousMouse.y;

            this.rotationY += dx * 0.005;
            this.rotationX += dy * 0.005;
            this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));

            this.updateCameraPosition();
            this.previousMouse = { x: e.clientX, y: e.clientY };
        } else {
            this.updateHover(e);
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            this.isDragging = false;
            this.renderer.domElement.style.cursor = this.hoveredSector ? 'pointer' : 'grab';
        }
    }

    onMouseLeave() {
        this.isDragging = false;
        this.hoveredSector = null;
        this.tooltipEl?.classList.add('hidden');
        this.renderer.domElement.style.cursor = 'grab';
    }

    onWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        this.cameraDistance = Math.max(300, Math.min(1200, this.cameraDistance * factor));
        this.updateCameraPosition();
    }

    onClick(e) {
        // Only treat as click if mouse didn't move much
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return;

        const sectorId = this.pickSector(e);
        if (!sectorId) return;

        if (sectorId === this.game.currentSector?.id) {
            this.game.ui?.showToast('Already in this sector', 'info');
            return;
        }

        // Left click: quick navigate (adjacent=select gate, far=plan route)
        const gate = this.findGateToSector(sectorId);
        if (gate) {
            this.game.selectTarget(gate);
            this.game.ui?.log(`Selected gate to ${this.sectorData[sectorId]?.name}`, 'system');
        } else {
            this.game.autopilot?.planRoute(sectorId);
        }
    }

    onRightClick(e) {
        e.preventDefault();
        const sectorId = this.pickSector(e);
        if (!sectorId) return;

        const sector = this.sectorData[sectorId];
        if (!sector) return;

        // Build and show context menu with autopilot tiers
        const menuEntity = {
            isSectorNode: true,
            sectorId: sectorId,
            sectorName: sector.name,
            name: sector.name,
            difficulty: sector.difficulty,
        };

        this.game.ui?.showContextMenu(e.clientX, e.clientY, menuEntity);
    }

    // ==========================================
    // RAYCASTING & PICKING
    // ==========================================

    pickSector(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Only check main node spheres
        const nodes = this.nodesGroup.children.filter(c => c.userData.isNode);
        const intersects = this.raycaster.intersectObjects(nodes);

        if (intersects.length > 0) {
            return intersects[0].object.userData.sectorId;
        }
        return null;
    }

    updateHover(e) {
        const sectorId = this.pickSector(e);
        const prevHovered = this.hoveredSector;
        this.hoveredSector = sectorId;

        // Update cursor
        this.renderer.domElement.style.cursor = sectorId ? 'pointer' : 'grab';

        // Restore previous hovered node
        if (prevHovered && prevHovered !== sectorId) {
            const mesh = this.sectorMeshes[prevHovered];
            if (mesh) {
                const isCurrent = prevHovered === this.game.currentSector?.id;
                mesh.scale.setScalar(1);
                mesh.material.opacity = isCurrent ? 1.0 : 0.85;
            }
        }

        // Highlight new hovered node
        if (sectorId) {
            const mesh = this.sectorMeshes[sectorId];
            if (mesh) {
                mesh.scale.setScalar(1.3);
                mesh.material.opacity = 1.0;
            }

            // Show tooltip
            const sector = this.sectorData[sectorId];
            if (sector) {
                this.showTooltip(e.clientX, e.clientY, sector);
            }
        } else {
            this.tooltipEl?.classList.add('hidden');
        }
    }

    showTooltip(x, y, sector) {
        if (!this.tooltipEl) return;

        const isCurrent = sector.id === this.game.currentSector?.id;
        const jumps = this.getJumpDistance(sector.id);
        const jumpText = isCurrent ? 'CURRENT LOCATION' :
            jumps === 1 ? '1 jump' :
            jumps > 0 ? `${jumps} jumps` : 'unreachable';

        const diffColor = '#' + (DIFFICULTY_COLORS[sector.difficulty] || 0x888888).toString(16).padStart(6, '0');

        this.tooltipEl.innerHTML = `
            <div style="font-size: 14px; font-weight: bold; color: ${diffColor}; margin-bottom: 3px;">${sector.name}</div>
            <div style="color: #9db0c4; font-size: 11px;">
                <span style="color: ${diffColor};">${(sector.difficulty || '').toUpperCase()}</span>
                ${sector.region === 'milkyway' ? ' &middot; Milky Way' : ' &middot; Core Region'}
            </div>
            <div style="color: #708498; font-size: 11px; margin-top: 3px;">
                ${sector.hasStation ? 'Station' : 'No Station'}
                &middot; ${jumpText}
            </div>
            ${!isCurrent ? '<div style="color: #556677; font-size: 10px; margin-top: 4px;">Left-click: Navigate &middot; Right-click: Autopilot</div>' : ''}
        `;

        this.tooltipEl.classList.remove('hidden');
        this.tooltipEl.style.left = `${x + 15}px`;
        this.tooltipEl.style.top = `${y - 10}px`;

        // Keep on screen
        requestAnimationFrame(() => {
            const rect = this.tooltipEl.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                this.tooltipEl.style.left = `${x - rect.width - 10}px`;
            }
            if (rect.bottom > window.innerHeight) {
                this.tooltipEl.style.top = `${y - rect.height - 10}px`;
            }
        });
    }

    getJumpDistance(targetId) {
        const currentId = this.game.currentSector?.id;
        if (!currentId || currentId === targetId) return 0;

        // BFS
        const adj = {};
        for (const g of UNIVERSE_LAYOUT.gates) {
            if (!adj[g.from]) adj[g.from] = [];
            if (!adj[g.to]) adj[g.to] = [];
            adj[g.from].push(g.to);
            adj[g.to].push(g.from);
        }

        const visited = new Set([currentId]);
        const queue = [{ id: currentId, dist: 0 }];
        while (queue.length > 0) {
            const { id, dist } = queue.shift();
            if (id === targetId) return dist;
            for (const neighbor of (adj[id] || [])) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push({ id: neighbor, dist: dist + 1 });
                }
            }
        }
        return -1;
    }

    findGateToSector(targetSectorId) {
        const currentSectorId = this.game.currentSector?.id;
        const gates = UNIVERSE_LAYOUT.gates;
        const hasConnection = gates.some(g =>
            (g.from === currentSectorId && g.to === targetSectorId) ||
            (g.to === currentSectorId && g.from === targetSectorId)
        );
        if (!hasConnection) return null;

        const entities = this.game.currentSector?.entities || [];
        return entities.find(e =>
            e.type === 'gate' && e.destinationSectorId === targetSectorId
        );
    }

    // ==========================================
    // CAMERA
    // ==========================================

    updateCameraPosition() {
        if (!this.camera) return;
        const r = this.cameraDistance;
        this.camera.position.set(
            r * Math.cos(this.rotationX) * Math.sin(this.rotationY),
            r * Math.sin(this.rotationX),
            r * Math.cos(this.rotationX) * Math.cos(this.rotationY)
        );
        this.camera.lookAt(0, 0, 0);
    }

    // ==========================================
    // ROUTE VISUALIZATION
    // ==========================================

    updateRouteVisualization() {
        const routeInfo = this.game.autopilot?.getRouteInfo();
        const routeKey = routeInfo
            ? routeInfo.path.join(',') + ':' + routeInfo.currentIndex
            : null;

        // Skip rebuild if route hasn't changed
        if (this.cachedRouteKey === routeKey) return;
        this.cachedRouteKey = routeKey;

        // Remove old route
        if (this.routeGroup) {
            this.scene.remove(this.routeGroup);
            this.routeGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        if (!routeInfo) {
            this.routeGroup = null;
            return;
        }

        this.routeGroup = new THREE.Group();
        const path = routeInfo.path;

        for (let i = 0; i < path.length - 1; i++) {
            const fromPos = this.sectorPositions[path[i]];
            const toPos = this.sectorPositions[path[i + 1]];
            if (!fromPos || !toPos) continue;

            const completed = i < routeInfo.currentIndex;
            const points = this.createArcPoints(fromPos, toPos, 32);
            const geom = new THREE.BufferGeometry().setFromPoints(points);

            const mat = new THREE.LineBasicMaterial({
                color: completed ? 0x665500 : 0xffcc00,
                opacity: completed ? 0.3 : 0.8,
                transparent: true,
                linewidth: 2,
            });
            this.routeGroup.add(new THREE.Line(geom, mat));
        }

        // Destination glow (animated in update loop)
        const destPos = this.sectorPositions[path[path.length - 1]];
        if (destPos) {
            const destGlowGeom = new THREE.SphereGeometry(16, 16, 12);
            const destGlowMat = new THREE.MeshBasicMaterial({
                color: 0xffcc00,
                opacity: 0.3,
                transparent: true,
            });
            const destGlow = new THREE.Mesh(destGlowGeom, destGlowMat);
            destGlow.position.copy(destPos);
            destGlow.userData = { isDestGlow: true };
            this.routeGroup.add(destGlow);
        }

        this.scene.add(this.routeGroup);
    }

    // ==========================================
    // ANIMATION
    // ==========================================

    startAnimation() {
        if (this.animationId) return;
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.animTime += 0.016;
            this.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update() {
        // Auto-rotate when not dragging
        if (this.isAutoRotating && !this.isDragging) {
            this.rotationY += this.autoRotateSpeed;
            this.updateCameraPosition();
        }

        // Animate gate flow dots
        this.animateGateDots();

        // Animate current sector beacon pulse
        this.animateBeacon();

        // Update route overlay
        this.updateRouteVisualization();

        // Animate route destination glow
        this.animateRouteDestination();

        // Update current sector highlighting (may change after gate jumps)
        this.updateCurrentSector();
    }

    animateGateDots() {
        for (const child of this.gatesGroup.children) {
            if (!child.userData.isDot) continue;

            const { dotIndex, dotCount, wormhole, arcPoints } = child.userData;
            const speed = wormhole ? 0.25 : 0.15;
            const t = ((dotIndex / dotCount) + this.animTime * speed) % 1;

            // Interpolate position along arc
            const idx = t * (arcPoints.length - 1);
            const i0 = Math.floor(idx);
            const i1 = Math.min(i0 + 1, arcPoints.length - 1);
            const frac = idx - i0;

            child.position.lerpVectors(arcPoints[i0], arcPoints[i1], frac);
            child.material.opacity = Math.sin(t * Math.PI) * 0.6;
        }
    }

    animateBeacon() {
        for (const child of this.nodesGroup.children) {
            if (!child.userData.isBeacon) continue;

            const pulse = 0.3 + Math.sin(this.animTime * 2) * 0.3;
            child.material.opacity = pulse;
            const scale = 1 + Math.sin(this.animTime * 1.5) * 0.15;
            child.scale.setScalar(scale);
        }
    }

    animateRouteDestination() {
        if (!this.routeGroup) return;
        for (const child of this.routeGroup.children) {
            if (!child.userData.isDestGlow) continue;
            const pulse = 0.5 + Math.sin(this.animTime * 3) * 0.3;
            child.material.opacity = pulse * 0.4;
            child.scale.setScalar(0.9 + pulse * 0.2);
        }
    }

    updateCurrentSector() {
        const currentId = this.game.currentSector?.id;
        for (const [sectorId, mesh] of Object.entries(this.sectorMeshes)) {
            const isCurrent = sectorId === currentId;
            const isHovered = sectorId === this.hoveredSector;
            if (!isHovered) {
                const scale = isCurrent ? 1.0 : 1.0;
                mesh.scale.setScalar(scale);
            }
        }
    }

    // ==========================================
    // RESIZE
    // ==========================================

    resize() {
        if (!this.renderer || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    dispose() {
        this.stopAnimation();

        if (this.tooltipEl) {
            this.tooltipEl.remove();
            this.tooltipEl = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }

        // Dispose all geometries and materials
        this.scene?.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });

        this.initialized = false;
    }
}
