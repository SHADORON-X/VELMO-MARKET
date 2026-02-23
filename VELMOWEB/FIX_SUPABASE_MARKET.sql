-- ============================================================
-- 🚀 FIX: ANALYTICS & WEB ORDERS PERMISSIONS
-- ============================================================

-- S'assurer que les colonnes nécessaires existent
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS orders_count INTEGER DEFAULT 0;

-- 1️⃣ TABLE: shop_analytics
CREATE TABLE IF NOT EXISTS shop_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    category TEXT,
    search_query TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ ENABLE RLS
ALTER TABLE shop_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

-- 3️⃣ POLICIES: shop_analytics
DROP POLICY IF EXISTS "Anyone can insert shop events" ON shop_analytics;
CREATE POLICY "Anyone can insert shop events" ON shop_analytics
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can view their shop analytics" ON shop_analytics;
CREATE POLICY "Owners can view their shop analytics" ON shop_analytics
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM shops
        WHERE shops.id = shop_analytics.shop_id
        AND shops.owner_id = auth.uid()
    )
);

-- 4️⃣ POLICIES: customer_orders (S'assurer que c'est ouvert)
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

-- 5️⃣ GRANTS
GRANT INSERT ON public.shop_analytics TO anon, authenticated;
GRANT SELECT ON public.shop_analytics TO authenticated;

GRANT INSERT ON public.customer_orders TO anon, authenticated;
GRANT SELECT ON public.customer_orders TO anon, authenticated; -- Permettre la lecture du statut par le client
GRANT SELECT ON public.shops TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;

-- 6️⃣ FIX: Forcer les boutiques existantes en public (optionnel mais recommandé pour les tests)
-- UPDATE shops SET is_public = true WHERE is_public IS FALSE OR is_public IS NULL;

-- ============================================================
-- ✅ SCRIPT TERMINÉ
-- ============================================================
