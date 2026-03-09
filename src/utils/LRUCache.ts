/** Thread-safe LRU cache with optional dispose callback */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private readonly maxSize: number;
  private readonly onEvict?: (key: K, value: V) => void;

  constructor(maxSize: number = 200, onEvict?: (key: K, value: V) => void) {
    this.maxSize = maxSize;
    this.onEvict = onEvict;
  }

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        const evicted = this.map.get(firstKey);
        this.map.delete(firstKey);
        if (evicted && this.onEvict) this.onEvict(firstKey, evicted);
      }
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    if (this.onEvict) {
      this.map.forEach((v, k) => this.onEvict!(k, v));
    }
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
