import { getBillPdfLinksFromPage, getBillPdfLinksFromPagePuppeteer } from '@/services/aiSummaryUtil';

async function main() {
  const testLinks = [
    'https://www.palegis.us/legislation/bills/2025/hb1825',
    'https://malegislature.gov/Bills/194/H4475',
    'https://capitol.texas.gov/BillLookup/History.aspx?LegSess=892&Bill=HB319',
    'https://capitol.texas.gov/BillLookup/Text.aspx?LegSess=892&Bill=HB319', // this page is after clicking 'text' button from above link
    'https://www.nysenate.gov/legislation/bills/2025/A9059',
    'https://legislature.mi.gov/Bills/Bill?ObjectName=2025-HB-4840',
    'https://www.congress.gov/bill/119th-congress/house-bill/5125/text',
    'https://ilga.gov/Legislation/BillStatus?DocNum=459&GAID=18&DocTypeID=HR&LegId=164103&SessionID=114',
    'https://ilga.gov/Legislation/BillStatus/FullText?GAID=18&DocNum=459&DocTypeID=HR&LegId=164103&SessionID=114', // this page is after clicking 'full text button' from the above link
    'https://www.revisor.mn.gov/bills/bill.php?b=House&f=HF0017&ssn=1&y=2025',
    'https://legislature.vermont.gov/bill/status/2026/J.R.S.28',
    'https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260HR73'
  ];

  for (const url of testLinks) {
    console.log(`\nTesting: ${url}`);
    console.log('='.repeat(60));
    
    try {
      console.log('\n1. Regular fetch-based extraction:');
      const regularLinks = await getBillPdfLinksFromPage(url);
      if (regularLinks.length === 0) {
        console.log('  No PDF links found with regular fetch.');
      } else {
        console.log('  PDF links found with regular fetch:');
        regularLinks.forEach(link => console.log('   -', link));
      }
    } catch (err) {
      console.error('  Error with regular fetch:', err);
    }

    try {
      console.log('\n2. Puppeteer-based extraction:');
      const puppeteerLinks = await getBillPdfLinksFromPagePuppeteer(url);
      if (puppeteerLinks.length === 0) {
        console.log('  No PDF links found with Puppeteer.');
      } else {
        console.log('  PDF links found with Puppeteer:');
        puppeteerLinks.forEach(link => console.log('   -', link));
      }
    } catch (err) {
      console.error('  Error with Puppeteer:', err);
    }
  }
}

main().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
