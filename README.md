This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## CRM: base de datos y login

El CRM es el único módulo cuyos datos tienen que sobrevivir al deploy, así que
vive en **Turso** (SQLite hosteado) en vez del archivo local. Y como maneja
datos de clientes, **todo el dashboard queda detrás de un login** de un solo
usuario.

Sin variables de entorno configuradas, en tu máquina todo sigue funcionando como
antes: el CRM usa `data/dashboard.db` y no hay login.

### Variables de entorno

| Variable | Para qué | Dónde |
|---|---|---|
| `TURSO_DATABASE_URL` | Base del CRM (`libsql://…`). Sin ella se usa el archivo local. | Turso |
| `TURSO_AUTH_TOKEN` | Token de esa base. | Turso |
| `AUTH_EMAIL` | El mail con el que entrás. | vos |
| `AUTH_PASSWORD_HASH` | Hash PBKDF2 de tu contraseña (`pbkdf2:iters:salt:hash`). | `npm run auth:setup` |
| `AUTH_SECRET` | Firma la cookie de sesión. | `npm run auth:setup` |

En local van en `.env.local` (ignorado por git). En Vercel se cargan con
`vercel env add <VARIABLE> production`.

> El hash usa `:` como separador y no `$` a propósito: los archivos `.env` de
> Next expanden `$VARIABLE` y romperían el valor.

### Puesta en marcha

1. Crear la base en [turso.tech](https://turso.tech) y copiar URL y token.
2. `npm run auth:setup` — pide email y contraseña, imprime el hash y el secreto.
3. Pegar las cinco variables en `.env.local` y cargarlas también en Vercel.
4. `npm run db:migrate` — crea la tabla `clientes` en Turso y siembra los
   ejemplos si está vacía. Es idempotente; con `-- --reseed` reinicia los datos.
5. `vercel deploy --prod --yes`.

El deploy de este proyecto **no sale del push a git**: hay que correr el comando
de Vercel a mano.
