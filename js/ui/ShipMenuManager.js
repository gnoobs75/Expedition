// =============================================
// Ship Menu Manager
// Handles ship info panel with 3D viewer, stats, and inventory
// =============================================

import { CONFIG } from '../config.js';
import { formatDistance, formatCredits } from '../utils/math.js';

export class ShipMenuManager {
    constructor(game) {
        this.game = game;

        // DOM elements
        this.modal = null;
        this.statsCanvas = null;

        // Three.js elements for ship viewer
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.shipMesh = null;
        this.animationId = null;

        // State
        this.visible = false;
        this.initialized = false;

        // Cache DOM elements
        this.cacheElements();

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Cache DOM element references
     */
    cacheElements() {
        this.modal = document.getElementById('ship-menu-modal');
        this.statsCanvas = document.getElementById('ship-viewer-canvas');
        this.shipNameEl = document.getElementById('ship-menu-name');
        this.statsContainer = document.getElementById('ship-stats-content');
        this.modulesContainer = document.getElementById('ship-modules-content');
        this.inventoryContainer = document.getElementById('ship-inventory-content');
    }

    /**
     * Setup event listeners for tabs and close button
     */
    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        const closeBtn = document.getElementById('ship-menu-close');
        closeBtn?.addEventListener('click', () => this.hide());

        // Tab buttons
        this.modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active tab button
                this.modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show corresponding tab content
                this.modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const tabId = `ship-tab-${btn.dataset.tab}`;
                document.getElementById(tabId)?.classList.add('active');

                this.game.audio?.play('click');
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.visible) {
                e.stopPropagation();
                this.hide();
            }
        });
    }

    /**
     * Initialize the 3D ship viewer
     */
    init3DViewer() {
        if (!this.statsCanvas || this.initialized) return;

        const width = 300;
        const height = 300;

        // Set canvas size
        this.statsCanvas.width = width;
        this.statsCanvas.height = height;

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000a14);

        // Create perspective camera for 3D effect
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(0, 50, 120);
        this.camera.lookAt(0, 0, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.statsCanvas,
            antialias: true,
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0x00ffff, 1.0);
        mainLight.position.set(5, 5, 5);
        this.scene.add(mainLight);

        const backLight = new THREE.DirectionalLight(0x0066ff, 0.5);
        backLight.position.set(-5, -3, -5);
        this.scene.add(backLight);

        // Add subtle grid for depth
        this.addGridBackground();

        this.initialized = true;
    }

    /**
     * Add a grid background for visual depth
     */
    addGridBackground() {
        const gridHelper = new THREE.GridHelper(200, 20, 0x003344, 0x001122);
        gridHelper.rotation.x = Math.PI / 2;
        gridHelper.position.z = -50;
        this.scene.add(gridHelper);
    }

    /**
     * Create or update the ship mesh in the viewer
     */
    createShipMesh() {
        const player = this.game.player;
        if (!player || !this.scene) return;

        // Remove existing ship mesh
        if (this.shipMesh) {
            this.scene.remove(this.shipMesh);
            // Dispose of geometry and materials
            this.shipMesh.traverse(child => {
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

        // Create ship mesh group
        const group = new THREE.Group();
        const size = 25; // Scale for viewer

        // Main hull
        const hullShape = new THREE.Shape();
        hullShape.moveTo(size * 1.2, 0);
        hullShape.lineTo(-size * 0.6, size * 0.6);
        hullShape.lineTo(-size * 0.3, 0);
        hullShape.lineTo(-size * 0.6, -size * 0.6);
        hullShape.closePath();

        const extrudeSettings = {
            depth: 8,
            bevelEnabled: true,
            bevelThickness: 2,
            bevelSize: 1,
            bevelSegments: 2,
        };

        const hullGeometry = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
        const hullMaterial = new THREE.MeshPhongMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.9,
            shininess: 50,
            specular: 0x00ffff,
        });
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        hull.position.z = -4;
        group.add(hull);

        // Cockpit
        const cockpitGeometry = new THREE.SphereGeometry(size * 0.2, 16, 16);
        const cockpitMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            emissive: 0x003344,
            emissiveIntensity: 0.5,
        });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.set(size * 0.2, 0, 0);
        cockpit.scale.z = 0.5;
        group.add(cockpit);

        // Engine glows
        const engineGeometry = new THREE.CylinderGeometry(size * 0.15, size * 0.1, 5, 16);
        const engineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
        });

        const engine1 = new THREE.Mesh(engineGeometry, engineMaterial);
        engine1.rotation.z = Math.PI / 2;
        engine1.position.set(-size * 0.55, size * 0.3, 0);
        group.add(engine1);

        const engine2 = engine1.clone();
        engine2.position.set(-size * 0.55, -size * 0.3, 0);
        group.add(engine2);

        // Wing accents
        const wingGeometry = new THREE.BoxGeometry(size * 0.1, size * 0.4, 3);
        const wingMaterial = new THREE.MeshPhongMaterial({
            color: 0x0066aa,
            transparent: true,
            opacity: 0.8,
        });

        const wing1 = new THREE.Mesh(wingGeometry, wingMaterial);
        wing1.position.set(-size * 0.2, size * 0.5, 0);
        wing1.rotation.z = 0.3;
        group.add(wing1);

        const wing2 = wing1.clone();
        wing2.position.set(-size * 0.2, -size * 0.5, 0);
        wing2.rotation.z = -0.3;
        group.add(wing2);

        // Center the model
        group.position.set(0, 0, 0);

        this.shipMesh = group;
        this.scene.add(this.shipMesh);
    }

    /**
     * Animate the ship model rotation
     */
    animate() {
        if (!this.visible || !this.shipMesh || !this.renderer) {
            this.animationId = null;
            return;
        }

        // Rotate ship
        this.shipMesh.rotation.z += 0.005;
        this.shipMesh.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;

        // Render
        this.renderer.render(this.scene, this.camera);

        // Continue animation
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Show the ship menu
     */
    show() {
        if (!this.modal) return;

        // Initialize 3D viewer on first show
        if (!this.initialized) {
            this.init3DViewer();
        }

        this.modal.classList.remove('hidden');
        this.visible = true;

        // Create ship mesh and start animation
        this.createShipMesh();
        this.animate();

        // Update content
        this.updateStats();
        this.updateModules();
        this.updateInventory();
        this.updateDrones();

        this.game.audio?.play('click');
    }

    /**
     * Hide the ship menu
     */
    hide() {
        if (!this.modal) return;

        this.modal.classList.add('hidden');
        this.visible = false;

        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Toggle ship menu visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Update ship statistics display
     */
    updateStats() {
        const player = this.game.player;
        if (!player || !this.statsContainer) return;

        // Get ship class config
        const shipClass = player.shipClass || 'frigate';
        const shipConfig = CONFIG.SHIPS[shipClass] || CONFIG.SHIPS.frigate;

        // Update ship name
        if (this.shipNameEl) {
            this.shipNameEl.textContent = shipConfig.name || 'Unknown Ship';
        }

        // Calculate effective stats with bonuses
        let effectiveMaxSpeed = player.maxSpeed;
        if (player.activeModules?.has('mid-2')) { // Afterburner
            effectiveMaxSpeed *= 1.5;
        }

        const html = `
            <div class="stat-section">
                <h4>ATTRIBUTES</h4>
                <div class="stat-row">
                    <span class="stat-label">Max Speed</span>
                    <span class="stat-value">${Math.floor(effectiveMaxSpeed)} m/s</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Acceleration</span>
                    <span class="stat-value">${player.acceleration} m/s²</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Turn Rate</span>
                    <span class="stat-value">${(player.turnSpeed * 180 / Math.PI).toFixed(1)}°/s</span>
                </div>
            </div>
            <div class="stat-section">
                <h4>DEFENSES</h4>
                <div class="stat-row">
                    <span class="stat-label">Shield</span>
                    <span class="stat-value shield">${Math.floor(player.shield)} / ${player.maxShield}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Armor</span>
                    <span class="stat-value armor">${Math.floor(player.armor)} / ${player.maxArmor}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Hull</span>
                    <span class="stat-value hull">${Math.floor(player.hull)} / ${player.maxHull}</span>
                </div>
            </div>
            <div class="stat-section">
                <h4>CAPACITOR</h4>
                <div class="stat-row">
                    <span class="stat-label">Capacity</span>
                    <span class="stat-value capacitor">${Math.floor(player.capacitor)} / ${player.maxCapacitor}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Recharge Rate</span>
                    <span class="stat-value">${player.capacitorRegen}/s</span>
                </div>
            </div>
            <div class="stat-section">
                <h4>CARGO</h4>
                <div class="stat-row">
                    <span class="stat-label">Capacity</span>
                    <span class="stat-value">${player.cargoCapacity} m³</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Used</span>
                    <span class="stat-value">${player.cargoUsed?.toFixed(1) || 0} m³</span>
                </div>
            </div>
        `;

        this.statsContainer.innerHTML = html;
    }

    /**
     * Update fitted modules display
     */
    updateModules() {
        const player = this.game.player;
        if (!player || !this.modulesContainer) return;

        const modules = player.getFittedModules();

        // Group by slot type
        const highSlots = modules.filter(m => m.slotType === 'high');
        const midSlots = modules.filter(m => m.slotType === 'mid');
        const lowSlots = modules.filter(m => m.slotType === 'low');

        const renderSlot = (mod) => {
            if (!mod.config) {
                return `
                    <div class="module-item empty">
                        <span class="module-slot-label">${mod.slotId}</span>
                        <span class="module-name">Empty</span>
                    </div>
                `;
            }

            const activeClass = mod.active ? 'active' : '';
            return `
                <div class="module-item ${activeClass}">
                    <span class="module-slot-label">${mod.slotId}</span>
                    <span class="module-name">${mod.config.name}</span>
                    ${mod.config.damage ? `<span class="module-stat">DMG: ${mod.config.damage}</span>` : ''}
                    ${mod.config.miningYield ? `<span class="module-stat">Yield: ${mod.config.miningYield}</span>` : ''}
                    ${mod.config.shieldBoost ? `<span class="module-stat">Shield: +${mod.config.shieldBoost}</span>` : ''}
                    ${mod.config.armorRepair ? `<span class="module-stat">Armor: +${mod.config.armorRepair}</span>` : ''}
                    ${mod.config.speedBonus ? `<span class="module-stat">Speed: +${mod.config.speedBonus * 100}%</span>` : ''}
                </div>
            `;
        };

        const html = `
            <div class="modules-section">
                <h4>HIGH SLOTS</h4>
                ${highSlots.map(renderSlot).join('')}
            </div>
            <div class="modules-section">
                <h4>MID SLOTS</h4>
                ${midSlots.map(renderSlot).join('')}
            </div>
            <div class="modules-section">
                <h4>LOW SLOTS</h4>
                ${lowSlots.map(renderSlot).join('')}
            </div>
        `;

        this.modulesContainer.innerHTML = html;
    }

    /**
     * Update inventory display
     */
    updateInventory() {
        const player = this.game.player;
        if (!player || !this.inventoryContainer) return;

        const cargo = player.cargo || {};
        const cargoEntries = Object.entries(cargo).filter(([type, data]) => data.units > 0);

        if (cargoEntries.length === 0) {
            this.inventoryContainer.innerHTML = `
                <div class="inventory-empty">
                    <p>Cargo hold is empty</p>
                    <p class="inventory-hint">Mine asteroids or pick up items to fill your cargo</p>
                </div>
            `;
            return;
        }

        let totalValue = 0;
        const itemsHtml = cargoEntries.map(([type, data]) => {
            const oreConfig = CONFIG.ASTEROID_TYPES[type] || { name: type, value: 10, color: '#888888' };
            const value = data.units * oreConfig.value;
            totalValue += value;

            return `
                <div class="inventory-item">
                    <div class="inventory-item-icon" style="background-color: ${oreConfig.color}"></div>
                    <div class="inventory-item-info">
                        <span class="inventory-item-name">${oreConfig.name}</span>
                        <span class="inventory-item-amount">${data.units.toLocaleString()} units (${data.volume.toFixed(1)} m³)</span>
                    </div>
                    <span class="inventory-item-value">${formatCredits(value)} ISK</span>
                </div>
            `;
        }).join('');

        this.inventoryContainer.innerHTML = `
            <div class="inventory-summary">
                <span>Cargo: ${player.cargoUsed?.toFixed(1) || 0} / ${player.cargoCapacity} m³</span>
                <span class="inventory-total-value">Total: ${formatCredits(totalValue)} ISK</span>
            </div>
            <div class="inventory-items">
                ${itemsHtml}
            </div>
        `;
    }

    /**
     * Update drones display
     */
    updateDrones() {
        const player = this.game.player;
        const container = document.getElementById('ship-tab-drones');
        if (!player || !container) return;

        const droneBay = player.droneBay;
        if (!droneBay || droneBay.capacity === 0) {
            container.innerHTML = `
                <div class="drones-empty">
                    <p>No Drone Bay</p>
                    <p class="drones-hint">This ship class does not support drones</p>
                </div>
            `;
            return;
        }

        const drones = player.getDronesInBay();
        const deployedCount = player.getDeployedDroneCount();

        const dronesHtml = drones.map(drone => {
            const config = drone.config || {};
            const statusClass = drone.deployed ? 'deployed' : 'in-bay';
            const hpPercent = Math.round((drone.hp / (config.hp || 50)) * 100);

            return `
                <div class="drone-item ${statusClass}" data-index="${drone.index}">
                    <div class="drone-item-icon">${drone.config?.type === 'mining' ? '&#9874;' : '&#9876;'}</div>
                    <div class="drone-item-info">
                        <span class="drone-item-name">${config.name || 'Drone'}</span>
                        <span class="drone-item-status">${drone.deployed ? 'DEPLOYED' : 'IN BAY'}</span>
                    </div>
                    <div class="drone-item-hp">
                        <div class="drone-hp-bar" style="width: ${hpPercent}%"></div>
                        <span class="drone-hp-text">${drone.hp}/${config.hp || 50}</span>
                    </div>
                    <button class="drone-action-btn" data-index="${drone.index}">
                        ${drone.deployed ? 'Recall' : 'Launch'}
                    </button>
                </div>
            `;
        }).join('');

        const emptySlots = droneBay.capacity - drones.length;
        const emptySlotsHtml = emptySlots > 0 ? `
            <div class="drone-empty-slots">
                ${emptySlots} empty slot${emptySlots > 1 ? 's' : ''} (drone destroyed)
            </div>
        ` : '';

        container.innerHTML = `
            <div class="drones-header">
                <h3>DRONE BAY</h3>
                <span class="drones-count">${deployedCount}/${droneBay.capacity} Deployed</span>
            </div>
            <div class="drones-bandwidth">
                <span>Bandwidth: ${droneBay.bandwidth} Mbit/s</span>
            </div>
            <div class="drones-actions">
                <button class="drone-mass-action-btn" id="launch-all-drones">Launch All</button>
                <button class="drone-mass-action-btn" id="recall-all-drones">Recall All</button>
            </div>
            <div class="drones-list">
                ${dronesHtml}
                ${emptySlotsHtml}
            </div>
        `;

        // Add event listeners
        container.querySelectorAll('.drone-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const drone = drones.find(d => d.index === index);
                if (drone) {
                    if (drone.deployed) {
                        const deployedDrone = player.droneBay.deployed.get(index);
                        if (deployedDrone) player.recallDrone(deployedDrone);
                    } else {
                        player.launchDrone(index);
                    }
                    // Refresh display after short delay
                    setTimeout(() => this.updateDrones(), 100);
                }
            });
        });

        document.getElementById('launch-all-drones')?.addEventListener('click', () => {
            player.launchAllDrones();
            setTimeout(() => this.updateDrones(), 100);
        });

        document.getElementById('recall-all-drones')?.addEventListener('click', () => {
            player.recallAllDrones();
            setTimeout(() => this.updateDrones(), 100);
        });
    }

    /**
     * Cleanup resources
     */
    dispose() {
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Dispose Three.js resources
        if (this.shipMesh) {
            this.scene.remove(this.shipMesh);
            this.shipMesh.traverse(child => {
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

        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
