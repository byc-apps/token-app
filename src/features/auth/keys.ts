export const authKeys = {
  all: ["auth"] as const,
  me: (uid: string) => [...authKeys.all, "me", uid] as const,
};
