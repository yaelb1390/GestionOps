function doGet(e) {
  var type = e.parameter.type || 'tickets';
  var ss = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/1NTBF8C9W3kkfBQbIe56OkwdjwYmO5m6ew2_auP4kQ-s/edit");
  
  if (type === 'tickets') {
    var sheet = ss.getSheetByName('Tickets');
    if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    var data = sheet.getDataRange().getValues();
    if(data.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
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
    return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
  } 
  else if (type === 'inspectors') {
    var sheet = ss.getSheetByName('Inspectores');
    if (!sheet) {
      sheet = ss.insertSheet('Inspectores');
      sheet.appendRow(['id', 'nombre', 'usuario', 'password', 'sector', 'estado']);
    }
    
    var data = sheet.getDataRange().getValues();
    if(data.length > 0) {
      var headers = data[0];
      var needsHeaderUpdate = false;
      if(headers.indexOf('usuario') === -1) { headers.push('usuario'); needsHeaderUpdate = true; }
      if(headers.indexOf('password') === -1) { headers.push('password'); needsHeaderUpdate = true; }
      if(needsHeaderUpdate) {
         sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
         data = sheet.getDataRange().getValues(); 
      }
    } else {
      sheet.appendRow(['id', 'nombre', 'usuario', 'password', 'sector', 'estado']);
      data = sheet.getDataRange().getValues();
    }

    if(data.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    
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
    return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
  }
  else if (type === 'razones') {
    var sheets = ss.getSheets();
    var sheet = null;
    for (var k = 0; k < sheets.length; k++) {
      if (sheets[k].getSheetId() == 761213977) {
        sheet = sheets[k];
        break;
      }
    }
    if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    
    var data = sheet.getDataRange().getValues();
    if(data.length <= 1) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
    
    var headers = data[0];
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j];
        // Solo incluimos las columnas solicitadas
        if(h === 'Caso' || h === 'Nombre del Ejecutor' || h === 'Nombre del Supervisor' || h === 'Localidad' || h === 'Descripcion') {
          obj[h] = row[j];
        }
      }
      // Solo agregamos si hay al menos una propiedad, y evitamos filas totalmente vacías
      if(Object.keys(obj).length > 0 && row.join("").trim() !== "") {
        results.push(obj);
      }
    }
    return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var action = params.action;
  var ss = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/1NTBF8C9W3kkfBQbIe56OkwdjwYmO5m6ew2_auP4kQ-s/edit");
  
  if (action === 'update_status') {
    var sheet = ss.getSheetByName('Tickets');
    var data = sheet.getDataRange().getValues();
    var idColIndex = data[0].indexOf('id');
    for (var i = 1; i < data.length; i++) {
      if (data[i][idColIndex] == params.id) {
        var statusColIndex = data[0].indexOf('status');
        var remarksColIndex = data[0].indexOf('remarks');
        var rootCauseColIndex = data[0].indexOf('rootCause');
        
        if (statusColIndex > -1) sheet.getRange(i + 1, statusColIndex + 1).setValue(params.status);
        if (remarksColIndex > -1) sheet.getRange(i + 1, remarksColIndex + 1).setValue(params.remarks);
        if (rootCauseColIndex > -1) sheet.getRange(i + 1, rootCauseColIndex + 1).setValue(params.rootCause);
        return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Ticket no encontrado"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'assign_ticket') {
    var sheet = ss.getSheetByName('Tickets');
    var data = sheet.getDataRange().getValues();
    var idColIndex = data[0].indexOf('id');
    for (var i = 1; i < data.length; i++) {
      if (data[i][idColIndex] == params.id) {
        var techIdCol = data[0].indexOf('tech_id');
        var techCol = data[0].indexOf('tech');
        var statusCol = data[0].indexOf('status');
        
        if (techIdCol > -1) sheet.getRange(i + 1, techIdCol + 1).setValue(params.tech_name);
        if (techCol > -1) sheet.getRange(i + 1, techCol + 1).setValue(params.tech_id);
        if (statusCol > -1) sheet.getRange(i + 1, statusCol + 1).setValue('Asignado');
        
        return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Ticket no encontrado"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'add_inspector') {
    var sheet = ss.getSheetByName('Inspectores');
    if (!sheet) {
      sheet = ss.insertSheet('Inspectores');
      sheet.appendRow(['id', 'nombre', 'usuario', 'password', 'sector', 'estado']);
    }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var id = new Date().getTime().toString().slice(-6);
    var newRow = new Array(headers.length).fill("");
    
    newRow[headers.indexOf('id')] = id;
    if(headers.indexOf('nombre') > -1) newRow[headers.indexOf('nombre')] = params.nombre || "";
    if(headers.indexOf('usuario') > -1) newRow[headers.indexOf('usuario')] = params.usuario || "";
    if(headers.indexOf('password') > -1) newRow[headers.indexOf('password')] = params.password || "";
    if(headers.indexOf('sector') > -1) newRow[headers.indexOf('sector')] = params.sector || "";
    if(headers.indexOf('estado') > -1) newRow[headers.indexOf('estado')] = params.estado || 'Activo';
    
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "id": id})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'update_inspector') {
    var sheet = ss.getSheetByName('Inspectores');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('id');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idCol] == params.id) {
        if(params.nombre && headers.indexOf('nombre') > -1) sheet.getRange(i + 1, headers.indexOf('nombre') + 1).setValue(params.nombre);
        if(params.usuario && headers.indexOf('usuario') > -1) sheet.getRange(i + 1, headers.indexOf('usuario') + 1).setValue(params.usuario);
        if(params.password && headers.indexOf('password') > -1) sheet.getRange(i + 1, headers.indexOf('password') + 1).setValue(params.password);
        if(params.sector && headers.indexOf('sector') > -1) sheet.getRange(i + 1, headers.indexOf('sector') + 1).setValue(params.sector);
        if(params.estado && headers.indexOf('estado') > -1) sheet.getRange(i + 1, headers.indexOf('estado') + 1).setValue(params.estado);
        
        return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Inspector no encontrado"})).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'delete_inspector') {
    var sheet = ss.getSheetByName('Inspectores');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idCol = headers.indexOf('id');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idCol] == params.id) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Inspector no encontrado"})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'auto_assign') {
    var ticketSheet = ss.getSheetByName('Tickets');
    var inspectorSheet = ss.getSheetByName('Inspectores');
    if(!ticketSheet || !inspectorSheet) return ContentService.createTextOutput(JSON.stringify({"status": "error"})).setMimeType(ContentService.MimeType.JSON);
    
    var tData = ticketSheet.getDataRange().getValues();
    var iData = inspectorSheet.getDataRange().getValues();
    if(iData.length <= 1) return ContentService.createTextOutput(JSON.stringify({"status": "error"})).setMimeType(ContentService.MimeType.JSON);
    
    var tHeaders = tData[0];
    var techIdCol = tHeaders.indexOf('tech_id');
    var techCol = tHeaders.indexOf('tech');
    var statusCol = tHeaders.indexOf('status');
    
    var iHeaders = iData[0];
    var iNameCol = iHeaders.indexOf('nombre');
    var iIdCol = iHeaders.indexOf('id');
    var iEstadoCol = iHeaders.indexOf('estado');
    
    var loadMap = {};
    var inspectors = [];
    for(var j=1; j<iData.length; j++) {
      if(iEstadoCol > -1 && iData[j][iEstadoCol] !== 'Activo') continue; // Solo activos
      var insp = { name: iData[j][iNameCol], id: iData[j][iIdCol], count: 0 };
      loadMap[insp.name] = insp;
      inspectors.push(insp);
    }
    
    for(var i=1; i<tData.length; i++) {
      var tStatus = tData[i][statusCol];
      var tTechName = tData[i][techIdCol]; 
      if(tStatus === 'Pendiente' && loadMap[tTechName]) {
        loadMap[tTechName].count++;
      }
    }
    
    var updated = 0;
    for(var i=1; i<tData.length; i++) {
      var currentTech = tData[i][techIdCol];
      var currentStatus = tData[i][statusCol];
      if(currentStatus === 'Pendiente' && (!currentTech || currentTech.toString().trim() === '')) {
         var minInspector = null;
         var minCount = 999999;
         for(var k=0; k<inspectors.length; k++) {
            if(inspectors[k].count < minCount) {
               minCount = inspectors[k].count;
               minInspector = inspectors[k];
            }
         }
         if(minInspector) {
            ticketSheet.getRange(i + 1, techIdCol + 1).setValue(minInspector.name); 
            ticketSheet.getRange(i + 1, techCol + 1).setValue(minInspector.id); 
            minInspector.count++;
            updated++;
         }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "updated": updated})).setMimeType(ContentService.MimeType.JSON);
  }
}
