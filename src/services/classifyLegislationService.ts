import { getDb } from '@/lib/mongodb';
import {BROAD_TOPIC_KEYWORDS, NARROW_TOPIC_KEYWORDS, ClassificationResult} from "@/types/legislation";

// Pre-compile regex patterns for better performance
const COMPILED_BROAD_PATTERNS: Record<string, RegExp[]> = {};
const COMPILED_NARROW_PATTERNS: Record<string, RegExp[]> = {};

// Initialize compiled patterns once
for (const [topic, keywords] of Object.entries(BROAD_TOPIC_KEYWORDS)) {
  COMPILED_BROAD_PATTERNS[topic] = keywords.map(keyword =>
    new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  );
}

for (const [topic, keywords] of Object.entries(NARROW_TOPIC_KEYWORDS)) {
  COMPILED_NARROW_PATTERNS[topic] = keywords.map(keyword =>
    new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  );
}

/**
 * OPTIMIZED classifier that uses pre-compiled regex and efficient scoring
 */
export function classifyLegislationTopics(
    title: string,
    summary?: string | null,
    abstract?: string | null
): ClassificationResult {
    const textToAnalyze = [title, summary, abstract]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (!textToAnalyze.trim()) {
        return {
            broadTopics: [],
            narrowTopics: [],
            confidence: 0,
            reasoning: 'No text available for classification'
        };
    }

    const titleLower = title?.toLowerCase() || '';
    const textLength = textToAnalyze.split(' ').length;

    // Score each broad topic with optimized regex matching
    const broadScores: Record<string, number> = {};
    for (const [topic, patterns] of Object.entries(COMPILED_BROAD_PATTERNS)) {
        let score = 0;

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const keyword = BROAD_TOPIC_KEYWORDS[topic][i];

            // Reset regex lastIndex for global patterns
            pattern.lastIndex = 0;
            const matches = textToAnalyze.match(pattern);

            if (matches) {
                let keywordScore = matches.length;

                // Optimized bonus calculations
                if (titleLower.includes(keyword.toLowerCase())) {
                    keywordScore *= 2;
                }

                if (keyword.includes(' ') && textToAnalyze.includes(keyword.toLowerCase())) {
                    keywordScore *= 1.5;
                }

                score += keywordScore;
            }
        }

        if (score > 0) {
            broadScores[topic] = score;
        }
    }

    // Score each narrow topic with optimized regex matching
    const narrowScores: Record<string, number> = {};
    for (const [topic, patterns] of Object.entries(COMPILED_NARROW_PATTERNS)) {
        let score = 0;

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const keyword = NARROW_TOPIC_KEYWORDS[topic][i];

            // Reset regex lastIndex for global patterns
            pattern.lastIndex = 0;
            const matches = textToAnalyze.match(pattern);

            if (matches) {
                let keywordScore = matches.length;

                // Optimized bonus calculations
                if (titleLower.includes(keyword.toLowerCase())) {
                    keywordScore *= 2;
                }

                if (keyword.includes(' ') && textToAnalyze.includes(keyword.toLowerCase())) {
                    keywordScore *= 1.5;
                }

                score += keywordScore;
            }
        }

        if (score > 0) {
            narrowScores[topic] = score;
        }
    }

    // Optimized sorting using single pass
    const sortedBroadTopics = Object.entries(broadScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([topic]) => topic);

    const sortedNarrowTopics = Object.entries(narrowScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic);

    // Optimized confidence calculation
    let confidence = 0;
    if (sortedBroadTopics.length > 0 || sortedNarrowTopics.length > 0) {
        const broadSum = Object.values(broadScores).reduce((sum, score) => sum + score, 0);
        const narrowSum = Object.values(narrowScores).reduce((sum, score) => sum + score, 0);
        const totalMatches = broadSum + narrowSum;

        confidence = Math.min(90, Math.max(20,
            (totalMatches * 10) +
            (textLength > 10 ? 10 : 0) +
            (sortedBroadTopics.length > 0 ? 15 : 0) +
            (sortedNarrowTopics.length > 0 ? 10 : 0)
        ));
    }

    // Simplified reasoning generation
    const broadMatches = Object.keys(broadScores).length;
    const narrowMatches = Object.keys(narrowScores).length;
    const reasoning = `Keyword matching: ${broadMatches} broad, ${narrowMatches} narrow topics from ${textLength} words.`;

    return {
        broadTopics: sortedBroadTopics,
        narrowTopics: sortedNarrowTopics,
        confidence: Math.round(confidence),
        reasoning
    };
}

/**
 * Lightweight classification for integration into fetch process
 * Returns the classification data but doesn't save to database
 */
export function classifyLegislationForFetch(legislation: any): any {
    // Extract text for classification
    const title = legislation.title || '';
    const summary = legislation.geminiSummary || legislation.summary;
    const abstract = legislation.abstracts && legislation.abstracts.length > 0
        ? legislation.abstracts[0].abstract || legislation.abstracts[0].note
        : undefined;

    if (!title && !summary && !abstract) {
        return null;
    }

    const classification = classifyLegislationTopics(title, summary, abstract);

    if (classification.broadTopics.length === 0 && classification.narrowTopics.length === 0) {
        return null;
    }

    // Combine broad and narrow topics for the subjects field
    const allTopics = [...classification.broadTopics, ...classification.narrowTopics];

    return {
        subjects: allTopics,
        topicClassification: {
            broadTopics: classification.broadTopics,
            narrowTopics: classification.narrowTopics,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            classifiedAt: new Date()
        }
    };
}

/**
 * Process a single legislation document
 */
export async function processLegislation(legislation: any): Promise<void> {
    console.log(`Processing: ${legislation.identifier || legislation.id} - ${legislation.title?.substring(0, 100)}...`);

    // Extract text for classification
    const title = legislation.title || '';
    const summary = legislation.geminiSummary || legislation.summary;
    const abstract = legislation.abstracts && legislation.abstracts.length > 0
        ? legislation.abstracts[0].abstract || legislation.abstracts[0].note
        : undefined;

    if (!title && !summary && !abstract) {
        console.log('  No text available for classification, skipping...');
        return;
    }

    try {
        const classification = classifyLegislationTopics(title, summary, abstract);

        if (classification.broadTopics.length === 0 && classification.narrowTopics.length === 0) {
            console.log('  No topics classified, skipping database update...');
            return;
        }

        // Combine broad and narrow topics for the subjects field
        const allTopics = [...classification.broadTopics, ...classification.narrowTopics];

        // Update the legislation document
        const db = await getDb();
        const result = await db.collection('legislation').updateOne(
            { id: legislation.id },
            {
                $set: {
                    subjects: allTopics,
                    topicClassification: {
                        broadTopics: classification.broadTopics,
                        narrowTopics: classification.narrowTopics,
                        confidence: classification.confidence,
                        reasoning: classification.reasoning,
                        classifiedAt: new Date()
                    }
                }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`  Classified into ${classification.broadTopics.length} broad + ${classification.narrowTopics.length} narrow topics (confidence: ${classification.confidence}%)`);
            console.log(`    Broad: ${classification.broadTopics.join(', ')}`);
            console.log(`    Narrow: ${classification.narrowTopics.join(', ')}`);
        } else {
            console.log('  Database update failed');
        }

        // No delay needed here as we're now using concurrency control in the main script

    } catch (error) {
        console.error(`  Error processing legislation: ${error}`);
    }
}
