export type AppListItem = {
  id: string;
  title: string;
  public_id: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  last_published_at?: string;
};

export type MeResponse = {
  ok: true;
  authenticated: boolean;
  user?: { id: number; email: string; is_verified?: boolean; created_at?: string };
};

export type SummaryResponse = {
  ok: true;
  range: { from: string; to: string; tz: string };
  kpi: Record<string, number>;
  profit: {
    revenue: number;
    reward_cost: number;
    cashback_cost: number;
    net_gain: number;
    roi: number;
  };
};

export type ActivityItem = {
  id?: number | string;
  ts?: string;
  type: string;
  tg_id?: string;
  username?: string;
  payload?: any;
  text?: string; // server-side humanized
};
