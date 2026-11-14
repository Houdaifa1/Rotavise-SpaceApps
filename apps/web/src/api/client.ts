import type { z } from "zod";
import { ownerSessionSchema } from "@rotavise/contracts";
import { api, apiEmpty, ApiFailure, type HttpOptions } from "../app/http.js";
import { Owner, getOwner } from "../features/session/owner.js";

export type Access = "none" | "owner" | "account" | "guest" | "both";
export class ApiClient {
  constructor(readonly owner: Owner) {}
  private createGuest = () =>
    api("/api/v1/plan-sessions", ownerSessionSchema, {
      method: "POST",
      body: {},
      credentials: "omit",
    });
  private async options(
    access: Access,
    options: HttpOptions,
  ): Promise<HttpOptions> {
    if (access === "none") return { ...options, credentials: "omit" };
    if (access === "account") return { ...options, credentials: "same-origin" };
    this.owner.assertChecked();
    if (access === "both") {
      const guest = this.owner.snapshot().guest;
      if (!guest || !this.owner.snapshot().account)
        throw new ApiFailure(401, "UNAUTHORIZED");
      return {
        ...options,
        credentials: "same-origin",
        headers: {
          ...options.headers,
          Authorization: `Bearer ${guest.accessToken}`,
        },
      };
    }
    if (access === "owner" && this.owner.snapshot().account)
      return { ...options, credentials: "same-origin" };
    const guest = await this.owner.ensureGuest(this.createGuest);
    return {
      ...options,
      credentials: "omit",
      headers: {
        ...options.headers,
        Authorization: `Bearer ${guest.accessToken}`,
      },
    };
  }
  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: HttpOptions & { access: Access },
  ): Promise<T>;
  async request(
    path: string,
    schema: null,
    options: HttpOptions & { access: Access },
  ): Promise<void>;
  async request<T>(
    path: string,
    schema: z.ZodType<T> | null,
    options: HttpOptions & { access: Access },
  ): Promise<T | void> {
    const execute = (value: HttpOptions) =>
      schema
        ? api(path, schema, value)
        : apiEmpty(path, { ...value, emptyStatuses: [204] });
    const first = await this.options(options.access, options);
    try {
      return await execute(first);
    } catch (error) {
      const bearer = first.headers?.Authorization;
      if (
        error instanceof ApiFailure &&
        error.code === "UNAUTHORIZED" &&
        !bearer &&
        options.access === "owner" &&
        this.owner.snapshot().account
      ) {
        this.owner.setAccount(undefined);
        this.owner.requireSignIn();
      }
      if (
        !(error instanceof ApiFailure) ||
        error.code !== "UNAUTHORIZED" ||
        !bearer ||
        options.access === "both"
      )
        throw error;
      await this.owner.refreshGuest(bearer.slice(7), this.createGuest);
      try {
        return await execute(await this.options(options.access, options));
      } catch (second) {
        if (second instanceof ApiFailure && second.code === "UNAUTHORIZED")
          this.owner.requireSignIn();
        throw second;
      }
    }
  }
}
let client: ApiClient | undefined;
export function getApiClient() {
  return (client ??= new ApiClient(getOwner()));
}
