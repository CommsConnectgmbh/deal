const en = require('./en.json');
const ar = require('./ar.json');

function flatKeys(obj, prefix) {
  prefix = prefix || '';
  var keys = [];
  var ks = Object.keys(obj);
  for (var i = 0; i < ks.length; i++) {
    var k = ks[i];
    var path = prefix ? prefix + '.' + k : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys = keys.concat(flatKeys(obj[k], path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function getVal(obj, path) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur && typeof cur === 'object') cur = cur[parts[i]];
    else return undefined;
  }
  return cur;
}

var enKeys = flatKeys(en);
var arKeys = new Set(flatKeys(ar));
var missing = enKeys.filter(function(k) { return !arKeys.has(k); });

var result = {};
for (var i = 0; i < missing.length; i++) {
  result[missing[i]] = getVal(en, missing[i]);
}
console.log(JSON.stringify(result, null, 2));
