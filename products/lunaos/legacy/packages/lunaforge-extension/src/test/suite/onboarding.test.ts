import * as assert from 'assert';
import * as vscode from 'vscode';
import { TourManager } from '../../onboarding/TourManager';
import { OnboardingChecklistManager } from '../../onboarding/ChecklistManager';

suite('Onboarding Tests', () => {
    let context: vscode.ExtensionContext;

    setup(() => {
        // Mock context
        context = {
            globalState: {
                get: (key: string) => undefined,
                update: (key: string, value: any) => Promise.resolve()
            }
        } as any;
    });

    test('TourManager should retrieve tours', () => {
        const manager = new TourManager(context);
        const tours = manager.getAllTours();
        assert.ok(tours.length > 0, 'Should have tours defined');
        assert.ok(tours.find(t => t.id === 'control-center'), 'Control Center tour should exist');
    });

    test('ChecklistManager should track progress', async () => {
        const manager = new OnboardingChecklistManager(context);
        const tasks = manager.getAllTasks();
        assert.ok(tasks.length > 0, 'Should have tasks defined');

        const initialProgress = manager.getCompletionPercentage();
        assert.strictEqual(initialProgress, 0, 'Initial progress should be 0');
    });
});
