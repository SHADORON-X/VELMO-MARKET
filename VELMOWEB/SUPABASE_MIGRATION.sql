-- ============================================================
-- 🚀 VELMO MARKETPLACE - SUPABASE MIGRATION SCRIPT
-- ============================================================
-- Ce script ajoute toutes les colonnes et tables nécessaires
-- pour synchroniser le site web vitrine avec les apps Mobile/Desktop
-- 
-- À exécuter dans: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- 📦 PARTIE 1: MISE À JOUR TABLE "shops"
-- ============================================================
-- Ajout des colonnes pour le profil boutique public

-- Image de couverture (bannière style Facebook)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Localisation de la boutique (adresse affichée)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS location TEXT;

-- Numéro de téléphone principal
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone TEXT;

-- Numéro WhatsApp (peut être différent du téléphone)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Horaires d'ouverture (format libre, ex: "Lun-Sam 8h-18h")
ALTER TABLE shops ADD COLUMN IF NOT EXISTS opening_hours TEXT;

-- Boutique vérifiée par Velmo (badge de confiance)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Compteur de commandes (pour badge "+500 commandes")
ALTER TABLE shops ADD COLUMN IF NOT EXISTS orders_count INTEGER DEFAULT 0;

-- Commentez les valeurs par défaut si besoin:
COMMENT ON COLUMN shops.location IS 'Adresse publique affichée sur la vitrine';
COMMENT ON COLUMN shops.phone IS 'Numéro de téléphone principal de la boutique';
COMMENT ON COLUMN shops.whatsapp IS 'Numéro WhatsApp pour contact direct (avec indicatif pays, ex: 224622123456)';
COMMENT ON COLUMN shops.opening_hours IS 'Horaires affichés (format libre)';
COMMENT ON COLUMN shops.is_verified IS 'Badge boutique vérifiée Velmo';
COMMENT ON COLUMN shops.orders_count IS 'Nombre total de commandes reçues (mis à jour automatiquement)';


-- ============================================================
-- 📦 PARTIE 2: MISE À JOUR TABLE "products"
-- ============================================================
-- Ajout des colonnes pour gestion de stock et popularité

-- Quantité en stock (null = stock non géré)
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;

-- Produit populaire/mis en avant
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- Date de création (pour filtre "nouveautés")
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN products.stock_quantity IS 'Quantité en stock. NULL = stock illimité/non géré';
COMMENT ON COLUMN products.is_popular IS 'Produit mis en avant avec badge Populaire';
COMMENT ON COLUMN products.created_at IS 'Date de création pour filtre nouveautés';


-- ============================================================
-- 📦 PARTIE 3: TABLE "customer_orders" (COMMANDES CLIENT)
-- ============================================================
-- Table pour stocker les commandes passées via le site web

CREATE TABLE IF NOT EXISTS customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Référence à la boutique
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Informations client (pas de compte requis)
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    
    -- Détails de la commande (JSON array)
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Format: [{"id": "...", "name": "...", "price": 1000, "quantity": 2}, ...]
    
    -- Montant total
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    -- Mode de livraison
    delivery_method TEXT CHECK (delivery_method IN ('pickup', 'delivery')) DEFAULT 'pickup',
    
    -- Note/message du client
    order_note TEXT,
    
    -- Statut de la commande
    status TEXT CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Métadonnées (source, device, etc.)
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index pour recherche rapide par boutique
CREATE INDEX IF NOT EXISTS idx_customer_orders_shop_id ON customer_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON customer_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_phone ON customer_orders(customer_phone);

COMMENT ON TABLE customer_orders IS 'Commandes passées via la vitrine web Velmo';


-- ============================================================
-- 📦 PARTIE 4: TABLE "order_notifications" (NOTIFICATIONS)
-- ============================================================
-- Notifications push pour les apps Mobile/Desktop

CREATE TABLE IF NOT EXISTS order_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Référence à la boutique et commande
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    order_id UUID REFERENCES customer_orders(id) ON DELETE CASCADE,
    
    -- Destinataire (owner de la boutique)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Type de notification
    type TEXT CHECK (type IN (
        'new_order',           -- Nouvelle commande
        'order_confirmed',     -- Commande confirmée
        'order_cancelled',     -- Commande annulée
        'low_stock',           -- Stock faible
        'out_of_stock'         -- Rupture de stock
    )) NOT NULL,
    
    -- Contenu
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    
    -- Données supplémentaires (pour deep linking)
    data JSONB DEFAULT '{}'::jsonb,
    
    -- Statut de lecture
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_notifications_shop_id ON order_notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_user_id ON order_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_is_read ON order_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_order_notifications_created_at ON order_notifications(created_at DESC);

COMMENT ON TABLE order_notifications IS 'Notifications pour les apps Mobile/Desktop';


-- ============================================================
-- 📦 PARTIE 5: TABLE "customer_favorites" (FAVORIS CLIENT)
-- ============================================================
-- Favoris sauvegardés côté serveur (optionnel, par téléphone)

CREATE TABLE IF NOT EXISTS customer_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identification par téléphone (pas de compte)
    customer_phone TEXT NOT NULL,
    
    -- Produit favori
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Contrainte unique: un produit par client
    UNIQUE(customer_phone, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_phone ON customer_favorites(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_shop ON customer_favorites(shop_id);


-- ============================================================
-- 🔐 PARTIE 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;

-- 📋 CUSTOMER_ORDERS Policies

-- Les clients (anonymes) peuvent créer des commandes
CREATE POLICY "Anyone can create orders" ON customer_orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Le propriétaire de la boutique peut voir ses commandes
CREATE POLICY "Shop owner can view orders" ON customer_orders
    FOR SELECT TO authenticated
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE owner_id = auth.uid()
        )
    );

-- Le propriétaire peut mettre à jour le statut
CREATE POLICY "Shop owner can update order status" ON customer_orders
    FOR UPDATE TO authenticated
    USING (
        shop_id IN (
            SELECT id FROM shops WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        shop_id IN (
            SELECT id FROM shops WHERE owner_id = auth.uid()
        )
    );

-- 📋 ORDER_NOTIFICATIONS Policies

-- Le propriétaire peut voir ses notifications
CREATE POLICY "User can view own notifications" ON order_notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Le propriétaire peut marquer comme lu
CREATE POLICY "User can update own notifications" ON order_notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Insertion via trigger ou fonction serveur
CREATE POLICY "System can insert notifications" ON order_notifications
    FOR INSERT TO service_role
    WITH CHECK (true);

-- 📋 CUSTOMER_FAVORITES Policies

-- N'importe qui peut créer des favoris
CREATE POLICY "Anyone can add favorites" ON customer_favorites
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- N'importe qui peut voir ses favoris (par téléphone)
CREATE POLICY "Anyone can view favorites by phone" ON customer_favorites
    FOR SELECT TO anon, authenticated
    USING (true);

-- Suppression par téléphone
CREATE POLICY "Anyone can delete own favorites" ON customer_favorites
    FOR DELETE TO anon, authenticated
    USING (true);


-- ============================================================
-- ⚡ PARTIE 7: TRIGGERS & FONCTIONS AUTOMATIQUES
-- ============================================================

-- Fonction pour créer une notification lors d'une nouvelle commande
CREATE OR REPLACE FUNCTION create_order_notification()
RETURNS TRIGGER AS $$
DECLARE
    shop_owner_id UUID;
    shop_name TEXT;
    item_count INTEGER;
BEGIN
    -- Récupérer le propriétaire de la boutique
    SELECT owner_id, name INTO shop_owner_id, shop_name
    FROM shops WHERE id = NEW.shop_id;
    
    -- Compter les articles
    SELECT jsonb_array_length(NEW.items) INTO item_count;
    
    -- Créer la notification
    INSERT INTO order_notifications (
        shop_id,
        order_id,
        user_id,
        type,
        title,
        body,
        data
    ) VALUES (
        NEW.shop_id,
        NEW.id,
        shop_owner_id,
        'new_order',
        '📦 Nouvelle commande !',
        format('%s a commandé %s article(s) pour %s GNF', 
               NEW.customer_name, 
               item_count,
               NEW.total_amount::TEXT),
        jsonb_build_object(
            'order_id', NEW.id,
            'customer_name', NEW.customer_name,
            'customer_phone', NEW.customer_phone,
            'total_amount', NEW.total_amount,
            'delivery_method', NEW.delivery_method
        )
    );
    
    -- Incrémenter le compteur de commandes de la boutique
    UPDATE shops 
    SET orders_count = COALESCE(orders_count, 0) + 1
    WHERE id = NEW.shop_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_new_order_notification ON customer_orders;
CREATE TRIGGER trigger_new_order_notification
    AFTER INSERT ON customer_orders
    FOR EACH ROW
    EXECUTE FUNCTION create_order_notification();


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


-- ============================================================
-- 📊 PARTIE 8: VUES UTILES (OPTIONNEL)
-- ============================================================

-- Vue pour les commandes avec détails boutique
CREATE OR REPLACE VIEW v_orders_with_shop AS
SELECT 
    co.*,
    s.name as shop_name,
    s.slug as shop_slug,
    s.logo_url as shop_logo,
    s.owner_id as shop_owner_id
FROM customer_orders co
JOIN shops s ON co.shop_id = s.id;

-- Vue pour les notifications non lues
CREATE OR REPLACE VIEW v_unread_notifications AS
SELECT 
    n.*,
    s.name as shop_name,
    co.customer_name,
    co.total_amount as order_total
FROM order_notifications n
LEFT JOIN shops s ON n.shop_id = s.id
LEFT JOIN customer_orders co ON n.order_id = co.id
WHERE n.is_read = false;


-- ============================================================
-- ✅ FIN DU SCRIPT
-- ============================================================

-- Vérification: Lister les nouvelles tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customer_orders', 'order_notifications', 'customer_favorites');

-- Vérification: Lister les nouvelles colonnes de shops
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shops'
AND column_name IN ('location', 'phone', 'whatsapp', 'opening_hours', 'is_verified', 'orders_count');

-- Vérification: Lister les nouvelles colonnes de products
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('stock_quantity', 'is_popular', 'created_at');
