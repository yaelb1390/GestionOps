export const SCRIPT_URL: string = "https://script.google.com/macros/s/AKfycbw5ZVODZMur-NiBUHcw73txQtOt7FjhVif2burD_Ys8tMFCuBLvmfpT5yQDqEHQgK8O2Q/exec"; // Reemplazar con la URL del Web App de Google

export interface Ticket {
  id: number | string;
  ticket: string;
  tech_id: string;
  tech: string;
  supervisor: string;
  sector: string;
  priority: string;
  status: string;
}

export async function fetchTickets(): Promise<Ticket[]> {
  try {
    if (SCRIPT_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") {
      console.warn("Usando datos de prueba. Configura la URL del script de Google.");
      return [
        { id: 1, ticket: 'TRB-8921', tech_id: '601228', tech: 'Juan Perez', supervisor: 'Carlos M.', sector: 'Norte', priority: 'Alta', status: 'Pendiente' },
        { id: 2, ticket: 'TRB-8922', tech_id: '601229', tech: 'Ana Gomez', supervisor: 'Carlos M.', sector: 'Sur', priority: 'Media', status: 'Inspeccionado' },
        { id: 3, ticket: 'TRB-8923', tech_id: '601230', tech: 'Luis Silva', supervisor: 'Maria R.', sector: 'Este', priority: 'Baja', status: 'Requiere corrección' },
      ];
    }

    const response = await fetch(SCRIPT_URL);
    const data = await response.json();
    return data as Ticket[];
  } catch (error) {
    console.error("Error fetching tickets from Google Sheets:", error);
    return [];
  }
}

export async function updateTicketStatus(id: number | string, newStatus: string, remarks?: string, rootCause?: string): Promise<boolean> {
  try {
    if (SCRIPT_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") {
      console.log(`[MOCK] Ticket ${id} actualizado a ${newStatus}. Observaciones: ${remarks}`);
      return true;
    }

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "update_status",
        id: id,
        status: newStatus,
        remarks: remarks || "",
        rootCause: rootCause || ""
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });

    const result = await response.json();
    return result.status === "success";
  } catch (error) {
    console.error("Error updating ticket in Google Sheets:", error);
    return false;
  }
}

export async function assignTicket(id: number | string, tech_id: string, tech_name: string): Promise<boolean> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "assign_ticket",
        id: id,
        tech_id: tech_id, // inspector id
        tech_name: tech_name // inspector name
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });

    const result = await response.json();
    return result.status === "success";
  } catch (error) {
    console.error("Error assigning ticket:", error);
    return false;
  }
}

export interface Inspector {
  id: string;
  nombre: string;
  sector: string;
  estado: string;
  usuario?: string;
  password?: string;
}

export const fetchInspectors = async (): Promise<Inspector[]> => {
  try {
    const res = await fetch(`${SCRIPT_URL}?type=inspectors`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching inspectors:", error);
    return [];
  }
};

export const createInspector = async (nombre: string, sector: string, usuario: string, password: string): Promise<boolean> => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'add_inspector', nombre, sector, usuario, password }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const data = await res.json();
    return data.status === 'success';
  } catch (error) {
    console.error("Error creating inspector:", error);
    return false;
  }
};

export const updateInspector = async (id: string, updates: Partial<Inspector>): Promise<boolean> => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'update_inspector', id, ...updates }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const data = await res.json();
    return data.status === 'success';
  } catch (error) {
    console.error("Error updating inspector:", error);
    return false;
  }
};

export const deleteInspector = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_inspector', id }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const data = await res.json();
    return data.status === 'success';
  } catch (error) {
    console.error("Error deleting inspector:", error);
    return false;
  }
};

export const autoAssignTickets = async (): Promise<{success: boolean, updated: number}> => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'auto_assign' }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const data = await res.json();
    return { success: data.status === 'success', updated: data.updated || 0 };
  } catch (error) {
    console.error("Error auto assigning tickets:", error);
    return { success: false, updated: 0 };
  }
};

export interface RazonCliente {
  Casos?: string;
  'Tarjeta del Ejecutor'?: string;
  'Nombre del Ejecutor'?: string;
  'Nombre del Supervisor'?: string;
  Localidad?: string;
  Descripcion?: string;
}

export const fetchRazones = async (): Promise<RazonCliente[]> => {
  try {
    const res = await fetch(`${SCRIPT_URL}?type=razones`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching razones:", error);
    return [];
  }
};
