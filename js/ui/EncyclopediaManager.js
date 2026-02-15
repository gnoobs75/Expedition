// =============================================
// Encyclopedia Manager - "Expedition Codex"
// In-game encyclopedia with 3D ship previews,
// stat comparisons, discovery tracking, and search
// =============================================

import { SHIP_DATABASE, SHIP_ROLES, SHIP_SIZES } from '../data/shipDatabase.js';
import { EQUIPMENT_DATABASE, EQUIPMENT_CATEGORIES } from '../data/equipmentDatabase.js';
import { GUILD_FACTIONS } from '../data/guildFactionDatabase.js';
import { TRADE_GOODS, TRADE_CATEGORIES, STATION_SPECIALTIES, getStationPrice } from '../data/tradeGoodsDatabase.js';
import { UNIVERSE_LAYOUT } from '../config.js';
import { formatCredits } from '../utils/math.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';

const ITEMS_PER_PAGE = 24;

const SIZE_ORDER = ['frigate', 'destroyer', 'cruiser', 'battlecruiser', 'battleship', 'capital'];
const SIZE_RADII = { frigate: 18, destroyer: 35, cruiser: 70, battlecruiser: 110, battleship: 180, capital: 320 };

const ROLE_COLORS = {
    mining: '#ffaa44', hauler: '#44dd88', salvager: '#cc88ff', harvester: '#88ff44',
    mercenary: '#ff4466', police: '#4488ff', military: '#66aaff', pirate: '#cc2244',
    surveyor: '#44dddd', logistics: '#ff88cc',
};

const DIFF_COLORS = {
    hub: '#44ddff', safe: '#44ff88', normal: '#ffdd44', dangerous: '#ff8844', deadly: '#ff4444',
};

const ROLE_ACCENT_HEX = {
    mining: 0xffdd00, hauler: 0x66ccee, salvager: 0xddaa66, harvester: 0x55eeaa,
    mercenary: 0xff5533, police: 0x88bbff, military: 0x7799bb, pirate: 0xee3333,
    surveyor: 0x55ffbb, logistics: 0x66ddff,
};

export class EncyclopediaManager {
    constructor(game) {
        this.game = game;
        this.visible = false;

        // View state
        this.activeTab = 'ships';
        this.currentPage = 0;
        this.viewMode = 'grid'; // 'grid' | 'detail' | 'compare'
        this.detailItem = null;
        this.compareShipA = null;
        this.compareShipB = null;
        this.searchQuery = '';

        // Filters
        this.filters = { role: 'all', size: 'all', slot: 'all', eqSize: 'all', category: 'all' };
        this.sortBy = 'name';
        this.sortAsc = true;

        // 3D viewers
        this.viewers = {};
        this.animFrames = {};

        // Thumbnail renderer (shared offscreen)
        this.thumbCache = {};
        this.thumbRenderer = null;
        this.thumbScene = null;
        this.thumbCamera = null;

        // Discovery tracking
        this.discoveries = this.loadDiscoveries();

        // Auto-discover player's starting ship + hub sector
        this.discoverItem('ships', 'hero-frigate');
        this.discoverItem('ships', 'venture');
        this.discoverItem('sectors', 'hub');

        // Search index
        this.searchIndex = [];
        this.buildSearchIndex();

        // Build DOM
        this.createDOM();
        this.bindEvents();
    }

    // =============================================
    // DISCOVERY TRACKING
    // =============================================

    loadDiscoveries() {
        try {
            const saved = localStorage.getItem('expedition-discoveries');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return { ships: {}, equipment: {}, factions: {}, sectors: {}, tradegoods: {} };
    }

    saveDiscoveries() {
        try {
            localStorage.setItem('expedition-discoveries', JSON.stringify(this.discoveries));
        } catch (e) { /* ignore */ }
    }

    discoverItem(category, id) {
        if (!this.discoveries[category]) this.discoveries[category] = {};
        if (!this.discoveries[category][id]) {
            this.discoveries[category][id] = true;
            this.saveDiscoveries();
            if (this.visible) this.updateDiscoveryCounts();
        }
    }

    isDiscovered(category, id) {
        return !!this.discoveries[category]?.[id];
    }

    getDiscoveryCount(category) {
        return Object.keys(this.discoveries[category] || {}).length;
    }

    revealAll() {
        for (const id of Object.keys(SHIP_DATABASE)) this.discoveries.ships[id] = true;
        for (const id of Object.keys(EQUIPMENT_DATABASE)) this.discoveries.equipment[id] = true;
        for (const id of Object.keys(GUILD_FACTIONS)) this.discoveries.factions[id] = true;
        for (const sec of UNIVERSE_LAYOUT.sectors) this.discoveries.sectors[sec.id] = true;
        for (const id of Object.keys(TRADE_GOODS)) this.discoveries.tradegoods[id] = true;
        this.saveDiscoveries();
        this.updateDiscoveryCounts();
        this.renderCurrentTab();
    }

    getTotalCount(category) {
        switch (category) {
            case 'ships': return Object.keys(SHIP_DATABASE).length;
            case 'equipment': return Object.keys(EQUIPMENT_DATABASE).length;
            case 'factions': return Object.keys(GUILD_FACTIONS).length;
            case 'sectors': return UNIVERSE_LAYOUT.sectors.length;
            case 'tradegoods': return Object.keys(TRADE_GOODS).length;
            default: return 0;
        }
    }

    // =============================================
    // SEARCH INDEX
    // =============================================

    buildSearchIndex() {
        this.searchIndex = [];

        // Ships
        for (const [id, ship] of Object.entries(SHIP_DATABASE)) {
            this.searchIndex.push({
                id, category: 'ships', name: ship.name,
                tokens: `${ship.name} ${ship.description || ''} ${ship.role} ${ship.size} ship`.toLowerCase(),
            });
        }
        // Equipment
        for (const [id, eq] of Object.entries(EQUIPMENT_DATABASE)) {
            this.searchIndex.push({
                id, category: 'equipment', name: eq.name,
                tokens: `${eq.name} ${eq.description || ''} ${eq.slot} ${eq.size} ${eq.category}`.toLowerCase(),
            });
        }
        // Factions
        for (const [id, fac] of Object.entries(GUILD_FACTIONS)) {
            this.searchIndex.push({
                id, category: 'factions', name: fac.name,
                tokens: `${fac.name} ${fac.shortName} ${fac.description || ''} faction guild`.toLowerCase(),
            });
        }
        // Sectors
        for (const sec of UNIVERSE_LAYOUT.sectors) {
            this.searchIndex.push({
                id: sec.id, category: 'sectors', name: sec.name,
                tokens: `${sec.name} ${sec.difficulty} sector ${STATION_SPECIALTIES[sec.id]?.specialty || ''}`.toLowerCase(),
            });
        }
        // Trade goods
        for (const [id, good] of Object.entries(TRADE_GOODS)) {
            this.searchIndex.push({
                id, category: 'tradegoods', name: good.name,
                tokens: `${good.name} ${good.description || ''} ${good.category} trade goods`.toLowerCase(),
            });
        }
    }

    search(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        return this.searchIndex.filter(item => item.tokens.includes(q));
    }

    // =============================================
    // DOM CREATION
    // =============================================

    createDOM() {
        const overlay = document.createElement('div');
        overlay.id = 'encyclopedia';
        overlay.className = 'hidden';

        overlay.innerHTML = `
            <div class="enc-container">
                <div class="enc-header">
                    <div class="enc-title">EXPEDITION CODEX</div>
                    <div class="enc-search-wrap">
                        <input type="text" class="enc-search" placeholder="Search the codex..." />
                    </div>
                    <div class="enc-discovery-total"></div>
                    <button class="enc-reveal-all">Reveal All</button>
                    <button class="enc-close">\u2715</button>
                </div>
                <div class="enc-tabs">
                    <button class="enc-tab active" data-tab="ships">SHIPS <span class="enc-tab-count"></span></button>
                    <button class="enc-tab" data-tab="equipment">EQUIPMENT <span class="enc-tab-count"></span></button>
                    <button class="enc-tab" data-tab="factions">FACTIONS <span class="enc-tab-count"></span></button>
                    <button class="enc-tab" data-tab="universe">UNIVERSE <span class="enc-tab-count"></span></button>
                    <button class="enc-tab" data-tab="tradegoods">TRADE GOODS <span class="enc-tab-count"></span></button>
                    <button class="enc-tab" data-tab="sounds">SOUNDS</button>
                </div>
                <div class="enc-toolbar"></div>
                <div class="enc-content"></div>
                <div class="enc-footer">
                    <button class="enc-page-btn enc-prev">\u25C0 Prev</button>
                    <span class="enc-page-info"></span>
                    <button class="enc-page-btn enc-next">Next \u25B6</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.el = overlay;
        this.contentEl = overlay.querySelector('.enc-content');
        this.toolbarEl = overlay.querySelector('.enc-toolbar');
        this.footerEl = overlay.querySelector('.enc-footer');

        this.updateDiscoveryCounts();
    }

    // =============================================
    // EVENT BINDING
    // =============================================

    bindEvents() {
        // Close button
        this.el.querySelector('.enc-close').addEventListener('click', () => this.toggle());

        // Reveal all button
        this.el.querySelector('.enc-reveal-all').addEventListener('click', () => this.revealAll());

        // Tab clicks
        this.el.querySelectorAll('.enc-tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Search
        const searchInput = this.el.querySelector('.enc-search');
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = searchInput.value.trim();
                if (this.searchQuery.length >= 2) {
                    this.viewMode = 'grid';
                    this.currentPage = 0;
                    this.renderSearchResults();
                } else if (this.searchQuery.length === 0) {
                    this.renderCurrentTab();
                }
            }, 200);
        });

        // Pagination
        this.el.querySelector('.enc-prev').addEventListener('click', () => {
            if (this.currentPage > 0) { this.currentPage--; this.renderCurrentTab(); }
        });
        this.el.querySelector('.enc-next').addEventListener('click', () => {
            this.currentPage++;
            this.renderCurrentTab();
        });

        // Close on overlay click
        this.el.addEventListener('click', (e) => {
            if (e.target === this.el) this.toggle();
        });

        // Escape to close or go back
        this.el.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.viewMode !== 'grid') {
                    this.viewMode = 'grid';
                    this.renderCurrentTab();
                } else {
                    this.toggle();
                }
                e.stopPropagation();
            }
        });
    }

    // =============================================
    // TOGGLE & VIEW CONTROL
    // =============================================

    toggle() {
        this.visible = !this.visible;
        this.el.classList.toggle('hidden', !this.visible);

        if (this.visible) {
            this.updateDiscoveryCounts();
            this.renderCurrentTab();
        } else {
            // Dispose all 3D viewers on close
            this.disposeAllViewers();
        }
    }

    switchTab(tab) {
        this.activeTab = tab;
        this.viewMode = 'grid';
        this.currentPage = 0;
        this.searchQuery = '';
        this.el.querySelector('.enc-search').value = '';
        this.filters = { role: 'all', size: 'all', slot: 'all', eqSize: 'all', category: 'all' };
        this.sortBy = 'name';
        this.sortAsc = true;

        this.el.querySelectorAll('.enc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        this.renderCurrentTab();
    }

    renderCurrentTab() {
        this.disposeAllViewers();
        switch (this.activeTab) {
            case 'ships':
                if (this.viewMode === 'detail') this.renderShipDetail(this.detailItem);
                else if (this.viewMode === 'compare') this.renderShipCompare();
                else this.renderShipGrid();
                break;
            case 'equipment':
                if (this.viewMode === 'detail') this.renderEquipmentDetail(this.detailItem);
                else this.renderEquipmentGrid();
                break;
            case 'factions':
                if (this.viewMode === 'detail') this.renderFactionDetail(this.detailItem);
                else this.renderFactionList();
                break;
            case 'universe':
                if (this.viewMode === 'detail') this.renderUniverseDetail(this.detailItem);
                else this.renderUniverseOverview();
                break;
            case 'tradegoods':
                if (this.viewMode === 'detail') this.renderTradeGoodDetail(this.detailItem);
                else this.renderTradeGoodsGrid();
                break;
            case 'sounds':
                this.renderSoundsGrid();
                break;
        }
    }

    updateDiscoveryCounts() {
        const tabs = this.el.querySelectorAll('.enc-tab');
        const categories = ['ships', 'equipment', 'factions', 'sectors', 'tradegoods'];
        let totalDisc = 0, totalAll = 0;

        tabs.forEach((tab, i) => {
            if (tab.dataset.tab === 'sounds') return; // No discovery tracking for SOUNDS
            const cat = categories[i];
            if (!cat) return;
            const disc = this.getDiscoveryCount(cat);
            const total = this.getTotalCount(cat);
            const countEl = tab.querySelector('.enc-tab-count');
            if (countEl) countEl.textContent = `(${disc}/${total})`;
            totalDisc += disc;
            totalAll += total;
        });

        this.el.querySelector('.enc-discovery-total').textContent = `Discovered: ${totalDisc}/${totalAll}`;
    }

    // =============================================
    // SHIP GRID
    // =============================================

    renderShipGrid() {
        this.renderShipToolbar();
        const entries = this.getFilteredShips();
        const { paged, totalPages } = this.paginate(entries);

        let html = '<div class="enc-grid">';
        for (const [id, ship] of paged) {
            const discovered = this.isDiscovered('ships', id);
            html += this.renderShipCard(id, ship, discovered);
        }
        html += '</div>';
        this.contentEl.innerHTML = html;
        this.renderPagination(totalPages);

        // Card click handlers
        this.contentEl.querySelectorAll('.enc-card').forEach(card => {
            card.addEventListener('click', () => {
                const shipId = card.dataset.id;
                this.detailItem = shipId;
                this.viewMode = 'detail';
                this.renderCurrentTab();
            });
        });

        // Async-load ship thumbnails
        this.loadGridThumbnails();
    }

    renderShipCard(id, ship, discovered) {
        const roleColor = ROLE_COLORS[ship.role] || '#888';
        if (!discovered) {
            return `<div class="enc-card enc-undiscovered" data-id="${id}">
                <div class="enc-card-preview enc-preview-locked"></div>
                <div class="enc-card-body">
                    <div class="enc-card-lock">\u{1F512}</div>
                    <div class="enc-card-name">???</div>
                    <div class="enc-card-sub">Encounter to unlock</div>
                </div>
            </div>`;
        }
        const totalHP = ship.shield + ship.armor + ship.hull;
        return `<div class="enc-card" data-id="${id}" style="--role-color:${roleColor}">
            <div class="enc-card-preview">
                <img class="enc-card-thumb" alt="" />
                <div class="enc-card-scanline"></div>
            </div>
            <div class="enc-card-body">
                <div class="enc-card-badges">
                    <span class="enc-badge-role" style="background:${roleColor}">${ship.role}</span>
                    <span class="enc-badge-size">${ship.size}</span>
                </div>
                <div class="enc-card-name">${ship.name}</div>
                <div class="enc-card-stats">
                    <span>\u2764 ${totalHP}</span>
                    <span>\u26A1 ${ship.maxSpeed}</span>
                    <span>${formatCredits(ship.price)} ISK</span>
                </div>
                ${ship.guildExclusive ? `<div class="enc-card-guild">${ship.guildExclusive}</div>` : ''}
            </div>
        </div>`;
    }

    renderShipToolbar() {
        this.toolbarEl.innerHTML = `
            <div class="enc-toolbar-row">
                <label>Role: <select class="enc-filter" data-filter="role">
                    <option value="all">All</option>
                    ${Object.values(SHIP_ROLES).map(r => `<option value="${r}"${this.filters.role === r ? ' selected' : ''}>${r}</option>`).join('')}
                </select></label>
                <label>Size: <select class="enc-filter" data-filter="size">
                    <option value="all">All</option>
                    ${Object.values(SHIP_SIZES).map(s => `<option value="${s}"${this.filters.size === s ? ' selected' : ''}>${s}</option>`).join('')}
                </select></label>
                <label>Sort: <select class="enc-sort">
                    <option value="name"${this.sortBy === 'name' ? ' selected' : ''}>Name</option>
                    <option value="price"${this.sortBy === 'price' ? ' selected' : ''}>Price</option>
                    <option value="speed"${this.sortBy === 'speed' ? ' selected' : ''}>Speed</option>
                    <option value="hp"${this.sortBy === 'hp' ? ' selected' : ''}>Total HP</option>
                    <option value="cargo"${this.sortBy === 'cargo' ? ' selected' : ''}>Cargo</option>
                </select></label>
                <button class="enc-sort-dir">${this.sortAsc ? '\u25B2' : '\u25BC'}</button>
                <button class="enc-back-btn ${this.viewMode === 'grid' ? 'hidden' : ''}">\u25C0 Back to Grid</button>
            </div>
        `;
        this.toolbarEl.querySelectorAll('.enc-filter').forEach(sel => {
            sel.addEventListener('change', () => {
                this.filters[sel.dataset.filter] = sel.value;
                this.currentPage = 0;
                this.renderCurrentTab();
            });
        });
        this.toolbarEl.querySelector('.enc-sort').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.currentPage = 0;
            this.renderCurrentTab();
        });
        this.toolbarEl.querySelector('.enc-sort-dir').addEventListener('click', () => {
            this.sortAsc = !this.sortAsc;
            this.renderCurrentTab();
        });
        const backBtn = this.toolbarEl.querySelector('.enc-back-btn');
        backBtn.addEventListener('click', () => {
            this.viewMode = 'grid';
            this.renderCurrentTab();
        });
    }

    getFilteredShips() {
        let entries = Object.entries(SHIP_DATABASE);
        if (this.filters.role !== 'all') entries = entries.filter(([, s]) => s.role === this.filters.role);
        if (this.filters.size !== 'all') entries = entries.filter(([, s]) => s.size === this.filters.size);

        entries.sort((a, b) => {
            let va, vb;
            switch (this.sortBy) {
                case 'price': va = a[1].price; vb = b[1].price; break;
                case 'speed': va = a[1].maxSpeed; vb = b[1].maxSpeed; break;
                case 'hp': va = a[1].shield + a[1].armor + a[1].hull; vb = b[1].shield + b[1].armor + b[1].hull; break;
                case 'cargo': va = a[1].cargoCapacity; vb = b[1].cargoCapacity; break;
                default: va = a[1].name.toLowerCase(); vb = b[1].name.toLowerCase();
            }
            if (va < vb) return this.sortAsc ? -1 : 1;
            if (va > vb) return this.sortAsc ? 1 : -1;
            return 0;
        });
        return entries;
    }

    // =============================================
    // SHIP DETAIL VIEW
    // =============================================

    renderShipDetail(shipId) {
        const ship = SHIP_DATABASE[shipId];
        if (!ship) return;

        this.renderShipToolbar();
        this.toolbarEl.querySelector('.enc-back-btn').classList.remove('hidden');

        const discovered = this.isDiscovered('ships', shipId);
        if (!discovered) {
            this.contentEl.innerHTML = `<div class="enc-detail-locked">
                <div class="enc-lock-big">\u{1F512}</div>
                <h2>Unknown Ship</h2>
                <p>Encounter this ship in space to unlock its codex entry.</p>
                <button class="enc-back-link">\u25C0 Back</button>
            </div>`;
            this.contentEl.querySelector('.enc-back-link').addEventListener('click', () => {
                this.viewMode = 'grid'; this.renderCurrentTab();
            });
            return;
        }

        const roleColor = ROLE_COLORS[ship.role] || '#888';
        const totalHP = ship.shield + ship.armor + ship.hull;

        // Find max stats for same size class for bar normalization
        const sameSize = Object.values(SHIP_DATABASE).filter(s => s.size === ship.size);
        const maxShield = Math.max(...sameSize.map(s => s.shield));
        const maxArmor = Math.max(...sameSize.map(s => s.armor));
        const maxHull = Math.max(...sameSize.map(s => s.hull));
        const maxSpeed = Math.max(...sameSize.map(s => s.maxSpeed));
        const maxCap = Math.max(...sameSize.map(s => s.capacitor));

        // Construction costs
        const isIndustrial = ['mining', 'hauler', 'salvager', 'harvester'].includes(ship.role);
        const matCost = ship.price * 0.6;
        const minerals = Math.floor(matCost * (isIndustrial ? 0.50 : 0.35));
        const electronics = Math.floor(matCost * (isIndustrial ? 0.25 : 0.30));
        const components = Math.floor(matCost * (isIndustrial ? 0.25 : 0.35));
        const labor = Math.floor(ship.price * 0.20);

        // Size silhouette bar
        let sizeBar = '<div class="enc-size-bar">';
        SIZE_ORDER.forEach(sz => {
            const r = SIZE_RADII[sz];
            const maxR = SIZE_RADII.capital;
            const h = Math.max(8, Math.round((r / maxR) * 60));
            const active = sz === ship.size;
            sizeBar += `<div class="enc-size-pip${active ? ' active' : ''}" style="height:${h}px" title="${sz}">
                <span class="enc-size-label">${sz.charAt(0).toUpperCase()}</span>
            </div>`;
        });
        sizeBar += '</div>';

        // Bonuses list
        let bonusHtml = '';
        if (ship.bonuses) {
            const bonusNames = {
                miningYield: 'Mining Yield', miningCycleTime: 'Mining Cycle Time', cargoCapacity: 'Cargo Capacity',
                damageBonus: 'Weapon Damage', trackingSpeed: 'Tracking Speed', maxSpeed: 'Max Speed',
                shieldBoost: 'Shield Boost', armorRepair: 'Armor Repair', weaponRange: 'Weapon Range',
                missileRange: 'Missile Range', missileDamageBonus: 'Missile Damage', warpDisrupt: 'Warp Disruption',
                capacitorRegen: 'Capacitor Regen', capacitorUse: 'Capacitor Use', droneBonus: 'Drone Damage',
                ewarRange: 'EWAR Range', ewarStrength: 'EWAR Strength', signatureRadius: 'Signature Radius',
                scanRange: 'Scan Range', scanSpeed: 'Scan Speed', scanStrength: 'Scan Strength',
                remoteRepair: 'Remote Repair', remoteRepairRange: 'Remote Repair Range',
                salvageChance: 'Salvage Chance', salvageRange: 'Salvage Range',
                harvestYield: 'Harvest Yield', harvestCycleTime: 'Harvest Cycle Time',
                laserDamageBonus: 'Laser Damage', capacitorDrain: 'Cap Drain',
                cycleTimeBonus: 'Cycle Time', droneYield: 'Drone Mining Yield',
                optimalRange: 'Optimal Range',
            };
            for (const [key, val] of Object.entries(ship.bonuses)) {
                const label = bonusNames[key] || key;
                let display;
                if (val < 1) display = `-${Math.round((1 - val) * 100)}%`;
                else display = `+${Math.round((val - 1) * 100)}%`;
                bonusHtml += `<div class="enc-bonus">${display} ${label}</div>`;
            }
        }

        this.contentEl.innerHTML = `
            <div class="enc-detail">
                <div class="enc-detail-left">
                    <canvas class="enc-3d-canvas" width="400" height="350"></canvas>
                    ${sizeBar}
                </div>
                <div class="enc-detail-right">
                    <div class="enc-detail-header">
                        <h2>${ship.name}</h2>
                        <span class="enc-badge-role" style="background:${roleColor}">${ship.role}</span>
                        <span class="enc-badge-size">${ship.size}</span>
                        ${ship.guildExclusive ? `<span class="enc-badge-guild">Guild: ${ship.guildExclusive}</span>` : ''}
                    </div>
                    <p class="enc-description">${ship.description || ''}</p>

                    <div class="enc-stat-section">
                        <h3>Defense</h3>
                        ${this.statBar('Shield', ship.shield, maxShield, '#4488ff')}
                        ${this.statBar('Armor', ship.armor, maxArmor, '#ff8844')}
                        ${this.statBar('Hull', ship.hull, maxHull, '#cc4444')}
                        <div class="enc-stat-total">Total HP: ${formatCredits(totalHP)}</div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Navigation</h3>
                        ${this.statBar('Max Speed', ship.maxSpeed, maxSpeed, '#44ddff')}
                        <div class="enc-stat-row"><span>Acceleration</span><span>${ship.acceleration} m/s\u00B2</span></div>
                        <div class="enc-stat-row"><span>Turn Speed</span><span>${ship.turnSpeed} rad/s</span></div>
                        <div class="enc-stat-row"><span>Signature</span><span>${ship.signatureRadius}m</span></div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Capacitor</h3>
                        ${this.statBar('Pool', ship.capacitor, maxCap, '#aa66ff')}
                        <div class="enc-stat-row"><span>Regen</span><span>${ship.capacitorRegen}/s</span></div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Fitting</h3>
                        <div class="enc-slot-blocks">
                            <div class="enc-slots-group">
                                <span class="enc-slot-label">Weapons</span>
                                <div class="enc-slot-pips">${this.slotPips(ship.weaponSlots, '#ff6644')}</div>
                            </div>
                            <div class="enc-slots-group">
                                <span class="enc-slot-label">Modules</span>
                                <div class="enc-slot-pips">${this.slotPips(ship.moduleSlots, '#44aaff')}</div>
                            </div>
                            <div class="enc-slots-group">
                                <span class="enc-slot-label">Subsystems</span>
                                <div class="enc-slot-pips">${this.slotPips(ship.subsystemSlots, '#44ff88')}</div>
                            </div>
                        </div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Bay</h3>
                        <div class="enc-stat-row"><span>Cargo</span><span>${formatCredits(ship.cargoCapacity)} m\u00B3</span></div>
                        <div class="enc-stat-row"><span>Drones</span><span>${ship.droneCapacity || 0}</span></div>
                        <div class="enc-stat-row"><span>Bandwidth</span><span>${ship.droneBandwidth || 0} Mbit/s</span></div>
                    </div>

                    ${bonusHtml ? `<div class="enc-stat-section"><h3>Role Bonuses</h3>${bonusHtml}</div>` : ''}

                    <div class="enc-stat-section">
                        <h3>Economics</h3>
                        <div class="enc-stat-row enc-price"><span>Purchase Price</span><span>${formatCredits(ship.price)} ISK</span></div>
                        <table class="enc-cost-table">
                            <tr><th>Material</th><th>Cost</th></tr>
                            <tr><td>Minerals</td><td>${formatCredits(minerals)} ISK</td></tr>
                            <tr><td>Electronics</td><td>${formatCredits(electronics)} ISK</td></tr>
                            <tr><td>Components</td><td>${formatCredits(components)} ISK</td></tr>
                            <tr><td>Labor</td><td>${formatCredits(labor)} ISK</td></tr>
                            <tr class="enc-cost-total"><td>Build Total</td><td>${formatCredits(minerals + electronics + components + labor)} ISK</td></tr>
                        </table>
                    </div>

                    <button class="enc-compare-btn">Compare with another ship</button>
                </div>
            </div>
        `;

        // 3D viewer
        const canvas = this.contentEl.querySelector('.enc-3d-canvas');
        this.init3DViewer('main', canvas, 400, 350, ship.role);
        this.set3DShipMesh('main', shipId, ship);

        // Compare button
        this.contentEl.querySelector('.enc-compare-btn').addEventListener('click', () => {
            this.compareShipA = shipId;
            this.compareShipB = null;
            this.viewMode = 'compare';
            this.renderCurrentTab();
        });
    }

    statBar(label, value, max, color) {
        const pct = max > 0 ? Math.round((value / max) * 100) : 0;
        return `<div class="enc-stat-bar-row">
            <span class="enc-stat-label">${label}</span>
            <div class="enc-stat-bar"><div class="enc-stat-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="enc-stat-value">${formatCredits(value)}</span>
        </div>`;
    }

    slotPips(count, color) {
        let html = '';
        for (let i = 0; i < count; i++) html += `<div class="enc-slot-pip" style="background:${color}"></div>`;
        return html;
    }

    // =============================================
    // SHIP COMPARISON
    // =============================================

    renderShipCompare() {
        this.renderShipToolbar();
        this.toolbarEl.querySelector('.enc-back-btn').classList.remove('hidden');

        const shipA = SHIP_DATABASE[this.compareShipA];

        // If no second ship selected yet, show selection grid
        if (!this.compareShipB) {
            const entries = this.getFilteredShips();
            const { paged, totalPages } = this.paginate(entries);

            let html = `<div class="enc-compare-prompt">Select a ship to compare with <strong>${shipA?.name || '???'}</strong></div>`;
            html += '<div class="enc-grid">';
            for (const [id, ship] of paged) {
                if (id === this.compareShipA) continue;
                const discovered = this.isDiscovered('ships', id);
                html += this.renderShipCard(id, ship, discovered);
            }
            html += '</div>';
            this.contentEl.innerHTML = html;
            this.renderPagination(totalPages);

            this.contentEl.querySelectorAll('.enc-card').forEach(card => {
                card.addEventListener('click', () => {
                    if (!this.isDiscovered('ships', card.dataset.id)) return;
                    this.compareShipB = card.dataset.id;
                    this.renderCurrentTab();
                });
            });
            this.loadGridThumbnails();
            return;
        }

        // Render comparison
        const shipB = SHIP_DATABASE[this.compareShipB];
        if (!shipA || !shipB) return;

        const stats = [
            { label: 'Shield', a: shipA.shield, b: shipB.shield, better: 'higher' },
            { label: 'Armor', a: shipA.armor, b: shipB.armor, better: 'higher' },
            { label: 'Hull', a: shipA.hull, b: shipB.hull, better: 'higher' },
            { label: 'Total HP', a: shipA.shield + shipA.armor + shipA.hull, b: shipB.shield + shipB.armor + shipB.hull, better: 'higher' },
            { label: 'Speed', a: shipA.maxSpeed, b: shipB.maxSpeed, better: 'higher' },
            { label: 'Accel', a: shipA.acceleration, b: shipB.acceleration, better: 'higher' },
            { label: 'Turn', a: shipA.turnSpeed, b: shipB.turnSpeed, better: 'higher' },
            { label: 'Capacitor', a: shipA.capacitor, b: shipB.capacitor, better: 'higher' },
            { label: 'Cap Regen', a: shipA.capacitorRegen, b: shipB.capacitorRegen, better: 'higher' },
            { label: 'Sig Radius', a: shipA.signatureRadius, b: shipB.signatureRadius, better: 'lower' },
            { label: 'W Slots', a: shipA.weaponSlots, b: shipB.weaponSlots, better: 'higher' },
            { label: 'M Slots', a: shipA.moduleSlots, b: shipB.moduleSlots, better: 'higher' },
            { label: 'S Slots', a: shipA.subsystemSlots, b: shipB.subsystemSlots, better: 'higher' },
            { label: 'Cargo', a: shipA.cargoCapacity, b: shipB.cargoCapacity, better: 'higher' },
            { label: 'Drones', a: shipA.droneCapacity || 0, b: shipB.droneCapacity || 0, better: 'higher' },
            { label: 'Price', a: shipA.price, b: shipB.price, better: 'lower' },
        ];

        let rows = '';
        for (const st of stats) {
            const max = Math.max(st.a, st.b, 1);
            const pctA = Math.round((st.a / max) * 100);
            const pctB = Math.round((st.b / max) * 100);
            let colorA = '#888', colorB = '#888';
            if (st.a !== st.b) {
                if (st.better === 'higher') {
                    colorA = st.a > st.b ? '#44ff88' : '#ff4466';
                    colorB = st.b > st.a ? '#44ff88' : '#ff4466';
                } else {
                    colorA = st.a < st.b ? '#44ff88' : '#ff4466';
                    colorB = st.b < st.a ? '#44ff88' : '#ff4466';
                }
            }
            rows += `<div class="enc-cmp-row">
                <span class="enc-cmp-val" style="color:${colorA}">${formatCredits(st.a)}</span>
                <div class="enc-cmp-bars">
                    <div class="enc-cmp-bar-left"><div class="enc-cmp-fill-left" style="width:${pctA}%;background:${colorA}"></div></div>
                    <span class="enc-cmp-label">${st.label}</span>
                    <div class="enc-cmp-bar-right"><div class="enc-cmp-fill-right" style="width:${pctB}%;background:${colorB}"></div></div>
                </div>
                <span class="enc-cmp-val" style="color:${colorB}">${formatCredits(st.b)}</span>
            </div>`;
        }

        this.contentEl.innerHTML = `
            <div class="enc-compare">
                <div class="enc-cmp-header">
                    <div class="enc-cmp-ship">
                        <canvas class="enc-3d-canvas-sm" width="300" height="260"></canvas>
                        <div class="enc-cmp-name">${shipA.name}</div>
                        <div class="enc-cmp-sub"><span class="enc-badge-role" style="background:${ROLE_COLORS[shipA.role] || '#888'}">${shipA.role}</span> ${shipA.size}</div>
                    </div>
                    <div class="enc-cmp-vs">VS</div>
                    <div class="enc-cmp-ship">
                        <canvas class="enc-3d-canvas-sm" width="300" height="260"></canvas>
                        <div class="enc-cmp-name">${shipB.name}</div>
                        <div class="enc-cmp-sub"><span class="enc-badge-role" style="background:${ROLE_COLORS[shipB.role] || '#888'}">${shipB.role}</span> ${shipB.size}</div>
                    </div>
                </div>
                <div class="enc-cmp-stats">${rows}</div>
            </div>
        `;

        this.footerEl.classList.add('hidden');

        // Init 3D viewers
        const canvases = this.contentEl.querySelectorAll('.enc-3d-canvas-sm');
        this.init3DViewer('cmpA', canvases[0], 300, 260, shipA.role);
        this.set3DShipMesh('cmpA', this.compareShipA, shipA);
        this.init3DViewer('cmpB', canvases[1], 300, 260, shipB.role);
        this.set3DShipMesh('cmpB', this.compareShipB, shipB);
    }

    // =============================================
    // EQUIPMENT
    // =============================================

    renderEquipmentGrid() {
        this.renderEquipmentToolbar();
        const entries = this.getFilteredEquipment();
        const { paged, totalPages } = this.paginate(entries);

        let html = '<div class="enc-grid">';
        for (const [id, eq] of paged) {
            const discovered = this.isDiscovered('equipment', id);
            html += this.renderEquipmentCard(id, eq, discovered);
        }
        html += '</div>';
        this.contentEl.innerHTML = html;
        this.renderPagination(totalPages);

        this.contentEl.querySelectorAll('.enc-card').forEach(card => {
            card.addEventListener('click', () => {
                this.detailItem = card.dataset.id;
                this.viewMode = 'detail';
                this.renderCurrentTab();
            });
        });
    }

    renderEquipmentCard(id, eq, discovered) {
        if (!discovered) {
            return `<div class="enc-card enc-undiscovered" data-id="${id}">
                <div class="enc-card-stripe"></div>
                <div class="enc-card-body">
                    <div class="enc-card-lock">\u{1F512}</div>
                    <div class="enc-card-name">???</div>
                    <div class="enc-card-sub">Encounter to unlock</div>
                </div>
            </div>`;
        }
        const slotColors = { weapon: '#ff6644', module: '#44aaff', subsystem: '#44ff88' };
        const color = slotColors[eq.slot] || '#888';
        const slotSymbols = { weapon: '\u2020', module: '\u25C6', subsystem: '\u25CE' };
        return `<div class="enc-card" data-id="${id}" style="--role-color:${color}">
            <div class="enc-card-stripe" style="background:linear-gradient(90deg, ${color}, transparent)"></div>
            <div class="enc-card-body">
                <div class="enc-card-eq-symbol" style="color:${color}">${slotSymbols[eq.slot] || '\u25A0'}</div>
                <div class="enc-card-badges">
                    <span class="enc-badge-role" style="background:${color}">${eq.slot}</span>
                    <span class="enc-badge-size">${eq.size}</span>
                </div>
                <div class="enc-card-name">${eq.name}</div>
                <div class="enc-card-stats">
                    <span>${eq.category}</span>
                    <span>${formatCredits(eq.price)} ISK</span>
                </div>
                ${eq.guildExclusive ? `<div class="enc-card-guild">${eq.guildExclusive}</div>` : ''}
            </div>
        </div>`;
    }

    renderEquipmentToolbar() {
        const categories = [...new Set(Object.values(EQUIPMENT_DATABASE).map(e => e.category))].sort();
        this.toolbarEl.innerHTML = `
            <div class="enc-toolbar-row">
                <label>Slot: <select class="enc-filter" data-filter="slot">
                    <option value="all">All</option>
                    <option value="weapon"${this.filters.slot === 'weapon' ? ' selected' : ''}>Weapon</option>
                    <option value="module"${this.filters.slot === 'module' ? ' selected' : ''}>Module</option>
                    <option value="subsystem"${this.filters.slot === 'subsystem' ? ' selected' : ''}>Subsystem</option>
                </select></label>
                <label>Size: <select class="enc-filter" data-filter="eqSize">
                    <option value="all">All</option>
                    <option value="small"${this.filters.eqSize === 'small' ? ' selected' : ''}>Small</option>
                    <option value="medium"${this.filters.eqSize === 'medium' ? ' selected' : ''}>Medium</option>
                    <option value="large"${this.filters.eqSize === 'large' ? ' selected' : ''}>Large</option>
                    <option value="xlarge"${this.filters.eqSize === 'xlarge' ? ' selected' : ''}>XLarge</option>
                </select></label>
                <label>Category: <select class="enc-filter" data-filter="category">
                    <option value="all">All</option>
                    ${categories.map(c => `<option value="${c}"${this.filters.category === c ? ' selected' : ''}>${c}</option>`).join('')}
                </select></label>
                <label>Sort: <select class="enc-sort">
                    <option value="name"${this.sortBy === 'name' ? ' selected' : ''}>Name</option>
                    <option value="price"${this.sortBy === 'price' ? ' selected' : ''}>Price</option>
                </select></label>
                <button class="enc-sort-dir">${this.sortAsc ? '\u25B2' : '\u25BC'}</button>
                <button class="enc-back-btn ${this.viewMode === 'grid' ? 'hidden' : ''}">\u25C0 Back to Grid</button>
            </div>
        `;
        this.toolbarEl.querySelectorAll('.enc-filter').forEach(sel => {
            sel.addEventListener('change', () => {
                this.filters[sel.dataset.filter] = sel.value;
                this.currentPage = 0;
                this.renderCurrentTab();
            });
        });
        this.toolbarEl.querySelector('.enc-sort').addEventListener('change', (e) => {
            this.sortBy = e.target.value; this.currentPage = 0; this.renderCurrentTab();
        });
        this.toolbarEl.querySelector('.enc-sort-dir').addEventListener('click', () => {
            this.sortAsc = !this.sortAsc; this.renderCurrentTab();
        });
        this.toolbarEl.querySelector('.enc-back-btn').addEventListener('click', () => {
            this.viewMode = 'grid'; this.renderCurrentTab();
        });
    }

    getFilteredEquipment() {
        let entries = Object.entries(EQUIPMENT_DATABASE);
        if (this.filters.slot !== 'all') entries = entries.filter(([, e]) => e.slot === this.filters.slot);
        if (this.filters.eqSize !== 'all') entries = entries.filter(([, e]) => e.size === this.filters.eqSize);
        if (this.filters.category !== 'all') entries = entries.filter(([, e]) => e.category === this.filters.category);

        entries.sort((a, b) => {
            let va, vb;
            if (this.sortBy === 'price') { va = a[1].price; vb = b[1].price; }
            else { va = a[1].name.toLowerCase(); vb = b[1].name.toLowerCase(); }
            if (va < vb) return this.sortAsc ? -1 : 1;
            if (va > vb) return this.sortAsc ? 1 : -1;
            return 0;
        });
        return entries;
    }

    renderEquipmentDetail(eqId) {
        const eq = EQUIPMENT_DATABASE[eqId];
        if (!eq) return;
        this.renderEquipmentToolbar();
        this.toolbarEl.querySelector('.enc-back-btn').classList.remove('hidden');

        const discovered = this.isDiscovered('equipment', eqId);
        if (!discovered) {
            this.contentEl.innerHTML = `<div class="enc-detail-locked">
                <div class="enc-lock-big">\u{1F512}</div>
                <h2>Unknown Equipment</h2>
                <p>Purchase or loot this item to unlock its codex entry.</p>
                <button class="enc-back-link">\u25C0 Back</button>
            </div>`;
            this.contentEl.querySelector('.enc-back-link').addEventListener('click', () => {
                this.viewMode = 'grid'; this.renderCurrentTab();
            });
            return;
        }

        const slotColors = { weapon: '#ff6644', module: '#44aaff', subsystem: '#44ff88' };
        const color = slotColors[eq.slot] || '#888';

        // Build stat rows from all numeric/meaningful properties
        const skipKeys = new Set(['name', 'slot', 'size', 'category', 'description', 'price', 'guildExclusive']);
        let statsHtml = '';
        for (const [key, val] of Object.entries(eq)) {
            if (skipKeys.has(key)) continue;
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            statsHtml += `<div class="enc-stat-row"><span>${label}</span><span>${val}</span></div>`;
        }

        this.contentEl.innerHTML = `
            <div class="enc-detail enc-eq-detail">
                <div class="enc-detail-right" style="max-width:700px;margin:0 auto">
                    <div class="enc-detail-header">
                        <h2>${eq.name}</h2>
                        <span class="enc-badge-role" style="background:${color}">${eq.slot}</span>
                        <span class="enc-badge-size">${eq.size}</span>
                        <span class="enc-badge-size">${eq.category}</span>
                        ${eq.guildExclusive ? `<span class="enc-badge-guild">Guild: ${eq.guildExclusive}</span>` : ''}
                    </div>
                    <p class="enc-description">${eq.description || ''}</p>
                    <div class="enc-stat-section">
                        <h3>Statistics</h3>
                        ${statsHtml}
                    </div>
                    <div class="enc-stat-section">
                        <div class="enc-stat-row enc-price"><span>Price</span><span>${formatCredits(eq.price)} ISK</span></div>
                    </div>
                    ${this.renderEquipmentSoundPicker(eqId)}
                </div>
            </div>
        `;
        this.footerEl.classList.add('hidden');
        this.bindEquipmentSoundPicker(eqId);
    }

    // =============================================
    // EQUIPMENT SOUND PICKER
    // =============================================

    renderEquipmentSoundPicker(eqId) {
        const audio = this.game.audio;
        const currentFile = audio?.getSoundMapping('equipment', eqId);
        return `
            <div class="enc-sound-section">
                <h3>Sound Effect</h3>
                <div class="enc-sound-picker" data-eq-id="${eqId}">
                    <span class="enc-sound-current">${currentFile || 'Synthesized (default)'}</span>
                    <label class="enc-sound-file-label">
                        Choose File
                        <input type="file" accept=".ogg,.wav,.mp3" class="enc-sound-file-input" style="display:none">
                    </label>
                    <button class="enc-sound-play-btn" ${currentFile ? '' : 'disabled'}>Play</button>
                    <button class="enc-sound-clear-btn" ${currentFile ? '' : 'disabled'}>Clear</button>
                </div>
            </div>`;
    }

    bindEquipmentSoundPicker(eqId) {
        const picker = this.contentEl.querySelector(`.enc-sound-picker[data-eq-id="${eqId}"]`);
        if (!picker) return;
        const audio = this.game.audio;

        picker.querySelector('.enc-sound-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const arrayBuffer = await file.arrayBuffer();
            await audio.storeSoundFile(file.name, arrayBuffer);
            audio.setSoundMapping('equipment', eqId, file.name);
            await audio.loadOggBuffer(file.name);
            picker.querySelector('.enc-sound-current').textContent = file.name;
            picker.querySelector('.enc-sound-play-btn').disabled = false;
            picker.querySelector('.enc-sound-clear-btn').disabled = false;
        });

        picker.querySelector('.enc-sound-play-btn').addEventListener('click', () => {
            const fn = audio.getSoundMapping('equipment', eqId);
            if (fn) audio.previewMappedSound(fn);
        });

        picker.querySelector('.enc-sound-clear-btn').addEventListener('click', async () => {
            const fn = audio.getSoundMapping('equipment', eqId);
            if (fn) await audio.deleteSoundFile(fn);
            audio.removeSoundMapping('equipment', eqId);
            delete audio.audioBufferCache[fn];
            picker.querySelector('.enc-sound-current').textContent = 'Synthesized (default)';
            picker.querySelector('.enc-sound-play-btn').disabled = true;
            picker.querySelector('.enc-sound-clear-btn').disabled = true;
        });
    }

    // =============================================
    // SOUNDS TAB
    // =============================================

    renderSoundsGrid() {
        this.toolbarEl.innerHTML = `<div class="enc-toolbar-row">
            <span style="color:#8af">Assign custom OGG/WAV/MP3 files to game sounds. These persist across sessions.</span>
        </div>`;

        const audio = this.game.audio;
        const SOUND_CATEGORIES = {
            'Combat': ['laser', 'hit', 'explosion', 'shield-hit', 'armor-hit', 'hull-hit',
                        'missile-launch', 'missile-hit', 'missile-explosion', 'target-destroyed'],
            'Navigation': ['warp-start', 'warp-end', 'dock', 'undock', 'jump-gate'],
            'Modules': ['module-activate', 'module-deactivate', 'mining', 'repair-beam',
                        'scan', 'scan-complete'],
            'Alerts': ['warning', 'capacitor-low', 'shield-low', 'hull-critical', 'cargo-full',
                        'warp-disrupted', 'ewar-warning', 'structural-alarm'],
            'UI': ['click', 'buy', 'sell', 'repair', 'loot-pickup'],
            'Progression': ['quest-accept', 'quest-complete', 'quest-fail', 'reputation-up', 'level-up'],
            'Dialogue': ['dialogue-open', 'dialogue-close'],
            'Drones': ['drone-launch', 'drone-recall'],
            'Targeting': ['lock-start', 'lock-complete'],
        };

        let html = '<div class="enc-sounds-grid">';

        for (const [category, sounds] of Object.entries(SOUND_CATEGORIES)) {
            html += `<div class="enc-sounds-category"><h3>${category}</h3></div>`;
            for (const soundName of sounds) {
                const currentFile = audio?.getSoundMapping('events', soundName);
                html += `
                    <div class="enc-sound-row" data-sound="${soundName}">
                        <span class="enc-sound-name">${soundName}</span>
                        <span class="enc-sound-current">${currentFile || 'Synthesized'}</span>
                        <label class="enc-sound-file-label">
                            Choose
                            <input type="file" accept=".ogg,.wav,.mp3" class="enc-sound-file-input" style="display:none">
                        </label>
                        <button class="enc-sound-play-btn" title="Play">&#9654;</button>
                        <button class="enc-sound-clear-btn" title="Clear" ${currentFile ? '' : 'disabled'}>&#10005;</button>
                    </div>`;
            }
        }

        // Equipment overrides section
        const eqMappings = audio?.soundMappings?.equipment || {};
        const eqEntries = Object.entries(eqMappings);
        if (eqEntries.length > 0) {
            html += `<div class="enc-sounds-category"><h3>Equipment Overrides</h3></div>`;
            for (const [eqId, filename] of eqEntries) {
                const eq = EQUIPMENT_DATABASE[eqId];
                html += `
                    <div class="enc-sound-row enc-sound-eq-row" data-eq-id="${eqId}">
                        <span class="enc-sound-name">${eq?.name || eqId}</span>
                        <span class="enc-sound-current">${filename}</span>
                        <button class="enc-sound-play-btn" title="Play">&#9654;</button>
                        <button class="enc-sound-jump-btn" title="View in Equipment tab">&#8594;</button>
                    </div>`;
            }
        }

        html += '</div>';
        this.contentEl.innerHTML = html;
        this.footerEl.classList.add('hidden');

        // Bind event sound rows
        this.contentEl.querySelectorAll('.enc-sound-row:not(.enc-sound-eq-row)').forEach(row => {
            const soundName = row.dataset.sound;

            row.querySelector('.enc-sound-file-input').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const arrayBuffer = await file.arrayBuffer();
                await audio.storeSoundFile(file.name, arrayBuffer);
                audio.setSoundMapping('events', soundName, file.name);
                await audio.loadOggBuffer(file.name);
                row.querySelector('.enc-sound-current').textContent = file.name;
                row.querySelector('.enc-sound-clear-btn').disabled = false;
            });

            row.querySelector('.enc-sound-play-btn').addEventListener('click', () => {
                const fn = audio.getSoundMapping('events', soundName);
                if (fn) {
                    audio.previewMappedSound(fn);
                } else {
                    audio.play(soundName);
                }
            });

            row.querySelector('.enc-sound-clear-btn').addEventListener('click', async () => {
                const fn = audio.getSoundMapping('events', soundName);
                if (fn) await audio.deleteSoundFile(fn);
                audio.removeSoundMapping('events', soundName);
                if (fn) delete audio.audioBufferCache[fn];
                row.querySelector('.enc-sound-current').textContent = 'Synthesized';
                row.querySelector('.enc-sound-clear-btn').disabled = true;
            });
        });

        // Bind equipment override rows
        this.contentEl.querySelectorAll('.enc-sound-eq-row').forEach(row => {
            const eqId = row.dataset.eqId;

            row.querySelector('.enc-sound-play-btn')?.addEventListener('click', () => {
                const fn = audio.getSoundMapping('equipment', eqId);
                if (fn) audio.previewMappedSound(fn);
            });

            row.querySelector('.enc-sound-jump-btn')?.addEventListener('click', () => {
                this.activeTab = 'equipment';
                this.detailItem = eqId;
                this.viewMode = 'detail';
                this.el.querySelectorAll('.enc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'equipment'));
                this.renderCurrentTab();
            });
        });
    }

    // =============================================
    // FACTIONS
    // =============================================

    renderFactionList() {
        this.toolbarEl.innerHTML = `<div class="enc-toolbar-row">
            <button class="enc-back-btn ${this.viewMode === 'grid' ? 'hidden' : ''}">\u25C0 Back to List</button>
        </div>`;
        if (this.viewMode !== 'grid') {
            this.toolbarEl.querySelector('.enc-back-btn').addEventListener('click', () => {
                this.viewMode = 'grid'; this.renderCurrentTab();
            });
        }

        let html = '<div class="enc-faction-list">';
        for (const [id, fac] of Object.entries(GUILD_FACTIONS)) {
            const discovered = this.isDiscovered('factions', id);
            if (!discovered) {
                html += `<div class="enc-faction-card enc-undiscovered" data-id="${id}">
                    <div class="enc-card-lock">\u{1F512}</div>
                    <div class="enc-faction-name">Unknown Faction</div>
                    <div class="enc-card-sub">Encounter their ships to unlock</div>
                </div>`;
                continue;
            }
            html += `<div class="enc-faction-card" data-id="${id}" style="border-left:4px solid ${fac.color}">
                <div class="enc-faction-icon" style="color:${fac.color}">${fac.icon}</div>
                <div class="enc-faction-info">
                    <div class="enc-faction-name">${fac.name} <span class="enc-faction-short">[${fac.shortName}]</span></div>
                    <div class="enc-faction-desc">${fac.description}</div>
                    ${fac.isPirate ? '<div class="enc-faction-hostile">HOSTILE</div>' : ''}
                </div>
            </div>`;
        }
        html += '</div>';
        this.contentEl.innerHTML = html;
        this.footerEl.classList.add('hidden');

        this.contentEl.querySelectorAll('.enc-faction-card:not(.enc-undiscovered)').forEach(card => {
            card.addEventListener('click', () => {
                this.detailItem = card.dataset.id;
                this.viewMode = 'detail';
                this.renderCurrentTab();
            });
        });
    }

    renderFactionDetail(factionId) {
        const fac = GUILD_FACTIONS[factionId];
        if (!fac) return;

        this.toolbarEl.innerHTML = `<div class="enc-toolbar-row">
            <button class="enc-back-btn">\u25C0 Back to List</button>
        </div>`;
        this.toolbarEl.querySelector('.enc-back-btn').addEventListener('click', () => {
            this.viewMode = 'grid'; this.renderCurrentTab();
        });

        // Fleet composition
        let fleetHtml = '';
        if (fac.startingShips) {
            for (const s of fac.startingShips) {
                const shipData = SHIP_DATABASE[s.shipClass];
                fleetHtml += `<div class="enc-fleet-entry">
                    <span class="enc-fleet-role">${s.role}</span>
                    <span class="enc-fleet-ship">${shipData?.name || s.shipClass}</span>
                    <span class="enc-fleet-count">x${s.count}</span>
                </div>`;
            }
        }

        // Operating sectors
        const ai = fac.aiConfig || {};
        const allSectors = [...(ai.preferredMiningSectors || []), ...(ai.preferredTradeSectors || []),
            ...(ai.preferredHuntSectors || []), ...(ai.preferredRaidSectors || []),
            ...(ai.preferredAmbushSectors || [])];
        const uniqueSectors = [...new Set(allSectors)];

        this.contentEl.innerHTML = `
            <div class="enc-detail enc-faction-detail">
                <div class="enc-detail-right" style="max-width:800px;margin:0 auto">
                    <div class="enc-detail-header">
                        <span class="enc-faction-icon-lg" style="color:${fac.color}">${fac.icon}</span>
                        <h2 style="color:${fac.color}">${fac.name}</h2>
                        <span class="enc-faction-short-lg">[${fac.shortName}]</span>
                        ${fac.isPirate ? '<span class="enc-badge-hostile">HOSTILE</span>' : ''}
                    </div>
                    <p class="enc-description">${fac.description}</p>

                    <div class="enc-stat-section">
                        <h3>Faction Details</h3>
                        <div class="enc-stat-row"><span>Home Station</span><span>${fac.homeStation || 'Unknown (Nomadic)'}</span></div>
                        <div class="enc-stat-row"><span>Treasury</span><span>${formatCredits(fac.startingTreasury)} ISK</span></div>
                        <div class="enc-stat-row"><span>Mining Focus</span><span>${Math.round((ai.miningPriority || 0) * 100)}%</span></div>
                        <div class="enc-stat-row"><span>Trading Focus</span><span>${Math.round((ai.tradingPriority || 0) * 100)}%</span></div>
                        <div class="enc-stat-row"><span>Combat Focus</span><span>${Math.round((ai.combatPriority || 0) * 100)}%</span></div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Fleet Composition</h3>
                        <div class="enc-fleet-list">${fleetHtml}</div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Operating Sectors</h3>
                        <div class="enc-sector-tags">
                            ${uniqueSectors.map(s => {
                                const sec = UNIVERSE_LAYOUT.sectors.find(x => x.id === s);
                                return `<span class="enc-sector-tag">${sec?.name || s}</span>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.footerEl.classList.add('hidden');
    }

    // =============================================
    // UNIVERSE
    // =============================================

    renderUniverseOverview() {
        this.toolbarEl.innerHTML = `<div class="enc-toolbar-row">
            <button class="enc-back-btn ${this.viewMode === 'grid' ? 'hidden' : ''}">\u25C0 Back</button>
        </div>`;
        if (this.viewMode !== 'grid') {
            this.toolbarEl.querySelector('.enc-back-btn').addEventListener('click', () => {
                this.viewMode = 'grid'; this.renderCurrentTab();
            });
        }

        let html = '<div class="enc-universe-list">';
        for (const sec of UNIVERSE_LAYOUT.sectors) {
            const discovered = this.isDiscovered('sectors', sec.id);
            const station = STATION_SPECIALTIES[sec.id];
            const diffColor = DIFF_COLORS[sec.difficulty] || '#888';

            if (!discovered) {
                html += `<div class="enc-sector-card enc-undiscovered" data-id="${sec.id}">
                    <div class="enc-card-lock">\u{1F512}</div>
                    <div class="enc-sector-name">Unknown Sector</div>
                    <div class="enc-card-sub">Jump here to unlock</div>
                </div>`;
                continue;
            }

            // Connected sectors
            const connections = UNIVERSE_LAYOUT.gates
                .filter(g => g.from === sec.id || g.to === sec.id)
                .map(g => g.from === sec.id ? g.to : g.from);

            html += `<div class="enc-sector-card" data-id="${sec.id}">
                <div class="enc-sector-header">
                    <div class="enc-sector-name">${sec.name}</div>
                    <span class="enc-badge-diff" style="background:${diffColor}">${sec.difficulty}</span>
                </div>
                <div class="enc-sector-specialty">${station?.specialty || 'unknown'}</div>
                <div class="enc-sector-desc">${station?.description || ''}</div>
                <div class="enc-sector-connections">Gates: ${connections.map(c => {
                    const s = UNIVERSE_LAYOUT.sectors.find(x => x.id === c);
                    return s?.name || c;
                }).join(', ')}</div>
            </div>`;
        }
        html += '</div>';
        this.contentEl.innerHTML = html;
        this.footerEl.classList.add('hidden');

        this.contentEl.querySelectorAll('.enc-sector-card:not(.enc-undiscovered)').forEach(card => {
            card.addEventListener('click', () => {
                this.detailItem = card.dataset.id;
                this.viewMode = 'detail';
                this.renderCurrentTab();
            });
        });
    }

    renderUniverseDetail(sectorId) {
        const sec = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        const station = STATION_SPECIALTIES[sectorId];
        if (!sec) return;

        this.toolbarEl.innerHTML = `<div class="enc-toolbar-row">
            <button class="enc-back-btn">\u25C0 Back</button>
        </div>`;
        this.toolbarEl.querySelector('.enc-back-btn').addEventListener('click', () => {
            this.viewMode = 'grid'; this.renderCurrentTab();
        });

        const diffColor = DIFF_COLORS[sec.difficulty] || '#888';

        // Trade goods available
        let producesHtml = '';
        let consumesHtml = '';
        if (station) {
            for (const gid of station.produces) {
                const good = TRADE_GOODS[gid];
                if (good) {
                    const price = getStationPrice(gid, sectorId);
                    producesHtml += `<div class="enc-trade-entry enc-produces">
                        <span>${good.icon} ${good.name}</span>
                        <span>Buy: ${formatCredits(price.buy)} | Sell: ${formatCredits(price.sell)}</span>
                    </div>`;
                }
            }
            for (const gid of station.consumes) {
                const good = TRADE_GOODS[gid];
                if (good) {
                    const price = getStationPrice(gid, sectorId);
                    consumesHtml += `<div class="enc-trade-entry enc-consumes">
                        <span>${good.icon} ${good.name}</span>
                        <span>Buy: ${formatCredits(price.buy)} | Sell: ${formatCredits(price.sell)}</span>
                    </div>`;
                }
            }
        }

        const connections = UNIVERSE_LAYOUT.gates
            .filter(g => g.from === sectorId || g.to === sectorId)
            .map(g => g.from === sectorId ? g.to : g.from);

        this.contentEl.innerHTML = `
            <div class="enc-detail enc-universe-detail">
                <div class="enc-detail-right" style="max-width:800px;margin:0 auto">
                    <div class="enc-detail-header">
                        <h2>${sec.name}</h2>
                        <span class="enc-badge-diff" style="background:${diffColor}">${sec.difficulty}</span>
                    </div>
                    <p class="enc-description">${station?.description || ''}</p>

                    <div class="enc-stat-section">
                        <h3>Station Info</h3>
                        <div class="enc-stat-row"><span>Specialty</span><span>${station?.specialty || 'N/A'}</span></div>
                        <div class="enc-stat-row"><span>Coordinates</span><span>(${sec.x}, ${sec.y})</span></div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Gate Connections</h3>
                        <div class="enc-sector-tags">
                            ${connections.map(c => {
                                const s = UNIVERSE_LAYOUT.sectors.find(x => x.id === c);
                                return `<span class="enc-sector-tag">${s?.name || c}</span>`;
                            }).join('')}
                        </div>
                    </div>

                    ${producesHtml ? `<div class="enc-stat-section"><h3>Produces (Cheap to Buy)</h3>${producesHtml}</div>` : ''}
                    ${consumesHtml ? `<div class="enc-stat-section"><h3>Consumes (Premium Sell)</h3>${consumesHtml}</div>` : ''}
                </div>
            </div>
        `;
        this.footerEl.classList.add('hidden');
    }

    // =============================================
    // TRADE GOODS
    // =============================================

    renderTradeGoodsGrid() {
        this.renderTradeGoodsToolbar();
        const entries = this.getFilteredTradeGoods();
        const { paged, totalPages } = this.paginate(entries);

        let html = '<div class="enc-grid">';
        for (const [id, good] of paged) {
            const discovered = this.isDiscovered('tradegoods', id);
            html += this.renderTradeGoodCard(id, good, discovered);
        }
        html += '</div>';
        this.contentEl.innerHTML = html;
        this.renderPagination(totalPages);

        this.contentEl.querySelectorAll('.enc-card').forEach(card => {
            card.addEventListener('click', () => {
                this.detailItem = card.dataset.id;
                this.viewMode = 'detail';
                this.renderCurrentTab();
            });
        });
    }

    renderTradeGoodCard(id, good, discovered) {
        if (!discovered) {
            return `<div class="enc-card enc-undiscovered" data-id="${id}">
                <div class="enc-card-body">
                    <div class="enc-card-lock">\u{1F512}</div>
                    <div class="enc-card-name">???</div>
                    <div class="enc-card-sub">Trade to unlock</div>
                </div>
            </div>`;
        }
        const catInfo = TRADE_CATEGORIES[good.category] || { name: good.category, color: '#888' };
        return `<div class="enc-card" data-id="${id}" style="--role-color:${catInfo.color}">
            <div class="enc-card-body">
                <div class="enc-card-badges">
                    <span class="enc-badge-role" style="background:${catInfo.color}">${catInfo.name}</span>
                </div>
                <div class="enc-card-icon">${good.icon}</div>
                <div class="enc-card-name">${good.name}</div>
                <div class="enc-card-stats">
                    <span>Base: ${formatCredits(good.basePrice)} ISK</span>
                    <span>Vol: ${good.volume} m\u00B3</span>
                </div>
            </div>
        </div>`;
    }

    renderTradeGoodsToolbar() {
        const categories = Object.keys(TRADE_CATEGORIES);
        this.toolbarEl.innerHTML = `
            <div class="enc-toolbar-row">
                <label>Category: <select class="enc-filter" data-filter="category">
                    <option value="all">All</option>
                    ${categories.map(c => `<option value="${c}"${this.filters.category === c ? ' selected' : ''}>${TRADE_CATEGORIES[c].name}</option>`).join('')}
                </select></label>
                <label>Sort: <select class="enc-sort">
                    <option value="name"${this.sortBy === 'name' ? ' selected' : ''}>Name</option>
                    <option value="price"${this.sortBy === 'price' ? ' selected' : ''}>Base Price</option>
                    <option value="volume"${this.sortBy === 'volume' ? ' selected' : ''}>Volume</option>
                </select></label>
                <button class="enc-sort-dir">${this.sortAsc ? '\u25B2' : '\u25BC'}</button>
                <button class="enc-back-btn ${this.viewMode === 'grid' ? 'hidden' : ''}">\u25C0 Back</button>
            </div>
        `;
        this.toolbarEl.querySelectorAll('.enc-filter').forEach(sel => {
            sel.addEventListener('change', () => {
                this.filters[sel.dataset.filter] = sel.value;
                this.currentPage = 0;
                this.renderCurrentTab();
            });
        });
        this.toolbarEl.querySelector('.enc-sort').addEventListener('change', (e) => {
            this.sortBy = e.target.value; this.currentPage = 0; this.renderCurrentTab();
        });
        this.toolbarEl.querySelector('.enc-sort-dir').addEventListener('click', () => {
            this.sortAsc = !this.sortAsc; this.renderCurrentTab();
        });
        this.toolbarEl.querySelector('.enc-back-btn').addEventListener('click', () => {
            this.viewMode = 'grid'; this.renderCurrentTab();
        });
    }

    getFilteredTradeGoods() {
        let entries = Object.entries(TRADE_GOODS);
        if (this.filters.category !== 'all') entries = entries.filter(([, g]) => g.category === this.filters.category);

        entries.sort((a, b) => {
            let va, vb;
            switch (this.sortBy) {
                case 'price': va = a[1].basePrice; vb = b[1].basePrice; break;
                case 'volume': va = a[1].volume; vb = b[1].volume; break;
                default: va = a[1].name.toLowerCase(); vb = b[1].name.toLowerCase();
            }
            if (va < vb) return this.sortAsc ? -1 : 1;
            if (va > vb) return this.sortAsc ? 1 : -1;
            return 0;
        });
        return entries;
    }

    renderTradeGoodDetail(goodId) {
        const good = TRADE_GOODS[goodId];
        if (!good) return;
        this.renderTradeGoodsToolbar();
        this.toolbarEl.querySelector('.enc-back-btn').classList.remove('hidden');

        const discovered = this.isDiscovered('tradegoods', goodId);
        if (!discovered) {
            this.contentEl.innerHTML = `<div class="enc-detail-locked">
                <div class="enc-lock-big">\u{1F512}</div>
                <h2>Unknown Trade Good</h2>
                <p>Buy or sell this commodity to unlock its codex entry.</p>
                <button class="enc-back-link">\u25C0 Back</button>
            </div>`;
            this.contentEl.querySelector('.enc-back-link').addEventListener('click', () => {
                this.viewMode = 'grid'; this.renderCurrentTab();
            });
            return;
        }

        const catInfo = TRADE_CATEGORIES[good.category] || { name: good.category, color: '#888' };

        // Per-station price table
        let priceTable = '';
        for (const sec of UNIVERSE_LAYOUT.sectors) {
            const station = STATION_SPECIALTIES[sec.id];
            if (!station) continue;
            const price = getStationPrice(goodId, sec.id);
            const produces = station.produces.includes(goodId);
            const consumes = station.consumes.includes(goodId);
            let note = '';
            if (produces) note = '<span class="enc-produces-tag">PRODUCES</span>';
            if (consumes) note = '<span class="enc-consumes-tag">CONSUMES</span>';
            priceTable += `<tr>
                <td>${sec.name}</td>
                <td>${formatCredits(price.buy)} ISK</td>
                <td>${formatCredits(price.sell)} ISK</td>
                <td>${note}</td>
            </tr>`;
        }

        this.contentEl.innerHTML = `
            <div class="enc-detail enc-trade-detail">
                <div class="enc-detail-right" style="max-width:800px;margin:0 auto">
                    <div class="enc-detail-header">
                        <span class="enc-trade-icon">${good.icon}</span>
                        <h2>${good.name}</h2>
                        <span class="enc-badge-role" style="background:${catInfo.color}">${catInfo.name}</span>
                    </div>
                    <p class="enc-description">${good.description || ''}</p>

                    <div class="enc-stat-section">
                        <h3>Properties</h3>
                        <div class="enc-stat-row"><span>Base Price</span><span>${formatCredits(good.basePrice)} ISK</span></div>
                        <div class="enc-stat-row"><span>Volume</span><span>${good.volume} m\u00B3</span></div>
                        <div class="enc-stat-row"><span>Category</span><span>${catInfo.name}</span></div>
                    </div>

                    <div class="enc-stat-section">
                        <h3>Station Prices</h3>
                        <table class="enc-price-table">
                            <tr><th>Station</th><th>Buy</th><th>Sell</th><th>Status</th></tr>
                            ${priceTable}
                        </table>
                    </div>
                </div>
            </div>
        `;
        this.footerEl.classList.add('hidden');
    }

    // =============================================
    // SEARCH RESULTS
    // =============================================

    renderSearchResults() {
        const results = this.search(this.searchQuery);
        this.toolbarEl.innerHTML = `<div class="enc-toolbar-row">
            <span class="enc-search-info">Search results for "${this.searchQuery}": ${results.length} found</span>
        </div>`;

        if (results.length === 0) {
            this.contentEl.innerHTML = '<div class="enc-no-results">No results found.</div>';
            this.footerEl.classList.add('hidden');
            return;
        }

        // Group by category
        const groups = {};
        for (const r of results) {
            if (!groups[r.category]) groups[r.category] = [];
            groups[r.category].push(r);
        }

        const catLabels = { ships: 'Ships', equipment: 'Equipment', factions: 'Factions', sectors: 'Universe', tradegoods: 'Trade Goods' };

        let html = '';
        for (const [cat, items] of Object.entries(groups)) {
            html += `<div class="enc-search-group"><h3>${catLabels[cat] || cat} (${items.length})</h3><div class="enc-grid">`;
            for (const item of items) {
                const disc = this.isDiscovered(cat, item.id);
                if (cat === 'ships') {
                    html += this.renderShipCard(item.id, SHIP_DATABASE[item.id], disc);
                } else if (cat === 'equipment') {
                    html += this.renderEquipmentCard(item.id, EQUIPMENT_DATABASE[item.id], disc);
                } else if (cat === 'tradegoods') {
                    html += this.renderTradeGoodCard(item.id, TRADE_GOODS[item.id], disc);
                } else {
                    // Factions and sectors - simple card
                    const name = disc ? item.name : '???';
                    html += `<div class="enc-card ${disc ? '' : 'enc-undiscovered'}" data-id="${item.id}" data-cat="${cat}">
                        <div class="enc-card-name">${name}</div>
                    </div>`;
                }
            }
            html += '</div></div>';
        }

        this.contentEl.innerHTML = html;
        this.footerEl.classList.add('hidden');

        // Click handlers
        this.contentEl.querySelectorAll('.enc-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const cat = card.dataset.cat || card.closest('.enc-search-group')?.querySelector('h3')?.textContent?.toLowerCase();

                if (card.closest('.enc-search-group')?.querySelector('h3')?.textContent?.startsWith('Ships')) {
                    this.activeTab = 'ships'; this.detailItem = id; this.viewMode = 'detail';
                } else if (card.closest('.enc-search-group')?.querySelector('h3')?.textContent?.startsWith('Equipment')) {
                    this.activeTab = 'equipment'; this.detailItem = id; this.viewMode = 'detail';
                } else if (card.closest('.enc-search-group')?.querySelector('h3')?.textContent?.startsWith('Factions')) {
                    this.activeTab = 'factions'; this.detailItem = id; this.viewMode = 'detail';
                } else if (card.closest('.enc-search-group')?.querySelector('h3')?.textContent?.startsWith('Universe')) {
                    this.activeTab = 'universe'; this.detailItem = id; this.viewMode = 'detail';
                } else if (card.closest('.enc-search-group')?.querySelector('h3')?.textContent?.startsWith('Trade')) {
                    this.activeTab = 'tradegoods'; this.detailItem = id; this.viewMode = 'detail';
                }
                this.searchQuery = '';
                this.el.querySelector('.enc-search').value = '';
                this.el.querySelectorAll('.enc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === this.activeTab));
                this.renderCurrentTab();
            });
        });

        // Async-load ship thumbnails in search results
        this.loadGridThumbnails();
    }

    // =============================================
    // PAGINATION
    // =============================================

    paginate(entries) {
        const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE));
        if (this.currentPage >= totalPages) this.currentPage = totalPages - 1;
        const start = this.currentPage * ITEMS_PER_PAGE;
        const paged = entries.slice(start, start + ITEMS_PER_PAGE);
        return { paged, totalPages };
    }

    renderPagination(totalPages) {
        if (totalPages <= 1) {
            this.footerEl.classList.add('hidden');
            return;
        }
        this.footerEl.classList.remove('hidden');
        this.footerEl.querySelector('.enc-page-info').textContent = `Page ${this.currentPage + 1} of ${totalPages}`;
        this.footerEl.querySelector('.enc-prev').disabled = this.currentPage === 0;
        this.footerEl.querySelector('.enc-next').disabled = this.currentPage >= totalPages - 1;
    }

    // =============================================
    // 3D VIEWER
    // =============================================

    init3DViewer(key, canvas, w, h, role) {
        if (!canvas || typeof THREE === 'undefined') return;

        this.disposeViewer(key);

        canvas.width = w;
        canvas.height = h;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x030608);

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(0, 50, 120);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        // Subdued lighting - lets PBR material colors show through
        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambient);
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(5, 8, 5);
        scene.add(mainLight);
        const fillLight = new THREE.DirectionalLight(0x6688aa, 0.4);
        fillLight.position.set(-5, 3, -4);
        scene.add(fillLight);
        const backLight = new THREE.DirectionalLight(0x00ccff, 0.4);
        backLight.position.set(0, -5, -5);
        scene.add(backLight);

        // Role-colored accent lights for dramatic rim lighting
        const accentColor = ROLE_ACCENT_HEX[role] || 0x00ffff;
        const accentLight = new THREE.PointLight(accentColor, 2.5, 300);
        accentLight.position.set(40, -15, 50);
        scene.add(accentLight);
        const accentLight2 = new THREE.PointLight(accentColor, 1.0, 200);
        accentLight2.position.set(-30, 20, -40);
        scene.add(accentLight2);

        // Holographic turntable platform
        const platformGroup = new THREE.Group();
        platformGroup.position.y = -28;

        // Outer glow ring
        const outerRingGeo = new THREE.RingGeometry(42, 44, 64);
        const outerRingMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide
        });
        const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        outerRing.rotation.x = -Math.PI / 2;
        platformGroup.add(outerRing);

        // Inner accent ring
        const innerRingGeo = new THREE.RingGeometry(35, 36.5, 64);
        const innerRingMat = new THREE.MeshBasicMaterial({
            color: accentColor, transparent: true, opacity: 0.2, side: THREE.DoubleSide
        });
        const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        platformGroup.add(innerRing);

        // Semi-transparent disc floor
        const discGeo = new THREE.CircleGeometry(35, 64);
        const discMat = new THREE.MeshBasicMaterial({
            color: 0x001520, transparent: true, opacity: 0.5, side: THREE.DoubleSide
        });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        platformGroup.add(disc);

        // Radial tick marks
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const tickGeo = new THREE.PlaneGeometry(0.6, 4);
            const tickMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide
            });
            const tick = new THREE.Mesh(tickGeo, tickMat);
            tick.position.set(Math.cos(angle) * 43, 0.1, Math.sin(angle) * 43);
            tick.rotation.x = -Math.PI / 2;
            tick.rotation.z = -angle;
            platformGroup.add(tick);
        }

        scene.add(platformGroup);

        // Starfield particles
        const starsGeo = new THREE.BufferGeometry();
        const starPos = [];
        for (let i = 0; i < 300; i++) {
            starPos.push(
                (Math.random() - 0.5) * 500,
                (Math.random() - 0.5) * 500,
                -30 - Math.random() * 250
            );
        }
        starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        const starsMat = new THREE.PointsMaterial({
            color: 0xffffff, size: 1.2, transparent: true, opacity: 0.5, sizeAttenuation: true
        });
        const stars = new THREE.Points(starsGeo, starsMat);
        scene.add(stars);

        // Subtle grid floor
        const grid = new THREE.GridHelper(200, 20, 0x002233, 0x000e18);
        grid.position.y = -28;
        if (grid.material) { grid.material.transparent = true; grid.material.opacity = 0.2; }
        scene.add(grid);

        this.viewers[key] = { scene, camera, renderer, mesh: null, wrapper: null, outerRing, innerRing, stars, time: 0 };

        // Animation loop
        const animate = () => {
            this.animFrames[key] = requestAnimationFrame(animate);
            const v = this.viewers[key];
            if (!v) return;

            v.time = (v.time || 0) + 0.016;
            if (v.wrapper) v.wrapper.rotation.y += 0.008;

            // Gentle camera breathing (zoom in/out subtly)
            if (v.camera) {
                const breathe = Math.sin(v.time * 0.4) * 3;
                v.camera.position.z = 120 + breathe;
            }

            // Animated platform rings
            if (v.outerRing) v.outerRing.rotation.z += 0.003;
            if (v.innerRing) v.innerRing.rotation.z -= 0.005;
            if (v.outerRing?.material) v.outerRing.material.opacity = 0.25 + Math.sin(v.time * 2) * 0.1;
            if (v.innerRing?.material) v.innerRing.material.opacity = 0.15 + Math.sin(v.time * 3 + 1) * 0.08;

            // Subtle star twinkle
            if (v.stars?.material) v.stars.material.opacity = 0.35 + Math.sin(v.time * 0.5) * 0.1;

            if (v.renderer) v.renderer.render(v.scene, v.camera);
        };
        animate();
    }

    async set3DShipMesh(key, shipId, config) {
        const viewer = this.viewers[key];
        if (!viewer) return;

        // Remove old mesh
        if (viewer.wrapper) {
            viewer.scene.remove(viewer.wrapper);
            viewer.wrapper = null;
            viewer.mesh = null;
        }

        try {
            const mesh = await shipMeshFactory.generateShipMeshAsync({
                shipId, role: config.role, size: config.size, detailLevel: 'high',
            });

            if (!this.viewers[key]) return; // Viewer disposed while loading

            const wrapper = new THREE.Group();
            wrapper.add(mesh);

            // Boost emissive so role colors pop
            mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    const mat = child.material;
                    if (mat.emissiveIntensity !== undefined) {
                        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.5);
                    }
                }
            });

            // Tilt procedural meshes (non-GLB) for better viewing angle
            if (!config.modelPath || !mesh.userData?.isGLB) {
                wrapper.rotation.x = -Math.PI / 3;
            }

            // Auto-fit: scale mesh to fill viewer
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
                const targetSize = 60;
                const scale = targetSize / maxDim;
                wrapper.scale.setScalar(scale);
            }

            viewer.scene.add(wrapper);
            viewer.wrapper = wrapper;
            viewer.mesh = mesh;
        } catch (e) {
            console.warn('Encyclopedia 3D viewer failed to load mesh:', e);
        }
    }

    disposeViewer(key) {
        if (this.animFrames[key]) {
            cancelAnimationFrame(this.animFrames[key]);
            delete this.animFrames[key];
        }

        const viewer = this.viewers[key];
        if (!viewer) return;

        // Traverse entire scene to dispose all geometries and materials
        viewer.scene.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });

        if (viewer.renderer) viewer.renderer.dispose();
        delete this.viewers[key];
    }

    disposeAllViewers() {
        for (const key of Object.keys(this.viewers)) {
            this.disposeViewer(key);
        }
        this.disposeThumbnailRenderer();
    }

    // =============================================
    // THUMBNAIL RENDERING
    // =============================================

    initThumbnailRenderer() {
        if (this.thumbRenderer) return;
        if (typeof THREE === 'undefined') return;

        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 110;

        this.thumbRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.thumbRenderer.setSize(160, 110);
        this.thumbRenderer.outputEncoding = THREE.sRGBEncoding;
        this.thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.thumbRenderer.toneMappingExposure = 0.9;

        this.thumbScene = new THREE.Scene();
        this.thumbScene.background = new THREE.Color(0x060a12);

        this.thumbCamera = new THREE.PerspectiveCamera(40, 160 / 110, 0.1, 500);
        this.thumbCamera.position.set(0, 30, 80);
        this.thumbCamera.lookAt(0, 0, 0);

        // Subdued lighting so PBR colors aren't washed out
        this.thumbScene.add(new THREE.AmbientLight(0xffffff, 0.25));
        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(4, 6, 5);
        this.thumbScene.add(keyLight);
        const fill = new THREE.DirectionalLight(0x6688aa, 0.3);
        fill.position.set(-4, 2, -3);
        this.thumbScene.add(fill);
        const rim = new THREE.DirectionalLight(0x00ccff, 0.3);
        rim.position.set(0, -3, -5);
        this.thumbScene.add(rim);

        // Subtle platform ring
        const ringGeo = new THREE.RingGeometry(20, 21.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -14;
        this.thumbScene.add(ring);

        this.thumbBaseLightCount = this.thumbScene.children.length;
    }

    async renderThumbnail(shipId, config) {
        if (this.thumbCache[shipId]) return this.thumbCache[shipId];

        this.initThumbnailRenderer();
        if (!this.thumbRenderer) return null;

        try {
            const mesh = await shipMeshFactory.generateShipMeshAsync({
                shipId, role: config.role, size: config.size, detailLevel: 'low',
            });

            const wrapper = new THREE.Group();
            wrapper.add(mesh);
            if (!mesh.userData?.isGLB) {
                wrapper.rotation.x = -Math.PI / 3;
            }

            // Fit to thumbnail view
            const box = new THREE.Box3().setFromObject(mesh);
            const sz = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(sz.x, sz.y, sz.z);
            if (maxDim > 0) wrapper.scale.setScalar(34 / maxDim);

            // Boost emissive intensity so role colors pop
            wrapper.traverse(child => {
                if (child.isMesh && child.material) {
                    const mat = child.material;
                    if (mat.emissiveIntensity !== undefined) {
                        mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 0.5);
                    }
                }
            });

            // Role-colored accent light for dramatic color cast
            const accentColor = ROLE_ACCENT_HEX[config.role] || 0x00ffff;
            const accent = new THREE.PointLight(accentColor, 2.0, 150);
            accent.position.set(20, 5, 30);

            this.thumbScene.add(wrapper);
            this.thumbScene.add(accent);
            this.thumbRenderer.render(this.thumbScene, this.thumbCamera);

            const dataUrl = this.thumbRenderer.domElement.toDataURL('image/png');
            this.thumbCache[shipId] = dataUrl;

            this.thumbScene.remove(wrapper);
            this.thumbScene.remove(accent);
            accent.dispose();

            wrapper.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });

            return dataUrl;
        } catch (e) {
            console.warn('[Encyclopedia] Thumbnail failed:', shipId, e);
            return null;
        }
    }

    async loadGridThumbnails() {
        const thumbs = this.contentEl.querySelectorAll('.enc-card-thumb:not(.loaded)');
        if (thumbs.length === 0) return;

        const BATCH = 3;
        const thumbArr = Array.from(thumbs);

        for (let i = 0; i < thumbArr.length; i += BATCH) {
            if (!this.visible) return; // Stop if encyclopedia closed
            const batch = thumbArr.slice(i, i + BATCH);
            await Promise.all(batch.map(async (img) => {
                const card = img.closest('.enc-card');
                if (!card) return;
                const id = card.dataset.id;
                const ship = SHIP_DATABASE[id];
                if (!ship) return;

                const dataUrl = await this.renderThumbnail(id, ship);
                if (dataUrl && img.isConnected) {
                    img.src = dataUrl;
                    img.classList.add('loaded');
                }
            }));
            // Yield to prevent blocking
            await new Promise(r => setTimeout(r, 8));
        }
    }

    disposeThumbnailRenderer() {
        if (this.thumbRenderer) {
            this.thumbRenderer.dispose();
            this.thumbRenderer = null;
        }
        this.thumbScene = null;
        this.thumbCamera = null;
    }
}
