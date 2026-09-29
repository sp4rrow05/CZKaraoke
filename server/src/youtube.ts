import type { Video } from '../../shared/types.ts';

const API = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; results: Video[] }>();

export class SearchError extends Error {}

/** "PT1H2M3S" -> "1:02:03" */
export function formatDuration(iso: string): string {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return '';
  const [h, min, s] = [m[1], m[2], m[3]].map((v) => Number(v ?? 0));
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(min).padStart(2, '0')}:${ss}` : `${min}:${ss}`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function call(path: string, params: Record<string, string>, apiKey: string) {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key: apiKey })}`;
  const res = await fetch(url);
  const body = (await res.json()) as any;
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw new SearchError('Daily YouTube search quota reached. Try again tomorrow.');
    throw new SearchError(`YouTube search failed: ${body?.error?.message ?? res.status}`);
  }
  return body;
}

export async function searchVideos(query: string, karaoke: boolean): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new SearchError('Search is not configured: YOUTUBE_API_KEY is missing on the server.');

  const q = (karaoke && !/karaoke/i.test(query) ? `${query} karaoke` : query).trim();
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.results;

  const search = await call(
    'search',
    { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '15', q },
    apiKey,
  );
  const ids: string[] = search.items.map((i: any) => i.id.videoId).filter(Boolean);
  if (!ids.length) return [];

  const details = await call('videos', { part: 'contentDetails', id: ids.join(',') }, apiKey);
  const durations = new Map<string, string>(
    details.items.map((v: any) => [v.id, formatDuration(v.contentDetails.duration)]),
  );

  const results: Video[] = search.items
    .filter((i: any) => i.id.videoId)
    .map((i: any) => ({
      videoId: i.id.videoId,
      title: decodeEntities(i.snippet.title),
      channel: decodeEntities(i.snippet.channelTitle),
      thumbnail: i.snippet.thumbnails?.medium?.url ?? i.snippet.thumbnails?.default?.url ?? '',
      duration: durations.get(i.id.videoId) ?? '',
    }));

  cache.set(key, { at: Date.now(), results });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return results;
}
