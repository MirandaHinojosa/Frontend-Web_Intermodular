// sala.js - VERSIÓN CORREGIDA
(function() {
    let salaData = [];
    let salaToDelete = null;

    // Inicializar gestión de sala
    window.initSala = function() {
        checkAuth();
        
        // Verificar que el usuario sea ADMIN
        if (userRole !== 'ADMIN') {
            alert('No tienes permisos para acceder a esta página');
            window.location.href = 'home.html';
            return;
        }
        
        loadSala();
        
        // Configurar evento para cerrar modal con ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
                closeConfirmModal();
            }
        });
    };

    async function loadSala() {
        const tbody = document.getElementById('salaTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Cargando...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/sala/listar`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            salaData = await response.json();
            
            if (!salaData || salaData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay salas registradas</td></tr>';
                return;
            }
            
            renderSalaTable();
            
        } catch (error) {
            console.error('Error cargando salas:', error);
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">${error.message}</td></tr>`;
        }
    }

    function renderSalaTable() {
        const tbody = document.getElementById('salaTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        salaData.forEach(sala => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${sala.idsala}</td>
                <td><strong>${sala.numeroSala || 'Sin número'}</strong></td>
                <td>${sala.capacidad || '0'} butacas</td>
                <td>${sala.fila || '0'} Filas</td>
                <td>${sala.columna || '0'} Columnas</td>
                <td>${sala.tipoSala || 'No especificada'}</td>
                
                <td>
                    <span class="${sala.estado ? 'status-active' : 'status-inactive'}">
                        ${sala.estado ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
               
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" style="background: #4299e1; color: white;" 
                                onclick="editSala(${sala.idsala})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn" style="background: #48bb78; color: white;" 
                                onclick="verAsientosSala(${sala.idsala})">
                            <i class="fas fa-chair"></i>
                        </button>
                        <button class="action-btn" style="background: #f56565; color: white;" 
                                onclick="showDeleteConfirm(${sala.idsala}, '${sala.numeroSala}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // Ver asientos de una sala
    window.verAsientosSala = function(salaId) {
        window.location.href = `asiento.html?sala=${salaId}`;
    };

    // Abrir modal para crear/editar
    window.openModal = function(mode, salaId = null) {
        const modal = document.getElementById('salaModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('salaForm');
        
        if (!modal || !modalTitle || !form) return;
        
        if (mode === 'create') {
            modalTitle.textContent = 'Nueva Sala';
            form.reset();
            document.getElementById('salaId').value = '';
            document.getElementById('estado').value = 'true';
        } else if (mode === 'edit' && salaId) {
            modalTitle.textContent = 'Editar Sala';
            const sala = salaData.find(m => m.idsala === salaId);
            
            if (sala) {
                document.getElementById('salaId').value = sala.idsala;
                document.getElementById('numero').value = sala.numeroSala || '';
                document.getElementById('capacidad').value = sala.capacidad || '';
                document.getElementById('fila').value = sala.fila || '';
                document.getElementById('columna').value = sala.columna || '';
                document.getElementById('tipo').value = sala.tipoSala || '';                        
                document.getElementById('estado').value = sala.estado ? 'true' : 'false';
            }
        }
        
        modal.style.display = 'flex';
    };

    // Cerrar modal
    window.closeModal = function() {
        const modal = document.getElementById('salaModal');
        if (modal) modal.style.display = 'none';
    };

    // Guardar sala
    window.saveSala = async function(event) {
        event.preventDefault();
        
        const salaId = document.getElementById('salaId').value;
        const isEdit = !!salaId;
        
        const formData = {
            numeroSala: document.getElementById('numero').value,
            capacidad: parseInt(document.getElementById('capacidad').value),
            fila: parseInt(document.getElementById('fila').value),
            columna: parseInt(document.getElementById('columna').value),
            tipoSala: document.getElementById('tipo').value,        
            estado: document.getElementById('estado').value === 'true'
        };
        
        if (isEdit) {
            formData.idsala = parseInt(salaId);
        }
        
        try {
            const url = isEdit ? 
                `${API_BASE_URL}/sala/actualizar` : 
                `${API_BASE_URL}/sala/crear`;
            
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: getHeaders(),
                body: JSON.stringify(formData)
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            closeModal();
            showSuccess(`Sala ${isEdit ? 'actualizada' : 'creada'} correctamente`);
            loadSala();
            
        } catch (error) {
            console.error('Error guardando Sala:', error);
            showError(`Error al guardar: ${error.message}`);
        }
    };

    // Editar sala
    window.editSala = function(salaId) {
        openModal('edit', salaId);
    };

    // Mostrar confirmación para eliminar
    window.showDeleteConfirm = function(salaId, salaTitle) {
        salaToDelete = salaId;
        document.getElementById('confirmMessage').textContent = 
            `¿Estás seguro de que quieres eliminar la Sala "${salaTitle}"?`;
        document.getElementById('confirmModal').style.display = 'flex';
    };

    // Cerrar modal de confirmación
    window.closeConfirmModal = function() {
        document.getElementById('confirmModal').style.display = 'none';
        salaToDelete = null;
    };

    // Confirmar eliminación
    window.confirmDelete = async function() {
        if (!salaToDelete) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/sala/eliminar/${salaToDelete}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            closeConfirmModal();
            showSuccess('Sala eliminada correctamente');
            loadSala();
            
        } catch (error) {
            console.error('Error eliminando sala:', error);
            showError(`Error al eliminar: ${error.message}`);
        }
    };

    // Refrescar lista
    window.refreshSala = function() {
        loadSala();
        showSuccess('Lista actualizada');
    };
})();