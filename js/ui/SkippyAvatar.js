// =============================================
// Skippy Avatar - 3D Beer Can with Animated Face
// "I am Skippy the Magnificent!"
// =============================================

export class SkippyAvatar {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canGroup = null;
        this.leftEye = null;
        this.rightEye = null;
        this.mouth = null;
        this.facePlane = null;
        this.animFrameId = null;
        this.expression = 'idle';
        this.blinkTimer = 0;
        this.blinkInterval = 3 + Math.random() * 4;
        this.isBlinking = false;
        this.talkTimer = 0;
        this.isTalking = false;
        this.disposed = false;

        // Running lights
        this.runningLights = [];

        // Antenna
        this.antennaBeacon = null;

        // Engine glow layers
        this.engineGlow = null;

        // Scan line
        this.scanLine = null;

        // Game state for reactive behavior
        this.gameState = {
            inCombat: false,
            shieldPct: 1,
            isWarping: false,
            isDocked: false,
            isSpeaking: false,
        };
    }

    init() {
        const width = this.container.clientWidth || 200;
        const height = this.container.clientHeight || 200;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000a14);

        // Camera
        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 500);
        this.camera.position.set(0, 2, 50);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        this.container.appendChild(canvas);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Build the beer can
        this.canGroup = new THREE.Group();
        this.buildBeerCan();
        this.scene.add(this.canGroup);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xccddff, 1.2);
        keyLight.position.set(3, 5, 8);
        this.scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x00ffff, 0.4);
        rimLight.position.set(-4, 2, -3);
        this.scene.add(rimLight);

        // Point light for face glow
        this.faceLight = new THREE.PointLight(0x00ffff, 0.6, 30);
        this.faceLight.position.set(0, 0, 16);
        this.scene.add(this.faceLight);

        // Start animation
        this.animate();
    }

    buildBeerCan() {
        // Can body - main cylinder
        const bodyGeo = new THREE.CylinderGeometry(10, 10, 28, 24, 1, false);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x8899aa,
            metalness: 0.85,
            roughness: 0.25,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        this.canGroup.add(body);

        // Top rim
        const topRimGeo = new THREE.TorusGeometry(10, 0.8, 8, 24);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0xaabbcc,
            metalness: 0.9,
            roughness: 0.2,
        });
        const topRim = new THREE.Mesh(topRimGeo, rimMat);
        topRim.position.y = 14;
        topRim.rotation.x = Math.PI / 2;
        this.canGroup.add(topRim);

        // Bottom rim
        const bottomRim = new THREE.Mesh(topRimGeo, rimMat);
        bottomRim.position.y = -14;
        bottomRim.rotation.x = Math.PI / 2;
        this.canGroup.add(bottomRim);

        // Tab on top
        const tabGeo = new THREE.BoxGeometry(4, 0.5, 7);
        const tabMat = new THREE.MeshStandardMaterial({
            color: 0xbbccdd,
            metalness: 0.9,
            roughness: 0.15,
        });
        const tab = new THREE.Mesh(tabGeo, tabMat);
        tab.position.set(0, 14.8, 2);
        this.canGroup.add(tab);

        // Label band around middle
        const labelGeo = new THREE.CylinderGeometry(10.15, 10.15, 14, 24, 1, true);
        const labelMat = new THREE.MeshStandardMaterial({
            color: 0x1a3a5c,
            metalness: 0.3,
            roughness: 0.6,
            side: THREE.DoubleSide,
        });
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.y = -1;
        this.canGroup.add(label);

        // Face screen (dark background)
        const faceGeo = new THREE.PlaneGeometry(14, 10);
        const faceMat = new THREE.MeshBasicMaterial({
            color: 0x001122,
            transparent: true,
            opacity: 0.95,
        });
        this.facePlane = new THREE.Mesh(faceGeo, faceMat);
        this.facePlane.position.set(0, 1, 10.2);
        this.canGroup.add(this.facePlane);

        // Left eye
        const eyeGeo = new THREE.PlaneGeometry(3, 3);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
        this.leftEye.position.set(-3.5, 3.5, 10.3);
        this.canGroup.add(this.leftEye);

        // Right eye
        this.rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
        this.rightEye.position.set(3.5, 3.5, 10.3);
        this.canGroup.add(this.rightEye);

        // Mouth (LED bar)
        const mouthGeo = new THREE.PlaneGeometry(8, 1.5);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
        this.mouth.position.set(0, -1, 10.3);
        this.canGroup.add(this.mouth);

        // Eyebrow lines (personality!)
        const browGeo = new THREE.PlaneGeometry(3.5, 0.5);
        const browMat = new THREE.MeshBasicMaterial({ color: 0x00cccc });
        this.leftBrow = new THREE.Mesh(browGeo, browMat.clone());
        this.leftBrow.position.set(-3.5, 5.5, 10.3);
        this.canGroup.add(this.leftBrow);

        this.rightBrow = new THREE.Mesh(browGeo, browMat.clone());
        this.rightBrow.position.set(3.5, 5.5, 10.3);
        this.canGroup.add(this.rightBrow);

        // Add visual enhancements
        this.addRunningLights();
        this.addAntenna();
        this.addEngineGlow();
        this.addScanLine();
    }

    // ---- Running Lights ----
    addRunningLights() {
        const lightGeo = new THREE.CircleGeometry(0.6, 6);

        const lightConfigs = [
            // Port side (red) x2
            { color: 0xff0000, x: -10.2, y: 4, z: 2, phase: 0 },
            { color: 0xff0000, x: -10.2, y: -4, z: 2, phase: 0.3 },
            // Starboard side (green) x2
            { color: 0x00ff00, x: 10.2, y: 4, z: 2, phase: 0.5 },
            { color: 0x00ff00, x: 10.2, y: -4, z: 2, phase: 0.8 },
            // Top strobe (cyan)
            { color: 0x00ffff, x: 0, y: 13, z: 8, phase: 0 },
            // Bottom (white)
            { color: 0xffffff, x: 0, y: -13, z: 8, phase: 0.5 },
        ];

        for (const cfg of lightConfigs) {
            const mat = new THREE.MeshBasicMaterial({
                color: cfg.color,
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
            });
            const light = new THREE.Mesh(lightGeo, mat);
            light.position.set(cfg.x, cfg.y, cfg.z);
            light.renderOrder = 6;
            this.canGroup.add(light);
            this.runningLights.push({ mesh: light, phase: cfg.phase });
        }
    }

    // ---- Antenna + Beacon ----
    addAntenna() {
        // Shaft
        const shaftGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 6);
        const shaftMat = new THREE.MeshStandardMaterial({
            color: 0x889999,
            metalness: 0.8,
            roughness: 0.3,
        });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.set(3, 18.5, 0);
        this.canGroup.add(shaft);

        // Beacon tip
        const tipGeo = new THREE.SphereGeometry(0.7, 8, 8);
        const tipMat = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.9,
        });
        this.antennaBeacon = new THREE.Mesh(tipGeo, tipMat);
        this.antennaBeacon.position.set(3, 23, 0);
        this.canGroup.add(this.antennaBeacon);
    }

    // ---- Engine Glow (Bottom) ----
    addEngineGlow() {
        this.engineGlow = {};

        // Core (white, bright)
        const coreGeo = new THREE.CircleGeometry(3, 12);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
        });
        this.engineGlow.core = new THREE.Mesh(coreGeo, coreMat);
        this.engineGlow.core.position.set(0, -15.5, 5);
        this.engineGlow.core.rotation.x = -Math.PI / 2;
        this.engineGlow.core.renderOrder = 5;
        this.canGroup.add(this.engineGlow.core);

        // Outer (cyan)
        const outerGeo = new THREE.CircleGeometry(5, 12);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x00ccff,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
        });
        this.engineGlow.outer = new THREE.Mesh(outerGeo, outerMat);
        this.engineGlow.outer.position.set(0, -15.5, 4.5);
        this.engineGlow.outer.rotation.x = -Math.PI / 2;
        this.engineGlow.outer.renderOrder = 4;
        this.canGroup.add(this.engineGlow.outer);

        // Bloom (dark cyan, large)
        const bloomGeo = new THREE.CircleGeometry(8, 12);
        const bloomMat = new THREE.MeshBasicMaterial({
            color: 0x0066aa,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        this.engineGlow.bloom = new THREE.Mesh(bloomGeo, bloomMat);
        this.engineGlow.bloom.position.set(0, -15.5, 4);
        this.engineGlow.bloom.rotation.x = -Math.PI / 2;
        this.engineGlow.bloom.renderOrder = 3;
        this.canGroup.add(this.engineGlow.bloom);
    }

    // ---- Scan Line ----
    addScanLine() {
        const lineGeo = new THREE.PlaneGeometry(13, 0.3);
        const lineMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
        });
        this.scanLine = new THREE.Mesh(lineGeo, lineMat);
        this.scanLine.position.set(0, 1, 10.35);
        this.scanLine.renderOrder = 8;
        this.canGroup.add(this.scanLine);
    }

    updateGameState(state) {
        if (state) {
            Object.assign(this.gameState, state);
        }
    }

    setExpression(type) {
        this.expression = type;

        // Eye colors by expression
        const eyeColors = {
            idle: 0x00ffff,
            talking: 0x00ffff,
            smug: 0x00ffaa,
            laughing: 0x44ff44,
            annoyed: 0xff8800,
            alarmed: 0xff2200,
            impressed: 0x44aaff,
            excited: 0xffff00,
            bored: 0x668888,
            concerned: 0xffaa00,
            disappointed: 0x888888,
            mildlyImpressed: 0x44ddaa,
            lecturing: 0x8888ff,
            neutral: 0x00dddd,
        };

        const mouthColors = {
            idle: 0x00ff88,
            talking: 0x00ffcc,
            smug: 0x00ff88,
            laughing: 0x44ff44,
            annoyed: 0xff6600,
            alarmed: 0xff0000,
            impressed: 0x44aaff,
            excited: 0xffff00,
            bored: 0x446666,
            concerned: 0xffaa00,
            disappointed: 0x666666,
            mildlyImpressed: 0x44ddaa,
            lecturing: 0x8888ff,
            neutral: 0x00dd88,
        };

        const color = eyeColors[type] || eyeColors.idle;
        const mColor = mouthColors[type] || mouthColors.idle;

        if (this.leftEye) this.leftEye.material.color.setHex(color);
        if (this.rightEye) this.rightEye.material.color.setHex(color);
        if (this.mouth) this.mouth.material.color.setHex(mColor);
        if (this.faceLight) this.faceLight.color.setHex(color);

        // Brow angles
        const browAngles = {
            idle: 0, talking: 0, smug: -0.15, laughing: 0.1,
            annoyed: -0.3, alarmed: 0.2, impressed: 0.15,
            excited: 0.1, bored: -0.1, concerned: 0.2,
            disappointed: -0.2, mildlyImpressed: 0.05,
            lecturing: -0.1, neutral: 0,
        };
        const browAngle = browAngles[type] || 0;
        if (this.leftBrow) this.leftBrow.rotation.z = browAngle;
        if (this.rightBrow) this.rightBrow.rotation.z = -browAngle;

        // Eye size adjustments
        const eyeScales = {
            idle: 1, talking: 1, smug: 0.85, laughing: 1.2,
            annoyed: 0.6, alarmed: 1.4, impressed: 1.3,
            excited: 1.3, bored: 0.7, concerned: 1.1,
            disappointed: 0.8, mildlyImpressed: 1.1,
            lecturing: 0.9, neutral: 1,
        };
        const scale = eyeScales[type] || 1;
        if (this.leftEye) this.leftEye.scale.setScalar(scale);
        if (this.rightEye) this.rightEye.scale.setScalar(scale);
    }

    startTalking() {
        this.isTalking = true;
        this.talkTimer = 0;
    }

    stopTalking() {
        this.isTalking = false;
        // Reset mouth to expression default
        if (this.mouth) {
            this.mouth.scale.set(1, 1, 1);
        }
    }

    animate = () => {
        if (this.disposed) return;
        this.animFrameId = requestAnimationFrame(this.animate);

        const t = performance.now() * 0.001;

        if (!this.canGroup) return;

        // State-reactive bob speed and amplitude
        const combat = this.gameState.inCombat;
        const docked = this.gameState.isDocked;
        const bobSpeed = combat ? 3.0 : (docked ? 0.8 : 1.5);
        const bobAmp = combat ? 0.8 : (docked ? 0.3 : 0.5);

        // Idle bob
        this.canGroup.position.y = Math.sin(t * bobSpeed) * bobAmp;

        // Gentle rotation - more erratic in combat
        const rotRange = combat ? 0.25 : 0.15;
        this.canGroup.rotation.y = Math.sin(t * 0.4) * rotRange + (combat ? Math.sin(t * 1.7) * 0.05 : 0);

        // Blink logic
        this.blinkTimer += 0.016; // ~60fps
        if (!this.isBlinking && this.blinkTimer >= this.blinkInterval) {
            this.isBlinking = true;
            this.blinkTimer = 0;
            this.blinkInterval = 2 + Math.random() * 5;
            if (this.leftEye) this.leftEye.scale.y = 0.1;
            if (this.rightEye) this.rightEye.scale.y = 0.1;
            setTimeout(() => {
                if (this.disposed) return;
                this.isBlinking = false;
                const s = this.leftEye?.scale.x || 1;
                if (this.leftEye) this.leftEye.scale.y = s;
                if (this.rightEye) this.rightEye.scale.y = s;
            }, 120);
        }

        // Talking animation - mouth oscillation
        if (this.isTalking && this.mouth) {
            this.talkTimer += 0.016;
            const mouthOpen = 0.5 + Math.abs(Math.sin(this.talkTimer * 12)) * 1.5;
            this.mouth.scale.y = mouthOpen;
            this.mouth.scale.x = 0.9 + Math.sin(this.talkTimer * 8) * 0.15;
        }

        // Face glow pulse
        if (this.faceLight) {
            this.faceLight.intensity = 0.4 + Math.sin(t * 2) * 0.2;
        }

        // Face flash when shields low
        if (this.facePlane && this.gameState.shieldPct < 0.3 && combat) {
            const flash = Math.sin(t * 8) > 0.3;
            this.facePlane.material.color.setHex(flash ? 0x220000 : 0x001122);
        } else if (this.facePlane) {
            this.facePlane.material.color.setHex(0x001122);
        }

        // Running lights animation
        for (const light of this.runningLights) {
            const pulse = Math.max(0, Math.sin(t * 2 + light.phase * Math.PI * 2));
            light.mesh.material.opacity = 0.3 + pulse * 0.7;
        }

        // Antenna beacon blink
        if (this.antennaBeacon) {
            const blinkSpeed = combat ? 4.0 : 1.3;
            const on = Math.sin(t * blinkSpeed) > 0;
            this.antennaBeacon.material.opacity = on ? 0.9 : 0.1;
            this.antennaBeacon.material.color.setHex(combat ? 0xff0000 : 0xff4400);
        }

        // Engine glow animation
        if (this.engineGlow) {
            const pulse = 0.7 + (Math.sin(t * 3) + Math.sin(t * 7.3)) * 0.15;
            const isWarping = this.gameState.isWarping;

            // Core
            this.engineGlow.core.material.opacity = (isWarping ? 0.9 : 0.6) * pulse;
            // Outer - color shifts purple when warping
            this.engineGlow.outer.material.opacity = (isWarping ? 0.5 : 0.3) * pulse;
            this.engineGlow.outer.material.color.setHex(isWarping ? 0x8844ff : 0x00ccff);
            // Bloom
            this.engineGlow.bloom.material.opacity = (isWarping ? 0.3 : 0.15) * pulse;
        }

        // Scan line sweep
        if (this.scanLine) {
            const cycle = (t % 3) / 3; // 0-1 over 3 seconds
            const yPos = -4 + cycle * 10; // sweep from y=-4 to y=6
            this.scanLine.position.y = 1 + yPos;
            this.scanLine.material.opacity = 0.1 + Math.sin(t * 5) * 0.05;
        }

        this.renderer.render(this.scene, this.camera);
    };

    dispose() {
        this.disposed = true;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
        // Remove canvas
        const canvas = this.container.querySelector('canvas');
        if (canvas) canvas.remove();
    }
}
