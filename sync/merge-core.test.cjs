'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {initialize, preview} = require('./merge-core.js');

function blank(){
  return {schema:1,profiles:[],accounts:[{id:'a',profileId:'personal',kind:'cash',name:'Nakit',opening:0,createdAt:'0',updatedAt:'0'}],transactions:[],obligations:[],assets:[],settings:{reserves:{personal:0,cihan:0,mavi:0,lokma:0},lastBackupAt:null},createdAt:'0'};
}
function tx(id,amount=100){
  return {id,kind:'income',profileId:'personal',accountId:'a',toAccountId:null,amount,date:'2026-11-18',createdAt:'0',updatedAt:'0'};
}
const pair=()=>{
  const initial=initialize(blank(),'random-vault-id-for-test');
  return [structuredClone(initial),structuredClone(initial)];
};
test('ayrı cihazlarda eklenen iki kayıt birleşir',()=>{
  const [a,b]=pair();a.transactions.push(tx('one'));b.transactions.push(tx('two'));
  const result=preview(a,b);
  assert.equal(result.status,'ready');assert.deepEqual(result.mergedState.transactions.map(x=>x.id).sort(),['one','two']);
});
test('aynı kimliğe sahip işlem iki kez sayılmaz',()=>{
  const [a,b]=pair();a.transactions.push(tx('one'));b.transactions.push(tx('one'));
  assert.equal(preview(a,b).mergedState.transactions.length,1);
});
test('iki cihazda farklı düzenleme çakışma verir',()=>{
  const base=blank();base.transactions.push(tx('one'));
  const prepared=initialize(base,'test-vault-id');
  const a=structuredClone(prepared),b=structuredClone(prepared);
  a.transactions[0].amount=300;b.transactions[0].amount=400;
  assert.equal(preview(a,b).status,'conflict');
});
test('tek cihazda silinen kayıt tekrar gelmez',()=>{
  const base=blank();base.transactions.push(tx('one'));
  const prepared=initialize(base,'test-vault-id');
  const a=structuredClone(prepared),b=structuredClone(prepared);
  a.transactions=[];
  const r=preview(a,b);
  assert.equal(r.status,'ready');assert.equal(r.mergedState.transactions.length,0);
});
test('silme ve eşzamanlı düzenleme çakışır',()=>{
  const base=blank();base.transactions.push(tx('one'));
  const prepared=initialize(base,'test-vault-id');
  const a=structuredClone(prepared),b=structuredClone(prepared);
  a.transactions=[];b.transactions[0].amount=250;
  assert.equal(preview(a,b).status,'conflict');
});
test('farklı şifreli kasa kimlikleri eşitlenmez',()=>{
  const a=initialize(blank(),'id-a'),b=initialize(blank(),'id-b');
  assert.equal(preview(a,b).status,'blocked');
});
test('eski şemasız eşitleme kasaları birleştirilmez',()=>{
  assert.equal(preview(blank(),blank()).status,'blocked');
});
test('farklı ortak başlangıçlar engellenir',()=>{
  const [a,b]=pair();b.sync.baseline.accounts[0].opening=100;
  assert.equal(preview(a,b).status,'blocked');
});
test('bozuk hesap bağlantısı engellenir',()=>{
  const [a,b]=pair();b.transactions.push({...tx('one'),accountId:'missing'});
  assert.equal(preview(a,b).status,'conflict');
});
test('rezervler tek taraftan güncellenebilir',()=>{
  const [a,b]=pair();a.settings.reserves.personal=500;
  const r=preview(a,b);assert.equal(r.status,'ready');assert.equal(r.mergedState.settings.reserves.personal,500);
});
test('iki rezerv değişikliği çakışır',()=>{
  const [a,b]=pair();a.settings.reserves.personal=500;b.settings.reserves.personal=600;
  assert.equal(preview(a,b).status,'conflict');
});
test('girdi verilerini mutasyona uğratmaz',()=>{
  const [a,b]=pair();a.transactions.push(tx('one'));
  const before=JSON.stringify(a);preview(a,b);assert.equal(JSON.stringify(a),before);
});
