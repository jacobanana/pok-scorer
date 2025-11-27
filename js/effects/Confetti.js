// ============================================
// CONFETTI PARTICLE SYSTEM
// Creates spectacular celebration effects
// ============================================

// ============================================
// CONFIGURATION
// Adjust these values to customize the confetti
// ============================================

const CONFETTI_CONFIG = {
    // Particle counts
    INITIAL_BURST_COUNT: 150,       // Particles in initial burst
    SPAWN_RATE: 8,                  // Particles spawned per interval
    MAX_PARTICLES: 400,             // Maximum particles on screen
    SPAWN_INTERVAL_MS: 100,         // How often to spawn new particles

    // Physics
    GRAVITY: 0.12,                  // Downward acceleration
    DRAG: 0.99,                     // Air resistance (0-1)
    WIND_STRENGTH: 3,               // Maximum wind force
    WIND_CHANGE_INTERVAL_MS: 2000,  // How often wind changes direction
    WIND_INTERPOLATION: 0.02,       // How smoothly wind changes (0-1)

    // Particle appearance
    MIN_SIZE: 6,                    // Minimum particle size (px)
    MAX_SIZE: 14,                   // Maximum particle size (px)
    MIN_ASPECT_RATIO: 0.5,          // Minimum width/height ratio
    MAX_ASPECT_RATIO: 1.0,          // Maximum width/height ratio

    // Particle motion
    INITIAL_VELOCITY_X: 4,          // Horizontal velocity spread
    INITIAL_VELOCITY_Y_MIN: 1,      // Minimum downward velocity
    INITIAL_VELOCITY_Y_MAX: 3,      // Maximum downward velocity
    WOBBLE_SPEED_MIN: 0.05,         // Minimum wobble frequency
    WOBBLE_SPEED_MAX: 0.15,         // Maximum wobble frequency
    WOBBLE_AMPLITUDE_MIN: 1,        // Minimum wobble distance
    WOBBLE_AMPLITUDE_MAX: 4,        // Maximum wobble distance
    ROTATION_SPEED: 0.15,           // Maximum rotation speed
    TILT_SPEED_MIN: 0.02,           // Minimum 3D tilt speed
    TILT_SPEED_MAX: 0.07,           // Maximum 3D tilt speed
    FLUTTER_MIN: 0.5,               // Minimum flutter effect
    FLUTTER_MAX: 1.0,               // Maximum flutter effect

    // Particle lifetime
    DECAY_RATE_MIN: 0.003,          // Minimum fade speed
    DECAY_RATE_MAX: 0.005,          // Maximum fade speed
    FADE_START_PERCENT: 0.7,        // Start fading at this % of screen height

    // Spawn positions
    SPAWN_HEIGHT_MIN: 50,           // Minimum spawn height above viewport
    SPAWN_HEIGHT_MAX: 250,          // Maximum spawn height above viewport

    // Colors - vibrant celebration palette
    COLORS: [
        '#ff6b6b', // Red
        '#4dabf7', // Blue
        '#69db7c', // Green
        '#ffd43b', // Yellow
        '#da77f2', // Purple
        '#ff922b', // Orange
        '#f06595', // Pink
        '#20c997', // Teal
        '#fcc419', // Gold
        '#ffffff', // White
    ],

    // Shape distribution (more common shapes appear multiple times)
    SHAPES: ['rect', 'rect', 'rect', 'circle', 'ribbon', 'star'],
};

// ============================================
// CONFETTI PARTICLE CLASS
// ============================================

/**
 * Individual confetti particle with physics
 */
class ConfettiParticle {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        const cfg = CONFETTI_CONFIG;

        // Position - start above viewport
        this.x = options.x ?? Math.random() * canvas.width;
        this.y = options.y ?? -cfg.SPAWN_HEIGHT_MIN - Math.random() * (cfg.SPAWN_HEIGHT_MAX - cfg.SPAWN_HEIGHT_MIN);

        // Velocity
        this.vx = (Math.random() - 0.5) * cfg.INITIAL_VELOCITY_X;
        this.vy = Math.random() * (cfg.INITIAL_VELOCITY_Y_MAX - cfg.INITIAL_VELOCITY_Y_MIN) + cfg.INITIAL_VELOCITY_Y_MIN;

        // Physics
        this.gravity = cfg.GRAVITY;
        this.drag = cfg.DRAG;
        this.wobbleSpeed = Math.random() * (cfg.WOBBLE_SPEED_MAX - cfg.WOBBLE_SPEED_MIN) + cfg.WOBBLE_SPEED_MIN;
        this.wobbleAmplitude = Math.random() * (cfg.WOBBLE_AMPLITUDE_MAX - cfg.WOBBLE_AMPLITUDE_MIN) + cfg.WOBBLE_AMPLITUDE_MIN;
        this.wobbleOffset = Math.random() * Math.PI * 2;

        // Rotation
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * cfg.ROTATION_SPEED;
        this.tilt = Math.random() * Math.PI * 2;
        this.tiltSpeed = Math.random() * (cfg.TILT_SPEED_MAX - cfg.TILT_SPEED_MIN) + cfg.TILT_SPEED_MIN;

        // Appearance
        this.size = Math.random() * (cfg.MAX_SIZE - cfg.MIN_SIZE) + cfg.MIN_SIZE;
        this.aspectRatio = Math.random() * (cfg.MAX_ASPECT_RATIO - cfg.MIN_ASPECT_RATIO) + cfg.MIN_ASPECT_RATIO;
        this.color = options.color ?? this._randomColor();
        this.shape = options.shape ?? this._randomShape();
        this.opacity = 1;

        // Lifetime
        this.life = 1;
        this.decay = cfg.DECAY_RATE_MIN + Math.random() * (cfg.DECAY_RATE_MAX - cfg.DECAY_RATE_MIN);

        // Flutter effect for ribbon-like motion
        this.flutter = Math.random() * (cfg.FLUTTER_MAX - cfg.FLUTTER_MIN) + cfg.FLUTTER_MIN;
        this.flutterPhase = Math.random() * Math.PI * 2;
    }

    _randomColor() {
        const colors = CONFETTI_CONFIG.COLORS;
        return colors[Math.floor(Math.random() * colors.length)];
    }

    _randomShape() {
        const shapes = CONFETTI_CONFIG.SHAPES;
        return shapes[Math.floor(Math.random() * shapes.length)];
    }

    update(deltaTime, wind = 0) {
        // Apply gravity
        this.vy += this.gravity;

        // Apply wind
        this.vx += wind * 0.01;

        // Apply drag
        this.vx *= this.drag;
        this.vy *= this.drag;

        // Wobble motion (side-to-side flutter)
        this.wobbleOffset += this.wobbleSpeed;
        const wobble = Math.sin(this.wobbleOffset) * this.wobbleAmplitude;

        // Flutter effect
        this.flutterPhase += this.flutter * 0.1;
        const flutter = Math.sin(this.flutterPhase) * this.flutter * 2;

        // Update position
        this.x += this.vx + wobble + flutter;
        this.y += this.vy;

        // Update rotation
        this.rotation += this.rotationSpeed;
        this.tilt += this.tiltSpeed;

        // Decay opacity as particle falls
        if (this.y > this.canvas.height * CONFETTI_CONFIG.FADE_START_PERCENT) {
            this.life -= this.decay * 2;
        }
        this.opacity = Math.max(0, this.life);

        // Return false if particle should be removed
        return this.y < this.canvas.height + 50 && this.life > 0;
    }

    draw() {
        const ctx = this.ctx;
        ctx.save();

        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Apply 3D-like tilt effect
        const scaleX = Math.cos(this.tilt);
        ctx.scale(scaleX, 1);

        ctx.fillStyle = this.color;

        switch (this.shape) {
            case 'rect':
                this._drawRect(ctx);
                break;
            case 'circle':
                this._drawCircle(ctx);
                break;
            case 'ribbon':
                this._drawRibbon(ctx);
                break;
            case 'star':
                this._drawStar(ctx);
                break;
            default:
                this._drawRect(ctx);
        }

        ctx.restore();
    }

    _drawRect(ctx) {
        const width = this.size;
        const height = this.size * this.aspectRatio;
        ctx.fillRect(-width / 2, -height / 2, width, height);

        // Add slight gradient for 3D effect
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-width / 2, -height / 2, width / 2, height);
    }

    _drawCircle(ctx) {
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(-this.size / 6, -this.size / 6, this.size / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawRibbon(ctx) {
        const width = this.size * 1.5;
        const height = this.size * 0.4;

        ctx.beginPath();
        ctx.moveTo(-width / 2, 0);
        ctx.quadraticCurveTo(-width / 4, -height, 0, 0);
        ctx.quadraticCurveTo(width / 4, height, width / 2, 0);
        ctx.quadraticCurveTo(width / 4, -height / 2, 0, 0);
        ctx.quadraticCurveTo(-width / 4, height / 2, -width / 2, 0);
        ctx.fill();
    }

    _drawStar(ctx) {
        const spikes = 5;
        const outerRadius = this.size / 2;
        const innerRadius = this.size / 4;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
    }
}

// ============================================
// CONFETTI SYSTEM CLASS
// ============================================

/**
 * Confetti system manager
 * Handles particle creation, animation, and cleanup
 */
export class ConfettiSystem {
    constructor(customConfig = {}) {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        this.isRunning = false;
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.wind = 0;
        this.targetWind = 0;

        // Allow runtime config overrides
        this.config = { ...CONFETTI_CONFIG, ...customConfig };

        // Bind methods
        this._animate = this._animate.bind(this);
        this._handleResize = this._handleResize.bind(this);
    }

    /**
     * Initialize the confetti system
     * @param {HTMLElement} container - Container element for the canvas
     */
    init(container) {
        if (this.canvas) {
            this.destroy();
        }

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'confetti-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;

        this.ctx = this.canvas.getContext('2d');
        container.appendChild(this.canvas);

        this._handleResize();
        window.addEventListener('resize', this._handleResize);

        return this;
    }

    /**
     * Start the confetti celebration
     * @param {Object} options - Start options
     */
    start(options = {}) {
        if (!this.canvas) {
            console.warn('Confetti: Canvas not initialized');
            return this;
        }

        this.isRunning = true;
        this.lastTime = performance.now();

        // Initial burst of confetti
        const burstCount = options.burstCount ?? this.config.INITIAL_BURST_COUNT;
        this._createBurst(burstCount);

        // Start animation loop
        this._animate();

        // Start wind changes
        this._startWindChanges();

        return this;
    }

    /**
     * Create a burst of confetti particles
     * @private
     */
    _createBurst(count) {
        const centerX = this.canvas.width / 2;
        const cfg = this.config;

        for (let i = 0; i < count; i++) {
            // Spawn from multiple points across the top
            const spawnX = Math.random() * this.canvas.width;
            const spawnY = -Math.random() * cfg.SPAWN_HEIGHT_MAX - cfg.SPAWN_HEIGHT_MIN;

            const particle = new ConfettiParticle(this.canvas, {
                x: spawnX,
                y: spawnY
            });

            // Add some initial velocity variation for burst effect
            particle.vy = Math.random() * cfg.INITIAL_VELOCITY_Y_MAX + cfg.INITIAL_VELOCITY_Y_MIN;
            particle.vx = (spawnX - centerX) / this.canvas.width * 2 + (Math.random() - 0.5) * cfg.INITIAL_VELOCITY_X;

            this.particles.push(particle);
        }
    }

    /**
     * Spawn continuous particles
     * @private
     */
    _spawnContinuous() {
        if (this.particles.length >= this.config.MAX_PARTICLES) return;

        for (let i = 0; i < this.config.SPAWN_RATE; i++) {
            const particle = new ConfettiParticle(this.canvas, {
                x: Math.random() * this.canvas.width,
                y: -20 - Math.random() * 50
            });
            this.particles.push(particle);
        }
    }

    /**
     * Animation loop
     * @private
     */
    _animate() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Smoothly interpolate wind
        this.wind += (this.targetWind - this.wind) * this.config.WIND_INTERPOLATION;

        // Update and draw particles
        this.particles = this.particles.filter(particle => {
            const alive = particle.update(deltaTime, this.wind);
            if (alive) {
                particle.draw();
            }
            return alive;
        });

        // Spawn new particles continuously
        this.spawnTimer += deltaTime;
        if (this.spawnTimer > this.config.SPAWN_INTERVAL_MS) {
            this._spawnContinuous();
            this.spawnTimer = 0;
        }

        // Continue animation
        this.animationId = requestAnimationFrame(this._animate);
    }

    /**
     * Start random wind changes
     * @private
     */
    _startWindChanges() {
        const changeWind = () => {
            if (!this.isRunning) return;

            this.targetWind = (Math.random() - 0.5) * this.config.WIND_STRENGTH;

            setTimeout(changeWind,
                this.config.WIND_CHANGE_INTERVAL_MS + Math.random() * 1000
            );
        };

        changeWind();
    }

    /**
     * Stop the confetti
     * @param {boolean} immediate - If true, clears immediately
     */
    stop(immediate = false) {
        this.isRunning = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (immediate) {
            this.particles = [];
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }

        return this;
    }

    /**
     * Clean up and remove the confetti system
     */
    destroy() {
        this.stop(true);

        window.removeEventListener('resize', this._handleResize);

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        this.canvas = null;
        this.ctx = null;
        this.particles = [];
    }

    /**
     * Handle window resize
     * @private
     */
    _handleResize() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);

        // Reset canvas size for CSS
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    /**
     * Add an extra burst of confetti
     * @param {number} count - Number of particles
     */
    burst(count = 50) {
        this._createBurst(count);
        return this;
    }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

// Singleton instance for easy access
let confettiInstance = null;

/**
 * Get or create the global confetti instance
 * @returns {ConfettiSystem}
 */
export function getConfetti() {
    if (!confettiInstance) {
        confettiInstance = new ConfettiSystem();
    }
    return confettiInstance;
}

/**
 * Convenience function to start confetti on a container
 * @param {HTMLElement} container
 * @param {Object} options
 */
export function startConfetti(container, options = {}) {
    const confetti = getConfetti();
    confetti.init(container);
    confetti.start(options);
    return confetti;
}

/**
 * Convenience function to stop confetti
 * @param {boolean} immediate
 */
export function stopConfetti(immediate = false) {
    if (confettiInstance) {
        confettiInstance.stop(immediate);
    }
}

/**
 * Convenience function to destroy confetti completely
 */
export function destroyConfetti() {
    if (confettiInstance) {
        confettiInstance.destroy();
        confettiInstance = null;
    }
}
