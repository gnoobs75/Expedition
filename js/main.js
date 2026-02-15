// =============================================
// EXPEDITION - Main Entry Point
// A 2D Top-Down Space Game
// =============================================

import { Game } from './core/Game.js';
import { SplashScreen } from './ui/SplashScreen.js';
import { DEBUG, debug, FPSMonitor, EntityInspector } from './utils/debug.js';

// Global game instance
let game = null;
let fpsMonitor = null;
let entityInspector = null;

/**
 * Show splash screen, then initialize and start the game
 */
async function init() {
    console.log('Starting Expedition...');

    if (DEBUG) {
        debug.info('INIT', 'Debug mode enabled');
        fpsMonitor = new FPSMonitor();
    }

    // Show splash / title screen
    const splash = new SplashScreen();
    const result = await splash.show();

    // Fade out splash
    await splash.hide();

    // Create game instance
    game = new Game();
    window.game = game;

    // Initialize all systems
    await game.init();

    // Apply faction data for new game
    if (result.faction) {
        game.faction = { ...result.faction };
    }

    // Apply hero ship name for new game
    if (result.heroShipName && game.player) {
        game.player.heroName = result.heroShipName;
        game.player.name = result.heroShipName;
    }

    // Auto-assign weapon groups on new game
    if (result.action === 'new' && game.player) {
        game.player.autoAssignWeaponGroups();
    }

    // If loading a save, restore state before starting game loop
    if (result.action === 'load' && result.slotData) {
        game.loadFromSave(result.slotData);
    }

    // If tutorial mode, enable guided tutorial arc
    if (result.tutorial && game.skippy) {
        game.skippy.milestones = new Set();
        game.skippy.guidedTutorial = true;
        game.skippy.guidedStep = 0;
        game.skippy.saveState();
        setTimeout(() => {
            game.skippy.startGuidedTutorial();
        }, 2000);
    } else if (game.skippy && !result.slotData) {
        // New game (non-tutorial) - still start the guided tutorial
        game.skippy.guidedTutorial = true;
        game.skippy.guidedStep = 0;
        game.skippy.saveState();
        setTimeout(() => {
            game.skippy.startGuidedTutorial();
        }, 2000);
    }

    // Create debug tools after game init
    if (DEBUG) {
        entityInspector = new EntityInspector(game);

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
