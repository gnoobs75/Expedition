// =============================================
// EXPEDITION - Main Entry Point
// A 2D Top-Down Space Game
// =============================================

import { Game } from './core/Game.js';
import { DEBUG, debug, FPSMonitor, EntityInspector } from './utils/debug.js';

// Global game instance
let game = null;
let fpsMonitor = null;
let entityInspector = null;

/**
 * Initialize and start the game
 */
async function init() {
    console.log('Starting Expedition...');

    if (DEBUG) {
        debug.info('INIT', 'Debug mode enabled');
        fpsMonitor = new FPSMonitor();
    }

    // Create game instance
    game = new Game();

    // Make game globally accessible for UI callbacks
    window.game = game;

    // Initialize all systems
    await game.init();

    // Create debug tools after game init
    if (DEBUG) {
        entityInspector = new EntityInspector(game);

        // Hook into game loop for debug updates
        const originalUpdate = game.update.bind(game);
        game.update = function(dt) {
            originalUpdate(dt);
            fpsMonitor?.update();
            entityInspector?.update();
        };
    }

    // Start the game loop
    game.start();

    // Log welcome message
    game.ui.log('Welcome to Expedition, Capsuleer.', 'system');
    game.ui.log('Right-click objects in the Overview to interact.', 'system');
    game.ui.log('Press V for D-Scan, Ctrl+B to bookmark.', 'system');

    if (DEBUG) {
        game.ui.log('Debug mode active. Press F9 for inspector.', 'system');
    }

    console.log('Expedition started!');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose game for debugging
window.getGame = () => game;
