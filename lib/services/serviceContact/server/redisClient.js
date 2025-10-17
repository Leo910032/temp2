// lib/services/serviceContact/server/redisClient.js
// Redis client for query enhancement caching
// Provides connection management and helper methods

import { createClient } from 'redis';

/**
 * RedisClient - Singleton Redis connection manager
 * 
 * Features:
 * - Automatic reconnection
 * - Connection pooling
 * - Error handling
 * - Helper methods for cache operations
 */
class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Initialize and connect to Redis
   */
  async connect() {
    if (this.isConnected) {
      console.log('✅ [Redis] Already connected');
      return this.client;
    }

    if (this.isConnecting) {
      console.log('⏳ [Redis] Connection in progress, waiting...');
      // Wait for existing connection attempt
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.client;
    }

    try {
      this.isConnecting = true;
      console.log('🔌 [Redis] Connecting to Redis Cloud...');

      this.client = createClient({
        username: 'default',
        password: process.env.REDIS_PASSWORD || 'cv7qij6GjYrg9SnOJ8BSl7NNnplEfgcs',
        socket: {
          host: process.env.REDIS_HOST || 'redis-11432.crce202.eu-west-3-1.ec2.redns.redis-cloud.com',
          port: parseInt(process.env.REDIS_PORT || '11432'),
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('❌ [Redis] Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            const delay = Math.min(retries * 100, 3000);
            console.log(`🔄 [Redis] Reconnecting in ${delay}ms (attempt ${retries})...`);
            return delay;
          }
        }
      });

      // Set up event listeners
      this.client.on('error', (err) => {
        console.error('❌ [Redis] Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔌 [Redis] Connected to server');
      });

      this.client.on('ready', () => {
        console.log('✅ [Redis] Client ready');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 [Redis] Reconnecting...');
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 [Redis] Connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      
      // Test connection
      await this.client.ping();
      
      this.isConnected = true;
      this.isConnecting = false;
      
      console.log('✅ [Redis] Successfully connected and ready');
      return this.client;

    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      console.error('❌ [Redis] Connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Get Redis client (connect if not connected)
   */
  async getClient() {
    if (!this.isConnected) {
      await this.connect();
    }
    return this.client;
  }

  /**
   * Set a value with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttlSeconds - TTL in seconds (default: 86400 = 24 hours)
   */
  async set(key, value, ttlSeconds = 86400) {
    try {
      const client = await this.getClient();
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttlSeconds > 0) {
        await client.setEx(key, ttlSeconds, stringValue);
      } else {
        await client.set(key, stringValue);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [Redis] Set error:', error.message);
      return false;
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @param {boolean} parseJson - Whether to parse as JSON (default: true)
   */
  async get(key, parseJson = true) {
    try {
      const client = await this.getClient();
      const value = await client.get(key);
      
      if (value === null) {
        return null;
      }
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          console.warn('⚠️ [Redis] JSON parse failed, returning raw value');
          return value;
        }
      }
      
      return value;
    } catch (error) {
      console.error('❌ [Redis] Get error:', error.message);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key) {
    try {
      const client = await this.getClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.error('❌ [Redis] Delete error:', error.message);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key) {
    try {
      const client = await this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ [Redis] Exists error:', error.message);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key) {
    try {
      const client = await this.getClient();
      return await client.ttl(key);
    } catch (error) {
      console.error('❌ [Redis] TTL error:', error.message);
      return -1;
    }
  }

  /**
   * Clear all keys matching a pattern
   */
  async clearPattern(pattern) {
    try {
      const client = await this.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(keys);
        console.log(`🗑️ [Redis] Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
      
      return keys.length;
    } catch (error) {
      console.error('❌ [Redis] Clear pattern error:', error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const client = await this.getClient();
      const info = await client.info('stats');
      const memory = await client.info('memory');
      
      return {
        connected: this.isConnected,
        info,
        memory
      };
    } catch (error) {
      console.error('❌ [Redis] Stats error:', error.message);
      return null;
    }
  }

  /**
   * Close the connection
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        console.log('👋 [Redis] Disconnected gracefully');
      }
      this.isConnected = false;
    } catch (error) {
      console.error('❌ [Redis] Disconnect error:', error.message);
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();

// Helper function to generate cache keys
export function generateCacheKey(prefix, ...parts) {
  return `${prefix}:${parts.join(':')}`;
}
