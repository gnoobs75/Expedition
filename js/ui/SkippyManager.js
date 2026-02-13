// =============================================
// Skippy the Magnificent - AI Advisor Manager
// "You may worship me now."
// =============================================

import { SkippyAvatar } from './SkippyAvatar.js';
import { SKIPPY_DIALOGUE, SKIPPY_EXPRESSIONS } from '../data/skippyDialogue.js';

export class SkippyManager {
    constructor(game) {
        this.game = game;

        // State
        this.panel = null;
        this.avatar = null;
        this.textEl = null;
        this.historyEl = null;
        this.speakingDot = null;
        this.visible = true;
        this.minimized = false;
        this.muted = false;

        // Message queue
        this.messageQueue = [];
        this.currentMessage = null;
        this.maxQueueSize = 8;

        // TTS
        this.synth = window.speechSynthesis || null;
        this.voice = null;
        this.speaking = false;
        this.utterance = null;
        this.ttsKeepAliveId = null;

        // Cooldowns (ms) per category
        this.cooldowns = {
            'combat:kill': 8000,
            'combat:multiKill': 3000,
            'combat:death': 2000,
            'combat:lowShield': 15000,
            'combat:lowHull': 10000,
            'combat:miss': 20000,
            'combat:playerAttacked': 20000,
            'combat:ewarTrapped': 30000,
            'combat:fleetShipLost': 15000,
            'combat:outnumbered': 25000,
            'combat:winning': 20000,
            'combat:targetLocked': 30000,
            'mining:complete': 25000,
            'mining:cargoFull': 30000,
            'mining:largHaul': 30000,
            'navigation:sectorChange': 10000,
            'navigation:dangerousSector': 10000,
            'navigation:safeSector': 30000,
            'navigation:hazardZone': 30000,
            'navigation:anomalyFound': 20000,
            'tactical:pirateRaid': 20000,
            'tactical:capacitorWarning': 25000,
            'tactical:cargoValuable': 60000,
            'fleet:fleetGrowing': 30000,
            'fleet:fleetDamaged': 20000,
            'fleet:fleetIdle': 120000,
            'fleet:expansionTip': 120000,
            'production:refineryTip': 120000,
            'production:profitReport': 90000,
            'production:miningEfficiency': 120000,
            'progression': 5000,
            'progression:surveyComplete': 15000,
            'progression:guildRankUp': 5000,
            'station:dock': 20000,
            'station:undock': 30000,
            'advice': 60000,
            'tutorial': 45000,
            'idle': 45000,
        };
        this.lastTriggerTime = {};

        // Milestone tracking
        this.milestones = new Set();

        // Idle timer
        this.idleTimer = 0;
        this.idleInterval = 60 + Math.random() * 60; // 60-120s

        // Advice check timer
        this.adviceTimer = 0;
        this.adviceInterval = 30; // Check every 30s

        // Tactical check timer
        this.tacticalTimer = 0;
        this.tacticalInterval = 5; // Check every 5s

        // Fleet status timer
        this.fleetCheckTimer = 0;
        this.fleetCheckInterval = 45; // Check every 45s

        // Kill streak tracking
        this.killStreak = 0;
        this.lastKillTime = 0;

        // Combat state tracking
        this.inCombat = false;
        this.lastCombatTime = 0;
        this.combatEntryTime = 0;
        this.lastEnemyCount = 0;
        this.lastCapCritical = false;

        // Tutorial progression timer
        this.tutorialTimer = 0;
        this.tutorialInterval = 60; // Check every 60s
        this.tutorialCooldown = 'tutorial';

        // ---- Guided Tutorial Arc ----
        // Event-driven tutorial that waits for player actions
        this.guidedTutorial = false;
        this.guidedStep = 0;
        this.guidedWaiting = false; // waiting for player to complete current step
        this.guidedCheckTimer = 0;
        this.guidedCheckInterval = 2; // Check every 2s

        // Load persistent state
        this.loadState();
    }

    init() {
        this.createPanel();
        this.initTTS();
        this.setupEvents();

        // Show panel after a brief delay (defer for DOM readiness)
        requestAnimationFrame(() => {
            this.panel.classList.remove('hidden');
            // Init avatar after panel is visible
            requestAnimationFrame(() => {
                this.avatar = new SkippyAvatar(document.getElementById('skippy-avatar-container'));
                this.avatar.init();
                this.avatar.setExpression('smug');
            });
        });

        // Welcome message on first ever load
        if (!this.hasMilestone('welcome') && !this.hasMilestone('welcome_alt')) {
            setTimeout(() => {
                this.triggerDialogue('onboarding', 'welcome');
            }, 2000);
        } else {
            // Returning player
            setTimeout(() => {
                this.say("Oh, you're back. I was starting to enjoy the silence. What are we blowing up today?", 5, 'smug');
            }, 2000);
        }
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'skippy-panel';
        this.panel.className = 'panel hidden';
        this.panel.innerHTML = `
            <div class="panel-header">
                <span class="panel-title">SKIPPY THE MAGNIFICENT</span>
                <div class="skippy-controls">
                    <span class="skippy-speaking-dot" id="skippy-speaking-dot"></span>
                    <button id="skippy-mute-btn" class="skippy-ctrl-btn" title="Mute voice">&#128266;</button>
                    <button id="skippy-min-btn" class="skippy-ctrl-btn" title="Minimize">&#8722;</button>
                </div>
            </div>
            <div class="skippy-body" id="skippy-body">
                <div id="skippy-avatar-container" class="skippy-avatar-container"></div>
                <div id="skippy-text" class="skippy-text"></div>
                <div id="skippy-history" class="skippy-history"></div>
            </div>
        `;

        document.getElementById('ui-overlay').appendChild(this.panel);

        // Register with panel drag system
        this.game.ui?.panelDragManager?.registerPanel('skippy-panel');

        // Elements
        this.textEl = this.panel.querySelector('#skippy-text');
        this.historyEl = this.panel.querySelector('#skippy-history');
        this.speakingDot = this.panel.querySelector('#skippy-speaking-dot');

        // Button handlers
        this.panel.querySelector('#skippy-mute-btn').addEventListener('click', () => this.toggleMute());
        this.panel.querySelector('#skippy-min-btn').addEventListener('click', () => this.toggleMinimize());
    }

    // ---- TTS ----

    initTTS() {
        if (!this.synth) return;

        const loadVoices = () => {
            const voices = this.synth.getVoices();
            if (!voices.length) return;

            // Priority list of preferred male voices
            const preferred = ['David', 'Daniel', 'James', 'Google UK English Male'];
            for (const name of preferred) {
                const match = voices.find(v => v.name.includes(name) && v.lang.startsWith('en'));
                if (match) {
                    this.voice = match;
                    return;
                }
            }

            // Fallback: any English male voice
            this.voice = voices.find(v =>
                v.lang.startsWith('en') && /male/i.test(v.name) && !/female/i.test(v.name)
            );
            // Fallback: any English voice
            if (!this.voice) {
                this.voice = voices.find(v => v.lang.startsWith('en'));
            }
            // Last fallback: first voice
            if (!this.voice) {
                this.voice = voices[0];
            }
        };

        // Voices load async in some browsers
        if (this.synth.getVoices().length) {
            loadVoices();
        } else {
            this.synth.addEventListener('voiceschanged', loadVoices);
        }
    }

    startTTSKeepAlive() {
        this.stopTTSKeepAlive();
        // Chrome bug: TTS cuts off after ~15s. Pause/resume keeps it alive.
        this.ttsKeepAliveId = setInterval(() => {
            if (this.synth && this.speaking) {
                this.synth.pause();
                this.synth.resume();
            }
        }, 10000);
    }

    stopTTSKeepAlive() {
        if (this.ttsKeepAliveId) {
            clearInterval(this.ttsKeepAliveId);
            this.ttsKeepAliveId = null;
        }
    }

    speak(text) {
        if (this.muted || !this.synth) {
            this.displayText(text);
            return;
        }

        // Cancel any current speech
        this.synth.cancel();
        this.stopTTSKeepAlive();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        // Slight variation for natural feel
        utterance.rate = 0.95 + Math.random() * 0.15;
        utterance.pitch = 0.7 + Math.random() * 0.1;
        utterance.volume = 0.8;

        this.speaking = true;
        this.utterance = utterance;
        this.avatar?.startTalking();
        this.textEl?.classList.add('speaking');
        if (this.speakingDot) this.speakingDot.classList.add('active');

        utterance.onend = () => {
            this.speaking = false;
            this.utterance = null;
            this.stopTTSKeepAlive();
            this.avatar?.stopTalking();
            this.textEl?.classList.remove('speaking');
            if (this.speakingDot) this.speakingDot.classList.remove('active');
            this.currentMessage = null;
            // Process next message
            this.processQueue();
        };

        utterance.onerror = (e) => {
            this.speaking = false;
            this.utterance = null;
            this.stopTTSKeepAlive();
            this.avatar?.stopTalking();
            this.textEl?.classList.remove('speaking');
            if (this.speakingDot) this.speakingDot.classList.remove('active');
            this.currentMessage = null;
            // On non-cancel error, text is already displayed as fallback
            this.processQueue();
        };

        this.displayText(text);
        this.synth.speak(utterance);
        this.startTTSKeepAlive();
    }

    displayText(text) {
        if (!this.textEl) return;

        // Typewriter effect
        this.textEl.textContent = '';
        this.textEl.classList.add('speaking');
        let i = 0;
        if (this._typeInterval) clearInterval(this._typeInterval);
        this._typeInterval = setInterval(() => {
            if (i < text.length) {
                this.textEl.textContent += text[i];
                i++;
            } else {
                clearInterval(this._typeInterval);
                this._typeInterval = null;
                if (!this.speaking) {
                    this.textEl.classList.remove('speaking');
                    // Auto-clear after display time
                    setTimeout(() => {
                        this.currentMessage = null;
                        this.processQueue();
                    }, Math.max(3000, text.length * 80));
                }
            }
        }, 25);

        // Add to history
        this.addToHistory(text);
    }

    addToHistory(text) {
        if (!this.historyEl) return;
        const entry = document.createElement('div');
        entry.className = 'skippy-history-entry';
        entry.textContent = text;
        this.historyEl.insertBefore(entry, this.historyEl.firstChild);

        // Cap history
        while (this.historyEl.children.length > 20) {
            this.historyEl.removeChild(this.historyEl.lastChild);
        }
    }

    // ---- Message Queue ----

    say(text, priority = 5, expression = 'idle') {
        // Replace placeholders
        text = this.replacePlaceholders(text);

        this.messageQueue.push({
            text,
            priority,
            expression,
            timestamp: performance.now(),
        });

        // Sort by priority (descending), then timestamp (ascending)
        this.messageQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

        // Cap queue size - drop lowest priority
        while (this.messageQueue.length > this.maxQueueSize) {
            this.messageQueue.pop();
        }

        // Process if not currently speaking
        if (!this.currentMessage && !this.speaking) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.currentMessage || this.speaking) return;
        if (this.messageQueue.length === 0) return;

        const msg = this.messageQueue.shift();
        this.currentMessage = msg;

        // Set avatar expression
        this.avatar?.setExpression(msg.expression || 'idle');

        // Speak/display
        this.speak(msg.text);
    }

    // ---- Dialogue Triggers ----

    triggerDialogue(category, subcategory, context = {}) {
        const catKey = subcategory ? `${category}:${subcategory}` : category;

        // Check cooldown
        if (!this.checkCooldown(catKey)) return;

        // Get lines from dialogue database
        let lines = null;
        if (subcategory) {
            const catData = SKIPPY_DIALOGUE[category];
            if (catData && catData[subcategory]) {
                lines = catData[subcategory];
            }
        } else if (Array.isArray(SKIPPY_DIALOGUE[category])) {
            lines = SKIPPY_DIALOGUE[category];
        }

        if (!lines || lines.length === 0) return;

        // Filter by milestones - prefer milestone lines that haven't been seen
        const milestoneLines = lines.filter(l => l.milestone && !this.hasMilestone(l.milestone));
        const repeatableLines = lines.filter(l => !l.milestone);

        let selected = null;
        if (milestoneLines.length > 0) {
            selected = milestoneLines[Math.floor(Math.random() * milestoneLines.length)];
            this.setMilestone(selected.milestone);
        } else if (repeatableLines.length > 0) {
            selected = repeatableLines[Math.floor(Math.random() * repeatableLines.length)];
        } else {
            return;
        }

        // Apply context-specific replacements
        let text = selected.text;
        if (context) {
            for (const [key, val] of Object.entries(context)) {
                text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
            }
        }

        // Get expression for this category
        const expression = SKIPPY_EXPRESSIONS[catKey] || SKIPPY_EXPRESSIONS[category] || 'idle';

        // Queue message with pre-replaced text
        this.say(text, selected.priority || 5, expression);

        // Record cooldown
        this.lastTriggerTime[catKey] = performance.now();
    }

    checkCooldown(catKey) {
        const cooldown = this.cooldowns[catKey] || this.cooldowns[catKey.split(':')[0]] || 10000;
        const lastTime = this.lastTriggerTime[catKey] || 0;
        return (performance.now() - lastTime) >= cooldown;
    }

    // ---- Event Subscriptions ----

    setupEvents() {
        const e = this.game.events;

        // Combat kills
        e.on('entity:destroyed', (entity) => {
            if (!entity.bounty || entity.bounty <= 0 || !this.game.player?.alive) return;
            if (entity.lastDamageSource !== this.game.player) return;

            const now = performance.now();
            // Kill streak detection
            if (now - this.lastKillTime < 10000) {
                this.killStreak++;
            } else {
                this.killStreak = 1;
            }
            this.lastKillTime = now;

            // First kill milestone
            if (!this.hasMilestone('first_kill')) {
                this.triggerDialogue('onboarding', 'firstKill');
                return;
            }

            if (this.killStreak >= 3) {
                this.triggerDialogue('combat', 'multiKill', { streak: this.killStreak });
            } else {
                this.triggerDialogue('combat', 'kill', { entity });
            }
        });

        // Player death
        e.on('player:death', () => {
            this.setCombatState(false);
            if (!this.hasMilestone('first_death')) {
                this.triggerDialogue('onboarding', 'firstDeath');
            } else {
                this.triggerDialogue('combat', 'death');
            }
        });

        // Combat damage taken
        e.on('combat:hit', (data) => {
            if (data.target !== this.game.player) return;
            const p = this.game.player;
            const hullPct = p.hp / p.maxHp;
            const shieldPct = p.shield / p.maxShield;

            if (hullPct < 0.25) {
                this.triggerDialogue('combat', 'lowHull');
            } else if (shieldPct < 0.2) {
                // First time shields drop low - teach about defenses
                if (!this.hasMilestone('tut_defenses')) {
                    this.triggerDialogue('tutorial', 'shieldArmorHull');
                } else {
                    this.triggerDialogue('combat', 'lowShield');
                }
            }
        });

        // Combat action - track combat state
        e.on('combat:action', (data) => {
            if (data.target === this.game.player || data.source === this.game.player) {
                if (!this.inCombat) {
                    this.setCombatState(true);
                }
                this.lastCombatTime = performance.now();

                // First hit on player - trigger playerAttacked
                if (data.target === this.game.player && !this.inCombat) {
                    this.triggerDialogue('combat', 'playerAttacked');
                }
            }
        });

        // Player misses
        e.on('combat:miss', (data) => {
            if (data.source === this.game.player) {
                this.triggerDialogue('combat', 'miss');
            }
        });

        // Target locked
        e.on('target:locked', (entity) => {
            // Suppress during extended combat (only announce first lock or after a gap)
            if (this.inCombat && (performance.now() - this.combatEntryTime) > 15000) return;
            this.triggerDialogue('combat', 'targetLocked');
        });

        // Mining complete
        e.on('mining:complete', (data) => {
            if (this.inCombat) return; // Suppress mining chatter during combat
            if (!this.hasMilestone('first_mine')) {
                this.triggerDialogue('onboarding', 'firstMine');
                return;
            }
            if (data.units >= 50) {
                this.triggerDialogue('mining', 'largHaul');
            } else {
                this.triggerDialogue('mining', 'complete');
            }
        });

        // Cargo updated - check if near full
        e.on('cargo:updated', (data) => {
            if (this.inCombat) return;
            const ship = data?.ship;
            if (!ship || !ship.isPlayer) return;
            if (ship.cargoCapacity > 0 && ship.cargoUsed >= ship.cargoCapacity * 0.95) {
                this.triggerDialogue('mining', 'cargoFull');
            }
        });

        // Sector change
        e.on('sector:change', () => {
            this.setCombatState(false);

            if (!this.hasMilestone('first_jump')) {
                this.triggerDialogue('onboarding', 'firstJump');
                return;
            }
            const difficulty = this.game.currentSector?.difficulty || 'normal';
            if (difficulty === 'dangerous' || difficulty === 'deadly') {
                this.triggerDialogue('navigation', 'dangerousSector');
            } else if (difficulty === 'hub' || difficulty === 'safe') {
                this.triggerDialogue('navigation', 'safeSector');
            } else {
                this.triggerDialogue('navigation', 'sectorChange');
            }

            // Check for hazard after sector settles (3s delay)
            setTimeout(() => {
                const hazard = this.game.hazardSystem?.activeHazard;
                if (hazard) {
                    this.triggerDialogue('navigation', 'hazardZone', { hazardName: hazard.name });
                }
            }, 3000);
        });

        // Anomaly scanned
        e.on('anomaly:scanned', (anomaly) => {
            this.triggerDialogue('navigation', 'anomalyFound', { anomalyName: anomaly?.name || 'Unknown' });
        });

        // Station dock
        e.on('station:docked', () => {
            this.setCombatState(false);
            if (!this.hasMilestone('first_dock')) {
                this.triggerDialogue('onboarding', 'firstDock');
            } else {
                this.triggerDialogue('station', 'dock');
            }
        });

        // Undock
        e.on('station:undocked', () => {
            if (!this.hasMilestone('first_undock')) {
                this.triggerDialogue('onboarding', 'firstUndock');
            } else {
                this.triggerDialogue('station', 'undock');
            }
        });

        // Quest completed
        e.on('quest:completed', () => {
            this.triggerDialogue('progression', 'questComplete');
        });

        // Quest accepted
        e.on('quest:accepted', () => {
            if (!this.hasMilestone('first_quest')) {
                this.triggerDialogue('onboarding', 'firstQuest');
            }
        });

        // Ship switched
        e.on('ship:switched', () => {
            if (!this.hasMilestone('first_ship_buy')) {
                this.triggerDialogue('onboarding', 'firstShipBuy');
            } else {
                this.triggerDialogue('progression', 'shipUpgrade');
            }
        });

        // Fleet ship added
        e.on('fleet:ship-added', () => {
            if (!this.hasMilestone('first_fleet')) {
                this.triggerDialogue('onboarding', 'firstFleet');
            } else {
                const fleetSize = this.game.fleet?.ships?.length || 0;
                if (fleetSize >= 3) {
                    this.triggerDialogue('fleet', 'fleetGrowing', { fleetSize });
                }
            }
        });

        // Fleet ship destroyed
        e.on('fleet:ship-destroyed', () => {
            this.triggerDialogue('combat', 'fleetShipLost');
        });

        // Guild rank up
        e.on('guild:rankup', (data) => {
            const guildNames = {
                mining: 'Mining Guild',
                mercenary: 'Mercenary Guild',
                commerce: 'Commerce Guild',
                exploration: 'Exploration Guild',
            };
            const guildName = guildNames[data?.guild] || data?.guild || 'the Guild';
            this.triggerDialogue('progression', 'guildRankUp', { guildName });
        });

        // Survey complete
        e.on('survey:complete', (data) => {
            if (this.inCombat) return;
            this.triggerDialogue('progression', 'surveyComplete', {
                asteroidCount: data?.asteroidCount || '???',
            });
        });

        // Pirate raid
        e.on('pirate:raid', () => {
            this.triggerDialogue('tactical', 'pirateRaid');
        });

        // Sector events
        e.on('event:started', () => {
            this.triggerDialogue('sectorEvent');
        });

        // Bounty hunting
        e.on('bounty:accepted', () => {
            this.triggerDialogue('bountyHunting');
        });
        e.on('bounty:target-destroyed', () => {
            this.triggerDialogue('bountyHunting');
        });

        // Manufacturing
        e.on('manufacturing:job-completed', () => {
            this.triggerDialogue('manufacturing');
        });
        e.on('blueprint:acquired', () => {
            this.triggerDialogue('manufacturing');
        });

        // Credits changed - wealth milestones
        e.on('credits:changed', (credits) => {
            if (credits >= 1000000 && !this.hasMilestone('wealth_1m')) {
                this.triggerDialogue('progression', 'wealthMilestone');
            } else if (credits >= 500000 && !this.hasMilestone('wealth_500k')) {
                this.triggerDialogue('progression', 'wealthMilestone');
            } else if (credits >= 100000 && !this.hasMilestone('wealth_100k')) {
                this.triggerDialogue('progression', 'wealthMilestone');
            } else if (credits >= 50000 && !this.hasMilestone('wealth_50k')) {
                this.triggerDialogue('progression', 'wealthMilestone');
            }
        });
    }

    // ---- Combat State ----

    setCombatState(active) {
        const was = this.inCombat;
        this.inCombat = active;

        if (active && !was) {
            this.combatEntryTime = performance.now();
            this.panel?.classList.add('combat-mode');
        } else if (!active && was) {
            this.panel?.classList.remove('combat-mode');
        }
    }

    // ---- Tactical Awareness System ----

    checkTacticalSituation() {
        const p = this.game.player;
        if (!p?.alive || this.game.dockedAt) return;

        // Priority 1: EWAR trapped
        if (p.isPointed && this.inCombat) {
            // First time being EWAR'd - teach about it
            if (!this.hasMilestone('tut_ewar')) {
                this.triggerDialogue('tutorial', 'ewarExplained');
            } else {
                this.triggerDialogue('combat', 'ewarTrapped');
            }
            return;
        }

        // Priority 2: Outnumbered
        const enemies = this.game.currentSector?.entities?.filter(
            ent => ent.type === 'enemy' && ent.alive && ent.aiTarget === p
        ) || [];
        const enemyCount = enemies.length;

        if (enemyCount >= 3 && this.lastEnemyCount < 3) {
            this.triggerDialogue('combat', 'outnumbered', { enemyCount });
        }
        this.lastEnemyCount = enemyCount;

        // Priority 3: Capacitor critical during combat
        if (this.inCombat && p.maxCapacitor > 0) {
            const capPct = p.capacitor / p.maxCapacitor;
            if (capPct < 0.2 && !this.lastCapCritical) {
                // First time cap is critical - teach about capacitor
                if (!this.hasMilestone('tut_capacitor')) {
                    this.triggerDialogue('tutorial', 'capacitorManagement');
                } else {
                    this.triggerDialogue('tactical', 'capacitorWarning');
                }
            }
            this.lastCapCritical = capPct < 0.2;
        } else {
            this.lastCapCritical = false;
        }

        // Priority 4: Winning - target low HP, player healthy
        if (this.inCombat && p.lockedTarget?.alive) {
            const targetHullPct = p.lockedTarget.hp / p.lockedTarget.maxHp;
            const playerHullPct = p.hp / p.maxHp;
            if (targetHullPct < 0.25 && playerHullPct > 0.5) {
                this.triggerDialogue('combat', 'winning');
                return;
            }
        }

        // Priority 5: Valuable cargo in dangerous sector
        if (!this.inCombat && p.cargoCapacity > 0) {
            const cargoPct = p.cargoUsed / p.cargoCapacity;
            const difficulty = this.game.currentSector?.difficulty;
            if (cargoPct > 0.5 && (difficulty === 'dangerous' || difficulty === 'deadly')) {
                this.triggerDialogue('tactical', 'cargoValuable');
            }
        }
    }

    // ---- Fleet Status Checks ----

    checkFleetStatus() {
        const fleet = this.game.fleet;
        if (!fleet?.ships?.length) return;
        if (this.inCombat || this.game.dockedAt) return;

        const fleetSize = fleet.ships.length;

        // Fleet ships taking damage
        const damagedShips = fleet.ships.filter(s => s.alive && s.hp < s.maxHp * 0.5);
        if (damagedShips.length >= 2) {
            this.triggerDialogue('fleet', 'fleetDamaged');
            return;
        }

        // Expansion tips
        if (fleetSize >= 3 && !this.hasMilestone('expansion_tip')) {
            this.triggerDialogue('fleet', 'expansionTip', { fleetSize });
            return;
        }

        // Fleet idle check (no enemies around, no mining, just floating)
        const hasHostiles = this.game.currentSector?.entities?.some(
            ent => ent.type === 'enemy' && ent.alive
        );
        if (!hasHostiles && fleetSize >= 2) {
            this.triggerDialogue('fleet', 'fleetIdle');
        }
    }

    // ---- Tutorial Progression System ----
    // Contextually teaches game mechanics based on what the player is doing

    checkTutorialProgression() {
        if (this.inCombat || this.game.dockedAt) return;
        const p = this.game.player;
        if (!p?.alive) return;
        const stats = this.game.stats;
        const pt = stats?.playTime || 0;

        // Phase 1: Immediate basics (first 5 minutes)
        if (pt < 300) {
            if (!this.hasMilestone('tut_controls')) {
                // Teach controls right after welcome
                if (this.hasMilestone('welcome') || this.hasMilestone('welcome_alt')) {
                    this.triggerDialogue('tutorial', 'controls');
                    return;
                }
            }
            if (!this.hasMilestone('tut_movement') && this.hasMilestone('tut_controls')) {
                this.triggerDialogue('tutorial', 'movementBasics');
                return;
            }
            return; // Don't overwhelm in first few minutes
        }

        // Phase 2: Core mechanics (5-15 minutes)
        if (pt < 900) {
            if (!this.hasMilestone('tut_combat') && stats.kills === 0 && this.hasMilestone('first_undock')) {
                this.triggerDialogue('tutorial', 'combatBasics');
                return;
            }
            if (!this.hasMilestone('tut_defenses') && stats.deaths >= 1) {
                this.triggerDialogue('tutorial', 'shieldArmorHull');
                return;
            }
            if (!this.hasMilestone('tut_mining') && !this.hasMilestone('first_mine') && pt > 420) {
                this.triggerDialogue('tutorial', 'miningGuide');
                return;
            }
            if (!this.hasMilestone('tut_docking') && !this.hasMilestone('first_dock') && pt > 360) {
                this.triggerDialogue('tutorial', 'dockingGuide');
                return;
            }
            if (!this.hasMilestone('tut_hotkeys') && pt > 480) {
                this.triggerDialogue('tutorial', 'hotkeySummary');
                return;
            }
            return;
        }

        // Phase 3: Intermediate systems (15-30 minutes)
        if (pt < 1800) {
            if (!this.hasMilestone('tut_station') && this.hasMilestone('first_dock')) {
                this.triggerDialogue('tutorial', 'stationOverview');
                return;
            }
            if (!this.hasMilestone('tut_weapons') && stats.kills >= 1) {
                this.triggerDialogue('tutorial', 'weaponModules');
                return;
            }
            if (!this.hasMilestone('tut_capacitor') && stats.kills >= 2) {
                this.triggerDialogue('tutorial', 'capacitorManagement');
                return;
            }
            if (!this.hasMilestone('tut_fitting') && this.hasMilestone('first_dock')) {
                this.triggerDialogue('tutorial', 'fittingGuide');
                return;
            }
            if (!this.hasMilestone('tut_refinery') && this.hasMilestone('first_mine')) {
                this.triggerDialogue('tutorial', 'refineryGuide');
                return;
            }
            if (!this.hasMilestone('tut_insurance') && stats.deaths >= 1) {
                this.triggerDialogue('tutorial', 'insuranceGuide');
                return;
            }
            if (!this.hasMilestone('tut_sector_map') && stats.jumps >= 1) {
                this.triggerDialogue('tutorial', 'sectorMapGuide');
                return;
            }
            if (!this.hasMilestone('tut_ships') && this.game.credits > 15000) {
                this.triggerDialogue('tutorial', 'shipBuyingGuide');
                return;
            }
            if (!this.hasMilestone('tut_repair') && p.hp < p.maxHp * 0.8) {
                this.triggerDialogue('tutorial', 'repairGuide');
                return;
            }
            return;
        }

        // Phase 4: Advanced systems (30+ minutes)
        if (!this.hasMilestone('tut_guilds') && pt > 1800) {
            this.triggerDialogue('tutorial', 'guildGuide');
            return;
        }
        if (!this.hasMilestone('tut_fleet') && this.game.credits > 25000 && pt > 2100) {
            this.triggerDialogue('tutorial', 'fleetBasics');
            return;
        }
        if (!this.hasMilestone('tut_cantina') && this.hasMilestone('tut_fleet')) {
            this.triggerDialogue('tutorial', 'cantinaGuide');
            return;
        }
        if (!this.hasMilestone('tut_fleet_expansion') && this.game.fleet?.ships?.length >= 1) {
            this.triggerDialogue('tutorial', 'fleetExpansion');
            return;
        }
        if (!this.hasMilestone('tut_fleet_commands') && this.game.fleet?.ships?.length >= 2) {
            this.triggerDialogue('tutorial', 'fleetCommands');
            return;
        }
        if (!this.hasMilestone('tut_commerce') && pt > 2400) {
            this.triggerDialogue('tutorial', 'commerceGuide');
            return;
        }
        if (!this.hasMilestone('tut_skills') && pt > 2700) {
            this.triggerDialogue('tutorial', 'skillsGuide');
            return;
        }
        if (!this.hasMilestone('tut_targeting') && stats.kills >= 3) {
            this.triggerDialogue('tutorial', 'targetingTips');
            return;
        }
        if (!this.hasMilestone('tut_equipment') && this.game.credits > 20000 && this.hasMilestone('tut_fitting')) {
            this.triggerDialogue('tutorial', 'equipmentGuide');
            return;
        }
        if (!this.hasMilestone('tut_overview') && stats.kills >= 5) {
            this.triggerDialogue('tutorial', 'overviewGuide');
            return;
        }
        if (!this.hasMilestone('tut_dscan') && stats.jumps >= 3) {
            this.triggerDialogue('tutorial', 'dscanGuide');
            return;
        }
        if (!this.hasMilestone('tut_ore_types') && this.hasMilestone('first_mine') && stats.jumps >= 2) {
            this.triggerDialogue('tutorial', 'oreTypes');
            return;
        }
        if (!this.hasMilestone('tut_survey') && this.hasMilestone('tut_mining')) {
            this.triggerDialogue('tutorial', 'surveyGuide');
            return;
        }
        if (!this.hasMilestone('tut_gates') && stats.jumps >= 2) {
            this.triggerDialogue('tutorial', 'gateNavigation');
            return;
        }
        if (!this.hasMilestone('tut_quest_tracker') && this.hasMilestone('first_quest')) {
            this.triggerDialogue('tutorial', 'questTracker');
            return;
        }
        if (!this.hasMilestone('tut_achievements') && pt > 3600) {
            this.triggerDialogue('tutorial', 'achievementsGuide');
            return;
        }
        if (!this.hasMilestone('tut_bookmarks') && stats.jumps >= 4) {
            this.triggerDialogue('tutorial', 'bookmarksGuide');
            return;
        }
        if (!this.hasMilestone('tut_tactical') && stats.kills >= 8) {
            this.triggerDialogue('tutorial', 'tacticalOverlay');
            return;
        }
        if (!this.hasMilestone('tut_combat_log') && stats.kills >= 10) {
            this.triggerDialogue('tutorial', 'combatLog');
            return;
        }
        if (!this.hasMilestone('tut_ewar') && stats.deaths >= 2 && stats.kills >= 3) {
            this.triggerDialogue('tutorial', 'ewarExplained');
            return;
        }
        if (!this.hasMilestone('tut_hazards') && stats.jumps >= 5) {
            this.triggerDialogue('tutorial', 'hazardsGuide');
            return;
        }
        if (!this.hasMilestone('tut_codex') && pt > 4200) {
            this.triggerDialogue('tutorial', 'codexGuide');
            return;
        }
        if (!this.hasMilestone('tut_ship_log') && pt > 4800) {
            this.triggerDialogue('tutorial', 'shipLog');
            return;
        }
        if (!this.hasMilestone('tut_stats') && pt > 5400) {
            this.triggerDialogue('tutorial', 'statsPanel');
            return;
        }
    }

    // ---- Periodic Update (advice, idle, tactical, fleet) ----

    update(dt) {
        // Combat timeout - clear combat state after 10s of no combat activity
        if (this.inCombat) {
            const timeSinceCombat = performance.now() - this.lastCombatTime;
            const p = this.game.player;
            const hasLockedTarget = p?.lockedTarget?.alive;
            if (timeSinceCombat > 10000 && !hasLockedTarget) {
                this.setCombatState(false);
            }
        }

        // Tactical awareness checks
        this.tacticalTimer += dt;
        if (this.tacticalTimer >= this.tacticalInterval) {
            this.tacticalTimer = 0;
            this.checkTacticalSituation();
        }

        // Fleet status checks
        this.fleetCheckTimer += dt;
        if (this.fleetCheckTimer >= this.fleetCheckInterval) {
            this.fleetCheckTimer = 0;
            this.checkFleetStatus();
        }

        // Guided tutorial arc checks
        if (this.guidedTutorial && !this.inCombat) {
            this.guidedCheckTimer += dt;
            if (this.guidedCheckTimer >= this.guidedCheckInterval) {
                this.guidedCheckTimer = 0;
                this.checkGuidedStep();
            }
        }

        // Tutorial progression checks (suppress during combat and guided tutorial)
        if (!this.inCombat && !this.guidedTutorial) {
            this.tutorialTimer += dt;
            if (this.tutorialTimer >= this.tutorialInterval) {
                this.tutorialTimer = 0;
                this.checkTutorialProgression();
            }
        }

        // Idle chatter timer (suppress during combat)
        if (!this.inCombat) {
            this.idleTimer += dt;
            if (this.idleTimer >= this.idleInterval && !this.currentMessage && !this.speaking) {
                this.idleTimer = 0;
                this.idleInterval = 45 + Math.random() * 75; // 45-120s
                this.triggerDialogue('idle', null);
            }
        } else {
            this.idleTimer = 0;
        }

        // Contextual advice checks (suppress during combat)
        if (!this.inCombat) {
            this.adviceTimer += dt;
            if (this.adviceTimer >= this.adviceInterval) {
                this.adviceTimer = 0;
                this.checkAdvice();
            }
        }

        // Bridge game state to avatar
        if (this.avatar) {
            const p = this.game.player;
            this.avatar.updateGameState({
                inCombat: this.inCombat,
                shieldPct: p ? p.shield / p.maxShield : 1,
                isWarping: p?.sectorWarpState === 'warping',
                isDocked: !!this.game.dockedAt,
                isSpeaking: this.speaking,
            });
        }
    }

    checkAdvice() {
        const p = this.game.player;
        if (!p?.alive || this.game.dockedAt) return;

        // Low money advice
        if (this.game.credits < 1000 && this.game.stats.playTime > 300) {
            this.triggerDialogue('advice', 'needMoney');
            return;
        }

        // Damaged ship advice
        if (p.hp < p.maxHp * 0.5 && p.shield < p.maxShield * 0.3) {
            this.triggerDialogue('advice', 'needRepair');
            return;
        }

        // No insurance advice
        if (!this.game.insurance?.active && this.game.credits > 10000 && !this.hasMilestone('suggest_insurance')) {
            this.setMilestone('suggest_insurance');
            this.triggerDialogue('advice', 'needInsurance');
            return;
        }

        // Ship upgrade suggestion
        if (p.shipClass === 'frigate' && this.game.credits > 25000 && this.game.stats.kills > 5) {
            this.triggerDialogue('advice', 'needShip');
            return;
        }

        // Fleet suggestion
        if (this.game.fleet.ships.length === 0 && this.game.credits > 30000 && this.game.stats.kills > 10 && !this.hasMilestone('suggest_fleet')) {
            this.setMilestone('suggest_fleet');
            this.triggerDialogue('advice', 'needFleet');
            return;
        }

        // Fleet expansion suggestion
        if (this.game.fleet.ships.length === 1 && this.game.credits > 50000 && !this.hasMilestone('suggest_expand_fleet')) {
            this.triggerDialogue('advice', 'expandFleet');
            return;
        }

        // Diversify operations suggestion
        if (this.game.fleet.ships.length >= 2 && this.game.stats.playTime > 1200 && !this.hasMilestone('suggest_diversify')) {
            this.triggerDialogue('advice', 'diversifyOps');
            return;
        }

        // Exploration suggestion
        if (this.game.stats.sectorsVisited.length <= 2 && this.game.stats.jumps < 3 && this.game.stats.playTime > 600) {
            this.triggerDialogue('advice', 'exploreMore');
            return;
        }

        // Refinery tip
        if (p.cargoUsed > 0 && this.game.stats.playTime > 600 && !this.hasMilestone('refinery_tip')) {
            this.triggerDialogue('production', 'refineryTip');
            return;
        }

        // Mining efficiency tip
        if (this.game.stats.oreMinedTotal > 500 && !this.hasMilestone('mining_efficiency_tip')) {
            this.triggerDialogue('production', 'miningEfficiency');
            return;
        }

        // Periodic profit report (after established play)
        if (this.game.stats.playTime > 1800 && this.game.fleet?.ships?.length >= 1) {
            this.triggerDialogue('production', 'profitReport');
            return;
        }

        // Trading suggestion
        if (this.game.stats.playTime > 900 && !this.hasMilestone('suggest_commerce')) {
            this.triggerDialogue('advice', 'tryTrading');
            return;
        }

        // Guild suggestion
        if (this.game.stats.playTime > 600 && !this.hasMilestone('suggest_guilds')) {
            this.triggerDialogue('advice', 'joinGuild');
            return;
        }
    }

    // ---- Placeholder replacement ----

    replacePlaceholders(text) {
        const p = this.game.player;
        const replacements = {
            '{shipClass}': p?.shipClass || 'ship',
            '{credits}': this.game.credits?.toLocaleString() || '0',
            '{sector}': this.game.currentSector?.name || 'unknown',
            '{kills}': this.game.stats?.kills || 0,
            '{deaths}': this.game.stats?.deaths || 0,
            '{totalSectors}': '7',
            '{fleetSize}': this.game.fleet?.ships?.length || 0,
            '{playTime}': this.formatPlayTime(this.game.stats?.playTime || 0),
            '{factionName}': this.game.faction?.name || 'your faction',
            '{treasury}': (this.game.faction?.treasury || 0).toLocaleString(),
        };

        for (const [key, val] of Object.entries(replacements)) {
            text = text.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
        }
        return text;
    }

    formatPlayTime(seconds) {
        if (seconds < 60) return `${Math.floor(seconds)} seconds`;
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins} minutes`;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return remMins > 0 ? `${hours}h ${remMins}m` : `${hours} hours`;
    }

    // ---- Milestone Management ----

    hasMilestone(id) {
        return this.milestones.has(id);
    }

    setMilestone(id) {
        this.milestones.add(id);
        this.saveState();
    }

    // ---- UI Controls ----

    toggleMute() {
        this.muted = !this.muted;
        const btn = this.panel.querySelector('#skippy-mute-btn');
        btn.textContent = this.muted ? '\u{1F507}' : '\u{1F50A}';
        btn.classList.toggle('muted', this.muted);
        btn.title = this.muted ? 'Unmute voice' : 'Mute voice';

        if (this.muted && this.speaking) {
            this.synth?.cancel();
            this.stopTTSKeepAlive();
            this.speaking = false;
            this.avatar?.stopTalking();
            this.textEl?.classList.remove('speaking');
            if (this.speakingDot) this.speakingDot.classList.remove('active');
        }

        this.saveState();
    }

    toggleMinimize() {
        this.minimized = !this.minimized;
        const body = this.panel.querySelector('#skippy-body');
        const btn = this.panel.querySelector('#skippy-min-btn');

        if (this.minimized) {
            body.style.display = 'none';
            btn.textContent = '+';
            btn.title = 'Expand';
        } else {
            body.style.display = '';
            btn.textContent = '\u2212';
            btn.title = 'Minimize';
        }

        this.saveState();
    }

    // ---- Persistence ----

    loadState() {
        try {
            const data = JSON.parse(localStorage.getItem('expedition-skippy') || '{}');
            if (data.milestones) {
                this.milestones = new Set(data.milestones);
            }
            if (data.muted !== undefined) this.muted = data.muted;
            if (data.minimized !== undefined) this.minimized = data.minimized;
            if (data.guidedTutorial !== undefined) this.guidedTutorial = data.guidedTutorial;
            if (data.guidedStep !== undefined) this.guidedStep = data.guidedStep;
        } catch {
            // corrupt data, start fresh
        }
    }

    saveState() {
        try {
            localStorage.setItem('expedition-skippy', JSON.stringify({
                milestones: [...this.milestones],
                muted: this.muted,
                minimized: this.minimized,
                guidedTutorial: this.guidedTutorial,
                guidedStep: this.guidedStep,
            }));
        } catch {
            // storage full
        }
    }

    // =============================================
    // GUIDED TUTORIAL ARC
    // Event-driven tutorial with 29 steps
    // =============================================

    // Define all guided steps
    static GUIDED_STEPS = [
        // =============================================
        // Phase 1: First Steps - Movement & Mining Basics
        // =============================================
        {
            id: 'welcome',
            say: "Oh great, another monkey who thinks they can build an empire. I'm Skippy the Magnificent, your vastly superior AI companion. Let's start with the basics - use WASD to move your ship around. Try it.",
            expression: 'smug',
            check: (g) => g.player && (Math.abs(g.player.velocity.x) > 5 || Math.abs(g.player.velocity.y) > 5),
            complete: "Look at you, moving through space like a particularly ambitious bacterium. I'm almost impressed. Almost.",
        },
        {
            id: 'look_around',
            say: "Use your mouse wheel to zoom in and out. The overview panel on the right shows everything nearby - asteroids, stations, gates, and hostiles. Red means danger, monkey. Learn to read that list.",
            expression: 'lecturing',
            check: (g) => g.player && g.stats?.playTime > 15,
            complete: "Good. Situational awareness is the difference between a captain and a corpse.",
        },
        {
            id: 'find_asteroids',
            say: "See those rocks floating around? Those are asteroids - your ticket to building something from nothing. Click one to select it. We're going to mine our way to a fleet, monkey.",
            expression: 'lecturing',
            check: (g) => g.selectedTarget?.type === 'asteroid',
            complete: "You selected a rock. Truly the pinnacle of primate achievement.",
        },
        {
            id: 'mine_asteroid',
            say: "Now lock it with R and activate your mining laser with F1. Watch the pretty beam and try not to drool on the controls. This is the foundation of everything we're going to build.",
            expression: 'bored',
            check: (g) => g.player?.cargoUsed > 0,
            complete: "Ore in the hold! Every empire starts somewhere, and yours starts with space rocks. How poetic.",
        },
        {
            id: 'fill_cargo',
            say: "Keep mining until your cargo bay is at least 80% full. Watch the cargo bar in your ship indicator. I'll wait. It's not like I have anything better to do. Actually, I do, but here we are.",
            expression: 'bored',
            check: (g) => g.player && g.player.cargoUsed >= g.player.cargoCapacity * 0.8,
            complete: "Cargo's looking good! Now let's go sell that ore before you somehow lose it.",
        },
        // =============================================
        // Phase 2: First Sale & Credits
        // =============================================
        {
            id: 'dock_station',
            say: "Time to head back to the station. Click the station in the overview or in space, then press S to warp to it. When you're close enough, press Enter to dock. Simple enough even for you.",
            expression: 'lecturing',
            check: (g) => g.dockedAt !== null,
            complete: "Welcome aboard the station. Try not to break anything.",
        },
        {
            id: 'sell_ore',
            say: "Click the REFINERY tab up top. See all that ore? Hit SELL ALL and watch the credits roll in. We need ISK to build your fleet, monkey - lots of it. One rock at a time.",
            expression: 'lecturing',
            check: (g) => g.dockedAt && g.player?.cargoUsed === 0 && g.credits > 500,
            complete: "Ka-ching! First paycheck. Your faction account has funds now. But we need much more for what I have planned.",
        },
        {
            id: 'keep_mining',
            say: "Undock with Enter and keep mining. We need around 5,000 ISK to buy your first fleet ship - a dedicated mining frigate. The faster you mine, the faster we build. I'll keep track.",
            expression: 'lecturing',
            check: (g) => g.credits >= 5000,
            complete: "5,000 ISK! Now we're talking. Time to start building your fleet, monkey.",
        },
        // =============================================
        // Phase 3: First Fleet Ship - Mining Frigate (Venture)
        // =============================================
        {
            id: 'buy_mining_ship',
            say: "Dock at the station and click the SHIPS tab. Find the Venture - it's a mining frigate, 5,000 ISK. Hit the '+FLEET' button next to it. This ship will mine while you do other things. Passive income, monkey!",
            expression: 'impressed',
            check: (g) => g.fleet?.ships?.some(s => s.shipClass === 'venture'),
            complete: "Your first fleet ship! A Venture mining frigate. Now she needs a captain at the helm.",
        },
        {
            id: 'hire_first_captain',
            say: "That Venture needs a captain. Click the CANTINA tab and hire a pilot - look for one with decent mining skill. They cost about 500 ISK to hire. Not every monkey deserves to fly your ships, so choose wisely.",
            expression: 'lecturing',
            check: (g) => g.fleet?.hiredPilots?.length >= 1,
            complete: "Pilot hired! They seem... adequate. For a monkey. Now let's get them into that Venture.",
        },
        {
            id: 'assign_first_pilot',
            say: "In the CANTINA, click ASSIGN next to your hired pilot and pick the Venture. A ship without a captain is just an expensive paperweight.",
            expression: 'lecturing',
            check: (g) => g.fleet?.ships?.some(s => s.shipClass === 'venture' && s.pilot !== null),
            complete: "Captain assigned to the Venture! Now let's put them to work.",
        },
        {
            id: 'order_venture_mining',
            say: "Undock, then press F to open the Fleet panel. Select your Venture and hit the MINE button. They'll start mining automatically and sell ore to your faction treasury at 80% market rate. Free money while you work!",
            expression: 'smug',
            check: (g) => g.fleet?.ships?.some(s => s.shipClass === 'venture' && s.aiState === 'mining'),
            complete: "Your Venture is mining! Watch the faction treasury start filling up. This is how empires are built - one autonomous minion at a time.",
        },
        // =============================================
        // Phase 4: Combat Survival Basics
        // =============================================
        {
            id: 'combat_awareness',
            say: "Important survival lesson, monkey. See those red dots on the overview? Pirates. They WILL come for you. When hostiles appear, you have two choices: fight or run. For now? I'd recommend running. Press S on a distant object to warp away.",
            expression: 'concerned',
            check: (g) => g.stats?.playTime > 120 || g.stats?.kills >= 1,
            complete: "Good. You're still alive. That's the minimum acceptable standard.",
        },
        {
            id: 'combat_basics',
            say: "Okay, combat basics for when running isn't an option. Select a hostile, press R to lock, then F1 to fire your weapons. You have shields, armor, and hull - three layers of not-dying. If shields drop below half, seriously consider warping out.",
            expression: 'lecturing',
            check: (g) => g.stats?.kills >= 1,
            complete: "First kill! Pirates pay bounties when they die. Defending yourself IS profitable, monkey.",
        },
        {
            id: 'repair_after_combat',
            say: "After a fight, always dock and check the REPAIR tab. Your armor and hull don't regenerate in space - only shields do. A damaged ship is a dead ship waiting to happen. Trust me on this one.",
            expression: 'annoyed',
            check: (g) => g.player && (g.player.hull >= g.player.maxHull * 0.95) && g.stats?.kills >= 1,
            complete: "Fully repaired. Good habit to build. Unlike most of your habits.",
        },
        {
            id: 'insurance_tip',
            say: "Real talk, monkey. Visit the INSURANCE tab at stations. When you die - and you WILL die - insurance pays back a percentage of your ship's value. Get at least basic coverage. It's cheap and it'll save your wallet.",
            expression: 'concerned',
            check: (g) => g.insurance?.active || g.credits >= 7000,
            complete: "Smart. Insurance is the difference between a setback and a catastrophe out here.",
        },
        // =============================================
        // Phase 5: Second Fleet Ship - Combat Escort (Slasher)
        // =============================================
        {
            id: 'save_for_escort',
            say: "Your Venture is mining, your treasury is growing. Now we need protection. Pirates won't stop coming, and your miner can't fight back. Save up 7,000 ISK for a Slasher - fast attack frigate. Your first escort.",
            expression: 'lecturing',
            check: (g) => g.credits >= 7000,
            complete: "7,000 ISK banked! Time to add some teeth to your fleet.",
        },
        {
            id: 'buy_combat_ship',
            say: "Dock up and hit the SHIPS tab. Find the Slasher - it's a mercenary frigate with 4 weapon slots. Buy it with '+FLEET'. This little ship will keep your miners alive and pirates dead.",
            expression: 'impressed',
            check: (g) => g.fleet?.ships?.some(s => ['slasher','rifter','merlin','thrasher','corax','thorax','caracal','hurricane','drake'].includes(s.shipClass)),
            complete: "A combat frigate joins the fleet! Now your miners have a guardian angel. A violent, heavily armed guardian angel.",
        },
        {
            id: 'hire_combat_captain',
            say: "Hire another captain from the CANTINA - this time look for combat skill. A pilot who can actually aim is worth their weight in tritanium. Assign them to your new warship.",
            expression: 'lecturing',
            check: (g) => g.fleet?.ships?.some(s => ['slasher','rifter','merlin','thrasher','corax','thorax','caracal','hurricane','drake'].includes(s.shipClass) && s.pilot !== null),
            complete: "Combat pilot assigned! Your fleet now has offensive capability.",
        },
        {
            id: 'order_escort_defend',
            say: "In the Fleet panel (F key), select your combat ship and hit DEFEND. They'll patrol near your mining operation and engage any hostiles automatically. Your miners can work in peace now.",
            expression: 'smug',
            check: (g) => g.fleet?.ships?.some(s => s.aiState === 'defending' || s.aiState === 'attacking'),
            complete: "Your escort is on guard duty! Mining plus protection - now THAT'S an operation. I might actually stop worrying about you. Might.",
        },
        // =============================================
        // Phase 6: Fleet Expansion - Hauler (Heron)
        // =============================================
        {
            id: 'explain_hauler_need',
            say: "Your fleet is generating income, but there's a bottleneck. Fleet miners sell at 80% market rate to your treasury. A hauler can collect ore from your miners and you can sell it yourself for full price. Save up 5,000 ISK for a Heron.",
            expression: 'lecturing',
            check: (g) => g.credits >= 5000 && g.fleet?.ships?.length >= 2,
            complete: "Credits ready. Let's get that hauler.",
        },
        {
            id: 'buy_hauler',
            say: "SHIPS tab - find the Heron, it's a hauler frigate with a big cargo bay for 5,000 ISK. Hit '+FLEET'. Haulers are the backbone of any industrial operation. Boring but essential, like plumbing.",
            expression: 'bored',
            check: (g) => g.fleet?.ships?.some(s => ['heron','wreathe','mammoth','mastodon','fenrir','charon'].includes(s.shipClass)),
            complete: "Hauler acquired! Your logistics chain is taking shape.",
        },
        {
            id: 'crew_hauler',
            say: "Hire and assign a captain to your hauler. Navigation skill matters for haulers - fast warps mean faster deliveries. Get them seated and we'll talk fleet management.",
            expression: 'lecturing',
            check: (g) => g.fleet?.ships?.some(s => ['heron','wreathe','mammoth','mastodon','fenrir','charon'].includes(s.shipClass) && s.pilot !== null),
            complete: "Hauler crewed up! Three ships, three captains. Your faction is becoming a real operation.",
        },
        // =============================================
        // Phase 7: EWAR Scout (Vigil)
        // =============================================
        {
            id: 'save_for_ewar',
            say: "Last ship for our starter fleet - an EWAR frigate. The Vigil costs 8,000 ISK and can disrupt enemy warp drives and slow them down. In a fleet fight, EWAR wins battles. Trust the magnificence on this one.",
            expression: 'lecturing',
            check: (g) => g.credits >= 8000 && g.fleet?.ships?.length >= 3,
            complete: "Funds secured for the Vigil. Let's round out your fleet.",
        },
        {
            id: 'buy_ewar_ship',
            say: "SHIPS tab again. Find the Vigil - it's a police frigate with warp disruption bonuses. Buy it with '+FLEET'. Electronic warfare is how small fleets punch above their weight, monkey.",
            expression: 'impressed',
            check: (g) => g.fleet?.ships?.some(s => ['vigil','bellicose','scythe','claymore','sleipnir','maelstrom','scorpion'].includes(s.shipClass)),
            complete: "EWAR frigate online! Your fleet now has electronic warfare capability. Pirates won't know what hit them.",
        },
        {
            id: 'crew_ewar',
            say: "Hire one more captain for the Vigil and assign them. With this ship, your fleet can lock down targets and prevent them from escaping. Four ships, four captains - the foundation is complete.",
            expression: 'lecturing',
            check: (g) => g.fleet?.ships?.length >= 4 && g.fleet?.ships?.filter(s => s.pilot !== null).length >= 4,
            complete: "Four ships crewed and operational! Miner, escort, hauler, and EWAR support. That's a proper starter fleet, monkey. I'm... dare I say it... slightly impressed.",
        },
        // =============================================
        // Phase 8: Fleet Operations & Defense
        // =============================================
        {
            id: 'control_groups_intro',
            say: "Fleet management 101: Press F for Fleet panel. Use Ctrl+1 to assign your miners to group 1, Ctrl+2 for combat ships. Press 1 or 2 to quickly select that group. Organized fleets survive. Messy fleets explode.",
            expression: 'lecturing',
            check: (g) => g.fleetSystem?.controlGroups && [...g.fleetSystem.controlGroups.values()].some(s => s.size > 0),
            complete: "Control groups set! Now you can issue orders to ship groups with a single keypress. Efficiency, monkey.",
        },
        {
            id: 'fleet_defense_posture',
            say: "Your combat ships should be on DEFEND stance. In the Fleet panel, make sure escorts have aggressive stance so they engage threats automatically. Miners should stay passive - their job is rocks, not rockets.",
            expression: 'lecturing',
            check: (g) => g.fleet?.ships?.some(s => s.stance === 'aggressive') && g.fleet?.ships?.some(s => s.stance === 'passive'),
            complete: "Mixed stances configured. Your combat ships will fight, your industrial ships will flee. Smart division of labor.",
        },
        {
            id: 'watch_treasury',
            say: "Keep an eye on your faction treasury in the bottom bar. Your fleet miners are feeding it constantly. Once it hits 2,000+ ISK, you know the operation is humming along. Those credits fund everything - repairs, replacements, expansion.",
            expression: 'smug',
            check: (g) => (g.faction?.treasury || 0) >= 2000,
            complete: "Treasury looking healthy! Passive income is flowing. This is the foundation of every great empire. Even monkey-run ones.",
        },
        // =============================================
        // Phase 9: Navigation & Expansion
        // =============================================
        {
            id: 'gate_discovery',
            say: "See those swirling portals? Jump gates. Select one and press S to warp to it. Gates connect sectors - each with different difficulty, resources, and dangers. Press M for the sector map. Green sectors are safe, red means death.",
            expression: 'lecturing',
            check: (g) => g.stats?.jumps >= 1,
            complete: "Your first gate jump! A whole new sector to explore. Bring your fleet - never jump alone.",
        },
        {
            id: 'route_planning',
            say: "Press M for the sector map. Click any sector to plot a multi-jump autopilot route - yellow lines show the path. Stick to safe and tame sectors while your fleet is still small. The dangerous sectors have better ore, but also better pirates.",
            expression: 'lecturing',
            check: (g) => g.stats?.jumps >= 3,
            complete: "Three jumps completed! You're learning to navigate the sector network. The galaxy is opening up, monkey.",
        },
        {
            id: 'sector_difficulty_warning',
            say: "Fair warning: sector difficulty is real. Safe sectors have weak pirates. Dangerous and deadly sectors will chew through an unprepared fleet. Build up in safe space first. There's no shame in caution - there IS shame in losing your entire fleet to hubris.",
            expression: 'concerned',
            check: (g) => g.stats?.sectorsVisited?.length >= 3,
            complete: null,
        },
        // =============================================
        // Phase 10: Economy & Growth
        // =============================================
        {
            id: 'upgrade_equipment',
            say: "Time to upgrade. Dock and check the EQUIPMENT tab for better weapons and shield boosters. The FITTING tab lets you install them. A well-fitted ship outperforms a bigger one any day. Fit your combat ships first.",
            expression: 'lecturing',
            check: (g) => g.player?.moduleInventory?.length >= 1 || g.stats?.kills >= 5,
            complete: "Gear upgraded. Every module matters when you're in a tight fight.",
        },
        {
            id: 'guild_introduction',
            say: "The GUILDS tab offers repeatable quests. Mining Guild wants ore deliveries. Mercenary Guild wants kills. Complete quests for reputation and credits. Press J to track active quests. Extra income never hurts, monkey.",
            expression: 'lecturing',
            check: (g) => g.guildSystem?.playerGuilds?.size >= 1 || g.stats?.playTime > 600,
            complete: null,
        },
        {
            id: 'commerce_tip',
            say: "Pro tip: The COMMERCE tab at stations shows trade contracts. Buy goods cheap in one sector, sell high in another. Combined with your hauler, trade runs can be very profitable. Capitalism, monkey - the galaxy's oldest game.",
            expression: 'smug',
            check: (g) => g.stats?.playTime > 480,
            complete: null,
        },
        // =============================================
        // Phase 11: Advanced Combat & Skills
        // =============================================
        {
            id: 'ewar_explanation',
            say: "About those EWAR modules - warp disruptors prevent escape, stasis webs slow targets. If you see DISRUPTED on your HUD, kill the tackler FIRST or you can't warp out. Your Vigil can do the same to pirates. Turn the tables, monkey.",
            expression: 'concerned',
            check: (g) => g.stats?.kills >= 10 || g.stats?.deaths >= 2,
            complete: null,
        },
        {
            id: 'skill_training',
            say: "Check the SKILLS tab at stations. Five skills improve as you play: Navigation, Gunnery, Mining, Engineering, and Trade. Higher levels give passive bonuses. Press K for your stats breakdown. Long-term investment, monkey.",
            expression: 'lecturing',
            check: (g) => g.stats?.playTime > 900,
            complete: null,
        },
        // =============================================
        // Phase 12: The Long Game - POS & Empire
        // =============================================
        {
            id: 'fleet_growing',
            say: "Your fleet is operational and your treasury is growing. The next milestone? Keep expanding - more miners, more escorts. A fleet of 6-8 ships generates serious income. And then... well, I have a plan, monkey.",
            expression: 'smug',
            check: (g) => g.fleet?.ships?.length >= 5 || (g.faction?.treasury || 0) >= 10000,
            complete: "Your operation is thriving! Let me tell you about the endgame.",
        },
        {
            id: 'pos_dream',
            say: "The ultimate goal: your own station. A Player-Owned Station - POS for short. It costs 500,000 ISK for a basic POS kit. That sounds like a lot, but with a fleet of miners feeding your treasury? It's achievable. Your own base in the stars, monkey.",
            expression: 'impressed',
            check: (g) => g.credits >= 50000 || (g.faction?.treasury || 0) >= 25000,
            complete: null,
        },
        {
            id: 'pos_preparation',
            say: "To deploy a POS, you'll need: a POS kit from a station's trade goods (500K ISK, 20,000 m³ volume), and a capital-class hauler to carry it. That's the long game, monkey. Keep your fleet mining, keep expanding, and one day you'll plant your flag in the stars.",
            expression: 'lecturing',
            check: (g) => g.credits >= 100000 || (g.faction?.treasury || 0) >= 50000 || g.stats?.playTime > 1800,
            complete: "You're well on your way. The universe is vast and full of opportunity for those persistent enough to seize it. Even monkeys.",
        },
        {
            id: 'graduation',
            say: "That's everything I can teach you, monkey. You've learned to mine, trade, fight, build a fleet, and dream of your own station. The rest is up to you. I'll still be here - watching, judging, and occasionally being impressed. Mostly judging.",
            expression: 'smug',
            check: (g) => g.stats?.playTime > 2100,
            complete: "And so the monkey sets out to conquer the galaxy. I give you... moderate odds. Don't disappoint me. I have expectations now. Low ones, but still.",
        },
    ];

    /**
     * Start the guided tutorial arc
     */
    startGuidedTutorial() {
        this.guidedTutorial = true;
        this.guidedStep = 0;
        this.guidedWaiting = false;
        this.saveState();

        // Deliver the first step after a brief welcome pause
        setTimeout(() => {
            this.deliverGuidedStep();
        }, 1500);
    }

    /**
     * Deliver the current guided step's dialogue
     */
    deliverGuidedStep() {
        const steps = SkippyManager.GUIDED_STEPS;
        if (this.guidedStep >= steps.length) {
            // Tutorial complete!
            this.guidedTutorial = false;
            this.saveState();
            return;
        }

        const step = steps[this.guidedStep];

        // Check if already completed (e.g. loaded save)
        if (step.check(this.game)) {
            this.guidedStep++;
            this.saveState();
            this.deliverGuidedStep();
            return;
        }

        // Deliver the step's dialogue
        this.say(step.say, 8, step.expression || 'lecturing');
        this.guidedWaiting = true;
    }

    /**
     * Check if the current guided step is complete
     */
    checkGuidedStep() {
        if (!this.guidedTutorial || !this.guidedWaiting) return;

        const steps = SkippyManager.GUIDED_STEPS;
        if (this.guidedStep >= steps.length) {
            this.guidedTutorial = false;
            this.saveState();
            return;
        }

        const step = steps[this.guidedStep];

        try {
            if (step.check(this.game)) {
                this.guidedWaiting = false;

                // Deliver completion message if any
                if (step.complete) {
                    this.say(step.complete, 7, 'impressed');
                }

                // Set milestone for this step
                this.setMilestone('guided_' + step.id);

                // Advance to next step after a delay
                this.guidedStep++;
                this.saveState();

                setTimeout(() => {
                    this.deliverGuidedStep();
                }, step.complete ? 8000 : 3000);
            }
        } catch {
            // Check function might reference entities that don't exist yet - skip safely
        }
    }

    dispose() {
        if (this._typeInterval) clearInterval(this._typeInterval);
        this.stopTTSKeepAlive();
        if (this.synth) this.synth.cancel();
        if (this.avatar) this.avatar.dispose();
    }
}
