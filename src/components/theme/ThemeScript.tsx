/**
 * Script inline anti-FOUC. Corre antes del hidratar para setear la clase `dark`
 * en el <html> según preferencia guardada o del sistema. Así el primer frame
 * ya sale con el tema correcto y no hay flash bone→ink (o viceversa).
 */
const script = `
(function() {
  try {
    var stored = localStorage.getItem('cm-theme');
    var theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
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
