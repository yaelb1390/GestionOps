<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function index(Request $request)
    {
        $query = Ticket::with(['technician.supervisor']);

        if ($request->has('supervisor')) {
            $query->whereHas('technician.supervisor', function($q) use ($request) {
                $q->where('nombre', 'like', '%' . $request->supervisor . '%');
            });
        }

        if ($request->has('tecnico')) {
            $query->whereHas('technician', function($q) use ($request) {
                $q->where('tecnico', 'like', '%' . $request->tecnico . '%');
            });
        }

        if ($request->has('sector')) {
            $query->where('sector', $request->sector);
        }

        if ($request->has('prioridad')) {
            $query->where('clasificacion_prioridad', $request->prioridad);
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        return response()->json($query->paginate(50));
    }

    public function show($id)
    {
        $ticket = Ticket::with(['technician.supervisor', 'inspections.evidences'])->findOrFail($id);
        return response()->json($ticket);
    }
    
    public function dashboardMetrics()
    {
        $total = Ticket::count();
        $inspeccionados = \App\Models\Inspection::count();
        // Pendientes son los que no tienen inspeccion
        $pendientes = Ticket::whereDoesntHave('inspections')->count();
        $requieren_correccion = \App\Models\Inspection::where('resultado', 'Requiere corrección')->count();
        
        // Reincidencias: tickets con mas de 1 inspeccion
        $reincidencias = \App\Models\Inspection::select('ticket_id')
                            ->groupBy('ticket_id')
                            ->havingRaw('count(id) > 1')
                            ->get()
                            ->count();

        return response()->json([
            'total_tickets' => $total,
            'pendientes_inspeccion' => $pendientes,
            'inspeccionados' => $inspeccionados,
            'requieren_correccion' => $requieren_correccion,
            'reincidencias' => $reincidencias,
        ]);
    }
}
