import { getCollection } from '../lib/mongodb';

async function main() {
  const collection = await getCollection('legislation');

  // The original Congress query
  const allCongressQuery = {
    $or: [
      {
        jurisdictionName: {
          $regex: "United States|US|USA|Federal|Congress",
          $options: "i"
        }
      },
      {
        $and: [
          {
            $or: [
              { jurisdictionName: { $exists: false } },
              { jurisdictionName: null },
              { jurisdictionName: "" }
            ]
          },
          { session: { $regex: "Congress", $options: "i" } }
        ]
      }
    ]
  };

  // Find all bills with jurisdictionName === 'United States Congress' that do NOT match the original query
  const incorrectCongressQuery = {
    jurisdictionName: "United States Congress",
    $nor: [allCongressQuery]
  };

  const result = await collection.updateMany(
    incorrectCongressQuery,
    { $unset: { jurisdictionName: "" } }
  );
  console.log(`Unset jurisdictionName for ${result.modifiedCount} incorrectly updated bills.`);
}

main().catch(err => {
  console.error('Error fixing incorrect Congress jurisdictionName:', err);
  process.exit(1);
});
