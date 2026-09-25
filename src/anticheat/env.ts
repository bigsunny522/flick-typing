export type EnvSnapshot = {
  userAgent: string;
  maxTouchPoints: number;
  coarsePointer: boolean;
  webdriver: boolean;
  uaData: { mobile: boolean; platform: string } | null;
  screenWidth: number;
  screenHeight: number;
};
export type EnvVerdict = { kind: "ok" | "notPhone" | "automation"; reasons: string[] };

export function collectEnv(): EnvSnapshot {
  const navigatorWithUaData = navigator as Navigator & {
    userAgentData?: { mobile: boolean; platform: string };
  };
  const uaData = navigatorWithUaData.userAgentData;
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    webdriver: navigator.webdriver === true,
    uaData: uaData ? { mobile: uaData.mobile, platform: uaData.platform } : null,
    screenWidth: screen.width,
    screenHeight: screen.height,
  };
}

export function checkEnv(snapshot: EnvSnapshot): EnvVerdict {
  const automation: string[] = [];
  const notPhone: string[] = [];
  if (snapshot.webdriver) automation.push("webdriver");
  if (snapshot.maxTouchPoints === 0 || !snapshot.coarsePointer) notPhone.push("no-touch");
  const iphone = /iPhone/.test(snapshot.userAgent);
  const androidMobile = /Android.+Mobile/.test(snapshot.userAgent);
  if (!iphone && !androidMobile) notPhone.push("not-mobile-ua");
  if (/Macintosh/.test(snapshot.userAgent) && snapshot.maxTouchPoints > 1)
    notPhone.push("ipad-desktop-ua");
  if (Math.min(snapshot.screenWidth, snapshot.screenHeight) > 500) notPhone.push("tablet-size");
  if (snapshot.uaData && !snapshot.uaData.mobile) notPhone.push("uadata-not-mobile");
  if (iphone && snapshot.uaData) notPhone.push("ios-with-uadata");
  if (
    /Android/.test(snapshot.userAgent) &&
    snapshot.uaData?.platform !== undefined &&
    snapshot.uaData.platform !== "Android"
  )
    notPhone.push("android-platform-mismatch");
  if (automation.length > 0) return { kind: "automation", reasons: [...automation, ...notPhone] };
  return notPhone.length > 0
    ? { kind: "notPhone", reasons: notPhone }
    : { kind: "ok", reasons: [] };
}
