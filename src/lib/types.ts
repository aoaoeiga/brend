export interface Staff {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  cost_rate: number | null;
  created_at: string;
}

export interface Order {
  id: string;
  total: number;
  staff_id: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: (OrderItem & { menus: MenuItem })[];
  staffs: Staff;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
}

export interface Settings {
  id: string;
  pin_hash: string;
  store_name: string | null;
  store_info: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  menu: MenuItem;
  quantity: number;
}

export type Category = "fast_coffee" | "drip_coffee" | "other_drinks" | "food";

export const CATEGORY_LABELS: Record<string, string> = {
  all: "すべて",
  fast_coffee: "Fast Coffee",
  drip_coffee: "Drip Coffee",
  other_drinks: "Other Drinks",
  food: "Food",
};

export const CATEGORY_EMOJI: Record<string, string> = {
  fast_coffee: "☕",
  drip_coffee: "☕",
  other_drinks: "🍵",
  food: "🥐",
};
