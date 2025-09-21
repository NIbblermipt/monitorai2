import { createDirectus, rest, staticToken } from "@directus/sdk";
import { components } from "./schema";
import "@dotenvx/dotenvx/config";

if (!process.env.DIRECTUS_URL) {
  throw new Error("DIRECTUS_URL is not defined");
}

if (!process.env.DIRECTUS_TOKEN) {
  throw new Error("DIRECTUS_TOKEN is not defined");
}

interface Schema {
  video_screens: components["schemas"]["ItemsVideoScreens"][];
  pings: components["schemas"]["ItemsPings"][];
  companies: components["schemas"]["ItemsCompanies"][];
  deductions: components["schemas"]["ItemsDeductions"][];
  reports: components["schemas"]["ItemsReports"][];
  directus_users: components["schemas"]["Users"][];
  holdings: components["schemas"]["ItemsHoldings"][];
}

export const client = createDirectus<Schema>(process.env.DIRECTUS_URL)
  .with(staticToken(process.env.DIRECTUS_TOKEN))
  .with(rest());
export default client;
