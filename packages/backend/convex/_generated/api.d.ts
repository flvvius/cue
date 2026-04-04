/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiOps from "../aiOps.js";
import type * as aiPipeline from "../aiPipeline.js";
import type * as aiPipelinePayload from "../aiPipelinePayload.js";
import type * as alternatives from "../alternatives.js";
import type * as breaks from "../breaks.js";
import type * as dashboard from "../dashboard.js";
import type * as demoCompanion from "../demoCompanion.js";
import type * as demoData from "../demoData.js";
import type * as excludedApps from "../excludedApps.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as nudgeGeneration from "../nudgeGeneration.js";
import type * as nudgeRequests from "../nudgeRequests.js";
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
  aiOps: typeof aiOps;
  aiPipeline: typeof aiPipeline;
  aiPipelinePayload: typeof aiPipelinePayload;
  alternatives: typeof alternatives;
  breaks: typeof breaks;
  dashboard: typeof dashboard;
  demoCompanion: typeof demoCompanion;
  demoData: typeof demoData;
  excludedApps: typeof excludedApps;
  healthCheck: typeof healthCheck;
  http: typeof http;
  nudgeGeneration: typeof nudgeGeneration;
  nudgeRequests: typeof nudgeRequests;
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
