export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_settings: {
        Row: {
          account_balance_usd: number
          created_at: string
          daily_trade_limit: number
          enabled: boolean
          id: string
          leverage: number
          market: string
          max_position_pct: number
          min_confidence: number
          owner_key: string
          updated_at: string
          volatility_circuit_breaker: number
        }
        Insert: {
          account_balance_usd?: number
          created_at?: string
          daily_trade_limit?: number
          enabled?: boolean
          id?: string
          leverage?: number
          market?: string
          max_position_pct?: number
          min_confidence?: number
          owner_key: string
          updated_at?: string
          volatility_circuit_breaker?: number
        }
        Update: {
          account_balance_usd?: number
          created_at?: string
          daily_trade_limit?: number
          enabled?: boolean
          id?: string
          leverage?: number
          market?: string
          max_position_pct?: number
          min_confidence?: number
          owner_key?: string
          updated_at?: string
          volatility_circuit_breaker?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          owner_key: string
          role: string
          steps: Json | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          owner_key: string
          role: string
          steps?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          owner_key?: string
          role?: string
          steps?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          owner_key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_key: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          asset: string
          closed_at: string | null
          entry_price: number
          id: string
          market: string
          opened_at: string
          owner_key: string
          pnl_usd: number
          side: string
          size: number
          status: string
          stop_loss: number | null
          target: number | null
        }
        Insert: {
          asset: string
          closed_at?: string | null
          entry_price: number
          id?: string
          market: string
          opened_at?: string
          owner_key: string
          pnl_usd?: number
          side: string
          size: number
          status?: string
          stop_loss?: number | null
          target?: number | null
        }
        Update: {
          asset?: string
          closed_at?: string | null
          entry_price?: number
          id?: string
          market?: string
          opened_at?: string
          owner_key?: string
          pnl_usd?: number
          side?: string
          size?: number
          status?: string
          stop_loss?: number | null
          target?: number | null
        }
        Relationships: []
      }
      risk_events: {
        Row: {
          asset: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          owner_key: string
          reason: string
        }
        Insert: {
          asset?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          owner_key: string
          reason: string
        }
        Update: {
          asset?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          owner_key?: string
          reason?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          asset: string
          confidence: number
          conviction: string
          created_at: string
          drivers: Json
          id: string
          market: string
          owner_key: string
          price: number | null
          reasoning: string
          side: string
          source: Json | null
          status: string
          stop_loss: number | null
          target: number | null
        }
        Insert: {
          asset: string
          confidence: number
          conviction: string
          created_at?: string
          drivers?: Json
          id?: string
          market: string
          owner_key: string
          price?: number | null
          reasoning: string
          side: string
          source?: Json | null
          status?: string
          stop_loss?: number | null
          target?: number | null
        }
        Update: {
          asset?: string
          confidence?: number
          conviction?: string
          created_at?: string
          drivers?: Json
          id?: string
          market?: string
          owner_key?: string
          price?: number | null
          reasoning?: string
          side?: string
          source?: Json | null
          status?: string
          stop_loss?: number | null
          target?: number | null
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset: string
          created_at: string
          error: string | null
          id: string
          market: string
          nonce: number | null
          owner_key: string
          payload_hash: string | null
          price: number | null
          side: string
          signal_id: string | null
          size: number
          sodex_order_id: string | null
          sodex_response: Json | null
          status: string
        }
        Insert: {
          asset: string
          created_at?: string
          error?: string | null
          id?: string
          market: string
          nonce?: number | null
          owner_key: string
          payload_hash?: string | null
          price?: number | null
          side: string
          signal_id?: string | null
          size: number
          sodex_order_id?: string | null
          sodex_response?: Json | null
          status: string
        }
        Update: {
          asset?: string
          created_at?: string
          error?: string | null
          id?: string
          market?: string
          nonce?: number | null
          owner_key?: string
          payload_hash?: string | null
          price?: number | null
          side?: string
          signal_id?: string | null
          size?: number
          sodex_order_id?: string | null
          sodex_response?: Json | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_owner_key: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
