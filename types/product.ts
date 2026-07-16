export type ProductClick = { id: string; created_at?: string };

export type Product = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  affiliate_url: string;
  platform: string | null;
  price_text: string | null;
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
};
