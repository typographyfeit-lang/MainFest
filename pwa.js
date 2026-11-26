'use strict';
// Offline cache, persistent storage request and the iOS "Add to Home Screen" hint.
// Optional: the game works without any of this.
(() => {
  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  if ('serviceWorker' in navigator && secure) {
    addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  }
  // Ask the browser not to evict saved progress under storage pressure.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(done => done || navigator.storage.persist()).catch(() => {});
  }
  // Safari deletes website storage after 7 days without a visit; Home Screen apps are not affected.
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
  const hint = document.querySelector('#installhint');
  if (hint && ios && !standalone) hint.hidden = false;
})();
