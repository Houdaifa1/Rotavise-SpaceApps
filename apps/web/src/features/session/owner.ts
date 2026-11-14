import { ownerSessionSchema } from "@rotavise/contracts";
import type { z } from "zod";
import type { Account } from "../../api/account.js";
import { ApiFailure } from "../../app/http.js";

export type GuestSession = z.infer<typeof ownerSessionSchema>;
export const guestKey = "rotavise.guest.v1";
type OwnerState = {
  account: Account | null | undefined;
  guest: GuestSession | null;
  recovered: boolean;
  signInRequired: boolean;
  scope: number;
};
export class Owner {
  private state: OwnerState;
  private listeners = new Set<() => void>();
  private creating: Promise<GuestSession> | undefined;
  constructor(
    private readonly storage?: Pick<
      Storage,
      "getItem" | "setItem" | "removeItem"
    >,
  ) {
    let guest: GuestSession | null = null;
    try {
      const raw = storage?.getItem(guestKey);
      const parsed = raw ? ownerSessionSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success && Date.parse(parsed.data.expiresAt) > Date.now())
        guest = parsed.data;
    } catch {
      /* Storage can be unavailable in private browsing. Memory still works. */
    }
    this.state = {
      account: undefined,
      guest,
      recovered: false,
      signInRequired: false,
      scope: 0,
    };
  }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<OwnerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  setAccount = (account: Account | null | undefined) =>
    this.update({
      account,
      signInRequired: false,
      scope:
        account?.id !== this.state.account?.id
          ? this.state.scope + 1
          : this.state.scope,
    });
  saveGuest(guest: GuestSession | null) {
    this.update({
      guest,
      scope:
        guest?.accessToken !== this.state.guest?.accessToken
          ? this.state.scope + 1
          : this.state.scope,
    });
    try {
      if (guest) this.storage?.setItem(guestKey, JSON.stringify(guest));
      else this.storage?.removeItem(guestKey);
    } catch {
      /* Keep the in-memory session. */
    }
  }
  async ensureGuest(create: () => Promise<GuestSession>) {
    if (this.state.guest && Date.parse(this.state.guest.expiresAt) > Date.now())
      return this.state.guest;
    if (!this.creating)
      this.creating = create()
        .then((session) => {
          this.saveGuest(session);
          return session;
        })
        .finally(() => {
          this.creating = undefined;
        });
    return this.creating;
  }
  async refreshGuest(
    rejectedToken: string,
    create: () => Promise<GuestSession>,
  ) {
    if (this.state.guest?.accessToken === rejectedToken) this.saveGuest(null);
    this.update({ recovered: true });
    return this.ensureGuest(create);
  }
  requireSignIn() {
    this.update({ signInRequired: true });
  }
  assertChecked() {
    if (this.state.account === undefined)
      throw new ApiFailure(0, "AUTH_UNAVAILABLE");
  }
}
let browserOwner: Owner | undefined;
export function getOwner() {
  if (!browserOwner) {
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {
      /* Memory-only mode. */
    }
    browserOwner = new Owner(storage);
  }
  return browserOwner;
}
