// js/comprar-boletos.js
let sesionesDisponibles = [];
let peliculas = [];
let sesionSeleccionada = null;
let asientosOcupados = [];
let asientoSeleccionado = null;
let tipoEntradaSeleccionado = 'ADULTO';

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    cargarPeliculas();
    cargarSesiones();
    configurarFiltros();
});

async function cargarPeliculas() {
    try {
        const response = await fetch(`${API_BASE_URL}/pelicula/listar`, {
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            peliculas = await response.json();
            const select = document.getElementById('filtroPelicula');
            
            peliculas.forEach(pelicula => {
                const option = document.createElement('option');
                option.value = pelicula.idpelicula;
                option.textContent = pelicula.titulo;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando películas:', error);
    }
}

async function cargarSesiones() {
    const container = document.getElementById('sesionesContainer');
    container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Cargando sesiones...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/listar`, {
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            sesionesDisponibles = await response.json();
            
            // Filtrar solo sesiones futuras con asientos disponibles
            const ahora = new Date();
            sesionesDisponibles = sesionesDisponibles.filter(s => {
                const fechaSesion = new Date(s.fecha + 'T' + s.hora);
                return fechaSesion > ahora && s.asientosDisponibles > 0;
            });
            
            mostrarSesiones(sesionesDisponibles);
        }
    } catch (error) {
        console.error('Error cargando sesiones:', error);
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i> Error cargando sesiones</div>';
    }
}

function mostrarSesiones(sesiones) {
    const container = document.getElementById('sesionesContainer');
    
    if (!sesiones || sesiones.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>No hay sesiones disponibles</h3>
                <p>No se encontraron sesiones con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    sesiones.forEach(sesion => {
        const pelicula = peliculas.find(p => p.idpelicula === sesion.pelicula?.idpelicula) || { titulo: 'Película no disponible' };
        const fecha = new Date(sesion.fecha).toLocaleDateString('es-ES');
        const hora = sesion.hora ? sesion.hora.substring(0, 5) : '';
        
        html += `
            <div class="sesion-card" onclick="seleccionarSesion(${sesion.idsesion})">
                <div class="sesion-header">
                    <h3>${pelicula.titulo}</h3>
                </div>
                <div class="sesion-body">
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-calendar"></i> Fecha:</span>
                        <span class="info-value">${fecha}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-clock"></i> Hora:</span>
                        <span class="info-value">${hora}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-dollar-sign"></i> Precio:</span>
                        <span class="info-value">$${sesion.precio?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label"><i class="fas fa-door-closed"></i> Sala:</span>
                        <span class="info-value">Sala ${sesion.sala?.numeroSala || 'N/A'}</span>
                    </div>
                    
                    <div class="asientos-disponibles">
                        <div class="asientos-count">${sesion.asientosDisponibles}</div>
                        <div>asientos disponibles</div>
                    </div>
                    
                    <button class="btn-comprar" onclick="event.stopPropagation(); abrirModalCompra(${sesion.idsesion})">
                        <i class="fas fa-shopping-cart"></i> Comprar
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function configurarFiltros() {
    const filtroFecha = document.getElementById('filtroFecha');
    const hoy = new Date().toISOString().split('T')[0];
    filtroFecha.min = hoy;
}

function aplicarFiltros() {
    const fecha = document.getElementById('filtroFecha').value;
    const peliculaId = document.getElementById('filtroPelicula').value;
    const ordenar = document.getElementById('ordenarPor').value;
    
    let filtradas = [...sesionesDisponibles];
    
    if (fecha) {
        filtradas = filtradas.filter(s => {
            const fechaSesion = new Date(s.fecha).toISOString().split('T')[0];
            return fechaSesion === fecha;
        });
    }
    
    if (peliculaId) {
        filtradas = filtradas.filter(s => s.pelicula?.idpelicula == peliculaId);
    }
    
    if (ordenar === 'fecha') {
        filtradas.sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora));
    } else if (ordenar === 'precio') {
        filtradas.sort((a, b) => a.precio - b.precio);
    }
    
    mostrarSesiones(filtradas);
}

function seleccionarSesion(id) {
    sesionSeleccionada = sesionesDisponibles.find(s => s.idsesion === id);
    document.querySelectorAll('.sesion-card').forEach(c => c.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

async function abrirModalCompra(sesionId) {
    sesionSeleccionada = sesionesDisponibles.find(s => s.idsesion === sesionId);
    
    if (!sesionSeleccionada) return;
    
    // Mostrar información de la sesión
    const pelicula = peliculas.find(p => p.idpelicula === sesionSeleccionada.pelicula?.idpelicula);
    const fecha = new Date(sesionSeleccionada.fecha).toLocaleDateString('es-ES');
    const hora = sesionSeleccionada.hora ? sesionSeleccionada.hora.substring(0, 5) : '';
    
    document.getElementById('sesionInfo').innerHTML = `
        <h3>${pelicula?.titulo || 'Película'}</h3>
        <p><strong>Fecha:</strong> ${fecha} - ${hora}</p>
        <p><strong>Sala:</strong> ${sesionSeleccionada.sala?.numeroSala || 'N/A'}</p>
        <p><strong>Precio base:</strong> $${sesionSeleccionada.precio?.toFixed(2) || '0.00'}</p>
    `;
    
    // Cargar asientos
    await cargarAsientosSesion(sesionId);
    
    // Resetear selecciones
    asientoSeleccionado = null;
    tipoEntradaSeleccionado = 'ADULTO';
    actualizarPrecio();
    
    document.getElementById('compraModal').style.display = 'flex';
}

async function cargarAsientosSesion(sesionId) {
    try {
        const sesion = sesionesDisponibles.find(s => s.idsesion === sesionId);
        if (!sesion || !sesion.sala) return;
        
        const salaId = sesion.sala.idSala || sesion.sala.idsala;
        
        // Obtener asientos ocupados
        const responseOcupados = await fetch(`${API_BASE_URL}/boletos/asientos-ocupados/${sesionId}`, {
            headers: getHeaders()
        });
        
        if (responseOcupados.ok) {
            asientosOcupados = await responseOcupados.json();
        }
        
        // Obtener asientos de la sala
        const responseAsientos = await fetch(`${API_BASE_URL}/asiento/porsala/${salaId}`, {
            headers: getHeaders()
        });
        
        if (responseAsientos.ok) {
            const asientosSala = await responseAsientos.json();
            generarGridAsientos(asientosSala);
        }
    } catch (error) {
        console.error('Error cargando asientos:', error);
    }
}

function generarGridAsientos(asientos) {
    const grid = document.getElementById('seatGrid');
    grid.innerHTML = '';
    
    if (!asientos || asientos.length === 0) {
        grid.innerHTML = '<div style="grid-column: span 10; text-align: center; padding: 20px;">No hay asientos configurados</div>';
        return;
    }
    
    // Encontrar máximo de columnas
    const maxColumna = Math.max(...asientos.map(a => parseInt(a.columna) || 1));
    grid.style.gridTemplateColumns = `repeat(${maxColumna}, 1fr)`;
    
    // Ordenar por fila y columna
    asientos.sort((a, b) => {
        const filaA = a.fila || 'A';
        const filaB = b.fila || 'A';
        if (filaA !== filaB) return filaA.localeCompare(filaB);
        return (a.columna || 0) - (b.columna || 0);
    });
    
    asientos.forEach(asiento => {
        const seatDiv = document.createElement('div');
        const numeroAsiento = asiento.numeroAsiento || `${asiento.fila}${asiento.columna}`;
        const estaOcupado = asientosOcupados.includes(numeroAsiento);
        const estaDisponible = asiento.estado === true || asiento.estado === 'true' || asiento.estado === 1;
        
        seatDiv.className = 'seat-item';
        seatDiv.textContent = numeroAsiento;
        seatDiv.dataset.asiento = numeroAsiento;
        
        if (estaOcupado || !estaDisponible) {
            seatDiv.classList.add('seat-occupied');
        } else {
            seatDiv.onclick = () => seleccionarAsiento(numeroAsiento);
        }
        
        grid.appendChild(seatDiv);
    });
}

function seleccionarAsiento(asiento) {
    document.querySelectorAll('.seat-selected').forEach(s => {
        s.classList.remove('seat-selected');
        s.classList.add('seat-available');
    });
    
    const seatElement = document.querySelector(`[data-asiento="${asiento}"]`);
    if (seatElement) {
        seatElement.classList.remove('seat-available');
        seatElement.classList.add('seat-selected');
        asientoSeleccionado = asiento;
        actualizarPrecio();
    }
}

function seleccionarTipoEntrada(tipo) {
    tipoEntradaSeleccionado = tipo;
    
    document.querySelectorAll('.tipo-entrada-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById(`tipo${tipo}`).classList.add('selected');
    
    actualizarPrecio();
}

function actualizarPrecio() {
    if (!sesionSeleccionada) return;
    
    const precioBase = sesionSeleccionada.precio || 0;
    let descuento = 0;
    let tipoTexto = 'Adulto';
    
    switch(tipoEntradaSeleccionado) {
        case 'MENOR':
            descuento = 0.5;
            tipoTexto = 'Menor (50% descuento)';
            document.getElementById('descuentoPorcentaje').textContent = '50%';
            break;
        case 'ESTUDIANTE':
            descuento = 0.25;
            tipoTexto = 'Estudiante (25% descuento)';
            document.getElementById('descuentoPorcentaje').textContent = '25%';
            break;
        default:
            descuento = 0;
            tipoTexto = 'Adulto (sin descuento)';
            document.getElementById('descuentoPorcentaje').textContent = '0%';
    }
    
    const total = precioBase * (1 - descuento);
    
    document.getElementById('precioBase').textContent = precioBase.toFixed(2);
    document.getElementById('tipoDescuento').textContent = tipoTexto;
    document.getElementById('totalPagar').textContent = total.toFixed(2);
}

async function confirmarCompra() {
    if (!asientoSeleccionado) {
        showError('Debes seleccionar un asiento');
        return;
    }
    
    if (!sesionSeleccionada) {
        showError('Error: sesión no seleccionada');
        return;
    }
    
    const precioTotal = sesionSeleccionada.precio * (tipoEntradaSeleccionado === 'MENOR' ? 0.5 : tipoEntradaSeleccionado === 'ESTUDIANTE' ? 0.75 : 1);
    
    const boletoData = {
        sesion: { idsesion: sesionSeleccionada.idsesion },
        numeroAsiento: asientoSeleccionado,
        tipoEntrada: tipoEntradaSeleccionado,
        estado: 'PAGADO',
        precioPagado: precioTotal,
        fechaCompra: new Date().toISOString()
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/boletos/crear`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(boletoData)
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            showSuccess('¡Boleto comprado exitosamente!');
            cerrarModalCompra();
            cargarSesiones(); // Recargar para actualizar disponibilidad
        } else {
            const error = await response.text();
            throw new Error(error || 'Error al comprar boleto');
        }
    } catch (error) {
        console.error('Error comprando boleto:', error);
        showError('Error al comprar el boleto: ' + error.message);
    }
}

function cerrarModalCompra() {
    document.getElementById('compraModal').style.display = 'none';
    asientoSeleccionado = null;
}