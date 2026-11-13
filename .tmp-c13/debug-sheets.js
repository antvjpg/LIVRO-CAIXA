(function() {
  var sheets = [...document.styleSheets];
  var info = {
    totalSheets: sheets.length,
    sheets: []
  };
  for (var si = 0; si < sheets.length; si++) {
    var sheet = sheets[si];
    var href = sheet.href || "(inline)";
    var rulesCount = 0;
    var cssRulesError = null;
    try {
      rulesCount = sheet.cssRules ? sheet.cssRules.length : 0;
    } catch (e) {
      cssRulesError = String(e.message || e).slice(0, 100);
    }
    info.sheets.push({ href: href, rulesCount: rulesCount, error: cssRulesError });
  }
  return info;
})()
