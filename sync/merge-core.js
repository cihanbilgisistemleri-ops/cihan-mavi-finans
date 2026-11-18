/* Cihan Mavi Finans · Eşitleme çekirdeği (deneysel)
 * Saf veri birleştirme: ağa bağlanmaz, veri kaydetmez, şifre çözmez.
 * Gerçek kasa verilerini halka açık GitHub'a göndermeyin.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MaviFinansMerge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COLLECTIONS = ['accounts', 'transactions', 'obligations', 'assets'];
  const PROFILES = ['personal', 'cihan', 'mavi', 'lokma'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    }
    return JSON.stringify(value);
  }
  function same(a, b) { return canonical(a) === canonical(b); }
  function isId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 200; }
  function mapById(rows, name) {
    if (!Array.isArray(rows)) throw new Error(name + ' bir kayıt dizisi olmalı.');
    const map = new Map();
    for (const row of rows) {
      if (!row || !isId(row.id)) throw new Error(name + ': geçersiz kayıt kimliği.');
      if (map.has(row.id)) throw new Error(name + ': mükerrer kimlik ' + row.id);
      map.set(row.id, row);
    }
    return map;
  }
  function snapshot(state) {
    if (!state || state.schema !== 1 || !state.settings || !state.settings.reserves)
      throw new Error('Desteklenmeyen finans kasası şeması.');
    const result = {schema: 1};
    for (const name of COLLECTIONS) {
      mapById(state[name], name);
      result[name] = clone(state[name]);
    }
    const reserves = {};
    for (const pid of PROFILES) {
      const amount = state.settings.reserves[pid] ?? 0;
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Geçersiz rezerv: ' + pid);
      reserves[pid] = amount;
    }
    result.settings = {reserves};
    return result;
  }
  // Bu adım yalnızca tek cihazda uygulanmalı; şifreli kopyası diğer cihaza aktarılır.
  function initialize(state, vaultId) {
    if (!isId(vaultId)) throw new Error('Güvenli rastgele üretilmiş kasa kimliği gerekli.');
    if (state.sync && state.sync.protocol === 2) throw new Error('Kasa zaten eşitleme için hazırlanmış.');
    const prepared = clone(state);
    prepared.sync = {protocol: 2, vaultId, baseline: snapshot(state)};
    return prepared;
  }
  function mergeItem(base, left, right, id, type, conflicts) {
    if (same(left, right)) return left;
    if (same(left, base)) return right;
    if (same(right, base)) return left;
    conflicts.push({type, id, reason: 'İki cihazda da farklı biçimde değiştirilmiş.'});
    return undefined;
  }
  function checkReferences(result, conflicts) {
    const accounts = mapById(result.accounts, 'accounts');
    const txs = mapById(result.transactions, 'transactions');
    for (const account of result.accounts)
      if (!PROFILES.includes(account.profileId)) conflicts.push({type:'accounts',id:account.id,reason:'Geçersiz işletme bağlantısı.'});
    for (const tx of result.transactions) {
      const from = accounts.get(tx.accountId);
      if (!from || !PROFILES.includes(tx.profileId))
        conflicts.push({type:'transactions',id:tx.id,reason:'Geçersiz hesap veya işletme bağlantısı.'});
      else if (from.profileId !== tx.profileId)
        conflicts.push({type:'transactions',id:tx.id,reason:'İşlem işletmesiyle kaynak hesap uyuşmuyor.'});
      if (tx.kind === 'transfer' && (!accounts.has(tx.toAccountId) || tx.toAccountId === tx.accountId))
        conflicts.push({type:'transactions',id:tx.id,reason:'Transfer hedef hesabı geçersiz.'});
    }
    for (const o of result.obligations) {
      if (!PROFILES.includes(o.profileId)) conflicts.push({type:'obligations',id:o.id,reason:'Geçersiz işletme.'});
      if (o.settledTxId && !txs.has(o.settledTxId)) conflicts.push({type:'obligations',id:o.id,reason:'Ödeme işlemi bulunamıyor.'});
    }
    for (const a of result.assets)
      if (!PROFILES.includes(a.profileId)) conflicts.push({type:'assets',id:a.id,reason:'Geçersiz işletme.'});
    const seen = new Map();
    for (const account of result.accounts) {
      const key = [account.profileId,account.kind,String(account.name).trim().toLocaleLowerCase('tr-TR')].join('|');
      if (seen.has(key)) conflicts.push({type:'accounts',id:account.id,reason:'Aynı işletmede ve türde mükerrer hesap: ' + account.name});
      else seen.set(key,account.id);
    }
  }
  // Kayıt değiştirmez: yalnızca güvenli birleştirme önizlemesi döndürür.
  function preview(local, incoming) {
    const left = snapshot(local), right = snapshot(incoming);
    const ls = local.sync, rs = incoming.sync;
    if (!ls || !rs || ls.protocol !== 2 || rs.protocol !== 2)
      return {status:'blocked',reason:'Önce ortak şifreli kasadan eşitleme kurulmalı. Eski yedekler otomatik birleştirilmez.'};
    if (!isId(ls.vaultId) || ls.vaultId !== rs.vaultId)
      return {status:'blocked',reason:'Farklı kasalar: eşitleme kimliği uyuşmuyor.'};
    if (!ls.baseline || !rs.baseline || !same(snapshot(ls.baseline),snapshot(rs.baseline)))
      return {status:'blocked',reason:'Ortak başlangıç noktası uyuşmuyor; veri üzerine yazılmayacak.'};
    const base = snapshot(ls.baseline);
    const merged = clone(local);
    const conflicts = [];
    const summary = {};
    for (const name of COLLECTIONS) {
      const bm=mapById(base[name],name), lm=mapById(left[name],name), rm=mapById(right[name],name);
      const ids = new Set([...bm.keys(),...lm.keys(),...rm.keys()]);
      const rows = [];
      let onlyLocal=0, onlyRemote=0;
      for (const id of ids) {
        const hasB=bm.has(id),hasL=lm.has(id),hasR=rm.has(id);
        const b=hasB?bm.get(id):undefined;
        const l=hasL?lm.get(id):undefined;
        const r=hasR?rm.get(id):undefined;
        const row=mergeItem(b,l,r,id,name,conflicts);
        if (row !== undefined) rows.push(clone(row));
        if (!hasB && hasL && !hasR) onlyLocal++;
        if (!hasB && !hasL && hasR) onlyRemote++;
      }
      merged[name] = rows;
      summary[name] = {onlyLocal, onlyRemote, resulting:rows.length};
    }
    merged.settings.reserves = {};
    for (const pid of PROFILES) {
      const value = mergeItem(base.settings.reserves[pid],left.settings.reserves[pid],right.settings.reserves[pid],pid,'reserves',conflicts);
      if (value !== undefined) merged.settings.reserves[pid] = value;
    }
    checkReferences(merged,conflicts);
    if (conflicts.length) return {status:'conflict',conflicts,summary};
    // Ortak temel, ancak her iki cihaz onaylayınca ileri alınmalıdır.
    // Çağıran uygulama önce şifreli yedek almalı ve kullanıcı onayı istemelidir.
    return {status:'ready',mergedState:merged,summary,requiresConfirmation:true};
  }
  return Object.freeze({snapshot,initialize,preview});
});