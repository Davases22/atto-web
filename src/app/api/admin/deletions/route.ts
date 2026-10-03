import { proxyToBackend } from "@/lib/admin-backend";

/**
 * Every deleted account, with who asked, who ran it and why. Read only: the
 * panel never deletes. Only the parameters the service understands are
 * forwarded.
 */
const PERMITIDOS = ["search", "limit", "offset"] as const;

export async function GET(req: Request) {
  const entrada = new URL(req.url).searchParams;
  const salida = new URLSearchParams();
  for (const clave of PERMITIDOS) {
    const valor = entrada.get(clave);
    if (valor !== null && valor !== "") salida.set(clave, valor);
  }
  const query = salida.toString();
  return proxyToBackend(`/users/admin/deletions${query ? `?${query}` : ""}`);
}
