import type { NewsItem } from './newsData';
import { sanitizeImageUrl } from '../utils/image';

const API_URL = import.meta.env.PUBLIC_API_URL || 'https://onlinepatinews.com/api';

/**
 * Online Pati News — CMS Service
 * Fetches data from the native Headless CMS (Hono + D1)
 */

export async function getPosts(perPage = 10, categoryId?: number): Promise<NewsItem[]> {
  const url = new URL(`${API_URL}/posts`);
  url.searchParams.append('per_page', perPage.toString());
  if (categoryId) {
    url.searchParams.append('categories', categoryId.toString());
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error(`CMS: Failed to fetch posts: ${response.statusText}`);
    return [];
  }

  const posts = await response.json();
  return posts.map(mapCMSPostToNewsItem);
}

export async function getPostBySlug(slug: string): Promise<NewsItem | null> {
  // The CMS supports fetching by slug at /api/posts/:slug
  const response = await fetch(`${API_URL}/posts/${slug}`);
  if (!response.ok) {
    console.error(`CMS: Failed to fetch post by slug (${slug}): ${response.statusText}`);
    return null;
  }

  const post = await response.json();
  if (!post || post.error) return null;

  return mapCMSPostToNewsItem(post);
}

export async function getCategories() {
  const response = await fetch(`${API_URL}/categories`);
  if (!response.ok) {
    console.error(`CMS: Failed to fetch categories: ${response.statusText}`);
    return [];
  }

  return await response.json();
}

export async function getPostsByCategorySlug(slug: string, perPage = 10): Promise<NewsItem[]> {
  // Use the optimized CMS route: /api/categories/:slug/posts
  const response = await fetch(`${API_URL}/categories/${encodeURIComponent(slug)}/posts?per_page=${perPage}`);
  if (!response.ok) {
    console.error(`CMS: Failed to fetch posts for category slug "${slug}": ${response.statusText}`);
    return [];
  }

  const posts = await response.json();
  return posts.map(mapCMSPostToNewsItem);
}

export async function searchPosts(query: string, perPage = 20): Promise<NewsItem[]> {
  // Search is not yet fully implemented in the new CMS, falling back to all posts or basic filtering
  // For now, we fetch all and let the UI handle it or implement search on backend
  const url = new URL(`${API_URL}/posts`);
  url.searchParams.append('per_page', perPage.toString());
  url.searchParams.append('search', query);

  const response = await fetch(url.toString());
  if (!response.ok) return [];
  
  const posts = await response.json();
  return posts.map(mapCMSPostToNewsItem);
}

/**
 * Maps the Native CMS payload to our NewsItem interface
 */
function mapCMSPostToNewsItem(post: any): NewsItem {
  // Extract categories (Handle native array of objects)
  const categories = post.categories || [];
  const categoryInfo = categories[0] || { name: 'समाचार', slug: 'news' };

  // Featured image is now direct
  let image = post.featured_image || '';
  
  // Sanitize image URL (remove Unsplash)
  image = sanitizeImageUrl(image);

  // Sanitize post content for embedded Unsplash images
  let content = post.content || '';
  if (content.includes('unsplash.com')) {
    content = content.replace(/https?:\/\/images\.unsplash\.com\/[^"']+/g, '/logo.png');
  }

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    image: image,
    category: categoryInfo.name,
    categorySlug: categoryInfo.slug,
    author: post.author || 'अनलाइनपाटी न्युज',
    date: formatDate(post.date),
    excerpt: stripHtml(post.excerpt || ''),
    content: content,
    dateIso: post.date,
    show_image: post.show_image === false || post.show_image === 0 ? false : true,
    caption: post.excerpt?.substring(0, 100)
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ne-NP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}
