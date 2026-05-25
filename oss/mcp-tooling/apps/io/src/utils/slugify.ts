export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function deriveToolName(
  operationId: string | undefined,
  method: string,
  path: string,
  tags?: string[]
): string {
  if (operationId) {
    return slugify(operationId);
  }

  const tag = tags && tags.length > 0 ? tags[0] + '_' : '';
  const pathParts = path
    .split('/')
    .filter(p => p && !p.startsWith('{'))
    .join('_');

  return slugify(`${tag}${method}_${pathParts}`);
}
