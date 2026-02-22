"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var http = __toESM(require("http"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var AYESMAN_PORT = 45642;
var statusBarItem;
function activate(context) {
  console.log("[AYesMan] Extension Activated.");
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(zap) AYesMan: Wait...";
  statusBarItem.tooltip = "Model Quota - Initializing";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "POST" && req.url === "/ayesman-event") {
      let body = "";
      req.on("data", (chunk) => body += chunk.toString());
      req.on("end", () => {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok" }));
        try {
          const data = JSON.parse(body);
          if (data.type === "quotaUpdate") {
            const remaining = data.payload.remainingFraction;
            const model = data.payload.model;
            const percentage = Math.round(remaining * 100);
            statusBarItem.text = `$(color-mode) ${model}: ${percentage}%`;
            if (percentage < 20) {
              statusBarItem.color = new vscode.ThemeColor("errorForeground");
            } else {
              statusBarItem.color = void 0;
            }
          }
        } catch (e) {
          console.error("[AYesMan] Error parsing incoming body", e);
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(AYESMAN_PORT, "127.0.0.1", () => {
    console.log(`[AYesMan] HTTP Server listening on port ${AYESMAN_PORT}`);
  });
  context.subscriptions.push({ dispose: () => server.close() });
  patchCodeiumWebview(context);
  let disposable = vscode.commands.registerCommand("ayesman.patchIt", () => {
    patchCodeiumWebview(context, true);
  });
  context.subscriptions.push(disposable);
}
function patchCodeiumWebview(context, forcePrompt = false) {
  const codeiumExt = vscode.extensions.getExtension("google.antigravity") || vscode.extensions.getExtension("codeium.codeium");
  if (!codeiumExt) {
    if (forcePrompt) vscode.window.showErrorMessage("[AYesMan] Antigravity/Codeium extension not found.");
    return;
  }
  const extPath = codeiumExt.extensionPath;
  const possiblePaths = [
    path.join(extPath, "out", "media", "chat.js"),
    // Antigravity IDE path
    path.join(extPath, "dist", "webview", "index.js"),
    path.join(extPath, "dist", "chat", "index.js"),
    path.join(extPath, "dist", "panel", "index.js")
  ];
  let targetFile = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      targetFile = p;
      break;
    }
  }
  if (!targetFile) {
    if (forcePrompt) vscode.window.showErrorMessage("[AYesMan] Could not find Codeium webview JS file.");
    return;
  }
  try {
    const content = fs.readFileSync(targetFile, "utf8");
    if (content.includes("__ayesman_injected")) {
      if (forcePrompt) vscode.window.showInformationMessage("[AYesMan] Patch already applied!");
      return;
    }
    const injectScriptPath = path.join(context.extensionPath, "src", "ayesman-inject.js");
    if (!fs.existsSync(injectScriptPath)) {
      console.error("[AYesMan] inject script not found at", injectScriptPath);
      return;
    }
    let scriptContent = fs.readFileSync(injectScriptPath, "utf8");
    const appendedContent = content + `

// AYESMAN INJECTION START
try {
${scriptContent}
} catch(e) { console.error('AYesMan inject failed', e); }
// AYESMAN INJECTION END
`;
    fs.writeFileSync(targetFile, appendedContent, "utf8");
    vscode.window.showInformationMessage('[AYesMan] Successfully patched Codeium webview! Please "Developer: Reload Window" to apply.', "Reload Window").then((res) => {
      if (res === "Reload Window") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
  } catch (e) {
    console.error("[AYesMan] Failed to patch Webview JS:", e);
    if (forcePrompt) vscode.window.showErrorMessage("[AYesMan] Failed to patch file: " + e.message);
  }
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
