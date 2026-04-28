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
      _backup_showcase_count: {
        Row: {
          backed_up_at: string
          backup_id: string
          client_id: string
          previous_showcase_count: number | null
          store_id: string
        }
        Insert: {
          backed_up_at?: string
          backup_id: string
          client_id: string
          previous_showcase_count?: number | null
          store_id: string
        }
        Update: {
          backed_up_at?: string
          backup_id?: string
          client_id?: string
          previous_showcase_count?: number | null
          store_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          action: string
          campaign_id: string
          created_at: string
          details: string | null
          id: string
          module: string
          store_id: string
          user_id: string
        }
        Insert: {
          action: string
          campaign_id: string
          created_at?: string
          details?: string | null
          id?: string
          module: string
          store_id: string
          user_id: string
        }
        Update: {
          action?: string
          campaign_id?: string
          created_at?: string
          details?: string | null
          id?: string
          module?: string
          store_id?: string
          user_id?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          id: string
          interface_mode: string
          logo_url: string | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          interface_mode?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          interface_mode?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      automation_group_items: {
        Row: {
          created_at: string
          display_order: number
          enabled: boolean
          group_id: string
          id: string
          template_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          group_id: string
          id?: string
          template_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          enabled?: boolean
          group_id?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "automation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_group_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "automation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_groups: {
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
            foreignKeyName: "automation_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_templates: {
        Row: {
          base_field: string | null
          campaign_id: string
          created_at: string
          filter_field: string
          filter_value: string
          id: string
          items: Json
          kind: string
          name: string
          outside_action: string
        }
        Insert: {
          base_field?: string | null
          campaign_id: string
          created_at?: string
          filter_field: string
          filter_value: string
          id?: string
          items?: Json
          kind?: string
          name: string
          outside_action?: string
        }
        Update: {
          base_field?: string | null
          campaign_id?: string
          created_at?: string
          filter_field?: string
          filter_value?: string
          id?: string
          items?: Json
          kind?: string
          name?: string
          outside_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_extra_costs: {
        Row: {
          created_at: string | null
          freight_value: number | null
          id: string
          installation_value: number | null
          supplier_id: string
        }
        Insert: {
          created_at?: string | null
          freight_value?: number | null
          id?: string
          installation_value?: number | null
          supplier_id: string
        }
        Update: {
          created_at?: string | null
          freight_value?: number | null
          id?: string
          installation_value?: number | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_extra_costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "budget_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_prices: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          kit_id: string | null
          piece_id: string | null
          supplier_id: string
          unit_price: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          kit_id?: string | null
          piece_id?: string | null
          supplier_id: string
          unit_price?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          kit_id?: string | null
          piece_id?: string | null
          supplier_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_prices_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_prices_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "campaign_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_prices_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "campaign_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "budget_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_settings: {
        Row: {
          budget_amount: number | null
          campaign_id: string
          created_at: string | null
          currency_code: string
          currency_locked: boolean
          deadline: string | null
          id: string
          notify_user_ids: string[] | null
        }
        Insert: {
          budget_amount?: number | null
          campaign_id: string
          created_at?: string | null
          currency_code?: string
          currency_locked?: boolean
          deadline?: string | null
          id?: string
          notify_user_ids?: string[] | null
        }
        Update: {
          budget_amount?: number | null
          campaign_id?: string
          created_at?: string | null
          currency_code?: string
          currency_locked?: boolean
          deadline?: string | null
          id?: string
          notify_user_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_settings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_suppliers: {
        Row: {
          access_token: string
          campaign_id: string
          company_name: string
          contact_name: string
          created_at: string | null
          email: string
          id: string
          invited_at: string | null
          locked: boolean | null
          phone: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          access_token?: string
          campaign_id: string
          company_name: string
          contact_name: string
          created_at?: string | null
          email: string
          id?: string
          invited_at?: string | null
          locked?: boolean | null
          phone: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          access_token?: string
          campaign_id?: string
          company_name?: string
          contact_name?: string
          created_at?: string | null
          email?: string
          id?: string
          invited_at?: string | null
          locked?: boolean | null
          phone?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_suppliers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_timeline_entries: {
        Row: {
          campaign_id: string
          created_at: string | null
          description: string
          display_order: number
          entry_date: string
          id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          description: string
          display_order?: number
          entry_date: string
          id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          description?: string
          display_order?: number
          entry_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_timeline_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_activity_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_type: string | null
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_type?: string | null
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_type?: string | null
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          store_id?: string | null
          user_id?: string | null
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
          category: string | null
          code: number
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_mockup: boolean
          is_new: boolean
          name: string
          sub_location: string | null
        }
        Insert: {
          campaign_id: string
          category?: string | null
          code: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_mockup?: boolean
          is_new?: boolean
          name: string
          sub_location?: string | null
        }
        Update: {
          campaign_id?: string
          category?: string | null
          code?: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_mockup?: boolean
          is_new?: boolean
          name?: string
          sub_location?: string | null
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
      campaign_message_reads: {
        Row: {
          campaign_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_message_reads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          sender_id: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
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
      campaign_piece_sub_locations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          location_id: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          location_id: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          location_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_piece_sub_locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_piece_sub_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "campaign_piece_locations"
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
          is_new: boolean
          kit_only: boolean
          name: string
          size: string
          specification: string
          store_category: string | null
          sub_location: string | null
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
          is_new?: boolean
          kit_only?: boolean
          name: string
          size: string
          specification?: string
          store_category?: string | null
          sub_location?: string | null
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
          is_new?: boolean
          kit_only?: boolean
          name?: string
          size?: string
          specification?: string
          store_category?: string | null
          sub_location?: string | null
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
          checkin_accuracy: number | null
          checkin_device_info: Json | null
          checkin_lat: number | null
          checkin_lng: number | null
          checkin_timestamp: string | null
          code_sent_at: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          install_code: string | null
          install_code_expires_at: string | null
          install_code_generated_at: string | null
          installation_os: string | null
          installation_preference: string | null
          locked: boolean
          manual_checkin_at: string | null
          manual_checkin_by: string | null
          manual_checkin_by_name: string | null
          manual_checkout_at: string | null
          manual_checkout_by: string | null
          manual_checkout_by_name: string | null
          photo_checkin: boolean
          photo_checkin_at: string | null
          reschedule_date: string | null
          reschedule_enabled: boolean
          reschedule_os: string | null
          reschedule_preference: string | null
          reschedule_responsibility: string | null
          reschedule_responsibility_at: string | null
          reschedule_store_approval_status: string
          reschedule_store_approved_at: string | null
          reschedule_suggested_date: string | null
          reschedule_suggested_date_2: string | null
          reschedule_suggested_time: string | null
          reschedule_suggested_time_2: string | null
          reschedule_team_approval_status: string
          reschedule_team_approved_at: string | null
          reschedule_time: string | null
          responsibility: string | null
          responsibility_at: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          store_approval_status: string
          store_approved: boolean
          store_approved_at: string | null
          store_id: string
          suggested_date: string | null
          suggested_date_2: string | null
          suggested_time: string | null
          suggested_time_2: string | null
          team_approval_status: string
          team_approved: boolean
          team_approved_at: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          checkin_accuracy?: number | null
          checkin_device_info?: Json | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_timestamp?: string | null
          code_sent_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          install_code?: string | null
          install_code_expires_at?: string | null
          install_code_generated_at?: string | null
          installation_os?: string | null
          installation_preference?: string | null
          locked?: boolean
          manual_checkin_at?: string | null
          manual_checkin_by?: string | null
          manual_checkin_by_name?: string | null
          manual_checkout_at?: string | null
          manual_checkout_by?: string | null
          manual_checkout_by_name?: string | null
          photo_checkin?: boolean
          photo_checkin_at?: string | null
          reschedule_date?: string | null
          reschedule_enabled?: boolean
          reschedule_os?: string | null
          reschedule_preference?: string | null
          reschedule_responsibility?: string | null
          reschedule_responsibility_at?: string | null
          reschedule_store_approval_status?: string
          reschedule_store_approved_at?: string | null
          reschedule_suggested_date?: string | null
          reschedule_suggested_date_2?: string | null
          reschedule_suggested_time?: string | null
          reschedule_suggested_time_2?: string | null
          reschedule_team_approval_status?: string
          reschedule_team_approved_at?: string | null
          reschedule_time?: string | null
          responsibility?: string | null
          responsibility_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          store_approval_status?: string
          store_approved?: boolean
          store_approved_at?: string | null
          store_id: string
          suggested_date?: string | null
          suggested_date_2?: string | null
          suggested_time?: string | null
          suggested_time_2?: string | null
          team_approval_status?: string
          team_approved?: boolean
          team_approved_at?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          checkin_accuracy?: number | null
          checkin_device_info?: Json | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          checkin_timestamp?: string | null
          code_sent_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          install_code?: string | null
          install_code_expires_at?: string | null
          install_code_generated_at?: string | null
          installation_os?: string | null
          installation_preference?: string | null
          locked?: boolean
          manual_checkin_at?: string | null
          manual_checkin_by?: string | null
          manual_checkin_by_name?: string | null
          manual_checkout_at?: string | null
          manual_checkout_by?: string | null
          manual_checkout_by_name?: string | null
          photo_checkin?: boolean
          photo_checkin_at?: string | null
          reschedule_date?: string | null
          reschedule_enabled?: boolean
          reschedule_os?: string | null
          reschedule_preference?: string | null
          reschedule_responsibility?: string | null
          reschedule_responsibility_at?: string | null
          reschedule_store_approval_status?: string
          reschedule_store_approved_at?: string | null
          reschedule_suggested_date?: string | null
          reschedule_suggested_date_2?: string | null
          reschedule_suggested_time?: string | null
          reschedule_suggested_time_2?: string | null
          reschedule_team_approval_status?: string
          reschedule_team_approved_at?: string | null
          reschedule_time?: string | null
          responsibility?: string | null
          responsibility_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          store_approval_status?: string
          store_approved?: boolean
          store_approved_at?: string | null
          store_id?: string
          suggested_date?: string | null
          suggested_date_2?: string | null
          suggested_time?: string | null
          suggested_time_2?: string | null
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
      campaign_snapshots: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          snapshot_data: Json
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          snapshot_data: Json
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          snapshot_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "campaign_snapshots_campaign_id_fkey"
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
          access_days_after: number | null
          access_days_before: number | null
          access_hours_after: number | null
          access_hours_before: number | null
          access_ignore_date: boolean | null
          access_ignore_time: boolean | null
          client_id: string
          color: string | null
          created_at: string
          display_order: number | null
          id: string
          name: string
          occurrence_end_date: string | null
          occurrence_start_date: string | null
        }
        Insert: {
          access_days_after?: number | null
          access_days_before?: number | null
          access_hours_after?: number | null
          access_hours_before?: number | null
          access_ignore_date?: boolean | null
          access_ignore_time?: boolean | null
          client_id: string
          color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          occurrence_end_date?: string | null
          occurrence_start_date?: string | null
        }
        Update: {
          access_days_after?: number | null
          access_days_before?: number | null
          access_hours_after?: number | null
          access_hours_before?: number | null
          access_ignore_date?: boolean | null
          access_ignore_time?: boolean | null
          client_id?: string
          color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          occurrence_end_date?: string | null
          occurrence_start_date?: string | null
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
          custom_field_10: string | null
          custom_field_2: string | null
          custom_field_3: string | null
          custom_field_4: string | null
          custom_field_5: string | null
          custom_field_6: string | null
          custom_field_7: string | null
          custom_field_8: string | null
          custom_field_9: string | null
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          manager_name: string | null
          name: string
          neighborhood: string | null
          nickname: string | null
          number: string | null
          observations: string | null
          phone: string | null
          show_in_scheduling: boolean
          showcase_count: number
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
          custom_field_10?: string | null
          custom_field_2?: string | null
          custom_field_3?: string | null
          custom_field_4?: string | null
          custom_field_5?: string | null
          custom_field_6?: string | null
          custom_field_7?: string | null
          custom_field_8?: string | null
          custom_field_9?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          name: string
          neighborhood?: string | null
          nickname?: string | null
          number?: string | null
          observations?: string | null
          phone?: string | null
          show_in_scheduling?: boolean
          showcase_count?: number
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
          custom_field_10?: string | null
          custom_field_2?: string | null
          custom_field_3?: string | null
          custom_field_4?: string | null
          custom_field_5?: string | null
          custom_field_6?: string | null
          custom_field_7?: string | null
          custom_field_8?: string | null
          custom_field_9?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          name?: string
          neighborhood?: string | null
          nickname?: string | null
          number?: string | null
          observations?: string | null
          phone?: string | null
          show_in_scheduling?: boolean
          showcase_count?: number
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
      client_suppliers: {
        Row: {
          client_id: string
          company_name: string
          contact_name: string | null
          created_at: string
          email: string
          id: string
          observations: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          company_name: string
          contact_name?: string | null
          created_at?: string
          email: string
          id?: string
          observations?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string
          id?: string
          observations?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_suppliers_client_id_fkey"
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
          country_code: string | null
          created_at: string
          currency_code: string | null
          custom_field_1_label: string | null
          custom_field_10_label: string | null
          custom_field_2_label: string | null
          custom_field_3_label: string | null
          custom_field_4_label: string | null
          custom_field_5_label: string | null
          custom_field_6_label: string | null
          custom_field_7_label: string | null
          custom_field_8_label: string | null
          custom_field_9_label: string | null
          display_order: number | null
          id: string
          language: string | null
          name: string
        }
        Insert: {
          agency_id: string
          color?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          custom_field_1_label?: string | null
          custom_field_10_label?: string | null
          custom_field_2_label?: string | null
          custom_field_3_label?: string | null
          custom_field_4_label?: string | null
          custom_field_5_label?: string | null
          custom_field_6_label?: string | null
          custom_field_7_label?: string | null
          custom_field_8_label?: string | null
          custom_field_9_label?: string | null
          display_order?: number | null
          id?: string
          language?: string | null
          name: string
        }
        Update: {
          agency_id?: string
          color?: string | null
          country_code?: string | null
          created_at?: string
          currency_code?: string | null
          custom_field_1_label?: string | null
          custom_field_10_label?: string | null
          custom_field_2_label?: string | null
          custom_field_3_label?: string | null
          custom_field_4_label?: string | null
          custom_field_5_label?: string | null
          custom_field_6_label?: string | null
          custom_field_7_label?: string | null
          custom_field_8_label?: string | null
          custom_field_9_label?: string | null
          display_order?: number | null
          id?: string
          language?: string | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      install_access_log: {
        Row: {
          accessed_at: string | null
          action: string | null
          campaign_id: string | null
          id: string
          install_code: string
          ip_address: unknown
          store_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          action?: string | null
          campaign_id?: string | null
          id?: string
          install_code: string
          ip_address?: unknown
          store_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          action?: string | null
          campaign_id?: string | null
          id?: string
          install_code?: string
          ip_address?: unknown
          store_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "install_access_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "install_access_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
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
          media_type: string
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
          media_type?: string
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
          media_type?: string
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
      installation_team_members: {
        Row: {
          cpf: string | null
          created_at: string
          id: string
          is_leader: boolean
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
          is_leader?: boolean
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
          is_leader?: boolean
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
      loja_a_loja_lojas: {
        Row: {
          ativo: boolean | null
          campaign_id: string
          created_at: string | null
          id: string
          store_id: string
          subdivisao_id: string | null
          tipo_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          campaign_id: string
          created_at?: string | null
          id?: string
          store_id: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          campaign_id?: string
          created_at?: string | null
          id?: string
          store_id?: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loja_a_loja_lojas_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_a_loja_lojas_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_a_loja_lojas_subdivisao_id_fkey"
            columns: ["subdivisao_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_subdivisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_a_loja_lojas_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_a_loja_pecas: {
        Row: {
          campaign_id: string
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          nome: string
          subdivisao_id: string | null
          tipo_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          nome: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          nome?: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loja_a_loja_pecas_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_a_loja_pecas_subdivisao_id_fkey"
            columns: ["subdivisao_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_subdivisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loja_a_loja_pecas_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_a_loja_subdivisoes: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          nome: string
          tipo_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          nome: string
          tipo_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          nome?: string
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_a_loja_subdivisoes_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_a_loja_tipos: {
        Row: {
          campaign_id: string
          created_at: string | null
          display_order: number | null
          id: string
          letra: string
          nome: string
          tem_subdivisao: boolean | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          letra: string
          nome: string
          tem_subdivisao?: boolean | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          letra?: string
          nome?: string
          tem_subdivisao?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "loja_a_loja_tipos_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          agency_id: string
          category_id: string | null
          created_at: string
          enabled: boolean
          event_type: string
          id: string
          role_scope: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          category_id?: string | null
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
          role_scope?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          category_id?: string | null
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
          role_scope?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_settings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "permission_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          campaign_id: string | null
          client_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          store_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          store_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          store_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
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
          display_order: number
          id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description: string
          display_order?: number
          id?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string
          display_order?: number
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
          kit_id: string | null
          location_in_store: string | null
          locked: boolean
          motive_id: string | null
          needs_reinstallation: boolean | null
          photo_url: string | null
          piece_id: string | null
          priority: string
          reinstallation_datetime: string | null
          reinstallation_os: string | null
          reporter_email: string | null
          reporter_name: string | null
          reporter_phone_ddd: string | null
          reporter_phone_number: string | null
          reporter_type: string
          resolved_date: string | null
          status: string | null
          store_id: string | null
        }
        Insert: {
          actions_taken?: string | null
          agency_observation?: string | null
          campaign_id: string
          created_at?: string | null
          description?: string | null
          expected_resolution_date?: string | null
          id?: string
          kit_id?: string | null
          location_in_store?: string | null
          locked?: boolean
          motive_id?: string | null
          needs_reinstallation?: boolean | null
          photo_url?: string | null
          piece_id?: string | null
          priority?: string
          reinstallation_datetime?: string | null
          reinstallation_os?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone_ddd?: string | null
          reporter_phone_number?: string | null
          reporter_type?: string
          resolved_date?: string | null
          status?: string | null
          store_id?: string | null
        }
        Update: {
          actions_taken?: string | null
          agency_observation?: string | null
          campaign_id?: string
          created_at?: string | null
          description?: string | null
          expected_resolution_date?: string | null
          id?: string
          kit_id?: string | null
          location_in_store?: string | null
          locked?: boolean
          motive_id?: string | null
          needs_reinstallation?: boolean | null
          photo_url?: string | null
          piece_id?: string | null
          priority?: string
          reinstallation_datetime?: string | null
          reinstallation_os?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_phone_ddd?: string | null
          reporter_phone_number?: string | null
          reporter_type?: string
          resolved_date?: string | null
          status?: string | null
          store_id?: string | null
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
            foreignKeyName: "occurrences_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "campaign_kits"
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
          can_delete_lal_acessos: boolean
          can_delete_lal_classificacao: boolean
          can_delete_lal_config: boolean
          can_delete_lal_estrutura: boolean
          can_delete_lal_ocorrencias: boolean
          can_delete_loja_a_loja: boolean
          can_delete_occurrences: boolean
          can_delete_pieces: boolean
          can_delete_schedules: boolean
          can_delete_stores: boolean
          can_edit_campaign_stores: boolean
          can_edit_campaigns: boolean
          can_edit_clients: boolean
          can_edit_installations: boolean
          can_edit_lal_acessos: boolean
          can_edit_lal_classificacao: boolean
          can_edit_lal_config: boolean
          can_edit_lal_estrutura: boolean
          can_edit_lal_ocorrencias: boolean
          can_edit_loja_a_loja: boolean | null
          can_edit_occurrences: boolean
          can_edit_pieces: boolean
          can_edit_reporter_data: boolean
          can_edit_schedules: boolean
          can_edit_stores: boolean
          can_lock_cards: boolean
          can_manage_team_codes: boolean
          can_view_campaign_stores: boolean
          can_view_campaigns: boolean
          can_view_clients: boolean
          can_view_installations: boolean
          can_view_lal_acessos: boolean
          can_view_lal_classificacao: boolean
          can_view_lal_config: boolean
          can_view_lal_estrutura: boolean
          can_view_lal_ocorrencias: boolean
          can_view_loja_a_loja: boolean | null
          can_view_occurrences: boolean
          can_view_photo_checkin: boolean
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
          can_delete_lal_acessos?: boolean
          can_delete_lal_classificacao?: boolean
          can_delete_lal_config?: boolean
          can_delete_lal_estrutura?: boolean
          can_delete_lal_ocorrencias?: boolean
          can_delete_loja_a_loja?: boolean
          can_delete_occurrences?: boolean
          can_delete_pieces?: boolean
          can_delete_schedules?: boolean
          can_delete_stores?: boolean
          can_edit_campaign_stores?: boolean
          can_edit_campaigns?: boolean
          can_edit_clients?: boolean
          can_edit_installations?: boolean
          can_edit_lal_acessos?: boolean
          can_edit_lal_classificacao?: boolean
          can_edit_lal_config?: boolean
          can_edit_lal_estrutura?: boolean
          can_edit_lal_ocorrencias?: boolean
          can_edit_loja_a_loja?: boolean | null
          can_edit_occurrences?: boolean
          can_edit_pieces?: boolean
          can_edit_reporter_data?: boolean
          can_edit_schedules?: boolean
          can_edit_stores?: boolean
          can_lock_cards?: boolean
          can_manage_team_codes?: boolean
          can_view_campaign_stores?: boolean
          can_view_campaigns?: boolean
          can_view_clients?: boolean
          can_view_installations?: boolean
          can_view_lal_acessos?: boolean
          can_view_lal_classificacao?: boolean
          can_view_lal_config?: boolean
          can_view_lal_estrutura?: boolean
          can_view_lal_ocorrencias?: boolean
          can_view_loja_a_loja?: boolean | null
          can_view_occurrences?: boolean
          can_view_photo_checkin?: boolean
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
          can_delete_lal_acessos?: boolean
          can_delete_lal_classificacao?: boolean
          can_delete_lal_config?: boolean
          can_delete_lal_estrutura?: boolean
          can_delete_lal_ocorrencias?: boolean
          can_delete_loja_a_loja?: boolean
          can_delete_occurrences?: boolean
          can_delete_pieces?: boolean
          can_delete_schedules?: boolean
          can_delete_stores?: boolean
          can_edit_campaign_stores?: boolean
          can_edit_campaigns?: boolean
          can_edit_clients?: boolean
          can_edit_installations?: boolean
          can_edit_lal_acessos?: boolean
          can_edit_lal_classificacao?: boolean
          can_edit_lal_config?: boolean
          can_edit_lal_estrutura?: boolean
          can_edit_lal_ocorrencias?: boolean
          can_edit_loja_a_loja?: boolean | null
          can_edit_occurrences?: boolean
          can_edit_pieces?: boolean
          can_edit_reporter_data?: boolean
          can_edit_schedules?: boolean
          can_edit_stores?: boolean
          can_lock_cards?: boolean
          can_manage_team_codes?: boolean
          can_view_campaign_stores?: boolean
          can_view_campaigns?: boolean
          can_view_clients?: boolean
          can_view_installations?: boolean
          can_view_lal_acessos?: boolean
          can_view_lal_classificacao?: boolean
          can_view_lal_config?: boolean
          can_view_lal_estrutura?: boolean
          can_view_lal_ocorrencias?: boolean
          can_view_loja_a_loja?: boolean | null
          can_view_occurrences?: boolean
          can_view_photo_checkin?: boolean
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
      portal_config_layout: {
        Row: {
          card_order: string[]
          collapsed_cards: string[]
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          card_order?: string[]
          collapsed_cards?: string[]
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          card_order?: string[]
          collapsed_cards?: string[]
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_url: string | null
          client_id: string | null
          company: string | null
          created_at: string
          display_name: string | null
          id: string
          job_title: string | null
          loja_a_loja_tab_order: string[] | null
          name_confirmed: boolean
          nickname: string | null
          phone: string | null
          phone_is_whatsapp: boolean | null
          preferred_language: string | null
          theme_hue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          loja_a_loja_tab_order?: string[] | null
          name_confirmed?: boolean
          nickname?: string | null
          phone?: string | null
          phone_is_whatsapp?: boolean | null
          preferred_language?: string | null
          theme_hue?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_url?: string | null
          client_id?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          job_title?: string | null
          loja_a_loja_tab_order?: string[] | null
          name_confirmed?: boolean
          nickname?: string | null
          phone?: string | null
          phone_is_whatsapp?: boolean | null
          preferred_language?: string | null
          theme_hue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_history: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_compliance_checks: {
        Row: {
          campaign_id: string
          checked_at: string | null
          checked_by_token: string | null
          created_at: string | null
          id: string
          notes: string | null
          overall_status: string
          store_id: string
        }
        Insert: {
          campaign_id: string
          checked_at?: string | null
          checked_by_token?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          overall_status?: string
          store_id: string
        }
        Update: {
          campaign_id?: string
          checked_at?: string | null
          checked_by_token?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          overall_status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_compliance_checks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_compliance_checks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_compliance_items: {
        Row: {
          check_id: string
          created_at: string | null
          creates_occurrence: boolean | null
          creates_replacement: boolean | null
          id: string
          loja_a_loja_peca_id: string | null
          notes: string | null
          photo_urls: string[] | null
          status: string
          subdivisao_id: string | null
          tipo_id: string | null
        }
        Insert: {
          check_id: string
          created_at?: string | null
          creates_occurrence?: boolean | null
          creates_replacement?: boolean | null
          id?: string
          loja_a_loja_peca_id?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          status?: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Update: {
          check_id?: string
          created_at?: string | null
          creates_occurrence?: boolean | null
          creates_replacement?: boolean | null
          id?: string
          loja_a_loja_peca_id?: string | null
          notes?: string | null
          photo_urls?: string[] | null
          status?: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_compliance_items_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "store_compliance_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_compliance_items_loja_a_loja_peca_id_fkey"
            columns: ["loja_a_loja_peca_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_compliance_items_subdivisao_id_fkey"
            columns: ["subdivisao_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_subdivisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_compliance_items_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
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
      store_maintenance_requests: {
        Row: {
          agency_notes: string | null
          campaign_id: string
          completed_at: string | null
          created_at: string | null
          description: string
          id: string
          loja_a_loja_peca_id: string | null
          opened_by: string
          opened_by_user_id: string | null
          photo_urls: string[] | null
          priority: string
          scheduled_date: string | null
          status: string
          store_id: string
          subdivisao_id: string | null
          tipo_id: string | null
        }
        Insert: {
          agency_notes?: string | null
          campaign_id: string
          completed_at?: string | null
          created_at?: string | null
          description: string
          id?: string
          loja_a_loja_peca_id?: string | null
          opened_by?: string
          opened_by_user_id?: string | null
          photo_urls?: string[] | null
          priority?: string
          scheduled_date?: string | null
          status?: string
          store_id: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Update: {
          agency_notes?: string | null
          campaign_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string
          id?: string
          loja_a_loja_peca_id?: string | null
          opened_by?: string
          opened_by_user_id?: string | null
          photo_urls?: string[] | null
          priority?: string
          scheduled_date?: string | null
          status?: string
          store_id?: string
          subdivisao_id?: string | null
          tipo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_maintenance_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_maintenance_requests_loja_a_loja_peca_id_fkey"
            columns: ["loja_a_loja_peca_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_maintenance_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_maintenance_requests_subdivisao_id_fkey"
            columns: ["subdivisao_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_subdivisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_maintenance_requests_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      store_occurrence_reports: {
        Row: {
          agency_notes: string | null
          campaign_id: string
          created_at: string | null
          description: string | null
          expected_resolution_date: string | null
          id: string
          loja_a_loja_peca_id: string | null
          motive_id: string | null
          needs_reinstallation: boolean
          photo_urls: string[] | null
          priority: string
          reinstallation_os: string | null
          reinstallation_scheduled_at: string | null
          reporter_type: string
          resolution_photo_urls: string[] | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          store_id: string
          subdivisao_id: string | null
          tipo_id: string | null
          token_id: string
          tratativa_notes: string | null
          tratativa_status: string
        }
        Insert: {
          agency_notes?: string | null
          campaign_id: string
          created_at?: string | null
          description?: string | null
          expected_resolution_date?: string | null
          id?: string
          loja_a_loja_peca_id?: string | null
          motive_id?: string | null
          needs_reinstallation?: boolean
          photo_urls?: string[] | null
          priority?: string
          reinstallation_os?: string | null
          reinstallation_scheduled_at?: string | null
          reporter_type?: string
          resolution_photo_urls?: string[] | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          store_id: string
          subdivisao_id?: string | null
          tipo_id?: string | null
          token_id: string
          tratativa_notes?: string | null
          tratativa_status?: string
        }
        Update: {
          agency_notes?: string | null
          campaign_id?: string
          created_at?: string | null
          description?: string | null
          expected_resolution_date?: string | null
          id?: string
          loja_a_loja_peca_id?: string | null
          motive_id?: string | null
          needs_reinstallation?: boolean
          photo_urls?: string[] | null
          priority?: string
          reinstallation_os?: string | null
          reinstallation_scheduled_at?: string | null
          reporter_type?: string
          resolution_photo_urls?: string[] | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          store_id?: string
          subdivisao_id?: string | null
          tipo_id?: string | null
          token_id?: string
          tratativa_notes?: string | null
          tratativa_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_occurrence_reports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_occurrence_reports_loja_a_loja_peca_id_fkey"
            columns: ["loja_a_loja_peca_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_occurrence_reports_motive_id_fkey"
            columns: ["motive_id"]
            isOneToOne: false
            referencedRelation: "store_portal_motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_occurrence_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_occurrence_reports_subdivisao_id_fkey"
            columns: ["subdivisao_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_subdivisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_occurrence_reports_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_occurrence_reports_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "store_portal_tokens"
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
      store_portal_config: {
        Row: {
          blocked_piece_message: string | null
          campaign_id: string
          created_at: string | null
          deadline_conformidade: string | null
          deadline_manutencao: string | null
          deadline_ocorrencias: string | null
          deadline_reposicoes: string | null
          id: string
          module_conformidade: boolean
          module_manutencao: boolean
          module_ocorrencias: boolean
          module_reposicoes: boolean
          occurrences_portal_subtitle: string | null
          occurrences_portal_title: string | null
          portal_title: string | null
          portal_welcome_message: string | null
          show_priority: boolean
          updated_at: string | null
        }
        Insert: {
          blocked_piece_message?: string | null
          campaign_id: string
          created_at?: string | null
          deadline_conformidade?: string | null
          deadline_manutencao?: string | null
          deadline_ocorrencias?: string | null
          deadline_reposicoes?: string | null
          id?: string
          module_conformidade?: boolean
          module_manutencao?: boolean
          module_ocorrencias?: boolean
          module_reposicoes?: boolean
          occurrences_portal_subtitle?: string | null
          occurrences_portal_title?: string | null
          portal_title?: string | null
          portal_welcome_message?: string | null
          show_priority?: boolean
          updated_at?: string | null
        }
        Update: {
          blocked_piece_message?: string | null
          campaign_id?: string
          created_at?: string | null
          deadline_conformidade?: string | null
          deadline_manutencao?: string | null
          deadline_ocorrencias?: string | null
          deadline_reposicoes?: string | null
          id?: string
          module_conformidade?: boolean
          module_manutencao?: boolean
          module_ocorrencias?: boolean
          module_reposicoes?: boolean
          occurrences_portal_subtitle?: string | null
          occurrences_portal_title?: string | null
          portal_title?: string | null
          portal_welcome_message?: string | null
          show_priority?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_portal_config_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      store_portal_motivos: {
        Row: {
          ativo: boolean
          client_id: string
          created_at: string | null
          descricao: string
          id: string
          sort_order: number
        }
        Insert: {
          ativo?: boolean
          client_id: string
          created_at?: string | null
          descricao: string
          id?: string
          sort_order?: number
        }
        Update: {
          ativo?: boolean
          client_id?: string
          created_at?: string | null
          descricao?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_portal_motivos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      store_portal_store_overrides: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          module_conformidade: boolean | null
          module_manutencao: boolean | null
          module_ocorrencias: boolean | null
          module_reposicoes: boolean | null
          store_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          module_conformidade?: boolean | null
          module_manutencao?: boolean | null
          module_ocorrencias?: boolean | null
          module_reposicoes?: boolean | null
          store_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          module_conformidade?: boolean | null
          module_manutencao?: boolean | null
          module_ocorrencias?: boolean | null
          module_reposicoes?: boolean | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_portal_store_overrides_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_portal_store_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_portal_tokens: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          store_id: string
          token: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          store_id: string
          token?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          store_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_portal_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_portal_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_replacement_requests: {
        Row: {
          agency_notes: string | null
          campaign_id: string
          id: string
          loja_a_loja_peca_id: string | null
          photo_urls: string[] | null
          quantity_requested: number
          reason: string
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          store_id: string
          subdivisao_id: string | null
          supplier_notes: string | null
          tipo_id: string | null
          token_id: string | null
        }
        Insert: {
          agency_notes?: string | null
          campaign_id: string
          id?: string
          loja_a_loja_peca_id?: string | null
          photo_urls?: string[] | null
          quantity_requested?: number
          reason: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          store_id: string
          subdivisao_id?: string | null
          supplier_notes?: string | null
          tipo_id?: string | null
          token_id?: string | null
        }
        Update: {
          agency_notes?: string | null
          campaign_id?: string
          id?: string
          loja_a_loja_peca_id?: string | null
          photo_urls?: string[] | null
          quantity_requested?: number
          reason?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          store_id?: string
          subdivisao_id?: string | null
          supplier_notes?: string | null
          tipo_id?: string | null
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_replacement_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_replacement_requests_loja_a_loja_peca_id_fkey"
            columns: ["loja_a_loja_peca_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_replacement_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "client_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_replacement_requests_subdivisao_id_fkey"
            columns: ["subdivisao_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_subdivisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_replacement_requests_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "loja_a_loja_tipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_replacement_requests_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "store_portal_tokens"
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
      supplier_spec_suggestions: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          orcado_por: string
          original_spec: string | null
          piece_id: string
          suggested_spec: string
          supplier_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          orcado_por?: string
          original_spec?: string | null
          piece_id: string
          suggested_spec: string
          supplier_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          orcado_por?: string
          original_spec?: string | null
          piece_id?: string
          suggested_spec?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_spec_suggestions_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "campaign_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_spec_suggestions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "budget_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_messages: {
        Row: {
          agency_id: string | null
          category: string
          content: string
          created_at: string
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
      user_campaign_favorites: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_campaign_favorites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
      criar_notificacao: {
        Args: {
          _action_url?: string
          _agency_id: string
          _body?: string
          _campaign_id?: string
          _client_id?: string
          _store_id?: string
          _title?: string
          _type?: string
        }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      has_campaign_access: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
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
      is_supplier_unlocked: {
        Args: { p_supplier_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      shift_display_orders: {
        Args: { p_after_order: number; p_campaign_id: string; p_slots: number }
        Returns: undefined
      }
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
