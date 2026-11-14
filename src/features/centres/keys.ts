export const centreKeys = {
  all: ["centres"] as const,
  list: () => [...centreKeys.all, "list"] as const,
};
