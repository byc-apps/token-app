export const profileKeys = {
  all: ["profile"] as const,
  settings: () => [...profileKeys.all, "settings"] as const,
  departments: () => [...profileKeys.all, "departments"] as const,
};
