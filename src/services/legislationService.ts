import { getCollection } from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import { Legislation } from '../types/legislation';
import { LegislationMongoDbDocument } from '../types/legislation';

function cleanupDataForMongoDB<T extends Record<string, any>>(data: T): T {
  const cleanData = { ...data };
  const arrayFields = ['subjects', 'classification', 'sources', 'versions', 'abstracts', 'sponsors', 'history'];
  for (const field of arrayFields) {
    if (cleanData[field] !== undefined && !Array.isArray(cleanData[field])) {
      (cleanData as Record<string, any>)[field] = Array.isArray(cleanData[field]) ? cleanData[field] : (cleanData[field] ? [cleanData[field]] : []);
    } else if (cleanData[field] === undefined) {
      (cleanData as Record<string, any>)[field] = [];
    }
  }
  return cleanData;
}

export async function addLegislation(legislationData: Legislation): Promise<void> {
    if (!legislationData.id) {
        console.error('Legislation ID is required to add legislation.');
        throw new Error('Legislation ID is required to add legislation.');
    }
    try {
        const { id, ...dataToAdd } = legislationData;
        let cleanedData = cleanupDataForMongoDB(dataToAdd);
        cleanedData.createdAt = new Date();
        cleanedData.updatedAt = new Date();
        if (cleanedData.firstActionAt) {
          cleanedData.firstActionAt = new Date(cleanedData.firstActionAt);
        }
        if (cleanedData.latestActionAt) {
          cleanedData.latestActionAt = new Date(cleanedData.latestActionAt);
        }
        if (cleanedData.latestPassageAt) {
          cleanedData.latestPassageAt = new Date(cleanedData.latestPassageAt);
        }
        const legislationCollection = await getCollection('legislation');
        console.log(`Adding legislation ${legislationData.id} (${legislationData.identifier || 'no identifier'})`);
        await legislationCollection.insertOne({
          _id: new ObjectId(),
          id,
          ...cleanedData
        });
    } catch (error) {
        console.error(`Error adding legislation document with id ${legislationData.id}: `, error);
        throw new Error('Failed to add legislation.');
    }
}

export async function upsertLegislation(legislationData: Legislation): Promise<void> {
  if (!legislationData.id) {
    console.error('Legislation ID is required to upsert legislation.');
    throw new Error('Legislation ID is required to upsert legislation.');
  }
  try {
    const { id, ...dataToUpsert } = legislationData;
    let cleanedData = cleanupDataForMongoDB(dataToUpsert);
    const { createdAt, ...dataForSet } = cleanedData;
    dataForSet.updatedAt = new Date();
    if (dataForSet.firstActionAt) {
      dataForSet.firstActionAt = new Date(dataForSet.firstActionAt);
    }
    if (dataForSet.latestActionAt) {
      dataForSet.latestActionAt = new Date(dataForSet.latestActionAt);
    }
    if (dataForSet.latestPassageAt) {
      dataForSet.latestPassageAt = new Date(dataForSet.latestPassageAt);
    }
    const legislationCollection = await getCollection('legislation');
    console.log(`Upserting legislation ${legislationData.id} (${legislationData.identifier || 'no identifier'})`);
    await legislationCollection.updateOne(
      { id },
      {
        $set: dataForSet,
        $setOnInsert: { createdAt: createdAt || new Date(), id }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Error upserting legislation document with id ${legislationData.id}: `, error);
    throw new Error('Failed to upsert legislation.');
  }
}

export async function upsertLegislationSelective(legislationData: Legislation): Promise<void> {
  if (!legislationData.id) {
    console.error('Legislation ID is required to upsert legislation.');
    throw new Error('Legislation ID is required to upsert legislation.');
  }
  try {
    const { id, ...dataToUpsert } = legislationData;
    let cleanedData = cleanupDataForMongoDB(dataToUpsert);
    const { createdAt, ...dataForSet } = cleanedData;
    dataForSet.updatedAt = new Date();
    if (dataForSet.firstActionAt) {
      dataForSet.firstActionAt = new Date(dataForSet.firstActionAt);
    }
    if (dataForSet.latestActionAt) {
      dataForSet.latestActionAt = new Date(dataForSet.latestActionAt);
    }
    if (dataForSet.latestPassageAt) {
      dataForSet.latestPassageAt = new Date(dataForSet.latestPassageAt);
    }
    const legislationCollection = await getCollection('legislation');
    // Fetch the existing document
    const existing = await legislationCollection.findOne({ id });
    if (!existing) {
      // Insert as new if not found
      await legislationCollection.insertOne({
        _id: new ObjectId(),
        id,
        ...dataForSet,
        createdAt: createdAt || new Date(),
      });
      console.log(`Inserted new legislation ${id}`);
      return;
    }
    // Only update fields that have changed, but ignore updatedAt and createdAt in comparison
    const ignoreFields = ['updatedAt', 'createdAt'];
    const updateFields: Record<string, any> = {};
    for (const key of Object.keys(dataForSet)) {
      if (ignoreFields.includes(key)) continue;
      const newValue = dataForSet[key];
      const oldValue = existing[key];
      // Compare arrays and objects by JSON.stringify, primitives by ===
      if (Array.isArray(newValue) || typeof newValue === 'object') {
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          updateFields[key] = newValue;
        }
      } else {
        if (newValue !== oldValue) {
          updateFields[key] = newValue;
        }
      }
    }
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await legislationCollection.updateOne(
        { id },
        { $set: updateFields }
      );
      console.log(`Updated fields for legislation ${id}:`, Object.keys(updateFields));
    } else {
      // No changes
      console.log(`No changes for legislation ${id}`);
    }
  } catch (error) {
    console.error(`Error selectively upserting legislation document with id ${legislationData.id}: `, error);
    throw new Error('Failed to upsert legislation selectively.');
  }
}

function convertDocumentToLegislation(doc: LegislationMongoDbDocument): Legislation {
  const { _id, ...rest } = doc;
  return rest as Legislation;
}

export async function getLegislationByMongoId(mongoId: string): Promise<Legislation | null> {
  if (!mongoId) {
    console.error('MongoDB ID is required to fetch legislation.');
    return null;
  }
  try {
    if (!ObjectId.isValid(mongoId)) {
      console.error('Invalid MongoDB ID format.');
      return null;
    }
    const legislationCollection = await getCollection('legislation');
    const document = await legislationCollection.findOne({ _id: new ObjectId(mongoId) }) as LegislationMongoDbDocument | null;
    if (document) {
      return convertDocumentToLegislation(document);
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching legislation document with MongoDB ID ${mongoId}: `, error);
    return null;
  }
}

export async function getLegislationById(id: string): Promise<Legislation | null> {
  if (!id) {
    console.error('ID is required to fetch legislation.');
    return null;
  }
  try {
    const legislationCollection = await getCollection('legislation');
    const document = await legislationCollection.findOne({ id });
    if (document) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...restOfDoc } = document;
      return restOfDoc as Legislation;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching legislation document with id ${id}: `, error);
    return null;
  }
}

export async function getAllLegislation({
  limit = 100,
  skip = 0,
  sort = { updatedAt: -1 },
  filter = {},
  showCongress = false
}: {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
  showCongress?: boolean;
}): Promise<Legislation[]> {
  try {
    const legislationCollection = await getCollection('legislation');

    const isMostRecentSort = sort.updatedAt === -1 || sort.createdAt === -1;

    // If showCongress is true, always use the aggregation pipeline for proper sorting.
    if (showCongress) {
      console.log('[Service] Using aggregation pipeline for Congress sorting');

      const sortStage: Record<string, any> = {};
      if (isMostRecentSort) {
        sortStage['sessionNumber'] = -1;
        sortStage['mostRecentDate'] = -1;
      } else if (sort.title) {
        sortStage['title'] = sort.title;
      } else {
        // Fallback or other sort fields can be added here
        sortStage['sessionNumber'] = -1;
        sortStage['mostRecentDate'] = -1;
      }

      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            sessionNumber: {
              $let: {
                vars: {
                  sessionString: { $ifNull: ["$session", "0"] }
                },
                in: {
                  $let: {
                    vars: {
                      match: { $regexFind: { input: "$$sessionString", regex: "\\d+" } }
                    },
                    in: { $toInt: { $ifNull: ["$$match.match", "0"] } }
                  }
                }
              }
            },
            mostRecentDate: {
              $max: [
                { $ifNull: ["$firstActionAt", new Date(0)] },
                { $ifNull: ["$latestActionAt", new Date(0)] },
                { $ifNull: ["$createdAt", new Date(0)] },
                {
                  $ifNull: [ // Max from history
                    {
                      $max: {
                        $map: {
                          input: { $ifNull: ["$history", []] },
                          in: {
                            $dateFromString: {
                              dateString: "$$this.date",
                              onError: new Date(0)
                            }
                          }
                        }
                      }
                    },
                    new Date(0)
                  ]
                },
                {
                  $ifNull: [ // Max from versions
                    {
                      $max: {
                        $map: {
                          input: { $ifNull: ["$versions", []] },
                          in: {
                            $dateFromString: {
                              dateString: "$$this.date",
                              onError: new Date(0)
                            }
                          }
                        }
                      }
                    },
                    new Date(0)
                  ]
                }
              ]
            }
          }
        },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limit }
      ];

      const results = await legislationCollection.aggregate(pipeline).toArray();
      return results as Legislation[];
    }

    // Default behavior for all other queries (non-congress)
    const results = await legislationCollection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
    return results as Legislation[];
  } catch (error) {
    console.error('Error fetching all legislation from service: ', error);
    throw new Error('Failed to fetch legislation.');
  }
}

export async function testLegislationCollectionService(): Promise<void> {
  try {
    const collection = await getCollection('legislation');
    const count = await collection.countDocuments();
    console.log(`[Service] Legislation collection has ${count} documents.`);
    const oneDoc = await collection.findOne();
    if (oneDoc) {
      console.log('[Service] Sample document:', oneDoc);
    } else {
      console.log('[Service] No documents found in legislation collection.');
    }
  } catch (error) {
    console.error('[Service] Failed to connect to legislation collection:', error);
  }
}

export async function searchLegislationByTopic(topic: string, daysBack: number = 7): Promise<Legislation[]> {
  try {
    const legislationCollection = await getCollection('legislation');

    // Extract location keywords from the topic (state names, cities, etc.)
    const locationKeywords = [
      'ohio', 'california', 'texas', 'florida', 'new york', 'pennsylvania',
      'illinois', 'georgia', 'north carolina', 'michigan', 'new jersey',
      'virginia', 'washington', 'arizona', 'massachusetts', 'tennessee',
      'indiana', 'maryland', 'missouri', 'wisconsin', 'colorado',
      'minnesota', 'south carolina', 'alabama', 'louisiana', 'kentucky',
      'oregon', 'oklahoma', 'connecticut', 'utah', 'iowa', 'nevada',
      'arkansas', 'mississippi', 'kansas', 'new mexico', 'nebraska',
      'west virginia', 'idaho', 'hawaii', 'new hampshire', 'maine',
      'montana', 'rhode island', 'delaware', 'south dakota', 'north dakota',
      'alaska', 'vermont', 'wyoming'
    ];
    // Add federal keywords
    const federalKeywords = [
      'congress', 'united states congress', 'us congress', 'federal', 'national', 'house of representatives', 'senate', 'capitol hill', 'washington dc', 'dc congress'
    ];

    const topicLower = topic.toLowerCase();
    const detectedStates = locationKeywords.filter(state => topicLower.includes(state));
    const detectedFederal = federalKeywords.filter(fed => topicLower.includes(fed));

    // Create search terms from the topic (excluding location and federal words for content search)
    const searchTerms = topic.toLowerCase()
      .split(' ')
      .filter(term => term.length > 2 && !locationKeywords.includes(term) && !federalKeywords.includes(term))
      .filter(term => !['in', 'of', 'the', 'and', 'or', 'laws', 'law', 'bill', 'bills'].includes(term));

    console.log('Search debug:', { topic, detectedStates, searchTerms });

    let docs = [];

    // Try federal search first if detected
    if (detectedFederal.length > 0) {
      const regexPatterns = searchTerms.map(term => new RegExp(term, 'i'));
      const query = {
        $and: [
          { jurisdictionName: { $in: [/united states congress/i, /congress/i, /federal/i] } },
          searchTerms.length > 0 ? {
            $or: [
              { title: { $in: regexPatterns } },
              { subjects: { $in: regexPatterns } },
              { summary: { $in: regexPatterns } },
              { geminiSummary: { $in: regexPatterns } },
              { latestActionDescription: { $in: regexPatterns } }
            ]
          } : {}
        ].filter(Boolean)
      };
      docs = await legislationCollection
        .find(query)
        .sort({ latestActionAt: -1, createdAt: -1 })
        .limit(10)
        .toArray();
      console.log('Federal search results:', docs.length);
    }
    // Try specific search first (location + content)
    if (docs.length === 0 && detectedStates.length > 0 && searchTerms.length > 0) {
      const statePatterns = detectedStates.map(state => new RegExp(state, 'i'));
      const regexPatterns = searchTerms.map(term => new RegExp(term, 'i'));

      const query = {
        $and: [
          { jurisdictionName: { $in: statePatterns } },
          {
            $or: [
              { title: { $in: regexPatterns } },
              { subjects: { $in: regexPatterns } },
              { summary: { $in: regexPatterns } },
              { geminiSummary: { $in: regexPatterns } },
              { latestActionDescription: { $in: regexPatterns } }
            ]
          }
        ]
      };

      docs = await legislationCollection
        .find(query)
        .sort({ latestActionAt: -1, createdAt: -1 })
        .limit(10)
        .toArray();

      console.log('Specific search results:', docs.length);
    }

    // Fallback to location-only search if no results
    if (docs.length === 0 && detectedStates.length > 0) {
      const statePatterns = detectedStates.map(state => new RegExp(state, 'i'));
      const query = { jurisdictionName: { $in: statePatterns } };

      docs = await legislationCollection
        .find(query)
        .sort({ latestActionAt: -1, createdAt: -1 })
        .limit(10)
        .toArray();

      console.log('Location-only search results:', docs.length);
    }

    // Fallback to content-only search if no results
    if (docs.length === 0 && searchTerms.length > 0) {
      const regexPatterns = searchTerms.map(term => new RegExp(term, 'i'));
      const query = {
        $or: [
          { title: { $in: regexPatterns } },
          { subjects: { $in: regexPatterns } },
          { summary: { $in: regexPatterns } },
          { geminiSummary: { $in: regexPatterns } },
          { latestActionDescription: { $in: regexPatterns } }
        ]
      };

      docs = await legislationCollection
        .find(query)
        .sort({ latestActionAt: -1, createdAt: -1 })
        .limit(10)
        .toArray();

      console.log('Content-only search results:', docs.length);
    }

    // Final fallback - just get any recent legislation
    if (docs.length === 0) {
      docs = await legislationCollection
        .find({})
        .sort({ latestActionAt: -1, createdAt: -1 })
        .limit(10)
        .toArray();

      console.log('Fallback search results:', docs.length);
    }

    return docs.map(convertDocumentToLegislation);
  } catch (error) {
    console.error('Error searching legislation by topic:', error);
    return [];
  }
}

export async function updateLegislation(id: string, updateData: Partial<Legislation>): Promise<Legislation | null> {
  if (!id) {
    console.error('ID is required to update legislation.');
    return null;
  }
  try {
    const { id: _, ...dataToUpdate } = updateData;
    let cleanedData = cleanupDataForMongoDB(dataToUpdate);
    cleanedData.updatedAt = new Date();

    if (cleanedData.firstActionAt) {
      cleanedData.firstActionAt = new Date(cleanedData.firstActionAt);
    }
    if (cleanedData.latestActionAt) {
      cleanedData.latestActionAt = new Date(cleanedData.latestActionAt);
    }
    if (cleanedData.latestPassageAt) {
      cleanedData.latestPassageAt = new Date(cleanedData.latestPassageAt);
    }

    const legislationCollection = await getCollection('legislation');
    const result = await legislationCollection.updateOne(
      { id },
      { $set: cleanedData }
    );

    if (result.matchedCount === 0) {
      return null;
    }

    // Return the updated document
    const updatedDoc = await legislationCollection.findOne({ id });
    if (updatedDoc) {
      const { _id, ...restOfDoc } = updatedDoc;
      return restOfDoc as Legislation;
    }
    return null;
  } catch (error) {
    console.error(`Error updating legislation document with id ${id}: `, error);
    throw new Error('Failed to update legislation.');
  }
}

export async function deleteLegislation(id: string): Promise<boolean> {
  if (!id) {
    console.error('ID is required to delete legislation.');
    return false;
  }
  try {
    const legislationCollection = await getCollection('legislation');
    const result = await legislationCollection.deleteOne({ id });
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`Error deleting legislation document with id ${id}: `, error);
    throw new Error('Failed to delete legislation.');
  }
}
