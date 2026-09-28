import { NextResponse } from "next/server";
import { adminHeaders, backendUrl, configMissing } from "@/lib/admin-backend";

/**
 * La lista de usuarios en CSV, con el mismo filtro que la pantalla.
 *
 * Como el de la waitlist: lo que se ve es lo que se baja, pero con TODAS las
 * filas que cumplen el filtro y no solo la página en pantalla. La diferencia
 * es de dónde salen: la waitlist consulta su propia tabla, y esto tiene que
 * pedírselo al user service, que pagina. Así que recorre las páginas hasta
 * juntarlas todas.
 */
const POR_PAGINA = 200;
/**
 * Tope de páginas. Con 200 por página son cuarenta mil cuentas, y si algún día
 * se pasa de ahí este no es el camino: sería una exportación en diferido y no
 * una petición que espera el navegador.
 */
const MAX_PAGINAS = 200;

interface FilaBackend {
  id: number;
  username: string;
  displayName: string;
  creatorName?: string | null;
  email?: string | null;
  phone?: string | null;
  role: string;
  location?: string | null;
  profileVerified: boolean;
  isManagedAccount: boolean;
  representativeId?: number | null;
  followersCount: number;
  postsCount: number;
  createdAt: string;
}

interface RespuestaBackend {
  success?: boolean;
  data?: { users?: FilaBackend[]; total?: number };
}

/** Escapado RFC 4180: entrecomilla si el valor trae coma, comilla o salto. */
function campo(valor: unknown): string {
  const s = valor == null ? "" : String(valor);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CABECERA = [
  "id",
  "username",
  "display_name",
  "creator_name",
  "email",
  "phone",
  "role",
  "managed_account",
  "representative_id",
  "verified",
  "location",
  "followers",
  "posts",
  "registered_at",
];

export async function GET(req: Request) {
  const guard = configMissing();
  if (guard) return guard;

  const entrada = new URL(req.url).searchParams;
  const base = new URLSearchParams();
  for (const clave of ["search", "role", "managed"] as const) {
    const valor = entrada.get(clave);
    if (valor) base.set(clave, valor);
  }

  const filas: FilaBackend[] = [];
  try {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const params = new URLSearchParams(base);
      params.set("limit", String(POR_PAGINA));
      params.set("offset", String(pagina * POR_PAGINA));
      const res = await fetch(backendUrl(`/users/admin?${params.toString()}`), {
        headers: adminHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Backend request failed (${res.status})` },
          { status: res.status }
        );
      }
      const cuerpo = (await res.json()) as RespuestaBackend;
      const lote = cuerpo.data?.users ?? [];
      filas.push(...lote);
      const total = cuerpo.data?.total ?? filas.length;
      if (lote.length === 0 || filas.length >= total) break;
    }
  } catch (err) {
    console.error("[/api/admin/users/export] failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 502 });
  }

  const lineas = [
    CABECERA.join(","),
    ...filas.map((u) =>
      [
        u.id,
        u.username,
        u.displayName,
        u.creatorName ?? "",
        u.email ?? "",
        u.phone ?? "",
        u.role,
        u.isManagedAccount ? "yes" : "no",
        u.representativeId ?? "",
        u.profileVerified ? "yes" : "no",
        u.location ?? "",
        u.followersCount,
        u.postsCount,
        u.createdAt ? new Date(u.createdAt).toISOString() : "",
      ]
        .map(campo)
        .join(",")
    ),
  ];
  // Con BOM, para que Excel abra bien los nombres con tildes.
  const csv = "﻿" + lineas.join("\r\n");
  const sello = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atto-users-${sello}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
