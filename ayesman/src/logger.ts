import * as vscode from "vscode";

let _channel: vscode.OutputChannel | undefined;

export function initOutputChannel(): vscode.OutputChannel {
  if (!_channel) {
    _channel = vscode.window.createOutputChannel("AYesMan");
  }
  return _channel;
}

export function getOutputChannel(): vscode.OutputChannel {
  if (!_channel) {
    _channel = vscode.window.createOutputChannel("AYesMan");
  }
  return _channel;
}

export function log(message: string): void {
  getOutputChannel().appendLine(message);
}
