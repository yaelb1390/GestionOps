<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supervisors', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->timestamps();
        });

        Schema::create('technicians', function (Blueprint $table) {
            $table->id();
            $table->string('tecnico')->unique(); // Tarjeta tecnico
            $table->string('nombre_tecnico');
            $table->foreignId('supervisor_id')->constrained('supervisors')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::create('tickets', function (Blueprint $table) {
            $table->id();
            $table->string('trabajo')->unique(); // Numero de ticket
            $table->foreignId('technician_id')->constrained('technicians')->onDelete('cascade');
            $table->string('estado');
            $table->string('sector')->nullable();
            $table->string('clasificacion_prioridad')->nullable();
            $table->string('tipo_averia')->nullable();
            $table->date('fecha_servicio')->nullable();
            $table->timestamps();
        });

        Schema::create('inspectors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('nombre');
            $table->timestamps();
        });

        Schema::create('inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('tickets')->onDelete('cascade');
            $table->foreignId('inspector_id')->constrained('inspectors')->onDelete('cascade');
            $table->string('causa_raiz');
            $table->text('observaciones')->nullable();
            $table->string('resultado'); // Aprobado, Requiere corrección, Rechazado
            $table->timestamps();
        });

        Schema::create('inspection_evidences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('inspections')->onDelete('cascade');
            $table->string('foto_path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_evidences');
        Schema::dropIfExists('inspections');
        Schema::dropIfExists('inspectors');
        Schema::dropIfExists('tickets');
        Schema::dropIfExists('technicians');
        Schema::dropIfExists('supervisors');
    }
};
