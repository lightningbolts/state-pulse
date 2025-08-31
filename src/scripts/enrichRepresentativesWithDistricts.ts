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

  // Iterate over all representatives who do not have a map_boundary
  const cursor = reps.find({
    map_boundary: { $exists: false }
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
    if (rep.current_role && rep.current_role.district && rep.current_role.org_classification && rep.jurisdiction && rep.jurisdiction.id) {
      const stateMatch = rep.jurisdiction.id.match(/state:([a-z]{2})/i);
      if (!stateMatch) {
        console.log(`[SKIP] Could not extract state from jurisdiction for rep:`, rep.name);
        continue;
      }
      const statePostal = stateMatch[1].toUpperCase();
      const stateFips = stateToFips[statePostal];
      const districtNum = rep.current_role.district;
      const orgClass = rep.current_role.org_classification.toLowerCase();
      const type = orgClassToType[orgClass] || orgClass;
      const districtProp = typeToDistrictProp[type];
      // Pad districtNum to match Census format (if numeric)
      let paddedDistrict = districtNum;
      if (districtProp === 'SLDLST' || districtProp === 'SLDUST') {
        if (/^\d+$/.test(districtNum)) {
          paddedDistrict = districtNum.padStart(3, '0');
        } else if (/^\d+[A-Za-z]$/.test(districtNum)) {
          // Handle multi-member districts with letter suffixes (e.g., "1A", "13B")
          // Extract the numeric part and pad it, keeping the letter
          const match = districtNum.match(/^(\d+)([A-Za-z])$/);
          if (match) {
            const numPart = match[1].padStart(3, '0');
            paddedDistrict = numPart; // Use just the numeric part for boundary lookup
            console.log(`[MULTI-MEMBER] Detected multi-member district ${districtNum}, using numeric part ${numPart} for boundary lookup`);
          }
        }
      } else if (districtProp === 'CD119FP') {
        if (/^\d+$/.test(districtNum)) {
          paddedDistrict = districtNum.padStart(2, '0');
        }
      }
      let boundary = null;
      if (type === 'congressional') {
        // For congressional, match on state FIPS and CD119FP
        console.log(`[MATCH] Looking for congressional boundary: STATEFP=${stateFips}, CD119FP=${paddedDistrict}, type=${type} for rep: ${rep.name}`);
        boundary = await boundaries.findOne({
          'properties.STATEFP': stateFips,
          'properties.CD119FP': paddedDistrict,
          type: 'congressional'
        });
      } else {
        // State legislative
        console.log(`[MATCH] Looking for boundary: STATEFP=${stateFips}, ${districtProp}=${paddedDistrict}, type=${type} for rep: ${rep.name}`);
        boundary = await boundaries.findOne({
          'properties.STATEFP': stateFips,
          ...(districtProp ? { [`properties.${districtProp}`]: paddedDistrict } : {}),
          type
        });
      }
      // Fallback: If not found and districtNum is not numeric, try by NAMELSAD (case-insensitive, regex, and prefix)
      if (!boundary && isNaN(Number(districtNum)) && districtProp) {
        console.log(`[FALLBACK] Trying NAMELSAD regex match for rep: ${rep.name}, district: ${districtNum}`);

        // Get all available boundaries for this state and type for better matching
        const available = await boundaries.find({
          'properties.STATEFP': stateFips,
          type
        }, { projection: { 'properties.NAMELSAD': 1 } }).toArray();
        const availableNames = available.map(b => b.properties?.NAMELSAD).filter(Boolean);

        // Try exact match first
        boundary = await boundaries.findOne({
          'properties.STATEFP': stateFips,
          'properties.NAMELSAD': districtNum,
          type
        });

        // Try case-insensitive regex match
        if (!boundary) {
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(`^${districtNum}$`, 'i') },
            type
          });
        }

        // Try raw districtNum as substring
        if (!boundary) {
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(districtNum, 'i') },
            type
          });
        }

        // Try with 'District ' prefix if not found
        if (!boundary) {
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(`District ?${districtNum}`, 'i') },
            type
          });
        }

        // Special handling for multi-county districts (e.g., "Norfolk, Worcester and Middlesex")
        if (!boundary && districtNum.includes(',')) {
          // Split on commas and "and", then try to match patterns
          const counties = districtNum.split(/,| and | & /).map((c: string) => c.trim());

          // Try different permutations and formats
          const permutations = [
            counties.join(' and '), // "Norfolk and Worcester and Middlesex"
            counties.join(', '), // "Norfolk, Worcester, Middlesex"
            counties.join('-'), // "Norfolk-Worcester-Middlesex"
            counties.reverse().join(' and '), // Reverse order
            counties.join(' '),  // Just spaces
            // Massachusetts-specific patterns
            `${counties[0]} and ${counties.slice(1).join(' and ')} District`,
            `${counties.join('-')} District`,
            `${counties.join(' and ')} District`
          ];

          for (const perm of permutations) {
            if (!boundary) {
              boundary = await boundaries.findOne({
                'properties.STATEFP': stateFips,
                'properties.NAMELSAD': { $regex: new RegExp(perm, 'i') },
                type
              });
              if (boundary) {
                console.log(`[NAME-MATCH] Found multi-county boundary with permutation "${perm}" for rep: ${rep.name}`);
                break;
              }
            }
          }

          // Try partial matches - any NAMELSAD that contains all county names
          if (!boundary) {
            const foundByPartial = availableNames.find(name => {
              const nameLower = name.toLowerCase();
              return counties.every((county: string) => nameLower.includes(county.toLowerCase()));
            });
            if (foundByPartial) {
              boundary = await boundaries.findOne({
                'properties.STATEFP': stateFips,
                'properties.NAMELSAD': foundByPartial,
                type
              });
              if (boundary) {
                console.log(`[NAME-MATCH] Found multi-county boundary by partial match for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
              }
            }
          }

          // Try word reordering for Massachusetts districts
          if (!boundary && statePostal === 'MA') {
            // Massachusetts often uses different word orders, try all combinations
            for (let i = 0; i < counties.length; i++) {
              for (let j = i + 1; j < counties.length; j++) {
                for (let k = j + 1; k < counties.length; k++) {
                  const permOrder = [counties[i], counties[j], counties[k]].filter(Boolean);
                  if (permOrder.length >= 2) {
                    const patterns = [
                      `${permOrder.join(' and ')} District`,
                      `${permOrder.join('-')} District`,
                      `${permOrder.join(' ')} District`
                    ];

                    for (const pattern of patterns) {
                      if (!boundary) {
                        boundary = await boundaries.findOne({
                          'properties.STATEFP': stateFips,
                          'properties.NAMELSAD': { $regex: new RegExp(pattern, 'i') },
                          type
                        });
                        if (boundary) {
                          console.log(`[NAME-MATCH] Found MA multi-county boundary with reordered pattern "${pattern}" for rep: ${rep.name}`);
                          break;
                        }
                      }
                    }
                    if (boundary) break;
                  }
                }
                if (boundary) break;
              }
              if (boundary) break;
            }
          }
        }

        // Special handling for tribal districts
        if (!boundary && (districtNum.toLowerCase().includes('tribe') || districtNum.toLowerCase().includes('tribal'))) {
          // Try matching any boundary that contains the tribe name
          const tribeName = districtNum.replace(/\s+(tribe|tribal).*$/i, '').trim();
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(tribeName, 'i') },
            type
          });

          if (!boundary) {
            // For tribal districts, try looking for special district types or at-large districts
            boundary = await boundaries.findOne({
              'properties.STATEFP': stateFips,
              'properties.NAMELSAD': { $regex: new RegExp('(tribal|at.large|special)', 'i') },
              type
            });
          }

          if (boundary) {
            console.log(`[NAME-MATCH] Found tribal/special boundary for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
          }
        }

        // If still not found and districtNum is not numeric, try parent district (strip trailing letter)
        if (!boundary && /^(\d+)[A-Za-z]$/.test(districtNum)) {
          const parentDistrict = districtNum.match(/^(\d+)[A-Za-z]$/)[1];
          // Try parent district as raw
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(parentDistrict, 'i') },
            type
          });
          // Try with 'District ' prefix
          if (!boundary) {
            boundary = await boundaries.findOne({
              'properties.STATEFP': stateFips,
              'properties.NAMELSAD': { $regex: new RegExp(`District ?${parentDistrict}`, 'i') },
              type
            });
          }
          if (boundary) {
            console.log(`[NAME-MATCH] Found parent boundary for subdistrict rep: ${rep.name}, parent: ${parentDistrict}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
          }
        }

        // If still not found, try matching 'CountyName N' style districts (e.g., 'Carroll 1')
        if (!boundary && /^([A-Za-z ]+) (\d+)$/.test(districtNum)) {
          const match = districtNum.match(/^([A-Za-z ]+) (\d+)$/);
          const county = match[1].trim();
          let num = match[2];
          // Try to match full NAMELSAD string (with and without leading zero)
          let fullName = `State House District ${county} ${num}`;
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(fullName, 'i') },
            type
          });
          if (!boundary && num.length === 1) {
            // Try with leading zero
            fullName = `State House District ${county} 0${num}`;
            boundary = await boundaries.findOne({
              'properties.STATEFP': stateFips,
              'properties.NAMELSAD': { $regex: new RegExp(fullName, 'i') },
              type
            });
          }
          // Try loose match: ignore spaces and leading zeros
          if (!boundary) {
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/^0+/, '');
            const matchNorm = norm(`${county}${num}`);
            const found = availableNames.find(name => norm(name).includes(matchNorm));
            if (found) {
              boundary = await boundaries.findOne({
                'properties.STATEFP': stateFips,
                'properties.NAMELSAD': found,
                type
              });
              if (boundary) {
                console.log(`[NAME-MATCH] Found loose county/number boundary for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
              }
            }
          }
          if (boundary) {
            console.log(`[NAME-MATCH] Found county/number boundary for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
          }
        }

        // If still not found, try matching 'Senatorial District' style (e.g., 'Chittenden Southeast')
        if (!boundary && /[A-Za-z]/.test(districtNum)) {
          // Try replacing 'Southeast' with 'South East' and add 'Senatorial District' suffix
          let altDistrict = districtNum.replace(/Southeast/i, 'South East');
          let senatorialName = `${altDistrict} Senatorial District`;
          boundary = await boundaries.findOne({
            'properties.STATEFP': stateFips,
            'properties.NAMELSAD': { $regex: new RegExp(senatorialName, 'i') },
            type
          });
          // Try with original districtNum + 'Senatorial District' if not found
          if (!boundary) {
            senatorialName = `${districtNum} Senatorial District`;
            boundary = await boundaries.findOne({
              'properties.STATEFP': stateFips,
              'properties.NAMELSAD': { $regex: new RegExp(senatorialName, 'i') },
              type
            });
          }
          // Try loose match: ignore spaces and case
          if (!boundary) {
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
            const matchNorm = norm(districtNum);
            const found = availableNames.find(name => norm(name).includes(matchNorm));
            if (found) {
              boundary = await boundaries.findOne({
                'properties.STATEFP': stateFips,
                'properties.NAMELSAD': found,
                type
              });
              if (boundary) {
                console.log(`[NAME-MATCH] Found loose senatorial boundary for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
              }
            }
          }
          if (boundary) {
            console.log(`[NAME-MATCH] Found senatorial boundary for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
          }
        }

        if (boundary) {
          console.log(`[NAME-MATCH] Found boundary by NAMELSAD regex for rep: ${rep.name}, NAMELSAD: ${boundary.properties.NAMELSAD}`);
        } else {
          // Log available NAMELSADs for debugging
          console.log(`[DEBUG] No NAMELSAD match for rep: ${rep.name}, district: ${districtNum}. Available NAMELSADs:`, availableNames);
        }
      }
      if (!boundary) {
        console.log(`[MISS] No boundary found for rep: ${rep.name}, STATEFP=${stateFips}, ${districtProp}=${paddedDistrict}, type=${type}`);
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
      if (boundary.properties.NAMELSAD === districtNum) {
        console.log(`[UPDATE] Updated rep: ${rep.name} with map_boundary (name-based):`, update.map_boundary);
      } else {
        console.log(`[UPDATE] Updated rep: ${rep.name} with map_boundary:`, update.map_boundary);
      }
      continue;
    }

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
