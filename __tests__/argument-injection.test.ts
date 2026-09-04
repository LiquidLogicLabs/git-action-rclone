import { assertNotOptionLike } from '../src/rclone-runner';

/**
 * Argument injection, not shell injection. An argv array stops the SHELL interpreting a
 * value; it does nothing about rclone's own option parser, which reads a leading "-" as a
 * flag wherever it appears. rclone's flags include `--config <file>`, which would repoint it
 * at an attacker-supplied remote definition.
 *
 * Deliberately NOT guarded, by standing decision: `rclone-flags` is documented as "Extra
 * flags appended to every rclone command". It exists to pass flags, so rejecting a leading
 * "-" there would reject every legitimate use. Its trust tier is the workflow author, the
 * same tier as a composite action's shell inputs — not an unauthenticated attacker.
 *
 * Also not guarded, because it is safe by construction rather than by policy: `sources`
 * reaches argv through `path.resolve()`, which always returns an absolute path beginning
 * with "/" and therefore can never occupy an option slot.
 */
describe('assertNotOptionLike', () => {
  it.each(['--config=/tmp/evil', '-v', '--password-command=id'])('rejects %s', (payload) => {
    expect(() => assertNotOptionLike(payload, 'remote password')).toThrow(/beginning with "-"/);
  });

  it.each(['s3cret', 'p-a-s-s', '', 'remote'])('accepts the ordinary value %s', (value) => {
    expect(() => assertNotOptionLike(value, 'remote password')).not.toThrow();
  });

  it('names the label so an operator can tell which input was rejected', () => {
    expect(() => assertNotOptionLike('-x', 'remote name')).toThrow(/remote name/);
  });
});
