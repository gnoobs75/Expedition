// =============================================
// Skill Tree Renderer - Canvas-based Radial Constellation
// Full-screen modal with interactive node allocation
// =============================================

import { SKILL_TREE_NODES, CONSTELLATIONS } from '../data/skillTreeDatabase.js';
import { SKILL_GAIN_DEFINITIONS } from '../data/skillGainDatabase.js';

// Procedural SVG icon generators
const SKILL_ICONS = {
    gunnery: (color) => `<svg viewBox="0 0 32 32"><line x1="4" y1="28" x2="28" y2="4" stroke="${color}" stroke-width="3"/><line x1="20" y1="4" x2="28" y2="4" stroke="${color}" stroke-width="2.5"/><line x1="28" y1="4" x2="28" y2="12" stroke="${color}" stroke-width="2.5"/><circle cx="10" cy="22" r="4" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`,
    mining: (color) => `<svg viewBox="0 0 32 32"><path d="M8 4 L16 16 L24 4" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/><line x1="16" y1="16" x2="16" y2="28" stroke="${color}" stroke-width="2.5"/><line x1="10" y1="28" x2="22" y2="28" stroke="${color}" stroke-width="2"/><circle cx="16" cy="8" r="2" fill="${color}" opacity="0.5"/></svg>`,
    navigation: (color) => `<svg viewBox="0 0 32 32"><polygon points="16,2 22,30 16,22 10,30" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="16" r="3" fill="${color}" opacity="0.4"/></svg>`,
    engineering: (color) => `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="none" stroke="${color}" stroke-width="2"/><path d="M16 4 v4 M16 24 v4 M4 16 h4 M24 16 h4 M8.3 8.3 l2.8 2.8 M20.9 20.9 l2.8 2.8 M8.3 23.7 l2.8-2.8 M20.9 11.1 l2.8-2.8" stroke="${color}" stroke-width="2"/></svg>`,
    trade: (color) => `<svg viewBox="0 0 32 32"><rect x="6" y="14" width="20" height="14" rx="2" fill="none" stroke="${color}" stroke-width="2"/><path d="M10 14 V10 a6 6 0 0 1 12 0 v4" fill="none" stroke="${color}" stroke-width="2"/><circle cx="16" cy="22" r="2.5" fill="${color}" opacity="0.5"/></svg>`,
    tactical: (color) => `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="16" cy="16" r="7" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="16" cy="16" r="2" fill="${color}"/><line x1="16" y1="2" x2="16" y2="8" stroke="${color}" stroke-width="1.5"/><line x1="16" y1="24" x2="16" y2="30" stroke="${color}" stroke-width="1.5"/><line x1="2" y1="16" x2="8" y2="16" stroke="${color}" stroke-width="1.5"/><line x1="24" y1="16" x2="30" y2="16" stroke="${color}" stroke-width="1.5"/></svg>`,
};

export class SkillTreeRenderer {
    constructor(game) {
        this.game = game;
        this.modal = null;
        this.canvas = null;
        this.ctx = null;
        this.visible = false;

        // Layout
        this.centerX = 0;
        this.centerY = 0;
        this.baseRadius = 0;
        this.nodePositions = {}; // nodeId -> {x, y, screenR}

        // Interaction
        this.hoveredNode = null;
        this.tooltip = null;
        this.animFrame = null;

        // Pan & zoom (for potential future use)
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;

        this.createModal();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'skill-tree-modal';
        this.modal.className = 'skill-tree-modal hidden';
        this.modal.innerHTML = `
            <div class="skill-tree-header">
                <div class="skill-tree-title">SKILL CONSTELLATION</div>
                <div class="skill-tree-sp" id="skill-tree-sp">SP: 0</div>
                <div class="skill-tree-actions">
                    <button id="skill-tree-respec" class="skill-tree-btn">RESPEC ALL</button>
                    <button id="skill-tree-close" class="skill-tree-btn">&times;</button>
                </div>
            </div>
            <canvas id="skill-tree-canvas"></canvas>
            <div id="skill-tree-tooltip" class="skill-tree-tooltip hidden"></div>
            <div class="skill-tree-legend">
                <span class="legend-item"><span class="legend-dot legend-minor"></span>Minor (2-3 pts)</span>
                <span class="legend-item"><span class="legend-dot legend-notable"></span>Notable (5 pts)</span>
                <span class="legend-item"><span class="legend-dot legend-keystone"></span>Keystone (1 pt)</span>
                <span class="legend-sep">|</span>
                <span class="legend-item">Left-click: Allocate</span>
                <span class="legend-item">Right-click: Deallocate</span>
            </div>
        `;

        document.body.appendChild(this.modal);

        this.canvas = this.modal.querySelector('#skill-tree-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tooltip = this.modal.querySelector('#skill-tree-tooltip');

        // Event handlers
        this.modal.querySelector('#skill-tree-close').addEventListener('click', () => this.hide());
        this.modal.querySelector('#skill-tree-respec').addEventListener('click', () => {
            this.game.skillTreeSystem?.respec();
            this.render();
        });

        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onRightClick(e);
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredNode = null;
            this.tooltip.classList.add('hidden');
        });

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.visible) this.hide();
        });
    }

    show() {
        this.visible = true;
        this.modal.classList.remove('hidden');
        this.resize();
        this.render();
    }

    hide() {
        this.visible = false;
        this.modal.classList.add('hidden');
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
    }

    toggle() {
        if (this.visible) this.hide();
        else this.show();
    }

    resize() {
        const rect = this.modal.getBoundingClientRect();
        const headerH = 48;
        const legendH = 32;
        const w = rect.width;
        const h = rect.height - headerH - legendH;
        this.canvas.width = w * window.devicePixelRatio;
        this.canvas.height = h * window.devicePixelRatio;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

        this.centerX = w / 2;
        this.centerY = h / 2;
        this.baseRadius = Math.min(w, h) * 0.35;
    }

    /**
     * Compute screen positions for all nodes based on constellation layout
     */
    computeLayout() {
        this.nodePositions = {};
        const ringSpacing = this.baseRadius * 0.28;

        for (const [nodeId, node] of Object.entries(SKILL_TREE_NODES)) {
            const cons = CONSTELLATIONS[node.constellation];
            if (!cons) continue;

            // Constellation base angle (degrees → radians), -90 so 0° is top
            const consAngle = (cons.baseAngle - 90) * Math.PI / 180;
            const nodeAngle = node.position.angle * Math.PI / 180;
            const ring = node.position.ring;

            // Distance from center for this ring
            const dist = ring === 0 ? this.baseRadius * 0.65 : this.baseRadius * 0.65 + ring * ringSpacing;

            // Position along constellation arm + perpendicular offset for node angle
            const perpDir = consAngle + Math.PI / 2;
            const across = nodeAngle * ringSpacing * 1.5;

            const nx = this.centerX + Math.cos(consAngle) * dist + Math.cos(perpDir) * across;
            const ny = this.centerY + Math.sin(consAngle) * dist + Math.sin(perpDir) * across;

            let screenR;
            switch (node.type) {
                case 'start': screenR = 12; break;
                case 'minor': screenR = 10; break;
                case 'notable': screenR = 14; break;
                case 'keystone': screenR = 16; break;
                default: screenR = 10;
            }

            this.nodePositions[nodeId] = { x: nx, y: ny, screenR };
        }
    }

    render() {
        if (!this.visible) return;

        const ctx = this.ctx;
        const w = this.canvas.width / window.devicePixelRatio;
        const h = this.canvas.height / window.devicePixelRatio;

        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, w, h);

        // Subtle star field
        this.drawStarfield(ctx, w, h);

        // Compute layout
        this.computeLayout();

        // Draw constellation labels
        this.drawConstellationLabels(ctx);

        // Draw connections first (under nodes)
        this.drawConnections(ctx);

        // Draw nodes
        this.drawNodes(ctx);

        // Update SP display
        const sp = this.game.skillGainSystem?.skillPoints || 0;
        const allocated = this.game.skillTreeSystem?.getTotalAllocated() || 0;
        const spEl = this.modal.querySelector('#skill-tree-sp');
        if (spEl) spEl.textContent = `SP Available: ${sp} | Allocated: ${allocated}`;
    }

    drawStarfield(ctx, w, h) {
        // Seeded stars for consistent background
        const seed = 42;
        for (let i = 0; i < 150; i++) {
            const sx = ((seed * (i + 1) * 7919) % 10000) / 10000 * w;
            const sy = ((seed * (i + 1) * 104729) % 10000) / 10000 * h;
            const brightness = 0.1 + ((seed * (i + 1) * 1301) % 10000) / 10000 * 0.3;
            const size = 0.5 + ((seed * (i + 1) * 2657) % 10000) / 10000;
            ctx.fillStyle = `rgba(200,220,255,${brightness})`;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Subtle radial glow at center
        const grad = ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.baseRadius * 0.4);
        grad.addColorStop(0, 'rgba(100,120,200,0.08)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    drawConstellationLabels(ctx) {
        for (const [consId, cons] of Object.entries(CONSTELLATIONS)) {
            const angle = (cons.baseAngle - 90) * Math.PI / 180;
            const labelDist = this.baseRadius * 0.35;
            const lx = this.centerX + Math.cos(angle) * labelDist;
            const ly = this.centerY + Math.sin(angle) * labelDist;

            ctx.save();
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = cons.color;
            ctx.globalAlpha = 0.6;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cons.name.toUpperCase(), lx, ly);
            ctx.restore();
        }
    }

    drawConnections(ctx) {
        const tree = this.game.skillTreeSystem;
        if (!tree) return;

        for (const [nodeId, node] of Object.entries(SKILL_TREE_NODES)) {
            const pos = this.nodePositions[nodeId];
            if (!pos) continue;

            for (const reqId of node.requires) {
                const reqPos = this.nodePositions[reqId];
                if (!reqPos) continue;

                const nodeAllocated = (tree.allocated[nodeId] || 0) > 0;
                const reqAllocated = (tree.allocated[reqId] || 0) > 0 || SKILL_TREE_NODES[reqId]?.type === 'start';

                ctx.beginPath();
                ctx.moveTo(reqPos.x, reqPos.y);
                ctx.lineTo(pos.x, pos.y);

                if (nodeAllocated && reqAllocated) {
                    // Fully connected
                    const cons = CONSTELLATIONS[node.constellation];
                    ctx.strokeStyle = cons?.color || '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.8;
                } else if (reqAllocated) {
                    // Available path
                    ctx.strokeStyle = '#446688';
                    ctx.lineWidth = 1.5;
                    ctx.globalAlpha = 0.5;
                    ctx.setLineDash([4, 4]);
                } else {
                    // Locked path
                    ctx.strokeStyle = '#223344';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.3;
                }

                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }
    }

    drawNodes(ctx) {
        const tree = this.game.skillTreeSystem;
        if (!tree) return;

        for (const [nodeId, node] of Object.entries(SKILL_TREE_NODES)) {
            const pos = this.nodePositions[nodeId];
            if (!pos) continue;

            const points = tree.allocated[nodeId] || 0;
            const isStart = node.type === 'start';
            const isAllocated = points > 0 || isStart;
            const canAlloc = tree.canAllocate(nodeId);
            const isHovered = this.hoveredNode === nodeId;
            const cons = CONSTELLATIONS[node.constellation];
            const color = cons?.color || '#ffffff';

            const r = pos.screenR * (isHovered ? 1.2 : 1);

            // Node shape based on type
            ctx.save();

            if (node.type === 'keystone') {
                // Diamond shape
                this.drawDiamond(ctx, pos.x, pos.y, r);
            } else if (node.type === 'notable') {
                // Hexagon
                this.drawHexagon(ctx, pos.x, pos.y, r);
            } else {
                // Circle
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            }

            // Fill
            if (isStart) {
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.3;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (isAllocated) {
                // Allocated: filled with color
                const fillGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
                fillGrad.addColorStop(0, color);
                fillGrad.addColorStop(1, this.darken(color, 0.5));
                ctx.fillStyle = fillGrad;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Glow
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else if (canAlloc) {
                // Available: outlined, bright
                ctx.fillStyle = 'rgba(20,25,40,0.8)';
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else {
                // Locked: dim
                ctx.fillStyle = 'rgba(15,18,30,0.6)';
                ctx.fill();
                ctx.strokeStyle = '#334455';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // Points indicator (e.g., "2/3")
            if (!isStart && node.maxPoints > 0) {
                ctx.font = `bold ${r < 12 ? 8 : 9}px monospace`;
                ctx.fillStyle = isAllocated ? '#ffffff' : (canAlloc ? '#aabbcc' : '#556677');
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${points}/${node.maxPoints}`, pos.x, pos.y);
            }

            // Start node: constellation icon text
            if (isStart) {
                ctx.font = `bold 9px monospace`;
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('★', pos.x, pos.y);
            }

            ctx.restore();
        }
    }

    drawDiamond(ctx, x, y, r) {
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
    }

    drawHexagon(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60 - 30) * Math.PI / 180;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    darken(hex, factor) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
    }

    getNodeAt(mx, my) {
        for (const [nodeId, pos] of Object.entries(this.nodePositions)) {
            const dx = mx - pos.x;
            const dy = my - pos.y;
            const hitR = pos.screenR + 4; // slightly larger hit area
            if (dx * dx + dy * dy <= hitR * hitR) {
                return nodeId;
            }
        }
        return null;
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const nodeId = this.getNodeAt(mx, my);
        if (nodeId !== this.hoveredNode) {
            this.hoveredNode = nodeId;
            this.render();

            if (nodeId) {
                this.showTooltip(nodeId, e.clientX, e.clientY);
            } else {
                this.tooltip.classList.add('hidden');
            }
        } else if (nodeId) {
            // Update tooltip position
            this.positionTooltip(e.clientX, e.clientY);
        }

        this.canvas.style.cursor = nodeId ? 'pointer' : 'default';
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const nodeId = this.getNodeAt(mx, my);

        if (nodeId) {
            const tree = this.game.skillTreeSystem;
            if (tree?.allocate(nodeId)) {
                this.game.audio?.play('module-online');
                this.render();
                if (this.hoveredNode === nodeId) {
                    this.showTooltip(nodeId, e.clientX, e.clientY);
                }
            }
        }
    }

    onRightClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const nodeId = this.getNodeAt(mx, my);

        if (nodeId) {
            const tree = this.game.skillTreeSystem;
            if (tree?.deallocate(nodeId)) {
                this.game.audio?.play('module-offline');
                this.render();
                if (this.hoveredNode === nodeId) {
                    this.showTooltip(nodeId, e.clientX, e.clientY);
                }
            }
        }
    }

    showTooltip(nodeId, cx, cy) {
        const tree = this.game.skillTreeSystem;
        const node = SKILL_TREE_NODES[nodeId];
        if (!node || !tree) return;

        const points = tree.allocated[nodeId] || 0;
        const cons = CONSTELLATIONS[node.constellation];

        let html = `<div class="stt-name" style="color:${cons?.color || '#fff'}">${node.name}</div>`;
        html += `<div class="stt-type">${node.type.toUpperCase()}${node.maxPoints > 0 ? ` (${points}/${node.maxPoints})` : ''}</div>`;
        html += `<div class="stt-desc">${node.tooltip}</div>`;

        if (node.maxPoints > 0 && Object.keys(node.bonuses).length > 0) {
            html += `<div class="stt-bonuses">`;
            for (const [stat, val] of Object.entries(node.bonuses)) {
                const current = val * points;
                const max = val * node.maxPoints;
                const sign = val >= 0 ? '+' : '';
                html += `<div class="stt-bonus">${sign}${(current * 100).toFixed(1)}% / ${sign}${(max * 100).toFixed(1)}% ${this.formatStatName(stat)}</div>`;
            }
            html += `</div>`;
        }

        if (node.requires.length > 0 && node.type !== 'start') {
            const reqNames = node.requires.map(r => SKILL_TREE_NODES[r]?.name || r).join(', ');
            html += `<div class="stt-req">Requires: ${reqNames}</div>`;
        }

        this.tooltip.innerHTML = html;
        this.tooltip.classList.remove('hidden');
        this.positionTooltip(cx, cy);
    }

    positionTooltip(cx, cy) {
        const ttW = this.tooltip.offsetWidth;
        const ttH = this.tooltip.offsetHeight;
        let left = cx + 15;
        let top = cy - 10;

        if (left + ttW > window.innerWidth - 10) left = cx - ttW - 15;
        if (top + ttH > window.innerHeight - 10) top = window.innerHeight - ttH - 10;
        if (top < 10) top = 10;

        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = top + 'px';
    }

    formatStatName(stat) {
        const map = {
            damageBonus: 'Weapon Damage',
            trackingBonus: 'Tracking Speed',
            fireRateBonus: 'Rate of Fire',
            rangeBonus: 'Weapon Range',
            critChance: 'Critical Hit Chance',
            missileDamageBonus: 'Missile Damage',
            droneDamageBonus: 'Drone Damage',
            miningYieldBonus: 'Mining Yield',
            miningSpeedBonus: 'Mining Speed',
            refineryBonus: 'Refinery Output',
            rareOreChance: 'Rare Ore Chance',
            warpSpeedBonus: 'Warp Speed',
            maxSpeedBonus: 'Max Speed',
            accelerationBonus: 'Acceleration',
            warpSpoolBonus: 'Warp Spool Time',
            evasionBonus: 'Evasion',
            fleetWarpBonus: 'Fleet Warp Speed',
            shieldBonus: 'Shield HP',
            armorBonus: 'Armor HP',
            hullBonus: 'Hull HP',
            capacitorBonus: 'Capacitor',
            capacitorRegenBonus: 'Cap Recharge',
            capacitorDrain: 'Cap Drain',
            shieldResistBonus: 'Shield Resist',
            armorResistBonus: 'Armor Resist',
            priceBonus: 'Trade Margin',
            cargoBonus: 'Cargo Capacity',
            taxReduction: 'Tax Reduction',
            insuranceBonus: 'Insurance Payout',
            ewarBonus: 'EWAR Strength',
            ewarResist: 'EWAR Resistance',
            fleetBonus: 'Fleet Bonus',
            fleetTankBonus: 'Fleet Tank',
            scanBonus: 'Scan Resolution',
            scanRange: 'Scan Range',
        };
        return map[stat] || stat;
    }
}
