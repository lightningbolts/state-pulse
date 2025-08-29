import { connectToDatabase } from '../lib/mongodb';
import { getRelatedBills } from '../services/relatedBillsService';

async function benchmarkRelatedBills() {
  await connectToDatabase();
  const { db } = await connectToDatabase();
  
  console.log('=== Related Bills Performance Benchmark ===\n');
  
  // Get a few test bills from different jurisdictions
  const testBills = await db.collection('legislation')
    .find({ 
      subjects: { $exists: true, $ne: [] },
      geminiSummary: { $exists: true }
    })
    .limit(5)
    .toArray();
    
  console.log(`Testing with ${testBills.length} bills...\n`);
  
  let totalTime = 0;
  
  for (const bill of testBills) {
    const startTime = Date.now();
    
    const relatedBills = await getRelatedBills(bill as any, 3);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    totalTime += duration;
    
    console.log(`${bill.identifier} (${bill.jurisdictionName}): ${duration}ms`);
    console.log(`  Found ${relatedBills.length} related bills from:`, 
      relatedBills.map(rb => rb.jurisdictionName).join(', '));
    console.log('');
  }
  
  const averageTime = totalTime / testBills.length;
  console.log(`Average time: ${averageTime.toFixed(0)}ms`);
  console.log(`Total time: ${totalTime}ms`);
  
  process.exit(0);
}

benchmarkRelatedBills().catch(console.error);
