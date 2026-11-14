import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryCache,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiClient } from "../../api/client.js";
import { getOwner } from "../../features/session/owner.js";
import { I18nProvider, useMessages } from "../../i18n/messages.js";
import { getCapabilities, getReady, getLive } from "../../api/capabilities.js";
import { getAccount } from "../../api/account.js";
import { getCatalogOptions } from "../../api/catalog.js";
import { getGlossary } from "../../api/glossary.js";
import { keys, stale } from "../../api/keys.js";
import { ApiFailure, observeNetwork, networkFailureCount } from "../http.js";
import { Toast } from "../../design/primitives/feedback.js";

const ClientContext = createContext<ApiClient | null>(null);
export function useApi() {
  const client = useContext(ClientContext);
  if (!client) throw new Error("API provider missing");
  return client;
}
export function useSession() {
  const { owner } = useApi();
  const state = useSyncExternalStore(owner.subscribe, owner.snapshot);
  const query = useQueryClient();
  const setAccount = useMemo(
    () => (account: typeof state.account) => {
      owner.setAccount(account);
      query.setQueryData(keys.account, account);
    },
    [owner, query],
  );
  return { ...state, setAccount };
}
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new ApiClient(getOwner()));
  const [query] = useState(() => createQueryClient());
  return (
    <I18nProvider>
      <QueryClientProvider client={query}>
        <ClientContext.Provider value={client}>
          <OwnerCache />
          <ToastProvider>{children}</ToastProvider>
        </ClientContext.Provider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
export function createQueryClient() {
  const query = new QueryClient({
    queryCache: new QueryCache({
      onSuccess(data, resource) {
        const [visibility, scope, kind, field] = resource.queryKey;
        if (
          visibility === "private" &&
          (kind === "observation" || kind === "extraction") &&
          data &&
          typeof data === "object" &&
          "status" in data &&
          data.status === "completed"
        )
          void query.invalidateQueries({
            queryKey: ["private", scope, "analysis", field],
          });
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        networkMode: "always",
        gcTime: 86_400_000,
      },
      mutations: { retry: false, networkMode: "always" },
    },
  });
  return query;
}
function OwnerCache() {
  const { scope } = useSession();
  const query = useQueryClient();
  const previous = useRef(scope);
  useEffect(() => {
    if (previous.current !== scope) {
      void query.cancelQueries({ queryKey: ["private", previous.current] });
      query.removeQueries({ queryKey: ["private", previous.current] });
      previous.current = scope;
    }
  }, [scope, query]);
  return null;
}
export function useOffline() {
  const [offline, setOffline] = useState(
    () => !navigator.onLine || networkFailureCount() >= 2,
  );
  useEffect(() => {
    let failures = networkFailureCount();
    const online = () => {
      failures = 0;
      setOffline(false);
    };
    const off = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    const unsubscribe = observeNetwork((available) => {
      failures = available ? 0 : failures + 1;
      if (failures >= 2 || !navigator.onLine) setOffline(true);
      else if (available) setOffline(false);
    });
    return () => {
      unsubscribe();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
    };
  }, []);
  return offline;
}
const DismissToastContext = createContext<() => void>(() => {});
export const useDismissToast = () => useContext(DismissToastContext);
const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(
    null,
  );
  const dismiss = useMemo(() => () => setToast(null), []);
  return (
    <DismissToastContext.Provider value={dismiss}>
      <ToastContext.Provider
        value={(message) => setToast({ message, id: Date.now() })}
      >
        {children}
        <div
          className="f1-toast-region"
          role="log"
          aria-label={useMessages().t("feedback")}
          aria-live="polite"
        >
          {toast && (
            <Toast key={toast.id} message={toast.message} onDismiss={dismiss} />
          )}
        </div>
      </ToastContext.Provider>
    </DismissToastContext.Provider>
  );
}
async function bounded<T>(
  signal: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
) {
  const timeout = AbortSignal.timeout(4000);
  try {
    return await run(AbortSignal.any([signal, timeout]));
  } catch (error) {
    if (timeout.aborted && !signal.aborted)
      throw new ApiFailure(0, "NETWORK_UNAVAILABLE");
    throw error;
  }
}
export function useBootQueries() {
  const client = useApi();
  const { language } = useMessages();
  const health = useQuery({
    queryKey: keys.health,
    queryFn: ({ signal }) =>
      bounded(signal, (s) => getLive(client, { signal: s })),
    staleTime: 30_000,
  });
  const readiness = useQuery({
    queryKey: [...keys.health, "readiness"],
    queryFn: ({ signal }) =>
      bounded(signal, (s) => getReady(client, { signal: s })),
    enabled: false,
    staleTime: 30_000,
  });
  const capabilities = useQuery({
    queryKey: keys.capabilities,
    queryFn: ({ signal }) =>
      bounded(signal, (s) => getCapabilities(client, { signal: s })),
    staleTime: 30_000,
  });
  const accountEnabled = !!(
    capabilities.data?.auth.email || capabilities.data?.auth.google
  );
  const account = useQuery({
    enabled: capabilities.isSuccess,
    queryKey: keys.account,
    queryFn: ({ signal }) =>
      bounded(signal, async (s) => {
        if (!accountEnabled) return null;
        try {
          return await getAccount(client, { signal: s });
        } catch (error) {
          if (error instanceof ApiFailure && [401, 404].includes(error.status))
            return null;
          throw error;
        }
      }),
    staleTime: 30_000,
  });
  const catalog = useQuery({
    // Lazy map tabs can read catalog data after the boot request has settled.
    // Notify the context even when no mounted consumer has tracked data yet.
    notifyOnChangeProps: "all",
    queryKey: keys.catalog(),
    queryFn: ({ signal }) =>
      bounded(signal, (s) => getCatalogOptions(client, { signal: s })),
    staleTime: stale.catalog,
  });
  const glossary = useGlossaryQuery();
  useEffect(() => {
    client.owner.setAccount(
      !accountEnabled && capabilities.data
        ? null
        : account.isError
          ? undefined
          : account.data,
    );
  }, [
    account.data,
    account.isError,
    client,
    accountEnabled,
    capabilities.data,
  ]);
  return {
    health,
    readiness,
    capabilities,
    account,
    catalog,
    glossary,
    language,
  };
}
export function useGlossaryQuery() {
  const client = useApi();
  const { language } = useMessages();
  return useQuery({
    notifyOnChangeProps: "all",
    queryKey: keys.glossary(language),
    queryFn: ({ signal }) =>
      bounded(signal, (s) =>
        getGlossary(client, { query: { lang: language }, signal: s }),
      ),
    staleTime: stale.glossary,
  });
}
type Boot = ReturnType<typeof useBootQueries>;
const BootContext = createContext<Boot | null>(null);
export const BootProvider = BootContext.Provider;
export function useBoot() {
  const value = useContext(BootContext);
  if (!value) throw new Error("Boot provider missing");
  return value;
}
