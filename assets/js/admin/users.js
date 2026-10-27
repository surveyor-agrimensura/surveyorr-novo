(() => {
  'use strict';

  function secureRandomIndex(max) {
    if (!Number.isInteger(max) || max <= 0) return 0;
    const limit = Math.floor(0x100000000 / max) * max;
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= limit);
    return values[0] % max;
  }

  function generateStrongPassword(length = 14) {
    const groups = [
      'ABCDEFGHJKLMNPQRSTUVWXYZ',
      'abcdefghijkmnopqrstuvwxyz',
      '23456789',
      '!@#$%*-_?'
    ];
    const targetLength = Math.max(12, Math.min(Number(length) || 14, 32));
    const chars = groups.map((group) => group[secureRandomIndex(group.length)]);
    const all = groups.join('');
    while (chars.length < targetLength) chars.push(all[secureRandomIndex(all.length)]);
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swap = secureRandomIndex(index + 1);
      [chars[index], chars[swap]] = [chars[swap], chars[index]];
    }
    return chars.join('');
  }

  window.SurveyorAdminUsers = Object.freeze({ generateStrongPassword });
})();
