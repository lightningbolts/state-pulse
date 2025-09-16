import { getBillPdfLinksFromPagePuppeteer } from '@/services/aiSummaryUtil';

async function main() {
  const testLinks = [
    'https://www.palegis.us/legislation/bills/2025/hb1825',
    'https://malegislature.gov/Bills/194/H4475',
    'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=892&Bill=HB319',
    'https://www.nysenate.gov/legislation/bills/2025/A9059',
    'https://legislature.mi.gov/Bills/Bill?ObjectName=2025-HB-4840',
    'https://www.congress.gov/bill/119th-congress/house-bill/5125/text',
    'https://ilga.gov/Legislation/BillStatus?DocNum=459&GAID=18&DocTypeID=HR&LegId=164103&SessionID=114',
    'https://www.njleg.state.nj.us/bill-search/2024/A5964',
    'https://legislature.mi.gov/Bills/Bill?ObjectName=2025-HB-4866',
    'https://www.senate.mo.gov/25info/BTS_Web/BillText.aspx?SessionType=E2&BillID=18282173',
    'https://capitol.texas.gov/BillLookup/Text.aspx?LegSess=892&Bill=HB319',
  ];

  for (const url of testLinks) {
    console.log(`\nTesting: ${url}`);
    try {
      const pdfLinks = await getBillPdfLinksFromPagePuppeteer(url);
      if (pdfLinks.length === 0) {
        console.log('  No PDF links found after JS rendering.');
      } else {
        console.log('  PDF links found after JS rendering:');
        pdfLinks.forEach(link => console.log('   -', link));
      }
    } catch (err) {
      console.error(`  Error fetching PDFs for ${url}:`, err);
    }
  }
}

main().catch(err => {
  console.error('Error running Puppeteer script:', err);
  process.exit(1);
});
