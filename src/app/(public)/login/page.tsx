import { redirect } from "next/navigation"
import { getSessionUser } from "@/modules/auth/queries"
import { dashboardPathFor } from "@/modules/auth/role-paths"
import { BrandMark, BrandWordmark } from "@/components/layout/BrandMark"
import { LoginForm } from "./_components/LoginForm"
import { LoginTopbar } from "./_components/LoginTopbar"

/**
 * Login — replica design-mockups/Login.html.
 *
 * Shell: grid 1fr + 540px. Aside ink-900 con grid milimétrico + glow teal y la
 * quote editorial. Form panel bone con topbar (lang + theme) y formulario.
 */
export default async function LoginPage() {
  const user = await getSessionUser()
  if (user) redirect(dashboardPathFor(user.role))

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_540px]">
      <EditorialAside />
      <FormPanel />
    </div>
  )
}

// -----------------------------------------------------------------------------
//  Aside — chrome ink-900 con quote editorial
// -----------------------------------------------------------------------------

function EditorialAside() {
  return (
    <aside className="bg-ink-900 text-bone relative hidden overflow-hidden px-12 py-10 lg:flex lg:flex-col">
      {/* Grid milimétrico + glow teal radial — ::before y ::after del mockup */}
      <div aria-hidden className="login-grid-bg absolute inset-0" />
      <div aria-hidden className="login-glow absolute inset-0" />

      <div className="relative z-[1] flex h-full flex-col">
        {/* Top: BrandMark + wordmark */}
        <div className="flex items-center gap-3">
          <BrandMark className="text-bone" size={28} />
          <BrandWordmark className="text-bone" size="md" />
        </div>

        {/* Body: eyebrow + quote */}
        <div className="my-auto max-w-[460px] py-16">
          <div className="text-bone/55 mb-7 flex items-center gap-3 font-mono text-[11px] tracking-[0.12em] uppercase">
            <span>Plataforma académica</span>
            <span aria-hidden className="bg-bone/[0.18] h-px flex-1" />
          </div>

          <p className="text-bone m-0 font-serif text-[38px] leading-[1.18] font-light tracking-[-0.02em]">
            Helping <em className="font-normal text-teal-500 italic">everyone</em> communicate
            <span className="text-bone/40"> — </span>with rigor,
            <br />
            warmth and a serious love
            <br />
            for the right preposition
            <span className="text-bone/40">.</span>
          </p>
        </div>

        {/* Foot: version + soporte */}
        <div className="text-bone/50 flex items-end justify-between font-mono text-[11px] tracking-[0.06em] uppercase">
          <div className="flex flex-col gap-1">
            <span>v 1.0 · Plataforma académica</span>
            <span>© {new Date().getFullYear()} CM English Instructor</span>
          </div>
          <a
            href="mailto:soporte@​cmenglishinstructor.com"
            className="text-bone/70 transition-colors hover:text-teal-500"
          >
            Soporte
          </a>
        </div>
      </div>
    </aside>
  )
}

// -----------------------------------------------------------------------------
//  FormPanel — bone bg con topbar y formulario centrado
// -----------------------------------------------------------------------------

function FormPanel() {
  return (
    <section className="bg-background relative flex flex-col px-10 py-8">
      <LoginTopbar />

      <div className="flex flex-1 flex-col items-stretch justify-center pt-6 pb-8">
        <div className="mx-auto w-full max-w-[380px]">
          <BrandMark className="text-foreground mb-8" size={36} />

          <h1 className="text-foreground m-0 mb-1.5 font-serif text-[32px] leading-[1.18] font-normal tracking-[-0.02em]">
            Te damos la bienvenida <span className="text-text-2 font-light italic">de vuelta.</span>
          </h1>
          <p className="text-text-2 m-0 mb-9 text-[14px] leading-[1.6]">
            Iniciá sesión para acceder a tu plataforma.
          </p>

          <LoginForm />
        </div>
      </div>

      <FormFooter />
    </section>
  )
}

// -----------------------------------------------------------------------------
//  Footer del panel
// -----------------------------------------------------------------------------

function FormFooter() {
  return (
    <footer className="border-border text-text-3 flex items-center justify-between border-t pt-6 font-mono text-[11px] tracking-[0.06em] uppercase">
      <div className="flex items-center gap-2.5">
        <a href="/terminos" className="text-text-2 transition-colors hover:text-teal-500">
          Términos
        </a>
        <FooterDot />
        <a href="/privacidad" className="text-text-2 transition-colors hover:text-teal-500">
          Privacidad
        </a>
        <FooterDot />
        <a href="/contacto" className="text-text-2 transition-colors hover:text-teal-500">
          Contacto
        </a>
      </div>
      <span>​cmenglishinstructor.com</span>
    </footer>
  )
}

function FooterDot() {
  return <span aria-hidden className="bg-text-4 inline-block h-[3px] w-[3px] rounded-full" />
}
