import axios from 'axios';
import * as cheerio from 'cheerio';

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  url: string;
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const getMeta = (name: string) =>
      $(`meta[property='${name}'], meta[name='${name}']`).attr('content');
    return {
      title: getMeta('og:title') || $('title').text(),
      description: getMeta('og:description') || getMeta('description'),
      image: getMeta('og:image'),
      url,
    };
  } catch {
    return { url };
  }
}

