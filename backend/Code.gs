// Función de normalización compartida para todos los tipos de datos
function normalizeHeader(h) {
  if (!h) return "";
  var low = String(h).trim().toLowerCase();

  if (low.includes("supervisor")) return "supervisor";
  if (low.includes("técnico") || low.includes("tecnico")) {
    if (low.includes("id") || low.includes("cedula") || low.includes("tarjeta"))
      return "tech_id";
    return "tech";
  }
  if (low.includes("ticket") || low.includes("trabajo")) return "ticket";
  if (low === "estado" || low === "status") return "status";
  if (low === "sector" || low === "zona") return "sector";
  if (low === "prioridad" || low === "priority") return "priority";

  return h.toString().trim();
}

function doGet(e) {
  var type = e.parameter.type || "tickets";
  var ss = SpreadsheetApp.openByUrl(
    "https://docs.google.com/spreadsheets/d/1NTBF8C9W3kkfBQbIe56OkwdjwYmO5m6ew2_auP4kQ-s/edit",
  );

  if (type === "inspectors") {
    var sheet = ss.getSheetByName("Inspectores");
    if (!sheet) {
      sheet = ss.insertSheet("Inspectores");
      sheet.appendRow([
        "id",
        "nombre",
        "usuario",
        "password",
        "sector",
        "estado",
        "rol",
        "correo_recuperacion",
      ]);
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j];
      }
      results.push(obj);
    }
    return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } else if (type === "config") {
    var sheet = ss.getSheetByName("Config");
    if (!sheet)
      return ContentService.createTextOutput("{}").setMimeType(
        ContentService.MimeType.JSON,
      );
    var data = sheet.getDataRange().getValues();
    var config = {};
    for (var i = 1; i < data.length; i++) {
      config[data[i][0]] = data[i][1];
    }
    return ContentService.createTextOutput(JSON.stringify(config)).setMimeType(
      ContentService.MimeType.JSON,
    );
  }

  // Lógica para Tickets, Calidad, Ordenes y Razones
  var sheetName = "";
  if (type === "tickets") sheetName = "Tickets";
  else if (type === "calidad") {
    var sheets = ss.getSheets();
    var sheet = sheets.find((s) => s.getSheetId() == 1724783398);
    if (sheet) sheetName = sheet.getName();
  }
  else if (type === "razones") {
    var sheets = ss.getSheets();
    var sheet = sheets.find((s) => s.getSheetId() == 761213977);
    if (sheet) sheetName = sheet.getName();
  }

  var targetSheet;
  if (type === "ordenes") {
    try {
      var ssOrdenes = SpreadsheetApp.openById(
        "1NTBF8C9W3kkfBQbIe56OkwdjwYmO5m6ew2_auP4kQ-s",
      );
      targetSheet =
        ssOrdenes.getSheets().find((s) => s.getSheetId() == 885138959) ||
        ssOrdenes.getSheetByName("Ordenes");
    } catch (e) {
      targetSheet = ss.getSheetByName("Ordenes");
    }
  } else if (sheetName) {
    targetSheet = ss.getSheetByName(sheetName);
  }

  if (!targetSheet)
    return ContentService.createTextOutput("[]").setMimeType(
      ContentService.MimeType.JSON,
    );

  var data = targetSheet.getDataRange().getValues();
  if (data.length <= 1)
    return ContentService.createTextOutput("[]").setMimeType(
      ContentService.MimeType.JSON,
    );

  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = normalizeHeader(headers[j]);
      if (key) obj[key] = row[j];
    }
    results.push(obj);
  }
  return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    var ss = SpreadsheetApp.openByUrl(
      "https://docs.google.com/spreadsheets/d/1NTBF8C9W3kkfBQbIe56OkwdjwYmO5m6ew2_auP4kQ-s/edit",
    );

    if (action === "update_status") {
      var sheet = ss.getSheetByName("Tickets");
      var data = sheet.getDataRange().getValues();
      var idColIndex = data[0].indexOf("id");
      var ticketColIndex = data[0].indexOf("ticket");
      for (var i = 1; i < data.length; i++) {
        if (
          (idColIndex > -1 && data[i][idColIndex] == params.id) ||
          (ticketColIndex > -1 && data[i][ticketColIndex] == params.id)
        ) {
          var statusColIndex = data[0].indexOf("status");
          var remarksColIndex = data[0].indexOf("remarks");
          var rootCauseColIndex = data[0].indexOf("rootCause");

          if (statusColIndex > -1)
            sheet.getRange(i + 1, statusColIndex + 1).setValue(params.status);
          if (remarksColIndex > -1)
            sheet.getRange(i + 1, remarksColIndex + 1).setValue(params.remarks);
          if (rootCauseColIndex > -1)
            sheet
              .getRange(i + 1, rootCauseColIndex + 1)
              .setValue(params.rootCause);

          // Manejo de Imágenes (Si existen)
          if (params.images && params.images.length > 0) {
            var evidenceColIndex = data[0].indexOf("evidence");
            if (evidenceColIndex === -1) {
              var headers = data[0];
              headers.push("evidence");
              sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
              evidenceColIndex = headers.length - 1;
            }
            try {
              var imageUrls = saveImages(params.images, params.id);
              if (imageUrls) {
                sheet.getRange(i + 1, evidenceColIndex + 1).setValue(imageUrls);
              }
            } catch (imageErr) {
              Logger.log(
                "Error saving images for ticket " +
                  params.id +
                  ": " +
                  imageErr.message,
              );
            }
          }

          return ContentService.createTextOutput(
            JSON.stringify({ status: "success" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Ticket no encontrado" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "assign_ticket") {
      var sheet = ss.getSheetByName("Tickets");
      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      var inspectorIdCol = headers.indexOf("inspector_id");
      var inspectorCol = headers.indexOf("inspector");
      var needsHeaderUpdate = false;
      if (inspectorIdCol === -1) {
        headers.push("inspector_id");
        inspectorIdCol = headers.length - 1;
        needsHeaderUpdate = true;
      }
      if (inspectorCol === -1) {
        headers.push("inspector");
        inspectorCol = headers.length - 1;
        needsHeaderUpdate = true;
      }
      if (needsHeaderUpdate) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        data = sheet.getDataRange().getValues();
      }

      var idColIndex = headers.indexOf("id");
      var ticketColIndex = headers.indexOf("ticket");
      var statusCol = headers.indexOf("status");

      for (var i = 1; i < data.length; i++) {
        if (
          (idColIndex > -1 && data[i][idColIndex] == params.id) ||
          (ticketColIndex > -1 && data[i][ticketColIndex] == params.id)
        ) {
          sheet.getRange(i + 1, inspectorIdCol + 1).setValue(params.tech_id);
          sheet.getRange(i + 1, inspectorCol + 1).setValue(params.tech_name);
          if (statusCol > -1)
            sheet.getRange(i + 1, statusCol + 1).setValue("Asignado");

          return ContentService.createTextOutput(
            JSON.stringify({ status: "success" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Ticket no encontrado" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "assign_tickets_by_supervisor") {
      var sheet = ss.getSheetByName("Tickets");
      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      var inspectorIdCol = headers.indexOf("inspector_id");
      var inspectorCol = headers.indexOf("inspector");
      var needsHeaderUpdate = false;
      if (inspectorIdCol === -1) {
        headers.push("inspector_id");
        inspectorIdCol = headers.length - 1;
        needsHeaderUpdate = true;
      }
      if (inspectorCol === -1) {
        headers.push("inspector");
        inspectorCol = headers.length - 1;
        needsHeaderUpdate = true;
      }
      if (needsHeaderUpdate) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        data = sheet.getDataRange().getValues();
      }

      // Busca la columna supervisor con nombre flexible
      var supervisorCol = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = String(headers[j]).trim().toLowerCase();
        if (
          h === "nombre supervisor" ||
          h === "supervisor" ||
          h === "nombre del supervisor"
        ) {
          supervisorCol = j;
          break;
        }
      }
      var statusCol = headers.indexOf("status");

      if (supervisorCol === -1) {
        return ContentService.createTextOutput(
          JSON.stringify({
            status: "error",
            message:
              "Columna NOMBRE SUPERVISOR no encontrada. Columnas: " +
              headers.join(","),
          }),
        ).setMimeType(ContentService.MimeType.JSON);
      }

      var updatedCount = 0;
      for (var i = 1; i < data.length; i++) {
        if (
          data[i][supervisorCol] == params.supervisor &&
          data[i][statusCol] == "Pendiente"
        ) {
          sheet.getRange(i + 1, inspectorIdCol + 1).setValue(params.tech_id);
          sheet.getRange(i + 1, inspectorCol + 1).setValue(params.tech_name);
          if (statusCol > -1)
            sheet.getRange(i + 1, statusCol + 1).setValue("Asignado");
          updatedCount++;
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", updated: updatedCount }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (
      action === "assign_razones_by_supervisor" ||
      action === "assign_razon_individual"
    ) {
      var ssTarget = SpreadsheetApp.openByUrl(
        "https://docs.google.com/spreadsheets/d/1NTBF8C9W3kkfBQbIe56OkwdjwYmO5m6ew2_auP4kQ-s/edit",
      );
      var sheets = ssTarget.getSheets();
      var sheet = null;
      for (var k = 0; k < sheets.length; k++) {
        if (sheets[k].getSheetId() == 761213977) {
          sheet = sheets[k];
          break;
        }
      }

      if (!sheet)
        return ContentService.createTextOutput(
          JSON.stringify({
            status: "error",
            message: "Hoja de razones no encontrada",
          }),
        ).setMimeType(ContentService.MimeType.JSON);

      var data = sheet.getDataRange().getValues();
      var headers = data[0];

      var inspectorIdCol = headers.indexOf("Inspector ID");
      var inspectorNameCol = headers.indexOf("Nombre del Inspector");
      var needsHeaderUpdate = false;
      if (inspectorIdCol === -1) {
        headers.push("Inspector ID");
        inspectorIdCol = headers.length - 1;
        needsHeaderUpdate = true;
      }
      if (inspectorNameCol === -1) {
        headers.push("Nombre del Inspector");
        inspectorNameCol = headers.length - 1;
        needsHeaderUpdate = true;
      }
      if (needsHeaderUpdate) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        data = sheet.getDataRange().getValues();
      }

      var supervisorCol = headers.indexOf("Nombre del Supervisor");
      var casosCol = headers.indexOf("Casos");

      if (action === "assign_razones_by_supervisor") {
        var updatedCount = 0;
        for (var i = 1; i < data.length; i++) {
          if (data[i][supervisorCol] == params.supervisor) {
            sheet.getRange(i + 1, inspectorIdCol + 1).setValue(params.tech_id);
            sheet
              .getRange(i + 1, inspectorNameCol + 1)
              .setValue(params.tech_name);
            updatedCount++;
          }
        }
        return ContentService.createTextOutput(
          JSON.stringify({ status: "success", updated: updatedCount }),
        ).setMimeType(ContentService.MimeType.JSON);
      } else if (action === "assign_razon_individual") {
        for (var i = 1; i < data.length; i++) {
          if (data[i][casosCol] == params.caso) {
            sheet.getRange(i + 1, inspectorIdCol + 1).setValue(params.tech_id);
            sheet
              .getRange(i + 1, inspectorNameCol + 1)
              .setValue(params.tech_name);
            return ContentService.createTextOutput(
              JSON.stringify({ status: "success" }),
            ).setMimeType(ContentService.MimeType.JSON);
          }
        }
        return ContentService.createTextOutput(
          JSON.stringify({ status: "error", message: "Caso no encontrado" }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (
      action === "assign_calidad_by_supervisor" ||
      action === "assign_calidad_individual"
    ) {
      try {
        var sheet = null;
        var sheets = ss.getSheets();
        for (var k = 0; k < sheets.length; k++) {
          if (sheets[k].getSheetId() == 1724783398) {
            sheet = sheets[k];
            break;
          }
        }

        if (!sheet)
          return ContentService.createTextOutput(
            JSON.stringify({
              status: "error",
              message: "Hoja de calidad no encontrada",
            }),
          ).setMimeType(ContentService.MimeType.JSON);

        var data = sheet.getDataRange().getValues();
        var headers = data[0];

        var inspectorIdCol = headers.indexOf("Inspector ID");
        var inspectorNameCol = headers.indexOf("Inspector");
        var needsHeaderUpdate = false;
        if (inspectorIdCol === -1) {
          headers.push("Inspector ID");
          inspectorIdCol = headers.length - 1;
          needsHeaderUpdate = true;
        }
        if (inspectorNameCol === -1) {
          headers.push("Inspector");
          inspectorNameCol = headers.length - 1;
          needsHeaderUpdate = true;
        }
        if (needsHeaderUpdate) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          data = sheet.getDataRange().getValues();
        }

        // Helper to normalize strings
        var normalize = function (str) {
          if (!str) return "";
          var s = String(str).toLowerCase().trim();
          try {
            s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          } catch (e) {
            // Fallback if normalize is not supported
            s = s
              .replace(/[áàäâ]/g, "a")
              .replace(/[éèëê]/g, "e")
              .replace(/[íìïî]/g, "i")
              .replace(/[óòöô]/g, "o")
              .replace(/[úùüû]/g, "u")
              .replace(/ñ/g, "n");
          }
          return s;
        };

        var supervisorCol = -1;
        var techCol = -1;

        for (var j = 0; j < headers.length; j++) {
          var h = normalize(headers[j]);
          if (
            h === "supervisor" ||
            h === "nombre del supervisor" ||
            h === "nombre supervisor" ||
            (h.includes("supervisor") && !h.includes("tarjeta"))
          ) {
            supervisorCol = j;
          }
          if (h === "tecnico" || h === "nombre del tecnico" || h === "nombre") {
            techCol = j;
          }
        }

        if (action === "assign_calidad_by_supervisor") {
          var updatedCount = 0;
          var targetSup = normalize(params.supervisor);

          if (supervisorCol === -1)
            return ContentService.createTextOutput(
              JSON.stringify({
                status: "error",
                message:
                  "Columna Supervisor no encontrada. Encabezados: " +
                  headers.join(","),
              }),
            ).setMimeType(ContentService.MimeType.JSON);

          for (var i = 1; i < data.length; i++) {
            var rowSup = normalize(data[i][supervisorCol]);
            if (rowSup === targetSup) {
              sheet
                .getRange(i + 1, inspectorIdCol + 1)
                .setValue(params.tech_id);
              sheet
                .getRange(i + 1, inspectorNameCol + 1)
                .setValue(params.tech_name);
              updatedCount++;
            }
          }
          if (updatedCount === 0) {
            var sample = [];
            for (var m = 1; m < Math.min(data.length, 5); m++)
              sample.push(data[m][supervisorCol]);
            return ContentService.createTextOutput(
              JSON.stringify({
                status: "error",
                message:
                  "0 técnicos encontrados para " +
                  params.supervisor +
                  ". Muestras: " +
                  sample.join(","),
              }),
            ).setMimeType(ContentService.MimeType.JSON);
          }
          return ContentService.createTextOutput(
            JSON.stringify({ status: "success", updated: updatedCount }),
          ).setMimeType(ContentService.MimeType.JSON);
        } else if (action === "assign_calidad_individual") {
          var targetTech = normalize(params.technician);

          if (techCol === -1)
            return ContentService.createTextOutput(
              JSON.stringify({
                status: "error",
                message: "Columna Técnico no encontrada",
              }),
            ).setMimeType(ContentService.MimeType.JSON);

          for (var i = 1; i < data.length; i++) {
            var rowTech = normalize(data[i][techCol]);
            if (rowTech === targetTech) {
              sheet
                .getRange(i + 1, inspectorIdCol + 1)
                .setValue(params.tech_id);
              sheet
                .getRange(i + 1, inspectorNameCol + 1)
                .setValue(params.tech_name);
              return ContentService.createTextOutput(
                JSON.stringify({ status: "success" }),
              ).setMimeType(ContentService.MimeType.JSON);
            }
          }
          return ContentService.createTextOutput(
            JSON.stringify({
              status: "error",
              message: "Técnico no encontrado: " + params.technician,
            }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(
          JSON.stringify({
            status: "error",
            message: "Error interno: " + err.toString(),
          }),
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === "add_inspector") {
      var sheet = ss.getSheetByName("Inspectores");
      if (!sheet) {
        sheet = ss.insertSheet("Inspectores");
        sheet.appendRow([
          "id",
          "nombre",
          "usuario",
          "password",
          "sector",
          "estado",
          "rol",
          "correo_recuperacion",
        ]);
      }
      var headers = sheet
        .getRange(1, 1, 1, sheet.getLastColumn())
        .getValues()[0];
      var id = new Date().getTime().toString().slice(-6);
      var newRow = new Array(headers.length).fill("");

      newRow[headers.indexOf("id")] = id;
      if (headers.indexOf("nombre") > -1)
        newRow[headers.indexOf("nombre")] = params.nombre || "";
      if (headers.indexOf("usuario") > -1)
        newRow[headers.indexOf("usuario")] = params.usuario || "";
      if (headers.indexOf("password") > -1)
        newRow[headers.indexOf("password")] = params.password || "";
      if (headers.indexOf("sector") > -1)
        newRow[headers.indexOf("sector")] = params.sector || "";
      if (headers.indexOf("estado") > -1)
        newRow[headers.indexOf("estado")] = params.estado || "Activo";
      if (headers.indexOf("rol") > -1)
        newRow[headers.indexOf("rol")] = params.rol || "Inspector";
      if (headers.indexOf("correo_recuperacion") > -1)
        newRow[headers.indexOf("correo_recuperacion")] =
          params.correo_recuperacion || "";

      sheet.appendRow(newRow);
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", id: id }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "update_inspector") {
      var sheet = ss.getSheetByName("Inspectores");
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var idCol = headers.indexOf("id");

      for (var i = 1; i < data.length; i++) {
        if (data[i][idCol] == params.id) {
          if (params.nombre && headers.indexOf("nombre") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("nombre") + 1)
              .setValue(params.nombre);
          if (params.usuario && headers.indexOf("usuario") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("usuario") + 1)
              .setValue(params.usuario);
          if (params.password && headers.indexOf("password") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("password") + 1)
              .setValue(params.password);
          if (params.sector && headers.indexOf("sector") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("sector") + 1)
              .setValue(params.sector);
          if (params.estado && headers.indexOf("estado") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("estado") + 1)
              .setValue(params.estado);
          if (params.rol && headers.indexOf("rol") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("rol") + 1)
              .setValue(params.rol);
          if (
            params.correo_recuperacion &&
            headers.indexOf("correo_recuperacion") > -1
          )
            sheet
              .getRange(i + 1, headers.indexOf("correo_recuperacion") + 1)
              .setValue(params.correo_recuperacion);

          return ContentService.createTextOutput(
            JSON.stringify({ status: "success" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Inspector no encontrado" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "delete_inspector") {
      var sheet = ss.getSheetByName("Inspectores");
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var idCol = headers.indexOf("id");

      for (var i = 1; i < data.length; i++) {
        if (data[i][idCol] == params.id) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(
            JSON.stringify({ status: "success" }),
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", message: "Inspector no encontrado" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "auto_assign") {
      var ticketSheet = ss.getSheetByName("Tickets");
      var inspectorSheet = ss.getSheetByName("Inspectores");
      if (!ticketSheet || !inspectorSheet)
        return ContentService.createTextOutput(
          JSON.stringify({ status: "error" }),
        ).setMimeType(ContentService.MimeType.JSON);

      var tData = ticketSheet.getDataRange().getValues();
      var iData = inspectorSheet.getDataRange().getValues();
      if (iData.length <= 1)
        return ContentService.createTextOutput(
          JSON.stringify({ status: "error" }),
        ).setMimeType(ContentService.MimeType.JSON);

      var tHeaders = tData[0];
      var techIdCol = tHeaders.indexOf("tech_id");
      var techCol = tHeaders.indexOf("tech");
      var statusCol = tHeaders.indexOf("status");

      var iHeaders = iData[0];
      var iNameCol = iHeaders.indexOf("nombre");
      var iIdCol = iHeaders.indexOf("id");
      var iEstadoCol = iHeaders.indexOf("estado");

      var loadMap = {};
      var inspectors = [];
      for (var j = 1; j < iData.length; j++) {
        if (iEstadoCol > -1 && iData[j][iEstadoCol] !== "Activo") continue; // Solo activos
        var insp = { name: iData[j][iNameCol], id: iData[j][iIdCol], count: 0 };
        loadMap[insp.id] = insp; // Key by ID instead of name
        inspectors.push(insp);
      }

      for (var i = 1; i < tData.length; i++) {
        var tStatus = tData[i][statusCol];
        var tTechId = tData[i][techIdCol];
        if (tStatus === "Pendiente" && loadMap[tTechId]) {
          loadMap[tTechId].count++;
        }
      }

      var updated = 0;
      for (var i = 1; i < tData.length; i++) {
        var currentTech = tData[i][techIdCol];
        var currentStatus = tData[i][statusCol];
        if (
          currentStatus === "Pendiente" &&
          (!currentTech || currentTech.toString().trim() === "")
        ) {
          var minInspector = null;
          var minCount = 999999;
          for (var k = 0; k < inspectors.length; k++) {
            if (inspectors[k].count < minCount) {
              minCount = inspectors[k].count;
              minInspector = inspectors[k];
            }
          }
          if (minInspector) {
            if (techIdCol > -1)
              ticketSheet
                .getRange(i + 1, techIdCol + 1)
                .setValue(minInspector.id);
            if (techCol > -1)
              ticketSheet
                .getRange(i + 1, techCol + 1)
                .setValue(minInspector.name);
            if (statusCol > -1)
              ticketSheet.getRange(i + 1, statusCol + 1).setValue("Asignado");
            minInspector.count++;
            updated++;
          }
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success", updated: updated }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "update_admin_profile") {
      var sheet = ss.getSheetByName("Config");
      if (!sheet) {
        sheet = ss.insertSheet("Config");
        sheet.appendRow(["param", "value"]);
      }
      var data = sheet.getDataRange().getValues();
      var configKeys = {
        admin_username: params.username,
        admin_password: params.password,
        admin_recovery_email: params.recovery_email,
      };

      for (var key in configKeys) {
        var found = false;
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] == key) {
            sheet.getRange(i + 1, 2).setValue(configKeys[key]);
            found = true;
            break;
          }
        }
        if (!found) {
          sheet.appendRow([key, configKeys[key]]);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: "success" }),
      ).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (globalErr) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: globalErr.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
function saveImages(images, ticketId) {
  if (!images || images.length === 0) return "";
  var folderName = "Evidencias Claro";
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(folderName);

  var links = [];
  for (var i = 0; i < images.length; i++) {
    try {
      var parts = images[i].split(",");
      if (parts.length < 2) continue;
      var base64Data = parts[1];
      var contentType = parts[0].split(";")[0].split(":")[1];
      var extension = contentType.split("/")[1] || "jpg";

      var blob = Utilities.newBlob(
        Utilities.base64Decode(base64Data),
        contentType,
        "Ticket_" + ticketId + "_" + i + "." + extension,
      );
      var file = folder.createFile(blob);
      file.setSharing(
        DriveApp.Access.ANYONE_WITH_LINK,
        DriveApp.Permission.VIEW,
      );
      links.push(file.getUrl());
    } catch (e) {
      Logger.log("Error saving image: " + e.message);
    }
  }
  return links.join(", ");
}
