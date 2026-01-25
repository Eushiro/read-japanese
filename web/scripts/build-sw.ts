import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import brand from "../../shared/brand.json";

const __dirname = import.meta.dirname;

const template = readFileSync(resolve(__dirname, "../public/sw.template.js"), "utf-8");
const output = template
  .replace(/__BRAND_NAME__/g, brand.name)
  .replace(/__BRAND_CACHE_NAME__/g, `${brand.nameLower}-media-v1`)
  .replace(/__BRAND_CACHE_PREFIX__/g, `${brand.nameLower}-`);

writeFileSync(resolve(__dirname, "../public/sw.js"), output);
console.log("Built sw.js with brand:", brand.name);
