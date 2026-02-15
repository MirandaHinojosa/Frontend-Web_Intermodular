let moviesData = [];
let movieToDelete = null;

// Inicializar gestión de películas
function initPeliculas() {
    checkAuth();
    
    // Verificar que el usuario sea ADMIN
    if (userRole !== 'ADMIN') {
        alert('No tienes permisos para acceder a esta página');
        window.location.href = 'home.html';
        return;
    }
    
    loadMovies();
    
    // Configurar evento para cerrar modal con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirmModal();
        }
    });

    // Agregar evento para previsualizar imagen cuando se cambia el campo
    const imagenInput = document.getElementById('imagen');
    if (imagenInput) {
        imagenInput.addEventListener('input', function(e) {
            previewImage(e.target.value);
        });
    }
}

// Función para previsualizar imagen
function previewImage(url) {
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('imagePreview');
    
    if (url && url.trim() !== '') {
        previewImg.src = url;
        previewContainer.style.display = 'block';
        
        // Manejar error de carga de imagen
        previewImg.onerror = function() {
            previewImg.src = 'https://via.placeholder.com/200x200?text=Error+al+cargar+imagen';
        };
    } else {
        previewContainer.style.display = 'none';
        previewImg.src = '';
    }
}

// Cargar películas
async function loadMovies() {
    const tbody = document.getElementById('moviesTableBody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">Cargando...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/pelicula/listar-todas`, {
            method: 'GET',
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        moviesData = await response.json();
        
        if (moviesData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No hay películas registradas</td></tr>';
            return;
        }
        
        renderMoviesTable();
        
    } catch (error) {
        console.error('Error cargando películas:', error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">${error.message}</td></tr>`;
    }
}

// Renderizar tabla de películas
function renderMoviesTable() {
    const tbody = document.getElementById('moviesTableBody');
    tbody.innerHTML = '';
    
    moviesData.forEach(movie => {
        const row = document.createElement('tr');
        
        // Formatear fecha
        const fecha = movie.fecha_publicacion ? 
            new Date(movie.fecha_publicacion).toLocaleDateString('es-ES') : 
            'No especificada';
        
        // Crear miniatura de imagen si existe URL
        const imagenThumb = movie.imagen ? 
            `<img src="${movie.imagen}" alt="${movie.titulo}" style="width: 50px; height: 70px; object-fit: cover; border-radius: 3px;" onerror="this.src='https://via.placeholder.com/50x70?text=No+imagen'">` : 
            '<span style="color: #999;">Sin imagen</span>';
        
        row.innerHTML = `
            <td>${movie.idpelicula}</td>
            <td>${imagenThumb}</td>
            <td><strong>${movie.titulo || 'Sin título'}</strong></td>
            <td>${movie.duracion_minutos || '0'} min</td>
            <td>${movie.clasificacion || 'No especificada'}</td>
            <td>${movie.genero || 'No especificado'}</td>
            <td>
                <span class="${movie.estado ? 'status-active' : 'status-inactive'}">
                    ${movie.estado ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>${fecha}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" style="background: #4299e1; color: white;" 
                            onclick="editMovie(${movie.idpelicula})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" style="background: #f56565; color: white;" 
                            onclick="showDeleteConfirm(${movie.idpelicula}, '${movie.titulo.replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Actualizar el colspan del mensaje de "No hay películas" si es necesario
    const thCount = document.querySelectorAll('#moviesTable thead th').length;
    if (thCount > 0) {
        // Ya está actualizado en el HTML
    }
}

// Abrir modal para crear/editar
function openModal(mode, movieId = null) {
    const modal = document.getElementById('movieModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('movieForm');
    const previewContainer = document.getElementById('imagePreviewContainer');
    
    if (mode === 'create') {
        modalTitle.textContent = 'Nueva Película';
        form.reset();
        document.getElementById('movieId').value = '';
        document.getElementById('estado').value = 'true';
        document.getElementById('imagen').value = '';
        previewContainer.style.display = 'none';
    } else if (mode === 'edit' && movieId) {
        modalTitle.textContent = 'Editar Película';
        const movie = moviesData.find(m => m.idpelicula === movieId);
        
        if (movie) {
            document.getElementById('movieId').value = movie.idpelicula;
            document.getElementById('titulo').value = movie.titulo || '';
            document.getElementById('duracion_minutos').value = movie.duracion_minutos || '';
            document.getElementById('clasificacion').value = movie.clasificacion || '';
            document.getElementById('genero').value = movie.genero || '';
            document.getElementById('fecha_publicacion').value = movie.fecha_publicacion || '';
            document.getElementById('estado').value = movie.estado ? 'true' : 'false';
            document.getElementById('imagen').value = movie.imagen || '';
            
            // Mostrar vista previa si hay imagen
            if (movie.imagen) {
                previewImage(movie.imagen);
            } else {
                previewContainer.style.display = 'none';
            }
        }
    }
    
    modal.style.display = 'flex';
}

// Cerrar modal
function closeModal() {
    document.getElementById('movieModal').style.display = 'none';
}

// Guardar película (crear o actualizar)
async function saveMovie(event) {
    event.preventDefault();
    
    const movieId = document.getElementById('movieId').value;
    const isEdit = !!movieId;
    
    const movieData = {
        titulo: document.getElementById('titulo').value,
        duracion_minutos: parseInt(document.getElementById('duracion_minutos').value),
        clasificacion: document.getElementById('clasificacion').value || null,
        genero: document.getElementById('genero').value || null,
        estado: document.getElementById('estado').value === 'true',
        fecha_publicacion: document.getElementById('fecha_publicacion').value || null,
        imagen: document.getElementById('imagen').value || null
    };
    
    // Si es edición, agregar el ID
    if (isEdit) {
        movieData.idpelicula = parseInt(movieId);
    }
    
    try {
        const url = isEdit ? 
            `${API_BASE_URL}/pelicula/actualizar` : 
            `${API_BASE_URL}/pelicula/crear`;
        
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(movieData)
        });
        
        checkTokenExpired(response);
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        closeModal();
        showSuccess(`Película ${isEdit ? 'actualizada' : 'creada'} correctamente`);
        loadMovies();
        
    } catch (error) {
        console.error('Error guardando película:', error);
        showError(`Error al guardar: ${error.message}`);
    }
}

// Editar película
function editMovie(movieId) {
    openModal('edit', movieId);
}

// Mostrar confirmación para eliminar
function showDeleteConfirm(movieId, movieTitle) {
    movieToDelete = movieId;
    document.getElementById('confirmMessage').textContent = 
        `¿Estás seguro de que quieres eliminar la película "${movieTitle}"?`;
    document.getElementById('confirmModal').style.display = 'flex';
}

// Cerrar modal de confirmación
function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
    movieToDelete = null;
}

// Confirmar eliminación
async function confirmDelete() {
    if (!movieToDelete) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/pelicula/eliminar/${movieToDelete}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        
        closeConfirmModal();
        showSuccess('Película eliminada correctamente');
        loadMovies();
        
    } catch (error) {
        console.error('Error eliminando película:', error);
        showError(`Error al eliminar: ${error.message}`);
    }
}

// Refrescar lista
function refreshMovies() {
    loadMovies();
    showSuccess('Lista actualizada');
}

// Inicializar eventos cuando se carga la página
window.onload = initPeliculas;