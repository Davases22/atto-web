import { proxyToBackend } from "@/lib/admin-backend";

/**
 * La lista de usuarios registrados en el app, para el panel de operador.
 *
 * Solo pasa los parámetros que el servicio entiende, y con su propio nombre:
 * reenviar la query entera dejaría que el navegador colara cualquier cosa en
 * la URL del backend.
 */
const PERMITIDOS = ["search", "role", "managed", "limit", "offset"] as const;

export async function GET(req: Request) {
  const entrada = new URL(req.url).searchParams;
  const salida = new URLSearchParams();
  for (const clave of PERMITIDOS) {
    const valor = entrada.get(clave);
    if (valor !== null && valor !== "") salida.set(clave, valor);
  }
  const query = salida.toString();
  return proxyToBackend(`/users/admin${query ? `?${query}` : ""}`);
}
