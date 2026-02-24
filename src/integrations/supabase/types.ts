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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaign_pieces: {
        Row: {
          campaign_id: string
          category: string
          code: number
          created_at: string
          id: string
          image_url: string | null
          name: string
          size: string
          store_category: string | null
        }
        Insert: {
          campaign_id: string
          category: string
          code: number
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          size: string
          store_category?: string | null
        }
        Update: {
          campaign_id?: string
          category?: string
          code?: number
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          size?: string
          store_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_pieces_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_store_pieces: {
        Row: {
          campaign_id: string
          id: string
          piece_id: string
          quantity: number
          store_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          piece_id: string
          quantity?: number
          store_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          piece_id?: string
          quantity?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_store_pieces_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_store_pieces_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "campaign_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_store_pieces_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      change_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: number
          new_value: number | null
          old_value: number | null
          piece_id: number | null
          store_id: number
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: number
          new_value?: number | null
          old_value?: number | null
          piece_id?: number | null
          store_id: number
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: number
          new_value?: number | null
          old_value?: number | null
          piece_id?: number | null
          store_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "change_logs_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stores: {
        Row: {
          city: string | null
          client_id: string
          cnpj: string | null
          complement: string | null
          country: string | null
          created_at: string
          custom_field_1: string | null
          custom_field_2: string | null
          custom_field_3: string | null
          custom_field_4: string | null
          custom_field_5: string | null
          id: string
          manager_name: string | null
          name: string
          neighborhood: string | null
          nickname: string | null
          number: string | null
          phone: string | null
          state: string | null
          state_registration: string | null
          store_code: string | null
          store_model: string | null
          street: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          client_id: string
          cnpj?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          custom_field_1?: string | null
          custom_field_2?: string | null
          custom_field_3?: string | null
          custom_field_4?: string | null
          custom_field_5?: string | null
          id?: string
          manager_name?: string | null
          name: string
          neighborhood?: string | null
          nickname?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          store_code?: string | null
          store_model?: string | null
          street?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          client_id?: string
          cnpj?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          custom_field_1?: string | null
          custom_field_2?: string | null
          custom_field_3?: string | null
          custom_field_4?: string | null
          custom_field_5?: string | null
          id?: string
          manager_name?: string | null
          name?: string
          neighborhood?: string | null
          nickname?: string | null
          number?: string | null
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          store_code?: string | null
          store_model?: string | null
          street?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_stores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          custom_field_1_label: string | null
          custom_field_2_label: string | null
          custom_field_3_label: string | null
          custom_field_4_label: string | null
          custom_field_5_label: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          custom_field_1_label?: string | null
          custom_field_2_label?: string | null
          custom_field_3_label?: string | null
          custom_field_4_label?: string | null
          custom_field_5_label?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          custom_field_1_label?: string | null
          custom_field_2_label?: string | null
          custom_field_3_label?: string | null
          custom_field_4_label?: string | null
          custom_field_5_label?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      permission_categories: {
        Row: {
          can_delete_campaigns: boolean
          can_delete_clients: boolean
          can_delete_pieces: boolean
          can_delete_stores: boolean
          can_edit_campaigns: boolean
          can_edit_clients: boolean
          can_edit_pieces: boolean
          can_edit_stores: boolean
          can_view_campaigns: boolean
          can_view_clients: boolean
          can_view_pieces: boolean
          can_view_stores: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          can_delete_campaigns?: boolean
          can_delete_clients?: boolean
          can_delete_pieces?: boolean
          can_delete_stores?: boolean
          can_edit_campaigns?: boolean
          can_edit_clients?: boolean
          can_edit_pieces?: boolean
          can_edit_stores?: boolean
          can_view_campaigns?: boolean
          can_view_clients?: boolean
          can_view_pieces?: boolean
          can_view_stores?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          can_delete_campaigns?: boolean
          can_delete_clients?: boolean
          can_delete_pieces?: boolean
          can_delete_stores?: boolean
          can_edit_campaigns?: boolean
          can_edit_clients?: boolean
          can_edit_pieces?: boolean
          can_edit_stores?: boolean
          can_view_campaigns?: boolean
          can_view_clients?: boolean
          can_view_pieces?: boolean
          can_view_stores?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pieces: {
        Row: {
          category: string
          code: number
          created_at: string
          id: number
          image_url: string | null
          name: string
          size: string
        }
        Insert: {
          category: string
          code: number
          created_at?: string
          id?: number
          image_url?: string | null
          name: string
          size: string
        }
        Update: {
          category?: string
          code?: number
          created_at?: string
          id?: number
          image_url?: string | null
          name?: string
          size?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_pieces: {
        Row: {
          id: number
          piece_id: number
          quantity: number
          store_id: number
        }
        Insert: {
          id?: number
          piece_id: number
          quantity?: number
          store_id: number
        }
        Update: {
          id?: number
          piece_id?: number
          quantity?: number
          store_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_pieces_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pieces_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          id: number
          model: string
          name: string
          number: number
          primary_mod: string
          secondary_mod: string
          type: string
          uf: string
        }
        Insert: {
          created_at?: string
          id?: number
          model: string
          name: string
          number: number
          primary_mod: string
          secondary_mod: string
          type: string
          uf: string
        }
        Update: {
          created_at?: string
          id?: number
          model?: string
          name?: string
          number?: number
          primary_mod?: string
          secondary_mod?: string
          type?: string
          uf?: string
        }
        Relationships: []
      }
      user_client_access: {
        Row: {
          can_edit: boolean
          category_id: string | null
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          category_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          category_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "permission_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_category_permission: {
        Args: { _client_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
      has_client_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_client_edit_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
    Enums: {
      app_role: ["admin", "viewer"],
    },
  },
} as const
