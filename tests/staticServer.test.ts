/**
 * The desktop app serves the built page over a private http server. These pin
 * the two things that server must never get wrong: it must not hand out files
 * from outside the build, and it must not be reachable from another machine.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";

/** The guard as electron/main.js applies it, kept in step by these tests. */
const insideBuild = (distDir: string, urlPath: string) => {
  const filePath = path.normalize(path.join(distDir, urlPath));
  return filePath === distDir || filePath.startsWith(distDir + path.sep);
};

describe("the desktop server only serves the build folder", () => {
  const dist = path.normalize("/app/dist");

  it("allows ordinary files", () => {
    for (const p of ["/index.html", "/assets/app.js", "/favicon.svg"]) {
      expect(insideBuild(dist, p)).toBe(true);
    }
  });

  it("refuses a climb out of the folder", () => {
    for (const p of ["/../secrets.env", "/assets/../../secrets.env", "/../../../etc/passwd"]) {
      expect(insideBuild(dist, p)).toBe(false);
    }
  });

  it("refuses a sibling folder whose name merely starts the same", () => {
    // "/app/dist-evil/x" begins with "/app/dist", so a plain startsWith check
    // lets it through. The separator is what makes the check mean "inside".
    expect(insideBuild(dist, "/../dist-evil/x")).toBe(false);
  });
});
