"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { EnokiFlowProvider } from "@mysten/enoki/react";
import { SuiClientProvider, createNetworkConfig } from "@mysten/dapp-kit";
import RouteTransition from "@/components/RouteTransition";
import SocialsButton from "@/components/SocialsButton";

const { networkConfig } = createNetworkConfig({
  testnet: { url: "https://fullnode.testnet.sui.io:443" },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <EnokiFlowProvider apiKey={process.env.NEXT_PUBLIC_ENOKI_API_KEY!}>
          {children}
          <RouteTransition />
          <SocialsButton />
        </EnokiFlowProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}