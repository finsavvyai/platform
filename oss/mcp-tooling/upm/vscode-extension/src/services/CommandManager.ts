import * as vscode from 'vscode';
import { Disposable } from '../utils/Disposable';
import { Logger } from '../utils/Logger';

const log = Logger.createLogger('CommandManager');

export class CommandManager extends Disposable {
    private commands = new Map<string, vscode.Disposable>();

    public register(command: vscode.Disposable): void {
        // Commands are registered in the extension, this is just a tracker
        log.debug('Command registered');
    }

    public async dispose(): Promise<void> {
        log.info('Disposing CommandManager...');
        for (const command of this.commands.values()) {
            command.dispose();
        }
        this.commands.clear();
        await super.dispose();
    }
}
