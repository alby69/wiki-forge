import { describe, it } from 'node:test';
import assert from 'node:assert';
import { appStore } from '../src/store/appStore';
import { SCRIPT_REGISTRY, buildCliArgs } from '../src/server/agentServer';

describe('Dual-Mode Shell & Application Store Test Suite', () => {
  it('should initialize with default Simple Focus Mode state', () => {
    const state = appStore.getState();
    assert.strictEqual(typeof state.isAdvancedMode, 'boolean');
    assert.strictEqual(state.activeProjectId, 'default');
  });

  it('should toggle between Simple Focus Mode and Developer Mode', () => {
    const initial = appStore.getState().isAdvancedMode;
    const toggled = appStore.toggleAdvancedMode();
    assert.strictEqual(toggled, !initial);
    assert.strictEqual(appStore.getState().isAdvancedMode, toggled);

    // Toggle back
    appStore.setAdvancedMode(initial);
    assert.strictEqual(appStore.getState().isAdvancedMode, initial);
  });

  it('should update active project and onboarding completion status', () => {
    appStore.setActiveProjectId('thesis-project');
    assert.strictEqual(appStore.getState().activeProjectId, 'thesis-project');

    appStore.setOnboardingCompleted(true);
    assert.strictEqual(appStore.getState().onboardingCompleted, true);

    // Reset to default
    appStore.setActiveProjectId('default');
  });

  it('should support action chip script definitions and arguments', () => {
    const wizardDef = SCRIPT_REGISTRY['wizard'];
    assert.ok(wizardDef);
    assert.strictEqual(wizardDef.id, 'wizard');

    const cliArgs = buildCliArgs(wizardDef, { preset: 'thesis' });
    assert.deepStrictEqual(cliArgs, ['--preset', 'thesis']);
  });
});
