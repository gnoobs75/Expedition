// =============================================
// Sector Map Manager
// Handles full-screen map with Local and Universe tabs
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { formatDistance } from '../utils/math.js';

export class SectorMapManager {
    constructor(game) {
        this.game = game;

        // DOM elements
        this.modal = null;
        this.localCanvas = null;
        this.universeCanvas = null;
        this.localCtx = null;
        this.universeCtx = null;

        // Local map state
        this.localZoom = 1.0;
        this.localPan = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };

        // State
        this.visible = false;
        this.activeTab = 'local';
        this.animationId = null;

        // Hover states
        this.hoveredEntity = null;
        this.hoveredSector = null;

        // Flag to prevent duplicate control button listeners
        this.controlsInitialized = false;

        // Cache DOM elements
        this.cacheElements();

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Cache DOM element references
     */
    cacheElements() {
        this.modal = document.getElementById('sector-map-modal');
        this.localCanvas = document.getElementById('local-map-canvas');
        this.universeCanvas = document.getElementById('universe-map-canvas');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        const closeBtn = document.getElementById('sector-map-close');
        closeBtn?.addEventListener('click', () => this.hide());

        // Tab buttons
        this.modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active tab button
                this.modal.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show corresponding tab content
                this.modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const tabId = `map-tab-${btn.dataset.tab}`;
                document.getElementById(tabId)?.classList.add('active');

                this.activeTab = btn.dataset.tab;
                this.render();
                this.game.audio?.play('click');
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.visible) {
                e.stopPropagation();
                this.hide();
            }
        });

        // Setup canvas interactions after modal is shown
    }

    /**
     * Initialize canvas contexts and interactions
     */
    initCanvases() {
        // Local map canvas - only setup once
        if (this.localCanvas && !this.localCtx) {
            this.localCanvas.width = this.localCanvas.parentElement?.clientWidth || 800;
            this.localCanvas.height = this.localCanvas.parentElement?.clientHeight || 500;
            this.localCtx = this.localCanvas.getContext('2d');

            // Local map interactions
            this.localCanvas.addEventListener('wheel', (e) => this.handleLocalZoom(e));
            this.localCanvas.addEventListener('mousedown', (e) => this.handleLocalMouseDown(e));
            this.localCanvas.addEventListener('mousemove', (e) => this.handleLocalMouseMove(e));
            this.localCanvas.addEventListener('mouseup', () => this.handleLocalMouseUp());
            this.localCanvas.addEventListener('mouseleave', () => this.handleLocalMouseUp());
            this.localCanvas.addEventListener('click', (e) => this.handleLocalClick(e));
            this.localCanvas.addEventListener('contextmenu', (e) => this.handleLocalRightClick(e));
        }

        // Universe map canvas - only setup once
        if (this.universeCanvas && !this.universeCtx) {
            this.universeCanvas.width = this.universeCanvas.parentElement?.clientWidth || 800;
            this.universeCanvas.height = this.universeCanvas.parentElement?.clientHeight || 500;
            this.universeCtx = this.universeCanvas.getContext('2d');

            // Universe map interactions
            this.universeCanvas.addEventListener('click', (e) => this.handleUniverseClick(e));
            this.universeCanvas.addEventListener('mousemove', (e) => this.handleUniverseHover(e));
        }

        // Zoom controls - only setup once
        if (!this.controlsInitialized) {
            this.controlsInitialized = true;
            document.getElementById('local-zoom-in')?.addEventListener('click', () => {
                this.localZoom = Math.min(5.0, this.localZoom * 1.5);
                this.renderLocalMap();
            });
            document.getElementById('local-zoom-out')?.addEventListener('click', () => {
                this.localZoom = Math.max(0.2, this.localZoom / 1.5);
                this.renderLocalMap();
            });
            document.getElementById('local-center')?.addEventListener('click', () => {
                this.centerOnPlayer();
                this.renderLocalMap();
            });
        }
    }

    /**
     * Show the sector map
     */
    show() {
        if (!this.modal) return;

        this.modal.classList.remove('hidden');
        this.visible = true;

        // Initialize canvases on first show
        if (!this.localCtx || !this.universeCtx) {
            // Small delay to allow modal to render
            setTimeout(() => {
                this.initCanvases();
                this.centerOnPlayer();
                this.render();
                this.startAnimation();
            }, 50);
        } else {
            this.centerOnPlayer();
            this.render();
            this.startAnimation();
        }

        this.game.audio?.play('click');
    }

    /**
     * Hide the sector map
     */
    hide() {
        if (!this.modal) return;

        this.modal.classList.add('hidden');
        this.visible = false;
        this.stopAnimation();
    }

    /**
     * Toggle map visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Start animation loop
     */
    startAnimation() {
        if (this.animationId) return;

        const animate = () => {
            if (!this.visible) {
                this.animationId = null;
                return;
            }

            this.render();
            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Render the active tab
     */
    render() {
        if (this.activeTab === 'local') {
            this.renderLocalMap();
        } else {
            this.renderUniverseMap();
        }
    }

    /**
     * Center the local map on player
     */
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

    /**
     * Render the local sector map
     */
    renderLocalMap() {
        if (!this.localCtx || !this.localCanvas) return;

        const ctx = this.localCtx;
        const width = this.localCanvas.width;
        const height = this.localCanvas.height;
        const player = this.game.player;
        const sector = this.game.currentSector;

        // Clear canvas
        ctx.fillStyle = '#000a14';
        ctx.fillRect(0, 0, width, height);

        if (!sector) return;

        // Calculate transform
        const scale = (this.localZoom * width) / CONFIG.SECTOR_SIZE;
        const offsetX = width / 2 - this.localPan.x * scale;
        const offsetY = height / 2 - this.localPan.y * scale;

        // Draw grid
        this.drawLocalGrid(ctx, width, height, scale, offsetX, offsetY);

        // Draw sector boundary
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, CONFIG.SECTOR_SIZE * scale, CONFIG.SECTOR_SIZE * scale);

        // Draw entities
        const entities = sector.entities || [];
        for (const entity of entities) {
            if (!entity.alive || !entity.visible) continue;

            const screenX = entity.x * scale + offsetX;
            const screenY = entity.y * scale + offsetY;
            const radius = Math.max(4, (entity.radius || 10) * scale * 0.5);

            // Determine color based on type
            let color = '#888888';
            if (entity.type === 'station') color = '#00ff00';
            else if (entity.type === 'warpgate') color = '#00aaff';
            else if (entity.type === 'asteroid') color = this.getAsteroidColor(entity);
            else if (entity.type === 'enemy') color = '#ff4444';
            else if (entity.type === 'planet') color = '#6644aa';

            // Draw entity
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Highlight if selected
            if (entity === this.game.selectedTarget) {
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Draw label for large entities
            if (entity.type === 'station' || entity.type === 'warpgate' || entity === this.hoveredEntity) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(entity.name, screenX, screenY - radius - 5);
            }
        }

        // Draw player
        if (player && player.alive) {
            const screenX = player.x * scale + offsetX;
            const screenY = player.y * scale + offsetY;
            const radius = 8;

            // Player triangle
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            const angle = player.rotation;
            ctx.moveTo(
                screenX + Math.cos(angle) * radius * 1.5,
                screenY + Math.sin(angle) * radius * 1.5
            );
            ctx.lineTo(
                screenX + Math.cos(angle + 2.5) * radius,
                screenY + Math.sin(angle + 2.5) * radius
            );
            ctx.lineTo(
                screenX + Math.cos(angle - 2.5) * radius,
                screenY + Math.sin(angle - 2.5) * radius
            );
            ctx.closePath();
            ctx.fill();

            // Player glow
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw info overlay
        this.drawLocalInfo(ctx, width, height);
    }

    /**
     * Draw grid on local map
     */
    drawLocalGrid(ctx, width, height, scale, offsetX, offsetY) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        const gridSize = 1000; // 1km grid
        const gridScale = gridSize * scale;

        // Vertical lines
        for (let x = 0; x < CONFIG.SECTOR_SIZE; x += gridSize) {
            const screenX = x * scale + offsetX;
            if (screenX >= 0 && screenX <= width) {
                ctx.beginPath();
                ctx.moveTo(screenX, Math.max(0, offsetY));
                ctx.lineTo(screenX, Math.min(height, offsetY + CONFIG.SECTOR_SIZE * scale));
                ctx.stroke();
            }
        }

        // Horizontal lines
        for (let y = 0; y < CONFIG.SECTOR_SIZE; y += gridSize) {
            const screenY = y * scale + offsetY;
            if (screenY >= 0 && screenY <= height) {
                ctx.beginPath();
                ctx.moveTo(Math.max(0, offsetX), screenY);
                ctx.lineTo(Math.min(width, offsetX + CONFIG.SECTOR_SIZE * scale), screenY);
                ctx.stroke();
            }
        }
    }

    /**
     * Draw info overlay on local map
     */
    drawLocalInfo(ctx, width, height) {
        // Sector name
        ctx.fillStyle = '#00ffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.game.currentSector?.name || 'Unknown Sector', 15, 25);

        // Zoom level
        ctx.fillStyle = '#888888';
        ctx.font = '11px monospace';
        ctx.fillText(`Zoom: ${(this.localZoom * 100).toFixed(0)}%`, 15, 45);

        // Entity count
        const entities = this.game.currentSector?.entities || [];
        ctx.fillText(`Entities: ${entities.filter(e => e.alive).length}`, 15, 60);

        // Instructions
        ctx.textAlign = 'right';
        ctx.fillText('Click to select | Right-click for menu | Scroll to zoom | Drag to pan', width - 15, height - 15);
    }

    /**
     * Get asteroid color
     */
    getAsteroidColor(asteroid) {
        const oreType = asteroid.oreType || 'veldspar';
        const config = CONFIG.ASTEROID_TYPES[oreType];
        if (!config) return '#888888';

        // Convert hex number to CSS color
        const color = config.color;
        if (typeof color === 'number') {
            return `#${color.toString(16).padStart(6, '0')}`;
        }
        return color;
    }

    // ==========================================
    // LOCAL MAP INTERACTIONS
    // ==========================================

    handleLocalZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const factor = 1 + 0.2 * delta;
        this.localZoom = Math.max(0.1, Math.min(10, this.localZoom * factor));
    }

    handleLocalMouseDown(e) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.localCanvas.style.cursor = 'grabbing';
    }

    handleLocalMouseMove(e) {
        if (!this.isDragging) {
            // Handle hover
            const entity = this.findEntityAtScreenPos(e.offsetX, e.offsetY);
            this.hoveredEntity = entity;
            this.localCanvas.style.cursor = entity ? 'pointer' : 'grab';
            return;
        }

        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;

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
        if (this.isDragging) return;

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
            // Position context menu
            this.game.ui?.showContextMenu(e.clientX, e.clientY, entity);
        }
    }

    findEntityAtScreenPos(screenX, screenY) {
        if (!this.localCanvas) return null;

        const width = this.localCanvas.width;
        const height = this.localCanvas.height;
        const scale = (this.localZoom * width) / CONFIG.SECTOR_SIZE;
        const offsetX = width / 2 - this.localPan.x * scale;
        const offsetY = height / 2 - this.localPan.y * scale;

        // Convert screen to world
        const worldX = (screenX - offsetX) / scale;
        const worldY = (screenY - offsetY) / scale;

        const entities = this.game.currentSector?.entities || [];
        const clickRadius = 20 / scale;

        let closest = null;
        let closestDist = Infinity;

        for (const entity of entities) {
            if (!entity.alive || !entity.visible) continue;

            const dx = entity.x - worldX;
            const dy = entity.y - worldY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const entityRadius = (entity.radius || 20) + clickRadius;

            if (dist < entityRadius && dist < closestDist) {
                closest = entity;
                closestDist = dist;
            }
        }

        return closest;
    }

    // ==========================================
    // UNIVERSE MAP RENDERING
    // ==========================================

    /**
     * Render the universe map
     */
    renderUniverseMap() {
        if (!this.universeCtx || !this.universeCanvas) return;

        const ctx = this.universeCtx;
        const width = this.universeCanvas.width;
        const height = this.universeCanvas.height;

        // Clear canvas
        ctx.fillStyle = '#000a14';
        ctx.fillRect(0, 0, width, height);

        const layout = UNIVERSE_LAYOUT;
        const sectors = layout.sectors;
        const gates = layout.gates;

        // Calculate layout bounds and scale
        const positions = this.calculateSectorPositions(sectors, width, height);

        // Draw gate connections first
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        for (const gate of gates) {
            const fromPos = positions[gate.from];
            const toPos = positions[gate.to];
            if (fromPos && toPos) {
                ctx.beginPath();
                ctx.moveTo(fromPos.x, fromPos.y);
                ctx.lineTo(toPos.x, toPos.y);
                ctx.stroke();
            }
        }

        // Draw sectors
        const currentSectorId = this.game.currentSector?.id;

        for (const sector of sectors) {
            const pos = positions[sector.id];
            if (!pos) continue;

            const isCurrent = sector.id === currentSectorId;
            const isHovered = this.hoveredSector === sector.id;
            const radius = isCurrent ? 35 : (isHovered ? 32 : 28);

            // Sector circle
            const difficultyColor = this.getDifficultyColor(sector.difficulty);
            ctx.fillStyle = isCurrent ? '#00ffff' : difficultyColor;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Outer ring
            ctx.strokeStyle = isCurrent ? '#00ffff' : 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = isCurrent ? 3 : 2;
            ctx.stroke();

            // Station indicator
            if (sector.hasStation) {
                ctx.fillStyle = '#00ff00';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y - radius - 8, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Sector name
            ctx.fillStyle = isCurrent ? '#000000' : '#ffffff';
            ctx.font = isCurrent ? 'bold 11px monospace' : '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sector.name.substring(0, 12), pos.x, pos.y + 4);

            // Difficulty label below
            ctx.fillStyle = '#888888';
            ctx.font = '9px monospace';
            ctx.fillText(sector.difficulty.toUpperCase(), pos.x, pos.y + radius + 15);
        }

        // Draw legend
        this.drawUniverseLegend(ctx, width, height);
    }

    /**
     * Calculate screen positions for sectors
     */
    calculateSectorPositions(sectors, width, height) {
        const positions = {};
        const padding = 80;
        const centerX = width / 2;
        const centerY = height / 2;
        const spreadX = (width - padding * 2) / 3;
        const spreadY = (height - padding * 2) / 3;

        for (const sector of sectors) {
            positions[sector.id] = {
                x: centerX + sector.x * spreadX,
                y: centerY + sector.y * spreadY,
            };
        }

        return positions;
    }

    /**
     * Get color based on difficulty
     */
    getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 'hub': return '#00ff00';
            case 'safe': return '#44ff44';
            case 'normal': return '#ffff00';
            case 'dangerous': return '#ff8800';
            case 'deadly': return '#ff0000';
            default: return '#888888';
        }
    }

    /**
     * Draw universe map legend
     */
    drawUniverseLegend(ctx, width, height) {
        const legendY = height - 80;
        const startX = 20;

        ctx.font = '10px monospace';

        const items = [
            { color: '#00ff00', label: 'Hub' },
            { color: '#44ff44', label: 'Safe' },
            { color: '#ffff00', label: 'Normal' },
            { color: '#ff8800', label: 'Dangerous' },
            { color: '#ff0000', label: 'Deadly' },
        ];

        let x = startX;
        for (const item of items) {
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x, legendY, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#888888';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, x + 12, legendY + 4);

            x += 80;
        }

        // Station indicator
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(x, legendY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#888888';
        ctx.fillText('= Station', x + 12, legendY + 4);

        // Instructions
        ctx.textAlign = 'right';
        ctx.fillText('Click a sector to warp to its gate', width - 15, height - 15);
    }

    // ==========================================
    // UNIVERSE MAP INTERACTIONS
    // ==========================================

    handleUniverseClick(e) {
        const sectorId = this.findSectorAtPos(e.offsetX, e.offsetY);
        if (!sectorId) return;

        // Don't warp to current sector
        if (sectorId === this.game.currentSector?.id) {
            this.game.ui?.log('Already in this sector', 'system');
            return;
        }

        // Find the gate that leads to this sector (or a connected sector leading there)
        const gate = this.findGateToSector(sectorId);
        if (gate) {
            this.game.selectTarget(gate);
            this.game.ui?.log(`Selected gate to ${sectorId}. Press S to warp.`, 'system');
            this.hide();
        } else {
            this.game.ui?.log('No direct gate connection to that sector', 'system');
        }
    }

    handleUniverseHover(e) {
        const sectorId = this.findSectorAtPos(e.offsetX, e.offsetY);
        this.hoveredSector = sectorId;
        this.universeCanvas.style.cursor = sectorId ? 'pointer' : 'default';
    }

    findSectorAtPos(screenX, screenY) {
        const width = this.universeCanvas.width;
        const height = this.universeCanvas.height;
        const positions = this.calculateSectorPositions(UNIVERSE_LAYOUT.sectors, width, height);

        for (const [sectorId, pos] of Object.entries(positions)) {
            const dx = screenX - pos.x;
            const dy = screenY - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 35) {
                return sectorId;
            }
        }

        return null;
    }

    findGateToSector(targetSectorId) {
        const currentSectorId = this.game.currentSector?.id;
        const gates = UNIVERSE_LAYOUT.gates;

        // Check if there's a direct gate connection
        const hasConnection = gates.some(g =>
            (g.from === currentSectorId && g.to === targetSectorId) ||
            (g.to === currentSectorId && g.from === targetSectorId)
        );

        if (!hasConnection) return null;

        // Find the gate entity in current sector
        const entities = this.game.currentSector?.entities || [];
        return entities.find(e =>
            e.type === 'warpgate' &&
            (e.destination === targetSectorId || e.targetSector === targetSectorId)
        );
    }
}
