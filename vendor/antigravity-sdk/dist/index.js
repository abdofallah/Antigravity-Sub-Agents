'use strict';

var path3 = require('path');
var fs3 = require('fs');
var vscode = require('vscode');
var crypto = require('crypto');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var path3__namespace = /*#__PURE__*/_interopNamespace(path3);
var fs3__namespace = /*#__PURE__*/_interopNamespace(fs3);
var vscode__namespace = /*#__PURE__*/_interopNamespace(vscode);
var crypto__namespace = /*#__PURE__*/_interopNamespace(crypto);

var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// package.json
var require_package = __commonJS({
  "package.json"(exports$1, module) {
    module.exports = {
      name: "antigravity-sdk",
      version: "1.7.0",
      description: "Community SDK for building extensions for Antigravity IDE",
      main: "dist/index.js",
      types: "dist/index.d.ts",
      files: [
        "dist"
      ],
      scripts: {
        build: "tsup",
        dev: "tsup --watch",
        lint: "eslint src/",
        docs: "typedoc --out docs-site src/index.ts",
        prepublishOnly: "npm run build"
      },
      keywords: [
        "antigravity",
        "antigravity-ide",
        "google-antigravity",
        "sdk",
        "cascade",
        "ai-agent",
        "vscode-extension"
      ],
      author: "Kanezal",
      license: "AGPL-3.0-or-later",
      repository: {
        type: "git",
        url: "git+https://github.com/Kanezal/antigravity-sdk.git"
      },
      homepage: "https://kanezal.github.io/antigravity-sdk",
      engines: {
        node: ">=16.0.0"
      },
      antigravityVersions: ">=1.107.0",
      peerDependencies: {
        "@types/vscode": "^1.85.0"
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        "@types/vscode": "^1.85.0",
        "@typescript-eslint/eslint-plugin": "^8.0.0",
        "@typescript-eslint/parser": "^8.0.0",
        eslint: "^9.0.0",
        tsup: "^8.0.0",
        typedoc: "^0.27.0",
        typescript: "^5.0.0"
      },
      dependencies: {
        "sql.js": "^1.14.0"
      }
    };
  }
});

// src/core/types.ts
var TerminalExecutionPolicy = /* @__PURE__ */ ((TerminalExecutionPolicy2) => {
  TerminalExecutionPolicy2[TerminalExecutionPolicy2["OFF"] = 1] = "OFF";
  TerminalExecutionPolicy2[TerminalExecutionPolicy2["AUTO"] = 2] = "AUTO";
  TerminalExecutionPolicy2[TerminalExecutionPolicy2["EAGER"] = 3] = "EAGER";
  return TerminalExecutionPolicy2;
})(TerminalExecutionPolicy || {});
var ArtifactReviewPolicy = /* @__PURE__ */ ((ArtifactReviewPolicy2) => {
  ArtifactReviewPolicy2[ArtifactReviewPolicy2["ALWAYS"] = 1] = "ALWAYS";
  ArtifactReviewPolicy2[ArtifactReviewPolicy2["TURBO"] = 2] = "TURBO";
  ArtifactReviewPolicy2[ArtifactReviewPolicy2["AUTO"] = 3] = "AUTO";
  return ArtifactReviewPolicy2;
})(ArtifactReviewPolicy || {});
var CortexStepType = /* @__PURE__ */ ((CortexStepType2) => {
  CortexStepType2["RunCommand"] = "RunCommand";
  CortexStepType2["WriteToFile"] = "WriteToFile";
  CortexStepType2["ViewFile"] = "ViewFile";
  CortexStepType2["ViewFileOutline"] = "ViewFileOutline";
  CortexStepType2["ViewCodeItem"] = "ViewCodeItem";
  CortexStepType2["SearchWeb"] = "SearchWeb";
  CortexStepType2["ReadUrlContent"] = "ReadUrlContent";
  CortexStepType2["OpenBrowserUrl"] = "OpenBrowserUrl";
  CortexStepType2["ReadBrowserPage"] = "ReadBrowserPage";
  CortexStepType2["ListBrowserPages"] = "ListBrowserPages";
  CortexStepType2["ListDirectory"] = "ListDirectory";
  CortexStepType2["FindByName"] = "FindByName";
  CortexStepType2["CodebaseSearch"] = "CodebaseSearch";
  CortexStepType2["GrepSearch"] = "GrepSearch";
  CortexStepType2["SendCommandInput"] = "SendCommandInput";
  CortexStepType2["ReadTerminal"] = "ReadTerminal";
  CortexStepType2["ShellExec"] = "ShellExec";
  CortexStepType2["McpTool"] = "McpTool";
  CortexStepType2["InvokeSubagent"] = "InvokeSubagent";
  CortexStepType2["Memory"] = "Memory";
  CortexStepType2["KnowledgeGeneration"] = "KnowledgeGeneration";
  CortexStepType2["UserInput"] = "UserInput";
  CortexStepType2["SystemMessage"] = "SystemMessage";
  CortexStepType2["PlannerResponse"] = "PlannerResponse";
  CortexStepType2["Wait"] = "Wait";
  CortexStepType2["ProposeCode"] = "ProposeCode";
  CortexStepType2["WriteCascadeEdit"] = "WriteCascadeEdit";
  return CortexStepType2;
})(CortexStepType || {});
var StepStatus = /* @__PURE__ */ ((StepStatus2) => {
  StepStatus2["Running"] = "running";
  StepStatus2["Completed"] = "completed";
  StepStatus2["Failed"] = "failed";
  StepStatus2["WaitingForUser"] = "waiting_for_user";
  StepStatus2["Cancelled"] = "cancelled";
  return StepStatus2;
})(StepStatus || {});
var TrajectoryType = /* @__PURE__ */ ((TrajectoryType2) => {
  TrajectoryType2["Chat"] = "chat";
  TrajectoryType2["Cascade"] = "cascade";
  return TrajectoryType2;
})(TrajectoryType || {});

// src/core/events.ts
var EventEmitter = class {
  constructor() {
    this._listeners = /* @__PURE__ */ new Set();
    this._disposed = false;
    /**
     * The event that listeners can subscribe to.
     */
    this.event = (listener) => {
      if (this._disposed) {
        throw new Error("EventEmitter has been disposed");
      }
      this._listeners.add(listener);
      return {
        dispose: () => {
          this._listeners.delete(listener);
        }
      };
    };
  }
  /**
   * Fire the event, notifying all listeners.
   *
   * @param data - The event data to send to listeners
   */
  fire(data) {
    if (this._disposed) {
      return;
    }
    for (const listener of this._listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error("[AntigravitySDK] Event listener error:", error);
      }
    }
  }
  /**
   * Subscribe to the event, but only fire once.
   *
   * @param listener - Callback to invoke once
   * @returns Disposable to cancel before the event fires
   */
  once(listener) {
    const sub = this.event((data) => {
      sub.dispose();
      listener(data);
    });
    return sub;
  }
  /**
   * Get the current number of listeners.
   */
  get listenerCount() {
    return this._listeners.size;
  }
  /**
   * Dispose of the emitter and all listeners.
   */
  dispose() {
    this._disposed = true;
    this._listeners.clear();
  }
};

// src/core/disposable.ts
var DisposableStore = class {
  constructor() {
    this._disposables = [];
    this._disposed = false;
  }
  /**
   * Add a disposable to the store.
   *
   * @param disposable - The disposable to track
   * @returns The same disposable (for chaining)
   */
  add(disposable) {
    if (this._disposed) {
      disposable.dispose();
      console.warn("[AntigravitySDK] Adding disposable to already disposed store");
    } else {
      this._disposables.push(disposable);
    }
    return disposable;
  }
  /**
   * Dispose all tracked disposables.
   */
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    for (const d of this._disposables) {
      try {
        d.dispose();
      } catch (error) {
        console.error("[AntigravitySDK] Dispose error:", error);
      }
    }
    this._disposables.length = 0;
  }
};
function toDisposable(fn) {
  return { dispose: fn };
}

// src/core/errors.ts
var AntigravitySDKError = class extends Error {
  constructor(message) {
    super(`[AntigravitySDK] ${message}`);
    this.name = "AntigravitySDKError";
  }
};
var AntigravityNotFoundError = class extends AntigravitySDKError {
  constructor() {
    super("Antigravity IDE not detected. Make sure this extension is running inside Antigravity.");
    this.name = "AntigravityNotFoundError";
  }
};
var CommandExecutionError = class extends AntigravitySDKError {
  constructor(command, reason) {
    super(`Command "${command}" failed: ${reason}`);
    this.command = command;
    this.reason = reason;
    this.name = "CommandExecutionError";
  }
};
var StateReadError = class extends AntigravitySDKError {
  constructor(key, reason) {
    super(`Failed to read state key "${key}": ${reason}`);
    this.key = key;
    this.reason = reason;
    this.name = "StateReadError";
  }
};
var SessionNotFoundError = class extends AntigravitySDKError {
  constructor(sessionId) {
    super(`Session "${sessionId}" not found`);
    this.sessionId = sessionId;
    this.name = "SessionNotFoundError";
  }
};

// src/core/logger.ts
var LogLevel = /* @__PURE__ */ ((LogLevel2) => {
  LogLevel2[LogLevel2["Debug"] = 0] = "Debug";
  LogLevel2[LogLevel2["Info"] = 1] = "Info";
  LogLevel2[LogLevel2["Warn"] = 2] = "Warn";
  LogLevel2[LogLevel2["Error"] = 3] = "Error";
  LogLevel2[LogLevel2["Off"] = 4] = "Off";
  return LogLevel2;
})(LogLevel || {});
var _Logger = class _Logger {
  /**
   * Create a logger for a specific module.
   *
   * @param module - Module name (shown in log prefix)
   */
  constructor(module) {
    this.module = module;
  }
  /**
   * Set the global log level for all SDK loggers.
   *
   * @param level - Minimum level to output
   */
  static setLevel(level) {
    _Logger._globalLevel = level;
  }
  /**
   * Route SDK logs to a VS Code OutputChannel (or any line-based sink).
   * Pass `null` to disable.
   *
   * @example
   * ```typescript
   * const out = vscode.window.createOutputChannel('My Extension');
   * Logger.setOutput(msg => out.appendLine(msg));
   * ```
   */
  static setOutput(fn) {
    _Logger._outputFn = fn;
  }
  /** Log a debug message. */
  debug(message, ...args) {
    this._log(0 /* Debug */, message, args);
  }
  /** Log an informational message. */
  info(message, ...args) {
    this._log(1 /* Info */, message, args);
  }
  /** Log a warning. */
  warn(message, ...args) {
    this._log(2 /* Warn */, message, args);
  }
  /** Log an error. */
  error(message, ...args) {
    this._log(3 /* Error */, message, args);
  }
  _log(level, message, args) {
    if (level < _Logger._globalLevel) {
      return;
    }
    const prefix = `[AntigravitySDK:${this.module}]`;
    const fn = level === 3 /* Error */ ? console.error : level === 2 /* Warn */ ? console.warn : level === 1 /* Info */ ? console.info : console.debug;
    fn(prefix, message, ...args);
    if (_Logger._outputFn) {
      const levelStr = LogLevel[level].toUpperCase().padEnd(5);
      const extra = args.length ? " " + args.map((a) => a instanceof Error ? a.message : String(a)).join(" ") : "";
      _Logger._outputFn(`[SDK:${this.module}] ${levelStr} ${message}${extra}`);
    }
  }
};
_Logger._globalLevel = 2 /* Warn */;
_Logger._outputFn = null;
var Logger = _Logger;
function parseVersion(v) {
  return String(v).split(".").map(Number);
}
function cmpVersion(a, b) {
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
function parseRange(range) {
  return range.trim().split(/\s+/).map((part) => {
    const m = part.match(/^(>=|<=|>|<|=)?(\d[\d.]*)$/);
    if (!m) throw new Error(`Invalid AG version constraint: "${part}"`);
    return { op: m[1] || "=", ver: parseVersion(m[2]) };
  });
}
function satisfies(version, rangeStr) {
  const v = parseVersion(version);
  return parseRange(rangeStr).every(({ op, ver }) => {
    const cmp = cmpVersion(v, ver);
    switch (op) {
      case ">=":
        return cmp >= 0;
      case "<=":
        return cmp <= 0;
      case ">":
        return cmp > 0;
      case "<":
        return cmp < 0;
      case "=":
        return cmp === 0;
      default:
        return false;
    }
  });
}
function detectAGVersion() {
  try {
    const localAppData = process.env.LOCALAPPDATA || "";
    const agPkgPath = path3__namespace.join(localAppData, "Programs", "Antigravity", "resources", "app", "package.json");
    if (!fs3__namespace.existsSync(agPkgPath)) return null;
    const agPkg = JSON.parse(fs3__namespace.readFileSync(agPkgPath, "utf8"));
    const version = agPkg.version;
    if (!version) return null;
    const sdkPkgPath = path3__namespace.join(__dirname, "..", "..", "package.json");
    const sdkPkg = JSON.parse(fs3__namespace.readFileSync(sdkPkgPath, "utf8"));
    const supportedRange = sdkPkg.antigravityVersions ?? "*";
    const compatible = supportedRange === "*" || satisfies(version, supportedRange);
    return { version, compatible, supportedRange };
  } catch {
    return null;
  }
}
var log = new Logger("CommandBridge");
var AntigravityCommands = {
  // ─── Agent Panel & UI (VERIFIED: .open/.focus suffix required) ────────
  /** Open the Cascade agent panel */
  OPEN_AGENT_PANEL: "antigravity.agentPanel.open",
  /** Focus the Cascade agent panel */
  FOCUS_AGENT_PANEL: "antigravity.agentPanel.focus",
  /** Open the agent side panel */
  OPEN_AGENT_SIDE_PANEL: "antigravity.agentSidePanel.open",
  /** Focus the agent side panel */
  FOCUS_AGENT_SIDE_PANEL: "antigravity.agentSidePanel.focus",
  /** Toggle side panel visibility */
  TOGGLE_SIDE_PANEL: "antigravity.agentSidePanel.toggleVisibility",
  /** Open agent (generic) */
  OPEN_AGENT: "antigravity.openAgent",
  /** Toggle chat focus */
  TOGGLE_CHAT_FOCUS: "antigravity.toggleChatFocus",
  /** Switch between workspace editor and agent view */
  SWITCH_WORKSPACE_AGENT: "antigravity.switchBetweenWorkspaceAndAgent",
  // ─── Conversation Management (Critical for SDK) ──────────────────────
  /** Start a new conversation */
  START_NEW_CONVERSATION: "antigravity.startNewConversation",
  /** Send a prompt to the agent panel */
  SEND_PROMPT_TO_AGENT: "antigravity.sendPromptToAgentPanel",
  /** Send text to chat */
  SEND_TEXT_TO_CHAT: "antigravity.sendTextToChat",
  /** Send a chat action message */
  SEND_CHAT_ACTION: "antigravity.sendChatActionMessage",
  /** Set which conversation is visible */
  SET_VISIBLE_CONVERSATION: "antigravity.setVisibleConversation",
  /** Execute a cascade action */
  EXECUTE_CASCADE_ACTION: "antigravity.executeCascadeAction",
  /** Broadcast conversation deletion to all windows */
  BROADCAST_CONVERSATION_DELETION: "antigravity.broadcastConversationDeletion",
  /** Track that a background conversation was created */
  TRACK_BACKGROUND_CONVERSATION: "antigravity.trackBackgroundConversationCreated",
  // ─── Agent Step Control (VERIFIED) ────────────────────────────────────
  /** Accept the current agent step */
  ACCEPT_AGENT_STEP: "antigravity.agent.acceptAgentStep",
  /** Reject the current agent step */
  REJECT_AGENT_STEP: "antigravity.agent.rejectAgentStep",
  /** Accept a pending command */
  COMMAND_ACCEPT: "antigravity.command.accept",
  /** Reject a pending command */
  COMMAND_REJECT: "antigravity.command.reject",
  /** Accept a terminal command */
  TERMINAL_ACCEPT: "antigravity.terminalCommand.accept",
  /** Reject a terminal command */
  TERMINAL_REJECT: "antigravity.terminalCommand.reject",
  /** Run a terminal command */
  TERMINAL_RUN: "antigravity.terminalCommand.run",
  /** Open new conversation (prioritized) */
  OPEN_NEW_CONVERSATION: "antigravity.prioritized.chat.openNewConversation",
  // ─── Terminal Integration ─────────────────────────────────────────────
  /** Notify terminal command started */
  TERMINAL_COMMAND_START: "antigravity.onManagerTerminalCommandStart",
  /** Notify terminal command data */
  TERMINAL_COMMAND_DATA: "antigravity.onManagerTerminalCommandData",
  /** Notify terminal command finished */
  TERMINAL_COMMAND_FINISH: "antigravity.onManagerTerminalCommandFinish",
  /** Update last terminal command */
  UPDATE_TERMINAL_LAST_COMMAND: "antigravity.updateTerminalLastCommand",
  /** Notify shell command completion */
  ON_SHELL_COMPLETION: "antigravity.onShellCommandCompletion",
  /** Show managed terminal */
  SHOW_MANAGED_TERMINAL: "antigravity.showManagedTerminal",
  /** Send terminal output to chat */
  SEND_TERMINAL_TO_CHAT: "antigravity.sendTerminalToChat",
  /** Send terminal output to side panel */
  SEND_TERMINAL_TO_SIDE_PANEL: "antigravity.sendTerminalToSidePanel",
  // ─── Agent & Mode ─────────────────────────────────────────────────────
  /** Initialize the agent */
  INITIALIZE_AGENT: "antigravity.initializeAgent",
  // ─── Conversation Picker & Workspace ──────────────────────────────────
  /** Open conversation workspace picker */
  OPEN_CONVERSATION_PICKER: "antigravity.openConversationWorkspaceQuickPick",
  /** Open conversation picker (alternative) */
  OPEN_CONV_PICKER_ALT: "antigravity.openConversationPicker",
  /** Set working directories */
  SET_WORKING_DIRS: "antigravity.setWorkingDirectories",
  // ─── Review & Diff ────────────────────────────────────────────────────
  /** Open review changes view */
  OPEN_REVIEW_CHANGES: "antigravity.openReviewChanges",
  /** Open diff view */
  OPEN_DIFF_VIEW: "antigravity.openDiffView",
  /** Open diff zones */
  OPEN_DIFF_ZONES: "antigravity.openDiffZones",
  /** Close all diff zones */
  CLOSE_ALL_DIFF_ZONES: "antigravity.closeAllDiffZones",
  // ─── Rules & Workflows ────────────────────────────────────────────────
  /** Create a new rule */
  CREATE_RULE: "antigravity.createRule",
  /** Create a new workflow */
  CREATE_WORKFLOW: "antigravity.createWorkflow",
  /** Create a global workflow */
  CREATE_GLOBAL_WORKFLOW: "antigravity.createGlobalWorkflow",
  /** Open global rules */
  OPEN_GLOBAL_RULES: "antigravity.openGlobalRules",
  /** Open workspace rules */
  OPEN_WORKSPACE_RULES: "antigravity.openWorkspaceRules",
  // ─── Plugins & MCP ────────────────────────────────────────────────────
  /** Open configure plugins page */
  OPEN_CONFIGURE_PLUGINS: "antigravity.openConfigurePluginsPage",
  /** Get Cascade plugin template */
  GET_PLUGIN_TEMPLATE: "antigravity.getCascadePluginTemplate",
  /** Poll MCP server states */
  POLL_MCP_SERVERS: "antigravity.pollMcpServerStates",
  /** Open MCP config file */
  OPEN_MCP_CONFIG: "antigravity.openMcpConfigFile",
  /** Open MCP docs page */
  OPEN_MCP_DOCS: "antigravity.openMcpDocsPage",
  /** Update plugin installation count */
  UPDATE_PLUGIN_COUNT: "antigravity.updatePluginInstallationCount",
  // ─── Autocomplete ─────────────────────────────────────────────────────
  /** Enable autocomplete */
  ENABLE_AUTOCOMPLETE: "antigravity.enableAutocomplete",
  /** Disable autocomplete */
  DISABLE_AUTOCOMPLETE: "antigravity.disableAutocomplete",
  /** Accept completion */
  ACCEPT_COMPLETION: "antigravity.acceptCompletion",
  /** Force supercomplete */
  FORCE_SUPERCOMPLETE: "antigravity.forceSupercomplete",
  /** Snooze autocomplete temporarily */
  SNOOZE_AUTOCOMPLETE: "antigravity.snoozeAutocomplete",
  /** Cancel snooze */
  CANCEL_SNOOZE: "antigravity.cancelSnoozeAutocomplete",
  // ─── Auth & Account ───────────────────────────────────────────────────
  /** Login to Antigravity */
  LOGIN: "antigravity.login",
  /** Cancel login */
  CANCEL_LOGIN: "antigravity.cancelLogin",
  /** Handle auth refresh */
  HANDLE_AUTH_REFRESH: "antigravity.handleAuthRefresh",
  /** Sign in to Antigravity */
  SIGN_IN: "antigravity.SignInToAntigravity",
  // ─── Diagnostics & Debug ──────────────────────────────────────────────
  /** Get diagnostics info */
  GET_DIAGNOSTICS: "antigravity.getDiagnostics",
  /** Download diagnostics bundle */
  DOWNLOAD_DIAGNOSTICS: "antigravity.downloadDiagnostics",
  /** Capture traces */
  CAPTURE_TRACES: "antigravity.captureTraces",
  /** Enable tracing */
  ENABLE_TRACING: "antigravity.enableTracing",
  /** Clear and disable tracing */
  CLEAR_TRACING: "antigravity.clearAndDisableTracing",
  /** Get manager trace */
  GET_MANAGER_TRACE: "antigravity.getManagerTrace",
  /** Get workbench trace */
  GET_WORKBENCH_TRACE: "antigravity.getWorkbenchTrace",
  /** Toggle debug info widget */
  TOGGLE_DEBUG_INFO: "antigravity.toggleDebugInfoWidget",
  /** Open troubleshooting */
  OPEN_TROUBLESHOOTING: "antigravity.openTroubleshooting",
  /** Open issue reporter */
  OPEN_ISSUE_REPORTER: "antigravity.openIssueReporter",
  // ─── Language Server ──────────────────────────────────────────────────
  /** Restart the language server */
  RESTART_LANGUAGE_SERVER: "antigravity.restartLanguageServer",
  /** Kill language server and reload window */
  KILL_LS_AND_RELOAD: "antigravity.killLanguageServerAndReloadWindow",
  // ─── Git & Commit ─────────────────────────────────────────────────────
  /** Generate commit message via AI */
  GENERATE_COMMIT_MESSAGE: "antigravity.generateCommitMessage",
  /** Cancel commit message generation */
  CANCEL_COMMIT_MESSAGE: "antigravity.cancelGenerateCommitMessage",
  // ─── Browser ──────────────────────────────────────────────────────────
  /** Open browser */
  OPEN_BROWSER: "antigravity.openBrowser",
  /** Get browser onboarding port (returns number, e.g. 57401) */
  GET_BROWSER_PORT: "antigravity.getBrowserOnboardingPort",
  // ─── Settings & Import ────────────────────────────────────────────────
  /** Open quick settings panel */
  OPEN_QUICK_SETTINGS: "antigravity.openQuickSettingsPanel",
  /** Open customizations tab */
  OPEN_CUSTOMIZATIONS: "antigravity.openCustomizationsTab",
  /** Import VS Code settings */
  IMPORT_VSCODE_SETTINGS: "antigravity.importVSCodeSettings",
  /** Import VS Code extensions */
  IMPORT_VSCODE_EXTENSIONS: "antigravity.importVSCodeExtensions",
  /** Import Cursor settings */
  IMPORT_CURSOR_SETTINGS: "antigravity.importCursorSettings",
  /** Import Cursor extensions */
  IMPORT_CURSOR_EXTENSIONS: "antigravity.importCursorExtensions",
  // ─── Misc ─────────────────────────────────────────────────────────────
  /** Reload window */
  RELOAD_WINDOW: "antigravity.reloadWindow",
  /** Open documentation */
  OPEN_DOCS: "antigravity.openDocs",
  /** Open changelog */
  OPEN_CHANGELOG: "antigravity.openChangeLog",
  /** Explain and fix problem (from diagnostics) */
  EXPLAIN_AND_FIX: "antigravity.explainAndFixProblem",
  /** Open a URL */
  OPEN_URL: "antigravity.openGenericUrl",
  /** Editor mode settings */
  EDITOR_MODE_SETTINGS: "antigravity.editorModeSettings"
};
var CommandBridge = class {
  constructor() {
    this._disposed = false;
  }
  /**
   * Execute an Antigravity command.
   *
   * @param command - The command ID to execute
   * @param args - Arguments to pass to the command
   * @returns The command's return value
   * @throws {CommandExecutionError} If the command fails
   */
  async execute(command, ...args) {
    if (this._disposed) {
      throw new CommandExecutionError(command, "CommandBridge has been disposed");
    }
    log.debug(`Executing: ${command}`, args.length > 0 ? args : "");
    try {
      const result = await vscode__namespace.commands.executeCommand(command, ...args);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Command failed: ${command}`, message);
      throw new CommandExecutionError(command, message);
    }
  }
  /**
   * Check if a command is registered and available.
   *
   * @param command - Command ID to check
   * @returns true if the command exists
   */
  async isAvailable(command) {
    const commands4 = await vscode__namespace.commands.getCommands(true);
    return commands4.includes(command);
  }
  /**
   * Get all registered Antigravity commands.
   *
   * @returns List of command IDs starting with 'antigravity.'
   */
  async getAntigravityCommands() {
    const commands4 = await vscode__namespace.commands.getCommands(true);
    return commands4.filter((cmd) => cmd.startsWith("antigravity."));
  }
  /**
   * Register a command handler.
   *
   * @param command - Command ID to register
   * @param handler - Function to handle the command
   * @returns Disposable to unregister the command
   */
  register(command, handler) {
    return vscode__namespace.commands.registerCommand(command, handler);
  }
  dispose() {
    this._disposed = true;
  }
};
var log2 = new Logger("StateBridge");
var USSKeys = {
  /** Agent preferences — terminal policy, review policy, secure mode, etc. (1020 bytes) */
  AGENT_PREFERENCES: "antigravityUnifiedStateSync.agentPreferences",
  /** Conversation/trajectory summaries — titles, timestamps, workspace URIs (74KB+) */
  TRAJECTORY_SUMMARIES: "antigravityUnifiedStateSync.trajectorySummaries",
  /** Agent manager window state (192 bytes) */
  AGENT_MANAGER_WINDOW: "antigravityUnifiedStateSync.agentManagerWindow",
  /** Enterprise override store (56 bytes) */
  OVERRIDE_STORE: "antigravityUnifiedStateSync.overrideStore",
  /** Model preferences — selected model, sentinel key */
  MODEL_PREFERENCES: "antigravityUnifiedStateSync.modelPreferences",
  /** Artifact review state (1204 bytes) */
  ARTIFACT_REVIEW: "antigravityUnifiedStateSync.artifactReview",
  /** Browser preferences (380 bytes) */
  BROWSER_PREFERENCES: "antigravityUnifiedStateSync.browserPreferences",
  /** Editor preferences (108 bytes) */
  EDITOR_PREFERENCES: "antigravityUnifiedStateSync.editorPreferences",
  /** Tab preferences (404 bytes) */
  TAB_PREFERENCES: "antigravityUnifiedStateSync.tabPreferences",
  /** Window preferences (44 bytes) */
  WINDOW_PREFERENCES: "antigravityUnifiedStateSync.windowPreferences",
  /** Scratch/playground workspaces (268 bytes) */
  SCRATCH_WORKSPACES: "antigravityUnifiedStateSync.scratchWorkspaces",
  /** Sidebar workspaces — recent workspace list (5604 bytes) */
  SIDEBAR_WORKSPACES: "antigravityUnifiedStateSync.sidebarWorkspaces",
  /** User status info (5196 bytes) */
  USER_STATUS: "antigravityUnifiedStateSync.userStatus",
  /** Model credits/usage info */
  MODEL_CREDITS: "antigravityUnifiedStateSync.modelCredits",
  /** Onboarding state (140 bytes) */
  ONBOARDING: "antigravityUnifiedStateSync.onboarding",
  /** Seen NUX (new user experience) IDs (76 bytes) */
  SEEN_NUX_IDS: "antigravityUnifiedStateSync.seenNuxIds",
  // ⚠️ Jetski-specific state (separate sync namespace)
  /** Agent manager initialization state — contains auth tokens, workspace map (5144 bytes) */
  AGENT_MANAGER_INIT: "jetskiStateSync.agentManagerInitState",
  // ⚠️ Non-USS but relevant keys
  /** All user settings — JSON format */
  ALL_USER_SETTINGS: "antigravityUserSettings.allUserSettings",
  /** Allowed model configs for commands */
  ALLOWED_COMMAND_MODEL_CONFIGS: "antigravity_allowed_command_model_configs",
  /** Chat session store index (JSON: {"version":1,"entries":{}}) */
  CHAT_SESSION_INDEX: "chat.ChatSessionStore.index"
};
var SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "antigravityUnifiedStateSync.oauthToken",
  "jetskiStateSync.agentManagerInitState",
  "antigravityAuthStatus"
]);
var SENTINEL_KEYS = {
  PLANNING_MODE: "planningModeSentinelKey",
  ARTIFACT_REVIEW_POLICY: "artifactReviewPolicySentinelKey",
  TERMINAL_AUTO_EXECUTION_POLICY: "terminalAutoExecutionPolicySentinelKey",
  ALLOW_NON_WORKSPACE_FILES: "allowAgentAccessNonWorkspaceFilesSentinelKey",
  ALLOW_GITIGNORE_ACCESS: "allowCascadeAccessGitignoreFilesSentinelKey",
  SECURE_MODE: "secureModeSentinelKey",
  EXPLAIN_FIX_IN_CONVO: "explainAndFixInCurrentConversationSentinelKey",
  AUTO_CONTINUE_ON_MAX: "autoContinueOnMaxGeneratorInvocationsSentinelKey",
  DISABLE_AUTO_OPEN_EDITED: "disableAutoOpenEditedFilesSentinelKey",
  ENABLE_SOUNDS: "enableSoundsForSpecialEventsSentinelKey",
  DISABLE_AUTO_FIX_LINTS: "disableCascadeAutoFixLintsSentinelKey",
  ENABLE_SHELL_INTEGRATION: "enableShellIntegrationSentinelKey",
  SANDBOX_ALLOW_NETWORK: "sandboxAllowNetworkSentinelKey",
  ENABLE_TERMINAL_SANDBOX: "enableTerminalSandboxSentinelKey"
};
var StateBridge = class {
  constructor() {
    this._dbPath = null;
    this._db = null;
    // sql.js Database instance
    this._disposed = false;
  }
  /**
   * Initialize the state bridge by locating and opening state database.
   *
   * @throws {StateReadError} If the database cannot be found
   */
  async initialize() {
    const dbPath = this._findStateDb();
    if (!dbPath) {
      throw new StateReadError("state.vscdb", "Could not locate Antigravity state database");
    }
    this._dbPath = dbPath;
    try {
      const path6 = __require("path");
      const fs7 = __require("fs");
      let initSqlJs;
      const localSqlJs = path6.join(__dirname, "sql-wasm.js");
      if (fs7.existsSync(localSqlJs)) {
        initSqlJs = __require(localSqlJs);
      } else {
        initSqlJs = __require("sql.js");
      }
      const candidates = [
        // 1. Adjacent to this file (if wasm was bundled/copied to dist/)
        path6.join(__dirname, "sql-wasm.wasm"),
        // 2. sql.js package dist/ (standard npm install)
        path6.resolve(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
        // 3. Hoisted node_modules (monorepo / npm workspaces)
        path6.resolve(__dirname, "..", "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
        // 4. Walk up to find it (deep hoisting)
        path6.resolve(__dirname, "..", "..", "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm")
      ];
      try {
        const sqlJsMain = __require.resolve("sql.js");
        candidates.unshift(path6.join(path6.dirname(sqlJsMain), "sql-wasm.wasm"));
      } catch {
      }
      let wasmPath = null;
      for (const p of candidates) {
        if (fs7.existsSync(p)) {
          wasmPath = p;
          break;
        }
      }
      if (!wasmPath) {
        throw new Error("sql-wasm.wasm not found in any expected location");
      }
      log2.debug(`sql-wasm.wasm located at: ${wasmPath}`);
      const SQL = await initSqlJs({
        locateFile: () => wasmPath
      });
      const fileBuffer = fs7.readFileSync(dbPath);
      const fileSizeKb = (fileBuffer.length / 1024).toFixed(1);
      this._db = new SQL.Database(fileBuffer);
      log2.info(`State database opened via sql.js: ${dbPath} (${fileSizeKb} KB)`);
    } catch (error) {
      log2.warn("sql.js not available, will use child_process fallback", error);
    }
  }
  /**
   * Read a raw value from the state database.
   *
   * @param key - The SQLite key to read
   * @returns The raw string value, or null if not found
   * @throws {StateReadError} If the key is sensitive or read fails
   */
  async getRawValue(key) {
    if (this._disposed) {
      throw new StateReadError(key, "StateBridge has been disposed");
    }
    if (!this._dbPath) {
      throw new StateReadError(key, "StateBridge not initialized");
    }
    if (SENSITIVE_KEYS.has(key)) {
      log2.warn(`Blocked access to sensitive key: ${key}`);
      throw new StateReadError(key, "Access to sensitive keys is blocked by the SDK for security");
    }
    log2.debug(`getRawValue: ${key} (${this._db ? "sql.js" : "child_process"})`);
    try {
      if (this._db) {
        return this._querySqlJs(key);
      }
      return await this._queryChildProcess(key);
    } catch (error) {
      if (error instanceof StateReadError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new StateReadError(key, msg);
    }
  }
  /**
   * Get agent preferences from USS.
   *
   * @returns Parsed agent preferences
   */
  async getAgentPreferences() {
    log2.debug("getAgentPreferences: reading USS key");
    const raw = await this.getRawValue(USSKeys.AGENT_PREFERENCES);
    if (!raw) {
      log2.warn("No agent preferences found, returning defaults");
      return this._defaultPreferences();
    }
    log2.debug(`getAgentPreferences: raw value length=${raw.length}, parsing protobuf sentinels`);
    try {
      const prefs = this._parseAgentPreferences(raw);
      log2.debug(`getAgentPreferences: terminalPolicy=${prefs.terminalExecutionPolicy}, secureMode=${prefs.secureModeEnabled}`);
      return prefs;
    } catch (error) {
      log2.error("Failed to parse preferences, returning defaults", error);
      return this._defaultPreferences();
    }
  }
  /**
   * Get all stored USS keys from the state database.
   *
   * @returns List of key names related to Antigravity (excludes sensitive keys)
   */
  async getAntigravityKeys() {
    if (!this._dbPath) {
      throw new StateReadError("*", "StateBridge not initialized");
    }
    let keys;
    if (this._db) {
      const result = this._db.exec(
        "SELECT key FROM ItemTable WHERE key LIKE '%antigravity%' OR key LIKE '%jetskiStateSync%' OR key LIKE 'chat.%'"
      );
      keys = result.length > 0 ? result[0].values.map((r) => r[0]) : [];
    } else {
      const result = await this._queryChildProcess("*");
      keys = result ? result.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    }
    return keys.filter((k) => !SENSITIVE_KEYS.has(k));
  }
  /**
   * Query using sql.js (in-process, pure JS).
   */
  _querySqlJs(key) {
    const stmt = this._db.prepare("SELECT value FROM ItemTable WHERE key = $key");
    stmt.bind({ $key: key });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row.value ?? null;
    }
    stmt.free();
    return null;
  }
  /**
   * Query using child_process sqlite3 CLI (fallback).
   */
  async _queryChildProcess(key) {
    const { exec } = __require("child_process");
    const { promisify } = __require("util");
    const execAsync = promisify(exec);
    const sql = key === "*" ? "SELECT key FROM ItemTable WHERE key LIKE '%antigravity%' OR key LIKE '%jetskiStateSync%'" : `SELECT value FROM ItemTable WHERE key = '${key.replace(/'/g, "''")}'`;
    try {
      const { stdout } = await execAsync(`sqlite3 "${this._dbPath}" "${sql}"`, {
        encoding: "utf8",
        timeout: 5e3
      });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
  /**
   * Locate the state.vscdb file across platforms.
   */
  _findStateDb() {
    const candidates = [];
    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(path3__namespace.join(appData, "Antigravity", "User", "globalStorage", "state.vscdb"));
    }
    const home = process.env.HOME;
    if (home) {
      candidates.push(
        path3__namespace.join(
          home,
          "Library",
          "Application Support",
          "Antigravity",
          "User",
          "globalStorage",
          "state.vscdb"
        )
      );
    }
    if (home) {
      candidates.push(
        path3__namespace.join(home, ".config", "Antigravity", "User", "globalStorage", "state.vscdb")
      );
    }
    for (const candidate of candidates) {
      if (fs3__namespace.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }
  /**
   * Parse agent preferences from Base64(Protobuf).
   *
   * The protobuf structure uses "sentinel keys" as string fields:
   * - `planningModeSentinelKey` → nested message with Base64(varint)
   * - `terminalAutoExecutionPolicySentinelKey` → nested message with Base64(varint)
   * - `artifactReviewPolicySentinelKey` → nested message with Base64(varint)
   *
   * Each sentinel value is itself a small Base64 string (e.g., "EAM=" = varint 3 = EAGER).
   */
  _parseAgentPreferences(raw) {
    const buffer = Buffer.from(raw, "base64");
    const text = buffer.toString("utf8");
    const terminalPolicy = this._extractSentinelValue(text, SENTINEL_KEYS.TERMINAL_AUTO_EXECUTION_POLICY);
    const artifactPolicy = this._extractSentinelValue(text, SENTINEL_KEYS.ARTIFACT_REVIEW_POLICY);
    const planningMode = this._extractSentinelValue(text, SENTINEL_KEYS.PLANNING_MODE);
    const secureMode = this._extractSentinelValue(text, SENTINEL_KEYS.SECURE_MODE);
    const terminalSandbox = this._extractSentinelValue(text, SENTINEL_KEYS.ENABLE_TERMINAL_SANDBOX);
    const sandboxNetwork = this._extractSentinelValue(text, SENTINEL_KEYS.SANDBOX_ALLOW_NETWORK);
    const shellIntegration = this._extractSentinelValue(text, SENTINEL_KEYS.ENABLE_SHELL_INTEGRATION);
    const nonWorkspaceFiles = this._extractSentinelValue(text, SENTINEL_KEYS.ALLOW_NON_WORKSPACE_FILES);
    const gitignoreAccess = this._extractSentinelValue(text, SENTINEL_KEYS.ALLOW_GITIGNORE_ACCESS);
    const explainFix = this._extractSentinelValue(text, SENTINEL_KEYS.EXPLAIN_FIX_IN_CONVO);
    const autoContinue = this._extractSentinelValue(text, SENTINEL_KEYS.AUTO_CONTINUE_ON_MAX);
    const disableAutoOpen = this._extractSentinelValue(text, SENTINEL_KEYS.DISABLE_AUTO_OPEN_EDITED);
    const enableSounds = this._extractSentinelValue(text, SENTINEL_KEYS.ENABLE_SOUNDS);
    const disableAutoFix = this._extractSentinelValue(text, SENTINEL_KEYS.DISABLE_AUTO_FIX_LINTS);
    return {
      terminalExecutionPolicy: terminalPolicy ?? 1,
      artifactReviewPolicy: artifactPolicy ?? 1,
      planningMode: planningMode ?? 0,
      secureModeEnabled: (secureMode ?? 0) === 1,
      terminalSandboxEnabled: (terminalSandbox ?? 0) === 1,
      sandboxAllowNetwork: (sandboxNetwork ?? 0) === 1,
      shellIntegrationEnabled: (shellIntegration ?? 1) === 1,
      allowNonWorkspaceFiles: (nonWorkspaceFiles ?? 0) === 1,
      allowGitignoreAccess: (gitignoreAccess ?? 0) === 1,
      explainFixInCurrentConvo: (explainFix ?? 0) === 1,
      autoContinueOnMax: autoContinue ?? 0,
      disableAutoOpenEdited: (disableAutoOpen ?? 0) === 1,
      enableSounds: (enableSounds ?? 0) === 1,
      disableAutoFixLints: (disableAutoFix ?? 0) === 1,
      allowedCommands: [],
      deniedCommands: []
    };
  }
  /**
   * Extract a varint value from a protobuf sentinel key.
   *
   * The structure is: sentinel_key_string followed by a small
   * Base64 value like "EAM=" (which decodes to a protobuf varint).
   *
   * Known mappings:
   * - "CAE=" → field 1, value 1 (OFF / ALWAYS)
   * - "EAI=" → field 2, value 2 (AUTO / TURBO)
   * - "EAM=" → field 2, value 3 (EAGER / AUTO)
   */
  _extractSentinelValue(text, sentinelKey) {
    const idx = text.indexOf(sentinelKey);
    if (idx === -1) return null;
    const after = text.substring(idx + sentinelKey.length, idx + sentinelKey.length + 30);
    const b64Match = after.match(/([A-Za-z0-9+/]{2,8}={0,2})/);
    if (!b64Match) return null;
    try {
      const decoded = Buffer.from(b64Match[1], "base64");
      if (decoded.length >= 2) {
        return decoded[1];
      } else if (decoded.length === 1) {
        return decoded[0];
      }
    } catch {
    }
    return null;
  }
  _defaultPreferences() {
    return {
      terminalExecutionPolicy: 1,
      // OFF
      artifactReviewPolicy: 1,
      // ALWAYS
      planningMode: 0,
      secureModeEnabled: false,
      terminalSandboxEnabled: false,
      sandboxAllowNetwork: false,
      shellIntegrationEnabled: true,
      allowNonWorkspaceFiles: false,
      allowGitignoreAccess: false,
      explainFixInCurrentConvo: false,
      autoContinueOnMax: 0,
      disableAutoOpenEdited: false,
      enableSounds: false,
      disableAutoFixLints: false,
      allowedCommands: [],
      deniedCommands: []
    };
  }
  dispose() {
    this._disposed = true;
    if (this._db) {
      try {
        this._db.close();
      } catch {
      }
      this._db = null;
    }
    this._dbPath = null;
  }
};
var log3 = new Logger("EventMonitor");
var EventMonitor = class {
  constructor(_state) {
    this._state = _state;
    this._disposables = new DisposableStore();
    this._ussTimer = null;
    this._trajTimer = null;
    this._ussSnapshots = /* @__PURE__ */ new Map();
    this._trajSnapshots = /* @__PURE__ */ new Map();
    this._activeSessionId = "";
    this._running = false;
    // ─── USS Events ─────────────────────────────────────────────────────
    this._onStateChanged = this._disposables.add(new EventEmitter());
    /** Fires when any monitored USS key changes size */
    this.onStateChanged = this._onStateChanged.event;
    this._onNewConversation = this._disposables.add(new EventEmitter());
    /** Fires when trajectory summaries grow (new conversation likely) */
    this.onNewConversation = this._onNewConversation.event;
    // ─── Trajectory Events ──────────────────────────────────────────────
    this._onStepCountChanged = this._disposables.add(new EventEmitter());
    /** Fires when a session's step count changes (agent made progress) */
    this.onStepCountChanged = this._onStepCountChanged.event;
    this._onActiveSessionChanged = this._disposables.add(new EventEmitter());
    /** Fires when the active (most recent) session changes */
    this.onActiveSessionChanged = this._onActiveSessionChanged.event;
    /** Keys we monitor for USS changes */
    this._watchedKeys = [
      USSKeys.TRAJECTORY_SUMMARIES,
      USSKeys.AGENT_PREFERENCES,
      USSKeys.USER_STATUS
    ];
  }
  /**
   * Start polling for state changes.
   *
   * @param intervalMs - USS polling interval (default: 3000ms)
   * @param trajectoryIntervalMs - Trajectory polling interval (default: 5000ms).
   *   Set to 0 to disable trajectory polling (saves CPU).
   */
  start(intervalMs = 3e3, trajectoryIntervalMs = 5e3) {
    if (this._running) return;
    this._running = true;
    log3.info(`Starting event monitor (USS: ${intervalMs}ms, Traj: ${trajectoryIntervalMs}ms)`);
    this._takeUSSSnapshot().catch(() => {
    });
    this._ussTimer = setInterval(async () => {
      try {
        await this._pollUSS();
      } catch (error) {
        log3.error("USS poll error", error);
      }
    }, intervalMs);
    if (trajectoryIntervalMs > 0) {
      this._pollTrajectories().catch(() => {
      });
      this._trajTimer = setInterval(async () => {
        try {
          await this._pollTrajectories();
        } catch (error) {
          log3.error("Trajectory poll error", error);
        }
      }, trajectoryIntervalMs);
    }
  }
  /**
   * Stop polling.
   */
  stop() {
    if (this._ussTimer) {
      clearInterval(this._ussTimer);
      this._ussTimer = null;
    }
    if (this._trajTimer) {
      clearInterval(this._trajTimer);
      this._trajTimer = null;
    }
    this._running = false;
    log3.info("Event monitor stopped");
  }
  /** Check if the monitor is currently running. */
  get isRunning() {
    return this._running;
  }
  /** Get the currently active session ID. */
  get activeSessionId() {
    return this._activeSessionId;
  }
  // ─── USS Polling ────────────────────────────────────────────────────
  async _takeUSSSnapshot() {
    for (const key of this._watchedKeys) {
      try {
        const value = await this._state.getRawValue(key);
        this._ussSnapshots.set(key, value ? value.length : 0);
      } catch {
        this._ussSnapshots.set(key, 0);
      }
    }
  }
  async _pollUSS() {
    for (const key of this._watchedKeys) {
      try {
        const value = await this._state.getRawValue(key);
        const newSize = value ? value.length : 0;
        const previousSize = this._ussSnapshots.get(key) ?? 0;
        if (newSize !== previousSize) {
          log3.debug(`USS change: ${key} (${previousSize} -> ${newSize})`);
          this._ussSnapshots.set(key, newSize);
          this._onStateChanged.fire({ key, newSize, previousSize });
          if (key === USSKeys.TRAJECTORY_SUMMARIES && newSize > previousSize) {
            this._onNewConversation.fire();
          }
        }
      } catch {
      }
    }
  }
  // ─── Trajectory Polling ─────────────────────────────────────────────
  async _pollTrajectories() {
    let trajectories;
    try {
      const raw = await vscode__namespace.commands.executeCommand("antigravity.getDiagnostics");
      if (!raw || typeof raw !== "string") return;
      const diag = JSON.parse(raw);
      if (!Array.isArray(diag.recentTrajectories)) return;
      trajectories = diag.recentTrajectories;
    } catch {
      return;
    }
    for (const traj of trajectories) {
      const id = traj.googleAgentId;
      if (!id) continue;
      const prev = this._trajSnapshots.get(id);
      const newCount = traj.lastStepIndex ?? 0;
      if (prev && prev.stepCount !== newCount) {
        const delta = newCount - prev.stepCount;
        log3.debug(`Step change: "${traj.summary}" ${prev.stepCount} -> ${newCount} (+${delta})`);
        this._onStepCountChanged.fire({
          sessionId: id,
          title: traj.summary ?? "Untitled",
          previousCount: prev.stepCount,
          newCount,
          delta
        });
      }
      this._trajSnapshots.set(id, {
        id,
        title: traj.summary ?? "Untitled",
        stepCount: newCount,
        lastModified: traj.lastModifiedTime ?? ""
      });
    }
    if (trajectories.length > 0) {
      const newActiveId = trajectories[0].googleAgentId;
      if (newActiveId && newActiveId !== this._activeSessionId) {
        const previousId = this._activeSessionId;
        this._activeSessionId = newActiveId;
        if (previousId !== "") {
          log3.debug(`Active session changed: "${trajectories[0].summary}"`);
          this._onActiveSessionChanged.fire({
            sessionId: newActiveId,
            title: trajectories[0].summary ?? "Untitled",
            previousSessionId: previousId
          });
        }
      }
    }
  }
  dispose() {
    this.stop();
    this._disposables.dispose();
  }
};

// src/transport/ls-bridge.ts
var log4 = new Logger("LSBridge");
var Models = {
  GEMINI_FLASH: 1018,
  GEMINI_PRO_LOW: 1164,
  GEMINI_PRO_HIGH: 1165,
  CLAUDE_SONNET: 1163,
  CLAUDE_OPUS: 1154,
  GPT_OSS: 342
};
var LSBridge = class {
  constructor(executeCommand) {
    this._port = null;
    this._csrfToken = null;
    this._useTls = false;
    this._executeCommand = executeCommand;
  }
  /**
   * Discover the Language Server port and CSRF token.
   * Must be called before other methods.
   *
   * Discovery chain:
   * 1. Parse LS process CLI arguments (--port, --csrf_token)
   * 2. Fallback: getDiagnostics console logs (port only)
   * 3. Manual: call setConnection() after initialize() returns false
   */
  async initialize() {
    const fromProcess = await this._discoverFromProcess();
    if (fromProcess) {
      this._port = fromProcess.port;
      this._csrfToken = fromProcess.csrfToken;
      this._useTls = fromProcess.useTls;
      log4.info(`LS discovered from process: port=${this._port}, tls=${this._useTls}, csrf=${this._csrfToken ? "found" : "missing"}`);
      return true;
    }
    this._port = await this._discoverPortFromDiagnostics();
    if (this._port) {
      log4.warn(`LS port from diagnostics: ${this._port}, but CSRF token not found \u2014 RPC calls may fail with 401`);
      return true;
    }
    log4.warn("Could not discover LS connection. Use setConnection(port, csrfToken) manually.");
    return false;
  }
  /** Whether the bridge is ready (port discovered) */
  get isReady() {
    return this._port !== null;
  }
  /** The discovered LS port */
  get port() {
    return this._port;
  }
  /** Whether CSRF token is available */
  get hasCsrfToken() {
    return this._csrfToken !== null;
  }
  /**
   * Manually set the LS connection parameters.
   *
   * Use this when auto-discovery fails (e.g., non-standard install,
   * or you've discovered the port/token through other means like `lsof`).
   *
   * @param port - LS port number
   * @param csrfToken - CSRF token from LS process CLI args
   * @param useTls - Whether to use HTTPS (default: false, extension_server uses HTTP)
   *
   * @example
   * ```typescript
   * const ls = new LSBridge(commandBridge);
   * const ok = await ls.initialize();
   * if (!ok) {
   *     // Manual fallback: get port and csrf from your own discovery
   *     ls.setConnection(54321, 'abc123-csrf-token');
   * }
   * ```
   */
  setConnection(port, csrfToken, useTls = false) {
    this._port = port;
    this._csrfToken = csrfToken;
    this._useTls = useTls;
    log4.info(`LS connection set manually: port=${port}, tls=${useTls}, csrf=${csrfToken ? "provided" : "empty"}`);
  }
  // ─── Headless Cascade API ────────────────────────────────────────
  /**
   * Create a new cascade and optionally send a message.
   * Fully headless — no UI panel opened, no conversation switched.
   *
   * @returns cascadeId or null on failure
   */
  async createCascade(options) {
    this._ensureReady();
    const startResp = await this._rpc("StartCascade", { source: 0 });
    const cascadeId = startResp?.cascadeId;
    if (!cascadeId) {
      log4.error("StartCascade returned no cascadeId");
      return null;
    }
    log4.info(`Cascade created: ${cascadeId}`);
    if (options.text) {
      await this._sendMessage(cascadeId, options.text, options.model, options.plannerType);
      log4.info(`Message sent to: ${cascadeId}`);
    }
    return cascadeId;
  }
  /**
   * Send a message to an existing cascade.
   *
   * @returns true if sent successfully
   */
  async sendMessage(options) {
    this._ensureReady();
    await this._sendMessage(options.cascadeId, options.text, options.model);
    return true;
  }
  /**
   * Switch the UI to show a specific cascade conversation.
   */
  async focusCascade(cascadeId) {
    this._ensureReady();
    await this._rpc("SmartFocusConversation", { cascadeId });
  }
  /**
   * Cancel a running cascade invocation.
   */
  async cancelCascade(cascadeId) {
    this._ensureReady();
    await this._rpc("CancelCascadeInvocation", { cascadeId });
  }
  // ─── Conversation Annotations API ───────────────────────────────
  /**
   * Native conversation annotations (verified from jetski_cortex.proto).
   *
   * ConversationAnnotations protobuf fields:
   *   - title (string)              — custom user title, overrides auto-summary
   *   - tags (string[])             — tags/labels
   *   - archived (bool)             — archive status  
   *   - starred (bool)              — pinned/starred
   *   - last_user_view_time (Timestamp)
   *
   * @param cascadeId - Conversation ID
   * @param annotations - Partial annotation fields to set
   * @param merge - If true, merge with existing annotations (default: true)
   */
  async updateAnnotations(cascadeId, annotations, merge = true) {
    this._ensureReady();
    const proto = {};
    if (annotations.title !== void 0) proto.title = annotations.title;
    if (annotations.starred !== void 0) proto.starred = annotations.starred;
    if (annotations.archived !== void 0) proto.archived = annotations.archived;
    if (annotations.tags !== void 0) proto.tags = annotations.tags;
    await this._rpc("UpdateConversationAnnotations", {
      cascadeId,
      annotations: proto,
      mergeAnnotations: merge
    });
    log4.info(`Annotations updated for ${cascadeId.substring(0, 8)}...`);
  }
  /**
   * Set a custom title for a conversation.
   *
   * This sets the `title` field in ConversationAnnotations.
   * When set, this title should be displayed instead of the
   * auto-generated `summary` from the LLM.
   *
   * @param cascadeId - Conversation ID
   * @param title - Custom title to set
   */
  async setTitle(cascadeId, title) {
    await this.updateAnnotations(cascadeId, { title });
  }
  /**
   * Star (pin) or unstar a conversation.
   *
   * This sets the `starred` field in ConversationAnnotations.
   *
   * @param cascadeId - Conversation ID
   * @param starred - true to star, false to unstar
   */
  async setStar(cascadeId, starred) {
    await this.updateAnnotations(cascadeId, { starred });
  }
  // ─── Conversation Read API ──────────────────────────────────────
  /**
   * Get details of a specific conversation.
   */
  async getConversation(cascadeId) {
    this._ensureReady();
    return this._rpc("GetConversation", { cascadeId });
  }
  /**
   * Get all cascade trajectories (conversation list).
   */
  async listCascades() {
    this._ensureReady();
    log4.debug("listCascades: fetching all trajectories");
    const resp = await this._rpc("GetAllCascadeTrajectories", {});
    const summaries = resp?.trajectorySummaries ?? {};
    log4.debug(`listCascades: ${Object.keys(summaries).length} entries`);
    return summaries;
  }
  /**
   * Get trajectory descriptions (lighter than full trajectories).
   * Returns { trajectories: [...] }.
   */
  async getTrajectoryDescriptions() {
    this._ensureReady();
    return this._rpc("GetUserTrajectoryDescriptions", {});
  }
  /**
   * Get user status (tier, models, etc.)
   */
  async getUserStatus() {
    this._ensureReady();
    return this._rpc("GetUserStatus", {});
  }
  /**
   * Make a raw RPC call to any LS method.
   * @param method - RPC method name (e.g. 'StartCascade')
   * @param payload - JSON payload
   */
  async rawRPC(method, payload) {
    this._ensureReady();
    return this._rpc(method, payload);
  }
  // ─── Internal ────────────────────────────────────────────────────
  _ensureReady() {
    if (!this._port) {
      throw new Error("LSBridge not initialized. Call initialize() first.");
    }
  }
  async _sendMessage(cascadeId, text, model, plannerType) {
    const payload = {
      cascadeId,
      items: [{ chunk: { case: "text", value: text } }],
      cascadeConfig: {
        plannerConfig: {
          plannerTypeConfig: {
            case: plannerType || "conversational",
            value: {}
          },
          requestedModel: {
            choice: { case: "model", value: model || Models.GEMINI_FLASH }
          }
        }
      }
    };
    await this._rpc("SendUserCascadeMessage", payload);
  }
  /**
   * Discover LS port and CSRF token from the Language Server process.
   *
   * VERIFIED 2026-03-01 from Antigravity extension.js source:
   *
   * 1. CSRF header is "x-codeium-csrf-token" (NOT x-csrf-token)
   * 2. CSRF value is --csrf_token from CLI (NOT --extension_server_csrf_token)
   * 3. ConnectRPC endpoint is on httpsPort (HTTPS) or httpPort (HTTP)
   *    These ports are NOT in CLI args (--random_port flag means random).
   *    We discover them via netstat/PID, excluding extension_server_port.
   *
   * Source code proof:
   *   n.header.set("x-codeium-csrf-token", e)        // header name
   *   address = `127.0.0.1:${te.httpsPort}`           // ConnectRPC address
   *   csrfToken = a = d.randomUUID() → --csrf_token   // token source
   *   t.headers["x-codeium-csrf-token"] === this.csrfToken ? ... : 403
   *
   * Discovery: 2 phases
   *   Phase 1: Get-CimInstance/ps → PID, --csrf_token, --extension_server_port
   *   Phase 2: netstat → find LISTENING ports for PID, exclude ext_server_port
   */
  async _discoverFromProcess() {
    try {
      const platform = process.platform;
      let processInfo = await this._findLSProcess(platform);
      if (!processInfo) {
        log4.debug("No LS processes found");
        return null;
      }
      log4.debug(`LS process found: PID=${processInfo.pid}, csrf=present, ext_port=${processInfo.extPort}`);
      const connectPort = await this._findConnectPort(platform, processInfo.pid, processInfo.extPort);
      if (!connectPort) {
        log4.debug("Could not find ConnectRPC port via netstat, trying extension_server_port as fallback");
        if (processInfo.extPort) {
          return { port: processInfo.extPort, csrfToken: processInfo.csrfToken, useTls: false };
        }
        return null;
      }
      return {
        port: connectPort.port,
        csrfToken: processInfo.csrfToken,
        useTls: connectPort.tls
      };
    } catch (err) {
      log4.debug("Process discovery failed", err);
    }
    return null;
  }
  /**
   * Phase 1: Find the LS process for this workspace.
   */
  async _findLSProcess(platform) {
    const { exec } = __require("child_process");
    const { promisify } = __require("util");
    const execAsync = promisify(exec);
    let output;
    if (platform === "win32") {
      const psScript = "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'language_server' -and $_.CommandLine -match 'csrf_token' } | ForEach-Object { $_.ProcessId.ToString() + '|' + $_.CommandLine }";
      const encoded = Buffer.from(psScript, "utf16le").toString("base64");
      const result = await execAsync(
        `powershell.exe -NoProfile -EncodedCommand ${encoded}`,
        { encoding: "utf8", timeout: 1e4, windowsHide: true }
      );
      output = result.stdout;
    } else {
      const result = await execAsync(
        "ps -eo pid,args 2>/dev/null | grep language_server | grep csrf_token | grep -v grep",
        { encoding: "utf8", timeout: 5e3 }
      );
      output = result.stdout;
    }
    const lines = output.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const workspaceHint = this._getWorkspaceHint();
    let bestLine = null;
    if (workspaceHint) {
      for (const line of lines) {
        if (line.includes(workspaceHint)) {
          bestLine = line;
          break;
        }
      }
    }
    if (!bestLine) bestLine = lines[0];
    let pid;
    if (platform === "win32") {
      pid = parseInt(bestLine.split("|")[0].trim(), 10);
    } else {
      pid = parseInt(bestLine.trim().split(/\s+/)[0], 10);
    }
    const csrfToken = this._extractArg(bestLine, "csrf_token");
    const extPortStr = this._extractArg(bestLine, "extension_server_port");
    const extPort = extPortStr ? parseInt(extPortStr, 10) : 0;
    if (!csrfToken || isNaN(pid)) return null;
    return { pid, csrfToken, extPort };
  }
  /**
   * Phase 2: Find ConnectRPC port via netstat.
   *
   * The LS process listens on multiple ports:
   * - httpsPort (HTTPS, ConnectRPC) ← this is what we want
   * - httpPort  (HTTP, ConnectRPC)  ← also works
   * - lspPort   (LSP JSON-RPC)
   * - extension_server_port is separate (for Extension Host IPC)
   *
   * We find all LISTENING ports for the LS PID, exclude ext_server_port,
   * then try HTTPS first (preferred), fall back to HTTP.
   */
  async _findConnectPort(platform, pid, extPort) {
    try {
      const { exec } = __require("child_process");
      const { promisify } = __require("util");
      const execAsync = promisify(exec);
      let output;
      if (platform === "win32") {
        const result = await execAsync(
          `netstat -aon | findstr "LISTENING" | findstr "${pid}"`,
          { encoding: "utf8", timeout: 5e3, windowsHide: true }
        );
        output = result.stdout;
      } else {
        const result = await execAsync(
          `ss -tlnp 2>/dev/null | grep "pid=${pid}" || netstat -tlnp 2>/dev/null | grep "${pid}"`,
          { encoding: "utf8", timeout: 5e3 }
        );
        output = result.stdout;
      }
      const portMatches = output.matchAll(/127\.0\.0\.1:(\d+)/g);
      const ports = [];
      for (const m of portMatches) {
        const p = parseInt(m[1], 10);
        if (p !== extPort && !ports.includes(p)) {
          ports.push(p);
        }
      }
      if (ports.length === 0) return null;
      log4.debug(`LS ports (excl ext ${extPort}): ${ports.join(", ")}`);
      for (const port of ports) {
        log4.debug(`Probing port ${port} (HTTPS)...`);
        const tls = await this._probePort(port, true);
        if (tls) {
          log4.debug(`Port ${port} accepted HTTPS`);
          return { port, tls: true };
        }
      }
      for (const port of ports) {
        log4.debug(`Probing port ${port} (HTTP)...`);
        const http = await this._probePort(port, false);
        if (http) {
          log4.debug(`Port ${port} accepted HTTP`);
          return { port, tls: false };
        }
      }
    } catch (err) {
      log4.debug("netstat port discovery failed", err);
    }
    return null;
  }
  /**
   * Quick probe: check if a port accepts ConnectRPC requests.
   * Returns true if the port responds (even with error) on the given protocol.
   */
  _probePort(port, useTls) {
    const mod = useTls ? __require("https") : __require("http");
    const proto = useTls ? "https" : "http";
    return new Promise((resolve2) => {
      const req = mod.request(`${proto}://127.0.0.1:${port}/exa.language_server_pb.LanguageServerService/GetUserStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": 2 },
        rejectUnauthorized: false,
        timeout: 2e3
      }, (res) => {
        resolve2(res.statusCode === 401 || res.statusCode === 200);
      });
      req.on("error", () => resolve2(false));
      req.on("timeout", () => {
        req.destroy();
        resolve2(false);
      });
      req.write("{}");
      req.end();
    });
  }
  /**
   * Get a workspace hint string used to match the correct LS process.
   *
   * The LS process has --workspace_id like:
   *   file_d_3A_programming_better_antigravity
   * which is an encoded version of the workspace URI.
   */
  _getWorkspaceHint() {
    try {
      const vscode4 = __require("vscode");
      const folders = vscode4.workspace?.workspaceFolders;
      if (folders && folders.length > 0) {
        const folder = folders[0].uri.fsPath;
        const parts = folder.replace(/\\/g, "/").split("/");
        return parts.slice(-2).join("_").replace(/[-.\s]/g, "_").toLowerCase();
      }
    } catch {
    }
    return "";
  }
  /**
   * Extract a CLI argument value from a command-line string.
   * Supports both --key=value and --key value formats.
   */
  _extractArg(cmdLine, argName) {
    const eqMatch = cmdLine.match(new RegExp(`--${argName}=([^\\s"]+)`));
    if (eqMatch) return eqMatch[1];
    const spaceMatch = cmdLine.match(new RegExp(`--${argName}\\s+([^\\s"]+)`));
    if (spaceMatch) return spaceMatch[1];
    return null;
  }
  /**
   * Fallback: discover port from getDiagnostics console logs.
   * NOTE: This does NOT discover the CSRF token.
   * In recent Antigravity versions, the port URL may no longer appear in logs.
   */
  async _discoverPortFromDiagnostics() {
    try {
      const raw = await this._executeCommand("antigravity.getDiagnostics");
      if (!raw || typeof raw !== "string") return null;
      const diag = JSON.parse(raw);
      const logs = diag.agentWindowConsoleLogs || "";
      const m1 = logs.match(/127\.0\.0\.1:(\d+)\/exa\.language_server_pb/);
      if (m1) return parseInt(m1[1], 10);
      const m2 = logs.match(/https?:\/\/127\.0\.0\.1:(\d+)/);
      if (m2) return parseInt(m2[1], 10);
      if (diag.mainThreadLogs) {
        const mainLogs = typeof diag.mainThreadLogs === "string" ? diag.mainThreadLogs : JSON.stringify(diag.mainThreadLogs);
        const m3 = mainLogs.match(/127\.0\.0\.1:(\d+)/);
        if (m3) return parseInt(m3[1], 10);
      }
    } catch (err) {
      log4.error("Failed to discover LS port from diagnostics", err);
    }
    return null;
  }
  /**
   * Make an authenticated RPC call to the Language Server.
   * Sends x-csrf-token header when available.
   *
   * VERIFIED 2026-03-01:
   * - extension_server_port uses plain HTTP (no TLS)
   * - Main LS port (--random_port) uses HTTPS with self-signed cert
   */
  async _rpc(method, payload) {
    const httpModule = this._useTls ? __require("https") : __require("http");
    const protocol = this._useTls ? "https" : "http";
    const url = `${protocol}://127.0.0.1:${this._port}/exa.language_server_pb.LanguageServerService/${method}`;
    log4.debug(`RPC \u2192 ${method} (port=${this._port}, tls=${this._useTls}, csrf=${!!this._csrfToken})`);
    return new Promise((resolve2, reject) => {
      const body = JSON.stringify(payload);
      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      };
      if (this._csrfToken) {
        headers["x-codeium-csrf-token"] = this._csrfToken;
      }
      const reqOptions = {
        method: "POST",
        headers
      };
      if (this._useTls) {
        reqOptions.rejectUnauthorized = false;
      }
      const req = httpModule.request(url, reqOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode === 200) {
            log4.debug(`RPC \u2190 ${method} OK (${data.length} bytes)`);
            try {
              resolve2(JSON.parse(data));
            } catch {
              resolve2(data);
            }
          } else {
            const hint = res.statusCode === 401 ? " (CSRF token may be invalid or missing -- try setConnection() with the correct token)" : "";
            reject(new Error(`LS ${method}: ${res.statusCode} -- ${data.substring(0, 200)}${hint}`));
          }
        });
      });
      req.on("error", (err) => reject(err));
      req.write(body);
      req.end();
    });
  }
};

// src/cascade/cascade-manager.ts
var log5 = new Logger("CascadeManager");
var CascadeManager = class {
  constructor(_commands, _state) {
    this._commands = _commands;
    this._state = _state;
    this._disposables = new DisposableStore();
    this._sessions = [];
    this._initialized = false;
    // Events
    this._onSessionsChanged = this._disposables.add(new EventEmitter());
    /** Fires when the session list changes */
    this.onSessionsChanged = this._onSessionsChanged.event;
  }
  /**
   * Initialize the cascade manager.
   * Loads the initial session list from getDiagnostics.
   */
  async initialize() {
    if (this._initialized) return;
    await this._loadSessions();
    this._initialized = true;
    log5.info(`Initialized with ${this._sessions.length} sessions`);
  }
  // ─── Read API ───────────────────────────────────────────────────────────
  /**
   * Get all known Cascade sessions.
   *
   * Uses `getDiagnostics.recentTrajectories` (clean JSON with titles).
   *
   * @returns List of trajectory entries sorted by recency
   */
  async getSessions() {
    if (!this._initialized) {
      await this._loadSessions();
    }
    return [...this._sessions];
  }
  /**
   * Refresh the session list.
   *
   * @returns Updated session list
   */
  async refreshSessions() {
    await this._loadSessions();
    this._onSessionsChanged.fire(this._sessions);
    return [...this._sessions];
  }
  /**
   * Get agent preferences (all 16 sentinel values).
   */
  async getPreferences() {
    log5.debug("getPreferences: delegating to StateBridge");
    return this._state.getAgentPreferences();
  }
  /**
   * Get IDE diagnostics (176KB JSON with system info, logs, trajectories).
   *
   * Structure (verified):
   * - isRemote, systemInfo (OS, user, email)
   * - extensionLogs (Array[375])
   * - rendererLogs, mainThreadLogs, agentWindowConsoleLogs
   * - languageServerLogs
   * - recentTrajectories (Array[10])
   *
   * @returns Parsed diagnostics information
   */
  async getDiagnostics() {
    log5.debug("getDiagnostics: executing antigravity.getDiagnostics");
    const raw = await this._commands.execute(AntigravityCommands.GET_DIAGNOSTICS);
    if (!raw || typeof raw !== "string") {
      throw new Error("getDiagnostics returned unexpected type");
    }
    log5.debug(`getDiagnostics: raw length=${raw.length} bytes, parsing`);
    const parsed = JSON.parse(raw);
    log5.debug(`getDiagnostics: user=${parsed.systemInfo?.userName}, trajectories=${parsed.recentTrajectories?.length ?? 0}`);
    return {
      isRemote: parsed.isRemote ?? false,
      systemInfo: {
        operatingSystem: parsed.systemInfo?.operatingSystem ?? "unknown",
        timestamp: parsed.systemInfo?.timestamp ?? "",
        userEmail: parsed.systemInfo?.userEmail ?? "",
        userName: parsed.systemInfo?.userName ?? ""
      },
      raw: parsed
    };
  }
  /**
   * Get the Chrome DevTools MCP URL.
   *
   * Verified: returns `http://127.0.0.1:{port}/mcp`
   *
   * @returns MCP URL string
   */
  async getMcpUrl() {
    const result = await this._commands.execute("antigravity.getChromeDevtoolsMcpUrl");
    return result ?? "";
  }
  /**
   * Check if a file is gitignored.
   *
   * @param filePath - Relative or absolute file path
   * @returns true if gitignored, false/null otherwise
   */
  async isFileGitIgnored(filePath) {
    const result = await this._commands.execute("antigravity.isFileGitIgnored", filePath);
    return result === true;
  }
  // ─── Write API ──────────────────────────────────────────────────────────
  //
  // Two-layer architecture (VERIFIED 2026-02-28):
  //
  // Layer 1 -- HEADLESS LS API (RECOMMENDED):
  //   Access: sdk.ls (LSBridge from antigravity-sdk)
  //   Method: Preact VNode tree -> component.props.lsClient -> 148 LS methods
  //   Creates cascade WITHOUT opening panel or switching UI.
  //   Usage:  await sdk.ls.createCascade({ text: 'prompt' })
  //
  // Layer 2 — COMMAND API (FALLBACK, this file):
  //   Access: vscode.commands.executeCommand (extension host)
  //   Method: startNewConversation → sendPromptToAgentPanel → restore
  //   PROBLEM: Always switches UI, causes flickering, race conditions.
  //   Use only when renderer integration is not available.
  //
  // ────────────────────────────────────────────────────────────────────────
  /**
   * Create a new Cascade conversation via VS Code commands.
   *
   * ⚠️ **FALLBACK APPROACH** — causes UI flickering.
   * For true headless creation, use `sdk.ls.createCascade()`
   * from the SDK's LS bridge (see LSBridge module).
   *
   * VERIFIED 2026-02-28:
   * - `startNewConversation` ✅ creates new chat (but switches UI)
   * - `prioritized.chat.openNewConversation` ❌ does NOT create new
   * - `sendPromptToAgentPanel` ✅ sends to currently visible chat (always opens panel)
   * - `sendTextToChat` ❌ does not visibly work
   *
   * @param options - Session creation options
   * @returns Session ID (googleAgentId) or empty string if not detected
   */
  async createSession(options) {
    log5.info(`Creating session (command fallback): "${options.task.substring(0, 50)}..."`);
    const beforeIds = new Set(this._sessions.map((s) => s.id));
    let previousActiveId = "";
    if (options.background) {
      try {
        const raw = await this._commands.execute(AntigravityCommands.GET_DIAGNOSTICS);
        if (raw && typeof raw === "string") {
          const diag = JSON.parse(raw);
          if (Array.isArray(diag.recentTrajectories) && diag.recentTrajectories.length > 0) {
            previousActiveId = diag.recentTrajectories[0].googleAgentId ?? "";
          }
        }
      } catch {
      }
    }
    await this._commands.execute(AntigravityCommands.START_NEW_CONVERSATION);
    await this._delay(1500);
    if (options.task) {
      await this._commands.execute(AntigravityCommands.SEND_PROMPT_TO_AGENT, options.task);
    }
    if (options.background) {
      await this._commands.execute(AntigravityCommands.TRACK_BACKGROUND_CONVERSATION);
    }
    const newId = await this._waitForNewSession(beforeIds, 8e3);
    if (options.background && previousActiveId) {
      await this._delay(500);
      await this._commands.execute(AntigravityCommands.SET_VISIBLE_CONVERSATION, previousActiveId);
      log5.info(`Background session created, restored to ${previousActiveId}`);
    }
    if (newId) {
      log5.info(`Session created: ${newId}`);
    } else {
      log5.warn("Session created but ID not detected within timeout");
    }
    return newId;
  }
  /**
   * Create a background Cascade conversation via commands.
   *
   * ⚠️ **FALLBACK** — Uses quick-switch approach (UI flickers briefly).
   * For true headless background sessions, use the SDK's LS bridge:
   * ```typescript
   * // Using LSBridge:
   * const cascadeId = await sdk.ls.createCascade({ text: 'task', modelId: 1018 });
   * ```
   *
   * @param task - Initial task/prompt to send
   * @returns Session ID or empty string
   */
  async createBackgroundSession(task) {
    return this.createSession({ task, background: true });
  }
  /**
   * Send a message to the active Cascade conversation.
   *
   * Uses `antigravity.sendTextToChat` — the primary text sending command.
   */
  async sendMessage(text) {
    await this._commands.execute(AntigravityCommands.SEND_TEXT_TO_CHAT, text);
  }
  /**
   * Send a prompt directly to the agent panel.
   *
   * Uses `antigravity.sendPromptToAgentPanel` — focuses the agent panel.
   */
  async sendPrompt(text) {
    await this._commands.execute(AntigravityCommands.SEND_PROMPT_TO_AGENT, text);
  }
  /**
   * Send a chat action message (e.g., typing indicator, feedback).
   *
   * Uses `antigravity.sendChatActionMessage`.
   */
  async sendChatAction(action) {
    await this._commands.execute(AntigravityCommands.SEND_CHAT_ACTION, action);
  }
  /**
   * Switch to a specific conversation.
   *
   * @param sessionId - Conversation UUID (googleAgentId)
   */
  async focusSession(sessionId) {
    await this._commands.execute(AntigravityCommands.SET_VISIBLE_CONVERSATION, sessionId);
  }
  /**
   * Open a new conversation in the agent panel (prioritized command).
   *
   * Uses `antigravity.prioritized.chat.openNewConversation` which both
   * opens the panel AND creates a fresh conversation.
   */
  async openNewConversation() {
    await this._commands.execute(AntigravityCommands.OPEN_NEW_CONVERSATION);
  }
  /**
   * Execute a Cascade action.
   *
   * Uses `antigravity.executeCascadeAction`.
   *
   * @param action - Action data to execute
   */
  async executeCascadeAction(action) {
    await this._commands.execute(AntigravityCommands.EXECUTE_CASCADE_ACTION, action);
  }
  // ─── Step Control ───────────────────────────────────────────────────────
  /**
   * Accept the current agent step (code edit, file write, etc.).
   *
   * Uses `antigravity.agent.acceptAgentStep`.
   */
  async acceptStep() {
    await this._commands.execute(AntigravityCommands.ACCEPT_AGENT_STEP);
  }
  /** Reject the current agent step. */
  async rejectStep() {
    await this._commands.execute(AntigravityCommands.REJECT_AGENT_STEP);
  }
  /**
   * Accept a pending command (non-terminal, e.g. file edit confirmation).
   *
   * Uses `antigravity.command.accept`.
   * This is DIFFERENT from terminalCommand.accept.
   */
  async acceptCommand() {
    await this._commands.execute(AntigravityCommands.COMMAND_ACCEPT);
  }
  /** Reject a pending command (non-terminal). */
  async rejectCommand() {
    await this._commands.execute(AntigravityCommands.COMMAND_REJECT);
  }
  // ─── Terminal Control ───────────────────────────────────────────────────
  /**
   * Accept a pending terminal command.
   *
   * Uses `antigravity.terminalCommand.accept`.
   */
  async acceptTerminalCommand() {
    await this._commands.execute(AntigravityCommands.TERMINAL_ACCEPT);
  }
  /** Reject a pending terminal command. */
  async rejectTerminalCommand() {
    await this._commands.execute(AntigravityCommands.TERMINAL_REJECT);
  }
  /** Run a pending terminal command. */
  async runTerminalCommand() {
    await this._commands.execute(AntigravityCommands.TERMINAL_RUN);
  }
  // ─── Panel Control ──────────────────────────────────────────────────────
  /** Open the Cascade agent panel */
  async openPanel() {
    await this._commands.execute(AntigravityCommands.OPEN_AGENT_PANEL);
  }
  /** Focus the Cascade agent panel */
  async focusPanel() {
    await this._commands.execute(AntigravityCommands.FOCUS_AGENT_PANEL);
  }
  /** Open the agent side panel */
  async openSidePanel() {
    await this._commands.execute(AntigravityCommands.OPEN_AGENT_SIDE_PANEL);
  }
  /** Focus the agent side panel */
  async focusSidePanel() {
    await this._commands.execute(AntigravityCommands.FOCUS_AGENT_SIDE_PANEL);
  }
  /**
   * Get the browser integration port (e.g., 57401).
   */
  async getBrowserPort() {
    return this._commands.execute(AntigravityCommands.GET_BROWSER_PORT);
  }
  // ─── Private ────────────────────────────────────────────────────────────
  /**
   * Load sessions from getDiagnostics.recentTrajectories (clean JSON).
   *
   * VERIFIED structure per entry:
   * {
   *   googleAgentId: "uuid",      ← conversation ID
   *   trajectoryId:  "uuid",      ← internal trajectory ID
   *   summary:       "title",     ← human-readable title
   *   lastStepIndex: 992,         ← step count
   *   lastModifiedTime: "ISO"     ← last activity
   * }
   */
  async _loadSessions() {
    try {
      const raw = await this._commands.execute(AntigravityCommands.GET_DIAGNOSTICS);
      if (raw && typeof raw === "string") {
        const diag = JSON.parse(raw);
        if (Array.isArray(diag.recentTrajectories)) {
          this._sessions = diag.recentTrajectories.map((entry) => ({
            id: entry.googleAgentId ?? "",
            title: entry.summary ?? "Untitled",
            stepCount: entry.lastStepIndex ?? 0,
            workspaceUri: "",
            lastModifiedTime: entry.lastModifiedTime ?? "",
            trajectoryId: entry.trajectoryId ?? ""
          }));
          log5.debug(`Loaded ${this._sessions.length} sessions from getDiagnostics`);
          return;
        }
      }
    } catch (error) {
      log5.warn("getDiagnostics failed, falling back to USS", error);
    }
    try {
      await this._loadSessionsFromUSS();
    } catch (error) {
      log5.error("Failed to load sessions from USS", error);
      this._sessions = [];
    }
  }
  /**
   * Fallback: extract sessions from USS trajectory summaries protobuf.
   */
  async _loadSessionsFromUSS() {
    const raw = await this._state.getRawValue("antigravityUnifiedStateSync.trajectorySummaries");
    if (!raw) {
      this._sessions = [];
      return;
    }
    const buffer = Buffer.from(raw, "base64");
    const text = buffer.toString("utf8");
    const uuids = [...new Set(text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || [])];
    this._sessions = uuids.map((id, i) => ({
      id,
      title: `Conversation ${i + 1}`,
      stepCount: 0,
      workspaceUri: ""
    }));
    log5.debug(`Loaded ${this._sessions.length} sessions from USS (fallback)`);
  }
  /**
   * Wait for a new session to appear in getDiagnostics.
   * Polls every 500ms up to timeoutMs.
   *
   * @returns New session ID or empty string if timeout
   */
  async _waitForNewSession(beforeIds, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    const pollInterval = 500;
    while (Date.now() < deadline) {
      await this._delay(pollInterval);
      try {
        const raw = await this._commands.execute(AntigravityCommands.GET_DIAGNOSTICS);
        if (!raw || typeof raw !== "string") continue;
        const diag = JSON.parse(raw);
        if (!Array.isArray(diag.recentTrajectories)) continue;
        for (const entry of diag.recentTrajectories) {
          const id = entry.googleAgentId;
          if (id && !beforeIds.has(id)) {
            await this._loadSessions();
            return id;
          }
        }
      } catch {
      }
    }
    return "";
  }
  /**
   * Simple delay utility.
   */
  _delay(ms) {
    return new Promise((resolve2) => setTimeout(resolve2, ms));
  }
  dispose() {
    this._disposables.dispose();
  }
};

// src/integration/types.ts
var IntegrationPoint = /* @__PURE__ */ ((IntegrationPoint2) => {
  IntegrationPoint2["TOP_BAR"] = "topBar";
  IntegrationPoint2["TOP_RIGHT"] = "topRight";
  IntegrationPoint2["INPUT_AREA"] = "inputArea";
  IntegrationPoint2["BOTTOM_ICONS"] = "bottomIcons";
  IntegrationPoint2["TURN_METADATA"] = "turnMeta";
  IntegrationPoint2["USER_BADGE"] = "userBadge";
  IntegrationPoint2["BOT_ACTION"] = "botAction";
  IntegrationPoint2["DROPDOWN_MENU"] = "dropdownMenu";
  IntegrationPoint2["CHAT_TITLE"] = "chatTitle";
  return IntegrationPoint2;
})(IntegrationPoint || {});

// src/integration/selectors.ts
var Selectors = {
  /** The entire agent side panel container */
  PANEL: ".antigravity-agent-side-panel",
  /** Top bar with title and action icons */
  TOP_BAR: ".flex.items-center.justify-between",
  /** Icons area in top bar (contains +, refresh, ..., X) */
  TOP_ICONS: ".flex.items-center.gap-2",
  /** Chat title element */
  TITLE: ".flex.min-w-0.items-center.overflow-hidden",
  /** Message turns container (direct children are turns) */
  TURNS_CONTAINER: "#conversation .gap-y-3",
  /** User message bubble (inside turn) */
  USER_BUBBLE: ".rounded-lg",
  /** Input box container */
  INPUT_BOX: "#antigravity\\.agentSidePanelInputBox",
  /** 3-dot dropdown menu (appears dynamically) */
  DROPDOWN_MARKER_TEXT: ["Customization", "Export"],
  /** Dropdown menu item class pattern */
  DROPDOWN_ITEM: ".cursor-pointer"};
var AG_PREFIX = "ag-";
var AG_DATA_ATTR = "data-ag-sdk";

// src/integration/script-generator.ts
var ScriptGenerator = class {
  /**
   * Generate the complete integration script.
   *
   * @param configs — Registered integration configurations
   * @param namespace — Optional namespace slug for file naming (used for heartbeat URL)
   * @returns — Complete JS code as a string
   */
  generate(configs, namespace) {
    const parts = [];
    parts.push(this._header());
    parts.push(this._css(configs));
    parts.push(this._helpers());
    parts.push(this._toast());
    parts.push(this._stats());
    const grouped = this._groupByPoint(configs);
    for (const [point, cfgs] of Object.entries(grouped)) {
      parts.push(this._generatePoint(point, cfgs));
    }
    parts.push(this._mainLoop(Object.keys(grouped)));
    parts.push(this._footer(namespace));
    return parts.join("\n");
  }
  // ─── Grouping ──────────────────────────────────────────────────────
  _groupByPoint(configs) {
    const groups = {};
    for (const c of configs) {
      if (c.enabled === false) continue;
      if (!groups[c.point]) groups[c.point] = [];
      groups[c.point].push(c);
    }
    return groups;
  }
  // ─── Code Sections ────────────────────────────────────────────────
  _header() {
    return `(function agSDK(){
'use strict';
if(window.__agSDK)return;
window.__agSDK=true;

// \u2500\u2500\u2500 Theme Detection \u2500\u2500\u2500
var _isDark=document.body.classList.contains('vscode-dark')||document.body.classList.contains('vscode-high-contrast');
var _theme={
  bg:_isDark?'rgba(25,25,30,.95)':'rgba(245,245,250,.95)',
  fg:_isDark?'#ccc':'#333',
  fgDim:_isDark?'rgba(200,200,200,.45)':'rgba(80,80,80,.5)',
  fgHover:_isDark?'rgba(200,200,200,.8)':'rgba(40,40,40,.9)',
  accent:_isDark?'#4fc3f7':'#0288d1',
  accentBg:_isDark?'rgba(79,195,247,.12)':'rgba(2,136,209,.08)',
  success:_isDark?'#81c784':'#388e3c',
  successBg:_isDark?'rgba(76,175,80,.1)':'rgba(56,142,60,.06)',
  warn:_isDark?'#ffb74d':'#e65100',
  border:_isDark?'rgba(79,195,247,.06)':'rgba(0,0,0,.06)',
  borderHover:_isDark?'rgba(79,195,247,.2)':'rgba(2,136,209,.15)',
  sep:_isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)',
  shadow:_isDark?'rgba(0,0,0,.5)':'rgba(0,0,0,.15)',
  metaBg:_isDark?'linear-gradient(135deg,rgba(79,195,247,.03),rgba(156,39,176,.02))':'linear-gradient(135deg,rgba(2,136,209,.03),rgba(123,31,162,.02))',
  metaBgHover:_isDark?'linear-gradient(135deg,rgba(79,195,247,.07),rgba(156,39,176,.05))':'linear-gradient(135deg,rgba(2,136,209,.07),rgba(123,31,162,.05))'
};
// Watch for theme changes (VS Code toggles body classes)
new MutationObserver(function(){var newDark=document.body.classList.contains('vscode-dark');if(newDark!==_isDark){location.reload();}}).observe(document.body,{attributes:true,attributeFilter:['class']});
`;
  }
  _footer(namespace) {
    const heartbeatFile = namespace ? `ag-sdk-${namespace}-heartbeat` : "ag-sdk-heartbeat";
    return `
var _heartbeatMaxAge=172800000;
function checkHeartbeat(){
  try{
    var xhr=new XMLHttpRequest();
    xhr.open('GET','./${heartbeatFile}?t='+Date.now(),false);
    xhr.send();
    if(xhr.status!==200)return false;
    var ts=parseInt(xhr.responseText,10);
    if(isNaN(ts))return false;
    return(Date.now()-ts)<_heartbeatMaxAge;
  }catch(e){return false;}
}
function boot(){
  if(!checkHeartbeat()){
    console.log('[AG SDK] Heartbeat missing or stale \u2014 extension disabled? Skipping.');
    return;
  }
  if(document.readyState==='complete')setTimeout(start,3000);
  else window.addEventListener('load',function(){setTimeout(start,3000);});
}
boot();
})();`;
  }
  _css(configs) {
    new Set(configs.map((c) => c.point));
    return `
// \u2500\u2500\u2500 Theme-Aware CSS \u2500\u2500\u2500
var _cssRules=[
  '.${AG_PREFIX}meta{padding:3px 8px;background:'+_theme.metaBg+';border-top:1px solid '+_theme.border+';font-family:"Cascadia Code","Fira Code",monospace;font-size:9px;color:'+_theme.fgDim+';display:flex;align-items:center;gap:5px;flex-wrap:wrap;transition:all .2s;cursor:default;user-select:none;margin-top:2px;border-radius:0 0 6px 6px}',
  '.${AG_PREFIX}meta:hover{background:'+_theme.metaBgHover+';color:'+_theme.fgHover+'}',
  '.${AG_PREFIX}t{padding:1px 4px;border-radius:3px;font-size:8px;font-weight:700;letter-spacing:.3px}',
  '.${AG_PREFIX}u{background:'+_theme.successBg+';color:'+_theme.success+'}',
  '.${AG_PREFIX}b{background:'+_theme.accentBg+';color:'+_theme.accent+'}',
  '.${AG_PREFIX}k{color:'+_theme.fgDim+';font-size:8px}',
  '.${AG_PREFIX}v{color:'+_theme.fg+';font-size:8px;opacity:.55}',
  '.${AG_PREFIX}hi{color:'+_theme.accent+'}',
  '.${AG_PREFIX}w{color:'+_theme.warn+'}',
  '.${AG_PREFIX}s{color:'+_theme.sep+'}',
  // Toast
  '.${AG_PREFIX}toast{position:fixed;bottom:80px;right:20px;background:'+_theme.bg+';border:1px solid '+_theme.borderHover+';border-radius:8px;padding:10px 14px;font-family:"Cascadia Code",monospace;font-size:10px;color:'+_theme.fg+';z-index:99999;max-width:320px;backdrop-filter:blur(10px);box-shadow:0 4px 24px '+_theme.shadow+';animation:${AG_PREFIX}fade .25s ease}',
  '@keyframes ${AG_PREFIX}fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
  '.${AG_PREFIX}toast-t{color:'+_theme.accent+';font-weight:700;margin-bottom:5px;font-size:11px;display:flex;align-items:center;gap:6px}',
  '.${AG_PREFIX}toast-r{display:flex;gap:8px;margin:1px 0}',
  '.${AG_PREFIX}toast-k{color:'+_theme.fgDim+';min-width:70px}',
  '.${AG_PREFIX}toast-v{color:'+_theme.fg+'}',
  '.${AG_PREFIX}toast-badge{font-size:8px;padding:1px 5px;border-radius:3px;font-weight:700}',
  // Buttons
  '.${AG_PREFIX}hdr{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:4px;cursor:pointer;color:'+_theme.fgDim+';font-size:9px;font-family:"Cascadia Code",monospace;transition:all .15s;user-select:none}',
  '.${AG_PREFIX}hdr:hover{background:'+_theme.accentBg+';color:'+_theme.accent+'}',
  '.${AG_PREFIX}inp{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:4px;cursor:pointer;color:'+_theme.fgDim+';font-size:11px;transition:all .15s;flex-shrink:0;padding:0 4px;font-family:"Cascadia Code",monospace}',
  '.${AG_PREFIX}inp:hover{background:'+_theme.accentBg+';color:'+_theme.accent+'}',
  '.${AG_PREFIX}menu{padding:4px 8px;cursor:pointer;font-size:11px;color:'+_theme.fg+';opacity:.7;transition:all .12s;display:flex;align-items:center;gap:6px;white-space:nowrap}',
  '.${AG_PREFIX}menu:hover{background:'+_theme.accentBg+';color:'+_theme.accent+';opacity:1}',
  '.${AG_PREFIX}vote{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:3px;cursor:pointer;color:'+_theme.fgDim+';font-size:9px;font-family:"Cascadia Code",monospace;transition:all .15s;margin-left:4px}',
  '.${AG_PREFIX}vote:hover{background:'+_theme.accentBg+';color:'+_theme.accent+'}',
  '.${AG_PREFIX}ubadge{display:inline-flex;align-items:center;gap:2px;padding:1px 5px;border-radius:3px;background:'+_theme.successBg+';cursor:pointer;color:'+_theme.success+';opacity:.4;font-size:8px;font-family:"Cascadia Code",monospace;transition:all .15s;margin-left:3px}',
  '.${AG_PREFIX}ubadge:hover{background:'+_theme.successBg+';color:'+_theme.success+';opacity:1}',
  '.${AG_PREFIX}title-hint{position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:8px;color:'+_theme.accent+';opacity:.3;pointer-events:none;font-family:"Cascadia Code",monospace;transition:opacity .2s}',
  '.${AG_PREFIX}title-wrap:hover .${AG_PREFIX}title-hint{opacity:1}'
];
var css=document.createElement('style');
css.textContent=_cssRules.join('\\n');
document.head.appendChild(css);
`;
  }
  _helpers() {
    return `
function mk(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function fmt(n){return n>=1000?(n/1000).toFixed(1)+'k':''+n;}
`;
  }
  _toast() {
    return `
var _toastT=0;
function toast(title,badge,rows){
  var old=document.querySelector('.${AG_PREFIX}toast');if(old)old.remove();
  var t=mk('div','${AG_PREFIX}toast');
  var hdr=mk('div','${AG_PREFIX}toast-t');
  hdr.appendChild(document.createTextNode(title));
  if(badge){var b=mk('span','${AG_PREFIX}toast-badge');b.textContent=badge[0];b.style.background=badge[1];b.style.color=badge[2];hdr.appendChild(b);}
  t.appendChild(hdr);
  rows.forEach(function(r){var row=mk('div','${AG_PREFIX}toast-r');row.appendChild(mk('span','${AG_PREFIX}toast-k',r[0]));row.appendChild(mk('span','${AG_PREFIX}toast-v',r[1]));t.appendChild(row);});
  document.body.appendChild(t);
  clearTimeout(_toastT);_toastT=setTimeout(function(){if(t.parentNode)t.remove();},6000);
  t.addEventListener('click',function(){t.remove();});
}
`;
  }
  _stats() {
    return `
function getStats(){
  var c=document.querySelector(${JSON.stringify(Selectors.TURNS_CONTAINER)});
  if(!c)return null;
  var turns=0,uC=0,bC=0,code=0;
  Array.from(c.children).forEach(function(ch){
    if(ch.getAttribute('${AG_DATA_ATTR}')||ch.children.length<1)return;
    turns++;
    uC+=(ch.children[0]?.textContent?.trim()||'').length;
    bC+=(ch.children[1]?.textContent?.trim()||'').length;
    code+=(ch.children[1]?.querySelectorAll('pre')?.length||0);
  });
  return{turns:turns,u:uC,b:bC,code:code};
}
`;
  }
  // ─── Point generators ─────────────────────────────────────────────
  _generatePoint(point, configs) {
    switch (point) {
      case "topBar" /* TOP_BAR */:
        return this._genTopBar(configs);
      case "topRight" /* TOP_RIGHT */:
        return this._genTopRight(configs);
      case "inputArea" /* INPUT_AREA */:
        return this._genInputArea(configs);
      case "bottomIcons" /* BOTTOM_ICONS */:
        return this._genBottomIcons(configs);
      case "turnMeta" /* TURN_METADATA */:
        return this._genTurnMeta(configs);
      case "userBadge" /* USER_BADGE */:
        return this._genUserBadge(configs);
      case "botAction" /* BOT_ACTION */:
        return this._genBotAction(configs);
      case "dropdownMenu" /* DROPDOWN_MENU */:
        return this._genDropdown(configs);
      case "chatTitle" /* CHAT_TITLE */:
        return this._genTitle(configs);
      default:
        return `// Unknown point: ${point}`;
    }
  }
  _genToastCall(toast) {
    if (!toast) return "";
    const badge = toast.badge ? `[${JSON.stringify(toast.badge.text)},${JSON.stringify(toast.badge.bgColor)},${JSON.stringify(toast.badge.textColor)}]` : "null";
    const rows = toast.rows.map((r) => {
      if (r.dynamic) {
        return `[${JSON.stringify(r.key)},${r.value}]`;
      }
      return `[${JSON.stringify(r.key)},${JSON.stringify(r.value)}]`;
    }).join(",");
    return `toast(${JSON.stringify(toast.title)},${badge},[${rows}]);`;
  }
  _genTopBar(configs) {
    const buttons = configs.map((c) => {
      const toastCall = this._genToastCall(c.toast);
      return `  var btn_${c.id}=mk('a','${AG_PREFIX}hdr ${AG_PREFIX}${c.id}');
  btn_${c.id}.textContent=${JSON.stringify(c.icon)};
  btn_${c.id}.title=${JSON.stringify(c.tooltip || "")};
  btn_${c.id}.addEventListener('click',function(){${toastCall}});
  iconsArea.insertBefore(btn_${c.id},iconsArea.children[1]);`;
    });
    return `
function integrateTopBar(){
  var p=document.querySelector(${JSON.stringify(Selectors.PANEL)});if(!p)return;
  var topBar=p.querySelector(${JSON.stringify(Selectors.TOP_BAR)});if(!topBar)return;
  var iconsArea=topBar.querySelector(${JSON.stringify(Selectors.TOP_ICONS)});
  if(!iconsArea||iconsArea.querySelector('.${AG_PREFIX}${configs[0].id}'))return;
${buttons.join("\n")}
}
`;
  }
  _genTopRight(configs) {
    const buttons = configs.map((c) => {
      const toastCall = this._genToastCall(c.toast);
      return `  var btn_${c.id}=mk('a','${AG_PREFIX}hdr ${AG_PREFIX}${c.id}');
  btn_${c.id}.textContent=${JSON.stringify(c.icon)};
  btn_${c.id}.title=${JSON.stringify(c.tooltip || "")};
  btn_${c.id}.addEventListener('click',function(){${toastCall}});
  iconsArea.insertBefore(btn_${c.id},iconsArea.lastElementChild);`;
    });
    return `
function integrateTopRight(){
  var p=document.querySelector(${JSON.stringify(Selectors.PANEL)});if(!p)return;
  var topBar=p.querySelector(${JSON.stringify(Selectors.TOP_BAR)});if(!topBar)return;
  var iconsArea=topBar.querySelector(${JSON.stringify(Selectors.TOP_ICONS)});
  if(!iconsArea||iconsArea.querySelector('.${AG_PREFIX}${configs[0].id}'))return;
${buttons.join("\n")}
}
`;
  }
  _genInputArea(configs) {
    const buttons = configs.map((c) => {
      const toastCall = this._genToastCall(c.toast);
      return `  var btn=mk('div','${AG_PREFIX}inp ${AG_PREFIX}${c.id}');
  btn.textContent=${JSON.stringify(c.icon)};
  btn.title=${JSON.stringify(c.tooltip || "")};
  btn.addEventListener('click',function(){${toastCall}});
  btnRow.insertBefore(btn,btnRow.firstChild);`;
    });
    return `
function integrateInputArea(){
  var ib=document.querySelector(${JSON.stringify(Selectors.INPUT_BOX)});
  if(!ib||ib.querySelector('.${AG_PREFIX}${configs[0].id}'))return;
  var allBtns=ib.querySelectorAll('button,[role="button"]');
  if(allBtns.length===0)return;
  var btnRow=allBtns[allBtns.length-1].parentElement;if(!btnRow)return;
${buttons.join("\n")}
}
`;
  }
  _genBottomIcons(configs) {
    const buttons = configs.map((c) => {
      const toastCall = this._genToastCall(c.toast);
      return `  var btn=mk('div','${AG_PREFIX}inp ${AG_PREFIX}${c.id}');
  btn.textContent=${JSON.stringify(c.icon)};
  btn.title=${JSON.stringify(c.tooltip || "")};
  btn.addEventListener('click',function(){${toastCall}});
  row.appendChild(btn);`;
    });
    return `
function integrateBottomIcons(){
  var ib=document.querySelector(${JSON.stringify(Selectors.INPUT_BOX)});
  if(!ib||ib.querySelector('.${AG_PREFIX}${configs[0].id}'))return;
  var rows=ib.querySelectorAll('.flex.items-center');
  var row=null;
  for(var i=0;i<rows.length;i++){if(rows[i].querySelectorAll('svg').length>=2){row=rows[i];}}
  if(!row)return;
${buttons.join("\n")}
}
`;
  }
  _genTurnMeta(configs) {
    const cfg = configs[0];
    const metricParts = [];
    for (const m of cfg.metrics) {
      switch (m) {
        case "turnNumber":
          metricParts.push(`meta.appendChild(mk('span','${AG_PREFIX}t ${AG_PREFIX}b','T'+tI));`);
          break;
        case "userCharCount":
          metricParts.push(`if(uL>0){meta.appendChild(mk('span','${AG_PREFIX}t ${AG_PREFIX}u','USER'));meta.appendChild(mk('span','${AG_PREFIX}k',fmt(uL)));}`);
          break;
        case "separator":
          metricParts.push(`if(uL>0&&bL>0)meta.appendChild(mk('span','${AG_PREFIX}s','\\u2502'));`);
          break;
        case "aiCharCount":
          metricParts.push(`if(bL>0){meta.appendChild(mk('span','${AG_PREFIX}t ${AG_PREFIX}b','AI'));meta.appendChild(mk('span','${AG_PREFIX}k',fmt(bL)));}`);
          break;
        case "codeBlocks":
          metricParts.push(`if(codes>0){meta.appendChild(mk('span','${AG_PREFIX}k','code:'));meta.appendChild(mk('span','${AG_PREFIX}v ${AG_PREFIX}w',''+codes));}`);
          break;
        case "thinkingIndicator":
          metricParts.push(`if(brain)meta.appendChild(mk('span','${AG_PREFIX}v','\\u{1F9E0}'));`);
          break;
        case "ratio":
          metricParts.push(`if(uL>0&&bL>0){meta.appendChild(mk('span','${AG_PREFIX}k',(bL/uL).toFixed(1)+'x'));}`);
          break;
      }
    }
    const clickHandler = cfg.clickable !== false ? `meta.addEventListener('click',function(){toast('Turn '+tI,null,[['user:',fmt(uL)],['AI:',fmt(bL)],['ratio:',uL>0?(bL/uL).toFixed(1)+'x':'\\u2014']]);});` : "";
    return `
function integrateTurnMeta(){
  var c=document.querySelector(${JSON.stringify(Selectors.TURNS_CONTAINER)});if(!c)return;
  var tI=0;
  Array.from(c.children).forEach(function(turn){
    if(turn.getAttribute('${AG_DATA_ATTR}')||turn.children.length<1)return;
    turn.setAttribute('${AG_DATA_ATTR}','1');
    tI++;var uL=(turn.children[0]?.textContent?.trim()||'').length;
    var bL=(turn.children[1]?.textContent?.trim()||'').length;
    if(uL===0&&bL===0)return;
    var codes=turn.children[1]?.querySelectorAll('pre')?.length||0;
    var brain=(turn.children[1]?.textContent||'').includes('Thought');
    var meta=mk('div','${AG_PREFIX}meta');
    ${metricParts.join("\n    ")}
    ${clickHandler}
    turn.appendChild(meta);
  });
}
`;
  }
  _genUserBadge(configs) {
    const cfg = configs[0];
    let displayExpr = 'fmt(uLen)+" ch"';
    if (cfg.display === "wordCount") {
      displayExpr = '(txt.split(/\\\\s+/).length)+" w"';
    } else if (cfg.display === "custom" && cfg.customFormat) {
      displayExpr = cfg.customFormat;
    }
    return `
function integrateUserBadges(){
  var c=document.querySelector(${JSON.stringify(Selectors.TURNS_CONTAINER)});if(!c)return;
  Array.from(c.children).forEach(function(turn,i){
    if(turn.getAttribute('${AG_DATA_ATTR}u')||turn.children.length<1)return;
    var bubble=turn.children[0]?.querySelector(${JSON.stringify(Selectors.USER_BUBBLE)});
    if(!bubble)return;
    var txt=turn.children[0]?.textContent?.trim()||'';
    var uLen=txt.length;if(uLen<5)return;
    turn.setAttribute('${AG_DATA_ATTR}u','1');
    var row=turn.children[0]?.querySelector('.flex.w-full,.flex.flex-row')||turn.children[0];
    var badge=mk('span','${AG_PREFIX}ubadge');
    badge.textContent=${displayExpr};
    badge.title='SDK: User message';
    row.appendChild(badge);
  });
}
`;
  }
  _genBotAction(configs) {
    const items = configs.map((c) => {
      const toastCall = this._genToastCall(c.toast);
      return `var b=mk('span','${AG_PREFIX}vote');b.textContent=${JSON.stringify(c.icon + " " + c.label)};
      b.addEventListener('click',function(ev){ev.stopPropagation();${toastCall}});
      row.appendChild(b);`;
    });
    return `
function integrateBotAction(){
  var c=document.querySelector(${JSON.stringify(Selectors.TURNS_CONTAINER)});if(!c)return;
  c.querySelectorAll('span,button,a,div').forEach(function(el){
    if(el.getAttribute('${AG_DATA_ATTR}v'))return;
    var txt=el.textContent?.trim();
    if(txt==='Good'||txt==='Bad'){
      var row=el.parentElement;if(!row||row.querySelector('.${AG_PREFIX}vote'))return;
      el.setAttribute('${AG_DATA_ATTR}v','1');
      ${items.join("\n      ")}
    }
  });
}
`;
  }
  _genDropdown(configs) {
    const markers = JSON.stringify(Selectors.DROPDOWN_MARKER_TEXT);
    const items = configs.map((c) => {
      const toastCall = this._genToastCall(c.toast);
      const sep = c.separator ? `var sep=mk('div','');sep.style.cssText='height:1px;background:rgba(255,255,255,.06);margin:4px 8px';dd.appendChild(sep);` : "";
      return `${sep}
    var mi=mk('div','${AG_PREFIX}menu');
    ${c.icon ? `mi.appendChild(mk('span','',${JSON.stringify(c.icon)}));` : ""}
    mi.appendChild(document.createTextNode(${JSON.stringify(c.label)}));
    mi.addEventListener('click',function(){${toastCall}});
    dd.appendChild(mi);`;
    });
    return `
function integrateDropdown(){
  var dds=document.querySelectorAll('.rounded-bg.py-1,.rounded-lg.py-1');
  dds.forEach(function(dd){
    if(dd.getAttribute('${AG_DATA_ATTR}m'))return;
    var items=dd.querySelectorAll(${JSON.stringify(Selectors.DROPDOWN_ITEM)});
    var markers=${markers};
    var found=false;
    items.forEach(function(it){markers.forEach(function(m){if((it.textContent||'').includes(m))found=true;});});
    if(!found)return;
    dd.setAttribute('${AG_DATA_ATTR}m','1');
    ${items.join("\n    ")}
  });
}
`;
  }
  _genTitle(configs) {
    const cfg = configs[0];
    const toastCall = this._genToastCall(cfg.toast);
    const event = cfg.interaction || "dblclick";
    return `
function integrateTitle(){
  var p=document.querySelector(${JSON.stringify(Selectors.PANEL)});if(!p)return;
  var el=p.querySelector(${JSON.stringify(Selectors.TITLE)});
  if(!el||el.getAttribute('${AG_DATA_ATTR}t'))return;
  el.setAttribute('${AG_DATA_ATTR}t','1');
  el.style.cursor='pointer';
  el.classList.add('${AG_PREFIX}title-wrap');
  el.style.position='relative';
  ${cfg.hint ? `var hint=mk('span','${AG_PREFIX}title-hint',${JSON.stringify(cfg.hint)});el.appendChild(hint);` : ""}
  el.addEventListener(${JSON.stringify(event)},function(){
    var title=el.textContent?.replace(${JSON.stringify(cfg.hint || "")},'')?.trim()||'';
    ${toastCall || `toast('Chat',null,[['title:',title],['chars:',''+title.length]]);`}
  });
}
`;
  }
  // ─── Main loop ────────────────────────────────────────────────────
  _mainLoop(points) {
    const fnMap = {
      ["topBar" /* TOP_BAR */]: "integrateTopBar",
      ["topRight" /* TOP_RIGHT */]: "integrateTopRight",
      ["inputArea" /* INPUT_AREA */]: "integrateInputArea",
      ["bottomIcons" /* BOTTOM_ICONS */]: "integrateBottomIcons",
      ["turnMeta" /* TURN_METADATA */]: "integrateTurnMeta",
      ["userBadge" /* USER_BADGE */]: "integrateUserBadges",
      ["botAction" /* BOT_ACTION */]: "integrateBotAction",
      ["dropdownMenu" /* DROPDOWN_MENU */]: "integrateDropdown",
      ["chatTitle" /* CHAT_TITLE */]: "integrateTitle"
    };
    const calls = points.map((p) => `    ${fnMap[p]} (); `).join("\n");
    return `
    function fullScan() {
${calls}
    }
    var _timer = 0;
    function debounced() { clearTimeout(_timer); _timer = setTimeout(function () { requestAnimationFrame(fullScan); }, 400); }
    function start() {
      var p = document.querySelector(${JSON.stringify(Selectors.PANEL)});
      if (!p) { setTimeout(start, 1000); return; }
      fullScan();
      new MutationObserver(debounced).observe(p, { childList: true, subtree: true });
      setInterval(fullScan, 8000);
      console.log('[AG SDK] Active \\u2014 ${points.length} integration points');
    }
    `;
  }
};
var PREFIX = "ag-sdk";
var MARKER_START = "<!-- AG SDK -->";
var MARKER_END = "<!-- /AG SDK -->";
var MANIFEST_FILE = `${PREFIX}-manifest.json`;
var LOADER_FILE = `${PREFIX}-loader.js`;
var WorkbenchPatcher = class {
  /**
   * @param namespace - Unique slug for this extension (e.g. 'kanezal-better-antigravity').
   */
  constructor(namespace = "default") {
    const appData = process.env.LOCALAPPDATA || "";
    this._workbenchDir = path3__namespace.join(
      appData,
      "Programs",
      "Antigravity",
      "resources",
      "app",
      "out",
      "vs",
      "code",
      "electron-browser",
      "workbench"
    );
    this._workbenchHtml = path3__namespace.join(this._workbenchDir, "workbench.html");
    this._manifestPath = path3__namespace.join(this._workbenchDir, MANIFEST_FILE);
    this._loaderPath = path3__namespace.join(this._workbenchDir, LOADER_FILE);
    this._slug = namespace.replace(/[^a-zA-Z0-9-]/g, "-");
    this._scriptPath = path3__namespace.join(this._workbenchDir, `${PREFIX}-${this._slug}.js`);
    this._heartbeatPath = path3__namespace.join(this._workbenchDir, `${PREFIX}-${this._slug}-heartbeat`);
  }
  // ─── Queries ──────────────────────────────────────────────────────
  /** Check if workbench.html exists and is accessible. */
  isAvailable() {
    return fs3__namespace.existsSync(this._workbenchHtml);
  }
  /** Check if the shared SDK loader is installed in workbench.html. */
  isLoaderInstalled() {
    if (!this.isAvailable()) return false;
    try {
      return fs3__namespace.readFileSync(this._workbenchHtml, "utf8").includes(MARKER_START);
    } catch {
      return false;
    }
  }
  /** Check if THIS extension is registered in the manifest. */
  isInstalled() {
    const manifest = this._readManifest();
    return manifest.extensions.includes(this._slug);
  }
  /** Get all registered extension namespaces from manifest. */
  getRegisteredExtensions() {
    return this._readManifest().extensions;
  }
  // ─── Install ──────────────────────────────────────────────────────
  /**
   * Install this extension's script into the SDK framework.
   *
   * - If loader is not in workbench.html → patch HTML (first extension)
   * - Writes/updates this extension's script file
   * - Registers in manifest
   * - Updates the loader script
   *
   * @param scriptContent — Generated JS for this extension
   */
  install(scriptContent) {
    if (!this.isAvailable()) {
      throw new Error(`Workbench not found at: ${this._workbenchDir}`);
    }
    this._cleanupLegacy();
    if (!this.isLoaderInstalled()) {
      this._patchHtml();
    }
    fs3__namespace.writeFileSync(this._scriptPath, scriptContent, "utf8");
    const manifest = this._readManifest();
    if (!manifest.extensions.includes(this._slug)) {
      manifest.extensions.push(this._slug);
    }
    this._writeManifest(manifest);
    this._writeLoader();
    const titlesPath = path3__namespace.join(this._workbenchDir, `${PREFIX}-titles-${this._slug}.json`);
    if (!fs3__namespace.existsSync(titlesPath)) {
      fs3__namespace.writeFileSync(titlesPath, "{}", "utf8");
    }
  }
  // ─── Uninstall ────────────────────────────────────────────────────
  /**
   * Uninstall this extension from the SDK framework.
   *
   * - Removes from manifest
   * - Deletes this extension's script + heartbeat + titles
   * - If last extension → removes loader from workbench.html + cleans up
   */
  uninstall() {
    if (!this.isAvailable()) return;
    const manifest = this._readManifest();
    manifest.extensions = manifest.extensions.filter((ns) => ns !== this._slug);
    this._tryDelete(this._scriptPath);
    this._tryDelete(this._heartbeatPath);
    this._tryDelete(path3__namespace.join(this._workbenchDir, `${PREFIX}-titles-${this._slug}.json`));
    if (manifest.extensions.length === 0) {
      this._unpatchHtml();
      this._tryDelete(this._loaderPath);
      this._tryDelete(this._manifestPath);
    } else {
      this._writeManifest(manifest);
      this._writeLoader();
    }
  }
  // ─── Heartbeat ────────────────────────────────────────────────────
  /** Write/refresh heartbeat marker. */
  writeHeartbeat() {
    try {
      fs3__namespace.writeFileSync(this._heartbeatPath, Date.now().toString(), "utf8");
    } catch {
    }
  }
  /** Remove heartbeat marker. */
  removeHeartbeat() {
    this._tryDelete(this._heartbeatPath);
  }
  // ─── Accessors ────────────────────────────────────────────────────
  getWorkbenchDir() {
    return this._workbenchDir;
  }
  getScriptPath() {
    return this._scriptPath;
  }
  getHeartbeatPath() {
    return this._heartbeatPath;
  }
  // ─── Private: HTML patching ───────────────────────────────────────
  /** Add the shared loader <script> to workbench.html (ONE time). */
  _patchHtml() {
    let html = fs3__namespace.readFileSync(this._workbenchHtml, "utf8");
    const loaderTag = [
      MARKER_START,
      `<script src="./${LOADER_FILE}"></script>`,
      MARKER_END
    ].join("\n");
    html = html.replace("</html>", `${loaderTag}
</html>`);
    fs3__namespace.writeFileSync(this._workbenchHtml, html, "utf8");
  }
  /** Remove the shared loader <script> from workbench.html. */
  _unpatchHtml() {
    try {
      let html = fs3__namespace.readFileSync(this._workbenchHtml, "utf8");
      const regex = new RegExp(
        `\\n?${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}\\n?`,
        "g"
      );
      html = html.replace(regex, "");
      fs3__namespace.writeFileSync(this._workbenchHtml, html, "utf8");
    } catch {
    }
  }
  // ─── Private: Manifest ────────────────────────────────────────────
  _readManifest() {
    try {
      if (fs3__namespace.existsSync(this._manifestPath)) {
        const data = JSON.parse(fs3__namespace.readFileSync(this._manifestPath, "utf8"));
        return { extensions: Array.isArray(data.extensions) ? data.extensions : [] };
      }
    } catch {
    }
    return { extensions: [] };
  }
  _writeManifest(manifest) {
    fs3__namespace.writeFileSync(this._manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }
  // ─── Private: Loader ──────────────────────────────────────────────
  /**
   * Generate and write the shared loader script.
   *
   * The loader runs in the renderer. On startup it:
   * 1. Fetches the manifest to get the list of extensions
   * 2. For each extension, checks its heartbeat (skip if stale >48h)
   * 3. Creates <script> tags to load each active extension's script
   */
  _writeLoader() {
    const manifest = this._readManifest();
    const scriptEntries = manifest.extensions.map((ns) => ({
      ns,
      script: `${PREFIX}-${ns}.js`,
      heartbeat: `${PREFIX}-${ns}-heartbeat`
    }));
    const loaderCode = `(function agSDKLoader() {
'use strict';
if (window.__agSDKLoader) return;
window.__agSDKLoader = true;

var MAX_AGE = 172800000; // 48h
var entries = ${JSON.stringify(scriptEntries)};

function checkHeartbeat(hbFile, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', './' + hbFile + '?t=' + Date.now(), true);
    xhr.onload = function() {
        if (xhr.status === 200) {
            var ts = parseInt(xhr.responseText, 10);
            callback(!isNaN(ts) && (Date.now() - ts) < MAX_AGE);
        } else {
            callback(false);
        }
    };
    xhr.onerror = function() { callback(false); };
    xhr.send();
}

function loadScript(src) {
    var s = document.createElement('script');
    s.src = './' + src;
    s.async = false;
    document.head.appendChild(s);
}

entries.forEach(function(entry) {
    checkHeartbeat(entry.heartbeat, function(alive) {
        if (alive) {
            loadScript(entry.script);
            console.log('[AG-SDK] Loaded: ' + entry.ns);
        } else {
            console.log('[AG-SDK] Skipped (stale heartbeat): ' + entry.ns);
        }
    });
});

console.log('[AG-SDK] Loader initialized (' + entries.length + ' extension(s))');
})();`;
    fs3__namespace.writeFileSync(this._loaderPath, loaderCode, "utf8");
  }
  // ─── Private: Cleanup ─────────────────────────────────────────────
  /**
   * Clean up legacy per-namespace HTML blocks and old files
   * from previous SDK versions that used per-extension HTML patching.
   */
  _cleanupLegacy() {
    try {
      const html = fs3__namespace.readFileSync(this._workbenchHtml, "utf8");
      const cleaned = html.replace(
        /\n?<!-- AG SDK \[[^\]]+\] -->[\s\S]*?<!-- \/AG SDK \[[^\]]+\] -->\n?/g,
        ""
      );
      if (cleaned !== html) {
        fs3__namespace.writeFileSync(this._workbenchHtml, cleaned, "utf8");
      }
    } catch {
    }
    const legacyFiles = [
      "ag-sdk-integrate.js",
      "ag-sdk-heartbeat",
      "ag-sdk-titles.json",
      "ag-sdk-titles-undefined.json",
      "ag-sdk-titles-default.json"
    ];
    for (const name of legacyFiles) {
      this._tryDelete(path3__namespace.join(this._workbenchDir, name));
    }
    try {
      const html = fs3__namespace.readFileSync(this._workbenchHtml, "utf8");
      const cleaned = html.replace(/<script src="\.\/ag-sdk-integrate\.js"><\/script>\n?/g, "").replace(/<!-- X-Ray SDK Integration -->\n?<script[^>]*ag-sdk-integrate[^>]*><\/script>\n?<!-- \/X-Ray SDK Integration -->\n?/g, "");
      if (cleaned !== html) {
        fs3__namespace.writeFileSync(this._workbenchHtml, cleaned, "utf8");
      }
    } catch {
    }
  }
  _tryDelete(filePath) {
    try {
      if (fs3__namespace.existsSync(filePath)) fs3__namespace.unlinkSync(filePath);
    } catch {
    }
  }
};
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var log6 = new Logger("IntegrityManager");
var REGISTRY_FILENAME = ".ag-sdk-integrity.json";
var IntegrityManager = class {
  /**
   * @param workbenchDir — Absolute path to the workbench directory
   *   (e.g. `%LOCALAPPDATA%/Programs/Antigravity/resources/app/out/vs/code/electron-browser/workbench/`)
   * @param namespace — Unique slug for this extension (e.g. 'kanezal-better-antigravity')
   */
  constructor(workbenchDir, namespace) {
    this._namespace = namespace;
    this._registryPath = path3__namespace.join(workbenchDir, REGISTRY_FILENAME);
    const appDir = path3__namespace.resolve(workbenchDir, "..", "..", "..", "..", "..");
    this._productJsonPath = path3__namespace.join(appDir, "product.json");
    this._appOutDir = path3__namespace.join(appDir, "out");
  }
  /**
   * Suppress the integrity check by updating ALL mismatched hashes in product.json.
   *
   * Scans every file listed in product.json checksums, recomputes SHA256 for each,
   * and updates any that have changed. This handles not just workbench.html but also
   * workbench.desktop.main.js (auto-run fix), jetskiAgent files, etc.
   *
   * Call this after any file patching. Safe to call multiple times.
   */
  suppressCheck() {
    try {
      if (!fs3__namespace.existsSync(this._productJsonPath)) {
        log6.warn(`product.json not found at ${this._productJsonPath}`);
        return;
      }
      const productJson = JSON.parse(fs3__namespace.readFileSync(this._productJsonPath, "utf8"));
      if (!productJson.checksums) {
        log6.debug("No checksums in product.json \u2014 nothing to update");
        return;
      }
      const registry = this._readRegistry();
      if (!registry.namespaces.includes(this._namespace)) {
        registry.namespaces.push(this._namespace);
      }
      let updatedCount = 0;
      for (const [relPath, storedHash] of Object.entries(productJson.checksums)) {
        const filePath = path3__namespace.join(this._appOutDir, relPath);
        let actualHash;
        try {
          const content = fs3__namespace.readFileSync(filePath);
          actualHash = this._computeHash(content);
        } catch {
          continue;
        }
        if (actualHash !== storedHash) {
          if (!(relPath in registry.originalHashes)) {
            registry.originalHashes[relPath] = storedHash;
            log6.debug(`Saved original hash for ${relPath}`);
          }
          productJson.checksums[relPath] = actualHash;
          updatedCount++;
          log6.info(`Updated hash: ${relPath} (${storedHash.substring(0, 8)}... -> ${actualHash.substring(0, 8)}...)`);
        }
      }
      this._writeRegistry(registry);
      if (updatedCount > 0) {
        fs3__namespace.writeFileSync(this._productJsonPath, JSON.stringify(productJson, null, "	"), "utf8");
        log6.info(`Updated ${updatedCount} hash(es) in product.json`);
      } else {
        log6.debug("All hashes already match \u2014 no update needed");
      }
    } catch (err) {
      log6.error("Failed to suppress integrity check", err);
    }
  }
  /**
   * Release the integrity check suppression.
   *
   * Call this when uninstalling the integration. If no other SDK namespaces
   * remain active, restores all original hashes in product.json.
   */
  releaseCheck() {
    try {
      const registry = this._readRegistry();
      registry.namespaces = registry.namespaces.filter((ns) => ns !== this._namespace);
      this._writeRegistry(registry);
      if (registry.namespaces.length > 0) {
        log6.debug(`${registry.namespaces.length} other namespace(s) still active, recomputing hashes`);
        this.suppressCheck();
        return;
      }
      if (Object.keys(registry.originalHashes).length > 0) {
        this._restoreOriginalHashes(registry.originalHashes);
        log6.info(`Restored ${Object.keys(registry.originalHashes).length} original hash(es)`);
      }
      this._deleteRegistry();
    } catch (err) {
      log6.error("Failed to release integrity check", err);
    }
  }
  /**
   * Re-apply integrity suppression after auto-repair.
   *
   * Call this after auto-repair has re-patched files
   * (e.g. after an AG update that overwrote workbench files).
   */
  repair() {
    log6.info("Repairing integrity check suppression...");
    this.suppressCheck();
  }
  // ── Private helpers ─────────────────────────────────────────────
  /**
   * Compute SHA256 hash matching Antigravity's ChecksumService format:
   * base64 WITHOUT trailing '=' padding.
   */
  _computeHash(content) {
    return crypto__namespace.createHash("sha256").update(content).digest("base64").replace(/=+$/, "");
  }
  /**
   * Restore all original hashes in product.json.
   */
  _restoreOriginalHashes(originalHashes) {
    if (!fs3__namespace.existsSync(this._productJsonPath)) return;
    const productJson = JSON.parse(fs3__namespace.readFileSync(this._productJsonPath, "utf8"));
    if (!productJson.checksums) return;
    for (const [relPath, hash] of Object.entries(originalHashes)) {
      if (relPath in productJson.checksums) {
        productJson.checksums[relPath] = hash;
      }
    }
    fs3__namespace.writeFileSync(this._productJsonPath, JSON.stringify(productJson, null, "	"), "utf8");
  }
  /**
   * Read the coordination registry from disk.
   */
  _readRegistry() {
    try {
      if (fs3__namespace.existsSync(this._registryPath)) {
        const raw = fs3__namespace.readFileSync(this._registryPath, "utf8");
        const data = JSON.parse(raw);
        let originalHashes = {};
        if (data.originalHashes && typeof data.originalHashes === "object") {
          originalHashes = data.originalHashes;
        } else if (typeof data.originalHash === "string") {
          originalHashes["vs/code/electron-browser/workbench/workbench.html"] = data.originalHash;
        }
        return {
          namespaces: Array.isArray(data.namespaces) ? data.namespaces : [],
          originalHashes
        };
      }
    } catch {
    }
    return { namespaces: [], originalHashes: {} };
  }
  /**
   * Write the coordination registry to disk.
   */
  _writeRegistry(registry) {
    try {
      fs3__namespace.writeFileSync(this._registryPath, JSON.stringify(registry, null, 2), "utf8");
    } catch (err) {
      log6.error("Failed to write integrity registry", err);
    }
  }
  /**
   * Delete the coordination registry file.
   */
  _deleteRegistry() {
    try {
      if (fs3__namespace.existsSync(this._registryPath)) {
        fs3__namespace.unlinkSync(this._registryPath);
      }
    } catch {
    }
  }
};

// src/integration/title-proxy.ts
var TITLES_STORAGE_PREFIX = "ag-sdk-titles";
var TITLES_DATA_PREFIX = "ag-sdk-titles";
function generateTitleProxyCode(namespace = "default") {
  const slug = namespace.replace(/[^a-zA-Z0-9-]/g, "-");
  const storageKey = `${TITLES_STORAGE_PREFIX}-${slug}`;
  const dataFile = `./${TITLES_DATA_PREFIX}-${slug}.json`;
  return `
// \u2500\u2500 AG SDK: Title Proxy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Intercepts summaries provider to inject custom chat titles.
// Uses structural matching (obfuscation-safe).

(function initTitleProxy(){
  var PANEL_SEL='.antigravity-agent-side-panel';
  var TITLE_SEL='.flex.min-w-0.items-center.overflow-hidden';
  var STORAGE_KEY='${storageKey}';
  var DATA_FILE='${dataFile}';
  
  var _provider=null;
  var _origGetState=null;
  var _listeners=[];
  var _customTitles={};
  var _searchTime=0;

  // \u2500\u2500 Load / Save \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  function loadTitles(){
    // Step 1: Load from localStorage (sync, fast)
    try{_customTitles=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(e){_customTitles={};}
    // Step 2: Merge extension-host titles from data file (async fetch)
    fetch(DATA_FILE).then(function(r){
      if(!r.ok)return;
      return r.text();
    }).then(function(text){
      if(!text)return;
      try{
        var extTitles=JSON.parse(text);
        if(extTitles&&typeof extTitles==='object'){
          for(var k in extTitles){_customTitles[k]=extTitles[k];}
          saveTitles();
          notifyListeners();
        }
      }catch(e){}
    }).catch(function(){});
  }
  
  function saveTitles(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(_customTitles));}catch(e){}
  }
  
  // \u2500\u2500 Notify \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  function notifyListeners(){
    for(var i=0;i<_listeners.length;i++){try{_listeners[i]();}catch(e){}}
  }
  
  // \u2500\u2500 Provider Wrapping \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  function wrapProvider(provider){
    if(provider.__agSDKWrapped)return;
    provider.__agSDKWrapped=true;
    _provider=provider;
    var origFn=provider.getState;
    _origGetState=origFn;
    
    // Wrap getState to inject custom titles
    provider.getState=function(){
      var state=origFn.call(provider);
      if(!state||!state.summaries)return state;
      var hasOverrides=false;
      for(var cid in _customTitles){if(state.summaries[cid]){hasOverrides=true;break;}}
      if(!hasOverrides)return state;
      var ns={};
      for(var k in state.summaries)ns[k]=state.summaries[k];
      for(var cid in _customTitles){
        if(ns[cid]){
          var copy={};for(var p in ns[cid])copy[p]=ns[cid][p];
          copy.summary=_customTitles[cid];
          ns[cid]=copy;
        }
      }
      var newState={};for(var sk in state)newState[sk]=state[sk];
      newState.summaries=ns;
      return newState;
    };
    
    // Intercept onDidChange to capture listeners
    var origOnDidChange=provider.onDidChange;
    provider.onDidChange=function(callback){
      _listeners.push(callback);
      var origDispose=origOnDidChange.call(this,callback);
      return{dispose:function(){
        var idx=_listeners.indexOf(callback);
        if(idx>=0)_listeners.splice(idx,1);
        origDispose.dispose();
      }};
    };
    
    console.log('[AG SDK] Title proxy active, custom titles:', Object.keys(_customTitles).length);
    
    // Force re-render so custom titles appear immediately
    // (without waiting for next native summaries update)
    setTimeout(function(){notifyListeners();},50);
  }
  
  // \u2500\u2500 VNode BFS Walk \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  function findProvider(){
    if(_provider)return;
    var panel=document.querySelector(PANEL_SEL);
    if(!panel||!panel.__k)return;
    // Throttle only AFTER confirming panel exists (don't block retries when panel isn't mounted)
    var now=Date.now();
    if(_searchTime&&now-_searchTime<30000)return;
    _searchTime=now;
    var queue=[panel.__k],visited=0;
    while(queue.length>0&&visited<3000){
      var node=queue.shift();
      if(!node)continue;
      if(Array.isArray(node)){
        for(var ai=0;ai<node.length;ai++){if(node[ai])queue.push(node[ai]);}
        continue;
      }
      visited++;
      var comp=node.__c;
      if(comp&&comp.context&&typeof comp.context==='object'){
        for(var key in comp.context){
          try{
            var ctx=comp.context[key];
            if(!ctx||!ctx.props||!ctx.props.value)continue;
            var val=ctx.props.value;
            // Structural match: {provider: {getState() -> {summaries}}}
            if(val.provider&&typeof val.provider.getState==='function'){
              var ts=val.provider.getState();
              if(ts&&ts.summaries){wrapProvider(val.provider);return;}
            }
            // Structural match: {trajectorySummariesProvider: {getState() -> {summaries}}}
            if(val.trajectorySummariesProvider&&typeof val.trajectorySummariesProvider.getState==='function'){
              var ts2=val.trajectorySummariesProvider.getState();
              if(ts2&&ts2.summaries){wrapProvider(val.trajectorySummariesProvider);return;}
            }
          }catch(e){}
        }
      }
      // Direct props match
      if(comp&&comp.props&&comp.props.trajectorySummariesProvider){
        var tsp=comp.props.trajectorySummariesProvider;
        if(typeof tsp.getState==='function'){
          try{var ts3=tsp.getState();
            if(ts3&&ts3.summaries){wrapProvider(tsp);return;}
          }catch(e){}
        }
      }
      if(node.__k){
        if(Array.isArray(node.__k)){for(var ki=0;ki<node.__k.length;ki++){if(node.__k[ki])queue.push(node.__k[ki]);}}
        else{queue.push(node.__k);}
      }
    }
  }
  
  // \u2500\u2500 CascadeId Resolution \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  function findCascadeIdByTitle(text){
    if(!_origGetState)return '';
    try{
      var state=_origGetState.call(_provider);
      if(!state||!state.summaries)return '';
      // Reverse lookup custom titles first
      for(var cid in _customTitles){if(_customTitles[cid]===text)return cid;}
      // Match original summaries
      var bestId='',bestTime=0;
      for(var cid in state.summaries){
        var e=state.summaries[cid];
        if(e&&e.summary===text){
          var t=0;try{t=new Date(e.lastModifiedTime).getTime();}catch(e){}
          if(!bestId||t>bestTime){bestId=cid;bestTime=t;}
        }
      }
      return bestId;
    }catch(e){return '';}
  }
  
  // \u2500\u2500 Public API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  window.__agSDKTitles={
    rename:function(cascadeId,title){
      if(!cascadeId||!title)return false;
      _customTitles[cascadeId]=title;
      saveTitles();
      notifyListeners();
      return true;
    },
    renameByCurrentTitle:function(currentTitle,newTitle){
      var cid=findCascadeIdByTitle(currentTitle);
      if(!cid)return false;
      return this.rename(cid,newTitle);
    },
    remove:function(cascadeId){
      delete _customTitles[cascadeId];
      saveTitles();
      notifyListeners();
    },
    getTitle:function(cascadeId){return _customTitles[cascadeId]||null;},
    getAll:function(){var copy={};for(var k in _customTitles)copy[k]=_customTitles[k];return copy;},
    getActiveCascadeId:function(){
      var panel=document.querySelector(PANEL_SEL);
      if(!panel)return '';
      var titleEl=panel.querySelector(TITLE_SEL);
      if(!titleEl)return '';
      var text='';
      function findText(el){
        for(var i=0;i<el.childNodes.length;i++){
          var n=el.childNodes[i];
          if(n.nodeType===3&&n.textContent.trim().length>0)return n.textContent.trim();
          if(n.nodeType===1){var found=findText(n);if(found)return found;}
        }
        return '';
      }
      text=findText(titleEl);
      return text?findCascadeIdByTitle(text):'';
    },
    isReady:function(){return !!_provider;},
    reload:function(){loadTitles();notifyListeners();}
  };
  
  // \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  
  loadTitles();
  
  function poll(){
    findProvider();
  }
  
  // Poll until provider found, then every 30s for recovery
  var pollTimer=setInterval(function(){poll();},2000);
  
  // Initial attempt after DOM is ready
  if(document.querySelector(PANEL_SEL)){
    poll();
  }

})();
`;
}
function getTitlesDataFile(namespace = "default") {
  const slug = namespace.replace(/[^a-zA-Z0-9-]/g, "-");
  return `${TITLES_DATA_PREFIX}-${slug}.json`;
}

// src/integration/title-manager.ts
var log7 = new Logger("TitleManager");
var TitleManager = class {
  constructor() {
    this._titles = {};
    this._dataPath = "";
    this._initialized = false;
  }
  /**
   * Initialize with the workbench directory path.
   *
   * @param workbenchDir - Path to workbench directory where data file is stored
   * @param namespace - Extension namespace for file isolation
   */
  initialize(workbenchDir, namespace = "default") {
    this._dataPath = path3__namespace.join(workbenchDir, getTitlesDataFile(namespace));
    this._load();
    this._initialized = true;
    log7.info(`Initialized, ${Object.keys(this._titles).length} custom titles loaded`);
  }
  /**
   * Check if the manager is initialized.
   */
  get isInitialized() {
    return this._initialized;
  }
  /**
   * Set a custom title for a conversation.
   *
   * The title will be displayed in the Agent View title bar
   * and conversation list instead of the auto-generated summary.
   *
   * @param cascadeId - The conversation's cascade ID (UUID)
   * @param title - The custom title to display
   *
   * @example
   * ```typescript
   * // Rename the active conversation
   * const id = sdk.titles.getActiveCascadeId();
   * sdk.titles.rename(id, 'Project Alpha Discussion');
   * ```
   */
  rename(cascadeId, title) {
    if (!cascadeId) {
      log7.warn("rename: cascadeId is required");
      return;
    }
    if (!title || !title.trim()) {
      log7.warn("rename: title cannot be empty");
      return;
    }
    this._titles[cascadeId] = title.trim();
    this._save();
    log7.debug(`Renamed ${cascadeId.substring(0, 8)}... -> "${title.trim()}"`);
  }
  /**
   * Get the custom title for a conversation.
   *
   * @param cascadeId - The conversation's cascade ID
   * @returns The custom title, or undefined if no custom title is set
   */
  getTitle(cascadeId) {
    return this._titles[cascadeId];
  }
  /**
   * Get all custom titles.
   *
   * @returns A copy of the titles map (cascadeId -> title)
   */
  getAll() {
    return { ...this._titles };
  }
  /**
   * Remove a custom title, reverting to the auto-generated summary.
   *
   * @param cascadeId - The conversation's cascade ID
   */
  remove(cascadeId) {
    if (this._titles[cascadeId]) {
      delete this._titles[cascadeId];
      this._save();
      log7.debug(`Removed title for ${cascadeId.substring(0, 8)}...`);
    }
  }
  /**
   * Remove all custom titles.
   */
  clear() {
    this._titles = {};
    this._save();
    log7.debug("Cleared all custom titles");
  }
  /**
   * Get the number of custom titles.
   */
  get count() {
    return Object.keys(this._titles).length;
  }
  /** Load titles from the data file */
  _load() {
    try {
      if (fs3__namespace.existsSync(this._dataPath)) {
        const content = fs3__namespace.readFileSync(this._dataPath, "utf8");
        this._titles = JSON.parse(content) || {};
      }
    } catch (err) {
      log7.warn(`Failed to load titles: ${err}`);
      this._titles = {};
    }
  }
  /** Save titles to the data file */
  _save() {
    if (!this._dataPath) return;
    try {
      fs3__namespace.writeFileSync(this._dataPath, JSON.stringify(this._titles, null, 2), "utf8");
    } catch (err) {
      log7.warn(`Failed to save titles: ${err}`);
    }
  }
  dispose() {
  }
};

// src/integration/integration-manager.ts
var log8 = new Logger("IntegrationManager");
var IntegrationManager = class {
  /**
   * @param namespace - Unique slug that isolates this extension's files.
   *   Derived automatically from `context.extension.id` when using AntigravitySDK.
   *   Multiple SDK-based extensions can coexist without conflicts.
   */
  constructor(namespace = "default") {
    this._configs = /* @__PURE__ */ new Map();
    this._generator = new ScriptGenerator();
    this._titles = new TitleManager();
    this._watcher = null;
    this._autoRepairDebounce = null;
    this._titleProxyEnabled = false;
    this._namespace = namespace;
    this._patcher = new WorkbenchPatcher(namespace);
    this._integrity = new IntegrityManager(
      this._patcher.getWorkbenchDir(),
      namespace
    );
  }
  // ─── Registration ──────────────────────────────────────────────────
  /**
   * Register a single integration point.
   *
   * @throws If an integration with the same ID already exists
   */
  register(config) {
    if (this._configs.has(config.id)) {
      throw new Error(`Integration '${config.id}' is already registered`);
    }
    this._configs.set(config.id, config);
    log8.debug(`Registered integration: ${config.id} (${config.point})`);
  }
  /**
   * Register multiple integration points at once.
   */
  registerMany(configs) {
    for (const c of configs) {
      this.register(c);
    }
  }
  /**
   * Remove a registered integration by ID.
   */
  unregister(id) {
    this._configs.delete(id);
    log8.debug(`Unregistered integration: ${id}`);
  }
  /**
   * Get all registered integrations.
   */
  getRegistered() {
    return Array.from(this._configs.values());
  }
  // ─── Convenience methods (fluent API) ──────────────────────────────
  /**
   * Add a button to the top bar (near +, refresh icons).
   */
  addTopBarButton(id, icon, tooltip, toast) {
    this.register({
      id,
      point: "topBar" /* TOP_BAR */,
      icon,
      tooltip,
      toast
    });
    return this;
  }
  /**
   * Add a button to the top-right corner (before X).
   */
  addTopRightButton(id, icon, tooltip, toast) {
    this.register({
      id,
      point: "topRight" /* TOP_RIGHT */,
      icon,
      tooltip,
      toast
    });
    return this;
  }
  /**
   * Add a button next to the send/voice buttons.
   */
  addInputButton(id, icon, tooltip, toast) {
    this.register({
      id,
      point: "inputArea" /* INPUT_AREA */,
      icon,
      tooltip,
      toast
    });
    return this;
  }
  /**
   * Add an icon to the bottom icon row (file, terminal, etc.).
   */
  addBottomIcon(id, icon, tooltip, toast) {
    this.register({
      id,
      point: "bottomIcons" /* BOTTOM_ICONS */,
      icon,
      tooltip,
      toast
    });
    return this;
  }
  /**
   * Enable per-turn metadata display.
   */
  addTurnMetadata(id, metrics, clickable = true) {
    this.register({
      id,
      point: "turnMeta" /* TURN_METADATA */,
      metrics,
      clickable
    });
    return this;
  }
  /**
   * Add character count badges to user messages.
   */
  addUserBadges(id, display = "charCount") {
    this.register({
      id,
      point: "userBadge" /* USER_BADGE */,
      display
    });
    return this;
  }
  /**
   * Add an action button next to Good/Bad feedback.
   */
  addBotAction(id, icon, label, toast) {
    this.register({
      id,
      point: "botAction" /* BOT_ACTION */,
      icon,
      label,
      toast
    });
    return this;
  }
  /**
   * Add item(s) to the 3-dot dropdown menu.
   */
  addDropdownItem(id, label, icon, toast, separator = false) {
    this.register({
      id,
      point: "dropdownMenu" /* DROPDOWN_MENU */,
      label,
      icon,
      toast,
      separator
    });
    return this;
  }
  /**
   * Enable chat title interaction.
   */
  addTitleInteraction(id, interaction = "dblclick", hint, toast) {
    this.register({
      id,
      point: "chatTitle" /* CHAT_TITLE */,
      interaction,
      hint,
      toast
    });
    return this;
  }
  // ─── Title Proxy ─────────────────────────────────────────────────
  /**
   * Enable the title proxy feature.
   *
   * Adds renderer-side code that intercepts the summaries provider
   * and injects custom chat titles. Uses structural matching to find
   * the provider (obfuscation-safe).
   *
   * After enabling, call `install()` or `updateScript()` to apply.
   *
   * @example
   * ```typescript
   * const sdk = new AntigravitySDK(context);
   * await sdk.initialize();
   *
   * sdk.integration.enableTitleProxy();
   * await sdk.integration.install();
   *
   * // Now rename from extension host:
   * sdk.integration.titles.rename(cascadeId, 'My Custom Title');
   * ```
   */
  enableTitleProxy() {
    this._titleProxyEnabled = true;
    if (this._patcher.isAvailable()) {
      this._titles.initialize(this._patcher.getWorkbenchDir(), this._namespace);
    }
    log8.info("Title proxy enabled");
    return this;
  }
  /**
   * Access the title manager for programmatic title control.
   *
   * Requires `enableTitleProxy()` to be called first.
   *
   * @example
   * ```typescript
   * sdk.integration.titles.rename(cascadeId, 'My Title');
   * sdk.integration.titles.remove(cascadeId);
   * const all = sdk.integration.titles.getAll();
   * ```
   */
  get titles() {
    if (!this._titleProxyEnabled) {
      log8.warn("Title proxy not enabled. Call enableTitleProxy() first.");
    }
    return this._titles;
  }
  // ─── Build & Install ───────────────────────────────────────────────
  /**
   * Generate the integration script from all registered configs.
   *
   * If title proxy is enabled, appends the title proxy renderer code.
   *
   * @returns Complete JavaScript code as a string
   */
  build() {
    const configs = Array.from(this._configs.values());
    if (configs.length === 0 && !this._titleProxyEnabled) {
      throw new Error("No integration points registered and title proxy not enabled");
    }
    log8.debug(`build: ${configs.length} configs, titleProxy=${this._titleProxyEnabled}, ns=${this._namespace}`);
    let script = "";
    if (configs.length > 0) {
      log8.info(`Building script for ${configs.length} integration(s): ${configs.map((c) => c.id).join(", ")}`);
      script = this._generator.generate(configs, this._namespace);
      log8.debug(`build: generated ${script.length} bytes`);
    }
    if (this._titleProxyEnabled) {
      log8.info("Appending title proxy code");
      script += "\n" + generateTitleProxyCode(this._namespace);
    }
    return script;
  }
  /**
   * Install this extension's script into the shared SDK framework.
   *
   * For seamless hot-reload behavior, use `installSeamless()` instead.
   *
   * The first extension to call install() patches workbench.html with
   * the shared loader. Subsequent extensions just register in the manifest.
   *
   * @returns true if the script content actually changed on disk
   */
  async install() {
    if (!this._patcher.isAvailable()) {
      throw new Error("Antigravity workbench not found. Is Antigravity installed?");
    }
    const script = this.build();
    const scriptPath = this._patcher.getScriptPath();
    let oldContent = "";
    try {
      if (fs3__namespace.existsSync(scriptPath)) {
        oldContent = fs3__namespace.readFileSync(scriptPath, "utf8");
      }
    } catch {
    }
    log8.debug(`install: writing script to ${scriptPath}`);
    this._patcher.install(script);
    log8.debug("install: suppressing integrity check");
    this._integrity.suppressCheck();
    this._patcher.writeHeartbeat();
    const changed = oldContent !== script;
    log8.info(
      `Installed integration (${this._configs.size} points, titleProxy: ${this._titleProxyEnabled}) -> ${scriptPath} [${changed ? "CHANGED" : "unchanged"}]`
    );
    log8.debug(`install: registered extensions = ${this._patcher.getRegisteredExtensions().join(", ") || "none"}`);
    return changed;
  }
  /**
   * Seamless install — handles everything automatically.
   *
   * This is the **recommended** install method for extension developers.
   * It handles the entire lifecycle:
   *
   * 1. **First install:** Writes script + patches HTML + prompts user to reload
   * 2. **Update:** Compares content, if changed → auto-reloads window (no prompt)
   * 3. **No change:** Does nothing
   *
   * The developer never needs to think about reload.
   *
   * @param executeCommand - Function to execute VS Code commands
   *   (pass `vscode.commands.executeCommand` or equivalent)
   *
   * @example
   * ```typescript
   * const sdk = new AntigravitySDK(context);
   * await sdk.initialize();
   *
   * sdk.integration.enableTitleProxy();
   * // That's it. SDK handles install, reload, everything.
   * await sdk.integration.installSeamless(
   *   (cmd) => vscode.commands.executeCommand(cmd),
   *   (msg, ...items) => vscode.window.showInformationMessage(msg, ...items),
   * );
   * ```
   */
  async installSeamless(executeCommand, showMessage) {
    const loaderWasPresent = this._patcher.isLoaderInstalled();
    const wasRegistered = this._patcher.isInstalled();
    const scriptPath = this._patcher.getScriptPath();
    let oldContent = "";
    try {
      if (fs3__namespace.existsSync(scriptPath)) {
        oldContent = fs3__namespace.readFileSync(scriptPath, "utf8");
      }
    } catch {
    }
    const changed = await this.install();
    if (!loaderWasPresent) {
      log8.info("First SDK install. Prompting for reload.");
      if (showMessage) {
        const action = await showMessage(
          "Antigravity SDK installed. Reload to activate.",
          "Reload Now"
        );
        if (action === "Reload Now") {
          await executeCommand("workbench.action.reloadWindow");
        }
      }
    } else if (!wasRegistered) {
      log8.info("SDK loader already present \u2014 extension registered, auto-reloading...");
      setTimeout(() => executeCommand("workbench.action.reloadWindow"), 500);
    } else if (changed) {
      log8.info("Script changed on disk. Auto-reloading window...");
      setTimeout(() => executeCommand("workbench.action.reloadWindow"), 500);
    } else {
      log8.debug("Script unchanged. No reload needed.");
    }
  }
  /**
   * Remove this extension from the SDK framework.
   *
   * If this is the last extension, the loader is removed from workbench.html
   * and all original checksums are restored.
   *
   * ⚠️ Requires Antigravity restart to take effect.
   */
  async uninstall() {
    const remaining = this._patcher.getRegisteredExtensions().filter((n) => n !== this._namespace);
    log8.debug(`uninstall: removing ns=${this._namespace}, remaining: ${remaining.join(", ") || "none (last extension)"}`);
    this._patcher.uninstall();
    this._integrity.releaseCheck();
    this.disableAutoRepair();
    log8.info(remaining.length > 0 ? `Uninstalled ${this._namespace}. ${remaining.length} extension(s) still active.` : `Uninstalled ${this._namespace}. SDK fully removed. Restart Antigravity.`);
  }
  /**
   * Check if this extension is registered in the SDK framework.
   */
  isInstalled() {
    return this._patcher.isInstalled();
  }
  /**
   * Check if the shared SDK loader is installed in workbench.html.
   */
  isLoaderInstalled() {
    return this._patcher.isLoaderInstalled();
  }
  /**
   * Signal that the extension is active.
   *
   * Call this in your extension's `activate()` function.
   * The integration script checks for this heartbeat;
   * if it's missing or stale (>48h), the script won't start.
   *
   * This prevents orphaned integrations from running after
   * an extension is disabled or uninstalled.
   *
   * @example
   * ```typescript
   * export function activate(context: vscode.ExtensionContext) {
   *   const sdk = new AntigravitySDK(context);
   *   sdk.integration.signalActive();
   *   // ...
   * }
   * ```
   */
  signalActive() {
    this._patcher.writeHeartbeat();
    log8.debug("Heartbeat refreshed");
  }
  // ─── Dynamic Update ─────────────────────────────────────────────────
  /**
   * Re-generate and overwrite the integration script without re-patching workbench.html.
   *
   * Use this after registering/unregistering integration points at runtime.
   * The script file is updated in-place; the next Antigravity restart
   * will pick up the changes. workbench.html <script> tag is unchanged.
   *
   * @returns true if script was updated
   */
  updateScript() {
    if (!this._patcher.isLoaderInstalled()) {
      log8.warn("Cannot update script \u2014 SDK loader is not installed");
      return false;
    }
    try {
      const script = this.build();
      fs3__namespace.writeFileSync(this._patcher.getScriptPath(), script, "utf8");
      log8.info(`Script updated (${this._configs.size} points)`);
      return true;
    } catch (err) {
      log8.error("Failed to update script", err);
      return false;
    }
  }
  // ─── Auto-Repair ────────────────────────────────────────────────────
  /**
   * Enable auto-repair: watches workbench.html for changes
   * and automatically re-applies the integration patch.
   *
   * This handles Antigravity updates that overwrite workbench.html.
   * The watcher detects when the file changes and re-patches it
   * if the integration marker is missing.
   *
   * @example
   * ```typescript
   * const integrator = new IntegrationManager();
   * integrator.useDemoPreset();
   * await integrator.install();
   * integrator.enableAutoRepair(); // Survive Antigravity updates
   * ```
   */
  enableAutoRepair() {
    if (this._watcher) return;
    const htmlPath = this._patcher.getWorkbenchDir() + "\\workbench.html";
    if (!fs3__namespace.existsSync(htmlPath)) {
      log8.warn("Cannot enable auto-repair \u2014 workbench.html not found");
      return;
    }
    try {
      this._watcher = fs3__namespace.watch(htmlPath, (eventType) => {
        if (eventType !== "change") return;
        if (this._autoRepairDebounce) clearTimeout(this._autoRepairDebounce);
        this._autoRepairDebounce = setTimeout(() => {
          this._tryRepair();
        }, 2e3);
      });
      log8.info("Auto-repair enabled \u2014 watching workbench.html");
    } catch (err) {
      log8.error("Failed to enable auto-repair", err);
    }
  }
  /**
   * Disable auto-repair watcher.
   */
  disableAutoRepair() {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
      log8.info("Auto-repair disabled");
    }
    if (this._autoRepairDebounce) {
      clearTimeout(this._autoRepairDebounce);
      this._autoRepairDebounce = null;
    }
  }
  /**
   * Whether auto-repair is active.
   */
  get isAutoRepairEnabled() {
    return this._watcher !== null;
  }
  _tryRepair() {
    try {
      if (this._patcher.isLoaderInstalled()) {
        log8.debug("Auto-repair: SDK loader still present, no action needed");
        return;
      }
      if (this._configs.size === 0 && !this._titleProxyEnabled) {
        log8.debug("Auto-repair: no configs registered, skipping");
        return;
      }
      log8.info("Auto-repair: SDK loader lost (Antigravity update?), re-installing...");
      const script = this.build();
      this._patcher.install(script);
      this._integrity.repair();
      log8.info("Auto-repair: re-installed successfully. Restart Antigravity.");
    } catch (err) {
      log8.error("Auto-repair failed", err);
    }
  }
  // ─── Preset ────────────────────────────────────────────────────────
  /**
   * Register the Demo preset — a complete demo of all 9 integration points.
   * Useful for testing and as a reference implementation.
   */
  useDemoPreset() {
    this.addTopBarButton("demo_overview", "\u{1F4E1}", "SDK: Session Overview", {
      title: "Session Overview",
      badge: { text: "TOP_BAR", bgColor: "rgba(79,195,247,.2)", textColor: "#4fc3f7" },
      rows: [
        { key: "location:", value: "Header icon bar" },
        { key: "use case:", value: "Session overview, navigation" }
      ]
    });
    this.addTopRightButton("demo_perf", "\u26A1", "SDK: Performance", {
      title: "Performance",
      badge: { text: "TOP_RIGHT", bgColor: "rgba(255,193,7,.2)", textColor: "#ffd54f" },
      rows: [
        { key: "location:", value: "Top right, before close" },
        { key: "use case:", value: "Status indicator" }
      ]
    });
    this.addInputButton("demo_stats", "\u{1F4CA}", "SDK: Stats", {
      title: "Input Stats",
      badge: { text: "INPUT_AREA", bgColor: "rgba(76,175,80,.2)", textColor: "#81c784" },
      rows: [
        { key: "location:", value: "Next to send button" },
        { key: "use case:", value: "Token counter, analytics" }
      ]
    });
    this.addBottomIcon("demo_actions", "\u2630", "SDK: Quick Actions", {
      title: "Quick Actions",
      badge: { text: "BOTTOM_ICONS", bgColor: "rgba(255,152,0,.2)", textColor: "#ffb74d" },
      rows: [
        { key: "location:", value: "Bottom icon row" },
        { key: "use case:", value: "Mode switches, quick actions" }
      ]
    });
    this.addTurnMetadata("demo_turns", [
      "turnNumber",
      "userCharCount",
      "separator",
      "aiCharCount",
      "codeBlocks",
      "thinkingIndicator"
    ]);
    this.addUserBadges("demo_ubadge", "charCount");
    this.addBotAction("demo_inspect", "\u{1F50D}", "inspect", {
      title: "Response Inspector",
      badge: { text: "BOT_ACTION", bgColor: "rgba(156,39,176,.2)", textColor: "#ce93d8" },
      rows: [
        { key: "location:", value: "Next to Good/Bad" },
        { key: "use case:", value: "Response analysis" }
      ]
    });
    this.addDropdownItem("demo_menu_stats", "SDK Stats", "\u{1F4CA}", {
      title: "Extended Stats",
      badge: { text: "DROPDOWN", bgColor: "rgba(233,30,99,.2)", textColor: "#f48fb1" },
      rows: [
        { key: "location:", value: "3-dot dropdown menu" },
        { key: "use case:", value: "Extended actions" }
      ]
    }, true);
    this.addDropdownItem("demo_menu_debug", "SDK Debug", "\u{1F9EA}", {
      title: "Debug Info",
      badge: { text: "DEBUG", bgColor: "rgba(255,87,34,.2)", textColor: "#ff8a65" },
      rows: [
        { key: "location:", value: "3-dot dropdown menu" },
        { key: "use case:", value: "Debug, diagnostics" }
      ]
    });
    this.addTitleInteraction("demo_title", "dblclick", "dblclick", {
      title: "Chat Title",
      badge: { text: "TITLE", bgColor: "rgba(0,150,136,.2)", textColor: "#80cbc4" },
      rows: [
        { key: "location:", value: "Conversation title" },
        { key: "use case:", value: "Rename, bookmark" }
      ]
    });
    return this;
  }
  // ─── Dispose ───────────────────────────────────────────────────────
  dispose() {
    this.disableAutoRepair();
    this._configs.clear();
    this._titles.dispose();
  }
};
var log9 = new Logger("SDK");
var AntigravitySDK = class {
  /**
   * Create a new Antigravity SDK instance.
   *
   * @param context - VS Code extension context
   * @param options - SDK options
   */
  constructor(_context, options) {
    this._context = _context;
    this._disposables = new DisposableStore();
    this._initialized = false;
    this._agVersion = null;
    if (options?.debug) {
      Logger.setLevel(0 /* Debug */);
    }
    const namespace = this._context.extension.id.replace(/\./g, "-");
    this.commands = this._disposables.add(new CommandBridge());
    this.state = this._disposables.add(new StateBridge());
    this.cascade = this._disposables.add(new CascadeManager(this.commands, this.state));
    this.monitor = this._disposables.add(new EventMonitor(this.state));
    this.integration = this._disposables.add(new IntegrationManager(namespace));
    this.ls = new LSBridge(
      (cmd, ...args) => Promise.resolve(vscode__namespace.commands.executeCommand(cmd, ...args))
    );
    log9.info(`SDK created (namespace: ${namespace})`);
  }
  /**
   * Initialize the SDK and verify Antigravity is running.
   *
   * Call this before using any SDK features.
   *
   * @throws {AntigravityNotFoundError} If Antigravity is not detected
   */
  async initialize() {
    if (this._initialized) {
      return;
    }
    log9.info("Initializing SDK...");
    this._agVersion = detectAGVersion();
    if (this._agVersion) {
      const { version, compatible, supportedRange } = this._agVersion;
      if (!compatible) {
        log9.warn(`AG v${version} is outside supported range (${supportedRange}) \u2014 some features may not work`);
      } else {
        log9.info(`AG v${version} detected (supported: ${supportedRange})`);
      }
    }
    const isAntigravity = await this._detectAntigravity();
    if (!isAntigravity) {
      throw new AntigravityNotFoundError();
    }
    await this.state.initialize();
    await this.cascade.initialize();
    const lsOk = await this.ls.initialize();
    if (lsOk) {
      log9.info(`LS bridge ready on port ${this.ls.port} (csrf: ${this.ls.hasCsrfToken ? "ok" : "missing"})`);
    } else {
      log9.warn("LS bridge not available \u2014 use sdk.ls.setConnection(port, csrfToken) or command fallback");
    }
    this.integration.signalActive();
    this._initialized = true;
    log9.info("SDK initialized successfully");
  }
  /**
   * Check if the SDK has been initialized.
   */
  get isInitialized() {
    return this._initialized;
  }
  /**
   * Get the SDK version.
   */
  get version() {
    try {
      return require_package().version;
    } catch {
      return "unknown";
    }
  }
  /**
   * Get info about the installed Antigravity version and SDK compatibility.
   * Available after initialize().
   */
  get agVersion() {
    return this._agVersion;
  }
  /**
   * Detect if we're running inside Antigravity IDE.
   */
  async _detectAntigravity() {
    try {
      const commands4 = await this.commands.getAntigravityCommands();
      const hasAgentPanel = commands4.includes("antigravity.agentPanel.open");
      if (hasAgentPanel) {
        log9.debug(`Detected Antigravity (${commands4.length} commands)`);
        return true;
      }
      const appName = vscode__namespace.env.appName;
      if (appName?.toLowerCase().includes("antigravity")) {
        log9.debug(`Detected Antigravity via appName: ${appName}`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  /**
   * Dispose of the SDK and all its resources.
   */
  dispose() {
    log9.info("Disposing SDK");
    this._disposables.dispose();
  }
};

exports.AntigravityCommands = AntigravityCommands;
exports.AntigravityNotFoundError = AntigravityNotFoundError;
exports.AntigravitySDK = AntigravitySDK;
exports.AntigravitySDKError = AntigravitySDKError;
exports.ArtifactReviewPolicy = ArtifactReviewPolicy;
exports.CascadeManager = CascadeManager;
exports.CommandBridge = CommandBridge;
exports.CommandExecutionError = CommandExecutionError;
exports.CortexStepType = CortexStepType;
exports.DisposableStore = DisposableStore;
exports.EventEmitter = EventEmitter;
exports.EventMonitor = EventMonitor;
exports.IntegrationManager = IntegrationManager;
exports.IntegrationPoint = IntegrationPoint;
exports.IntegrityManager = IntegrityManager;
exports.LSBridge = LSBridge;
exports.LogLevel = LogLevel;
exports.Logger = Logger;
exports.Models = Models;
exports.SessionNotFoundError = SessionNotFoundError;
exports.StateBridge = StateBridge;
exports.StateReadError = StateReadError;
exports.StepStatus = StepStatus;
exports.TerminalExecutionPolicy = TerminalExecutionPolicy;
exports.TitleManager = TitleManager;
exports.TrajectoryType = TrajectoryType;
exports.USSKeys = USSKeys;
exports.detectAGVersion = detectAGVersion;
exports.toDisposable = toDisposable;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map