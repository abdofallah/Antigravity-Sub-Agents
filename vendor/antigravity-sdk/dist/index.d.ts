import * as vscode from 'vscode';

/**
 * Core type definitions for Antigravity SDK.
 *
 * These types mirror the internal protobuf schemas used by Antigravity's
 * Language Server, extracted via reverse engineering of the minified source.
 *
 * @module types
 */
/**
 * Terminal command auto-execution policy.
 *
 * Controls how terminal commands are handled when the agent requests execution.
 */
declare enum TerminalExecutionPolicy {
    /** Always ask user before running */
    OFF = 1,
    /** Auto-run safe commands, ask for potentially dangerous ones */
    AUTO = 2,
    /** Always auto-run without asking */
    EAGER = 3
}
/**
 * Artifact review policy for code changes.
 */
declare enum ArtifactReviewPolicy {
    /** Always show diff review */
    ALWAYS = 1,
    /** Skip review for simple changes */
    TURBO = 2,
    /** Automatically decide based on change complexity */
    AUTO = 3
}
/**
 * Type of a Cortex step (tool call) in a trajectory.
 */
declare enum CortexStepType {
    RunCommand = "RunCommand",
    WriteToFile = "WriteToFile",
    ViewFile = "ViewFile",
    ViewFileOutline = "ViewFileOutline",
    ViewCodeItem = "ViewCodeItem",
    SearchWeb = "SearchWeb",
    ReadUrlContent = "ReadUrlContent",
    OpenBrowserUrl = "OpenBrowserUrl",
    ReadBrowserPage = "ReadBrowserPage",
    ListBrowserPages = "ListBrowserPages",
    ListDirectory = "ListDirectory",
    FindByName = "FindByName",
    CodebaseSearch = "CodebaseSearch",
    GrepSearch = "GrepSearch",
    SendCommandInput = "SendCommandInput",
    ReadTerminal = "ReadTerminal",
    ShellExec = "ShellExec",
    McpTool = "McpTool",
    InvokeSubagent = "InvokeSubagent",
    Memory = "Memory",
    KnowledgeGeneration = "KnowledgeGeneration",
    UserInput = "UserInput",
    SystemMessage = "SystemMessage",
    PlannerResponse = "PlannerResponse",
    Wait = "Wait",
    ProposeCode = "ProposeCode",
    WriteCascadeEdit = "WriteCascadeEdit"
}
/**
 * Status of a Cortex step.
 */
declare enum StepStatus {
    /** Step is being processed */
    Running = "running",
    /** Step completed successfully */
    Completed = "completed",
    /** Step failed */
    Failed = "failed",
    /** Step is waiting for user interaction */
    WaitingForUser = "waiting_for_user",
    /** Step was cancelled */
    Cancelled = "cancelled"
}
/**
 * Type of trajectory (conversation).
 */
declare enum TrajectoryType {
    /** Standard chat conversation */
    Chat = "chat",
    /** Agent mode (Cascade) */
    Cascade = "cascade"
}
/**
 * A single step (tool call) in a Cascade trajectory.
 */
interface ICortexStep {
    /** Unique step identifier */
    readonly id: string;
    /** Step index within the trajectory */
    readonly index: number;
    /** Type of tool call */
    readonly type: CortexStepType;
    /** Current status */
    readonly status: StepStatus;
    /** Human-readable summary of what this step does */
    readonly summary: string;
    /** Step-specific data (command line, file path, etc.) */
    readonly data: Record<string, unknown>;
    /** Internal metadata not shown in UI */
    readonly metadata: IStepMetadata;
    /** Timestamp when step was created */
    readonly createdAt: Date;
    /** Timestamp when step completed (if completed) */
    readonly completedAt?: Date;
}
/**
 * Internal metadata attached to each step.
 */
interface IStepMetadata {
    /** Raw protobuf fields from the server response */
    readonly rawFields: Record<string, unknown>;
    /** Token count for this step's input */
    readonly inputTokens?: number;
    /** Token count for this step's output */
    readonly outputTokens?: number;
    /** Model used for this step */
    readonly model?: string;
    /** Whether this step was auto-approved */
    readonly autoApproved?: boolean;
}
/**
 * A chat message in a conversation.
 */
interface IChatMessage {
    /** Message role */
    readonly role: 'user' | 'assistant' | 'system';
    /** Message content */
    readonly content: string;
    /** Message ID */
    readonly id: string;
    /** Timestamp */
    readonly createdAt: Date;
    /** Hidden metadata */
    readonly metadata: Record<string, unknown>;
}
/**
 * Information about the current context window usage.
 */
interface IContextInfo {
    /** Total tokens currently in context */
    readonly totalTokens: number;
    /** Maximum context window size */
    readonly maxTokens: number;
    /** Usage as percentage (0-100) */
    readonly usagePercent: number;
    /** Token breakdown by category */
    readonly breakdown: ITokenBreakdown;
}
/**
 * Token usage breakdown.
 */
interface ITokenBreakdown {
    /** System prompt tokens */
    readonly system: number;
    /** User message tokens */
    readonly userMessages: number;
    /** Assistant response tokens */
    readonly assistantMessages: number;
    /** Tool call input tokens */
    readonly toolCalls: number;
    /** Tool result tokens */
    readonly toolResults: number;
}
/**
 * A Cascade session (conversation/trajectory).
 */
interface ISessionInfo {
    /** Unique session/cascade ID */
    readonly id: string;
    /** Session title (auto-generated or user-set) */
    readonly title: string;
    /** When the session was created */
    readonly createdAt: Date;
    /** When the session was last active */
    readonly lastActiveAt: Date;
    /** Type of trajectory */
    readonly type: TrajectoryType;
    /** Whether the session is currently active */
    readonly isActive: boolean;
    /** Tags applied to this session */
    readonly tags: string[];
}
/**
 * Agent preferences from USS (Unified State Sync).
 *
 * All 16 sentinel keys verified from live state.vscdb on 2026-02-28.
 */
interface IAgentPreferences {
    /** Terminal command auto-execution policy (terminalAutoExecutionPolicySentinelKey) */
    readonly terminalExecutionPolicy: TerminalExecutionPolicy;
    /** Code change review policy (artifactReviewPolicySentinelKey) */
    readonly artifactReviewPolicy: ArtifactReviewPolicy;
    /** Planning mode (planningModeSentinelKey) */
    readonly planningMode: number;
    /** Whether strict/secure mode is enabled (secureModeSentinelKey) */
    readonly secureModeEnabled: boolean;
    /** Whether terminal sandbox is enabled (enableTerminalSandboxSentinelKey) */
    readonly terminalSandboxEnabled: boolean;
    /** Whether sandbox allows network access (sandboxAllowNetworkSentinelKey) */
    readonly sandboxAllowNetwork: boolean;
    /** Whether shell integration is enabled (enableShellIntegrationSentinelKey) */
    readonly shellIntegrationEnabled: boolean;
    /** Allow agent to access files outside workspace (allowAgentAccessNonWorkspaceFilesSentinelKey) */
    readonly allowNonWorkspaceFiles: boolean;
    /** Allow Cascade to read .gitignore files (allowCascadeAccessGitignoreFilesSentinelKey) */
    readonly allowGitignoreAccess: boolean;
    /** Explain and fix in current conversation (explainAndFixInCurrentConversationSentinelKey) */
    readonly explainFixInCurrentConvo: boolean;
    /** Auto-continue on max generator invocations (autoContinueOnMaxGeneratorInvocationsSentinelKey) */
    readonly autoContinueOnMax: number;
    /** Disable auto-open of edited files (disableAutoOpenEditedFilesSentinelKey) */
    readonly disableAutoOpenEdited: boolean;
    /** Enable sounds for special events (enableSoundsForSpecialEventsSentinelKey) */
    readonly enableSounds: boolean;
    /** Disable Cascade auto-fix for lint errors (disableCascadeAutoFixLintsSentinelKey) */
    readonly disableAutoFixLints: boolean;
    /** Explicitly allowed terminal commands (terminalAllowedCommandsSentinelKey) */
    readonly allowedCommands: string[];
    /** Explicitly denied terminal commands (terminalDeniedCommandsSentinelKey) */
    readonly deniedCommands: string[];
}
/**
 * Model configuration.
 */
interface IModelConfig {
    /** Model identifier */
    readonly id: string;
    /** Human-readable model name */
    readonly name: string;
    /** Whether this model is currently selected */
    readonly isActive: boolean;
    /** Maximum context window size in tokens */
    readonly maxContextTokens: number;
}
/**
 * Options for creating a new Cascade session.
 */
interface ICreateSessionOptions {
    /** Initial task/message to send */
    readonly task: string;
    /** Whether to run in background (don't focus the panel) */
    readonly background?: boolean;
    /** Model to use (defaults to current) */
    readonly model?: string;
}
/**
 * Agent state from the Agent Manager.
 */
interface IAgentState {
    /** Whether the agent manager is enabled */
    readonly isEnabled: boolean;
    /** Whether the agent is currently processing */
    readonly isProcessing: boolean;
    /** Active cascade/conversation ID */
    readonly activeCascadeId: string | null;
    /** Current model in use */
    readonly currentModel: string;
}
/**
 * Trajectory entry from getDiagnostics.recentTrajectories.
 *
 * VERIFIED 2026-02-28: getDiagnostics returns clean JSON array with:
 * { googleAgentId, trajectoryId, summary, lastStepIndex, lastModifiedTime }
 */
interface ITrajectoryEntry {
    /** Conversation UUID = googleAgentId */
    readonly id: string;
    /** Human-readable title = summary field */
    readonly title: string;
    /** Current step index in this conversation */
    readonly stepCount: number;
    /** Workspace URI (from USS protobuf fallback) */
    readonly workspaceUri: string;
    /** Internal trajectory UUID (from getDiagnostics) */
    readonly trajectoryId?: string;
    /** ISO timestamp of last modification (from getDiagnostics) */
    readonly lastModifiedTime?: string;
}
/**
 * Diagnostics info from `antigravity.getDiagnostics`.
 *
 * VERIFIED: returns 176KB JSON string with 8 top-level keys:
 * isRemote, systemInfo, extensionLogs, rendererLogs,
 * mainThreadLogs, agentWindowConsoleLogs, languageServerLogs,
 * recentTrajectories.
 */
interface IDiagnosticsInfo {
    /** Whether IDE is running remotely (SSH) */
    readonly isRemote: boolean;
    /** System info */
    readonly systemInfo: {
        readonly operatingSystem: string;
        readonly timestamp: string;
        readonly userEmail: string;
        readonly userName: string;
    };
    /** Raw JSON for fields not yet typed */
    readonly raw: Record<string, unknown>;
}

/**
 * Disposable pattern for resource cleanup.
 *
 * @module disposable
 */
/**
 * An object that can release resources when no longer needed.
 */
interface IDisposable {
    dispose(): void;
}
/**
 * Collects multiple disposables and disposes them all at once.
 *
 * @example
 * ```typescript
 * const store = new DisposableStore();
 * store.add(someEventSub);
 * store.add(anotherSub);
 * // Later:
 * store.dispose(); // cleans up everything
 * ```
 */
declare class DisposableStore implements IDisposable {
    private readonly _disposables;
    private _disposed;
    /**
     * Add a disposable to the store.
     *
     * @param disposable - The disposable to track
     * @returns The same disposable (for chaining)
     */
    add<T extends IDisposable>(disposable: T): T;
    /**
     * Dispose all tracked disposables.
     */
    dispose(): void;
}
/**
 * Creates a disposable from a cleanup function.
 *
 * @param fn - Cleanup function to call on dispose
 */
declare function toDisposable(fn: () => void): IDisposable;

/**
 * Lightweight event system for SDK.
 *
 * Follows VS Code's `Event<T>` / `EventEmitter<T>` pattern.
 * Supports subscription, disposal, and one-shot listeners.
 *
 * @module events
 */

/**
 * A function that represents a subscription to an event.
 * Call the returned disposable to unsubscribe.
 */
type Event<T> = (listener: (e: T) => void) => IDisposable;
/**
 * Emits events to registered listeners.
 *
 * @example
 * ```typescript
 * const emitter = new EventEmitter<string>();
 *
 * const sub = emitter.event((msg) => console.log(msg));
 * emitter.fire('hello'); // logs: hello
 * sub.dispose();
 * emitter.fire('world'); // nothing happens
 * ```
 */
declare class EventEmitter<T> implements IDisposable {
    private _listeners;
    private _disposed;
    /**
     * The event that listeners can subscribe to.
     */
    readonly event: Event<T>;
    /**
     * Fire the event, notifying all listeners.
     *
     * @param data - The event data to send to listeners
     */
    fire(data: T): void;
    /**
     * Subscribe to the event, but only fire once.
     *
     * @param listener - Callback to invoke once
     * @returns Disposable to cancel before the event fires
     */
    once(listener: (e: T) => void): IDisposable;
    /**
     * Get the current number of listeners.
     */
    get listenerCount(): number;
    /**
     * Dispose of the emitter and all listeners.
     */
    dispose(): void;
}

/**
 * SDK-specific error classes.
 *
 * @module errors
 */
/**
 * Base error for all Antigravity SDK errors.
 */
declare class AntigravitySDKError extends Error {
    constructor(message: string);
}
/**
 * Thrown when Antigravity IDE is not detected or not running.
 */
declare class AntigravityNotFoundError extends AntigravitySDKError {
    constructor();
}
/**
 * Thrown when a command fails to execute.
 */
declare class CommandExecutionError extends AntigravitySDKError {
    readonly command: string;
    readonly reason: string;
    constructor(command: string, reason: string);
}
/**
 * Thrown when the state database cannot be read.
 */
declare class StateReadError extends AntigravitySDKError {
    readonly key: string;
    readonly reason: string;
    constructor(key: string, reason: string);
}
/**
 * Thrown when a session/conversation is not found.
 */
declare class SessionNotFoundError extends AntigravitySDKError {
    readonly sessionId: string;
    constructor(sessionId: string);
}

/**
 * Debug logger for SDK internals.
 *
 * Respects the `antigravitySDK.debug` setting.
 *
 * @module logger
 */
/**
 * Log levels for SDK logging.
 */
declare enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Off = 4
}
/**
 * SDK logger with level-based filtering.
 *
 * @example
 * ```typescript
 * const log = new Logger('CascadeManager');
 * log.debug('Loading sessions...');
 * log.info('Found 5 sessions');
 * log.error('Failed to load', err);
 * ```
 */
declare class Logger {
    private readonly module;
    private static _globalLevel;
    private static _outputFn;
    /**
     * Set the global log level for all SDK loggers.
     *
     * @param level - Minimum level to output
     */
    static setLevel(level: LogLevel): void;
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
    static setOutput(fn: ((msg: string) => void) | null): void;
    /**
     * Create a logger for a specific module.
     *
     * @param module - Module name (shown in log prefix)
     */
    constructor(module: string);
    /** Log a debug message. */
    debug(message: string, ...args: unknown[]): void;
    /** Log an informational message. */
    info(message: string, ...args: unknown[]): void;
    /** Log a warning. */
    warn(message: string, ...args: unknown[]): void;
    /** Log an error. */
    error(message: string, ...args: unknown[]): void;
    private _log;
}

/**
 * Antigravity version detection and compatibility checking.
 *
 * Reads the installed AG version at runtime and validates it against the
 * `antigravityVersions` range declared in the SDK's own package.json.
 *
 * @module ag-version
 */
interface AGVersionInfo {
    /** Installed AG version string, e.g. "1.107.3" */
    version: string;
    /** Whether it satisfies the SDK's antigravityVersions range */
    compatible: boolean;
    /** The supported range declared in the SDK's package.json */
    supportedRange: string;
}
/**
 * Detect the installed Antigravity version.
 *
 * Reads from `%LOCALAPPDATA%\Programs\Antigravity\resources\app\package.json`.
 *
 * @returns AGVersionInfo, or null if AG is not found / version unreadable.
 */
declare function detectAGVersion(): AGVersionInfo | null;

/**
 * Command Bridge — executes Antigravity internal commands via VS Code API.
 *
 * All commands go through `vscode.commands.executeCommand()` which is the
 * safe, official way to interact with Antigravity from extensions.
 *
 * VERIFIED: All commands listed below were confirmed to exist in
 * Antigravity v1.107.0 workbench.desktop.main.js and extension.js
 * on 2026-02-28.
 *
 * @module transport/command-bridge
 */

/**
 * All known Antigravity commands, organized by category.
 *
 * Sources: workbench.desktop.main.js (160+ commands) + extension.js (45 commands)
 */
declare const AntigravityCommands: {
    /** Open the Cascade agent panel */
    readonly OPEN_AGENT_PANEL: "antigravity.agentPanel.open";
    /** Focus the Cascade agent panel */
    readonly FOCUS_AGENT_PANEL: "antigravity.agentPanel.focus";
    /** Open the agent side panel */
    readonly OPEN_AGENT_SIDE_PANEL: "antigravity.agentSidePanel.open";
    /** Focus the agent side panel */
    readonly FOCUS_AGENT_SIDE_PANEL: "antigravity.agentSidePanel.focus";
    /** Toggle side panel visibility */
    readonly TOGGLE_SIDE_PANEL: "antigravity.agentSidePanel.toggleVisibility";
    /** Open agent (generic) */
    readonly OPEN_AGENT: "antigravity.openAgent";
    /** Toggle chat focus */
    readonly TOGGLE_CHAT_FOCUS: "antigravity.toggleChatFocus";
    /** Switch between workspace editor and agent view */
    readonly SWITCH_WORKSPACE_AGENT: "antigravity.switchBetweenWorkspaceAndAgent";
    /** Start a new conversation */
    readonly START_NEW_CONVERSATION: "antigravity.startNewConversation";
    /** Send a prompt to the agent panel */
    readonly SEND_PROMPT_TO_AGENT: "antigravity.sendPromptToAgentPanel";
    /** Send text to chat */
    readonly SEND_TEXT_TO_CHAT: "antigravity.sendTextToChat";
    /** Send a chat action message */
    readonly SEND_CHAT_ACTION: "antigravity.sendChatActionMessage";
    /** Set which conversation is visible */
    readonly SET_VISIBLE_CONVERSATION: "antigravity.setVisibleConversation";
    /** Execute a cascade action */
    readonly EXECUTE_CASCADE_ACTION: "antigravity.executeCascadeAction";
    /** Broadcast conversation deletion to all windows */
    readonly BROADCAST_CONVERSATION_DELETION: "antigravity.broadcastConversationDeletion";
    /** Track that a background conversation was created */
    readonly TRACK_BACKGROUND_CONVERSATION: "antigravity.trackBackgroundConversationCreated";
    /** Accept the current agent step */
    readonly ACCEPT_AGENT_STEP: "antigravity.agent.acceptAgentStep";
    /** Reject the current agent step */
    readonly REJECT_AGENT_STEP: "antigravity.agent.rejectAgentStep";
    /** Accept a pending command */
    readonly COMMAND_ACCEPT: "antigravity.command.accept";
    /** Reject a pending command */
    readonly COMMAND_REJECT: "antigravity.command.reject";
    /** Accept a terminal command */
    readonly TERMINAL_ACCEPT: "antigravity.terminalCommand.accept";
    /** Reject a terminal command */
    readonly TERMINAL_REJECT: "antigravity.terminalCommand.reject";
    /** Run a terminal command */
    readonly TERMINAL_RUN: "antigravity.terminalCommand.run";
    /** Open new conversation (prioritized) */
    readonly OPEN_NEW_CONVERSATION: "antigravity.prioritized.chat.openNewConversation";
    /** Notify terminal command started */
    readonly TERMINAL_COMMAND_START: "antigravity.onManagerTerminalCommandStart";
    /** Notify terminal command data */
    readonly TERMINAL_COMMAND_DATA: "antigravity.onManagerTerminalCommandData";
    /** Notify terminal command finished */
    readonly TERMINAL_COMMAND_FINISH: "antigravity.onManagerTerminalCommandFinish";
    /** Update last terminal command */
    readonly UPDATE_TERMINAL_LAST_COMMAND: "antigravity.updateTerminalLastCommand";
    /** Notify shell command completion */
    readonly ON_SHELL_COMPLETION: "antigravity.onShellCommandCompletion";
    /** Show managed terminal */
    readonly SHOW_MANAGED_TERMINAL: "antigravity.showManagedTerminal";
    /** Send terminal output to chat */
    readonly SEND_TERMINAL_TO_CHAT: "antigravity.sendTerminalToChat";
    /** Send terminal output to side panel */
    readonly SEND_TERMINAL_TO_SIDE_PANEL: "antigravity.sendTerminalToSidePanel";
    /** Initialize the agent */
    readonly INITIALIZE_AGENT: "antigravity.initializeAgent";
    /** Open conversation workspace picker */
    readonly OPEN_CONVERSATION_PICKER: "antigravity.openConversationWorkspaceQuickPick";
    /** Open conversation picker (alternative) */
    readonly OPEN_CONV_PICKER_ALT: "antigravity.openConversationPicker";
    /** Set working directories */
    readonly SET_WORKING_DIRS: "antigravity.setWorkingDirectories";
    /** Open review changes view */
    readonly OPEN_REVIEW_CHANGES: "antigravity.openReviewChanges";
    /** Open diff view */
    readonly OPEN_DIFF_VIEW: "antigravity.openDiffView";
    /** Open diff zones */
    readonly OPEN_DIFF_ZONES: "antigravity.openDiffZones";
    /** Close all diff zones */
    readonly CLOSE_ALL_DIFF_ZONES: "antigravity.closeAllDiffZones";
    /** Create a new rule */
    readonly CREATE_RULE: "antigravity.createRule";
    /** Create a new workflow */
    readonly CREATE_WORKFLOW: "antigravity.createWorkflow";
    /** Create a global workflow */
    readonly CREATE_GLOBAL_WORKFLOW: "antigravity.createGlobalWorkflow";
    /** Open global rules */
    readonly OPEN_GLOBAL_RULES: "antigravity.openGlobalRules";
    /** Open workspace rules */
    readonly OPEN_WORKSPACE_RULES: "antigravity.openWorkspaceRules";
    /** Open configure plugins page */
    readonly OPEN_CONFIGURE_PLUGINS: "antigravity.openConfigurePluginsPage";
    /** Get Cascade plugin template */
    readonly GET_PLUGIN_TEMPLATE: "antigravity.getCascadePluginTemplate";
    /** Poll MCP server states */
    readonly POLL_MCP_SERVERS: "antigravity.pollMcpServerStates";
    /** Open MCP config file */
    readonly OPEN_MCP_CONFIG: "antigravity.openMcpConfigFile";
    /** Open MCP docs page */
    readonly OPEN_MCP_DOCS: "antigravity.openMcpDocsPage";
    /** Update plugin installation count */
    readonly UPDATE_PLUGIN_COUNT: "antigravity.updatePluginInstallationCount";
    /** Enable autocomplete */
    readonly ENABLE_AUTOCOMPLETE: "antigravity.enableAutocomplete";
    /** Disable autocomplete */
    readonly DISABLE_AUTOCOMPLETE: "antigravity.disableAutocomplete";
    /** Accept completion */
    readonly ACCEPT_COMPLETION: "antigravity.acceptCompletion";
    /** Force supercomplete */
    readonly FORCE_SUPERCOMPLETE: "antigravity.forceSupercomplete";
    /** Snooze autocomplete temporarily */
    readonly SNOOZE_AUTOCOMPLETE: "antigravity.snoozeAutocomplete";
    /** Cancel snooze */
    readonly CANCEL_SNOOZE: "antigravity.cancelSnoozeAutocomplete";
    /** Login to Antigravity */
    readonly LOGIN: "antigravity.login";
    /** Cancel login */
    readonly CANCEL_LOGIN: "antigravity.cancelLogin";
    /** Handle auth refresh */
    readonly HANDLE_AUTH_REFRESH: "antigravity.handleAuthRefresh";
    /** Sign in to Antigravity */
    readonly SIGN_IN: "antigravity.SignInToAntigravity";
    /** Get diagnostics info */
    readonly GET_DIAGNOSTICS: "antigravity.getDiagnostics";
    /** Download diagnostics bundle */
    readonly DOWNLOAD_DIAGNOSTICS: "antigravity.downloadDiagnostics";
    /** Capture traces */
    readonly CAPTURE_TRACES: "antigravity.captureTraces";
    /** Enable tracing */
    readonly ENABLE_TRACING: "antigravity.enableTracing";
    /** Clear and disable tracing */
    readonly CLEAR_TRACING: "antigravity.clearAndDisableTracing";
    /** Get manager trace */
    readonly GET_MANAGER_TRACE: "antigravity.getManagerTrace";
    /** Get workbench trace */
    readonly GET_WORKBENCH_TRACE: "antigravity.getWorkbenchTrace";
    /** Toggle debug info widget */
    readonly TOGGLE_DEBUG_INFO: "antigravity.toggleDebugInfoWidget";
    /** Open troubleshooting */
    readonly OPEN_TROUBLESHOOTING: "antigravity.openTroubleshooting";
    /** Open issue reporter */
    readonly OPEN_ISSUE_REPORTER: "antigravity.openIssueReporter";
    /** Restart the language server */
    readonly RESTART_LANGUAGE_SERVER: "antigravity.restartLanguageServer";
    /** Kill language server and reload window */
    readonly KILL_LS_AND_RELOAD: "antigravity.killLanguageServerAndReloadWindow";
    /** Generate commit message via AI */
    readonly GENERATE_COMMIT_MESSAGE: "antigravity.generateCommitMessage";
    /** Cancel commit message generation */
    readonly CANCEL_COMMIT_MESSAGE: "antigravity.cancelGenerateCommitMessage";
    /** Open browser */
    readonly OPEN_BROWSER: "antigravity.openBrowser";
    /** Get browser onboarding port (returns number, e.g. 57401) */
    readonly GET_BROWSER_PORT: "antigravity.getBrowserOnboardingPort";
    /** Open quick settings panel */
    readonly OPEN_QUICK_SETTINGS: "antigravity.openQuickSettingsPanel";
    /** Open customizations tab */
    readonly OPEN_CUSTOMIZATIONS: "antigravity.openCustomizationsTab";
    /** Import VS Code settings */
    readonly IMPORT_VSCODE_SETTINGS: "antigravity.importVSCodeSettings";
    /** Import VS Code extensions */
    readonly IMPORT_VSCODE_EXTENSIONS: "antigravity.importVSCodeExtensions";
    /** Import Cursor settings */
    readonly IMPORT_CURSOR_SETTINGS: "antigravity.importCursorSettings";
    /** Import Cursor extensions */
    readonly IMPORT_CURSOR_EXTENSIONS: "antigravity.importCursorExtensions";
    /** Reload window */
    readonly RELOAD_WINDOW: "antigravity.reloadWindow";
    /** Open documentation */
    readonly OPEN_DOCS: "antigravity.openDocs";
    /** Open changelog */
    readonly OPEN_CHANGELOG: "antigravity.openChangeLog";
    /** Explain and fix problem (from diagnostics) */
    readonly EXPLAIN_AND_FIX: "antigravity.explainAndFixProblem";
    /** Open a URL */
    readonly OPEN_URL: "antigravity.openGenericUrl";
    /** Editor mode settings */
    readonly EDITOR_MODE_SETTINGS: "antigravity.editorModeSettings";
};
/**
 * Bridges between the SDK and Antigravity's command system.
 *
 * All interactions with Antigravity go through registered VS Code commands,
 * ensuring we never bypass the official extension API.
 *
 * @example
 * ```typescript
 * const bridge = new CommandBridge();
 *
 * // Open the agent panel
 * await bridge.execute(AntigravityCommands.OPEN_AGENT_PANEL);
 *
 * // Start a new conversation
 * await bridge.execute(AntigravityCommands.START_NEW_CONVERSATION);
 *
 * // Send a prompt
 * await bridge.execute(AntigravityCommands.SEND_PROMPT_TO_AGENT, 'Hello!');
 * ```
 */
declare class CommandBridge implements IDisposable {
    private _disposed;
    /**
     * Execute an Antigravity command.
     *
     * @param command - The command ID to execute
     * @param args - Arguments to pass to the command
     * @returns The command's return value
     * @throws {CommandExecutionError} If the command fails
     */
    execute<T = unknown>(command: string, ...args: unknown[]): Promise<T>;
    /**
     * Check if a command is registered and available.
     *
     * @param command - Command ID to check
     * @returns true if the command exists
     */
    isAvailable(command: string): Promise<boolean>;
    /**
     * Get all registered Antigravity commands.
     *
     * @returns List of command IDs starting with 'antigravity.'
     */
    getAntigravityCommands(): Promise<string[]>;
    /**
     * Register a command handler.
     *
     * @param command - Command ID to register
     * @param handler - Function to handle the command
     * @returns Disposable to unregister the command
     */
    register(command: string, handler: (...args: unknown[]) => unknown): IDisposable;
    dispose(): void;
}

/**
 * State Bridge — reads Antigravity's USS state from the SQLite database.
 *
 * Antigravity stores settings, conversation metadata, and agent preferences
 * in `state.vscdb` (SQLite). This bridge provides read-only access to that data.
 *
 * VERIFIED against live state.vscdb on 2026-02-28.
 *
 * @module transport/state-bridge
 */

/**
 * USS (Unified State Sync) keys in state.vscdb.
 *
 * VERIFIED: All keys listed below were confirmed to exist
 * in a live Antigravity v1.107.0 installation on 2026-02-28.
 * Values are Base64-encoded protobuf unless noted otherwise.
 */
declare const USSKeys: {
    /** Agent preferences — terminal policy, review policy, secure mode, etc. (1020 bytes) */
    readonly AGENT_PREFERENCES: "antigravityUnifiedStateSync.agentPreferences";
    /** Conversation/trajectory summaries — titles, timestamps, workspace URIs (74KB+) */
    readonly TRAJECTORY_SUMMARIES: "antigravityUnifiedStateSync.trajectorySummaries";
    /** Agent manager window state (192 bytes) */
    readonly AGENT_MANAGER_WINDOW: "antigravityUnifiedStateSync.agentManagerWindow";
    /** Enterprise override store (56 bytes) */
    readonly OVERRIDE_STORE: "antigravityUnifiedStateSync.overrideStore";
    /** Model preferences — selected model, sentinel key */
    readonly MODEL_PREFERENCES: "antigravityUnifiedStateSync.modelPreferences";
    /** Artifact review state (1204 bytes) */
    readonly ARTIFACT_REVIEW: "antigravityUnifiedStateSync.artifactReview";
    /** Browser preferences (380 bytes) */
    readonly BROWSER_PREFERENCES: "antigravityUnifiedStateSync.browserPreferences";
    /** Editor preferences (108 bytes) */
    readonly EDITOR_PREFERENCES: "antigravityUnifiedStateSync.editorPreferences";
    /** Tab preferences (404 bytes) */
    readonly TAB_PREFERENCES: "antigravityUnifiedStateSync.tabPreferences";
    /** Window preferences (44 bytes) */
    readonly WINDOW_PREFERENCES: "antigravityUnifiedStateSync.windowPreferences";
    /** Scratch/playground workspaces (268 bytes) */
    readonly SCRATCH_WORKSPACES: "antigravityUnifiedStateSync.scratchWorkspaces";
    /** Sidebar workspaces — recent workspace list (5604 bytes) */
    readonly SIDEBAR_WORKSPACES: "antigravityUnifiedStateSync.sidebarWorkspaces";
    /** User status info (5196 bytes) */
    readonly USER_STATUS: "antigravityUnifiedStateSync.userStatus";
    /** Model credits/usage info */
    readonly MODEL_CREDITS: "antigravityUnifiedStateSync.modelCredits";
    /** Onboarding state (140 bytes) */
    readonly ONBOARDING: "antigravityUnifiedStateSync.onboarding";
    /** Seen NUX (new user experience) IDs (76 bytes) */
    readonly SEEN_NUX_IDS: "antigravityUnifiedStateSync.seenNuxIds";
    /** Agent manager initialization state — contains auth tokens, workspace map (5144 bytes) */
    readonly AGENT_MANAGER_INIT: "jetskiStateSync.agentManagerInitState";
    /** All user settings — JSON format */
    readonly ALL_USER_SETTINGS: "antigravityUserSettings.allUserSettings";
    /** Allowed model configs for commands */
    readonly ALLOWED_COMMAND_MODEL_CONFIGS: "antigravity_allowed_command_model_configs";
    /** Chat session store index (JSON: {"version":1,"entries":{}}) */
    readonly CHAT_SESSION_INDEX: "chat.ChatSessionStore.index";
};
/**
 * Reads Antigravity's internal state from the SQLite database.
 *
 * Uses **sql.js** (pure JavaScript SQLite, compiled to WASM) which is
 * verified to work in Antigravity's Extension Host (unlike better-sqlite3
 * which fails due to ABI mismatch with Electron v22.21.1 / ABI v140).
 *
 * @example
 * ```typescript
 * const bridge = new StateBridge();
 * await bridge.initialize();
 *
 * const prefs = await bridge.getAgentPreferences();
 * console.log(prefs.terminalExecutionPolicy);
 * ```
 */
declare class StateBridge implements IDisposable {
    private _dbPath;
    private _db;
    private _disposed;
    /**
     * Initialize the state bridge by locating and opening state database.
     *
     * @throws {StateReadError} If the database cannot be found
     */
    initialize(): Promise<void>;
    /**
     * Read a raw value from the state database.
     *
     * @param key - The SQLite key to read
     * @returns The raw string value, or null if not found
     * @throws {StateReadError} If the key is sensitive or read fails
     */
    getRawValue(key: string): Promise<string | null>;
    /**
     * Get agent preferences from USS.
     *
     * @returns Parsed agent preferences
     */
    getAgentPreferences(): Promise<IAgentPreferences>;
    /**
     * Get all stored USS keys from the state database.
     *
     * @returns List of key names related to Antigravity (excludes sensitive keys)
     */
    getAntigravityKeys(): Promise<string[]>;
    /**
     * Query using sql.js (in-process, pure JS).
     */
    private _querySqlJs;
    /**
     * Query using child_process sqlite3 CLI (fallback).
     */
    private _queryChildProcess;
    /**
     * Locate the state.vscdb file across platforms.
     */
    private _findStateDb;
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
    private _parseAgentPreferences;
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
    private _extractSentinelValue;
    private _defaultPreferences;
    dispose(): void;
}

/**
 * Event Monitor — polls state.vscdb and getDiagnostics for changes.
 *
 * Detects:
 * - USS key changes (trajectory summaries, preferences, etc.)
 * - Step count changes per session (via getDiagnostics.recentTrajectories)
 * - Active session switches
 * - New conversations
 *
 * @module transport/event-monitor
 */

/**
 * USS key change event.
 */
interface IStateChange {
    /** Which USS key changed */
    readonly key: string;
    /** New data size */
    readonly newSize: number;
    /** Previous data size */
    readonly previousSize: number;
}
/**
 * Step count change event — fired when the agent adds/processes steps.
 */
interface IStepCountChange {
    /** Conversation UUID (googleAgentId) */
    readonly sessionId: string;
    /** Conversation title */
    readonly title: string;
    /** Previous step count */
    readonly previousCount: number;
    /** New step count */
    readonly newCount: number;
    /** Number of new steps added */
    readonly delta: number;
}
/**
 * Active session change event.
 */
interface IActiveSessionChange {
    /** New active session ID */
    readonly sessionId: string;
    /** New active session title */
    readonly title: string;
    /** Previous active session ID (empty if first detection) */
    readonly previousSessionId: string;
}
/**
 * Monitors Antigravity state for changes.
 *
 * Two polling modes:
 * 1. **USS polling** — watches state.vscdb keys for size changes (lightweight)
 * 2. **Trajectory polling** — watches getDiagnostics for step count changes (heavier, optional)
 *
 * @example
 * ```typescript
 * const monitor = new EventMonitor(stateBridge);
 *
 * // React to step changes (agent is working)
 * monitor.onStepCountChanged((e) => {
 *   console.log(`${e.title}: +${e.delta} steps (now ${e.newCount})`);
 * });
 *
 * // React to conversation switches
 * monitor.onActiveSessionChanged((e) => {
 *   console.log(`Switched to: ${e.title}`);
 * });
 *
 * monitor.start(3000);
 * ```
 */
declare class EventMonitor implements IDisposable {
    private readonly _state;
    private readonly _disposables;
    private _ussTimer;
    private _trajTimer;
    private _ussSnapshots;
    private _trajSnapshots;
    private _activeSessionId;
    private _running;
    private readonly _onStateChanged;
    /** Fires when any monitored USS key changes size */
    readonly onStateChanged: Event<IStateChange>;
    private readonly _onNewConversation;
    /** Fires when trajectory summaries grow (new conversation likely) */
    readonly onNewConversation: Event<void>;
    private readonly _onStepCountChanged;
    /** Fires when a session's step count changes (agent made progress) */
    readonly onStepCountChanged: Event<IStepCountChange>;
    private readonly _onActiveSessionChanged;
    /** Fires when the active (most recent) session changes */
    readonly onActiveSessionChanged: Event<IActiveSessionChange>;
    /** Keys we monitor for USS changes */
    private readonly _watchedKeys;
    constructor(_state: StateBridge);
    /**
     * Start polling for state changes.
     *
     * @param intervalMs - USS polling interval (default: 3000ms)
     * @param trajectoryIntervalMs - Trajectory polling interval (default: 5000ms).
     *   Set to 0 to disable trajectory polling (saves CPU).
     */
    start(intervalMs?: number, trajectoryIntervalMs?: number): void;
    /**
     * Stop polling.
     */
    stop(): void;
    /** Check if the monitor is currently running. */
    get isRunning(): boolean;
    /** Get the currently active session ID. */
    get activeSessionId(): string;
    private _takeUSSSnapshot;
    private _pollUSS;
    private _pollTrajectories;
    dispose(): void;
}

/**
 * Language Server Bridge — Direct ConnectRPC calls to the local LS.
 *
 * UPDATED 2026-03-01 (v1.3.0):
 * Fixed CSRF token authentication (Issue #1).
 * The LS binary is launched with --csrf_token as a CLI argument.
 * Previous versions did not send this token, causing 401 "missing CSRF token".
 *
 * Discovery strategy (multi-layer):
 * 1. Process CLI args — extract --port and --csrf_token from LS process
 * 2. getDiagnostics console logs — fallback for port discovery
 * 3. Manual override — setConnection(port, csrfToken)
 *
 * Service: exa.language_server_pb.LanguageServerService
 * Protocol: HTTPS POST with JSON body + x-csrf-token header
 *
 * @module transport/ls-bridge
 */
/** Known model IDs (verified 2026-02-28) */
declare const Models: {
    readonly GEMINI_FLASH: 1018;
    readonly GEMINI_PRO_LOW: 1164;
    readonly GEMINI_PRO_HIGH: 1165;
    readonly CLAUDE_SONNET: 1163;
    readonly CLAUDE_OPUS: 1154;
    readonly GPT_OSS: 342;
};
type ModelId = typeof Models[keyof typeof Models] | number;
/** Options for creating a headless cascade */
interface IHeadlessCascadeOptions {
    /** Text prompt to send */
    text: string;
    /** Model ID (default: Gemini 3 Flash = 1018) */
    model?: ModelId;
    /** Planner type: 'conversational' (default) or 'normal' */
    plannerType?: 'conversational' | 'normal';
}
/** Options for sending a message to existing cascade */
interface ISendMessageOptions {
    /** Target cascade ID */
    cascadeId: string;
    /** Text to send */
    text: string;
    /** Model ID (default: Gemini 3 Flash = 1018) */
    model?: ModelId;
}
/**
 * Conversation annotation fields (from jetski_cortex.proto ConversationAnnotations).
 *
 * These are metadata annotations on a conversation that the user can set.
 * The LS stores these natively and they persist across sessions.
 */
interface IConversationAnnotations {
    /** Custom user title -- overrides the auto-generated summary */
    title?: string;
    /** Tags/labels for organization */
    tags?: string[];
    /** Whether this conversation is archived */
    archived?: boolean;
    /** Whether this conversation is starred (pinned) */
    starred?: boolean;
}
/**
 * Direct bridge to the Language Server via ConnectRPC.
 *
 * Discovers the LS port and CSRF token from the LS process CLI args,
 * then makes authenticated HTTPS POST calls to the LS endpoints.
 *
 * @example
 * ```typescript
 * const ls = new LSBridge(commandBridge);
 * await ls.initialize();
 *
 * // Create a headless cascade
 * const cascadeId = await ls.createCascade({
 *     text: 'Analyze test coverage',
 *     model: Models.GEMINI_FLASH,
 * });
 *
 * // Send follow-up
 * await ls.sendMessage({ cascadeId, text: 'Focus on edge cases' });
 *
 * // Switch UI to it
 * await ls.focusCascade(cascadeId);
 * ```
 */
declare class LSBridge {
    private _port;
    private _csrfToken;
    private _useTls;
    private _executeCommand;
    constructor(executeCommand: <T = any>(command: string, ...args: any[]) => Promise<T>);
    /**
     * Discover the Language Server port and CSRF token.
     * Must be called before other methods.
     *
     * Discovery chain:
     * 1. Parse LS process CLI arguments (--port, --csrf_token)
     * 2. Fallback: getDiagnostics console logs (port only)
     * 3. Manual: call setConnection() after initialize() returns false
     */
    initialize(): Promise<boolean>;
    /** Whether the bridge is ready (port discovered) */
    get isReady(): boolean;
    /** The discovered LS port */
    get port(): number | null;
    /** Whether CSRF token is available */
    get hasCsrfToken(): boolean;
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
    setConnection(port: number, csrfToken: string, useTls?: boolean): void;
    /**
     * Create a new cascade and optionally send a message.
     * Fully headless — no UI panel opened, no conversation switched.
     *
     * @returns cascadeId or null on failure
     */
    createCascade(options: IHeadlessCascadeOptions): Promise<string | null>;
    /**
     * Send a message to an existing cascade.
     *
     * @returns true if sent successfully
     */
    sendMessage(options: ISendMessageOptions): Promise<boolean>;
    /**
     * Switch the UI to show a specific cascade conversation.
     */
    focusCascade(cascadeId: string): Promise<void>;
    /**
     * Cancel a running cascade invocation.
     */
    cancelCascade(cascadeId: string): Promise<void>;
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
    updateAnnotations(cascadeId: string, annotations: IConversationAnnotations, merge?: boolean): Promise<void>;
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
    setTitle(cascadeId: string, title: string): Promise<void>;
    /**
     * Star (pin) or unstar a conversation.
     *
     * This sets the `starred` field in ConversationAnnotations.
     *
     * @param cascadeId - Conversation ID
     * @param starred - true to star, false to unstar
     */
    setStar(cascadeId: string, starred: boolean): Promise<void>;
    /**
     * Get details of a specific conversation.
     */
    getConversation(cascadeId: string): Promise<any>;
    /**
     * Get all cascade trajectories (conversation list).
     */
    listCascades(): Promise<any>;
    /**
     * Get trajectory descriptions (lighter than full trajectories).
     * Returns { trajectories: [...] }.
     */
    getTrajectoryDescriptions(): Promise<any>;
    /**
     * Get user status (tier, models, etc.)
     */
    getUserStatus(): Promise<any>;
    /**
     * Make a raw RPC call to any LS method.
     * @param method - RPC method name (e.g. 'StartCascade')
     * @param payload - JSON payload
     */
    rawRPC(method: string, payload: any): Promise<any>;
    private _ensureReady;
    private _sendMessage;
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
    private _discoverFromProcess;
    /**
     * Phase 1: Find the LS process for this workspace.
     */
    private _findLSProcess;
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
    private _findConnectPort;
    /**
     * Quick probe: check if a port accepts ConnectRPC requests.
     * Returns true if the port responds (even with error) on the given protocol.
     */
    private _probePort;
    /**
     * Get a workspace hint string used to match the correct LS process.
     *
     * The LS process has --workspace_id like:
     *   file_d_3A_programming_better_antigravity
     * which is an encoded version of the workspace URI.
     */
    private _getWorkspaceHint;
    /**
     * Extract a CLI argument value from a command-line string.
     * Supports both --key=value and --key value formats.
     */
    private _extractArg;
    /**
     * Fallback: discover port from getDiagnostics console logs.
     * NOTE: This does NOT discover the CSRF token.
     * In recent Antigravity versions, the port URL may no longer appear in logs.
     */
    private _discoverPortFromDiagnostics;
    /**
     * Make an authenticated RPC call to the Language Server.
     * Sends x-csrf-token header when available.
     *
     * VERIFIED 2026-03-01:
     * - extension_server_port uses plain HTTP (no TLS)
     * - Main LS port (--random_port) uses HTTPS with self-signed cert
     */
    private _rpc;
}

/**
 * Cascade Manager — Session listing, creation, and monitoring.
 *
 * Provides high-level API to interact with Cascade conversations
 * using verified transport layer (CommandBridge + StateBridge).
 *
 * VERIFIED 2026-02-28: getDiagnostics.recentTrajectories returns clean JSON
 * with { googleAgentId, trajectoryId, summary, lastStepIndex, lastModifiedTime }.
 *
 * @module cascade/cascade-manager
 */

/**
 * Manages Cascade conversations.
 *
 * Primary data source: `antigravity.getDiagnostics` → `recentTrajectories`
 * Fallback: `antigravityUnifiedStateSync.trajectorySummaries` protobuf parsing
 *
 * @example
 * ```typescript
 * const manager = new CascadeManager(commands, state);
 * await manager.initialize();
 *
 * // List sessions (real titles from getDiagnostics)
 * const sessions = await manager.getSessions();
 * sessions.forEach(s => console.log(`${s.title} (step ${s.stepCount})`));
 *
 * // Read preferences (all 16 sentinel values)
 * const prefs = await manager.getPreferences();
 *
 * // Create & send
 * await manager.createSession({ task: 'Analyze coverage', background: true });
 * ```
 */
declare class CascadeManager implements IDisposable {
    private readonly _commands;
    private readonly _state;
    private readonly _disposables;
    private _sessions;
    private _initialized;
    private readonly _onSessionsChanged;
    /** Fires when the session list changes */
    readonly onSessionsChanged: Event<ITrajectoryEntry[]>;
    constructor(_commands: CommandBridge, _state: StateBridge);
    /**
     * Initialize the cascade manager.
     * Loads the initial session list from getDiagnostics.
     */
    initialize(): Promise<void>;
    /**
     * Get all known Cascade sessions.
     *
     * Uses `getDiagnostics.recentTrajectories` (clean JSON with titles).
     *
     * @returns List of trajectory entries sorted by recency
     */
    getSessions(): Promise<ITrajectoryEntry[]>;
    /**
     * Refresh the session list.
     *
     * @returns Updated session list
     */
    refreshSessions(): Promise<ITrajectoryEntry[]>;
    /**
     * Get agent preferences (all 16 sentinel values).
     */
    getPreferences(): Promise<IAgentPreferences>;
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
    getDiagnostics(): Promise<IDiagnosticsInfo>;
    /**
     * Get the Chrome DevTools MCP URL.
     *
     * Verified: returns `http://127.0.0.1:{port}/mcp`
     *
     * @returns MCP URL string
     */
    getMcpUrl(): Promise<string>;
    /**
     * Check if a file is gitignored.
     *
     * @param filePath - Relative or absolute file path
     * @returns true if gitignored, false/null otherwise
     */
    isFileGitIgnored(filePath: string): Promise<boolean>;
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
    createSession(options: ICreateSessionOptions): Promise<string>;
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
    createBackgroundSession(task: string): Promise<string>;
    /**
     * Send a message to the active Cascade conversation.
     *
     * Uses `antigravity.sendTextToChat` — the primary text sending command.
     */
    sendMessage(text: string): Promise<void>;
    /**
     * Send a prompt directly to the agent panel.
     *
     * Uses `antigravity.sendPromptToAgentPanel` — focuses the agent panel.
     */
    sendPrompt(text: string): Promise<void>;
    /**
     * Send a chat action message (e.g., typing indicator, feedback).
     *
     * Uses `antigravity.sendChatActionMessage`.
     */
    sendChatAction(action: string): Promise<void>;
    /**
     * Switch to a specific conversation.
     *
     * @param sessionId - Conversation UUID (googleAgentId)
     */
    focusSession(sessionId: string): Promise<void>;
    /**
     * Open a new conversation in the agent panel (prioritized command).
     *
     * Uses `antigravity.prioritized.chat.openNewConversation` which both
     * opens the panel AND creates a fresh conversation.
     */
    openNewConversation(): Promise<void>;
    /**
     * Execute a Cascade action.
     *
     * Uses `antigravity.executeCascadeAction`.
     *
     * @param action - Action data to execute
     */
    executeCascadeAction(action: unknown): Promise<void>;
    /**
     * Accept the current agent step (code edit, file write, etc.).
     *
     * Uses `antigravity.agent.acceptAgentStep`.
     */
    acceptStep(): Promise<void>;
    /** Reject the current agent step. */
    rejectStep(): Promise<void>;
    /**
     * Accept a pending command (non-terminal, e.g. file edit confirmation).
     *
     * Uses `antigravity.command.accept`.
     * This is DIFFERENT from terminalCommand.accept.
     */
    acceptCommand(): Promise<void>;
    /** Reject a pending command (non-terminal). */
    rejectCommand(): Promise<void>;
    /**
     * Accept a pending terminal command.
     *
     * Uses `antigravity.terminalCommand.accept`.
     */
    acceptTerminalCommand(): Promise<void>;
    /** Reject a pending terminal command. */
    rejectTerminalCommand(): Promise<void>;
    /** Run a pending terminal command. */
    runTerminalCommand(): Promise<void>;
    /** Open the Cascade agent panel */
    openPanel(): Promise<void>;
    /** Focus the Cascade agent panel */
    focusPanel(): Promise<void>;
    /** Open the agent side panel */
    openSidePanel(): Promise<void>;
    /** Focus the agent side panel */
    focusSidePanel(): Promise<void>;
    /**
     * Get the browser integration port (e.g., 57401).
     */
    getBrowserPort(): Promise<number>;
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
    private _loadSessions;
    /**
     * Fallback: extract sessions from USS trajectory summaries protobuf.
     */
    private _loadSessionsFromUSS;
    /**
     * Wait for a new session to appear in getDiagnostics.
     * Polls every 500ms up to timeoutMs.
     *
     * @returns New session ID or empty string if timeout
     */
    private _waitForNewSession;
    /**
     * Simple delay utility.
     */
    private _delay;
    dispose(): void;
}

/**
 * Integration module types — standardized UI integration points
 * for the Antigravity Agent View.
 *
 * @module integration/types
 */
/**
 * Standardized integration points in the Agent View UI.
 *
 * Each point corresponds to a specific DOM location in the
 * Antigravity chat interface (verified 2026-02-28).
 */
declare enum IntegrationPoint {
    /** Top bar — next to +, refresh, ... icons */
    TOP_BAR = "topBar",
    /** Top right corner — before the X (close) button */
    TOP_RIGHT = "topRight",
    /** Input area — next to voice/send buttons */
    INPUT_AREA = "inputArea",
    /** Bottom icon row — file, terminal, artifact, chrome icons */
    BOTTOM_ICONS = "bottomIcons",
    /** Per-turn metadata — appended inside each conversation turn */
    TURN_METADATA = "turnMeta",
    /** User message badge — small badge inside user message bubbles */
    USER_BADGE = "userBadge",
    /** Bot response action — button next to Good/Bad feedback */
    BOT_ACTION = "botAction",
    /** 3-dot dropdown menu — extra items in the overflow menu */
    DROPDOWN_MENU = "dropdownMenu",
    /** Chat title bar — interaction on conversation title */
    CHAT_TITLE = "chatTitle"
}
/**
 * Base configuration for all integration points.
 */
interface IIntegrationBase {
    /** Unique ID for this integration (prevents duplicates) */
    id: string;
    /** Which integration point to target */
    point: IntegrationPoint;
    /** Whether this integration is enabled (default: true) */
    enabled?: boolean;
}
/**
 * Configuration for button-type integrations (top bar, input area, etc.).
 */
interface IButtonIntegration extends IIntegrationBase {
    point: IntegrationPoint.TOP_BAR | IntegrationPoint.TOP_RIGHT | IntegrationPoint.INPUT_AREA | IntegrationPoint.BOTTOM_ICONS;
    /** Icon (emoji or text glyph) */
    icon: string;
    /** Tooltip text */
    tooltip?: string;
    /** Toast to show on click */
    toast?: IToastConfig;
    /** CSS class override */
    className?: string;
}
/**
 * Configuration for turn-level metadata integration.
 */
interface ITurnMetaIntegration extends IIntegrationBase {
    point: IntegrationPoint.TURN_METADATA;
    /** Which metrics to display */
    metrics: TurnMetric[];
    /** Whether turns are clickable to show details toast */
    clickable?: boolean;
}
/**
 * Configuration for user message badges.
 */
interface IUserBadgeIntegration extends IIntegrationBase {
    point: IntegrationPoint.USER_BADGE;
    /** What to show in the badge */
    display: 'charCount' | 'wordCount' | 'custom';
    /** Custom formatter function body (receives `textLength` as arg) */
    customFormat?: string;
}
/**
 * Configuration for bot response action buttons.
 */
interface IBotActionIntegration extends IIntegrationBase {
    point: IntegrationPoint.BOT_ACTION;
    /** Icon */
    icon: string;
    /** Label text */
    label: string;
    /** Toast config on click */
    toast?: IToastConfig;
}
/**
 * Configuration for dropdown menu items.
 */
interface IDropdownIntegration extends IIntegrationBase {
    point: IntegrationPoint.DROPDOWN_MENU;
    /** Menu item icon */
    icon?: string;
    /** Menu item label */
    label: string;
    /** Add separator before this item */
    separator?: boolean;
    /** Toast config on click */
    toast?: IToastConfig;
}
/**
 * Configuration for chat title interaction.
 */
interface ITitleIntegration extends IIntegrationBase {
    point: IntegrationPoint.CHAT_TITLE;
    /** Interaction type */
    interaction: 'click' | 'dblclick' | 'hover';
    /** Hint text shown on hover */
    hint?: string;
    /** Toast config on interaction */
    toast?: IToastConfig;
}
/**
 * Toast popup configuration.
 */
interface IToastConfig {
    /** Toast title */
    title: string;
    /** Badge label and colors */
    badge?: {
        text: string;
        bgColor: string;
        textColor: string;
    };
    /** Key-value rows to display */
    rows: IToastRow[];
    /** Auto-dismiss after N milliseconds (default: 6000) */
    duration?: number;
}
/**
 * A row in a toast popup.
 */
interface IToastRow {
    /** Label (left side) */
    key: string;
    /**
     * Value (right side).
     * Can be a static string or a dynamic expression.
     * Dynamic expressions are JS code that runs in the renderer,
     * with access to `getStats()` which returns conversation stats.
     */
    value: string;
    /** If true, `value` is treated as a JS expression */
    dynamic?: boolean;
}
/**
 * Metrics available for turn metadata display.
 */
type TurnMetric = 'turnNumber' | 'userCharCount' | 'aiCharCount' | 'codeBlocks' | 'thinkingIndicator' | 'ratio' | 'separator';
/**
 * Union type of all integration configurations.
 */
type IntegrationConfig = IButtonIntegration | ITurnMetaIntegration | IUserBadgeIntegration | IBotActionIntegration | IDropdownIntegration | ITitleIntegration;
/**
 * Public interface for the Integration Manager.
 */
interface IIntegrationManager {
    /** Register a single integration point */
    register(config: IntegrationConfig): void;
    /** Register multiple integration points at once */
    registerMany(configs: IntegrationConfig[]): void;
    /** Remove a registered integration by ID */
    unregister(id: string): void;
    /** Get all registered integrations */
    getRegistered(): ReadonlyArray<IntegrationConfig>;
    /** Generate the integration script from all registered configs */
    build(): string;
    /** Install the generated script into workbench.html. Returns true if content changed. */
    install(): Promise<boolean>;
    /** Remove the integration from workbench.html */
    uninstall(): Promise<void>;
    /** Check if an integration is currently installed */
    isInstalled(): boolean;
}

/**
 * Title Manager — Extension-host API for managing chat titles.
 *
 * Allows extensions to programmatically rename conversations
 * by writing to a data file that the renderer-side title proxy reads.
 *
 * Also provides a direct localStorage synchronization mechanism
 * via the integration script's window.__agSDKTitles API.
 *
 * @module integration/title-manager
 *
 * @example
 * ```typescript
 * const sdk = new AntigravitySDK(context);
 * await sdk.initialize();
 *
 * // Rename via extension host (writes data file, renderer picks up on next poll)
 * sdk.titles.rename('cascade-uuid', 'My Custom Title');
 *
 * // Get all custom titles
 * const titles = sdk.titles.getAll();
 *
 * // Remove a custom title (reverts to auto-generated summary)
 * sdk.titles.remove('cascade-uuid');
 * ```
 */

/**
 * Manages custom conversation titles from the extension host.
 *
 * Titles are persisted in a JSON file in the workbench directory.
 * The renderer-side title proxy reads this file and merges with localStorage.
 */
declare class TitleManager implements IDisposable {
    private _titles;
    private _dataPath;
    private _initialized;
    /**
     * Initialize with the workbench directory path.
     *
     * @param workbenchDir - Path to workbench directory where data file is stored
     * @param namespace - Extension namespace for file isolation
     */
    initialize(workbenchDir: string, namespace?: string): void;
    /**
     * Check if the manager is initialized.
     */
    get isInitialized(): boolean;
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
    rename(cascadeId: string, title: string): void;
    /**
     * Get the custom title for a conversation.
     *
     * @param cascadeId - The conversation's cascade ID
     * @returns The custom title, or undefined if no custom title is set
     */
    getTitle(cascadeId: string): string | undefined;
    /**
     * Get all custom titles.
     *
     * @returns A copy of the titles map (cascadeId -> title)
     */
    getAll(): Readonly<Record<string, string>>;
    /**
     * Remove a custom title, reverting to the auto-generated summary.
     *
     * @param cascadeId - The conversation's cascade ID
     */
    remove(cascadeId: string): void;
    /**
     * Remove all custom titles.
     */
    clear(): void;
    /**
     * Get the number of custom titles.
     */
    get count(): number;
    /** Load titles from the data file */
    private _load;
    /** Save titles to the data file */
    private _save;
    dispose(): void;
}

/**
 * Integration Manager — Public API for UI integration into Agent View.
 *
 * Orchestrates ScriptGenerator and WorkbenchPatcher to provide
 * a clean, developer-friendly API.
 *
 * @module integration/integration-manager
 *
 * @example
 * ```typescript
 * import { IntegrationManager, IntegrationPoint } from 'antigravity-sdk';
 *
 * const integrator = new IntegrationManager();
 *
 * integrator.register({
 *   id: 'myStats',
 *   point: IntegrationPoint.TOP_BAR,
 *   icon: '📊',
 *   tooltip: 'Show Stats',
 *   toast: {
 *     title: 'My Extension Stats',
 *     rows: [{ key: 'turns:', value: 'Dynamic data here' }],
 *   },
 * });
 *
 * integrator.register({
 *   id: 'turnInfo',
 *   point: IntegrationPoint.TURN_METADATA,
 *   metrics: ['turnNumber', 'userCharCount', 'separator', 'aiCharCount', 'codeBlocks'],
 * });
 *
 * await integrator.install();
 * // Restart Antigravity to see changes
 * ```
 */

/**
 * Manages UI integrations into the Antigravity Agent View.
 *
 * Provides a declarative API to register integration points,
 * generates a self-contained JavaScript file, and installs it
 * into Antigravity's workbench.
 *
 * Features:
 * - **Theme-aware**: Adapts to dark/light mode automatically
 * - **Auto-repair**: Watches workbench.html and re-patches after updates
 * - **Dynamic update**: Re-generate script without re-patching workbench.html
 */
declare class IntegrationManager implements IIntegrationManager, IDisposable {
    private readonly _configs;
    private readonly _generator;
    private readonly _patcher;
    private readonly _integrity;
    private readonly _titles;
    private readonly _namespace;
    private _watcher;
    private _autoRepairDebounce;
    private _titleProxyEnabled;
    /**
     * @param namespace - Unique slug that isolates this extension's files.
     *   Derived automatically from `context.extension.id` when using AntigravitySDK.
     *   Multiple SDK-based extensions can coexist without conflicts.
     */
    constructor(namespace?: string);
    /**
     * Register a single integration point.
     *
     * @throws If an integration with the same ID already exists
     */
    register(config: IntegrationConfig): void;
    /**
     * Register multiple integration points at once.
     */
    registerMany(configs: IntegrationConfig[]): void;
    /**
     * Remove a registered integration by ID.
     */
    unregister(id: string): void;
    /**
     * Get all registered integrations.
     */
    getRegistered(): ReadonlyArray<IntegrationConfig>;
    /**
     * Add a button to the top bar (near +, refresh icons).
     */
    addTopBarButton(id: string, icon: string, tooltip?: string, toast?: IToastConfig): this;
    /**
     * Add a button to the top-right corner (before X).
     */
    addTopRightButton(id: string, icon: string, tooltip?: string, toast?: IToastConfig): this;
    /**
     * Add a button next to the send/voice buttons.
     */
    addInputButton(id: string, icon: string, tooltip?: string, toast?: IToastConfig): this;
    /**
     * Add an icon to the bottom icon row (file, terminal, etc.).
     */
    addBottomIcon(id: string, icon: string, tooltip?: string, toast?: IToastConfig): this;
    /**
     * Enable per-turn metadata display.
     */
    addTurnMetadata(id: string, metrics: ITurnMetaIntegration['metrics'], clickable?: boolean): this;
    /**
     * Add character count badges to user messages.
     */
    addUserBadges(id: string, display?: IUserBadgeIntegration['display']): this;
    /**
     * Add an action button next to Good/Bad feedback.
     */
    addBotAction(id: string, icon: string, label: string, toast?: IToastConfig): this;
    /**
     * Add item(s) to the 3-dot dropdown menu.
     */
    addDropdownItem(id: string, label: string, icon?: string, toast?: IToastConfig, separator?: boolean): this;
    /**
     * Enable chat title interaction.
     */
    addTitleInteraction(id: string, interaction?: ITitleIntegration['interaction'], hint?: string, toast?: IToastConfig): this;
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
    enableTitleProxy(): this;
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
    get titles(): TitleManager;
    /**
     * Generate the integration script from all registered configs.
     *
     * If title proxy is enabled, appends the title proxy renderer code.
     *
     * @returns Complete JavaScript code as a string
     */
    build(): string;
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
    install(): Promise<boolean>;
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
    installSeamless(executeCommand: (command: string) => Thenable<any>, showMessage?: (message: string, ...items: string[]) => Thenable<string | undefined>): Promise<void>;
    /**
     * Remove this extension from the SDK framework.
     *
     * If this is the last extension, the loader is removed from workbench.html
     * and all original checksums are restored.
     *
     * ⚠️ Requires Antigravity restart to take effect.
     */
    uninstall(): Promise<void>;
    /**
     * Check if this extension is registered in the SDK framework.
     */
    isInstalled(): boolean;
    /**
     * Check if the shared SDK loader is installed in workbench.html.
     */
    isLoaderInstalled(): boolean;
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
    signalActive(): void;
    /**
     * Re-generate and overwrite the integration script without re-patching workbench.html.
     *
     * Use this after registering/unregistering integration points at runtime.
     * The script file is updated in-place; the next Antigravity restart
     * will pick up the changes. workbench.html <script> tag is unchanged.
     *
     * @returns true if script was updated
     */
    updateScript(): boolean;
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
    enableAutoRepair(): void;
    /**
     * Disable auto-repair watcher.
     */
    disableAutoRepair(): void;
    /**
     * Whether auto-repair is active.
     */
    get isAutoRepairEnabled(): boolean;
    private _tryRepair;
    /**
     * Register the Demo preset — a complete demo of all 9 integration points.
     * Useful for testing and as a reference implementation.
     */
    useDemoPreset(): this;
    dispose(): void;
}

/**
 * Integrity Manager — Suppress Antigravity's "corrupt installation" warnings.
 *
 * When the SDK patches workbench files, Antigravity's IntegrityService detects
 * checksum mismatches and shows two warnings:
 *   1. Console WARN ("Installation has been modified on disk")
 *   2. UI Notification ("Your Antigravity installation appears to be corrupt")
 *
 * This class updates ALL mismatched SHA256 hashes in product.json, so
 * IntegrityService sees isPure=true and produces no warnings at all.
 *
 * Handles not just workbench.html but also workbench.desktop.main.js (auto-run fix),
 * workbench-jetski-agent.html (agent manager patching), and any other modified files.
 *
 * Multi-extension coordination: the SDK manifest (ag-sdk-manifest.json)
 * tracks active extensions. A separate registry (.ag-sdk-integrity.json)
 * stores the original hashes, so the last extension to uninstall restores
 * the original state.
 *
 * @module integration/integrity-manager
 *
 * @internal
 */
/**
 * Manages integrity check suppression for Antigravity's IntegrityService.
 *
 * Call `suppressCheck()` after any file patching (workbench.html, main.js, etc.).
 * It scans ALL files listed in product.json checksums, recomputes hashes for
 * any that have changed, and updates product.json. IntegrityService will see
 * `isPure = true` on next restart, producing zero warnings.
 */
declare class IntegrityManager {
    private readonly _productJsonPath;
    private readonly _appOutDir;
    private readonly _registryPath;
    private readonly _namespace;
    /**
     * @param workbenchDir — Absolute path to the workbench directory
     *   (e.g. `%LOCALAPPDATA%/Programs/Antigravity/resources/app/out/vs/code/electron-browser/workbench/`)
     * @param namespace — Unique slug for this extension (e.g. 'kanezal-better-antigravity')
     */
    constructor(workbenchDir: string, namespace: string);
    /**
     * Suppress the integrity check by updating ALL mismatched hashes in product.json.
     *
     * Scans every file listed in product.json checksums, recomputes SHA256 for each,
     * and updates any that have changed. This handles not just workbench.html but also
     * workbench.desktop.main.js (auto-run fix), jetskiAgent files, etc.
     *
     * Call this after any file patching. Safe to call multiple times.
     */
    suppressCheck(): void;
    /**
     * Release the integrity check suppression.
     *
     * Call this when uninstalling the integration. If no other SDK namespaces
     * remain active, restores all original hashes in product.json.
     */
    releaseCheck(): void;
    /**
     * Re-apply integrity suppression after auto-repair.
     *
     * Call this after auto-repair has re-patched files
     * (e.g. after an AG update that overwrote workbench files).
     */
    repair(): void;
    /**
     * Compute SHA256 hash matching Antigravity's ChecksumService format:
     * base64 WITHOUT trailing '=' padding.
     */
    private _computeHash;
    /**
     * Restore all original hashes in product.json.
     */
    private _restoreOriginalHashes;
    /**
     * Read the coordination registry from disk.
     */
    private _readRegistry;
    /**
     * Write the coordination registry to disk.
     */
    private _writeRegistry;
    /**
     * Delete the coordination registry file.
     */
    private _deleteRegistry;
}

/**
 * Main SDK entry point.
 *
 * Provides a unified interface to Antigravity's agent system
 * via verified transport layer (CommandBridge + StateBridge + EventMonitor).
 *
 * @module AntigravitySDK
 *
 * @example
 * ```typescript
 * import { AntigravitySDK } from 'antigravity-sdk';
 *
 * export function activate(context: vscode.ExtensionContext) {
 *   const sdk = new AntigravitySDK(context);
 *   await sdk.initialize();
 *
 *   // List conversations
 *   const sessions = await sdk.cascade.getSessions();
 *   console.log(`${sessions.length} conversations`);
 *
 *   // Read preferences (all 16 sentinel values)
 *   const prefs = await sdk.cascade.getPreferences();
 *   console.log('Terminal policy:', prefs.terminalExecutionPolicy);
 *
 *   // Monitor for new conversations
 *   sdk.monitor.onNewConversation(() => {
 *     console.log('New conversation detected!');
 *   });
 *   sdk.monitor.start(3000);
 *
 *   // Clean up
 *   context.subscriptions.push(sdk);
 * }
 * ```
 */

/**
 * SDK initialization options.
 */
interface ISDKOptions {
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * The main Antigravity SDK class.
 *
 * Provides access to:
 * - `commands` — Execute Antigravity internal commands
 * - `state` — Read agent preferences and state from USS
 * - `cascade` — Manage Cascade conversations, send messages, read preferences
 * - `monitor` — Watch for state changes (new conversations, preference updates)
 *
 * @example
 * ```typescript
 * const sdk = new AntigravitySDK(context);
 * await sdk.initialize();
 * const sessions = await sdk.cascade.getSessions();
 * ```
 */
declare class AntigravitySDK implements IDisposable {
    private readonly _context;
    private readonly _disposables;
    private _initialized;
    private _agVersion;
    /** Command bridge for executing Antigravity commands */
    readonly commands: CommandBridge;
    /** State bridge for reading USS data */
    readonly state: StateBridge;
    /** Cascade manager for conversations, preferences, diagnostics */
    readonly cascade: CascadeManager;
    /** Event monitor for watching state changes */
    readonly monitor: EventMonitor;
    /** Integration manager for Agent View UI customization */
    readonly integration: IntegrationManager;
    /**
     * Language Server bridge for headless cascade operations.
     * Use this for background cascade creation without UI switching.
     *
     * @example
     * ```typescript
     * const id = await sdk.ls.createCascade({ text: 'Analyze coverage' });
     * await sdk.ls.sendMessage({ cascadeId: id, text: 'Focus on tests' });
     * await sdk.ls.focusCascade(id); // Only when ready to show
     * ```
     */
    readonly ls: LSBridge;
    /**
     * Create a new Antigravity SDK instance.
     *
     * @param context - VS Code extension context
     * @param options - SDK options
     */
    constructor(_context: vscode.ExtensionContext, options?: ISDKOptions);
    /**
     * Initialize the SDK and verify Antigravity is running.
     *
     * Call this before using any SDK features.
     *
     * @throws {AntigravityNotFoundError} If Antigravity is not detected
     */
    initialize(): Promise<void>;
    /**
     * Check if the SDK has been initialized.
     */
    get isInitialized(): boolean;
    /**
     * Get the SDK version.
     */
    get version(): string;
    /**
     * Get info about the installed Antigravity version and SDK compatibility.
     * Available after initialize().
     */
    get agVersion(): AGVersionInfo | null;
    /**
     * Detect if we're running inside Antigravity IDE.
     */
    private _detectAntigravity;
    /**
     * Dispose of the SDK and all its resources.
     */
    dispose(): void;
}

export { type AGVersionInfo, AntigravityCommands, AntigravityNotFoundError, AntigravitySDK, AntigravitySDKError, ArtifactReviewPolicy, CascadeManager, CommandBridge, CommandExecutionError, CortexStepType, DisposableStore, type Event, EventEmitter, EventMonitor, type IActiveSessionChange, type IAgentPreferences, type IAgentState, type IBotActionIntegration, type IButtonIntegration, type IChatMessage, type IContextInfo, type IConversationAnnotations, type ICortexStep, type ICreateSessionOptions, type IDiagnosticsInfo, type IDisposable, type IDropdownIntegration, type IHeadlessCascadeOptions, type IModelConfig, type ISDKOptions, type ISendMessageOptions, type ISessionInfo, type IStateChange, type IStepCountChange, type IStepMetadata, type ITitleIntegration, type IToastConfig, type ITokenBreakdown, type ITrajectoryEntry, type ITurnMetaIntegration, type IUserBadgeIntegration, type IntegrationConfig, IntegrationManager, IntegrationPoint, IntegrityManager, LSBridge, LogLevel, Logger, type ModelId, Models, SessionNotFoundError, StateBridge, StateReadError, StepStatus, TerminalExecutionPolicy, TitleManager, TrajectoryType, type TurnMetric, USSKeys, detectAGVersion, toDisposable };
