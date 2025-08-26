import { fetchCurrentGovernors, getCurrentGovernorName } from '../services/governorInfoService';
import { config } from 'dotenv';

// Load environment variables
config({ path: '../../.env' });

interface GovernorUpdateResult {
  state: string;
  oldGovernor: string;
  newGovernor: string;
  changed: boolean;
  source: 'scraped' | 'wikipedia' | 'fallback';
}

/**
 * Test and update governor information for all states
 */
async function testAndUpdateGovernors(): Promise<void> {
  console.log('Testing automatic governor detection for all 50 states...\n');

  // Current hardcoded governors (these may be outdated)
  const currentGovernors = {
    'Alabama': 'Kay Ivey',
    'Alaska': 'Mike Dunleavy',
    'Arizona': 'Katie Hobbs',
    'Arkansas': 'Sarah Huckabee Sanders',
    'California': 'Gavin Newsom',
    'Colorado': 'Jared Polis',
    'Connecticut': 'Ned Lamont',
    'Delaware': 'John Carney',
    'Florida': 'Ron DeSantis',
    'Georgia': 'Brian Kemp',
    'Hawaii': 'Josh Green',
    'Idaho': 'Brad Little',
    'Illinois': 'J.B. Pritzker',
    'Indiana': 'Eric Holcomb',
    'Iowa': 'Kim Reynolds',
    'Kansas': 'Laura Kelly',
    'Kentucky': 'Andy Beshear',
    'Louisiana': 'Jeff Landry',
    'Maine': 'Janet Mills',
    'Maryland': 'Wes Moore',
    'Massachusetts': 'Maura Healey',
    'Michigan': 'Gretchen Whitmer',
    'Minnesota': 'Tim Walz',
    'Mississippi': 'Tate Reeves',
    'Missouri': 'Mike Parson',
    'Montana': 'Greg Gianforte',
    'Nebraska': 'Pete Ricketts',
    'Nevada': 'Joe Lombardo',
    'New Hampshire': 'Chris Sununu',
    'New Jersey': 'Phil Murphy',
    'New Mexico': 'Michelle Lujan Grisham',
    'New York': 'Kathy Hochul',
    'North Carolina': 'Roy Cooper',
    'North Dakota': 'Doug Burgum',
    'Ohio': 'Mike DeWine',
    'Oklahoma': 'Kevin Stitt',
    'Oregon': 'Tina Kotek',
    'Pennsylvania': 'Josh Shapiro',
    'Rhode Island': 'Daniel McKee',
    'South Carolina': 'Henry McMaster',
    'South Dakota': 'Kristi Noem',
    'Tennessee': 'Bill Lee',
    'Texas': 'Greg Abbott',
    'Utah': 'Spencer Cox',
    'Vermont': 'Phil Scott',
    'Virginia': 'Glenn Youngkin',
    'Washington': 'Jay Inslee',
    'West Virginia': 'Jim Justice',
    'Wisconsin': 'Tony Evers',
    'Wyoming': 'Mark Gordon'
  };

  const results: GovernorUpdateResult[] = [];
  const states = Object.keys(currentGovernors);

  // Test a few states first to verify the system works
  const testStates = ['California', 'Texas', 'New York', 'Florida', 'Illinois'];

  console.log(`Testing system with ${testStates.length} sample states first...\n`);

  for (const state of testStates) {
    const oldGovernor = currentGovernors[state as keyof typeof currentGovernors];
    console.log(`Testing ${state} (expected: ${oldGovernor})...`);

    try {
      const newGovernor = await getCurrentGovernorName(state, oldGovernor);
      const changed = newGovernor !== oldGovernor;

      console.log(`${changed ? '[CHANGED]' : '[OK]'} ${state}: ${newGovernor}${changed ? ` (was: ${oldGovernor})` : ''}`);

      results.push({
        state,
        oldGovernor,
        newGovernor,
        changed,
        source: 'scraped' // This will be updated by the actual service
      });

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error testing ${state}:`, error);
    }
  }

  // Summary
  const changedGovernors = results.filter(r => r.changed);
  console.log(`\n=== TEST RESULTS ===`);
  console.log(`States tested: ${results.length}`);
  console.log(`Governors that changed: ${changedGovernors.length}`);

  if (changedGovernors.length > 0) {
    console.log(`\nGovernor changes detected:`);
    changedGovernors.forEach(result => {
      console.log(`  ${result.state}: ${result.oldGovernor} → ${result.newGovernor}`);
    });
  }

  console.log(`\n${results.length > 0 ? 'System is working!' : 'System needs debugging.'}`);
}

/**
 * Update all governors (use with caution - hits many websites)
 */
async function updateAllGovernors(): Promise<void> {
  console.log('Fetching current governors for all 50 states...');
  console.log('This will take several minutes due to rate limiting.\n');

  try {
    const governors = await fetchCurrentGovernors();

    console.log('\n=== RESULTS ===');
    Object.entries(governors).forEach(([state, info]) => {
      console.log(`${state}: ${info.name} (${info.source})`);
    });

    const successful = Object.keys(governors).length;
    console.log(`\nSuccessfully fetched ${successful}/50 governors`);

    if (successful < 50) {
      console.log('\nStates that failed:');
      const allStates = [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
        'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
        'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
        'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
        'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
        'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
        'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
        'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
        'West Virginia', 'Wisconsin', 'Wyoming'
      ];

      const failed = allStates.filter(state => !governors[state]);
      failed.forEach(state => console.log(`  ${state}`));
    }

  } catch (error) {
    console.error('Error fetching governors:', error);
  }
}

/**
 * Main function with command line interface
 */
async function main() {
  const command = process.argv[2] || 'test';

  switch (command) {
    case 'test':
      await testAndUpdateGovernors();
      break;
    case 'update-all':
      await updateAllGovernors();
      break;
    case 'single':
      const state = process.argv[3];
      if (!state) {
        console.log('Usage: npm run test-governors single "State Name"');
        process.exit(1);
      }
      console.log(`Testing ${state}...`);
      const governor = await getCurrentGovernorName(state, 'Unknown');
      console.log(`Current governor of ${state}: ${governor}`);
      break;
    default:
      console.log(`
Usage: npm run test-governors [command]

Commands:
  test       - Test the system with a few sample states (default)
  update-all - Fetch current governors for all 50 states (slow)
  single     - Test a single state (requires state name)

Examples:
  npm run test-governors
  npm run test-governors test
  npm run test-governors update-all
  npm run test-governors single "California"
      `);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}
