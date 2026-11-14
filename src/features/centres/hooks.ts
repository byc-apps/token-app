"use client";

import { useQuery } from "@tanstack/react-query";
import { getCentres } from "./api";
import { centreKeys } from "./keys";

export function useCentres(enabled = true) {
  return useQuery({
    queryKey: centreKeys.list(),
    queryFn: getCentres,
    enabled,
  });
}
