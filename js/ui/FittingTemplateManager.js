export class FittingTemplateManager {
    constructor(game) {
        this.game = game;
        this.templates = [];
        this.nextId = 1;
        this._loadFromStorage();
    }

    saveTemplate(name) {
        const player = this.game.player;
        if (!player) {
            this.game.ui?.showToast('No active ship', 'error');
            return null;
        }

        const template = {
            id: this.nextId++,
            name: name || `Fitting ${this.templates.length + 1}`,
            shipClass: player.shipClass || player.type || 'unknown',
            modules: {
                high: this._cloneSlots(player.modules?.high),
                mid: this._cloneSlots(player.modules?.mid),
                low: this._cloneSlots(player.modules?.low)
            },
            timestamp: Date.now()
        };

        this.templates.push(template);
        this._saveToStorage();
        this.game.ui?.showToast(`Template "${template.name}" saved`, 'success');
        this.game.audio?.play('ui-click');
        this.game.ui?.log(`Saved fitting template: ${template.name}`, 'fitting');
        return template;
    }

    loadTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            this.game.ui?.showToast('Template not found', 'error');
            return false;
        }

        const player = this.game.player;
        if (!player) {
            this.game.ui?.showToast('No active ship', 'error');
            return false;
        }

        if (!player.docked) {
            this.game.ui?.showToast('Must be docked to change fittings', 'warning');
            return false;
        }

        player.modules = {
            high: this._cloneSlots(template.modules.high),
            mid: this._cloneSlots(template.modules.mid),
            low: this._cloneSlots(template.modules.low)
        };

        this.game.events.emit('fitting:changed', { shipId: player.id, templateId });
        this.game.ui?.showToast(`Loaded "${template.name}"`, 'success');
        this.game.audio?.play('ui-click');
        this.game.ui?.log(`Loaded fitting template: ${template.name}`, 'fitting');
        return true;
    }

    applyToFleetShip(templateId, fleetShip) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) {
            this.game.ui?.showToast('Template not found', 'error');
            return false;
        }

        if (!fleetShip) {
            this.game.ui?.showToast('No fleet ship selected', 'error');
            return false;
        }

        const player = this.game.player;
        if (!player || !player.docked) {
            this.game.ui?.showToast('Must be docked to fit fleet ships', 'warning');
            return false;
        }

        // Collect all modules needed
        const needed = [];
        for (const slotType of ['high', 'mid', 'low']) {
            const slots = template.modules[slotType] || [];
            for (const mod of slots) {
                if (mod && mod.id) {
                    needed.push(mod);
                }
            }
        }

        // Check cargo/inventory for missing modules and auto-buy
        for (const mod of needed) {
            if (!this._playerHasModule(mod.id)) {
                const price = this._getModulePrice(mod.id);
                if (player.credits < price) {
                    this.game.ui?.showToast(`Cannot afford ${mod.name || mod.id} (${price.toLocaleString()} CR)`, 'error');
                    return false;
                }
                player.credits -= price;
                this.game.ui?.log(`Auto-purchased ${mod.name || mod.id} for ${price.toLocaleString()} CR`, 'commerce');
            } else {
                this._removeModuleFromCargo(mod.id);
            }
        }

        fleetShip.modules = {
            high: this._cloneSlots(template.modules.high),
            mid: this._cloneSlots(template.modules.mid),
            low: this._cloneSlots(template.modules.low)
        };

        this.game.events.emit('fitting:changed', { shipId: fleetShip.id, templateId });
        this.game.ui?.showToast(`Applied "${template.name}" to fleet ship`, 'success');
        this.game.audio?.play('ui-click');
        this.game.ui?.log(`Applied template "${template.name}" to fleet ship`, 'fitting');
        return true;
    }

    deleteTemplate(templateId) {
        const idx = this.templates.findIndex(t => t.id === templateId);
        if (idx === -1) return false;

        const name = this.templates[idx].name;
        this.templates.splice(idx, 1);
        this._saveToStorage();
        this.game.ui?.showToast(`Deleted "${name}"`, 'warning');
        this.game.audio?.play('ui-click');
        return true;
    }

    renderTemplateSection(container) {
        const section = document.createElement('div');
        section.style.cssText = 'padding: 8px; color: #ccc; font-family: "Courier New", monospace; font-size: 12px;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 6px;';

        const title = document.createElement('span');
        title.textContent = '-- FITTING TEMPLATES --';
        title.style.cssText = 'color: #44ccff; font-weight: bold; font-size: 13px;';
        header.appendChild(title);

        // Save current fitting button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '+ SAVE CURRENT';
        saveBtn.style.cssText = 'background: #002233; color: #44ccff; border: 1px solid #44ccff; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-family: "Courier New", monospace; font-size: 11px; font-weight: bold;';
        saveBtn.addEventListener('click', () => this._promptSaveTemplate(container));
        header.appendChild(saveBtn);

        section.appendChild(header);

        // Template list
        if (this.templates.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No saved templates. Save your current fitting to create one.';
            empty.style.cssText = 'color: #666; font-style: italic; padding: 8px 0;';
            section.appendChild(empty);
        } else {
            for (const template of this.templates) {
                const card = this._createTemplateCard(template);
                section.appendChild(card);
            }
        }

        container.appendChild(section);
    }

    _createTemplateCard(template) {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid #333; border-radius: 4px; padding: 8px 10px; margin-bottom: 6px;';

        // Top row: name + ship class + date
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';

        const nameEl = document.createElement('span');
        nameEl.textContent = template.name;
        nameEl.style.cssText = 'color: #fff; font-weight: bold; font-size: 12px;';
        topRow.appendChild(nameEl);

        const meta = document.createElement('span');
        const date = new Date(template.timestamp);
        meta.textContent = `${template.shipClass} | ${date.toLocaleDateString()}`;
        meta.style.cssText = 'color: #888; font-size: 10px;';
        topRow.appendChild(meta);

        card.appendChild(topRow);

        // Module summary
        const summary = document.createElement('div');
        summary.style.cssText = 'color: #aaa; font-size: 11px; margin-bottom: 6px;';
        const highCount = (template.modules.high || []).filter(m => m && m.id).length;
        const midCount = (template.modules.mid || []).filter(m => m && m.id).length;
        const lowCount = (template.modules.low || []).filter(m => m && m.id).length;
        summary.textContent = `H: ${highCount} | M: ${midCount} | L: ${lowCount}`;
        card.appendChild(summary);

        // Module details
        for (const slotType of ['high', 'mid', 'low']) {
            const slots = template.modules[slotType] || [];
            for (const mod of slots) {
                if (mod && mod.id) {
                    const modEl = document.createElement('div');
                    modEl.textContent = `  [${slotType.toUpperCase()}] ${mod.name || mod.id}`;
                    modEl.style.cssText = 'color: #777; font-size: 10px; padding-left: 6px;';
                    card.appendChild(modEl);
                }
            }
        }

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px;';

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'LOAD';
        loadBtn.style.cssText = 'background: #002200; color: #44ff88; border: 1px solid #44ff88; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-family: "Courier New", monospace; font-size: 11px; font-weight: bold;';
        loadBtn.addEventListener('click', () => {
            this.loadTemplate(template.id);
        });
        btnRow.appendChild(loadBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'DELETE';
        delBtn.style.cssText = 'background: #330000; color: #ff4444; border: 1px solid #ff4444; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-family: "Courier New", monospace; font-size: 11px; font-weight: bold;';
        delBtn.addEventListener('click', () => {
            this.deleteTemplate(template.id);
            // Re-render parent
            const parent = card.closest('.station-tab-content');
            if (parent) {
                const templateContainer = card.parentElement;
                if (templateContainer) {
                    templateContainer.innerHTML = '';
                    this.renderTemplateSection(templateContainer);
                }
            }
        });
        btnRow.appendChild(delBtn);

        card.appendChild(btnRow);
        return card;
    }

    _promptSaveTemplate(container) {
        const name = prompt('Enter template name:');
        if (name && name.trim()) {
            this.saveTemplate(name.trim());
            // Re-render
            const parent = container.parentElement;
            if (parent) {
                container.innerHTML = '';
                this.renderTemplateSection(container);
            }
        }
    }

    _cloneSlots(slots) {
        if (!slots) return [];
        return slots.map(s => s ? { ...s } : null);
    }

    _playerHasModule(moduleId) {
        const player = this.game.player;
        if (!player || !player.cargo) return false;
        return player.cargo.some(item => item.id === moduleId && (item.quantity || item.amount || 1) > 0);
    }

    _removeModuleFromCargo(moduleId) {
        const player = this.game.player;
        if (!player || !player.cargo) return;
        const idx = player.cargo.findIndex(item => item.id === moduleId);
        if (idx !== -1) {
            const item = player.cargo[idx];
            const qty = item.quantity || item.amount || 1;
            if (qty <= 1) {
                player.cargo.splice(idx, 1);
            } else {
                if (item.quantity) item.quantity--;
                if (item.amount) item.amount--;
            }
        }
    }

    _getModulePrice(moduleId) {
        // Attempt to get price from game config or default
        if (this.game.getModuleConfig) {
            const config = this.game.getModuleConfig(moduleId);
            if (config && config.price) return config.price;
        }
        return 1000; // fallback price
    }

    saveState() {
        return {
            templates: JSON.parse(JSON.stringify(this.templates)),
            nextId: this.nextId
        };
    }

    loadState(data) {
        if (!data) return;
        this.templates = data.templates || [];
        this.nextId = data.nextId || this.templates.length + 1;
        this._saveToStorage();
    }

    _saveToStorage() {
        try {
            localStorage.setItem('expedition-fitting-templates', JSON.stringify({
                templates: this.templates,
                nextId: this.nextId
            }));
        } catch (e) {
            // Storage full or unavailable
        }
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem('expedition-fitting-templates');
            if (raw) {
                const data = JSON.parse(raw);
                this.templates = data.templates || [];
                this.nextId = data.nextId || this.templates.length + 1;
            }
        } catch (e) {
            this.templates = [];
            this.nextId = 1;
        }
    }
}
