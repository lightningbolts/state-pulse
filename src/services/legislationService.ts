import { getCollection } from '@/lib/mongodb';
import { Collection } from 'mongodb'; // Import Collection for explicit typing

// Application-facing type
export interface Legislation {
  id: string; // This is the OpenStates ID, used to generate _id for MongoDB
  identifier?: string;
  title?: string;
  session?: string;
  jurisdictionId?: string;
  jurisdictionName?: string;
  chamber?: string | null;
  classification?: string[];
  subjects?: string[];
  statusText?: string | null;
  sponsors?: any[];
  history?: any[];
  versions?: any[];
  sources?: any[];
  abstracts?: any[];
  openstatesUrl?: string;
  firstActionAt?: Date | null;
  latestActionAt?: Date | null;
  latestActionDescription?: string | null;
  latestPassageAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  summary?: string | null;
  extras?: Record<string, any> | null;
}

// MongoDB document type
interface LegislationMongoDbDocument extends Omit<Legislation, 'id' | 'createdAt' | 'updatedAt'> {
  _id: string; // Primary key in MongoDB, derived from Legislation.id
  createdAt?: Date; // Optional here because $set might not always include it
  updatedAt?: Date; // Optional here because $set might not always include it
}


/**
 * Cleans data by ensuring specific fields are arrays if they exist.
 * Note: JSON.parse(JSON.stringify(data)) will convert Date objects to ISO strings.
 * This function should be used carefully if Date objects need to be preserved.
 */
function cleanupDataForMongoDB<T extends Record<string, any>>(data: T): T {
  // Create a shallow copy to avoid modifying the original object directly if it's not spread.
  const cleanData = { ...data };

  const arrayFields = ['subjects', 'classification', 'sources', 'versions', 'abstracts', 'sponsors', 'history'];
  for (const field of arrayFields) {
    if (cleanData[field] !== undefined && !Array.isArray(cleanData[field])) {
      // If it exists and is not an array, wrap it in an array or set to empty array
      // This part depends on desired behavior for non-array existing values.
      // For now, let's assume if it's provided, it should be an array.
      // If it's problematic, it might be better to ensure it's an array upstream.
      console.warn(`Field ${field} was not an array, converting. Value:`, cleanData[field]);
      cleanData[field] = Array.isArray(cleanData[field]) ? cleanData[field] : (cleanData[field] ? [cleanData[field]] : []);
    } else if (cleanData[field] === undefined) {
      cleanData[field] = []; // Ensure array fields exist
    }
  }
  // Date conversion from string to Date should happen before this stage if data comes from JSON.parse
  // If Date objects are passed in, they should remain Date objects for MongoDB driver.
  return cleanData;
}

/**
 * Upserts (updates or inserts) legislation data into MongoDB.
 */
export async function upsertLegislation(legislationData: Legislation): Promise<void> {
  if (!legislationData.id) {
    console.error('Legislation ID is required to upsert legislation.');
    throw new Error('Legislation ID is required to upsert legislation.');
  }

  try {
    const docId = legislationData.id.trim().replace(/\\//g, '_');
    const { id, ...dataToUpsert } = legislationData;

    // Apply cleanup to the data part
    let cleanedData = cleanupDataForMongoDB(dataToUpsert);

    cleanedData.updatedAt = new Date();
    if (cleanedData.createdAt && !(cleanedData.createdAt instanceof Date)) {
      cleanedData.createdAt = new Date(cleanedData.createdAt);
    }
    if (cleanedData.firstActionAt && !(cleanedData.firstActionAt instanceof Date)) {
      cleanedData.firstActionAt = new Date(cleanedData.firstActionAt);
    }
    if (cleanedData.latestActionAt && !(cleanedData.latestActionAt instanceof Date)) {
      cleanedData.latestActionAt = new Date(cleanedData.latestActionAt);
    }
    if (cleanedData.latestPassageAt && !(cleanedData.latestPassageAt instanceof Date)) {
      cleanedData.latestPassageAt = new Date(cleanedData.latestPassageAt);
    }


    const legislationCollection = await getCollection<LegislationMongoDbDocument>('legislation');

    console.log(`Upserting legislation ${legislationData.id} (${legislationData.identifier || 'no identifier'})`);

    await legislationCollection.updateOne(
      { _id: docId },
      {
        $set: cleanedData,
        $setOnInsert: { createdAt: cleanedData.createdAt || new Date() } // Set createdAt only on insert
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`Error upserting legislation document with id ${legislationData.id}: `, error);
    // console.error('Error details:', error); // Already part of the error object
    throw new Error('Failed to upsert legislation.');
  }
}

/**
 * Fetches a single legislation document from MongoDB by its ID.
 */
export async function getLegislationById(id: string): Promise<Legislation | null> {
  if (!id) {
    console.error('ID is required to fetch legislation.');
    return null;
  }

  try {
    const docId = id.replace(/\\//g, '_'); // Consistent ID formatting
    const legislationCollection = await getCollection<LegislationMongoDbDocument>('legislation');
    const document = await legislationCollection.findOne({ _id: docId });

    if (document) {
      const { _id, ...restOfDoc } = document;
      const appLegislation: Legislation = {
        id: _id, // _id (string) from DB maps to id (string) in app
        ...restOfDoc,
      };
      return appLegislation;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching legislation document with id ${id}: `, error);
    return null;
  }
}

/**
 * Add a new legislation document to MongoDB
 */
export async function addLegislation(legislationData: Legislation): Promise<Legislation> {
  if (!legislationData.id) {
    throw new Error("Legislation ID is required for addLegislation.");
  }

  const mongoDbId = legislationData.id.trim().replace(/\\//g, '_');
  const { id, ...appData } = legislationData; // appData is Omit<Legislation, 'id'>

  // Apply cleanup to the core data
  const cleanedData = cleanupDataForMongoDB(appData);

  const docToInsert: LegislationMongoDbDocument = {
    _id: mongoDbId,
    ...cleanedData,
    createdAt: cleanedData.createdAt ? new Date(cleanedData.createdAt) : new Date(),
    updatedAt: cleanedData.updatedAt ? new Date(cleanedData.updatedAt) : new Date(),
  };

  // Ensure 'id' field (application id) is not part of the MongoDB document
  if ('id' in (docToInsert as any)) {
    delete (docToInsert as any).id;
  }
  if (docToInsert.firstActionAt && !(docToInsert.firstActionAt instanceof Date)) {
    docToInsert.firstActionAt = new Date(docToInsert.firstActionAt);
  }
  if (docToInsert.latestActionAt && !(docToInsert.latestActionAt instanceof Date)) {
    docToInsert.latestActionAt = new Date(docToInsert.latestActionAt);
  }
  if (docToInsert.latestPassageAt && !(docToInsert.latestPassageAt instanceof Date)) {
    docToInsert.latestPassageAt = new Date(docToInsert.latestPassageAt);
  }


  const legislationCollection = await getCollection<LegislationMongoDbDocument>('legislation');
  try {
    await legislationCollection.insertOne(docToInsert);
    // Construct the returned Legislation object
    const { _id: insertedMongoId, ...insertedRest } = docToInsert;
    return { id: insertedMongoId, ...insertedRest };
  } catch (error) {
     console.error(`Error adding new legislation document with id ${legislationData.id}: `, error);
     throw new Error('Failed to add legislation.');
  }
}

/**
 * Get all legislation documents with optional filtering
 */
export async function getAllLegislation(options: {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Partial<LegislationMongoDbDocument>; // Filter by MongoDB document properties
} = {}): Promise<Legislation[]> {
  try {
    const { limit = 100, skip = 0, sort = { updatedAt: -1 }, filter = {} } = options;

    const legislationCollection = await getCollection<LegislationMongoDbDocument>('legislation');

    const cursor = legislationCollection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const documents = await cursor.toArray();

    return documents.map(doc => {
      const { _id, ...restOfDoc } = doc;
      const appLegislation: Legislation = {
        id: _id,
        ...restOfDoc,
      };
      return appLegislation;
    });
  } catch (error) {
    console.error(`Error fetching legislation documents: `, error);
    throw new Error('Failed to fetch legislation documents.');
  }
}
