/**
 * Inline bootstrap script that sets `data-theme` on <html> before the page
 * paints. This is the standard pattern for avoiding theme-related FOUC in
 * Next.js apps.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem("pdfqa:theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=t||(d?"dark":"light");}catch(e){document.documentElement.dataset.theme="light";}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
