// Pure comparison rules for "is every piece of content editable in the CMS?"
//
// Three files describe the same content and must not drift apart:
//   • `src/content/config.ts`      — the Zod schemas Astro validates against
//   • `src/data/collections.json`  — the inputs @codeyam/cms renders in /admin
//   • `src/data/*Page.json`        — the committed singletons the site falls
//                                    back to when a CMS entry is blank
//
// These functions compare them pairwise. They live here rather than inside
// `src/data/collections.test.ts` — where they were written and where they sat
// for as long as one test was the only caller — because a SECOND guard now needs
// them, and the alternative to extracting them is a second copy. Two
// implementations of one rule is how one of them quietly stops matching the
// other, which is the exact failure mode this whole module exists to catch.
//
// No `fs`, no Astro imports, no JSON reads: the callers supply the sources as
// strings and parsed objects, so every rule here unit-tests directly.

/** One field as `collections.json` declares it. */
export interface RegistryField {
  name: string;
  type: string;
  fields?: RegistryField[];
  // The presentation half of a field definition. The drift checks do not need it
  // — they compare names — but a field's label and hint are its usability, and
  // some guards assert them directly.
  label?: string;
  optional?: boolean;
  hint?: string;
}

/**
 * The top-level frontmatter keys a registry field list declares.
 *
 * A `list`'s sub-fields are row keys INSIDE the array value, not frontmatter
 * keys of their own, so they are deliberately excluded — counting them would
 * make `donorTiers`'s `id`/`name`/`description` look like three missing
 * top-level schema keys.
 */
export function declaredFieldNames(fields: RegistryField[]): string[] {
  return fields.map((f) => f.name);
}

/**
 * Registry-declared keys with no counterpart in the content schema.
 *
 * The DANGEROUS direction: the CMS renders the input, an editor fills it in, and
 * the build then rejects the entry against the Zod schema — so the failure lands
 * on a deploy rather than on the person who added the field.
 */
export function unknownFields(fields: RegistryField[], schemaKeys: string[]): string[] {
  const known = new Set(schemaKeys);
  return declaredFieldNames(fields).filter((name) => !known.has(name));
}

/**
 * Schema keys the editor renders no input for.
 *
 * The QUIET direction, and the one that costs nothing until someone needs it:
 * the key renders on the site and validates fine, but it is absent from /admin,
 * so an editor can neither set it nor learn it exists. `exempt` names the keys
 * that legitimately have no input.
 */
export function missingFields(
  schemaKeys: string[],
  editorFieldNames: string[],
  exempt: string[] = [],
): string[] {
  const rendered = new Set(editorFieldNames);
  const skip = new Set(exempt);
  return schemaKeys.filter((key) => !rendered.has(key) && !skip.has(key));
}

/**
 * Keys of a committed JSON singleton that the CMS renders no input for.
 *
 * The THIRD direction, and the one nothing checked until the Momentum Network
 * shipped its entire copy surface — heading, tagline, search label, share
 * message — readable only in `donatePage.json`. The two checks above compare
 * COLLECTIONS to SCHEMAS and structurally cannot see a singleton, because a
 * singleton is not a collection: it is the fallback `pageCopyMerge` reads when a
 * CMS entry's box is blank. A key that lives only there is live on the site and
 * editable by nobody.
 *
 * `retired` is the escape hatch and it is meant to sting slightly: naming a key
 * there is a claim that no visitor can see it, so each entry wants a comment
 * saying why. `donorsIntro` is the honest example — the donor wall that rendered
 * it is no longer mounted on any page, so giving it an editor box would be worse
 * than leaving it out.
 */
export function singletonKeysWithoutEditor(
  singletonKeys: string[],
  editorFieldNames: string[],
  retired: string[] = [],
): string[] {
  return missingFields(singletonKeys, editorFieldNames, retired);
}

/**
 * Strip `//` line comments so prose colons inside them are never read as schema
 * keys. The `[^:]` guard leaves `https://` inside string literals alone.
 *
 * Block comments are deliberately NOT stripped. Every collection's loader
 * carries a recursive markdown glob, and that glob's text contains both a
 * block-comment opener and, one loader line later, a closer — so a naive
 * block-comment regex matches from one loader to the next and eats the entire
 * collection schema between them. That is exactly how the built-in collections
 * first came back with zero keys. The content config uses only line comments, so
 * stripping just those is sufficient and cannot silently delete a collection.
 */
export function stripComments(source: string): string {
  return source.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Top-level keys of one collection's `z.object({...})` in the content config
 * source.
 *
 * Walks brace depth so a nested shape — a `z.array(z.object({...}))` row like
 * `stats` or `donorTiers` — contributes none of its own keys. Returns `[]` for a
 * collection that is not declared, which callers treat as a failure rather than
 * an empty pass: every collection the editor renders must be declared somewhere.
 */
export function schemaKeysFor(source: string, collection: string): string[] {
  const src = stripComments(source);
  const declIdx = src.indexOf(`const ${collection} = defineCollection(`);
  if (declIdx === -1) return [];
  const objIdx = src.indexOf('z.object({', declIdx);
  if (objIdx === -1) return [];

  const start = src.indexOf('{', objIdx + 'z.object'.length);
  const keys: string[] = [];
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    } else if (depth === 1 && /[A-Za-z_$]/.test(ch)) {
      const match = /^([A-Za-z0-9_$]+)\s*:/.exec(src.slice(i));
      if (match) {
        keys.push(match[1]);
        i += match[1].length;
      }
    }
  }
  return keys;
}
