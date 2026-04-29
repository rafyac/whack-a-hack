import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ADMIN_CODE = 'test-admin';
process.env.COOKIE_SECRET = 'test-cookie-secret';

const {
  generateAnimalTeamNames,
  generatePassword,
  sign,
  unsign,
} = await import('../src/auth.js');

test('sign and unsign round-trip plain values', () => {
  const value = 'team-42';
  const signed = sign(value);

  assert.notEqual(signed, value);
  assert.equal(unsign(signed), value);
});

test('unsign rejects tampered values and signatures', () => {
  const signed = sign('alpha.bravo');
  const separator = signed.lastIndexOf('.');
  const value = signed.slice(0, separator);
  const mac = signed.slice(separator + 1);
  const tamperedValue = `alpha.charlie.${mac}`;
  const tamperedMac = `${value}.${mac}tampered`;

  assert.equal(unsign(tamperedValue), null);
  assert.equal(unsign(tamperedMac), null);
  assert.equal(unsign('missing-separator'), null);
});

test('generatePassword returns a non-empty three-word slug', () => {
  for (let i = 0; i < 25; i += 1) {
    const password = generatePassword();

    assert.match(password, /^[a-z]+-[a-z]+-[a-z]+$/);
    assert.equal(password.split('-').length, 3);
    assert.ok(password.length > 0);
  }
});

test('generateAnimalTeamNames skips existing names and stays unique', () => {
  const names = generateAnimalTeamNames(6, ['Fox', 'Otter']);

  assert.equal(names.length, 6);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 6);
  assert.ok(!names.some((name) => ['fox', 'otter'].includes(name.toLowerCase())));
});
