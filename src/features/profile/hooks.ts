"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/features/auth";
import { completeProfile, getDepartments, getSettings, updateEmailPrefs, updateMobile } from "./api";
import { profileKeys } from "./keys";

export function useSettings() {
  return useQuery({ queryKey: profileKeys.settings(), queryFn: getSettings });
}

export function useDepartments() {
  return useQuery({ queryKey: profileKeys.departments(), queryFn: getDepartments });
}

export function useCompleteProfile(uid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeProfile,
    onSuccess: ({ user }) => queryClient.setQueryData(authKeys.me(uid), { user }),
  });
}

export function useUpdateMobile(uid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMobile,
    onSuccess: ({ user }) => queryClient.setQueryData(authKeys.me(uid), { user }),
  });
}

export function useUpdateEmailPrefs(uid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateEmailPrefs,
    onSuccess: ({ user }) => queryClient.setQueryData(authKeys.me(uid), { user }),
  });
}
