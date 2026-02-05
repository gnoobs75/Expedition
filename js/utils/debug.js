// =============================================
// Debug Utilities
// Enable with ?debug=true in URL
// =============================================

const urlParams = new URLSearchParams(window.location.search);
export const DEBUG = urlParams.get('debug') === 'true';

// Debug log levels
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

let currentLevel = DEBUG ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

/**
 * Debug logger with levels and categories
 */
export const debug = {
    setLevel(level) {
        currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.DEBUG;
    },

    error(category, ...args) {
        if (currentLevel >= LOG_LEVELS.ERROR) {
            console.error(`[ERROR][${category}]`, ...args);
        }
    },

    warn(category, ...args) {
        if (currentLevel >= LOG_LEVELS.WARN) {
            console.warn(`[WARN][${category}]`, ...args);
        }
    },

    info(category, ...args) {
        if (currentLevel >= LOG_LEVELS.INFO) {
            console.info(`[INFO][${category}]`, ...args);
        }
    },

    log(category, ...args) {
        if (currentLevel >= LOG_LEVELS.DEBUG) {
            console.log(`[DEBUG][${category}]`, ...args);
        }
    },

    trace(category, ...args) {
        if (currentLevel >= LOG_LEVELS.TRACE) {
            console.log(`[TRACE][${category}]`, ...args);
        }
    }
};

/**
 * Performance monitoring
 */
export const perf = {
    marks: new Map(),

    start(label) {
        if (!DEBUG) return;
        this.marks.set(label, performance.now());
    },

    end(label) {
        if (!DEBUG) return;
        const start = this.marks.get(label);
        if (start) {
            const duration = performance.now() - start;
            debug.trace('PERF', `${label}: ${duration.toFixed(2)}ms`);
            this.marks.delete(label);
            return duration;
        }
        return 0;
    }
};

/**
 * Frame rate monitor
 */
export class FPSMonitor {
    constructor() {
        this.frames = [];
        this.lastTime = performance.now();
        this.element = null;

        if (DEBUG) {
            this.createDisplay();
        }
    }

    createDisplay() {
        this.element = document.createElement('div');
        this.element.id = 'fps-display';
        this.element.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #0ff;
            font-family: monospace;
            font-size: 12px;
            padding: 8px 12px;
            border: 1px solid #0ff;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(this.element);
    }

    update() {
        if (!DEBUG || !this.element) return;

        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;

        this.frames.push(delta);
        if (this.frames.length > 60) {
            this.frames.shift();
        }

        const avgDelta = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        const fps = 1000 / avgDelta;
        const minFps = 1000 / Math.max(...this.frames);
        const maxFps = 1000 / Math.min(...this.frames);

        this.element.innerHTML = `
            FPS: ${fps.toFixed(1)}<br>
            Min: ${minFps.toFixed(1)}<br>
            Max: ${maxFps.toFixed(1)}<br>
            Frame: ${delta.toFixed(1)}ms
        `;
    }
}

/**
 * Entity inspector overlay
 */
export class EntityInspector {
    constructor(game) {
        this.game = game;
        this.element = null;
        this.visible = false;

        if (DEBUG) {
            this.createDisplay();
            this.setupKeyHandler();
        }
    }

    createDisplay() {
        this.element = document.createElement('div');
        this.element.id = 'entity-inspector';
        this.element.style.cssText = `
            position: fixed;
            top: 60px;
            left: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: #0ff;
            font-family: monospace;
            font-size: 11px;
            padding: 10px;
            border: 1px solid #0ff;
            z-index: 10000;
            max-width: 300px;
            max-height: 400px;
            overflow: auto;
            display: none;
        `;
        document.body.appendChild(this.element);
    }

    setupKeyHandler() {
        window.addEventListener('keydown', (e) => {
            // F9 to toggle inspector
            if (e.code === 'F9') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    toggle() {
        this.visible = !this.visible;
        if (this.element) {
            this.element.style.display = this.visible ? 'block' : 'none';
        }
    }

    update() {
        if (!DEBUG || !this.visible || !this.element) return;

        const target = this.game.selectedTarget;
        const player = this.game.player;

        let html = '<b>== ENTITY INSPECTOR (F9) ==</b><br><br>';

        if (player) {
            html += '<b>PLAYER:</b><br>';
            html += this.formatEntity(player);
            html += '<br>';
        }

        if (target && target !== player) {
            html += '<b>TARGET:</b><br>';
            html += this.formatEntity(target);
        }

        if (!target) {
            html += '<i>No target selected</i>';
        }

        this.element.innerHTML = html;
    }

    formatEntity(entity) {
        const props = [
            `id: ${entity.id}`,
            `name: ${entity.name}`,
            `type: ${entity.type}`,
            `x: ${entity.x?.toFixed(1)}`,
            `y: ${entity.y?.toFixed(1)}`,
            `rotation: ${(entity.rotation * 180 / Math.PI)?.toFixed(1)}°`,
            `speed: ${entity.currentSpeed?.toFixed(1)}`,
        ];

        if (entity.shield !== undefined) {
            props.push(`shield: ${entity.shield?.toFixed(0)}/${entity.maxShield}`);
            props.push(`armor: ${entity.armor?.toFixed(0)}/${entity.maxArmor}`);
            props.push(`hull: ${entity.hull?.toFixed(0)}/${entity.maxHull}`);
            props.push(`capacitor: ${entity.capacitor?.toFixed(0)}/${entity.maxCapacitor}`);
        }

        if (entity.modules) {
            const activeModules = entity.modules.filter(m => m.active).length;
            props.push(`modules: ${activeModules}/${entity.modules.length} active`);
        }

        return props.map(p => `  ${p}`).join('<br>') + '<br>';
    }
}

/**
 * Console commands for debugging
 */
if (DEBUG) {
    window.dbg = {
        // Teleport player
        tp(x, y) {
            const player = window.game?.player;
            if (player) {
                player.x = x;
                player.y = y;
                console.log(`Teleported to (${x}, ${y})`);
            }
        },

        // Give credits
        credits(amount) {
            if (window.game) {
                window.game.credits += amount;
                console.log(`Added ${amount} credits. Total: ${window.game.credits}`);
            }
        },

        // Heal player
        heal() {
            const player = window.game?.player;
            if (player) {
                player.shield = player.maxShield;
                player.armor = player.maxArmor;
                player.hull = player.maxHull;
                player.capacitor = player.maxCapacitor;
                console.log('Player fully healed');
            }
        },

        // God mode toggle
        god() {
            const player = window.game?.player;
            if (player) {
                player.invulnerable = !player.invulnerable;
                console.log(`God mode: ${player.invulnerable ? 'ON' : 'OFF'}`);
            }
        },

        // List all entities
        entities() {
            const entities = window.game?.getVisibleEntities() || [];
            console.table(entities.map(e => ({
                id: e.id,
                name: e.name,
                type: e.type,
                x: e.x?.toFixed(0),
                y: e.y?.toFixed(0)
            })));
        },

        // Spawn enemy at location
        spawn(x, y) {
            console.log('Spawn not implemented - would spawn enemy at', x, y);
        },

        // Show help
        help() {
            console.log(`
Debug Commands (window.dbg.*):
  tp(x, y)      - Teleport player to coordinates
  credits(n)    - Add n credits
  heal()        - Fully heal player
  god()         - Toggle invulnerability
  entities()    - List all visible entities
  help()        - Show this help

Keyboard Shortcuts:
  F9            - Toggle entity inspector
            `);
        }
    };

    console.log('%c[DEBUG MODE ENABLED]', 'color: #0ff; font-weight: bold; font-size: 14px');
    console.log('Type dbg.help() for available commands');
}
