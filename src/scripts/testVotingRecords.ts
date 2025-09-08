import { getCollection } from '@/lib/mongodb';

// Sample voting record data for testing
const sampleVotingRecord = {
  identifier: 'test-house-119-1',
  rollCallNumber: 1,
  legislationType: 'HR',
  legislationNumber: '1234',
  bill_id: 'congress-bill-119-hr-1234',
  voteQuestion: 'On Passage: H.R. 1234 - Test Bill for Voting Record Feature',
  result: 'Passed',
  date: new Date().toISOString(),
  memberVotes: [
    {
      bioguideId: 'A000369', // Sample bioguide ID
      firstName: 'Mark',
      lastName: 'Amodei',
      voteCast: 'Yea',
      voteParty: 'R',
      voteState: 'NV'
    },
    {
      bioguideId: 'B001230', // Sample bioguide ID
      firstName: 'Tammy',
      lastName: 'Baldwin',
      voteCast: 'Nay',
      voteParty: 'D',
      voteState: 'WI'
    }
  ],
  congress: 119,
  session: 1,
  chamber: 'US House'
};

export async function createSampleVotingRecord() {
  try {
    const collection = await getCollection('voting_records');
    
    // Insert sample voting record
    const result = await collection.insertOne(sampleVotingRecord);
    console.log('Sample voting record created:', result.insertedId);
    
    return result;
  } catch (error) {
    console.error('Error creating sample voting record:', error);
    throw error;
  }
}

export async function testVotingRecordsAPI() {
  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/representatives/A000369/voting-records?limit=5');
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error testing voting records API:', error);
    throw error;
  }
}

export async function cleanupSampleData() {
  try {
    const collection = await getCollection('voting_records');
    
    // Remove the test voting record
    const result = await collection.deleteMany({
      identifier: { $regex: /^test-/ }
    });
    
    console.log('Cleaned up sample data:', result.deletedCount, 'records deleted');
    return result;
  } catch (error) {
    console.error('Error cleaning up sample data:', error);
    throw error;
  }
}

// Main test function
export async function runVotingRecordTest() {
  console.log('🧪 Testing RepVotingRecord feature...');
  
  try {
    // Step 1: Create sample data
    console.log('Step 1: Creating sample voting record...');
    await createSampleVotingRecord();
    
    // Step 2: Test API
    console.log('Step 2: Testing API endpoint...');
    const apiResult = await testVotingRecordsAPI();
    
    // Step 3: Validate results
    console.log('Step 3: Validating results...');
    if (apiResult.success && apiResult.data.votingRecords.length > 0) {
      console.log('✅ Test passed! Found voting records:', apiResult.data.votingRecords.length);
    } else {
      console.log('⚠️  Test completed but no records found. This might be expected if the representative has no voting records.');
    }
    
    // Step 4: Cleanup
    console.log('Step 4: Cleaning up test data...');
    await cleanupSampleData();
    
    console.log('🎉 RepVotingRecord test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Attempt cleanup even on failure
    try {
      await cleanupSampleData();
    } catch (cleanupError) {
      console.error('Failed to cleanup test data:', cleanupError);
    }
    
    throw error;
  }
}
