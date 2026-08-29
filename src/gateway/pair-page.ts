import en from '../locales/en.json' with { type: 'json' }
import zh from '../locales/zh.json' with { type: 'json' }

export const PAIR_PATH = '/__dsh-local-link/pair'
export const CONNECT_PATH = '/__dsh-local-link/connect'

const pairCopies = {
  en: {
    title: en['pair.title'], connecting: en['pair.connecting'], incomplete: en['pair.incomplete'],
    expired: en['pair.expired'], failed: en['pair.failed'], unreachable: en['pair.unreachable'], timeout: en['pair.timeout'],
  },
  zh: {
    title: zh['pair.title'], connecting: zh['pair.connecting'], incomplete: zh['pair.incomplete'],
    expired: zh['pair.expired'], failed: zh['pair.failed'], unreachable: zh['pair.unreachable'], timeout: zh['pair.timeout'],
  },
} as const

function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')
}

const copySource = JSON.stringify(pairCopies).replace(/</gu, '\\u003c')

export const PAIR_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(pairCopies.en.title)}</title>
<style>
  :root{font-family:system-ui,sans-serif;color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#101216;color:#f5f7fa}main{box-sizing:border-box;width:min(380px,calc(100% - 32px));padding:28px;text-align:center;border:1px solid #343942;border-radius:20px;background:#191c22;box-shadow:0 20px 60px #0008}h1{margin:0 0 8px;font-size:24px}p{margin:0;color:#b8c0cc;line-height:1.5}.spinner{width:32px;height:32px;margin:0 auto 20px;border:3px solid #3a414d;border-top-color:#2878ff;border-radius:50%;animation:spin .8s linear infinite}output{display:block;min-height:22px;margin-top:16px;color:#ffb4ab}@keyframes spin{to{transform:rotate(360deg)}}
</style>
<main>
  <div class="spinner" aria-hidden="true"></div>
  <h1>DeepSeek Harness</h1>
  <p id="message">${escapeHtml(pairCopies.en.connecting)}</p>
  <output id="status"></output>
</main>
<script>
  const copies=${copySource};
  const languages=navigator.languages??[navigator.language];const language=languages.some(value=>String(value).toLowerCase().startsWith('zh'))?'zh':'en';const copy=copies[language];
  if(document.documentElement)document.documentElement.lang=language;document.title=copy.title;document.getElementById('message').textContent=copy.connecting;
  const status=document.getElementById('status');
  const stop=(message)=>{document.querySelector('.spinner')?.remove();status.textContent=message;};
  void (async()=>{try{
    const params=new URLSearchParams(location.hash.slice(1));const token=params.get('token');const sessionId=params.get('session');
    if(!token)throw new Error(copy.incomplete);
    try{history.replaceState(null,'',location.pathname);}catch{}
    const ua=navigator.userAgent;const mobile=navigator.userAgentData?.mobile===true;
    const type=/iPad|Tablet/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))?'Tablet':mobile||/iPhone|iPod|Android|Mobile/i.test(ua)?'Phone':'Computer';
    const browser=/EdgA?|EdgiOS|Edg/i.test(ua)?'Edge':/CriOS|Chrome/i.test(ua)?'Chrome':/FxiOS|Firefox/i.test(ua)?'Firefox':/Safari/i.test(ua)?'Safari':'Browser';
    await new Promise((resolve,reject)=>{
      const request=new XMLHttpRequest();request.open('POST',location.pathname);request.timeout=12000;request.setRequestHeader('content-type','application/json');
      request.onload=()=>request.status===204?resolve():reject(new Error(request.status===410?copy.expired:copy.failed));
      request.onerror=()=>reject(new Error(copy.unreachable));
      request.ontimeout=()=>reject(new Error(copy.timeout));
      request.send(JSON.stringify({token,device:{type,browser}}));
    });
    if(sessionId)try{localStorage.setItem('dsh.sessions.current',JSON.stringify({sessionId}));}catch{}
    location.replace('${CONNECT_PATH}');
  }catch(error){stop(error instanceof Error?error.message:copy.failed);}})();
</script>
</html>`
