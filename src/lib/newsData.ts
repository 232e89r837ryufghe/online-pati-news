export interface NewsItem {
  id: number;
  slug?: string;
  title: string;
  image: string;
  category: string;
  categorySlug: string;
  date: string;
  author: string;
  excerpt: string;
  content: string;
  dateIso?: string;
  caption?: string;
}

// Static data removed as the site now uses the Native Headless CMS via src/lib/cms.ts
export const newsData: NewsItem[] = [];
