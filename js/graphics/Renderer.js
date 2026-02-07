// =============================================
// Three.js Renderer
// Handles all rendering with orthographic camera
// =============================================

import { CONFIG } from '../config.js';
import { StarField } from './StarField.js';
import { Nebula } from './Nebula.js';
import { Effects } from './Effects.js';

export class Renderer {
    constructor(game) {
        this.game = game;

        // Three.js core
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Render groups
        this.backgroundGroup = null;
        this.entityGroup = null;
        this.effectsGroup = null;
        this.uiGroup = null;

        // Special effects
        this.starField = null;
        this.nebula = null;
        this.effects = null;

        // Entity mesh tracking
        this.entityMeshes = new Map();

        // Selection indicator
        this.selectionMesh = null;
        this.lockMesh = null;

        // Lighting
        this.hemisphereLight = null;
        this.directionalLight = null;
    }

    /**
     * Initialize the renderer
     */
    async init() {
        // Initialize Three.js renderer

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000811);

        // Create orthographic camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = CONFIG.CAMERA_ZOOM_DEFAULT;

        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect,
            frustumSize * aspect,
            frustumSize,
            -frustumSize,
            0.1,
            1000
        );
        this.camera.position.z = 100;

        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Add to DOM
        const container = document.getElementById('game-container');
        container.appendChild(this.renderer.domElement);

        // Create render groups
        this.backgroundGroup = new THREE.Group();
        this.entityGroup = new THREE.Group();
        this.effectsGroup = new THREE.Group();
        this.uiGroup = new THREE.Group();

        this.scene.add(this.backgroundGroup);
        this.scene.add(this.entityGroup);
        this.scene.add(this.effectsGroup);
        this.scene.add(this.uiGroup);

        // Create starfield
        this.starField = new StarField(this.game);
        this.backgroundGroup.add(this.starField.mesh);

        // Create nebula
        this.nebula = new Nebula(this.game);
        this.backgroundGroup.add(this.nebula.mesh);

        // Create effects manager
        this.effects = new Effects(this.game, this.effectsGroup);

        // Create selection indicators
        this.createSelectionIndicators();

        // Setup lighting for 3D asteroids
        this.setupLighting();

        // Handle window resize
        window.addEventListener('resize', this.onResize.bind(this));

        // Renderer ready
    }

    /**
     * Create selection and lock indicator meshes
     */
    createSelectionIndicators() {
        // Selection brackets
        const bracketGroup = new THREE.Group();
        const bracketMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
        });

        // Create bracket corners
        const corners = [
            // Top-left
            [[-1, 1], [-1, 0.7], [-1, 1], [-0.7, 1]],
            // Top-right
            [[1, 1], [1, 0.7], [1, 1], [0.7, 1]],
            // Bottom-left
            [[-1, -1], [-1, -0.7], [-1, -1], [-0.7, -1]],
            // Bottom-right
            [[1, -1], [1, -0.7], [1, -1], [0.7, -1]],
        ];

        for (const corner of corners) {
            for (let i = 0; i < 2; i++) {
                const points = [
                    new THREE.Vector3(corner[i * 2][0] * 30, corner[i * 2][1] * 30, 0),
                    new THREE.Vector3(corner[i * 2 + 1][0] * 30, corner[i * 2 + 1][1] * 30, 0),
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, bracketMaterial);
                bracketGroup.add(line);
            }
        }

        this.selectionMesh = bracketGroup;
        this.selectionMesh.visible = false;
        this.uiGroup.add(this.selectionMesh);

        // Lock indicator (spinning circle)
        const lockGeometry = new THREE.RingGeometry(35, 40, 32, 1, 0, Math.PI * 1.5);
        const lockMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
        });
        this.lockMesh = new THREE.Mesh(lockGeometry, lockMaterial);
        this.lockMesh.visible = false;
        this.uiGroup.add(this.lockMesh);
    }

    /**
     * Setup lighting for 3D objects (asteroids)
     */
    setupLighting() {
        // Hemisphere light for ambient fill (sky color / ground color)
        this.hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x222244, 0.6);
        this.scene.add(this.hemisphereLight);

        // Directional light for shadows and depth (positioned above/in front)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(0, 0, 500);
        this.scene.add(this.directionalLight);
    }

    /**
     * Load a sector's entities into the scene
     */
    loadSector(sector) {
        // Load sector entities into renderer

        // Update nebula for this sector
        this.nebula.setSeed(sector.seed);

        // Create meshes for all entities
        for (const entity of sector.entities) {
            this.addEntityMesh(entity);
        }

        // Add player mesh
        if (this.game.player) {
            this.addEntityMesh(this.game.player);
        }
    }

    /**
     * Clear all sector entities from scene
     */
    clearSector() {
        // Remove all entity meshes and dispose GPU resources
        for (const [entity, mesh] of this.entityMeshes) {
            this.entityGroup.remove(mesh);
            this.disposeMesh(mesh);
        }
        this.entityMeshes.clear();

        // Clear effects
        this.effects.clear();
    }

    /**
     * Add mesh for an entity
     */
    addEntityMesh(entity) {
        if (this.entityMeshes.has(entity)) return;

        const mesh = entity.createMesh();
        if (mesh) {
            this.entityGroup.add(mesh);
            this.entityMeshes.set(entity, mesh);
        }
    }

    /**
     * Remove mesh for an entity
     */
    removeEntityMesh(entity) {
        const mesh = this.entityMeshes.get(entity);
        if (mesh) {
            this.entityGroup.remove(mesh);
            this.disposeMesh(mesh);
            this.entityMeshes.delete(entity);
        }
    }

    /**
     * Dispose of a mesh's geometry and materials to free GPU memory
     */
    disposeMesh(mesh) {
        mesh.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    /**
     * Main render function
     */
    render() {
        // Update camera from game camera
        this.updateCamera();

        // Update entity meshes
        this.updateEntityMeshes();

        // Update selection indicators
        this.updateSelectionIndicators();

        // Update starfield parallax
        this.starField.update(this.game.camera);

        // Update nebula animation
        this.nebula.update(1 / 60);

        // Update effects
        this.effects.update(1 / 60);

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Update Three.js camera from game camera
     */
    updateCamera() {
        const gameCamera = this.game.camera;
        if (!gameCamera) return;

        const pos = gameCamera.getPosition();
        const zoom = gameCamera.zoom;
        const aspect = window.innerWidth / window.innerHeight;

        // Update orthographic frustum based on zoom
        // Higher zoom = smaller view (more zoomed in)
        // At zoom=500 (default), view is ~2000 units tall - good for local combat
        // At zoom=50 (zoomed out), view is ~20000 units - full sector view
        // At zoom=8000 (zoomed in), view is ~125 units - close tactical
        const viewHeight = 1000000 / zoom;
        const viewWidth = viewHeight * aspect;

        this.camera.left = -viewWidth / 2;
        this.camera.right = viewWidth / 2;
        this.camera.top = viewHeight / 2;
        this.camera.bottom = -viewHeight / 2;

        this.camera.position.x = pos.x;
        this.camera.position.y = pos.y;

        this.camera.updateProjectionMatrix();
    }

    /**
     * Update all entity meshes
     */
    updateEntityMeshes() {
        // Update existing entities
        for (const [entity, mesh] of this.entityMeshes) {
            if (!entity.alive) {
                this.removeEntityMesh(entity);
                continue;
            }

            entity.updateMesh();
        }

        // Add meshes for new entities
        if (this.game.currentSector) {
            for (const entity of this.game.currentSector.entities) {
                if (entity.alive && !this.entityMeshes.has(entity)) {
                    this.addEntityMesh(entity);
                }
            }
        }
    }

    /**
     * Update selection and lock indicators
     */
    updateSelectionIndicators() {
        // Track animation time
        this._animTime = (this._animTime || 0) + 0.016;

        // Selection brackets
        const selected = this.game.selectedTarget;
        if (selected && selected.alive) {
            this.selectionMesh.visible = true;
            this.selectionMesh.position.set(selected.x, selected.y, 5);

            // Scale with breathing pulse
            const baseScale = (selected.radius || 30) / 30;
            const pulse = 1.0 + Math.sin(this._animTime * 3) * 0.08;
            this.selectionMesh.scale.setScalar(baseScale * pulse);

            // Pulsing opacity
            const bracketOpacity = 0.6 + Math.sin(this._animTime * 3) * 0.3;
            this.selectionMesh.children.forEach(child => {
                if (child.material) child.material.opacity = bracketOpacity;
            });

            // Rotate slowly
            this.selectionMesh.rotation.z += 0.01;
        } else {
            this.selectionMesh.visible = false;
        }

        // Lock indicator
        const locked = this.game.lockedTarget;
        if (locked && locked.alive) {
            this.lockMesh.visible = true;
            this.lockMesh.position.set(locked.x, locked.y, 5);

            // Scale with pulse
            const baseScale = (locked.radius || 30) / 30;
            const lockPulse = 1.0 + Math.sin(this._animTime * 4) * 0.05;
            this.lockMesh.scale.setScalar(baseScale * lockPulse);

            // Pulsing opacity
            this.lockMesh.material.opacity = 0.6 + Math.sin(this._animTime * 4) * 0.3;

            // Rotate
            this.lockMesh.rotation.z -= 0.03;
        } else {
            this.lockMesh.visible = false;
        }
    }

    /**
     * Add a visual effect
     */
    addEffect(type, x, y, options = {}) {
        return this.effects.spawn(type, x, y, options);
    }

    /**
     * Handle window resize
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.renderer.setSize(width, height);
        this.updateCamera();
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((screenX - rect.left) / rect.width) * 2 - 1;
        const y = -((screenY - rect.top) / rect.height) * 2 + 1;

        const vector = new THREE.Vector3(x, y, 0);
        vector.unproject(this.camera);

        return { x: vector.x, y: vector.y };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        const vector = new THREE.Vector3(worldX, worldY, 0);
        vector.project(this.camera);

        const rect = this.renderer.domElement.getBoundingClientRect();
        return {
            x: (vector.x + 1) / 2 * rect.width + rect.left,
            y: -(vector.y - 1) / 2 * rect.height + rect.top,
        };
    }
}
