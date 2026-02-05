// =============================================
// Math Utilities
// =============================================

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Smooth step interpolation
 */
export function smoothstep(a, b, t) {
    t = clamp((t - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

/**
 * Calculate distance between two 2D points
 */
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance (faster, no sqrt)
 */
export function distanceSquared(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}

/**
 * Calculate angle between two points (radians)
 */
export function angleBetween(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Normalize angle to 0-2PI range
 */
export function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

/**
 * Shortest angle difference
 */
export function angleDifference(a, b) {
    let diff = normalizeAngle(b) - normalizeAngle(a);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

/**
 * Rotate a point around origin
 */
export function rotatePoint(x, y, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos,
    };
}

/**
 * Convert degrees to radians
 */
export function degToRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad) {
    return rad * (180 / Math.PI);
}

/**
 * Wrap coordinate for toroidal space
 */
export function wrapCoord(value, size) {
    while (value < 0) value += size;
    while (value >= size) value -= size;
    return value;
}

/**
 * Calculate wrapped distance (toroidal)
 */
export function wrappedDistance(x1, y1, x2, y2, size) {
    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);

    // Check if wrapping is shorter
    if (dx > size / 2) dx = size - dx;
    if (dy > size / 2) dy = size - dy;

    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get direction considering toroidal wrap
 */
export function wrappedDirection(x1, y1, x2, y2, size) {
    let dx = x2 - x1;
    let dy = y2 - y1;

    // Adjust for wrap
    if (dx > size / 2) dx -= size;
    if (dx < -size / 2) dx += size;
    if (dy > size / 2) dy -= size;
    if (dy < -size / 2) dy += size;

    return Math.atan2(dy, dx);
}

/**
 * Vector2 class for common operations
 */
export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    divideScalar(s) {
        if (s !== 0) {
            this.x /= s;
            this.y /= s;
        }
        return this;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    distanceTo(v) {
        return distance(this.x, this.y, v.x, v.y);
    }

    angleTo(v) {
        return angleBetween(this.x, this.y, v.x, v.y);
    }

    rotate(angle) {
        const result = rotatePoint(this.x, this.y, angle);
        this.x = result.x;
        this.y = result.y;
        return this;
    }

    lerp(v, t) {
        this.x = lerp(this.x, v.x, t);
        this.y = lerp(this.y, v.y, t);
        return this;
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    cross(v) {
        return this.x * v.y - this.y * v.x;
    }
}

/**
 * Format distance for display
 */
export function formatDistance(dist) {
    if (dist < 1000) {
        return Math.round(dist) + 'm';
    } else {
        return (dist / 1000).toFixed(1) + 'km';
    }
}

/**
 * Format credits with commas
 */
export function formatCredits(credits) {
    return Math.floor(credits).toLocaleString();
}
