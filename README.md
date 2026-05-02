# Corona Quality — Full-Stack App

Next.js 14 + Supabase + Chart.js

---

## 🗂 Estructura de Archivos

```
corona-quality/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← Layout global (carga Chart.js)
│   │   ├── globals.css             ← Estilos globales (idénticos al HTML original)
│   │   ├── page.tsx                ← Dashboard del operario (/)
│   │   ├── admin/
│   │   │   └── page.tsx            ← Panel de administrador (/admin)
│   │   └── api/
│   │       ├── dates/route.ts      ← GET /api/dates
│   │       ├── upload/route.ts     ← POST /api/upload (bulk insert)
│   │       └── dashboard/route.ts  ← GET /api/dashboard?date=YYYY-MM-DD
│   └── lib/
│       ├── supabase.ts             ← Clientes de Supabase (anon + admin)
│       └── logic.ts                ← Constantes, tipos y funciones de negocio
├── supabase_schema.sql             ← ⚠️ Ejecutar en Supabase SQL Editor
├── .env.local                      ← Variables de entorno (NO subir a Git)
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## 🚀 Setup en 5 pasos

### 1. Crear proyecto en Supabase
1. Ir a https://app.supabase.com → New Project
2. Abrir **SQL Editor** y ejecutar todo el contenido de `supabase_schema.sql`

### 2. Configurar variables de entorno
Editar `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
ADMIN_PASSWORD=tu_password_secreto
```
Copiar estos valores desde: Supabase → Project Settings → API

### 3. Instalar dependencias y correr localmente
```bash
npm install
npm run dev
# → http://localhost:3000
```

### 4. Subir datos (Admin)
1. Ir a http://localhost:3000/admin
2. Ingresar la contraseña definida en `ADMIN_PASSWORD`
3. Seleccionar fecha de reporte
4. Elegir modo: **Sobrescribir** (limpia la fecha) o **Añadir** (acumula histórico)
5. Copiar datos desde Excel → pegar en la zona azul
6. Presionar **⬆ Subir registros**

### 5. Desplegar en Vercel
```bash
# Instalar Vercel CLI (si no lo tiene)
npm i -g vercel

# Deploy
vercel

# Configurar variables de entorno en Vercel Dashboard:
# Settings → Environment Variables → agregar las 4 variables de .env.local
```

---

## 🏗 Arquitectura de datos

```
Excel (2500 filas)
      ↓ Ctrl+V
   /admin (Next.js)
      ↓ POST /api/upload  (chunks de 500 filas)
   Supabase PostgreSQL
      ↓ GET /api/dashboard?date=...
   Agregación SQL en servidor
      ↓ JSON (~10KB)
   Dashboard operario (Chart.js)
```

**El operario NO procesa 2500 objetos.** Solo recibe los datos ya agregados por el servidor.

---

## 📊 Lógica de negocio

| Métrica | Fórmula |
|---|---|
| % Grado A Esmaltador | `BUENA / (BUENA + Desperdicio_Directo + RETRABAJO)` |
| % Defectos Terminados | `Desperdicio_Directo / Total` |
| % Raja | `Desp_defecto_1 / Total` |

**Defectos Directos:** 3, 5, 6, 7, 8, 9, 13, 15, 23, 25, 26, 30.1, 31, 32, 33, 35, 40

**Semáforo % Grado A:**
- 🟢 Verde: > 95%
- 🟡 Amarillo: 92–95%
- 🔴 Rojo: < 92%

---

## 🔐 Seguridad

- `/admin` tiene protección por contraseña en el cliente
- Todas las escrituras a Supabase pasan por `/api/upload` que verifica el header `x-admin-password`
- El `SUPABASE_SERVICE_ROLE_KEY` **nunca** se expone al navegador (solo lo usa el servidor Next.js)
- La clave anon de Supabase solo tiene permiso de SELECT (configurado en Row Level Security)
