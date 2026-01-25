import type { Plugin } from "vite";

import brand from "../../shared/brand.json";

export function brandReplacePlugin(): Plugin {
  return {
    name: "brand-replace",
    transformIndexHtml(html: string) {
      return html
        .replace(/__BRAND_NAME__/g, brand.name)
        .replace(/__BRAND_THEME_KEY__/g, `${brand.nameLower}-theme`);
    },
  };
}
