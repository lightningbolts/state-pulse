import { ABR_TO_FIPS } from '@/types/geo';
import { getCollection } from '../lib/mongodb';

const stateToFips: Record<string, string> = ABR_TO_FIPS

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
