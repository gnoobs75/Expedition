// =============================================
// Tactical Replay Viewer
// 2D canvas replay of combat engagements from AAR data
// =============================================

export class TacticalReplay {
    constructor(game) {
        this.game = game;
        this.report = null;
        this.modal = null;
        this.canvas = null;
        this.ctx = null;

        // Playback state
        this.playing = false;
        this.playbackTime = 0;
        this.playbackSpeed = 1;
        this.currentSnapIndex = 0;
        this.animFrame = null;
        this.lastFrameTime = 0;

        // Trail history per entity
        this.trails = {};

        // Weapon flash events (from damage log)
        this.weaponFlashes = [];

        // View state
        this.width = 400;
        this.height = 300;
    }

    /**
     * Show the tactical replay modal for a report
     */
    show(report) {
        this.report = report;
        if (!report || !report.snapshots || report.snapshots.length === 0) return;

        this.playbackTime = 0;
        this.currentSnapIndex = 0;
        this.playing = false;
        this.playbackSpeed = 1;
        this.trails = {};
        this.prepareWeaponFlashes();

        this.createModal();
        this.drawFrame();
    }

    /**
     * Pre-process damage log into timed weapon flash events
     */
    prepareWeaponFlashes() {
        this.weaponFlashes = [];
        if (!this.report?.damageLog) return;

        for (const entry of this.report.damageLog) {
            if (entry.type === 'destroyed') continue;
            this.weaponFlashes.push({
                t: entry.t,
                src: entry.src,
                tgt: entry.tgt,
                dmg: entry.dmg,
                type: entry.type,
            });
        }
    }

    /**
     * Create the replay modal UI
     */
    createModal() {
        // Remove existing
        this.destroy();

        this.modal = document.createElement('div');
        this.modal.className = 'tactical-replay-modal';
        this.modal.innerHTML = `
            <div class="tactical-replay-container">
                <div class="tactical-replay-header">
                    <span class="tactical-replay-title">TACTICAL REPLAY</span>
                    <span class="tactical-replay-stardate">SD ${this.report.stardate} - ${this.report.sectorName}</span>
                    <button class="tactical-replay-close">&times;</button>
                </div>
                <canvas class="tactical-replay-canvas" width="${this.width}" height="${this.height}"></canvas>
                <div class="tactical-replay-controls">
                    <button class="replay-btn replay-play-btn">&#9654;</button>
                    <input type="range" class="replay-scrubber" min="0" max="100" value="0">
                    <span class="replay-time">0.0s / ${this.report.duration}s</span>
                    <button class="replay-btn replay-speed-btn">1x</button>
                </div>
                <div class="tactical-replay-legend"></div>
            </div>
        `;

        document.body.appendChild(this.modal);

        this.canvas = this.modal.querySelector('.tactical-replay-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Controls
        const playBtn = this.modal.querySelector('.replay-play-btn');
        const scrubber = this.modal.querySelector('.replay-scrubber');
        const speedBtn = this.modal.querySelector('.replay-speed-btn');
        const closeBtn = this.modal.querySelector('.tactical-replay-close');

        playBtn.addEventListener('click', () => this.togglePlay());
        speedBtn.addEventListener('click', () => this.cycleSpeed());
        closeBtn.addEventListener('click', () => this.destroy());

        scrubber.addEventListener('input', () => {
            const pct = parseFloat(scrubber.value) / 100;
            this.playbackTime = pct * this.report.duration;
            this.currentSnapIndex = this.findSnapIndex(this.playbackTime);
            this.trails = {};
            // Rebuild trails up to current time
            this.rebuildTrails();
            this.drawFrame();
        });

        // Build legend
        this.buildLegend();

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.destroy();
        });
    }

    /**
     * Build faction color legend
     */
    buildLegend() {
        const legendEl = this.modal.querySelector('.tactical-replay-legend');
        if (!legendEl) return;

        let html = '';
        for (const [name, faction] of Object.entries(this.report.factions)) {
            const color = this.getFactionColor(name, faction.isPlayerFaction);
            html += `<span class="replay-legend-item"><span class="replay-legend-dot" style="background:${color}"></span>${name}</span>`;
        }
        legendEl.innerHTML = html;
    }

    /**
     * Get color for a faction
     */
    getFactionColor(factionName, isPlayer) {
        if (isPlayer) return '#00ccff';
        // Hash faction name to a consistent warm color
        const colors = ['#ff4444', '#ff8844', '#ffcc44', '#ff44aa', '#cc44ff'];
        let hash = 0;
        for (let i = 0; i < factionName.length; i++) {
            hash = ((hash << 5) - hash) + factionName.charCodeAt(i);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Find the snapshot index for a given time
     */
    findSnapIndex(time) {
        const snaps = this.report.snapshots;
        for (let i = snaps.length - 1; i >= 0; i--) {
            if (snaps[i].t <= time) return i;
        }
        return 0;
    }

    /**
     * Rebuild trail history up to current playback time
     */
    rebuildTrails() {
        this.trails = {};
        const bounds = this.calculateBounds();
        const snaps = this.report.snapshots;

        for (let i = 0; i <= this.currentSnapIndex; i++) {
            const snap = snaps[i];
            for (const ent of snap.entities) {
                if (!this.trails[ent.id]) this.trails[ent.id] = [];
                const sx = this.worldToCanvasX(ent.x, bounds);
                const sy = this.worldToCanvasY(ent.y, bounds);
                this.trails[ent.id].push({ x: sx, y: sy, alive: ent.alive });
            }
        }
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        this.playing = !this.playing;
        const btn = this.modal?.querySelector('.replay-play-btn');
        if (btn) btn.textContent = this.playing ? '\u23F8' : '\u25B6';

        if (this.playing) {
            this.lastFrameTime = performance.now();
            this.animate();
        } else {
            if (this.animFrame) {
                cancelAnimationFrame(this.animFrame);
                this.animFrame = null;
            }
        }
    }

    /**
     * Cycle playback speed: 1x -> 2x -> 4x -> 0.5x -> 1x
     */
    cycleSpeed() {
        const speeds = [1, 2, 4, 0.5];
        const idx = speeds.indexOf(this.playbackSpeed);
        this.playbackSpeed = speeds[(idx + 1) % speeds.length];
        const btn = this.modal?.querySelector('.replay-speed-btn');
        if (btn) btn.textContent = this.playbackSpeed + 'x';
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.playing || !this.report) return;

        const now = performance.now();
        const realDt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        this.playbackTime += realDt * this.playbackSpeed;

        if (this.playbackTime >= this.report.duration) {
            this.playbackTime = this.report.duration;
            this.playing = false;
            const btn = this.modal?.querySelector('.replay-play-btn');
            if (btn) btn.textContent = '\u25B6';
        }

        this.currentSnapIndex = this.findSnapIndex(this.playbackTime);

        // Update scrubber
        const scrubber = this.modal?.querySelector('.replay-scrubber');
        if (scrubber) {
            scrubber.value = (this.playbackTime / this.report.duration * 100).toFixed(1);
        }

        // Update time display
        const timeEl = this.modal?.querySelector('.replay-time');
        if (timeEl) {
            timeEl.textContent = `${this.playbackTime.toFixed(1)}s / ${this.report.duration}s`;
        }

        this.drawFrame();

        if (this.playing) {
            this.animFrame = requestAnimationFrame(() => this.animate());
        }
    }

    /**
     * Calculate world-space bounding box from all snapshots
     */
    calculateBounds() {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        for (const snap of this.report.snapshots) {
            for (const ent of snap.entities) {
                if (ent.x < minX) minX = ent.x;
                if (ent.x > maxX) maxX = ent.x;
                if (ent.y < minY) minY = ent.y;
                if (ent.y > maxY) maxY = ent.y;
            }
        }

        // Add padding
        const padX = Math.max((maxX - minX) * 0.15, 200);
        const padY = Math.max((maxY - minY) * 0.15, 200);
        return {
            minX: minX - padX,
            maxX: maxX + padX,
            minY: minY - padY,
            maxY: maxY + padY,
        };
    }

    worldToCanvasX(wx, bounds) {
        return ((wx - bounds.minX) / (bounds.maxX - bounds.minX)) * this.width;
    }

    worldToCanvasY(wy, bounds) {
        return ((wy - bounds.minY) / (bounds.maxY - bounds.minY)) * this.height;
    }

    /**
     * Draw the current frame
     */
    drawFrame() {
        const ctx = this.ctx;
        if (!ctx || !this.report) return;

        const snaps = this.report.snapshots;
        if (snaps.length === 0) return;

        const bounds = this.calculateBounds();
        const snap = snaps[this.currentSnapIndex];
        if (!snap) return;

        // Clear
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Grid lines
        ctx.strokeStyle = 'rgba(40, 60, 80, 0.3)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 8; i++) {
            const x = (i / 8) * this.width;
            const y = (i / 8) * this.height;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
        }

        // Update trails for current snapshot
        for (const ent of snap.entities) {
            if (!this.trails[ent.id]) this.trails[ent.id] = [];
            const sx = this.worldToCanvasX(ent.x, bounds);
            const sy = this.worldToCanvasY(ent.y, bounds);

            const trail = this.trails[ent.id];
            const last = trail[trail.length - 1];
            if (!last || Math.abs(last.x - sx) > 0.5 || Math.abs(last.y - sy) > 0.5) {
                trail.push({ x: sx, y: sy, alive: ent.alive });
            }
            // Limit trail length
            if (trail.length > 100) trail.shift();
        }

        // Draw trails
        for (const [id, trail] of Object.entries(this.trails)) {
            if (trail.length < 2) continue;
            const ent = snap.entities.find(e => e.id === id);
            const faction = ent?.faction;
            const isPlayer = faction && this.report.factions[faction]?.isPlayerFaction;
            const color = this.getFactionColor(faction || '', isPlayer);

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 1;
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) {
                ctx.lineTo(trail[i].x, trail[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw weapon flashes (damage events within +-0.3s of current time)
        for (const flash of this.weaponFlashes) {
            if (Math.abs(flash.t - this.playbackTime) > 0.3) continue;

            // Find source and target positions
            const srcEnt = snap.entities.find(e => e.id === flash.src);
            const tgtEnt = snap.entities.find(e => e.id === flash.tgt);
            if (!srcEnt || !tgtEnt) continue;

            const sx = this.worldToCanvasX(srcEnt.x, bounds);
            const sy = this.worldToCanvasY(srcEnt.y, bounds);
            const tx = this.worldToCanvasX(tgtEnt.x, bounds);
            const ty = this.worldToCanvasY(tgtEnt.y, bounds);

            const age = Math.abs(flash.t - this.playbackTime) / 0.3;
            ctx.globalAlpha = 0.6 * (1 - age);

            const beamColor = flash.type === 'shield' ? '#4488ff' :
                flash.type === 'armor' ? '#ffaa44' : '#ff4444';

            ctx.strokeStyle = beamColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(tx, ty);
            ctx.stroke();

            // Impact spark
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(tx, ty, 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 1;
        }

        // Draw entities
        for (const ent of snap.entities) {
            const sx = this.worldToCanvasX(ent.x, bounds);
            const sy = this.worldToCanvasY(ent.y, bounds);
            const faction = ent.faction;
            const isPlayer = faction && this.report.factions[faction]?.isPlayerFaction;
            const color = this.getFactionColor(faction || '', isPlayer);

            if (!ent.alive) {
                // Dead entity - X mark
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx - 3, sy - 3); ctx.lineTo(sx + 3, sy + 3);
                ctx.moveTo(sx + 3, sy - 3); ctx.lineTo(sx - 3, sy + 3);
                ctx.stroke();
                continue;
            }

            // Entity dot
            const radius = isPlayer ? 4 : 3;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fill();

            // HP ring
            if (ent.hp < 100) {
                const hpFrac = ent.hp / 100;
                const hpColor = hpFrac > 0.6 ? '#44ff88' : hpFrac > 0.3 ? '#ffcc44' : '#ff4444';
                ctx.strokeStyle = hpColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(sx, sy, radius + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac);
                ctx.stroke();
            }

            // Label
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.7;
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(ent.id.split(' ').pop(), sx, sy - radius - 3);
            ctx.globalAlpha = 1;
        }

        // Update time display
        const timeEl = this.modal?.querySelector('.replay-time');
        if (timeEl) {
            timeEl.textContent = `${this.playbackTime.toFixed(1)}s / ${this.report.duration}s`;
        }
    }

    /**
     * Clean up and close the replay modal
     */
    destroy() {
        this.playing = false;
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        this.canvas = null;
        this.ctx = null;
        this.report = null;
    }
}
