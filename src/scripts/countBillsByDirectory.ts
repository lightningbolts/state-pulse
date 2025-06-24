import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../data');

async function countBillsByDirectory(dir: string) {
    const result: Record<string, number> = {};

    async function traverse(currentDir: string) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await traverse(fullPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
                try {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const data = JSON.parse(content);
                    // Adjust this line if your JSON structure is different
                    const billsCount = Array.isArray(data) ? data.length : Array.isArray(data.bills) ? data.bills.length : 0;
                    const parent = path.relative(DATA_DIR, path.dirname(fullPath));
                    result[parent] = (result[parent] || 0) + billsCount;
                } catch (e) {
                    console.error(`Error reading ${fullPath}:`, e);
                }
            }
        }
    }

    await traverse(dir);
    return result;
}

countBillsByDirectory(DATA_DIR).then(counts => {
    Object.entries(counts).forEach(([dir, count]) => {
        console.log(`${dir}: ${count} bills`);
    });
});