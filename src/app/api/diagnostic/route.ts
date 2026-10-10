import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const cwd = process.cwd();
  
  function listSafe(dir: string) {
    try {
      if (!fs.existsSync(dir)) return { exists: false };
      const items = fs.readdirSync(dir);
      return { exists: true, items };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // Find any .png files in /home/u209580425/
  function findPngs(dir: string, depth = 0): string[] {
    if (depth > 4) return [];
    let results: string[] = [];
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item === "node_modules" || item === ".next") continue;
        const full = path.join(dir, item);
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            results = results.concat(findPngs(full, depth + 1));
          } else if (item.endsWith(".png") || item.endsWith(".jpeg") || item.endsWith(".jpg")) {
            results.push(full);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    return results;
  }

  const foundImages = findPngs("/home/u209580425/domains/dearr.in");

  return NextResponse.json({
    cwd,
    homeItems: listSafe("/home/u209580425/domains/dearr.in"),
    hbuilds: listSafe("/home/u209580425/domains/dearr.in/hbuilds"),
    versions: listSafe("/home/u209580425/domains/dearr.in/hbuilds/versions"),
    foundImages,
  });
}
