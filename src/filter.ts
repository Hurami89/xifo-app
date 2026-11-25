// Word filter for the chat log (on by default, "Filter: On/Off" in the room). Masks the word, keeps the first letter.
// Words are stored reversed so the source file reads cleanly; add more to the list as the room needs.
const REVERSED = [
  'kcuf', 'gnikcuf', 'rekcuf', 'tihs', 'yttihs', 'hctib', 'ssa', 'elohssa', 'kcid', 'tnuc', 'kcoc', 'ssup',
  'ssupy', 'tsdrab', 'erohw', 'tuls', 'gaf', 'toggaf', 'reggin', 'aggin', 'drater', 'kips', 'kcihc', 'ekyd',
  'ynnart', 'knaw', 'rekcnaw',
];
const WORDS = REVERSED.map((w) => w.split('').reverse().join(''));
const RE = new RegExp(`\\b(${WORDS.join('|')})(s|es|ed|ing|er|ers)?\\b`, 'gi');

export function cleanWords(text: string): string {
  return text.replace(RE, (m) => m[0] + '*'.repeat(m.length - 1));
}
