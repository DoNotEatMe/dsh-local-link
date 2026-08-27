export const PAIR_PATH = '/__dsh-local-link/pair'

export const PAIR_PAGE = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Pair with DeepSeek Harness</title>
<style>
  :root{font-family:system-ui,sans-serif;color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#101216;color:#f5f7fa}main{box-sizing:border-box;width:min(420px,calc(100% - 32px));padding:28px;border:1px solid #343942;border-radius:20px;background:#191c22;box-shadow:0 20px 60px #0008}h1{margin:0 0 8px;font-size:24px}p{color:#b8c0cc;line-height:1.5}label{display:grid;gap:7px;margin:20px 0 14px;font-size:13px;color:#d7dce4}input,button{box-sizing:border-box;width:100%;min-height:48px;border-radius:12px;font:inherit}input{padding:11px 13px;border:1px solid #49515d;background:#101216;color:#fff}button{border:0;background:#2878ff;color:#fff;font-weight:650;cursor:pointer}button:disabled{opacity:.55;cursor:wait}output{display:block;min-height:22px;margin-top:12px;color:#ffb4ab}
</style>
<main>
  <h1>DeepSeek Harness</h1>
  <p>Pair this browser with the Harness instance on your local network.</p>
  <form id="pair-form">
    <label>Device name<input id="device-label" maxlength="64" autocomplete="off" value="Mobile browser"></label>
    <button type="submit">Pair this device</button>
    <output id="status"></output>
  </form>
</main>
<script>
  const form=document.getElementById('pair-form');const label=document.getElementById('device-label');const status=document.getElementById('status');
  const token=new URLSearchParams(location.hash.slice(1)).get('token');history.replaceState(null,'',location.pathname);
  form.addEventListener('submit',async(event)=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.value='Pairing…';
    try{const response=await fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,label:label.value})});
      if(!response.ok)throw new Error(response.status===410?'This QR code expired or was already used.':'Pairing failed.');location.replace('/');
    }catch(error){status.value=error instanceof Error?error.message:'Pairing failed.';button.disabled=false;}});
</script>
</html>`
