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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      anamnesis: {
        Row: {
          created_at: string
          created_by: string | null
          family_background: string | null
          id: string
          patient_id: string
          personal_background: string | null
          problem_history: string | null
          reason_for_consultation: string
          risk_assessment: string | null
          session_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_background?: string | null
          id?: string
          patient_id: string
          personal_background?: string | null
          problem_history?: string | null
          reason_for_consultation: string
          risk_assessment?: string | null
          session_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_background?: string | null
          id?: string
          patient_id?: string
          personal_background?: string | null
          problem_history?: string | null
          reason_for_consultation?: string
          risk_assessment?: string | null
          session_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment: {
        Row: {
          attendance: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          notes: string | null
          patient_id: string
          price: number
          professional_id: string
          scheduled_at: string
          service_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attendance?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id: string
          price?: number
          professional_id: string
          scheduled_at: string
          service_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attendance?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_id?: string
          price?: number
          professional_id?: string
          scheduled_at?: string
          service_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          metadata: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_schedule: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template: {
        Row: {
          code: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      informed_consent: {
        Row: {
          accepted_by: string | null
          created_at: string
          document_template_id: string
          evidence_url: string | null
          id: string
          patient_id: string
          signed_at: string
          status: string
          tenant_id: string
          valid_until: string | null
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          document_template_id: string
          evidence_url?: string | null
          id?: string
          patient_id: string
          signed_at?: string
          status?: string
          tenant_id: string
          valid_until?: string | null
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          document_template_id?: string
          evidence_url?: string | null
          id?: string
          patient_id?: string
          signed_at?: string
          status?: string
          tenant_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "informed_consent_document_template_id_fkey"
            columns: ["document_template_id"]
            isOneToOne: false
            referencedRelation: "document_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informed_consent_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "informed_consent_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_guardian: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          identity_doc_number: string | null
          identity_doc_type: string | null
          patient_id: string
          phone: string | null
          relationship: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          identity_doc_number?: string | null
          identity_doc_type?: string | null
          patient_id: string
          phone?: string | null
          relationship: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          identity_doc_number?: string | null
          identity_doc_type?: string | null
          patient_id?: string
          phone?: string | null
          relationship?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_guardian_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_guardian_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      patient: {
        Row: {
          address: string | null
          birth_date: string
          created_at: string
          email: string | null
          first_name: string
          gender: string | null
          id: string
          identity_doc_number: string | null
          identity_doc_type: string | null
          is_minor: boolean
          last_name: string
          medical_record_number: string | null
          phone: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date: string
          created_at?: string
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          identity_doc_number?: string | null
          identity_doc_type?: string | null
          is_minor?: boolean
          last_name: string
          medical_record_number?: string | null
          phone?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string
          created_at?: string
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          identity_doc_number?: string | null
          identity_doc_type?: string | null
          is_minor?: boolean
          last_name?: string
          medical_record_number?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_schedule: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          kind: string
          professional_id: string
          start_time: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          kind?: string
          professional_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          kind?: string
          professional_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_schedule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_note: {
        Row: {
          analysis: string
          created_at: string
          created_by: string | null
          id: string
          objective: string
          patient_id: string
          plan: string
          session_id: string
          signed_at: string | null
          signed_by: string | null
          subjective: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          analysis: string
          created_at?: string
          created_by?: string | null
          id?: string
          objective: string
          patient_id: string
          plan: string
          session_id: string
          signed_at?: string | null
          signed_by?: string | null
          subjective: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          analysis?: string
          created_at?: string
          created_by?: string | null
          id?: string
          objective?: string
          patient_id?: string
          plan?: string
          session_id?: string
          signed_at?: string | null
          signed_by?: string | null
          subjective?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_note_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_note_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_note_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      role: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          name: string
          platform_scope: boolean
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: never
          name: string
          platform_scope?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: never
          name?: string
          platform_scope?: boolean
        }
        Relationships: []
      }
      schedule_exception: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          kind: string
          professional_id: string | null
          reason: string | null
          start_time: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          kind?: string
          professional_id?: string | null
          reason?: string | null
          start_time: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          kind?: string
          professional_id?: string | null
          reason?: string | null
          start_time?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exception_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      service: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          max_appointments_per_day: number
          modality: string
          name: string
          price: number
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          max_appointments_per_day?: number
          modality?: string
          name: string
          price?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          max_appointments_per_day?: number
          modality?: string
          name?: string
          price?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      service_price: {
        Row: {
          created_at: string
          id: string
          price: number
          service_id: string
          tenant_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          service_id: string
          tenant_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          service_id?: string
          tenant_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_price_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_price_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          appointment_id: string
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          patient_id: string
          professional_id: string
          started_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          patient_id: string
          professional_id: string
          started_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          patient_id?: string
          professional_id?: string
          started_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_counter: {
        Row: {
          next_patient_number: number
          tenant_id: string
        }
        Insert: {
          next_patient_number?: number
          tenant_id: string
        }
        Update: {
          next_patient_number?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_counter_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_membership: {
        Row: {
          created_at: string
          id: string
          role_id: number
          status: string
          tenant_id: string
          user_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: number
          status?: string
          tenant_id: string
          user_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: number
          status?: string
          tenant_id?: string
          user_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_membership_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_membership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          tax_id: string | null
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          tax_id?: string | null
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          tax_id?: string | null
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan: {
        Row: {
          created_at: string
          created_by: string | null
          duration_weeks: number | null
          ends_on: string | null
          id: string
          notes: string | null
          objectives: string
          patient_id: string
          professional_id: string
          starts_on: string
          status: string
          suggested_frequency: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_weeks?: number | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          objectives: string
          patient_id: string
          professional_id: string
          starts_on?: string
          status?: string
          suggested_frequency?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_weeks?: number | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          objectives?: string
          patient_id?: string
          professional_id?: string
          starts_on?: string
          status?: string
          suggested_frequency?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_platform_admin: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_platform_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_availability: {
        Args: {
          p_date: string
          p_professional_id: string
          p_service_id: string
          p_tenant_id: string
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      get_pending_session_appointments: {
        Args: { p_tenant_id: string }
        Returns: {
          attendance: string
          id: string
          patient_first_name: string
          patient_id: string
          patient_last_name: string
          professional_id: string
          scheduled_at: string
          service_id: string
          service_name: string
          status: string
        }[]
      }
      has_role_in_tenant: {
        Args: { p_roles: string[]; p_tenant_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      lookup_user_by_email: {
        Args: { p_email: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      next_patient_record_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
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

export type Role = Tables<'role'>
export type Tenant = Tables<'tenant'>
export type TenantSettings = Tables<'tenant_settings'>
export type UserProfile = Tables<'user_profile'>
export type TenantMembership = Tables<'tenant_membership'>
export type AuditLog = Tables<'audit_log'>
export type Service = Tables<'service'>
export type ServicePrice = Tables<'service_price'>
export type ClinicSchedule = Tables<'clinic_schedule'>
export type ProfessionalSchedule = Tables<'professional_schedule'>
export type ScheduleException = Tables<'schedule_exception'>
export type Patient = Tables<'patient'>
export type LegalGuardian = Tables<'legal_guardian'>
export type DocumentTemplate = Tables<'document_template'>
export type InformedConsent = Tables<'informed_consent'>
export type Appointment = Tables<'appointment'>
export type Session = Tables<'session'>
export type Anamnesis = Tables<'anamnesis'>
export type ProgressNote = Tables<'progress_note'>
export type TreatmentPlan = Tables<'treatment_plan'>