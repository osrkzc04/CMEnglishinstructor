/**
 * Script inline anti-FOUC. Corre antes del hidratar para setear la clase `dark`
 * en el <html> según preferencia guardada. Así el primer frame ya sale con el
 * tema correcto y no hay flash bone→ink (o viceversa).
 *
 * Default global: claro. Solo se entra a oscuro si el usuario lo eligió
 * explícitamente (stored === 'dark') o si tiene 'system' guardado y su OS
 * está en oscuro. Los visitantes sin preferencia guardada — incluido el
 * candidato que rinde la evaluación, que no tiene nada en localStorage —
 * arrancan en claro.
 */
const script = `
(function() {
  try {
    var stored = localStorage.getItem('cm-theme');
    var theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
