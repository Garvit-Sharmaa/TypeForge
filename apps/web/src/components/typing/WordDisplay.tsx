'use client';
/**
 * WordDisplay — renders all words with character spans.
 *
 * CRITICAL: This component is wrapped in React.memo.
 * It renders ONCE on mount. All subsequent character updates
 * go through direct className mutations on charRefs — zero re-renders.
 */

import React from 'react';

interface WordDisplayProps {
  words:     string[];
  charRefs:  React.MutableRefObject<(HTMLSpanElement | null)[][]>;
  wordRefs:  React.MutableRefObject<(HTMLSpanElement | null)[]>;
  caretRef:  React.MutableRefObject<HTMLDivElement | null>;
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
  onWrapperClick: () => void;
}

const WordDisplay = React.memo(
  function WordDisplay({
    words,
    charRefs,
    wordRefs,
    caretRef,
    wrapperRef,
    onWrapperClick,
  }: WordDisplayProps) {
    // Pre-allocate the ref arrays on every word list change
    // (words only change on session init, so this is safe)
    charRefs.current = words.map(() => []);
    wordRefs.current = new Array(words.length).fill(null);

    return (
      /* Scrollable 3-row window — overflow hidden, JS scrolls via scrollTop */
      <div
        ref={wrapperRef}
        className="words-wrapper"
        onClick={onWrapperClick}
        role="textbox"
        aria-label="Typing area"
        aria-multiline="true"
      >
        {/* Animated caret — positioned absolutely inside this container */}
        <div ref={caretRef} className="typing-caret" aria-hidden="true" />

        {/* Words flex-wrap container */}
        <div className="words-container" id="words-container">
          {words.map((word, wIdx) => (
            <span
              key={`${wIdx}-${word}`}
              ref={(el) => { wordRefs.current[wIdx] = el; }}
              className="word"
              data-word-idx={wIdx}
            >
              {word.split('').map((char, cIdx) => (
                <span
                  key={cIdx}
                  ref={(el) => {
                    if (!charRefs.current[wIdx]) charRefs.current[wIdx] = [];
                    charRefs.current[wIdx][cIdx] = el;
                  }}
                  className="char"
                  data-char={char}
                  data-word-idx={wIdx}
                  data-char-idx={cIdx}
                >
                  {char}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    );
  },
  // Never re-render — words only change on session reset (handled by key prop in parent)
  () => true,
);

WordDisplay.displayName = 'WordDisplay';
export default WordDisplay;
