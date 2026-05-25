package api

import "net/http"

// ServeEmbedPage serves a minimal HTML host that customers can drop
// into their KYC flow with `<iframe src=".../embed?key=API_KEY">`.
// It loads widget.js, exposes an input + result panel, and posts
// every screen result back to the parent via window.postMessage so
// the embedding application can react without polling.
//
// X-Frame-Options is intentionally NOT set: this page is meant to be
// framed. Content-Security-Policy frame-ancestors stays open here so
// any tenant can embed; per-tenant origin allow-listing is enforced
// upstream by IFrameWhitelistMiddleware on the screening endpoint.
func (h *IFrameHandler) ServeEmbedPage(
	w http.ResponseWriter, _ *http.Request,
) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(embedHTML)
}

var embedHTML = []byte(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>AMLIQ screening</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
color:#111;background:#fafafa;padding:16px;margin:0}
input,button{font:inherit;padding:10px 12px;border-radius:8px;
border:1px solid #d1d5db;outline:none}
input{width:100%;box-sizing:border-box}
button{background:#111;color:#fff;border:none;cursor:pointer;
margin-top:8px;width:100%}
button:disabled{opacity:.5}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;
padding:12px;margin-top:12px;font-size:14px}
.tag{display:inline-block;padding:2px 8px;border-radius:6px;
background:#fee2e2;color:#991b1b;font-size:12px;margin-left:6px}
.empty{color:#6b7280;font-size:13px}
</style></head><body>
<form id="f"><input id="q" placeholder="Enter name to screen…" autofocus>
<button id="b" type="submit">Screen</button></form>
<div id="r"></div>
<script src="/api/v1/widget/widget.js"></script>
<script>
var p=new URLSearchParams(location.search);
AEGIS.init({apiKey:p.get("key")||""});
var r=document.getElementById("r"),b=document.getElementById("b");
document.getElementById("f").addEventListener("submit",function(e){
  e.preventDefault();var q=document.getElementById("q").value.trim();
  if(!q)return;b.disabled=true;b.textContent="Screening…";
  AEGIS.screen(q,function(res){
    b.disabled=false;b.textContent="Screen";
    var d=res&&res.data?res.data:{matches:[]};
    var m=d.matches||[];r.innerHTML="";
    if(window.parent!==window){
      window.parent.postMessage({source:"amliq",query:q,matches:m},"*");
    }
    if(m.length===0){r.innerHTML='<div class="card empty">'+
      'No matches.</div>';return;}
    m.forEach(function(x){var c=document.createElement("div");
      c.className="card";c.innerHTML=x.name+
      '<span class="tag">'+(x.list_id||"hit")+'</span>';
      r.appendChild(c);});
  });
});
</script></body></html>
`)
