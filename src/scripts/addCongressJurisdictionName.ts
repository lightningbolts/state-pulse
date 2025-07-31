import { getCollection } from '../lib/mongodb';

async function main() {
  const collection = await getCollection('legislation');

  // Use the provided allCongressQuery for filtering
  const allCongressQuery = {
    $or: [
      // Matches older data with explicit jurisdiction names
      {
        jurisdictionName: {
          $regex: "United States|US|USA|Federal|Congress",
          $options: "i"
        }
      },
      // Matches newer data (like 119th Congress) that lacks a jurisdictionName
      // but has a session field and other federal indicators.
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

  const result = await collection.updateMany(
    allCongressQuery,
    { $set: { jurisdictionName: "United States Congress" } }
  );
  console.log(`Updated ${result.modifiedCount} Congress bills.`);
}

main().catch(err => {
  console.error('Error updating Congress bills:', err);
  process.exit(1);
});
