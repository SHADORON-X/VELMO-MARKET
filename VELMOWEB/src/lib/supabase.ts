import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing! Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// ============================================================
// 📦 TYPES - Conformes au rapport VELMO
// ============================================================

export interface Shop {
  id: string;
  velmo_id?: string;
  owner_id?: string;

  // 📛 IDENTITÉ
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;

  // 📸 BRANDING (IMAGES)
  logo?: string | null;
  logo_url?: string | null;
  cover?: string | null;
  cover_url?: string | null;
  logo_icon?: string | null;
  logo_color?: string | null;

  // 📍 CONTACT & LOCALISATION
  address?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;

  // 🕐 HORAIRES
  opening_hours?: string | null;

  // 🌐 RÉSEAUX SOCIAUX
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  twitter_url?: string | null;
  website_url?: string | null;

  // 📦 INFORMATIONS LIVRAISON
  delivery_info?: string | null;
  return_policy?: string | null;

  // 🔘 STATUTS
  is_public: boolean;
  is_verified?: boolean;
  is_active?: boolean;

  // 📊 STATISTIQUES
  orders_count?: number;

  // 🔄 TIMESTAMPS
  created_at?: string;
  updated_at?: string;

  // 💰 DEVISE (legacy)
  currency?: string;
}

export interface Product {
  id: string;
  velmo_id?: string;
  shop_id: string;
  user_id?: string;

  // 📦 PRODUIT
  name: string;
  description?: string | null;
  category?: string | null;
  barcode?: string | null;
  unit?: string;

  // 💰 PRIX
  price_sale: number;
  price_buy?: number;

  // 📊 STOCK
  quantity?: number;
  stock_alert?: number;

  // 📸 IMAGE
  photo_url?: string | null;

  // 🔘 STATUTS
  is_active: boolean;
  is_incomplete?: boolean;

  // 🔄 TIMESTAMPS
  created_at?: string;
  updated_at?: string;
}

// Structure des items dans une commande (items_json)
export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  photo_url?: string | null;
}

export interface CustomerOrder {
  id?: string;
  short_ref?: string;
  shop_id: string;

  // 👤 INFORMATIONS CLIENT
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  customer_location?: { lat: number; lng: number } | null;

  // 💰 COMMANDE
  total_amount: number;
  items_json: OrderItem[];

  // 🚚 LIVRAISON
  delivery_method: 'pickup' | 'delivery';
  order_note?: string | null;

  // 📊 STATUT
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';

  // 🔄 TIMESTAMPS
  created_at?: string;
  updated_at?: string;
  confirmed_at?: string | null;
  delivered_at?: string | null;
}

export interface ShopEvent {
  id?: string;
  shop_id: string;
  session_id: string;
  event_type: 'visit' | 'view_product' | 'add_to_cart' | 'search' | 'category_click' | 'checkout_start' | 'checkout_success';
  product_id?: string;
  category?: string;
  search_query?: string;
  metadata?: any;
  created_at?: string;
}

