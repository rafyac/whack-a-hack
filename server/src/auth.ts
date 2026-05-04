import './env.js';
import crypto from 'node:crypto';

const COOKIE_SECRET =
  process.env.COOKIE_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('COOKIE_SECRET env var is required in production');
      })()
    : 'dev-only-secret-change-me');

export const ADMIN_CODE =
  process.env.ADMIN_CODE ||
  (() => {
    throw new Error(
      'ADMIN_CODE env var is required. Copy server/.env.example to server/.env for local development, and set ADMIN_CODE before deployment.'
    );
  })();

export function sign(value: string): string {
  const mac = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(value)
    .digest('base64url');
  return `${value}.${mac}`;
}

export function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(value)
    .digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? value : null;
}

const WORDS = [
  'apple','breeze','cosmic','dragon','ember','falcon','glow','harbor','iris','jolly',
  'kite','lunar','mango','nebula','orbit','pixel','quartz','rocket','sunny','tiger',
  'umbra','vivid','willow','xenon','yellow','zephyr','blaze','coral','delta','echo'
];

const ANIMAL_TEAM_NAMES = [
  'Aardvark', 'Albatross', 'Alligator', 'Alpaca', 'Anaconda', 'Antelope',
  'Armadillo', 'Axolotl', 'Badger', 'Barracuda', 'Bat', 'Beaver', 'Bison',
  'Bobcat', 'Buffalo', 'Camel', 'Capybara', 'Caracal', 'Cheetah', 'Cobra',
  'Condor', 'Cougar', 'Coyote', 'Crane', 'Crocodile', 'Crow', 'Dingo',
  'Dolphin', 'Eagle', 'Falcon', 'Ferret', 'Fox', 'Gazelle', 'Gecko',
  'Giraffe', 'Gorilla', 'Hawk', 'Hedgehog', 'Heron', 'Hippo', 'Hyena',
  'Ibis', 'Jaguar', 'Kangaroo', 'Kingfisher', 'Koala', 'Leopard', 'Lion',
  'Llama', 'Lynx', 'Macaw', 'Manta Ray', 'Meerkat', 'Moose', 'Narwhal',
  'Octopus', 'Orca', 'Osprey', 'Otter', 'Owl', 'Panda', 'Panther',
  'Parrot', 'Peacock', 'Pelican', 'Penguin', 'Peregrine', 'Puma', 'Python',
  'Quail', 'Raccoon', 'Raven', 'Rhino', 'Salamander', 'Seal', 'Shark',
  'Snow Leopard', 'Sparrow', 'Stingray', 'Tiger', 'Toucan', 'Tortoise',
  'Viper', 'Walrus', 'Wolf', 'Wolverine', 'Wombat', 'Yak', 'Zebra'
] as const;

// Auto-generated team password when admin doesn't supply one.
// Plaintext storage (per project decision) — hackathon-scope only.
export function generatePassword(): string {
  const pick = () => WORDS[crypto.randomInt(0, WORDS.length)];
  return `${pick()}-${pick()}-${pick()}`;
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateAnimalTeamNames(
  count: number,
  existingNames: readonly string[] = []
): string[] {
  const used = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const generated: string[] = [];
  const pool = shuffle(ANIMAL_TEAM_NAMES);

  for (const baseName of pool) {
    if (generated.length >= count) break;
    const candidate = baseName.trim();
    const normalized = candidate.toLowerCase();
    if (used.has(normalized)) continue;
    generated.push(candidate);
    used.add(normalized);
  }

  for (const baseName of pool) {
    if (generated.length >= count) break;
    let suffix = 2;
    while (generated.length < count) {
      const candidate = `${baseName} ${suffix}`;
      const normalized = candidate.toLowerCase();
      if (!used.has(normalized)) {
        generated.push(candidate);
        used.add(normalized);
        break;
      }
      suffix += 1;
    }
  }

  return generated;
}
