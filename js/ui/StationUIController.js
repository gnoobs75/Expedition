// =============================================
// Station UI Controller
// Extracted from UIManager - handles station panel tabs and interactions
// =============================================

import { CONFIG } from '../config.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { TRADE_GOODS } from '../data/tradeGoodsDatabase.js';
import { formatCredits } from '../utils/math.js';

export class StationUIController {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;

        // Station ambient particles
        this.stationAmbientCanvas = document.getElementById('station-ambient-canvas');
        this.stationAmbientCtx = null;
        this.stationAmbientParticles = [];
        this.stationAmbientRAF = null;

        // Station traffic state
        this._stationTrafficActive = false;
        this._stationTrafficTimer = null;
    }

    populatePriceTicker(station) {
        const track = document.getElementById('price-ticker-track');
        if (!track || !TRADE_GOODS) return;

        const goods = Object.values(TRADE_GOODS);
        const items = goods.map(good => {
            const basePrice = good.basePrice || 100;
            // Simulate price fluctuation
            const change = (Math.random() - 0.45) * 20;
            const currentPrice = Math.max(1, Math.floor(basePrice + change));
            const changePct = ((change / basePrice) * 100).toFixed(1);
            const arrow = change > 1 ? '&#9650;' : change < -1 ? '&#9660;' : '&#9644;';
            const cls = change > 1 ? 'up' : change < -1 ? 'down' : 'flat';
            return `<span class="ticker-item"><span class="ticker-name">${good.name}</span> <span class="ticker-price">${currentPrice}</span> <span class="ticker-change ${cls}">${arrow}${Math.abs(changePct)}%</span></span>`;
        });

        // Duplicate for seamless scroll
        track.innerHTML = items.join('') + items.join('');
    }

    startStationAmbient() {
        const canvas = this.stationAmbientCanvas;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.stationAmbientCtx = canvas.getContext('2d');
        this.stationAmbientParticles = [];
        // Floating dust motes
        for (let i = 0; i < 60; i++) {
            this.stationAmbientParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 12,
                vy: -8 - Math.random() * 15,
                size: 1 + Math.random() * 2.5,
                alpha: 0.15 + Math.random() * 0.35,
                color: Math.random() < 0.7 ? 'cyan' : (Math.random() < 0.5 ? 'orange' : 'white'),
                life: Math.random(),
                lifeSpeed: 0.002 + Math.random() * 0.004,
                type: 'dust'
            });
        }
        // Occasional sparks from welding
        for (let i = 0; i < 8; i++) {
            this.stationAmbientParticles.push({
                x: Math.random() * canvas.width,
                y: canvas.height * 0.2 + Math.random() * canvas.height * 0.3,
                vx: (Math.random() - 0.5) * 40,
                vy: 20 + Math.random() * 30,
                size: 1 + Math.random() * 1.5,
                alpha: 0.6 + Math.random() * 0.4,
                color: 'spark',
                life: Math.random(),
                lifeSpeed: 0.01 + Math.random() * 0.02,
                type: 'spark'
            });
        }
        const animate = () => {
            this.updateStationAmbient();
            this.stationAmbientRAF = requestAnimationFrame(animate);
        };
        this.stationAmbientRAF = requestAnimationFrame(animate);
    }

    updateStationAmbient() {
        const ctx = this.stationAmbientCtx;
        const canvas = this.stationAmbientCanvas;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Subtle volumetric light beam from top
        const grad = ctx.createLinearGradient(canvas.width * 0.4, 0, canvas.width * 0.6, canvas.height * 0.7);
        grad.addColorStop(0, 'rgba(100, 180, 255, 0.03)');
        grad.addColorStop(0.5, 'rgba(100, 180, 255, 0.015)');
        grad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.35, 0);
        ctx.lineTo(canvas.width * 0.2, canvas.height);
        ctx.lineTo(canvas.width * 0.8, canvas.height);
        ctx.lineTo(canvas.width * 0.65, 0);
        ctx.fill();

        for (const p of this.stationAmbientParticles) {
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.life += p.lifeSpeed;
            if (p.life > 1) {
                p.life = 0;
                p.x = Math.random() * canvas.width;
                p.y = p.type === 'spark' ? (canvas.height * 0.2 + Math.random() * canvas.height * 0.3) : (canvas.height + 5);
                p.vx = p.type === 'spark' ? ((Math.random() - 0.5) * 40) : ((Math.random() - 0.5) * 12);
            }
            // Wrap horizontally
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;

            const fadeAlpha = p.alpha * Math.sin(p.life * Math.PI);
            if (p.color === 'spark') {
                ctx.fillStyle = `rgba(255, ${180 + Math.random() * 75}, 50, ${fadeAlpha})`;
                ctx.shadowColor = 'rgba(255, 150, 0, 0.4)';
                ctx.shadowBlur = 6;
            } else if (p.color === 'cyan') {
                ctx.fillStyle = `rgba(100, 220, 255, ${fadeAlpha * 0.5})`;
                ctx.shadowColor = '';
                ctx.shadowBlur = 0;
            } else if (p.color === 'orange') {
                ctx.fillStyle = `rgba(255, 180, 80, ${fadeAlpha * 0.4})`;
                ctx.shadowColor = '';
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = `rgba(200, 200, 220, ${fadeAlpha * 0.4})`;
                ctx.shadowColor = '';
                ctx.shadowBlur = 0;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    stopStationAmbient() {
        if (this.stationAmbientRAF) {
            cancelAnimationFrame(this.stationAmbientRAF);
            this.stationAmbientRAF = null;
        }
        if (this.stationAmbientCtx && this.stationAmbientCanvas) {
            this.stationAmbientCtx.clearRect(0, 0, this.stationAmbientCanvas.width, this.stationAmbientCanvas.height);
        }
        this.stationAmbientParticles = [];
    }

    startStationTraffic() {
        const logEl = document.getElementById('station-traffic-log');
        if (!logEl) return;

        const shipNames = [
            'Meridian Star', 'Cobalt Drifter', 'Iron Wake', 'Sable Horizon',
            'Quantum Rift', 'Dust Runner', 'Voidspear', 'Solar Vagrant',
            'Crimson Tide', 'Neon Fang', 'Starweaver', 'Eclipse Moth',
            'Steel Phantom', 'Dark Current', 'Pulse Nova', 'Arc Lightning',
        ];
        const shipClasses = ['Frigate', 'Destroyer', 'Cruiser', 'Hauler', 'Battlecruiser', 'Mining Barge'];

        const addEntry = () => {
            if (!this._stationTrafficActive) return;
            const isDock = Math.random() < 0.5;
            const name = shipNames[Math.floor(Math.random() * shipNames.length)];
            const cls = shipClasses[Math.floor(Math.random() * shipClasses.length)];
            const entry = document.createElement('span');
            entry.className = `traffic-entry ${isDock ? 'dock' : 'undock'}`;
            entry.innerHTML = `<span class="traffic-action">${isDock ? 'ARR' : 'DEP'}</span> <span class="traffic-ship">${name}</span> <span style="opacity:0.4">${cls}</span>`;

            // Keep max 4 entries
            while (logEl.children.length >= 4) logEl.removeChild(logEl.firstChild);
            logEl.appendChild(entry);

            // Schedule next
            this._stationTrafficTimer = setTimeout(addEntry, 3000 + Math.random() * 5000);
        };

        this._stationTrafficActive = true;
        addEntry();
    }

    stopStationTraffic() {
        this._stationTrafficActive = false;
        if (this._stationTrafficTimer) clearTimeout(this._stationTrafficTimer);
        const logEl = document.getElementById('station-traffic-log');
        if (logEl) logEl.innerHTML = '';
    }

    showStationPanel(station) {
        this.ui.elements.stationName.textContent = station.name;
        this.ui.elements.stationPanel.classList.remove('hidden');

        // Start station ambient particles
        this.startStationAmbient();

        // Start station traffic log
        this.startStationTraffic();

        // Populate price ticker
        this.populatePriceTicker(station);

        // Initialize vendor manager
        this.ui.vendorManager.show(station);

        // Populate shop (uses vendor manager for market/fitting, legacy for repair)
        this.updateShopPanel(station);

        // Populate refinery tab
        this.updateRefineryTab();

        // Initialize cantina (generates pilots when docked)
        this.ui.cantinaManager.show(station);

        // Station greeting dialogue (random chance)
        if (Math.random() < 0.3) {
            const greetings = [
                { name: 'Docking Officer', title: 'Station Control', portrait: '\u{1F468}\u200D\u2708\uFE0F', color: '#88aacc',
                  text: `Welcome to ${station.name}, capsuleer. All services are available. Fly safe.` },
                { name: 'Hangar Chief', title: 'Maintenance Crew', portrait: '\u{1F527}', color: '#ffaa44',
                  text: `Your ship's looking a bit roughed up, pilot. Hit the repair bay if you need us.` },
                { name: 'Intel Officer', title: 'Security Division', portrait: '\u{1F6E1}\uFE0F', color: '#44aaff',
                  text: `Pirate activity has been increasing in the outer sectors. Watch your six out there.` },
                { name: 'Trade Broker', title: 'Market Division', portrait: '\u{1F4B0}', color: '#44ff88',
                  text: `Ore prices are holding steady. The refineries are always buying if you've got cargo to offload.` },
            ];
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            setTimeout(() => this.ui.dialogueManager?.open({ ...greeting, options: [{ label: 'Understood', action: 'close' }] }), 500);
        }
    }

    hideStationPanel() {
        this.ui.elements.stationPanel.classList.add('hidden');
        this.ui.vendorManager.hide();
        this.ui.cantinaManager.hide();
        this.stopStationAmbient();
        this.stopStationTraffic();
        this.ui.killStreak = 0; // Reset kill streak on dock
    }

    playDockingAnimation(stationName, onComplete) {
        const overlay = document.getElementById('dock-animation');
        if (!overlay) { onComplete?.(); return; }

        const textEl = document.getElementById('dock-anim-text');
        const stationEl = document.getElementById('dock-anim-station');
        if (textEl) textEl.textContent = 'DOCKING';
        if (stationEl) stationEl.textContent = stationName;

        overlay.classList.remove('hidden', 'undocking', 'fullscreen');
        overlay.classList.add('active');

        // Cinematic bars slide in, then fullscreen fade
        setTimeout(() => overlay.classList.add('fullscreen'), 800);

        // Complete after animation
        setTimeout(() => {
            overlay.classList.remove('active', 'fullscreen');
            overlay.classList.add('hidden');
            onComplete?.();
        }, 1600);
    }

    playUndockAnimation(stationName, onComplete) {
        const overlay = document.getElementById('dock-animation');
        if (!overlay) { onComplete?.(); return; }

        const textEl = document.getElementById('dock-anim-text');
        const stationEl = document.getElementById('dock-anim-station');
        if (textEl) textEl.textContent = 'UNDOCKING';
        if (stationEl) stationEl.textContent = stationName;

        overlay.classList.remove('hidden');
        overlay.classList.add('active', 'fullscreen', 'undocking');

        // Open from fullscreen
        setTimeout(() => overlay.classList.remove('fullscreen'), 400);

        // Bars retract
        setTimeout(() => overlay.classList.remove('active'), 1000);

        // Cleanup
        setTimeout(() => {
            overlay.classList.remove('undocking');
            overlay.classList.add('hidden');
            onComplete?.();
        }, 1600);
    }

    updateShopPanel(station) {
        // Ships and Equipment tabs handled by StationVendorManager
        this.ui.vendorManager.renderShips();
        this.ui.vendorManager.renderEquipment();

        // Repair cost (still handled here)
        const repairCost = station.getRepairCost(this.game.player);
        document.getElementById('repair-options').innerHTML = `
            <div class="shop-item">
                <div class="item-info">
                    <div class="item-name">Full Repair</div>
                    <div class="item-desc">Restore all shield, armor, and hull</div>
                </div>
                <div class="item-price">${formatCredits(repairCost)} ISK</div>
                <button class="buy-btn" onclick="game.ui.repairShip()">REPAIR</button>
            </div>
        `;
    }

    updateRefineryTab() {
        const player = this.game.player;
        if (!player) return;

        const oreList = document.getElementById('refinery-ore-list');
        const totalDisplay = document.getElementById('refinery-total');
        const sellBtn = document.getElementById('sell-all-ore-btn');

        if (!oreList || !totalDisplay) return;

        // Get ore from cargo
        const cargo = player.cargo || {};
        const oreTypes = Object.entries(cargo).filter(([type, data]) => data.units > 0);

        if (oreTypes.length === 0) {
            oreList.innerHTML = '<div style="color: var(--text-dim); padding: 20px; text-align: center;">No ore in cargo hold</div>';
            totalDisplay.innerHTML = `
                <span class="label">TOTAL VALUE</span>
                <span class="value">0 ISK</span>
            `;
            if (sellBtn) sellBtn.disabled = true;
            return;
        }

        // Build ore list HTML
        let totalValue = 0;
        const html = oreTypes.map(([type, data]) => {
            const config = CONFIG.ASTEROID_TYPES[type] || { name: type, value: 10 };
            const value = data.units * config.value;
            totalValue += value;

            return `
                <div class="refinery-ore-item">
                    <div class="refinery-ore-info">
                        <div class="refinery-ore-name">${config.name}</div>
                        <div class="refinery-ore-amount">${data.units.toLocaleString()} units (${data.volume.toFixed(1)} m\u00B3)</div>
                    </div>
                    <div class="refinery-ore-value">${formatCredits(value)} ISK</div>
                </div>
            `;
        }).join('');

        oreList.innerHTML = html;
        totalDisplay.innerHTML = `
            <span class="label">TOTAL VALUE</span>
            <span class="value">${formatCredits(totalValue)} ISK</span>
        `;

        if (sellBtn) sellBtn.disabled = false;

        // Show ingot conversion preview
        const refineBtn = document.getElementById('refine-all-ore-btn');
        const ingotPreview = document.getElementById('refinery-ingot-preview');
        const conversions = CONFIG.REFINERY_CONVERSIONS;
        if (ingotPreview && conversions) {
            let hasConversion = false;
            let previewHtml = '<div class="ingot-preview-title">REFINE PREVIEW</div>';
            for (const [type, data] of oreTypes) {
                const conv = conversions[type];
                if (!conv) continue;
                const ingotAmount = Math.floor(data.units * conv.rate);
                if (ingotAmount <= 0) continue;
                hasConversion = true;
                previewHtml += `<div class="ingot-preview-row">
                    <span class="ingot-ore">${data.units} ${type}</span>
                    <span class="ingot-arrow">\u2192</span>
                    <span class="ingot-result">${ingotAmount} ${conv.name}</span>
                </div>`;
            }
            ingotPreview.innerHTML = hasConversion ? previewHtml : '';
            if (refineBtn) refineBtn.disabled = !hasConversion;
        }
    }

    repairShip() {
        const station = this.game.dockedAt;
        if (!station || !this.game.player) return;

        if (station.repairShip(this.game.player)) {
            this.ui.log('Ship fully repaired', 'system');
            this.ui.toast('Ship repaired!', 'success');
            this.game.audio?.play('repair');
            this.game.events.emit('station:repair', { ship: this.game.player });
            this.updateShopPanel(station);

            // Repair flash animation on ship indicator
            const indicator = document.getElementById('ship-indicator');
            if (indicator) {
                indicator.classList.add('repair-flash');
                setTimeout(() => indicator.classList.remove('repair-flash'), 1500);
            }
        } else {
            this.ui.toast('Not enough credits', 'warning');
        }
    }

    sellAllOre() {
        const player = this.game.player;
        if (!player || !player.cargo) return;

        let totalValue = 0;
        let totalUnits = 0;

        // Calculate total value and clear cargo
        for (const [type, data] of Object.entries(player.cargo)) {
            if (data.units > 0) {
                const config = CONFIG.ASTEROID_TYPES[type] || { value: 10 };
                totalValue += data.units * config.value;
                totalUnits += data.units;
            }
        }

        if (totalValue === 0) {
            this.ui.log('No ore to sell', 'system');
            return;
        }

        // Notify guild system of ore sold BEFORE clearing cargo
        for (const [type, data] of Object.entries(player.cargo)) {
            if (data.units > 0) {
                this.game.guildSystem?.onOreSold(type, data.units);
            }
        }

        // Clear cargo
        player.cargo = {};
        player.cargoUsed = 0;

        // Add credits
        this.game.addCredits(totalValue);

        // Award trade XP
        this.game.skillSystem?.onTrade(totalValue);

        // Log and feedback
        this.ui.log(`Sold ${totalUnits.toLocaleString()} units of ore for ${formatCredits(totalValue)} ISK`, 'mining');
        this.ui.toast(`Sold ore for ${formatCredits(totalValue)} ISK`, 'success');
        this.game.audio?.play('sell');
        // Floating credit popup
        this.ui.showCreditPopup(totalValue, window.innerWidth / 2, window.innerHeight / 2, 'gain');
        // Ship log
        this.ui.addShipLogEntry(`Sold ore for ${formatCredits(totalValue)} ISK`, 'trade');

        // Update display
        this.updateRefineryTab();
    }

    refineAllOre() {
        const player = this.game.player;
        if (!player || !player.cargo) return;

        const conversions = CONFIG.REFINERY_CONVERSIONS;
        if (!conversions) {
            this.ui.toast('Refinery conversions not configured', 'error');
            return;
        }

        let totalRefined = 0;
        const results = [];

        for (const [oreType, data] of Object.entries(player.cargo)) {
            if (data.units <= 0) continue;
            const conv = conversions[oreType];
            if (!conv) continue;

            const ingotAmount = Math.floor(data.units * conv.rate);
            if (ingotAmount <= 0) continue;

            // Add ingots to materials
            if (!player.materials) player.materials = {};
            if (!player.materials[conv.material]) {
                player.materials[conv.material] = 0;
            }
            player.materials[conv.material] += ingotAmount;

            results.push({ ore: oreType, units: data.units, ingot: conv.name, amount: ingotAmount });
            totalRefined += data.units;
        }

        if (totalRefined === 0) {
            this.ui.toast('No refinable ore in cargo', 'warning');
            return;
        }

        // Clear refined ore from cargo
        for (const r of results) {
            delete player.cargo[r.ore];
        }
        // Recalculate cargo used
        let used = 0;
        for (const data of Object.values(player.cargo)) {
            used += data.volume || 0;
        }
        player.cargoUsed = used;

        // Log results
        const summary = results.map(r => `${r.amount} ${r.ingot}`).join(', ');
        this.ui.log(`Refined ${totalRefined.toLocaleString()} units of ore into ${summary}`, 'mining');
        this.ui.toast(`Refined ore into ingots!`, 'success');
        this.game.audio?.play('scan-complete');
        this.ui.addShipLogEntry(`Refined ore: ${summary}`, 'industry');

        // Emit event for Skippy etc
        this.game.events?.emit('refinery:complete', { results, totalRefined });

        this.updateRefineryTab();
    }

    updateInsuranceTab() {
        const container = document.getElementById('insurance-content');
        if (!container) return;

        const game = this.game;
        const player = game.player;
        const shipId = player?.shipClass || 'frigate';
        const shipData = SHIP_DATABASE[shipId];
        const shipName = shipData?.name || 'Unknown Ship';
        const shipValue = shipData?.price || 5000;
        const tiers = game.constructor.INSURANCE_TIERS;
        const current = game.insurance;

        let html = `<div class="insurance-panel">`;

        // Current status
        html += `<div class="insurance-status">`;
        html += `<div class="insurance-ship-info">`;
        html += `<span class="insurance-label">INSURED VESSEL</span>`;
        html += `<span class="insurance-ship-name">${shipName}</span>`;
        html += `<span class="insurance-ship-value">Hull Value: ${formatCredits(shipValue)} ISK</span>`;
        html += `</div>`;

        if (current.active) {
            const payout = Math.floor(shipValue * current.payoutRate);
            const matchesShip = current.shipInsured === shipId;
            html += `<div class="insurance-active-badge${matchesShip ? '' : ' insurance-mismatch'}">`;
            html += `<span class="insurance-tier-name">${current.tierName} Coverage</span>`;
            html += `<span class="insurance-payout">Payout: ${formatCredits(payout)} ISK (${Math.round(current.payoutRate * 100)}%)</span>`;
            if (!matchesShip) {
                const insuredName = SHIP_DATABASE[current.shipInsured]?.name || current.shipInsured;
                html += `<span class="insurance-warning">Insured for: ${insuredName} (switch ships to match)</span>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="insurance-inactive-badge">`;
            html += `<span>NO ACTIVE COVERAGE</span>`;
            html += `<span class="insurance-warning-text">Ship loss will not be compensated</span>`;
            html += `</div>`;
        }
        html += `</div>`;

        // Tier cards
        html += `<div class="insurance-tiers">`;
        for (const [tierId, tier] of Object.entries(tiers)) {
            const premium = Math.floor(shipValue * tier.premiumRate);
            const payout = Math.floor(shipValue * tier.payoutRate);
            const isActive = current.active && current.tier === tierId && current.shipInsured === shipId;
            const canAfford = game.credits >= premium;
            const profit = payout - premium;

            html += `<div class="insurance-tier-card${isActive ? ' active' : ''}">`;
            html += `<div class="tier-header tier-${tierId}">${tier.name}</div>`;
            html += `<div class="tier-body">`;
            html += `<div class="tier-stat"><span>Premium</span><span class="tier-cost">${formatCredits(premium)} ISK</span></div>`;
            html += `<div class="tier-stat"><span>Payout</span><span class="tier-payout">${formatCredits(payout)} ISK</span></div>`;
            html += `<div class="tier-stat"><span>Coverage</span><span>${Math.round(tier.payoutRate * 100)}%</span></div>`;
            html += `<div class="tier-stat"><span>Net Gain</span><span class="${profit > 0 ? 'tier-profit' : 'tier-loss'}">${profit > 0 ? '+' : ''}${formatCredits(profit)} ISK</span></div>`;

            if (isActive) {
                html += `<button class="buy-btn insurance-btn" disabled>ACTIVE</button>`;
            } else {
                html += `<button class="buy-btn insurance-btn${canAfford ? '' : ' disabled'}" ${canAfford ? '' : 'disabled'} data-insurance-tier="${tierId}">PURCHASE</button>`;
            }

            html += `</div></div>`;
        }
        html += `</div>`;

        // Info text
        html += `<div class="insurance-info">`;
        html += `<p>Insurance provides a one-time ISK payout when your ship is destroyed. Coverage is consumed on death and must be repurchased.</p>`;
        html += `<p>Switching ships does not transfer coverage. Insure your current vessel before undocking.</p>`;
        html += `</div>`;

        html += `</div>`;
        container.innerHTML = html;

        // Add click handlers
        container.querySelectorAll('[data-insurance-tier]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tier = btn.dataset.insuranceTier;
                if (game.purchaseInsurance(tier)) {
                    this.updateInsuranceTab();
                    this.game.audio?.play('quest-accept');
                }
            });
        });
    }

    updateSkillsTab() {
        const container = document.getElementById('skills-content');
        if (!container) return;

        const gainSystem = this.game.skillGainSystem;
        const treeSystem = this.game.skillTreeSystem;
        if (!gainSystem) {
            container.innerHTML = '<div class="skills-empty">Skills not available</div>';
            return;
        }

        const skills = gainSystem.getAllSkills();
        const sp = gainSystem.skillPoints || 0;
        const allocated = treeSystem?.getTotalAllocated() || 0;

        let html = `<div class="skills-panel">`;
        html += `<div class="skills-header">`;
        html += `<span>PILOT SKILLS</span>`;
        html += `<span class="skills-sp-display">SP: ${sp} available | ${allocated} allocated</span>`;
        html += `</div>`;

        for (const s of skills) {
            const pctFill = Math.floor(s.progress * 100);

            // Build bonus text from passive bonuses
            let bonusText = '';
            for (const [stat, perLevel] of Object.entries(s.passivePerLevel)) {
                const totalVal = (perLevel * s.level * 100).toFixed(1);
                const statName = this.formatStatName(stat);
                bonusText += `<span class="skill-bonus-line">+${totalVal}% ${statName}</span>`;
            }

            html += `<div class="skill-card" style="border-left: 3px solid ${s.color}">`;
            html += `<div class="skill-card-top">`;
            html += `<div class="skill-info">`;
            html += `<div class="skill-name" style="color:${s.color}">${s.name} <span class="skill-level">Lv.${s.level}/100</span></div>`;
            html += `<div class="skill-desc">${s.description}</div>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="skill-xp-bar-outer">`;
            html += `<div class="skill-xp-bar-inner" style="width:${pctFill}%;background:${s.color}"></div>`;
            html += `</div>`;
            html += `<div class="skill-card-bottom">`;
            html += `<span class="skill-xp-text">${s.maxed ? 'MAX LEVEL' : `${s.xp.toLocaleString()} / ${s.nextXP.toLocaleString()} XP`}</span>`;
            html += `<span class="skill-bonuses">${bonusText}</span>`;
            html += `</div>`;
            html += `</div>`;
        }

        html += `<div class="skills-tree-btn-row">`;
        html += `<button class="skills-open-tree-btn">OPEN SKILL TREE (T)</button>`;
        html += `</div>`;

        html += `</div>`;
        container.innerHTML = html;

        // Open skill tree button
        container.querySelector('.skills-open-tree-btn')?.addEventListener('click', () => {
            this.game.skillTreeRenderer?.show();
        });
    }

    formatStatName(stat) {
        const map = {
            damageBonus: 'Weapon Damage',
            trackingBonus: 'Tracking Speed',
            maxSpeedBonus: 'Max Speed',
            warpSpeedBonus: 'Warp Speed',
            miningYieldBonus: 'Mining Yield',
            miningSpeedBonus: 'Mining Speed',
            shieldBonus: 'Shield HP',
            capacitorBonus: 'Capacitor',
            priceBonus: 'Trade Margin',
            cargoBonus: 'Cargo Space',
            ewarBonus: 'EWAR Strength',
            fleetBonus: 'Fleet Bonus',
        };
        return map[stat] || stat.replace(/Bonus$/, '');
    }
}
