/**
 * Utility functions for normalizing, converting, and previewing image URLs
 * Supports:
 * - Google Drive shareable links (converted to direct Google UserContent CDN links)
 * - Dropbox share links (converted to raw=1 direct links)
 * - Imgur links (converted to i.imgur.com direct links)
 * - Google Image Search / Photos redirection links
 * - Base64 Data URLs
 * - Direct HTTP/HTTPS image links with hotlink bypass (referrerPolicy="no-referrer")
 * - Server-side image proxy fallback
 */

export function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();

  // Strip leading/trailing quotes or backticks if pasted with them
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")) || (url.startsWith('`') && url.endsWith('`'))) {
    url = url.slice(1, -1).trim();
  }

  if (!url) return '';

  // If multiple URLs were accidentally concatenated without whitespace (e.g. https://...https://...)
  // Extract just the first one for single URL normalization
  const secondHttpIndex = url.slice(1).search(/https?:\/\//i);
  if (secondHttpIndex !== -1) {
    url = url.slice(0, secondHttpIndex + 1).trim();
  }

  // Data URLs (e.g. data:image/png;base64,...) are already direct
  if (url.startsWith('data:image/')) {
    return url;
  }

  // Handle Google Drive links
  // Pattern 1: https://drive.google.com/file/d/FILE_ID/view...
  // Pattern 2: https://drive.google.com/open?id=FILE_ID
  // Pattern 3: https://drive.google.com/uc?id=FILE_ID
  if (url.includes('drive.google.com')) {
    const fileIdMatch =
      url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      // Direct high-res image link using Google UserContent CDN (works reliably without login)
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  // Handle Google search image result (e.g. https://www.google.com/imgres?imgurl=...)
  if (url.includes('google.') && url.includes('imgurl=')) {
    try {
      const match = url.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        return normalizeImageUrl(decoded);
      }
    } catch {
      // fallback
    }
  }

  // Handle Dropbox links
  // https://www.dropbox.com/s/.../image.jpg?dl=0 -> raw=1
  if (url.includes('dropbox.com')) {
    if (url.includes('?dl=0')) {
      return url.replace('?dl=0', '?raw=1');
    }
    if (url.includes('&dl=0')) {
      return url.replace('&dl=0', '&raw=1');
    }
    if (!url.includes('raw=1')) {
      return url.includes('?') ? `${url}&raw=1` : `${url}?raw=1`;
    }
  }

  // Handle Imgur links: https://imgur.com/ABCxyz -> https://i.imgur.com/ABCxyz.jpg
  if (url.includes('imgur.com') && !url.includes('i.imgur.com')) {
    const imgurMatch = url.match(/imgur\.com\/(?:gallery\/|a\/)?([a-zA-Z0-9]+)$/);
    if (imgurMatch && imgurMatch[1]) {
      return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    }
  }

  return url;
}

/**
 * Returns a fallback proxy URL using our backend to bypass strict CORS or hotlink referrers
 */
export function getProxyImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:image/') || url.startsWith('/') || url.startsWith('./')) {
    return url;
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Parses multiple URLs if pasted in one block (comma, space, or newline separated)
 */
export function parseMultipleImageUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  // Split on newlines, commas, whitespace, and also split if two http(s) URLs are stuck together
  const rawParts = text.split(/[\n,\s]+/);
  const parts: string[] = [];
  for (const part of rawParts) {
    if (part.includes('http://') || part.includes('https://')) {
      // Split on boundary right before https:// or http:// (except at index 0)
      const subParts = part.split(/(?=[hH][tT][tT][pP][sS]?:\/\/)/);
      parts.push(...subParts);
    } else if (part.trim()) {
      parts.push(part);
    }
  }

  const results: string[] = [];
  for (const item of parts) {
    const norm = normalizeImageUrl(item);
    if (norm && (norm.startsWith('http://') || norm.startsWith('https://') || norm.startsWith('data:image/'))) {
      if (!results.includes(norm)) {
        results.push(norm);
      }
    }
  }
  return results;
}
