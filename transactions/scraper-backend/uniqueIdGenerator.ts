// Unique ID Generator for Spanish Architecture Offices
// Format: B---S where --- is a random 3-digit number

export class UniqueIdGenerator {
  private static usedIds = new Set<string>();
  private static readonly PREFIX = 'B';
  private static readonly SUFFIX = 'S';
  private static readonly ID_LENGTH = 3; // 3 digits between B and S

  /**
   * Generate a unique ID for Spanish architecture offices
   * Format: B---S (e.g., B123S, B456S, B789S)
   */
  static generateId(): string {
    let attempts = 0;
    const maxAttempts = 1000; // Prevent infinite loops

    while (attempts < maxAttempts) {
      // Generate random 3-digit number
      const randomNumber = Math.floor(Math.random() * 1000);
      const paddedNumber = randomNumber.toString().padStart(3, '0');
      
      const id = `${this.PREFIX}${paddedNumber}${this.SUFFIX}`;
      
      // Check if ID is already used
      if (!this.usedIds.has(id)) {
        this.usedIds.add(id);
        console.log(`Generated unique ID: ${id}`);
        return id;
      }
      
      attempts++;
    }

    // Fallback: if we can't generate a unique ID, throw an error
    throw new Error(`Failed to generate unique ID after ${maxAttempts} attempts`);
  }

  /**
   * Check if an ID is already in use
   */
  static isIdUsed(id: string): boolean {
    return this.usedIds.has(id);
  }

  /**
   * Add an existing ID to the used set (for loading from database)
   */
  static markIdAsUsed(id: string): void {
    this.usedIds.add(id);
  }

  /**
   * Get all currently used IDs (for debugging)
   */
  static getUsedIds(): string[] {
    return Array.from(this.usedIds);
  }

  /**
   * Clear all used IDs (for testing)
   */
  static clearUsedIds(): void {
    this.usedIds.clear();
  }

  /**
   * Validate ID format
   */
  static isValidId(id: string): boolean {
    const pattern = /^B\d{3}S$/;
    return pattern.test(id);
  }

  /**
   * Load existing IDs from database to prevent collisions
   */
  static async loadExistingIds(existingOffices: any[]): Promise<void> {
    console.log(`Loading ${existingOffices.length} existing IDs...`);
    
    for (const office of existingOffices) {
      if (office.uniqueId && this.isValidId(office.uniqueId)) {
        this.markIdAsUsed(office.uniqueId);
      }
    }
    
    console.log(`Loaded ${this.usedIds.size} existing unique IDs`);
  }
}
