# CLAUDE.md — Memoria permanente de PPLE.TCG Next.js

> Leer este archivo al inicio de cada sesión. Actualizar cuando el schema o el estado cambien.

---

## 1. INSTRUCCIONES DE COMPORTAMIENTO

- **Leer siempre el archivo completo antes de editar.** Nunca editar a ciegas.
- **Verificar nombres de columnas contra el schema de este documento** antes de escribir cualquier query Supabase.
- **Hacer upsert en `profiles` antes de insertar en `portfolio`** (FK constraint: portfolio.user_id → profiles.id).
- **Nunca inventar columnas** que no estén listadas en el schema de este documento.
- **Consultar el proyecto legacy** (`C:\Users\javie\pple-tcg`) como referencia de diseño, lógica de negocio y flujos de usuario.
- **No romper código que funciona.** Si hay que refactorizar, proponer el cambio antes de hacerlo.
- **Nunca exponer claves secretas en el frontend.** Variables de entorno en `.env.local`, nunca en código fuente.
- **No asumir que el schema remoto coincide con lo que hay aquí.** Si hay dudas, preguntar al usuario o verificar en Supabase dashboard.

---

## 2. DESCRIPCIÓN DEL PRODUCTO

**PPLE.TCG** es un marketplace español de cartas coleccionables de Pokémon TCG.

### Funcionalidades core:
- **Marketplace**: comprar/vender cartas individuales (raw y slabs gradeadas PSA)
- **Portfolio**: gestión de colección personal con condición, cantidad y precio pagado
- **Órdenes**: flujo de compra con protección al comprador (3%), verificación (AI 2%, humana 5%, Beckett)
- **Mensajería**: chat en tiempo real entre comprador y vendedor con contexto de carta
- **Ofertas de compra** (buy offers): compradores publican precio deseado por una carta
- **Seguimiento**: tracking de pedidos (pending → shipped → delivered)
- **Perfiles de vendedor**: reputación, ventas, valoraciones
- **Verificación**: IA automática, manual, PRE, Beckett

### API externa de cartas:
- **TCGdex API**: `https://api.tcgdex.net/v2/en/` — datos de cartas Pokémon (sets, cartas, imágenes)
- Precios vía Cardmarket: `pricing.cardmarket.trend / avg / low / avg1 / avg7 / avg30`

### Idioma: Español (España)
### Usuarios objetivo: coleccionistas y vendedores de habla hispana

---

## 3. STACK Y CONFIGURACIÓN

### Next.js Project (`C:\Users\javie\pple-tcg-next`)
```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "@supabase/ssr": "^0.9.0",
  "@supabase/supabase-js": "^2.98.0",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "eslint": "^9",
  "eslint-config-next": "16.1.6"
}
```

### Comandos
```bash
npm run dev    # localhost:3000
npm run build  # build de producción
npm run lint   # ESLint
```

### Configuración
- **jsconfig.json**: alias `@/*` → `./src/*`
- **postcss.config.mjs**: Tailwind CSS plugin
- **Supabase**: `@supabase/ssr` para cookies SSR (no usar `@supabase/auth-helpers-nextjs`, está deprecated)
- **Fonts**: Geist Sans + Geist Mono (Google Fonts via `next/font/google`)

### Despliegue
- **git push** → Vercel despliega automáticamente en ~10s
- Branch principal: `main`
- Usuario de prueba: `javiermportoles2@gmail.com`

### Variables de entorno necesarias (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://iijreiuecodmqlcvhapp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key — nunca en código fuente>
```

> ⚠️ La clave `sb_publishable_XmQgiY0xFENpn4-6YXUoJA_gEovC6U8` del legacy está expuesta en sb.js. En Next.js usar siempre variables de entorno.

---

## 4. SCHEMA COMPLETO

> Reconstruido de las queries reales del proyecto legacy. No existe supabase-schema.sql en el repo. Verificar en el dashboard de Supabase si hay dudas.

### Tabla: `profiles`
```sql
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id),
  username    text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `username`, `avatar_url`, `bio`, `created_at`

**Operaciones**:
- `upsert({ id, username }, { onConflict: 'id' })` — siempre antes de insertar en portfolio
- `select('id, username, avatar_url').in('id', userIds)` — para cargar usernames en mensajes
- `select('username, avatar_url, bio, created_at').eq('id', profileId).single()` — perfil de vendedor

---

### Tabla: `listings`
```sql
CREATE TABLE listings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid REFERENCES profiles(id),
  card_id      text NOT NULL,
  card_name    text,
  card_set     text,
  card_image   text,
  condition    text CHECK (condition IN ('NM','LP','MP','PSA10','PSA9','PSA8')),
  display_type text CHECK (display_type IN ('raw','slab')),
  price        numeric NOT NULL,
  description  text,
  psa_cert     text,
  sold         boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `seller_id`, `card_id`, `card_name`, `card_set`, `card_image`, `condition`, `display_type`, `price`, `description`, `psa_cert`, `sold`, `created_at`

---

### Tabla: `portfolio`
```sql
CREATE TABLE portfolio (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id),
  card_id      text NOT NULL,
  card_name    text,
  card_set     text,
  card_image   text,
  condition    text CHECK (condition IN ('NM','LP','MP','PSA10','PSA9','PSA8')),
  display_type text CHECK (display_type IN ('raw','slab')),
  paid_price   numeric,        -- precio pagado por la carta (usado en portfolio.html)
  quantity     integer DEFAULT 1, -- cantidad (usado en vender.html)
  status       text CHECK (status IN ('owned','for_sale')),
  cert         text,           -- certificado (PSA u otro)
  created_at   timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `user_id`, `card_id`, `card_name`, `card_set`, `card_image`, `condition`, `display_type`, `paid_price`, `quantity`, `status`, `cert`, `created_at`

---

### Tabla: `orders`
```sql
CREATE TABLE orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id             uuid REFERENCES profiles(id),
  seller_id            uuid REFERENCES profiles(id),
  listing_id           uuid REFERENCES listings(id),
  card_id              text,
  price                numeric,               -- precio simple (usado en pple-tcg.html y mensajes)
  price_card           numeric,               -- precio de carta (usado en checkout)
  shipping_price       numeric,               -- precio envío (usado en checkout)
  verification_type    text,                  -- 'none'|'ai'|'human'|'beckett'
  verification_fee     numeric,
  buyer_protection_fee numeric,
  total_price          numeric,               -- total con fees (usado en checkout)
  verification         text,                  -- campo alternativo (usado en pple-tcg.html)
  status               text CHECK (status IN ('pending_payment','pending','shipped','delivered')),
  source               text,                  -- 'offer' | 'buy_offer' (cuando viene de oferta)
  offer_id             uuid,                  -- referencia a buy_offers si source='buy_offer'
  created_at           timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `buyer_id`, `seller_id`, `listing_id`, `card_id`, `price`, `price_card`, `shipping_price`, `verification_type`, `verification_fee`, `buyer_protection_fee`, `total_price`, `verification`, `status`, `source`, `offer_id`, `created_at`

---

### Tabla: `buy_offers`
```sql
CREATE TABLE buy_offers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    text NOT NULL,
  user_id    uuid REFERENCES profiles(id),
  price      numeric NOT NULL,
  condition  text CHECK (condition IN ('NM','LP','MP','PSA10','PSA9','PSA8')),
  status     text CHECK (status IN ('open','accepted')) DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `card_id`, `user_id`, `price`, `condition`, `status`, `created_at`

---

### Tabla: `conversations`
```sql
CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   uuid REFERENCES profiles(id),
  seller_id  uuid REFERENCES profiles(id),
  listing_id uuid REFERENCES listings(id),
  updated_at timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `buyer_id`, `seller_id`, `listing_id`, `updated_at`

---

### Tabla: `messages`
```sql
CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id),
  sender_id       uuid REFERENCES profiles(id),
  text            text NOT NULL,
  created_at      timestamptz DEFAULT now()
);
```
**Columnas exactas usadas en queries**: `id`, `conversation_id`, `sender_id`, `text`, `created_at`

---

### Relaciones (foreign keys usadas en .select con join)
```javascript
// listings → profiles (seller)
.select('*, profiles:seller_id(username)')

// orders → listings + profiles
.select('*, listing:listing_id(card_name, card_set, card_image), seller:seller_id(username), buyer:buyer_id(username)')

// conversations → listings
.select(`id, buyer_id, seller_id, listing_id, updated_at,
         listing:listing_id(id, card_id, card_name, card_set, card_image, condition, price, display_type)`)
```

---

### Valores de enum usados

| Campo | Valores válidos |
|-------|----------------|
| condition | `'NM'`, `'LP'`, `'MP'`, `'PSA10'`, `'PSA9'`, `'PSA8'` |
| display_type | `'raw'`, `'slab'` |
| status (orders) | `'pending_payment'`, `'pending'`, `'shipped'`, `'delivered'` |
| status (buy_offers) | `'open'`, `'accepted'` |
| status (portfolio) | `'owned'`, `'for_sale'` |
| verification_type | `'none'`, `'ai'`, `'human'`, `'beckett'` |
| source (orders) | `'offer'`, `'buy_offer'` |

---

## 5. ERRORES CONOCIDOS — NUNCA REPETIR

### ❌ Error 1: Inconsistencia en columna de precio de orders
**Problema**: La tabla `orders` tiene DOS nombres para el precio:
- `price` — usado en `pple-tcg.html` y `pple-tcg-mensajes.html` (insert simple)
- `price_card` — usado en `pple-tcg-checkout.html` (insert con desglose completo)

**Regla**: Al insertar una orden, decidir si es un insert simple (`price`) o completo (`price_card + shipping_price + verification_fee + buyer_protection_fee + total_price`). **No mezclar ambos en el mismo insert.**

---

### ❌ Error 2: portfolio.paid_price vs portfolio.quantity — columnas que no coexisten en todos los inserts
**Problema**: `pple-tcg-portfolio.html` inserta en portfolio con `paid_price` pero sin `quantity` ni `status`. `pple-tcg-vender.html` inserta con `quantity` y `status` pero sin `paid_price`.

**Regla**: La tabla tiene AMBAS columnas. Siempre incluir las dos: `paid_price` (puede ser null si no se conoce) y `quantity` (default 1) y `status` en cada insert.

```javascript
// CORRECTO — siempre incluir todos los campos relevantes
await sb.from('portfolio').insert({
  user_id, card_id, card_name, card_set, card_image,
  condition, display_type,
  paid_price: null,   // o el valor real
  quantity: 1,
  status: 'owned'
})
```

---

### ❌ Error 3: FK violation — insertar en portfolio sin upsert previo en profiles
**Problema**: `portfolio.user_id` es FK a `profiles.id`. Si el usuario existe en `auth.users` pero no en `profiles`, el insert falla con FK violation.

**Regla OBLIGATORIA**: Siempre hacer upsert en profiles antes de cualquier insert en portfolio:
```javascript
await sb.from('profiles').upsert(
  { id: user.id, username: user.email?.split('@')[0] || user.id.slice(0,8) },
  { onConflict: 'id' }
)
// LUEGO insertar en portfolio
```

---

### ❌ Error 4: Columna `verification` vs `verification_type` en orders
**Problema**: `pple-tcg.html` usa `verification` en el insert de orders, pero `pple-tcg-checkout.html` usa `verification_type`.

**Regla**: En el proyecto Next.js, **usar siempre `verification_type`** (nombre más descriptivo y consistente con `verification_fee`).

---

### ❌ Error 5: Clave Supabase expuesta en sb.js del legacy
**Problema**: La clave `sb_publishable_XmQgiY0xFENpn4-6YXUoJA_gEovC6U8` está hardcodeada en `sb.js`.

**Regla Next.js**: **Siempre usar `.env.local`**. Nunca hardcodear claves en ningún archivo de código fuente.

---

### ❌ Error 6: Usar `@supabase/auth-helpers-nextjs` (deprecated)
**Regla**: Usar **`@supabase/ssr`** para crear el cliente Supabase en Next.js App Router.

```javascript
// CORRECTO — src/lib/supabase/client.js
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

// CORRECTO — src/lib/supabase/server.js (para Server Components)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export const createClient = async () => {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (ca) => ca.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}
```

---

## 6. DISEÑO Y TOKENS

### Paleta de colores (del CSS legacy — mantener consistencia)
```css
:root {
  /* Fondos */
  --bg:      #08080d;   /* fondo principal */
  --bg2:     #0e0e16;   /* fondo secundario */
  --surface:  #11111c;  /* superficies (cards, modales) */
  --surface2: #181825;  /* superficies secundarias */

  /* Bordes */
  --border:  #22223a;
  --border2: #2d2d4a;

  /* Acento principal — Lima neón */
  --accent:      #d4f53c;
  --accent-glow: rgba(212,245,60,0.15);
  --accent-dim:  rgba(212,245,60,0.06);

  /* Texto */
  --text:  #eeeef8;   /* texto principal */
  --text2: #9898b8;   /* texto secundario */
  --text3: #55556a;   /* texto terciario / placeholder */

  /* Condiciones */
  --nm:    #2ed573;  /* Near Mint — verde */
  --lp:    #ffa502;  /* Lightly Played — naranja */
  --mp:    #ff4757;  /* Moderately Played — rojo */
  --nm-bg: rgba(46,213,115,0.08);
  --lp-bg: rgba(255,165,2,0.08);
  --mp-bg: rgba(255,71,87,0.08);

  /* Grados PSA */
  --psa10: #d4f53c;  /* PSA 10 — Lima (igual que accent) */
  --psa9:  #38bdf8;  /* PSA 9  — Cyan */
  --psa8:  #a78bfa;  /* PSA 8  — Violeta */

  /* Sellado */
  --sealed:    #f59e0b;
  --sealed-bg: rgba(245,158,11,0.08);

  /* Tipografía */
  --font-display: 'Bebas Neue', sans-serif;    /* títulos grandes */
  --font-mono:    'DM Mono', monospace;        /* labels, precios, IDs */
  --font-body:    'Plus Jakarta Sans', sans-serif; /* cuerpo */
}
```

### En Next.js / Tailwind 4
Definir los tokens como variables CSS en `globals.css` y referenciarlas desde Tailwind. Mantener el estilo oscuro y el acento lima neón `#d4f53c` como identidad visual de la marca.

### Efectos visuales del legacy (replicar en Next.js)
- Grain overlay: SVG `feTurbulence` filter sobre pseudo-elemento
- Backdrop blur: `backdrop-filter: blur(24px)` en overlays y navs
- Radial gradients para glows del acento
- Transiciones suaves: `0.15s ease` / `0.2s ease`
- Dot pulsante para indicadores "en vivo"

---

## 7. RUTAS Y ESTADO ACTUAL

### Next.js (`C:\Users\javie\pple-tcg-next`) — Estado: BOILERPLATE
| Ruta | Archivo | Estado | Supabase |
|------|---------|--------|----------|
| `/` | `src/app/page.js` | Template Create Next App | ❌ No conectado |

**Todo está por implementar en Next.js.** El proyecto está en estado inicial.

### Legacy (`C:\Users\javie\pple-tcg`) — Estado: FUNCIONAL
| Página | Archivo | Estado | Supabase |
|--------|---------|--------|----------|
| Marketplace | `pple-tcg.html` | ✅ Funcional | ✅ Real |
| Auth | `pple-tcg-auth.html` | ✅ Funcional | ✅ Real |
| Portfolio | `pple-tcg-portfolio.html` | ✅ Funcional | ✅ Real |
| Buscar | `pple-tcg-buscar.html` | ✅ UI completa | ⚠️ Parcial |
| Vender | `pple-tcg-vender.html` | ✅ Funcional | ✅ Real |
| Checkout | `pple-tcg-checkout.html` | ✅ Funcional | ✅ Real |
| Perfil | `pple-tcg-perfil.html` | ✅ Funcional | ✅ Real |
| Mensajes | `pple-tcg-mensajes.html` | ✅ Funcional | ✅ Real + Realtime |
| Seguimiento | `pple-tcg-seguimiento.html` | ✅ Funcional | ✅ Real |
| Verificación | `pple-tcg-verificacion.html` | ✅ UI info | ⚠️ Sin lógica |
| Reset password | `pple-tcg-reset.html` | ✅ Funcional | ✅ Real |
| Order confirmation | `order-confirmation.html` | ✅ Funcional | ✅ Real |

---

## 8. ROADMAP PENDIENTE

### Alta prioridad — Migración Next.js
- [ ] Configurar Supabase SSR con middleware de autenticación
- [ ] `/auth` — Página de login/registro (espejo de pple-tcg-auth.html)
- [ ] `/` — Marketplace principal (espejo de pple-tcg.html)
- [ ] `/portfolio` — Portfolio del usuario (espejo de pple-tcg-portfolio.html)
- [ ] `/vender` — Crear listing (espejo de pple-tcg-vender.html)
- [ ] `/checkout/[listingId]` — Compra (espejo de pple-tcg-checkout.html)
- [ ] `/perfil/[userId]` — Perfil de vendedor
- [ ] `/mensajes` — Chat en tiempo real
- [ ] `/pedido/[orderId]` — Seguimiento de pedido

### Media prioridad
- [ ] **Stripe** — Pagos reales (actualmente sin pasarela de pago)
- [ ] **SEO pages**: `/carta/[id]` y `/set/[id]` — páginas indexables por carta y set
- [ ] **Valoraciones post-venta** — sistema de reviews después de entrega
- [ ] **Notificaciones email** — Supabase Edge Functions o Resend

### Baja prioridad
- [ ] **Panel de administración** — gestión de usuarios, listings, verificaciones
- [ ] **Sistema de verificación real** — integración con Beckett API o flujo manual

---

## 9. FLUJO DE TRABAJO

```bash
# Desarrollo local
npm run dev        # → http://localhost:3000

# Despliegue
git add .
git commit -m "feat: descripción"
git push           # Vercel despliega automáticamente en ~10s
```

### Credenciales de prueba
- **Email**: `javiermportoles2@gmail.com`
- **Proyecto Supabase**: `https://iijreiuecodmqlcvhapp.supabase.co`

### Referencia legacy
- **Código fuente**: `C:\Users\javie\pple-tcg\`
- **Supabase legacy client**: `C:\Users\javie\pple-tcg\sb.js`
- Siempre consultar el legacy para entender la lógica de negocio y los flujos de UI antes de implementar en Next.js

### Arquitectura Supabase en Next.js (App Router)
```
src/
├── app/
│   ├── layout.js
│   ├── page.js
│   ├── auth/page.js
│   ├── portfolio/page.js
│   └── ...
├── lib/
│   └── supabase/
│       ├── client.js    # createBrowserClient (componentes cliente)
│       └── server.js    # createServerClient (server components, API routes)
└── middleware.js         # refresh session en cada request
```

---

*Última actualización: 2026-03-09. Actualizar este archivo cuando cambien el schema, las rutas o el stack.*
