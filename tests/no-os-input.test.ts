import { describe, expect, it } from "vitest"; // @ts-ignore Node types are intentionally not part of the application build
import fs from "node:fs"; // @ts-ignore Node types are intentionally not part of the application build
import path from "node:path";
declare const process: { cwd: () => string };
describe("no OS input", () => {
  it("has no prohibited input controls or listeners", () => {
    const root = path.resolve(process.cwd());
    const files = [path.join(root, "index.html"), ...walk(path.join(root, "src"))];
    const text = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    expect(text).not.toMatch(/<(input|textarea|select)\b/i);
    expect(text).not.toMatch(/contenteditable/i);
    expect(text).not.toMatch(
      /addEventListener\(\s*["'](keydown|keyup|keypress|input|beforeinput|paste|compositionstart)["']/,
    );
    expect(text).not.toMatch(/\.on(keydown|keyup|keypress|input|beforeinput|paste)\s*=/);
  });
});
function walk(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e: { isDirectory: () => boolean; name: string }) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
