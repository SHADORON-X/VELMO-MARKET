import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing! Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export interface Shop {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;  // 🆕 Cover image from Desktop
  description: string | null;
  is_public: boolean;
  currency: string;
  // 🆕 Marketplace Fields
  location?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  opening_hours?: string | null;
  is_verified?: boolean;
  orders_count?: number;
}

export interface Product {
  id: string;
  shop_id: string;
  name: string;
  price_sale: number; // Was price
  photo_url: string | null; // Was image_url
  is_active: boolean;
  is_visible: boolean;
  description: string | null;
  category: string | null;
  // 🆕 Marketplace Fields
  stock_quantity?: number | null;
  is_popular?: boolean;
  created_at?: string;
}

export interface CustomerOrder {
  shop_id: string;
  items: any[];
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  status: 'pending' | 'accepted' | 'rejected';
}
