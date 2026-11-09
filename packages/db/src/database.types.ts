export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      alert_events: {
        Row: {
          alert_id: string;
          delivery: Json;
          id: string;
          triggered_at: string;
          user_id: string;
          value_at_trigger: number;
        };
        Insert: {
          alert_id: string;
          delivery?: Json;
          id?: string;
          triggered_at?: string;
          user_id: string;
          value_at_trigger: number;
        };
        Update: {
          alert_id?: string;
          delivery?: Json;
          id?: string;
          triggered_at?: string;
          user_id?: string;
          value_at_trigger?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'alert_events_alert_id_fkey';
            columns: ['alert_id'];
            isOneToOne: false;
            referencedRelation: 'alerts';
            referencedColumns: ['id'];
          },
        ];
      };
      alerts: {
        Row: {
          channels: string[];
          created_at: string;
          id: string;
          instrument_id: string;
          last_triggered_at: string | null;
          status: Database['public']['Enums']['alert_status'];
          threshold: number;
          type: Database['public']['Enums']['alert_type'];
          user_id: string;
        };
        Insert: {
          channels?: string[];
          created_at?: string;
          id?: string;
          instrument_id: string;
          last_triggered_at?: string | null;
          status?: Database['public']['Enums']['alert_status'];
          threshold: number;
          type: Database['public']['Enums']['alert_type'];
          user_id?: string;
        };
        Update: {
          channels?: string[];
          created_at?: string;
          id?: string;
          instrument_id?: string;
          last_triggered_at?: string | null;
          status?: Database['public']['Enums']['alert_status'];
          threshold?: number;
          type?: Database['public']['Enums']['alert_type'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alerts_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_movements: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          instrument_id: string | null;
          kind: Database['public']['Enums']['cash_kind'];
          note: string | null;
          occurred_on: string;
          portfolio_id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          instrument_id?: string | null;
          kind: Database['public']['Enums']['cash_kind'];
          note?: string | null;
          occurred_on: string;
          portfolio_id: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          instrument_id?: string | null;
          kind?: Database['public']['Enums']['cash_kind'];
          note?: string | null;
          occurred_on?: string;
          portfolio_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_movements_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_movements_portfolio_fk';
            columns: ['portfolio_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'portfolios';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      instruments: {
        Row: {
          created_at: string;
          currency: string;
          exchange: string | null;
          id: string;
          isin: string | null;
          name: string;
          yahoo_symbol: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          exchange?: string | null;
          id?: string;
          isin?: string | null;
          name: string;
          yahoo_symbol: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          exchange?: string | null;
          id?: string;
          isin?: string | null;
          name?: string;
          yahoo_symbol?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          note: string | null;
          used_at: string | null;
          used_by: string | null;
          used_email: string | null;
        };
        Insert: {
          code?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          note?: string | null;
          used_at?: string | null;
          used_by?: string | null;
          used_email?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          note?: string | null;
          used_at?: string | null;
          used_by?: string | null;
          used_email?: string | null;
        };
        Relationships: [];
      };
      market_data_version: {
        Row: {
          id: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          created_at: string;
          executed_at: string;
          fees: number;
          id: string;
          instrument_id: string;
          note: string | null;
          portfolio_id: string;
          quantity: number;
          side: Database['public']['Enums']['order_side'];
          unit_price: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          executed_at: string;
          fees?: number;
          id?: string;
          instrument_id: string;
          note?: string | null;
          portfolio_id: string;
          quantity: number;
          side: Database['public']['Enums']['order_side'];
          unit_price: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          executed_at?: string;
          fees?: number;
          id?: string;
          instrument_id?: string;
          note?: string | null;
          portfolio_id?: string;
          quantity?: number;
          side?: Database['public']['Enums']['order_side'];
          unit_price?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_portfolio_fk';
            columns: ['portfolio_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'portfolios';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      portfolios: {
        Row: {
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['portfolio_kind'];
          name: string;
          opened_on: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['portfolio_kind'];
          name: string;
          opened_on?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['portfolio_kind'];
          name?: string;
          opened_on?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      price_history: {
        Row: {
          close: number;
          date: string;
          instrument_id: string;
        };
        Insert: {
          close: number;
          date: string;
          instrument_id: string;
        };
        Update: {
          close?: number;
          date?: string;
          instrument_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'price_history_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          disabled_at: string | null;
          invited_by: string | null;
          is_admin: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          disabled_at?: string | null;
          invited_by?: string | null;
          is_admin?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          disabled_at?: string | null;
          invited_by?: string | null;
          is_admin?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      quotes_latest: {
        Row: {
          fetched_at: string;
          instrument_id: string;
          prev_close: number | null;
          price: number;
          quoted_at: string;
        };
        Insert: {
          fetched_at?: string;
          instrument_id: string;
          prev_close?: number | null;
          price: number;
          quoted_at: string;
        };
        Update: {
          fetched_at?: string;
          instrument_id?: string;
          prev_close?: number | null;
          price?: number;
          quoted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'quotes_latest_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: true;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      settings: {
        Row: {
          benchmark_symbol: string | null;
          discord_webhook_url: string | null;
          email: string | null;
          income_tax_rate: number;
          last_summary_on: string | null;
          social_tax_rate: number;
          summary_enabled: boolean;
          summary_time: string;
          user_id: string;
        };
        Insert: {
          benchmark_symbol?: string | null;
          discord_webhook_url?: string | null;
          email?: string | null;
          income_tax_rate?: number;
          last_summary_on?: string | null;
          social_tax_rate?: number;
          summary_enabled?: boolean;
          summary_time?: string;
          user_id?: string;
        };
        Update: {
          benchmark_symbol?: string | null;
          discord_webhook_url?: string | null;
          email?: string | null;
          income_tax_rate?: number;
          last_summary_on?: string | null;
          social_tax_rate?: number;
          summary_enabled?: boolean;
          summary_time?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      splits: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_on: string;
          id: string;
          instrument_id: string;
          ratio_from: number;
          ratio_to: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_on: string;
          id?: string;
          instrument_id: string;
          ratio_from: number;
          ratio_to: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_on?: string;
          id?: string;
          instrument_id?: string;
          ratio_from?: number;
          ratio_to?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'splits_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      user_instruments: {
        Row: {
          created_at: string;
          instrument_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          instrument_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          instrument_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_instruments_instrument_id_fkey';
            columns: ['instrument_id'];
            isOneToOne: false;
            referencedRelation: 'instruments';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_status: {
        Row: {
          failed: Json;
          id: number;
          last_cycle_at: string | null;
          last_error: string | null;
          last_poll_at: string | null;
        };
        Insert: {
          failed?: Json;
          id?: number;
          last_cycle_at?: string | null;
          last_error?: string | null;
          last_poll_at?: string | null;
        };
        Update: {
          failed?: Json;
          id?: number;
          last_cycle_at?: string | null;
          last_error?: string | null;
          last_poll_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      aal_ok: { Args: never; Returns: boolean };
      access_ok: { Args: never; Returns: boolean };
      admin_change_symbol: {
        Args: { p_instrument: string; p_name?: string; p_symbol: string };
        Returns: undefined;
      };
      admin_list_accounts: {
        Args: never;
        Returns: {
          created_at: string;
          disabled_at: string;
          email: string;
          has_mfa: boolean;
          is_admin: boolean;
          last_sign_in_at: string;
          orders_count: number;
          user_id: string;
        }[];
      };
      admin_set_disabled: {
        Args: { p_disabled: boolean; p_user: string };
        Returns: undefined;
      };
      admin_supervision: {
        Args: never;
        Returns: {
          fetched_at: string;
          followers: number;
          instrument_id: string;
          last_close_date: string;
          name: string;
          price: number;
          quoted_at: string;
          yahoo_symbol: string;
        }[];
      };
      assert_no_oversell: {
        Args: { p_instrument: string; p_portfolio: string };
        Returns: undefined;
      };
      delete_my_account: { Args: never; Returns: undefined };
      invitation_is_valid: { Args: { p_code: string }; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      set_instrument_isin: {
        Args: { p_instrument: string; p_isin: string };
        Returns: undefined;
      };
      split_factor: {
        Args: { p_at: string; p_instrument: string };
        Returns: number;
      };
      track_instrument: {
        Args: { p_exchange?: string; p_name?: string; p_symbol: string };
        Returns: string;
      };
    };
    Enums: {
      alert_status: 'active' | 'triggered' | 'paused';
      alert_type:
        | 'price_above'
        | 'price_below'
        | 'day_change_up'
        | 'day_change_down'
        | 'position_pl_above'
        | 'position_pl_below';
      cash_kind: 'deposit' | 'withdrawal' | 'dividend' | 'fee';
      order_side: 'buy' | 'sell';
      portfolio_kind: 'pea' | 'pea_pme' | 'cto';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_status: ['active', 'triggered', 'paused'],
      alert_type: [
        'price_above',
        'price_below',
        'day_change_up',
        'day_change_down',
        'position_pl_above',
        'position_pl_below',
      ],
      cash_kind: ['deposit', 'withdrawal', 'dividend', 'fee'],
      order_side: ['buy', 'sell'],
      portfolio_kind: ['pea', 'pea_pme', 'cto'],
    },
  },
} as const;
