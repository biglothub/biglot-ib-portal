import DOMPurify from 'dompurify';

/** Sanitize HTML to prevent XSS — allows safe formatting tags only */
export function sanitizeHtml(html: string): string {
	if (typeof window === 'undefined') return html;
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: [
			'strong', 'em', 'b', 'i', 'code', 'pre', 'br', 'p',
			'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'ul', 'ol', 'li',
			'table', 'thead', 'tbody', 'tr', 'th', 'td',
			'div', 'span', 'a', 'blockquote',
			'svg', 'path',
		],
		ALLOWED_ATTR: [
			'class', 'style', 'href', 'target', 'rel',
			'fill', 'viewBox', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd',
		],
	});
}
