// =============================================
// Three.js Renderer
// Handles all rendering with orthographic camera
// 3D-enhanced with camera tilt, dynamic lights, and shadows
// =============================================

import { CONFIG } from '../config.js';
import { StarField } from './StarField.js';
import { Nebula } from './Nebula.js';
import { Effects } from './Effects.js';
import { LightPool } from './LightPool.js';

// Camera tilt angle in radians (~12 degrees)
const CAMERA_TILT = 0.21;

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
        this.lightPool = null;

        // Entity mesh tracking
        this.entityMeshes = new Map();

        // Shadow tracking
        this.entityShadows = new Map();

        // Selection indicator
        this.selectionMesh = null;
        this.lockMesh = null;

        // Lighting
        this.hemisphereLight = null;
        this.directionalLight = null;

        // Raycaster for tilted coordinate conversion
        this._raycaster = null;
        this._groundPlane = null;
    }

    /**
     * Initialize the renderer
     */
    async init() {
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
        // Apply slight downward tilt to reveal 3D geometry
        this.camera.rotation.x = -CAMERA_TILT;

        // Setup raycaster and ground plane for tilted coordinate conversion
        this._raycaster = new THREE.Raycaster();
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Color space for correct output — NO tone mapping since this scene mixes
        // MeshBasicMaterial (nebula, particles, UI) with MeshStandardMaterial (ships, stations).
        // ACES tone mapping washes out the BasicMaterial colors.
        this.renderer.outputEncoding = THREE.sRGBEncoding;

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

        // Counter-rotate background so stars/nebula stay "flat" behind the action
        this.backgroundGroup.rotation.x = CAMERA_TILT;

        // Create starfield
        this.starField = new StarField(this.game);
        this.backgroundGroup.add(this.starField.mesh);

        // Create nebula
        this.nebula = new Nebula(this.game);
        this.backgroundGroup.add(this.nebula.mesh);

        // Create dynamic light pool
        this.lightPool = new LightPool(this.scene);

        // Create effects manager (pass lightPool for dynamic illumination)
        this.effects = new Effects(this.game, this.effectsGroup, this.lightPool);

        // Create selection indicators
        this.createSelectionIndicators();

        // Setup lighting for 3D objects
        this.setupLighting();

        // Create vignette overlay
        this.createVignette();

        // Handle window resize
        window.addEventListener('resize', this.onResize.bind(this));
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
     * Setup lighting for 3D objects
     */
    setupLighting() {
        // Hemisphere light for ambient base — moderate so MeshStandardMaterial
        // colors stay close to their assigned hex values
        this.hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x222244, 0.4);
        this.scene.add(this.hemisphereLight);

        // Directional light from above — creates depth shading on extruded faces
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.directionalLight.position.set(100, 200, 800);
        this.scene.add(this.directionalLight);
    }

    /**
     * Create vignette overlay mesh (darkened edges for atmospheric depth)
     */
    createVignette() {
        // Use a screen-space quad with radial gradient texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(256, 256, 100, 256, 256, 360);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.85, 'rgba(0, 4, 12, 0.3)');
        gradient.addColorStop(1.0, 'rgba(0, 4, 12, 0.6)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);

        this._vignetteTexture = new THREE.CanvasTexture(canvas);

        // Use a CSS overlay instead — cheaper and resolution-independent
        const vignetteEl = document.createElement('div');
        vignetteEl.id = 'vignette-overlay';
        vignetteEl.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
            box-shadow: inset 0 0 250px 80px rgba(0, 4, 12, 0.5);
            z-index: 1;
        `;
        document.getElementById('game-container').appendChild(vignetteEl);
    }

    /**
     * Load a sector's entities into the scene
     */
    loadSector(sector) {
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

        // Remove all shadows
        for (const [entity, shadow] of this.entityShadows) {
            this.entityGroup.remove(shadow);
            shadow.geometry.dispose();
            shadow.material.dispose();
        }
        this.entityShadows.clear();

        // Clear effects and lights
        this.effects.clear();
        this.lightPool.clear();
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

            // Create shadow for ships, stations, and asteroids
            this.createEntityShadow(entity);
        }
    }

    /**
     * Create a shadow beneath an entity
     */
    createEntityShadow(entity) {
        if (this.entityShadows.has(entity)) return;

        const r = entity.radius || 20;
        // Elliptical shadow - wider than tall to match tilt perspective
        const shadowGeo = new THREE.CircleGeometry(r * 1.2, 16);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
        });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.position.set(entity.x, entity.y - r * 0.15, -0.5);
        shadow.scale.y = 0.6; // Squash vertically for perspective shadow
        shadow.renderOrder = -1;
        this.entityGroup.add(shadow);
        this.entityShadows.set(entity, shadow);
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

        // Remove shadow too
        const shadow = this.entityShadows.get(entity);
        if (shadow) {
            this.entityGroup.remove(shadow);
            shadow.geometry.dispose();
            shadow.material.dispose();
            this.entityShadows.delete(entity);
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

        // Update entity shadows
        this.updateEntityShadows();

        // Update selection indicators
        this.updateSelectionIndicators();

        // Update starfield parallax
        this.starField.update(this.game.camera);

        // Update nebula animation
        this.nebula.update(1 / 60);

        // Update effects
        this.effects.update(1 / 60);

        // Update dynamic lights
        this.lightPool.update(1 / 60);

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
     * Update shadow positions to follow entities
     */
    updateEntityShadows() {
        for (const [entity, shadow] of this.entityShadows) {
            if (!entity.alive) continue;
            const r = entity.radius || 20;
            // Shadow offset slightly below entity to simulate light from upper-front
            shadow.position.set(entity.x, entity.y - r * 0.15, -0.5);
            shadow.visible = entity.visible && entity.alive;
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
     * Accounts for camera tilt by ray-plane intersection
     */
    screenToWorld(screenX, screenY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

        // For tilted orthographic camera, cast a ray and intersect with z=0 plane
        this._raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
        const intersection = new THREE.Vector3();
        const result = this._raycaster.ray.intersectPlane(this._groundPlane, intersection);

        if (result) {
            return { x: intersection.x, y: intersection.y };
        }

        // Fallback: untilted projection
        const vector = new THREE.Vector3(ndcX, ndcY, 0);
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
