import { getCollection } from '../lib/mongodb';
    import { Collection } from 'mongodb';

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
      _id: string;
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
            const docId = legislationData.id.trim().replace(/\//g, '_');
            const { id, ...dataToAdd } = legislationData;

            let cleanedData = cleanupDataForMongoDB(dataToAdd);

            cleanedData.createdAt = new Date();
            cleanedData.updatedAt = new Date();
            if (cleanedData.firstActionAt && !(cleanedData.firstActionAt instanceof Date)) {
            cleanedData.firstActionAt = new Date(cleanedData.firstActionAt);
            }
            if (cleanedData.latestActionAt && !(cleanedData.latestActionAt instanceof Date)) {
            cleanedData.latestActionAt = new Date(cleanedData.latestActionAt);
            }
            if (cleanedData.latestPassageAt && !(cleanedData.latestPassageAt instanceof Date)) {
            cleanedData.latestPassageAt = new Date(cleanedData.latestPassageAt);
            }

            const legislationCollection = await getCollection('legislation');

            console.log(`Adding legislation ${legislationData.id} (${legislationData.identifier || 'no identifier'})`);

            await legislationCollection.insertOne({
            _id: docId,
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
        const docId = legislationData.id.trim().replace(/\//g, '_');
        const { id, ...dataToUpsert } = legislationData;

        let cleanedData = cleanupDataForMongoDB(dataToUpsert);

        // Remove createdAt from cleanedData for $set
        const { createdAt, ...dataForSet } = cleanedData;
        dataForSet.updatedAt = new Date();
        if (dataForSet.firstActionAt && !(dataForSet.firstActionAt instanceof Date)) {
          dataForSet.firstActionAt = new Date(dataForSet.firstActionAt);
        }
        if (dataForSet.latestActionAt && !(dataForSet.latestActionAt instanceof Date)) {
          dataForSet.latestActionAt = new Date(dataForSet.latestActionAt);
        }
        if (dataForSet.latestPassageAt && !(dataForSet.latestPassageAt instanceof Date)) {
          dataForSet.latestPassageAt = new Date(dataForSet.latestPassageAt);
        }

        const legislationCollection = await getCollection('legislation');

        console.log(`Upserting legislation ${legislationData.id} (${legislationData.identifier || 'no identifier'})`);

        await legislationCollection.updateOne(
          { _id: docId },
          {
            $set: dataForSet,
            $setOnInsert: { createdAt: createdAt || new Date() }
          },
          { upsert: true }
        );
      } catch (error) {
        console.error(`Error upserting legislation document with id ${legislationData.id}: `, error);
        throw new Error('Failed to upsert legislation.');
      }
    }

    export async function getLegislationById(id: string): Promise<Legislation | null> {
      if (!id) {
        console.error('ID is required to fetch legislation.');
        return null;
      }

      try {
        const docId = id.replace(/\//g, '_');
        const legislationCollection = await getCollection('legislation');
        const document = await legislationCollection.findOne({ _id: docId });

        if (document) {
          const { _id, ...restOfDoc } = document;
          const appLegislation: Legislation = {
            id: _id,
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

    export async function getAllLegislation(options: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      filter?: Partial<LegislationMongoDbDocument>;
    } = {}): Promise<Legislation[]> {
      try {
        const { limit = 100, skip = 0, sort = { updatedAt: -1 }, filter = {} } = options;

        const legislationCollection = await getCollection('legislation');

        const cursor = legislationCollection
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit);

        const documents = await cursor.toArray();

        // @ts-ignore
        return documents.map((doc: LegislationMongoDbDocument) => {
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
