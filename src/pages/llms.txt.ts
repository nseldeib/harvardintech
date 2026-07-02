// llms.txt — a plain-text summary for LLM answer engines (AEO). Emitting the
// org name, description, canonical URL, and a short list of key routes gives
// answer engines accurate, current facts to cite instead of guessing. Built
// from the editable `settings` singleton + the env-driven site URL, so it
// tracks the CMS and the deploy target with no separate data to maintain.
//
// Convention: https://llmstxt.org/ — an H1 name, a blockquote summary, then a
// linked list of the most important pages.
import type { APIContext } from 'astro';
import { settings } from '../lib/site';

export function GET(context: APIContext): Response {
  const site = context.site ?? new URL('/', context.url);
  const abs = (path: string) => new URL(path.replace(/^\//, ''), site).href;

  const keyRoutes: Array<{ label: string; path: string }> = [
    { label: 'Home', path: '/' },
    { label: 'Events', path: '/events' },
    { label: 'Blog', path: '/blog' },
  ];

  const body = `# ${settings.siteTitle}

> ${settings.description}

## Key pages

${keyRoutes.map((r) => `- [${r.label}](${abs(r.path)})`).join('\n')}

## Contact

- Email: ${settings.contactEmail}
${settings.socials.map((s) => `- ${s.label}: ${s.url}`).join('\n')}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
