// =============================================
// Audio Manager - Synthesized sound effects
// No external audio files needed
// =============================================

import { CONFIG } from '../config.js';

export class AudioManager {
    constructor(game) {
        this.game = game;
        this.enabled = CONFIG.AUDIO_ENABLED;
        this.volume = CONFIG.MASTER_VOLUME;

        // Audio context (created on first user interaction)
        this.context = null;
        this.masterGain = null;

        // Sound definitions
        this.sounds = {
            'laser': { type: 'laser', duration: 0.15 },
            'hit': { type: 'hit', duration: 0.1 },
            'explosion': { type: 'explosion', duration: 0.5 },
            'shield-hit': { type: 'shieldHit', duration: 0.2 },
            'lock-start': { type: 'lockStart', duration: 0.3 },
            'lock-complete': { type: 'lockComplete', duration: 0.2 },
            'warp-start': { type: 'warpStart', duration: 0.5 },
            'warp-end': { type: 'warpEnd', duration: 0.3 },
            'mining': { type: 'mining', duration: 0.4 },
            'dock': { type: 'dock', duration: 0.5 },
            'undock': { type: 'undock', duration: 0.5 },
            'module-activate': { type: 'moduleActivate', duration: 0.1 },
            'module-deactivate': { type: 'moduleDeactivate', duration: 0.1 },
            'warning': { type: 'warning', duration: 0.3 },
            'click': { type: 'click', duration: 0.05 },
            'capacitor-low': { type: 'capacitorLow', duration: 0.4 },
            'shield-low': { type: 'shieldLow', duration: 0.5 },
            'hull-critical': { type: 'hullCritical', duration: 0.6 },
            'cargo-full': { type: 'cargoFull', duration: 0.3 },
            'buy': { type: 'buy', duration: 0.3 },
            'sell': { type: 'sell', duration: 0.3 },
            'repair': { type: 'repair', duration: 0.4 },
            'quest-accept': { type: 'questAccept', duration: 0.5 },
            'quest-complete': { type: 'questComplete', duration: 0.8 },
            'quest-fail': { type: 'questFail', duration: 0.4 },
            'reputation-up': { type: 'reputationUp', duration: 0.6 },
            'level-up': { type: 'levelUp', duration: 1.0 },
            'dialogue-open': { type: 'dialogueOpen', duration: 0.2 },
            'dialogue-close': { type: 'dialogueClose', duration: 0.15 },
            'missile-launch': { type: 'missileLaunch', duration: 0.3 },
            'missile-hit': { type: 'missileHit', duration: 0.4 },
            'drone-launch': { type: 'droneLaunch', duration: 0.3 },
            'drone-recall': { type: 'droneRecall', duration: 0.3 },
            'jump-gate': { type: 'jumpGate', duration: 0.8 },
            'purchase': { type: 'buy', duration: 0.3 },
            'target-destroyed': { type: 'targetDestroyed', duration: 0.6 },
            'loot-pickup': { type: 'lootPickup', duration: 0.3 },
        };

        // Initialize on first click
        this.initialized = false;
        document.addEventListener('click', () => this.init(), { once: true });
        document.addEventListener('keydown', () => this.init(), { once: true });
    }

    /**
     * Initialize audio context (requires user gesture)
     */
    init() {
        if (this.initialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.context.destination);
            this.initialized = true;
            console.log('Audio initialized');
        } catch (e) {
            console.warn('Audio not available:', e);
            this.enabled = false;
        }
    }

    /**
     * Play a sound effect
     */
    play(soundName, volumeMultiplier = 1) {
        if (!this.enabled || !this.initialized) return;

        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Unknown sound: ${soundName}`);
            return;
        }

        // Generate the sound
        this.synthesize(sound.type, sound.duration, volumeMultiplier);
    }

    /**
     * Synthesize sound effects
     */
    synthesize(type, duration, volumeMultiplier) {
        const ctx = this.context;
        const now = ctx.currentTime;

        // Create gain node for this sound
        const gain = ctx.createGain();
        gain.gain.value = volumeMultiplier;
        gain.connect(this.masterGain);

        switch (type) {
            case 'laser':
                this.synthLaser(ctx, gain, now, duration);
                break;
            case 'hit':
                this.synthHit(ctx, gain, now, duration);
                break;
            case 'explosion':
                this.synthExplosion(ctx, gain, now, duration);
                break;
            case 'shieldHit':
                this.synthShieldHit(ctx, gain, now, duration);
                break;
            case 'lockStart':
                this.synthLockStart(ctx, gain, now, duration);
                break;
            case 'lockComplete':
                this.synthLockComplete(ctx, gain, now, duration);
                break;
            case 'warpStart':
                this.synthWarpStart(ctx, gain, now, duration);
                break;
            case 'warpEnd':
                this.synthWarpEnd(ctx, gain, now, duration);
                break;
            case 'mining':
                this.synthMining(ctx, gain, now, duration);
                break;
            case 'dock':
            case 'undock':
                this.synthDock(ctx, gain, now, duration);
                break;
            case 'moduleActivate':
                this.synthModuleActivate(ctx, gain, now, duration);
                break;
            case 'moduleDeactivate':
                this.synthModuleDeactivate(ctx, gain, now, duration);
                break;
            case 'warning':
                this.synthWarning(ctx, gain, now, duration);
                break;
            case 'click':
                this.synthClick(ctx, gain, now, duration);
                break;
            case 'capacitorLow':
                this.synthCapacitorLow(ctx, gain, now, duration);
                break;
            case 'shieldLow':
                this.synthShieldLow(ctx, gain, now, duration);
                break;
            case 'hullCritical':
                this.synthHullCritical(ctx, gain, now, duration);
                break;
            case 'cargoFull':
                this.synthCargoFull(ctx, gain, now, duration);
                break;
            case 'buy':
                this.synthBuy(ctx, gain, now, duration);
                break;
            case 'sell':
                this.synthSell(ctx, gain, now, duration);
                break;
            case 'repair':
                this.synthRepair(ctx, gain, now, duration);
                break;
            case 'questAccept':
                this.synthQuestAccept(ctx, gain, now, duration);
                break;
            case 'questComplete':
                this.synthQuestComplete(ctx, gain, now, duration);
                break;
            case 'questFail':
                this.synthQuestFail(ctx, gain, now, duration);
                break;
            case 'reputationUp':
                this.synthReputationUp(ctx, gain, now, duration);
                break;
            case 'levelUp':
                this.synthLevelUp(ctx, gain, now, duration);
                break;
            case 'dialogueOpen':
                this.synthDialogueOpen(ctx, gain, now, duration);
                break;
            case 'dialogueClose':
                this.synthDialogueClose(ctx, gain, now, duration);
                break;
            case 'missileLaunch':
                this.synthMissileLaunch(ctx, gain, now, duration);
                break;
            case 'missileHit':
                this.synthMissileHit(ctx, gain, now, duration);
                break;
            case 'droneLaunch':
                this.synthDroneLaunch(ctx, gain, now, duration);
                break;
            case 'droneRecall':
                this.synthDroneRecall(ctx, gain, now, duration);
                break;
            case 'jumpGate':
                this.synthJumpGate(ctx, gain, now, duration);
                break;
            case 'targetDestroyed':
                this.synthTargetDestroyed(ctx, gain, now, duration);
                break;
            case 'lootPickup':
                this.synthLootPickup(ctx, gain, now, duration);
                break;
        }
    }

    // --- Sound Synthesis Functions ---

    synthLaser(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + duration);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthHit(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + duration);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthExplosion(ctx, gain, now, duration) {
        // White noise for explosion
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Low-pass filter
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        noise.start(now);
    }

    synthShieldHit(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(400, now + 0.05);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthLockStart(ctx, gain, now, duration) {
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 800;

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.1);
            oscGain.gain.linearRampToValueAtTime(0.15, now + i * 0.1 + 0.02);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.08);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.1);
        }
    }

    synthLockComplete(ctx, gain, now, duration) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 600;
        osc2.frequency.value = 900;

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    }

    synthWarpStart(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + duration);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.3, now + duration * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthWarpEnd(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + duration);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthMining(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);

        // Vibrato
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 10;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 20;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.setValueAtTime(0.15, now + duration * 0.9);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
    }

    synthDock(ctx, gain, now, duration) {
        const frequencies = [400, 500, 600, 700];
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.1);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.15);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.2);
        });
    }

    synthModuleActivate(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(600, now + duration);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthModuleDeactivate(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(300, now + duration);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthWarning(ctx, gain, now, duration) {
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 440;

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.15);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.15 + 0.02);
            oscGain.gain.setValueAtTime(0.1, now + i * 0.15 + 0.08);
            oscGain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.1);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.12);
        }
    }

    synthClick(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1000;

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthShieldLow(ctx, gain, now, duration) {
        // Blue/electric warning - high frequency beeps
        for (let i = 0; i < 2; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 600 + i * 200; // Ascending tone

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.2);
            oscGain.gain.linearRampToValueAtTime(0.15, now + i * 0.2 + 0.03);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.15);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.2);
        }
    }

    synthCapacitorLow(ctx, gain, now, duration) {
        // Purple/power warning - pulsing low tone
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 220;

        // Pulsing effect
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 8;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.1;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
    }

    synthHullCritical(ctx, gain, now, duration) {
        // Red alert - urgent alarm
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 440;

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.18);
            oscGain.gain.linearRampToValueAtTime(0.12, now + i * 0.18 + 0.02);
            oscGain.gain.setValueAtTime(0.12, now + i * 0.18 + 0.1);
            oscGain.gain.linearRampToValueAtTime(0, now + i * 0.18 + 0.12);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.18);
            osc.stop(now + i * 0.18 + 0.15);
        }
    }

    synthCargoFull(ctx, gain, now, duration) {
        // Notification beep - cargo is full
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 523; // C5
        osc2.frequency.value = 659; // E5

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        osc1.start(now);
        osc2.start(now + 0.1);
        osc1.stop(now + 0.15);
        osc2.stop(now + duration);
    }

    synthBuy(ctx, gain, now, duration) {
        // Cash register / purchase sound
        const frequencies = [523, 659, 784]; // C5, E5, G5
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.06);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.06 + 0.02);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.12);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.15);
        });
    }

    synthSell(ctx, gain, now, duration) {
        // Descending arpeggio G5-E5-C5 (reverse of buy)
        const frequencies = [784, 659, 523];
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.06);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.06 + 0.02);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.12);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.15);
        });
    }

    synthRepair(ctx, gain, now, duration) {
        // Gentle rising hum with harmonics
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(400, now + duration);
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(300, now);
        osc2.frequency.linearRampToValueAtTime(600, now + duration);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.12, now + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        osc2.connect(gain);
        osc.start(now); osc2.start(now);
        osc.stop(now + duration); osc2.stop(now + duration);
    }

    synthQuestAccept(ctx, gain, now, duration) {
        // Ascending fanfare: C5-E5-G5-C6
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.1);
            oscGain.gain.linearRampToValueAtTime(0.12, now + i * 0.1 + 0.03);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.15);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.2);
        });
    }

    synthQuestComplete(ctx, gain, now, duration) {
        // Triumphant fanfare: C5-E5-G5 chord, then C6
        const chord = [523, 659, 784];
        chord.forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.08, now);
            oscGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now);
            osc.stop(now + 0.5);
        });
        // Final high note
        const finalOsc = ctx.createOscillator();
        finalOsc.type = 'sine';
        finalOsc.frequency.value = 1047;
        const finalGain = ctx.createGain();
        finalGain.gain.setValueAtTime(0, now + 0.4);
        finalGain.gain.linearRampToValueAtTime(0.15, now + 0.45);
        finalGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        finalOsc.connect(finalGain);
        finalGain.connect(gain);
        finalOsc.start(now + 0.4);
        finalOsc.stop(now + duration);
    }

    synthQuestFail(ctx, gain, now, duration) {
        // Descending minor: E5-C5 with dissonance
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(659, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(filter);
        filter.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthReputationUp(ctx, gain, now, duration) {
        // Two-part chime: ascending fifth
        const notes = [440, 660, 880];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.15);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.15 + 0.04);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.2);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.25);
        });
    }

    synthLevelUp(ctx, gain, now, duration) {
        // Grand ascending scale with harmonics
        const scale = [523, 587, 659, 784, 880, 1047];
        scale.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.value = freq * 1.5;
            const oscGain = ctx.createGain();
            const t = now + i * 0.12;
            oscGain.gain.setValueAtTime(0, t);
            oscGain.gain.linearRampToValueAtTime(0.08, t + 0.03);
            oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.connect(oscGain);
            osc2.connect(oscGain);
            oscGain.connect(gain);
            osc.start(t); osc2.start(t);
            osc.stop(t + 0.25); osc2.stop(t + 0.25);
        });
    }

    synthDialogueOpen(ctx, gain, now, duration) {
        // Soft two-tone chime
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthDialogueClose(ctx, gain, now, duration) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthMissileLaunch(ctx, gain, now, duration) {
        // Whoosh with rising pitch
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + duration * 0.5);
        osc.frequency.exponentialRampToValueAtTime(400, now + duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 600;
        filter.Q.value = 2;
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(filter);
        filter.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthMissileHit(ctx, gain, now, duration) {
        // Thud + explosion mix
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + duration);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        noise.connect(filter);
        filter.connect(gain);
        noise.start(now);
    }

    synthDroneLaunch(ctx, gain, now, duration) {
        // Quick ascending buzz
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(600, now + duration);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthDroneRecall(ctx, gain, now, duration) {
        // Quick descending buzz
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(200, now + duration);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthJumpGate(ctx, gain, now, duration) {
        // Deep resonant hum building to a flash
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + duration * 0.8);
        osc.frequency.exponentialRampToValueAtTime(80, now + duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(3000, now + duration * 0.7);
        filter.frequency.exponentialRampToValueAtTime(100, now + duration);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.25, now + duration * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(filter);
        filter.connect(gain);
        osc.start(now);
        osc.stop(now + duration);
    }

    synthTargetDestroyed(ctx, gain, now, duration) {
        // Satisfying crunch + confirmation tone
        const bufferSize = ctx.sampleRate * 0.2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        noise.connect(noiseGain);
        noiseGain.connect(gain);
        noise.start(now);
        // Confirmation tone
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 880;
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0, now + 0.15);
        oscGain.gain.linearRampToValueAtTime(0.1, now + 0.2);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(oscGain);
        oscGain.connect(gain);
        osc.start(now + 0.15);
        osc.stop(now + duration);
    }

    synthLootPickup(ctx, gain, now, duration) {
        // Quick sparkle sound
        const notes = [1200, 1600, 2000];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.05);
            oscGain.gain.linearRampToValueAtTime(0.06, now + i * 0.05 + 0.01);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.1);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.12);
        });
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        this.volume = volume;
        if (this.masterGain) {
            this.masterGain.gain.value = volume;
        }
    }

    /**
     * Set master volume (alias for settings panel)
     */
    setMasterVolume(volume) {
        this.setVolume(volume);
    }

    /**
     * Toggle audio on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}
