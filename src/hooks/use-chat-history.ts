import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/use-wallet";

export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: any | null;
}

// Owner key: prefer wallet address, fall back to a per-device anon id
function getOwnerKey(walletAddr: string | null): string {
  if (walletAddr) return `wallet:${walletAddr.toLowerCase()}`;
  let id = localStorage.getItem("ds_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ds_device_id", id);
  }
  return `device:${id}`;
}

// Inject the owner key into every PostgREST + Edge Function request so RLS
// policies (`current_owner_key()`) can verify ownership server-side.
function applyOwnerHeader(ownerKey: string) {
  const restAny = (supabase as any).rest;
  if (restAny?.headers) {
    restAny.headers["x-owner-key"] = ownerKey;
  }
  const fnAny = (supabase as any).functions;
  if (fnAny?.headers) {
    fnAny.headers["x-owner-key"] = ownerKey;
  } else if (fnAny?.setAuth) {
    // fallback no-op
  }
}

export function useChatHistory() {
  const { address } = useWallet();
  const ownerKey = getOwnerKey(address);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep the global supabase client headers in sync with the active owner key
  useEffect(() => {
    applyOwnerHeader(ownerKey);
  }, [ownerKey]);

  const refresh = useCallback(async () => {
    applyOwnerHeader(ownerKey);
    setLoading(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("owner_key", ownerKey)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (!error && data) setConversations(data);
    setLoading(false);
  }, [ownerKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const createConversation = useCallback(async (title = "New chat"): Promise<string | null> => {
    applyOwnerHeader(ownerKey);
    const { data, error } = await supabase
      .from("conversations")
      .insert({ owner_key: ownerKey, title })
      .select("id")
      .single();
    if (error) {
      console.error("[chat-history] createConversation error:", error.code, error.message, error.details);
      return null;
    }
    if (!data) return null;
    await refresh();
    return data.id;
  }, [ownerKey, refresh]);


  const renameConversation = useCallback(async (id: string, title: string) => {
    applyOwnerHeader(ownerKey);
    await supabase.from("conversations").update({ title }).eq("id", id).eq("owner_key", ownerKey);
    await refresh();
  }, [ownerKey, refresh]);

  const deleteConversation = useCallback(async (id: string) => {
    applyOwnerHeader(ownerKey);
    await supabase.from("conversations").delete().eq("id", id).eq("owner_key", ownerKey);
    await refresh();
  }, [ownerKey, refresh]);

  const loadMessages = useCallback(async (conversationId: string): Promise<StoredMessage[]> => {
    applyOwnerHeader(ownerKey);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, steps")
      .eq("conversation_id", conversationId)
      .eq("owner_key", ownerKey)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((d) => ({ id: d.id, role: d.role as "user" | "assistant", content: d.content, steps: d.steps }));
  }, [ownerKey]);

  const saveMessage = useCallback(async (
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    steps?: any,
  ) => {
    applyOwnerHeader(ownerKey);
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      owner_key: ownerKey,
      role,
      content,
      steps: steps ?? null,
    });
  }, [ownerKey]);

  return {
    ownerKey,
    conversations,
    loading,
    refresh,
    createConversation,
    renameConversation,
    deleteConversation,
    loadMessages,
    saveMessage,
  };
}
