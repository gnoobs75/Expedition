// =============================================
// Ship Mesh Factory
// Procedural 3D mesh generation + GLB model loading for all ship types
// =============================================

import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';

// GLB model cache: path -> { scene: THREE.Group, loading: bool, callbacks: [] }
const MODEL_CACHE = {};

// Size configurations
const SIZE_CONFIGS = {
    frigate:       { radius: 20,  scale: 1.0, complexity: 1.0 },
    destroyer:     { radius: 30,  scale: 1.5, complexity: 1.5 },
    cruiser:       { radius: 50,  scale: 2.5, complexity: 2.0 },
    battlecruiser: { radius: 70,  scale: 3.5, complexity: 2.5 },
    battleship:    { radius: 100, scale: 5.0, complexity: 3.0 },
    capital:       { radius: 150, scale: 7.5, complexity: 3.5 },
};

// Color palettes per role
const ROLE_PALETTES = {
    mining:     { primary: 0x556677, secondary: 0x88aa44, accent: 0xffcc00, glow: 0x44ff88 },
    hauler:     { primary: 0x445566, secondary: 0x667788, accent: 0x88aacc, glow: 0x4488ff },
    salvager:   { primary: 0x665544, secondary: 0x887766, accent: 0xccaa88, glow: 0xff8844 },
    harvester:  { primary: 0x446655, secondary: 0x558877, accent: 0x66ccaa, glow: 0x44ffcc },
    mercenary:  { primary: 0x554444, secondary: 0x884444, accent: 0xff6644, glow: 0xff4422 },
    police:     { primary: 0x334466, secondary: 0x4466aa, accent: 0x88bbff, glow: 0x4488ff },
    military:   { primary: 0x444455, secondary: 0x556677, accent: 0x8899bb, glow: 0x6688cc },
    pirate:     { primary: 0x443333, secondary: 0x663333, accent: 0xcc4444, glow: 0xff2222 },
};

class ShipMeshFactory {
    /**
     * Generate a ship mesh from ship database config
     * @param {Object} config - { shipId, role, size, detailLevel }
     * @param {string} config.shipId - Ship ID from database
     * @param {string} config.role - Ship role (mining, hauler, etc.)
     * @param {string} config.size - Ship size class
     * @param {string} [config.detailLevel='low'] - 'low' for in-game, 'high' for ship viewer
     * @returns {THREE.Group}
     */
    generateShipMesh(config) {
        const { shipId, role, size, detailLevel = 'low' } = config;
        const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.frigate;
        const palette = ROLE_PALETTES[role] || ROLE_PALETTES.mercenary;
        const rng = this.createSeededRNG(this.hashString(shipId || 'default'));

        const group = new THREE.Group();

        // Generate base hull
        this.generateHull(group, sizeConfig, rng, detailLevel, palette, role);

        // Add role-specific details
        const detailFn = this.roleDetailGenerators[role];
        if (detailFn) {
            detailFn.call(this, group, sizeConfig, rng, detailLevel, palette);
        }

        return group;
    }

    /**
     * Generate base hull shape based on role
     */
    generateHull(group, sizeConfig, rng, detailLevel, palette, role) {
        const s = sizeConfig.radius;
        const shape = new THREE.Shape();

        switch (role) {
            case 'mining':
                // Boxy, industrial hull
                shape.moveTo(s * 0.6, 0);
                shape.lineTo(s * 0.4, s * 0.45);
                shape.lineTo(-s * 0.5, s * 0.4);
                shape.lineTo(-s * 0.6, s * 0.2);
                shape.lineTo(-s * 0.6, -s * 0.2);
                shape.lineTo(-s * 0.5, -s * 0.4);
                shape.lineTo(s * 0.4, -s * 0.45);
                shape.closePath();
                break;

            case 'hauler':
                // Wide, bulky hull
                shape.moveTo(s * 0.5, 0);
                shape.lineTo(s * 0.3, s * 0.5);
                shape.lineTo(-s * 0.6, s * 0.5);
                shape.lineTo(-s * 0.7, s * 0.3);
                shape.lineTo(-s * 0.7, -s * 0.3);
                shape.lineTo(-s * 0.6, -s * 0.5);
                shape.lineTo(s * 0.3, -s * 0.5);
                shape.closePath();
                break;

            case 'salvager':
                // Asymmetric, rough hull
                shape.moveTo(s * 0.5, s * 0.1);
                shape.lineTo(s * 0.2, s * 0.45);
                shape.lineTo(-s * 0.4, s * 0.35);
                shape.lineTo(-s * 0.6, s * 0.1);
                shape.lineTo(-s * 0.5, -s * 0.3);
                shape.lineTo(-s * 0.3, -s * 0.45);
                shape.lineTo(s * 0.3, -s * 0.35);
                shape.closePath();
                break;

            case 'harvester':
                // Rounded, organic hull
                shape.moveTo(s * 0.55, 0);
                shape.quadraticCurveTo(s * 0.5, s * 0.4, s * 0.1, s * 0.5);
                shape.quadraticCurveTo(-s * 0.3, s * 0.5, -s * 0.6, s * 0.2);
                shape.lineTo(-s * 0.6, -s * 0.2);
                shape.quadraticCurveTo(-s * 0.3, -s * 0.5, s * 0.1, -s * 0.5);
                shape.quadraticCurveTo(s * 0.5, -s * 0.4, s * 0.55, 0);
                break;

            case 'mercenary':
                // Aggressive, angular hull
                shape.moveTo(s * 0.9, 0);
                shape.lineTo(s * 0.1, s * 0.5);
                shape.lineTo(-s * 0.3, s * 0.55);
                shape.lineTo(-s * 0.7, s * 0.3);
                shape.lineTo(-s * 0.5, 0);
                shape.lineTo(-s * 0.7, -s * 0.3);
                shape.lineTo(-s * 0.3, -s * 0.55);
                shape.lineTo(s * 0.1, -s * 0.5);
                shape.closePath();
                break;

            case 'police':
                // Clean, sleek hull
                shape.moveTo(s * 0.8, 0);
                shape.lineTo(s * 0.2, s * 0.4);
                shape.lineTo(-s * 0.5, s * 0.35);
                shape.lineTo(-s * 0.65, s * 0.15);
                shape.lineTo(-s * 0.65, -s * 0.15);
                shape.lineTo(-s * 0.5, -s * 0.35);
                shape.lineTo(s * 0.2, -s * 0.4);
                shape.closePath();
                break;

            case 'military':
                // Symmetrical, imposing hull
                shape.moveTo(s * 0.7, 0);
                shape.lineTo(s * 0.3, s * 0.45);
                shape.lineTo(-s * 0.2, s * 0.5);
                shape.lineTo(-s * 0.6, s * 0.4);
                shape.lineTo(-s * 0.7, s * 0.15);
                shape.lineTo(-s * 0.7, -s * 0.15);
                shape.lineTo(-s * 0.6, -s * 0.4);
                shape.lineTo(-s * 0.2, -s * 0.5);
                shape.lineTo(s * 0.3, -s * 0.45);
                shape.closePath();
                break;

            case 'pirate':
                // Jagged, intimidating hull
                shape.moveTo(s * 0.85, 0);
                shape.lineTo(s * 0.3, s * 0.3);
                shape.lineTo(s * 0.1, s * 0.55);
                shape.lineTo(-s * 0.4, s * 0.4);
                shape.lineTo(-s * 0.6, s * 0.5);
                shape.lineTo(-s * 0.55, s * 0.1);
                shape.lineTo(-s * 0.55, -s * 0.1);
                shape.lineTo(-s * 0.6, -s * 0.5);
                shape.lineTo(-s * 0.4, -s * 0.4);
                shape.lineTo(s * 0.1, -s * 0.55);
                shape.lineTo(s * 0.3, -s * 0.3);
                shape.closePath();
                break;

            default:
                // Generic triangle
                shape.moveTo(s, 0);
                shape.lineTo(-s * 0.7, s * 0.5);
                shape.lineTo(-s * 0.5, 0);
                shape.lineTo(-s * 0.7, -s * 0.5);
                shape.closePath();
        }

        let geometry;
        if (detailLevel === 'high') {
            const extrudeSettings = {
                depth: s * 0.2,
                bevelEnabled: true,
                bevelThickness: s * 0.05,
                bevelSize: s * 0.03,
                bevelSegments: 2,
            };
            geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            geometry.center();
        } else {
            geometry = new THREE.ShapeGeometry(shape);
        }

        const material = new THREE.MeshBasicMaterial({
            color: palette.primary,
            transparent: true,
            opacity: 0.9,
        });

        const hull = new THREE.Mesh(geometry, material);
        group.add(hull);
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

    addMiningDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Mining turrets
        const turretPositions = [
            { x: s * 0.3, y: s * 0.35 },
            { x: s * 0.3, y: -s * 0.35 },
        ];
        if (sizeConfig.complexity >= 2) {
            turretPositions.push({ x: s * 0.1, y: 0 });
        }
        for (const pos of turretPositions) {
            this.addTurretMount(group, pos.x, pos.y, s * 0.1, palette.accent, detailLevel);
        }

        // Cargo bay doors
        const bayGeometry = new THREE.PlaneGeometry(s * 0.4, s * 0.25);
        const bayMaterial = new THREE.MeshBasicMaterial({
            color: palette.secondary, transparent: true, opacity: 0.7,
        });
        const bay = new THREE.Mesh(bayGeometry, bayMaterial);
        bay.position.set(-s * 0.2, 0, 0.05);
        group.add(bay);

        // Engines
        this.addEngines(group, s, [
            { x: -s * 0.65, y: s * 0.25 },
            { x: -s * 0.65, y: -s * 0.25 },
        ], palette.glow, detailLevel);

        // Cockpit
        this.addCockpit(group, s * 0.35, 0, s * 0.12, palette.accent, detailLevel);
    }

    addHaulerDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Cargo containers
        const containerCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < containerCount; i++) {
            const cGeo = new THREE.PlaneGeometry(s * 0.25, s * 0.2);
            const cMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? palette.secondary : palette.primary,
                transparent: true, opacity: 0.75,
            });
            const container = new THREE.Mesh(cGeo, cMat);
            const row = Math.floor(i / 2);
            const col = i % 2;
            container.position.set(
                -s * 0.3 + row * s * 0.2,
                col === 0 ? s * 0.25 : -s * 0.25,
                0.05
            );
            group.add(container);
        }

        // Engines
        this.addEngines(group, s * 1.5, [
            { x: -s * 0.7, y: 0 },
        ], palette.glow, detailLevel);

        // Cockpit
        this.addCockpit(group, s * 0.3, 0, s * 0.1, palette.accent, detailLevel);
    }

    addSalvagerDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Tractor beam emitters
        const tractorPositions = [
            { x: s * 0.1, y: s * 0.5 },
            { x: s * 0.1, y: -s * 0.5 },
        ];
        for (const pos of tractorPositions) {
            const tGeo = new THREE.CircleGeometry(s * 0.08, 8);
            const tMat = new THREE.MeshBasicMaterial({
                color: palette.glow, transparent: true, opacity: 0.6,
            });
            const tractor = new THREE.Mesh(tGeo, tMat);
            tractor.position.set(pos.x, pos.y, 0.1);
            group.add(tractor);
        }

        // Utility arms
        const armCount = Math.floor(sizeConfig.complexity);
        for (let i = 0; i < armCount; i++) {
            const armGeo = new THREE.PlaneGeometry(s * 0.06, s * 0.5);
            const armMat = new THREE.MeshBasicMaterial({
                color: palette.secondary, transparent: true, opacity: 0.8,
            });
            const arm = new THREE.Mesh(armGeo, armMat);
            const side = i % 2 === 0 ? 1 : -1;
            arm.position.set(-s * 0.4, side * s * 0.4, 0);
            arm.rotation.z = side * (Math.PI / 6 + rng() * Math.PI / 6);
            group.add(arm);
        }

        // Engines (asymmetric)
        this.addEngines(group, s, [
            { x: -s * 0.7, y: s * 0.1 },
            { x: -s * 0.6, y: -s * 0.3 },
        ], palette.glow, detailLevel);

        // Cockpit (off-center)
        this.addCockpit(group, s * 0.2, s * 0.1, s * 0.12, palette.accent, detailLevel);
    }

    addHarvesterDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Storage tanks
        const tankCount = Math.floor(sizeConfig.complexity * 1.5);
        for (let i = 0; i < tankCount; i++) {
            const tankRadius = s * (0.15 + rng() * 0.1);
            const tankGeo = new THREE.CircleGeometry(tankRadius, 12);
            const tankMat = new THREE.MeshBasicMaterial({
                color: palette.secondary, transparent: true, opacity: 0.7,
            });
            const tank = new THREE.Mesh(tankGeo, tankMat);
            const angle = (i / tankCount) * Math.PI * 2;
            tank.position.set(Math.cos(angle) * s * 0.3, Math.sin(angle) * s * 0.3, 0.05);
            group.add(tank);
        }

        // Collection scoops
        for (let i = 0; i < 2; i++) {
            const scoopShape = new THREE.Shape();
            scoopShape.moveTo(s * 0.7, 0);
            scoopShape.lineTo(s * 0.9, s * 0.15);
            scoopShape.lineTo(s * 0.9, -s * 0.15);
            scoopShape.closePath();
            const scoopGeo = new THREE.ShapeGeometry(scoopShape);
            const scoopMat = new THREE.MeshBasicMaterial({
                color: palette.accent, transparent: true, opacity: 0.5,
            });
            const scoop = new THREE.Mesh(scoopGeo, scoopMat);
            scoop.position.y = i === 0 ? s * 0.3 : -s * 0.3;
            group.add(scoop);
        }

        // Engines
        this.addEngines(group, s, [
            { x: -s * 0.65, y: s * 0.25 },
            { x: -s * 0.65, y: -s * 0.25 },
        ], palette.glow, detailLevel);

        this.addCockpit(group, s * 0.3, 0, s * 0.13, palette.accent, detailLevel);
    }

    addMercenaryDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Weapon hardpoints
        const weaponCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < weaponCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const row = Math.floor(i / 2);
            this.addTurretMount(
                group,
                s * (0.3 - row * 0.25),
                side * s * (0.4 + row * 0.1),
                s * 0.12, palette.accent, detailLevel
            );
        }

        // Armor plating
        const plateCount = Math.floor(sizeConfig.complexity * 3);
        for (let i = 0; i < plateCount; i++) {
            const plateGeo = new THREE.PlaneGeometry(s * 0.2, s * 0.15);
            const plateMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? palette.secondary : palette.primary,
                transparent: true, opacity: 0.8,
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            const row = Math.floor(i / 3);
            const col = i % 3;
            plate.position.set(s * 0.1 - row * s * 0.3, (col - 1) * s * 0.25, 0.05);
            plate.rotation.z = (rng() - 0.5) * 0.3;
            group.add(plate);
        }

        // Afterburner exhausts
        const exhaustPositions = [
            { x: -s * 0.7, y: s * 0.3 },
            { x: -s * 0.7, y: -s * 0.3 },
        ];
        if (sizeConfig.complexity >= 2) {
            exhaustPositions.push({ x: -s * 0.65, y: 0 });
        }
        this.addEngines(group, s * 0.8, exhaustPositions, palette.glow, detailLevel);

        this.addCockpit(group, s * 0.4, 0, s * 0.14, palette.accent, detailLevel);
    }

    addPoliceDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Authority stripes
        const stripeCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < stripeCount; i++) {
            const stripeGeo = new THREE.PlaneGeometry(s * 0.4, s * 0.08);
            const stripeMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0x88bbff : 0xffffff,
                transparent: true, opacity: 0.7,
            });
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            const side = i % 2 === 0 ? 1 : -1;
            stripe.position.set(0, side * s * (0.3 + Math.floor(i / 2) * 0.15), 0.06);
            group.add(stripe);
        }

        // Scanner emitters
        const scannerCount = Math.floor(sizeConfig.complexity * 1.5);
        for (let i = 0; i < scannerCount; i++) {
            const emitterGeo = new THREE.CircleGeometry(s * 0.05, 8);
            const emitterMat = new THREE.MeshBasicMaterial({
                color: palette.glow, transparent: true, opacity: 0.9,
            });
            const emitter = new THREE.Mesh(emitterGeo, emitterMat);
            const side = i % 2 === 0 ? 1 : -1;
            emitter.position.set(-s * 0.2, side * s * 0.7, 0.07);
            group.add(emitter);
        }

        // Light bar
        if (sizeConfig.complexity >= 1.5) {
            const lightBarGeo = new THREE.PlaneGeometry(s * 0.3, s * 0.05);
            const lightBarMat = new THREE.MeshBasicMaterial({
                color: 0xff4444, transparent: true, opacity: 0.7,
            });
            const lightBar = new THREE.Mesh(lightBarGeo, lightBarMat);
            lightBar.position.set(0, 0, 0.08);
            group.add(lightBar);
        }

        // Engines
        this.addEngines(group, s, [
            { x: -s * 0.65, y: s * 0.2 },
            { x: -s * 0.65, y: -s * 0.2 },
        ], palette.glow, detailLevel);

        this.addCockpit(group, s * 0.35, 0, s * 0.16, palette.accent, detailLevel);
    }

    addMilitaryDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Armor layers
        const armorLayers = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < armorLayers; i++) {
            const layerW = s * (0.8 - i * 0.15);
            const layerH = s * (0.6 - i * 0.1);
            const armorGeo = new THREE.PlaneGeometry(layerW, layerH);
            const armorMat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? palette.secondary : palette.primary,
                transparent: true, opacity: 0.75,
            });
            const armor = new THREE.Mesh(armorGeo, armorMat);
            armor.position.set(-s * 0.1, 0, 0.05);
            group.add(armor);
        }

        // Turret platforms
        const turretCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < turretCount; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const row = Math.floor(i / 2);
            this.addTurretMount(
                group, s * (0.2 - row * 0.3), side * s * 0.45,
                s * 0.1, palette.accent, detailLevel
            );
        }

        // Engines
        const enginePositions = [
            { x: -s * 0.7, y: s * 0.25 },
            { x: -s * 0.7, y: -s * 0.25 },
        ];
        if (sizeConfig.complexity >= 2) {
            enginePositions.push({ x: -s * 0.65, y: s * 0.45 });
            enginePositions.push({ x: -s * 0.65, y: -s * 0.45 });
        }
        if (sizeConfig.complexity >= 3) {
            enginePositions.push({ x: -s * 0.75, y: 0 });
        }
        this.addEngines(group, s * 1.2, enginePositions, palette.glow, detailLevel);

        this.addCockpit(group, s * 0.3, 0, s * 0.15, palette.accent, detailLevel);
    }

    addPirateDetails(group, sizeConfig, rng, detailLevel, palette) {
        const s = sizeConfig.radius;

        // Improvised armor plates
        const plateCount = Math.floor(sizeConfig.complexity * 4);
        for (let i = 0; i < plateCount; i++) {
            const pw = s * (0.15 + rng() * 0.2);
            const ph = s * (0.1 + rng() * 0.15);
            const plateGeo = new THREE.PlaneGeometry(pw, ph);
            const plateMat = new THREE.MeshBasicMaterial({
                color: rng() > 0.6 ? palette.secondary : palette.primary,
                transparent: true, opacity: 0.75,
            });
            const plate = new THREE.Mesh(plateGeo, plateMat);
            plate.position.set(
                (rng() - 0.5) * s * 0.7,
                (rng() - 0.5) * s * 0.8,
                0.05
            );
            plate.rotation.z = (rng() - 0.5) * Math.PI / 3;
            group.add(plate);
        }

        // Weapon spikes
        const spikeCount = Math.floor(sizeConfig.complexity * 2);
        for (let i = 0; i < spikeCount; i++) {
            const spikeGeo = new THREE.CircleGeometry(s * 0.08, 3);
            const spikeMat = new THREE.MeshBasicMaterial({
                color: palette.accent, transparent: true, opacity: 0.8,
            });
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            const angle = (i / spikeCount) * Math.PI * 2;
            spike.position.set(
                Math.cos(angle) * s * 0.6,
                Math.sin(angle) * s * 0.6,
                0
            );
            spike.rotation.z = angle;
            group.add(spike);
        }

        // Skull cockpit
        const skullGeo = new THREE.CircleGeometry(s * 0.18, 12);
        const skullMat = new THREE.MeshBasicMaterial({
            color: 0x220000, transparent: true, opacity: 0.9,
        });
        const skull = new THREE.Mesh(skullGeo, skullMat);
        skull.position.set(s * 0.5, 0, 0.06);
        group.add(skull);

        // Skull eyes
        const eyeGeo = new THREE.CircleGeometry(s * 0.05, 8);
        const eyeMat = new THREE.MeshBasicMaterial({
            color: palette.glow, transparent: true, opacity: 0.9,
        });
        const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
        eye1.position.set(s * 0.55, s * 0.08, 0.07);
        group.add(eye1);
        const eye2 = eye1.clone();
        eye2.position.y = -s * 0.08;
        group.add(eye2);

        // Weapon mounts (asymmetric)
        this.addTurretMount(group, s * 0.2, s * 0.5, s * 0.1, palette.accent, detailLevel);
        this.addTurretMount(group, s * 0.1, -s * 0.4, s * 0.1, palette.accent, detailLevel);

        // Engines (asymmetric)
        this.addEngines(group, s, [
            { x: -s * 0.7, y: s * 0.15 },
            { x: -s * 0.65, y: -s * 0.3 },
        ], palette.glow, detailLevel);
    }

    // =============================================
    // COMMON COMPONENT BUILDERS
    // =============================================

    addEngines(group, s, positions, glowColor, detailLevel) {
        for (const pos of positions) {
            const engineGeo = new THREE.CircleGeometry(s * 0.12, 12);
            const engineMat = new THREE.MeshBasicMaterial({
                color: glowColor, transparent: true, opacity: 0.7,
            });
            const engine = new THREE.Mesh(engineGeo, engineMat);
            engine.position.set(pos.x, pos.y, 0);
            group.add(engine);
        }
    }

    addCockpit(group, x, y, size, color, detailLevel) {
        const cockpitGeo = new THREE.CircleGeometry(size, 12);
        const cockpitMat = new THREE.MeshBasicMaterial({
            color: color, transparent: true, opacity: 0.8,
        });
        const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
        cockpit.position.set(x, y, 0.06);
        group.add(cockpit);
    }

    addTurretMount(group, x, y, size, color, detailLevel) {
        const mountGeo = new THREE.CircleGeometry(size, 8);
        const mountMat = new THREE.MeshBasicMaterial({
            color: color, transparent: true, opacity: 0.7,
        });
        const mount = new THREE.Mesh(mountGeo, mountMat);
        mount.position.set(x, y, 0.05);
        group.add(mount);
    }

    // =============================================
    // GLB MODEL LOADING
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
        // This ensures rotation works correctly around the model's center
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
     * Returns a Promise<THREE.Group>.
     * Use this for 3D viewers where async is fine.
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

    /**
     * Get saved orientation for a model path from localStorage
     * @param {string} path - Model file path
     * @returns {{ rx: number, ry: number, rz: number, scale: number } | null}
     */
    getModelOrientation(path) {
        try {
            const data = JSON.parse(localStorage.getItem('glb-orientations') || '{}');
            return data[path] || null;
        } catch {
            return null;
        }
    }

    /**
     * Save orientation for a model path to localStorage
     * @param {string} path - Model file path
     * @param {{ rx: number, ry: number, rz: number, scale: number }} orientation
     */
    saveModelOrientation(path, orientation) {
        try {
            const data = JSON.parse(localStorage.getItem('glb-orientations') || '{}');
            data[path] = orientation;
            localStorage.setItem('glb-orientations', JSON.stringify(data));
        } catch (e) {
            console.warn('[ShipMeshFactory] Failed to save orientation:', e);
        }
    }

    /**
     * Apply saved orientation to a model group via a wrapper Group.
     * Creates a wrapper, reparents all children into it, then applies rotation/scale.
     * @param {THREE.Group} group - The model group (already normalized)
     * @param {string} path - Model file path to look up orientation
     * @returns {THREE.Group} The group (modified in place)
     */
    applyOrientation(group, path) {
        const orientation = this.getModelOrientation(path);
        if (!orientation) return group;

        const wrapper = new THREE.Group();
        wrapper.name = 'orientation-wrapper';

        // Move all children into the wrapper
        while (group.children.length > 0) {
            wrapper.add(group.children[0]);
        }

        // Apply orientation
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
     * Returns a Promise that resolves to a THREE.Group clone.
     * Does NOT apply saved orientation (editor shows raw model).
     */
    loadModelByPath(path, targetSize = 40) {
        if (!path) return Promise.resolve(null);

        // Return cached clone immediately
        if (MODEL_CACHE[path]?.scene) {
            const clone = MODEL_CACHE[path].scene.clone();
            this.normalizeModelSize(clone, targetSize);
            return Promise.resolve(clone);
        }

        // Already loading - queue a callback
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
}

// Export singleton
export const shipMeshFactory = new ShipMeshFactory();
