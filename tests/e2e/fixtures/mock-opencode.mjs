#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const prompt = readFileSync(0, 'utf8');
const isCompile = prompt.includes('Ingest raw file');
const text = isCompile
  ? [
      '---',
      'type: Concept',
      'title: E2E Compiled Note',
      'description: Deterministic note produced by the E2E mock LLM',
      'status: stable',
      'tags: [e2e]',
      'generated:',
      '  by: process:e2e-mock',
      '  at: "2026-11-26T00:00:00Z"',
      'verified: []',
      'sources: []',
      '---',
      '',
      '# E2E Compiled Note',
      '',
      'Nota deterministica generata dal mock LLM per il flusso Carica → Compila → Chiedi.',
    ].join('\n')
  : 'Risposta E2E: la wiki è pronta.';

process.stdout.write(`${JSON.stringify({ type: 'text', part: { type: 'text', text } })}\n`);
