
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });


const CONGRESS_API_KEY = process.env.US_CONGRESS_API_KEY || '';
const CONGRESS_API_BASE = 'https://api.congress.gov/v3/member';
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse';
const COLLECTION_NAME = 'representatives';


async function main() {
	if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');
	if (!CONGRESS_API_KEY) throw new Error('Missing US_CONGRESS_API_KEY');
	const client = new MongoClient(MONGODB_URI);
	await client.connect();
	const db = client.db(DB_NAME);
	const collection = db.collection(COLLECTION_NAME);

	// Find all current US House and Senate members
	const cursor = collection.find({
		jurisdiction: { $in: ['US House', 'US Senate'] }
	});
	const reps = await cursor.toArray();
	console.log(`Found ${reps.length} current US House and Senate representatives.`);

	let updatedCount = 0;
	for (const rep of reps) {
		const id = rep.id;
		if (!id) continue;
		const url = `${CONGRESS_API_BASE}/${encodeURIComponent(id)}?api_key=${CONGRESS_API_KEY}`;
		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.error(`Failed to fetch Congress details for ${id}: ${response.status}`);
				continue;
			}
			const data = await response.json();
			const details = data.member || data;
			if (!details) {
				console.warn(`No details found for ${id}`);
				continue;
			}
			// Extract and normalize specific fields from the new API response
			const updateFields: Record<string, any> = {};

			// Extract phone from addressInformation.phoneNumber
			if (details.addressInformation?.phoneNumber) {
				updateFields.phone = details.addressInformation.phoneNumber;
				console.log(`  [UPDATE] Field 'phone': '${JSON.stringify(rep.phone)}' => '${JSON.stringify(details.addressInformation.phoneNumber)}'`);
			}

			// Extract address from addressInformation.officeAddress  
			if (details.addressInformation?.officeAddress) {
				updateFields.address = details.addressInformation.officeAddress;
				console.log(`  [UPDATE] Field 'address': '${JSON.stringify(rep.address)}' => '${JSON.stringify(details.addressInformation.officeAddress)}'`);
			}

			// Extract website from officialWebsiteUrl
			if (details.officialWebsiteUrl) {
				updateFields.website = details.officialWebsiteUrl;
				console.log(`  [UPDATE] Field 'website': '${JSON.stringify(rep.website)}' => '${JSON.stringify(details.officialWebsiteUrl)}'`);
			}

			// Overwrite leadership, sponsoredLegislation, cosponsoredLegislation, terms if present
			for (const key of ['leadership', 'sponsoredLegislation', 'cosponsoredLegislation', 'terms']) {
				if (details[key] !== undefined) {
					updateFields[key] = details[key];
					console.log(`  [UPDATE] Field '${key}': '${JSON.stringify(rep[key])}' => '${JSON.stringify(details[key])}'`);
				}
			}

			// Add partyHistory and birthYear if present
			if (details.partyHistory !== undefined) {
				updateFields.partyHistory = details.partyHistory;
				console.log(`  [ADD] Field 'partyHistory': '${JSON.stringify(details.partyHistory)}'`);
			}
			if (details.birthYear !== undefined) {
				updateFields.birthYear = details.birthYear;
				console.log(`  [ADD] Field 'birthYear': '${details.birthYear}'`);
			}

			if (Object.keys(updateFields).length > 0) {
				await collection.updateOne({ _id: rep._id }, { $set: updateFields });
				updatedCount++;
				console.log(`[UPDATED] ${rep.name} (${id}) updated with Congress.gov details.`);
			} else {
				console.log(`[SKIPPED] ${rep.name} (${id}) - no changes.`);
			}
		} catch (err) {
			console.error(`Error updating ${id}:`, err);
		}
	}
	console.log(`Total representatives updated: ${updatedCount}`);
	await client.close();
}

main().catch(err => {
	console.error('Error in fetchDetailedCongressMembers:', err);
	process.exit(1);
});
