/**
 * Type definitions for LunaForge command system
 */

import * as vscode from 'vscode';

export interface CommandContext {
  mode: string;
  hasGraph: boolean;
  hasLicense: boolean;
  isPremium: boolean;
  workspaceOpen: boolean;
  selectedFile?: string;
  activeEditor?: string;
  [key: string]: any;
}

export interface CommandHandler {
  (...args: any[]): Promise<void> | void;
}

export interface CommandRegistration {
  id: string;
  title: string;
  description: string;
  category?: string;
  handler: CommandHandler;
  when?: string;
  context?: {
    mode?: string;
    requiresGraph?: boolean;
    requiresLicense?: boolean;
    requiresPremium?: boolean;
    minVersion?: string;
  };
  keywords?: string[];
  icon?: string;
  keybinding?: string;
}

export interface CommandGroup {
  id: string;
  title: string;
  description: string;
  commands: string[];
  icon?: string;
  when?: string;
}

export interface CommandPaletteItem {
  command: string;
  title: string;
  category: string;
  when?: string;
}

export interface CommandDocumentation {
  id: string;
  title: string;
  description: string;
  usage: string;
  examples: string[];
  arguments?: CommandArgument[];
  category: string;
  since: string;
}

export interface CommandArgument {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  default?: any;
  options?: string[];
}

export interface CommandTelemetry {
  commandId: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  context: Partial<CommandContext>;
}