// =============================================
// Performance Monitor - Enhanced debug panel
// =============================================

export class PerformanceMonitor {
    constructor(game) {
        this.game = game;
        this.visible = false;

        // Frame tracking
        this.frames = [];
        this.maxFrames = 60;
        this.lastTime = performance.now();

        // Stats
        this.fps = 0;
        this.fpsMin = Infinity;
        this.fpsMax = 0;
        this.frameTime = 0;

        // Create DOM element
        this.element = this.createElement();
        document.getElementById('ui-overlay').appendChild(this.element);

        // Update interval
        this.updateInterval = null;
    }

    createElement() {
        const el = document.createElement('div');
        el.id = 'performance-monitor';
        el.className = 'panel hidden';
        el.innerHTML = `
            <div class="panel-header perf-header">
                <span class="panel-title">PERFORMANCE</span>
                <button class="panel-close">&times;</button>
            </div>
            <div class="perf-content">
                <div class="perf-section">
                    <div class="perf-label">FPS</div>
                    <div class="perf-row">
                        <span class="perf-stat" id="perf-fps">0</span>
                        <span class="perf-detail">min: <span id="perf-fps-min">0</span> max: <span id="perf-fps-max">0</span></span>
                    </div>
                </div>
                <div class="perf-section">
                    <div class="perf-label">FRAME TIME</div>
                    <div class="perf-row">
                        <span class="perf-stat" id="perf-frametime">0</span>
                        <span class="perf-unit">ms</span>
                    </div>
                </div>
                <div class="perf-section">
                    <div class="perf-label">ENTITIES</div>
                    <div class="perf-row">
                        <span class="perf-stat" id="perf-entities">0</span>
                        <span class="perf-detail">visible: <span id="perf-visible">0</span></span>
                    </div>
                </div>
                <div class="perf-section">
                    <div class="perf-label">MEMORY</div>
                    <div class="perf-row">
                        <span class="perf-stat" id="perf-memory">N/A</span>
                        <span class="perf-unit">MB</span>
                    </div>
                </div>
                <div class="perf-section">
                    <div class="perf-label">SECTOR</div>
                    <div class="perf-row">
                        <span class="perf-stat" id="perf-sector">-</span>
                    </div>
                </div>
                <div class="perf-section">
                    <div class="perf-label">POSITION</div>
                    <div class="perf-row">
                        <span class="perf-detail" id="perf-position">x: 0, y: 0</span>
                    </div>
                </div>
            </div>
        `;

        // Close button
        el.querySelector('.panel-close').addEventListener('click', () => {
            this.hide();
        });

        return el;
    }

    show() {
        this.visible = true;
        this.element.classList.remove('hidden');
        this.fpsMin = Infinity;
        this.fpsMax = 0;
        this.frames = [];

        // Start update loop
        if (!this.updateInterval) {
            this.updateInterval = setInterval(() => this.updateDisplay(), 100);
        }
    }

    hide() {
        this.visible = false;
        this.element.classList.add('hidden');

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Called each frame from game loop
     */
    update() {
        if (!this.visible) return;

        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;

        this.frameTime = delta;
        this.frames.push(delta);

        if (this.frames.length > this.maxFrames) {
            this.frames.shift();
        }

        // Calculate FPS
        const avgDelta = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        this.fps = Math.round(1000 / avgDelta);

        // Track min/max
        if (this.fps > 0 && this.fps < 1000) {
            this.fpsMin = Math.min(this.fpsMin, this.fps);
            this.fpsMax = Math.max(this.fpsMax, this.fps);
        }
    }

    updateDisplay() {
        if (!this.visible) return;

        // FPS
        document.getElementById('perf-fps').textContent = this.fps;
        document.getElementById('perf-fps-min').textContent = this.fpsMin === Infinity ? '-' : this.fpsMin;
        document.getElementById('perf-fps-max').textContent = this.fpsMax === 0 ? '-' : this.fpsMax;

        // Frame time
        document.getElementById('perf-frametime').textContent = this.frameTime.toFixed(2);

        // Entities
        const entities = this.game.currentSector?.entities || [];
        const visible = this.game.getVisibleEntities?.()?.length || 0;
        document.getElementById('perf-entities').textContent = entities.length;
        document.getElementById('perf-visible').textContent = visible;

        // Memory (Chrome only)
        if (performance.memory) {
            const mb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            document.getElementById('perf-memory').textContent = mb;
        }

        // Sector
        const sectorName = this.game.currentSector?.name || '-';
        document.getElementById('perf-sector').textContent = sectorName;

        // Position
        const player = this.game.player;
        if (player) {
            document.getElementById('perf-position').textContent =
                `x: ${Math.round(player.x)}, y: ${Math.round(player.y)}`;
        }
    }
}
