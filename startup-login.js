"use strict";
(function(root){
  let timer=null;
  function check(){
    root.clearTimeout(timer);timer=null;
    const auth=root.inventoryServerSearch;
    if(!auth)return;
    if(root.inventoryCommonWorkspace?.mode()==='legacy'){
      auth.cancelStartupLogin();return;
    }
    const session=auth.getSession();
    const logout=root.document.getElementById('common-workspace-logout');
    if(logout)logout.hidden=!session;
    if(!session){auth.openStartupLogin();return;}
    timer=root.setTimeout(check,Math.max(1,Math.min(60000,session.expiresAt-Date.now())));
  }
  root.document.addEventListener('DOMContentLoaded',()=>{
    const home=root.document.getElementById('common-workspace-home');
    if(home){
      const button=root.document.createElement('button');
      button.id='common-workspace-logout';button.type='button';button.textContent='ログアウト';
      button.addEventListener('click',()=>root.inventoryServerSearch.logout());home.appendChild(button);
    }
    root.addEventListener('inventory-server-auth-changed',check);
    root.addEventListener('inventory-workspace-changed',check);
    root.addEventListener('focus',check);
    root.document.addEventListener('visibilitychange',check);
    check();
  });
})(window);
