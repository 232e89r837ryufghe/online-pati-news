/**
 * Sanitizes image URLs to remove external dependencies like Unsplash.
 * If a URL contains 'unsplash.com', it returns a local fallback.
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return '/logo.png';
  
  if (url.includes('unsplash.com')) {
    return '/logo.png';
  }
  
  return url;
}
