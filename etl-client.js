/*
 * etl-client.js
 * Client-side port of etl_v6.py — turns the raw "Monitoring Pengiriman Laut" sheet
 * (exported as CSV) into the same compact `summary` object the dashboard expects
 * ({ total_all, total_delivered, active_rows, updatedAt }).
 *
 * Depends on PapaParse (https://www.papaparse.com/) being loaded first.
 *
 * Column matching is done by HEADER NAME (with whitespace/case-insensitive
 * fallback), never by position — so inserting/reordering columns in the sheet
 * is safe as long as the header text itself isn't renamed. This mirrors the
 * `find_col()` helper in etl_v6.py exactly.
 */
(function (global) {
  "use strict";

  var RISKY_ALERTS = {
    POO: ["Delay", "Potensi Delay"],
    Sailing: ["Delay", "Potensi Delay"],
    Yard: ["Potensi Stordem"],
  };
  var SEVERITY_ORDER = { Delay: 0, "Potensi Stordem": 1, "Potensi Delay": 2 };
  var MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  var MON_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function normWs(s) {
    return String(s).replace(/\s+/g, "").toLowerCase();
  }

  // Mirrors pandas.read_csv's default na_values list, so cells like "#N/A" or
  // "NULL" are treated as missing exactly like the Python ETL does.
  var NA_TOKENS = {
    "": true, "#n/a": true, "#n/a n/a": true, "#na": true, "-1.#ind": true,
    "-1.#qnan": true, "-nan": true, "1.#ind": true, "1.#qnan": true,
    "<na>": true, "n/a": true, "na": true, "null": true, "nan": true, "none": true,
  };
  function isNaToken(s) {
    return NA_TOKENS.hasOwnProperty(String(s).trim().toLowerCase());
  }

  // Mirrors pandas' auto-suffixing of duplicate CSV headers ("Target SLA",
  // "Target SLA" -> "Target SLA", "Target SLA.1").
  function dedupeHeaders(headers) {
    var seen = {};
    return headers.map(function (h) {
      var key = h == null ? "" : String(h);
      if (!(key in seen)) {
        seen[key] = 0;
        return key;
      }
      seen[key] += 1;
      return key + "." + seen[key];
    });
  }

  function findCol(headers) {
    var cands = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < cands.length; i++) {
      if (headers.indexOf(cands[i]) !== -1) return cands[i];
    }
    var normMap = {};
    headers.forEach(function (h) { normMap[h] = normWs(h); });
    for (var j = 0; j < cands.length; j++) {
      var target = normWs(cands[j]);
      for (var k = 0; k < headers.length; k++) {
        if (normMap[headers[k]] === target) return headers[k];
      }
    }
    return null;
  }

  function safeFloat(v) {
    if (v == null) return null;
    var s = String(v).trim();
    if (isNaToken(s)) return null;
    var n = parseFloat(s.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  }

  function safeStr(v) {
    if (v == null) return "";
    var s = String(v).trim();
    if (isNaToken(s)) return "";
    return s;
  }

  function parseDateParts(v) {
    if (v == null) return null;
    var s = String(v).trim();
    if (isNaToken(s)) return null;
    s = s.slice(0, 9).trim();
    var m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2})$/);
    if (!m) return null;
    var day = parseInt(m[1], 10);
    var mon = MONTHS[m[2].toLowerCase()];
    if (mon == null) return null;
    var year = 2000 + parseInt(m[3], 10);
    var d = new Date(Date.UTC(year, mon, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== mon || d.getUTCDate() !== day) return null;
    return { day: day, mon: mon, year: year };
  }

  function fmtShortDate(v) {
    var p = parseDateParts(v);
    if (!p) return null;
    var dd = String(p.day).padStart(2, "0");
    var yy = String(p.year % 100).padStart(2, "0");
    return dd + " " + MON_NAMES[p.mon] + " " + yy;
  }

  function parseDateIso(v) {
    var p = parseDateParts(v);
    if (!p) return null;
    var mm = String(p.mon + 1).padStart(2, "0");
    var dd = String(p.day).padStart(2, "0");
    return p.year + "-" + mm + "-" + dd;
  }

  // rows: array of plain objects keyed by (deduped) header name.
  // headers: the deduped header array (defines which columns exist).
  function buildSummary(rows, headers) {
    var COL = {
      alertPoo: findCol(headers, "Alert\nPOO"),
      alertSailing: findCol(headers, "Alert Sailling"),
      alertYard: findCol(headers, "Alert Yard"),
      agingPoo: findCol(headers, "Aging POO"),
      agingSailing: findCol(headers, "Aging Sailing"),
      agingYard: findCol(headers, "Aging Yard"),
      countdaySailing: findCol(headers, "Count Day \nSailling", "Count Day\nSailling", "Count Day \n Sailling"),
      rataPoo: findCol(headers, "Rata-rata POO"),
      rataSailing: findCol(headers, "Rata-rata Sailling"),
      rataYard: findCol(headers, "Rata-rata Yard"),
      container: findCol(headers, "Container Number"),
      noCont: findCol(headers, "No Cont"),
      vendor: findCol(headers, "Vendor"),
      pelayaran: findCol(headers, "Pelayaran"),
      vessel: findCol(headers, "Vessel"),
      checkout: findCol(headers, "Checkout"),
      atd: findCol(headers, "ATD"),
      ata: findCol(headers, "ATA"),
      dooring: findCol(headers, "Dooring"),
      etd: findCol(headers, "ETD"),
      eta: findCol(headers, "ETA"),
      dateStuffing: findCol(headers, "Date Stuffing"),
      type: findCol(headers, "TYPE", "Type"),
      position: findCol(headers, "Position"),
      noSi: findCol(headers, "No SI"),
      port: findCol(headers, "Port"),
      tujuan: findCol(headers, "Tujuan"),
    };
    COL.targetSla2 = headers.indexOf("Target SLA.1") !== -1 ? "Target SLA.1" : findCol(headers, "Target SLA");

    var STAGES = [
      { key: "POO", posValue: "POO", alertCol: COL.alertPoo, avgCol: COL.rataPoo, dateCol: COL.checkout },
      { key: "Sailing", posValue: "On Sailling", alertCol: COL.alertSailing, avgCol: COL.rataSailing, dateCol: COL.atd },
      { key: "Yard", posValue: "Yard", alertCol: COL.alertYard, avgCol: COL.rataYard, dateCol: COL.ata },
      { key: "Dooring", posValue: "Dooring", alertCol: null, avgCol: COL.rataYard, dateCol: COL.dooring },
    ];

    var totalAll = rows.length;
    var totalDelivered = 0;
    var buckets = { POO: [], Sailing: [], Yard: [], Dooring: [] };
    var posToStage = { POO: "POO", "On Sailling": "Sailing", Yard: "Yard", Dooring: "Dooring" };

    rows.forEach(function (r) {
      var pos = safeStr(r[COL.position]);
      if (pos === "Delivered") { totalDelivered++; return; }
      var stageKey = posToStage[pos];
      if (stageKey) buckets[stageKey].push(r);
    });

    var activeRows = [];

    STAGES.forEach(function (stageCfg) {
      var stageKey = stageCfg.key;
      buckets[stageKey].forEach(function (r) {
        var agingPoo = COL.agingPoo ? safeFloat(r[COL.agingPoo]) : null;
        var agingSailingColVal = COL.agingSailing ? safeFloat(r[COL.agingSailing]) : null;
        var countdaySailingVal = COL.countdaySailing ? safeFloat(r[COL.countdaySailing]) : null;
        var agingSailing;
        if (stageKey === "Sailing") {
          agingSailing = countdaySailingVal != null ? countdaySailingVal : agingSailingColVal;
        } else {
          agingSailing = agingSailingColVal != null ? agingSailingColVal : countdaySailingVal;
        }
        var agingYard = COL.agingYard ? safeFloat(r[COL.agingYard]) : null;

        var ownAgingMap = { POO: agingPoo, Sailing: agingSailing, Yard: agingYard, Dooring: agingYard };
        var ownAging = ownAgingMap[stageKey];
        var avg = stageCfg.avgCol ? safeFloat(r[stageCfg.avgCol]) : null;
        var over = (ownAging != null && avg != null) ? (ownAging - avg) : null;

        var alert = stageCfg.alertCol ? safeStr(r[stageCfg.alertCol]) : "";
        var isRisky = !!alert && (RISKY_ALERTS[stageKey] || []).indexOf(alert) !== -1;

        var dateKey = stageCfg.dateCol ? parseDateIso(r[stageCfg.dateCol]) : null;

        var ctypeRaw = COL.type ? safeStr(r[COL.type]) : "";
        var ctype;
        if (ctypeRaw.indexOf("20") !== -1) ctype = "20";
        else if (ctypeRaw.indexOf("40") !== -1) ctype = "40";
        else ctype = ctypeRaw;

        var row = {
          si: safeStr(r[COL.noSi]),
          pt: safeStr(r[COL.port]),
          sg: stageKey,
          tj: safeStr(r[COL.tujuan]),
          vd: safeStr(r[COL.vendor]),
          pl: safeStr(r[COL.pelayaran]),
          vs: safeStr(r[COL.vessel]),
          cn: safeStr(r[COL.container]) || safeStr(r[COL.noCont]),
          tp: ctype,
          al: alert,
          rk: isRisky ? 1 : 0,
          sv: SEVERITY_ORDER[alert] != null ? SEVERITY_ORDER[alert] : 9,
          ag: ownAging,
          ap: agingPoo,
          as_: agingSailing,
          ay: agingYard,
          ov: over,
          dk: dateKey,
          co: COL.checkout ? fmtShortDate(r[COL.checkout]) : null,
          etd: COL.etd ? fmtShortDate(r[COL.etd]) : null,
          eta: COL.eta ? fmtShortDate(r[COL.eta]) : null,
          atd: COL.atd ? fmtShortDate(r[COL.atd]) : null,
          sla: COL.targetSla2 ? safeStr(r[COL.targetSla2]) : "",
          ds: COL.dateStuffing ? fmtShortDate(r[COL.dateStuffing]) : null,
          dsi: COL.dateStuffing ? parseDateIso(r[COL.dateStuffing]) : null,
        };
        var cleaned = {};
        Object.keys(row).forEach(function (k) {
          var v = row[k];
          if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
        });
        activeRows.push(cleaned);
      });
    });

    return {
      total_all: totalAll,
      total_delivered: totalDelivered,
      active_rows: activeRows,
      updatedAt: new Date().toISOString(),
    };
  }

  function csvTextToSummary(csvText) {
    var parsed = Papa.parse(csvText, { skipEmptyLines: true });
    if (!parsed.data || !parsed.data.length) {
      return { total_all: 0, total_delivered: 0, active_rows: [], updatedAt: new Date().toISOString() };
    }
    var headers = dedupeHeaders(parsed.data[0]);
    var rows = parsed.data.slice(1).map(function (arr) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = arr[i]; });
      return obj;
    });
    return buildSummary(rows, headers);
  }

  global.DashboardETL = {
    csvTextToSummary: csvTextToSummary,
    buildSummary: buildSummary,
    dedupeHeaders: dedupeHeaders,
    findCol: findCol,
  };
})(typeof window !== "undefined" ? window : global);
