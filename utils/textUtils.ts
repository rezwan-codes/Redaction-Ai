
import { DetectedEntity, RedactionMode, DiffChunk, EntityType } from '../types';

/**
 * Calculates Levenshtein distance between two strings
 */
export const calculateLevenshteinDistance = (s1: string, s2: string): number => {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) {
     track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
     track[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
     for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
           track[j][i - 1] + 1, // deletion
           track[j - 1][i] + 1, // insertion
           track[j - 1][i - 1] + indicator, // substitution
        );
     }
  }
  return track[s2.length][s1.length];
};

/**
 * Calculates similarity percentage based on Levenshtein distance
 */
export const calculateSimilarity = (original: string, redacted: string, distance: number): number => {
  const maxLength = Math.max(original.length, redacted.length);
  if (maxLength === 0) return 100;
  return Math.max(0, ((maxLength - distance) / maxLength) * 100);
};

/**
 * Applies redaction to the text based on detected entities
 */
export const applyRedaction = (
  text: string,
  entities: DetectedEntity[],
  mode: RedactionMode
): { redactedText: string; entitiesWithIndices: DetectedEntity[] } => {
  let currentText = text;
  let processedEntities: DetectedEntity[] = [];

  // Sort by length (descending) to avoid partial replacement issues
  const sortedEntities = [...entities].sort((a, b) => b.text.length - a.text.length);
  
  // We perform a simplified greedy replacement for the hackathon context.
  // In a real production system, we would map exact indices from the source to destination.
  
  sortedEntities.forEach(entity => {
    let searchIndex = 0;
    let foundIndex = -1;
    
    // Find all instances of this text
    while ((foundIndex = text.indexOf(entity.text, searchIndex)) !== -1) {
        // Check collision with already processed ranges (simplified)
        // We only add to the "Found" list if it looks like a valid new occurrence.
        // NOTE: This logic is for UI visualization purposes mostly.
        const isOverlap = processedEntities.some(e => 
            e.startIndex !== undefined && e.endIndex !== undefined &&
            foundIndex < e.endIndex && (foundIndex + entity.text.length) > e.startIndex
        );

        if (!isOverlap) {
            processedEntities.push({
                ...entity,
                startIndex: foundIndex,
                endIndex: foundIndex + entity.text.length
            });
        }
        searchIndex = foundIndex + 1; 
    }

    const replacement = mode === 'MASK' ? `[${entity.type}]` : '';
    // Escape special regex chars for the replacement
    const escapedText = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, 'g');
    currentText = currentText.replace(regex, replacement);
  });

  // Cleanup: Collapse multiple consecutive spaces into a single space and trim
  currentText = currentText.replace(/ +/g, ' ').trim();

  processedEntities.sort((a, b) => (a.startIndex || 0) - (b.startIndex || 0));

  return { redactedText: currentText, entitiesWithIndices: processedEntities };
};

/**
 * Computes a difference between actual and expected text using a simple LCS approach on words.
 * Returns chunks for visualization.
 */
export const computeWordDiff = (actual: string, expected: string): { actualChunks: DiffChunk[], expectedChunks: DiffChunk[] } => {
  const tokenizer = /([^\S\r\n]+|[.,!?;:]|\b)/; 
  const actualTokens = actual.split(tokenizer).filter(s => s !== '');
  const expectedTokens = expected.split(tokenizer).filter(s => s !== '');

  const m = actualTokens.length;
  const n = expectedTokens.length;
  const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (actualTokens[i - 1] === expectedTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const tempActual: DiffChunk[] = [];
  const tempExpected: DiffChunk[] = [];
  
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && actualTokens[i - 1] === expectedTokens[j - 1]) {
      tempActual.push({ value: actualTokens[i - 1], type: 'match' });
      tempExpected.push({ value: expectedTokens[j - 1], type: 'match' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempExpected.push({ value: expectedTokens[j - 1], type: 'mismatch-expected' });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      tempActual.push({ value: actualTokens[i - 1], type: 'mismatch-actual' });
      i--;
    }
  }

  return {
    actualChunks: tempActual.reverse(),
    expectedChunks: tempExpected.reverse()
  };
};

/**
 * Regex-based detection for standard entity types.
 * This acts as a fallback/hybrid layer to catch things AI might miss or to verify AI output.
 */
export const detectRegexEntities = (text: string): DetectedEntity[] => {
  const entities: DetectedEntity[] = [];

  // Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    entities.push({ text: match[0], type: EntityType.EMAIL_ADDRESS });
  }

  // IP Address (IPv4)
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  while ((match = ipRegex.exec(text)) !== null) {
    entities.push({ text: match[0], type: EntityType.IP_ADDRESS });
  }

  // URL (Reasonable web URL regex)
  const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  while ((match = urlRegex.exec(text)) !== null) {
     entities.push({ text: match[0], type: EntityType.URL });
  }

  // Credit Card (Simple: 4 groups of 4 digits, or continuous 16)
  const ccRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
  while ((match = ccRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: EntityType.CREDIT_CARD });
  }

  // Phone (North America format mostly, basic global support)
  // Catch formats like (123) 456-7890, 123-456-7890, +1 123 456 7890
  const phoneRegex = /(?:\+?\d{1,3}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}/g;
  while ((match = phoneRegex.exec(text)) !== null) {
      // Basic filter to avoid matching simple years or large numbers
      if (match[0].length >= 10) {
        entities.push({ text: match[0], type: EntityType.PHONE_NUMBER });
      }
  }

  // Date (Simple: DD/MM/YYYY, MM-DD-YYYY, YYYY-MM-DD, D/M/YY)
  // Matches 03/01/2024, 2024-01-03, 12-12-24
  const dateRegex = /\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/g;
  while ((match = dateRegex.exec(text)) !== null) {
      // Basic check to ensure it's not part of a phone number (often phones are 10+ digits)
      if (match[0].length <= 10) {
        entities.push({ text: match[0], type: EntityType.DATE_TIME });
      }
  }

  // Time (HH:MM, HH:MM:SS, with optional AM/PM)
  // Matches 14:30, 06:12 PM, 9:00am
  const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?\b/g;
  while ((match = timeRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: EntityType.DATE_TIME });
  }

  return entities;
};

/**
 * Merges AI detected entities with Regex entities.
 * Regex entities are added only if they don't overlap with existing AI entities.
 */
export const mergeEntities = (aiEntities: DetectedEntity[], regexEntities: DetectedEntity[]): DetectedEntity[] => {
  const merged = [...aiEntities];
  const aiTexts = new Set(aiEntities.map(e => e.text));

  regexEntities.forEach(re => {
    // Basic deduplication: if exact text isn't in AI results, add it.
    // In a more complex system, we'd check index overlaps.
    if (!aiTexts.has(re.text)) {
      merged.push(re);
    }
  });
  return merged;
};
