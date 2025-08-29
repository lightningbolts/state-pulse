import { connectToDatabase } from '../lib/mongodb';
import { getRelatedBills } from '../services/relatedBillsService';

async function performanceTest() {
  await connectToDatabase();
  const { db } = await connectToDatabase();
  
  console.log('=== Related Bills Performance Test (Optimized) ===\n');
  
  const testBill = await db.collection('legislation')
    .findOne({ 
      jurisdictionName: 'Alabama',
      subjects: { $exists: true, $ne: [] },
      geminiSummary: { $exists: true }
    });
    
  if (!testBill) {
    console.log('No test bill found');
    return;
  }
  
  console.log(`Testing with: ${testBill.identifier} (${testBill.jurisdictionName})`);
  console.log(`Title: ${testBill.title.substring(0, 60)}...`);
  console.log('');
  
  // Test multiple calls to check cache performance
  const times: number[] = [];
  
  for (let i = 0; i < 5; i++) {
    const startTime = Date.now();
    const relatedBills = await getRelatedBills(testBill as any, 3);
    const endTime = Date.now();
    const duration = endTime - startTime;
    times.push(duration);
    
    console.log(`Call ${i + 1}: ${duration}ms - Found ${relatedBills.length} bills from: ${relatedBills.map(rb => rb.jurisdictionName).join(', ')}`);
  }
  
  console.log('');
  console.log(`First call (no cache): ${times[0]}ms`);
  console.log(`Subsequent calls (cached): ${times.slice(1).map(t => t + 'ms').join(', ')}`);
  console.log(`Average time: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}ms`);
  console.log(`Cache hit improvement: ${((times[0] - times[1]) / times[0] * 100).toFixed(1)}%`);
  
  process.exit(0);
}

performanceTest().catch(console.error);
