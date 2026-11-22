/* 한국파크 서비스 워커
   - 목적: 홈 화면 설치(PWA) 조건 충족 + 인터넷이 약한 구장에서도 앱이 열리게 함
   - 방식: network-first — 항상 인터넷에서 새 파일을 먼저 받고,
           인터넷이 안 될 때만 저장해 둔 사본을 씁니다.
           (그래서 index.html을 고쳐 올리면 옛 화면에 갇히지 않습니다.)

   ※ 이 파일은 index.html과 같은 폴더(app/)에 둡니다.
*/
const CACHE = 'hangukpark-v3';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

/* 새 서비스 워커는 바로 대기열을 건너뛰고, 옛 캐시는 지웁니다. */
self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      /* 하나라도 실패해도 설치는 계속되게 합니다. */
      return Promise.all(CORE.map(function(url){
        return cache.add(new Request(url, { cache: 'reload' })).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* 협회 서버(API)·외부 요청은 건드리지 않음 */

  event.respondWith(
    fetch(req).then(function(res){
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(function(cache){
          cache.put(req, copy).catch(function(){});
        }).catch(function(){});
      }
      return res;
    }).catch(function(){
      /* 인터넷이 안 될 때: 같은 주소의 저장본 → 화면 요청이면 index.html */
      return caches.match(req, { ignoreSearch: true }).then(function(hit){
        if (hit) return hit;
        if (req.mode === 'navigate') {
          return caches.match('./index.html').then(function(page){
            if (page) return page;
            return new Response(
              '<!DOCTYPE html><html lang="ko"><meta charset="utf-8">' +
              '<meta name="viewport" content="width=device-width,initial-scale=1">' +
              '<title>한국파크</title>' +
              '<body style="font-family:sans-serif;padding:2rem;line-height:1.7;color:#10241a">' +
              '<h1 style="font-size:1.2rem">인터넷에 연결되지 않았습니다</h1>' +
              '<p>연결된 뒤 다시 열어 주세요. 저장해 둔 점수는 이 휴대폰에 그대로 있습니다.</p>' +
              '</body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        }
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
