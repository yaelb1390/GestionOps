<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Technician extends Model
{
    protected $fillable = ['tecnico', 'nombre_tecnico', 'supervisor_id'];

    public function supervisor()
    {
        return $this->belongsTo(Supervisor::class);
    }

    public function tickets()
    {
        return $this->hasMany(Ticket::class);
    }
}
