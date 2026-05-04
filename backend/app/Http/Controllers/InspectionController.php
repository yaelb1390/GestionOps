<?php

namespace App\Http\Controllers;

use App\Models\Inspection;
use App\Models\InspectionEvidence;
use Illuminate\Http\Request;

class InspectionController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'ticket_id' => 'required|exists:tickets,id',
            'inspector_id' => 'required|exists:inspectors,id',
            'causa_raiz' => 'required|string',
            'resultado' => 'required|string|in:Aprobado,Requiere corrección,Rechazado',
            'observaciones' => 'nullable|string',
            'fotos' => 'nullable|array',
            'fotos.*' => 'image|mimes:jpeg,png,jpg|max:2048'
        ]);

        $inspection = Inspection::create([
            'ticket_id' => $request->ticket_id,
            'inspector_id' => $request->inspector_id, // Vendria de Auth::user()->inspector->id idealmente
            'causa_raiz' => $request->causa_raiz,
            'observaciones' => $request->observaciones,
            'resultado' => $request->resultado,
        ]);

        if ($request->hasFile('fotos')) {
            foreach ($request->file('fotos') as $foto) {
                $path = $foto->store('evidencias', 'public');
                InspectionEvidence::create([
                    'inspection_id' => $inspection->id,
                    'foto_path' => $path
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Inspección guardada correctamente',
            'inspection' => $inspection->load('evidences')
        ]);
    }

    public function myInspections($inspector_id)
    {
        $inspections = Inspection::with(['ticket.technician.supervisor'])
            ->where('inspector_id', $inspector_id)
            ->get();
            
        return response()->json($inspections);
    }
}
