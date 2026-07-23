export type ProductClick = {
  id: string;
  created_at?: string;
  source?: string;
  device_type?: string;
  referrer_host?: string | null;
};

export type ProductStatus = "draft" | "review" | "published" | "paused" | "sold_out" | "link_error";
export type ProductLinkStatus = "unchecked" | "healthy" | "broken" | "sold_out";

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  affiliate_url: string;
  platform: string | null;
  price_text: string | null;
  category: string;
  status: ProductStatus;
  is_public: boolean;
  is_featured: boolean;
  quality_score: number;
  target_audience: string | null;
  selling_points: string[] | null;
  usage_tips: string | null;
  cautions: string | null;
  short_video_url: string | null;
  long_video_url: string | null;
  review_url: string | null;
  link_status: ProductLinkStatus;
  price_checked_at: string | null;
  published_at: string | null;
  updated_at: string;
  created_at: string;
  product_clicks?: ProductClick[];
};

export type ProductFormValues = {
  title: string;
  description: string;
  image_url: string;
  affiliate_url: string;
  platform: string;
  price_text: string;
  category: string;
  status: ProductStatus;
  is_public: boolean;
  is_featured: boolean;
  quality_score: number;
  target_audience: string;
  selling_points: string;
  usage_tips: string;
  cautions: string;
  short_video_url: string;
  long_video_url: string;
  review_url: string;
  link_status: ProductLinkStatus;
};
