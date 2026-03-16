import { describe, expect, it } from 'vitest';

import {
  implementedToolDefinitions,
  toolNavigationGroups,
} from '~/tools/catalog/definitions';

describe('tool definitions', () => {
  it('uses unique ids, slugs, and top-level paths', () => {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    const paths = new Set<string>();

    for (const tool of implementedToolDefinitions) {
      expect(tool.path.startsWith('/')).toBe(true);
      expect(tool.path.startsWith('/tools/')).toBe(false);
      expect(ids.has(tool.id)).toBe(false);
      expect(slugs.has(tool.slug)).toBe(false);
      expect(paths.has(tool.path)).toBe(false);
      ids.add(tool.id);
      slugs.add(tool.slug);
      paths.add(tool.path);
    }
  });

  it('only contains available tools across the expected navigation groups', () => {
    expect(implementedToolDefinitions).toHaveLength(6);
    expect(new Set(implementedToolDefinitions.map((tool) => tool.availability))).toEqual(
      new Set(['available']),
    );
    expect(
      new Set(implementedToolDefinitions.map((tool) => tool.navGroup)),
    ).toEqual(new Set(toolNavigationGroups));
  });
});
