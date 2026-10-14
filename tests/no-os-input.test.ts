import { describe, expect, it } from "vitest"; // @ts-ignore Node types are intentionally not part of the application build
import fs from "node:fs"; // @ts-ignore Node types are intentionally not part of the application build
import path from "node:path";
declare const process: { cwd: () => string };
describe("no OS input", () => {
  it("has no prohibited input controls or listeners", () => {
    const root = path.resolve(process.cwd());
    const skips = [path.join(root, "src", "probe"), path.join(root, "src", "native")];
    const files = [path.join(root, "index.html"), ...walk(path.join(root, "src"), skips)];
    const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(text).not.toMatch(/<(input|textarea|select)\b/i);
    expect(text).not.toMatch(/contenteditable/i);
    expect(text).not.toMatch(
      /addEventListener\(\s*["'](keydown|keyup|keypress|input|beforeinput|paste|compositionstart)["']/,
    );
    expect(text).not.toMatch(/\.on(keydown|keyup|keypress|input|beforeinput|paste)\s*=/);
  });
  it("routes OS input only through field.ts and probe.ts", () => {
    const root = path.resolve(process.cwd());
    const matched = walk(path.join(root, "src"), [])
      .filter((file) => hasOsInput(file))
      .map((file) => path.relative(root, file).split(path.sep).join("/"));
    expect(matched.sort()).toEqual(["src/native/field.ts", "src/probe/probe.ts"]);
  });
});
function walk(dir: string, skips: string[]): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e: { isDirectory: () => boolean; name: string }) => {
      const child = path.join(dir, e.name);
      if (!e.isDirectory()) return [child];
      return skips.includes(child) ? [] : walk(child, skips);
    });
}
function hasOsInput(file: string): boolean {
  const text = fs.readFileSync(file, "utf8");
  return (
    /<(input|textarea|select)\b/i.test(text) ||
    /createElement\(\s*["']input["']/.test(text) ||
    /addEventListener\(\s*["'](keydown|input)["']/.test(text)
  );
}
