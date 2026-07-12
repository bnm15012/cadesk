import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,        // data stays fresh for 30s — no refetch on navigation
        gcTime: 5 * 60_000,       // keep unused cache for 5 mins
        refetchOnWindowFocus: false, // don't refetch just because user switched tabs
        retry: 1,                 // retry failed requests once only
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
