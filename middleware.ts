import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/panel-auth";

// En este dominio TODO es panel, asi que todo pide sesion.
const PANEL_HOST = "smart.breadman.studio";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const esSmart = host.startsWith(PANEL_HOST);
  const esPanel = pathname.startsWith("/panel");

  // Fuera del panel (la web publica de breadman.studio) no se pide sesion
  if (!esSmart && !esPanel) {
    return NextResponse.next();
  }

  // La pantalla de login siempre queda accesible
  if (pathname === "/panel/login" || (esSmart && pathname === "/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const username = await verifySessionToken(token);

  if (!username) {
    const loginUrl = new URL("/panel/login", req.url);
    const destino = esSmart && !esPanel
      ? "/panel" + (pathname === "/" ? "" : pathname)
      : pathname;
    loginUrl.searchParams.set("next", destino);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Corre en todas las paginas, menos archivos internos, api e imagenes
  matcher: ["/((?!_next/|api/|favicon|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)"],
};
