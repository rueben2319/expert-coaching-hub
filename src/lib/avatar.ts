import { supabase } from "@/integrations/supabase/client";

export const AVATAR_PUBLIC_PATH_SEGMENT = "/storage/v1/object/public/avatars/";

export const isValidAvatarPublicUrl = (value?: string | null): value is string => {
  if (!value || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.pathname.includes(AVATAR_PUBLIC_PATH_SEGMENT);
  } catch {
    return false;
  }
};

export const isAvatarStorageKey = (value?: string | null): value is string => {
  if (!value || !value.trim()) {
    return false;
  }

  return !value.startsWith("http://")
    && !value.startsWith("https://")
    && !value.startsWith("data:")
    && !value.startsWith("blob:")
    && value.includes("/");
};

export const resolveAvatarUrl = (value?: string | null): string | undefined => {
  if (!value || !value.trim()) {
    return undefined;
  }

  if (isValidAvatarPublicUrl(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }

  if (isAvatarStorageKey(value)) {
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(value);
    return publicUrl;
  }

  return value;
};

export const isAvatarUrlReachable = async (value?: string | null): Promise<boolean | null> => {
  const resolvedUrl = resolveAvatarUrl(value);
  if (!resolvedUrl) {
    return false;
  }

  try {
    const response = await fetch(resolvedUrl, { method: "HEAD" });
    if (response.status === 400 || response.status === 404) {
      return false;
    }

    return response.ok;
  } catch {
    return null;
  }
};
