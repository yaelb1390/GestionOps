export const SCRIPT_URL: string = "https://script.google.com/macros/s/AKfycbwAkYRYJnsXWZYurVKLgR4jrdfFf1tCfPyHawXMJPrpdGpSHhKuSTf1HhATCCbKQz6_Hg/exec"; // Reemplazar con la URL del Web App de Google

export interface Ticket {
  id: number | string;
  ticket: string;
  tech_id: string;
  tech: string;
  inspector_id?: string | number;
  inspector?: string;
  supervisor: string;
  sector: string;
  priority: string;
  status: string;
  evidence?: string;
  codigo_aplicado?: string;
}

export interface Orden {
  ticket?: string;
  orden_servicio?: string;
  cliente?: string;
  fecha?: string;
  tecnologia?: string;
  sector?: string;
  terminal?: string;
  tech?: string;
  supervisor?: string;
  [key: string]: any;
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

    const response = await fetch(`${SCRIPT_URL}?_t=${Date.now()}`);
    const data = await response.json();
    return data as Ticket[];
  } catch (error) {
    console.error("Error fetching tickets from Google Sheets:", error);
    return [];
  }
}

export async function updateTicketStatus(id: number | string, newStatus: string, remarks?: string, rootCause?: string, images: string[] = []): Promise<boolean> {
  try {
    if (SCRIPT_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") {
      console.log(`[MOCK] Ticket ${id} actualizado a ${newStatus}. Imágenes: ${images.length}`);
      return true;
    }

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "update_status",
        id: id,
        status: newStatus,
        remarks: remarks || "",
        rootCause: rootCause || "",
        images: images
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });

    const result = await response.json();
    if (result.status !== "success") {
      console.error("API Error updating status:", result.message);
    }
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

export async function assignTicketsBySupervisor(supervisor: string, tech_id: string, tech_name: string): Promise<number> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "assign_tickets_by_supervisor",
        supervisor: supervisor,
        tech_id: tech_id, // inspector id
        tech_name: tech_name // inspector name
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });

    const result = await response.json();
    return result.status === "success" ? result.updated : 0;
  } catch (error) {
    console.error("Error bulk assigning tickets:", error);
    return 0;
  }
}

export interface Inspector {
  id: string;
  nombre: string;
  sector: string;
  estado: string;
  usuario?: string;
  password?: string;
  rol?: 'Admin' | 'Inspector';
  correo_recuperacion?: string;
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

export const createInspector = async (nombre: string, sector: string, usuario: string, password: string, rol: string = 'Inspector', correo_recuperacion: string = ''): Promise<boolean> => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'add_inspector', nombre, sector, usuario, password, rol, correo_recuperacion }),
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

export const fetchConfig = async (): Promise<any> => {
  try {
    const res = await fetch(`${SCRIPT_URL}?type=config`);
    return await res.json();
  } catch (error) {
    console.error("Error fetching config:", error);
    return {};
  }
};

export const updateAdminProfile = async (username: string, password: string, recovery_email: string): Promise<boolean> => {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'update_admin_profile', username, password, recovery_email }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const data = await res.json();
    return data.status === 'success';
  } catch (error) {
    console.error("Error updating admin profile:", error);
    return false;
  }
};

export const fetchCalidad = async (role: string = 'admin'): Promise<any[]> => {
  try {
    const res = await fetch(`${SCRIPT_URL}?type=calidad&role=${role}&_t=${Date.now()}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching calidad data:", error);
    return [];
  }
};

export const fetchRazones = async (): Promise<any[]> => {
  try {
    const res = await fetch(`${SCRIPT_URL}?type=razones`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching razones data:", error);
    return [];
  }
};

export const fetchOrdenes = async (): Promise<Orden[]> => {
  try {
    const res = await fetch(`${SCRIPT_URL}?type=ordenes&_t=${Date.now()}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching ordenes:", error);
    return [];
  }
};

export async function assignCalidadBySupervisor(supervisor: string, tech_id: string, tech_name: string): Promise<number> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "assign_calidad_by_supervisor",
        supervisor: supervisor,
        tech_id: tech_id, // inspector id
        tech_name: tech_name // inspector name
      })
    });

    const result = await response.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Error desconocido en la asignación masiva");
    }
    return result.updated;
  } catch (error: any) {
    console.error("Error bulk assigning calidad:", error);
    throw error;
  }
}

export async function assignCalidadIndividual(technician: string, tech_id: string, tech_name: string): Promise<boolean> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "assign_calidad_individual",
        technician: technician,
        tech_id: tech_id, // inspector id
        tech_name: tech_name // inspector name
      })
    });

    const result = await response.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Error al asignar técnico individual");
    }
    return true;
  } catch (error: any) {
    console.error("Error assigning individual calidad:", error);
    throw error;
  }
}

// ── Asignación de Órdenes ────────────────────────────────────────────────────

export async function assignOrdenesBySupervisor(supervisor: string, tech_id: string, tech_name: string): Promise<number> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "assign_ordenes_by_supervisor",
        supervisor: supervisor,
        tech_id: tech_id,
        tech_name: tech_name
      })
    });
    const result = await response.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Error en la asignación masiva de órdenes");
    }
    return result.updated;
  } catch (error: any) {
    console.error("Error bulk assigning ordenes:", error);
    throw error;
  }
}

export async function assignOrdenesIndividual(orden_id: string | number, tech_id: string, tech_name: string): Promise<boolean> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "assign_ordenes_individual",
        orden_id: String(orden_id),
        tech_id: tech_id,
        tech_name: tech_name
      })
    });
    const result = await response.json();
    if (result.status !== "success") {
      throw new Error(result.message || "Error al asignar orden individual");
    }
    return true;
  } catch (error: any) {
    console.error("Error assigning individual orden:", error);
    throw error;
  }
}

export async function saveCalidadCodigo(ticket: string, codigo: string): Promise<{success: boolean, message?: string}> {
  try {
    console.log("Intentando guardar código:", { ticket, codigo });
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: 'cors',
      body: JSON.stringify({
        action: "save_calidad_codigo",
        ticket: ticket,
        codigo: codigo
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });

    if (!response.ok) {
      return { success: false, message: `Error del servidor: ${response.status}` };
    }

    const result = await response.json();
    return { success: result.status === "success", message: result.message };
  } catch (error: any) {
    console.error("Error detallado en saveCalidadCodigo:", error);
    return { success: false, message: "Error de conexión: " + (error.message === "Failed to fetch" ? "No se pudo conectar con el servidor (CORS/Network)" : error.message) };
  }
}

export async function saveManualCodigo(ticket: string, codigo: string, type: string): Promise<{success: boolean, message?: string}> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: 'cors',
      body: JSON.stringify({
        action: "save_manual_code",
        ticket: ticket,
        codigo: codigo,
        type: type
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });
    const result = await response.json();
    return { success: result.status === "success", message: result.message };
  } catch (error: any) {
    console.error("Error in saveManualCodigo:", error);
    return { success: false, message: "Error de conexión" };
  }
}

export async function cancelManualCodigo(ticket: string, type: string): Promise<{success: boolean, message?: string}> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: 'cors',
      body: JSON.stringify({
        action: "cancel_manual_code",
        ticket: ticket,
        type: type
      }),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      }
    });
    const result = await response.json();
    return { success: result.status === "success", message: result.message };
  } catch (error: any) {
    console.error("Error in cancelManualCodigo:", error);
    return { success: false, message: "Error de conexión" };
  }
}
