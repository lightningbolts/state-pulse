import { getCollection } from '../lib/mongodb';
import { STATE_MAP } from '../types/geo';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_MAP).map(([fullName, abbr]) => [normalize(fullName), abbr])
);

const stateToFips: Record<string, string> = {
  'AL': '01',
  'AK': '02',
  'AZ': '04',
  'AR': '05',
  'CA': '06',
  'CO': '08',
  'CT': '09',
  'DE': '10',
  'FL': '12',
  'GA': '13',
  'HI': '15',
  'ID': '16',
  'IL': '17',
  'IN': '18',
  'IA': '19',
  'KS': '20',
  'KY': '21',
  'LA': '22',
  'ME': '23',
  'MD': '24',
  'MA': '25',
  'MI': '26',
  'MN': '27',
  'MS': '28',
  'MO': '29',
  'MT': '30',
  'NE': '31',
  'NV': '32',
  'NH': '33',
  'NJ': '34',
  'NM': '35',
  'NY': '36',
  'NC': '37',
  'ND': '38',
  'OH': '39',
  'OK': '40',
  'OR': '41',
  'PA': '42',
  'RI': '44',
  'SC': '45',
  'SD': '46',
  'TN': '47',
  'TX': '48',
  'UT': '49',
  'VT': '50',
  'VA': '51',
  'WA': '53',
  'WV': '54',
  'WI': '55',
  'WY': '56',
  'DC': '11'
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

  const cursor = reps.find({
    map_boundary: { $exists: false },
    $or: [
      { chamber: { $regex: /house/i } },
      { role: { $regex: /representative|congress/i } },
      { jurisdiction: { $regex: /us house/i } }
    ],
    state: { $exists: true },
    district: { $exists: true }
  });
  let updated = 0;
  let checked = 0;
  while (await cursor.hasNext()) {
    const rep = await cursor.next();
    checked++;
    if (!rep) {
      continue;
    }

    // OpenStates-style
    // if (rep.current_role && rep.current_role.district && rep.current_role.org_classification && rep.jurisdiction && rep.jurisdiction.id) {
    //   const stateMatch = rep.jurisdiction.id.match(/state:([a-z]{2})/i);
    //   if (!stateMatch) {
    //     console.log(`[SKIP] Could not extract state from jurisdiction for rep:`, rep.name);
    //     continue;
    //   }
    //   const statePostal = stateMatch[1].toUpperCase();
    //   const stateFips = stateToFips[statePostal];
    //   const districtNum = rep.current_role.district;
    //   const orgClass = rep.current_role.org_classification.toLowerCase();
    //   const type = orgClassToType[orgClass] || orgClass;
    //   const districtProp = typeToDistrictProp[type];
    //   // Pad districtNum to match Census format (if numeric)
    //   let paddedDistrict = districtNum;
    //   if (districtProp === 'SLDLST' || districtProp === 'SLDUST') {
    //     if (/^\d+$/.test(districtNum)) {
    //       paddedDistrict = districtNum.padStart(3, '0');
    //     }
    //   } else if (districtProp === 'CD119FP') {
    //     if (/^\d+$/.test(districtNum)) {
    //       paddedDistrict = districtNum.padStart(2, '0');
    //     }
    //   }
    //   let boundary = null;
    //   if (type === 'congressional') {
    //     // For congressional, match on state FIPS and CD119FP
    //     console.log(`[MATCH] Looking for congressional boundary: STATEFP=${stateFips}, CD119FP=${paddedDistrict}, type=${type} for rep: ${rep.name}`);
    //     boundary = await boundaries.findOne({
    //       'properties.STATEFP': stateFips,
    //       'properties.CD119FP': paddedDistrict,
    //       type: 'congressional'
    //     });
    //   } else {
    //     // State legislative
    //     console.log(`[MATCH] Looking for boundary: STATEFP=${stateFips}, ${districtProp}=${paddedDistrict}, type=${type} for rep: ${rep.name}`);
    //     boundary = await boundaries.findOne({
    //       'properties.STATEFP': stateFips,
    //       ...(districtProp ? { [`properties.${districtProp}`]: paddedDistrict } : {}),
    //       type
    //     });
    //   }
    //   // Fallback: If not found and districtNum is not numeric, try by NAMELSAD
    //   if (!boundary && isNaN(Number(districtNum)) && districtProp) {
    //     console.log(`[FALLBACK] Trying NAMELSAD match for rep: ${rep.name}, district: ${districtNum}`);
    //     boundary = await boundaries.findOne({
    //       'properties.STATEFP': stateFips,
    //       'properties.NAMELSAD': districtNum,
    //       type
    //     });
    //     if (boundary) {
    //       console.log(`[NAME-MATCH] Found boundary by NAMELSAD for rep: ${rep.name}, NAMELSAD: ${districtNum}`);
    //     }
    //   }
    //   if (!boundary) {
    //     console.log(`[MISS] No boundary found for rep: ${rep.name}, STATEFP=${stateFips}, ${districtProp}=${paddedDistrict}, type=${type}`);
    //     continue;
    //   }
    //   const update = {
    //     map_boundary: {
    //       district: boundary.properties.GEOID,
    //       name: boundary.properties.NAMELSAD,
    //       geoidfq: boundary.properties.GEOIDFQ,
    //       type: boundary.type
    //     }
    //   };
    //   await reps.updateOne({ _id: rep._id }, { $set: update });
    //   updated++;
    //   if (boundary.properties.NAMELSAD === districtNum) {
    //     console.log(`[UPDATE] Updated rep: ${rep.name} with map_boundary (name-based):`, update.map_boundary);
    //   } else {
    //     console.log(`[UPDATE] Updated rep: ${rep.name} with map_boundary:`, update.map_boundary);
    //   }
    //   continue;
    // }

    const chamberStr = typeof rep.chamber === 'string' ? rep.chamber.toLowerCase() : '';
    const roleStr = typeof rep.role === 'string' ? rep.role.toLowerCase() : '';
    const jurisdictionStr = typeof rep.jurisdiction === 'string' ? rep.jurisdiction.toLowerCase() : '';
    const isHouseRep =
      rep.state &&
      (typeof rep.district !== 'undefined' && rep.district !== null) &&
      (
        chamberStr.includes('house') ||
        roleStr.includes('representative') || roleStr.includes('congress') ||
        jurisdictionStr.includes('us house')
      );
    if (isHouseRep) {
      let statePostal = '';
      if (typeof rep.state === 'string') {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
        const stateStrNorm = normalize(rep.state);
        if (rep.state.length === 2) {
          statePostal = rep.state.toUpperCase();
        } else {
          let found = false;
          for (const [name, abbr] of Object.entries(STATE_NAME_TO_ABBR)) {
            if (stateStrNorm === normalize(name)) {
              statePostal = abbr;
              found = true;
              console.log(`[STATE_MAP] Exact-mapped '${rep.state}' to '${statePostal}' using '${name}'`);
              break;
            }
          }
          if (!found) {
            console.log(`[STATE_MAP] Could not map state: '${rep.state}' (normalized: '${stateStrNorm}')`);
          }
        }
      }
      const stateFips = stateToFips[statePostal];
      if (!stateFips) {
        console.log(`[SKIP] Could not map state to FIPS for rep:`, rep.name, rep.state);
        continue;
      }
      let districtNum = String(rep.district).toLowerCase();
      let paddedDistrict = districtNum;
      if (districtNum === 'at-large' || districtNum === 'at large' || districtNum === '0' || districtNum === '00') {
        paddedDistrict = '00';
      } else if (/^\d+$/.test(districtNum)) {
        paddedDistrict = districtNum.padStart(2, '0');
      }
      const type = 'congressional';
      const districtProp = 'CD119FP';
      console.log(`[MATCH] [HOUSE] Looking for congressional boundary: STATEFP=${stateFips}, CD119FP=${paddedDistrict}, type=${type} for rep: ${rep.name}`);
      let boundary = await boundaries.findOne({
        'properties.STATEFP': stateFips,
        'properties.CD119FP': paddedDistrict,
        type: 'congressional'
      });
      if (!boundary) {
        if (districtNum === 'at-large' || districtNum === 'at large') {
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': /at-large/i,
            type: 'congressional'
          });
        }
      }
      if (!boundary) {
        console.log(`[MISS] [HOUSE] No boundary found for rep: ${rep.name}, STATEFP=${stateFips}, CD119FP=${paddedDistrict}`);
        continue;
      }
      const update = {
        map_boundary: {
          district: boundary.properties.GEOID,
          name: boundary.properties.NAMELSAD,
          geoidfq: boundary.properties.GEOIDFQ,
          type: boundary.type
        }
      };
      await reps.updateOne({ _id: rep._id }, { $set: update });
      updated++;
      console.log(`[UPDATE] [HOUSE] Updated rep: ${rep.name} with map_boundary:`, update.map_boundary);
      continue;
    }

    console.log(`[SKIP] Unrecognized rep structure for:`, rep.name);
    continue;
  }
  console.log(`Checked ${checked} representatives. Updated ${updated} with district info.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
