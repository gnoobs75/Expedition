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
            'armor-hit': { type: 'armorHit', duration: 0.15 },
            'hull-hit': { type: 'hullHit', duration: 0.2 },
            'missile-explosion': { type: 'missileExplosion', duration: 0.5 },
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
            'scan': { type: 'scan', duration: 0.6 },
            'scan-complete': { type: 'scanComplete', duration: 0.5 },
            'repair-beam': { type: 'repairBeam', duration: 0.4 },
            'warp-disrupted': { type: 'warpDisrupted', duration: 0.5 },
            'ewar-warning': { type: 'ewarWarning', duration: 0.4 },
            'structural-alarm': { type: 'structuralAlarm', duration: 0.6 },
        };

        // OGG sound mapping system
        this.soundMappings = { equipment: {}, events: {} };
        this.audioBufferCache = {};
        this.soundDB = null;
        this.loadSoundMappings();

        // Load saved settings
        this.loadSettings();

        // Engine hum state
        this.engineHumNode = null;
        this.engineHumGain = null;

        // Dynamic music state
        this.musicEnabled = true;
        this.musicVolume = 0.12;
        this.musicMode = 'ambient'; // 'ambient' | 'combat' | 'danger' | 'station'
        this.musicTargetMode = 'ambient';
        this.musicTransitionTimer = 0;
        this.musicTransitionDuration = 2.0;
        this.musicLayers = null; // { ambient: {nodes, gain}, combat: {nodes, gain}, danger: {nodes, gain} }
        this.musicMasterGain = null;
        this.musicStarted = false;
        this.musicBeatTimer = 0;

        // OGG music track player
        this.spaceTracks = [
            'audio/music/Space.ogg',
            'audio/music/space2.ogg',
            'audio/music/Space3.ogg',
            'audio/music/Space4.ogg',
        ];
        this.trackIndex = 0;
        this.trackShuffleOrder = null;
        this.currentTrack = null;  // Audio element
        this.nextTrack = null;     // Audio element (for crossfade preload)
        this.trackFadeInterval = null;
        this.trackPlaying = false;
        this.trackVolume = 0.3;    // Base volume for OGG tracks (scaled by musicVolume)

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

            // Preload custom OGG sounds from IndexedDB
            this.preloadMappedSounds();

            // Start ambient engine hum
            this.startEngineHum();

            // Start dynamic music system
            this.startMusic();

            // Sync settings UI
            const volSlider = document.getElementById('master-volume');
            const volValue = document.getElementById('volume-value');
            const sfxCheckbox = document.getElementById('sfx-enabled');
            if (volSlider) volSlider.value = Math.round(this.volume * 100);
            if (volValue) volValue.textContent = `${Math.round(this.volume * 100)}%`;
            if (sfxCheckbox) sfxCheckbox.checked = this.enabled;
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

        // Check for custom OGG mapping for this event sound
        const mappedFile = this.soundMappings.events?.[soundName];
        if (mappedFile && this.audioBufferCache[mappedFile]) {
            this.playOggBuffer(this.audioBufferCache[mappedFile], volumeMultiplier);
            return;
        }

        const sound = this.sounds[soundName];
        if (!sound) {
            console.warn(`Unknown sound: ${soundName}`);
            return;
        }

        // Generate the sound
        this.synthesize(sound.type, sound.duration, volumeMultiplier);
    }

    /**
     * Play a sound for equipment, checking equipment-specific mapping first
     */
    playForEquipment(soundName, volumeMultiplier = 1, equipmentId = null) {
        if (!this.enabled || !this.initialized) return;

        // Check equipment-specific OGG mapping
        if (equipmentId) {
            const mappedFile = this.soundMappings.equipment?.[equipmentId];
            if (mappedFile && this.audioBufferCache[mappedFile]) {
                this.playOggBuffer(this.audioBufferCache[mappedFile], volumeMultiplier);
                return;
            }
        }

        // Fall through to normal play (which checks event mappings, then synth)
        this.play(soundName, volumeMultiplier);
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
            case 'scan':
                this.synthScan(ctx, gain, now, duration);
                break;
            case 'scanComplete':
                this.synthScanComplete(ctx, gain, now, duration);
                break;
            case 'repairBeam':
                this.synthRepairBeam(ctx, gain, now, duration);
                break;
            case 'warpDisrupted':
                this.synthWarpDisrupted(ctx, gain, now, duration);
                break;
            case 'ewarWarning':
                this.synthEwarWarning(ctx, gain, now, duration);
                break;
            case 'armorHit':
                this.synthArmorHit(ctx, gain, now, duration);
                break;
            case 'hullHit':
                this.synthHullHit(ctx, gain, now, duration);
                break;
            case 'missileExplosion':
                this.synthMissileExplosion(ctx, gain, now, duration);
                break;
            case 'structuralAlarm':
                this.synthStructuralAlarm(ctx, gain, now, duration);
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

    synthScan(ctx, gain, now, duration) {
        // Sonar-like sweeping ping
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + duration * 0.6);
        osc.frequency.exponentialRampToValueAtTime(200, now + duration);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 6;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 30;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.06, now + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
    }

    synthScanComplete(ctx, gain, now, duration) {
        // Data received chime - ascending triple ping
        const notes = [800, 1100, 1500];
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.12);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.12 + 0.02);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.15);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.18);
        });
    }

    synthRepairBeam(ctx, gain, now, duration) {
        // Warm healing hum with shimmer
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(500, now + duration);
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(600, now);
        osc2.frequency.linearRampToValueAtTime(1000, now + duration);
        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.03;
        osc2.connect(osc2Gain);
        osc2Gain.connect(gain);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.08, now + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(gain);
        osc.start(now); osc2.start(now);
        osc.stop(now + duration); osc2.stop(now + duration);
    }

    synthWarpDisrupted(ctx, gain, now, duration) {
        // Alarming buzzer - warp scrambled
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 300 + i * 50;
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.14);
            oscGain.gain.linearRampToValueAtTime(0.08, now + i * 0.14 + 0.02);
            oscGain.gain.setValueAtTime(0.08, now + i * 0.14 + 0.08);
            oscGain.gain.linearRampToValueAtTime(0, now + i * 0.14 + 0.1);
            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.14);
            osc.stop(now + i * 0.14 + 0.12);
        }
    }

    synthEwarWarning(ctx, gain, now, duration) {
        // Electronic interference buzz
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + duration);
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 300;
        filter.Q.value = 5;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 12;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.05;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        osc.connect(filter);
        filter.connect(gain);
        lfo.start(now);
        osc.start(now);
        lfo.stop(now + duration);
        osc.stop(now + duration);
    }

    /**
     * Armor hit - metallic clang with resonant ring
     */
    synthArmorHit(ctx, gain, now, duration) {
        // Sharp metallic impact
        const impact = ctx.createOscillator();
        impact.type = 'square';
        impact.frequency.setValueAtTime(800, now);
        impact.frequency.exponentialRampToValueAtTime(200, now + 0.04);
        const impactGain = ctx.createGain();
        impactGain.gain.setValueAtTime(0.15, now);
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        // Metallic resonance ring
        const ring = ctx.createOscillator();
        ring.type = 'sine';
        ring.frequency.setValueAtTime(1200, now);
        ring.frequency.exponentialRampToValueAtTime(600, now + duration);
        const ringGain = ctx.createGain();
        ringGain.gain.setValueAtTime(0.06, now + 0.01);
        ringGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // Noise burst for crunch
        const noiseLen = Math.floor(ctx.sampleRate * 0.03);
        const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.5;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.12, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 2000;
        bandpass.Q.value = 3;

        impact.connect(impactGain); impactGain.connect(gain);
        ring.connect(ringGain); ringGain.connect(gain);
        noise.connect(bandpass); bandpass.connect(noiseGain); noiseGain.connect(gain);

        impact.start(now); impact.stop(now + 0.06);
        ring.start(now); ring.stop(now + duration);
        noise.start(now); noise.stop(now + 0.04);
    }

    /**
     * Hull hit - deep thud with structural creak/groan
     */
    synthHullHit(ctx, gain, now, duration) {
        // Deep impact thud
        const thud = ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(120, now);
        thud.frequency.exponentialRampToValueAtTime(40, now + 0.08);
        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.2, now);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        // Structural creak/groan
        const creak = ctx.createOscillator();
        creak.type = 'sawtooth';
        creak.frequency.setValueAtTime(80, now + 0.03);
        creak.frequency.linearRampToValueAtTime(50, now + duration);
        const creakGain = ctx.createGain();
        creakGain.gain.setValueAtTime(0, now);
        creakGain.gain.linearRampToValueAtTime(0.04, now + 0.05);
        creakGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        const creakFilter = ctx.createBiquadFilter();
        creakFilter.type = 'lowpass';
        creakFilter.frequency.value = 200;

        // Crunch noise burst
        const noiseLen = Math.floor(ctx.sampleRate * 0.05);
        const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1) * 0.4;
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 500;

        thud.connect(thudGain); thudGain.connect(gain);
        creak.connect(creakFilter); creakFilter.connect(creakGain); creakGain.connect(gain);
        noise.connect(lowpass); lowpass.connect(noiseGain); noiseGain.connect(gain);

        thud.start(now); thud.stop(now + 0.1);
        creak.start(now + 0.03); creak.stop(now + duration);
        noise.start(now); noise.stop(now + 0.06);
    }

    /**
     * Missile explosion - deep boom with rumble and debris scatter
     */
    synthMissileExplosion(ctx, gain, now, duration) {
        // Initial detonation flash (white noise burst)
        const detLen = Math.floor(ctx.sampleRate * 0.08);
        const detBuf = ctx.createBuffer(1, detLen, ctx.sampleRate);
        const detData = detBuf.getChannelData(0);
        for (let i = 0; i < detLen; i++) detData[i] = (Math.random() * 2 - 1);
        const det = ctx.createBufferSource();
        det.buffer = detBuf;
        const detGain = ctx.createGain();
        detGain.gain.setValueAtTime(0.2, now);
        detGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        const detFilter = ctx.createBiquadFilter();
        detFilter.type = 'highpass';
        detFilter.frequency.value = 800;

        // Deep boom
        const boom = ctx.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(80, now);
        boom.frequency.exponentialRampToValueAtTime(25, now + 0.3);
        const boomGain = ctx.createGain();
        boomGain.gain.setValueAtTime(0.25, now + 0.01);
        boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        // Rolling rumble (low noise)
        const rumbleLen = Math.floor(ctx.sampleRate * duration);
        const rumbleBuf = ctx.createBuffer(1, rumbleLen, ctx.sampleRate);
        const rumbleData = rumbleBuf.getChannelData(0);
        for (let i = 0; i < rumbleLen; i++) rumbleData[i] = (Math.random() * 2 - 1) * 0.6;
        const rumble = ctx.createBufferSource();
        rumble.buffer = rumbleBuf;
        const rumbleGain = ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.08, now + 0.05);
        rumbleGain.gain.linearRampToValueAtTime(0.12, now + 0.15);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(300, now);
        rumbleFilter.frequency.linearRampToValueAtTime(100, now + duration);

        // Debris scatter (high crackle)
        const debrisLen = Math.floor(ctx.sampleRate * 0.2);
        const debrisBuf = ctx.createBuffer(1, debrisLen, ctx.sampleRate);
        const debrisData = debrisBuf.getChannelData(0);
        for (let i = 0; i < debrisLen; i++) {
            debrisData[i] = Math.random() > 0.85 ? (Math.random() * 2 - 1) * 0.8 : 0;
        }
        const debris = ctx.createBufferSource();
        debris.buffer = debrisBuf;
        const debrisGain = ctx.createGain();
        debrisGain.gain.setValueAtTime(0.05, now + 0.05);
        debrisGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        det.connect(detFilter); detFilter.connect(detGain); detGain.connect(gain);
        boom.connect(boomGain); boomGain.connect(gain);
        rumble.connect(rumbleFilter); rumbleFilter.connect(rumbleGain); rumbleGain.connect(gain);
        debris.connect(debrisGain); debrisGain.connect(gain);

        det.start(now); det.stop(now + 0.08);
        boom.start(now); boom.stop(now + 0.35);
        rumble.start(now); rumble.stop(now + duration);
        debris.start(now + 0.05); debris.stop(now + 0.3);
    }

    /**
     * Structural alarm - low repeating beep for hull warnings
     */
    synthStructuralAlarm(ctx, gain, now, duration) {
        for (let i = 0; i < 4; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 200;

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0, now + i * 0.15);
            oscGain.gain.linearRampToValueAtTime(0.1, now + i * 0.15 + 0.01);
            oscGain.gain.setValueAtTime(0.1, now + i * 0.15 + 0.06);
            oscGain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.08);

            osc.connect(oscGain);
            oscGain.connect(gain);
            osc.start(now + i * 0.15);
            osc.stop(now + i * 0.15 + 0.1);
        }
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        this.volume = volume;
        if (this.masterGain) {
            this.masterGain.gain.value = volume;
        }
        this.saveSettings();
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
        this.saveSettings();
        return this.enabled;
    }

    // ==========================================
    // OGG Sound Mapping System
    // ==========================================

    loadSoundMappings() {
        try {
            const data = localStorage.getItem('expedition-sound-mappings');
            if (data) this.soundMappings = JSON.parse(data);
        } catch (e) { /* corrupt */ }
        if (!this.soundMappings.equipment) this.soundMappings.equipment = {};
        if (!this.soundMappings.events) this.soundMappings.events = {};
    }

    saveSoundMappings() {
        try {
            localStorage.setItem('expedition-sound-mappings', JSON.stringify(this.soundMappings));
        } catch (e) { /* storage full */ }
    }

    setSoundMapping(type, key, filename) {
        this.soundMappings[type][key] = filename;
        this.saveSoundMappings();
    }

    getSoundMapping(type, key) {
        return this.soundMappings[type]?.[key] || null;
    }

    removeSoundMapping(type, key) {
        delete this.soundMappings[type][key];
        this.saveSoundMappings();
    }

    openSoundDB() {
        return new Promise((resolve, reject) => {
            if (this.soundDB) { resolve(this.soundDB); return; }
            const req = indexedDB.open('expedition-sounds', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'name' });
                }
            };
            req.onsuccess = (e) => {
                this.soundDB = e.target.result;
                resolve(this.soundDB);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async storeSoundFile(filename, arrayBuffer) {
        const db = await this.openSoundDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            tx.objectStore('files').put({ name: filename, data: arrayBuffer });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getSoundFile(filename) {
        const db = await this.openSoundDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readonly');
            const req = tx.objectStore('files').get(filename);
            req.onsuccess = () => resolve(req.result?.data || null);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteSoundFile(filename) {
        const db = await this.openSoundDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            tx.objectStore('files').delete(filename);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadOggBuffer(filename) {
        if (this.audioBufferCache[filename]) return this.audioBufferCache[filename];
        if (!this.context) return null;
        const arrayBuffer = await this.getSoundFile(filename);
        if (!arrayBuffer) return null;
        const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
        this.audioBufferCache[filename] = buffer;
        return buffer;
    }

    playOggBuffer(buffer, volumeMultiplier = 1) {
        if (!buffer || !this.context || !this.masterGain) return;
        const src = this.context.createBufferSource();
        src.buffer = buffer;
        const gain = this.context.createGain();
        gain.gain.value = volumeMultiplier;
        src.connect(gain);
        gain.connect(this.masterGain);
        src.start();
    }

    async preloadMappedSounds() {
        try {
            await this.openSoundDB();
        } catch (e) { return; }

        const filenames = new Set();
        for (const fn of Object.values(this.soundMappings.equipment)) filenames.add(fn);
        for (const fn of Object.values(this.soundMappings.events)) filenames.add(fn);

        for (const fn of filenames) {
            try { await this.loadOggBuffer(fn); } catch (e) { /* skip bad files */ }
        }
    }

    async previewSoundFile(file) {
        if (!this.initialized || !this.context) return;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
        this.playOggBuffer(buffer);
    }

    async previewMappedSound(filename) {
        if (!this.initialized || !this.context) return;
        const buffer = await this.loadOggBuffer(filename);
        if (buffer) this.playOggBuffer(buffer);
    }

    saveSettings() {
        try {
            localStorage.setItem('expedition-audio', JSON.stringify({
                volume: this.volume,
                enabled: this.enabled,
                musicVolume: this.musicVolume,
                musicEnabled: this.musicEnabled,
                trackVolume: this.trackVolume,
            }));
        } catch (e) { /* storage full */ }
    }

    loadSettings() {
        try {
            const data = localStorage.getItem('expedition-audio');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.volume !== undefined) this.volume = parsed.volume;
                if (parsed.enabled !== undefined) this.enabled = parsed.enabled;
                if (parsed.musicVolume !== undefined) this.musicVolume = parsed.musicVolume;
                if (parsed.musicEnabled !== undefined) this.musicEnabled = parsed.musicEnabled;
                if (parsed.trackVolume !== undefined) this.trackVolume = parsed.trackVolume;
            }
        } catch (e) { /* corrupt */ }
    }

    /**
     * Start ambient engine hum (low frequency oscillator)
     */
    startEngineHum() {
        if (!this.initialized || !this.context || this.engineHumNode) return;

        const ctx = this.context;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.value = 35;

        filter.type = 'lowpass';
        filter.frequency.value = 80;
        filter.Q.value = 2;

        gain.gain.value = 0.03;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start();

        this.engineHumNode = osc;
        this.engineHumGain = gain;
    }

    /**
     * Update engine hum volume based on speed
     */
    updateEngineHum(speedFraction) {
        if (!this.engineHumGain) return;
        const vol = 0.01 + speedFraction * 0.04;
        this.engineHumGain.gain.setTargetAtTime(vol, this.context.currentTime, 0.1);
    }

    /**
     * Stop engine hum
     */
    stopEngineHum() {
        if (this.engineHumNode) {
            try { this.engineHumNode.stop(); } catch (e) {}
            this.engineHumNode = null;
            this.engineHumGain = null;
        }
    }

    /**
     * Start station ambient sound (mechanical hum + subtle tone)
     */
    startStationAmbient() {
        if (!this.initialized || !this.context || this.stationAmbientNode) return;

        const ctx = this.context;

        // Low mechanical hum
        const osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.value = 55;

        // Higher harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 110;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;
        filter.Q.value = 1;

        const gain = ctx.createGain();
        gain.gain.value = 0.025;

        const gain2 = ctx.createGain();
        gain2.gain.value = 0.01;

        osc1.connect(filter);
        filter.connect(gain);
        osc2.connect(gain2);
        gain.connect(this.masterGain);
        gain2.connect(this.masterGain);

        osc1.start();
        osc2.start();

        this.stationAmbientNode = osc1;
        this.stationAmbientNode2 = osc2;
        this.stationAmbientGain = gain;
        this.stationAmbientGain2 = gain2;
    }

    /**
     * Stop station ambient sound
     */
    stopStationAmbient() {
        if (this.stationAmbientNode) {
            try { this.stationAmbientNode.stop(); } catch (e) {}
            this.stationAmbientNode = null;
        }
        if (this.stationAmbientNode2) {
            try { this.stationAmbientNode2.stop(); } catch (e) {}
            this.stationAmbientNode2 = null;
        }
        this.stationAmbientGain = null;
        this.stationAmbientGain2 = null;
    }

    // ==========================================
    // Dynamic Music System
    // ==========================================

    /**
     * Start the layered music system
     * Creates all layers at once, crossfades between them
     */
    startMusic() {
        if (!this.initialized || !this.context || this.musicStarted || !this.musicEnabled) return;

        const ctx = this.context;
        this.musicMasterGain = ctx.createGain();
        this.musicMasterGain.gain.value = this.musicVolume;
        this.musicMasterGain.connect(this.masterGain);

        this.musicLayers = {
            ambient: this.createAmbientLayer(ctx),
            combat: this.createCombatLayer(ctx),
            danger: this.createDangerLayer(ctx),
            station: this.createStationMusicLayer(ctx),
        };

        // Synth ambient starts quiet (OGG tracks are the main music)
        this.musicLayers.ambient.gain.gain.value = 0.3;
        this.musicLayers.combat.gain.gain.value = 0.0;
        this.musicLayers.danger.gain.gain.value = 0.0;
        this.musicLayers.station.gain.gain.value = 0.0;

        this.musicMode = 'ambient';
        this.musicTargetMode = 'ambient';
        this.musicStarted = true;

        // Start OGG space music tracks
        this.startSpaceMusic();
    }

    /**
     * Ambient layer: deep space drone with slowly evolving harmonics
     * Inspired by EVE Online's ambient space music
     */
    createAmbientLayer(ctx) {
        const layerGain = ctx.createGain();
        layerGain.gain.value = 0;
        layerGain.connect(this.musicMasterGain);

        const nodes = [];

        // Sub bass drone - very low sine, the foundation
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 38;
        const subGain = ctx.createGain();
        subGain.gain.value = 0.35;
        sub.connect(subGain);
        subGain.connect(layerGain);
        sub.start();
        nodes.push(sub);

        // Low pad - filtered triangle for warmth
        const pad = ctx.createOscillator();
        pad.type = 'triangle';
        pad.frequency.value = 65;
        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 200;
        padFilter.Q.value = 1;
        const padGain = ctx.createGain();
        padGain.gain.value = 0.2;
        pad.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(layerGain);
        pad.start();
        nodes.push(pad);

        // Slow LFO on pad filter for gentle movement
        const padLfo = ctx.createOscillator();
        padLfo.frequency.value = 0.07; // ~14 second cycle
        const padLfoGain = ctx.createGain();
        padLfoGain.gain.value = 60;
        padLfo.connect(padLfoGain);
        padLfoGain.connect(padFilter.frequency);
        padLfo.start();
        nodes.push(padLfo);

        // Chord tones: perfect 5th + octave (ethereal space harmony)
        const chord1 = ctx.createOscillator();
        chord1.type = 'sine';
        chord1.frequency.value = 98; // G2 - perfect 5th above sub
        const chord1Gain = ctx.createGain();
        chord1Gain.gain.value = 0.08;
        chord1.connect(chord1Gain);
        chord1Gain.connect(layerGain);
        chord1.start();
        nodes.push(chord1);

        const chord2 = ctx.createOscillator();
        chord2.type = 'sine';
        chord2.frequency.value = 131; // C3 - octave above sub
        const chord2Gain = ctx.createGain();
        chord2Gain.gain.value = 0.05;
        chord2.connect(chord2Gain);
        chord2Gain.connect(layerGain);
        chord2.start();
        nodes.push(chord2);

        // Very subtle high shimmer with slow vibrato
        const shimmer = ctx.createOscillator();
        shimmer.type = 'sine';
        shimmer.frequency.value = 523; // C5
        const shimmerGain = ctx.createGain();
        shimmerGain.gain.value = 0.015;
        const shimmerLfo = ctx.createOscillator();
        shimmerLfo.frequency.value = 0.15;
        const shimmerLfoGain = ctx.createGain();
        shimmerLfoGain.gain.value = 0.008;
        shimmerLfo.connect(shimmerLfoGain);
        shimmerLfoGain.connect(shimmerGain.gain);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(layerGain);
        shimmer.start();
        shimmerLfo.start();
        nodes.push(shimmer, shimmerLfo);

        return { nodes, gain: layerGain };
    }

    /**
     * Combat layer: tense, pulsing, aggressive
     * Minor key dissonance + rhythmic low pulse
     */
    createCombatLayer(ctx) {
        const layerGain = ctx.createGain();
        layerGain.gain.value = 0;
        layerGain.connect(this.musicMasterGain);

        const nodes = [];

        // Aggressive sub pulse - pulsing bass
        const sub = ctx.createOscillator();
        sub.type = 'sawtooth';
        sub.frequency.value = 45;
        const subFilter = ctx.createBiquadFilter();
        subFilter.type = 'lowpass';
        subFilter.frequency.value = 120;
        subFilter.Q.value = 3;
        const subGain = ctx.createGain();
        subGain.gain.value = 0.25;
        // Rhythmic pulse LFO
        const pulseLfo = ctx.createOscillator();
        pulseLfo.frequency.value = 1.2; // ~72 BPM feel
        const pulseLfoGain = ctx.createGain();
        pulseLfoGain.gain.value = 0.15;
        pulseLfo.connect(pulseLfoGain);
        pulseLfoGain.connect(subGain.gain);
        sub.connect(subFilter);
        subFilter.connect(subGain);
        subGain.connect(layerGain);
        sub.start();
        pulseLfo.start();
        nodes.push(sub, pulseLfo);

        // Minor chord - Cm (C-Eb-G) in low register for tension
        const chordFreqs = [65.4, 77.8, 98]; // C2, Eb2, G2
        chordFreqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = i === 1 ? 'triangle' : 'sine'; // Eb gets triangle for edge
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.value = 0.12 - i * 0.02;
            osc.connect(oscGain);
            oscGain.connect(layerGain);
            osc.start();
            nodes.push(osc);
        });

        // Tension drone - tritone interval (devil's interval)
        const tension = ctx.createOscillator();
        tension.type = 'sine';
        tension.frequency.value = 92.5; // F#2 (tritone from C)
        const tensionGain = ctx.createGain();
        tensionGain.gain.value = 0.04;
        // Slow vibrato for unease
        const tensionLfo = ctx.createOscillator();
        tensionLfo.frequency.value = 3;
        const tensionLfoGain = ctx.createGain();
        tensionLfoGain.gain.value = 2;
        tensionLfo.connect(tensionLfoGain);
        tensionLfoGain.connect(tension.frequency);
        tension.connect(tensionGain);
        tensionGain.connect(layerGain);
        tension.start();
        tensionLfo.start();
        nodes.push(tension, tensionLfo);

        // High staccato ping - repeating metallic hit
        const ping = ctx.createOscillator();
        ping.type = 'sine';
        ping.frequency.value = 880;
        const pingGain = ctx.createGain();
        pingGain.gain.value = 0.0;
        // Fast LFO creates staccato pulsing
        const pingLfo = ctx.createOscillator();
        pingLfo.frequency.value = 2.4; // Double the base pulse
        const pingLfoGain = ctx.createGain();
        pingLfoGain.gain.value = 0.025;
        pingLfo.connect(pingLfoGain);
        pingLfoGain.connect(pingGain.gain);
        ping.connect(pingGain);
        pingGain.connect(layerGain);
        ping.start();
        pingLfo.start();
        nodes.push(ping, pingLfo);

        return { nodes, gain: layerGain };
    }

    /**
     * Danger layer: used when in dangerous sectors without active combat
     * Suspenseful, lurking menace
     */
    createDangerLayer(ctx) {
        const layerGain = ctx.createGain();
        layerGain.gain.value = 0;
        layerGain.connect(this.musicMasterGain);

        const nodes = [];

        // Deep rumble
        const rumble = ctx.createOscillator();
        rumble.type = 'sine';
        rumble.frequency.value = 30;
        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = 0.3;
        // Very slow swell
        const rumbleLfo = ctx.createOscillator();
        rumbleLfo.frequency.value = 0.04; // 25s cycle
        const rumbleLfoGain = ctx.createGain();
        rumbleLfoGain.gain.value = 0.12;
        rumbleLfo.connect(rumbleLfoGain);
        rumbleLfoGain.connect(rumbleGain.gain);
        rumble.connect(rumbleGain);
        rumbleGain.connect(layerGain);
        rumble.start();
        rumbleLfo.start();
        nodes.push(rumble, rumbleLfo);

        // Dissonant minor 2nd cluster
        const dis1 = ctx.createOscillator();
        dis1.type = 'sine';
        dis1.frequency.value = 55; // A1
        const dis2 = ctx.createOscillator();
        dis2.type = 'sine';
        dis2.frequency.value = 58.3; // Bb1 (minor 2nd)
        const dis1Gain = ctx.createGain();
        dis1Gain.gain.value = 0.07;
        const dis2Gain = ctx.createGain();
        dis2Gain.gain.value = 0.06;
        dis1.connect(dis1Gain);
        dis2.connect(dis2Gain);
        dis1Gain.connect(layerGain);
        dis2Gain.connect(layerGain);
        dis1.start();
        dis2.start();
        nodes.push(dis1, dis2);

        // Eerie high tone with slow sweep
        const eerie = ctx.createOscillator();
        eerie.type = 'sine';
        eerie.frequency.value = 660;
        const eerieFilter = ctx.createBiquadFilter();
        eerieFilter.type = 'bandpass';
        eerieFilter.frequency.value = 800;
        eerieFilter.Q.value = 8;
        const eerieGain = ctx.createGain();
        eerieGain.gain.value = 0.02;
        const eerieLfo = ctx.createOscillator();
        eerieLfo.frequency.value = 0.05;
        const eerieLfoGain = ctx.createGain();
        eerieLfoGain.gain.value = 100;
        eerieLfo.connect(eerieLfoGain);
        eerieLfoGain.connect(eerie.frequency);
        eerie.connect(eerieFilter);
        eerieFilter.connect(eerieGain);
        eerieGain.connect(layerGain);
        eerie.start();
        eerieLfo.start();
        nodes.push(eerie, eerieLfo);

        return { nodes, gain: layerGain };
    }

    /**
     * Station layer: calm, mechanical, safe harbor
     */
    createStationMusicLayer(ctx) {
        const layerGain = ctx.createGain();
        layerGain.gain.value = 0;
        layerGain.connect(this.musicMasterGain);

        const nodes = [];

        // Warm pad in major key (C major 7th)
        const padFreqs = [130.8, 164.8, 196, 247]; // C3, E3, G3, B3
        padFreqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const oscGain = ctx.createGain();
            oscGain.gain.value = 0.06 - i * 0.01;
            osc.connect(oscGain);
            oscGain.connect(layerGain);
            osc.start();
            nodes.push(osc);
        });

        // Gentle chime LFO (very slow amplitude modulation on top note)
        const chimeLfo = ctx.createOscillator();
        chimeLfo.frequency.value = 0.12;
        const chimeLfoGain = ctx.createGain();
        chimeLfoGain.gain.value = 0.015;
        chimeLfo.connect(chimeLfoGain);
        // Modulate the B3 tone's gain
        const bOsc = ctx.createOscillator();
        bOsc.type = 'sine';
        bOsc.frequency.value = 494; // B4 - octave shimmer
        const bGain = ctx.createGain();
        bGain.gain.value = 0.0;
        chimeLfo.connect(chimeLfoGain);
        chimeLfoGain.connect(bGain.gain);
        bOsc.connect(bGain);
        bGain.connect(layerGain);
        bOsc.start();
        chimeLfo.start();
        nodes.push(bOsc, chimeLfo);

        // Sub warmth
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 65.4; // C2
        const subGain = ctx.createGain();
        subGain.gain.value = 0.15;
        sub.connect(subGain);
        subGain.connect(layerGain);
        sub.start();
        nodes.push(sub);

        return { nodes, gain: layerGain };
    }

    // ==========================================
    // OGG Music Track Player
    // ==========================================

    /**
     * Shuffle the track order for variety
     */
    shuffleTracks() {
        this.trackShuffleOrder = [...this.spaceTracks.keys()];
        // Fisher-Yates shuffle
        for (let i = this.trackShuffleOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.trackShuffleOrder[i], this.trackShuffleOrder[j]] =
                [this.trackShuffleOrder[j], this.trackShuffleOrder[i]];
        }
        this.trackIndex = 0;
    }

    /**
     * Get the next track path from shuffled order
     */
    getNextTrackPath() {
        if (!this.trackShuffleOrder || this.trackIndex >= this.trackShuffleOrder.length) {
            this.shuffleTracks();
        }
        const idx = this.trackShuffleOrder[this.trackIndex];
        this.trackIndex++;
        return this.spaceTracks[idx];
    }

    /**
     * Start playing space music tracks
     */
    startSpaceMusic() {
        if (!this.musicEnabled || this.trackPlaying) return;
        if (this.spaceTracks.length === 0) return;

        this.shuffleTracks();
        this.trackPlaying = true;
        this.playTrack(this.getNextTrackPath());
    }

    /**
     * Play a specific track with fade-in
     */
    playTrack(src) {
        const audio = new Audio(src);
        audio.volume = 0;
        this.currentTrack = audio;

        audio.onended = () => {
            if (!this.trackPlaying) return;
            // Crossfade to next track
            this.crossfadeToNext();
        };

        audio.onerror = () => {
            // Skip broken track, try next
            if (!this.trackPlaying) return;
            setTimeout(() => this.crossfadeToNext(), 500);
        };

        audio.play().then(() => {
            this.fadeTrack(audio, 0, this.getEffectiveTrackVolume(), 3000);
        }).catch(() => {
            // Autoplay blocked - try next on user interaction
            this.trackPlaying = false;
        });
    }

    /**
     * Crossfade from current track to the next one
     */
    crossfadeToNext() {
        if (!this.trackPlaying) return;

        const oldTrack = this.currentTrack;
        const nextSrc = this.getNextTrackPath();
        const newTrack = new Audio(nextSrc);
        newTrack.volume = 0;
        this.currentTrack = newTrack;

        newTrack.onended = () => {
            if (!this.trackPlaying) return;
            this.crossfadeToNext();
        };

        newTrack.onerror = () => {
            if (!this.trackPlaying) return;
            setTimeout(() => this.crossfadeToNext(), 500);
        };

        newTrack.play().then(() => {
            // Fade in new track
            this.fadeTrack(newTrack, 0, this.getEffectiveTrackVolume(), 3000);
            // Fade out old track
            if (oldTrack) {
                this.fadeTrack(oldTrack, oldTrack.volume, 0, 3000, () => {
                    oldTrack.pause();
                    oldTrack.src = '';
                });
            }
        }).catch(() => {
            // Failed to play next, keep old going
            this.currentTrack = oldTrack;
        });
    }

    /**
     * Fade a track's volume from start to end over duration ms
     */
    fadeTrack(audio, fromVol, toVol, duration, onComplete = null) {
        if (!audio) return;
        const steps = 30;
        const stepTime = duration / steps;
        const volStep = (toVol - fromVol) / steps;
        let step = 0;

        audio.volume = Math.max(0, Math.min(1, fromVol));

        const interval = setInterval(() => {
            step++;
            if (step >= steps || !audio.src) {
                clearInterval(interval);
                try { audio.volume = Math.max(0, Math.min(1, toVol)); } catch (e) {}
                if (onComplete) onComplete();
                return;
            }
            try {
                audio.volume = Math.max(0, Math.min(1, fromVol + volStep * step));
            } catch (e) {
                clearInterval(interval);
            }
        }, stepTime);
    }

    /**
     * Get effective track volume (trackVolume * musicVolume)
     */
    getEffectiveTrackVolume() {
        return Math.min(1, this.trackVolume * (this.musicVolume / 0.12));
    }

    /**
     * Stop space music tracks
     */
    stopSpaceMusic() {
        this.trackPlaying = false;
        if (this.currentTrack) {
            this.fadeTrack(this.currentTrack, this.currentTrack.volume, 0, 1500, () => {
                if (this.currentTrack) {
                    this.currentTrack.pause();
                    this.currentTrack.src = '';
                    this.currentTrack = null;
                }
            });
        }
    }

    /**
     * Duck space music volume (e.g. during mode transitions)
     */
    duckSpaceMusic(targetVol, duration = 2000) {
        if (this.currentTrack && this.trackPlaying) {
            this.fadeTrack(this.currentTrack, this.currentTrack.volume, targetVol, duration);
        }
    }

    /**
     * Restore space music volume after ducking
     */
    unduckSpaceMusic(duration = 2000) {
        if (this.currentTrack && this.trackPlaying) {
            this.fadeTrack(this.currentTrack, this.currentTrack.volume, this.getEffectiveTrackVolume(), duration);
        }
    }

    /**
     * Set the target music mode (crossfades smoothly)
     */
    setMusicMode(mode) {
        if (mode === this.musicTargetMode) return;

        this.musicTargetMode = mode;

        // Handle OGG space music: play in ambient, duck in others
        if (mode === 'ambient') {
            if (!this.trackPlaying && this.musicEnabled) {
                this.startSpaceMusic();
            } else {
                this.unduckSpaceMusic();
            }
        } else if (mode === 'combat' || mode === 'danger') {
            // Duck space music during combat/danger (don't stop - resume on return)
            this.duckSpaceMusic(this.getEffectiveTrackVolume() * 0.15, 2000);
        } else if (mode === 'station') {
            this.duckSpaceMusic(this.getEffectiveTrackVolume() * 0.25, 2000);
        }

        // Handle synth layers
        if (this.musicStarted && this.musicLayers) {
            this.musicTransitionTimer = this.musicTransitionDuration;

            const ctx = this.context;
            const now = ctx.currentTime;
            const fadeDur = this.musicTransitionDuration;

            // In ambient mode, silence synth layers (OGG tracks take over)
            for (const [layerName, layer] of Object.entries(this.musicLayers)) {
                let target;
                if (mode === 'ambient') {
                    // OGG tracks play, synth ambient as subtle underlayer
                    target = layerName === 'ambient' ? 0.3 : 0.0;
                } else {
                    target = layerName === mode ? 1.0 : 0.0;
                }
                layer.gain.gain.cancelScheduledValues(now);
                layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
                layer.gain.gain.linearRampToValueAtTime(target, now + fadeDur);
            }
        }

        this.musicMode = mode;
    }

    /**
     * Stop all music
     */
    stopMusic() {
        // Stop OGG tracks
        this.trackPlaying = false;
        if (this.currentTrack) {
            this.currentTrack.pause();
            this.currentTrack.src = '';
            this.currentTrack = null;
        }

        // Stop synth layers
        if (!this.musicStarted || !this.musicLayers) return;

        for (const layer of Object.values(this.musicLayers)) {
            for (const node of layer.nodes) {
                try { node.stop(); } catch (e) {}
            }
            try { layer.gain.disconnect(); } catch (e) {}
        }

        if (this.musicMasterGain) {
            try { this.musicMasterGain.disconnect(); } catch (e) {}
        }

        this.musicLayers = null;
        this.musicMasterGain = null;
        this.musicStarted = false;
    }

    /**
     * Set music volume
     */
    setMusicVolume(volume) {
        this.musicVolume = volume;
        if (this.musicMasterGain) {
            this.musicMasterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.1);
        }
        // Update OGG track volume too
        if (this.currentTrack && this.trackPlaying) {
            try {
                this.currentTrack.volume = Math.max(0, Math.min(1, this.getEffectiveTrackVolume()));
            } catch (e) {}
        }
    }

    /**
     * Toggle music on/off
     */
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        if (this.musicEnabled) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
        this.saveSettings();
        return this.musicEnabled;
    }
}
