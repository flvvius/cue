/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alternatives from "../alternatives.js";
import type * as dashboard from "../dashboard.js";
import type * as excludedApps from "../excludedApps.js";
import type * as healthCheck from "../healthCheck.js";
import type * as nudges from "../nudges.js";
import type * as privateData from "../privateData.js";
import type * as recommendations from "../recommendations.js";
import type * as usageSessions from "../usageSessions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alternatives: typeof alternatives;
  dashboard: typeof dashboard;
  excludedApps: typeof excludedApps;
  healthCheck: typeof healthCheck;
  nudges: typeof nudges;
  privateData: typeof privateData;
  recommendations: typeof recommendations;
  usageSessions: typeof usageSessions;
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
