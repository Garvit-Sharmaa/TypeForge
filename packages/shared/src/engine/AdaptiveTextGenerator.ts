export interface KeyPerformanceProfile {
  keyChar: string;
  errorRate: number; // 0 to 1 scale typically, or percentage
  avgLatencyMs: number;
}

export class AdaptiveTextGenerator {
  /**
   * Identifies the top 3 weakest keys mathematically based on a combined severity score.
   *
   * Formula: severity = (errorRate * 10) + (avgLatencyMs / 50)
   * Time Complexity: O(K log K) where K is number of keys (max ~50) -> Effectively O(1).
   */
  public static identifyWeakestKeys(profile: KeyPerformanceProfile[]): string[] {
    if (!profile || profile.length === 0) return [];

    const scoredKeys = profile.map(p => {
      // Weighting heuristic: errors are heavily penalized, latency is secondary
      const severity = (p.errorRate * 10) + (p.avgLatencyMs / 50);
      return { key: p.keyChar, severity };
    });

    // Sort descending by severity and pick top 3
    scoredKeys.sort((a, b) => b.severity - a.severity);

    return scoredKeys.slice(0, 3).map(k => k.key);
  }

  /**
   * Generates a 30-word adaptive practice string from a given dictionary.
   * Heavily favors words containing the top 3 weakest keys.
   *
   * @param dictionary - Array of common English words
   * @param weakKeys - The top 3 weakest keys (e.g., ['q', 'p', 'z'])
   * @param wordCount - Number of words to generate (default 30)
   * @returns Array of generated words
   *
   * Time Complexity: O(N) for dictionary weighting + O(wordCount * log N) for binary search sampling.
   * Very fast, single-digit milliseconds deterministic execution.
   */
  public static generateAdaptiveDrill(
    dictionary: string[],
    weakKeys: string[],
    wordCount: number = 30
  ): string[] {
    if (dictionary.length === 0) return [];
    if (weakKeys.length === 0) {
      // Fallback: fully random generation if no weak keys
      return Array.from({ length: wordCount }, () =>
        dictionary[Math.floor(Math.random() * dictionary.length)]
      );
    }

    const n = dictionary.length;
    const prefixSums = new Float64Array(n); // Float64 to avoid overflow with large dictionaries

    let totalWeight = 0;

    // --- Phase 1: Weighted Dictionary (O(N)) ---
    for (let i = 0; i < n; i++) {
      const word = dictionary[i];
      let weight = 1; // Base weight (all words have non-zero probability)

      // Add multiplier for occurrences of weak keys
      for (let charIndex = 0; charIndex < word.length; charIndex++) {
        const char = word[charIndex].toLowerCase();
        if (char === weakKeys[0]) {
          weight += 10; // Heaviest penalty for #1 weakest key
        } else if (char === weakKeys[1]) {
          weight += 6;  // Medium penalty for #2
        } else if (char === weakKeys[2]) {
          weight += 3;  // Light penalty for #3
        }
      }

      totalWeight += weight;
      prefixSums[i] = totalWeight;
    }

    // --- Phase 2: Binary Search Sampling (O(W * log N)) ---
    const generatedWords: string[] = [];
    
    for (let i = 0; i < wordCount; i++) {
      // Random target weight between 0 and totalWeight
      const target = Math.random() * totalWeight;

      // Binary search to find the word index corresponding to target weight
      let left = 0;
      let right = n - 1;
      let selectedIndex = -1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (target <= prefixSums[mid]) {
          selectedIndex = mid;
          right = mid - 1; // Try to find a smaller index that satisfies the condition
        } else {
          left = mid + 1;
        }
      }

      // Fallback in case of extreme floating point precision edge cases
      if (selectedIndex === -1) selectedIndex = n - 1;

      generatedWords.push(dictionary[selectedIndex]);
    }

    return generatedWords;
  }
}
