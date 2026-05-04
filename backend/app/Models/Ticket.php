<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    protected $fillable = [
        'trabajo',
        'technician_id',
        'estado',
        'sector',
        'clasificacion_prioridad',
        'tipo_averia',
        'fecha_servicio'
    ];

    public function technician()
    {
        return $this->belongsTo(Technician::class);
    }

    public function inspections()
    {
        return $this->hasMany(Inspection::class);
    }
}
