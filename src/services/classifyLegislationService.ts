import { getDb } from '../lib/mongodb';
import { Legislation } from '../types/legislation';
import {BROAD_TOPIC_KEYWORDS, NARROW_TOPIC_KEYWORDS, ClassificationResult} from "../types/legislation";

/**
 * Custom classifier that uses keyword matching and weighted scoring
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

    // Score each broad topic
    const broadScores: Record<string, number> = {};
    for (const [topic, keywords] of Object.entries(BROAD_TOPIC_KEYWORDS)) {
        let score = 0;

        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = textToAnalyze.match(regex);
            if (matches) {
                // Weight keywords based on where they appear and frequency
                let keywordScore = matches.length;

                // Bonus for title matches
                if (title && title.toLowerCase().includes(keyword.toLowerCase())) {
                    keywordScore *= 2;
                }

                // Bonus for exact phrase matches
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

    // Score each narrow topic
    const narrowScores: Record<string, number> = {};
    for (const [topic, keywords] of Object.entries(NARROW_TOPIC_KEYWORDS)) {
        let score = 0;

        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = textToAnalyze.match(regex);
            if (matches) {
                let keywordScore = matches.length;

                // Bonus for title matches
                if (title && title.toLowerCase().includes(keyword.toLowerCase())) {
                    keywordScore *= 2;
                }

                // Bonus for exact phrase matches
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

    // Select top broad topics (1-3)
    const sortedBroadTopics = Object.entries(broadScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

    // Select top narrow topics (1-5)
    const sortedNarrowTopics = Object.entries(narrowScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    const selectedBroadTopics = sortedBroadTopics.map(([topic]) => topic);
    const selectedNarrowTopics = sortedNarrowTopics.map(([topic]) => topic);

    // Calculate confidence based on keyword matches and score distribution
    let confidence = 0;
    if (selectedBroadTopics.length > 0 || selectedNarrowTopics.length > 0) {
        const totalMatches = Object.values(broadScores).reduce((sum, score) => sum + score, 0) +
            Object.values(narrowScores).reduce((sum, score) => sum + score, 0);

        // Base confidence on keyword matches and text length
        confidence = Math.min(90, Math.max(20,
            (totalMatches * 10) +
            (textToAnalyze.split(' ').length > 10 ? 10 : 0) +
            (selectedBroadTopics.length > 0 ? 15 : 0) +
            (selectedNarrowTopics.length > 0 ? 10 : 0)
        ));
    }

    // Generate reasoning
    const reasoning = `Classified based on keyword matching. Found ${Object.keys(broadScores).length} broad topic matches and ${Object.keys(narrowScores).length} narrow topic matches from analyzing ${textToAnalyze.split(' ').length} words.`;

    return {
        broadTopics: selectedBroadTopics,
        narrowTopics: selectedNarrowTopics,
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

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
        console.error(`  Error processing legislation: ${error}`);
    }
}
