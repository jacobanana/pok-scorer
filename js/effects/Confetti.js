// ============================================
// CONFETTI PARTICLE SYSTEM
// Creates spectacular celebration effects
// ============================================

/**
 * Individual confetti particle with physics
 */
class ConfettiParticle {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Position - start above viewport
        this.x = options.x ?? Math.random() * canvas.width;
        this.y = options.y ?? -20 - Math.random() * 100;

        // Velocity
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = Math.random() * 2 + 2;

        // Physics
        this.gravity = 0.12;
        this.drag = 0.99;
        this.wobbleSpeed = Math.random() * 0.1 + 0.05;
        this.wobbleAmplitude = Math.random() * 3 + 1;
        this.wobbleOffset = Math.random() * Math.PI * 2;

        // Rotation
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.15;
        this.tilt = Math.random() * Math.PI * 2;
        this.tiltSpeed = Math.random() * 0.05 + 0.02;

        // Appearance
        this.size = Math.random() * 8 + 6;
        this.aspectRatio = Math.random() * 0.5 + 0.5;
        this.color = options.color ?? this._randomColor();
        this.shape = options.shape ?? this._randomShape();
        this.opacity = 1;

        // Lifetime
        this.life = 1;
        this.decay = 0.003 + Math.random() * 0.002;

        // Flutter effect for ribbon-like motion
        this.flutter = Math.random() * 0.5 + 0.5;
        this.flutterPhase = Math.random() * Math.PI * 2;
    }

    _randomColor() {
        const colors = [
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
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    _randomShape() {
        const shapes = ['rect', 'rect', 'rect', 'circle', 'ribbon', 'star'];
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
        if (this.y > this.canvas.height * 0.7) {
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

/**
 * Confetti system manager
 * Handles particle creation, animation, and cleanup
 */
export class ConfettiSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        this.isRunning = false;
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.wind = 0;
        this.targetWind = 0;

        // Configuration
        this.config = {
            particleCount: 150,      // Initial burst count
            spawnRate: 8,            // Particles per frame during continuous mode
            gravity: 0.12,
            windChangeInterval: 2000,
            maxParticles: 400
        };

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
        const burstCount = options.burstCount ?? this.config.particleCount;
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

        for (let i = 0; i < count; i++) {
            // Spawn from multiple points across the top
            const spawnX = Math.random() * this.canvas.width;
            const spawnY = -Math.random() * 200 - 50;

            const particle = new ConfettiParticle(this.canvas, {
                x: spawnX,
                y: spawnY
            });

            // Add some initial velocity variation for burst effect
            particle.vy = Math.random() * 3 + 1;
            particle.vx = (spawnX - centerX) / this.canvas.width * 2 + (Math.random() - 0.5) * 4;

            this.particles.push(particle);
        }
    }

    /**
     * Spawn continuous particles
     * @private
     */
    _spawnContinuous() {
        if (this.particles.length >= this.config.maxParticles) return;

        for (let i = 0; i < this.config.spawnRate; i++) {
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
        this.wind += (this.targetWind - this.wind) * 0.02;

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
        if (this.spawnTimer > 100) { // Every 100ms
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

            this.targetWind = (Math.random() - 0.5) * 3;

            setTimeout(changeWind,
                this.config.windChangeInterval + Math.random() * 1000
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
