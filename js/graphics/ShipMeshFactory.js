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
        this.addLightHalos(group, sizeConfig, palette);
        this.addPanelGreebles(group, sizeConfig, rng, palette, role);

        // Enhanced visual detail layers
        this.addArmorPlates(group, sizeConfig, rng, palette);
        this.addHullTrim(group, sizeConfig, palette, role);
        this.addHullRibbing(group, sizeConfig, rng, palette);
        this.addWindowRows(group, sizeConfig, rng, palette);
        this.addAntennaArrays(group, sizeConfig, rng, palette);
        this.addPowerConduits(group, sizeConfig, rng, palette);
        this.addDockingClamps(group, sizeConfig, rng, palette);

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
            surveyor: this.addSurveyorDetails,
            logistics: this.addLogisticsDetails,
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

    addSurveyorDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const sc = SUBSYSTEM_COLORS.sensor;

        // Large forward sensor array (the defining feature of surveyors)
        const mainDishSize = s * 0.18;
        this.addSensorDish(group, s * 0.35, 0, mainDishSize, palette);

        // Secondary sensor arrays (flanking)
        this.addSensorDish(group, s * 0.1, s * 0.32 * a, s * 0.1, palette);
        this.addSensorDish(group, s * 0.1, -s * 0.32 * a, s * 0.1, palette);

        // Probe launcher bay (rear-dorsal)
        if (sizeConfig.complexity >= 1.5) {
            const bayGeo = new THREE.PlaneGeometry(s * 0.15, s * 0.1);
            const bayMat = new THREE.MeshBasicMaterial({
                color: sc.dish, transparent: true, opacity: 0.5,
            });
            const bay = new THREE.Mesh(bayGeo, bayMat);
            bay.position.set(-s * 0.2, 0, 0.04);
            bay.renderOrder = 3;
            group.add(bay);

            // Probe tube indicators
            for (let i = -1; i <= 1; i++) {
                const tGeo = new THREE.CircleGeometry(s * 0.015, 5);
                const tMat = new THREE.MeshBasicMaterial({
                    color: sc.receiver, transparent: true, opacity: 0.65,
                });
                const tube = new THREE.Mesh(tGeo, tMat);
                tube.position.set(-s * 0.2, i * s * 0.03, 0.05);
                tube.renderOrder = 4;
                group.add(tube);
            }
        }

        // Extended antenna arrays (multiple thin sensor antennae)
        const antennaCount = Math.floor(sizeConfig.complexity) + 2;
        for (let i = 0; i < antennaCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const offset = Math.floor(i / 2) * s * 0.12;
            this.addAntenna(group, -s * 0.15 - offset, side * s * (0.35 + offset * 0.3) * a, s * 0.3 * a, palette, rng);
        }

        // Scan line emitter strips (glowing green lines along hull)
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? 1 : -1;
            const stripGeo = new THREE.PlaneGeometry(s * 0.6, s * 0.01);
            const stripMat = new THREE.MeshBasicMaterial({
                color: sc.scan, transparent: true, opacity: 0.35,
            });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.set(s * 0.05, side * s * 0.18 * a, 0.06);
            strip.renderOrder = 5;
            group.add(strip);
        }

        // Small weapon mount (surveyors have few weapons)
        this.addTurretMount(group, s * 0.2, 0, s * 0.05, palette.accent, detailLevel);

        // Drone bay (scouts rely on drones)
        this.addDroneBay(group, -s * 0.35, 0, s * 0.1, palette);

        // Fast engines (surveyors are quick)
        this.addEngineNacelles(group, s, [
            { x: -s * 0.58, y: s * 0.15 * a },
            { x: -s * 0.58, y: -s * 0.15 * a },
        ], palette, detailLevel, speedFactor);

        if (sizeConfig.complexity >= 2) {
            this.addSmallThruster(group, -s * 0.5, s * 0.3 * a, palette);
            this.addSmallThruster(group, -s * 0.5, -s * 0.3 * a, palette);
        }

        // Cockpit (forward, prominent sensor-linked)
        this.addCockpit(group, s * 0.5, 0, s * 0.1, palette.accent, detailLevel);
    }

    addLogisticsDetails(group, sizeConfig, rng, detailLevel, palette, speedFactor = 1.0) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const shc = SUBSYSTEM_COLORS.shield;

        // Remote repair projector arms (the defining feature - extending outward)
        for (let side = -1; side <= 1; side += 2) {
            // Repair arm structure
            const armGeo = new THREE.PlaneGeometry(s * 0.03, s * 0.45 * a);
            const armMat = new THREE.MeshBasicMaterial({
                color: palette.secondary, transparent: true, opacity: 0.6,
            });
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.position.set(s * 0.05, side * s * 0.35 * a, 0.04);
            arm.renderOrder = 3;
            group.add(arm);

            // Repair emitter at arm tip
            const emitGeo = new THREE.CircleGeometry(s * 0.06, 8);
            const emitMat = new THREE.MeshBasicMaterial({
                color: shc.glow, transparent: true, opacity: 0.7,
            });
            const emitter = new THREE.Mesh(emitGeo, emitMat);
            emitter.position.set(s * 0.05, side * s * 0.55 * a, 0.05);
            emitter.renderOrder = 4;
            group.add(emitter);

            // Emitter ring
            const ringGeo = new THREE.RingGeometry(s * 0.06, s * 0.08, 8);
            const ringMat = new THREE.MeshBasicMaterial({
                color: shc.pulse, transparent: true, opacity: 0.3,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(s * 0.05, side * s * 0.55 * a, 0.052);
            ring.renderOrder = 4;
            group.add(ring);

            // Emitter glow halo
            const haloGeo = new THREE.CircleGeometry(s * 0.1, 10);
            const haloMat = new THREE.MeshBasicMaterial({
                color: shc.glow, transparent: true, opacity: 0.1,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.position.set(s * 0.05, side * s * 0.55 * a, 0.048);
            halo.renderOrder = 3;
            group.add(halo);
        }

        // Additional repair emitters for larger ships
        if (sizeConfig.complexity >= 2) {
            for (let side = -1; side <= 1; side += 2) {
                const emitGeo = new THREE.CircleGeometry(s * 0.05, 8);
                const emitMat = new THREE.MeshBasicMaterial({
                    color: shc.pulse, transparent: true, opacity: 0.6,
                });
                const emitter = new THREE.Mesh(emitGeo, emitMat);
                emitter.position.set(-s * 0.15, side * s * 0.42 * a, 0.05);
                emitter.renderOrder = 4;
                group.add(emitter);
            }
        }

        // Capacitor transfer links (energy conduits visible on hull)
        const pc = SUBSYSTEM_COLORS.power;
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? 1 : -1;
            const conduitPts = [
                new THREE.Vector3(-s * 0.3, side * s * 0.08 * a, 0.045),
                new THREE.Vector3(-s * 0.1, side * s * 0.15 * a, 0.045),
                new THREE.Vector3(s * 0.05, side * s * 0.35 * a, 0.045),
            ];
            const conduitGeo = new THREE.BufferGeometry().setFromPoints(conduitPts);
            const conduitMat = new THREE.LineBasicMaterial({
                color: pc.glow, transparent: true, opacity: 0.35,
            });
            const conduit = new THREE.Line(conduitGeo, conduitMat);
            conduit.renderOrder = 3;
            group.add(conduit);

            // Energy nodes along conduit
            for (const pt of conduitPts) {
                const nodeGeo = new THREE.CircleGeometry(s * 0.012, 6);
                const nodeMat = new THREE.MeshBasicMaterial({
                    color: pc.pulse, transparent: true, opacity: 0.4,
                });
                const node = new THREE.Mesh(nodeGeo, nodeMat);
                node.position.set(pt.x, pt.y, 0.048);
                node.renderOrder = 3;
                group.add(node);
            }
        }

        // Shield generator (logistics ships have strong personal defenses)
        const sgGeo = new THREE.CircleGeometry(s * 0.07, 8);
        const sgMat = new THREE.MeshBasicMaterial({
            color: shc.emitter, transparent: true, opacity: 0.5,
        });
        const sg = new THREE.Mesh(sgGeo, sgMat);
        sg.position.set(-s * 0.2, 0, 0.05);
        sg.renderOrder = 4;
        group.add(sg);

        const sgRingGeo = new THREE.RingGeometry(s * 0.07, s * 0.09, 10);
        const sgRingMat = new THREE.MeshBasicMaterial({
            color: shc.glow, transparent: true, opacity: 0.25,
        });
        const sgRing = new THREE.Mesh(sgRingGeo, sgRingMat);
        sgRing.position.set(-s * 0.2, 0, 0.052);
        sgRing.renderOrder = 4;
        group.add(sgRing);

        // Small defensive turret
        this.addTurretMount(group, s * 0.2, 0, s * 0.05, palette.accent, detailLevel);

        // Drone bay
        this.addDroneBay(group, -s * 0.35, 0, s * 0.1, palette);

        // Engines (moderate - logistics aren't fast but need to keep up)
        this.addEngineNacelles(group, s, [
            { x: -s * 0.52, y: s * 0.15 * a },
            { x: -s * 0.52, y: -s * 0.15 * a },
        ], palette, detailLevel, speedFactor);

        // Cockpit
        this.addCockpit(group, s * 0.28, 0, s * 0.1, palette.accent, detailLevel);

        // Comm antenna
        this.addAntenna(group, -s * 0.35, s * 0.22 * a, s * 0.2, palette, rng);
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

            // Inner vane structure (cross-shaped engine internals)
            const vaneMat = new THREE.MeshBasicMaterial({
                color: ec.housing, transparent: true, opacity: 0.35,
            });
            for (let v = 0; v < 4; v++) {
                const angle = (v / 4) * Math.PI;
                const vaneLen = nacSize * 0.55;
                const vaneGeo = new THREE.PlaneGeometry(vaneLen, nacSize * 0.04);
                const vane = new THREE.Mesh(vaneGeo, vaneMat);
                vane.position.set(pos.x, pos.y, 0.028);
                vane.rotation.z = angle;
                vane.renderOrder = 2;
                group.add(vane);
            }

            // Heat distortion ring (subtle outer shimmer)
            const heatGeo = new THREE.RingGeometry(nacSize * 1.05, nacSize * 1.15, 16);
            const heatMat = new THREE.MeshBasicMaterial({
                color: ec.boost, transparent: true, opacity: 0.08 + speedFactor * 0.04,
            });
            const heat = new THREE.Mesh(heatGeo, heatMat);
            heat.position.set(pos.x, pos.y, 0.015);
            heat.renderOrder = 1;
            group.add(heat);
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

        // Canopy reflection highlight (elongated ellipse offset for specular look)
        const reflGeo = new THREE.PlaneGeometry(size * 0.9, size * 0.3);
        const reflMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.12,
        });
        const refl = new THREE.Mesh(reflGeo, reflMat);
        refl.position.set(x + size * 0.15, y - size * 0.2, 0.078);
        refl.rotation.z = -0.3;
        refl.renderOrder = 7;
        group.add(refl);

        // Instrument panel glow (dim colored bar below center)
        const instrGeo = new THREE.PlaneGeometry(size * 0.6, size * 0.12);
        const instrMat = new THREE.MeshBasicMaterial({
            color: cc.glow, transparent: true, opacity: 0.25,
        });
        const instr = new THREE.Mesh(instrGeo, instrMat);
        instr.position.set(x - size * 0.1, y, 0.072);
        instr.renderOrder = 6;
        group.add(instr);
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
    // ENHANCED VISUAL DETAIL COMPONENTS
    // =============================================

    /**
     * Add illuminated window rows along the hull.
     * Scales with ship size - frigates get a few, capitals get dense rows.
     */
    addWindowRows(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const complexity = sizeConfig.complexity || 1;

        // Window count scales with ship size
        const rowCount = Math.floor(complexity * 1.5) + 1;
        const windowColor = 0xaaddff;
        const windowMat = new THREE.MeshBasicMaterial({
            color: windowColor, transparent: true, opacity: 0.55,
        });
        const frameMat = new THREE.MeshBasicMaterial({
            color: palette.dark, transparent: true, opacity: 0.4,
        });

        for (let row = 0; row < rowCount; row++) {
            const yBand = (row / rowCount - 0.5) * s * 0.55 * a;
            const windowsInRow = Math.floor(3 + complexity * 2 + rng() * 3);
            const startX = -s * 0.3 + rng() * s * 0.05;
            const endX = s * 0.2 + rng() * s * 0.1;
            const span = endX - startX;

            for (let w = 0; w < windowsInRow; w++) {
                const t = w / windowsInRow;
                const wx = startX + t * span;
                const wy = yBand + (rng() - 0.5) * s * 0.03;
                const ww = s * (0.012 + rng() * 0.008);
                const wh = s * (0.006 + rng() * 0.004);

                // Window frame (dark border)
                const fGeo = new THREE.PlaneGeometry(ww * 1.4, wh * 1.6);
                const frame = new THREE.Mesh(fGeo, frameMat);
                frame.position.set(wx, wy, 0.045);
                frame.renderOrder = 3;
                group.add(frame);

                // Lit window
                const wGeo = new THREE.PlaneGeometry(ww, wh);
                const win = new THREE.Mesh(wGeo, windowMat);
                win.position.set(wx, wy, 0.048);
                win.renderOrder = 4;
                group.add(win);
            }
        }
    }

    /**
     * Add hull armor plate overlays with subtle color variation.
     * Creates a layered, armored look.
     */
    addArmorPlates(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const complexity = sizeConfig.complexity || 1;
        const plateCount = Math.floor(2 + complexity * 2);

        for (let i = 0; i < plateCount; i++) {
            const px = (rng() - 0.3) * s * 0.7;
            const py = (rng() - 0.5) * s * 0.6 * a;
            const pw = s * (0.1 + rng() * 0.15);
            const ph = s * (0.05 + rng() * 0.08) * a;

            // Plate - slightly lighter/darker than hull
            const shade = rng() > 0.5 ? palette.secondary : palette.dark;
            const plateGeo = new THREE.PlaneGeometry(pw, ph);
            const plateMat = new THREE.MeshBasicMaterial({
                color: shade, transparent: true, opacity: 0.15 + rng() * 0.1,
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            plate.position.set(px, py, 0.015);
            plate.rotation.z = (rng() - 0.5) * 0.1;
            plate.renderOrder = 1;
            group.add(plate);

            // Plate edge highlight (top edge)
            const edgeGeo = new THREE.PlaneGeometry(pw, ph * 0.06);
            const edgeMat = new THREE.MeshBasicMaterial({
                color: palette.trim, transparent: true, opacity: 0.15,
            });
            const edge = new THREE.Mesh(edgeGeo, edgeMat);
            edge.position.set(px, py + ph * 0.47, 0.018);
            edge.rotation.z = plate.rotation.z;
            edge.renderOrder = 1;
            group.add(edge);
        }
    }

    /**
     * Add antenna/mast arrays extending from hull.
     * Line geometry - virtually free performance cost.
     */
    addAntennaArrays(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const complexity = sizeConfig.complexity || 1;
        const antennaCount = Math.floor(1 + complexity);

        const antennaMat = new THREE.LineBasicMaterial({
            color: palette.trim, transparent: true, opacity: 0.5,
        });
        const tipMat = new THREE.MeshBasicMaterial({
            color: palette.glow, transparent: true, opacity: 0.6,
        });

        for (let i = 0; i < antennaCount; i++) {
            const ax = (rng() - 0.2) * s * 0.5;
            const side = i % 2 === 0 ? 1 : -1;
            const ay = side * s * (0.35 + rng() * 0.15) * a;
            const length = s * (0.08 + rng() * 0.06);

            // Antenna mast line
            const pts = [
                new THREE.Vector3(ax, ay, 0.06),
                new THREE.Vector3(ax + (rng() - 0.5) * s * 0.02, ay + side * length, 0.06),
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(lineGeo, antennaMat);
            line.renderOrder = 5;
            group.add(line);

            // Antenna tip light
            const tipGeo = new THREE.CircleGeometry(s * 0.006, 4);
            const tip = new THREE.Mesh(tipGeo, tipMat);
            tip.position.copy(pts[1]);
            tip.renderOrder = 6;
            group.add(tip);
        }
    }

    /**
     * Add glow halos around running lights for bloom-like effect.
     */
    addLightHalos(group, sizeConfig, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const haloSize = Math.max(3, s * 0.05);

        // Port halo (red)
        const portHaloGeo = new THREE.CircleGeometry(haloSize, 8);
        const portHaloMat = new THREE.MeshBasicMaterial({
            color: 0xff2200, transparent: true, opacity: 0.12,
        });
        const portHalo = new THREE.Mesh(portHaloGeo, portHaloMat);
        portHalo.position.set(-s * 0.1, s * 0.45 * a, 0.065);
        portHalo.renderOrder = 5;
        group.add(portHalo);

        // Starboard halo (green)
        const stbdHaloGeo = new THREE.CircleGeometry(haloSize, 8);
        const stbdHaloMat = new THREE.MeshBasicMaterial({
            color: 0x00ff22, transparent: true, opacity: 0.12,
        });
        const stbdHalo = new THREE.Mesh(stbdHaloGeo, stbdHaloMat);
        stbdHalo.position.set(-s * 0.1, -s * 0.45 * a, 0.065);
        stbdHalo.renderOrder = 5;
        group.add(stbdHalo);

        // Forward strobe halo
        const fwdHaloGeo = new THREE.CircleGeometry(haloSize * 0.8, 8);
        const fwdHaloMat = new THREE.MeshBasicMaterial({
            color: palette.glow, transparent: true, opacity: 0.1,
        });
        const fwdHalo = new THREE.Mesh(fwdHaloGeo, fwdHaloMat);
        fwdHalo.position.set(s * 0.5, 0, 0.065);
        fwdHalo.renderOrder = 5;
        group.add(fwdHalo);
    }

    /**
     * Add hull edge trim - bright accent lines along the hull perimeter.
     * Uses the hull shape to trace an accent edge line.
     */
    addHullTrim(group, sizeConfig, palette, role) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;

        // Simple perimeter accent - two lateral trim strips
        const trimMat = new THREE.MeshBasicMaterial({
            color: palette.accent, transparent: true, opacity: 0.2,
        });

        // Port trim
        const portTrimGeo = new THREE.PlaneGeometry(s * 0.9, s * 0.015);
        const portTrim = new THREE.Mesh(portTrimGeo, trimMat);
        portTrim.position.set(-s * 0.05, s * 0.38 * a, 0.042);
        portTrim.renderOrder = 3;
        group.add(portTrim);

        // Starboard trim
        const stbdTrim = new THREE.Mesh(portTrimGeo.clone(), trimMat);
        stbdTrim.position.set(-s * 0.05, -s * 0.38 * a, 0.042);
        stbdTrim.renderOrder = 3;
        group.add(stbdTrim);

        // Forward accent mark
        const fwdGeo = new THREE.PlaneGeometry(s * 0.03, s * 0.3 * a);
        const fwdTrim = new THREE.Mesh(fwdGeo, trimMat);
        fwdTrim.position.set(s * 0.35, 0, 0.042);
        fwdTrim.renderOrder = 3;
        group.add(fwdTrim);
    }

    /**
     * Add structural hull ribbing for larger ships.
     * Capitals get dense ribbing, frigates get minimal.
     */
    addHullRibbing(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const complexity = sizeConfig.complexity || 1;
        // Only add ribbing for destroyer+ ships
        if (complexity < 1.5) return;

        const ribCount = Math.floor(complexity * 2);
        const ribMat = new THREE.MeshBasicMaterial({
            color: palette.dark, transparent: true, opacity: 0.2,
        });

        for (let i = 0; i < ribCount; i++) {
            const t = (i + 1) / (ribCount + 1);
            const xPos = s * (0.3 - t * 0.8);
            const ribHeight = s * (0.6 + (1 - Math.abs(t - 0.5) * 2) * 0.3) * a;
            const ribGeo = new THREE.PlaneGeometry(s * 0.008, ribHeight);
            const rib = new THREE.Mesh(ribGeo, ribMat);
            rib.position.set(xPos, 0, 0.02);
            rib.renderOrder = 1;
            group.add(rib);
        }
    }

    /**
     * Add power conduit network lines along the hull.
     * Visual energy distribution lines with junction nodes.
     */
    addPowerConduits(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const complexity = sizeConfig.complexity || 1;
        const pc = SUBSYSTEM_COLORS.power;

        const conduitCount = Math.floor(1 + complexity);
        const lineMat = new THREE.LineBasicMaterial({
            color: pc.conduit, transparent: true, opacity: 0.25,
        });
        const nodeMat = new THREE.MeshBasicMaterial({
            color: pc.pulse, transparent: true, opacity: 0.3,
        });

        for (let i = 0; i < conduitCount; i++) {
            // Main conduit run from stern to bow
            const yOffset = (rng() - 0.5) * s * 0.3 * a;
            const segments = 3 + Math.floor(rng() * 3);
            const pts = [];
            for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                pts.push(new THREE.Vector3(
                    -s * 0.4 + t * s * 0.7,
                    yOffset + (rng() - 0.5) * s * 0.04,
                    0.038
                ));
            }
            const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
            const line = new THREE.Line(lineGeo, lineMat);
            line.renderOrder = 3;
            group.add(line);

            // Junction nodes along the conduit
            for (let j = 1; j < pts.length - 1; j++) {
                if (rng() > 0.5) continue;
                const nodeGeo = new THREE.CircleGeometry(s * 0.008, 4);
                const node = new THREE.Mesh(nodeGeo, nodeMat);
                node.position.copy(pts[j]);
                node.position.z = 0.04;
                node.renderOrder = 3;
                group.add(node);
            }
        }
    }

    /**
     * Add docking clamp indicators on larger ships.
     */
    addDockingClamps(group, sizeConfig, rng, palette) {
        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        if (sizeConfig.complexity < 2) return; // Cruiser+ only

        const clampCount = Math.floor(sizeConfig.complexity - 1);
        const clampMat = new THREE.MeshBasicMaterial({
            color: palette.secondary, transparent: true, opacity: 0.3,
        });
        const lightMat = new THREE.MeshBasicMaterial({
            color: 0x44ff88, transparent: true, opacity: 0.5,
        });

        for (let i = 0; i < clampCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const cx = -s * (0.15 + i * 0.08);
            const cy = side * s * 0.42 * a;

            // Clamp bracket (U-shape via two small rectangles)
            const bracketGeo = new THREE.PlaneGeometry(s * 0.04, s * 0.02);
            const bracket = new THREE.Mesh(bracketGeo, clampMat);
            bracket.position.set(cx, cy, 0.04);
            bracket.renderOrder = 3;
            group.add(bracket);

            // Docking status light
            const dLightGeo = new THREE.CircleGeometry(s * 0.006, 4);
            const dLight = new THREE.Mesh(dLightGeo, lightMat);
            dLight.position.set(cx, cy + side * s * 0.015, 0.045);
            dLight.renderOrder = 4;
            group.add(dLight);
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
        const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.frigate;
        const targetSize = detailLevel === 'high' ? 50 : 30;

        // Try GLB first
        const glbMesh = await this.loadModel(shipId, targetSize);
        if (glbMesh) return glbMesh;

        // Fallback to procedural + add preview turret hardpoints
        const mesh = this.generateShipMesh(config);
        this.addPreviewTurrets(mesh, sizeConfig, shipId, role);
        return mesh;
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

    // =============================================
    // PREVIEW TURRET HARDPOINTS
    // =============================================

    /**
     * Determine the default turret weapon type for a ship role.
     * Preview meshes don't have fitted modules, so we pick representative weapons.
     */
    _roleTurretTypes(role) {
        switch (role) {
            case 'mining':     return 'mining';
            case 'salvager':   return 'salvage';
            case 'harvester':  return 'harvest';
            case 'surveyor':   return 'utility';
            case 'logistics':  return 'utility';
            case 'hauler':     return 'laser';
            case 'mercenary':  return 'laser';
            case 'pirate':     return 'laser';
            case 'police':     return 'laser';
            case 'military':   return 'missile';
            default:           return 'laser';
        }
    }

    /**
     * Add weapon turret hardpoints to a preview mesh.
     * Uses SHIP_DATABASE to determine weapon count, and role for weapon type.
     */
    addPreviewTurrets(group, sizeConfig, shipId, role) {
        // Look up ship in database for weapon count
        const shipData = SHIP_DATABASE[shipId];
        const weaponCount = shipData?.weaponSlots || 0;
        if (weaponCount <= 0) return;

        const s = sizeConfig.radius;
        const a = sizeConfig.aspect || 0.5;
        const turretSize = Math.max(s * 0.025, 1.0);
        const primaryType = this._roleTurretTypes(role);

        for (let i = 0; i < Math.min(weaponCount, 8); i++) {
            // Distribute turrets from front to mid along hull
            const t = weaponCount === 1 ? 0.3 : (0.55 - (i / (weaponCount - 1)) * 0.7);
            const localX = s * t;
            // Alternate port/starboard, increasing lateral spread
            const localY = (i % 2 === 0 ? 1 : -1) * s * 0.2 * a * (1 + Math.floor(i / 2) * 0.3);

            // Military ships get mixed turrets (missiles + lasers)
            let type = primaryType;
            if (role === 'military' && i >= Math.ceil(weaponCount / 2)) type = 'laser';
            if (role === 'pirate' && weaponCount > 2 && i === weaponCount - 1) type = 'missile';

            const turret = this._buildPreviewTurret(type, turretSize);
            turret.position.set(localX, localY, Math.min(s * 0.04, 4) + 0.5);
            group.add(turret);
        }
    }

    /**
     * Build a turret mesh by weapon type for preview display.
     */
    _buildPreviewTurret(type, ts) {
        switch (type) {
            case 'missile':  return this._buildPreviewMissileTurret(ts);
            case 'mining':   return this._buildPreviewMiningTurret(ts);
            case 'salvage':  return this._buildPreviewSalvageTurret(ts);
            case 'harvest':  return this._buildPreviewHarvestTurret(ts);
            case 'utility':  return this._buildPreviewUtilityTurret(ts);
            default:         return this._buildPreviewLaserTurret(ts);
        }
    }

    /**
     * Laser turret: rotating base + twin energy emitter barrels + blue-white tip glow
     */
    _buildPreviewLaserTurret(ts) {
        const g = new THREE.Group();

        // Rotating base
        const baseGeo = new THREE.CylinderGeometry(ts * 0.9, ts * 1.1, ts * 0.5, 8);
        baseGeo.rotateX(Math.PI / 2);
        g.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
            color: 0x445566, emissive: 0x112233, emissiveIntensity: 0.1,
            roughness: 0.35, metalness: 0.65,
        })));

        // Twin barrel housing
        const housingGeo = new THREE.BoxGeometry(ts * 1.8, ts * 0.7, ts * 0.5);
        housingGeo.translate(ts * 0.8, 0, 0);
        g.add(new THREE.Mesh(housingGeo, new THREE.MeshStandardMaterial({
            color: 0x556677, emissive: 0x223344, emissiveIntensity: 0.08,
            roughness: 0.3, metalness: 0.7,
        })));

        // Twin emitter barrels
        for (let b = -1; b <= 1; b += 2) {
            const barrelGeo = new THREE.CylinderGeometry(ts * 0.1, ts * 0.12, ts * 2.5, 6);
            barrelGeo.rotateZ(Math.PI / 2);
            barrelGeo.translate(ts * 1.8, b * ts * 0.18, 0);
            g.add(new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({
                color: 0x8899aa, emissive: 0x334466, emissiveIntensity: 0.1,
                roughness: 0.2, metalness: 0.8,
            })));
        }

        // EM blue-white emitter tip
        const tipGeo = new THREE.SphereGeometry(ts * 0.18, 6, 4);
        tipGeo.translate(ts * 3.0, 0, 0);
        g.add(new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({
            color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 0.15,
            transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.2,
        })));

        g.userData.weaponType = 'laser';
        return g;
    }

    /**
     * Missile turret: box launcher rack with tube openings + orange warhead glow
     */
    _buildPreviewMissileTurret(ts) {
        const g = new THREE.Group();

        // Mounting platform
        const baseGeo = new THREE.BoxGeometry(ts * 1.2, ts * 1.0, ts * 0.4);
        baseGeo.translate(0, 0, ts * 0.1);
        g.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
            color: 0x554433, emissive: 0x221100, emissiveIntensity: 0.08,
            roughness: 0.5, metalness: 0.5,
        })));

        // Launcher rack body
        const rackGeo = new THREE.BoxGeometry(ts * 2.2, ts * 0.9, ts * 0.7);
        rackGeo.translate(ts * 0.9, 0, ts * 0.15);
        g.add(new THREE.Mesh(rackGeo, new THREE.MeshStandardMaterial({
            color: 0x665544, emissive: 0x332211, emissiveIntensity: 0.06,
            roughness: 0.6, metalness: 0.4,
        })));

        // 2x2 missile tube grid
        for (let row = -1; row <= 1; row += 2) {
            for (let col = -1; col <= 1; col += 2) {
                const tubeGeo = new THREE.CylinderGeometry(ts * 0.12, ts * 0.14, ts * 0.6, 6);
                tubeGeo.rotateZ(Math.PI / 2);
                tubeGeo.translate(ts * 2.0, row * ts * 0.2, col * ts * 0.15 + ts * 0.15);
                g.add(new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({
                    color: 0x332211, emissive: 0x110000, emissiveIntensity: 0.05,
                    roughness: 0.7, metalness: 0.3,
                })));
            }
        }

        // Orange warhead indicator
        const wGeo = new THREE.SphereGeometry(ts * 0.15, 4, 3);
        wGeo.translate(ts * 2.3, 0, ts * 0.15);
        g.add(new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({
            color: 0xff6622, emissive: 0xff4400, emissiveIntensity: 0.2,
            transparent: true, opacity: 0.75, roughness: 0.2, metalness: 0.1,
        })));

        g.userData.weaponType = 'missile';
        return g;
    }

    /**
     * Mining turret: heavy industrial base + articulated arm + green emitter
     */
    _buildPreviewMiningTurret(ts) {
        const g = new THREE.Group();

        // Industrial base
        const baseGeo = new THREE.CylinderGeometry(ts * 1.0, ts * 1.3, ts * 0.6, 6);
        baseGeo.rotateX(Math.PI / 2);
        g.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
            color: 0x5a6a30, emissive: 0x223311, emissiveIntensity: 0.08,
            roughness: 0.5, metalness: 0.4,
        })));

        // Articulated arm
        const armGeo = new THREE.BoxGeometry(ts * 2.0, ts * 0.4, ts * 0.4);
        armGeo.translate(ts * 0.8, 0, ts * 0.1);
        g.add(new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({
            color: 0x667744, emissive: 0x334422, emissiveIntensity: 0.06,
            roughness: 0.45, metalness: 0.55,
        })));

        // Emitter housing (wider cone end)
        const emitGeo = new THREE.CylinderGeometry(ts * 0.35, ts * 0.2, ts * 0.8, 6);
        emitGeo.rotateZ(Math.PI / 2);
        emitGeo.translate(ts * 2.2, 0, ts * 0.1);
        g.add(new THREE.Mesh(emitGeo, new THREE.MeshStandardMaterial({
            color: 0x88aa44, emissive: 0x44aa22, emissiveIntensity: 0.12,
            roughness: 0.3, metalness: 0.5,
        })));

        // Green emitter glow
        const tipGeo = new THREE.SphereGeometry(ts * 0.22, 6, 4);
        tipGeo.translate(ts * 2.7, 0, ts * 0.1);
        g.add(new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({
            color: 0x44ff66, emissive: 0x22ff44, emissiveIntensity: 0.25,
            transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1,
        })));

        g.userData.weaponType = 'mining';
        return g;
    }

    /**
     * Salvage turret: tractor beam with purple glow dish
     */
    _buildPreviewSalvageTurret(ts) {
        const g = new THREE.Group();

        // Compact base
        const baseGeo = new THREE.CylinderGeometry(ts * 0.7, ts * 0.9, ts * 0.4, 6);
        baseGeo.rotateX(Math.PI / 2);
        g.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
            color: 0x6a5540, emissive: 0x332a18, emissiveIntensity: 0.08,
            roughness: 0.5, metalness: 0.5,
        })));

        // Emitter arm
        const armGeo = new THREE.BoxGeometry(ts * 1.8, ts * 0.3, ts * 0.35);
        armGeo.translate(ts * 0.7, 0, 0);
        g.add(new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({
            color: 0x7a6550, emissive: 0x443322, emissiveIntensity: 0.06,
            roughness: 0.4, metalness: 0.6,
        })));

        // Tractor dish
        const dishGeo = new THREE.ConeGeometry(ts * 0.3, ts * 0.5, 8);
        dishGeo.rotateZ(-Math.PI / 2);
        dishGeo.translate(ts * 2.0, 0, 0);
        g.add(new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({
            color: 0x8866aa, emissive: 0x6644aa, emissiveIntensity: 0.15,
            roughness: 0.3, metalness: 0.4,
        })));

        // Purple emitter glow
        const tipGeo = new THREE.SphereGeometry(ts * 0.18, 6, 4);
        tipGeo.translate(ts * 2.3, 0, 0);
        g.add(new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({
            color: 0xaa66ff, emissive: 0x8844ee, emissiveIntensity: 0.3,
            transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1,
        })));

        g.userData.weaponType = 'salvage';
        return g;
    }

    /**
     * Harvest turret: scoop intake with teal glow
     */
    _buildPreviewHarvestTurret(ts) {
        const g = new THREE.Group();

        // Base mount
        const baseGeo = new THREE.CylinderGeometry(ts * 0.8, ts * 1.0, ts * 0.5, 6);
        baseGeo.rotateX(Math.PI / 2);
        g.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
            color: 0x306650, emissive: 0x1a3322, emissiveIntensity: 0.08,
            roughness: 0.45, metalness: 0.45,
        })));

        // Scoop arm
        const armGeo = new THREE.BoxGeometry(ts * 1.6, ts * 0.5, ts * 0.35);
        armGeo.translate(ts * 0.6, 0, 0);
        g.add(new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({
            color: 0x44aa77, emissive: 0x226644, emissiveIntensity: 0.06,
            roughness: 0.4, metalness: 0.5,
        })));

        // Scoop cone intake
        const scoopGeo = new THREE.ConeGeometry(ts * 0.35, ts * 0.7, 8);
        scoopGeo.rotateZ(-Math.PI / 2);
        scoopGeo.translate(ts * 1.8, 0, 0);
        g.add(new THREE.Mesh(scoopGeo, new THREE.MeshStandardMaterial({
            color: 0x55eeaa, emissive: 0x33cc88, emissiveIntensity: 0.12,
            roughness: 0.3, metalness: 0.4,
        })));

        // Teal intake glow
        const tipGeo = new THREE.SphereGeometry(ts * 0.2, 6, 4);
        tipGeo.translate(ts * 2.2, 0, 0);
        g.add(new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({
            color: 0x44ffcc, emissive: 0x33eebb, emissiveIntensity: 0.25,
            transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1,
        })));

        g.userData.weaponType = 'harvest';
        return g;
    }

    /**
     * Utility turret: simple single barrel with white indicator
     */
    _buildPreviewUtilityTurret(ts) {
        const g = new THREE.Group();

        // Small base
        const baseGeo = new THREE.CylinderGeometry(ts * 0.6, ts * 0.8, ts * 0.4, 6);
        baseGeo.rotateX(Math.PI / 2);
        g.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
            color: 0x556677, emissive: 0x223344, emissiveIntensity: 0.08,
            roughness: 0.4, metalness: 0.6,
        })));

        // Single barrel
        const barrelGeo = new THREE.CylinderGeometry(ts * 0.12, ts * 0.15, ts * 2.0, 6);
        barrelGeo.rotateZ(Math.PI / 2);
        barrelGeo.translate(ts * 1.2, 0, 0);
        g.add(new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({
            color: 0x778899, emissive: 0x334455, emissiveIntensity: 0.08,
            roughness: 0.3, metalness: 0.7,
        })));

        // White tip indicator
        const tipGeo = new THREE.SphereGeometry(ts * 0.14, 4, 3);
        tipGeo.translate(ts * 2.2, 0, 0);
        g.add(new THREE.Mesh(tipGeo, new THREE.MeshStandardMaterial({
            color: 0xaabbcc, emissive: 0x5588aa, emissiveIntensity: 0.15,
            transparent: true, opacity: 0.7, roughness: 0.2, metalness: 0.3,
        })));

        g.userData.weaponType = 'utility';
        return g;
    }

    // =============================================
    // UTILITY METHODS
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
