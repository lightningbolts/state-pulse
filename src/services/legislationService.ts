import { getCollection } from '../lib/mongodb';
    import { Collection, ObjectId } from 'mongodb';

    export interface Legislation {
      id: string;
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

    interface LegislationMongoDbDocument extends Omit<Legislation, 'id' | 'createdAt' | 'updatedAt'> {
      _id: ObjectId;
      id: string;
      createdAt?: Date;
      updatedAt?: Date;
    }

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
        // Only update fields that have changed
        const updateFields: Record<string, any> = {};
        for (const key of Object.keys(dataForSet)) {
          if (key === 'updatedAt') continue;
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
          // Optionally update updatedAt if you want to track polling
          // await legislationCollection.updateOne({ id }, { $set: { updatedAt: new Date() } });
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

    export async function getAllLegislation(options: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      filter?: Record<string, any>;
    } = {}): Promise<Legislation[]> {
      try {
        const { limit = 100, skip = 0, sort = { updatedAt: -1 }, filter = {} } = options;
        const legislationCollection = await getCollection('legislation');
        const cursor = legislationCollection
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit);
        const documents = (await cursor.toArray()) as LegislationMongoDbDocument[];
        return documents.map((doc) => {
          const { _id, ...restOfDoc } = doc;
          return { ...restOfDoc };
        });
      } catch (error) {
        console.error(`Error fetching legislation documents: `, error);
        throw new Error('Failed to fetch legislation documents.');
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
