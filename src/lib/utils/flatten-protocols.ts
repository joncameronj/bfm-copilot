import type {
  ProtocolRecommendation,
  FlattenedFrequencyCard
} from '@/types/diagnostic-analysis';

/**
 * Flattens grouped protocol recommendations into individual frequency cards
 *
 * BEFORE: 1 protocol card "Autonomic Balance" with 2 frequencies
 * AFTER: 2 frequency cards ("PNS Support", "Sympathetic Calm")
 *
 * Each flattened card retains context from its parent protocol:
 * - Category, priority, status
 * - Original protocol title (for logging/telemetry)
 *
 * @param protocols - Array of protocol recommendations from AI analysis
 * @returns Array of flattened frequency cards sorted by priority
 */
export function flattenProtocolsToFrequencyCards(
  protocols: ProtocolRecommendation[]
): FlattenedFrequencyCard[] {
  const flattened: FlattenedFrequencyCard[] = [];

  for (const protocol of protocols) {
    for (const frequency of protocol.recommendedFrequencies) {
      flattened.push({
        // Frequency details
        frequencyId: frequency.id,
        frequencyName: frequency.name,
        frequencyRationale: frequency.rationale,
        sourceReference: frequency.source_reference,
        diagnosticTrigger: frequency.diagnostic_trigger,

        // Context from parent protocol
        originalProtocolId: protocol.id,
        originalProtocolTitle: protocol.title,
        category: protocol.category,
        priority: protocol.priority,

        // Status (from protocol recommendation)
        status: protocol.status,

        // Local execution state (initialized as false)
        pendingExecution: false,
      });
    }
  }

  // Sort by priority (lower number = higher priority)
  return flattened.sort((a, b) => a.priority - b.priority);
}

/**
 * Groups flattened frequency cards by their original protocol ID
 * Useful for batch operations that need to update protocol status
 *
 * @param cards - Array of flattened frequency cards
 * @returns Map of protocol ID to array of frequency cards
 */
export function groupByProtocol(
  cards: FlattenedFrequencyCard[]
): Map<string, FlattenedFrequencyCard[]> {
  const grouped = new Map<string, FlattenedFrequencyCard[]>();

  for (const card of cards) {
    const existing = grouped.get(card.originalProtocolId) || [];
    existing.push(card);
    grouped.set(card.originalProtocolId, existing);
  }

  return grouped;
}

/**
 * Gets unique protocol IDs from a list of flattened frequency cards
 * Useful for batch updating protocol statuses
 *
 * @param cards - Array of flattened frequency cards
 * @returns Array of unique protocol IDs
 */
export function getUniqueProtocolIds(cards: FlattenedFrequencyCard[]): string[] {
  return [...new Set(cards.map(card => card.originalProtocolId))];
}
