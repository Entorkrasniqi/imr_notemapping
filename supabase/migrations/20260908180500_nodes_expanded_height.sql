-- A note collapses to a fixed short height while closed and remembers
-- its real (user-set) height for when it's reopened — a UI behavior added
-- after docs/database.md was first written, which didn't anticipate it.
-- `height` alone can't hold both meanings at once: whichever value was
-- true at the moment of the last save (very often "collapsed", since most
-- notes sit closed most of the time) would be the only one left. This
-- column is genuinely new information, not a duplicate of anything above.
--
-- Nullable, since a note that has never been opened yet has no "expanded"
-- size to remember — the app falls back to a sensible default in that case.
alter table public.nodes
  add column expanded_height double precision;
