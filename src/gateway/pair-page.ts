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
  const status=document.getElementById('status');const params=new URLSearchParams(location.hash.slice(1));
  const token=params.get('token');const sessionId=params.get('session');history.replaceState(null,'',location.pathname);
  const label=navigator.userAgentData?.platform||navigator.platform||'Mobile browser';
  void (async()=>{try{if(!token)throw new Error('This connection link is incomplete.');
    const response=await fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,label})});
    if(!response.ok)throw new Error(response.status===410?'This QR code expired or was already used.':'Could not connect this device.');
    if(sessionId)localStorage.setItem('dsh.sessions.current',JSON.stringify({sessionId}));
    location.replace('/');
  }catch(error){document.querySelector('.spinner')?.remove();status.value=error instanceof Error?error.message:'Could not connect this device.';}})();
</script>
</html>`
