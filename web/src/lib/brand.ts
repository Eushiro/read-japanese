import brandConfig from "../../../shared/brand.json";

export const BRAND = {
  name: brandConfig.name,
  nameLower: brandConfig.nameLower,
  domain: brandConfig.domain,
  url: `https://${brandConfig.domain}`,
  version: brandConfig.version,
  themeStorageKey: `${brandConfig.nameLower}-theme`,
  cachePrefix: `${brandConfig.nameLower}-`,
} as const;
