import { getCollection } from '../lib/mongodb';

const states = [
  { abbr: "AL", name: "Alabama", source: "alison.legislature.state.al.us/bill-search" },
  { abbr: "AK", name: "Alaska", source: "akleg" },
  { abbr: "AZ", name: "Arizona", source: "azleg" },
  { abbr: "AR", name: "Arkansas", source: "arkleg" },
  { abbr: "CA", name: "California", source: "leginfo.legislature.ca.gov" },
  { abbr: "CO", name: "Colorado", source: "leg.colorado.gov" },
  { abbr: "CT", name: "Connecticut", source: "cga.ct.gov" },
  { abbr: "DC", name: "District of Columbia", source: "dccouncil.gov" },
  { abbr: "DE", name: "Delaware", source: "legis.delaware.gov" },
  { abbr: "FL", name: "Florida", source: "flsenate.gov" },
  { abbr: "GA", name: "Georgia", source: "legis.ga.gov" },
  { abbr: "HI", name: "Hawaii", source: "capitol.hawaii.gov" },
  { abbr: "ID", name: "Idaho", source: "legislature.idaho.gov" },
  { abbr: "IL", name: "Illinois", source: "ilga.gov" },
  { abbr: "IN", name: "Indiana", source: "iga.in.gov" },
  { abbr: "IA", name: "Iowa", source: "legis.iowa.gov" },
  { abbr: "KS", name: "Kansas", source: "kslegislature.gov" },
  { abbr: "KY", name: "Kentucky", source: "apps.legislature.ky.gov" },
  { abbr: "LA", name: "Louisiana", source: "legis.la.gov" },
  { abbr: "ME", name: "Maine", source: "legislature.maine.gov" },
  { abbr: "MD", name: "Maryland", source: "mgaleg.maryland.gov" },
  { abbr: "MA", name: "Massachusetts", source: "malegislature.gov" },
  { abbr: "MI", name: "Michigan", source: "legislature.mi.gov" },
  { abbr: "MN", name: "Minnesota", source: "revisor.mn.gov" },
  { abbr: "MS", name: "Mississippi", source: "billstatus.ls.state.ms.us" },
  { abbr: "MO", name: "Missouri", source: "mo.gov" },
  { abbr: "MT", name: "Montana", source: "bills.legmt.gov" },
  { abbr: "NE", name: "Nebraska", source: "nebraskalegislature.gov" },
  { abbr: "NV", name: "Nevada", source: "leg.state.nv.us" },
  { abbr: "NH", name: "New Hampshire", source: "gc.nh.gov" },
  { abbr: "NJ", name: "New Jersey", source: "njleg.state.nj.us" },
  { abbr: "NM", name: "New Mexico", source: "nmlegis.gov" },
  { abbr: "NY", name: "New York", source: "nyassembly.gov" }, // "nysenate.gov" is also valid
  { abbr: "NC", name: "North Carolina", source: "ncleg.gov" },
  { abbr: "ND", name: "North Dakota", source: "ndlegis.gov" },
  { abbr: "OH", name: "Ohio", source: "state.oh.us" },
  { abbr: "OK", name: "Oklahoma", source: "oklegislature.gov" },
  { abbr: "OR", name: "Oregon", source: "oregonlegislature.gov" },
  { abbr: "PA", name: "Pennsylvania", source: "palegis.us" },
  { abbr: "RI", name: "Rhode Island", source: "rilegislature.gov" },
  { abbr: "SC", name: "South Carolina", source: "scstatehouse.gov" },
  { abbr: "SD", name: "South Dakota", source: "sdlegislature.gov" },
  { abbr: "TN", name: "Tennessee", source: "capitol.tn.gov" },
  { abbr: "TX", name: "Texas", source: "capitol.texas.gov" },
  { abbr: "UT", name: "Utah", source: "le.utah.gov" },
  { abbr: "VT", name: "Vermont", source: "legislature.vermont.gov" },
  { abbr: "VA", name: "Virginia", source: "virginia.gov" },
  { abbr: "WA", name: "Washington", source: "leg.wa.gov" },
  { abbr: "WV", name: "West Virginia", source: "wvlegislature.gov" },
  { abbr: "WI", name: "Wisconsin", source: "docs.legis.wisconsin.gov" },
  { abbr: "WY", name: "Wyoming", source: "wyoleg.gov" },
  { abbr: "US", name: "United States Congress", source: "congress.gov" },
//   { abbr: "PR", name: "Puerto Rico", source: "legislature.pr.gov" },
//   { abbr: "VI", name: "Virgin Islands", source: "legvi.org" },
//   { abbr: "GU", name: "Guam", source: "guamlegislature.org" },
//   { abbr: "MP", name: "Northern Mariana Islands", source: "cnmilaw.org" }
];

async function main() {
  const collection = await getCollection('legislation');
  let totalRestored = 0;

  for (const state of states) {
    const result = await collection.updateMany(
      {
        jurisdictionName: "United States",
        $or: [
          { state: state.abbr },
          { jurisdictionId: new RegExp(state.abbr, "i") },
          { openstatesUrl: new RegExp(state.abbr, "i") },
          { "versions.links.url": new RegExp(state.source, "i") },
          { "sources.url": new RegExp(state.source, "i") }
        ]
      },
      { $set: { jurisdictionName: state.name } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Restored jurisdictionName for ${result.modifiedCount} ${state.name} bills.`);
      totalRestored += result.modifiedCount;
    }
  }
  console.log(`Total restored: ${totalRestored} bills.`);
}

main().catch(err => {
  console.error('Error restoring state jurisdictionName:', err);
  process.exit(1);
});