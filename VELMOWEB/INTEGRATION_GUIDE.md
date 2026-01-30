# 🚀 GUIDE D'INTÉGRATION : MODULE VELMO SHOP (WEB MARKETPLACE)

**POUR L'AGENT RESPONSABLE DE L'INTÉGRATION :**
Ce document contient toutes les instructions nécessaires pour migrer le module "Boutique" (ShopPage) vers un site Vitrine ou Dashboard existant. Suis ces étapes scrupuleusement pour conserver le design "Cosmic", la réactivité mobile et la logique panier.

---

## 1. CONTEXTE DU MODULE
Ce module est une **Marketplace Web complète** permettant d'afficher les produits d'une boutique via son `slug` (ex: `/b/maboutique`).
- **Features** : Panier dynamique, Filtres, Recherche, Favoris, Modal Détail, WhatsApp Checkout, Mode Sombre/Clair.
- **Design** : Style "Cosmic Glassmorphism" avec corrections UX critiques pour Mobile (Centrage, Menus opaques).

---

## 2. LES FICHIERS À COPIER
Récupère les fichiers suivants dans l'arborescence source et place-les dans ton projet cible :

| Fichier Source | Destination Suggérée (Cible) | Description |
| :--- | :--- | :--- |
| `src/pages/ShopPage.tsx` | `src/components/Shop/ShopPage.tsx` | **Cœur du module**. Contient toute la logique UI/UX. |
| `src/index.css` | `src/styles/ShopStyles.css` | **Critique**. Contient tout le CSS, les variables, et les fix mobiles. |
| `src/lib/supabase.ts` | `src/lib/supabase.ts` | Client Supabase (si non existant dans la cible). |
| `public/velmo.svg` | `public/velmo.svg` | Logo officiel. |

---

## 3. DÉPENDANCES NÉCESSAIRES
Installe ces paquets dans le projet cible si ils ne sont pas présents :

```bash
npm install lucide-react framer-motion sonner @supabase/supabase-js
```

---

## 4. INTÉGRATION & ROUTING (Exemple React/Vite)

### A. Dans ton routeur (ex: `App.tsx`)
Ajoute une route qui capture le slug de la boutique.

```tsx
import ShopPage from './components/Shop/ShopPage';

// Dans tes routes :
<Route path="/b/:slug" element={<ShopPage />} />
```

### B. Gestion des Styles
**IMPORTANT :** Le fichier `ShopStyles.css` (anciennement `index.css`) contient des variables CSS (`:root`).
1. Importe ce fichier CSS **dans** `ShopPage.tsx` ou dans ton fichier racine.
2. Vérifie qu'il n'y a pas de conflit de nom de classe. Les classes critiques sont `.product-card`, `.cart-sheet`, `.cart-floating`.

---

## 5. VARIABLES D'ENVIRONNEMENT (.env)
Assure-toi que le projet cible a accès aux clés Supabase :

```env
VITE_SUPABASE_URL=ton_url_supabase
VITE_SUPABASE_ANON_KEY=ta_cle_anon
```

---

## 6. POINTS D'ATTENTION CRITIQUES (NE PAS CASSER !)

L'agent précédent a implémenté des correctifs UX majeurs qui doivent être préservés :

1.  **Mobile Centering (CSS Media Queries < 1200px)** :
    *   Le bouton paner flottant (`.cart-floating`) est forcé au **centre** (`left: 50%`).
    *   L'ouvrir de panier (`.cart-sheet`) est centré et opaque.
    *   *Ne pas remettre ces éléments à droite sur mobile.*

2.  **Modal Produit Opaque** :
    *   La classe `.product-modal` a un fond solide (`#121212` ou `#ffffff`). Ne pas remettre de transparence ici pour la lisibilité.

3.  **Contrôleur de Quantité sur Carte** :
    *   La logique dans `ShopPage.tsx` remplace le bouton "Ajouter" par `[-] Qte [+]` quand l'article est dans le panier. Conserver cette logique.

4.  **Logo & Favicon** :
    *   Le fichier `velmo.svg` est un V blanc sur fond Orange.

---

**FIN DU GUIDE**
Si tu suis ces instructions, la boutique fonctionnera instantanément dans le nouveau site.
