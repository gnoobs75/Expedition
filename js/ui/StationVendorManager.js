// =============================================
// Station Vendor Manager
// Handles ship browser, equipment shop, and fitting screen
// =============================================

import { CONFIG, UNIVERSE_LAYOUT_MAP } from '../config.js';
import { SHIP_DATABASE, SHIP_ROLES, SHIP_SIZES, getShipsByRole, getShipsByRoleAndSize } from '../data/shipDatabase.js';
import { EQUIPMENT_DATABASE, SLOT_DISPLAY_MAP, getEquipmentBySlot } from '../data/equipmentDatabase.js';
import { FACTIONS, FACTION_SHIP_VARIANTS, getFactionShipCatalog, applyFactionOverlay } from '../data/factionDatabase.js';
import { shipMeshFactory, PAINT_SCHEMES, DECAL_PRESETS } from '../graphics/ShipMeshFactory.js';
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

        // 3D viewer state (hangar)
        this.hangarScene = null;
        this.hangarCamera = null;
        this.hangarRenderer = null;
        this.hangarShipMesh = null;
        this.hangarAnimationId = null;
        this.hangarDragState = null;
        this.hangarRotationY = 0;
        this.hangarRotationX = -0.3;
        this.hangarZoom = 1.0;

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
        if (this.hangarAnimationId) {
            cancelAnimationFrame(this.hangarAnimationId);
            this.hangarAnimationId = null;
        }
        if (this.hangarRenderer) {
            this.hangarRenderer.dispose();
            this.hangarRenderer = null;
        }
    }

    /**
     * Update content when switching tabs
     */
    updateTab(tab) {
        this.activeTab = tab;

        // Clean up hangar viewer when leaving hangar tab
        if (tab !== 'hangar' && this.hangarAnimationId) {
            cancelAnimationFrame(this.hangarAnimationId);
            this.hangarAnimationId = null;
        }

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
            case 'drones':
                this.renderDroneMarket();
                break;
            case 'manufacturing':
                this.game.ui?.manufacturingPanelManager?.render(
                    document.getElementById('manufacturing-content')
                );
                break;
            case 'bounty':
                this.game.ui?.bountyBoardManager?.render(
                    document.getElementById('bounty-content')
                );
                break;
            case 'missions':
                this.game.ui?.missionBoardManager?.show(
                    document.getElementById('missions-content')
                );
                break;
            case 'factions':
                this.renderFactions();
                break;
        }
    }

    // =============================================
    // HANGAR TAB
    // =============================================

    renderHangar() {
        const player = this.game.player;
        if (!player) return;

        const container = document.getElementById('hangar-content');
        if (!container) return;

        // Stop existing animation
        if (this.hangarAnimationId) {
            cancelAnimationFrame(this.hangarAnimationId);
            this.hangarAnimationId = null;
        }

        const shipConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        const shipName = shipConfig?.name || player.shipClass;

        // Hull upgrade
        const hullTiers = CONFIG.HULL_TIERS || {};
        const currentSize = player.shipSize || 'frigate';
        const currentTier = hullTiers[currentSize];
        const nextTierKey = currentTier?.nextTier;
        const nextTier = nextTierKey ? hullTiers[nextTierKey] : null;

        let hullUpgradeHtml = '';
        if (nextTier) {
            const canAfford = this.game.credits >= nextTier.cost;
            hullUpgradeHtml = `<div class="hangar-upgrade-item ${canAfford ? '' : 'disabled'}">
                <span class="upgrade-label">HULL: ${nextTier.name}</span>
                <button class="buy-btn" id="hull-upgrade-btn" ${canAfford ? '' : 'disabled'}>${formatCredits(nextTier.cost)}</button>
            </div>`;
        } else {
            hullUpgradeHtml = `<div class="hangar-upgrade-item maxed"><span class="upgrade-label">HULL: MAX TIER</span></div>`;
        }

        // Component upgrades
        const compUpgrades = CONFIG.COMPONENT_UPGRADES || {};
        let compHtml = '';
        for (const [compId, def] of Object.entries(compUpgrades)) {
            const currentLevel = player.componentLevels?.[compId] || 0;
            const maxLevel = def.levels.length - 1;
            const isMaxed = currentLevel >= maxLevel;
            const cost = isMaxed ? 0 : def.costs[currentLevel + 1];
            const canAfford = !isMaxed && this.game.credits >= cost;
            compHtml += `<div class="hangar-upgrade-item ${isMaxed ? 'maxed' : ''} ${canAfford ? '' : 'disabled'}">
                <span class="upgrade-label">${def.name} Mk.${currentLevel + 1}${isMaxed ? ' MAX' : ''}</span>
                ${isMaxed ? '' : `<button class="buy-btn" data-comp="${compId}" ${canAfford ? '' : 'disabled'}>${formatCredits(cost)}</button>`}
            </div>`;
        }

        // Paint scheme selector
        const activePaint = player.paintScheme || '';
        let paintHtml = `<div class="hangar-paint-item ${!activePaint ? 'active' : ''}" data-paint="">
            <div class="paint-swatch" style="background: linear-gradient(135deg, #4a5566, #607080)"></div>
            <span>Default</span>
        </div>`;
        for (const [id, scheme] of Object.entries(PAINT_SCHEMES)) {
            const p = scheme;
            const c1 = '#' + p.primary.toString(16).padStart(6, '0');
            const c2 = '#' + p.secondary.toString(16).padStart(6, '0');
            const c3 = '#' + p.accent.toString(16).padStart(6, '0');
            paintHtml += `<div class="hangar-paint-item ${activePaint === id ? 'active' : ''}" data-paint="${id}">
                <div class="paint-swatch" style="background: linear-gradient(135deg, ${c1}, ${c2}, ${c3})"></div>
                <span>${scheme.name}</span>
            </div>`;
        }

        // Decal selector
        const activeDecals = player.decals || [];
        const positions = ['port', 'starboard', 'dorsal-fore', 'dorsal-aft'];
        let decalHtml = '';
        for (const pos of positions) {
            const existing = activeDecals.find(d => d.position === pos);
            const existingPreset = existing ? DECAL_PRESETS[existing.id] : null;
            decalHtml += `<div class="hangar-decal-slot" data-pos="${pos}">
                <div class="decal-slot-label">${pos.toUpperCase()}</div>
                <div class="decal-slot-current">${existingPreset ? existingPreset.symbol : '---'}</div>
                <select class="decal-select" data-pos="${pos}">
                    <option value="">None</option>
                    ${Object.entries(DECAL_PRESETS).map(([id, d]) =>
                        `<option value="${id}" ${existing?.id === id ? 'selected' : ''}>${d.symbol} ${d.name}</option>`
                    ).join('')}
                </select>
            </div>`;
        }

        // Cargo summary
        const cargo = player.getCargoContents();
        const cargoUsed = cargo.reduce((sum, c) => sum + c.volume, 0);
        const cargoMax = player.cargoCapacity || shipConfig?.cargoCapacity || 0;

        container.innerHTML = `
            <div class="hangar-layout">
                <div class="hangar-viewer-section">
                    <canvas id="hangar-3d-canvas"></canvas>
                    <div class="hangar-ship-overlay">
                        <div class="hangar-ship-name">${player.heroName || shipName}</div>
                        <div class="hangar-ship-class">${shipConfig?.role ? shipConfig.role.toUpperCase() : ''} ${shipConfig?.size ? shipConfig.size.toUpperCase() : ''}</div>
                    </div>
                    <div class="hangar-ship-stats">
                        <span>SHD ${Math.floor(player.shield)}/${player.maxShield}</span>
                        <span>ARM ${Math.floor(player.armor)}/${player.maxArmor}</span>
                        <span>CAP ${Math.floor(player.capacitor)}/${player.maxCapacitor}</span>
                        <span>SPD ${player.maxSpeed} m/s</span>
                        <span>CARGO ${cargoUsed.toFixed(0)}/${cargoMax} m\u00B3</span>
                    </div>
                    <div class="hangar-viewer-hint">DRAG TO ROTATE | SCROLL TO ZOOM</div>
                </div>
                <div class="hangar-controls-section">
                    <div class="hangar-panel">
                        <div class="hangar-panel-title">UPGRADES</div>
                        ${hullUpgradeHtml}
                        ${compHtml}
                    </div>
                    <div class="hangar-panel">
                        <div class="hangar-panel-title">PAINT SCHEME</div>
                        <div class="hangar-paint-grid">${paintHtml}</div>
                    </div>
                    <div class="hangar-panel">
                        <div class="hangar-panel-title">DECALS</div>
                        <div class="hangar-decal-grid">${decalHtml}</div>
                    </div>
                    <div class="hangar-panel">
                        <div class="hangar-panel-title">CARGO HOLD (${cargo.length} items)</div>
                        <div class="hangar-cargo-list">
                            ${cargo.length === 0 ? '<div class="empty-message">Empty</div>' :
                            cargo.map(item => `<div class="hangar-cargo-item">
                                <span>${item.name} x${item.units}</span>
                                <span>${formatCredits(item.value)}</span>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize 3D viewer
        requestAnimationFrame(() => {
            const canvas = document.getElementById('hangar-3d-canvas');
            if (canvas) {
                this.initHangar3DViewer(canvas);
                this.loadHangarShipMesh();
                this.animateHangarViewer();
                this.setupHangarControls(canvas);
            }
        });

        // Hull upgrade button
        const hullBtn = document.getElementById('hull-upgrade-btn');
        if (hullBtn && nextTierKey) {
            hullBtn.addEventListener('click', () => {
                this.upgradeHull(nextTierKey, nextTier.cost);
            });
        }

        // Component upgrade buttons
        container.querySelectorAll('.hangar-upgrade-item .buy-btn[data-comp]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.upgradeComponent(btn.dataset.comp);
            });
        });

        // Paint scheme buttons
        container.querySelectorAll('.hangar-paint-item').forEach(item => {
            item.addEventListener('click', () => {
                const paintId = item.dataset.paint || null; // '' -> null for default
                player.paintScheme = paintId;
                // Update active state visually
                container.querySelectorAll('.hangar-paint-item').forEach(p => p.classList.remove('active'));
                item.classList.add('active');
                // Reload ship mesh with new paint
                this.loadHangarShipMesh();
                this.game.audio?.play('click');
            });
        });

        // Decal selectors
        container.querySelectorAll('.decal-select').forEach(sel => {
            sel.addEventListener('change', () => {
                const pos = sel.dataset.pos;
                const decalId = sel.value;
                // Update player decals array
                player.decals = (player.decals || []).filter(d => d.position !== pos);
                if (decalId) {
                    player.decals.push({ id: decalId, position: pos });
                }
                // Update visual
                const slot = sel.closest('.hangar-decal-slot');
                const currentEl = slot?.querySelector('.decal-slot-current');
                if (currentEl) {
                    const preset = DECAL_PRESETS[decalId];
                    currentEl.textContent = preset ? preset.symbol : '---';
                }
                // Reload mesh
                this.loadHangarShipMesh();
                this.game.audio?.play('click');
            });
        });
    }

    /**
     * Initialize the hangar 3D viewer
     */
    initHangar3DViewer(canvas) {
        if (this.hangarRenderer) {
            this.hangarRenderer.dispose();
            this.hangarRenderer = null;
        }

        const rect = canvas.parentElement.getBoundingClientRect();
        const width = Math.floor(rect.width) || 500;
        const height = 280;
        canvas.width = width;
        canvas.height = height;

        this.hangarScene = new THREE.Scene();
        this.hangarScene.background = new THREE.Color(0x020810);

        this.hangarCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
        this.hangarCamera.position.set(0, 60, 150);
        this.hangarCamera.lookAt(0, 0, 0);

        this.hangarRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.hangarRenderer.setSize(width, height);
        this.hangarRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.hangarRenderer.outputEncoding = THREE.sRGBEncoding;
        this.hangarRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.hangarRenderer.toneMappingExposure = 2.5;

        // Hangar lighting - dramatic station lighting
        const ambient = new THREE.AmbientLight(0x223344, 1.0);
        this.hangarScene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
        keyLight.position.set(4, 10, 6);
        this.hangarScene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x4488cc, 1.2);
        fillLight.position.set(-6, 4, -3);
        this.hangarScene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x00ccff, 0.8);
        rimLight.position.set(0, -3, -8);
        this.hangarScene.add(rimLight);

        const topLight = new THREE.PointLight(0x88aaff, 0.6, 300);
        topLight.position.set(0, 80, 0);
        this.hangarScene.add(topLight);

        // Hangar floor grid
        const grid = new THREE.GridHelper(300, 30, 0x0a2233, 0x061522);
        grid.rotation.x = Math.PI / 2;
        grid.position.z = -40;
        this.hangarScene.add(grid);

        // Hangar environment - docking clamps
        for (const side of [-1, 1]) {
            const clampGeo = new THREE.BoxGeometry(4, 60, 8);
            const clampMat = new THREE.MeshStandardMaterial({
                color: 0x1a2a3a, metalness: 0.8, roughness: 0.3,
            });
            const clamp = new THREE.Mesh(clampGeo, clampMat);
            clamp.position.set(0, side * 55, -20);
            this.hangarScene.add(clamp);

            // Docking light
            const lightGeo = new THREE.SphereGeometry(1.5, 8, 8);
            const lightMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
            const dockLight = new THREE.Mesh(lightGeo, lightMat);
            dockLight.position.set(0, side * 55, -12);
            this.hangarScene.add(dockLight);
        }
    }

    /**
     * Load the player's ship mesh into hangar viewer
     */
    loadHangarShipMesh() {
        if (!this.hangarScene) return;

        // Remove old mesh
        if (this.hangarShipMesh && this.hangarScene) {
            this.hangarScene.remove(this.hangarShipMesh);
            this.hangarShipMesh.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.hangarShipMesh = null;
        }

        const player = this.game.player;
        if (!player) return;
        const shipConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        if (!shipConfig) return;

        shipMeshFactory.generateShipMeshAsync({
            shipId: player.modelId || player.shipClass,
            role: shipConfig.role || 'mercenary',
            size: shipConfig.size || 'frigate',
            detailLevel: 'high',
            paintScheme: player.paintScheme || null,
            decals: player.decals || [],
        }).then(mesh => {
            if (!mesh || !this.hangarScene) return;

            const wrapper = new THREE.Group();

            // Normalize size
            const box = new THREE.Box3().setFromObject(mesh);
            const dims = new THREE.Vector3();
            box.getSize(dims);
            const maxDim = Math.max(dims.x, dims.y, dims.z);
            if (maxDim > 0) {
                const targetSize = 80;
                mesh.scale.multiplyScalar(targetSize / maxDim);
            }

            // Center
            const scaledBox = new THREE.Box3().setFromObject(mesh);
            const center = new THREE.Vector3();
            scaledBox.getCenter(center);
            mesh.position.sub(center);

            // Detect flat procedural mesh and tilt
            const isProcedural = dims.z < dims.x * 0.3;
            if (isProcedural) {
                wrapper.rotation.x = -Math.PI / 3;
            }
            this._hangarIsProcedural = isProcedural;

            wrapper.add(mesh);
            this.hangarShipMesh = wrapper;
            this.hangarScene.add(this.hangarShipMesh);
        });
    }

    /**
     * Animate the hangar 3D viewer
     */
    animateHangarViewer() {
        if (!this.hangarRenderer || !this.hangarScene) {
            this.hangarAnimationId = null;
            return;
        }

        if (this.hangarShipMesh) {
            const inner = this.hangarShipMesh.children[0];
            if (inner) {
                // Auto-rotate slowly when not dragging
                if (!this.hangarDragState) {
                    this.hangarRotationY += 0.003;
                }
                inner.rotation.y = this.hangarRotationY;
                if (!this._hangarIsProcedural) {
                    inner.rotation.x = this.hangarRotationX;
                }
            }

            // Apply zoom
            const baseZ = 150;
            this.hangarCamera.position.z = baseZ / this.hangarZoom;
            this.hangarCamera.position.y = 60 / this.hangarZoom;
        }

        this.hangarRenderer.render(this.hangarScene, this.hangarCamera);
        this.hangarAnimationId = requestAnimationFrame(() => this.animateHangarViewer());
    }

    /**
     * Setup mouse controls for hangar 3D viewer
     */
    setupHangarControls(canvas) {
        // Drag to rotate
        canvas.addEventListener('mousedown', (e) => {
            this.hangarDragState = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.hangarDragState) return;
            const dx = e.clientX - this.hangarDragState.x;
            const dy = e.clientY - this.hangarDragState.y;
            this.hangarRotationY += dx * 0.008;
            if (!this._hangarIsProcedural) {
                this.hangarRotationX = Math.max(-1.2, Math.min(1.2, this.hangarRotationX + dy * 0.005));
            }
            this.hangarDragState = { x: e.clientX, y: e.clientY };
        });

        canvas.addEventListener('mouseup', () => { this.hangarDragState = null; });
        canvas.addEventListener('mouseleave', () => { this.hangarDragState = null; });

        // Scroll to zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
            this.hangarZoom = Math.max(0.3, Math.min(3.0, this.hangarZoom * zoomDelta));
        }, { passive: false });
    }

    /**
     * Upgrade hero ship hull to next tier
     */
    upgradeHull(nextTierKey, cost) {
        if (!this.game.spendCredits(cost)) {
            this.game.ui?.showToast('Not enough credits', 'error');
            return;
        }

        const player = this.game.player;
        // Find a ship in SHIP_DATABASE that matches the target size
        // Look for a generic ship of that size class
        let targetShipId = nextTierKey;
        for (const [shipId, config] of Object.entries(SHIP_DATABASE)) {
            if (config.size === nextTierKey) {
                targetShipId = shipId;
                break;
            }
        }

        const savedName = player.heroName;
        const savedComponents = { ...player.componentLevels };
        const savedWeaponGroups = { ...player.weaponGroups };

        player.switchShip(targetShipId);

        // Restore hero ship state
        player.heroName = savedName;
        player.name = savedName;
        player.componentLevels = savedComponents;
        player.weaponGroups = savedWeaponGroups;
        player.applyComponentUpgrades();

        this.game.ui?.showToast(`Hull upgraded to ${nextTierKey}!`, 'success');
        this.game.audio?.play('quest-complete');
        this.renderHangar();
    }

    /**
     * Upgrade a ship component
     */
    upgradeComponent(compId) {
        const player = this.game.player;
        const def = CONFIG.COMPONENT_UPGRADES?.[compId];
        if (!def || !player) return;

        const currentLevel = player.componentLevels[compId] || 0;
        const nextLevel = currentLevel + 1;
        if (nextLevel >= def.levels.length) return;

        const cost = def.costs[nextLevel];
        if (!this.game.spendCredits(cost)) {
            this.game.ui?.showToast('Not enough credits', 'error');
            return;
        }

        player.componentLevels[compId] = nextLevel;

        // Re-apply all component upgrades (need to reset stats first)
        // The simplest way: switchShip to same class to reset base stats, then reapply
        const savedName = player.heroName;
        const savedModules = {
            high: [...player.modules.high],
            mid: [...player.modules.mid],
            low: [...player.modules.low],
        };
        const savedActiveModules = new Set(player.activeModules);

        // Reset base stats from ship config
        const shipConfig = SHIP_DATABASE[player.shipClass] || CONFIG.SHIPS[player.shipClass];
        if (shipConfig) {
            player.maxSpeed = shipConfig.maxSpeed;
            player.capacitorRegen = shipConfig.capacitorRegen;
            player.maxHull = shipConfig.hull;
            player.hull = player.maxHull;
        }

        // Re-apply component upgrades
        player.applyComponentUpgrades();
        player.name = savedName;

        this.game.ui?.showToast(`${def.name} upgraded to Mk.${nextLevel + 1}!`, 'success');
        this.game.audio?.play('click');
        this.renderHangar();
    }

    // =============================================
    // FACTIONS TAB
    // =============================================

    renderFactions() {
        const container = document.getElementById('factions-content');
        if (!container) return;

        // Get player standings
        const standings = this.game.factionStandings || {};

        // Group factions by tier
        const tiers = {
            1: { label: 'TIER 1 - ELDER RACES', factions: [] },
            2: { label: 'TIER 2 - PATRON RACES', factions: [] },
            3: { label: 'TIER 3 - CLIENT RACES', factions: [] },
        };

        // Separate human factions
        const humanFactions = [];

        for (const [id, fac] of Object.entries(FACTIONS)) {
            if (fac.coalition === 'humanity') {
                humanFactions.push({ id, ...fac });
            } else if (tiers[fac.tier]) {
                tiers[fac.tier].factions.push({ id, ...fac });
            }
        }

        let html = '<div class="factions-container">';

        // Render alien species by tier
        for (const [tier, group] of Object.entries(tiers)) {
            if (group.factions.length === 0) continue;
            html += `<div class="faction-tier-group">
                <div class="faction-tier-header">${group.label}</div>`;

            for (const fac of group.factions) {
                const standing = standings[fac.id] || fac.baseStanding;
                const standingInfo = this._getStandingLabel(standing);
                html += this._buildFactionCard(fac, standing, standingInfo);
            }
            html += '</div>';
        }

        // Human factions
        if (humanFactions.length > 0) {
            html += `<div class="faction-tier-group">
                <div class="faction-tier-header">HUMANITY</div>`;
            for (const fac of humanFactions) {
                const standing = standings[fac.id] || fac.baseStanding;
                const standingInfo = this._getStandingLabel(standing);
                html += this._buildFactionCard(fac, standing, standingInfo);
            }
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Wire up expand/collapse
        container.querySelectorAll('.faction-card-header').forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.faction-card');
                card.classList.toggle('expanded');
            });
        });
    }

    _getStandingLabel(standing) {
        if (standing >= 5) return { label: 'ALLIED', color: '#44ff44' };
        if (standing >= 2) return { label: 'FRIENDLY', color: '#44aaff' };
        if (standing >= -2) return { label: 'NEUTRAL', color: '#888888' };
        if (standing >= -5) return { label: 'UNFRIENDLY', color: '#ff8844' };
        return { label: 'HOSTILE', color: '#ff2222' };
    }

    _buildFactionCard(fac, standing, standingInfo) {
        const standingBar = Math.max(0, Math.min(100, (standing + 10) * 5));
        const traits = (fac.notableTraits || []).map(t => `<span class="faction-trait">${t}</span>`).join('');

        return `
            <div class="faction-card" style="--faction-color: ${fac.color}">
                <div class="faction-card-header">
                    <div class="faction-icon">${fac.icon || ''}</div>
                    <div class="faction-header-info">
                        <div class="faction-name" style="color: ${fac.color}">${fac.name}</div>
                        <div class="faction-subtitle">"${fac.nickname}" | ${fac.coalition ? fac.coalition.charAt(0).toUpperCase() + fac.coalition.slice(1) + ' Coalition' : ''} | Tech Level ${fac.techLevel}</div>
                    </div>
                    <div class="faction-standing-badge" style="color: ${standingInfo.color}">${standingInfo.label}</div>
                    <div class="faction-expand-icon">&#9660;</div>
                </div>
                <div class="faction-card-body">
                    <div class="faction-description">${fac.description}</div>

                    <div class="faction-standing-bar-wrap">
                        <span class="faction-standing-label">Standing: ${standing.toFixed(1)}</span>
                        <div class="faction-standing-bar">
                            <div class="faction-standing-fill" style="width: ${standingBar}%; background: ${standingInfo.color}"></div>
                            <div class="faction-standing-marker" style="left: 50%"></div>
                        </div>
                        <div class="faction-standing-range"><span>HOSTILE</span><span>NEUTRAL</span><span>ALLIED</span></div>
                    </div>

                    ${fac.physicalDescription ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">SPECIES PROFILE</div>
                        <div class="faction-lore-text">${fac.physicalDescription}</div>
                    </div>` : ''}

                    ${fac.homeworld ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">HOMEWORLD</div>
                        <div class="faction-lore-text">${fac.homeworld}</div>
                    </div>` : ''}

                    ${fac.government ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">GOVERNMENT</div>
                        <div class="faction-lore-text">${fac.government}</div>
                    </div>` : ''}

                    ${fac.society ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">SOCIETY & CULTURE</div>
                        <div class="faction-lore-text">${fac.society}</div>
                    </div>` : ''}

                    ${fac.technology ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">TECHNOLOGY</div>
                        <div class="faction-lore-text">${fac.technology}</div>
                    </div>` : ''}

                    ${fac.militaryDoctrine ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">MILITARY DOCTRINE</div>
                        <div class="faction-lore-text">${fac.militaryDoctrine}</div>
                    </div>` : ''}

                    ${fac.humanRelations ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">RELATIONS WITH HUMANITY</div>
                        <div class="faction-lore-text">${fac.humanRelations}</div>
                    </div>` : ''}

                    ${traits ? `
                    <div class="faction-lore-section">
                        <div class="faction-lore-title">NOTABLE TRAITS</div>
                        <div class="faction-traits">${traits}</div>
                    </div>` : ''}

                    <div class="faction-stats-row">
                        <div class="faction-stat"><span class="stat-label">AGGRESSION</span><span class="stat-value">${Math.round(fac.aggressionLevel * 100)}%</span></div>
                        <div class="faction-stat"><span class="stat-label">TECH</span><span class="stat-value">Lv.${fac.techLevel}</span></div>
                        <div class="faction-stat"><span class="stat-label">TRADE</span><span class="stat-value">${(fac.tradeGoods || []).length} goods</span></div>
                        <div class="faction-stat"><span class="stat-label">PREFIX</span><span class="stat-value">${fac.shipPrefix}</span></div>
                    </div>
                </div>
            </div>`;
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

        // Filter ships - use faction catalog if docked at faction station
        const dockedSector = this.game.currentSector;
        const sectorData = dockedSector ? UNIVERSE_LAYOUT_MAP[dockedSector.id] : null;
        const stationFaction = sectorData?.faction || null;
        const hasFactionVariants = stationFaction && FACTION_SHIP_VARIANTS[stationFaction];

        let ships;
        if (hasFactionVariants) {
            // Faction station: show faction-overlaid ships + generic SHIP_DATABASE
            const factionCatalog = getFactionShipCatalog(stationFaction, SHIP_DATABASE);
            // Also include generic ships not in faction catalog
            const factionShipIds = new Set(FACTION_SHIP_VARIANTS[stationFaction] || []);
            const genericShips = Object.entries(SHIP_DATABASE).filter(([id]) => !factionShipIds.has(id));
            ships = [...factionCatalog, ...genericShips];
        } else {
            ships = Object.entries(SHIP_DATABASE);
        }
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
                          </button>
                          <button class="buy-fleet-btn" ${this.game.credits < config.price ? 'disabled' : ''} data-action="buy-fleet-ship" data-ship-id="${shipId}" title="Buy for fleet">
                            +FLEET
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

        // Wire up "Buy for Fleet" buttons
        container.querySelectorAll('[data-action="buy-fleet-ship"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const shipId = btn.dataset.shipId;
                this.purchaseFleetShip(shipId);
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

        // Dispose old renderer to prevent WebGL context leak
        if (this.vendorRenderer) {
            this.vendorRenderer.dispose();
            this.vendorRenderer = null;
        }

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
        this.vendorRenderer.outputEncoding = THREE.sRGBEncoding;
        this.vendorRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.vendorRenderer.toneMappingExposure = 2.5;

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 1.5);
        this.vendorScene.add(ambient);
        const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
        mainLight.position.set(5, 8, 5);
        this.vendorScene.add(mainLight);
        const fillLight = new THREE.DirectionalLight(0x88bbff, 1.0);
        fillLight.position.set(-5, 3, -4);
        this.vendorScene.add(fillLight);
        const backLight = new THREE.DirectionalLight(0x00ccff, 0.6);
        backLight.position.set(0, -5, -5);
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
        this.removeVendorShipMesh();

        // Load async (GLB if available, procedural fallback)
        shipMeshFactory.generateShipMeshAsync({
            shipId,
            role: config.role || 'mercenary',
            size: config.size || 'frigate',
            detailLevel: 'high',
        }).then(mesh => {
            if (!mesh) return;
            this.removeVendorShipMesh();

            // Wrap in a group so we can tilt the group while rotating the mesh inside
            const wrapper = new THREE.Group();

            // Measure original bounds
            const box = new THREE.Box3().setFromObject(mesh);
            const dims = new THREE.Vector3();
            box.getSize(dims);
            const maxDim = Math.max(dims.x, dims.y, dims.z);

            // Normalize to fit camera view (camera at z=120, fov=45)
            if (maxDim > 0) {
                const targetSize = 60;
                const scale = targetSize / maxDim;
                mesh.scale.multiplyScalar(scale);
            }

            // Center the mesh at origin (recalculate box after scaling)
            const scaledBox = new THREE.Box3().setFromObject(mesh);
            const center = new THREE.Vector3();
            scaledBox.getCenter(center);
            mesh.position.sub(center);

            // Detect flat procedural meshes (tiny Z extent) and tilt wrapper
            this._vendorIsProcedural = dims.z < dims.x * 0.3;
            if (this._vendorIsProcedural) {
                wrapper.rotation.x = -Math.PI / 3; // Tilt 60deg toward camera
            }

            wrapper.add(mesh);
            this.vendorShipMesh = wrapper;
            this.vendorScene.add(this.vendorShipMesh);
        });
    }

    removeVendorShipMesh() {
        if (this.vendorShipMesh && this.vendorScene) {
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
    }

    /**
     * Animate the vendor 3D viewer
     */
    animateVendorViewer() {
        if (!this.vendorShipMesh || !this.vendorRenderer || !this.vendorScene) {
            this.vendorAnimationId = null;
            return;
        }

        // Rotate the inner mesh (child of wrapper group) so wrapper tilt stays intact
        const inner = this.vendorShipMesh.children[0];
        if (inner) {
            inner.rotation.y += 0.005;
            if (!this._vendorIsProcedural) {
                inner.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
            }
        }
        this.vendorRenderer.render(this.vendorScene, this.vendorCamera);
        this.vendorAnimationId = requestAnimationFrame(() => this.animateVendorViewer());
    }

    showShipDetail(shipId, container) {
        const resolved = this.resolveShipId(shipId);
        if (!resolved) return;
        const config = resolved.config;

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
            this.setVendorShipMesh(resolved.baseId, config);
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
    // DRONES TAB
    // =============================================

    renderDroneMarket() {
        const container = document.getElementById('drone-market');
        const player = this.game.player;
        if (!container || !player) return;

        const droneBay = player.droneBay;
        const droneSlots = droneBay ? droneBay.capacity : 0;
        const dronesOwned = droneBay ? droneBay.drones.filter(d => d !== null).length : 0;
        const usedBW = player.getUsedBandwidth?.() || 0;
        const totalBW = droneBay?.bandwidth || 0;

        // All purchasable drone types
        const droneTypes = Object.entries(CONFIG.DRONES);

        // Category icons
        const catIcons = { mining: '&#9874;', combat: '&#9876;', ewar: '&#9889;', scout: '&#9678;' };
        const catLabels = { mining: 'Mining', combat: 'Combat', ewar: 'EWAR', scout: 'Scout' };
        const sizeLabels = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };

        const dronesHtml = droneTypes.map(([droneId, config]) => {
            const canAfford = this.game.credits >= config.price;
            const bayFull = dronesOwned >= droneSlots;
            const canBuy = canAfford && !bayFull && droneSlots > 0;

            // Build stat line
            let stats = `${catLabels[config.type] || config.type} ${sizeLabels[config.size] || ''} | ${config.bandwidth} Mbit/s`;
            if (config.damage) stats += ` | ${config.damage} dmg`;
            if (config.miningYield) stats += ` | ${config.miningYield} yield`;
            if (config.ewarType === 'jam') stats += ` | Jam str ${config.jamStrength}`;
            if (config.ewarType === 'damp') stats += ` | Warp disrupt ${config.warpDisruptStrength}`;
            if (config.hp) stats += ` | ${config.hp} HP`;
            if (config.speed) stats += ` | ${config.speed} m/s`;

            const icon = catIcons[config.type] || '&#9679;';

            return `
                <div class="shop-item ${!canBuy ? 'too-expensive' : ''}" data-drone-id="${droneId}">
                    <div class="item-info">
                        <div class="item-name">${icon} ${config.name}</div>
                        <div class="item-desc">${stats}</div>
                    </div>
                    <div class="item-price">${formatCredits(config.price)} ISK</div>
                    <button class="buy-btn" ${!canBuy ? 'disabled' : ''} data-action="buy-drone" data-drone-id="${droneId}">
                        ${bayFull ? 'BAY FULL' : (canAfford ? 'BUY' : '---')}
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="drones-market-header">
                <h3>DRONE MARKET</h3>
                <span class="drones-market-info">Bay: ${dronesOwned}/${droneSlots} | BW: ${usedBW}/${totalBW} Mbit/s</span>
            </div>
            <div class="market-list">${dronesHtml}</div>
        `;

        // Wire buy buttons
        container.querySelectorAll('[data-action="buy-drone"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const droneId = btn.dataset.droneId;
                this.purchaseDrone(droneId);
            });
        });
    }

    purchaseDrone(droneId) {
        const player = this.game.player;
        const config = CONFIG.DRONES[droneId];
        if (!player || !config) return;

        if (this.game.credits < config.price) {
            this.game.ui?.toast('Insufficient funds', 'error');
            return;
        }

        const droneBay = player.droneBay;
        if (!droneBay || droneBay.capacity <= 0) {
            this.game.ui?.toast('No drone bay on this ship', 'error');
            return;
        }

        // Find empty slot
        let emptySlot = -1;
        for (let i = 0; i < droneBay.capacity; i++) {
            if (!droneBay.drones[i]) {
                emptySlot = i;
                break;
            }
        }

        // If no empty slot, check if we can add to end (within capacity)
        if (emptySlot === -1 && droneBay.drones.length < droneBay.capacity) {
            emptySlot = droneBay.drones.length;
        }

        if (emptySlot === -1) {
            this.game.ui?.toast('Drone bay is full', 'error');
            return;
        }

        // Purchase
        this.game.credits -= config.price;
        droneBay.drones[emptySlot] = {
            type: droneId,
            hp: config.hp || 50,
        };

        this.game.audio?.play('purchase');
        this.game.ui?.toast(`Purchased ${config.name}!`, 'success');
        this.game.ui?.log(`Purchased ${config.name} for ${formatCredits(config.price)} ISK`, 'system');
        this.game.ui?.updateHUD();

        // Refresh
        this.renderDroneMarket();
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

        // CPU/PG
        const cpuUsed = player.getUsedCpu();
        const cpuMax = player.maxCpu;
        const pgUsed = player.getUsedPowergrid();
        const pgMax = player.maxPowergrid;
        const cpuOver = cpuUsed > cpuMax;
        const pgOver = pgUsed > pgMax;

        // Resists
        const resists = player.getEffectiveResists();
        const rCell = (v) => {
            const c = v >= 0.7 ? '#44ff44' : v >= 0.4 ? '#aaff44' : v >= 0.2 ? '#ffcc44' : '#ff4444';
            return `<span style="color:${c}">${Math.round(v*100)}%</span>`;
        };

        // Build live stats
        const statsHtml = `
            <div class="fitting-stat-group">
                <h4>FITTING</h4>
                <div class="detail-row"><span>CPU</span><span class="${cpuOver ? 'overfit' : ''}">${cpuUsed}/${cpuMax} tf</span></div>
                <div class="detail-row"><span>Powergrid</span><span class="${pgOver ? 'overfit' : ''}">${pgUsed}/${pgMax} MW</span></div>
            </div>
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
                <div class="detail-row"><span>EHP</span><span>${Math.floor(player.getEffectiveHp()).toLocaleString()}</span></div>
            </div>
            <div class="fitting-stat-group">
                <h4>RESISTANCES</h4>
                <div class="resist-mini-grid">
                    <div class="resist-row"><span></span><span style="color:#44aaff">EM</span><span style="color:#ff8844">TH</span><span style="color:#aaa">KI</span><span style="color:#ffcc44">EX</span></div>
                    <div class="resist-row"><span>SH</span>${rCell(resists.shield.em)}${rCell(resists.shield.thermal)}${rCell(resists.shield.kinetic)}${rCell(resists.shield.explosive)}</div>
                    <div class="resist-row"><span>AR</span>${rCell(resists.armor.em)}${rCell(resists.armor.thermal)}${rCell(resists.armor.kinetic)}${rCell(resists.armor.explosive)}</div>
                    <div class="resist-row"><span>HL</span>${rCell(resists.hull.em)}${rCell(resists.hull.thermal)}${rCell(resists.hull.kinetic)}${rCell(resists.hull.explosive)}</div>
                </div>
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

        // Wire slot click events - opens equipment picker
        fittingDisplay.querySelectorAll('.fitting-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const slotId = slot.dataset.slotId;
                if (e.target.closest('[data-action="unfit"]')) {
                    this.unfitModule(slotId);
                    return;
                }
                // Toggle equipment picker for this slot
                this._openEquipmentPicker(slot, slotId);
            });
        });

        // Wire inventory click events (keep as fallback)
        fittingDisplay.querySelectorAll('.fitting-inventory-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectedInventoryIndex = this.selectedInventoryIndex === index ? null : index;
                this.renderFitting();
            });
        });

        // Fitting templates section
        const templateContainer = document.createElement('div');
        templateContainer.style.cssText = 'margin-top:12px;border-top:1px solid #333;padding-top:8px';
        this.game.ui?.fittingTemplateManager?.renderTemplateSection(templateContainer);
        fittingDisplay.appendChild(templateContainer);
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
        if (config.damageBonus || config.maserDamageBonus || config.missileDamageBonus) return '&#9733;';
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

    /**
     * Resolve a ship ID (which may be a faction variant like "ruhar-slasher") to
     * { baseId, config } where baseId is the SHIP_DATABASE key and config has faction overlay if applicable.
     */
    resolveShipId(shipId) {
        // Direct match in SHIP_DATABASE
        if (SHIP_DATABASE[shipId]) {
            return { baseId: shipId, config: SHIP_DATABASE[shipId] };
        }
        // Faction variant: "factionId-baseShipId"
        const dashIdx = shipId.indexOf('-');
        if (dashIdx > 0) {
            const factionId = shipId.substring(0, dashIdx);
            const baseId = shipId.substring(dashIdx + 1);
            // Handle multi-dash base IDs (e.g. "ruhar-hero-frigate")
            const baseConfig = SHIP_DATABASE[baseId] || SHIP_DATABASE[shipId.substring(shipId.indexOf('-') + 1)];
            if (baseConfig && FACTIONS[factionId]) {
                return { baseId, config: applyFactionOverlay(baseConfig, baseId, factionId) };
            }
        }
        return null;
    }

    purchaseShip(shipId) {
        const player = this.game.player;
        const resolved = this.resolveShipId(shipId);
        if (!player || !resolved) return;
        const { baseId, config } = resolved;

        const tradeInValue = this.calculateTradeInValue();
        const finalPrice = config.price - tradeInValue;

        if (this.game.credits < finalPrice) {
            this.game.ui?.toast('Insufficient funds', 'error');
            return;
        }

        this.game.credits -= finalPrice;
        player.switchShip(baseId);

        this.game.audio?.play('purchase');
        this.game.ui?.toast(`Purchased ${config.name}!`, 'success');
        this.game.ui?.log(`Purchased ${config.name} for ${formatCredits(finalPrice)} ISK (trade-in: ${formatCredits(tradeInValue)} ISK)`, 'system');
        this.game.ui?.updateHUD();

        // Refresh ships display
        this.renderShips();
    }

    purchaseFleetShip(shipId) {
        const resolved = this.resolveShipId(shipId);
        if (!resolved) return;
        const { baseId, config } = resolved;

        if (this.game.credits < config.price) {
            this.game.ui?.toast('Insufficient funds', 'error');
            return;
        }

        // Deduct full price (no trade-in for fleet ships)
        this.game.credits -= config.price;

        // Add ship to fleet via FleetSystem
        const fleetShip = this.game.fleetSystem?.addShip(baseId, null);
        if (fleetShip) {
            this.game.audio?.play('purchase');
            this.game.ui?.toast(`${config.name} added to fleet!`, 'success');
            this.game.ui?.log(`Purchased ${config.name} for fleet - ${formatCredits(config.price)} ISK`, 'system');
            this.game.events.emit('fleet:ship-purchased', { shipId: baseId, ship: fleetShip });
        }

        this.game.ui?.updateHUD();
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

        // Encyclopedia discovery
        this.game.encyclopedia?.discoverItem('equipment', equipId);

        // Refresh
        this.renderEquipment();
    }

    // =============================================
    // FITTING LOGIC
    // =============================================

    /**
     * Open an equipment picker popup below a fitting slot.
     * Shows compatible inventory items with stat comparison vs currently fitted module.
     */
    _openEquipmentPicker(slotEl, slotId) {
        // Close any existing picker
        const existing = document.querySelector('.fitting-equipment-picker');
        if (existing) {
            // If clicking same slot, just close
            if (existing.dataset.slotId === slotId) { existing.remove(); return; }
            existing.remove();
        }

        const player = this.game.player;
        if (!player) return;

        const [slotType, slotNum] = slotId.split('-');
        const slotIndex = parseInt(slotNum) - 1;

        // Get currently fitted module
        const currentId = player.modules[slotType]?.[slotIndex];
        const currentConfig = currentId ? (EQUIPMENT_DATABASE[currentId] || CONFIG.MODULES[currentId]) : null;

        // Map internal slot type to equipment slot field
        const reverseMap = { high: 'weapon', mid: 'module', low: 'subsystem' };
        const equipSlot = reverseMap[slotType];

        // Filter inventory for compatible items
        const inventory = player.moduleInventory || [];
        const compatible = [];
        inventory.forEach((item, idx) => {
            const cfg = item.config || EQUIPMENT_DATABASE[item.id] || CONFIG.MODULES[item.id];
            if (!cfg) return;
            const itemInternalSlot = cfg.slot === 'weapon' ? 'high' : cfg.slot === 'module' ? 'mid' : cfg.slot === 'subsystem' ? 'low' : cfg.slot;
            if (itemInternalSlot === slotType) {
                compatible.push({ index: idx, id: item.id, config: cfg });
            }
        });

        // Build picker HTML
        const picker = document.createElement('div');
        picker.className = 'fitting-equipment-picker';
        picker.dataset.slotId = slotId;

        if (compatible.length === 0 && !currentId) {
            picker.innerHTML = `
                <div class="picker-header">No compatible modules in inventory</div>
                <div class="picker-hint">Buy modules from the MARKET tab</div>
            `;
        } else {
            // Build stat comparison helper
            const statDiff = (label, newVal, oldVal, unit = '', higher = true) => {
                if (newVal === undefined && oldVal === undefined) return '';
                const nv = newVal || 0, ov = oldVal || 0;
                const diff = nv - ov;
                if (diff === 0 && nv === 0) return '';
                const cls = diff > 0 ? (higher ? 'stat-better' : 'stat-worse') :
                            diff < 0 ? (higher ? 'stat-worse' : 'stat-better') : 'stat-same';
                const arrow = diff > 0 ? '+' : '';
                const diffStr = diff !== 0 ? `<span class="${cls}">${arrow}${diff.toFixed?.(1) || diff}${unit}</span>` : '';
                return `<div class="picker-stat"><span class="stat-label">${label}</span><span class="stat-val">${nv}${unit}</span>${diffStr}</div>`;
            };

            // Build item rows
            let itemsHtml = '';
            for (const item of compatible) {
                const c = item.config;
                let statsHtml = '';

                // Weapon stats
                if (c.damage !== undefined) statsHtml += statDiff('DMG', c.damage, currentConfig?.damage, '');
                if (c.optimalRange !== undefined) statsHtml += statDiff('Range', c.optimalRange, currentConfig?.optimalRange, 'm');
                if (c.cycleTime !== undefined) statsHtml += statDiff('Cycle', c.cycleTime, currentConfig?.cycleTime, 's', false);
                if (c.trackingSpeed !== undefined) statsHtml += statDiff('Track', c.trackingSpeed, currentConfig?.trackingSpeed, '');
                // DPS calc
                if (c.damage && c.cycleTime) {
                    const newDps = (c.damage / c.cycleTime).toFixed(1);
                    const oldDps = currentConfig?.damage && currentConfig?.cycleTime ? (currentConfig.damage / currentConfig.cycleTime).toFixed(1) : 0;
                    statsHtml += statDiff('DPS', parseFloat(newDps), parseFloat(oldDps), '');
                }

                // Defense stats
                if (c.shieldRepair !== undefined) statsHtml += statDiff('Shield Rep', c.shieldRepair, currentConfig?.shieldRepair, '/s');
                if (c.armorRepair !== undefined) statsHtml += statDiff('Armor Rep', c.armorRepair, currentConfig?.armorRepair, '/s');
                if (c.shieldBonus !== undefined) statsHtml += statDiff('Shield+', c.shieldBonus, currentConfig?.shieldBonus, '');
                if (c.armorBonus !== undefined) statsHtml += statDiff('Armor+', c.armorBonus, currentConfig?.armorBonus, '');

                // Utility stats
                if (c.speedBonus !== undefined) statsHtml += statDiff('Speed', c.speedBonus, currentConfig?.speedBonus, '%');
                if (c.maxSpeedBonus !== undefined) statsHtml += statDiff('Speed', c.maxSpeedBonus, currentConfig?.maxSpeedBonus, '%');
                if (c.miningYield !== undefined) statsHtml += statDiff('Yield', c.miningYield, currentConfig?.miningYield, '');
                if (c.miningYieldBonus !== undefined) statsHtml += statDiff('Yield+', c.miningYieldBonus, currentConfig?.miningYieldBonus, '%');
                if (c.capacitorUse !== undefined) statsHtml += statDiff('Cap Use', c.capacitorUse, currentConfig?.capacitorUse, ' GJ', false);

                // EWAR
                if (c.warpDisrupt !== undefined) statsHtml += statDiff('Disrupt', c.warpDisrupt, currentConfig?.warpDisrupt, '');
                if (c.webFactor !== undefined) statsHtml += statDiff('Web', Math.round((c.webFactor || 0) * 100), Math.round((currentConfig?.webFactor || 0) * 100), '%');

                itemsHtml += `
                    <div class="picker-item" data-inv-index="${item.index}">
                        <div class="picker-item-header">
                            <span class="picker-icon">${this.getModuleIcon(c)}</span>
                            <span class="picker-name">${c.name}</span>
                            ${c.size ? `<span class="picker-size">${c.size.toUpperCase()}</span>` : ''}
                        </div>
                        <div class="picker-stats">${statsHtml || '<div class="picker-stat"><span class="stat-label">Utility module</span></div>'}</div>
                    </div>
                `;
            }

            // Unfit option if slot is occupied
            let unfitHtml = '';
            if (currentId && currentConfig) {
                unfitHtml = `<div class="picker-item picker-unfit" data-action="unfit-slot">
                    <span class="picker-icon" style="color:#ff6644">&#10006;</span>
                    <span class="picker-name">Remove ${currentConfig.name}</span>
                </div>`;
            }

            picker.innerHTML = `
                <div class="picker-header">${currentConfig ? 'Replace' : 'Fit'}: ${currentConfig?.name || 'Empty Slot'}</div>
                ${unfitHtml}
                ${itemsHtml || '<div class="picker-hint">No compatible modules in inventory</div>'}
            `;
        }

        // Insert picker after the slot element
        slotEl.parentNode.insertBefore(picker, slotEl.nextSibling);

        // Wire picker item clicks
        picker.querySelectorAll('.picker-item[data-inv-index]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const invIndex = parseInt(el.dataset.invIndex);
                this._fitFromPicker(slotId, invIndex);
            });
        });

        // Wire unfit button
        const unfitBtn = picker.querySelector('[data-action="unfit-slot"]');
        if (unfitBtn) {
            unfitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unfitModule(slotId);
            });
        }

        // Close picker when clicking outside
        const closePicker = (e) => {
            if (!picker.contains(e.target) && !slotEl.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closePicker);
            }
        };
        setTimeout(() => document.addEventListener('click', closePicker), 0);
    }

    /**
     * Fit a module from a specific inventory index to a slot (used by equipment picker).
     */
    _fitFromPicker(slotId, inventoryIndex) {
        const player = this.game.player;
        if (!player) return;

        const inventory = player.moduleInventory || [];
        const module = inventory[inventoryIndex];
        if (!module) return;

        const config = module.config || EQUIPMENT_DATABASE[module.id] || CONFIG.MODULES[module.id];
        if (!config) return;

        const [slotType, slotNum] = slotId.split('-');
        const slotIndex = parseInt(slotNum) - 1;

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

        // Remove from inventory (adjust index if we just pushed an existing module)
        const adjustedIndex = existingModuleId ? inventoryIndex : inventoryIndex;
        inventory.splice(adjustedIndex, 1);

        this.game.audio?.play('click');
        this.game.ui?.toast(`Fitted ${config.name}`, 'success');
        this.selectedInventoryIndex = null;
        this.renderFitting();
    }

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
