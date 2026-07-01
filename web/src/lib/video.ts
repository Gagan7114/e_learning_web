/**
 * Classify a lecture/promo video URL so the player can pick the right renderer.
 * - YouTube & Vimeo links are page URLs and must be shown in an <iframe> embed.
 * - Everything else is treated as a direct media file for the <video> element.
 */
export type ParsedVideo =
  | { kind: 'youtube'; id: string; embedUrl: string }
  | { kind: 'vimeo'; id: string; embedUrl: string }
  | { kind: 'file'; url: string }
  | { kind: 'none' };

export function parseVideo(raw?: string | null): ParsedVideo {
  if (!raw) return { kind: 'none' };
  const url = raw.trim();
  if (!url) return { kind: 'none' };

  // YouTube video id: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID, /live/ID, /v/ID
  const videoId = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )?.[1];
  // Playlist id — a full "course" on YouTube is usually a playlist: ...?list=ID or /playlist?list=ID
  const listId = url.match(/[?&]list=([A-Za-z0-9_-]+)/)?.[1];

  if (/youtube\.com|youtu\.be/.test(url) && (videoId || listId)) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
    if (listId) params.set('list', listId); // keep playlist context if present
    // A single video wins; otherwise embed the playlist as a series.
    const path = videoId ? `embed/${videoId}` : 'embed/videoseries';
    return {
      kind: 'youtube',
      id: videoId ?? listId!,
      embedUrl: `https://www.youtube.com/${path}?${params.toString()}`,
    };
  }

  // Vimeo: vimeo.com/123456789 or player.vimeo.com/video/123456789
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    return { kind: 'vimeo', id: vm[1], embedUrl: `https://player.vimeo.com/video/${vm[1]}` };
  }

  return { kind: 'file', url };
}

export function isEmbed(raw?: string | null): boolean {
  const k = parseVideo(raw).kind;
  return k === 'youtube' || k === 'vimeo';
}
