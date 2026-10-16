/**
 * `?debug` を効かせてよい場所か。
 * `dev` は `import.meta.env.DEV`、`hostname` は `location.hostname`
 */
export function isDebugAllowed(dev: boolean, hostname: string): boolean {
  if (dev) return true;
  if (!hostname.endsWith(".workers.dev")) return false;
  const firstLabel = hostname.split(".")[0] ?? "";
  return firstLabel.endsWith("-flick-typing");
}
