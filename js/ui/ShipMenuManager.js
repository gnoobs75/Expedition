// =============================================
// Ship Menu Manager
// Handles ship info panel with 3D viewer, stats, and inventory
// =============================================

import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { formatDistance, formatCredits } from '../utils/math.js';

export class ShipMenuManager {
    constructor(game) {
        this.game = game;

        // Live-refresh inventory when cargo changes
        game.events.on('cargo:updated', () => {
            if (this.visible) this.updateInventory();
        });

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

        // Mouse drag rotation state
        this.isDragging = false;
        this.previousMouseX = 0;
        this.previousMouseY = 0;
        this.rotationX = 0.3;    // Default tilt angle
        this.rotationY = 0;      // Current Y rotation
        this.autoRotate = true;  // Auto-rotate when not dragging

        // Fittings tab state
        this.selectedSlot = null; // { slotType: 'high', index: 0 }

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

        // Cache all tab content elements for direct display control
        this.tabElements = {
            stats: document.getElementById('ship-tab-stats'),
            fittings: document.getElementById('ship-tab-fittings'),
            inventory: document.getElementById('ship-tab-inventory'),
            drones: document.getElementById('ship-tab-drones'),
        };
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
                const tab = btn.dataset.tab;
                if (!tab) return;

                // Update active tab button
                this.modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Switch to tab using direct style control
                this.switchToTab(tab);

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
     * Switch to a specific tab by name, using direct style.display control
     */
    switchToTab(tabName) {
        // Hide ALL tab content with inline style (overrides any CSS)
        for (const [name, el] of Object.entries(this.tabElements)) {
            if (!el) continue;
            if (name === tabName) {
                el.style.display = 'flex';
                el.classList.add('active');
            } else {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        }

        // Refresh content for the selected tab
        if (tabName === 'stats') {
            this.updateStats();
            this.updateModules();
            requestAnimationFrame(() => this.refreshViewer());
            if (!this.animationId && this.visible) this.animate();
        } else if (tabName === 'fittings') {
            this.updateFittings();
        } else if (tabName === 'inventory') {
            this.updateInventory();
        } else if (tabName === 'drones') {
            this.updateDrones();
        }
    }

    /**
     * Initialize the 3D ship viewer
     */
    init3DViewer() {
        if (!this.statsCanvas || this.initialized) return;

        const width = 450;
        const height = 400;

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
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 2.5;

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
        mainLight.position.set(5, 8, 5);
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x88bbff, 1.0);
        fillLight.position.set(-5, 3, -4);
        this.scene.add(fillLight);

        const backLight = new THREE.DirectionalLight(0x00ccff, 0.6);
        backLight.position.set(0, -5, -5);
        this.scene.add(backLight);

        // Add subtle grid for depth
        this.addGridBackground();

        this.initialized = true;

        // Setup mouse drag rotation on canvas
        this.setupDragRotation();
    }

    /**
     * Setup mouse drag rotation for the 3D ship viewer
     */
    setupDragRotation() {
        if (!this.statsCanvas) return;

        this.statsCanvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.autoRotate = false;
            this.previousMouseX = e.clientX;
            this.previousMouseY = e.clientY;
            this.statsCanvas.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const deltaX = e.clientX - this.previousMouseX;
            const deltaY = e.clientY - this.previousMouseY;
            this.rotationY += deltaX * 0.01;
            this.rotationX += deltaY * 0.01;
            // Clamp vertical rotation
            this.rotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationX));
            this.previousMouseX = e.clientX;
            this.previousMouseY = e.clientY;
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.statsCanvas.style.cursor = 'grab';
            }
        });

        this.statsCanvas.style.cursor = 'grab';
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
     * Create or update the ship mesh in the viewer (async GLB with procedural fallback)
     */
    createShipMesh() {
        const player = this.game.player;
        if (!player || !this.scene) return;

        // Remove existing ship mesh
        this.removeShipMesh();

        // Use modelId for GLB lookup (hero-frigate), fall back to shipClass
        const shipLookupId = player.modelId || player.shipClass;
        const shipConfig = SHIP_DATABASE[shipLookupId] || SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];

        // Try async GLB loading
        shipMeshFactory.generateShipMeshAsync({
            shipId: shipLookupId,
            role: shipConfig?.role || 'mercenary',
            size: shipConfig?.size || 'frigate',
            detailLevel: 'high',
        }).then(mesh => {
            if (!mesh) return;
            // Don't discard mesh if menu was hidden during load - keep it for next show
            this.removeShipMesh();
            this.shipMesh = mesh;

            // Add turret hardpoints to show fitted weapons
            this.addViewerTurrets(mesh);

            // Reset rotation
            this.rotationY = 0;
            this.rotationX = 0.3;
            this.autoRotate = true;
            this.scene.add(this.shipMesh);
            // Restart animation loop if it stopped while waiting for mesh
            if (!this.animationId && this.visible) {
                this.animate();
            }
        });
    }

    /**
     * Add turret hardpoints to the viewer mesh to show fitted weapons
     */
    addViewerTurrets(mesh) {
        const player = this.game.player;
        if (!player) return;

        const modules = player.getFittedModules();
        const weapons = modules.filter(m => m.slotType === 'high' && m.config?.damage);
        if (weapons.length === 0) return;

        // Get mesh bounding box for placement
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const turretSpacing = size.x / (weapons.length + 1);

        weapons.forEach((weapon, i) => {
            const turretGroup = new THREE.Group();

            // Base cylinder
            const baseGeo = new THREE.CylinderGeometry(1.2, 1.5, 1.5, 8);
            const baseMat = new THREE.MeshStandardMaterial({
                color: 0x445566,
                metalness: 0.8,
                roughness: 0.3,
            });
            const base = new THREE.Mesh(baseGeo, baseMat);
            turretGroup.add(base);

            // Barrel
            const barrelGeo = new THREE.BoxGeometry(0.5, 0.5, 4);
            const barrelMat = new THREE.MeshStandardMaterial({
                color: 0x667788,
                metalness: 0.9,
                roughness: 0.2,
                emissive: weapon.active ? 0xff4400 : 0x223344,
                emissiveIntensity: weapon.active ? 0.3 : 0.1,
            });
            const barrel = new THREE.Mesh(barrelGeo, barrelMat);
            barrel.position.set(0, 0.5, 2);
            turretGroup.add(barrel);

            // Position turret on top of ship
            const xPos = center.x - size.x / 2 + turretSpacing * (i + 1);
            turretGroup.position.set(xPos, box.max.y + 1, center.z);

            mesh.add(turretGroup);
        });
    }

    /**
     * Remove current ship mesh and dispose resources
     */
    removeShipMesh() {
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
            this.shipMesh = null;
        }
    }

    /**
     * Force the WebGL renderer to refresh (needed after canvas was in display:none)
     */
    refreshViewer() {
        if (!this.renderer || !this.statsCanvas) return;
        const width = 450;
        const height = 400;
        this.statsCanvas.width = width;
        this.statsCanvas.height = height;
        this.renderer.setSize(width, height);
        if (this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Animate the ship model rotation
     */
    animate() {
        if (!this.visible || !this.renderer) {
            this.animationId = null;
            return;
        }

        // Rotate ship if loaded
        if (this.shipMesh) {
            if (this.autoRotate) {
                this.rotationY += 0.005;
            }
            this.shipMesh.rotation.y = this.rotationY;
            this.shipMesh.rotation.x = this.rotationX;
        }

        // Render scene (shows grid even while model loads)
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

        // Always reset to stats tab on open
        this.modal.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === 'stats');
        });

        // Create ship mesh and start animation
        this.createShipMesh();
        this.refreshViewer();
        this.animate();

        // Switch to stats tab (handles all display + content updates)
        this.switchToTab('stats');

        // Pre-render other tabs so content is ready when user switches
        this.updateFittings();
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

        // Clear inline display styles so next show() starts clean
        for (const el of Object.values(this.tabElements)) {
            if (el) el.style.display = '';
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

        // Update ship name - use player's chosen heroName
        if (this.shipNameEl) {
            this.shipNameEl.textContent = player.heroName || shipConfig.name || 'Unknown Ship';
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
     * Update fittings tab with slot selection and inventory browser
     */
    updateFittings() {
        const player = this.game.player;
        const container = document.getElementById('ship-fittings-content');
        if (!player || !container) return;

        const modules = player.getFittedModules();
        const highSlots = modules.filter(m => m.slotType === 'high');
        const midSlots = modules.filter(m => m.slotType === 'mid');
        const lowSlots = modules.filter(m => m.slotType === 'low');

        const renderSlotRow = (mod) => {
            const isSelected = this.selectedSlot &&
                this.selectedSlot.slotType === mod.slotType &&
                this.selectedSlot.slotId === mod.slotId;
            const selClass = isSelected ? 'fitting-slot-selected' : '';
            const moduleConfig = mod.config;
            const weaponGroup = this.getWeaponGroupForSlot(mod.slotId);

            return `
                <div class="fitting-slot ${selClass} ${mod.moduleId ? '' : 'empty'}"
                     data-slot-id="${mod.slotId}" data-slot-type="${mod.slotType}">
                    <span class="fitting-slot-label">${mod.slotId.toUpperCase()}</span>
                    <span class="fitting-slot-module">${moduleConfig ? moduleConfig.name : '-- Empty --'}</span>
                    ${moduleConfig?.damage ? `<span class="fitting-slot-stat">DMG ${moduleConfig.damage}</span>` : ''}
                    ${moduleConfig?.miningYield ? `<span class="fitting-slot-stat">Yield ${moduleConfig.miningYield}</span>` : ''}
                    ${moduleConfig?.shieldBoost ? `<span class="fitting-slot-stat">+${moduleConfig.shieldBoost} SH</span>` : ''}
                    ${moduleConfig?.armorRepair ? `<span class="fitting-slot-stat">+${moduleConfig.armorRepair} AR</span>` : ''}
                    ${moduleConfig?.speedBonus ? `<span class="fitting-slot-stat">+${Math.round(moduleConfig.speedBonus * 100)}% SPD</span>` : ''}
                    ${weaponGroup ? `<span class="fitting-weapon-group">G${weaponGroup}</span>` : ''}
                    ${mod.moduleId ? `<button class="fitting-unfit-btn" data-slot-id="${mod.slotId}" title="Remove module">&#10005;</button>` : ''}
                </div>
            `;
        };

        // Build inventory panel for selected slot
        let inventoryHtml = '';
        if (this.selectedSlot) {
            const compatible = this.getCompatibleModules(this.selectedSlot.slotType);
            if (compatible.length === 0) {
                inventoryHtml = `<div class="fitting-inv-empty">No compatible modules in inventory</div>`;
            } else {
                inventoryHtml = compatible.map((item, idx) => {
                    const config = item.config || EQUIPMENT_DATABASE[item.id] || CONFIG.MODULES[item.id];
                    if (!config) return '';
                    return `
                        <div class="fitting-inv-item" data-inv-index="${idx}" data-module-id="${item.id}">
                            <span class="fitting-inv-name">${config.name || item.id}</span>
                            <div class="fitting-inv-stats">
                                ${config.damage ? `<span>DMG: ${config.damage}</span>` : ''}
                                ${config.optimalRange ? `<span>Range: ${config.optimalRange}m</span>` : ''}
                                ${config.miningYield ? `<span>Yield: ${config.miningYield}</span>` : ''}
                                ${config.shieldBoost ? `<span>Shield: +${config.shieldBoost}</span>` : ''}
                                ${config.armorRepair ? `<span>Armor: +${config.armorRepair}</span>` : ''}
                                ${config.speedBonus ? `<span>Speed: +${Math.round(config.speedBonus * 100)}%</span>` : ''}
                                ${config.capacitorUse ? `<span>Cap: ${config.capacitorUse}/s</span>` : ''}
                                ${config.cycleTime ? `<span>Cycle: ${config.cycleTime}s</span>` : ''}
                            </div>
                            <button class="fitting-equip-btn" data-module-id="${item.id}" data-inv-index="${item.originalIndex}">EQUIP</button>
                        </div>
                    `;
                }).join('');
            }
        } else {
            inventoryHtml = `<div class="fitting-inv-empty">Select a slot to see compatible modules</div>`;
        }

        container.innerHTML = `
            <div class="fittings-layout">
                <div class="fittings-slots-panel">
                    <div class="fitting-section">
                        <h4>HIGH SLOTS (Weapons)</h4>
                        ${highSlots.map(renderSlotRow).join('')}
                    </div>
                    <div class="fitting-section">
                        <h4>MID SLOTS (Utility)</h4>
                        ${midSlots.map(renderSlotRow).join('')}
                    </div>
                    <div class="fitting-section">
                        <h4>LOW SLOTS (Passive)</h4>
                        ${lowSlots.map(renderSlotRow).join('')}
                    </div>
                    <div class="fitting-docked-notice">
                        ${this.game.dockedAt ? '' : 'Dock at a station to change fittings'}
                    </div>
                </div>
                <div class="fittings-inventory-panel">
                    <h4>${this.selectedSlot ? `COMPATIBLE MODULES (${this.selectedSlot.slotType.toUpperCase()})` : 'MODULE INVENTORY'}</h4>
                    <div class="fittings-inv-list">
                        ${inventoryHtml}
                    </div>
                </div>
            </div>
        `;

        // Event listeners - slot selection
        container.querySelectorAll('.fitting-slot').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('fitting-unfit-btn')) return;
                const slotId = el.dataset.slotId;
                const slotType = el.dataset.slotType;
                this.selectedSlot = { slotId, slotType };
                this.updateFittings();
                this.game.audio?.play('click');
            });
        });

        // Event listeners - unfit buttons
        container.querySelectorAll('.fitting-unfit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.game.dockedAt) {
                    this.game.ui?.toast('Must be docked to change fittings', 'warning');
                    return;
                }
                const slotId = btn.dataset.slotId;
                const moduleId = player.unfitModule(slotId);
                if (moduleId) {
                    const config = EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId];
                    if (!player.moduleInventory) player.moduleInventory = [];
                    player.moduleInventory.push({ id: moduleId, config });
                    this.game.ui?.toast(`Removed ${config?.name || moduleId}`, 'info');
                }
                this.updateFittings();
                this.updateModules();
                this.game.audio?.play('click');
            });
        });

        // Event listeners - equip buttons
        container.querySelectorAll('.fitting-equip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.game.dockedAt) {
                    this.game.ui?.toast('Must be docked to change fittings', 'warning');
                    return;
                }
                if (!this.selectedSlot) return;
                const moduleId = btn.dataset.moduleId;
                const invIndex = parseInt(btn.dataset.invIndex);

                // Unfit existing module first
                const existingModuleId = player.modules[this.selectedSlot.slotType]?.[parseInt(this.selectedSlot.slotId.split('-')[1]) - 1];
                if (existingModuleId) {
                    player.unfitModule(this.selectedSlot.slotId);
                    const existingConfig = EQUIPMENT_DATABASE[existingModuleId] || CONFIG.MODULES[existingModuleId];
                    player.moduleInventory.push({ id: existingModuleId, config: existingConfig });
                }

                // Fit new module
                const success = player.fitModule(this.selectedSlot.slotId, moduleId);
                if (success) {
                    // Remove from inventory
                    player.moduleInventory.splice(invIndex, 1);
                    const config = EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId];
                    this.game.ui?.toast(`Fitted ${config?.name || moduleId}`, 'success');
                } else {
                    // Put back unfit module if fit failed
                    if (existingModuleId) {
                        player.fitModule(this.selectedSlot.slotId, existingModuleId);
                        player.moduleInventory.pop();
                    }
                }
                this.updateFittings();
                this.updateModules();
                this.game.audio?.play('click');
            });
        });
    }

    /**
     * Get compatible modules from inventory for a slot type
     */
    getCompatibleModules(slotType) {
        const player = this.game.player;
        if (!player?.moduleInventory) return [];

        // Map internal slot types to equipment DB slot values
        const slotMap = { high: ['weapon', 'high'], mid: ['module', 'mid'], low: ['subsystem', 'low'] };
        const validSlots = slotMap[slotType] || [slotType];

        return player.moduleInventory
            .map((item, idx) => {
                const config = item.config || EQUIPMENT_DATABASE[item.id] || CONFIG.MODULES[item.id];
                if (!config) return null;
                const itemSlot = config.slot;
                if (!validSlots.includes(itemSlot)) return null;
                return { ...item, config, originalIndex: idx };
            })
            .filter(Boolean);
    }

    /**
     * Get weapon group number for a slot (if assigned)
     */
    getWeaponGroupForSlot(slotId) {
        const player = this.game.player;
        if (!player?.weaponGroups) return null;
        for (const [group, slots] of Object.entries(player.weaponGroups)) {
            if (slots.includes(slotId)) return group;
        }
        return null;
    }

    /**
     * Update inventory display (ore, trade goods, materials, modules)
     */
    updateInventory() {
        const player = this.game.player;
        if (!player || !this.inventoryContainer) return;

        const cargo = player.cargo || {};
        const tradeGoods = player.tradeGoods || {};
        const materials = player.materials || {};
        const moduleInv = player.moduleInventory || [];

        const cargoEntries = Object.entries(cargo).filter(([, data]) => data.units > 0);
        const tradeEntries = Object.entries(tradeGoods).filter(([, data]) => data.quantity > 0);
        const materialEntries = Object.entries(materials).filter(([, qty]) => qty > 0);

        const hasItems = cargoEntries.length > 0 || tradeEntries.length > 0 || materialEntries.length > 0 || moduleInv.length > 0;

        if (!hasItems) {
            this.inventoryContainer.innerHTML = `
                <div class="inventory-empty">
                    <p>Cargo hold is empty</p>
                    <p class="inventory-hint">Mine asteroids or pick up items to fill your cargo</p>
                </div>
            `;
            return;
        }

        let totalValue = 0;

        // Ore items
        const oreHtml = cargoEntries.map(([type, data]) => {
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

        // Trade goods
        const tradeHtml = tradeEntries.map(([goodId, data]) => {
            const vol = (data.quantity * (data.volumePerUnit || 1)).toFixed(1);
            return `
                <div class="inventory-item">
                    <div class="inventory-item-icon" style="background-color: #d4a855"></div>
                    <div class="inventory-item-info">
                        <span class="inventory-item-name">${goodId.replace(/-/g, ' ')}</span>
                        <span class="inventory-item-amount">${data.quantity.toLocaleString()} units (${vol} m³)</span>
                    </div>
                    <span class="inventory-item-value">Trade Good</span>
                </div>
            `;
        }).join('');

        // Materials
        const matsHtml = materialEntries.map(([matId, qty]) => {
            return `
                <div class="inventory-item">
                    <div class="inventory-item-icon" style="background-color: #88aacc"></div>
                    <div class="inventory-item-info">
                        <span class="inventory-item-name">${matId.replace(/-/g, ' ')}</span>
                        <span class="inventory-item-amount">${qty.toLocaleString()} units</span>
                    </div>
                    <span class="inventory-item-value">Material</span>
                </div>
            `;
        }).join('');

        // Module inventory
        const modsHtml = moduleInv.map((item) => {
            const config = item.config || EQUIPMENT_DATABASE[item.id] || CONFIG.MODULES[item.id];
            const name = config?.name || item.id || 'Unknown Module';
            return `
                <div class="inventory-item">
                    <div class="inventory-item-icon" style="background-color: #66cc88"></div>
                    <div class="inventory-item-info">
                        <span class="inventory-item-name">${name}</span>
                        <span class="inventory-item-amount">Equipment</span>
                    </div>
                    <span class="inventory-item-value">${config?.price ? formatCredits(config.price) + ' ISK' : ''}</span>
                </div>
            `;
        }).join('');

        this.inventoryContainer.innerHTML = `
            <div class="inventory-summary">
                <span>Cargo: ${player.cargoUsed?.toFixed(1) || 0} / ${player.cargoCapacity} m³</span>
                <span class="inventory-total-value">Total Ore Value: ${formatCredits(totalValue)} ISK</span>
            </div>
            <div class="inventory-items">
                ${cargoEntries.length > 0 ? `<div class="inventory-category-header">ORE</div>${oreHtml}` : ''}
                ${tradeEntries.length > 0 ? `<div class="inventory-category-header">TRADE GOODS</div>${tradeHtml}` : ''}
                ${materialEntries.length > 0 ? `<div class="inventory-category-header">MATERIALS</div>${matsHtml}` : ''}
                ${moduleInv.length > 0 ? `<div class="inventory-category-header">EQUIPMENT (${moduleInv.length})</div>${modsHtml}` : ''}
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
        const usedBW = player.getUsedBandwidth();

        // Icon map for drone types
        const droneIcons = {
            'mining': '&#9874;',   // pick
            'combat': '&#9876;',   // crossed swords
            'ewar': '&#9889;',     // lightning bolt
            'scout': '&#9678;',    // bullseye
        };
        // Size badge colors
        const sizeBadges = {
            'light': { label: 'L', color: '#4af' },
            'medium': { label: 'M', color: '#fa4' },
            'heavy': { label: 'H', color: '#f44' },
        };

        const dronesHtml = drones.map(drone => {
            const config = drone.config || {};
            const statusClass = drone.deployed ? 'deployed' : 'in-bay';
            const hpPercent = Math.round((drone.hp / (config.hp || 50)) * 100);
            const icon = droneIcons[config.type] || '&#9679;';
            const badge = sizeBadges[config.size || 'medium'] || sizeBadges.medium;
            const bwCost = config.bandwidth || 10;

            return `
                <div class="drone-item ${statusClass}" data-index="${drone.index}">
                    <div class="drone-item-icon">${icon}<span class="drone-size-badge" style="color:${badge.color}">${badge.label}</span></div>
                    <div class="drone-item-info">
                        <span class="drone-item-name">${config.name || 'Drone'}</span>
                        <span class="drone-item-status">${drone.deployed ? 'DEPLOYED' : 'IN BAY'} &middot; ${bwCost} Mbit/s</span>
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
                <span>Bandwidth: ${usedBW}/${droneBay.bandwidth} Mbit/s</span>
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
