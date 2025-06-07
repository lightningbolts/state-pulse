import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-legislation-legally-dense.ts';
import '@/ai/flows/summarize-legislation.ts';
import '@/ai/flows/summarize-legislation-tweet-length.ts';