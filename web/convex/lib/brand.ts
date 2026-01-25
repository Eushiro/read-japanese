import brandConfig from "../../../shared/brand.json";

export const BRAND = {
  name: brandConfig.name,
  domain: brandConfig.domain,
  url: `https://${brandConfig.domain}`,
} as const;
