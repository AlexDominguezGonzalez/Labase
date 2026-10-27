import { NextResponse, type NextRequest } from "next/server"

/**
 * Protección con usuario y contraseña (HTTP Basic Auth) para toda la app,
 * páginas y endpoints. Se activa al definir ACCESO_USUARIO y ACCESO_CLAVE;
 * sin ellas no hace nada y, en producción, accesoPermitido() sigue bloqueando
 * los endpoints.
 */
export function proxy(req: NextRequest) {
  const usuario = process.env.ACCESO_USUARIO
  const clave = process.env.ACCESO_CLAVE
  if (!usuario || !clave) return NextResponse.next()

  const cabecera = req.headers.get("authorization") ?? ""
  if (cabecera.startsWith("Basic ")) {
    let credenciales = ""
    try {
      credenciales = atob(cabecera.slice(6))
    } catch {
      // Base64 mal formado: se trata como credenciales incorrectas.
    }
    const separador = credenciales.indexOf(":")
    if (
      separador !== -1 &&
      igualesEnTiempoConstante(credenciales.slice(0, separador), usuario) &&
      igualesEnTiempoConstante(credenciales.slice(separador + 1), clave)
    ) {
      return NextResponse.next()
    }
  }

  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BaseBig", charset="UTF-8"' },
  })
}

/** Evita revelar por el tiempo de respuesta cuántos caracteres coinciden. */
function igualesEnTiempoConstante(a: string, b: string) {
  const ca = new TextEncoder().encode(a)
  const cb = new TextEncoder().encode(b)
  let diferencia = ca.length ^ cb.length
  for (let i = 0; i < cb.length; i++) diferencia |= (ca[i] ?? 0) ^ cb[i]
  return diferencia === 0
}

export const config = {
  // Todo salvo los recursos estáticos que genera Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
