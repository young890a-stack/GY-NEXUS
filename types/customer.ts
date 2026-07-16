export type CustomerRole = "member" | "creator" | "admin";

export type CustomerProfile = {
  id: string;
  display_name: string;
  role: CustomerRole;
  interests: string[];
  avatar_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CustomerSummary = CustomerProfile & {
  email?: string;
  bookmark_count?: number;
  comment_count?: number;
  inquiry_count?: number;
};
