# Recacor Dashboard Demo

Dashboard web con Next.js para visualizar y aceptar incidencias creadas por chatbot de WhatsApp (n8n) persistidas en PostgreSQL.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Validación con Zod
- Auth propia con `usuarios` + `bcryptjs`
- Sesión por cookie httpOnly con JWT firmado (`jose`)

## Configuración local

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env.local` a partir de `.env.example`:

```env
DATABASE_URL=postgresql://n8n:n8npass@100.118.76.11:5432/roadside_demo
AUTH_SECRET=pon-un-secreto-largo
N8N_ACCEPT_WEBHOOK_URL=https://tu-n8n/webhook/accept
```

3. Genera cliente Prisma:

```bash
npm run prisma:generate
```

4. Ejecuta en desarrollo:

```bash
npm run dev
```

## Seed opcional (manual)

No se ejecuta automáticamente. Crea admin por defecto:

- email: `admin@demo.com`
- password: `Admin123!`
- rol: `admin`
- activo: `true`

Comando:

```bash
npm run seed
```

## API principal

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/incidencias`
- `GET /api/incidencias/:id`
- `POST /api/incidencias/:id/accept`
- `GET /api/talleres`
- `GET/POST /api/usuarios` (admin)
- `PATCH /api/usuarios/:id` (admin)

## n8n webhook de aceptación

Variable: `N8N_ACCEPT_WEBHOOK_URL`

Payload enviado por el backend:

```json
{
  "incidenciaId": "uuid",
  "telefono": "string",
  "tallerId": "uuid",
  "tallerNombre": "string",
  "mensaje": "incidencia aceptada"
}
```

Si el webhook falla, la aceptación queda guardada en DB y la API devuelve `200` con `warning`.

## Despliegue en Vercel

1. Sube el repositorio.
2. En Vercel, configura variables de entorno:
   - `DATABASE_URL` (Postgres gestionado: Neon/Supabase/Railway)
   - `AUTH_SECRET`
   - `N8N_ACCEPT_WEBHOOK_URL`
3. Ejecuta build (`npm run build`) en Vercel.

Importante: en producción no usar `localhost` ni nombres de servicio Docker en `DATABASE_URL`.
