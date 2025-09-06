import { getBillPdfLinksFromPage } from '@/services/aiSummaryUtil';

async function main() {
  const testLinks = [
    'https://www.palegis.us/legislation/bills/2025/hb1825',
  ];

  for (const url of testLinks) {
    try {
      console.log(`\nTesting: ${url}`);
      // Print all PDF links (regardless of tag) for debugging
      const res = await fetch(url);
      const html = await res.text();
      // Match any https://.../legislation/bills/text/PDF/... substring
      const pdfUrlRegex = /https?:\/\/www\.palegis\.us\/legislation\/bills\/text\/PDF\/[\w\/-]+/gi;
      const allPdfLinks = Array.from(html.matchAll(pdfUrlRegex)).map(m => m[0]);
      if (allPdfLinks.length === 0) {
        console.log('  No PDF-like links found on the page.');
      } else {
        console.log('  All PDF-like links found:');
        allPdfLinks.forEach(link => console.log('   -', link));
      }
      // Also print bill-only links for comparison
      const billPdfLinks = allPdfLinks.filter(link => link.toLowerCase().includes('bill'));
      if (billPdfLinks.length === 0) {
        console.log('  No bill PDFs found.');
      } else {
        console.log('  Bill PDFs found:');
        billPdfLinks.forEach(link => console.log('   -', link));
      }
    } catch (err) {
      console.error(`  Error fetching PDFs for ${url}:`, err);
    }
  }
}

main();
