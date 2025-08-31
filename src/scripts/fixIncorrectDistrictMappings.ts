import { getCollection } from '../lib/mongodb';

const stateToFips: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20',
  'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36',
  'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
  'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56', 'DC': '11'
};

const orgClassToType: Record<string, string> = {
  'upper': 'state_leg_upper',
  'lower': 'state_leg_lower',
  'legislature': 'congressional',
  'congress': 'congressional'
};

const typeToDistrictProp: Record<string, string> = {
  congressional: 'CD119FP',
  state_leg_lower: 'SLDLST',
  state_leg_upper: 'SLDUST'
};

async function main() {
  const reps = await getCollection('representatives');
  const boundaries = await getCollection('map_boundaries');

  // Find representatives with multi-member districts (ending with A, B, etc.) that might be incorrectly mapped
  const cursor = reps.find({
    'current_role.district': { $regex: /^\d+[A-Za-z]$/ },
    'map_boundary.district': { $exists: true }
  });

  let checked = 0;
  let fixed = 0;

  while (await cursor.hasNext()) {
    const rep = await cursor.next();
    checked++;
    if (!rep || !rep.current_role?.district || !rep.jurisdiction?.id) {
      continue;
    }

    const stateMatch = rep.jurisdiction.id.match(/state:([a-z]{2})/i);
    if (!stateMatch) {
      continue;
    }

    const statePostal = stateMatch[1].toUpperCase();
    const stateFips = stateToFips[statePostal];
    const districtNum = rep.current_role.district;
    const orgClass = rep.current_role.org_classification?.toLowerCase();
    const type = orgClassToType[orgClass] || orgClass;
    const districtProp = typeToDistrictProp[type];

    // Extract the numeric part from districts like "1A", "13B"
    const match = districtNum.match(/^(\d+)([A-Za-z])$/);
    if (!match) {
      continue;
    }

    const numericPart = match[1];
    const letterPart = match[2];
    const paddedDistrict = numericPart.padStart(3, '0');

    // Check if the current mapping is correct
    const currentMappedDistrict = rep.map_boundary?.district;
    const expectedDistrictId = `${stateFips}${paddedDistrict}`;

    console.log(`[CHECK] Rep: ${rep.name}, District: ${districtNum}, Current mapping: ${currentMappedDistrict}, Expected: ${expectedDistrictId}`);

    if (currentMappedDistrict !== expectedDistrictId) {
      // Find the correct boundary
      const correctBoundary = await boundaries.findOne({
        'properties.STATEFP': stateFips,
        [`properties.${districtProp}`]: paddedDistrict,
        type
      });

      if (correctBoundary) {
        const update = {
          map_boundary: {
            district: correctBoundary.properties.GEOID,
            name: correctBoundary.properties.NAMELSAD,
            geoidfq: correctBoundary.properties.GEOIDFQ,
            type: correctBoundary.type
          }
        };

        await reps.updateOne({ _id: rep._id }, { $set: update });
        fixed++;
        console.log(`[FIXED] Updated ${rep.name} (${districtNum}) from ${currentMappedDistrict} to ${correctBoundary.properties.GEOID} (${correctBoundary.properties.NAMELSAD})`);
      } else {
        console.log(`[ERROR] Could not find correct boundary for ${rep.name} (${districtNum})`);
      }
    } else {
      console.log(`[OK] ${rep.name} (${districtNum}) is correctly mapped to ${currentMappedDistrict}`);
    }
  }

  console.log(`\nChecked ${checked} multi-member district representatives. Fixed ${fixed} incorrect mappings.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
