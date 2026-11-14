"use client";

import { useQuery } from "@tanstack/react-query";
import { getMeAfterLogin } from "./api";
import { authKeys } from "./keys";

export function useMe(uid: string | undefined) {
  return useQuery({
    queryKey: authKeys.me(uid ?? ""),
    queryFn: getMeAfterLogin,
    enabled: Boolean(uid),
    retry: false,
  });
}
