<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supervisor extends Model
{
    protected $fillable = ['nombre'];

    public function technicians()
    {
        return $this->hasMany(Technician::class);
    }
}
