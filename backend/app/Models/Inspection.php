<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inspection extends Model
{
    protected $fillable = [
        'ticket_id',
        'inspector_id',
        'causa_raiz',
        'observaciones',
        'resultado'
    ];

    public function ticket()
    {
        return $this->belongsTo(Ticket::class);
    }

    public function inspector()
    {
        return $this->belongsTo(Inspector::class);
    }

    public function evidences()
    {
        return $this->hasMany(InspectionEvidence::class);
    }
}
