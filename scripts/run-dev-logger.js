#!/usr/bin/env node
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const logPath = path.join(projectRoot, "dev-server.log");

const nextBin = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");

const out = fs.createWriteStream(logPath, { flags: "a" });
const ts = () => new Date().toISOString();
out.write(`\n\n=== Next dev log started: ${ts()} ===\n`);
console.log(`Starting Next dev (logging to ${logPath})`);

const child = spawn(nextBin, ["dev"], { env: process.env, stdio: ["inherit", "pipe", "pipe"] });

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  out.write(chunk);
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  out.write(chunk);
});

const finish = (code, signal) => {
  const msg = `\n=== Next dev exited: code=${code} signal=${signal} at ${ts()} ===\n`;
  console.log(msg);
  out.write(msg);
  out.end();
  process.exit(typeof code === "number" ? code : 0);
};

child.on("close", finish);
child.on("exit", finish);

process.on("SIGINT", () => {
  child.kill("SIGINT");
});
