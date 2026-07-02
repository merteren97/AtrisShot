import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const serviceRoot = process.cwd();
const source = path.resolve(serviceRoot, "../../apps/landing/out");
const destination = path.resolve(serviceRoot, "public");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
