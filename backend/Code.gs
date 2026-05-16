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
  if (low === "trabajo" || low === "idd" || low === "nro trabajo" || low === "id trabajo" || low === "id_trabajo" || low === "job id" || low === "nro orden" || low === "numero de orden" || low === "nro de orden" || low === "nro_orden" || low === "ticket" || low === "id ticket" || low === "nro ticket" || low === "id_ticket") return "ticket";
  
  // Descripción / tipo del trabajo
  if (low === "work name" || low === "tipo trabajo" || low === "tipo de trabajo" || low === "descripcion trabajo" || low === "tipo servicio" || low === "tipo_servicio") return "descripcion_orden";
  
  if (low === "orden servicio" || low === "orden de servicio" || low === "orden_servicio" || low === "os" || low === "id orden") return "orden_servicio";
  
  // CORRECCIÓN: En la hoja de Órdenes, "Orden externa" es el ID numérico y "Trabajo" es la descripción.
  // Mapeamos "orden externa" a orden_externa_id para tener el ID limpio.
  if (low === "orden externa" || low === "order externa" || low === "external order") return "orden_externa_id";
  if (low === "descripcion" || low === "descripcion orden") return "descripcion_orden";
  
  // Datos del Cliente y Reporte
  if (low === "cliente" || low === "nombre cliente" || low === "nombre_cliente" || low === "subscriber") return "cliente";
  if (low === "fecha" || low === "fecha reporte" || low === "fecha_creacion" || low === "vence" || low === "oe vencimiento" || low === "oe_vencimiento") return "fecha";
  
  // Tecnología de red
  if (low === "tecnologia" || low === "tipo red" || low === "tipo_red" || low === "red" || low === "servicio" || low === "tipo servicio") return "tecnologia";
  
  if (low === "sector") return "sector";
  if (low === "barrio") return "barrio";
  if (low === "ciudad") return "ciudad";
  if (low === "zona" || low === "region" || low === "municipio") return "sector";
  if (low === "terminal" || low === "id terminal" || low === "fat" || low === "caja") return "terminal";
  
  // Personal (Supervisor / Técnico)
  if (low.includes("supervisor") && !low.includes("id") && !low.includes("tarjeta")) return "supervisor";
  if (low.includes("supervisor") && (low.includes("id") || low.includes("tarjeta"))) return "supervisor_id";
  
  // "tecnico" solo (sin "nombre") = ID/cédula del técnico → tech_id
  // "nombre tecnico" o "asignado a" = nombre del técnico → tech
  if (low === "nombre tecnico" || low === "nombre_tecnico" || low === "asignado a" || low === "asignado_a" || low === "tech_name" || low === "tech") return "tech";
  if (low === "tecnico" || low === "cedula" || low === "cedula tecnico" || low.includes("id tecnico") || low.includes("tarjeta tecnico") || low.includes("tech_id") || low === "tarjeta") return "tech_id";
  
  // Inspector (para dashboard móvil)
  if (low === "inspector" || low === "inspector_nombre" || low === "nombre inspector" || low === "inspector asignado" || low === "inspector_asignado" || low === "nombre_inspector") return "inspector";
  if (low === "inspector id" || low === "inspector_id" || low === "tarjeta inspector" || low === "id inspector" || low === "id_inspector") return "inspector_id";
  
  // Calidad / Avería Repetida Especificos (Alineación con Base de Datos)
  if (low === "caso actual" || low === "caso_actual" || low === "ticket_actual") return "ticket";
  if (low === "tecnico actual" || low === "tecnico_actual") return "tech";
  if (low === "supervisor actual" || low === "supervisor_actual") return "supervisor";
  if (low === "work name actual" || low === "work_name_actual" || low === "work name") return "work_name";
  if (low === "caso repetido" || low === "caso_repetido" || low === "ticket_repetido") return "caso_repetido";
  if (low === "tecnico caso repetido" || low === "tecnico_caso_repetido" || low === "tecnico repetido") return "tecnico_repetido";
  if (low === "respuesta caso repetido" || low === "respuesta_caso_repetido" || low === "respuesta_repetido") return "respuesta_repetido";
  if (low === "fecha cierre repetido" || low === "fecha_cierre_repetido" || low === "fecha_repetido") return "fecha_repetido";
  if (low === "tecnologia actual" || low === "tecnologia_actual") return "tecnologia";
  if (low === "sector actual" || low === "sector_actual") return "sector";

  // Estado y Prioridad
  if (low === "estado" || low === "status" || low === "estado_orden" || low === "estado inspeccion" || low === "estado_inspeccion") return "status";
  if (low === "prioridad" || low === "priority" || low === "tipo de prioridad" || low === "clasificacion prioridad") return "priority";
  
  // Otros
  if (low === "codigo aplicado" || low === "codigo_aplicado" || low === "manual_code" || low === "codigo_razon") return "codigo_aplicado";

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
  if (type === "calidad") return findSheet(["Calidad", "Averias Repetidas", "Repetidas", "Base Calidad"], 556329786);
  if (type === "inspectores") return findSheet(["Inspectores", "Usuarios", "Personal", "Inspectores_Base"]);
  if (type === "razones") return findSheet(["Razones", "Codigo Razon Cliente", "Razones_Base"], 761213977);
  if (type === "ordenes") return findSheet(["Ordenes", "Ordenes de Servicio", "Trabajos", "OS", "Ordenes_Base"], 885138959);
  
  return null;
}

// Helper to find the header row and normalize headers
function getHeaderInfo(data) {
  var headerRowIndex = 0;
  var foundHeaders = false;
  for (var r = 0; r < Math.min(data.length, 10); r++) {
    for (var c = 0; c < data[r].length; c++) {
      var cellVal = normalizeString(data[r][c]);
      if (cellVal === "trabajo" || cellVal === "ticket" || cellVal === "orden servicio" || cellVal === "id" || cellVal === "caso") {
        headerRowIndex = r;
        foundHeaders = true;
        break;
      }
    }
    if (foundHeaders) break;
  }
  
  var rawHeaders = data[headerRowIndex] || [];
  var headers = rawHeaders.map(normalizeHeader);
  
  return {
    index: headerRowIndex,
    headers: headers,
    rawHeaders: rawHeaders
  };
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
  if (data.length === 0)
    return ContentService.createTextOutput("[]").setMimeType(
      ContentService.MimeType.JSON,
    );

  var info = getHeaderInfo(data);
  var headerRowIndex = info.index;
  var headers = info.rawHeaders;
  var normalizedHeaders = info.headers;

  var results = [];
  
  // Encontrar columnas para filtrado 24h
  var estadoCol = -1;
  var fechaCol = -1;
  for (var j = 0; j < normalizedHeaders.length; j++) {
    var h = normalizedHeaders[j];
    if (h === "status") estadoCol = j;
    if (h === "fecha") fechaCol = j;
  }

  var now = new Date();

  // Los datos comienzan después de la fila de encabezados
  for (var i = headerRowIndex + 1; i < data.length; i++) {
    var row = data[i];
    if (!row.some(cell => cell !== "")) continue;
    
    // Filtrado 24h para Inspectores
    if (role === "inspector" && estadoCol > -1 && fechaCol > -1) {
      var status = String(row[estadoCol]).toLowerCase();
      if (status === "completado" || status === "inspeccionado") {
        var fechaInspeccion = new Date(row[fechaCol]);
        if (!isNaN(fechaInspeccion.getTime())) {
          var diffHours = (now - fechaInspeccion) / (1000 * 60 * 60);
          if (diffHours > 24) continue;
        }
      }
    }

    var obj = {};
    var ticketValue = null;
    for (var j = 0; j < normalizedHeaders.length; j++) {
      var key = normalizedHeaders[j];
      if (!key) continue;

      // La columna "TRABAJO" tiene prioridad absoluta para la clave "ticket"
      var rawH = normalizeString(headers[j]);
      if (rawH === 'trabajo') {
        ticketValue = row[j];
        obj['ticket'] = row[j];
      } else if (key === 'ticket') {
        if (ticketValue === null) obj['ticket'] = row[j];
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
      var info = getHeaderInfo(data);
      var headers = info.headers;
      var idColIndex = headers.indexOf("id");
      var ticketColIndex = headers.indexOf("ticket");
      
      for (var i = info.index + 1; i < data.length; i++) {
        if (
          (idColIndex > -1 && data[i][idColIndex] == params.id) ||
          (ticketColIndex > -1 && data[i][ticketColIndex] == params.id)
        ) {
          var statusColIndex = headers.indexOf("status");
          var remarksColIndex = headers.indexOf("remarks");
          var rootCauseColIndex = headers.indexOf("root_cause");

          if (statusColIndex > -1)
            sheet.getRange(i + 1, statusColIndex + 1).setValue(params.status);
          if (remarksColIndex > -1)
            sheet.getRange(i + 1, remarksColIndex + 1).setValue(params.remarks);
          if (rootCauseColIndex > -1)
            sheet.getRange(i + 1, rootCauseColIndex + 1).setValue(params.rootCause);

          // Manejo de Imágenes
          if (params.images && params.images.length > 0) {
            var evidenceColIndex = headers.indexOf("evidence");
            if (evidenceColIndex === -1) {
              var rawHeaders = info.rawHeaders;
              rawHeaders.push("evidence");
              sheet.getRange(info.index + 1, 1, 1, rawHeaders.length).setValues([rawHeaders]);
              evidenceColIndex = rawHeaders.length - 1;
            }
            try {
              var imageUrls = saveImages(params.images, params.id);
              if (imageUrls) {
                sheet.getRange(i + 1, evidenceColIndex + 1).setValue(imageUrls);
              }
            } catch (imageErr) {
              Logger.log("Error saving images: " + imageErr.message);
            }
          }

          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Ticket no encontrado" })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── Asignación de Tickets ──────────────────
    if (action === "assign_ticket" || action === "assign_tickets_by_supervisor") {
      try {
        var sheet = getTargetSheetByType(ss, "tickets");
        if (!sheet) throw new Error("Hoja de Tickets no encontrada");

        var data = sheet.getDataRange().getValues();
        var info = getHeaderInfo(data);
        var headers = info.headers;
        var rawHeaders = info.rawHeaders;

        // Asegurar columnas de inspector
        var inspIdCol = headers.indexOf("inspector_id");
        var inspNameCol = headers.indexOf("inspector");
        
        var needsHeaderUpdate = false;
        if (inspIdCol === -1) { rawHeaders.push("Inspector ID"); inspIdCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        if (inspNameCol === -1) { rawHeaders.push("Inspector"); inspNameCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        
        if (needsHeaderUpdate) {
          sheet.getRange(info.index + 1, 1, 1, rawHeaders.length).setValues([rawHeaders]);
          data = sheet.getDataRange().getValues();
          // Actualizar info después de añadir columnas
          info = getHeaderInfo(data);
          headers = info.headers;
        }

        var ticketCol = headers.indexOf("ticket");
        var statusCol = headers.indexOf("status");
        var supervisorCol = headers.indexOf("supervisor");

        if (action === "assign_ticket") {
          var targetId = normalizeString(params.id || params.ticket);
          if (ticketCol === -1) throw new Error("Columna Ticket/Trabajo no encontrada");

          var found = false;
          for (var i = info.index + 1; i < data.length; i++) {
            if (normalizeString(data[i][ticketCol]) === targetId) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              if (statusCol > -1) {
                 var currentStatus = String(data[i][statusCol]).trim();
                 if (currentStatus === "" || currentStatus === "Pendiente") {
                   sheet.getRange(i + 1, statusCol + 1).setValue("Asignado");
                 }
              }
              found = true;
            }
          }
          if (!found) throw new Error("No se encontró el ticket " + targetId + " en la columna " + (info.rawHeaders[ticketCol] || "Ticket"));
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        } else {
          // Bulk assign by supervisor
          var targetSup = normalizeString(params.supervisor);
          if (supervisorCol === -1) throw new Error("Columna Supervisor no encontrada");

          var updatedCount = 0;
          for (var i = info.index + 1; i < data.length; i++) {
            if (normalizeString(data[i][supervisorCol]) === targetSup) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              if (statusCol > -1) {
                var currentStatus = String(data[i][statusCol]).trim();
                if (currentStatus === "" || currentStatus === "Pendiente") {
                  sheet.getRange(i + 1, statusCol + 1).setValue("Asignado");
                }
              }
              updatedCount++;
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updatedCount })).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Error tickets: " + err.toString() })).setMimeType(ContentService.MimeType.JSON);
      }
    }


    // ── Asignación de Razones ──────────────────
    if (action === "assign_razones_by_supervisor" || action === "assign_razon_individual" || action === "assign_razones_individual") {
      try {
        var sheet = getTargetSheetByType(ss, "razones");
        if (!sheet) throw new Error("Hoja de Razones no encontrada");

        var data = sheet.getDataRange().getValues();
        var info = getHeaderInfo(data);
        var headers = info.headers;
        var rawHeaders = info.rawHeaders;

        // Asegurar columnas de inspector
        var inspIdCol = headers.indexOf("inspector_id");
        var inspNameCol = headers.indexOf("inspector");
        
        var needsHeaderUpdate = false;
        if (inspIdCol === -1) { rawHeaders.push("Inspector ID"); inspIdCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        if (inspNameCol === -1) { rawHeaders.push("Inspector"); inspNameCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        
        if (needsHeaderUpdate) {
          sheet.getRange(info.index + 1, 1, 1, rawHeaders.length).setValues([rawHeaders]);
          data = sheet.getDataRange().getValues();
          info = getHeaderInfo(data);
          headers = info.headers;
        }

        var supervisorCol = headers.indexOf("supervisor");
        var ticketCol = headers.indexOf("ticket"); 

        if (action === "assign_razon_individual" || action === "assign_razones_individual") {
          var targetId = String(params.ticket || params.id).trim();
          if (ticketCol === -1) throw new Error("Columna Caso/Ticket no encontrada");

          for (var i = info.index + 1; i < data.length; i++) {
            if (String(data[i][ticketCol]).trim() === targetId) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Caso no encontrado: " + targetId })).setMimeType(ContentService.MimeType.JSON);
        } else {
          var targetSup = normalizeString(params.supervisor);
          if (supervisorCol === -1) throw new Error("Columna Supervisor no encontrada");

          var updatedCount = 0;
          for (var i = info.index + 1; i < data.length; i++) {
            if (normalizeString(data[i][supervisorCol]) === targetSup) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              updatedCount++;
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updatedCount })).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Error razones: " + err.toString() })).setMimeType(ContentService.MimeType.JSON);
      }
    }


    if (action === "save_manual_code" || action === "cancel_manual_code") {
      try {
        var type = params.type || "calidad";
        var sheet = getTargetSheetByType(ss, type);
        if (!sheet) throw new Error("Hoja no encontrada");

        var data = sheet.getDataRange().getValues();
        var info = getHeaderInfo(data);
        var headers = info.headers;
        var rawHeaders = info.rawHeaders;

        var ticketCol = headers.indexOf("ticket");
        
        if (type === "ordenes") {
          var extCol = headers.indexOf("orden_externa_id");
          var servCol = headers.indexOf("orden_servicio");
          if (extCol > -1) ticketCol = extCol;
          else if (servCol > -1) ticketCol = servCol;
        }

        var codigoCol = headers.indexOf("codigo_aplicado");
        var estadoCol = headers.indexOf("status");
        var fechaCol = headers.indexOf("fecha");
        
        if (ticketCol === -1) throw new Error("Columna de identificación no encontrada");
        
        var needsUpdate = false;
        if (codigoCol === -1) { rawHeaders.push("Código Aplicado"); codigoCol = rawHeaders.length - 1; needsUpdate = true; }
        if (estadoCol === -1) { rawHeaders.push("Estado Inspección"); estadoCol = rawHeaders.length - 1; needsUpdate = true; }
        if (fechaCol === -1) { rawHeaders.push("Fecha Inspección"); fechaCol = rawHeaders.length - 1; needsUpdate = true; }
        
        if (needsUpdate) {
          sheet.getRange(info.index + 1, 1, 1, rawHeaders.length).setValues([rawHeaders]);
          data = sheet.getDataRange().getValues();
          info = getHeaderInfo(data);
          headers = info.headers;
        }

        var targetTicket = String(params.ticket).trim();
        for (var i = info.index + 1; i < data.length; i++) {
          if (String(data[i][ticketCol]).trim() === targetTicket) {
            if (action === "save_manual_code") {
              if (data[i][codigoCol] && String(data[i][codigoCol]).trim() !== "") {
                return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Ya tiene un código aplicado" })).setMimeType(ContentService.MimeType.JSON);
              }
              sheet.getRange(i + 1, codigoCol + 1).setValue(params.codigo);
              sheet.getRange(i + 1, estadoCol + 1).setValue(type === "tickets" ? "Inspeccionado" : "Completado");
              var rdDate = Utilities.formatDate(new Date(), "GMT-4", "dd/MM/yyyy HH:mm:ss");
              sheet.getRange(i + 1, fechaCol + 1).setValue(rdDate);
            } else {
              sheet.getRange(i + 1, codigoCol + 1).clearContent();
              sheet.getRange(i + 1, estadoCol + 1).setValue(type === "tickets" ? "Asignado" : "Pendiente");
              sheet.getRange(i + 1, fechaCol + 1).clearContent();
            }
            return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
          }
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Registro no encontrado: " + targetTicket })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Error manual_code: " + err.toString() })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── Asignación de Calidad ──────────────────
    if (action === "assign_calidad_by_supervisor" || action === "assign_calidad_individual") {
      try {
        var sheet = getTargetSheetByType(ss, "calidad");
        if (!sheet) throw new Error("Hoja de Calidad no encontrada");

        var data = sheet.getDataRange().getValues();
        var info = getHeaderInfo(data);
        var headers = info.headers;
        var rawHeaders = info.rawHeaders;

        var inspIdCol = headers.indexOf("inspector_id");
        var inspNameCol = headers.indexOf("inspector");
        
        var needsHeaderUpdate = false;
        if (inspIdCol === -1) { rawHeaders.push("Inspector ID"); inspIdCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        if (inspNameCol === -1) { rawHeaders.push("Inspector"); inspNameCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        
        if (needsHeaderUpdate) {
          sheet.getRange(info.index + 1, 1, 1, rawHeaders.length).setValues([rawHeaders]);
          data = sheet.getDataRange().getValues();
          info = getHeaderInfo(data);
          headers = info.headers;
        }

        var supervisorCol = headers.indexOf("supervisor");
        var techIdCol = headers.indexOf("tech_id");
        var techNameCol = headers.indexOf("tech");
        var ticketCol = headers.indexOf("ticket");

        if (action === "assign_calidad_individual") {
          var targetTicket = String(params.ticket || params.technician).trim();
          if (ticketCol === -1) ticketCol = headers.indexOf("trabajo");
          if (ticketCol === -1) throw new Error("Columna de Ticket/Trabajo no encontrada en Calidad");

          var updatedCount = 0;
          for (var i = info.index + 1; i < data.length; i++) {
            var rowTicket = String(data[i][ticketCol]).trim();
            var rowTechName = techNameCol > -1 ? String(data[i][techNameCol]).trim() : "";
            var rowTechId = techIdCol > -1 ? String(data[i][techIdCol]).trim() : "";

            if (rowTicket === targetTicket || rowTechName === targetTicket || rowTechId === targetTicket) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              var stCol = headers.indexOf("status");
              if (stCol > -1) sheet.getRange(i + 1, stCol + 1).setValue("Asignado");
              updatedCount++;
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updatedCount })).setMimeType(ContentService.MimeType.JSON);
        } else {
          var targetSup = normalizeString(params.supervisor);
          if (supervisorCol === -1) throw new Error("Columna Supervisor no encontrada");

          var updatedCount = 0;
          for (var i = info.index + 1; i < data.length; i++) {
            if (normalizeString(data[i][supervisorCol]) === targetSup) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              var stCol = headers.indexOf("status");
              if (stCol > -1) sheet.getRange(i + 1, stCol + 1).setValue("Asignado");
              updatedCount++;
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updatedCount })).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Error calidad: " + err.toString() })).setMimeType(ContentService.MimeType.JSON);
      }
    }


    // ── Asignación de Órdenes ──────────────────
    if (action === "assign_ordenes_by_supervisor" || action === "assign_ordenes_individual") {
      try {
        var sheet = getTargetSheetByType(ss, "ordenes");
        if (!sheet) throw new Error("Hoja de Órdenes no encontrada");

        var data = sheet.getDataRange().getValues();
        var info = getHeaderInfo(data);
        var headers = info.headers;
        var rawHeaders = info.rawHeaders;

        var inspIdCol = headers.indexOf("inspector_id");
        var inspNameCol = headers.indexOf("inspector");
        
        var needsHeaderUpdate = false;
        if (inspIdCol === -1) { rawHeaders.push("Inspector ID"); inspIdCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        if (inspNameCol === -1) { rawHeaders.push("Inspector"); inspNameCol = rawHeaders.length - 1; needsHeaderUpdate = true; }
        
        if (needsHeaderUpdate) {
          sheet.getRange(info.index + 1, 1, 1, rawHeaders.length).setValues([rawHeaders]);
          data = sheet.getDataRange().getValues();
          info = getHeaderInfo(data);
          headers = info.headers;
        }

        var supervisorCol = headers.indexOf("supervisor");
        var ticketCol = headers.indexOf("ticket");

        if (action === "assign_ordenes_individual") {
          var targetTicket = String(params.ticketId || params.orden_id).trim();
          if (ticketCol === -1) throw new Error("Columna Ticket no encontrada");

          for (var i = info.index + 1; i < data.length; i++) {
            if (String(data[i][ticketCol]).trim() === targetTicket) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              var stCol = headers.indexOf("status");
              if (stCol > -1) sheet.getRange(i + 1, stCol + 1).setValue("Asignado");
              return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Orden no encontrada: " + targetTicket })).setMimeType(ContentService.MimeType.JSON);
        } else {
          var targetSup = normalizeString(params.supervisor);
          if (supervisorCol === -1) throw new Error("Columna Supervisor no encontrada");

          var updatedCount = 0;
          for (var i = info.index + 1; i < data.length; i++) {
            if (normalizeString(data[i][supervisorCol]) === targetSup) {
              sheet.getRange(i + 1, inspIdCol + 1).setValue(params.tech_id);
              sheet.getRange(i + 1, inspNameCol + 1).setValue(params.tech_name);
              var stCol = headers.indexOf("status");
              if (stCol > -1) sheet.getRange(i + 1, stCol + 1).setValue("Asignado");
              updatedCount++;
            }
          }
          return ContentService.createTextOutput(JSON.stringify({ status: "success", updated: updatedCount })).setMimeType(ContentService.MimeType.JSON);
        }
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Error ordenes: " + err.toString() })).setMimeType(ContentService.MimeType.JSON);
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
      var id = params.id ? String(params.id) : new Date().getTime().toString().slice(-6);
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
          if (params.new_id && headers.indexOf("id") > -1)
            sheet
              .getRange(i + 1, headers.indexOf("id") + 1)
              .setValue(params.new_id);
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
      var ticketSheet = getTargetSheetByType(ss, "tickets");
      var inspectorSheet = ss.getSheetByName("Inspectores");
      if (!ticketSheet || !inspectorSheet)
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Hojas no encontradas" })).setMimeType(ContentService.MimeType.JSON);

      var tData = ticketSheet.getDataRange().getValues();
      var tInfo = getHeaderInfo(tData);
      var tHeaders = tInfo.headers;

      var iData = inspectorSheet.getDataRange().getValues();
      var iInfo = getHeaderInfo(iData);
      var iHeaders = iInfo.headers;

      if (iData.length <= iInfo.index + 1)
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No hay inspectores" })).setMimeType(ContentService.MimeType.JSON);

      var techIdCol = tHeaders.indexOf("inspector_id");
      var techCol = tHeaders.indexOf("inspector");
      var statusCol = tHeaders.indexOf("status");

      var iNameCol = iHeaders.indexOf("nombre");
      var iIdCol = iHeaders.indexOf("id");
      var iEstadoCol = iHeaders.indexOf("estado");

      var loadMap = {};
      var inspectors = [];
      for (var j = iInfo.index + 1; j < iData.length; j++) {
        if (iEstadoCol > -1 && iData[j][iEstadoCol] !== "Activo") continue;
        var insp = { name: iData[j][iNameCol], id: iData[j][iIdCol], count: 0 };
        loadMap[insp.id] = insp;
        inspectors.push(insp);
      }

      // Contar carga actual
      for (var i = tInfo.index + 1; i < tData.length; i++) {
        var tStatus = String(tData[i][statusCol]).trim();
        var tTechId = String(tData[i][techIdCol]).trim();
        if (tStatus === "Asignado" && loadMap[tTechId]) {
          loadMap[tTechId].count++;
        }
      }

      var updated = 0;
      for (var i = tInfo.index + 1; i < tData.length; i++) {
        var currentTech = String(tData[i][techIdCol]).trim();
        var currentStatus = String(tData[i][statusCol]).trim();
        if (
          (currentStatus === "" || currentStatus === "Pendiente") &&
          (!currentTech || currentTech === "")
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
            if (techIdCol > -1) ticketSheet.getRange(i + 1, techIdCol + 1).setValue(minInspector.id);
            if (techCol > -1) ticketSheet.getRange(i + 1, techCol + 1).setValue(minInspector.name);
            if (statusCol > -1) ticketSheet.getRange(i + 1, statusCol + 1).setValue("Asignado");
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
