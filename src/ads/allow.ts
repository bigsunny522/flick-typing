/** 広告を出す本番のホスト名 */
export const AD_HOSTNAME = "flicktypinggame.xyzack271.com";

/** 広告を出してよい場所か。`hostname` は `location.hostname` */
export function isAdAllowed(hostname: string): boolean {
  return hostname === AD_HOSTNAME;
}
