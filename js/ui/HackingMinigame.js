export class HackingMinigame {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.modal = null;
        this.pattern = [];
        this.playerPattern = [];
        this.difficulty = 1;
        this.timer = null;
        this.timeLeft = 0;
        this.timerInterval = null;
        this.showingPattern = false;
        this.onSuccess = null;
        this.onFailure = null;
    }

    start(difficulty, onSuccess, onFailure) {
        if (this.active) this.close();

        this.active = true;
        this.difficulty = Math.max(1, Math.min(3, difficulty));
        this.onSuccess = onSuccess || null;
        this.onFailure = onFailure || null;
        this.playerPattern = new Array(9).fill(false);
        this.showingPattern = true;

        // Generate pattern based on difficulty
        const cellCount = this.difficulty === 1 ? 3 : this.difficulty === 2 ? 5 : 7;
        this.pattern = new Array(9).fill(false);
        const indices = [];
        while (indices.length < cellCount) {
            const idx = Math.floor(Math.random() * 9);
            if (!indices.includes(idx)) {
                indices.push(idx);
                this.pattern[idx] = true;
            }
        }

        // Timer duration based on difficulty
        const durations = { 1: 15, 2: 12, 3: 10 };
        this.timeLeft = durations[this.difficulty];

        this._createModal();
        this._renderGrid(true); // Show pattern initially
        this.game.audio?.play('ui-click');

        // Show pattern for 2 seconds, then hide
        setTimeout(() => {
            if (!this.active) return;
            this.showingPattern = false;
            this._renderGrid(false);
            this._startTimer();
        }, 2000);
    }

    close() {
        this.active = false;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
    }

    _createModal() {
        // Remove existing modal if any
        const existing = document.getElementById('hacking-minigame-modal');
        if (existing) existing.remove();

        this.modal = document.createElement('div');
        this.modal.id = 'hacking-minigame-modal';
        this.modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            font-family: "Courier New", monospace;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: #0a0a1a; border: 2px solid #00ccff; border-radius: 8px;
            padding: 20px; min-width: 280px; text-align: center;
            box-shadow: 0 0 30px rgba(0, 204, 255, 0.3);
        `;

        // Title
        const title = document.createElement('div');
        title.textContent = `SYSTEM BREACH - LEVEL ${this.difficulty}`;
        title.style.cssText = 'color: #00ccff; font-size: 14px; font-weight: bold; margin-bottom: 4px; letter-spacing: 2px;';
        panel.appendChild(title);

        // Instructions
        const instructions = document.createElement('div');
        instructions.textContent = 'Memorize the pattern. Recreate it to breach.';
        instructions.style.cssText = 'color: #668899; font-size: 11px; margin-bottom: 12px;';
        panel.appendChild(instructions);

        // Timer display
        const timerEl = document.createElement('div');
        timerEl.id = 'hacking-timer';
        timerEl.textContent = `TIME: ${this.timeLeft}s`;
        timerEl.style.cssText = 'color: #ffcc00; font-size: 12px; font-weight: bold; margin-bottom: 10px;';
        panel.appendChild(timerEl);

        // Grid container
        const gridContainer = document.createElement('div');
        gridContainer.id = 'hacking-grid';
        gridContainer.style.cssText = `
            display: grid; grid-template-columns: repeat(3, 1fr);
            gap: 6px; width: 210px; margin: 0 auto 14px auto;
        `;
        panel.appendChild(gridContainer);

        // Status text
        const status = document.createElement('div');
        status.id = 'hacking-status';
        status.textContent = 'Memorizing...';
        status.style.cssText = 'color: #ffcc00; font-size: 11px; margin-bottom: 10px; min-height: 16px;';
        panel.appendChild(status);

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

        const submitBtn = document.createElement('button');
        submitBtn.id = 'hacking-submit';
        submitBtn.textContent = 'SUBMIT';
        submitBtn.style.cssText = 'background: #002233; color: #00ccff; border: 1px solid #00ccff; border-radius: 3px; padding: 6px 20px; cursor: pointer; font-family: "Courier New", monospace; font-size: 12px; font-weight: bold; letter-spacing: 1px; display: none;';
        submitBtn.addEventListener('click', () => this._submit());
        btnRow.appendChild(submitBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'ABORT';
        cancelBtn.style.cssText = 'background: #330000; color: #ff4444; border: 1px solid #ff4444; border-radius: 3px; padding: 6px 20px; cursor: pointer; font-family: "Courier New", monospace; font-size: 12px; font-weight: bold; letter-spacing: 1px;';
        cancelBtn.addEventListener('click', () => this._fail('Aborted'));
        btnRow.appendChild(cancelBtn);

        panel.appendChild(btnRow);
        this.modal.appendChild(panel);
        document.body.appendChild(this.modal);
    }

    _renderGrid(showPattern) {
        const gridContainer = document.getElementById('hacking-grid');
        if (!gridContainer) return;
        gridContainer.innerHTML = '';

        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.style.cssText = `
                width: 64px; height: 64px; border: 2px solid #335566;
                border-radius: 4px; cursor: pointer;
                transition: background 0.15s, border-color 0.15s;
                display: flex; align-items: center; justify-content: center;
            `;

            if (showPattern && this.pattern[i]) {
                cell.style.background = '#00ccff';
                cell.style.borderColor = '#00ffff';
                cell.style.boxShadow = '0 0 12px rgba(0, 204, 255, 0.6)';
            } else if (!showPattern && this.playerPattern[i]) {
                cell.style.background = '#00ccff';
                cell.style.borderColor = '#00ffff';
                cell.style.boxShadow = '0 0 12px rgba(0, 204, 255, 0.6)';
            } else {
                cell.style.background = '#111122';
            }

            if (!showPattern) {
                const idx = i;
                cell.addEventListener('click', () => {
                    if (this.showingPattern || !this.active) return;
                    this.playerPattern[idx] = !this.playerPattern[idx];
                    this.game.audio?.play('ui-click');
                    this._renderGrid(false);
                });
            }

            gridContainer.appendChild(cell);
        }

        // Show/hide submit button
        const submitBtn = document.getElementById('hacking-submit');
        if (submitBtn) {
            submitBtn.style.display = showPattern ? 'none' : 'inline-block';
        }

        // Update status
        const statusEl = document.getElementById('hacking-status');
        if (statusEl) {
            statusEl.textContent = showPattern ? 'Memorizing...' : 'Recreate the pattern';
        }
    }

    _startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            const timerEl = document.getElementById('hacking-timer');
            if (timerEl) {
                timerEl.textContent = `TIME: ${this.timeLeft}s`;
                if (this.timeLeft <= 5) {
                    timerEl.style.color = '#ff4444';
                }
            }
            if (this.timeLeft <= 0) {
                this._fail('Time expired');
            }
        }, 1000);
    }

    _submit() {
        if (!this.active) return;

        // Check if player pattern matches
        let match = true;
        for (let i = 0; i < 9; i++) {
            if (this.pattern[i] !== this.playerPattern[i]) {
                match = false;
                break;
            }
        }

        if (match) {
            this.game.ui?.showToast('System breached', 'success');
            this.game.audio?.play('quest-complete');
            this.game.ui?.log('Successfully hacked data anomaly', 'exploration');
            const cb = this.onSuccess;
            this.close();
            if (cb) cb();
        } else {
            this._fail('Pattern mismatch');
        }
    }

    _fail(reason) {
        if (!this.active) return;
        this.game.ui?.showToast(`Hack failed: ${reason}`, 'error');
        this.game.audio?.play('ui-error');
        this.game.ui?.log(`Failed to hack data anomaly: ${reason}`, 'exploration');
        const cb = this.onFailure;
        this.close();
        if (cb) cb();
    }
}
