// =============================================
// POS Management Panel
// Floating panel for managing player-owned stations:
// Overview, Modules, Turrets, Storage, Repair
// =============================================

import { POS_MODULES, POS_MAX_SLOTS, getModuleProgress } from '../data/posModuleDatabase.js';
import { TURRET_TYPES } from '../entities/PlayerStation.js';
import { TRADE_GOODS } from '../data/tradeGoodsDatabase.js';
import { formatCredits } from '../utils/math.js';

export class POSManagementPanel {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this.station = null;
        this.activeTab = 'overview';

        this.panel = document.getElementById('pos-panel');
        this.content = document.getElementById('pos-content');

        this.setupEvents();
    }

    setupEvents() {
        if (!this.panel) return;

        // Close button
        const closeBtn = this.panel.querySelector('.panel-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Tab buttons
        this.panel.querySelectorAll('.pos-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTab = btn.dataset.posTab;
                this.panel.querySelectorAll('.pos-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.render();
            });
        });

        // Delegated click handler for actions inside content
        this.content?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-pos-action]');
            if (!btn) return;
            this.handleAction(btn.dataset.posAction, btn.dataset);
        });
    }

    show(station) {
        if (!station || !this.panel) return;
        this.station = station;
        this.activeTab = 'overview';

        // Reset tab buttons
        this.panel.querySelectorAll('.pos-tab-btn').forEach(b => b.classList.remove('active'));
        const firstTab = this.panel.querySelector('.pos-tab-btn[data-pos-tab="overview"]');
        if (firstTab) firstTab.classList.add('active');

        this.panel.classList.remove('hidden');
        this.render();
    }

    hide() {
        if (!this.panel) return;
        this.panel.classList.add('hidden');
        this.station = null;
    }

    isVisible() {
        return this.station && this.panel && !this.panel.classList.contains('hidden');
    }

    render() {
        if (!this.content || !this.station) return;

        switch (this.activeTab) {
            case 'overview': this.renderOverview(); break;
            case 'modules': this.renderModules(); break;
            case 'turrets': this.renderTurrets(); break;
            case 'storage': this.renderStorage(); break;
            case 'repair': this.renderRepair(); break;
        }
    }

    // ----- Overview Tab -----

    renderOverview() {
        const s = this.station;
        const hullPct = s.maxHull > 0 ? (s.hull / s.maxHull * 100) : 0;
        const shieldPct = s.maxShieldHP > 0 ? (s.shieldHP / s.maxShieldHP * 100) : 0;
        const storageUsed = s.getStorageUsed();
        const bonuses = s.getModuleBonuses();
        const completedModules = s.modules.filter(m => m.completed).length;

        const sectorName = this.game.currentSector?.name || s.sectorId || 'Unknown';

        this.content.innerHTML = `
            <div class="pos-overview-header">
                <div class="pos-station-icon" style="color: ${s.owner.color}">\u2B22</div>
                <div class="pos-station-info">
                    <div class="pos-station-name">${s.name}</div>
                    <div class="pos-station-location">${sectorName} \u2022 ${s.owner.name}</div>
                </div>
            </div>

            <div class="pos-health-bars">
                <div class="pos-health-row">
                    <span class="pos-health-label">HULL</span>
                    <div class="pos-health-bar">
                        <div class="pos-health-fill hull" style="width: ${hullPct}%"></div>
                    </div>
                    <span class="pos-health-text">${Math.floor(s.hull)} / ${s.maxHull}</span>
                </div>
                <div class="pos-health-row">
                    <span class="pos-health-label">SHIELDS</span>
                    <div class="pos-health-bar">
                        <div class="pos-health-fill shield" style="width: ${shieldPct}%"></div>
                    </div>
                    <span class="pos-health-text">${Math.floor(s.shieldHP)} / ${s.maxShieldHP}</span>
                </div>
            </div>

            <div class="pos-stats-grid">
                <div class="pos-stat-item">
                    <span class="pos-stat-label">MODULES</span>
                    <span class="pos-stat-value">${completedModules} / ${s.maxModuleSlots}</span>
                </div>
                <div class="pos-stat-item">
                    <span class="pos-stat-label">TURRETS</span>
                    <span class="pos-stat-value">${s.turrets.length} / ${s.maxTurrets}</span>
                </div>
                <div class="pos-stat-item">
                    <span class="pos-stat-label">STORAGE</span>
                    <span class="pos-stat-value">${storageUsed.toLocaleString()} / ${s.storageCapacity.toLocaleString()} m\u00B3</span>
                </div>
                <div class="pos-stat-item">
                    <span class="pos-stat-label">REFINERY</span>
                    <span class="pos-stat-value">${(s.refineryBonus * 100).toFixed(0)}%</span>
                </div>
                <div class="pos-stat-item">
                    <span class="pos-stat-label">SHIELD REGEN</span>
                    <span class="pos-stat-value">${s.shieldRegen.toFixed(1)} / s</span>
                </div>
                <div class="pos-stat-item">
                    <span class="pos-stat-label">DEFENSE LVL</span>
                    <span class="pos-stat-value">${s.upgradeLevel.defense}</span>
                </div>
                ${bonuses.fleetAutoRepair ? `<div class="pos-stat-item"><span class="pos-stat-label">FLEET REPAIR</span><span class="pos-stat-value" style="color:#44ff88">ACTIVE</span></div>` : ''}
                ${bonuses.shipManufacturing ? `<div class="pos-stat-item"><span class="pos-stat-label">SHIPYARD</span><span class="pos-stat-value" style="color:#44ff88">ONLINE</span></div>` : ''}
            </div>
        `;
    }

    // ----- Modules Tab -----

    renderModules() {
        const s = this.station;
        const installedIds = new Set(s.modules.map(m => m.id));
        let html = '';

        // Installed modules first
        for (let i = 0; i < s.modules.length; i++) {
            const slot = s.modules[i];
            const modDef = POS_MODULES[slot.id];
            if (!modDef) continue;

            const progress = getModuleProgress(slot.contributed, slot.id);
            const pct = (progress * 100).toFixed(1);

            if (slot.completed) {
                html += `
                    <div class="pos-module-card completed">
                        <div class="pos-module-header">
                            <span class="pos-module-icon">${modDef.icon}</span>
                            <span class="pos-module-name">${modDef.name}</span>
                            <span class="pos-module-status online">ONLINE</span>
                        </div>
                        <div class="pos-module-desc">${modDef.description}</div>
                    </div>
                `;
            } else {
                html += this.renderBuildingModule(i, slot, modDef, pct);
            }
        }

        // Available modules (not yet installed)
        const available = Object.entries(POS_MODULES).filter(([id]) => !installedIds.has(id));
        if (available.length > 0 && s.modules.length < s.maxModuleSlots) {
            html += `<div class="pos-section-title">AVAILABLE MODULES</div>`;
            for (const [modId, modDef] of available) {
                html += this.renderAvailableModule(modId, modDef);
            }
        }

        html += `<div class="pos-slots-remaining">MODULE SLOTS: ${s.modules.length} / ${s.maxModuleSlots}</div>`;
        this.content.innerHTML = html;
    }

    renderBuildingModule(slotIndex, slot, modDef, pct) {
        let materialsHtml = '';
        for (const [matId, required] of Object.entries(modDef.materials)) {
            const contributed = slot.contributed[matId] || 0;
            const cls = contributed >= required ? 'met' : contributed > 0 ? 'partial' : '';
            const goodName = TRADE_GOODS[matId]?.name || matId;
            materialsHtml += `<span class="pos-material-chip ${cls}">${goodName}: ${contributed}/${required}</span>`;
        }

        // Check what's available in POS storage for contribution
        let canContribute = false;
        for (const matId of Object.keys(modDef.materials)) {
            const required = modDef.materials[matId];
            const contributed = slot.contributed[matId] || 0;
            if (contributed >= required) continue;
            const inStorage = (this.station.storage.tradeGoods[matId]?.quantity || 0) +
                              (this.station.storage.materials[matId]?.quantity || 0);
            if (inStorage > 0) { canContribute = true; break; }
        }

        return `
            <div class="pos-module-card in-progress">
                <div class="pos-module-header">
                    <span class="pos-module-icon">${modDef.icon}</span>
                    <span class="pos-module-name">${modDef.name}</span>
                    <span class="pos-module-status building">BUILDING</span>
                </div>
                <div class="pos-module-desc">${modDef.description}</div>
                <div class="pos-module-progress">
                    <div class="pos-progress-bar">
                        <div class="pos-progress-fill" style="width: ${pct}%"></div>
                    </div>
                    <div class="pos-progress-text">${pct}% COMPLETE</div>
                </div>
                <div class="pos-materials-list">${materialsHtml}</div>
                <div class="pos-module-actions">
                    <button class="pos-btn success" data-pos-action="contribute" data-slot="${slotIndex}" ${canContribute ? '' : 'disabled'}>
                        CONTRIBUTE RESOURCES
                    </button>
                </div>
            </div>
        `;
    }

    renderAvailableModule(modId, modDef) {
        let materialsHtml = '';
        for (const [matId, required] of Object.entries(modDef.materials)) {
            const goodName = TRADE_GOODS[matId]?.name || matId;
            materialsHtml += `<span class="pos-material-chip">${goodName}: ${required}</span>`;
        }

        return `
            <div class="pos-module-card">
                <div class="pos-module-header">
                    <span class="pos-module-icon">${modDef.icon}</span>
                    <span class="pos-module-name">${modDef.name}</span>
                    <span class="pos-module-status available">AVAILABLE</span>
                </div>
                <div class="pos-module-desc">${modDef.description}</div>
                <div class="pos-materials-list">${materialsHtml}</div>
                <div class="pos-module-actions">
                    <button class="pos-btn" data-pos-action="begin-construction" data-module-id="${modId}">
                        BEGIN CONSTRUCTION
                    </button>
                </div>
            </div>
        `;
    }

    // ----- Turrets Tab -----

    renderTurrets() {
        const s = this.station;
        let html = '<div class="pos-section-title">INSTALLED TURRETS</div>';

        // Installed turrets
        for (let i = 0; i < s.maxTurrets; i++) {
            const turret = s.turrets[i];
            if (turret) {
                html += `
                    <div class="pos-turret-slot">
                        <span class="pos-turret-name">${turret.name}</span>
                        <span class="pos-turret-stats">DMG ${turret.damage} | RNG ${turret.range} | ${turret.cycleTime}s</span>
                        <button class="pos-btn danger" data-pos-action="remove-turret" data-index="${i}">REMOVE</button>
                    </div>
                `;
            } else {
                html += `
                    <div class="pos-turret-slot empty">
                        <span class="pos-turret-name" style="color: rgba(150,180,200,0.3)">[ Empty Slot ]</span>
                    </div>
                `;
            }
        }

        // Turret shop
        if (s.turrets.length < s.maxTurrets) {
            html += `
                <div class="pos-turret-shop">
                    <div class="pos-turret-shop-title">PURCHASE TURRETS</div>
            `;
            for (const [typeId, t] of Object.entries(TURRET_TYPES)) {
                const canAfford = this.game.credits >= t.price;
                html += `
                    <div class="pos-turret-buy-row">
                        <span class="pos-turret-buy-name">${t.name}</span>
                        <span class="pos-turret-buy-stats">DMG ${t.damage} | RNG ${t.range} | ${t.cycleTime}s</span>
                        <span class="pos-turret-buy-price">${formatCredits(t.price)}</span>
                        <button class="pos-btn" data-pos-action="buy-turret" data-turret-type="${typeId}" ${canAfford ? '' : 'disabled'}>BUY</button>
                    </div>
                `;
            }
            html += `</div>`;
        }

        this.content.innerHTML = html;
    }

    // ----- Storage Tab -----

    renderStorage() {
        const s = this.station;
        const used = s.getStorageUsed();

        let html = `
            <div class="pos-storage-header">
                <span class="pos-section-title" style="border:none;margin:0;padding:0">STATION STORAGE</span>
                <span class="pos-storage-capacity">${used.toLocaleString()} / ${s.storageCapacity.toLocaleString()} m\u00B3</span>
            </div>
        `;

        // Player cargo transfer section
        html += `<div class="pos-section-title">TRANSFER FROM SHIP</div>`;
        const player = this.game.player;
        const playerItems = this.getPlayerTransferableItems(player);
        if (playerItems.length > 0) {
            html += `<div class="pos-storage-items">`;
            for (const item of playerItems) {
                html += `
                    <div class="pos-storage-row">
                        <span class="pos-storage-name">${item.name}</span>
                        <span class="pos-storage-qty">${item.quantity}</span>
                        <div class="pos-storage-transfer">
                            <button class="pos-btn" data-pos-action="transfer-to-pos" data-item-id="${item.id}" data-item-type="${item.type}" data-qty="1">+1</button>
                            <button class="pos-btn" data-pos-action="transfer-to-pos" data-item-id="${item.id}" data-item-type="${item.type}" data-qty="${item.quantity}">ALL</button>
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        } else {
            html += `<div class="pos-empty-msg">NO TRANSFERABLE ITEMS IN SHIP</div>`;
        }

        // POS storage contents
        html += `<div class="pos-section-title" style="margin-top:12px">STATION CONTENTS</div>`;
        const posItems = this.getPOSStorageItems(s);
        if (posItems.length > 0) {
            html += `<div class="pos-storage-items">`;
            for (const item of posItems) {
                html += `
                    <div class="pos-storage-row">
                        <span class="pos-storage-name">${item.name}</span>
                        <span class="pos-storage-qty">${item.quantity}</span>
                        <div class="pos-storage-transfer">
                            <button class="pos-btn" data-pos-action="transfer-to-ship" data-item-id="${item.id}" data-item-type="${item.type}" data-qty="1">-1</button>
                            <button class="pos-btn" data-pos-action="transfer-to-ship" data-item-id="${item.id}" data-item-type="${item.type}" data-qty="${item.quantity}">ALL</button>
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        } else {
            html += `<div class="pos-empty-msg">STORAGE EMPTY</div>`;
        }

        this.content.innerHTML = html;
    }

    getPlayerTransferableItems(player) {
        const items = [];
        if (!player) return items;

        // Trade goods
        const tradeGoods = player.tradeGoods || {};
        for (const [id, data] of Object.entries(tradeGoods)) {
            if (data.quantity > 0) {
                const def = TRADE_GOODS[id];
                items.push({
                    id, type: 'tradeGoods',
                    name: def?.name || id,
                    quantity: data.quantity,
                    volume: def?.volume || 1,
                });
            }
        }

        // Ore cargo
        for (const [id, data] of Object.entries(player.cargo || {})) {
            if (data.units > 0 || data.quantity > 0) {
                items.push({
                    id, type: 'ore',
                    name: data.name || id,
                    quantity: data.units || data.quantity || 0,
                    volume: data.volume || 1,
                });
            }
        }

        // Materials
        for (const [id, amount] of Object.entries(player.materials || {})) {
            if (amount > 0) {
                items.push({
                    id, type: 'materials',
                    name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    quantity: amount,
                    volume: 0.5,
                });
            }
        }

        return items;
    }

    getPOSStorageItems(station) {
        const items = [];
        for (const [category, bucket] of Object.entries(station.storage)) {
            for (const [id, data] of Object.entries(bucket)) {
                if ((data.quantity || 0) > 0) {
                    const def = TRADE_GOODS[id];
                    items.push({
                        id, type: category,
                        name: def?.name || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        quantity: data.quantity,
                    });
                }
            }
        }
        return items;
    }

    // ----- Repair Tab -----

    renderRepair() {
        const s = this.station;
        const cost = s.getRepairCost();
        const hullPct = s.maxHull > 0 ? (s.hull / s.maxHull * 100) : 0;
        const shieldPct = s.maxShieldHP > 0 ? (s.shieldHP / s.maxShieldHP * 100) : 0;

        let html = `
            <div class="pos-health-bars" style="margin-bottom:16px">
                <div class="pos-health-row">
                    <span class="pos-health-label">HULL</span>
                    <div class="pos-health-bar">
                        <div class="pos-health-fill hull" style="width: ${hullPct}%"></div>
                    </div>
                    <span class="pos-health-text">${Math.floor(s.hull)} / ${s.maxHull}</span>
                </div>
                <div class="pos-health-row">
                    <span class="pos-health-label">SHIELDS</span>
                    <div class="pos-health-bar">
                        <div class="pos-health-fill shield" style="width: ${shieldPct}%"></div>
                    </div>
                    <span class="pos-health-text">${Math.floor(s.shieldHP)} / ${s.maxShieldHP}</span>
                </div>
            </div>
        `;

        if (cost > 0) {
            const canAfford = this.game.credits >= cost;
            html += `
                <div class="pos-repair-section">
                    <div class="pos-repair-cost">REPAIR COST: ${formatCredits(cost)} ISK</div>
                    <button class="pos-btn success" data-pos-action="repair" ${canAfford ? '' : 'disabled'}>
                        REPAIR STATION
                    </button>
                    ${!canAfford ? '<div style="color:rgba(255,80,80,0.6);font:10px var(--font-mono);margin-top:6px">INSUFFICIENT FUNDS</div>' : ''}
                </div>
            `;
        } else {
            html += `<div class="pos-repair-ok">STATION FULLY OPERATIONAL</div>`;
        }

        this.content.innerHTML = html;
    }

    // ----- Action Handler -----

    handleAction(action, dataset) {
        if (!this.station) return;

        switch (action) {
            case 'begin-construction':
                this.beginConstruction(dataset.moduleId);
                break;
            case 'contribute':
                this.contributeResources(parseInt(dataset.slot));
                break;
            case 'buy-turret':
                this.buyTurret(dataset.turretType);
                break;
            case 'remove-turret':
                this.removeTurret(parseInt(dataset.index));
                break;
            case 'transfer-to-pos':
                this.transferToPOS(dataset.itemId, dataset.itemType, parseInt(dataset.qty));
                break;
            case 'transfer-to-ship':
                this.transferToShip(dataset.itemId, dataset.itemType, parseInt(dataset.qty));
                break;
            case 'repair':
                this.repairStation();
                break;
        }
    }

    beginConstruction(moduleId) {
        const result = this.station.installModule(moduleId);
        if (result === -1) {
            this.ui?.toast('Cannot begin construction - no slots or duplicate', 'error');
            return;
        }
        const modDef = POS_MODULES[moduleId];
        this.ui?.toast(`Construction started: ${modDef?.name}`, 'success');
        this.ui?.log(`POS: Started construction of ${modDef?.name}`, 'system');
        this.game.audio?.play('scan-complete');
        this.render();
    }

    contributeResources(slotIndex) {
        const slot = this.station.modules[slotIndex];
        if (!slot || slot.completed) return;

        const modDef = POS_MODULES[slot.id];
        if (!modDef) return;

        // Auto-contribute maximum available from storage for each material
        let contributed = false;
        for (const [matId, required] of Object.entries(modDef.materials)) {
            const already = slot.contributed[matId] || 0;
            const remaining = required - already;
            if (remaining <= 0) continue;

            // contributeToModule pulls from both tradeGoods and materials buckets
            const actual = this.station.contributeToModule(slotIndex, matId, remaining);
            if (actual > 0) contributed = true;
        }

        if (contributed) {
            if (slot.completed) {
                this.ui?.toast(`${modDef.name} construction complete!`, 'success');
                this.ui?.log(`POS: ${modDef.name} module is now ONLINE`, 'system');
                this.game.audio?.play('quest-complete');
            } else {
                this.ui?.toast('Resources contributed', 'success');
                this.game.audio?.play('loot');
            }
        } else {
            this.ui?.toast('No matching resources in storage', 'warning');
        }

        this.render();
    }

    buyTurret(turretType) {
        const template = TURRET_TYPES[turretType];
        if (!template) return;

        if (this.game.credits < template.price) {
            this.ui?.toast('Insufficient credits', 'error');
            return;
        }

        if (!this.station.addTurret(turretType)) {
            this.ui?.toast('No turret slots available', 'error');
            return;
        }

        this.game.credits -= template.price;
        this.ui?.toast(`Installed ${template.name}`, 'success');
        this.ui?.log(`POS: Installed ${template.name}`, 'system');
        this.game.audio?.play('module-online');
        this.render();
    }

    removeTurret(index) {
        const turret = this.station.turrets[index];
        if (!turret) return;

        this.station.removeTurret(index);
        this.ui?.toast(`Removed ${turret.name}`, 'success');
        this.render();
    }

    transferToPOS(itemId, itemType, qty) {
        const player = this.game.player;
        if (!player) return;

        let transferred = 0;

        if (itemType === 'tradeGoods') {
            const tg = player.tradeGoods || {};
            const available = tg[itemId]?.quantity || 0;
            const amount = Math.min(qty, available);
            if (amount <= 0) return;

            const goodDef = TRADE_GOODS[itemId];
            const vol = goodDef?.volume || 1;

            if (this.station.addToStorage('tradeGoods', itemId, amount, vol)) {
                tg[itemId].quantity -= amount;
                if (tg[itemId].quantity <= 0) delete tg[itemId];
                transferred = amount;
            }
        } else if (itemType === 'ore') {
            const cargo = player.cargo || {};
            const data = cargo[itemId];
            if (!data) return;
            const available = data.units || data.quantity || 0;
            const amount = Math.min(qty, available);
            if (amount <= 0) return;

            if (this.station.addToStorage('ore', itemId, amount, data.volume || 1)) {
                if (data.units !== undefined) data.units -= amount;
                if (data.quantity !== undefined) data.quantity -= amount;
                if ((data.units || data.quantity || 0) <= 0) delete cargo[itemId];
                // Recalc cargo
                let used = 0;
                for (const d of Object.values(cargo)) used += d.volume || 0;
                player.cargoUsed = used;
                transferred = amount;
            }
        } else if (itemType === 'materials') {
            const mats = player.materials || {};
            const available = mats[itemId] || 0;
            const amount = Math.min(qty, available);
            if (amount <= 0) return;

            if (this.station.addToStorage('materials', itemId, amount, 0.5)) {
                mats[itemId] -= amount;
                if (mats[itemId] <= 0) delete mats[itemId];
                transferred = amount;
            }
        }

        if (transferred > 0) {
            this.ui?.toast(`Transferred ${transferred} to station`, 'success');
            this.game.audio?.play('loot');
        } else {
            this.ui?.toast('Transfer failed - storage full?', 'error');
        }

        this.render();
    }

    transferToShip(itemId, itemType, qty) {
        const player = this.game.player;
        if (!player) return;

        const bucket = this.station.storage[itemType];
        if (!bucket || !bucket[itemId]) return;

        const available = bucket[itemId].quantity || 0;
        const amount = Math.min(qty, available);
        if (amount <= 0) return;

        let transferred = false;

        if (itemType === 'tradeGoods') {
            if (!player.tradeGoods) player.tradeGoods = {};
            if (!player.tradeGoods[itemId]) {
                player.tradeGoods[itemId] = { quantity: 0 };
            }
            player.tradeGoods[itemId].quantity += amount;
            this.station.removeFromStorage('tradeGoods', itemId, amount);
            transferred = true;
        } else if (itemType === 'ore') {
            if (!player.cargo) player.cargo = {};
            if (!player.cargo[itemId]) {
                player.cargo[itemId] = { units: 0, volume: 0, name: itemId };
            }
            if (player.cargo[itemId].units !== undefined) {
                player.cargo[itemId].units += amount;
            } else {
                player.cargo[itemId].quantity = (player.cargo[itemId].quantity || 0) + amount;
            }
            this.station.removeFromStorage('ore', itemId, amount);
            transferred = true;
        } else if (itemType === 'materials') {
            if (!player.materials) player.materials = {};
            player.materials[itemId] = (player.materials[itemId] || 0) + amount;
            this.station.removeFromStorage('materials', itemId, amount);
            transferred = true;
        }

        if (transferred) {
            this.ui?.toast(`Transferred ${amount} to ship`, 'success');
            this.game.audio?.play('loot');
        }

        this.render();
    }

    repairStation() {
        const cost = this.station.repair();
        if (cost > 0) {
            this.ui?.toast(`Station repaired for ${formatCredits(cost)} ISK`, 'success');
            this.ui?.log(`POS: Repaired for ${formatCredits(cost)} ISK`, 'system');
            this.game.audio?.play('repair');
        } else {
            this.ui?.toast('Cannot repair station', 'error');
        }
        this.render();
    }
}
