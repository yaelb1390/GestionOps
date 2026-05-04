import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert OneDrive share URL → direct download URL
// Works for: https://1drv.ms/... and https://onedrive.live.com/...
// ─────────────────────────────────────────────────────────────────────────────
function toOneDriveDownloadUrl(shareUrl: string): string {
  // Already a direct link
  if (shareUrl.includes('download=1') || shareUrl.endsWith('.xlsx') || shareUrl.endsWith('.xls')) {
    return shareUrl;
  }
  // Short 1drv.ms links → append download param
  if (shareUrl.includes('1drv.ms') || shareUrl.includes('onedrive.live.com')) {
    const base64 = Buffer.from(shareUrl).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `https://api.onedrive.com/v1.0/shares/u!${base64}/root/content`;
  }
  // SharePoint shared links
  if (shareUrl.includes('sharepoint.com')) {
    // SharePoint: replace "view.aspx" pattern with direct download
    // If it's a sharing link, use Graph API format
    if (shareUrl.includes('/_layouts/') || shareUrl.includes('/s/')) {
      const base64 = Buffer.from(shareUrl).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return `https://graph.microsoft.com/v1.0/shares/u!${base64}/driveItem/content`;
    }
    // Direct SharePoint file URL — add download param
    return shareUrl.includes('?') ? `${shareUrl}&download=1` : `${shareUrl}?download=1`;
  }
  return shareUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Excel row → Ticket object using flexible column matching
// ─────────────────────────────────────────────────────────────────────────────
function mapRowToTicket(row: Record<string, string | number>, idx: number) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k] ?? row[k.toUpperCase()] ?? row[k.toLowerCase()];
      if (val !== undefined && val !== null && val !== '') return String(val).trim();
    }
    return '';
  };

  return {
    id: idx + 1,
    ticket:      get('TRABAJO', 'trabajo', 'ticket', 'TICKET', 'Trabajo'),
    tech_id:     get('TÉCNICO', 'TECNICO', 'tecnico', 'técnico', 'tech_id'),
    tech:        get('NOMBRE TÉCNICO', 'NOMBRE_TECNICO', 'nombre_tecnico', 'Nombre Técnico', 'tech'),
    supervisor:  get('NOMBRE SUPERVISOR', 'NOMBRE_SUPERVISOR', 'nombre_supervisor', 'Nombre Supervisor', 'supervisor'),
    sector:      get('SECTOR', 'sector'),
    state:       get('ESTADO', 'estado', 'state', 'ESTADO TICKET', 'estado_ticket'),
    tech_type:   get('TECNOLOGÍA', 'TECNOLOGIA', 'tecnologia', 'tech_type'),
    work_name:   get('WORK NAME', 'work_name', 'WORK_NAME', 'tipo'),
    inspector:   '',
    inspected:   false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url, accessToken } = await req.json() as { url: string; accessToken?: string };

    if (!url) {
      return NextResponse.json({ error: 'Se requiere la URL del archivo.' }, { status: 400 });
    }

    const downloadUrl = toOneDriveDownloadUrl(url);

    // Prepare headers
    const headers: Record<string, string> = {
      'User-Agent': 'ClaroNexus/1.0',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Fetch the file
    const response = await fetch(downloadUrl, { headers });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          error: 'Acceso denegado. El archivo debe ser público (compartido con "Cualquier persona con el enlace") o proporciona un token de acceso.',
          status: response.status
        }, { status: 403 });
      }
      return NextResponse.json({
        error: `Error al descargar el archivo: ${response.status} ${response.statusText}`,
        status: response.status
      }, { status: response.status });
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(firstSheet);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'El archivo Excel está vacío o no tiene datos.' }, { status: 422 });
    }

    const tickets = rows
      .filter(row => Object.values(row).some(v => v !== '' && v !== null))
      .map((row, idx) => mapRowToTicket(row, idx));

    return NextResponse.json({
      success: true,
      count: tickets.length,
      tickets,
      columns: Object.keys(rows[0]),
      sheet: workbook.SheetNames[0],
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error interno: ${msg}` }, { status: 500 });
  }
}
