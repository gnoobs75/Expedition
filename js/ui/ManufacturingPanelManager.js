import { BLUEPRINT_DATABASE, MATERIAL_DATABASE } from '../data/blueprintDatabase.js';

export class ManufacturingPanelManager {
    constructor(game) {
        this.game = game;
    }

    render(container) {
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding: 10px; color: #ccc; font-family: "Courier New", monospace; font-size: 13px; overflow-y: auto; max-height: 500px;';

        // Section 1: Blueprint Shop
        this._renderShopSection(wrapper);

        // Section 2: Owned Blueprints
        this._renderOwnedSection(wrapper);

        // Section 3: Active Jobs
        this._renderJobsSection(wrapper);

        container.appendChild(wrapper);
    }

    _renderShopSection(wrapper) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const header = document.createElement('div');
        header.textContent = '-- BLUEPRINT SHOP --';
        header.style.cssText = 'color: #ffcc44; font-size: 14px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;';
        section.appendChild(header);

        const mfg = this.game.manufacturingSystem;
        const stationBps = mfg.getStationBlueprints();

        if (!stationBps || stationBps.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No blueprints available at this station.';
            empty.style.cssText = 'color: #666; font-style: italic; padding: 8px 0;';
            section.appendChild(empty);
            wrapper.appendChild(section);
            return;
        }

        for (const bp of stationBps) {
            const card = this._createBlueprintCard(bp, 'shop');
            section.appendChild(card);
        }

        wrapper.appendChild(section);
    }

    _renderOwnedSection(wrapper) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const header = document.createElement('div');
        header.textContent = '-- MY BLUEPRINTS --';
        header.style.cssText = 'color: #44ccff; font-size: 14px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;';
        section.appendChild(header);

        const mfg = this.game.manufacturingSystem;
        const owned = mfg.getOwnedBlueprints();

        if (!owned || owned.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No blueprints owned. Purchase from the shop above.';
            empty.style.cssText = 'color: #666; font-style: italic; padding: 8px 0;';
            section.appendChild(empty);
            wrapper.appendChild(section);
            return;
        }

        for (const bp of owned) {
            const card = this._createBlueprintCard(bp, 'owned');
            section.appendChild(card);
        }

        wrapper.appendChild(section);
    }

    _renderJobsSection(wrapper) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const header = document.createElement('div');
        header.textContent = '-- ACTIVE JOBS --';
        header.style.cssText = 'color: #ff8844; font-size: 14px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;';
        section.appendChild(header);

        const mfg = this.game.manufacturingSystem;
        const jobs = mfg.getActiveJobs();

        if (!jobs || jobs.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No active manufacturing jobs.';
            empty.style.cssText = 'color: #666; font-style: italic; padding: 8px 0;';
            section.appendChild(empty);
            wrapper.appendChild(section);
            return;
        }

        for (const job of jobs) {
            const card = this._createJobCard(job);
            section.appendChild(card);
        }

        wrapper.appendChild(section);
    }

    _createBlueprintCard(bp, mode) {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid #333; border-radius: 4px; padding: 8px 10px; margin-bottom: 6px;';

        // Blueprint name and output
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';

        const name = document.createElement('span');
        name.textContent = bp.name || bp.id;
        name.style.cssText = 'color: #fff; font-weight: bold; font-size: 13px;';
        titleRow.appendChild(name);

        if (bp.outputName) {
            const output = document.createElement('span');
            output.textContent = `=> ${bp.outputName}`;
            output.style.cssText = 'color: #88ff88; font-size: 13px;';
            titleRow.appendChild(output);
        }

        card.appendChild(titleRow);

        // Description
        if (bp.description) {
            const desc = document.createElement('div');
            desc.textContent = bp.description;
            desc.style.cssText = 'color: #888; font-size: 13px; margin-bottom: 6px;';
            card.appendChild(desc);
        }

        // Craft time
        if (bp.craftTime) {
            const time = document.createElement('div');
            time.textContent = `Craft Time: ${bp.craftTime}s`;
            time.style.cssText = 'color: #aaa; font-size: 13px; margin-bottom: 4px;';
            card.appendChild(time);
        }

        // Material requirements
        if (bp.materials && bp.materials.length > 0) {
            const matHeader = document.createElement('div');
            matHeader.textContent = 'Materials:';
            matHeader.style.cssText = 'color: #aaa; font-size: 13px; margin-bottom: 2px;';
            card.appendChild(matHeader);

            const mfg = this.game.manufacturingSystem;

            for (const mat of bp.materials) {
                const matRow = document.createElement('div');
                matRow.style.cssText = 'padding-left: 10px; font-size: 13px; margin-bottom: 1px;';

                const matInfo = MATERIAL_DATABASE ? MATERIAL_DATABASE[mat.id] : null;
                const matName = matInfo ? matInfo.name : mat.id;
                const required = mat.quantity || mat.amount || 1;

                // Check if player has enough
                const hasMats = mfg.hasMaterials ? mfg.hasMaterials(bp.id) : true;
                const playerHas = this._getPlayerMaterialCount(mat.id);
                const sufficient = playerHas >= required;

                matRow.textContent = `  ${matName} x${required} (have: ${playerHas})`;
                matRow.style.color = sufficient ? '#44ff88' : '#ff4444';
                card.appendChild(matRow);
            }
        }

        // Action button
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top: 8px; text-align: right;';

        if (mode === 'shop') {
            const price = bp.price || 0;
            const btn = document.createElement('button');
            btn.textContent = `BUY - ${price.toLocaleString()} CR`;
            btn.style.cssText = this._buttonStyle('#ffcc44', '#332200');
            const canAfford = this.game.player && this.game.player.credits >= price;
            if (!canAfford) {
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.addEventListener('click', () => this._purchaseBlueprint(bp.id));
            }
            btnRow.appendChild(btn);
        } else if (mode === 'owned') {
            const mfg = this.game.manufacturingSystem;
            const canCraft = mfg.hasMaterials ? mfg.hasMaterials(bp.id) : true;
            const btn = document.createElement('button');
            btn.textContent = 'CRAFT';
            btn.style.cssText = this._buttonStyle('#44ccff', '#002233');
            if (!canCraft) {
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.title = 'Insufficient materials';
            } else {
                btn.addEventListener('click', () => this._startCrafting(bp.id));
            }
            btnRow.appendChild(btn);
        }

        card.appendChild(btnRow);
        return card;
    }

    _createJobCard(job) {
        const card = document.createElement('div');
        card.style.cssText = 'background: rgba(255,140,50,0.06); border: 1px solid #553300; border-radius: 4px; padding: 8px 10px; margin-bottom: 6px;';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';

        const name = document.createElement('span');
        name.textContent = job.blueprintName || job.blueprintId || 'Unknown';
        name.style.cssText = 'color: #ff8844; font-weight: bold; font-size: 13px;';
        topRow.appendChild(name);

        const pct = job.craftTime > 0 ? Math.min(100, (job.progress / job.craftTime) * 100) : 0;
        const pctLabel = document.createElement('span');
        pctLabel.textContent = `${pct.toFixed(1)}%`;
        pctLabel.style.cssText = 'color: #ffcc44; font-size: 13px;';
        topRow.appendChild(pctLabel);

        card.appendChild(topRow);

        // Progress bar
        const barOuter = document.createElement('div');
        barOuter.style.cssText = 'background: #222; border: 1px solid #444; border-radius: 3px; height: 14px; overflow: hidden; margin-bottom: 6px;';

        const barInner = document.createElement('div');
        barInner.style.cssText = `background: linear-gradient(90deg, #ff6600, #ffcc00); height: 100%; width: ${pct}%; transition: width 0.3s;`;
        barOuter.appendChild(barInner);
        card.appendChild(barOuter);

        // Time remaining
        const remaining = Math.max(0, job.craftTime - job.progress);
        const timeLabel = document.createElement('div');
        timeLabel.textContent = `Time remaining: ${remaining.toFixed(0)}s`;
        timeLabel.style.cssText = 'color: #888; font-size: 13px; margin-bottom: 6px;';
        card.appendChild(timeLabel);

        // Cancel button
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'text-align: right;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'CANCEL';
        cancelBtn.style.cssText = this._buttonStyle('#ff4444', '#330000');
        cancelBtn.addEventListener('click', () => this._cancelJob(job.id));
        btnRow.appendChild(cancelBtn);
        card.appendChild(btnRow);

        return card;
    }

    _purchaseBlueprint(bpId) {
        const mfg = this.game.manufacturingSystem;
        const result = mfg.purchaseBlueprint(bpId);
        if (result === false || (result && result.error)) {
            const msg = (result && result.error) || 'Cannot purchase blueprint';
            this.game.ui?.showToast(msg, 'error');
            this.game.audio?.play('ui-error');
        } else {
            this.game.ui?.showToast('Blueprint purchased', 'success');
            this.game.audio?.play('ui-buy');
            this.game.ui?.log('Purchased blueprint', 'industry');
            this._refresh();
        }
    }

    _startCrafting(bpId) {
        const mfg = this.game.manufacturingSystem;
        const result = mfg.startJob(bpId);
        if (result === false || (result && result.error)) {
            const msg = (result && result.error) || 'Cannot start crafting job';
            this.game.ui?.showToast(msg, 'error');
            this.game.audio?.play('ui-error');
        } else {
            this.game.ui?.showToast('Crafting started', 'success');
            this.game.audio?.play('ui-click');
            this.game.ui?.log('Started manufacturing job', 'industry');
            this._refresh();
        }
    }

    _cancelJob(jobId) {
        const mfg = this.game.manufacturingSystem;
        mfg.cancelJob(jobId);
        this.game.ui?.showToast('Job cancelled', 'warning');
        this.game.audio?.play('ui-click');
        this._refresh();
    }

    _refresh() {
        const container = document.querySelector('.station-tab-content');
        if (container) {
            this.render(container);
        }
    }

    _getPlayerMaterialCount(materialId) {
        if (!this.game.player || !this.game.player.cargo) return 0;
        const cargo = this.game.player.cargo;
        for (const item of cargo) {
            if (item.id === materialId || item.type === materialId) {
                return item.quantity || item.amount || 0;
            }
        }
        return 0;
    }

    _buttonStyle(color, bg) {
        return `background: ${bg}; color: ${color}; border: 1px solid ${color}; border-radius: 3px; padding: 4px 12px; cursor: pointer; font-family: "Courier New", monospace; font-size: 13px; font-weight: bold; letter-spacing: 1px;`;
    }
}
