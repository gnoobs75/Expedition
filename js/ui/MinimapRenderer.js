// =============================================
// Minimap Renderer
// Extracted from UIManager - handles radar minimap canvas
// =============================================

import { formatDistance } from '../utils/math.js';

export class MinimapRenderer {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;

        this.minimapRange = 5000;
        this.minimapExpanded = false;
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas?.getContext('2d');
        this._radarAngle = 0;
        this.scanPulse = null;

        // Observe container resizes to update canvas dimensions
        this._resizeTimer = null;
        const minimapPanel = document.getElementById('minimap');
        if (minimapPanel && this.minimapCanvas) {
            this._resizeObserver = new ResizeObserver(() => {
                clearTimeout(this._resizeTimer);
                this._resizeTimer = setTimeout(() => this._syncCanvasSize(), 100);
            });
            this._resizeObserver.observe(minimapPanel);
        }
    }

    _syncCanvasSize() {
        const canvas = this.minimapCanvas;
        if (!canvas) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
            canvas.width = w;
            canvas.height = h;
        }
    }

    update() {
        const ctx = this.minimapCtx;
        const canvas = this.minimapCanvas;
        if (!ctx || !canvas) return;

        const player = this.game.player;
        if (!player) return;

        // Derive size from actual canvas dimensions
        this._syncCanvasSize();
        const W = canvas.width || 210;
        const H = canvas.height || 210;
        const cx = W / 2;
        const cy = H / 2;
        const radarMult = this.game.hazardSystem?.getRadarMultiplier() ?? 1;
        const range = this.minimapRange * radarMult;
        const scale = (W / 2 - 10) / range;

        // Background
        ctx.clearRect(0, 0, W, H);
        const hazard = this.game.hazardSystem?.activeHazard;
        if (hazard?.type === 'radiation') {
            ctx.fillStyle = 'rgba(20, 4, 4, 0.9)';
        } else if (hazard?.type === 'ion-storm') {
            ctx.fillStyle = 'rgba(8, 4, 20, 0.9)';
        } else if (hazard?.type === 'nebula-interference') {
            ctx.fillStyle = 'rgba(4, 12, 10, 0.9)';
        } else {
            ctx.fillStyle = 'rgba(0, 8, 20, 0.9)';
        }
        ctx.fillRect(0, 0, W, H);

        // Range rings
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        for (let r = 1; r <= 3; r++) {
            const ringR = (r / 3) * (W / 2 - 10);
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Radar sweep
        this._radarAngle = ((this._radarAngle || 0) + 0.03) % (Math.PI * 2);
        const sweepR = W / 2 - 10;
        if (ctx.createConicGradient) {
            const trailAngle = 0.5;
            const gradient = ctx.createConicGradient(this._radarAngle - trailAngle, cx, cy);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradient.addColorStop(trailAngle / (Math.PI * 2), 'rgba(0, 255, 255, 0.06)');
            gradient.addColorStop(trailAngle / (Math.PI * 2) + 0.001, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, sweepR, this._radarAngle - trailAngle, this._radarAngle);
            ctx.closePath();
            ctx.fill();
        }
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(this._radarAngle) * sweepR, cy + Math.sin(this._radarAngle) * sweepR);
        ctx.stroke();

        // Crosshair
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(cx, 5); ctx.lineTo(cx, H - 5);
        ctx.moveTo(5, cy); ctx.lineTo(W - 5, cy);
        ctx.stroke();

        // Player heading
        const headLen = 20;
        const hx = cx + Math.cos(player.rotation) * headLen;
        const hy = cy - Math.sin(player.rotation) * headLen;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        // Entities
        const entities = this.game.currentSector?.entities || [];
        const allEntities = [...entities];
        if (this.game.player && !allEntities.includes(this.game.player)) {
            allEntities.push(this.game.player);
        }

        for (const entity of allEntities) {
            if (!entity.alive || entity === player) continue;

            const dx = entity.x - player.x;
            const dy = entity.y - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > range) continue;

            const sx = cx + dx * scale;
            const sy = cy - dy * scale;

            let color, size;
            switch (entity.type) {
                case 'enemy':
                    color = '#ff4444'; size = 2.5; break;
                case 'guild':
                    if (entity.isPirate) { color = '#ff4444'; size = 2.5; }
                    else { color = entity.factionColor || '#44aaff'; size = 2; }
                    break;
                case 'npc':
                    color = entity.role === 'security' ? '#44ff88' : '#44aa44'; size = 2; break;
                case 'fleet':
                    color = '#00ffff'; size = 2.5; break;
                case 'station':
                case 'player-station':
                    color = '#ffffff'; size = 4; break;
                case 'asteroid': {
                    const oreColors = {
                        veldspar: 'rgba(160, 160, 160, 0.5)',
                        scordite: 'rgba(180, 110, 55, 0.6)',
                        pyroxeres: 'rgba(70, 180, 110, 0.6)',
                        plagioclase: 'rgba(70, 110, 180, 0.7)',
                    };
                    color = oreColors[entity.asteroidType] || 'rgba(160, 140, 100, 0.5)';
                    size = entity.asteroidType === 'plagioclase' ? 2 :
                        entity.asteroidType === 'pyroxeres' ? 1.5 : 1;
                    if (entity.ore <= 0) { color = 'rgba(80, 70, 50, 0.3)'; size = 0.8; }
                    break;
                }
                case 'planet':
                    color = '#8866cc'; size = 5; break;
                case 'gate':
                case 'warpgate':
                    color = '#ffaa00'; size = 3.5; break;
                case 'drone':
                    color = '#00dddd'; size = 1.5; break;
                case 'wreck':
                    color = '#887766'; size = 2; break;
                case 'anomaly':
                    if (entity.scanned) {
                        color = entity.anomalyType === 'wormhole' ? '#8844ff' :
                            entity.anomalyType === 'combatSite' ? '#ff4422' :
                            entity.anomalyType === 'dataSite' ? '#44ddff' : '#44ff88';
                        size = 3;
                    } else { color = 'rgba(255, 255, 255, 0.3)'; size = 2; }
                    break;
                default:
                    color = '#666666'; size = 1.5;
            }

            // Blip shapes
            ctx.fillStyle = color;
            const isHostile = entity.hostility === 'hostile' || entity.type === 'enemy' || (entity.type === 'guild' && entity.isPirate);
            if (entity.type === 'station' || entity.type === 'player-station') {
                ctx.beginPath();
                ctx.moveTo(sx, sy - size); ctx.lineTo(sx + size, sy);
                ctx.lineTo(sx, sy + size); ctx.lineTo(sx - size, sy);
                ctx.closePath(); ctx.fill();
            } else if (entity.type === 'gate' || entity.type === 'warpgate') {
                ctx.lineWidth = 1; ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.moveTo(sx, sy - size); ctx.lineTo(sx + size, sy);
                ctx.lineTo(sx, sy + size); ctx.lineTo(sx - size, sy);
                ctx.closePath(); ctx.stroke();
            } else if (isHostile) {
                ctx.beginPath();
                ctx.moveTo(sx, sy + size); ctx.lineTo(sx - size, sy - size);
                ctx.lineTo(sx + size, sy - size); ctx.closePath(); ctx.fill();
            } else if (entity.type === 'wreck' || entity.type === 'loot') {
                ctx.strokeStyle = color; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx - size, sy - size); ctx.lineTo(sx + size, sy + size);
                ctx.moveTo(sx + size, sy - size); ctx.lineTo(sx - size, sy + size);
                ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
            }

            // Selected highlight
            if (entity === this.game.selectedTarget) {
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(sx, sy, size + 3, 0, Math.PI * 2); ctx.stroke();
            }

            // Hostile glow
            if (entity.hostility === 'hostile' || entity.type === 'enemy') {
                ctx.strokeStyle = color; ctx.lineWidth = 0.5;
                ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 300) * 0.2;
                ctx.beginPath(); ctx.arc(sx, sy, size + 2, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // Player chevron
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        const pr = 4;
        const pa = player.rotation;
        ctx.moveTo(cx + Math.cos(pa) * pr, cy - Math.sin(pa) * pr);
        ctx.lineTo(cx + Math.cos(pa + 2.5) * pr * 0.7, cy - Math.sin(pa + 2.5) * pr * 0.7);
        ctx.lineTo(cx + Math.cos(pa + Math.PI) * pr * 0.3, cy - Math.sin(pa + Math.PI) * pr * 0.3);
        ctx.lineTo(cx + Math.cos(pa - 2.5) * pr * 0.7, cy - Math.sin(pa - 2.5) * pr * 0.7);
        ctx.closePath(); ctx.fill();

        // D-scan sweep (when panel open)
        const dscanPanel = this.ui.elements.dscanPanel;
        const dscanOpen = dscanPanel && !dscanPanel.classList.contains('hidden');
        if (dscanOpen) {
            const sweepAngle = (Date.now() / 5000) * Math.PI * 2;
            const sweepLen = W / 2 - 5;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-sweepAngle);
            const grad = ctx.createLinearGradient(0, 0, sweepLen, 0);
            grad.addColorStop(0, 'rgba(0, 255, 128, 0.0)');
            grad.addColorStop(0.4, 'rgba(0, 255, 128, 0.15)');
            grad.addColorStop(1, 'rgba(0, 255, 128, 0.4)');
            ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sweepLen, 0); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, sweepLen * 0.8, -0.3, 0);
            ctx.strokeStyle = 'rgba(0, 255, 128, 0.06)'; ctx.lineWidth = 20; ctx.stroke();
            ctx.restore();
        }

        // Warp destination marker
        if (player.sectorWarpState === 'spooling' && player.sectorWarpTarget) {
            const wdx = player.sectorWarpTarget.x - player.x;
            const wdy = player.sectorWarpTarget.y - player.y;
            const wsx = cx + wdx * scale;
            const wsy = cy - wdy * scale;
            const pulse = 0.5 + Math.sin(Date.now() / 200) * 0.5;
            ctx.strokeStyle = `rgba(68, 136, 255, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(wsx, wsy - 5); ctx.lineTo(wsx + 4, wsy);
            ctx.lineTo(wsx, wsy + 5); ctx.lineTo(wsx - 4, wsy);
            ctx.closePath(); ctx.stroke();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = `rgba(68, 136, 255, ${0.2 + pulse * 0.2})`;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(wsx, wsy); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Autopilot route marker
        if (this.game.autopilot?.warpTarget) {
            const at = this.game.autopilot.warpTarget;
            const atdx = at.x - player.x;
            const atdy = at.y - player.y;
            const atsx = cx + atdx * scale;
            const atsy = cy - atdy * scale;
            ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)'; ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(atsx, atsy); ctx.stroke();
            ctx.setLineDash([]);
        }

        // Scan pulse animation
        if (this.scanPulse) {
            const elapsed = performance.now() - this.scanPulse.startTime;
            const progress = elapsed / this.scanPulse.duration;

            if (progress > 1.2) {
                this.scanPulse = null;
            } else {
                const ringProgress = Math.min(progress, 1.0);
                const maxRingR = (W / 2 - 10) * (this.scanPulse.range / range);
                const ringR = ringProgress * Math.min(maxRingR, W / 2 - 5);
                const ringAlpha = Math.max(0, 1 - ringProgress) * 0.5;

                ctx.strokeStyle = `rgba(0, 255, 200, ${ringAlpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();

                ctx.strokeStyle = `rgba(0, 255, 200, ${ringAlpha * 0.3})`;
                ctx.lineWidth = 6;
                ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();

                const scanScale = (W / 2 - 10) / range;
                for (const ep of this.scanPulse.entityPositions) {
                    const edist = Math.sqrt(ep.dx * ep.dx + ep.dy * ep.dy);
                    const ePixelDist = edist * scanScale;
                    const diff = Math.abs(ePixelDist - ringR);

                    if (diff < 12) {
                        const flash = Math.max(0, 1 - diff / 12);
                        const esx = cx + ep.dx * scanScale;
                        const esy = cy - ep.dy * scanScale;
                        const flashColor = ep.hostile ? '255, 80, 80' : '0, 255, 200';
                        ctx.fillStyle = `rgba(${flashColor}, ${flash * 0.7})`;
                        ctx.beginPath(); ctx.arc(esx, esy, 4 + flash * 3, 0, Math.PI * 2); ctx.fill();
                    }
                }

                if (progress > 0.6) {
                    const textAlpha = Math.min(1, (progress - 0.6) * 3) * Math.max(0, 1.2 - progress) * 3;
                    const counts = this.scanPulse.counts;
                    const total = Object.values(counts).reduce((s, c) => s + c, 0);
                    ctx.fillStyle = `rgba(0, 255, 200, ${textAlpha * 0.8})`;
                    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
                    ctx.fillText(`${total} CONTACT${total !== 1 ? 'S' : ''}`, cx, cy - 14);
                    ctx.font = '8px monospace';
                    ctx.fillStyle = `rgba(0, 255, 200, ${textAlpha * 0.5})`;
                    const parts = Object.entries(counts).slice(0, 3).map(([t, c]) => `${c} ${t}`);
                    ctx.fillText(parts.join(' | '), cx, cy - 4);
                }
            }
        }

        // Range label
        ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.font = '8px monospace'; ctx.textAlign = 'right';
        ctx.fillText(`${(range / 1000).toFixed(0)}km`, W - 4, H - 3);
    }

    toggleExpand() {
        this.minimapExpanded = !this.minimapExpanded;
        const minimap = document.getElementById('minimap');
        const btn = document.getElementById('minimap-expand-btn');
        if (minimap) {
            minimap.classList.toggle('minimap-expanded', this.minimapExpanded);
            // Update panel size to match expanded/collapsed state
            if (this.minimapExpanded) {
                minimap.style.width = '400px';
                minimap.style.height = '428px';
            } else {
                minimap.style.width = '210px';
                minimap.style.height = '';
            }
        }
        if (btn) btn.textContent = this.minimapExpanded ? '\u25BE' : '\u25B4';
        // Canvas will auto-sync via ResizeObserver
    }
}
