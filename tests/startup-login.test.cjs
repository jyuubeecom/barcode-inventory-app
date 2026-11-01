'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function node(){return {hidden:false,inert:false,value:'',children:[],nodes:new Map(),listeners:{},classList:{add(){},remove(){}},focus(){this.focused=true;},appendChild(n){this.children.push(n);},querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,node());return this.nodes.get(s);},addEventListener(t,f){this.listeners[t]=f;}};}
function bridge({fail=false,storageFails=false}={}){
 const body=node(),under=node();body.appendChild(under);const values=new Map(),screens=[],calls=[];
 const doc={body,head:node(),createElement:()=>node(),addEventListener(){},querySelector:()=>null};
 const c={document:doc,sessionStorage:{getItem:k=>values.get(k)||null,setItem(k,v){if(storageFails)throw Error('FAKE_STORAGE');values.set(k,v);},removeItem:k=>values.delete(k)},window:null,CustomEvent:function(t,o){this.type=t;this.detail=o.detail;},fetch:async(u,o)=>{calls.push({u,o});return {ok:!fail,status:fail?401:200,headers:{get:()=> 'application/json'},json:async()=>fail?{success:false,message:'FAKE_BAD_LOGIN'}:{success:true,token:'FAKE-TOKEN',expires_in:60,user:{username:'fake-worker',role:'worker'}}};},Date,Map,Set,Number,JSON,Error,console};
 c.window=c;c.dispatchEvent=()=>{};c.inventoryApp={showScreen:s=>screens.push(s)};c.inventoryPermissions={isAdmin:()=>false};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server-test.js'),'utf8'),c);
 const api=c.inventoryServerSearch;
 function dialog(){return body.children.find(n=>n.id==='server-auth-dialog');}
 async function login(){const content=dialog().querySelector('#server-auth-content');content.querySelector('#server-auth-username').value='fake-worker';content.querySelector('#server-auth-password').value='FAKE-PASSWORD';await content.querySelector('#server-auth-login-form').listeners.submit({preventDefault(){}});}
 return {api,body,under,values,screens,calls,dialog,login};
}
test('startup login is available to workers, blocks background and preserves entered form on repeated open',()=>{
 const s=bridge();s.api.openStartupLogin();const d=s.dialog();assert.equal(d.hidden,false);assert.equal(s.under.inert,true);assert.equal(d.querySelector('#server-auth-close-button').hidden,true);
 const form=d.querySelector('#server-auth-content');form.querySelector('#server-auth-username').value='FAKE';s.api.openStartupLogin();assert.equal(form.querySelector('#server-auth-username').value,'FAKE');
 d.querySelector('#server-auth-close-button').listeners.click();assert.equal(d.hidden,false);
 s.api.cancelStartupLogin();assert.equal(d.hidden,true);assert.equal(s.under.inert,false);assert.equal(s.screens.length,0);
});
test('successful startup login goes home and does not fetch a test product or retain password',async()=>{
 const s=bridge();s.api.openStartupLogin();await s.login();assert.deepEqual(s.screens,['home']);assert.equal(s.dialog().hidden,true);assert.equal(s.under.inert,false);assert.equal(s.calls.length,1);assert.ok(s.calls[0].u.endsWith('/login.php'));assert.ok(![...s.values.values()].some(v=>v.includes('FAKE-PASSWORD')));assert.equal(s.api.getSession().user.role,'worker');
 s.api.logout();assert.equal(s.api.getSession(),null);
});
test('failed login and blocked session storage keep startup login open without home navigation',async()=>{
 for(const options of [{fail:true},{storageFails:true}]){const s=bridge(options);s.api.openStartupLogin();await s.login();assert.equal(s.dialog().hidden,false);assert.equal(s.under.inert,true);assert.equal(s.screens.length,0);assert.equal(s.api.getSession(),null);assert.equal(s.calls.length,1);}
});
function startup({session=null,mode='shared'}={}){
 const events={},docEvents={},timers=new Map();let next=0,opened=0,cancelled=0,loggedOut=0;
 const home=node(),nodes=new Map();home.appendChild=n=>nodes.set(n.id,n);
 const c={Date,Math,window:null,document:{getElementById:id=>id==='common-workspace-home'?home:nodes.get(id),createElement:()=>node(),addEventListener:(t,f)=>docEvents[t]=f},addEventListener:(t,f)=>events[t]=f,clearTimeout:id=>timers.delete(id),setTimeout:(f,ms)=>{timers.set(++next,{f,ms});return next;},inventoryCommonWorkspace:{mode:()=>mode},inventoryServerSearch:{getSession:()=>session,openStartupLogin:()=>opened++,cancelStartupLogin:()=>cancelled++,logout(){loggedOut++;session=null;events['inventory-server-auth-changed']();}}};c.window=c;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../startup-login.js'),'utf8'),c);docEvents.DOMContentLoaded();return {events,docEvents,timers,nodes,session(v){session=v;},mode(v){mode=v;},get opened(){return opened;},get cancelled(){return cancelled;},get loggedOut(){return loggedOut;}};
}
test('fresh common workspace opens login, valid session skips it and logout returns to login',()=>{
 const s=startup();assert.equal(s.opened,1);assert.equal(s.nodes.get('common-workspace-logout').hidden,true);
 s.session({expiresAt:Date.now()+120000});s.events['inventory-server-auth-changed']();assert.equal(s.opened,1);assert.equal(s.timers.size,1);assert.equal([...s.timers.values()][0].ms,60000);
 s.nodes.get('common-workspace-logout').listeners.click();assert.equal(s.loggedOut,1);assert.equal(s.opened,2);assert.equal(s.timers.size,0);
});
test('expiry and resume return to login; legacy workspace is not blocked',()=>{
 const s=startup({session:{expiresAt:Date.now()+30000}});assert.equal(s.opened,0);s.session(null);[...s.timers.values()][0].f();assert.equal(s.opened,1);
 s.mode('legacy');s.events['inventory-workspace-changed']();assert.equal(s.cancelled,1);assert.equal(s.timers.size,0);
 const l=startup({mode:'legacy'});assert.equal(l.opened,0);l.mode('shared');l.events['inventory-workspace-changed']();assert.equal(l.opened,1);
});
