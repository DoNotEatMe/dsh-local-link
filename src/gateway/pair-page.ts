export const PAIR_PATH = '/__dsh-local-link/pair'

export const PAIR_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Connecting to DeepSeek Harness</title>
<style>
  :root{font-family:system-ui,sans-serif;color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#101216;color:#f5f7fa}main{box-sizing:border-box;width:min(380px,calc(100% - 32px));padding:28px;text-align:center;border:1px solid #343942;border-radius:20px;background:#191c22;box-shadow:0 20px 60px #0008}h1{margin:0 0 8px;font-size:24px}p{margin:0;color:#b8c0cc;line-height:1.5}.spinner{width:32px;height:32px;margin:0 auto 20px;border:3px solid #3a414d;border-top-color:#2878ff;border-radius:50%;animation:spin .8s linear infinite}output{display:block;min-height:22px;margin-top:16px;color:#ffb4ab}@keyframes spin{to{transform:rotate(360deg)}}
</style>
<main>
  <div class="spinner" aria-hidden="true"></div>
  <h1>DeepSeek Harness</h1>
  <p>Connecting this device…</p>
  <output id="status"></output>
</main>
<script>
  const status=document.getElementById('status');
  const stop=(message)=>{document.querySelector('.spinner')?.remove();status.textContent=message;};
  void (async()=>{try{
    const params=new URLSearchParams(location.hash.slice(1));const token=params.get('token');const sessionId=params.get('session');
    if(!token)throw new Error('This connection link is incomplete.');
    try{history.replaceState(null,'',location.pathname);}catch{}
    const ua=navigator.userAgent;const mobile=navigator.userAgentData?.mobile===true;
    const type=/iPad|Tablet/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))?'Tablet':mobile||/iPhone|iPod|Android|Mobile/i.test(ua)?'Phone':'Computer';
    const browser=/EdgA?|EdgiOS|Edg/i.test(ua)?'Edge':/CriOS|Chrome/i.test(ua)?'Chrome':/FxiOS|Firefox/i.test(ua)?'Firefox':/Safari/i.test(ua)?'Safari':'Browser';
    await new Promise((resolve,reject)=>{
      const request=new XMLHttpRequest();request.open('POST',location.pathname);request.timeout=12000;request.setRequestHeader('content-type','application/json');
      request.onload=()=>request.status===204?resolve():reject(new Error(request.status===410?'This QR code expired or was already used.':'Could not connect this device.'));
      request.onerror=()=>reject(new Error('Could not reach this computer. Check the local network and try again.'));
      request.ontimeout=()=>reject(new Error('Connection timed out. Generate a new code and try again.'));
      request.send(JSON.stringify({token,device:{type,browser}}));
    });
    if(sessionId)try{localStorage.setItem('dsh.sessions.current',JSON.stringify({sessionId}));}catch{}
    location.replace('/');
  }catch(error){stop(error instanceof Error?error.message:'Could not connect this device.');}})();
</script>
</html>`
