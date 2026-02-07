// =============================================
// Station Vendor Manager
// Handles ship browser, equipment shop, and fitting screen
// =============================================

import { CONFIG } from '../config.js';
import { SHIP_DATABASE, SHIP_ROLES, SHIP_SIZES, getShipsByRole, getShipsByRoleAndSize } from '../data/shipDatabase.js';
import { EQUIPMENT_DATABASE, SLOT_DISPLAY_MAP, getEquipmentBySlot } from '../data/equipmentDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';
import { formatCredits } from '../utils/math.js';

export class StationVendorManager {
    constructor(game) {
        this.game = game;

        // State
        this.activeTab = 'hangar';
        this.selectedShipId = null;
        this.selectedEquipId = null;
        this.selectedInventoryIndex = null;
        this.shipRoleFilter = 'all';
        this.shipSizeFilter = 'all';
        this.equipSlotFilter = 'all';

        // 3D viewer state (vendor)
        this.vendorScene = null;
        this.vendorCamera = null;
        this.vendorRenderer = null;
        this.vendorShipMesh = null;
        this.vendorAnimationId = null;

        // 3D viewer state (fitting)
        this.fittingScene = null;
        this.fittingCamera = null;
        this.fittingRenderer = null;
        this.fittingShipMesh = null;
        this.fittingAnimationId = null;
    }

    /**
     * Show the station panel and initialize content
     */
    show(station) {
        this.station = station;
        this.activeTab = 'hangar';
        this.updateTab('hangar');
    }

    /**
     * Hide and cleanup
     */
    hide() {
        if (this.vendorAnimationId) {
            cancelAnimationFrame(this.vendorAnimationId);
            this.vendorAnimationId = null;
        }
        if (this.fittingAnimationId) {
            cancelAnimationFrame(this.fittingAnimationId);
            this.fittingAnimationId = null;
        }
    }

    /**
     * Update content when switching tabs
     */
    updateTab(tab) {
        this.activeTab = tab;

        switch (tab) {
            case 'hangar':
                this.renderHangar();
                break;
            case 'ships':
                this.renderShips();
                break;
            case 'equipment':
                this.renderEquipment();
                break;
            case 'market':
                // Legacy compat
                this.renderShips();
                this.renderEquipment();
                break;
            case 'fitting':
                this.renderFitting();
                break;
        }
    }

    // =============================================
    // HANGAR TAB
    // =============================================

    renderHangar() {
        const player = this.game.player;
        if (!player) return;

        const hangarShips = document.getElementById('hangar-ships');
        const cargoContents = document.getElementById('cargo-contents');
        if (!hangarShips || !cargoContents) return;

        // Current ship info
        const shipConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        const shipName = shipConfig?.name || player.shipClass;

        hangarShips.innerHTML = `
            <div class="shop-item current-ship">
                <div class="item-info">
                    <div class="item-name">${shipName}</div>
                    <div class="item-desc">
                        ${shipConfig?.role ? shipConfig.role.toUpperCase() + ' - ' : ''}${shipConfig?.size ? shipConfig.size.toUpperCase() : ''}
                        | Shield: ${Math.floor(player.shield)}/${player.maxShield}
                        | Armor: ${Math.floor(player.armor)}/${player.maxArmor}
                    </div>
                </div>
                <div class="item-price" style="color: var(--text-secondary)">ACTIVE</div>
            </div>
        `;

        // Cargo
        const cargo = player.getCargoContents();
        if (cargo.length === 0) {
            cargoContents.innerHTML = '<div class="empty-message">Cargo hold is empty</div>';
        } else {
            cargoContents.innerHTML = cargo.map(item => `
                <div class="shop-item">
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.units} units (${item.volume.toFixed(1)} m³)</div>
                    </div>
                    <div class="item-price">${formatCredits(item.value)} ISK</div>
                </div>
            `).join('');
        }
    }

    // =============================================
    // MARKET TAB
    // =============================================

    renderShips() {
        const container = document.getElementById('ships-market');
        if (!container) return;
        this.renderShipMarket(container);
    }

    renderEquipment() {
        const container = document.getElementById('equipment-market');
        if (!container) return;
        this.renderEquipmentMarket(container);
    }

    renderMarket() {
        // Legacy: render both to old containers or new
        const marketShips = document.getElementById('ships-market') || document.getElementById('market-ships');
        const marketModules = document.getElementById('equipment-market') || document.getElementById('market-modules');
        if (marketShips) this.renderShipMarket(marketShips);
        if (marketModules) this.renderEquipmentMarket(marketModules);
    }

    renderShipMarket(container) {
        const player = this.game.player;
        if (!player) return;

        // Build filter bar
        const roleOptions = ['all', ...Object.values(SHIP_ROLES)].map(r =>
            `<option value="${r}" ${this.shipRoleFilter === r ? 'selected' : ''}>${r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>`
        ).join('');

        const sizeOptions = ['all', ...Object.values(SHIP_SIZES)].map(s =>
            `<option value="${s}" ${this.shipSizeFilter === s ? 'selected' : ''}>${s === 'all' ? 'All Sizes' : s.charAt(0).toUpperCase() + s.slice(1)}</option>`
        ).join('');

        // Filter ships
        let ships = Object.entries(SHIP_DATABASE);
        if (this.shipRoleFilter !== 'all') {
            ships = ships.filter(([id, s]) => s.role === this.shipRoleFilter);
        }
        if (this.shipSizeFilter !== 'all') {
            ships = ships.filter(([id, s]) => s.size === this.shipSizeFilter);
        }
        ships.sort((a, b) => a[1].price - b[1].price);

        const tradeInValue = this.calculateTradeInValue();

        const shipsHtml = ships.map(([shipId, config]) => {
            const finalPrice = config.price - tradeInValue;
            const canAfford = this.game.credits >= finalPrice;
            const isCurrentShip = player.shipClass === shipId;

            return `
                <div class="shop-item ${isCurrentShip ? 'current-ship' : ''} ${!canAfford ? 'too-expensive' : ''}"
                     data-ship-id="${shipId}">
                    <div class="item-info">
                        <div class="item-name">${config.name}</div>
                        <div class="item-desc">
                            ${config.role.toUpperCase()} ${config.size.toUpperCase()}
                            | Spd: ${config.maxSpeed} | Shd: ${config.shield} | Arm: ${config.armor}
                            | W:${config.weaponSlots} M:${config.moduleSlots} S:${config.subsystemSlots}
                        </div>
                    </div>
                    <div class="item-price-group">
                        <div class="item-price">${formatCredits(config.price)} ISK</div>
                        ${tradeInValue > 0 && !isCurrentShip ? `<div class="trade-in-info">Trade-in: -${formatCredits(tradeInValue)}</div>` : ''}
                    </div>
                    ${isCurrentShip
                        ? '<span class="current-label">CURRENT</span>'
                        : `<button class="buy-btn" ${!canAfford ? 'disabled' : ''} data-action="buy-ship" data-ship-id="${shipId}">
                            ${canAfford ? 'BUY' : 'INSUFFICIENT'}
                          </button>`
                    }
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="market-filters">
                <select id="ship-role-filter" class="market-filter-select">${roleOptions}</select>
                <select id="ship-size-filter" class="market-filter-select">${sizeOptions}</select>
                <span class="filter-count">${ships.length} ships</span>
            </div>
            <div class="market-list">${shipsHtml || '<div class="empty-message">No ships match filters</div>'}</div>
        `;

        // Wire up filter events
        container.querySelector('#ship-role-filter')?.addEventListener('change', (e) => {
            this.shipRoleFilter = e.target.value;
            this.renderShipMarket(container);
        });
        container.querySelector('#ship-size-filter')?.addEventListener('change', (e) => {
            this.shipSizeFilter = e.target.value;
            this.renderShipMarket(container);
        });

        // Wire up buy buttons
        container.querySelectorAll('[data-action="buy-ship"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const shipId = btn.dataset.shipId;
                this.purchaseShip(shipId);
            });
        });

        // Wire up ship detail preview on click
        container.querySelectorAll('.shop-item[data-ship-id]').forEach(item => {
            item.addEventListener('click', () => {
                this.showShipDetail(item.dataset.shipId, container);
            });
        });
    }

    /**
     * Initialize the vendor 3D viewer for ship previews
     */
    initVendor3DViewer(canvas) {
        if (!canvas) return;

        const width = 200;
        const height = 180;
        canvas.width = width;
        canvas.height = height;

        this.vendorScene = new THREE.Scene();
        this.vendorScene.background = new THREE.Color(0x000a14);

        this.vendorCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.vendorCamera.position.set(0, 50, 120);
        this.vendorCamera.lookAt(0, 0, 0);

        this.vendorRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.vendorRenderer.setSize(width, height);
        this.vendorRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lighting
        const ambient = new THREE.AmbientLight(0x404050, 0.6);
        this.vendorScene.add(ambient);
        const mainLight = new THREE.DirectionalLight(0x00ffff, 1.0);
        mainLight.position.set(5, 5, 5);
        this.vendorScene.add(mainLight);
        const backLight = new THREE.DirectionalLight(0x0066ff, 0.5);
        backLight.position.set(-5, -3, -5);
        this.vendorScene.add(backLight);

        // Grid background
        const grid = new THREE.GridHelper(200, 20, 0x003344, 0x001122);
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -50;
        this.vendorScene.add(grid);
    }

    /**
     * Set a ship mesh in the vendor 3D viewer
     */
    setVendorShipMesh(shipId, config) {
        if (!this.vendorScene) return;

        // Remove old mesh
        if (this.vendorShipMesh) {
            this.vendorScene.remove(this.vendorShipMesh);
            this.vendorShipMesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.vendorShipMesh = null;
        }

        try {
            this.vendorShipMesh = shipMeshFactory.generateShipMesh({
                shipId,
                role: config.role || 'mercenary',
                size: config.size || 'small',
                detailLevel: 'high',
            });
            this.vendorScene.add(this.vendorShipMesh);
        } catch (e) {
            // Ignore - no preview available
        }
    }

    /**
     * Animate the vendor 3D viewer
     */
    animateVendorViewer() {
        if (!this.vendorShipMesh || !this.vendorRenderer || !this.vendorScene) {
            this.vendorAnimationId = null;
            return;
        }

        this.vendorShipMesh.rotation.z += 0.005;
        this.vendorShipMesh.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
        this.vendorRenderer.render(this.vendorScene, this.vendorCamera);
        this.vendorAnimationId = requestAnimationFrame(() => this.animateVendorViewer());
    }

    showShipDetail(shipId, container) {
        const config = SHIP_DATABASE[shipId];
        if (!config) return;

        this.selectedShipId = shipId;

        // Stop existing animation
        if (this.vendorAnimationId) {
            cancelAnimationFrame(this.vendorAnimationId);
            this.vendorAnimationId = null;
        }

        // Find or create detail panel
        let detailPanel = container.querySelector('.ship-detail-panel');
        if (!detailPanel) {
            detailPanel = document.createElement('div');
            detailPanel.className = 'ship-detail-panel';
            container.appendChild(detailPanel);
        }

        const player = this.game.player;
        const tradeInValue = this.calculateTradeInValue();
        const finalPrice = config.price - tradeInValue;
        const canAfford = this.game.credits >= finalPrice;
        const isCurrentShip = player.shipClass === shipId;

        // Build bonus list
        const bonusHtml = config.bonuses ? Object.entries(config.bonuses).map(([key, val]) => {
            const percent = val >= 1 ? `+${Math.round((val - 1) * 100)}%` : `-${Math.round((1 - val) * 100)}%`;
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            return `<div class="detail-bonus">${label}: <span class="bonus-value">${percent}</span></div>`;
        }).join('') : '';

        detailPanel.innerHTML = `
            <div class="detail-header">
                <div class="detail-header-row">
                    <canvas class="vendor-ship-canvas"></canvas>
                    <div class="detail-header-text">
                        <h3>${config.name}</h3>
                        <div class="detail-role">${config.role.toUpperCase()} - ${config.size.toUpperCase()}</div>
                        <div class="detail-desc">${config.description}</div>
                    </div>
                </div>
            </div>
            <div class="detail-stats-grid">
                <div class="detail-stat-group">
                    <h4>MOBILITY</h4>
                    <div class="detail-row"><span>Max Speed</span><span>${config.maxSpeed} m/s</span></div>
                    <div class="detail-row"><span>Acceleration</span><span>${config.acceleration} m/s²</span></div>
                    <div class="detail-row"><span>Turn Speed</span><span>${config.turnSpeed} rad/s</span></div>
                </div>
                <div class="detail-stat-group">
                    <h4>DEFENSES</h4>
                    <div class="detail-row"><span>Shield</span><span>${config.shield} HP</span></div>
                    <div class="detail-row"><span>Armor</span><span>${config.armor} HP</span></div>
                    <div class="detail-row"><span>Hull</span><span>${config.hull} HP</span></div>
                </div>
                <div class="detail-stat-group">
                    <h4>CAPACITOR</h4>
                    <div class="detail-row"><span>Capacity</span><span>${config.capacitor} GJ</span></div>
                    <div class="detail-row"><span>Recharge</span><span>${config.capacitorRegen}/s</span></div>
                </div>
                <div class="detail-stat-group">
                    <h4>FITTING</h4>
                    <div class="detail-row"><span>Weapon Slots</span><span>${config.weaponSlots}</span></div>
                    <div class="detail-row"><span>Module Slots</span><span>${config.moduleSlots}</span></div>
                    <div class="detail-row"><span>Subsystem Slots</span><span>${config.subsystemSlots}</span></div>
                    <div class="detail-row"><span>Cargo</span><span>${config.cargoCapacity} m³</span></div>
                    ${config.droneCapacity ? `<div class="detail-row"><span>Drone Bay</span><span>${config.droneCapacity} drones</span></div>` : ''}
                </div>
            </div>
            ${bonusHtml ? `<div class="detail-bonuses"><h4>SHIP BONUSES</h4>${bonusHtml}</div>` : ''}
            <div class="detail-buy-section">
                <div class="detail-price">
                    <span class="label">PRICE:</span>
                    <span class="amount">${formatCredits(config.price)} ISK</span>
                </div>
                ${tradeInValue > 0 && !isCurrentShip ? `
                    <div class="detail-trade-in">
                        <span class="label">TRADE-IN:</span>
                        <span class="amount">-${formatCredits(tradeInValue)} ISK</span>
                    </div>
                    <div class="detail-final-price">
                        <span class="label">FINAL:</span>
                        <span class="amount">${formatCredits(finalPrice)} ISK</span>
                    </div>
                ` : ''}
                ${isCurrentShip
                    ? '<div class="current-ship-label">THIS IS YOUR CURRENT SHIP</div>'
                    : `<button class="buy-btn large" ${!canAfford ? 'disabled' : ''} data-action="buy-ship-detail" data-ship-id="${shipId}">
                        ${canAfford ? 'PURCHASE SHIP' : 'INSUFFICIENT FUNDS'}
                      </button>`
                }
            </div>
        `;

        // Initialize 3D viewer on the canvas
        const canvas = detailPanel.querySelector('.vendor-ship-canvas');
        if (canvas) {
            this.initVendor3DViewer(canvas);
            this.setVendorShipMesh(shipId, config);
            this.animateVendorViewer();
        }

        // Wire buy button
        detailPanel.querySelector('[data-action="buy-ship-detail"]')?.addEventListener('click', () => {
            this.purchaseShip(shipId);
        });

        detailPanel.scrollIntoView({ behavior: 'smooth' });
    }

    renderEquipmentMarket(container) {
        const player = this.game.player;
        if (!player) return;

        // Build filter bar
        const slotOptions = ['all', 'weapon', 'module', 'subsystem'].map(s =>
            `<option value="${s}" ${this.equipSlotFilter === s ? 'selected' : ''}>${s === 'all' ? 'All Slots' : (SLOT_DISPLAY_MAP[s === 'weapon' ? 'high' : s === 'module' ? 'mid' : 'low'] || s.charAt(0).toUpperCase() + s.slice(1)) + 's'}</option>`
        ).join('');

        // Filter equipment
        let equipment = Object.entries(EQUIPMENT_DATABASE);
        if (this.equipSlotFilter !== 'all') {
            equipment = equipment.filter(([id, e]) => e.slot === this.equipSlotFilter);
        }
        equipment.sort((a, b) => a[1].price - b[1].price);

        const equipHtml = equipment.map(([equipId, config]) => {
            const canAfford = this.game.credits >= config.price;
            const slotLabel = config.slot === 'weapon' ? 'WPN' : config.slot === 'module' ? 'MOD' : 'SUB';

            // Build stat summary
            let statDesc = `${slotLabel} | ${config.size?.toUpperCase() || ''}`;
            if (config.damage) statDesc += ` | ${config.damage} dmg`;
            if (config.miningYield) statDesc += ` | ${config.miningYield} yield`;
            if (config.shieldRepair) statDesc += ` | ${config.shieldRepair} shield/cycle`;
            if (config.armorRepair) statDesc += ` | ${config.armorRepair} armor/cycle`;
            if (config.speedBonus) statDesc += ` | +${Math.floor((config.speedBonus - 1) * 100)}% speed`;
            if (config.damageBonus) statDesc += ` | +${Math.floor((config.damageBonus - 1) * 100)}% dmg`;
            if (config.range) statDesc += ` | ${config.range}m range`;

            return `
                <div class="shop-item ${!canAfford ? 'too-expensive' : ''}" data-equip-id="${equipId}">
                    <div class="item-info">
                        <div class="item-name">${config.name}</div>
                        <div class="item-desc">${statDesc}</div>
                    </div>
                    <div class="item-price">${formatCredits(config.price)} ISK</div>
                    <button class="buy-btn" ${!canAfford ? 'disabled' : ''} data-action="buy-equip" data-equip-id="${equipId}">
                        ${canAfford ? 'BUY' : '---'}
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="market-filters">
                <select id="equip-slot-filter" class="market-filter-select">${slotOptions}</select>
                <span class="filter-count">${equipment.length} items</span>
            </div>
            <div class="market-list">${equipHtml || '<div class="empty-message">No equipment match filters</div>'}</div>
        `;

        // Wire filter
        container.querySelector('#equip-slot-filter')?.addEventListener('change', (e) => {
            this.equipSlotFilter = e.target.value;
            this.renderEquipmentMarket(container);
        });

        // Wire buy buttons
        container.querySelectorAll('[data-action="buy-equip"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const equipId = btn.dataset.equipId;
                this.purchaseEquipment(equipId);
            });
        });
    }

    // =============================================
    // FITTING TAB
    // =============================================

    renderFitting() {
        const fittingDisplay = document.getElementById('fitting-display');
        if (!fittingDisplay) return;

        const player = this.game.player;
        if (!player) return;

        const shipConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        if (!shipConfig) return;

        const weaponSlots = shipConfig.weaponSlots || shipConfig.highSlots || 3;
        const moduleSlots = shipConfig.moduleSlots || shipConfig.midSlots || 2;
        const subsystemSlots = shipConfig.subsystemSlots || shipConfig.lowSlots || 2;

        // Build slot sections
        const buildSlotSection = (label, internalPrefix, count) => {
            let html = '';
            for (let i = 1; i <= count; i++) {
                const slotId = `${internalPrefix}-${i}`;
                const moduleId = player.modules[internalPrefix]?.[i - 1];
                const moduleConfig = moduleId ? (EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId]) : null;
                const isActive = player.activeModules?.has(slotId);

                if (moduleConfig) {
                    html += `
                        <div class="fitting-slot filled ${isActive ? 'active' : ''}" data-slot-id="${slotId}">
                            <span class="slot-icon">${this.getModuleIcon(moduleConfig)}</span>
                            <span class="slot-name">${moduleConfig.name}</span>
                            <button class="slot-unfit" data-action="unfit" data-slot-id="${slotId}" title="Unfit">&times;</button>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="fitting-slot empty" data-slot-id="${slotId}">
                            <span class="slot-icon">&#9633;</span>
                            <span class="slot-name">Empty ${label} Slot</span>
                        </div>
                    `;
                }
            }
            return html;
        };

        // Build inventory list
        const inventory = player.moduleInventory || [];
        const inventoryHtml = inventory.length === 0
            ? '<div class="empty-message">No modules in inventory.<br>Buy modules from the MARKET tab.</div>'
            : inventory.map((item, index) => {
                const config = item.config || EQUIPMENT_DATABASE[item.id] || CONFIG.MODULES[item.id];
                if (!config) return '';
                const selectedClass = this.selectedInventoryIndex === index ? 'selected' : '';
                return `
                    <div class="fitting-inventory-item ${selectedClass}" data-index="${index}">
                        <span class="inv-icon">${this.getModuleIcon(config)}</span>
                        <span class="inv-name">${config.name}</span>
                        <span class="inv-slot">${config.slot?.toUpperCase() || ''}</span>
                    </div>
                `;
            }).join('');

        // Build live stats
        const statsHtml = `
            <div class="fitting-stat-group">
                <h4>MOBILITY</h4>
                <div class="detail-row"><span>Speed</span><span>${player.maxSpeed} m/s</span></div>
                <div class="detail-row"><span>Accel</span><span>${player.acceleration} m/s²</span></div>
            </div>
            <div class="fitting-stat-group">
                <h4>DEFENSES</h4>
                <div class="detail-row"><span>Shield</span><span>${Math.floor(player.shield)} / ${player.maxShield}</span></div>
                <div class="detail-row"><span>Armor</span><span>${Math.floor(player.armor)} / ${player.maxArmor}</span></div>
                <div class="detail-row"><span>Hull</span><span>${Math.floor(player.hull)} / ${player.maxHull}</span></div>
            </div>
            <div class="fitting-stat-group">
                <h4>CAPACITOR</h4>
                <div class="detail-row"><span>Capacity</span><span>${player.maxCapacitor} GJ</span></div>
                <div class="detail-row"><span>Recharge</span><span>${player.capacitorRegen}/s</span></div>
            </div>
            <div class="fitting-stat-group">
                <h4>CARGO</h4>
                <div class="detail-row"><span>Used</span><span>${player.cargoUsed.toFixed(1)} / ${player.cargoCapacity} m³</span></div>
            </div>
        `;

        fittingDisplay.innerHTML = `
            <div class="fitting-layout">
                <div class="fitting-slots-panel">
                    <div class="fitting-section">
                        <div class="fitting-section-label">WEAPON SLOTS (${weaponSlots})</div>
                        ${buildSlotSection('Weapon', 'high', weaponSlots)}
                    </div>
                    <div class="fitting-section">
                        <div class="fitting-section-label">MODULE SLOTS (${moduleSlots})</div>
                        ${buildSlotSection('Module', 'mid', moduleSlots)}
                    </div>
                    <div class="fitting-section">
                        <div class="fitting-section-label">SUBSYSTEM SLOTS (${subsystemSlots})</div>
                        ${buildSlotSection('Subsystem', 'low', subsystemSlots)}
                    </div>
                </div>
                <div class="fitting-right-panel">
                    <div class="fitting-stats">${statsHtml}</div>
                    <div class="fitting-inventory">
                        <div class="fitting-section-label">MODULE INVENTORY</div>
                        <div class="fitting-inventory-list">${inventoryHtml}</div>
                    </div>
                </div>
            </div>
        `;

        // Wire slot click events
        fittingDisplay.querySelectorAll('.fitting-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const slotId = slot.dataset.slotId;
                if (e.target.closest('[data-action="unfit"]')) {
                    this.unfitModule(slotId);
                } else if (slot.classList.contains('empty') && this.selectedInventoryIndex !== null) {
                    this.fitModuleToSlot(slotId);
                }
            });
        });

        // Wire inventory click events
        fittingDisplay.querySelectorAll('.fitting-inventory-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectedInventoryIndex = this.selectedInventoryIndex === index ? null : index;
                this.renderFitting();
            });
        });
    }

    getModuleIcon(config) {
        if (!config) return '&#9633;';
        if (config.damage) return '&#9889;';
        if (config.miningYield) return '&#9874;';
        if (config.salvageYield) return '&#9851;';
        if (config.shieldRepair) return '&#9211;';
        if (config.armorRepair) return '&#9881;';
        if (config.speedBonus) return '&#10148;';
        if (config.warpDisrupt) return '&#10006;';
        if (config.damageBonus || config.laserDamageBonus || config.missileDamageBonus) return '&#9733;';
        if (config.maxSpeedBonus) return '&#10148;';
        if (config.capacitorRegenBonus || config.capacitorBonus) return '&#9889;';
        if (config.shieldResistance || config.armorResistance || config.hullResistance) return '&#9730;';
        if (config.miningYieldBonus) return '&#9874;';
        if (config.droneDamageBonus || config.droneSpeedBonus) return '&#9670;';
        return '&#9632;';
    }

    // =============================================
    // PURCHASE LOGIC
    // =============================================

    calculateTradeInValue() {
        const player = this.game.player;
        if (!player || !player.shipClass) return 0;

        const currentConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        if (!currentConfig) return 0;

        return Math.floor(currentConfig.price * 0.5);
    }

    purchaseShip(shipId) {
        const player = this.game.player;
        const config = SHIP_DATABASE[shipId];
        if (!player || !config) return;

        const tradeInValue = this.calculateTradeInValue();
        const finalPrice = config.price - tradeInValue;

        if (this.game.credits < finalPrice) {
            this.game.ui?.toast('Insufficient funds', 'error');
            return;
        }

        this.game.credits -= finalPrice;
        player.switchShip(shipId);

        this.game.audio?.play('purchase');
        this.game.ui?.toast(`Purchased ${config.name}!`, 'success');
        this.game.ui?.log(`Purchased ${config.name} for ${formatCredits(finalPrice)} ISK (trade-in: ${formatCredits(tradeInValue)} ISK)`, 'system');
        this.game.ui?.updateHUD();

        // Refresh ships display
        this.renderShips();
    }

    purchaseEquipment(equipId) {
        const player = this.game.player;
        const config = EQUIPMENT_DATABASE[equipId];
        if (!player || !config) return;

        if (this.game.credits < config.price) {
            this.game.ui?.toast('Insufficient funds', 'error');
            return;
        }

        if (!player.moduleInventory) {
            player.moduleInventory = [];
        }

        player.moduleInventory.push({ id: equipId, config });
        this.game.credits -= config.price;

        this.game.audio?.play('purchase');
        this.game.ui?.toast(`Purchased ${config.name}!`, 'success');
        this.game.ui?.log(`Purchased ${config.name} for ${formatCredits(config.price)} ISK`, 'system');
        this.game.ui?.updateHUD();

        // Refresh
        this.renderEquipment();
    }

    // =============================================
    // FITTING LOGIC
    // =============================================

    fitModuleToSlot(slotId) {
        const player = this.game.player;
        if (!player || this.selectedInventoryIndex === null) return;

        const inventory = player.moduleInventory || [];
        const module = inventory[this.selectedInventoryIndex];
        if (!module) return;

        const config = module.config || EQUIPMENT_DATABASE[module.id] || CONFIG.MODULES[module.id];
        if (!config) return;

        // Map slot types: weapon->high, module->mid, subsystem->low
        const slotType = slotId.split('-')[0];
        const slotMapping = { weapon: 'high', module: 'mid', subsystem: 'low' };
        const reverseMapping = { high: 'weapon', mid: 'module', low: 'subsystem' };

        const requiredInternal = slotMapping[config.slot] || config.slot;

        if (slotType !== requiredInternal) {
            const displaySlot = reverseMapping[slotType] || slotType;
            this.game.ui?.toast(`This module requires a ${config.slot} slot, not ${displaySlot}`, 'error');
            return;
        }

        // Parse slot index
        const slotIndex = parseInt(slotId.split('-')[1]) - 1;

        // Unfit existing module (move to inventory)
        const existingModuleId = player.modules[slotType]?.[slotIndex];
        if (existingModuleId) {
            const existingConfig = EQUIPMENT_DATABASE[existingModuleId] || CONFIG.MODULES[existingModuleId];
            player.moduleInventory.push({ id: existingModuleId, config: existingConfig });
            player.activeModules?.delete(slotId);
        }

        // Fit new module
        if (!player.modules[slotType]) player.modules[slotType] = [];
        player.modules[slotType][slotIndex] = module.id;

        // Remove from inventory
        inventory.splice(this.selectedInventoryIndex, 1);
        this.selectedInventoryIndex = null;

        this.game.audio?.play('click');
        this.game.ui?.toast(`Fitted ${config.name}`, 'success');

        this.renderFitting();
    }

    unfitModule(slotId) {
        const player = this.game.player;
        if (!player) return;

        const [slotType, slotNum] = slotId.split('-');
        const slotIndex = parseInt(slotNum) - 1;

        const moduleId = player.modules[slotType]?.[slotIndex];
        if (!moduleId) return;

        const config = EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId];

        // Move to inventory
        if (!player.moduleInventory) player.moduleInventory = [];
        player.moduleInventory.push({ id: moduleId, config });

        // Clear slot
        player.modules[slotType][slotIndex] = null;
        player.activeModules?.delete(slotId);

        this.game.audio?.play('click');
        this.game.ui?.toast(`Unfitted ${config?.name || moduleId}`, 'success');

        this.renderFitting();
    }

    // =============================================
    // CLEANUP
    // =============================================

    dispose() {
        this.hide();
        if (this.vendorRenderer) {
            this.vendorRenderer.dispose();
            this.vendorRenderer = null;
        }
        if (this.fittingRenderer) {
            this.fittingRenderer.dispose();
            this.fittingRenderer = null;
        }
    }
}
