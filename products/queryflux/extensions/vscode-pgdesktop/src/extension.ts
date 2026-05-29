// Ultimate Universal Database Manager Extension
// Main entry point that supports both legacy and new modes

import * as vscode from 'vscode';

// Import both old and new extension modules  
import { activate as activateOriginal, deactivate as deactivateOriginal } from './originalExtension';
import { activate as activateUltimate, deactivate as deactivateUltimate } from './ultimateExtension';

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Ultimate Universal Database Manager Extension is now active!');
    
    // Check if user wants the new ultimate experience or legacy PostgreSQL-only
    const config = vscode.workspace.getConfiguration('ultimatedb');
    const useUltimateMode = config.get<boolean>('enableUltimateMode', true);
    
    if (useUltimateMode) {
        // Use the new ultimate multi-database experience
        try {
            activateUltimate(context);
        } catch (error) {
            console.error('Ultimate mode activation failed:', error);
            vscode.window.showErrorMessage('Failed to activate Ultimate mode, falling back to legacy mode');
            activateOriginal(context);
        }
    } else {
        // Use original PostgreSQL-only experience
        activateOriginal(context);
    }
}

export function deactivate() {
    // Deactivate both if needed
    try {
        deactivateUltimate();
    } catch (error) {
        // Ultimate mode might not be active
    }
    
    try {
        deactivateOriginal();
    } catch (error) {
        // Original mode might not be active
    }
}