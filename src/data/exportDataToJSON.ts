
import { getCollection } from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

/**
 * Exports documents from a MongoDB collection to a JSON file, with optional filtering.
 * @param collectionName The name of the collection to export
 * @param outputFile The output file path (absolute or relative)
 * @param filterField (Optional) Only export documents where this field is not null
 */
async function exportCollectionToJSON(collectionName: string, outputFile: string, filterField?: string) {
  const collection = await getCollection(collectionName);
  let query = {};
  if (filterField) {
    query = {
      $and: [
        { [filterField]: { $ne: null } },
        {
          $or: [
            { [filterField]: { $not: { $type: 'array' } } },
            { [filterField]: { $not: { $size: 0 } } }
          ]
        }
      ]
    };
  }
  const outputPath = path.resolve(process.cwd(), outputFile);
  const cursor = collection.find(query);
  const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf-8' });
  let count = 0;
  writeStream.write('[\n');
  for await (const doc of cursor) {
    if (count > 0) writeStream.write(',\n');
    writeStream.write(JSON.stringify(doc));
    count++;
  }
  writeStream.write('\n]\n');
  writeStream.end();
  await new Promise<void>(resolve => writeStream.on('finish', () => resolve()));
  console.log(`Exported ${count} documents from '${collectionName}' to ${outputPath}`);
}

async function main() {

  const collectionName = 'legislation';
  const outputFile = `${collectionName}2.json`;
  const filterField = 'subjects';

  try {
    await exportCollectionToJSON(collectionName, outputFile, filterField);
  } catch (err) {
    console.error('Error exporting data:', err);
    process.exit(1);
  }
}

main();
