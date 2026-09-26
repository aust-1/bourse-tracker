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
      orders: {
        Row: {
          created_at: string;
          executed_at: string;
          fees: number;
          id: string;
          instrument_id: string;
          note: string | null;
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
        ];
      };
      portfolio_snapshots: {
        Row: {
          cost_basis: number;
          date: string;
          market_value: number;
          realized_pl: number;
          user_id: string;
        };
        Insert: {
          cost_basis: number;
          date: string;
          market_value: number;
          realized_pl: number;
          user_id: string;
        };
        Update: {
          cost_basis?: number;
          date?: string;
          market_value?: number;
          realized_pl?: number;
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
          discord_webhook_url: string | null;
          email: string | null;
          last_summary_on: string | null;
          summary_enabled: boolean;
          summary_time: string;
          user_id: string;
        };
        Insert: {
          discord_webhook_url?: string | null;
          email?: string | null;
          last_summary_on?: string | null;
          summary_enabled?: boolean;
          summary_time?: string;
          user_id?: string;
        };
        Update: {
          discord_webhook_url?: string | null;
          email?: string | null;
          last_summary_on?: string | null;
          summary_enabled?: boolean;
          summary_time?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      worker_status: {
        Row: {
          id: number;
          last_cycle_at: string | null;
          last_error: string | null;
        };
        Insert: {
          id?: number;
          last_cycle_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          id?: number;
          last_cycle_at?: string | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assert_no_oversell: {
        Args: { p_instrument: string; p_user: string };
        Returns: undefined;
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
      order_side: 'buy' | 'sell';
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
      order_side: ['buy', 'sell'],
    },
  },
} as const;
