// =============================================
// Sector Map Manager - POLISHED
// Rich tactical map with entity icons, range rings,
// asteroid field overlays, survey heatmaps, tooltips,
// D-scan cone, fleet positions, and detailed universe view.
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { formatDistance, formatCredits } from '../utils/math.js';
import { GUILD_FACTIONS } from '../data/guildFactionDatabase.js';
import { FACTIONS } from '../data/factionDatabase.js';
import { UniverseMapRenderer3D } from './UniverseMapRenderer3D.js';

export class SectorMapManager {
    constructor(game) {
        this.game = game;

        // DOM elements
        this.modal = null;
        this.localCanvas = null;
        this.universeCanvas = null;
        this.localCtx = null;
        this.universeCtx = null;

        // 3D universe map renderer
        this.universeRenderer3D = null;

        // Local map state
        this.localZoom = 1.0;
        this.localPan = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragMoved = false;

        // State
        this.visible = false;
        this.activeTab = 'local';
        this.animationId = null;
        this.animTime = 0;

        // Hover states
        this.hoveredEntity = null;
        this.hoveredSector = null;
        this.mousePos = { x: 0, y: 0 };

        // Overlay toggles
        this.showRangeRings = true;
        this.showSurveyData = true;
        this.showDscan = false;
        this.dscanAngle = 0;
        this.showAsteroidFields = true;

        // Flag to prevent duplicate control button listeners
        this.controlsInitialized = false;

        // Tooltip element
        this.tooltip = null;

        // Asteroid cluster cache
        this._asteroidClusterCache = null;
        this._asteroidClusterEntityCount = 0;

        // Strategic overlays
        this.strategicOverlays = { faction: false, trade: false, threat: false, resources: false, events: false };

        // Entity type filters (all visible by default)
        this.entityFilters = {
            asteroid: true, planet: true, station: true, gate: true,
            enemy: true, npc: true, guild: true, fleet: true
        };

        // Cursor world position tracking
        this.cursorWorld = null; // {x, y} or null

        // Cache DOM elements
        this.cacheElements();
        this.createTooltip();
        this.setupEventListeners();
        this.setupOverlayToggles();
        this.setupEntityFilters();
    }

    setupOverlayToggles() {
        const names = ['faction', 'trade', 'threat', 'resources', 'events'];
        for (const name of names) {
            const cb = document.getElementById(`overlay-${name}`);
            if (cb) {
                cb.addEventListener('change', () => {
                    this.strategicOverlays[name] = cb.checked;
                });
            }
        }
    }

    setupEntityFilters() {
        const bar = document.getElementById('entity-filter-bar');
        if (!bar) return;
        const types = [
            { id: 'asteroid', label: 'Rocks', color: '#aa8844' },
            { id: 'planet', label: 'Planets', color: '#6688aa' },
            { id: 'station', label: 'Stations', color: '#00cc44' },
            { id: 'gate', label: 'Wormholes', color: '#0088ff' },
            { id: 'enemy', label: 'Hostiles', color: '#ff4444' },
            { id: 'npc', label: 'NPCs', color: '#88cc88' },
            { id: 'guild', label: 'Guild', color: '#cc88ff' },
            { id: 'fleet', label: 'Fleet', color: '#44ffaa' },
        ];
        bar.innerHTML = types.map(t =>
            `<button class="ef-btn active" data-type="${t.id}" style="--ef-color:${t.color}">` +
            `<span class="ef-dot" style="background:${t.color}"></span>${t.label}</button>`
        ).join('');
        bar.addEventListener('click', (e) => {
            const btn = e.target.closest('.ef-btn');
            if (!btn) return;
            const type = btn.dataset.type;
            this.entityFilters[type] = !this.entityFilters[type];
            btn.classList.toggle('active', this.entityFilters[type]);
        });
    }

    cacheElements() {
        this.modal = document.getElementById('sector-map-modal');
        this.localCanvas = document.getElementById('local-map-canvas');
        this.universeCanvas = document.getElementById('universe-map-canvas');
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'map-tooltip hidden';
        document.body.appendChild(this.tooltip);
    }

    setupEventListeners() {
        if (!this.modal) return;

        const closeBtn = document.getElementById('sector-map-close');
        closeBtn?.addEventListener('click', () => this.hide());

        this.modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const tabId = `map-tab-${btn.dataset.tab}`;
                document.getElementById(tabId)?.classList.add('active');
                this.activeTab = btn.dataset.tab;
                // Start/stop 3D renderer based on active tab
                if (this.activeTab === 'universe') {
                    // Lazy-init on first activation (container must be visible)
                    if (!this.universeRenderer3D && this.universeCanvas) {
                        const container = this.universeCanvas.parentElement;
                        if (container) {
                            this.universeRenderer3D = new UniverseMapRenderer3D(this.game, container);
                            this.universeRenderer3D.init();
                        }
                    }
                    if (this.universeRenderer3D) {
                        // Defer resize to next frame so layout is fully computed
                        requestAnimationFrame(() => {
                            this.universeRenderer3D.resize();
                            this.universeRenderer3D.startAnimation();
                        });
                    }
                } else {
                    this.universeRenderer3D?.stopAnimation();
                }
                this.render();
                this.game.audio?.play('click');
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.visible) {
                e.stopPropagation();
                this.hide();
            }
        });
    }

    initCanvases() {
        if (this.localCanvas && !this.localCtx) {
            this.localCanvas.width = this.localCanvas.parentElement?.clientWidth || 800;
            this.localCanvas.height = this.localCanvas.parentElement?.clientHeight || 500;
            this.localCtx = this.localCanvas.getContext('2d');

            this.localCanvas.addEventListener('wheel', (e) => this.handleLocalZoom(e));
            this.localCanvas.addEventListener('mousedown', (e) => this.handleLocalMouseDown(e));
            this.localCanvas.addEventListener('mousemove', (e) => this.handleLocalMouseMove(e));
            this.localCanvas.addEventListener('mouseup', () => this.handleLocalMouseUp());
            this.localCanvas.addEventListener('mouseleave', () => { this.handleLocalMouseUp(); this.hideTooltip(); });
            this.localCanvas.addEventListener('click', (e) => this.handleLocalClick(e));
            this.localCanvas.addEventListener('contextmenu', (e) => this.handleLocalRightClick(e));
        }

        // 3D universe renderer is lazy-initialized when universe tab is first activated
        // (container must be visible to have non-zero dimensions for Three.js)

        if (!this.controlsInitialized) {
            this.controlsInitialized = true;
            document.getElementById('local-zoom-in')?.addEventListener('click', () => {
                this.localZoom = Math.min(8.0, this.localZoom * 1.5);
            });
            document.getElementById('local-zoom-out')?.addEventListener('click', () => {
                this.localZoom = Math.max(0.1, this.localZoom / 1.5);
            });
            document.getElementById('local-center')?.addEventListener('click', () => {
                this.centerOnPlayer();
            });
        }
    }

    show() {
        if (!this.modal) return;
        this.modal.classList.remove('hidden');
        this.visible = true;

        if (!this.localCtx) {
            setTimeout(() => {
                this.initCanvases();
                this.centerOnPlayer();
                this.render();
                this.startAnimation();
                this.ensureUniverseRenderer();
            }, 50);
        } else {
            this.centerOnPlayer();
            this.render();
            this.startAnimation();
            this.ensureUniverseRenderer();
        }
        this.game.audio?.play('click');
    }

    hide() {
        if (!this.modal) return;
        this.modal.classList.add('hidden');
        this.visible = false;
        this.stopAnimation();
        this.universeRenderer3D?.stopAnimation();
        this.hideTooltip();
    }

    /**
     * Lazy-init and start 3D universe renderer if on the universe tab.
     * Uses rAF to ensure the tab container is laid out before sizing the renderer.
     */
    ensureUniverseRenderer() {
        if (this.activeTab !== 'universe') return;
        if (!this.universeRenderer3D && this.universeCanvas) {
            const container = this.universeCanvas.parentElement;
            if (container) {
                this.universeRenderer3D = new UniverseMapRenderer3D(this.game, container);
                this.universeRenderer3D.init();
            }
        }
        if (this.universeRenderer3D) {
            requestAnimationFrame(() => {
                this.universeRenderer3D.resize();
                this.universeRenderer3D.startAnimation();
            });
        }
    }

    toggle() {
        if (this.visible) this.hide();
        else this.show();
    }

    startAnimation() {
        if (this.animationId) return;
        const animate = () => {
            if (!this.visible) { this.animationId = null; return; }
            this.animTime += 0.016;
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        this.animationId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    }

    render() {
        if (this.activeTab === 'local') this.renderLocalMap();
        else this.renderUniverseMap();
    }

    centerOnPlayer() {
        const player = this.game.player;
        if (player) {
            this.localPan.x = player.x;
            this.localPan.y = player.y;
        }
    }

    // ==========================================
    // LOCAL MAP RENDERING
    // ==========================================

    renderLocalMap() {
        if (!this.localCtx || !this.localCanvas) return;

        const ctx = this.localCtx;
        const w = this.localCanvas.width;
        const h = this.localCanvas.height;
        const player = this.game.player;
        const sector = this.game.currentSector;

        // Deep space background
        ctx.fillStyle = '#000810';
        ctx.fillRect(0, 0, w, h);

        if (!sector) return;

        const scale = (this.localZoom * w) / CONFIG.SECTOR_SIZE;
        const ox = w / 2 - this.localPan.x * scale;
        const oy = h / 2 - this.localPan.y * scale;

        // Subtle background stars
        this.drawBackgroundStars(ctx, w, h, ox, oy, scale);

        // Grid
        this.drawLocalGrid(ctx, w, h, scale, ox, oy);

        // Sector boundary
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(ox, oy, CONFIG.SECTOR_SIZE * scale, CONFIG.SECTOR_SIZE * scale);
        ctx.setLineDash([]);

        // Asteroid field overlay (density clouds)
        if (this.showAsteroidFields) {
            this.drawAsteroidFieldOverlay(ctx, sector, scale, ox, oy);
        }

        // Survey data overlay
        if (this.showSurveyData) {
            this.drawSurveyOverlay(ctx, scale, ox, oy);
        }

        // Player range rings
        if (this.showRangeRings && player && player.alive) {
            this.drawRangeRings(ctx, player, scale, ox, oy);
        }

        // D-Scan cone
        if (this.showDscan && player && player.alive) {
            this.drawDscanCone(ctx, player, scale, ox, oy);
        }

        // Draw entities (sorted: asteroids first, then structures, then ships)
        const entities = (sector.entities || []).filter(e => e.alive && e.visible !== false);
        const sortOrder = { asteroid: 0, planet: 1, station: 2, warpgate: 3, npc: 4, fleet: 5, guild: 6, enemy: 7 };
        entities.sort((a, b) => (sortOrder[a.type] || 4) - (sortOrder[b.type] || 4));

        for (const entity of entities) {
            // Entity filter check
            const filterType = (entity.type === 'warpgate' || entity.type === 'gate') ? 'gate' :
                               (entity.type === 'player-station') ? 'station' : entity.type;
            if (!this.entityFilters[filterType]) continue;
            this.drawEntity(ctx, entity, scale, ox, oy, w, h);
        }

        // Fleet ships
        const fleetShips = this.game.fleet?.ships || [];
        for (const fs of fleetShips) {
            if (fs.alive && fs.currentSector === sector.id && this.entityFilters.fleet) {
                this.drawEntity(ctx, fs, scale, ox, oy, w, h);
            }
        }

        // Player (drawn last, always on top)
        if (player && player.alive) {
            this.drawPlayer(ctx, player, scale, ox, oy);
        }

        // Hover tooltip
        if (this.hoveredEntity && !this.isDragging) {
            this.drawEntityTooltip(ctx, this.hoveredEntity, scale, ox, oy, w, h);
        }

        // Info overlay
        this.drawLocalInfo(ctx, w, h);

        // Legend
        this.drawLocalLegend(ctx, w, h);

        // Minimap inset
        this.drawMinimap(ctx, sector, player, w, h, scale, ox, oy);

        // Cursor info bar
        this.drawCursorInfo(ctx, player, w, h);
    }

    drawBackgroundStars(ctx, w, h, ox, oy, scale) {
        // Deterministic star positions based on pan
        const seed = Math.floor(ox * 0.01) + Math.floor(oy * 0.01) * 1000;
        const rng = (i) => {
            const x = Math.sin(seed + i * 127.1) * 43758.5453;
            return x - Math.floor(x);
        };
        ctx.fillStyle = 'rgba(100, 140, 180, 0.3)';
        for (let i = 0; i < 60; i++) {
            const sx = rng(i) * w;
            const sy = rng(i + 100) * h;
            const size = rng(i + 200) * 1.5 + 0.5;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawLocalGrid(ctx, w, h, scale, ox, oy) {
        // Adaptive grid spacing based on zoom
        let gridSize = 1000;
        if (this.localZoom > 3) gridSize = 500;
        if (this.localZoom > 6) gridSize = 200;
        if (this.localZoom < 0.5) gridSize = 2000;
        if (this.localZoom < 0.2) gridSize = 5000;

        ctx.strokeStyle = 'rgba(0, 180, 255, 0.06)';
        ctx.lineWidth = 1;

        const startX = Math.floor(-ox / (gridSize * scale)) * gridSize;
        const startY = Math.floor(-oy / (gridSize * scale)) * gridSize;
        const endX = Math.ceil((w - ox) / (gridSize * scale)) * gridSize;
        const endY = Math.ceil((h - oy) / (gridSize * scale)) * gridSize;

        for (let x = startX; x <= endX; x += gridSize) {
            if (x < 0 || x > CONFIG.SECTOR_SIZE) continue;
            const sx = x * scale + ox;
            ctx.beginPath();
            ctx.moveTo(sx, Math.max(0, oy));
            ctx.lineTo(sx, Math.min(h, oy + CONFIG.SECTOR_SIZE * scale));
            ctx.stroke();
        }

        for (let y = startY; y <= endY; y += gridSize) {
            if (y < 0 || y > CONFIG.SECTOR_SIZE) continue;
            const sy = y * scale + oy;
            ctx.beginPath();
            ctx.moveTo(Math.max(0, ox), sy);
            ctx.lineTo(Math.min(w, ox + CONFIG.SECTOR_SIZE * scale), sy);
            ctx.stroke();
        }

        // Grid coordinate labels
        if (this.localZoom > 0.3) {
            ctx.fillStyle = 'rgba(0, 180, 255, 0.15)';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            for (let x = startX; x <= endX; x += gridSize) {
                if (x < 0 || x > CONFIG.SECTOR_SIZE) continue;
                const sx = x * scale + ox;
                if (sx > 0 && sx < w) {
                    ctx.fillText(`${(x / 1000).toFixed(0)}km`, sx + 2, Math.max(12, oy + 12));
                }
            }
        }
    }

    drawAsteroidFieldOverlay(ctx, sector, scale, ox, oy) {
        // Cluster asteroids into field groups and draw density clouds
        const asteroids = (sector.entities || []).filter(e => e.alive && e.type === 'asteroid');
        if (asteroids.length < 3) return;

        // Use cached cluster results if entity count hasn't changed
        let fields;
        if (this._asteroidClusterCache && this._asteroidClusterEntityCount === asteroids.length) {
            fields = this._asteroidClusterCache;
        } else {
            // Group nearby asteroids into fields (simple spatial clustering)
            const fieldRadius = 2000;
            fields = [];
            const assigned = new Set();

            for (let i = 0; i < asteroids.length; i++) {
                if (assigned.has(i)) continue;
                const field = { asteroids: [asteroids[i]], cx: asteroids[i].x, cy: asteroids[i].y };
                assigned.add(i);

                for (let j = i + 1; j < asteroids.length; j++) {
                    if (assigned.has(j)) continue;
                    const dx = asteroids[j].x - field.cx;
                    const dy = asteroids[j].y - field.cy;
                    if (Math.sqrt(dx * dx + dy * dy) < fieldRadius) {
                        field.asteroids.push(asteroids[j]);
                        assigned.add(j);
                        // Update centroid
                        field.cx = field.asteroids.reduce((s, a) => s + a.x, 0) / field.asteroids.length;
                        field.cy = field.asteroids.reduce((s, a) => s + a.y, 0) / field.asteroids.length;
                    }
                }
                if (field.asteroids.length >= 2) fields.push(field);
            }
            this._asteroidClusterCache = fields;
            this._asteroidClusterEntityCount = asteroids.length;
        }

        // Draw field boundary clouds
        for (const field of fields) {
            const sx = field.cx * scale + ox;
            const sy = field.cy * scale + oy;

            // Calculate field radius
            let maxDist = 0;
            for (const a of field.asteroids) {
                const d = Math.sqrt((a.x - field.cx) ** 2 + (a.y - field.cy) ** 2);
                if (d > maxDist) maxDist = d;
            }
            const r = Math.max(30, (maxDist + 500) * scale);

            // Dominant ore type color
            const oreCounts = {};
            for (const a of field.asteroids) {
                const t = a.oreType || 'veldspar';
                oreCounts[t] = (oreCounts[t] || 0) + 1;
            }
            const dominant = Object.entries(oreCounts).sort((a, b) => b[1] - a[1])[0][0];
            const oreColor = CONFIG.ASTEROID_TYPES[dominant]?.color || 0x888888;
            const colorStr = `#${(typeof oreColor === 'number' ? oreColor : parseInt(oreColor)).toString(16).padStart(6, '0')}`;

            // Soft gradient cloud
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
            grad.addColorStop(0, this.hexToRgba(colorStr, 0.08));
            grad.addColorStop(0.6, this.hexToRgba(colorStr, 0.04));
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();

            // Dashed boundary
            ctx.strokeStyle = this.hexToRgba(colorStr, 0.15);
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(sx, sy, r * 0.85, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Field label
            if (r > 20) {
                ctx.fillStyle = this.hexToRgba(colorStr, 0.5);
                ctx.font = '11px monospace';
                ctx.textAlign = 'center';
                const oreName = CONFIG.ASTEROID_TYPES[dominant]?.name || dominant;
                ctx.fillText(`${oreName} Field (${field.asteroids.length})`, sx, sy - r - 4);
            }
        }
    }

    drawSurveyOverlay(ctx, scale, ox, oy) {
        const surveySystem = this.game.surveySystem;
        if (!surveySystem) return;

        const sectorId = this.game.currentSector?.id;
        if (!sectorId) return;

        const scans = surveySystem.surveyData[sectorId];
        if (!scans) return;

        // Draw scan circles
        for (const scan of Object.values(scans)) {
            const sx = scan.scannerPos.x * scale + ox;
            const sy = scan.scannerPos.y * scale + oy;
            const r = scan.scanRadius * scale;

            // Scan area circle
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Scanned asteroid dots with value-based size
            for (const a of scan.asteroids) {
                const ax = a.x * scale + ox;
                const ay = a.y * scale + oy;
                const dotR = Math.max(2, Math.min(6, a.oreRemaining * 0.02));

                const oreColor = CONFIG.ASTEROID_TYPES[a.oreType]?.color || 0x888888;
                const colorStr = `#${(typeof oreColor === 'number' ? oreColor : parseInt(oreColor)).toString(16).padStart(6, '0')}`;

                ctx.fillStyle = this.hexToRgba(colorStr, 0.7);
                ctx.beginPath();
                ctx.arc(ax, ay, dotR, 0, Math.PI * 2);
                ctx.fill();

                // Value ring for high-value ores
                if (a.value >= 50) {
                    ctx.strokeStyle = this.hexToRgba(colorStr, 0.4);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(ax, ay, dotR + 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }
    }

    drawRangeRings(ctx, player, scale, ox, oy) {
        const sx = player.x * scale + ox;
        const sy = player.y * scale + oy;

        const rings = [
            { range: 200, label: 'Mining', color: 'rgba(68, 136, 255, 0.2)', dash: [2, 4] },
            { range: 500, label: 'Short', color: 'rgba(255, 170, 68, 0.15)', dash: [4, 4] },
            { range: 1000, label: 'Med', color: 'rgba(255, 255, 68, 0.1)', dash: [6, 4] },
            { range: 2000, label: 'Long', color: 'rgba(255, 68, 68, 0.08)', dash: [8, 4] },
        ];

        for (const ring of rings) {
            const r = ring.range * scale;
            if (r < 5 || r > 2000) continue; // Skip if too small/large on screen

            ctx.strokeStyle = ring.color;
            ctx.lineWidth = 1;
            ctx.setLineDash(ring.dash);
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.stroke();

            // Label
            ctx.fillStyle = ring.color.replace(/[\d.]+\)$/, '0.5)');
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${ring.range}m ${ring.label}`, sx + r + 3, sy - 2);
        }
        ctx.setLineDash([]);
    }

    drawDscanCone(ctx, player, scale, ox, oy) {
        const sx = player.x * scale + ox;
        const sy = player.y * scale + oy;
        const angle = player.rotation;
        const coneAngle = Math.PI / 4; // 45 degree cone
        const coneRange = 5000 * scale;

        ctx.fillStyle = 'rgba(0, 255, 200, 0.04)';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, coneRange, angle - coneAngle, angle + coneAngle);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 255, 200, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawEntity(ctx, entity, scale, ox, oy, w, h) {
        const sx = entity.x * scale + ox;
        const sy = entity.y * scale + oy;

        // Cull off-screen entities (with margin)
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) return;

        const isSelected = entity === this.game.selectedTarget;
        const isHovered = entity === this.hoveredEntity;
        const isLocked = entity === this.game.lockedTarget;
        const pulse = Math.sin(this.animTime * 3) * 0.3 + 0.7;

        switch (entity.type) {
            case 'asteroid':
                this.drawAsteroid(ctx, entity, sx, sy, scale, isSelected, isHovered);
                break;
            case 'planet':
                this.drawPlanet(ctx, entity, sx, sy, scale, isSelected);
                break;
            case 'station':
            case 'player-station':
                this.drawStation(ctx, entity, sx, sy, scale, isSelected, isHovered, pulse);
                break;
            case 'gate':
            case 'warpgate':
                this.drawWarpGate(ctx, entity, sx, sy, scale, isSelected, isHovered, pulse);
                break;
            case 'enemy':
                this.drawShipIcon(ctx, entity, sx, sy, scale, '#ff4444', isSelected, isHovered, isLocked, pulse);
                break;
            case 'npc':
                this.drawNPCIcon(ctx, entity, sx, sy, scale, isSelected, isHovered, isLocked);
                break;
            case 'guild':
                this.drawGuildShipIcon(ctx, entity, sx, sy, scale, isSelected, isHovered, isLocked);
                break;
            case 'fleet':
                this.drawShipIcon(ctx, entity, sx, sy, scale, '#44ffaa', isSelected, isHovered, isLocked, pulse);
                break;
            default:
                this.drawGenericDot(ctx, sx, sy, '#888888', 4);
        }

        // Selected indicator
        if (isSelected) {
            const r = Math.max(6, (entity.radius || 10) * scale * 0.3);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sx, sy, r + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Locked indicator
        if (isLocked) {
            const r = Math.max(8, (entity.radius || 10) * scale * 0.3);
            ctx.strokeStyle = `rgba(255, 68, 68, ${0.5 + pulse * 0.5})`;
            ctx.lineWidth = 2;
            // Crosshair
            const cr = r + 6;
            ctx.beginPath();
            ctx.moveTo(sx - cr, sy); ctx.lineTo(sx - cr + 4, sy);
            ctx.moveTo(sx + cr, sy); ctx.lineTo(sx + cr - 4, sy);
            ctx.moveTo(sx, sy - cr); ctx.lineTo(sx, sy - cr + 4);
            ctx.moveTo(sx, sy + cr); ctx.lineTo(sx, sy + cr - 4);
            ctx.stroke();
        }

        // Label for important entities
        const showLabel = entity.type === 'station' || entity.type === 'player-station' || entity.type === 'gate' || entity.type === 'warpgate' ||
            isHovered || isSelected || isLocked ||
            (entity.type === 'enemy' && this.localZoom > 0.8);

        if (showLabel) {
            const r = Math.max(6, (entity.radius || 10) * scale * 0.3);
            ctx.fillStyle = isSelected ? '#00ffff' : isHovered ? '#ffffff' : 'rgba(200, 220, 255, 0.7)';
            ctx.font = isSelected ? 'bold 12px monospace' : '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(entity.name || '', sx, sy - r - 6);
        }
    }

    drawAsteroid(ctx, entity, sx, sy, scale, isSelected, isHovered) {
        const oreType = entity.oreType || 'veldspar';
        const config = CONFIG.ASTEROID_TYPES[oreType];
        const color = config ? `#${config.color.toString(16).padStart(6, '0')}` : '#888888';
        const r = Math.max(2, Math.min(5, (entity.radius || 8) * scale * 0.3));

        // Asteroid dot with ore-colored glow
        ctx.fillStyle = color;
        ctx.globalAlpha = isHovered ? 1.0 : 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Depletion indicator (smaller = more depleted)
        if (entity.oreRemaining !== undefined && entity.oreAmount) {
            const pct = entity.oreRemaining / entity.oreAmount;
            if (pct < 0.3) {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(sx, sy, r + 2, 0, Math.PI * 2 * pct);
                ctx.stroke();
            }
        }
    }

    drawPlanet(ctx, entity, sx, sy, scale, isSelected) {
        const r = Math.max(8, Math.min(40, entity.radius * scale * 0.3));

        // Planet gradient
        const grad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 0, sx, sy, r);
        grad.addColorStop(0, '#8866cc');
        grad.addColorStop(0.7, '#442266');
        grad.addColorStop(1, '#221133');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // Kill radius ring
        if (entity.killRadius) {
            const kr = entity.killRadius * scale;
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(sx, sy, kr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Label
        ctx.fillStyle = '#8866cc';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(entity.name || 'Planet', sx, sy - r - 4);
    }

    drawStation(ctx, entity, sx, sy, scale, isSelected, isHovered, pulse) {
        const r = Math.max(6, Math.min(14, entity.radius * scale * 0.2));

        // Station diamond icon
        ctx.fillStyle = isHovered ? '#44ff88' : '#00cc44';
        ctx.beginPath();
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r * 0.7, sy);
        ctx.lineTo(sx, sy + r);
        ctx.lineTo(sx - r * 0.7, sy);
        ctx.closePath();
        ctx.fill();

        // Inner detail
        ctx.fillStyle = '#003311';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Docking range ring
        const dockRange = (entity.dockingRange || entity.radius + 200) * scale;
        if (dockRange > 3) {
            ctx.strokeStyle = `rgba(0, 204, 68, ${0.1 + pulse * 0.1})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.arc(sx, sy, dockRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Always show label
        ctx.fillStyle = '#44ff88';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(entity.name || 'Station', sx, sy - r - 6);
    }

    drawWarpGate(ctx, entity, sx, sy, scale, isSelected, isHovered, pulse) {
        const r = Math.max(6, Math.min(12, (entity.radius || 30) * scale * 0.2));

        // Gate portal circle
        ctx.strokeStyle = isHovered ? '#66ccff' : '#0088ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Inner rotating arcs
        const t = this.animTime;
        ctx.strokeStyle = `rgba(0, 170, 255, ${0.4 + pulse * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.6, t % (Math.PI * 2), (t + Math.PI) % (Math.PI * 2));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.6, (t + Math.PI) % (Math.PI * 2), (t + Math.PI * 2) % (Math.PI * 2));
        ctx.stroke();

        // Destination label
        const dest = entity.destinationSectorId || '';
        const destSector = UNIVERSE_LAYOUT.sectors.find(s => s.id === dest);
        ctx.fillStyle = '#66aaff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(entity.name || 'Elder Wormhole', sx, sy - r - 8);
        if (destSector) {
            ctx.fillStyle = 'rgba(102, 170, 255, 0.5)';
            ctx.fillText(`\u2192 ${destSector.name}`, sx, sy - r - 18);
        }
    }

    drawShipIcon(ctx, entity, sx, sy, scale, color, isSelected, isHovered, isLocked, pulse) {
        const r = Math.max(4, Math.min(8, (entity.radius || 10) * scale * 0.4));
        const angle = entity.rotation || 0;

        // Directional triangle
        ctx.fillStyle = isHovered ? '#ffffff' : color;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(angle) * r * 1.5, sy + Math.sin(angle) * r * 1.5);
        ctx.lineTo(sx + Math.cos(angle + 2.4) * r, sy + Math.sin(angle + 2.4) * r);
        ctx.lineTo(sx + Math.cos(angle - 2.4) * r, sy + Math.sin(angle - 2.4) * r);
        ctx.closePath();
        ctx.fill();

        // Velocity vector line
        if (entity.currentSpeed > 5) {
            const vLen = Math.min(20, entity.currentSpeed * scale * 0.5);
            ctx.strokeStyle = `${color}66`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(angle) * vLen, sy + Math.sin(angle) * vLen);
            ctx.stroke();
        }

        // HP bar below
        if (isHovered || isSelected || isLocked) {
            const totalHp = (entity.shield || 0) + (entity.armor || 0) + (entity.hull || 0);
            const maxHp = (entity.maxShield || 0) + (entity.maxArmor || 0) + (entity.maxHull || 0);
            if (maxHp > 0) {
                const pct = totalHp / maxHp;
                const barW = 20;
                const barH = 2;
                const barX = sx - barW / 2;
                const barY = sy + r + 4;
                ctx.fillStyle = '#222';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = pct > 0.6 ? '#44ff88' : pct > 0.3 ? '#ffaa44' : '#ff4444';
                ctx.fillRect(barX, barY, barW * pct, barH);
            }
        }
    }

    drawNPCIcon(ctx, entity, sx, sy, scale, isSelected, isHovered, isLocked) {
        const role = entity.role || 'miner';
        let color = '#88aacc';
        if (role === 'security') color = '#4488ff';
        else if (role === 'miner') color = '#88cc88';
        else if (role === 'logistics') color = '#88ff88';
        else if (role === 'surveyor') color = '#88ffcc';

        const r = Math.max(3, Math.min(6, (entity.radius || 8) * scale * 0.3));

        // Role-specific icon shape
        if (role === 'security') {
            // Shield shape
            ctx.fillStyle = isHovered ? '#ffffff' : color;
            ctx.beginPath();
            ctx.moveTo(sx, sy - r);
            ctx.lineTo(sx + r, sy - r * 0.3);
            ctx.lineTo(sx + r * 0.7, sy + r);
            ctx.lineTo(sx - r * 0.7, sy + r);
            ctx.lineTo(sx - r, sy - r * 0.3);
            ctx.closePath();
            ctx.fill();
        } else if (role === 'miner') {
            // Pickaxe dot
            ctx.fillStyle = isHovered ? '#ffffff' : color;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx - r * 0.5, sy - r * 0.5);
            ctx.lineTo(sx + r * 0.5, sy + r * 0.5);
            ctx.stroke();
        } else {
            // Generic NPC dot
            ctx.fillStyle = isHovered ? '#ffffff' : color;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawGuildShipIcon(ctx, entity, sx, sy, scale, isSelected, isHovered, isLocked) {
        const isPirate = entity.isPirate;
        let color = '#aaaaff'; // default guild color

        if (isPirate) {
            color = '#ff4466';
        } else if (entity.factionId) {
            const faction = GUILD_FACTIONS?.[entity.factionId];
            if (faction) color = faction.color;
        }

        const pulse = Math.sin(this.animTime * 3) * 0.3 + 0.7;
        this.drawShipIcon(ctx, entity, sx, sy, scale, color, isSelected, isHovered, isLocked, pulse);
    }

    drawPlayer(ctx, player, scale, ox, oy) {
        const sx = player.x * scale + ox;
        const sy = player.y * scale + oy;
        const r = 10;
        const angle = player.rotation;
        const pulse = Math.sin(this.animTime * 2) * 0.2 + 0.8;

        // Outer glow
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.5);
        grad.addColorStop(0, `rgba(0, 255, 255, ${0.15 * pulse})`);
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Player triangle (larger, filled)
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(angle) * r * 1.8, sy + Math.sin(angle) * r * 1.8);
        ctx.lineTo(sx + Math.cos(angle + 2.4) * r, sy + Math.sin(angle + 2.4) * r);
        ctx.lineTo(sx + Math.cos(angle - 2.4) * r, sy + Math.sin(angle - 2.4) * r);
        ctx.closePath();
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = '#88ffff';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Velocity vector
        if (player.currentSpeed > 5) {
            const vLen = Math.min(30, player.currentSpeed * scale * 0.8);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(angle) * r * 1.8, sy + Math.sin(angle) * r * 1.8);
            ctx.lineTo(sx + Math.cos(angle) * (r * 1.8 + vLen), sy + Math.sin(angle) * (r * 1.8 + vLen));
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // EWAR status indicators
        if (player.isPointed) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.arc(sx, sy, r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (player.isWebbed) {
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + Math.cos(a) * (r + 4), sy + Math.sin(a) * (r + 4));
            }
            ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YOU', sx, sy - r - 8);
    }

    drawGenericDot(ctx, sx, sy, color, r) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEntityTooltip(ctx, entity, scale, ox, oy, w, h) {
        const sx = entity.x * scale + ox;
        const sy = entity.y * scale + oy;

        // Build tooltip lines
        const lines = [];
        lines.push(entity.name || 'Unknown');

        if (entity.type === 'asteroid') {
            const oreName = CONFIG.ASTEROID_TYPES[entity.oreType]?.name || entity.oreType;
            const value = CONFIG.ASTEROID_TYPES[entity.oreType]?.value || 0;
            lines.push(`Type: ${oreName} (${value} ISK/unit)`);
            if (entity.oreRemaining !== undefined) {
                lines.push(`Remaining: ${entity.oreRemaining} units`);
            }
        } else if (entity.type === 'station' || entity.type === 'player-station') {
            lines.push(entity.type === 'player-station' ? 'Player Station' : 'Station');
            if (entity.specialty) lines.push(`Specialty: ${entity.specialty}`);
        } else if (entity.type === 'gate' || entity.type === 'warpgate') {
            const dest = entity.destinationName || entity.destinationSectorId || 'unknown';
            lines.push(`Elder Wormhole \u2192 ${dest}`);
        } else if (entity.type === 'enemy' || entity.type === 'npc' || entity.type === 'guild' || entity.type === 'fleet') {
            if (entity.role) lines.push(`Role: ${entity.role}`);
            if (entity.shipClass) lines.push(`Class: ${entity.shipClass}`);
            const totalHp = (entity.shield || 0) + (entity.armor || 0) + (entity.hull || 0);
            const maxHp = (entity.maxShield || 0) + (entity.maxArmor || 0) + (entity.maxHull || 0);
            if (maxHp > 0) lines.push(`HP: ${Math.round(totalHp / maxHp * 100)}%`);
            if (entity.aiState) lines.push(`State: ${entity.aiState}`);
            if (entity.bounty) lines.push(`Bounty: ${entity.bounty} ISK`);
        }

        const player = this.game.player;
        if (player) {
            const dist = player.distanceTo(entity);
            lines.push(`Dist: ${formatDistance(dist)}`);
        }

        // Draw tooltip box
        const padding = 6;
        const lineH = 14;
        const tooltipW = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2 + 10;
        const tooltipH = lines.length * lineH + padding * 2;

        let tx = sx + 15;
        let ty = sy - tooltipH / 2;
        if (tx + tooltipW > w) tx = sx - tooltipW - 15;
        if (ty < 5) ty = 5;
        if (ty + tooltipH > h) ty = h - tooltipH - 5;

        // Background
        ctx.fillStyle = 'rgba(0, 10, 20, 0.9)';
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipW, tooltipH, 4);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ccddee';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillStyle = i === 0 ? '#ffffff' : '#aabbcc';
            ctx.fillText(lines[i], tx + padding, ty + padding + (i + 1) * lineH - 3);
        }
    }

    drawLocalInfo(ctx, w, h) {
        // Top-left panel
        const sector = this.game.currentSector;
        const difficulty = sector?.difficulty || 'unknown';
        const diffColor = this.getDifficultyColor(difficulty);

        // Background for info
        ctx.fillStyle = 'rgba(0, 10, 20, 0.7)';
        ctx.fillRect(5, 5, 190, 80);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(5, 5, 190, 80);

        ctx.fillStyle = '#00ccff';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(sector?.name || 'Unknown Sector', 12, 22);

        ctx.fillStyle = diffColor;
        ctx.font = '12px monospace';
        ctx.fillText(`Security: ${difficulty.toUpperCase()}`, 12, 38);

        ctx.fillStyle = '#778899';
        ctx.fillText(`Zoom: ${(this.localZoom * 100).toFixed(0)}%`, 12, 52);

        const entities = (sector?.entities || []).filter(e => e.alive);
        const ships = entities.filter(e => e.type === 'enemy' || e.type === 'npc' || e.type === 'guild');
        const asteroids = entities.filter(e => e.type === 'asteroid');
        ctx.fillText(`Ships: ${ships.length} | Rocks: ${asteroids.length}`, 12, 66);

        // Player coordinates
        const player = this.game.player;
        if (player) {
            ctx.fillStyle = '#556677';
            ctx.font = '11px monospace';
            ctx.fillText(`Pos: ${Math.round(player.x)}, ${Math.round(player.y)}`, 12, 80);
        }
    }

    drawLocalLegend(ctx, w, h) {
        const items = [
            { color: '#00ffff', shape: 'tri', label: 'You' },
            { color: '#ff4444', shape: 'tri', label: 'Hostile' },
            { color: '#88cc88', shape: 'dot', label: 'NPC Miner' },
            { color: '#4488ff', shape: 'shield', label: 'Security' },
            { color: '#00cc44', shape: 'diamond', label: 'Station' },
            { color: '#0088ff', shape: 'circle', label: 'Wormhole' },
        ];

        const startX = w - 110;
        let y = h - items.length * 15 - 10;

        ctx.fillStyle = 'rgba(0, 10, 20, 0.6)';
        ctx.fillRect(startX - 5, y - 5, 115, items.length * 15 + 10);

        ctx.font = '11px monospace';
        for (const item of items) {
            const ix = startX + 5;
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(ix, y + 5, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#889999';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, ix + 8, y + 8);
            y += 15;
        }
    }

    // ==========================================
    // MINIMAP & CURSOR INFO
    // ==========================================

    drawMinimap(ctx, sector, player, w, h, mainScale, mainOx, mainOy) {
        const size = 120;
        const pad = 8;
        const mx = w - size - pad;
        const my = pad + 90; // below info panel
        const ss = CONFIG.SECTOR_SIZE;
        const miniScale = size / ss;

        // Background
        ctx.fillStyle = 'rgba(0, 8, 16, 0.8)';
        ctx.fillRect(mx, my, size, size);
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx, my, size, size);

        // Entity dots (simplified)
        const entities = (sector?.entities || []).filter(e => e.alive);
        for (const e of entities) {
            const filterType = (e.type === 'warpgate' || e.type === 'gate') ? 'gate' :
                               (e.type === 'player-station') ? 'station' : e.type;
            if (!this.entityFilters[filterType]) continue;
            const ex = mx + e.x * miniScale;
            const ey = my + e.y * miniScale;
            if (ex < mx || ex > mx + size || ey < my || ey > my + size) continue;

            let color = '#555';
            if (e.type === 'asteroid') color = '#665533';
            else if (e.type === 'station' || e.type === 'player-station') color = '#00cc44';
            else if (e.type === 'gate' || e.type === 'warpgate') color = '#0088ff';
            else if (e.type === 'enemy') color = '#ff4444';
            else if (e.type === 'npc') color = '#88aa88';
            else if (e.type === 'guild') color = '#aa77cc';

            ctx.fillStyle = color;
            ctx.fillRect(ex - 0.5, ey - 0.5, 1.5, 1.5);
        }

        // Fleet dots
        const fleetShips = this.game.fleet?.ships || [];
        if (this.entityFilters.fleet) {
            for (const fs of fleetShips) {
                if (fs.alive && fs.currentSector === sector?.id) {
                    ctx.fillStyle = '#44ffaa';
                    ctx.fillRect(mx + fs.x * miniScale - 0.5, my + fs.y * miniScale - 0.5, 1.5, 1.5);
                }
            }
        }

        // Player dot
        if (player && player.alive) {
            const px = mx + player.x * miniScale;
            const py = my + player.y * miniScale;
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Viewport rectangle
        const viewL = (-mainOx / mainScale) * miniScale;
        const viewT = (-mainOy / mainScale) * miniScale;
        const viewW = (w / mainScale) * miniScale;
        const viewH = (h / mainScale) * miniScale;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(mx + viewL, my + viewT, viewW, viewH);
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = 'rgba(0, 200, 255, 0.4)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('MINIMAP', mx + size - 3, my + size - 3);
    }

    drawCursorInfo(ctx, player, w, h) {
        if (!this.cursorWorld || this.isDragging) return;

        const cx = this.cursorWorld.x;
        const cy = this.cursorWorld.y;
        // Only show if cursor is within sector bounds (roughly)
        if (cx < -500 || cy < -500 || cx > CONFIG.SECTOR_SIZE + 500 || cy > CONFIG.SECTOR_SIZE + 500) return;

        let text = `X: ${Math.round(cx)}  Y: ${Math.round(cy)}`;
        if (player && player.alive) {
            const dx = cx - player.x;
            const dy = cy - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            text += `  |  ${formatDistance(dist)} from ship`;
        }

        const barH = 18;
        const barY = h - barH;
        ctx.fillStyle = 'rgba(0, 8, 16, 0.7)';
        ctx.fillRect(0, barY, w, barH);
        ctx.fillStyle = 'rgba(0, 180, 255, 0.5)';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, barY + 12);
    }

    // ==========================================
    // LOCAL MAP INTERACTIONS
    // ==========================================

    handleLocalZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const factor = 1 + 0.15 * delta;
        this.localZoom = Math.max(0.05, Math.min(12, this.localZoom * factor));
    }

    handleLocalMouseDown(e) {
        this.isDragging = true;
        this.dragMoved = false;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.localCanvas.style.cursor = 'grabbing';
    }

    handleLocalMouseMove(e) {
        this.mousePos = { x: e.offsetX, y: e.offsetY };

        // Track cursor world position
        if (this.localCanvas) {
            const w = this.localCanvas.width;
            const scale = (this.localZoom * w) / CONFIG.SECTOR_SIZE;
            const ox = w / 2 - this.localPan.x * scale;
            const oy = this.localCanvas.height / 2 - this.localPan.y * scale;
            this.cursorWorld = {
                x: (e.offsetX - ox) / scale,
                y: (e.offsetY - oy) / scale
            };
        }

        if (!this.isDragging) {
            const entity = this.findEntityAtScreenPos(e.offsetX, e.offsetY);
            this.hoveredEntity = entity;
            this.localCanvas.style.cursor = entity ? 'pointer' : 'grab';
            return;
        }

        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.dragMoved = true;

        const scale = (this.localZoom * this.localCanvas.width) / CONFIG.SECTOR_SIZE;
        this.localPan.x -= dx / scale;
        this.localPan.y -= dy / scale;

        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    handleLocalMouseUp() {
        this.isDragging = false;
        this.localCanvas.style.cursor = 'grab';
    }

    handleLocalClick(e) {
        if (this.dragMoved) return;

        const entity = this.findEntityAtScreenPos(e.offsetX, e.offsetY);
        if (entity) {
            this.game.selectTarget(entity);
            this.game.ui?.log(`Selected ${entity.name}`, 'system');
        }
    }

    handleLocalRightClick(e) {
        e.preventDefault();
        const entity = this.findEntityAtScreenPos(e.offsetX, e.offsetY);
        if (entity) {
            this.game.selectTarget(entity);
            this.game.ui?.showContextMenu(e.clientX, e.clientY, entity);
        }
    }

    findEntityAtScreenPos(screenX, screenY) {
        if (!this.localCanvas) return null;

        const w = this.localCanvas.width;
        const h = this.localCanvas.height;
        const scale = (this.localZoom * w) / CONFIG.SECTOR_SIZE;
        const ox = w / 2 - this.localPan.x * scale;
        const oy = h / 2 - this.localPan.y * scale;

        const worldX = (screenX - ox) / scale;
        const worldY = (screenY - oy) / scale;

        const entities = this.game.currentSector?.entities || [];
        const clickRadius = 15 / scale;

        let closest = null;
        let closestDist = Infinity;

        // Prioritize ships over asteroids
        for (const entity of entities) {
            if (!entity.alive || entity.visible === false) continue;

            const dx = entity.x - worldX;
            const dy = entity.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const entityRadius = (entity.radius || 20) + clickRadius;

            // Ships get priority in selection
            const priority = (entity.type === 'asteroid') ? 0.5 : 1.0;

            if (dist < entityRadius && dist * priority < closestDist) {
                closest = entity;
                closestDist = dist * priority;
            }
        }

        return closest;
    }

    hideTooltip() {
        if (this.tooltip) this.tooltip.classList.add('hidden');
        this.hoveredEntity = null;
        this.hoveredSector = null;
    }

    // ==========================================
    // UNIVERSE MAP RENDERING
    // ==========================================

    renderUniverseMap() {
        // 3D renderer handles its own animation loop
        if (this.universeRenderer3D) return;
        if (!this.universeCtx || !this.universeCanvas) return;

        const ctx = this.universeCtx;
        const w = this.universeCanvas.width;
        const h = this.universeCanvas.height;

        // Background with subtle nebula
        ctx.fillStyle = '#000810';
        ctx.fillRect(0, 0, w, h);
        this.drawUniverseBackground(ctx, w, h);

        const layout = UNIVERSE_LAYOUT;
        const sectors = layout.sectors;
        const gates = layout.gates;
        const positions = this.calculateSectorPositions(sectors, w, h);
        const currentSectorId = this.game.currentSector?.id;

        // Draw gate connections with animated flow
        for (const gate of gates) {
            const fromPos = positions[gate.from];
            const toPos = positions[gate.to];
            if (!fromPos || !toPos) continue;

            const isWormhole = gate.wormhole || false;

            // Base line - purple dashed for wormholes, blue solid for normal
            ctx.save();
            if (isWormhole) {
                const whPulse = 0.15 + Math.sin(this.animTime * 2) * 0.1;
                ctx.strokeStyle = `rgba(136, 68, 255, ${whPulse + 0.1})`;
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 6]);
                ctx.lineDashOffset = -this.animTime * 30;
            } else {
                ctx.strokeStyle = 'rgba(0, 180, 255, 0.15)';
                ctx.lineWidth = 2;
            }
            ctx.beginPath();
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.lineTo(toPos.x, toPos.y);
            ctx.stroke();
            ctx.restore();

            // Animated flow dots
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const dotCount = Math.floor(len / 30);

            for (let i = 0; i < dotCount; i++) {
                const t = ((i / dotCount) + this.animTime * (isWormhole ? 0.25 : 0.15)) % 1;
                const px = fromPos.x + dx * t;
                const py = fromPos.y + dy * t;
                const alpha = Math.sin(t * Math.PI) * 0.4;

                if (isWormhole) {
                    ctx.fillStyle = `rgba(170, 100, 255, ${alpha})`;
                } else {
                    ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
                }
                ctx.beginPath();
                ctx.arc(px, py, isWormhole ? 2 : 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Trade route indicators (if commerce system exists)
            const fromIsAdj = gate.from === currentSectorId || gate.to === currentSectorId;
            if (fromIsAdj) {
                ctx.strokeStyle = isWormhole ? 'rgba(170, 100, 255, 0.35)' : 'rgba(0, 200, 255, 0.3)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(fromPos.x, fromPos.y);
                ctx.lineTo(toPos.x, toPos.y);
                ctx.stroke();
            }
        }

        // Draw autopilot route overlay
        const routeInfo = this.game.autopilot?.getRouteInfo();
        if (routeInfo) {
            const routePath = routeInfo.path;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 8;
            ctx.setLineDash([8, 4]);

            for (let i = 0; i < routePath.length - 1; i++) {
                const fromPos = positions[routePath[i]];
                const toPos = positions[routePath[i + 1]];
                if (!fromPos || !toPos) continue;

                // Dim completed segments, bright remaining
                const completed = i < routeInfo.currentIndex;
                ctx.strokeStyle = completed ? 'rgba(255, 200, 0, 0.15)' : 'rgba(255, 200, 0, 0.6)';
                ctx.lineWidth = completed ? 2 : 4;

                ctx.beginPath();
                ctx.moveTo(fromPos.x, fromPos.y);
                ctx.lineTo(toPos.x, toPos.y);
                ctx.stroke();
            }

            // Route destination marker
            const destPos = positions[routePath[routePath.length - 1]];
            if (destPos) {
                ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(destPos.x, destPos.y, 42, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // Draw sectors
        for (const sector of sectors) {
            const pos = positions[sector.id];
            if (!pos) continue;

            const isCurrent = sector.id === currentSectorId;
            const isHovered = this.hoveredSector === sector.id;

            this.drawUniverseSector(ctx, sector, pos, isCurrent, isHovered);
        }

        // Region cluster labels
        this.drawRegionLabels(ctx, sectors, positions);

        // Strategic overlays
        this.renderStrategicOverlays(ctx, sectors, positions);

        // Draw legend
        this.drawUniverseLegend(ctx, w, h);

        // Hovered sector tooltip
        if (this.hoveredSector) {
            this.drawUniverseTooltip(ctx, w, h, positions);
        }
    }

    renderStrategicOverlays(ctx, sectors, positions) {
        const ov = this.strategicOverlays;
        if (ov.faction) this.renderFactionOverlay(ctx, sectors, positions);
        if (ov.trade) this.renderTradeOverlay(ctx, sectors, positions);
        if (ov.threat) this.renderThreatOverlay(ctx, sectors, positions);
        if (ov.resources) this.renderResourcesOverlay(ctx, sectors, positions);
        if (ov.events) this.renderEventsOverlay(ctx, sectors, positions);
    }

    renderFactionOverlay(ctx, sectors, positions) {
        for (const sector of sectors) {
            const pos = positions[sector.id];
            if (!pos) continue;

            if (sector.faction && FACTIONS[sector.faction]) {
                const factionColor = FACTIONS[sector.faction].color;
                ctx.strokeStyle = factionColor;
                ctx.globalAlpha = 0.5;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 42, 0, Math.PI * 2);
                ctx.stroke();

                // Faction nickname label below sector name
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = factionColor;
                ctx.font = '9px "Share Tech Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(FACTIONS[sector.faction].nickname, pos.x, pos.y + 26);
                ctx.globalAlpha = 1;
            } else if (sector.contested) {
                // Contested sectors: yellow pulsing ring
                const pulse = 0.3 + Math.sin(Date.now() / 500) * 0.2;
                ctx.strokeStyle = '#ffdd44';
                ctx.globalAlpha = pulse;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 42, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;
            }
        }
    }

    renderTradeOverlay(ctx, sectors, positions) {
        const volumes = this.game.commerceSystem?.getTradeVolumePerSector();
        if (!volumes) return;
        for (const sector of sectors) {
            const pos = positions[sector.id];
            if (!pos) continue;
            const vol = volumes[sector.id];
            if (!vol || vol.recent <= 0) continue;
            const thickness = Math.min(6, 1 + vol.recent * 0.1);
            ctx.strokeStyle = 'rgba(255, 204, 68, 0.5)';
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 46, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    renderThreatOverlay(ctx, sectors, positions) {
        const reports = this.game.engagementRecorder?.reports;
        if (!reports || reports.length === 0) return;
        const recentCutoff = Date.now() - 600000; // last 10 min
        const counts = {};
        for (const r of reports) {
            if (r.timestamp && r.timestamp < recentCutoff) continue;
            const sid = r.sectorId;
            if (sid) counts[sid] = (counts[sid] || 0) + 1;
        }
        for (const sector of sectors) {
            const pos = positions[sector.id];
            if (!pos) continue;
            const c = counts[sector.id];
            if (!c) continue;
            const alpha = Math.min(0.8, c * 0.2);
            const pulse = 0.7 + 0.3 * Math.sin(this.animTime * 3);
            ctx.strokeStyle = `rgba(255, 68, 68, ${alpha * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 50, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    renderResourcesOverlay(ctx, sectors, positions) {
        const richness = { tutorial: 1, hub: 1, safe: 2, tame: 2, neutral: 3, normal: 3, dangerous: 4, deadly: 5 };
        for (const sector of sectors) {
            const pos = positions[sector.id];
            if (!pos) continue;
            const r = richness[sector.difficulty] || 1;
            const size = 2 + r;
            ctx.fillStyle = `rgba(255, 170, 0, ${0.3 + r * 0.1})`;
            for (let i = 0; i < Math.min(r, 4); i++) {
                const angle = (i / 4) * Math.PI * 2 + this.animTime * 0.3;
                const ox = Math.cos(angle) * 22;
                const oy = Math.sin(angle) * 22;
                ctx.save();
                ctx.translate(pos.x + ox, pos.y + oy);
                ctx.rotate(Math.PI / 4);
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.restore();
            }
        }
    }

    renderEventsOverlay(ctx, sectors, positions) {
        const events = this.game.sectorEventSystem?.getAllActiveEvents?.();
        if (!events || events.length === 0) return;
        const eventColors = {
            pirate_capital_invasion: '#ff4444', wormhole_opening: '#8844ff',
            trade_embargo: '#ffaa00', radiation_storm: '#ff6600', mining_rush: '#44ff88'
        };
        for (const evt of events) {
            const pos = positions[evt.sectorId];
            if (!pos) continue;
            const color = eventColors[evt.type] || '#ffcc44';
            ctx.save();
            ctx.translate(pos.x, pos.y - 32);
            ctx.rotate(this.animTime * 2);
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
                const r = i % 2 === 0 ? 6 : 3;
                if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    drawUniverseBackground(ctx, w, h) {
        // Subtle nebula clouds
        for (let i = 0; i < 3; i++) {
            const cx = (i * 0.4 + 0.2) * w;
            const cy = (Math.sin(i * 2.3) * 0.3 + 0.5) * h;
            const r = 200;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            const colors = ['#110022', '#001122', '#002200'];
            grad.addColorStop(0, colors[i] + '44');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        // Background stars
        const rng = (i) => {
            const x = Math.sin(i * 127.1 + 47.3) * 43758.5453;
            return x - Math.floor(x);
        };
        ctx.fillStyle = 'rgba(150, 180, 220, 0.4)';
        for (let i = 0; i < 100; i++) {
            ctx.beginPath();
            ctx.arc(rng(i) * w, rng(i + 200) * h, rng(i + 400) * 1.2 + 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawUniverseSector(ctx, sector, pos, isCurrent, isHovered) {
        const baseRadius = 30;
        const radius = isCurrent ? baseRadius + 8 : (isHovered ? baseRadius + 4 : baseRadius);
        const diffColor = this.getDifficultyColor(sector.difficulty);
        const pulse = Math.sin(this.animTime * 2) * 0.15 + 0.85;

        // Outer glow for current
        if (isCurrent) {
            const grad = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, radius + 20);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.15)');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius + 20, 0, Math.PI * 2);
            ctx.fill();
        }

        // Main circle - gradient fill
        const grad = ctx.createRadialGradient(
            pos.x - radius * 0.2, pos.y - radius * 0.2, 0,
            pos.x, pos.y, radius
        );
        if (isCurrent) {
            grad.addColorStop(0, '#44ffff');
            grad.addColorStop(1, '#008888');
        } else {
            grad.addColorStop(0, diffColor);
            grad.addColorStop(1, this.darkenColor(diffColor, 0.4));
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Ring
        ctx.strokeStyle = isCurrent ? `rgba(0, 255, 255, ${pulse})` : 'rgba(100, 180, 220, 0.4)';
        ctx.lineWidth = isCurrent ? 3 : (isHovered ? 2 : 1);
        ctx.stroke();

        // Station icon
        if (sector.hasStation) {
            ctx.fillStyle = '#00ff66';
            ctx.beginPath();
            const sx = pos.x + radius * 0.6;
            const sy = pos.y - radius * 0.6;
            ctx.moveTo(sx, sy - 5);
            ctx.lineTo(sx + 4, sy);
            ctx.lineTo(sx, sy + 5);
            ctx.lineTo(sx - 4, sy);
            ctx.closePath();
            ctx.fill();
        }

        // Ship count badge
        const guildSys = this.game.guildEconomySystem;
        if (guildSys) {
            let shipCount = 0;
            for (const faction of Object.values(guildSys.factions || {})) {
                for (const ship of Object.values(faction.ships || {})) {
                    if (ship.currentSector === sector.id) shipCount++;
                }
            }
            if (shipCount > 0) {
                ctx.fillStyle = 'rgba(0, 30, 60, 0.8)';
                ctx.beginPath();
                ctx.arc(pos.x + radius * 0.7, pos.y + radius * 0.5, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#aaccff';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(shipCount, pos.x + radius * 0.7, pos.y + radius * 0.5 + 3);
            }
        }

        // Sector name
        ctx.fillStyle = isCurrent ? '#002222' : '#ffffff';
        ctx.font = isCurrent ? 'bold 11px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        const displayName = sector.name.length > 14 ? sector.name.substring(0, 12) + '..' : sector.name;
        ctx.fillText(displayName, pos.x, pos.y + 4);

        // Difficulty label
        ctx.fillStyle = isCurrent ? '#005555' : 'rgba(150, 180, 200, 0.6)';
        ctx.font = '12px monospace';
        ctx.fillText(sector.difficulty.toUpperCase(), pos.x, pos.y + radius + 14);
    }

    drawUniverseTooltip(ctx, w, h, positions) {
        const sectorId = this.hoveredSector;
        const sector = UNIVERSE_LAYOUT.sectors.find(s => s.id === sectorId);
        if (!sector) return;

        const pos = positions[sectorId];
        if (!pos) return;

        const lines = [sector.name];
        lines.push(`Security: ${sector.difficulty}`);

        // Station specialty
        const station = this.game.universe?.getSector(sectorId)?.getStation?.();
        if (station?.specialty) {
            lines.push(`Specialty: ${station.specialty}`);
        }

        // Enemy count from config
        const diffConfig = CONFIG.SECTOR_DIFFICULTY[sector.difficulty];
        if (diffConfig) {
            lines.push(`Hostiles: ~${diffConfig.enemyCount}`);
        }

        // Guild ships in sector
        const guildSys = this.game.guildEconomySystem;
        if (guildSys) {
            let ships = 0;
            for (const faction of Object.values(guildSys.factions || {})) {
                for (const ship of Object.values(faction.ships || {})) {
                    if (ship.currentSector === sectorId) ships++;
                }
            }
            if (ships > 0) lines.push(`Guild ships: ${ships}`);
        }

        // Draw tooltip
        ctx.font = '12px monospace';
        const padding = 8;
        const lineH = 15;
        const tooltipW = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2 + 10;
        const tooltipH = lines.length * lineH + padding * 2;

        let tx = pos.x + 45;
        let ty = pos.y - tooltipH / 2;
        if (tx + tooltipW > w) tx = pos.x - tooltipW - 45;
        if (ty < 5) ty = 5;
        if (ty + tooltipH > h) ty = h - tooltipH - 5;

        ctx.fillStyle = 'rgba(0, 10, 25, 0.92)';
        ctx.strokeStyle = 'rgba(0, 180, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tooltipW, tooltipH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillStyle = i === 0 ? '#ffffff' : '#99aabb';
            ctx.fillText(lines[i], tx + padding, ty + padding + (i + 1) * lineH - 3);
        }
    }

    drawRegionLabels(ctx, sectors, positions) {
        // Group sectors by region
        const regions = {};
        for (const sector of sectors) {
            const region = sector.region || 'core';
            if (!regions[region]) regions[region] = [];
            const pos = positions[sector.id];
            if (pos) regions[region].push(pos);
        }

        ctx.font = '11px monospace';
        ctx.textAlign = 'center';

        for (const [region, posList] of Object.entries(regions)) {
            if (posList.length === 0) continue;
            // Find bounding center of region
            let cx = 0, cy = 0;
            for (const p of posList) { cx += p.x; cy += p.y; }
            cx /= posList.length;
            cy /= posList.length;

            // Find top of region (min y)
            let minY = Infinity;
            for (const p of posList) { if (p.y < minY) minY = p.y; }

            const label = region === 'milkyway' ? 'MILKY WAY' : 'CORE SECTORS';
            const labelY = minY - 48;

            ctx.fillStyle = region === 'milkyway' ? 'rgba(136, 68, 255, 0.5)' : 'rgba(0, 180, 255, 0.5)';
            ctx.fillText(label, cx, labelY);

            // Subtle bracket underline
            const labelW = ctx.measureText(label).width;
            ctx.strokeStyle = region === 'milkyway' ? 'rgba(136, 68, 255, 0.2)' : 'rgba(0, 180, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - labelW / 2, labelY + 4);
            ctx.lineTo(cx + labelW / 2, labelY + 4);
            ctx.stroke();
        }
    }

    calculateSectorPositions(sectors, w, h) {
        const positions = {};
        const padding = 70;

        // Calculate grid bounds dynamically
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const sector of sectors) {
            if (sector.x < minX) minX = sector.x;
            if (sector.x > maxX) maxX = sector.x;
            if (sector.y < minY) minY = sector.y;
            if (sector.y > maxY) maxY = sector.y;
        }
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const centerGridX = (minX + maxX) / 2;
        const centerGridY = (minY + maxY) / 2;

        const centerX = w / 2;
        const centerY = h / 2;
        const spreadX = (w - padding * 2) / rangeX;
        const spreadY = (h - padding * 2) / rangeY;

        for (const sector of sectors) {
            positions[sector.id] = {
                x: centerX + (sector.x - centerGridX) * spreadX,
                y: centerY + (sector.y - centerGridY) * spreadY,
            };
        }
        return positions;
    }

    getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 'tutorial': return '#44ffaa';
            case 'hub': return '#22dd44';
            case 'safe': return '#44ee55';
            case 'tame': return '#88ddaa';
            case 'neutral': return '#ddaa44';
            case 'normal': return '#ddcc22';
            case 'dangerous': return '#ee8822';
            case 'deadly': return '#ee2222';
            default: return '#888888';
        }
    }

    drawUniverseLegend(ctx, w, h) {
        const items = [
            { color: '#22dd44', label: 'Hub' },
            { color: '#44ee55', label: 'Safe' },
            { color: '#88ddaa', label: 'Tame' },
            { color: '#ddaa44', label: 'Neutral' },
            { color: '#ddcc22', label: 'Normal' },
            { color: '#ee8822', label: 'Danger' },
            { color: '#ee2222', label: 'Deadly' },
        ];

        const legendX = 15;
        const legendY = h - 55;

        ctx.fillStyle = 'rgba(0, 10, 20, 0.6)';
        ctx.fillRect(legendX - 5, legendY - 5, 390, 45);

        ctx.font = '11px monospace';
        let x = legendX;
        for (const item of items) {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x + 5, legendY + 10, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#889999';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, x + 14, legendY + 14);
            x += 55;
        }

        ctx.fillStyle = '#556677';
        ctx.textAlign = 'left';
        ctx.fillText('Click a sector to select its wormhole | Hover for details', legendX, legendY + 32);
    }

    // ==========================================
    // UNIVERSE MAP INTERACTIONS
    // ==========================================

    handleUniverseClick(e) {
        const sectorId = this.findSectorAtPos(e.offsetX, e.offsetY);
        if (!sectorId) return;

        if (sectorId === this.game.currentSector?.id) {
            this.game.ui?.log('Already in this sector', 'system');
            return;
        }

        // Direct gate for adjacent sectors
        const gate = this.findGateToSector(sectorId);
        if (gate) {
            this.game.selectTarget(gate);
            this.game.ui?.log(`Selected Elder Wormhole to ${sectorId}. Press S to warp.`, 'system');
            this.hide();
        } else {
            // Multi-sector route for non-adjacent sectors
            this.game.autopilot?.planRoute(sectorId);
            this.hide();
        }
    }

    handleUniverseHover(e) {
        const sectorId = this.findSectorAtPos(e.offsetX, e.offsetY);
        this.hoveredSector = sectorId;
        this.universeCanvas.style.cursor = sectorId ? 'pointer' : 'default';
    }

    findSectorAtPos(screenX, screenY) {
        const w = this.universeCanvas.width;
        const h = this.universeCanvas.height;
        const positions = this.calculateSectorPositions(UNIVERSE_LAYOUT.sectors, w, h);

        for (const [sectorId, pos] of Object.entries(positions)) {
            const dx = screenX - pos.x;
            const dy = screenY - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < 38) return sectorId;
        }
        return null;
    }

    findGateToSector(targetSectorId) {
        const currentSectorId = this.game.currentSector?.id;
        const gates = UNIVERSE_LAYOUT.gates;

        const hasConnection = gates.some(g =>
            (g.from === currentSectorId && g.to === targetSectorId) ||
            (g.to === currentSectorId && g.from === targetSectorId)
        );
        if (!hasConnection) return null;

        const entities = this.game.currentSector?.entities || [];
        return entities.find(e =>
            e.type === 'gate' &&
            e.destinationSectorId === targetSectorId
        );
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    darkenColor(hex, factor) {
        const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
        const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
        const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }

    getAsteroidColor(asteroid) {
        const oreType = asteroid.oreType || 'veldspar';
        const config = CONFIG.ASTEROID_TYPES[oreType];
        if (!config) return '#888888';
        const color = config.color;
        if (typeof color === 'number') return `#${color.toString(16).padStart(6, '0')}`;
        return color;
    }
}
