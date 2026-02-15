// Variables globales
let sesiones = [];
let peliculas = [];
let salas = [];
let sesionAEliminar = null;
let filtrosActivos = {
    fecha: '',
    peliculaId: '',
    salaId: '',
    estado: ''
};

// Inicialización
async function initSesiones() {
    try {
        await cargarDatosIniciales();
        await cargarSesiones();
        setupEventListeners();
    } catch (error) {
        showError('Error al inicializar: ' + error.message);
    }
}

// Cargar datos iniciales (películas y salas)
async function cargarDatosIniciales() {
    try {
        // Cargar películas
        const peliculasResponse = await fetch(`${API_BASE_URL}/pelicula/listar`, {
            headers: getHeaders()
        });
        
        if (peliculasResponse.ok) {
            peliculas = await peliculasResponse.json();
            cargarSelectPeliculas();
            cargarFiltroPeliculas();
        }

        // Cargar salas
        const salasResponse = await fetch(`${API_BASE_URL}/sala/listar`, {
            headers: getHeaders()
        });
        
        if (salasResponse.ok) {
            salas = await salasResponse.json();
            cargarSelectSalas();
            cargarFiltroSalas();
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// Cargar sesiones
async function cargarSesiones() {
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/listar`, {
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            sesiones = await response.json();
            aplicarFiltros();
        } else {
            throw new Error('Error al cargar sesiones');
        }
    } catch (error) {
        showError('Error: ' + error.message);
        sesiones = [];
        mostrarSesiones([]);
    }
}

// Mostrar sesiones en la lista
function mostrarSesiones(sesionesAMostrar) {
    const container = document.getElementById('sesionesLista');
    
    if (!sesionesAMostrar || sesionesAMostrar.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>No hay sesiones disponibles</h3>
                <p>No se encontraron sesiones con los filtros aplicados.</p>
                <button class="btn btn-primary" onclick="limpiarFiltros()">
                    <i class="fas fa-undo"></i> Limpiar filtros
                </button>
            </div>
        `;
        return;
    }

    let html = '<div class="sesiones-grid">';
    
    sesionesAMostrar.forEach(sesion => {
        const pelicula = peliculas.find(p => p.idpelicula === sesion.pelicula?.idpelicula);
        const sala = salas.find(s => s.idsala === sesion.sala?.idsala);
        
        const fechaFormateada = new Date(sesion.fecha).toLocaleDateString('es-ES');
        const horaFormateada = sesion.hora ? sesion.hora.substring(0, 5) : '';
        
        // Determinar estado de asientos
        let estadoAsientos = '';
        let badgeClass = '';
        if (sesion.asientosDisponibles > 10) {
            estadoAsientos = 'Disponible';
            badgeClass = 'badge-success';
        } else if (sesion.asientosDisponibles > 0) {
            estadoAsientos = 'Últimos lugares';
            badgeClass = 'badge-warning';
        } else {
            estadoAsientos = 'Agotado';
            badgeClass = 'badge-danger';
        }

        html += `
            <div class="sesion-card">
                <div class="sesion-header">
                    <h3 class="sesion-title">${pelicula?.titulo || 'Película no encontrada'}</h3>
                    <p class="sesion-subtitle">Sala ${sala?.nombre || 'N/A'} - ${sala?.tipo || ''}</p>
                </div>
                <div class="sesion-body">
                    <div class="sesion-info">
                        <div class="info-row">
                            <span class="info-label"><i class="far fa-calendar"></i> Fecha:</span>
                            <span class="info-value">${fechaFormateada}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label"><i class="far fa-clock"></i> Hora:</span>
                            <span class="info-value">${horaFormateada}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label"><i class="fas fa-dollar-sign"></i> Precio:</span>
                            <span class="info-value">$${sesion.precio?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label"><i class="fas fa-chair"></i> Estado:</span>
                            <span class="badge ${badgeClass}">${estadoAsientos}</span>
                        </div>
                    </div>
                    
                    <div class="asientos-info">
                        <div class="asientos-count">${sesion.asientosDisponibles}</div>
                        <div>asientos disponibles</div>
                        <small>Capacidad: ${sala?.capacidad || 'N/A'}</small>
                    </div>
                    
                    <div class="sesion-actions">
                        <button class="btn btn-sm btn-primary btn-block" onclick="verDetalle(${sesion.idsesion})">
                            <i class="fas fa-eye"></i> Ver Detalle
                        </button>
                        ${hasRole('ADMIN') ? `
                        <button class="btn btn-sm btn-success" onclick="editarSesion(${sesion.idsesion})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarSesion(${sesion.idsesion})">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Ver detalle de sesión
async function verDetalle(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/listarId/${id}`, {
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            const sesion = await response.json();
            mostrarModalDetalle(sesion);
        }
    } catch (error) {
        showError('Error al cargar detalle: ' + error.message);
    }
}

// Mostrar modal de detalle
function mostrarModalDetalle(sesion) {
    const pelicula = peliculas.find(p => p.idpelicula === sesion.pelicula?.idpelicula);
    const sala = salas.find(s => s.idsala === sesion.sala?.idsala);
    const fechaFormateada = new Date(sesion.fecha).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Detalle de Sesión</h3>
                <span onclick="cerrarModal()" style="cursor: pointer; font-size: 20px;">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 48px; color: #667eea; margin-bottom: 10px;">
                        <i class="fas fa-clock"></i>
                    </div>
                    <h2>${pelicula?.titulo || 'N/A'}</h2>
                </div>
                
                <div class="info-detalle">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                            <h4><i class="fas fa-info-circle"></i> Información</h4>
                            <p><strong>Fecha:</strong> ${fechaFormateada}</p>
                            <p><strong>Hora:</strong> ${sesion.hora?.substring(0, 5)}</p>
                            <p><strong>Precio:</strong> $${sesion.precio?.toFixed(2)}</p>
                        </div>
                        
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                            <h4><i class="fas fa-door-closed"></i> Sala</h4>
                            <p><strong>Nombre:</strong> ${sala?.nombre || 'N/A'}</p>
                            <p><strong>Tipo:</strong> ${sala?.tipo || 'N/A'}</p>
                            <p><strong>Capacidad:</strong> ${sala?.capacidad || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; text-align: center;">
                        <h4><i class="fas fa-chair"></i> Disponibilidad</h4>
                        <div style="font-size: 36px; font-weight: bold; color: ${sesion.asientosDisponibles > 0 ? '#10b981' : '#ef4444'}">
                            ${sesion.asientosDisponibles}
                        </div>
                        <p>asientos disponibles de ${sala?.capacidad || 'N/A'}</p>
                    </div>
                    
                    ${pelicula ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
                        <h4><i class="fas fa-film"></i> Información de la Película</h4>
                        <p><strong>Duración:</strong> ${pelicula.duracion || 'N/A'} minutos</p>
                        <p><strong>Género:</strong> ${pelicula.genero || 'N/A'}</p>
                        <p><strong>Clasificación:</strong> ${pelicula.clasificacion || 'N/A'}</p>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="cerrarModal()">Cerrar</button>
                ${hasRole('ADMIN') ? `
                <button class="btn btn-primary" onclick="editarSesion(${sesion.idsesion})">
                    <i class="fas fa-edit"></i> Editar Sesión
                </button>
                ` : ''}
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    
    // Cerrar modal al hacer clic fuera
    modal.onclick = function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

// Mostrar modal para crear sesión
function mostrarModalCrear() {
    if (!hasRole('ADMIN')) {
        showError('Solo los administradores pueden crear sesiones');
        return;
    }
    
    document.getElementById('modalTitulo').textContent = 'Nueva Sesión';
    document.getElementById('sesionForm').reset();
    document.getElementById('sesionId').value = '';
    document.getElementById('sesionModal').style.display = 'block';
    
    // Establecer fecha mínima como hoy
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').min = hoy;
}

// Editar sesión
async function editarSesion(id) {
    if (!hasRole('ADMIN')) {
        showError('Solo los administradores pueden editar sesiones');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/listarId/${id}`, {
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            const sesion = await response.json();
            llenarFormularioEdicion(sesion);
        }
    } catch (error) {
        showError('Error al cargar sesión: ' + error.message);
    }
}

// Llenar formulario para edición
function llenarFormularioEdicion(sesion) {
    document.getElementById('modalTitulo').textContent = 'Editar Sesión';
    document.getElementById('sesionId').value = sesion.idsesion;
    
    // Formatear fecha para el input date
    const fecha = new Date(sesion.fecha);
    const fechaFormateada = fecha.toISOString().split('T')[0];
    
    document.getElementById('pelicula').value = sesion.pelicula?.idpelicula || '';
    document.getElementById('sala').value = sesion.sala?.idsala || '';
    document.getElementById('fecha').value = fechaFormateada;
    document.getElementById('hora').value = sesion.hora?.substring(0, 5) || '';
    document.getElementById('precio').value = sesion.precio || '';
    document.getElementById('asientosDisponibles').value = sesion.asientosDisponibles || '';
    
    document.getElementById('sesionModal').style.display = 'block';
}

// Guardar sesión (crear o actualizar)
async function guardarSesion(event) {
    event.preventDefault();
    
    if (!hasRole('ADMIN')) {
        showError('Solo los administradores pueden guardar sesiones');
        return;
    }
    
    const id = document.getElementById('sesionId').value;
    const esEdicion = id !== '';
    
    const sesionData = {
        pelicula: { idpelicula: parseInt(document.getElementById('pelicula').value) },
        sala: { idsala: parseInt(document.getElementById('sala').value) },
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value + ':00',
        precio: parseFloat(document.getElementById('precio').value),
        asientosDisponibles: document.getElementById('asientosDisponibles').value ? 
            parseInt(document.getElementById('asientosDisponibles').value) : null
    };
    
    const url = esEdicion ? `${API_BASE_URL}/sesiones/actualizar` : `${API_BASE_URL}/sesiones/crear`;
    const method = esEdicion ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(esEdicion ? { ...sesionData, idsesion: parseInt(id) } : sesionData)
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            showSuccess(`Sesión ${esEdicion ? 'actualizada' : 'creada'} correctamente`);
            cerrarModal();
            await cargarSesiones();
        } else {
            const error = await response.text();
            throw new Error(error || 'Error al guardar la sesión');
        }
    } catch (error) {
        showError('Error: ' + error.message);
    }
}

// Eliminar sesión
function eliminarSesion(id) {
    if (!hasRole('ADMIN')) {
        showError('Solo los administradores pueden eliminar sesiones');
        return;
    }
    
    sesionAEliminar = id;
    document.getElementById('confirmModal').style.display = 'block';
}

// Confirmar eliminación
async function confirmarEliminar() {
    if (!sesionAEliminar) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/eliminar/${sesionAEliminar}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            showSuccess('Sesión eliminada correctamente');
            cerrarConfirmModal();
            await cargarSesiones();
        } else {
            throw new Error('Error al eliminar la sesión');
        }
    } catch (error) {
        showError('Error: ' + error.message);
    } finally {
        sesionAEliminar = null;
    }
}

// Aplicar filtros
function aplicarFiltros() {
    filtrosActivos.fecha = document.getElementById('filtroFecha').value;
    filtrosActivos.peliculaId = document.getElementById('filtroPelicula').value;
    filtrosActivos.salaId = document.getElementById('filtroSala').value;
    filtrosActivos.estado = document.getElementById('filtroEstado').value;
    
    let sesionesFiltradas = [...sesiones];
    
    // Filtrar por fecha
    if (filtrosActivos.fecha) {
        const fechaFiltro = new Date(filtrosActivos.fecha).toISOString().split('T')[0];
        sesionesFiltradas = sesionesFiltradas.filter(s => 
            new Date(s.fecha).toISOString().split('T')[0] === fechaFiltro
        );
    }
    
    // Filtrar por película
    if (filtrosActivos.peliculaId) {
        sesionesFiltradas = sesionesFiltradas.filter(s => 
            s.pelicula?.idpelicula == filtrosActivos.peliculaId
        );
    }
    
    // Filtrar por sala
    if (filtrosActivos.salaId) {
        sesionesFiltradas = sesionesFiltradas.filter(s => 
            s.sala?.idsala == filtrosActivos.salaId
        );
    }
    
    // Filtrar por estado de asientos
    if (filtrosActivos.estado === 'disponibles') {
        sesionesFiltradas = sesionesFiltradas.filter(s => s.asientosDisponibles > 0);
    } else if (filtrosActivos.estado === 'agotados') {
        sesionesFiltradas = sesionesFiltradas.filter(s => s.asientosDisponibles === 0);
    }
    
    // Ordenar por fecha y hora
    sesionesFiltradas.sort((a, b) => {
        const fechaA = new Date(a.fecha + 'T' + a.hora);
        const fechaB = new Date(b.fecha + 'T' + b.hora);
        return fechaA - fechaB;
    });
    
    mostrarSesiones(sesionesFiltradas);
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('filtroFecha').value = '';
    document.getElementById('filtroPelicula').value = '';
    document.getElementById('filtroSala').value = '';
    document.getElementById('filtroEstado').value = '';
    
    filtrosActivos = {
        fecha: '',
        peliculaId: '',
        salaId: '',
        estado: ''
    };
    
    mostrarSesiones(sesiones);
}

// Cargar select de películas en formulario
function cargarSelectPeliculas() {
    const select = document.getElementById('pelicula');
    select.innerHTML = '<option value="">Seleccionar película</option>';
    
    peliculas.forEach(pelicula => {
        const option = document.createElement('option');
        option.value = pelicula.idpelicula;
        option.textContent = pelicula.titulo;
        select.appendChild(option);
    });
}

// Cargar select de salas en formulario
function cargarSelectSalas() {
    const select = document.getElementById('sala');
    select.innerHTML = '<option value="">Seleccionar sala</option>';
    
    salas.forEach(sala => {
        const option = document.createElement('option');
        option.value = sala.idsala;
        option.textContent = `${sala.nombre} - ${sala.tipo} (Cap: ${sala.capacidad})`;
        option.dataset.capacidad = sala.capacidad;
        select.appendChild(option);
    });
}

// Cargar filtro de películas
function cargarFiltroPeliculas() {
    const select = document.getElementById('filtroPelicula');
    
    peliculas.forEach(pelicula => {
        const option = document.createElement('option');
        option.value = pelicula.idpelicula;
        option.textContent = pelicula.titulo;
        select.appendChild(option);
    });
}

// Cargar filtro de salas
function cargarFiltroSalas() {
    const select = document.getElementById('filtroSala');
    
    salas.forEach(sala => {
        const option = document.createElement('option');
        option.value = sala.idsala;
        option.textContent = `Número: ${sala.numeroSala} - Tipo sala: ${sala.tipoSala}`;
        select.appendChild(option);
    });
}

// Actualizar capacidad cuando se selecciona una sala
function actualizarCapacidad() {
    const salaSelect = document.getElementById('sala');
    const asientosInput = document.getElementById('asientosDisponibles');
    const selectedOption = salaSelect.options[salaSelect.selectedIndex];
    
    if (selectedOption && selectedOption.dataset.capacidad) {
        asientosInput.placeholder = `Capacidad: ${selectedOption.dataset.capacidad}`;
    }
}

// Cerrar modal
function cerrarModal() {
    document.getElementById('sesionModal').style.display = 'none';
}

// Cerrar modal de confirmación
function cerrarConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    sesionAEliminar = null;
}

// Setup event listeners
function setupEventListeners() {
    // Cerrar modales al hacer clic fuera
    window.onclick = function(event) {
        const modal = document.getElementById('sesionModal');
        const confirmModal = document.getElementById('confirmModal');
        
        if (event.target === modal) {
            cerrarModal();
        }
        if (event.target === confirmModal) {
            cerrarConfirmModal();
        }
    };
    
    // Permitir Enter en filtros
    document.querySelectorAll('.filtro-input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                aplicarFiltros();
            }
        });
    });
}