// Helper to normalize strings and remove accents
function normalizeString(str) {
  if (!str) return "";
  var s = String(str).toLowerCase().trim();
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (e) {
    s = s
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u")
      .replace(/ñ/g, "n");
  }
  return s;
}

// Función de normalización compartida para todos los tipos de datos
function normalizeHeader(h) {
  if (!h) return "";
  var low = normalizeString(h);

  // Mappings para IDs de trabajo (Ticket / Trabajo / Orden / IDD)
  // NOTA: "work name" NO está aquí porque contiene descripciones como "Reparacion Internet",
  //        no el ID numérico. Se mapea a "tipo_trabajo" más abajo.
  if (low === "trabajo" || low === "idd" || low === "nro trabajo" || low === "id trabajo" || low === "id_trabajo" || low === "job id" || low === "nro orden" || low === "numero de orden" || low === "nro de orden" || low === "nro_orden" || low === "ticket" || low === "id ticket" || low === "nro ticket" || low === "id_ticket") return "ticket";
  
  // Descripción / tipo del trabajo (NO es el ID numérico)
  if (low === "work name" || low === "tipo trabajo" || low === "tipo de trabajo" || low === "descripcion trabajo" || low === "descripcion") return "tipo_trabajo";
  
  // Mappings para Orden de Servicio específica
  if (low === "orden servicio" || low === "orden de servicio" || low === "orden_servicio" || low === "os" || low === "id orden" || low === "orden externa") return "orden_servicio";
  
  // Datos del Cliente y Reporte
  if (low === "cliente" || low === "nombre cliente" || low === "nombre_cliente" || low === "subscriber") return "cliente";
  if (low === "fecha" || low === "fecha reporte" || low === "fecha_creacion" || low === "vence" || low === "oe vencimiento") return "fecha";
  // Tecnología de red (NO incluir "tech" aquí, es ambiguo y choca con nombre técnico)
  if (low === "tecnologia" || low === "tipo red" || low === "tipo_red" || low === "red" || low === "servicio") return "tecnologia";
  if (low === "sector" || low === "zona" || low === "barrio" || low === "region" || low === "municipio" || low === "ciudad") return "sector";
  if (low === "terminal" || low === "id terminal" || low === "fat" || low === "caja") return "terminal";
  
  // Personal (Supervisor / Técnico)
  if (low.includes("supervisor") && !low.includes("id") && !low.includes("tarjeta")) return "supervisor";
  if (low.includes("supervisor") && (low.includes("id") || low.includes("tarjeta"))) return "supervisor_id";
  
  // "tecnico" solo (sin "nombre") = ID/cédula del técnico → tech_id
  // "nombre tecnico" o "asignado a" = nombre del técnico → tech
  if (low === "nombre tecnico" || low === "nombre_tecnico" || low === "asignado a" || low === "asignado_a" || low === "tech_name" || low === "tech") return "tech";
  if (low === "tecnico" || low === "cedula" || low === "cedula tecnico" || low.includes("id tecnico") || low.includes("tarjeta tecnico") || low.includes("tech_id") || low === "tarjeta") return "tech_id";
  
  // Estado y Prioridad (Clave para Tickets y Calidad)
  if (low === "estado" || low === "status" || low === "estado_orden" || low === "estado inspeccion" || low === "estado_inspeccion") return "status";
  if (low === "prioridad" || low === "priority" || low === "tipo de prioridad" || low === "clasificacion prioridad") return "priority";
  
  // Otros
  if (low === "codigo aplicado" || low === "codigo_aplicado" || low === "manual_code" || low === "codigo_razon") return "codigo_aplicado";
  if (low === "inspector" || low === "inspector_nombre" || low === "nombre inspector") return "inspector";
  if (low === "inspector id" || low === "inspector_id" || low === "tarjeta inspector") return "inspector_id";

  // Si no coincide con nada, devolver snake_case minúscula
  return low.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function getTargetSheetByType(ss, type) {
  var sheets = ss.getSheets();
  
  function findSheet(names, gid) {
    // 1. Try by GID if provided
    if (gid) {
      var s = sheets.find(s => s.getSheetId() == gid);
      if (s) return s;
    }
    // 2. Try by exact name
    for (var n of names) {
      var s = ss.getSheetByName(n);
      if (s) return s;
    }
    // 3. Try by normalized name (case-insensitive, trimmed)
    var normalizedNames = names.map(n => normalizeString(n));
    return sheets.find(s => {
      var sName = normalizeString(s.getName());
      return normalizedNames.includes(sName);
    });
  }

  if (type === "tickets") return findSheet(["Tickets", "Averias", "Base", "Tickets_Base"]);
  if (type === "calidad") return findSheet(["Calidad", "Averias Repetidas", "Repetidas", "Base Calidad"], 1724783398);
  if (type === "inspectores") return findSheet(["Inspectores", "Usuarios", "Personal", "Inspectores_Base"]);
  if (type === "razones") return findSheet(["Razones", "Codigo Razon Cliente", "Razones_Base"], 761213977);
  if (type === "ordenes") return findSheet(["Ordenes", "Ordenes de Servicio", "Trabajos", "OS", "Ordenes_Base"], 885138959);
  
  return null;
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

  var targetSheet = getTargetSheetByType(ss, type);

  if (!targetSheet)
    return ContentService.createTextOutput("[]").setMimeType(
      ContentService.MimeType.JSON,
    );

  var role = e.parameter.role || "admin";
  var data = targetSheet.getDataRange().getValues();
  if (data.length <= 1)
    return ContentService.createTextOutput("[]").setMimeType(
      ContentService.MimeType.JSON,
    );

  var headers = data[0];
  var results = [];
  
  // Encontrar columnas para filtrado 24h
  var estadoCol = -1;
  var fechaCol = -1;
  for (var j = 0; j < headers.length; j++) {
    var h = normalizeString(headers[j]);
    if (h === "estado inspeccion" || h === "estado" || h === "status") estadoCol = j;
    if (h === "fecha inspeccion") fechaCol = j;
  }

  var now = new Date();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    // Filtrado 24h para Inspectores
    if (role === "inspector" && estadoCol > -1 && fechaCol > -1) {
      var status = String(row[estadoCol]).toLowerCase();
      if (status === "completado" || status === "inspeccionado") {
        var fechaInspeccion = new Date(row[fechaCol]);
        if (!isNaN(fechaInspeccion.getTime())) {
          var diffHours = (now - fechaInspeccion) / (1000 * 60 * 60);
          if (diffHours > 24) continue; // Ocultar después de 24h
        }
      }
    }

    var obj = {};
    var trabajoValue = null; // Guardar valor exacto de columna TRABAJO
    for (var j = 0; j < headers.length; j++) {
      var rawHeader = String(headers[j] || '').trim();
      var key = normalizeHeader(rawHeader);
      if (!key) continue;

      // La columna "TRABAJO" tiene prioridad absoluta para la clave "ticket"
      // (evita que columnas posteriores como IDD la sobreescriban)
      if (normalizeString(rawHeader) === 'trabajo') {
        trabajoValue = row[j];
        obj['ticket'] = row[j];
      } else if (key === 'ticket') {
        // Solo asignar si TRABAJO aún no ha sido encontrado
        if (trabajoValue === null) obj['ticket'] = row[j];
      } else {
        obj[key] = row[j];
      }
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
        var h = normalizeString(headers[j]);
        if (
          h === "nombre supervisor" ||
          h === "supervisor" ||
          h === "nombre del supervisor" ||
          (h.includes("supervisor") && !h.includes("tarjeta"))
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
      var targetSup = normalizeString(params.supervisor);
      for (var i = 1; i < data.length; i++) {
        var rowSup = normalizeString(data[i][supervisorCol]);
        if (
          rowSup === targetSup &&
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

      var supervisorCol = -1;
      var casosCol = -1;
      for (var j = 0; j < headers.length; j++) {
        var h = normalizeString(headers[j]);
        if (h === "nombre del supervisor" || h === "supervisor" || h === "nombre supervisor" || (h.includes("supervisor") && !h.includes("tarjeta"))) {
          supervisorCol = j;
        }
        if (h === "casos" || h === "caso") {
          casosCol = j;
        }
      }

      if (action === "assign_razones_by_supervisor") {
        var updatedCount = 0;
        var targetSup = normalizeString(params.supervisor);
        for (var i = 1; i < data.length; i++) {
          var rowSup = normalizeString(data[i][supervisorCol]);
          if (rowSup === targetSup) {
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

    if (action === "save_manual_code") {
      var type = params.type || "calidad";
      var sheet = getTargetSheetByType(ss, type);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Hoja no encontrada" })).setMimeType(ContentService.MimeType.JSON);

      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var ticketCol = -1;
      var codigoCol = -1;
      var estadoCol = -1;
      var fechaCol = -1;
      
      for (var j = 0; j < headers.length; j++) {
        var h = normalizeString(headers[j]);
        if (h === "trabajo" || h === "ticket" || h === "orden servicio") ticketCol = j;
        if (h === "codigo aplicado") codigoCol = j;
        if (h === "estado inspeccion" || h === "estado") estadoCol = j;
        if (h === "fecha inspeccion") fechaCol = j;
      }
      
      if (ticketCol === -1) return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Columna de identificación no encontrada" })).setMimeType(ContentService.MimeType.JSON);
      
      var needsUpdate = false;
      if (codigoCol === -1) { headers.push("Código Aplicado"); codigoCol = headers.length - 1; needsUpdate = true; }
      if (estadoCol === -1) { headers.push("Estado Inspección"); estadoCol = headers.length - 1; needsUpdate = true; }
      if (fechaCol === -1) { headers.push("Fecha Inspección"); fechaCol = headers.length - 1; needsUpdate = true; }
      
      if (needsUpdate) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        data = sheet.getDataRange().getValues();
      }
      
      var targetTicket = String(params.ticket).trim();
      for (var i = 1; i < data.length; i++) {
        var currentTicket = String(data[i][ticketCol]).trim();
        if (currentTicket === targetTicket) {
          if (data[i][codigoCol] && String(data[i][codigoCol]).trim() !== "") {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Este registro ya tiene un código aplicado" })).setMimeType(ContentService.MimeType.JSON);
          }
          sheet.getRange(i + 1, codigoCol + 1).setValue(params.codigo);
          sheet.getRange(i + 1, estadoCol + 1).setValue(type === "tickets" ? "Inspeccionado" : "Completado");
          sheet.getRange(i + 1, fechaCol + 1).setValue(new Date());
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Registro no encontrado" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "cancel_manual_code") {
      var type = params.type || "calidad";
      var sheet = getTargetSheetByType(ss, type);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Hoja no encontrada" })).setMimeType(ContentService.MimeType.JSON);

      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var ticketCol = -1;
      var codigoCol = -1;
      var estadoCol = -1;
      var fechaCol = -1;
      
      for (var j = 0; j < headers.length; j++) {
        var h = normalizeString(headers[j]);
        if (h === "trabajo" || h === "ticket" || h === "orden servicio") ticketCol = j;
        if (h === "codigo aplicado") codigoCol = j;
        if (h === "estado inspeccion" || h === "estado") estadoCol = j;
        if (h === "fecha inspeccion") fechaCol = j;
      }
      
      var targetTicket = String(params.ticket).trim();
      for (var i = 1; i < data.length; i++) {
        var currentTicket = String(data[i][ticketCol]).trim();
        if (currentTicket === targetTicket) {
          if (codigoCol > -1) sheet.getRange(i + 1, codigoCol + 1).clearContent();
          if (estadoCol > -1) sheet.getRange(i + 1, estadoCol + 1).setValue(type === "tickets" ? "Asignado" : "Pendiente");
          if (fechaCol > -1) sheet.getRange(i + 1, fechaCol + 1).clearContent();
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Registro no encontrado" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (
      action === "assign_calidad_by_supervisor" ||
      action === "assign_calidad_individual" ||
      action === "save_calidad_codigo"
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

        if (action === "save_calidad_codigo") {
          var ticketCol = -1;
          var codigoCol = -1;
          var estadoCol = -1;
          var fechaCol = -1;
          
          for (var j = 0; j < headers.length; j++) {
            var h = normalizeString(headers[j]);
            if (h === "trabajo" || h === "ticket") ticketCol = j;
            if (h === "codigo aplicado") codigoCol = j;
            if (h === "estado inspeccion") estadoCol = j;
            if (h === "fecha inspeccion") fechaCol = j;
          }
          
          if (ticketCol === -1) {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Columna Trabajo no encontrada" })).setMimeType(ContentService.MimeType.JSON);
          }
          
          var needsUpdate = false;
          if (codigoCol === -1) { headers.push("Código Aplicado"); codigoCol = headers.length - 1; needsUpdate = true; }
          if (estadoCol === -1) { headers.push("Estado Inspección"); estadoCol = headers.length - 1; needsUpdate = true; }
          if (fechaCol === -1) { headers.push("Fecha Inspección"); fechaCol = headers.length - 1; needsUpdate = true; }
          
          if (needsUpdate) {
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            data = sheet.getDataRange().getValues();
          }
          
          var targetTicket = String(params.ticket).trim();
          for (var i = 1; i < data.length; i++) {
            var currentTicket = String(data[i][ticketCol]).trim();
            if (currentTicket === targetTicket) {
              // Validar que no tenga ya un código
              if (data[i][codigoCol] && String(data[i][codigoCol]).trim() !== "") {
                return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Este ticket ya tiene un código aplicado" })).setMimeType(ContentService.MimeType.JSON);
              }
              sheet.getRange(i + 1, codigoCol + 1).setValue(params.codigo);
              sheet.getRange(i + 1, estadoCol + 1).setValue("Completado");
              sheet.getRange(i + 1, fechaCol + 1).setValue(new Date());
              return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Ticket no encontrado: " + targetTicket })).setMimeType(ContentService.MimeType.JSON);
        }

        if (action === "cancel_calidad_codigo") {
          var ticketCol = -1;
          var codigoCol = -1;
          var estadoCol = -1;
          var fechaCol = -1;
          
          for (var j = 0; j < headers.length; j++) {
            var h = normalizeString(headers[j]);
            if (h === "trabajo" || h === "ticket") ticketCol = j;
            if (h === "codigo aplicado") codigoCol = j;
            if (h === "estado inspeccion") estadoCol = j;
            if (h === "fecha inspeccion") fechaCol = j;
          }
          
          var targetTicket = String(params.ticket).trim();
          for (var i = 1; i < data.length; i++) {
            var currentTicket = String(data[i][ticketCol]).trim();
            if (currentTicket === targetTicket) {
              if (codigoCol > -1) sheet.getRange(i + 1, codigoCol + 1).clearContent();
              if (estadoCol > -1) sheet.getRange(i + 1, estadoCol + 1).setValue("Pendiente");
              if (fechaCol > -1) sheet.getRange(i + 1, fechaCol + 1).clearContent();
              return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Ticket no encontrado" })).setMimeType(ContentService.MimeType.JSON);
        }

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

        var supervisorCol = -1;
        var techCol = -1;

        for (var j = 0; j < headers.length; j++) {
          var h = normalizeString(headers[j]);
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
          var targetSup = normalizeString(params.supervisor);

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
            var rowSup = normalizeString(data[i][supervisorCol]);
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
          var targetTech = normalizeString(params.technician);

          if (techCol === -1)
            return ContentService.createTextOutput(
              JSON.stringify({
                status: "error",
                message: "Columna Técnico no encontrada",
              }),
            ).setMimeType(ContentService.MimeType.JSON);

          for (var i = 1; i < data.length; i++) {
            var rowTech = normalizeString(data[i][techCol]);
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

    // ── Asignación de Órdenes (misma arquitectura que Calidad) ──────────────────
    if (
      action === "assign_ordenes_by_supervisor" ||
      action === "assign_ordenes_individual"
    ) {
      try {
        var ordenSheet = null;
        var allSheets = ss.getSheets();
        for (var k = 0; k < allSheets.length; k++) {
          if (allSheets[k].getSheetId() == 885138959) {
            ordenSheet = allSheets[k];
            break;
          }
        }
        // Fallback por nombre si no encuentra por GID
        if (!ordenSheet) ordenSheet = getTargetSheetByType(ss, "ordenes");

        if (!ordenSheet)
          return ContentService.createTextOutput(
            JSON.stringify({ status: "error", message: "Hoja de Órdenes no encontrada" })
          ).setMimeType(ContentService.MimeType.JSON);

        var ordData = ordenSheet.getDataRange().getValues();
        var ordHeaders = ordData[0];

        // Asegurar columnas Inspector ID e Inspector
        var ordInspIdCol = ordHeaders.indexOf("Inspector ID");
        var ordInspNameCol = ordHeaders.indexOf("Inspector");
        var needsOrdHeaderUpdate = false;
        if (ordInspIdCol === -1) {
          ordHeaders.push("Inspector ID");
          ordInspIdCol = ordHeaders.length - 1;
          needsOrdHeaderUpdate = true;
        }
        if (ordInspNameCol === -1) {
          ordHeaders.push("Inspector");
          ordInspNameCol = ordHeaders.length - 1;
          needsOrdHeaderUpdate = true;
        }
        if (needsOrdHeaderUpdate) {
          ordenSheet.getRange(1, 1, 1, ordHeaders.length).setValues([ordHeaders]);
          ordData = ordenSheet.getDataRange().getValues();
        }

        // Localizar columnas de Supervisor y Técnico/Orden
        var ordSupervisorCol = -1;
        var ordTicketCol = -1;
        for (var j = 0; j < ordHeaders.length; j++) {
          var h = normalizeString(ordHeaders[j]);
          if (h.includes("supervisor") && !h.includes("tarjeta") && !h.includes("id"))
            ordSupervisorCol = j;
          if (h === "trabajo" || h === "ticket" || h === "orden servicio" || h === "orden_servicio")
            ordTicketCol = j;
        }

        if (action === "assign_ordenes_by_supervisor") {
          var updatedCount = 0;
          var targetSup = normalizeString(params.supervisor);

          if (ordSupervisorCol === -1)
            return ContentService.createTextOutput(
              JSON.stringify({ status: "error", message: "Columna Supervisor no encontrada en Órdenes. Headers: " + ordHeaders.join(",") })
            ).setMimeType(ContentService.MimeType.JSON);

          for (var i = 1; i < ordData.length; i++) {
            var rowSup = normalizeString(ordData[i][ordSupervisorCol]);
            if (rowSup === targetSup) {
              ordenSheet.getRange(i + 1, ordInspIdCol + 1).setValue(params.tech_id);
              ordenSheet.getRange(i + 1, ordInspNameCol + 1).setValue(params.tech_name);
              updatedCount++;
            }
          }
          if (updatedCount === 0) {
            var sample = [];
            for (var m = 1; m < Math.min(ordData.length, 5); m++)
              sample.push(ordData[m][ordSupervisorCol]);
            return ContentService.createTextOutput(
              JSON.stringify({ status: "error", message: "0 órdenes para supervisor '" + params.supervisor + "'. Muestras: " + sample.join(",") })
            ).setMimeType(ContentService.MimeType.JSON);
          }
          return ContentService.createTextOutput(
            JSON.stringify({ status: "success", updated: updatedCount })
          ).setMimeType(ContentService.MimeType.JSON);

        } else if (action === "assign_ordenes_individual") {
          var targetOrden = String(params.orden_id).trim();

          if (ordTicketCol === -1)
            return ContentService.createTextOutput(
              JSON.stringify({ status: "error", message: "Columna de ID de orden no encontrada" })
            ).setMimeType(ContentService.MimeType.JSON);

          for (var i = 1; i < ordData.length; i++) {
            if (String(ordData[i][ordTicketCol]).trim() === targetOrden) {
              ordenSheet.getRange(i + 1, ordInspIdCol + 1).setValue(params.tech_id);
              ordenSheet.getRange(i + 1, ordInspNameCol + 1).setValue(params.tech_name);
              return ContentService.createTextOutput(
                JSON.stringify({ status: "success" })
              ).setMimeType(ContentService.MimeType.JSON);
            }
          }
          return ContentService.createTextOutput(
            JSON.stringify({ status: "error", message: "Orden no encontrada: " + targetOrden })
          ).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(
          JSON.stringify({ status: "error", message: "Error interno ordenes: " + err.toString() })
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
