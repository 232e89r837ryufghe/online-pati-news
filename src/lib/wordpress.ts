import type { NewsItem } from './newsData';

const API_URL = import.meta.env.WORDPRESS_API_URL || 'https://public-api.wordpress.com/wp/v2/sites/dreamchasernepal.wordpress.com';

export async function getWordPressPosts(perPage = 10, category?: number): Promise<NewsItem[]> {
  const url = new URL(`${API_URL}/posts`);
  url.searchParams.append('_embed', 'true');
  url.searchParams.append('per_page', perPage.toString());
  if (category) {
    url.searchParams.append('categories', category.toString());
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error(`Failed to fetch WordPress posts: ${response.statusText}`);
    return [];
  }

  const posts = await response.json();
  return posts.map(mapWordPressPostToNewsItem);
}

export async function getWordPressPostBySlug(slug: string): Promise<NewsItem | null> {
  const url = new URL(`${API_URL}/posts`);
  url.searchParams.append('_embed', 'true');
  url.searchParams.append('slug', slug);

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error(`Failed to fetch WordPress post by slug (${slug}): ${response.statusText}`);
    return null;
  }

  const posts = await response.json();
  if (posts.length === 0) return null;

  return mapWordPressPostToNewsItem(posts[0]);
}

export async function getWordPressCategories() {
  const url = new URL(`${API_URL}/categories`);
  url.searchParams.append('per_page', '100');

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error(`Failed to fetch WordPress categories: ${response.statusText}`);
    return [];
  }

  return await response.json();
}

export async function searchWordPressPosts(query: string, perPage = 20): Promise<NewsItem[]> {
  const url = new URL(`${API_URL}/posts`);
  url.searchParams.append('_embed', 'true');
  url.searchParams.append('search', query);
  url.searchParams.append('per_page', perPage.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error(`Failed to search WordPress posts (${query}): ${response.statusText}`);
    return [];
  }

  const posts = await response.json();
  return posts.map(mapWordPressPostToNewsItem);
}

export async function getWordPressPostsByCategorySlug(slug: string, perPage = 10): Promise<NewsItem[]> {

  const categories = await getWordPressCategories();
  const category = categories.find((c: any) => c.slug === slug);
  
  if (!category) {
    console.warn(`Category with slug "${slug}" not found.`);
    return [];
  }

  return getWordPressPosts(perPage, category.id);
}

function mapWordPressPostToNewsItem(post: any): NewsItem {
  // Extract featured image
  let image = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1200'; // Default placeholder
  
  // Try Jetpack featured media URL first
  if (post.jetpack_featured_media_url) {
    image = post.jetpack_featured_media_url;
  } 
  // Then try standard WordPress embed
  else if (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) {
    image = post._embedded['wp:featuredmedia'][0].source_url;
  }

  // Extract author
  const author = post._embedded?.author?.[0]?.name || 'अनलाइन पाटी';

  // Extract category info
  const categoryInfo = post._embedded?.['wp:term']?.[0]?.[0] || { name: 'समाचार', slug: 'news' };

  return {
    id: post.id,
    slug: post.slug,
    title: post.title.rendered,
    image: image,
    category: categoryInfo.name,
    categorySlug: categoryInfo.slug,
    author: author,
    date: formatDate(post.date),
    excerpt: stripHtml(post.excerpt.rendered),
    content: post.content.rendered
  };
}


function formatDate(dateStr: string): string {
  // Simple conversion of ISO date to a more readable format for the UI
  // In a real application, you might want to convert to Nepali date (B.S.)
  const date = new Date(dateStr);
  return date.toLocaleDateString('ne-NP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function stripHtml(html: string): string {
  if (typeof window !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }
  // Server-side simple regex for stripping HTML
  return html.replace(/<[^>]*>?/gm, '').trim();
}
