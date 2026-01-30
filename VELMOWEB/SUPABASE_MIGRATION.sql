-- ============================================================
-- 🚀 VELMO MARKETPLACE - SUPABASE MIGRATION SCRIPT v2.0
-- ============================================================
-- Conforme au rapport VELMO du 30 Janvier 2026
-- 
-- À exécuter dans: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- 📦 PARTIE 1: TABLE "shops" (PROFIL BOUTIQUE)
-- ============================================================

-- Vérifier et ajouter les colonnes manquantes
ALTER TABLE shops ADD COLUMN IF NOT EXISTS velmo_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS category TEXT;

-- Images
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS cover TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_icon TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS logo_color TEXT;

-- Contact & Localisation
ALTER TABLE shops ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Horaires
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_hours TEXT;

-- Réseaux sociaux
ALTER TABLE shops ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Livraison
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_info TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS return_policy TEXT;

-- Statuts
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Statistiques
ALTER TABLE shops ADD COLUMN IF NOT EXISTS orders_count INTEGER DEFAULT 0;

-- Timestamps
ALTER TABLE shops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE shops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index critiques
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_slug_unique 
ON shops (slug) WHERE slug IS NOT NULL AND slug != '';

CREATE INDEX IF NOT EXISTS idx_shops_is_public 
ON shops(is_public) WHERE is_public = true;


-- ============================================================
-- 📦 PARTIE 2: TABLE "products" (CATALOGUE)
-- ============================================================

-- Vérifier et ajouter les colonnes manquantes
ALTER TABLE products ADD COLUMN IF NOT EXISTS velmo_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pièce';

-- Prix
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_sale NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_buy NUMERIC DEFAULT 0;

-- Stock
ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_alert INTEGER DEFAULT 5;

-- Image
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Statuts
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_incomplete BOOLEAN DEFAULT false;

-- Timestamps
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;


-- ============================================================
-- 📦 PARTIE 3: TABLE "customer_orders" (COMMANDES WEB)
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    
    -- Informations client
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    
    -- Commande (items_json conforme au rapport)
    total_amount NUMERIC DEFAULT 0,
    items_json JSONB DEFAULT '[]'::JSONB,
    
    -- Livraison
    delivery_method TEXT DEFAULT 'pickup',
    order_note TEXT,
    
    -- Statut
    status TEXT DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

-- 🛡️ SAFETY: S'assurer que les colonnes existent même si la table existait déjà
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS items_json JSONB DEFAULT '[]'::JSONB;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS order_note TEXT;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Index
CREATE INDEX IF NOT EXISTS idx_customer_orders_shop_id ON customer_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON customer_orders(created_at DESC);


-- ============================================================
-- 🔐 PARTIE 4: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Activer RLS
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

-- ✅ PUBLIC: Lecture boutiques publiques
DROP POLICY IF EXISTS "Public can read public shops" ON shops;
CREATE POLICY "Public can read public shops" ON shops
FOR SELECT TO anon, authenticated
USING (is_public = true);

-- ✅ PUBLIC: Lecture produits des boutiques publiques
DROP POLICY IF EXISTS "Public can read products of public shops" ON products;
CREATE POLICY "Public can read products of public shops" ON products
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = products.shop_id
    AND shops.is_public = true
  )
);

-- ✅ PUBLIC: Création de commandes pour boutiques publiques
DROP POLICY IF EXISTS "Public can create web orders" ON customer_orders;
CREATE POLICY "Public can create web orders" ON customer_orders
FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_orders.shop_id
    AND shops.is_public = true
  )
);

-- 🔒 PRIVÉ: Lecture commandes (propriétaire uniquement)
DROP POLICY IF EXISTS "Shop owners can read their web orders" ON customer_orders;
CREATE POLICY "Shop owners can read their web orders" ON customer_orders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_orders.shop_id
    AND shops.owner_id = auth.uid()
  )
);

-- 🔒 PRIVÉ: Mise à jour commandes (propriétaire uniquement)
DROP POLICY IF EXISTS "Shop owners can update their web orders" ON customer_orders;
CREATE POLICY "Shop owners can update their web orders" ON customer_orders
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_orders.shop_id
    AND shops.owner_id = auth.uid()
  )
);


-- ============================================================
-- � PARTIE 5: GRANTS
-- ============================================================

GRANT SELECT ON public.shops TO anon;
GRANT SELECT ON public.products TO anon;
GRANT INSERT ON public.customer_orders TO anon;
GRANT SELECT ON public.customer_orders TO authenticated;
GRANT UPDATE ON public.customer_orders TO authenticated;


-- ============================================================
-- ⚡ PARTIE 6: FONCTIONS & TRIGGERS
-- ============================================================

-- Fonction pour générer un slug unique
CREATE OR REPLACE FUNCTION generate_unique_slug(shop_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    new_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Nettoyer le nom pour créer un slug
    base_slug := lower(regexp_replace(shop_name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
    
    new_slug := base_slug;
    
    -- Vérifier l'unicité et incrémenter si nécessaire
    WHILE EXISTS (SELECT 1 FROM shops WHERE slug = new_slug) LOOP
        counter := counter + 1;
        new_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN new_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer automatiquement un slug
CREATE OR REPLACE FUNCTION auto_generate_shop_slug()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le slug est vide, le générer
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_unique_slug(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_shop_slug ON shops;
CREATE TRIGGER trigger_auto_generate_shop_slug
    BEFORE INSERT OR UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_shop_slug();

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour customer_orders
DROP TRIGGER IF EXISTS trigger_update_customer_orders_updated_at ON customer_orders;
CREATE TRIGGER trigger_update_customer_orders_updated_at
    BEFORE UPDATE ON customer_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour incrémenter orders_count
CREATE OR REPLACE FUNCTION increment_shop_orders_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE shops 
    SET orders_count = COALESCE(orders_count, 0) + 1
    WHERE id = NEW.shop_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_orders_count ON customer_orders;
CREATE TRIGGER trigger_increment_orders_count
    AFTER INSERT ON customer_orders
    FOR EACH ROW
    EXECUTE FUNCTION increment_shop_orders_count();


-- ============================================================
-- 📊 PARTIE 7: VÉRIFICATIONS
-- ============================================================

-- Lister les tables créées/modifiées
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('shops', 'products', 'customer_orders');

-- Vérifier les colonnes de shops
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shops'
AND column_name IN ('slug', 'is_public', 'logo', 'cover', 'whatsapp', 'location', 'opening_hours')
ORDER BY column_name;

-- Vérifier que customer_orders a items_json
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customer_orders'
AND column_name = 'items_json';


-- ============================================================
-- ✅ FIN DU SCRIPT
-- ============================================================
-- Si tout s'est bien passé, les boutiques avec is_public = true
-- seront accessibles via velmo.market/{slug}
-- ============================================================
