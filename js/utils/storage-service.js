// ============================================
// STORAGE SERVICE
// Centralized localStorage access
// ============================================

/**
 * Centralized service for localStorage operations
 * Provides type-safe, consistent access to browser storage
 */
export class StorageService {
    /**
     * Save data to localStorage
     * @param {string} key - Storage key
     * @param {*} data - Data to store (will be JSON stringified)
     * @returns {boolean} - Success status
     */
    static save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`[StorageService] Failed to save to ${key}:`, error);
            return false;
        }
    }

    /**
     * Load data from localStorage
     * @param {string} key - Storage key
     * @returns {*|null} - Parsed data or null if not found/invalid
     */
    static load(key) {
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return null;
            return JSON.parse(saved);
        } catch (error) {
            console.error(`[StorageService] Failed to load from ${key}:`, error);
            return null;
        }
    }

    /**
     * Remove data from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} - Success status
     */
    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`[StorageService] Failed to remove ${key}:`, error);
            return false;
        }
    }

    /**
     * Check if a key exists in localStorage
     * @param {string} key - Storage key
     * @returns {boolean} - True if key exists
     */
    static exists(key) {
        return localStorage.getItem(key) !== null;
    }

    /**
     * Get raw string value without parsing
     * @param {string} key - Storage key
     * @returns {string|null} - Raw string value or null
     */
    static getRaw(key) {
        return localStorage.getItem(key);
    }

    /**
     * Clear all localStorage data
     * Use with caution!
     */
    static clear() {
        localStorage.clear();
    }
}
