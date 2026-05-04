<?php

namespace App\Imports;

use App\Models\Supervisor;
use App\Models\Technician;
use App\Models\Ticket;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Concerns\WithBatchInserts;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Carbon\Carbon;

class TicketsImport implements ToModel, WithStartRow, WithBatchInserts, WithChunkReading
{
    public function startRow(): int
    {
        return 2; // Ignorar encabezados
    }

    public function model(array $row)
    {
        // Orden esperado según requerimiento:
        // 0 tecnico
        // 1 nombre_tecnico
        // 2 estado
        // 3 trabajo
        // 4 nombre_supervisor
        // 5 sector
        // 6 clasificacion_prioridad
        
        if (!isset($row[0]) || !isset($row[3])) {
            return null; // Skip invalid rows
        }

        // 1. Obtener o crear Supervisor
        $supervisor = Supervisor::firstOrCreate(
            ['nombre' => $row[4] ?? 'Sin Supervisor']
        );

        // 2. Obtener o crear Técnico
        $technician = Technician::firstOrCreate(
            ['tecnico' => $row[0]],
            [
                'nombre_tecnico' => $row[1] ?? 'Desconocido',
                'supervisor_id' => $supervisor->id
            ]
        );

        // Actualizar datos del técnico por si cambiaron de supervisor
        if ($technician->supervisor_id !== $supervisor->id || $technician->nombre_tecnico !== $row[1]) {
            $technician->update([
                'nombre_tecnico' => $row[1] ?? 'Desconocido',
                'supervisor_id' => $supervisor->id
            ]);
        }

        // 3. Crear o actualizar el Ticket (trabajo es el ID unico)
        return Ticket::updateOrCreate(
            ['trabajo' => $row[3]],
            [
                'technician_id' => $technician->id,
                'estado' => $row[2] ?? 'Pendiente',
                'sector' => $row[5] ?? 'Sin sector',
                'clasificacion_prioridad' => $row[6] ?? 'Normal',
                'tipo_averia' => $row[7] ?? null, // Asumiendo que puede venir en 7
                'fecha_servicio' => isset($row[8]) ? \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($row[8]) : Carbon::now(),
            ]
        );
    }

    public function batchSize(): int
    {
        return 1000;
    }

    public function chunkSize(): int
    {
        return 1000;
    }
}
