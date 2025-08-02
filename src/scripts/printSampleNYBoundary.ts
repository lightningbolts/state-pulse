import { getCollection } from '../lib/mongodb';

async function main() {
  const boundaries = await getCollection('map_boundaries');
  const doc = await boundaries.findOne({
    $or: [
      { 'properties.STATEFP': '36' },
      { 'properties.STATEFP': 'NY' }
    ]
  });
  console.log(JSON.stringify(doc, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
