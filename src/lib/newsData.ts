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
}

// Static data removed as the site now uses Headless WordPress via src/lib/wordpress.ts
export const newsData: NewsItem[] = [];
