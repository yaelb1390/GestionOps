<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\TicketsImport;

class ExcelImportController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls,csv'
        ]);

        try {
            Excel::import(new TicketsImport, $request->file('file'));
            return response()->json([
                'success' => true,
                'message' => 'Tickets importados y actualizados correctamente.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar archivo: ' . $e->getMessage()
            ], 500);
        }
    }
}
