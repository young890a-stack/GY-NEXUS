export type Channel = "wordpress" | "webhook" | "manual";

export type TrendProduct = {
  title: string;
  description?: string;
  image_url?: string;
  affiliate_url: string;
  platform?: string;
  price_text?: string;
  source_name?: string;
  external_rank?: number;
  external_score?: number;
};

export type PublishPayload = {
  title: string;
  content: string;
  channel: Channel;
  scheduledAt?: string | null;
};
