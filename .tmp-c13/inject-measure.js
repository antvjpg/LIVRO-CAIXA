(function() {
  var sheets = [...document.styleSheets];
  var allSelectors = [];
  var seen = new Set();
  for (var si = 0; si < sheets.length; si++) {
    try {
      var sheet = sheets[si];
      var href = sheet.href || "";
      var isLocal = ["style/themes.css","style/base.css","style/components.css","style/layout.css","style/features.css","style/dashboard-chat.css","vendor/tabler-icons/tabler-icons.css"].some(function(p) { return href.indexOf(p) !== -1; });
      if (!isLocal) continue;
      var rules = extractAll(sheet);
      for (var ri = 0; ri < rules.length; ri++) {
        if (!seen.has(rules[ri])) {
          seen.add(rules[ri]);
          allSelectors.push({ selector: rules[ri], sheet: href || "(inline)" });
        }
      }
    } catch (e) {}
  }

  function extractAll(sheet) {
    var out = [];
    try {
      var rules = sheet.cssRules || [];
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule) continue;
        if (rule.type === 1) {
          var st = rule.selectorText || "";
          var parts = splitCSSSelectors(st);
          for (var pi = 0; pi < parts.length; pi++) {
            if (parts[pi]) out.push(parts[pi]);
          }
        } else if (rule.type === 4 || rule.type === 12) {
          out.push.apply(out, extractAll(rule));
        }
      }
    } catch (e) {}
    return out;
  }

  function splitCSSSelectors(text) {
    var parts = [];
    var cur = "";
    var depth = 0;
    var s1 = false, s2 = false;
    var SQ = String.fromCharCode(39);
    var DQ = String.fromCharCode(34);
    var BS = String.fromCharCode(92);
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (s1) {
        cur += c;
        if (c === SQ && text[i-1] !== BS) s1 = false;
        continue;
      }
      if (s2) {
        cur += c;
        if (c === DQ && text[i-1] !== BS) s2 = false;
        continue;
      }
      if (c === SQ) { s1 = true; cur += c; continue; }
      if (c === DQ) { s2 = true; cur += c; continue; }
      if (c === "(" || c === "[" || c === "{") { depth++; cur += c; continue; }
      if (c === ")" || c === "]" || c === "}") { depth = Math.max(0, depth-1); cur += c; continue; }
      if (c === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  var results = [];
  for (var ai = 0; ai < allSelectors.length; ai++) {
    var item = allSelectors[ai];
    var count = 0;
    var status = "inconclusivo";
    var error = null;
    try {
      var nodes = document.querySelectorAll(item.selector);
      count = nodes.length;
      if (count > 0) status = "estatica";
      else status = "sem-correspondencia";
    } catch (e) {
      status = "inconclusivo";
      error = String(e.message || e).slice(0, 200);
    }
    results.push({ selector: item.selector, sheet: item.sheet, count: count, status: status, error: error });
  }
  return results;
})()
