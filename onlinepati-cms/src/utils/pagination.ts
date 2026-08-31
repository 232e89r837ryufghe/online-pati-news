/**
 * Pagination helper utilities
 */

export interface PaginationParams {
  page: number;
  perPage: number;
  offset: number;
}

export function parsePagination(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '10', 10)));
  const offset = (page - 1) * perPage;

  return { page, perPage, offset };
}

export function setPaginationHeaders(
  headers: Headers,
  total: number,
  params: PaginationParams
): void {
  const totalPages = Math.ceil(total / params.perPage);
  headers.set('X-CMS-Total', total.toString());
  headers.set('X-CMS-TotalPages', totalPages.toString());
}
