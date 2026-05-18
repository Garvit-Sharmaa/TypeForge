'use client';
import React from 'react';
import { useKeyboardStore, selectKeyLookup } from '@/store/keyboardStore';
import { Key } from './Key';
import type { RowDefinition } from '@typing-master/shared';

interface RowProps { rowDef: RowDefinition }

export const Row = React.memo(function Row({ rowDef }: RowProps) {
  const keyLookup = useKeyboardStore(selectKeyLookup);
  if (!keyLookup) return null;

  return (
    <g role="group" aria-label={`${rowDef.label}`}>
      {rowDef.keyIds.map((keyId) => {
        const keyDef = keyLookup[keyId];
        return keyDef ? <Key key={keyId} keyDef={keyDef} /> : null;
      })}
    </g>
  );
});
