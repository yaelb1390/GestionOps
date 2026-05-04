<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\ExcelImportController;
use App\Http\Controllers\InspectionController;

// Auth routes should be handled with Laravel Sanctum
// Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Dashboard metrics
    Route::get('/dashboard/metrics', [TicketController::class, 'dashboardMetrics']);

    // Tickets
    Route::get('/tickets', [TicketController::class, 'index']);
    Route::get('/tickets/{id}', [TicketController::class, 'show']);

    // Import Excel
    Route::post('/tickets/import', [ExcelImportController::class, 'import']);

    // Inspections
    Route::post('/inspections', [InspectionController::class, 'store']);
    Route::get('/inspectors/{id}/inspections', [InspectionController::class, 'myInspections']);
});
