// js/admin-sesiones.js
let sesiones = [];
let peliculas = [];
let salas = [];
let sesionAEliminar = null;

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth() || userRole !== 'ADMIN') {
        window.location.href = 'home.html';
        return;
    }
    
    cargarDatosIniciales();
});

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarPeliculas(),
            cargarSalas(),
            cargarSesiones()
        ]);
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

async function cargarPeliculas() {
    const response = await fetch(`${API_BASE_URL}/pelicula/listar`, {
        headers: getHeaders()
    });
    
    if (response.ok) {
        peliculas = await response.json();
        
        // Llenar selects
        const selectPelicula = document.getElementById('peliculaId');
        const filtroPelicula = document.getElementById('filtroPelicula');
        
        peliculas.forEach(p => {
            const option = document.createElement('option');
            option.value = p.idpelicula;
            option.textContent = p.titulo;
            selectPelicula.appendChild(option.cloneNode(true));
            filtroPelicula.appendChild(option);
        });
    }
}

async function cargarSalas() {
    const response = await fetch(`${API_BASE_URL}/sala/listar`, {
        headers: getHeaders()
    });
    
    if (response.ok) {
        salas = await response.json();
        
        const selectSala = document.getElementById('salaId');
        const filtroSala = document.getElementById('filtroSala');
        
        salas.forEach(s => {
            const option = document.createElement('option');
            option.value = s.idsala;
            option.textContent = `Sala ${s.numeroSala} - ${s.tipoSala || 'Normal'} (${s.capacidad} asientos)`;
            selectSala.appendChild(option.cloneNode(true));
            filtroSala.appendChild(option);
        });
    }
}

async function cargarSesiones() {
    const container = document.getElementById('sesionesContainer');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Cargando sesiones...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/listar`, {
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            sesiones = await response.json();
            mostrarSesiones(sesiones);
        }
    } catch (error) {
        console.error('Error cargando sesiones:', error);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error cargando sesiones</div>';
    }
}

function mostrarSesiones(sesionesAMostrar) {
    const container = document.getElementById('sesionesContainer');
    
    if (!sesionesAMostrar || sesionesAMostrar.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #718096;">
                <i class="fas fa-clock" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>No hay sesiones</h3>
                <p>Crea una nueva sesión para comenzar.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    sesionesAMostrar.forEach(sesion => {
        const pelicula = peliculas.find(p => p.idpelicula === sesion.pelicula?.idpelicula);
        const sala = salas.find(s => s.idsala === sesion.sala?.idsala);
        
        const fecha = new Date(sesion.fecha).toLocaleDateString('es-ES');
        const hora = sesion.hora ? sesion.hora.substring(0, 5) : '';
        
        html += `
            <div class="sesion-card">
                <div class="sesion-header">
                    <h3>${pelicula?.titulo || 'Película no disponible'}</h3>
                </div>
                <div class="sesion-body">
                    <div class="info-row">
                        <span><i class="fas fa-calendar"></i> Fecha:</span>
                        <span><strong>${fecha}</strong></span>
                    </div>
                    <div class="info-row">
                        <span><i class="fas fa-clock"></i> Hora:</span>
                        <span><strong>${hora}</strong></span>
                    </div>
                    <div class="info-row">
                        <span><i class="fas fa-door-closed"></i> Sala:</span>
                        <span><strong>Sala ${sala?.numeroSala || 'N/A'}</strong></span>
                    </div>
                    <div class="info-row">
                        <span><i class="fas fa-dollar-sign"></i> Precio:</span>
                        <span><strong>$${sesion.precio?.toFixed(2) || '0.00'}</strong></span>
                    </div>
                    
                    <div class="asientos-info">
                        <div class="asientos-count" style="color: ${sesion.asientosDisponibles > 0 ? '#48bb78' : '#f56565'}">
                            ${sesion.asientosDisponibles || 0}
                        </div>
                        <div>asientos disponibles de ${sala?.capacidad || '?'}</div>
                    </div>
                    
                    <div class="acciones-card">
                        <button class="btn-accion btn-editar" onclick="editarSesion(${sesion.idsesion})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn-accion btn-eliminar" onclick="confirmarEliminar(${sesion.idsesion})">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function aplicarFiltros() {
    const fecha = document.getElementById('filtroFecha').value;
    const peliculaId = document.getElementById('filtroPelicula').value;
    const salaId = document.getElementById('filtroSala').value;
    
    let filtradas = [...sesiones];
    
    if (fecha) {
        filtradas = filtradas.filter(s => {
            const fechaSesion = new Date(s.fecha).toISOString().split('T')[0];
            return fechaSesion === fecha;
        });
    }
    
    if (peliculaId) {
        filtradas = filtradas.filter(s => s.pelicula?.idpelicula == peliculaId);
    }
    
    if (salaId) {
        filtradas = filtradas.filter(s => s.sala?.idsala == salaId);
    }
    
    mostrarSesiones(filtradas);
}

function abrirModalCrear() {
    document.getElementById('modalTitulo').textContent = 'Nueva Sesión';
    document.getElementById('sesionForm').reset();
    document.getElementById('sesionId').value = '';
    
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').min = hoy;
    
    document.getElementById('sesionModal').style.display = 'flex';
}

async function editarSesion(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/sesiones/listarId/${id}`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            const sesion = await response.json();
            
            document.getElementById('modalTitulo').textContent = 'Editar Sesión';
            document.getElementById('sesionId').value = sesion.idsesion;
            document.getElementById('peliculaId').value = sesion.pelicula?.idpelicula || '';
            document.getElementById('salaId').value = sesion.sala?.idsala || '';
            
            const fecha = new Date(sesion.fecha).toISOString().split('T')[0];
            document.getElementById('fecha').value = fecha;
            document.getElementById('hora').value = sesion.hora ? sesion.hora.substring(0, 5) : '';
            document.getElementById('precio').value = sesion.precio || '';
            document.getElementById('asientosDisponibles').value = sesion.asientosDisponibles || '';
            
            document.getElementById('sesionModal').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error cargando sesión:', error);
        showError('Error cargando sesión');
    }
}

async function guardarSesion(event) {
    event.preventDefault();
    
    const id = document.getElementById('sesionId').value;
    const esEdicion = id !== '';
    
    const sesionData = {
        pelicula: { idpelicula: parseInt(document.getElementById('peliculaId').value) },
        sala: { idsala: parseInt(document.getElementById('salaId').value) },
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value + ':00',
        precio: parseFloat(document.getElementById('precio').value)
    };
    
    const asientos = document.getElementById('asientosDisponibles').value;
    if (asientos) {
        sesionData.asientosDisponibles = parseInt(asientos);
    }
    
    if (esEdicion) {
        sesionData.idsesion = parseInt(id);
    }
    
    try {
        const url = esEdicion ? `${API_BASE_URL}/sesiones/actualizar` : `${API_BASE_URL}/sesiones/crear`;
        const method = esEdicion ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(sesionData)
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            showSuccess(`Sesión ${esEdicion ? 'actualizada' : 'creada'} correctamente`);
            cerrarModal();
            await cargarSesiones();
        } else {
            const error = await response.text();
            throw new Error(error || 'Error al guardar');
        }
    } catch (error) {
        console.error('Error guardando sesión:', error);
        showError('Error al guardar: ' + error.message);
    }
}

function confirmarEliminar(id) {
    sesionAEliminar = id;
    document.getElementById('confirmModal').style.display = 'flex';
}

async function ejecutarEliminar() {
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
        }
    } catch (error) {
        console.error('Error eliminando sesión:', error);
        showError('Error al eliminar');
    }
}

function cerrarModal() {
    document.getElementById('sesionModal').style.display = 'none';
}

function cerrarConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    sesionAEliminar = null;
}