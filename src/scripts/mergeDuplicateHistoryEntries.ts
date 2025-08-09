
// Script to remove duplicate history entries within each bill's timeline
import { getCollection } from "@/lib/mongodb";
import { Legislation } from "@/types/legislation";
async function removeDuplicateHistoryEntries() {
	const collection = await getCollection("legislation");
	const cursor = collection.find({ history: { $exists: true, $ne: [] } });
	let billsWithDuplicates = 0;
	let totalDuplicatesRemoved = 0;
	let totalBills = 0;

	while (await cursor.hasNext()) {
		const bill: Legislation = await cursor.next();
		totalBills++;
		const history = bill.history || [];
		const seen = new Set<string>();
		const deduped = [];
		let duplicates = 0;
		for (const entry of history) {
			// Use date+description as the deduplication key
			const key = `${entry.date || ''}|${entry.description || ''}`;
			if (seen.has(key)) {
				duplicates++;
				continue;
			}
			seen.add(key);
			deduped.push(entry);
		}
		if (duplicates > 0) {
			billsWithDuplicates++;
			totalDuplicatesRemoved += duplicates;
			await collection.updateOne({ _id: bill._id }, { $set: { history: deduped } });
			console.log(`Bill ${bill.identifier || bill.id}: removed ${duplicates} duplicate history entries.`);
		}
	}
	console.log(`\nChecked ${totalBills} bills.`);
	console.log(`${billsWithDuplicates} bills had duplicate history entries.`);
	console.log(`Total duplicate history entries removed: ${totalDuplicatesRemoved}`);
}

if (require.main === module) {
	removeDuplicateHistoryEntries()
		.then(() => process.exit(0))
		.catch(err => { console.error(err); process.exit(1); });
}
