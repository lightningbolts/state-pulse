

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';


const DOWNLOADS = [
  {
    name: 'congressional',
    url: 'https://www2.census.gov/geo/tiger/TIGER2024/CD/',
    outDir: './src/data/congressional_districts_zips',
    zipPattern: /href="(tl_2024_\d{2}_cd119\.zip)"/gi
  },
  {
    name: 'state_leg_lower',
    url: 'https://www2.census.gov/geo/tiger/TIGER2024/SLDL/',
    outDir: './src/data/state_leg_lower_zips',
    zipPattern: /href="(tl_2024_\d{2}_sldl\.zip)"/gi
  },
  {
    name: 'state_leg_upper',
    url: 'https://www2.census.gov/geo/tiger/TIGER2024/SLDU/',
    outDir: './src/data/state_leg_upper_zips',
    zipPattern: /href="(tl_2024_\d{2}_sldu\.zip)"/gi
  }
];

// Helper to download a file
async function downloadFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const buffer = await res.arrayBuffer();
  await fs.writeFile(dest, Buffer.from(buffer));
}


async function fetchAllDistrictZips() {
  for (const { name, url, outDir, zipPattern } of DOWNLOADS) {
    console.log(`Fetching ${name} district ZIPs from ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch directory listing for ${name}`);
    const html = await res.text();
    const matches = [...html.matchAll(zipPattern)];
    const files = matches.map(m => m[1]);
    if (files.length === 0) throw new Error(`No zip files found for ${name}`);
    await fs.mkdir(outDir, { recursive: true });
    for (const file of files) {
      const fileUrl = url + file;
      const dest = path.join(outDir, file);
      console.log(`Downloading ${file}...`);
      await downloadFile(fileUrl, dest);
      console.log(`Saved to ${dest}`);
    }
  }
}


fetchAllDistrictZips().catch(err => {
  console.error('Error fetching district ZIPs:', err);
  process.exit(1);
});
