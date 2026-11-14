import { hash, verify, Algorithm } from "@node-rs/argon2";
// Better Auth's documented hashing extension; the maintained native library
// generates its salt and implements Argon2id. No cryptographic algorithm here.
export function createPasswordHasher() {
  const options = {
    algorithm: Algorithm.Argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    outputLen: 32,
  };
  let active = 0;
  const waiting: Array<() => void> = [];
  const bounded = async <T>(run: () => Promise<T>): Promise<T> => {
    if (active >= 2) {
      if (waiting.length >= 16) throw new Error("AUTH_BUSY");
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else active++;
    try {
      return await run();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
  return {
    hash: (password: string) => bounded(() => hash(password, options)),
    verify: ({ password, hash: encoded }: { password: string; hash: string }) =>
      bounded(async () => {
        // Stored corruption must not request an excessive native memory/work factor.
        if (
          !/^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/.test(
            encoded,
          )
        )
          return false;
        return verify(encoded, password, options);
      }),
  };
}
