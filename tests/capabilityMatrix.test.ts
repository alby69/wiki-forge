import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_MIN_ROLE,
  OPERATION_MIN_ROLE,
  ROLE_ORDER,
  canUseAction,
  canUseOperation,
  roleHasCapability,
} from '@shared/auth/capabilities';
import { OPERATION_ROLES } from '@backend/server/auth/rbacMiddleware';

describe('progressive capability matrix', () => {
  it('uses one operation map for backend and UI', () => {
    assert.strictEqual(OPERATION_ROLES, OPERATION_MIN_ROLE);
  });

  it('orders roles from Reader to Admin', () => {
    assert.deepEqual(ROLE_ORDER, ['Reader', 'Contributor', 'KnowledgeEngineer', 'Admin']);
    for (const role of ROLE_ORDER) {
      assert.ok(roleHasCapability([role], 'Reader'), `${role} inherits Reader`);
    }
    assert.ok(!roleHasCapability(undefined, 'Reader'));
  });

  it('maps governance operations to the intended tier', () => {
    assert.equal(canUseOperation(['Reader'], 'projects.exportMarkdownZip'), true);
    assert.equal(canUseOperation(['Reader'], 'wiki.note.save'), false);
    assert.equal(canUseOperation(['Contributor'], 'wiki.note.save'), true);
    assert.equal(canUseOperation(['Contributor'], 'changesets.apply'), false);
    assert.equal(canUseOperation(['KnowledgeEngineer'], 'changesets.apply'), true);
    assert.equal(canUseOperation(['KnowledgeEngineer'], 'schedule.approvalDecision'), false);
    assert.equal(canUseOperation(['Admin'], 'schedule.approvalDecision'), true);
    assert.equal(canUseOperation(['Contributor'], 'graph.reconcile'), false);
    assert.equal(canUseOperation(['KnowledgeEngineer'], 'graph.reconcile'), true);
    for (const id of [
      'projects.gguf.list',
      'projects.gguf.uploadStart',
      'projects.gguf.uploadChunk',
      'projects.gguf.uploadFinalize',
      'projects.gguf.activate',
      'projects.gguf.deactivate',
    ]) {
      assert.equal(canUseOperation(['KnowledgeEngineer'], id), false, `${id} must be Admin-only`);
      assert.equal(canUseOperation(['Admin'], id), true, `${id} must be available to Admin`);
    }
  });

  it('maps UI actions to the intended tier', () => {
    assert.equal(ACTION_MIN_ROLE['global:projects'], 'Reader');
    assert.equal(ACTION_MIN_ROLE['global:study'], 'Contributor');
    assert.equal(ACTION_MIN_ROLE['global:toggleMode'], 'Contributor');
    assert.equal(ACTION_MIN_ROLE['global:keWorkbench'], 'KnowledgeEngineer');
    assert.equal(ACTION_MIN_ROLE['global:users'], 'Admin');
    assert.equal(canUseAction(['Reader'], 'global:review'), true);
    assert.equal(canUseAction(['Reader'], 'global:study'), false);
    assert.equal(canUseAction(['Contributor'], 'global:changesets'), true);
    assert.equal(canUseAction(['KnowledgeEngineer'], 'global:keWorkbench'), true);
    assert.equal(canUseAction(['KnowledgeEngineer'], 'global:users'), false);
    assert.equal(canUseAction(['Admin'], 'global:users'), true);
  });

  it('leaves unmapped UI actions visible and fails unknown operations closed', () => {
    assert.equal(canUseAction(['Reader'], 'view:graph'), true);
    assert.equal(canUseOperation(['Admin'], 'brand.new.command'), true);
    assert.equal(canUseOperation(['KnowledgeEngineer'], 'brand.new.command'), false);
  });
});
