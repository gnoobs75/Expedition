// =============================================
// Ship Mesh Factory
// Procedural 3D mesh generation + GLB model loading for all ship types
// Enhanced with detailed hull geometry, panel lines, greebles,
// engine nacelles, running lights, and role-specific equipment
// =============================================

import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';

// GLB model cache: path -> { scene: THREE.Group, loading: bool, callbacks: [] }
const MODEL_CACHE = {};

// Size configurations - dramatic scaling for visual distinction at distance
// aspect: width/length ratio. <1 = long and narrow, >1 = wide and fat
const SIZE_CONFIGS = {
    frigate:       { radius: 18,  scale: 1.0, complexity: 1.0, aspect: 0.7 },
    destroyer:     { radius: 35,  scale: 1.8, complexity: 1.5, aspect: 0.55 },
    cruiser:       { radius: 70,  scale: 3.5, complexity: 2.0, aspect: 0.5 },
    battlecruiser: { radius: 110, scale: 5.5, complexity: 2.5, aspect: 0.45 },
    battleship:    { radius: 180, scale: 9.0, complexity: 3.0, aspect: 0.35 },
    capital:       { radius: 320, scale: 16.0, complexity: 3.5, aspect: 0.3 },
};

// Color palettes per role - highly saturated for distance identification
const ROLE_PALETTES = {
    mining:     { primary: 0x5a7a30, secondary: 0x88cc44, accent: 0xffdd00, glow: 0x66ff88, trim: 0x99bb44, dark: 0x2a3a18 },
    hauler:     { primary: 0x3a5577, secondary: 0x5588bb, accent: 0x66ccee, glow: 0x44bbff, trim: 0x6699cc, dark: 0x1a2a44 },
    salvager:   { primary: 0x6a5540, secondary: 0x99774a, accent: 0xddaa66, glow: 0xff9944, trim: 0xbb8855, dark: 0x332a18 },
    harvester:  { primary: 0x306650, secondary: 0x44aa77, accent: 0x55eeaa, glow: 0x44ffcc, trim: 0x55cc88, dark: 0x1a3322 },
    mercenary:  { primary: 0x662222, secondary: 0xaa3333, accent: 0xff5533, glow: 0xff4422, trim: 0xcc4400, dark: 0x330a0a },
    police:     { primary: 0xccddee, secondary: 0x4477cc, accent: 0x88bbff, glow: 0x4488ff, trim: 0xffffff, dark: 0x223355 },
    military:   { primary: 0x4a5566, secondary: 0x607080, accent: 0x7799bb, glow: 0x5588cc, trim: 0x556677, dark: 0x222a33 },
    pirate:     { primary: 0x551111, secondary: 0x882222, accent: 0xee3333, glow: 0xff2200, trim: 0xaa1111, dark: 0x220505 },
    surveyor:   { primary: 0x226655, secondary: 0x33aa88, accent: 0x55ffbb, glow: 0x00ff88, trim: 0x44cc99, dark: 0x113322 },
    logistics:  { primary: 0x335577, secondary: 0x4488bb, accent: 0x66ddff, glow: 0x44ccff, trim: 0x55aadd, dark: 0x1a2a44 },
};

// Faction logo colors for guild ship hull decals
const FACTION_LOGOS = {
    'ore-extraction-syndicate': { color: 0xffaa44, glow: 0xffcc66 },
    'stellar-logistics':       { color: 0x44ddff, glow: 0x66eeff },
    'void-hunters':            { color: 0xff4466, glow: 0xff6688 },
    'frontier-alliance':       { color: 0x44ff88, glow: 0x66ffaa },
    'shadow-cartel':           { color: 0xcc2244, glow: 0xee4466 },
};

// Universal subsystem colors - distinct from hull palettes so components POP
const SUBSYSTEM_COLORS = {
    engine:  { housing: 0x334455, glow: 0x44ccff, trail: 0x2288cc, boost: 0x00eeff },
    weapon:  { base: 0x883322, barrel: 0x554433, muzzle: 0xff4422, charge: 0xff6600 },
    sensor:  { dish: 0x226655, receiver: 0x00ffaa, ring: 0x33ddaa, scan: 0x00ff88 },
    shield:  { emitter: 0x3344aa, glow: 0x6688ff, ring: 0x4466dd, pulse: 0x88aaff },
    cockpit: { glass: 0x225588, frame: 0x556677, pip: 0x88ddff, glow: 0x44aaff },
    missile: { tube: 0x443322, warhead: 0xff6622, exhaust: 0xff4400, housing: 0x554433 },
    drone:   { bay: 0x223344, door: 0x44ddcc, light: 0x33eebb, frame: 0x556666 },
    power:   { conduit: 0x6622aa, glow: 0xaa44ff, node: 0x8833ee, pulse: 0xcc66ff },
    cargo:   { container: 0x445566, stripe: 0x66aacc, hatch: 0x557788, frame: 0x778899 },
};

class ShipMeshFactory {
    /**
     * Generate a ship mesh from ship database config
     */
    generateShipMesh(config) {
        const { shipId, role, size, detailLevel = 'low', factionId } = config;
        const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.frigate;
        const palette = ROLE_PALETTES[role] || ROLE_PALETTES.mercenary;
        const rng = this.createSeededRNG(this.hashString(shipId || 'default'));

        // Calculate engine speed factor: fast ships (frigates) have big engines, slow ships (capitals) small
        // Based on size: frigate=1.5, destroyer=1.3, cruiser=1.0, BC=0.8, BS=0.6, capital=0.4
        const speedFactors = { frigate: 1.5, destroyer: 1.3, cruiser: 1.0, battlecruiser: 0.8, battleship: 0.6, capital: 0.4 };
        sizeConfig._speedFactor = speedFactors[size] || 1.0;

        const group = new THREE.Group();

        // Generate layered hull with panel lines
        this.generateHull(group, sizeConfig, rng, detailLevel, palette, role);

        // Add structural spine/keel line
        this.addKeelLine(group, sizeConfig, palette, role);

        // Add role-specific details (pass speedFactor for engine scaling)
        const detailFn = this.roleDetailGenerators[role];
        if (detailFn) {
            detailFn.call(this, group, sizeConfig, rng, detailLevel, palette, sizeConfig._speedFactor || 1.0);
        }

        // Add faction decal (guild ships only)
        if (factionId && FACTION_LOGOS[factionId]) {
            this.addFactionDecal(group, sizeConfig, factionId);
        }

        // Add universal details (running lights, panel greebles)
        this.addRunningLights(group, sizeConfig, rng, palette);
        this.addPanelGreebles(group, sizeConfig, rng, palette, role);

        return group;
    }

    /**
     * Generate layered hull with panel line detail
     */
    generateHull(group, sizeConfig, rng, detailLevel, palette, role) {
        const s = sizeConfig.radius;
        // a = aspect ratio: stretch Y coordinates to make ships longer/narrower as they get bigger
        const a = sizeConfig.aspect || 0.5;
        const shape = new THREE.Shape();

        switch (role) {
            case 'mining':
                // Boxy, wide industrial hull - WIDEST of all roles (hauler-like)
                shape.moveTo(s * 0.5, 0);
                shape.lineTo(s * 0.4, s * 0.15 * a);
                shape.lineTo(s * 0.35, s * 0.5 * a);
                shape.lineTo(s * 0.15, s * 0.55 * a);
                shape.lineTo(-s * 0.35, s * 0.52 * a);
                shape.lineTo(-s * 0.55, s * 0.4 * a);
                shape.lineTo(-s * 0.6, s * 0.2 * a);
                shape.lineTo(-s * 0.6, -s * 0.2 * a);
                shape.lineTo(-s * 0.55, -s * 0.4 * a);
                shape.lineTo(-s * 0.35, -s * 0.52 * a);
                shape.lineTo(s * 0.15, -s * 0.55 * a);
                shape.lineTo(s * 0.35, -s * 0.5 * a);
                shape.lineTo(s * 0.4, -s * 0.15 * a);
                shape.closePath();
                break;

            case 'hauler':
                // Very wide and flat - brick-like cargo vessel
                shape.moveTo(s * 0.4, 0);
                shape.lineTo(s * 0.3, s * 0.2 * a);
                shape.lineTo(s * 0.2, s * 0.6 * a);
                shape.lineTo(-s * 0.5, s * 0.6 * a);
                shape.lineTo(-s * 0.65, s * 0.4 * a);
                shape.lineTo(-s * 0.65, -s * 0.4 * a);
                shape.lineTo(-s * 0.5, -s * 0.6 * a);
                shape.lineTo(s * 0.2, -s * 0.6 * a);
                shape.lineTo(s * 0.3, -s * 0.2 * a);
                shape.closePath();
                break;

            case 'salvager':
                // Asymmetric, rough hull with crane-like forward extension
                shape.moveTo(s * 0.65, s * 0.05 * a);
                shape.lineTo(s * 0.4, s * 0.25 * a);
                shape.lineTo(s * 0.15, s * 0.45 * a);
                shape.lineTo(-s * 0.15, s * 0.4 * a);
                shape.lineTo(-s * 0.4, s * 0.32 * a);
                shape.lineTo(-s * 0.55, s * 0.12 * a);
                shape.lineTo(-s * 0.5, -s * 0.1 * a);
                shape.lineTo(-s * 0.45, -s * 0.35 * a);
                shape.lineTo(-s * 0.2, -s * 0.45 * a);
                shape.lineTo(s * 0.1, -s * 0.38 * a);
                shape.lineTo(s * 0.35, -s * 0.2 * a);
                shape.closePath();
                break;

            case 'harvester':
                // Rounded, organic hull with intake scoops
                shape.moveTo(s * 0.5, 0);
                shape.quadraticCurveTo(s * 0.48, s * 0.25 * a, s * 0.35, s * 0.45 * a);
                shape.quadraticCurveTo(s * 0.1, s * 0.55 * a, -s * 0.15, s * 0.5 * a);
                shape.quadraticCurveTo(-s * 0.45, s * 0.35 * a, -s * 0.55, s * 0.18 * a);
                shape.lineTo(-s * 0.55, -s * 0.18 * a);
                shape.quadraticCurveTo(-s * 0.45, -s * 0.35 * a, -s * 0.15, -s * 0.5 * a);
                shape.quadraticCurveTo(s * 0.1, -s * 0.55 * a, s * 0.35, -s * 0.45 * a);
                shape.quadraticCurveTo(s * 0.48, -s * 0.25 * a, s * 0.5, 0);
                break;

            case 'mercenary':
                // VERY long, aggressive needle with swept wings - longest role
                shape.moveTo(s * 1.1, 0);
                shape.lineTo(s * 0.55, s * 0.08 * a);
                shape.lineTo(s * 0.2, s * 0.18 * a);
                shape.lineTo(s * 0.0, s * 0.5 * a);
                shape.lineTo(-s * 0.25, s * 0.52 * a);
                shape.lineTo(-s * 0.5, s * 0.3 * a);
                shape.lineTo(-s * 0.6, s * 0.2 * a);
                shape.lineTo(-s * 0.55, s * 0.06 * a);
                shape.lineTo(-s * 0.55, -s * 0.06 * a);
                shape.lineTo(-s * 0.6, -s * 0.2 * a);
                shape.lineTo(-s * 0.5, -s * 0.3 * a);
                shape.lineTo(-s * 0.25, -s * 0.52 * a);
                shape.lineTo(s * 0.0, -s * 0.5 * a);
                shape.lineTo(s * 0.2, -s * 0.18 * a);
                shape.lineTo(s * 0.55, -s * 0.08 * a);
                shape.closePath();
                break;

            case 'police':
                // Clean, sleek hull with defined nose
                shape.moveTo(s * 0.8, 0);
                shape.lineTo(s * 0.55, s * 0.1 * a);
                shape.lineTo(s * 0.3, s * 0.3 * a);
                shape.lineTo(s * 0.05, s * 0.38 * a);
                shape.lineTo(-s * 0.35, s * 0.36 * a);
                shape.lineTo(-s * 0.55, s * 0.22 * a);
                shape.lineTo(-s * 0.6, s * 0.08 * a);
                shape.lineTo(-s * 0.6, -s * 0.08 * a);
                shape.lineTo(-s * 0.55, -s * 0.22 * a);
                shape.lineTo(-s * 0.35, -s * 0.36 * a);
                shape.lineTo(s * 0.05, -s * 0.38 * a);
                shape.lineTo(s * 0.3, -s * 0.3 * a);
                shape.lineTo(s * 0.55, -s * 0.1 * a);
                shape.closePath();
                break;

            case 'military':
                // Imposing wide hull - fortress-like, gets VERY wide at capital size
                shape.moveTo(s * 0.65, 0);
                shape.lineTo(s * 0.5, s * 0.15 * a);
                shape.lineTo(s * 0.35, s * 0.42 * a);
                shape.lineTo(s * 0.05, s * 0.55 * a);
                shape.lineTo(-s * 0.25, s * 0.58 * a);
                shape.lineTo(-s * 0.55, s * 0.45 * a);
                shape.lineTo(-s * 0.65, s * 0.25 * a);
                shape.lineTo(-s * 0.68, s * 0.1 * a);
                shape.lineTo(-s * 0.68, -s * 0.1 * a);
                shape.lineTo(-s * 0.65, -s * 0.25 * a);
                shape.lineTo(-s * 0.55, -s * 0.45 * a);
                shape.lineTo(-s * 0.25, -s * 0.58 * a);
                shape.lineTo(s * 0.05, -s * 0.55 * a);
                shape.lineTo(s * 0.35, -s * 0.42 * a);
                shape.lineTo(s * 0.5, -s * 0.15 * a);
                shape.closePath();
                break;

            case 'pirate':
                // Jagged spear with asymmetric protrusions
                shape.moveTo(s * 1.0, 0);
                shape.lineTo(s * 0.55, s * 0.08 * a);
                shape.lineTo(s * 0.35, s * 0.28 * a);
                shape.lineTo(s * 0.18, s * 0.2 * a);
                shape.lineTo(s * 0.05, s * 0.5 * a);
                shape.lineTo(-s * 0.15, s * 0.32 * a);
                shape.lineTo(-s * 0.35, s * 0.48 * a);
                shape.lineTo(-s * 0.5, s * 0.25 * a);
                shape.lineTo(-s * 0.55, s * 0.08 * a);
                shape.lineTo(-s * 0.55, -s * 0.08 * a);
                shape.lineTo(-s * 0.5, -s * 0.25 * a);
                shape.lineTo(-s * 0.35, -s * 0.48 * a);
                shape.lineTo(-s * 0.15, -s * 0.32 * a);
                shape.lineTo(s * 0.05, -s * 0.5 * a);
                shape.lineTo(s * 0.18, -s * 0.2 * a);
                shape.lineTo(s * 0.35, -s * 0.28 * a);
                shape.lineTo(s * 0.55, -s * 0.08 * a);
                shape.closePath();
                break;

            case 'surveyor':
                // Sleek, narrow scout with sensor dish (wide rear, thin front)
                shape.moveTo(s * 0.8, 0);
                shape.lineTo(s * 0.5, s * 0.08 * a);
                shape.lineTo(s * 0.2, s * 0.15 * a);
                shape.lineTo(-s * 0.1, s * 0.35 * a);
                shape.quadraticCurveTo(-s * 0.3, s * 0.45 * a, -s * 0.5, s * 0.38 * a);
                shape.lineTo(-s * 0.6, s * 0.15 * a);
                shape.lineTo(-s * 0.55, 0);
                shape.lineTo(-s * 0.6, -s * 0.15 * a);
                shape.lineTo(-s * 0.5, -s * 0.38 * a);
                shape.quadraticCurveTo(-s * 0.3, -s * 0.45 * a, -s * 0.1, -s * 0.35 * a);
                shape.lineTo(s * 0.2, -s * 0.15 * a);
                shape.lineTo(s * 0.5, -s * 0.08 * a);
                shape.closePath();
                break;

            case 'logistics':
                // Rounded, cross-shaped support vessel with repair arms
                shape.moveTo(s * 0.45, 0);
                shape.lineTo(s * 0.35, s * 0.12 * a);
                shape.lineTo(s * 0.15, s * 0.2 * a);
                shape.lineTo(s * 0.1, s * 0.5 * a);
                shape.lineTo(-s * 0.05, s * 0.55 * a);
                shape.lineTo(-s * 0.15, s * 0.35 * a);
                shape.lineTo(-s * 0.35, s * 0.3 * a);
                shape.lineTo(-s * 0.55, s * 0.18 * a);
                shape.lineTo(-s * 0.5, 0);
                shape.lineTo(-s * 0.55, -s * 0.18 * a);
                shape.lineTo(-s * 0.35, -s * 0.3 * a);
                shape.lineTo(-s * 0.15, -s * 0.35 * a);
                shape.lineTo(-s * 0.05, -s * 0.55 * a);
                shape.lineTo(s * 0.1, -s * 0.5 * a);
                shape.lineTo(s * 0.15, -s * 0.2 * a);
                shape.lineTo(s * 0.35, -s * 0.12 * a);
                shape.closePath();
                break;

            default:
                shape.moveTo(s, 0);
                shape.lineTo(-s * 0.7, s * 0.5 * a);
                shape.lineTo(-s * 0.5, 0);
                shape.lineTo(-s * 0.7, -s * 0.5 * a);
                shape.closePath();
        }

        // Base hull layer - always extruded for 3D depth
        // Cap extrusion depth so large ships don't have overly thick dark side faces
        let geometry;
        const extrudeDepth = Math.min(s * 0.12, 8);
        const bevelThick = Math.min(s * 0.03, 2);
        const bevelSize = Math.min(s * 0.02, 1.5);
        const extrudeSettings = {
            depth: extrudeDepth,
            bevelEnabled: true,
            bevelThickness: bevelThick,
            bevelSize: bevelSize,
            bevelSegments: 1,
        };
        geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
            color: palette.primary,
            emissive: palette.primary,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.92,
            roughness: 0.55,
            metalness: 0.35,
        });

        const hull = new THREE.Mesh(geometry, material);
        hull.renderOrder = 0;
        group.add(hull);

        // Inner hull plating (slightly smaller, different shade)
        const innerShape = this.scaleShape(shape, 0.8);
        const innerExtSettings = { depth: Math.min(s * 0.14, 9), bevelEnabled: false };
        const innerGeo = new THREE.ExtrudeGeometry(innerShape, innerExtSettings);
        innerGeo.center();
        const innerMat = new THREE.MeshStandardMaterial({
            color: palette.secondary,
            emissive: palette.secondary,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 0.65,
            roughness: 0.5,
            metalness: 0.3,
        });
        const innerHull = new THREE.Mesh(innerGeo, innerMat);
        innerHull.position.z = 0.02;
        innerHull.renderOrder = 1;
        group.add(innerHull);

        // Hull panel lines (thin lines creating panel separation effect)
        this.addPanelLines(group, s, rng, palette, role, a);
    }

    /**
     * Scale a shape uniformly around its center
     */
    scaleShape(originalShape, factor) {
        const scaled = new THREE.Shape();
        const curves = originalShape.curves;
        const pts = originalShape.getPoints(32);

        // Calculate centroid
        let cx = 0, cy = 0;
        for (const p of pts) { cx += p.x; cy += p.y; }
        cx /= pts.length; cy /= pts.length;

        // Scale points relative to centroid
        const scaledPts = pts.map(p => new THREE.Vector2(
            cx + (p.x - cx) * factor,
            cy + (p.y - cy) * factor
        ));

        scaled.moveTo(scaledPts[0].x, scaledPts[0].y);
        for (let i = 1; i < scaledPts.length; i++) {
            scaled.lineTo(scaledPts[i].x, scaledPts[i].y);
        }
        scaled.closePath();
        return scaled;
    }

    /**
     * Add hull panel separation lines
     */
    addPanelLines(group, s, rng, palette, role, aspect = 0.5) {
        const lineMat = new THREE.LineBasicMaterial({
            color: palette.dark,
            transparent: true,
            opacity: 0.5,
        });

        const lineCount = Math.floor(2 + rng() * 3);
        for (let i = 0; i < lineCount; i++) {
            const points = [];
            const yOff = (rng() - 0.5) * s * 0.6 * aspect;
            const startX = -s * (0.3 + rng() * 0.2);
            const endX = s * (0.1 + rng() * 0.3);

            // Slightly irregular line
            const segments = 3 + Math.floor(rng() * 3);
            for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                const x = startX + (endX - startX) * t;
                const y = yOff + (rng() - 0.5) * s * 0.05;
                points.push(new THREE.Vector3(x, y, 0.03));
            }

            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeo, lineMat);
            line.renderOrder = 2;
            group.add(line);
        }

        // Cross panel lines
        const crossCount = Math.floor(1 + rng() * 2);
        for (let i = 0; i < crossCount; i++) {
            const xPos = -s * 0.2 + rng() * s * 0.4;
            const points = [
                new THREE.Vector3(xPos, -s * (0.15 + rng() * 0.15) * aspect, 0.03),
                new THREE.Vector3(xPos + (rng() - 0.5) * s * 0.1, s * (0.15 + rng() * 0.15) * aspect, 0.03),
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeo, lineMat);
            line.renderOrder = 2;
            group.add(line);
        }
    }

    /**
     * Add structural keel/spine line down the center
     */
    addKeelLine(group, sizeConfig, palette, role) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const keelMat = new THREE.MeshBasicMaterial({
            color: palette.trim,
            transparent: true,
            opacity: 0.7,
        });

        // Center spine
        const keelGeo = new THREE.PlaneGeometry(s * 1.0, s * 0.04);
        const keel = new THREE.Mesh(keelGeo, keelMat);
        keel.position.set(-s * 0.05, 0, 0.04);
        keel.renderOrder = 3;
        group.add(keel);

        // Cross beams (structural ribs)
        const ribCount = Math.floor(sizeConfig.complexity + 1);
        for (let i = 0; i < ribCount; i++) {
            const xPos = -s * 0.3 + (i / ribCount) * s * 0.6;
            const ribGeo = new THREE.PlaneGeometry(s * 0.03, s * 0.5 * a);
            const rib = new THREE.Mesh(ribGeo, keelMat);
            rib.position.set(xPos, 0, 0.04);
            rib.renderOrder = 3;
            group.add(rib);
        }
    }

    // Role-specific detail generator map
    get roleDetailGenerators() {
        return {
            mining: this.addMiningDetails,
            hauler: this.addHaulerDetails,
            salvager: this.addSalvagerDetails,
            harvester: this.addHarvesterDetails,
            mercenary: this.addMercenaryDetails,
            police: this.addPoliceDetails,
            military: this.addMilitaryDetails,
            pirate: this.addPirateDetails,
        };
    }

    // =============================================
    // ROLE-SPECIFIC DETAIL GENERATORS
    // =============================================

    addMiningDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;

        // Mining drill assembly (forward)
        this.addMiningDrill(group, s * 0.55, 0, s * 0.15, palette, rng);

        // Side-mounted strip miner turrets
        const turretPositions = [
            { x: s * 0.25, y: s * 0.38 * a },
            { x: s * 0.25, y: -s * 0.38 * a },
        ];
        if (sizeConfig.complexity >= 2) {
            turretPositions.push({ x: s * 0.05, y: s * 0.35 * a });
            turretPositions.push({ x: s * 0.05, y: -s * 0.35 * a });
        }
        for (const pos of turretPositions) {
            this.addTurretMount(group, pos.x, pos.y, s * 0.08, palette.accent, detailLevel);
        }

        // Ore processing bay (large interior area)
        const bayGeo = new THREE.PlaneGeometry(s * 0.5, s * 0.35 * a);
        const bayMat = new THREE.MeshBasicMaterial({
            color: palette.dark, transparent: true, opacity: 0.5,
        });
        const bay = new THREE.Mesh(bayGeo, bayMat);
        bay.position.set(-s * 0.15, 0, 0.03);
        bay.renderOrder = 2;
        group.add(bay);

        // Ore chute hatch marks
        for (let i = 0; i < 3; i++) {
            const hatchGeo = new THREE.PlaneGeometry(s * 0.12, s * 0.08);
            const hatchMat = new THREE.MeshBasicMaterial({
                color: palette.secondary, transparent: true, opacity: 0.6,
            });
            const hatch = new THREE.Mesh(hatchGeo, hatchMat);
            hatch.position.set(-s * 0.1 + i * s * 0.12, s * 0.22 * a, 0.04);
            hatch.renderOrder = 3;
            group.add(hatch);
        }

        // Drone bay indicator
        this.addDroneBay(group, -s * 0.25, 0, s * 0.12, palette);

        // Engines
        this.addEngineNacelles(group, s, [
            { x: -s * 0.6, y: s * 0.22 * a },
            { x: -s * 0.6, y: -s * 0.22 * a },
        ], palette, detailLevel, speedFactor);

        // Cockpit (industrial, forward-offset)
        this.addCockpit(group, s * 0.32, 0, s * 0.1, palette.accent, detailLevel);

        // Sensor dish
        this.addSensorDish(group, -s * 0.35, s * 0.3 * a, s * 0.08, palette);
    }

    addHaulerDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const cg = SUBSYSTEM_COLORS.cargo;

        // Cargo container bays (prominent, multiple)
        const containerCount = Math.floor(sizeConfig.complexity * 2) + 2;
        for (let i = 0; i < containerCount; i++) {
            const row = Math.floor(i / 2);
            const col = i % 2;
            const cw = s * 0.22;
            const ch = s * 0.18 * a;

            // Container outline - cargo blue-grey
            const cGeo = new THREE.PlaneGeometry(cw, ch);
            const cMat = new THREE.MeshBasicMaterial({
                color: col === 0 ? cg.container : cg.hatch,
                transparent: true, opacity: 0.7,
            });
            const container = new THREE.Mesh(cGeo, cMat);
            container.position.set(
                -s * 0.35 + row * s * 0.2,
                col === 0 ? s * 0.28 * a : -s * 0.28 * a,
                0.03
            );
            container.renderOrder = 2;
            group.add(container);

            // Container stripe - accent color
            const detailGeo = new THREE.PlaneGeometry(cw * 0.8, s * 0.015);
            const detailMat = new THREE.MeshBasicMaterial({
                color: cg.stripe, transparent: true, opacity: 0.5,
            });
            const detail = new THREE.Mesh(detailGeo, detailMat);
            detail.position.set(container.position.x, container.position.y, 0.04);
            detail.renderOrder = 3;
            group.add(detail);

            // Container frame outline
            const frmMat = new THREE.LineBasicMaterial({
                color: cg.frame, transparent: true, opacity: 0.3,
            });
            const cx = container.position.x, cy = container.position.y;
            const frmPts = [
                new THREE.Vector3(cx - cw * 0.48, cy - ch * 0.48, 0.035),
                new THREE.Vector3(cx + cw * 0.48, cy - ch * 0.48, 0.035),
                new THREE.Vector3(cx + cw * 0.48, cy + ch * 0.48, 0.035),
                new THREE.Vector3(cx - cw * 0.48, cy + ch * 0.48, 0.035),
                new THREE.Vector3(cx - cw * 0.48, cy - ch * 0.48, 0.035),
            ];
            const frmGeo = new THREE.BufferGeometry().setFromPoints(frmPts);
            const frm = new THREE.Line(frmGeo, frmMat);
            frm.renderOrder = 3;
            group.add(frm);
        }

        // Cargo arm/crane structure
        const craneGeo = new THREE.PlaneGeometry(s * 0.03, s * 0.7 * a);
        const craneMat = new THREE.MeshBasicMaterial({
            color: cg.frame, transparent: true, opacity: 0.6,
        });
        const crane = new THREE.Mesh(craneGeo, craneMat);
        crane.position.set(s * 0.1, 0, 0.05);
        crane.renderOrder = 4;
        group.add(crane);

        // Structural reinforcement beams
        for (let i = 0; i < 3; i++) {
            const beamGeo = new THREE.PlaneGeometry(s * 0.8, s * 0.02);
            const beamMat = new THREE.MeshBasicMaterial({
                color: cg.frame, transparent: true, opacity: 0.45,
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(-s * 0.15, (i - 1) * s * 0.3 * a, 0.035);
            beam.renderOrder = 3;
            group.add(beam);
        }

        // Large single engine (haulers are slow but powerful)
        this.addEngineNacelles(group, s * 1.3, [
            { x: -s * 0.65, y: 0 },
        ], palette, detailLevel, speedFactor);

        // Side thrusters (maneuvering)
        if (sizeConfig.complexity >= 1.5) {
            this.addSmallThruster(group, -s * 0.55, s * 0.35 * a, palette);
            this.addSmallThruster(group, -s * 0.55, -s * 0.35 * a, palette);
        }

        // Cockpit (small relative to hull)
        this.addCockpit(group, s * 0.35, 0, s * 0.08, palette.accent, detailLevel);

        // Navigation antenna
        this.addAntenna(group, s * 0.2, s * 0.4 * a, s * 0.3 * a, palette, rng);
    }

    addSalvagerDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;

        // Tractor beam emitter arrays (prominent forward)
        const tractorPositions = [
            { x: s * 0.35, y: s * 0.25 * a },
            { x: s * 0.35, y: -s * 0.2 * a },
        ];
        if (sizeConfig.complexity >= 2) {
            tractorPositions.push({ x: s * 0.15, y: s * 0.35 * a });
        }
        for (const pos of tractorPositions) {
            this.addTractorEmitter(group, pos.x, pos.y, s * 0.1, palette);
        }

        // Utility crane arms (articulated)
        const armCount = Math.floor(sizeConfig.complexity) + 1;
        for (let i = 0; i < armCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            this.addUtilityArm(group, -s * 0.2 + i * s * 0.1, side * s * 0.35 * a, s * 0.4, side, palette, rng);
        }

        // Scrap collection bin (rear-center)
        const binGeo = new THREE.PlaneGeometry(s * 0.35, s * 0.25);
        const binMat = new THREE.MeshBasicMaterial({
            color: palette.dark, transparent: true, opacity: 0.6,
        });
        const bin = new THREE.Mesh(binGeo, binMat);
        bin.position.set(-s * 0.3, 0, 0.03);
        bin.renderOrder = 2;
        group.add(bin);

        // Scrap bin grating
        for (let i = 0; i < 4; i++) {
            const grateGeo = new THREE.PlaneGeometry(s * 0.015, s * 0.22);
            const grateMat = new THREE.MeshBasicMaterial({
                color: palette.trim, transparent: true, opacity: 0.4,
            });
            const grate = new THREE.Mesh(grateGeo, grateMat);
            grate.position.set(-s * 0.38 + i * s * 0.06, 0, 0.04);
            grate.renderOrder = 3;
            group.add(grate);
        }

        // Asymmetric welded plate patches
        const patchCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < patchCount; i++) {
            const pw = s * (0.08 + rng() * 0.12);
            const ph = s * (0.06 + rng() * 0.08);
            const patchGeo = new THREE.PlaneGeometry(pw, ph);
            const patchMat = new THREE.MeshBasicMaterial({
                color: rng() > 0.5 ? palette.accent : palette.trim,
                transparent: true, opacity: 0.45,
            });
            const patch = new THREE.Mesh(patchGeo, patchMat);
            patch.position.set(
                (rng() - 0.3) * s * 0.5,
                (rng() - 0.5) * s * 0.6,
                0.035
            );
            patch.rotation.z = (rng() - 0.5) * 0.6;
            patch.renderOrder = 3;
            group.add(patch);
        }

        // Engines (asymmetric placement - salvagers are cobbled together)
        this.addEngineNacelles(group, s * 0.9, [
            { x: -s * 0.55, y: s * 0.08 * a },
            { x: -s * 0.5, y: -s * 0.25 * a },
        ], palette, detailLevel, speedFactor);

        // Cockpit (off-center, cluttered)
        this.addCockpit(group, s * 0.2, s * 0.08 * a, s * 0.1, palette.accent, detailLevel);
    }

    addHarvesterDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const cg = SUBSYSTEM_COLORS.cargo;

        // Storage tanks (spherical indicators) - cargo colored
        const tankCount = Math.floor(sizeConfig.complexity * 1.5) + 1;
        for (let i = 0; i < tankCount; i++) {
            const tankR = s * (0.1 + rng() * 0.06);
            const angle = (i / tankCount) * Math.PI * 1.4 - Math.PI * 0.2;
            const dist = s * (0.2 + rng() * 0.1);

            // Tank body
            const tankGeo = new THREE.CircleGeometry(tankR, 16);
            const tankMat = new THREE.MeshBasicMaterial({
                color: cg.container, transparent: true, opacity: 0.65,
            });
            const tank = new THREE.Mesh(tankGeo, tankMat);
            tank.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 0.03);
            tank.renderOrder = 2;
            group.add(tank);

            // Tank ring - accent stripe
            const ringGeo = new THREE.RingGeometry(tankR * 0.7, tankR * 0.85, 16);
            const ringMat = new THREE.MeshBasicMaterial({
                color: cg.stripe, transparent: true, opacity: 0.5,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(tank.position.x, tank.position.y, 0.04);
            ring.renderOrder = 3;
            group.add(ring);

            // Fill indicator on larger tanks
            if (tankR > s * 0.12) {
                const fillGeo = new THREE.CircleGeometry(tankR * 0.4, 8);
                const fillMat = new THREE.MeshBasicMaterial({
                    color: 0x44ffcc, transparent: true, opacity: 0.2,
                });
                const fill = new THREE.Mesh(fillGeo, fillMat);
                fill.position.set(tank.position.x, tank.position.y, 0.035);
                fill.renderOrder = 2;
                group.add(fill);
            }
        }

        // Collection scoops (front-facing intakes) - bright green intake glow
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? 1 : -1;
            const scoopShape = new THREE.Shape();
            scoopShape.moveTo(s * 0.5, 0);
            scoopShape.lineTo(s * 0.7, side * s * 0.12 * a);
            scoopShape.lineTo(s * 0.72, side * s * 0.03 * a);
            scoopShape.lineTo(s * 0.5, -side * s * 0.02 * a);
            scoopShape.closePath();
            const scoopGeo = new THREE.ShapeGeometry(scoopShape);
            const scoopMat = new THREE.MeshBasicMaterial({
                color: palette.accent, transparent: true, opacity: 0.45,
            });
            const scoop = new THREE.Mesh(scoopGeo, scoopMat);
            scoop.position.y = side * s * 0.25 * a;
            scoop.renderOrder = 2;
            group.add(scoop);

            // Scoop intake glow - bright teal
            const glowGeo = new THREE.CircleGeometry(s * 0.045, 8);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0x44ffcc, transparent: true, opacity: 0.75,
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(s * 0.65, side * s * 0.28 * a, 0.05);
            glow.renderOrder = 4;
            group.add(glow);

            // Scoop glow halo
            const haloGeo = new THREE.CircleGeometry(s * 0.08, 10);
            const haloMat = new THREE.MeshBasicMaterial({
                color: 0x33eebb, transparent: true, opacity: 0.1,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(s * 0.65, side * s * 0.28 * a, 0.045);
            halo.renderOrder = 3;
            group.add(halo);
        }

        // Processing pipes connecting tanks - power purple conduits
        if (tankCount >= 2) {
            const pwc = SUBSYSTEM_COLORS.power;
            const pipeLineMat = new THREE.LineBasicMaterial({
                color: pwc.conduit, transparent: true, opacity: 0.45,
            });
            for (let i = 0; i < tankCount - 1; i++) {
                const a1 = (i / tankCount) * Math.PI * 1.4 - Math.PI * 0.2;
                const a2 = ((i + 1) / tankCount) * Math.PI * 1.4 - Math.PI * 0.2;
                const d = s * 0.25;
                const pts = [
                    new THREE.Vector3(Math.cos(a1) * d, Math.sin(a1) * d, 0.04),
                    new THREE.Vector3(Math.cos(a2) * d, Math.sin(a2) * d, 0.04),
                ];
                const pipeGeo = new THREE.BufferGeometry().setFromPoints(pts);
                const pipe = new THREE.Line(pipeGeo, pipeLineMat);
                pipe.renderOrder = 3;
                group.add(pipe);

                // Pipe junction node
                const midX = (Math.cos(a1) + Math.cos(a2)) * d * 0.5;
                const midY = (Math.sin(a1) + Math.sin(a2)) * d * 0.5;
                const nodeGeo = new THREE.CircleGeometry(s * 0.015, 6);
                const nodeMat = new THREE.MeshBasicMaterial({
                    color: pwc.glow, transparent: true, opacity: 0.35,
                });
                const node = new THREE.Mesh(nodeGeo, nodeMat);
                node.position.set(midX, midY, 0.045);
                node.renderOrder = 3;
                group.add(node);
            }
        }

        // Engines
        this.addEngineNacelles(group, s, [
            { x: -s * 0.55, y: s * 0.2 * a },
            { x: -s * 0.55, y: -s * 0.2 * a },
        ], palette, detailLevel, speedFactor);

        this.addCockpit(group, s * 0.28, 0, s * 0.1, palette.accent, detailLevel);
        this.addSensorDish(group, -s * 0.4, s * 0.25 * a, s * 0.06, palette);
    }

    addMercenaryDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;

        // Wing-mounted weapon hardpoints with barrels
        const weaponCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < weaponCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const row = Math.floor(i / 2);
            const x = s * (0.2 - row * 0.2);
            const y = side * s * (0.42 + row * 0.05) * a;
            this.addWeaponHardpoint(group, x, y, s * 0.1, palette, rng, side);
        }

        // Armor plating segments (angular)
        const plateCount = Math.floor(sizeConfig.complexity * 2) + 1;
        for (let i = 0; i < plateCount; i++) {
            const pw = s * (0.15 + rng() * 0.08);
            const ph = s * (0.1 + rng() * 0.06);
            const plateGeo = new THREE.PlaneGeometry(pw, ph);
            const plateMat = new THREE.MeshBasicMaterial({
                color: i % 3 === 0 ? palette.trim : palette.secondary,
                transparent: true, opacity: 0.65,
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            const col = i % 3;
            const row = Math.floor(i / 3);
            plate.position.set(
                s * 0.15 - row * s * 0.25,
                (col - 1) * s * 0.2,
                0.035
            );
            plate.rotation.z = (rng() - 0.5) * 0.15;
            plate.renderOrder = 3;
            group.add(plate);
        }

        // Forward missile bay
        if (sizeConfig.complexity >= 2) {
            this.addMissileBay(group, s * 0.3, 0, s, palette, rng);
        }

        // Afterburner exhausts (large, aggressive)
        const exhaustPositions = [
            { x: -s * 0.62, y: s * 0.25 * a },
            { x: -s * 0.62, y: -s * 0.25 * a },
        ];
        if (sizeConfig.complexity >= 2) {
            exhaustPositions.push({ x: -s * 0.55, y: 0 });
        }
        this.addEngineNacelles(group, s * 0.9, exhaustPositions, palette, detailLevel, speedFactor);

        // Cockpit (armored, compact)
        this.addCockpit(group, s * 0.45, 0, s * 0.1, palette.accent, detailLevel);

        // Wing fins
        this.addWingFins(group, s, palette, rng, 'swept', a);
    }

    addPoliceDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;

        // Authority identification stripes
        const stripeCount = Math.floor(sizeConfig.complexity) + 1;
        for (let i = 0; i < stripeCount; i++) {
            const stripeGeo = new THREE.PlaneGeometry(s * 0.5, s * 0.025);
            const stripeMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0x6699cc : 0xdddddd,
                transparent: true, opacity: 0.6,
            });
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.position.set(-s * 0.05, (i - (stripeCount - 1) / 2) * s * 0.2 * a, 0.05);
            stripe.renderOrder = 4;
            group.add(stripe);
        }

        // Scanner arrays (antenna structures with emitters)
        const scannerCount = Math.floor(sizeConfig.complexity) + 1;
        for (let i = 0; i < scannerCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            this.addScannerArray(group, -s * 0.15 + Math.floor(i / 2) * s * 0.15, side * s * 0.38 * a, s * 0.3 * a, side, palette);
        }

        // Emergency light bar (red/blue rotating indicator)
        const lightBarLen = s * 0.25;
        const lightBarGeo = new THREE.PlaneGeometry(lightBarLen, s * 0.035);
        const lightBarMat = new THREE.MeshBasicMaterial({
            color: 0xff2244, transparent: true, opacity: 0.75,
        });
        const lightBar = new THREE.Mesh(lightBarGeo, lightBarMat);
        lightBar.position.set(s * 0.15, 0, 0.06);
        lightBar.renderOrder = 5;
        group.add(lightBar);

        // Blue light (offset)
        const blueLightGeo = new THREE.PlaneGeometry(lightBarLen * 0.45, s * 0.03);
        const blueLightMat = new THREE.MeshBasicMaterial({
            color: 0x2244ff, transparent: true, opacity: 0.7,
        });
        const blueLight = new THREE.Mesh(blueLightGeo, blueLightMat);
        blueLight.position.set(s * 0.22, 0, 0.065);
        blueLight.renderOrder = 5;
        group.add(blueLight);

        // Forward weapon mount (single, clean)
        this.addTurretMount(group, s * 0.35, 0, s * 0.07, palette.accent, detailLevel);

        // Side-mounted interceptor weapons
        if (sizeConfig.complexity >= 1.5) {
            this.addTurretMount(group, s * 0.1, s * 0.3 * a, s * 0.06, palette.accent, detailLevel);
            this.addTurretMount(group, s * 0.1, -s * 0.3 * a, s * 0.06, palette.accent, detailLevel);
        }

        // Clean symmetrical engines
        this.addEngineNacelles(group, s, [
            { x: -s * 0.58, y: s * 0.18 * a },
            { x: -s * 0.58, y: -s * 0.18 * a },
        ], palette, detailLevel, speedFactor);

        if (sizeConfig.complexity >= 2) {
            this.addSmallThruster(group, -s * 0.52, s * 0.32 * a, palette);
            this.addSmallThruster(group, -s * 0.52, -s * 0.32 * a, palette);
        }

        // Cockpit (prominent, command-style)
        this.addCockpit(group, s * 0.4, 0, s * 0.12, palette.accent, detailLevel);

        // Comm antenna
        this.addAntenna(group, -s * 0.3, 0, s * 0.2, palette, rng);
    }

    addMilitaryDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const shc = SUBSYSTEM_COLORS.shield;

        // Layered armor plating
        const armorLayers = Math.floor(sizeConfig.complexity) + 1;
        for (let i = 0; i < armorLayers; i++) {
            const layerW = s * (0.65 - i * 0.12);
            const layerH = s * (0.5 - i * 0.08) * a;
            const armorGeo = new THREE.PlaneGeometry(layerW, layerH);
            const armorMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? palette.secondary : palette.trim,
                transparent: true, opacity: 0.55 - i * 0.08,
            });
            const armor = new THREE.Mesh(armorGeo, armorMat);
            armor.position.set(-s * 0.08, 0, 0.03 + i * 0.01);
            armor.renderOrder = 2 + i;
            group.add(armor);
        }

        // Shield generator emitters (blue/purple glow nodes)
        for (let side = -1; side <= 1; side += 2) {
            const sgX = -s * 0.15;
            const sgY = side * s * 0.28 * a;
            // Emitter base
            const sgBaseGeo = new THREE.CircleGeometry(s * 0.06, 8);
            const sgBaseMat = new THREE.MeshBasicMaterial({
                color: shc.emitter, transparent: true, opacity: 0.55,
            });
            const sgBase = new THREE.Mesh(sgBaseGeo, sgBaseMat);
            sgBase.position.set(sgX, sgY, 0.05);
            sgBase.renderOrder = 4;
            group.add(sgBase);
            // Shield ring
            const sgRingGeo = new THREE.RingGeometry(s * 0.06, s * 0.08, 10);
            const sgRingMat = new THREE.MeshBasicMaterial({
                color: shc.glow, transparent: true, opacity: 0.3,
            });
            const sgRing = new THREE.Mesh(sgRingGeo, sgRingMat);
            sgRing.position.set(sgX, sgY, 0.052);
            sgRing.renderOrder = 4;
            group.add(sgRing);
            // Core glow
            const sgCoreGeo = new THREE.CircleGeometry(s * 0.025, 6);
            const sgCoreMat = new THREE.MeshBasicMaterial({
                color: shc.pulse, transparent: true, opacity: 0.6,
            });
            const sgCore = new THREE.Mesh(sgCoreGeo, sgCoreMat);
            sgCore.position.set(sgX, sgY, 0.055);
            sgCore.renderOrder = 5;
            group.add(sgCore);
        }

        // Symmetrical turret platforms with barrels
        const turretCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < turretCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const row = Math.floor(i / 2);
            const x = s * (0.15 - row * 0.25);
            const y = side * s * 0.42 * a;
            this.addWeaponHardpoint(group, x, y, s * 0.09, palette, rng, side);
        }

        // Command bridge superstructure
        if (sizeConfig.complexity >= 1.5) {
            const bridgeGeo = new THREE.PlaneGeometry(s * 0.2, s * 0.15);
            const bridgeMat = new THREE.MeshBasicMaterial({
                color: palette.secondary, transparent: true, opacity: 0.7,
            });
            const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
            bridge.position.set(s * 0.15, 0, 0.06);
            bridge.renderOrder = 5;
            group.add(bridge);

            // Bridge windows - cockpit blue glow
            const bcc = SUBSYSTEM_COLORS.cockpit;
            for (let i = 0; i < 3; i++) {
                const winGeo = new THREE.PlaneGeometry(s * 0.02, s * 0.04);
                const winMat = new THREE.MeshBasicMaterial({
                    color: bcc.glow, transparent: true, opacity: 0.65,
                });
                const win = new THREE.Mesh(winGeo, winMat);
                win.position.set(s * 0.22, (i - 1) * s * 0.05, 0.07);
                win.renderOrder = 6;
                group.add(win);
            }
        }

        // Antenna arrays (multiple thin antennas)
        const antennaCount = Math.floor(sizeConfig.complexity) + 1;
        for (let i = 0; i < antennaCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            this.addAntenna(group, -s * 0.3, side * s * (0.35 + i * 0.05) * a, s * 0.25, palette, rng);
        }

        // Missile tubes (capital ships)
        if (sizeConfig.complexity >= 2.5) {
            this.addMissileBay(group, s * 0.05, s * 0.35 * a, s, palette, rng);
            this.addMissileBay(group, s * 0.05, -s * 0.35 * a, s, palette, rng);
        }

        // Multi-engine array
        const enginePositions = [
            { x: -s * 0.65, y: s * 0.2 * a },
            { x: -s * 0.65, y: -s * 0.2 * a },
        ];
        if (sizeConfig.complexity >= 2) {
            enginePositions.push({ x: -s * 0.6, y: s * 0.38 * a });
            enginePositions.push({ x: -s * 0.6, y: -s * 0.38 * a });
        }
        if (sizeConfig.complexity >= 3) {
            enginePositions.push({ x: -s * 0.68, y: 0 });
        }
        this.addEngineNacelles(group, s * 1.1, enginePositions, palette, detailLevel, speedFactor);

        // Cockpit (armored command center)
        this.addCockpit(group, s * 0.3, 0, s * 0.12, palette.accent, detailLevel);
    }

    addPirateDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;

        // Improvised welded armor plates (scattered, uneven)
        const plateCount = Math.floor(sizeConfig.complexity * 3) + 2;
        for (let i = 0; i < plateCount; i++) {
            const pw = s * (0.08 + rng() * 0.14);
            const ph = s * (0.06 + rng() * 0.1);
            const plateGeo = new THREE.PlaneGeometry(pw, ph);
            const isRust = rng() > 0.5;
            const plateMat = new THREE.MeshBasicMaterial({
                color: isRust ? this.lerpColor(palette.primary, 0x886644, rng() * 0.4)
                              : palette.secondary,
                transparent: true, opacity: 0.6,
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            plate.position.set(
                (rng() - 0.4) * s * 0.6,
                (rng() - 0.5) * s * 0.7 * a,
                0.035
            );
            plate.rotation.z = (rng() - 0.5) * Math.PI / 2.5;
            plate.renderOrder = 3;
            group.add(plate);
        }

        // Weapon spikes/prongs (menacing protrusions) - weapon red
        const wsc = SUBSYSTEM_COLORS.weapon;
        const spikeCount = Math.floor(sizeConfig.complexity * 2) + 1;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 1.5 - Math.PI * 0.3;
            const dist = s * (0.45 + rng() * 0.15);
            const spikeLen = s * (0.1 + rng() * 0.12);

            const spikePts = [
                new THREE.Vector3(Math.cos(angle) * dist, Math.sin(angle) * dist, 0.04),
                new THREE.Vector3(Math.cos(angle) * (dist + spikeLen), Math.sin(angle) * (dist + spikeLen), 0.04),
            ];
            const spikeGeo = new THREE.BufferGeometry().setFromPoints(spikePts);
            const spikeMat = new THREE.LineBasicMaterial({
                color: wsc.charge, transparent: true, opacity: 0.8, linewidth: 2,
            });
            const spike = new THREE.Line(spikeGeo, spikeMat);
            spike.renderOrder = 4;
            group.add(spike);

            // Spike tip - bright muzzle red
            const tipGeo = new THREE.CircleGeometry(s * 0.03, 3);
            const tipMat = new THREE.MeshBasicMaterial({
                color: wsc.muzzle, transparent: true, opacity: 0.75,
            });
            const tip = new THREE.Mesh(tipGeo, tipMat);
            tip.position.set(
                Math.cos(angle) * (dist + spikeLen),
                Math.sin(angle) * (dist + spikeLen),
                0.04
            );
            tip.rotation.z = angle;
            tip.renderOrder = 4;
            group.add(tip);
        }

        // Skull-like cockpit (intimidating forward section)
        const skullGeo = new THREE.CircleGeometry(s * 0.14, 12);
        const skullMat = new THREE.MeshBasicMaterial({
            color: 0x1a0000, transparent: true, opacity: 0.85,
        });
        const skull = new THREE.Mesh(skullGeo, skullMat);
        skull.position.set(s * 0.5, 0, 0.05);
        skull.renderOrder = 4;
        group.add(skull);

        // Skull eyes (menacing red glow with weapon subsystem colors)
        const pwc = SUBSYSTEM_COLORS.weapon;
        for (let side = -1; side <= 1; side += 2) {
            // Outer socket - dark weapon red
            const socketGeo = new THREE.RingGeometry(s * 0.04, s * 0.065, 8);
            const socketMat = new THREE.MeshBasicMaterial({
                color: pwc.base, transparent: true, opacity: 0.6,
            });
            const socket = new THREE.Mesh(socketGeo, socketMat);
            socket.position.set(s * 0.55, side * s * 0.06 * a, 0.055);
            socket.renderOrder = 5;
            group.add(socket);

            // Eye glow - bright muzzle red
            const eyeGeo = new THREE.CircleGeometry(s * 0.04, 8);
            const eyeMat = new THREE.MeshBasicMaterial({
                color: pwc.muzzle, transparent: true, opacity: 0.9,
            });
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(s * 0.55, side * s * 0.06 * a, 0.06);
            eye.renderOrder = 5;
            group.add(eye);

            // Eye glow halo
            const haloGeo = new THREE.CircleGeometry(s * 0.07, 10);
            const haloMat = new THREE.MeshBasicMaterial({
                color: pwc.muzzle, transparent: true, opacity: 0.12,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(s * 0.55, side * s * 0.06 * a, 0.052);
            halo.renderOrder = 4;
            group.add(halo);
        }

        // Crude weapon mounts (asymmetric, bolted-on)
        this.addWeaponHardpoint(group, s * 0.15, s * 0.45 * a, s * 0.09, palette, rng, 1);
        this.addWeaponHardpoint(group, s * 0.05, -s * 0.38 * a, s * 0.09, palette, rng, -1);
        if (sizeConfig.complexity >= 2) {
            this.addWeaponHardpoint(group, -s * 0.15, s * 0.4 * a, s * 0.08, palette, rng, 1);
        }

        // Cobbled-together engines (asymmetric)
        this.addEngineNacelles(group, s * 0.85, [
            { x: -s * 0.58, y: s * 0.12 * a },
            { x: -s * 0.52, y: -s * 0.25 * a },
        ], palette, detailLevel, speedFactor);

        if (sizeConfig.complexity >= 2) {
            this.addSmallThruster(group, -s * 0.48, s * 0.35 * a, palette);
        }

        // Stolen antenna (slightly bent)
        this.addAntenna(group, -s * 0.35, -s * 0.3 * a, s * 0.2, palette, rng);
    }

    // =============================================
    // ENHANCED COMPONENT BUILDERS
    // =============================================

    /**
     * Engine nacelles with inner glow ring and exhaust cone
     */
    addEngineNacelles(group, s, positions, palette, detailLevel, speedFactor = 1.0) {
        const ec = SUBSYSTEM_COLORS.engine;
        for (const pos of positions) {
            // Engine size scales with speed factor - fast ships have huge engines
            const nacSize = s * 0.1 * speedFactor;

            // Outer housing ring - dark metallic
            const housingGeo = new THREE.RingGeometry(nacSize * 0.6, nacSize, 16);
            const housingMat = new THREE.MeshBasicMaterial({
                color: ec.housing, transparent: true, opacity: 0.8,
            });
            const housing = new THREE.Mesh(housingGeo, housingMat);
            housing.position.set(pos.x, pos.y, 0.02);
            housing.renderOrder = 2;
            group.add(housing);

            // Mid ring - accent colored heat ring
            const midRingGeo = new THREE.RingGeometry(nacSize * 0.5, nacSize * 0.62, 16);
            const midRingMat = new THREE.MeshBasicMaterial({
                color: ec.boost, transparent: true, opacity: 0.4,
            });
            const midRing = new THREE.Mesh(midRingGeo, midRingMat);
            midRing.position.set(pos.x, pos.y, 0.025);
            midRing.renderOrder = 2;
            group.add(midRing);

            // Inner glow (engine flame) - bright cyan/blue
            const glowGeo = new THREE.CircleGeometry(nacSize * 0.48, 16);
            const glowMat = new THREE.MeshBasicMaterial({
                color: ec.glow,
                transparent: true, opacity: Math.min(0.95, 0.6 + speedFactor * 0.2),
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(pos.x, pos.y, 0.03);
            glow.renderOrder = 3;
            group.add(glow);

            // Hot core center - white hot
            const coreGeo = new THREE.CircleGeometry(nacSize * 0.18, 8);
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.7 + speedFactor * 0.1,
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.set(pos.x, pos.y, 0.035);
            core.renderOrder = 4;
            group.add(core);

            // Exhaust trail - vivid blue glow
            const trailLen = nacSize * (1.2 + speedFactor * 0.6);
            const trailGeo = new THREE.PlaneGeometry(trailLen, nacSize * 0.35);
            const trailMat = new THREE.MeshBasicMaterial({
                color: ec.trail,
                transparent: true, opacity: 0.2 + speedFactor * 0.12,
            });
            const trail = new THREE.Mesh(trailGeo, trailMat);
            trail.position.set(pos.x - trailLen * 0.4, pos.y, 0.01);
            trail.renderOrder = 1;
            group.add(trail);

            // Outer exhaust glow halo
            const haloGeo = new THREE.PlaneGeometry(trailLen * 0.6, nacSize * 0.7);
            const haloMat = new THREE.MeshBasicMaterial({
                color: ec.glow, transparent: true, opacity: 0.06 + speedFactor * 0.04,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(pos.x - trailLen * 0.2, pos.y, 0.005);
            halo.renderOrder = 0;
            group.add(halo);
        }
    }

    /**
     * Small maneuvering thruster
     */
    addSmallThruster(group, x, y, palette) {
        const ec = SUBSYSTEM_COLORS.engine;
        // Outer housing
        const housingGeo = new THREE.RingGeometry(2, 4, 8);
        const housingMat = new THREE.MeshBasicMaterial({
            color: ec.housing, transparent: true, opacity: 0.6,
        });
        const housing = new THREE.Mesh(housingGeo, housingMat);
        housing.position.set(x, y, 0.025);
        housing.renderOrder = 2;
        group.add(housing);

        // Inner glow
        const tGeo = new THREE.CircleGeometry(2.2, 8);
        const tMat = new THREE.MeshBasicMaterial({
            color: ec.glow, transparent: true, opacity: 0.65,
        });
        const thruster = new THREE.Mesh(tGeo, tMat);
        thruster.position.set(x, y, 0.03);
        thruster.renderOrder = 3;
        group.add(thruster);

        // Hot center
        const coreGeo = new THREE.CircleGeometry(0.8, 6);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(x, y, 0.035);
        core.renderOrder = 4;
        group.add(core);
    }

    /**
     * Enhanced cockpit with canopy frame
     */
    addCockpit(group, x, y, size, color, detailLevel) {
        const cc = SUBSYSTEM_COLORS.cockpit;
        // Outer frame ring - metallic
        const outerGeo = new THREE.RingGeometry(size * 0.9, size * 1.15, 12);
        const outerMat = new THREE.MeshBasicMaterial({
            color: cc.frame, transparent: true, opacity: 0.55,
        });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.position.set(x, y, 0.058);
        outer.renderOrder = 5;
        group.add(outer);

        // Canopy glass - translucent blue
        const cockpitGeo = new THREE.CircleGeometry(size, 12);
        const cockpitMat = new THREE.MeshBasicMaterial({
            color: cc.glass, transparent: true, opacity: 0.7,
        });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.set(x, y, 0.06);
        cockpit.renderOrder = 5;
        group.add(cockpit);

        // Inner canopy glow ring
        const frameGeo = new THREE.RingGeometry(size * 0.5, size * 0.7, 12);
        const frameMat = new THREE.MeshBasicMaterial({
            color: cc.glow, transparent: true, opacity: 0.3,
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(x, y, 0.065);
        frame.renderOrder = 5;
        group.add(frame);

        // HUD pip - bright cockpit indicator
        const pipGeo = new THREE.CircleGeometry(size * 0.22, 8);
        const pipMat = new THREE.MeshBasicMaterial({
            color: cc.pip, transparent: true, opacity: 0.6,
        });
        const pip = new THREE.Mesh(pipGeo, pipMat);
        pip.position.set(x, y, 0.07);
        pip.renderOrder = 6;
        group.add(pip);

        // HUD center dot
        const dotGeo = new THREE.CircleGeometry(size * 0.08, 6);
        const dotMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5,
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(x, y, 0.075);
        dot.renderOrder = 6;
        group.add(dot);
    }

    /**
     * Turret mount with base and barrel indication
     */
    addTurretMount(group, x, y, size, color, detailLevel) {
        const wc = SUBSYSTEM_COLORS.weapon;
        // Mounting plate - dark base
        const plateGeo = new THREE.CircleGeometry(size * 1.1, 8);
        const plateMat = new THREE.MeshBasicMaterial({
            color: wc.base, transparent: true, opacity: 0.5,
        });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.set(x, y, 0.045);
        plate.renderOrder = 3;
        group.add(plate);

        // Turret base - weapon red
        const baseGeo = new THREE.CircleGeometry(size, 8);
        const baseMat = new THREE.MeshBasicMaterial({
            color: wc.charge, transparent: true, opacity: 0.65,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(x, y, 0.05);
        base.renderOrder = 4;
        group.add(base);

        // Rotation ring
        const ringGeo = new THREE.RingGeometry(size * 0.55, size * 0.8, 8);
        const ringMat = new THREE.MeshBasicMaterial({
            color: wc.barrel, transparent: true, opacity: 0.45,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y, 0.055);
        ring.renderOrder = 4;
        group.add(ring);
    }

    /**
     * Weapon hardpoint with barrel(s)
     */
    addWeaponHardpoint(group, x, y, size, palette, rng, side) {
        const wc = SUBSYSTEM_COLORS.weapon;
        // Turret base
        this.addTurretMount(group, x, y, size, wc.charge, 'low');

        // Twin barrels (extends forward) - dark metallic
        const barrelLen = size * 2.0;
        const barrelSpacing = size * 0.12;
        for (let b = -1; b <= 1; b += 2) {
            const barrelGeo = new THREE.PlaneGeometry(barrelLen, size * 0.12);
            const barrelMat = new THREE.MeshBasicMaterial({
                color: wc.barrel, transparent: true, opacity: 0.75,
            });
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.position.set(x + barrelLen * 0.45, y + b * barrelSpacing, 0.06);
            barrel.renderOrder = 5;
            group.add(barrel);
        }

        // Barrel jacket / heat shroud
        const jacketGeo = new THREE.PlaneGeometry(barrelLen * 0.4, size * 0.35);
        const jacketMat = new THREE.MeshBasicMaterial({
            color: wc.base, transparent: true, opacity: 0.4,
        });
        const jacket = new THREE.Mesh(jacketGeo, jacketMat);
        jacket.position.set(x + barrelLen * 0.2, y, 0.055);
        jacket.renderOrder = 4;
        group.add(jacket);

        // Muzzle flash point - bright red-orange
        const muzzleGeo = new THREE.CircleGeometry(size * 0.18, 6);
        const muzzleMat = new THREE.MeshBasicMaterial({
            color: wc.muzzle, transparent: true, opacity: 0.7,
        });
        const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzle.position.set(x + barrelLen * 0.92, y, 0.065);
        muzzle.renderOrder = 5;
        group.add(muzzle);

        // Muzzle glow halo
        const haloGeo = new THREE.CircleGeometry(size * 0.3, 8);
        const haloMat = new THREE.MeshBasicMaterial({
            color: wc.muzzle, transparent: true, opacity: 0.15,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(x + barrelLen * 0.92, y, 0.06);
        halo.renderOrder = 4;
        group.add(halo);
    }

    /**
     * Mining drill assembly
     */
    addMiningDrill(group, x, y, size, palette, rng) {
        // Drill housing - industrial yellow-brown
        const housingGeo = new THREE.PlaneGeometry(size * 1.5, size * 1.2);
        const housingMat = new THREE.MeshBasicMaterial({
            color: 0x665522, transparent: true, opacity: 0.6,
        });
        const housing = new THREE.Mesh(housingGeo, housingMat);
        housing.position.set(x, y, 0.04);
        housing.renderOrder = 3;
        group.add(housing);

        // Housing frame lines
        const frameMat = new THREE.LineBasicMaterial({
            color: 0x887744, transparent: true, opacity: 0.4,
        });
        const framePts = [
            new THREE.Vector3(x - size * 0.7, y - size * 0.55, 0.045),
            new THREE.Vector3(x + size * 0.5, y - size * 0.55, 0.045),
            new THREE.Vector3(x + size * 0.5, y + size * 0.55, 0.045),
            new THREE.Vector3(x - size * 0.7, y + size * 0.55, 0.045),
        ];
        const frameGeo = new THREE.BufferGeometry().setFromPoints(framePts);
        const frame = new THREE.Line(frameGeo, frameMat);
        frame.renderOrder = 3;
        group.add(frame);

        // Drill tip (triangular) - bright gold
        const drillShape = new THREE.Shape();
        drillShape.moveTo(size * 1.0, 0);
        drillShape.lineTo(0, size * 0.4);
        drillShape.lineTo(0, -size * 0.4);
        drillShape.closePath();
        const drillGeo = new THREE.ShapeGeometry(drillShape);
        const drillMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00, transparent: true, opacity: 0.7,
        });
        const drill = new THREE.Mesh(drillGeo, drillMat);
        drill.position.set(x + size * 0.5, y, 0.05);
        drill.renderOrder = 4;
        group.add(drill);

        // Drill rotation ring
        const ringGeo = new THREE.RingGeometry(size * 0.3, size * 0.45, 8);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xddaa22, transparent: true, opacity: 0.4,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x + size * 0.3, y, 0.055);
        ring.renderOrder = 4;
        group.add(ring);

        // Laser emitter glow - bright green mining laser
        const emitterGeo = new THREE.CircleGeometry(size * 0.18, 8);
        const emitterMat = new THREE.MeshBasicMaterial({
            color: 0x66ff88, transparent: true, opacity: 0.85,
        });
        const emitter = new THREE.Mesh(emitterGeo, emitterMat);
        emitter.position.set(x + size * 1.2, y, 0.06);
        emitter.renderOrder = 5;
        group.add(emitter);

        // Emitter glow halo
        const haloGeo = new THREE.CircleGeometry(size * 0.35, 10);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0x44ff66, transparent: true, opacity: 0.12,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.position.set(x + size * 1.2, y, 0.055);
        halo.renderOrder = 4;
        group.add(halo);
    }

    /**
     * Drone bay indicator
     */
    addDroneBay(group, x, y, size, palette) {
        const dc = SUBSYSTEM_COLORS.drone;
        // Bay interior - dark recessed area
        const bayGeo = new THREE.PlaneGeometry(size * 1.5, size);
        const bayMat = new THREE.MeshBasicMaterial({
            color: dc.bay, transparent: true, opacity: 0.55,
        });
        const bay = new THREE.Mesh(bayGeo, bayMat);
        bay.position.set(x, y, 0.04);
        bay.renderOrder = 3;
        group.add(bay);

        // Bay frame
        const frameGeo = new THREE.RingGeometry(size * 0.65, size * 0.8, 4);
        const frameMat = new THREE.MeshBasicMaterial({
            color: dc.frame, transparent: true, opacity: 0.4,
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(x, y, 0.042);
        frame.renderOrder = 3;
        group.add(frame);

        // Bay door lines - teal colored
        const doorMat = new THREE.LineBasicMaterial({
            color: dc.door, transparent: true, opacity: 0.5,
        });
        for (let i = 0; i < 3; i++) {
            const doorPts = [
                new THREE.Vector3(x - size * 0.6 + i * size * 0.6, y - size * 0.4, 0.05),
                new THREE.Vector3(x - size * 0.6 + i * size * 0.6, y + size * 0.4, 0.05),
            ];
            const doorGeo = new THREE.BufferGeometry().setFromPoints(doorPts);
            const door = new THREE.Line(doorGeo, doorMat);
            door.renderOrder = 4;
            group.add(door);
        }

        // Status lights on bay doors
        for (let i = 0; i < 2; i++) {
            const lightGeo = new THREE.CircleGeometry(size * 0.06, 6);
            const lightMat = new THREE.MeshBasicMaterial({
                color: dc.light, transparent: true, opacity: 0.7,
            });
            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(x - size * 0.3 + i * size * 0.6, y - size * 0.3, 0.055);
            light.renderOrder = 4;
            group.add(light);
        }
    }

    /**
     * Sensor/radar dish
     */
    addSensorDish(group, x, y, size, palette) {
        const sc = SUBSYSTEM_COLORS.sensor;
        // Dish body - teal/green
        const dishGeo = new THREE.RingGeometry(size * 0.3, size, 12);
        const dishMat = new THREE.MeshBasicMaterial({
            color: sc.dish, transparent: true, opacity: 0.55,
        });
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.set(x, y, 0.06);
        dish.renderOrder = 5;
        group.add(dish);

        // Outer scan ring - pulsing indicator
        const outerGeo = new THREE.RingGeometry(size * 0.95, size * 1.15, 12);
        const outerMat = new THREE.MeshBasicMaterial({
            color: sc.ring, transparent: true, opacity: 0.25,
        });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.position.set(x, y, 0.058);
        outer.renderOrder = 5;
        group.add(outer);

        // Center receiver - bright green
        const recGeo = new THREE.CircleGeometry(size * 0.28, 8);
        const recMat = new THREE.MeshBasicMaterial({
            color: sc.receiver, transparent: true, opacity: 0.7,
        });
        const rec = new THREE.Mesh(recGeo, recMat);
        rec.position.set(x, y, 0.065);
        rec.renderOrder = 5;
        group.add(rec);

        // Receiver glow halo
        const glowGeo = new THREE.CircleGeometry(size * 0.5, 10);
        const glowMat = new THREE.MeshBasicMaterial({
            color: sc.scan, transparent: true, opacity: 0.1,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(x, y, 0.062);
        glow.renderOrder = 5;
        group.add(glow);
    }

    /**
     * Tractor beam emitter (salvager-specific)
     */
    addTractorEmitter(group, x, y, size, palette) {
        const pc = SUBSYSTEM_COLORS.power;
        // Emitter housing - dark purple base
        const housingGeo = new THREE.CircleGeometry(size, 8);
        const housingMat = new THREE.MeshBasicMaterial({
            color: pc.conduit, transparent: true, opacity: 0.6,
        });
        const housing = new THREE.Mesh(housingGeo, housingMat);
        housing.position.set(x, y, 0.04);
        housing.renderOrder = 3;
        group.add(housing);

        // Outer energy ring
        const outerGeo = new THREE.RingGeometry(size * 0.7, size * 0.9, 8);
        const outerMat = new THREE.MeshBasicMaterial({
            color: pc.node, transparent: true, opacity: 0.35,
        });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        outer.position.set(x, y, 0.042);
        outer.renderOrder = 3;
        group.add(outer);

        // Inner emitter glow - bright purple
        const glowGeo = new THREE.CircleGeometry(size * 0.5, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: pc.glow, transparent: true, opacity: 0.75,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(x, y, 0.05);
        glow.renderOrder = 4;
        group.add(glow);

        // Emitter ring - bright pulse
        const ringGeo = new THREE.RingGeometry(size * 0.5, size * 0.65, 8);
        const ringMat = new THREE.MeshBasicMaterial({
            color: pc.pulse, transparent: true, opacity: 0.3,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y, 0.045);
        ring.renderOrder = 4;
        group.add(ring);

        // Center hot point
        const coreGeo = new THREE.CircleGeometry(size * 0.15, 6);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.5,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(x, y, 0.055);
        core.renderOrder = 5;
        group.add(core);
    }

    /**
     * Utility arm (salvager crane)
     */
    addUtilityArm(group, x, y, length, side, palette, rng) {
        const cc = SUBSYSTEM_COLORS.cargo;
        // Arm segments - industrial grey-blue
        const segCount = 2;
        const segLen = length / segCount;
        const armAngle = side * (Math.PI / 5 + rng() * Math.PI / 8);

        let curX = x;
        let curY = y;
        for (let i = 0; i < segCount; i++) {
            const angle = armAngle + (rng() - 0.5) * 0.3;
            const nextX = curX + Math.cos(angle) * segLen;
            const nextY = curY + Math.sin(angle) * segLen;

            const pts = [
                new THREE.Vector3(curX, curY, 0.05),
                new THREE.Vector3(nextX, nextY, 0.05),
            ];
            const segGeo = new THREE.BufferGeometry().setFromPoints(pts);
            const segMat = new THREE.LineBasicMaterial({
                color: cc.frame, transparent: true, opacity: 0.65,
            });
            const seg = new THREE.Line(segGeo, segMat);
            seg.renderOrder = 4;
            group.add(seg);

            // Joint - bright accent
            const jointGeo = new THREE.CircleGeometry(2.5, 6);
            const jointMat = new THREE.MeshBasicMaterial({
                color: cc.stripe, transparent: true, opacity: 0.6,
            });
            const joint = new THREE.Mesh(jointGeo, jointMat);
            joint.position.set(nextX, nextY, 0.055);
            joint.renderOrder = 4;
            group.add(joint);

            curX = nextX;
            curY = nextY;
        }

        // Claw/tool at end - bright salvager orange glow
        const toolGeo = new THREE.CircleGeometry(3.5, 4);
        const toolMat = new THREE.MeshBasicMaterial({
            color: 0xff9944, transparent: true, opacity: 0.7,
        });
        const tool = new THREE.Mesh(toolGeo, toolMat);
        tool.position.set(curX, curY, 0.06);
        tool.renderOrder = 5;
        group.add(tool);

        // Tool glow
        const glowGeo = new THREE.CircleGeometry(5, 6);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xff9944, transparent: true, opacity: 0.12,
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        glowMesh.position.set(curX, curY, 0.055);
        glowMesh.renderOrder = 4;
        group.add(glowMesh);
    }

    /**
     * Scanner array (police-specific)
     */
    addScannerArray(group, x, y, length, side, palette) {
        const sc = SUBSYSTEM_COLORS.sensor;
        // Antenna mast - sensor teal
        const mastPts = [
            new THREE.Vector3(x, y, 0.05),
            new THREE.Vector3(x, y + side * length, 0.05),
        ];
        const mastGeo = new THREE.BufferGeometry().setFromPoints(mastPts);
        const mastMat = new THREE.LineBasicMaterial({
            color: sc.ring, transparent: true, opacity: 0.6,
        });
        const mast = new THREE.Line(mastGeo, mastMat);
        mast.renderOrder = 4;
        group.add(mast);

        // Cross-bar at midpoint
        const midY = y + side * length * 0.6;
        const crossPts = [
            new THREE.Vector3(x - 4, midY, 0.05),
            new THREE.Vector3(x + 4, midY, 0.05),
        ];
        const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPts);
        const crossMat = new THREE.LineBasicMaterial({
            color: sc.dish, transparent: true, opacity: 0.5,
        });
        const cross = new THREE.Line(crossGeo, crossMat);
        cross.renderOrder = 4;
        group.add(cross);

        // Tip emitter - bright green
        const tipGeo = new THREE.CircleGeometry(3.5, 8);
        const tipMat = new THREE.MeshBasicMaterial({
            color: sc.receiver, transparent: true, opacity: 0.85,
        });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(x, y + side * length, 0.06);
        tip.renderOrder = 5;
        group.add(tip);

        // Tip scan glow
        const glowGeo = new THREE.CircleGeometry(6, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: sc.scan, transparent: true, opacity: 0.1,
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(x, y + side * length, 0.055);
        glow.renderOrder = 4;
        group.add(glow);
    }

    /**
     * Communication/navigation antenna
     */
    addAntenna(group, x, y, length, palette, rng) {
        const sc = SUBSYSTEM_COLORS.sensor;
        const angle = Math.PI / 2 + (rng() - 0.5) * 0.4;
        const endX = x + Math.cos(angle) * length * 0.3;
        const endY = y + Math.sin(angle) * length;

        // Antenna mast
        const antPts = [
            new THREE.Vector3(x, y, 0.05),
            new THREE.Vector3(endX, endY, 0.05),
        ];
        const antGeo = new THREE.BufferGeometry().setFromPoints(antPts);
        const antMat = new THREE.LineBasicMaterial({
            color: sc.dish, transparent: true, opacity: 0.55,
        });
        const ant = new THREE.Line(antGeo, antMat);
        ant.renderOrder = 4;
        group.add(ant);

        // Base mount
        const baseGeo = new THREE.CircleGeometry(2, 6);
        const baseMat = new THREE.MeshBasicMaterial({
            color: sc.ring, transparent: true, opacity: 0.3,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(x, y, 0.052);
        base.renderOrder = 4;
        group.add(base);

        // Tip indicator - bright green receiver
        const tipGeo = new THREE.CircleGeometry(2, 6);
        const tipMat = new THREE.MeshBasicMaterial({
            color: sc.receiver, transparent: true, opacity: 0.7,
        });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(endX, endY, 0.06);
        tip.renderOrder = 5;
        group.add(tip);
    }

    /**
     * Missile bay (forward-facing missile tubes)
     */
    addMissileBay(group, x, y, s, palette, rng) {
        const mc = SUBSYSTEM_COLORS.missile;
        const tubeCount = 2 + Math.floor(rng() * 2);

        // Bay housing background
        const bayH = s * 0.035 * tubeCount + s * 0.02;
        const bayGeo = new THREE.PlaneGeometry(s * 0.1, bayH);
        const bayMat = new THREE.MeshBasicMaterial({
            color: mc.housing, transparent: true, opacity: 0.4,
        });
        const bay = new THREE.Mesh(bayGeo, bayMat);
        bay.position.set(x, y, 0.045);
        bay.renderOrder = 3;
        group.add(bay);

        for (let i = 0; i < tubeCount; i++) {
            const ty = y + (i - (tubeCount - 1) / 2) * s * 0.035;

            // Tube body - dark
            const tubeGeo = new THREE.PlaneGeometry(s * 0.08, s * 0.022);
            const tubeMat = new THREE.MeshBasicMaterial({
                color: mc.tube, transparent: true, opacity: 0.65,
            });
            const tube = new THREE.Mesh(tubeGeo, tubeMat);
            tube.position.set(x, ty, 0.05);
            tube.renderOrder = 4;
            group.add(tube);

            // Warhead tip - bright orange
            const tipGeo = new THREE.CircleGeometry(s * 0.012, 4);
            const tipMat = new THREE.MeshBasicMaterial({
                color: mc.warhead, transparent: true, opacity: 0.75,
            });
            const tip = new THREE.Mesh(tipGeo, tipMat);
            tip.position.set(x + s * 0.04, ty, 0.055);
            tip.renderOrder = 4;
            group.add(tip);
        }

        // Bay status light
        const lightGeo = new THREE.CircleGeometry(s * 0.008, 6);
        const lightMat = new THREE.MeshBasicMaterial({
            color: mc.exhaust, transparent: true, opacity: 0.6,
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(x - s * 0.04, y - bayH * 0.4, 0.055);
        light.renderOrder = 4;
        group.add(light);
    }

    /**
     * Wing fins (mercenary/fighter ships)
     */
    addWingFins(group, s, palette, rng, style, aspect = 0.5) {
        const wc = SUBSYSTEM_COLORS.weapon;
        const fa = aspect;
        for (let side = -1; side <= 1; side += 2) {
            const finShape = new THREE.Shape();
            if (style === 'swept') {
                // Swept-back fins
                finShape.moveTo(s * 0.1, side * s * 0.4 * fa);
                finShape.lineTo(-s * 0.15, side * s * 0.55 * fa);
                finShape.lineTo(-s * 0.35, side * s * 0.5 * fa);
                finShape.lineTo(-s * 0.25, side * s * 0.38 * fa);
                finShape.closePath();
            }

            const finGeo = new THREE.ShapeGeometry(finShape);
            const finMat = new THREE.MeshBasicMaterial({
                color: palette.secondary, transparent: true, opacity: 0.55,
            });
            const fin = new THREE.Mesh(finGeo, finMat);
            fin.position.z = 0.01;
            fin.renderOrder = 1;
            group.add(fin);

            // Fin leading edge - weapon red accent
            const edgePts = [
                new THREE.Vector3(s * 0.1, side * s * 0.4 * fa, 0.015),
                new THREE.Vector3(-s * 0.15, side * s * 0.55 * fa, 0.015),
                new THREE.Vector3(-s * 0.35, side * s * 0.5 * fa, 0.015),
            ];
            const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
            const edgeMat = new THREE.LineBasicMaterial({
                color: wc.charge, transparent: true, opacity: 0.45,
            });
            const edge = new THREE.Line(edgeGeo, edgeMat);
            edge.renderOrder = 2;
            group.add(edge);

            // Wingtip light
            const tipGeo = new THREE.CircleGeometry(s * 0.012, 6);
            const tipMat = new THREE.MeshBasicMaterial({
                color: wc.muzzle, transparent: true, opacity: 0.6,
            });
            const tipLight = new THREE.Mesh(tipGeo, tipMat);
            tipLight.position.set(-s * 0.15, side * s * 0.55 * fa, 0.02);
            tipLight.renderOrder = 2;
            group.add(tipLight);
        }
    }

    // =============================================
    // UNIVERSAL DETAIL BUILDERS
    // =============================================

    /**
     * Add running lights (nav lights at wing tips / hull extremes)
     */
    addRunningLights(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const lightSize = Math.max(1.5, s * 0.025);

        // Port (left) - red
        const portGeo = new THREE.CircleGeometry(lightSize, 6);
        const portMat = new THREE.MeshBasicMaterial({
            color: 0xff2200, transparent: true, opacity: 0.8,
        });
        const port = new THREE.Mesh(portGeo, portMat);
        port.position.set(-s * 0.1, s * 0.45 * a, 0.07);
        port.renderOrder = 6;
        group.add(port);

        // Starboard (right) - green
        const stbdGeo = new THREE.CircleGeometry(lightSize, 6);
        const stbdMat = new THREE.MeshBasicMaterial({
            color: 0x00ff22, transparent: true, opacity: 0.8,
        });
        const stbd = new THREE.Mesh(stbdGeo, stbdMat);
        stbd.position.set(-s * 0.1, -s * 0.45 * a, 0.07);
        stbd.renderOrder = 6;
        group.add(stbd);

        // Stern (rear) - white
        const sternGeo = new THREE.CircleGeometry(lightSize, 6);
        const sternMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.6,
        });
        const stern = new THREE.Mesh(sternGeo, sternMat);
        stern.position.set(-s * 0.55, 0, 0.07);
        stern.renderOrder = 6;
        group.add(stern);

        // Forward strobe (blinking indicator)
        const strobeGeo = new THREE.CircleGeometry(lightSize * 0.7, 6);
        const strobeMat = new THREE.MeshBasicMaterial({
            color: palette.glow, transparent: true, opacity: 0.7,
        });
        const strobe = new THREE.Mesh(strobeGeo, strobeMat);
        strobe.position.set(s * 0.5, 0, 0.07);
        strobe.renderOrder = 6;
        group.add(strobe);
    }

    /**
     * Add surface greebles (tiny details that add visual complexity)
     */
    addPanelGreebles(group, sizeConfig, rng, palette, role) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const pc = SUBSYSTEM_COLORS.power;
        const cc = SUBSYSTEM_COLORS.cargo;
        const greebleCount = Math.floor(sizeConfig.complexity * 3) + 2;

        for (let i = 0; i < greebleCount; i++) {
            const gType = Math.floor(rng() * 5);
            const gx = (rng() - 0.4) * s * 0.7;
            const gy = (rng() - 0.5) * s * 0.5 * a;

            switch (gType) {
                case 0: {
                    // Heat vent/grille - dark with glow stripe
                    const ventW = s * (0.04 + rng() * 0.04);
                    const ventH = s * (0.02 + rng() * 0.02);
                    const ventGeo = new THREE.PlaneGeometry(ventW, ventH);
                    const ventMat = new THREE.MeshBasicMaterial({
                        color: palette.dark, transparent: true, opacity: 0.45,
                    });
                    const vent = new THREE.Mesh(ventGeo, ventMat);
                    vent.position.set(gx, gy, 0.04);
                    vent.renderOrder = 3;
                    group.add(vent);
                    // Vent glow line
                    const glowGeo = new THREE.PlaneGeometry(ventW * 0.8, ventH * 0.15);
                    const glowMat = new THREE.MeshBasicMaterial({
                        color: pc.glow, transparent: true, opacity: 0.2,
                    });
                    const glow = new THREE.Mesh(glowGeo, glowMat);
                    glow.position.set(gx, gy, 0.042);
                    glow.renderOrder = 3;
                    group.add(glow);
                    break;
                }
                case 1: {
                    // Access port - with indicator light
                    const portGeo = new THREE.CircleGeometry(s * 0.015, 6);
                    const portMat = new THREE.MeshBasicMaterial({
                        color: cc.hatch, transparent: true, opacity: 0.45,
                    });
                    const port = new THREE.Mesh(portGeo, portMat);
                    port.position.set(gx, gy, 0.04);
                    port.renderOrder = 3;
                    group.add(port);
                    // Status LED
                    const ledGeo = new THREE.CircleGeometry(s * 0.005, 4);
                    const ledMat = new THREE.MeshBasicMaterial({
                        color: rng() > 0.5 ? 0x44ff44 : 0xff4444,
                        transparent: true, opacity: 0.5,
                    });
                    const led = new THREE.Mesh(ledGeo, ledMat);
                    led.position.set(gx + s * 0.02, gy, 0.042);
                    led.renderOrder = 3;
                    group.add(led);
                    break;
                }
                case 2: {
                    // Equipment module box
                    const boxGeo = new THREE.PlaneGeometry(s * 0.035, s * 0.025);
                    const boxMat = new THREE.MeshBasicMaterial({
                        color: cc.container, transparent: true, opacity: 0.38,
                    });
                    const box = new THREE.Mesh(boxGeo, boxMat);
                    box.position.set(gx, gy, 0.04);
                    box.rotation.z = rng() * 0.3;
                    box.renderOrder = 3;
                    group.add(box);
                    break;
                }
                case 3: {
                    // Power conduit line - purple glow
                    const pipePts = [
                        new THREE.Vector3(gx, gy, 0.04),
                        new THREE.Vector3(gx + (rng() - 0.5) * s * 0.08, gy + (rng() - 0.5) * s * 0.06, 0.04),
                    ];
                    const pipeGeo = new THREE.BufferGeometry().setFromPoints(pipePts);
                    const pipeMat = new THREE.LineBasicMaterial({
                        color: pc.conduit, transparent: true, opacity: 0.35,
                    });
                    const pipe = new THREE.Line(pipeGeo, pipeMat);
                    pipe.renderOrder = 3;
                    group.add(pipe);
                    break;
                }
                case 4: {
                    // Power node junction
                    const nodeGeo = new THREE.CircleGeometry(s * 0.01, 6);
                    const nodeMat = new THREE.MeshBasicMaterial({
                        color: pc.node, transparent: true, opacity: 0.35,
                    });
                    const node = new THREE.Mesh(nodeGeo, nodeMat);
                    node.position.set(gx, gy, 0.04);
                    node.renderOrder = 3;
                    group.add(node);
                    break;
                }
            }
        }
    }

    // =============================================
    // GLB MODEL LOADING (preserved from original)
    // =============================================

    /**
     * Get the model path for a ship, checking shipDatabase and CONFIG.SHIPS
     */
    getModelPath(shipId) {
        const dbConfig = SHIP_DATABASE[shipId];
        if (dbConfig?.modelPath) return dbConfig.modelPath;
        const cfgConfig = CONFIG.SHIPS?.[shipId];
        if (cfgConfig?.modelPath) return cfgConfig.modelPath;
        return null;
    }

    /**
     * Check if a GLB model is already loaded and cached for a ship
     */
    hasLoadedModel(shipId) {
        const path = this.getModelPath(shipId);
        return path && MODEL_CACHE[path]?.scene;
    }

    /**
     * Get a cached GLB model clone (sync - returns null if not loaded yet)
     */
    getCachedModel(shipId, targetSize) {
        const path = this.getModelPath(shipId);
        if (!path || !MODEL_CACHE[path]?.scene) return null;

        const clone = MODEL_CACHE[path].scene.clone();
        this.normalizeModelSize(clone, targetSize);
        this.applyOrientation(clone, path);
        return clone;
    }

    /**
     * Load a GLB model async. Returns a Promise that resolves to a THREE.Group clone.
     * Uses cache so repeated calls for the same path don't re-fetch.
     */
    loadModel(shipId, targetSize = 40) {
        const path = this.getModelPath(shipId);
        if (!path) return Promise.resolve(null);

        // Return cached clone immediately
        if (MODEL_CACHE[path]?.scene) {
            const clone = MODEL_CACHE[path].scene.clone();
            this.normalizeModelSize(clone, targetSize);
            this.applyOrientation(clone, path);
            return Promise.resolve(clone);
        }

        // Already loading - queue a callback
        if (MODEL_CACHE[path]?.loading) {
            return new Promise((resolve) => {
                MODEL_CACHE[path].callbacks.push((scene) => {
                    if (scene) {
                        const clone = scene.clone();
                        this.normalizeModelSize(clone, targetSize);
                        this.applyOrientation(clone, path);
                        resolve(clone);
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        // Start loading
        MODEL_CACHE[path] = { scene: null, loading: true, callbacks: [] };

        return new Promise((resolve) => {
            if (typeof THREE.GLTFLoader === 'undefined') {
                console.warn('[ShipMeshFactory] GLTFLoader not available');
                MODEL_CACHE[path].loading = false;
                resolve(null);
                return;
            }

            const loader = new THREE.GLTFLoader();
            loader.load(
                path,
                (gltf) => {
                    const scene = gltf.scene;

                    // Upgrade materials for visibility in space
                    scene.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.side = THREE.DoubleSide;
                            if (child.material.metalness !== undefined) {
                                child.material.metalness = Math.min(child.material.metalness, 0.6);
                                child.material.roughness = Math.max(child.material.roughness, 0.3);
                            }
                            // Add emissive glow based on base color so models are visible in dark space
                            if (child.material.color && child.material.emissive !== undefined) {
                                child.material.emissive = child.material.color.clone().multiplyScalar(0.3);
                                child.material.emissiveIntensity = 1.0;
                            }
                        }
                    });

                    MODEL_CACHE[path].scene = scene;
                    MODEL_CACHE[path].loading = false;

                    // Resolve this promise
                    const clone = scene.clone();
                    this.normalizeModelSize(clone, targetSize);
                    this.applyOrientation(clone, path);
                    resolve(clone);

                    // Resolve queued callbacks
                    for (const cb of MODEL_CACHE[path].callbacks) {
                        cb(scene);
                    }
                    MODEL_CACHE[path].callbacks = [];
                },
                undefined,
                (error) => {
                    console.warn(`[ShipMeshFactory] Failed to load ${path}:`, error);
                    MODEL_CACHE[path].loading = false;
                    resolve(null);
                    for (const cb of MODEL_CACHE[path].callbacks) {
                        cb(null);
                    }
                    MODEL_CACHE[path].callbacks = [];
                }
            );
        });
    }

    /**
     * Normalize a loaded model to fit within targetSize units.
     * Centers the model and scales uniformly.
     */
    normalizeModelSize(group, targetSize) {
        const box = new THREE.Box3().setFromObject(group);

        // Center the model by offsetting children (not group.position)
        const center = new THREE.Vector3();
        box.getCenter(center);
        group.children.forEach(child => {
            child.position.sub(center);
        });

        // Scale to target size
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scale = targetSize / maxDim;
            group.scale.multiplyScalar(scale);
        }
    }

    /**
     * Generate mesh with GLB if available (async), falls back to procedural.
     */
    async generateShipMeshAsync(config) {
        const { shipId, role, size, detailLevel = 'low' } = config;
        const targetSize = detailLevel === 'high' ? 50 : 30;

        // Try GLB first
        const glbMesh = await this.loadModel(shipId, targetSize);
        if (glbMesh) return glbMesh;

        // Fallback to procedural
        return this.generateShipMesh(config);
    }

    // =============================================
    // ORIENTATION STORAGE & APPLICATION
    // =============================================

    getModelOrientation(path) {
        try {
            const data = JSON.parse(localStorage.getItem('glb-orientations') || '{}');
            return data[path] || null;
        } catch {
            return null;
        }
    }

    saveModelOrientation(path, orientation) {
        try {
            const data = JSON.parse(localStorage.getItem('glb-orientations') || '{}');
            data[path] = orientation;
            localStorage.setItem('glb-orientations', JSON.stringify(data));
        } catch (e) {
            console.warn('[ShipMeshFactory] Failed to save orientation:', e);
        }
    }

    applyOrientation(group, path) {
        const orientation = this.getModelOrientation(path);
        if (!orientation) return group;

        const wrapper = new THREE.Group();
        wrapper.name = 'orientation-wrapper';

        while (group.children.length > 0) {
            wrapper.add(group.children[0]);
        }

        wrapper.rotation.x = (orientation.rx || 0) * Math.PI / 180;
        wrapper.rotation.y = (orientation.ry || 0) * Math.PI / 180;
        wrapper.rotation.z = (orientation.rz || 0) * Math.PI / 180;
        if (orientation.scale && orientation.scale !== 1) {
            wrapper.scale.multiplyScalar(orientation.scale);
        }

        group.add(wrapper);
        return group;
    }

    /**
     * Load a GLB model by path directly (for the model editor).
     * Does NOT apply saved orientation (editor shows raw model).
     */
    loadModelByPath(path, targetSize = 40) {
        if (!path) return Promise.resolve(null);

        if (MODEL_CACHE[path]?.scene) {
            const clone = MODEL_CACHE[path].scene.clone();
            this.normalizeModelSize(clone, targetSize);
            return Promise.resolve(clone);
        }

        if (MODEL_CACHE[path]?.loading) {
            return new Promise((resolve) => {
                MODEL_CACHE[path].callbacks.push((scene) => {
                    if (scene) {
                        const clone = scene.clone();
                        this.normalizeModelSize(clone, targetSize);
                        resolve(clone);
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        MODEL_CACHE[path] = { scene: null, loading: true, callbacks: [] };

        return new Promise((resolve) => {
            if (typeof THREE.GLTFLoader === 'undefined') {
                console.warn('[ShipMeshFactory] GLTFLoader not available');
                MODEL_CACHE[path].loading = false;
                resolve(null);
                return;
            }

            const loader = new THREE.GLTFLoader();
            loader.load(
                path,
                (gltf) => {
                    const scene = gltf.scene;
                    scene.traverse((child) => {
                        if (child.isMesh && child.material) {
                            child.material.side = THREE.DoubleSide;
                            if (child.material.metalness !== undefined) {
                                child.material.metalness = Math.min(child.material.metalness, 0.8);
                                child.material.roughness = Math.max(child.material.roughness, 0.2);
                            }
                        }
                    });

                    MODEL_CACHE[path].scene = scene;
                    MODEL_CACHE[path].loading = false;

                    const clone = scene.clone();
                    this.normalizeModelSize(clone, targetSize);
                    resolve(clone);

                    for (const cb of MODEL_CACHE[path].callbacks) {
                        cb(scene);
                    }
                    MODEL_CACHE[path].callbacks = [];
                },
                undefined,
                (error) => {
                    console.warn(`[ShipMeshFactory] Failed to load ${path}:`, error);
                    MODEL_CACHE[path].loading = false;
                    resolve(null);
                    for (const cb of MODEL_CACHE[path].callbacks) {
                        cb(null);
                    }
                    MODEL_CACHE[path].callbacks = [];
                }
            );
        });
    }

    // =============================================
    // FACTION DECALS
    // =============================================

    /**
     * Add faction logo decals to both sides of the hull
     */
    addFactionDecal(group, sizeConfig, factionId) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const logo = FACTION_LOGOS[factionId];
        const decalSize = s * 0.12;
        const xPos = -s * 0.15;

        for (const side of [1, -1]) {
            const yPos = side * s * 0.22 * a;

            // Dark circular backing plate
            const backGeo = new THREE.CircleGeometry(decalSize * 1.2, 16);
            const backMat = new THREE.MeshBasicMaterial({
                color: 0x111111, transparent: true, opacity: 0.5,
            });
            const back = new THREE.Mesh(backGeo, backMat);
            back.position.set(xPos, yPos, 0.048);
            back.renderOrder = 4;
            group.add(back);

            // Faction-colored border ring
            const ringGeo = new THREE.RingGeometry(decalSize * 1.05, decalSize * 1.2, 24);
            const ringMat = new THREE.MeshBasicMaterial({
                color: logo.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(xPos, yPos, 0.049);
            ring.renderOrder = 4;
            group.add(ring);

            // Logo geometry
            this.drawFactionLogo(group, xPos, yPos, decalSize, factionId);

            // Subtle glow halo
            const glowGeo = new THREE.CircleGeometry(decalSize * 1.6, 16);
            const glowMat = new THREE.MeshBasicMaterial({
                color: logo.glow, transparent: true, opacity: 0.08,
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(xPos, yPos, 0.047);
            glow.renderOrder = 4;
            group.add(glow);
        }
    }

    /**
     * Draw faction-specific logo shapes
     */
    drawFactionLogo(group, x, y, size, factionId) {
        const logo = FACTION_LOGOS[factionId];
        const mat = new THREE.MeshBasicMaterial({
            color: logo.color, transparent: true, opacity: 0.85,
        });
        const z = 0.050;

        switch (factionId) {
            case 'ore-extraction-syndicate': {
                // Crossed pickaxes: two diagonal lines with diamond heads
                const lineW = size * 0.08;
                const lineL = size * 1.4;
                for (const angle of [Math.PI / 4, -Math.PI / 4]) {
                    const lineGeo = new THREE.PlaneGeometry(lineL, lineW);
                    const line = new THREE.Mesh(lineGeo, mat);
                    line.position.set(x, y, z);
                    line.rotation.z = angle;
                    line.renderOrder = 5;
                    group.add(line);
                }
                // Diamond heads at upper tips
                for (const dir of [1, -1]) {
                    const headShape = new THREE.Shape();
                    const hs = size * 0.2;
                    headShape.moveTo(0, hs);
                    headShape.lineTo(hs * 0.6, 0);
                    headShape.lineTo(0, -hs);
                    headShape.lineTo(-hs * 0.6, 0);
                    headShape.closePath();
                    const headGeo = new THREE.ShapeGeometry(headShape);
                    const head = new THREE.Mesh(headGeo, mat);
                    const tipX = x + Math.cos(dir * Math.PI / 4) * lineL * 0.45;
                    const tipY = y + Math.sin(dir * Math.PI / 4) * lineL * 0.45;
                    head.position.set(tipX, tipY, z);
                    head.rotation.z = dir * Math.PI / 4;
                    head.renderOrder = 5;
                    group.add(head);
                }
                break;
            }
            case 'stellar-logistics': {
                // Trade diamond: rotated square with arrow wings
                const dShape = new THREE.Shape();
                const ds = size * 0.55;
                dShape.moveTo(0, ds);
                dShape.lineTo(ds, 0);
                dShape.lineTo(0, -ds);
                dShape.lineTo(-ds, 0);
                dShape.closePath();
                const dGeo = new THREE.ShapeGeometry(dShape);
                const diamond = new THREE.Mesh(dGeo, mat);
                diamond.position.set(x, y, z);
                diamond.renderOrder = 5;
                group.add(diamond);
                // Arrow wings extending left/right
                for (const dir of [1, -1]) {
                    const wingShape = new THREE.Shape();
                    const ws = size * 0.3;
                    wingShape.moveTo(0, 0);
                    wingShape.lineTo(dir * ws * 1.5, 0);
                    wingShape.lineTo(dir * ws * 1.0, ws * 0.25);
                    wingShape.lineTo(dir * ws * 0.3, ws * 0.08);
                    wingShape.closePath();
                    const wingGeo = new THREE.ShapeGeometry(wingShape);
                    const wing = new THREE.Mesh(wingGeo, mat);
                    wing.position.set(x, y, z);
                    wing.renderOrder = 5;
                    group.add(wing);
                }
                break;
            }
            case 'void-hunters': {
                // Targeting reticle: circle with 4 crosshair lines + center dot
                const reticleGeo = new THREE.RingGeometry(size * 0.5, size * 0.6, 24);
                const reticle = new THREE.Mesh(reticleGeo, mat);
                reticle.position.set(x, y, z);
                reticle.renderOrder = 5;
                group.add(reticle);
                // 4 crosshair lines pointing inward with gap
                for (let i = 0; i < 4; i++) {
                    const angle = i * Math.PI / 2;
                    const lineGeo = new THREE.PlaneGeometry(size * 0.35, size * 0.06);
                    const line = new THREE.Mesh(lineGeo, mat);
                    const dist = size * 0.72;
                    line.position.set(
                        x + Math.cos(angle) * dist,
                        y + Math.sin(angle) * dist,
                        z
                    );
                    line.rotation.z = angle;
                    line.renderOrder = 5;
                    group.add(line);
                }
                // Bright center dot
                const dotGeo = new THREE.CircleGeometry(size * 0.12, 8);
                const dotMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.9,
                });
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.position.set(x, y, z + 0.001);
                dot.renderOrder = 5;
                group.add(dot);
                break;
            }
            case 'frontier-alliance': {
                // 5-pointed star
                const starShape = new THREE.Shape();
                const outerR = size * 0.7;
                const innerR = size * 0.3;
                for (let i = 0; i < 5; i++) {
                    const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                    const innerAngle = outerAngle + Math.PI / 5;
                    const ox = Math.cos(outerAngle) * outerR;
                    const oy = Math.sin(outerAngle) * outerR;
                    const ix = Math.cos(innerAngle) * innerR;
                    const iy = Math.sin(innerAngle) * innerR;
                    if (i === 0) starShape.moveTo(ox, oy);
                    else starShape.lineTo(ox, oy);
                    starShape.lineTo(ix, iy);
                }
                starShape.closePath();
                const starGeo = new THREE.ShapeGeometry(starShape);
                const star = new THREE.Mesh(starGeo, mat);
                star.position.set(x, y, z);
                star.renderOrder = 5;
                group.add(star);
                break;
            }
            case 'shadow-cartel': {
                // Death mark: X-cross with center circle + two eye dots
                const lineW = size * 0.1;
                const lineL = size * 1.2;
                for (const angle of [Math.PI / 4, -Math.PI / 4]) {
                    const lineGeo = new THREE.PlaneGeometry(lineL, lineW);
                    const line = new THREE.Mesh(lineGeo, mat);
                    line.position.set(x, y, z);
                    line.rotation.z = angle;
                    line.renderOrder = 5;
                    group.add(line);
                }
                // Center circle
                const circGeo = new THREE.RingGeometry(size * 0.22, size * 0.32, 16);
                const circ = new THREE.Mesh(circGeo, mat);
                circ.position.set(x, y, z + 0.001);
                circ.renderOrder = 5;
                group.add(circ);
                // Two "eye" dots above center
                for (const dir of [-1, 1]) {
                    const eyeGeo = new THREE.CircleGeometry(size * 0.09, 8);
                    const eyeMat = new THREE.MeshBasicMaterial({
                        color: 0xff4466, transparent: true, opacity: 0.9,
                    });
                    const eye = new THREE.Mesh(eyeGeo, eyeMat);
                    eye.position.set(x + dir * size * 0.2, y + size * 0.25, z + 0.001);
                    eye.renderOrder = 5;
                    group.add(eye);
                }
                break;
            }
        }
    }

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    createSeededRNG(seed) {
        let state = seed;
        return function () {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    }

    /**
     * Interpolate between two colors
     */
    lerpColor(colorA, colorB, t) {
        const a = typeof colorA === 'number' ? new THREE.Color(colorA) : colorA;
        const b = typeof colorB === 'number' ? new THREE.Color(colorB) : colorB;
        const r = a.r + (b.r - a.r) * t;
        const g = a.g + (b.g - a.g) * t;
        const bl = a.b + (b.b - a.b) * t;
        return new THREE.Color(r, g, bl).getHex();
    }
}

// Export singleton
export const shipMeshFactory = new ShipMeshFactory();
