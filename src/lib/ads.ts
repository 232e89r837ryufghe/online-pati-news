/**
 * Online Pati News — Advertisement Service
 * Fetches active banners from the CMS API
 */
import { sanitizeImageUrl } from '../utils/image';

const API_BASE = import.meta.env.PUBLIC_API_URL || 'https://onlinepatinews.com/api';

export interface Advertisement {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  position: string;
  status: 'active' | 'inactive';
}

export async function getAdsByPosition(position: string): Promise<Advertisement[]> {
  try {
    const res = await fetch(`${API_BASE}/ads?position=${position}`);
    if (!res.ok) return [];
    const ads: Advertisement[] = await res.json();
    return ads.map(ad => ({
      ...ad,
      image_url: sanitizeImageUrl(ad.image_url)
    }));
  } catch (e) {
    console.error(`Failed to fetch ads for position ${position}:`, e);
    return [];
  }
}

export async function getAllAds(): Promise<Advertisement[]> {
  try {
    const res = await fetch(`${API_BASE}/ads`);
    if (!res.ok) return [];
    const ads: Advertisement[] = await res.json();
    return ads.map(ad => ({
      ...ad,
      image_url: sanitizeImageUrl(ad.image_url)
    }));
  } catch (e) {
    console.error('Failed to fetch all ads:', e);
    return [];
  }
}
