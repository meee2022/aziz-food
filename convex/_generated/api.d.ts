/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as backup from "../backup.js";
import type * as categories from "../categories.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as expenses from "../expenses.js";
import type * as hash from "../hash.js";
import type * as helpers from "../helpers.js";
import type * as invoices from "../invoices.js";
import type * as items from "../items.js";
import type * as notify from "../notify.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as priceLists from "../priceLists.js";
import type * as prices from "../prices.js";
import type * as purchases from "../purchases.js";
import type * as reports from "../reports.js";
import type * as returns from "../returns.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  audit: typeof audit;
  auth: typeof auth;
  backup: typeof backup;
  categories: typeof categories;
  customers: typeof customers;
  dashboard: typeof dashboard;
  expenses: typeof expenses;
  hash: typeof hash;
  helpers: typeof helpers;
  invoices: typeof invoices;
  items: typeof items;
  notify: typeof notify;
  orders: typeof orders;
  payments: typeof payments;
  priceLists: typeof priceLists;
  prices: typeof prices;
  purchases: typeof purchases;
  reports: typeof reports;
  returns: typeof returns;
  seed: typeof seed;
  settings: typeof settings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
