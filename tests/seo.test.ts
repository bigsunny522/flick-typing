import { describe, expect, it } from "vitest"; // @ts-ignore Node types are intentionally not part of the application build
import fs from "node:fs"; // @ts-ignore Node types are intentionally not part of the application build
import path from "node:path";
declare const process: { cwd: () => string };

const root = path.resolve(process.cwd());
const title = "ふりっくタイピング｜スマホのフリック入力タイピングゲーム";
const description =
  "フリック入力だけで遊ぶスマホ用のタイピングゲーム。60秒のタイムアタックでフリック入力の速さを練習できます。" +
  "青空文庫の名作で競う「今日の耐久」とランキングも。無料・登録不要。";
const canonical = "https://flicktypinggame.xyzack271.com/";
const statsUrl = "https://flicktypinggame.xyzack271.com/stats";

const index = read("index.html");
const stats = read("stats.html");
const robots = read("public/robots.txt");
const sitemap = read("public/sitemap.xml");

function read(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function value(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1] ?? "";
}

function metaDescription(text: string): string {
  return value(text, /<meta[^>]*name="description"[^>]*content="([^"]*)"/);
}

function canonicalUrl(text: string): string {
  const link = text.match(/<link[^>]*rel="canonical"[^>]*>/)?.[0] ?? "";
  return value(link, /href="([^"]*)"/);
}

function jsonLdRaw(text: string): string {
  return value(text, /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
}

interface JsonLdNode {
  "@type"?: string;
  name?: string;
  alternateName?: string[];
  url?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  inLanguage?: string;
  image?: string;
  offers?: { "@type"?: string; price?: string; priceCurrency?: string };
}

function jsonLdGraph(text: string): JsonLdNode[] {
  const raw = jsonLdRaw(text);
  expect(raw).not.toBe("");
  const data = JSON.parse(raw) as { "@graph"?: JsonLdNode[] };
  return data["@graph"] ?? [];
}

function jsonLdNode(text: string, type: string): JsonLdNode {
  const matched = jsonLdGraph(text).filter((node) => node["@type"] === type);
  expect(matched).toHaveLength(1);
  return matched[0];
}

describe("seo", () => {
  it("index.html の title が仕様の値", () => {
    expect(value(index, /<title>([^<]*)<\/title>/)).toBe(title);
  });
  it("index.html の canonical が正規の URL", () => {
    expect(canonicalUrl(index)).toBe(canonical);
  });
  it("index.html の description と og / twitter の description が同じ文字列", () => {
    const og = value(index, /<meta[^>]*property="og:description"[^>]*content="([^"]*)"/);
    const twitter = value(index, /<meta[^>]*name="twitter:description"[^>]*content="([^"]*)"/);
    expect(metaDescription(index)).toBe(description);
    expect(og).toBe(description);
    expect(twitter).toBe(description);
  });
  it("index.html の JSON-LD を JSON.parse でき、@graph に WebSite と WebApplication が1つずつある", () => {
    const graph = jsonLdGraph(index);
    expect(graph.filter((node) => node["@type"] === "WebSite")).toHaveLength(1);
    expect(graph.filter((node) => node["@type"] === "WebApplication")).toHaveLength(1);
  });
  it("index.html の JSON-LD の WebSite の name と alternateName が仕様の値", () => {
    const site = jsonLdNode(index, "WebSite");
    expect(site.name).toBe("ふりっくタイピング");
    expect(site.alternateName).toContain("フリックタイピング");
  });
  it("index.html の JSON-LD の WebSite と WebApplication の url が canonical と同じ", () => {
    expect(jsonLdNode(index, "WebSite").url).toBe(canonical);
    expect(jsonLdNode(index, "WebApplication").url).toBe(canonical);
  });
  it("index.html の JSON-LD の WebApplication の description が meta description と同じ", () => {
    const app = jsonLdNode(index, "WebApplication");
    expect(app.description).toBe(metaDescription(index));
  });
  it("index.html の JSON-LD の WebApplication の他の項目がそのまま残る", () => {
    const app = jsonLdNode(index, "WebApplication");
    expect(app.name).toBe("ふりっくタイピング");
    expect(app.alternateName).toContain("フリックタイピング");
    expect(app.applicationCategory).toBe("GameApplication");
    expect(app.operatingSystem).toBe("iOS, Android");
    expect(app.inLanguage).toBe("ja");
    expect(app.image).toBe("https://flicktypinggame.xyzack271.com/ogp.png");
    expect(app.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "JPY" });
  });
  it("index.html の noscript の中に h1 がある", () => {
    const noscript = index.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[0] ?? "";
    expect(noscript).toContain("<h1>");
  });
  it("stats.html の canonical が og:url と同じ", () => {
    const ogUrl = value(stats, /<meta[^>]*property="og:url"[^>]*content="([^"]*)"/);
    expect(ogUrl).toBe(statsUrl);
    expect(canonicalUrl(stats)).toBe(ogUrl);
  });
  it("public/robots.txt が /api/ を止め、サイトマップを指す", () => {
    const lines = robots.split("\n").map((line) => line.trim());
    expect(lines).toContain("Disallow: /api/");
    expect(lines).toContain(`Sitemap: ${canonical}sitemap.xml`);
  });
  it("public/sitemap.xml の loc がトップと stats の2つだけ", () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
    expect(locs).toEqual([canonical, statsUrl]);
  });
});
