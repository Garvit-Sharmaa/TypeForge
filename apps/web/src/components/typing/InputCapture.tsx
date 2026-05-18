'use client';
/**
 * InputCapture — invisible input that captures all keystrokes.
 *
 * This is a plain <input> element that is visually hidden (not display:none —
 * display:none prevents focus). It receives all keyboard events and forwards
 * them to the engine handler via onKeyDown.
 *
 * Paste is blocked server-side by anti-cheat AND client-side here.
 */

import React from 'react';

interface InputCaptureProps {
  inputRef:     React.RefObject<HTMLInputElement>;
  onKeyDown:    (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?:    boolean;
}

const InputCapture = React.memo(function InputCapture({
  inputRef,
  onKeyDown,
  disabled = false,
}: InputCaptureProps) {
  return (
    <input
      ref={inputRef}
      id="typing-input-capture"
      className="typing-input-capture"
      type="text"
      onKeyDown={onKeyDown}
      // Block paste — anti-cheat client guard
      onPaste={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      // Keep input empty — we track state in engineRef
      onChange={() => {}}
      value=""
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      disabled={disabled}
      tabIndex={0}
      aria-label="Typing input — start typing to begin"
      aria-hidden="false"
    />
  );
});

InputCapture.displayName = 'InputCapture';
export default InputCapture;
