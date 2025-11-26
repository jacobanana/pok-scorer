import { Component } from '../core/Component.js';

/**
 * LoadingBar component - Animated loading/progress bar
 *
 * Props:
 * - id: string - Element ID
 * - duration: number - Animation duration in ms (default 3000)
 * - autoStart: boolean - Start animation on mount
 */
export class LoadingBar extends Component {
    template() {
        const { id } = this.props;
        const idAttr = id ? `id="${id}"` : '';

        return `
            <div class="round-end-loading-bar" ${idAttr}>
                <div class="loading-bar-fill"></div>
            </div>
        `.trim();
    }

    onCreate() {
        this._animationId = null;

        if (this.props.autoStart) {
            this.start();
        }
    }

    /**
     * Get the fill element
     * @returns {HTMLElement|null}
     */
    getFill() {
        return this.find('.loading-bar-fill');
    }

    /**
     * Start the loading animation
     * @param {Function} onComplete - Callback when animation completes
     * @returns {LoadingBar} this for chaining
     */
    start(onComplete = null) {
        const fill = this.getFill();
        if (!fill) return this;

        const duration = this.props.duration || 3000;

        // Reset
        this.reset();
        this.show();

        // Animate
        fill.style.transition = `width ${duration}ms linear`;
        requestAnimationFrame(() => {
            fill.style.width = '100%';
        });

        // Handle completion
        if (onComplete) {
            this._animationId = setTimeout(() => {
                onComplete();
            }, duration);
        }

        return this;
    }

    /**
     * Stop the animation
     * @returns {LoadingBar} this for chaining
     */
    stop() {
        if (this._animationId) {
            clearTimeout(this._animationId);
            this._animationId = null;
        }

        const fill = this.getFill();
        if (fill) {
            // Freeze at current position
            const currentWidth = fill.offsetWidth;
            const parentWidth = this.el.offsetWidth;
            const percentage = (currentWidth / parentWidth) * 100;

            fill.style.transition = 'none';
            fill.style.width = `${percentage}%`;
        }

        return this;
    }

    /**
     * Reset the loading bar to 0
     * @returns {LoadingBar} this for chaining
     */
    reset() {
        this.stop();

        const fill = this.getFill();
        if (fill) {
            fill.style.transition = 'none';
            fill.style.width = '0%';
        }

        return this;
    }

    /**
     * Set progress manually (0-100)
     * @param {number} percent
     * @returns {LoadingBar} this for chaining
     */
    setProgress(percent) {
        const fill = this.getFill();
        if (fill) {
            fill.style.transition = 'width 0.1s ease';
            fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        }
        return this;
    }

    onUnmount() {
        this.stop();
    }
}
