"use client";

import { useRouter } from "next/navigation";
import { useEnokiFlow } from "@mysten/enoki/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Signs the user out of Enoki, clears local session markers, and returns to
 * the landing page so a different account can sign in.
 */
export function LogoutButton() {
  const flow = useEnokiFlow();
  const router = useRouter();

  async function handleLogout() {
    try {
      await flow.logout();
    } catch (err) {
      console.warn("Enoki logout warning:", err);
    }
    // Clear any local markers we set after sign-in.
    sessionStorage.removeItem("mnemo_authed");
    router.push("/");
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      <LogOut className="w-4 h-4 mr-1.5" />
      Sign out
    </Button>
  );
}