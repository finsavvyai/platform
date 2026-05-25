import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { voiceCommands } from '../schema/index.js';

export async function seedVoiceCommands(db: PostgresJsDatabase<any>) {
  const commands = [
    // Recording commands
    {
      name: 'Start Recording',
      trigger: 'start recording',
      alternativeTriggers: ['begin recording', 'start test recording'],
      category: 'recording',
      description: 'Start a new test recording session',
      actionType: 'system-command',
      actionConfig: { action: 'start_recording' },
      parameters: [],
      isSystemCommand: true,
    },
    {
      name: 'Stop Recording',
      trigger: 'stop recording',
      alternativeTriggers: ['end recording', 'finish recording'],
      category: 'recording',
      description: 'Stop the current recording session',
      actionType: 'system-command',
      actionConfig: { action: 'stop_recording' },
      parameters: [],
      isSystemCommand: true,
    },
    {
      name: 'Pause Recording',
      trigger: 'pause recording',
      alternativeTriggers: ['pause test'],
      category: 'recording',
      description: 'Pause the current recording session',
      actionType: 'system-command',
      actionConfig: { action: 'pause_recording' },
      parameters: [],
      isSystemCommand: true,
    },
    
    // Navigation commands
    {
      name: 'Navigate To',
      trigger: 'navigate to',
      alternativeTriggers: ['go to', 'open'],
      category: 'navigation',
      description: 'Navigate to a specific URL',
      actionType: 'ui-action',
      actionConfig: { action: 'navigate', element: 'url' },
      parameters: [{ name: 'url', type: 'string', required: true }],
      isSystemCommand: true,
    },
    {
      name: 'Go Back',
      trigger: 'go back',
      alternativeTriggers: ['navigate back', 'back'],
      category: 'navigation',
      description: 'Navigate back in browser history',
      actionType: 'ui-action',
      actionConfig: { action: 'back' },
      parameters: [],
      isSystemCommand: true,
    },
    {
      name: 'Refresh Page',
      trigger: 'refresh page',
      alternativeTriggers: ['reload page', 'refresh'],
      category: 'navigation',
      description: 'Refresh the current page',
      actionType: 'ui-action',
      actionConfig: { action: 'refresh' },
      parameters: [],
      isSystemCommand: true,
    },
    
    // Interaction commands
    {
      name: 'Click Element',
      trigger: 'click',
      alternativeTriggers: ['tap', 'press'],
      category: 'interaction',
      description: 'Click on an element',
      actionType: 'ui-action',
      actionConfig: { action: 'click' },
      parameters: [{ name: 'element', type: 'string', required: true }],
      isSystemCommand: true,
    },
    {
      name: 'Type Text',
      trigger: 'type',
      alternativeTriggers: ['enter text', 'input'],
      category: 'interaction',
      description: 'Type text into an input field',
      actionType: 'ui-action',
      actionConfig: { action: 'type' },
      parameters: [
        { name: 'text', type: 'string', required: true },
        { name: 'element', type: 'string', required: false }
      ],
      isSystemCommand: true,
    },
    {
      name: 'Select Option',
      trigger: 'select',
      alternativeTriggers: ['choose', 'pick'],
      category: 'interaction',
      description: 'Select an option from a dropdown',
      actionType: 'ui-action',
      actionConfig: { action: 'select' },
      parameters: [
        { name: 'option', type: 'string', required: true },
        { name: 'element', type: 'string', required: false }
      ],
      isSystemCommand: true,
    },
    
    // Assertion commands
    {
      name: 'Assert Text',
      trigger: 'assert text',
      alternativeTriggers: ['verify text', 'check text'],
      category: 'assertion',
      description: 'Assert that specific text is present',
      actionType: 'test-step',
      actionConfig: { action: 'assert_text' },
      parameters: [
        { name: 'text', type: 'string', required: true },
        { name: 'element', type: 'string', required: false }
      ],
      isSystemCommand: true,
    },
    {
      name: 'Assert Visible',
      trigger: 'assert visible',
      alternativeTriggers: ['verify visible', 'check visible'],
      category: 'assertion',
      description: 'Assert that an element is visible',
      actionType: 'test-step',
      actionConfig: { action: 'assert_visible' },
      parameters: [{ name: 'element', type: 'string', required: true }],
      isSystemCommand: true,
    },
    {
      name: 'Assert Hidden',
      trigger: 'assert hidden',
      alternativeTriggers: ['verify hidden', 'check hidden'],
      category: 'assertion',
      description: 'Assert that an element is hidden',
      actionType: 'test-step',
      actionConfig: { action: 'assert_hidden' },
      parameters: [{ name: 'element', type: 'string', required: true }],
      isSystemCommand: true,
    },
    
    // Wait commands
    {
      name: 'Wait For Element',
      trigger: 'wait for',
      alternativeTriggers: ['wait for element'],
      category: 'wait',
      description: 'Wait for an element to appear',
      actionType: 'test-step',
      actionConfig: { action: 'wait_for_element' },
      parameters: [
        { name: 'element', type: 'string', required: true },
        { name: 'timeout', type: 'number', required: false }
      ],
      isSystemCommand: true,
    },
    {
      name: 'Wait Seconds',
      trigger: 'wait',
      alternativeTriggers: ['pause for', 'delay'],
      category: 'wait',
      description: 'Wait for a specific number of seconds',
      actionType: 'test-step',
      actionConfig: { action: 'wait' },
      parameters: [{ name: 'seconds', type: 'number', required: true }],
      isSystemCommand: true,
    },
    
    // Screenshot commands
    {
      name: 'Take Screenshot',
      trigger: 'take screenshot',
      alternativeTriggers: ['capture screen', 'screenshot'],
      category: 'capture',
      description: 'Take a screenshot of the current page',
      actionType: 'test-step',
      actionConfig: { action: 'screenshot' },
      parameters: [{ name: 'name', type: 'string', required: false }],
      isSystemCommand: true,
    },
  ];

  const insertedCommands = await db.insert(voiceCommands).values(commands).returning();
  console.log(`✅ Inserted ${insertedCommands.length} voice commands`);
  
  return insertedCommands;
}