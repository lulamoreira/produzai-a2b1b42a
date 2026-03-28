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
      agencies: {
        Row: {
          color: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      campaign_budget_items: {
        Row: {
          budget_id: string
          created_at: string
          display_order: number
          id: string
          item_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          budget_id: string
          created_at?: string
          display_order?: number
          id?: string
          item_name: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          budget_id?: string
          created_at?: string
          display_order?: number
          id?: string
          item_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "campaign_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_budgets: {
        Row: {
          campaign_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          quotation_id: string | null
          supplier_name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          quotation_id?: string | null
          supplier_name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          quotation_id?: string | null
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_budgets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_budgets_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "campaign_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_kit_pieces: {
        Row: {
          created_at: string
          id: string
          kit_id: string
          piece_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          kit_id: string
          piece_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          kit_id?: string
          piece_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_kit_pieces_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "campaign_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_kit_pieces_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "campaign_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_kits: {
        Row: {
          campaign_id: string
          code: number
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_mockup: boolean
          name: string
        }
        Insert: {
          campaign_id: string
          code: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_mockup?: boolean
          name: string
        }
        Update: {
          campaign_id?: string
          code?: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_mockup?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_kits_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_notification_emails: {
        Row: {
          campaign_id: string
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_notification_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_piece_locations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_piece_locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_pieces: {
        Row: {
          campaign_id: string
          category: string
          code: number
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          installation_instructions: string
          is_mockup: boolean
          kit_only: boolean
          name: string
          size: string
          specification: string
          store_category: string | null
        }
        Insert: {
          campaign_id: string
          category: string
          code: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          installation_instructions?: string
          is_mockup?: boolean
          kit_only?: boolean
          name: string
          size: string
          specification?: string
          store_category?: string | null
        }
        Update: {
          campaign_id?: string
          category?: string
          code?: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          installation_instructions?: string
          is_mockup?: boolean
          kit_only?: boolean
          name?: string
          size?: string
          specification?: string
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
      campaign_quotations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_quotations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_schedules: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          installation_os: string | null
          installation_preference: string | null
          responsibility: string | null
          responsibility_at: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          store_approval_status: string
          store_approved: boolean
          store_approved_at: string | null
          store_id: string
          team_approval_status: string
          team_approved: boolean
          team_approved_at: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          installation_os?: string | null
          installation_preference?: string | null
          responsibility?: string | null
          responsibility_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          store_approval_status?: string
          store_approved?: boolean
          store_approved_at?: string | null
          store_id: string
          team_approval_status?: string
          team_approved?: boolean
          team_approved_at?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          installation_os?: string | null
          installation_preference?: string | null
          responsibility?: string | null
          responsibility_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          store_approval_status?: string
          store_approved?: boolean
          store_approved_at?: string | null
          store_id?: string
          team_approval_status?: string
          team_approved?: boolean
          team_approved_at?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_schedules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_schedules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
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
      campaign_store_status: {
        Row: {
          campaign_id: string
          created_at: string
          enabled: boolean
          id: string
          store_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          store_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_store_status_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_store_status_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_support_materials: {
        Row: {
          campaign_id: string
          created_at: string
          display_order: number
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          title: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          display_order?: number
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          title?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          display_order?: number
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_support_materials_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          display_order?: number | null
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
      chat_conversations: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          subject: string
          user_1: string
          user_2: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          subject?: string
          user_1: string
          user_2: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          subject?: string
          user_1?: string
          user_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_status: {
        Row: {
          context_id: string
          context_type: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          context_id: string
          context_type: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          context_id?: string
          context_type?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_store_models: {
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
            foreignKeyName: "client_store_models_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stores: {
        Row: {
          auto_distribute: boolean
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
          email: string | null
          id: string
          manager_name: string | null
          name: string
          neighborhood: string | null
          nickname: string | null
          number: string | null
          observations: string | null
          phone: string | null
          state: string | null
          state_registration: string | null
          store_code: string | null
          store_model: string | null
          street: string | null
          zip_code: string | null
        }
        Insert: {
          auto_distribute?: boolean
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
          email?: string | null
          id?: string
          manager_name?: string | null
          name: string
          neighborhood?: string | null
          nickname?: string | null
          number?: string | null
          observations?: string | null
          phone?: string | null
          state?: string | null
          state_registration?: string | null
          store_code?: string | null
          store_model?: string | null
          street?: string | null
          zip_code?: string | null
        }
        Update: {
          auto_distribute?: boolean
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
          email?: string | null
          id?: string
          manager_name?: string | null
          name?: string
          neighborhood?: string | null
          nickname?: string | null
          number?: string | null
          observations?: string | null
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
          agency_id: string
          color: string | null
          created_at: string
          custom_field_1_label: string | null
          custom_field_2_label: string | null
          custom_field_3_label: string | null
          custom_field_4_label: string | null
          custom_field_5_label: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          agency_id: string
          color?: string | null
          created_at?: string
          custom_field_1_label?: string | null
          custom_field_2_label?: string | null
          custom_field_3_label?: string | null
          custom_field_4_label?: string | null
          custom_field_5_label?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          agency_id?: string
          color?: string | null
          created_at?: string
          custom_field_1_label?: string | null
          custom_field_2_label?: string | null
          custom_field_3_label?: string | null
          custom_field_4_label?: string | null
          custom_field_5_label?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_photos: {
        Row: {
          campaign_id: string
          caption: string | null
          category: string
          created_at: string
          id: string
          photo_url: string
          store_id: string
          upload_method: string
          uploaded_by: string | null
        }
        Insert: {
          campaign_id: string
          caption?: string | null
          category?: string
          created_at?: string
          id?: string
          photo_url: string
          store_id: string
          upload_method?: string
          uploaded_by?: string | null
        }
        Update: {
          campaign_id?: string
          caption?: string | null
          category?: string
          created_at?: string
          id?: string
          photo_url?: string
          store_id?: string
          upload_method?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installation_photos_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_team_codes: {
        Row: {
          campaign_id: string
          code: string
          created_at: string
          created_by: string | null
          id: string
          team_id: string
        }
        Insert: {
          campaign_id: string
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          team_id: string
        }
        Update: {
          campaign_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_team_codes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_team_codes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_team_members: {
        Row: {
          cpf: string | null
          created_at: string
          id: string
          is_unified_doc: boolean
          name: string
          phone: string | null
          rg: string | null
          team_id: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          id?: string
          is_unified_doc?: boolean
          name: string
          phone?: string | null
          rg?: string | null
          team_id: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          id?: string
          is_unified_doc?: boolean
          name?: string
          phone?: string | null
          rg?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_team_vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          plate: string | null
          team_id: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          plate?: string | null
          team_id: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          plate?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_team_vehicles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_teams: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_teams_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          created_by: string
          id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          occurrence_id: string
          user_display_name: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          occurrence_id: string
          user_display_name: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          occurrence_id?: string
          user_display_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_comments_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_motives: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string
          id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description: string
          id?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string
          id?: string
        }
        Relationships: []
      }
      occurrence_photos: {
        Row: {
          category: string
          created_at: string
          id: string
          occurrence_id: string
          photo_url: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          occurrence_id: string
          photo_url: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          occurrence_id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrence_photos_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrence_statuses: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          order: number
          value: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          order?: number
          value: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          order?: number
          value?: string
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          actions_taken: string | null
          agency_observation: string | null
          campaign_id: string
          created_at: string | null
          description: string | null
          expected_resolution_date: string | null
          id: string
          location_in_store: string | null
          motive_id: string | null
          needs_reinstallation: boolean | null
          photo_url: string | null
          piece_id: string
          reinstallation_datetime: string | null
          reinstallation_os: string | null
          reporter_email: string | null
          reporter_name: string | null
          reporter_phone_ddd: string | null
          reporter_phone_number: string | null
          resolved_date: string | null
          status: string | null
          store_id: string
        }
        Insert: {
          actions_taken?: string | null
          agency_observation?: string | null
          campaign_id: string
          created_at?: string | null
          description?: string | null
          expected_resolution_date?: string | null
          id?: string
          location_in_store?: string | null
          motive_id?: string | null
          needs_reinstallation?: boolean | null
          photo_url?: string | null
          piece_id: string
          reinstallation_datetime?: string | null
          reinstallation_os?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone_ddd?: string | null
          reporter_phone_number?: string | null
          resolved_date?: string | null
          status?: string | null
          store_id: string
        }
        Update: {
          actions_taken?: string | null
          agency_observation?: string | null
          campaign_id?: string
          created_at?: string | null
          description?: string | null
          expected_resolution_date?: string | null
          id?: string
          location_in_store?: string | null
          motive_id?: string | null
          needs_reinstallation?: boolean | null
          photo_url?: string | null
          piece_id?: string
          reinstallation_datetime?: string | null
          reinstallation_os?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone_ddd?: string | null
          reporter_phone_number?: string | null
          resolved_date?: string | null
          status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_motive_id_fkey"
            columns: ["motive_id"]
            isOneToOne: false
            referencedRelation: "occurrence_motives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "campaign_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_categories: {
        Row: {
          can_delete_campaign_stores: boolean
          can_delete_campaigns: boolean
          can_delete_clients: boolean
          can_delete_installations: boolean
          can_delete_occurrences: boolean
          can_delete_pieces: boolean
          can_delete_schedules: boolean
          can_delete_stores: boolean
          can_edit_campaign_stores: boolean
          can_edit_campaigns: boolean
          can_edit_clients: boolean
          can_edit_installations: boolean
          can_edit_occurrences: boolean
          can_edit_pieces: boolean
          can_edit_reporter_data: boolean
          can_edit_schedules: boolean
          can_edit_stores: boolean
          can_manage_team_codes: boolean
          can_view_campaign_stores: boolean
          can_view_campaigns: boolean
          can_view_clients: boolean
          can_view_installations: boolean
          can_view_occurrences: boolean
          can_view_pieces: boolean
          can_view_schedules: boolean
          can_view_stores: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          can_delete_campaign_stores?: boolean
          can_delete_campaigns?: boolean
          can_delete_clients?: boolean
          can_delete_installations?: boolean
          can_delete_occurrences?: boolean
          can_delete_pieces?: boolean
          can_delete_schedules?: boolean
          can_delete_stores?: boolean
          can_edit_campaign_stores?: boolean
          can_edit_campaigns?: boolean
          can_edit_clients?: boolean
          can_edit_installations?: boolean
          can_edit_occurrences?: boolean
          can_edit_pieces?: boolean
          can_edit_reporter_data?: boolean
          can_edit_schedules?: boolean
          can_edit_stores?: boolean
          can_manage_team_codes?: boolean
          can_view_campaign_stores?: boolean
          can_view_campaigns?: boolean
          can_view_clients?: boolean
          can_view_installations?: boolean
          can_view_occurrences?: boolean
          can_view_pieces?: boolean
          can_view_schedules?: boolean
          can_view_stores?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          can_delete_campaign_stores?: boolean
          can_delete_campaigns?: boolean
          can_delete_clients?: boolean
          can_delete_installations?: boolean
          can_delete_occurrences?: boolean
          can_delete_pieces?: boolean
          can_delete_schedules?: boolean
          can_delete_stores?: boolean
          can_edit_campaign_stores?: boolean
          can_edit_campaigns?: boolean
          can_edit_clients?: boolean
          can_edit_installations?: boolean
          can_edit_occurrences?: boolean
          can_edit_pieces?: boolean
          can_edit_reporter_data?: boolean
          can_edit_schedules?: boolean
          can_edit_stores?: boolean
          can_manage_team_codes?: boolean
          can_view_campaign_stores?: boolean
          can_view_campaigns?: boolean
          can_view_clients?: boolean
          can_view_installations?: boolean
          can_view_occurrences?: boolean
          can_view_pieces?: boolean
          can_view_schedules?: boolean
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
          installation_instructions: string
          name: string
          size: string
          specification: string
        }
        Insert: {
          category: string
          code: number
          created_at?: string
          id?: number
          image_url?: string | null
          installation_instructions?: string
          name: string
          size: string
          specification?: string
        }
        Update: {
          category?: string
          code?: number
          created_at?: string
          id?: number
          image_url?: string | null
          installation_instructions?: string
          name?: string
          size?: string
          specification?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          job_title: string | null
          name_confirmed: boolean
          nickname: string | null
          phone: string | null
          phone_is_whatsapp: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          name_confirmed?: boolean
          nickname?: string | null
          phone?: string | null
          phone_is_whatsapp?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          name_confirmed?: boolean
          nickname?: string | null
          phone?: string | null
          phone_is_whatsapp?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedule_chat_messages: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
          store_id: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
          store_id: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_chat_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_chat_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_contact_roles: {
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
            foreignKeyName: "store_contact_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      store_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role_id: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role_id?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_contacts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "store_contact_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_contacts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
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
      user_agency_access: {
        Row: {
          agency_id: string
          can_edit: boolean
          category_id: string | null
          created_at: string
          id: string
          suspended: boolean
          user_id: string
        }
        Insert: {
          agency_id: string
          can_edit?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          suspended?: boolean
          user_id: string
        }
        Update: {
          agency_id?: string
          can_edit?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          suspended?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_agency_access_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_agency_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "permission_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_campaign_access: {
        Row: {
          campaign_id: string
          category_id: string | null
          created_at: string
          id: string
          suspended: boolean
          user_id: string
        }
        Insert: {
          campaign_id: string
          category_id?: string | null
          created_at?: string
          id?: string
          suspended?: boolean
          user_id: string
        }
        Update: {
          campaign_id?: string
          category_id?: string | null
          created_at?: string
          id?: string
          suspended?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_campaign_access_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_campaign_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "permission_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_client_access: {
        Row: {
          can_edit: boolean
          category_id: string | null
          client_id: string
          created_at: string
          id: string
          suspended: boolean
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          category_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          suspended?: boolean
          user_id: string
        }
        Update: {
          can_edit?: boolean
          category_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          suspended?: boolean
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
      has_campaign_category_permission: {
        Args: { _campaign_id: string; _permission: string; _user_id: string }
        Returns: boolean
      }
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
      has_permission_category: {
        Args: { _category_name: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_master: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "viewer" | "master"
      approval_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "viewer", "master"],
      approval_status: ["pending", "approved", "rejected"],
    },
  },
} as const
