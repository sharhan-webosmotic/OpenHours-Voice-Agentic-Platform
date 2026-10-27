// Shared helper for the placeholder scripts that stand in for tooling which does not
// exist yet. It always exits 0 so `pnpm check` is runnable, and it prints loudly so a
// green `pnpm check` is never mistaken for a real gate.
export const notYetImplemented = (name, arrivesIn) => {
  process.stdout.write(`${name}: not yet implemented (${arrivesIn}) - STUB, exiting 0\n`);
  process.exit(0);
};
