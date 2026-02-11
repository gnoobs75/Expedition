// =============================================
// Camera System - Orthographic 2D camera
// With zoom, pan, and target following
// =============================================

import { CONFIG } from '../config.js';
import { lerp, clamp } from '../utils/math.js';

export class Camera {
    constructor(game) {
        this.game = game;

        // Position (center of view)
        this.x = CONFIG.SECTOR_SIZE / 2;
        this.y = CONFIG.SECTOR_SIZE / 2;

        // Target position for smooth movement
        this.targetX = this.x;
        this.targetY = this.y;

        // Zoom level
        this.zoom = CONFIG.CAMERA_ZOOM_DEFAULT;
        this.targetZoom = this.zoom;

        // Following settings
        this.following = null; // Entity to follow
        this.lookingAt = null; // Entity to look at (temporary)
        this.followSpeed = 5; // How fast camera catches up
        this.zoomSpeed = 8;

        // Bounds
        this.minZoom = CONFIG.CAMERA_ZOOM_MIN;
        this.maxZoom = CONFIG.CAMERA_ZOOM_MAX;

        // Shake effect
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
    }

    /**
     * Update camera position
     */
    update(dt) {
        // Determine target to follow
        let target = this.lookingAt || this.following || this.game.player;

        if (target && target.alive) {
            this.targetX = target.x;
            this.targetY = target.y;
        }

        // Smooth camera movement
        this.x = lerp(this.x, this.targetX, this.followSpeed * dt);
        this.y = lerp(this.y, this.targetY, this.followSpeed * dt);

        // Smooth zoom
        this.zoom = lerp(this.zoom, this.targetZoom, this.zoomSpeed * dt);

        // Update shake — damped sine for cinematic feel
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            const decay = this.shakeDuration / (this.shakeDuration + dt); // Smooth decay
            const freq = 15 + Math.random() * 10; // Varied frequency
            const t = this.shakeDuration * freq;
            this.shakeOffsetX = Math.sin(t) * this.shakeIntensity * decay;
            this.shakeOffsetY = Math.cos(t * 1.3) * this.shakeIntensity * decay;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }
    }

    /**
     * Set zoom level directly
     */
    setZoom(zoom) {
        this.targetZoom = clamp(zoom, this.minZoom, this.maxZoom);
    }

    /**
     * Adjust zoom by delta
     */
    adjustZoom(delta) {
        // Use logarithmic scaling for smoother zoom
        const factor = 1 + CONFIG.CAMERA_ZOOM_SPEED * Math.sign(delta);
        this.targetZoom = clamp(
            this.targetZoom * factor,
            this.minZoom,
            this.maxZoom
        );
    }

    /**
     * Set entity to follow
     */
    follow(entity) {
        this.following = entity;
        this.lookingAt = null;
    }

    /**
     * Look at entity (temporary, until player moves or presses C)
     */
    lookAt(entity) {
        this.lookingAt = entity;
    }

    /**
     * Stop looking at and return to following player
     */
    centerOnPlayer() {
        this.lookingAt = null;
        this.following = this.game.player;
    }

    /**
     * Move camera by offset in screen pixels
     */
    pan(dx, dy) {
        const viewHeight = 1000000 / this.zoom;
        const pixelToWorld = viewHeight / window.innerHeight;
        this.targetX += dx * pixelToWorld;
        this.targetY -= dy * pixelToWorld; // Screen Y is inverted vs world Y
    }

    /**
     * Apply camera shake effect
     */
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    /**
     * Get view bounds (for culling)
     * Uses same frustum formula as Renderer: viewHeight = 1000000 / zoom
     */
    getViewBounds() {
        const viewHeight = 1000000 / this.zoom;
        const aspect = window.innerWidth / window.innerHeight;
        const halfWidth = (viewHeight * aspect) / 2;
        const halfHeight = viewHeight / 2;

        return {
            left: this.x - halfWidth,
            right: this.x + halfWidth,
            top: this.y - halfHeight,
            bottom: this.y + halfHeight,
            width: halfWidth * 2,
            height: halfHeight * 2,
        };
    }

    /**
     * Check if a point is visible
     */
    isVisible(x, y, margin = 100) {
        const bounds = this.getViewBounds();
        return (
            x >= bounds.left - margin &&
            x <= bounds.right + margin &&
            y >= bounds.top - margin &&
            y <= bounds.bottom + margin
        );
    }

    /**
     * Get camera position with shake applied
     */
    getPosition() {
        return {
            x: this.x + this.shakeOffsetX,
            y: this.y + this.shakeOffsetY,
        };
    }

    /**
     * Get zoom percentage for UI
     */
    getZoomPercent() {
        const range = this.maxZoom - this.minZoom;
        return ((this.zoom - this.minZoom) / range) * 100;
    }

    /**
     * Is camera zoomed out to map view?
     */
    isMapView() {
        return this.zoom < 100;
    }

    /**
     * Is camera zoomed in for tactical view?
     */
    isTacticalView() {
        return this.zoom > 300;
    }

    /**
     * Cinematic sector arrival zoom — briefly zoom out then back in
     */
    sectorArrivalZoom() {
        const savedZoom = this.targetZoom;
        // Immediately pull zoom out
        this.zoom = savedZoom * 0.55;
        this.targetZoom = savedZoom * 0.55;
        // After a brief pause, smoothly zoom back to original
        setTimeout(() => {
            this.targetZoom = savedZoom;
        }, 300);
    }
}
