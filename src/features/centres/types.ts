import type { CentreConfig, CentreDoc, ListItem } from "@shared/schemas";

export interface CentreListItem {
  id: string;
  name: string;
  code: string;
  kind: CentreDoc["kind"];
  tokenPrefix: string;
  location: string | null;
  confidential: boolean;
  allowOther: boolean;
  services: { id: string; name: string; active?: boolean }[];
  active?: boolean;
  config?: CentreConfig;
  counters?: ListItem[];
}

export type CentresResponse = { centres: CentreListItem[] };
