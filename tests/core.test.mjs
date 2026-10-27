import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, reconcile, preferred, delaySeconds } from '../extension/core.mjs';
function fixture() {
 const tabs = new Map([
 [1,{id:1,url:'https://chatgpt.com/c/voice',audible:true,mutedInfo:{muted:false}}],
 [2,{id:2,url:'https://example.com',mutedInfo:{muted:false}}],
 [3,{id:3,url:'https://example.org',mutedInfo:{muted:true,reason:'user'}}],
 [4,{id:4,url:'https://chatgpt.com/dots',mutedInfo:{muted:false}}]
 ]);
 const api = {runtime:{id:'self'},storage:{session:{set:async()=>{}}},tabs:{
 query:async()=>[...tabs.values()],get:async id=>{if(!tabs.has(id))throw Error('closed');return tabs.get(id)},
 update:async(id,{muted})=>{tabs.get(id).mutedInfo={muted,extensionId:'self',reason:'extension'}}}};
 return {tabs,api,state:initial()};
}
test('exact host and delay limits',()=>{
 assert.ok(preferred({url:'https://chatgpt.com/any/path'}));
 assert.ok(!preferred({url:'https://chatgpt.com.evil.example'}));
 assert.equal(delaySeconds(undefined),10);assert.equal(delaySeconds(2),10);assert.equal(delaySeconds(99),20);
});
test('mute others, spare ChatGPT and preserve prior mute; release after quiet',async()=>{
 const {tabs,api,state}=fixture();
 await reconcile(api,state,{},0);
 assert.equal(tabs.get(2).mutedInfo.muted,true);assert.equal(tabs.get(4).mutedInfo.muted,false);
 tabs.get(1).audible=false;
 assert.equal(await reconcile(api,state,{},100),10100);
 await reconcile(api,state,{},10099);assert.equal(tabs.get(2).mutedInfo.muted,true);
 await reconcile(api,state,{},10100);assert.equal(tabs.get(2).mutedInfo.muted,false);
 assert.equal(tabs.get(3).mutedInfo.muted,true);
});
test('new audio cancels release and multiple ChatGPT tabs cooperate',async()=>{
 const {tabs,api,state}=fixture();await reconcile(api,state,{},0);
 tabs.get(1).audible=false;await reconcile(api,state,{},100);
 tabs.get(4).audible=true;assert.equal(await reconcile(api,state,{},10100),null);
 assert.equal(tabs.get(2).mutedInfo.muted,true);
});
test('manual override survives active focus and restoration',async()=>{
 const {tabs,api,state}=fixture();await reconcile(api,state,{},0);
 tabs.get(2).mutedInfo={muted:false,reason:'user'};
 await reconcile(api,state,{},10);assert.equal(tabs.get(2).mutedInfo.muted,false);
 await reconcile(api,state,{enabled:false},20);assert.equal(tabs.get(2).mutedInfo.muted,false);
});
test('close, suspension, and persisted worker state release safely',async()=>{
 const {tabs,api,state}=fixture();await reconcile(api,state,{},0);
 const restored=JSON.parse(JSON.stringify(state));tabs.get(1).frozen=true;
 await reconcile(api,restored,{},100);tabs.delete(3);
 await reconcile(api,restored,{},10100);assert.equal(tabs.get(2).mutedInfo.muted,false);
 assert.equal(restored.active,false);
});
test('navigation to ChatGPT restores a tab immediately',async()=>{
 const {tabs,api,state}=fixture();await reconcile(api,state,{},0);
 tabs.get(2).url='https://chatgpt.com/';await reconcile(api,state,{},10);
 assert.equal(tabs.get(2).mutedInfo.muted,false);
});
test('muted ChatGPT or merely open call never triggers',async()=>{
 const {tabs,api,state}=fixture();tabs.get(1).mutedInfo={muted:true};
 await reconcile(api,state,{},0);assert.equal(tabs.get(2).mutedInfo.muted,false);
 tabs.get(1).mutedInfo={muted:false};tabs.get(1).audible=false;
 await reconcile(api,state,{},10);assert.equal(state.active,false);
});
test('recover own mute after session state loss',async()=>{
 const {tabs,api,state}=fixture();await reconcile(api,state,{},0);
 tabs.get(1).audible=false;
 await reconcile(api,initial(),{},100);assert.equal(tabs.get(2).mutedInfo.muted,false);
 assert.equal(tabs.get(3).mutedInfo.muted,true);
});
