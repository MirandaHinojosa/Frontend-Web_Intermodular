
(function() {
    // Variables locales
    let asientoData = [];
    let asientosOriginales = [];
    let salaData = [];
    let salaSeleccionada = null;
    let asientoAEliminar = null;

    // Función de inicialización - SOLO UNA VEZ
    window.initAsiento = function() {
        console.log("Inicializando gestión de asientos en asiento.html...");
        if (!checkAuth()) return;
        
        // Verificar que el usuario sea ADMIN
        if (userRole !== 'ADMIN') {
            alert('No tienes permisos para acceder a esta página');
            window.location.href = 'home.html';
            return;
        }
        
        // Cargar salas
        cargarSalas();
        
        // Verificar si hay parámetro de sala en la URL
        const urlParams = new URLSearchParams(window.location.search);
        const salaParam = urlParams.get('sala');
        if (salaParam) {
            setTimeout(() => {
                const selectSala = document.getElementById('selectSala');
                if (selectSala) {
                    selectSala.value = salaParam;
                    cargarAsientosPorSala();
                }
            }, 300);
        }
        
        // Configurar eventos
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
                closeConfirmModal();
                closeSalasModal();
            }
        });
    };

    // Función para crear asientos automáticos
    async function crearAsientosAutomaticos(salaId, salaInfo) {
        try {
            console.log(`Creando asientos automáticos para sala ${salaId}...`);
            
            // Obtener información de filas y columnas de la sala
            const filas = salaInfo.fila || 5;
            const columnas = salaInfo.columna || 10;
            
            const asientosACrear = [];
            
            // Crear asientos ordenados por fila y columna
            for (let filaNum = 1; filaNum <= filas; filaNum++) {
                const filaLetra = String.fromCharCode(64 + filaNum); // A, B, C, ...
                
                for (let columna = 1; columna <= columnas; columna++) {
                    // Determinar tipo de asiento basado en la posición
                    let tipoAsiento = 'normal';
                    if (filaNum === 1) {
                        tipoAsiento = 'preferencial';
                    } else if (filaNum === filas) {
                        tipoAsiento = 'vip';
                    }
                    
                    const asiento = {
                        numeroAsiento: `${filaLetra}${columna}`,
                        fila: filaLetra,
                        columna: columna,
                        tipoAsiento: tipoAsiento,
                        estado: true,
                        sala: {
                            idsala: parseInt(salaId)
                        }
                    };
                    asientosACrear.push(asiento);
                }
            }
            
            // Crear asientos uno por uno
            for (const asientoData of asientosACrear) {
                try {
                    await fetch(`${API_BASE_URL}/asiento/crear`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(asientoData)
                    });
                } catch (e) {
                    console.warn('Error creando asiento individual:', e);
                }
            }
            
            showSuccess(`${asientosACrear.length} asientos creados automáticamente`);
            
        } catch (error) {
            console.error('Error creando asientos automáticos:', error);
            showError('Error al crear asientos automáticos: ' + error.message);
        }
    }

    // Cargar lista de salas
    async function cargarSalas() {
        const selectSala = document.getElementById('selectSala');
        
        if (!selectSala) {
            console.error("Elemento selectSala no encontrado!");
            return;
        }
        
        console.log("Cargando salas...");
        
        try {
            const response = await fetch(`${API_BASE_URL}/sala/listar`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Error: ${response.status}`);
            }
            
            salaData = await response.json();
            console.log("Datos de salas recibidos:", salaData);
            
            // Limpiar y poblar el select
            selectSala.innerHTML = '<option value="">-- Seleccione una sala --</option>';
            
            if (salaData && salaData.length > 0) {
                salaData.forEach(sala => {
                    const option = document.createElement('option');
                    option.value = sala.idsala || sala.idSala;
                    option.textContent = `Sala ${sala.numeroSala} - ${sala.capacidad} asientos`;
                    selectSala.appendChild(option);
                });
                console.log("Select de salas poblado con", salaData.length, "salas");
            } else {
                console.warn("No hay salas para mostrar");
            }
            
        } catch (error) {
            console.error('Error cargando salas:', error);
            showError('Error al cargar las salas: ' + error.message);
        }
    }

    // Cargar asientos por sala
    async function cargarAsientosPorSala() {
        const selectSala = document.getElementById('selectSala');
        if (!selectSala) return;
        
        const salaId = selectSala.value;
        console.log("ID de sala seleccionada:", salaId);
        
        if (!salaId) {
            salaSeleccionada = null;
            const salaInfo = document.getElementById('salaInfo');
            if (salaInfo) salaInfo.style.display = 'none';
            
            const btnCrear = document.getElementById('btnCrearAsiento');
            if (btnCrear) btnCrear.disabled = true;
            
            mostrarEstadoVacio('Seleccione una sala para ver sus asientos');
            return;
        }
        
        // Buscar la sala seleccionada
        salaSeleccionada = salaData.find(s => {
            const id = s.idsala || s.idSala;
            return id == salaId;
        });
        
        console.log("Sala seleccionada encontrada:", salaSeleccionada);
        
        if (salaSeleccionada) {
            // Mostrar información de la sala
            const salaInfo = document.getElementById('salaInfo');
            if (salaInfo) {
                salaInfo.style.display = 'block';
                document.getElementById('salaNumero').textContent = salaSeleccionada.numeroSala;
                document.getElementById('salaCapacidad').textContent = salaSeleccionada.capacidad;
                document.getElementById('salaTipo').textContent = salaSeleccionada.tipoSala || 'No especificado';
            }
            
            const btnCrear = document.getElementById('btnCrearAsiento');
            if (btnCrear) btnCrear.disabled = false;
        }
        
        const tbody = document.getElementById('asientoTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Cargando asientos...</td></tr>';
        
        try {
            console.log(`Solicitando asientos para sala ${salaId}...`);
            const response = await fetch(`${API_BASE_URL}/asiento/porsala/${salaId}`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Error: ${response.status}`);
            }
            
            asientoData = await response.json();
            
            // ORDENAR ASIENTOS por fila y columna
            asientoData.sort((a, b) => {
                const filaA = a.fila || 'A';
                const filaB = b.fila || 'A';
                if (filaA !== filaB) {
                    return filaA.localeCompare(filaB);
                }
                return (parseInt(a.columna) || 0) - (parseInt(b.columna) || 0);
            });
            
            asientosOriginales = [...asientoData];
            
            console.log('Asientos cargados:', asientoData);
            
            if (!asientoData || asientoData.length === 0) {
                // Preguntar si quiere crear asientos automáticamente
                if (salaSeleccionada && confirm(`No hay asientos para la Sala ${salaSeleccionada.numeroSala}. ¿Desea crearlos automáticamente?`)) {
                    await crearAsientosAutomaticos(salaId, salaSeleccionada);
                    await cargarAsientosPorSala(); // Recargar
                } else {
                    mostrarEstadoVacio(`No hay asientos registrados en la Sala ${salaSeleccionada?.numeroSala || salaId}`);
                }
                return;
            }
            
            renderAsientoTable();
            
        } catch (error) {
            console.error('Error cargando asientos:', error);
            showError('Error al cargar los asientos: ' + error.message);
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">${error.message}</td></tr>`;
        }
    }

    // Mostrar estado vacío
    function mostrarEstadoVacio(mensaje) {
        const tbody = document.getElementById('asientoTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <i class="fas fa-chair"></i>
                        <h3>${mensaje}</h3>
                        <p>No hay asientos para mostrar</p>
                    </div>
                </td>
            </tr>
        `;
    }

    // Renderizar tabla de asientos
    function renderAsientoTable() {
        const tbody = document.getElementById('asientoTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!asientoData || asientoData.length === 0) {
            mostrarEstadoVacio('No hay datos para mostrar');
            return;
        }
        
        asientoData.forEach(asiento => {
            const tr = document.createElement('tr');
            
            // Obtener valores con diferentes posibles nombres
            const id = asiento.idAsiento || asiento.idasiento || asiento.id_asiento || 'N/A';
            const numero = asiento.numeroAsiento || asiento.numeroasiento || asiento.numero_asiento || 'N/A';
            const tipo = asiento.tipoAsiento || asiento.tipoasiento || asiento.tipo_asiento || 'normal';
            const fila = asiento.fila || '';
            const columna = asiento.columna || '';
            
            // Determinar clase CSS para el tipo de asiento
            let tipoClass = '';
            switch(tipo.toLowerCase()) {
                case 'vip': tipoClass = 'tipo-vip'; break;
                case 'preferencial': tipoClass = 'tipo-preferencial'; break;
                default: tipoClass = 'tipo-normal';
            }
            
            // Determinar estado
            const estadoBoolean = asiento.estado === true || asiento.estado === 'true' || asiento.estado === 1;
            const estadoText = estadoBoolean ? 'Disponible' : 'Ocupado';
            const estadoClass = estadoBoolean ? 'status-disponible' : 'status-ocupado';
            
            // Obtener información de la sala
            let salaInfo = 'N/A';
            if (asiento.sala) {
                salaInfo = `Sala ${asiento.sala.numeroSala || ''}`;
            } else if (asiento.idSala || asiento.idsala) {
                const salaId = asiento.idSala || asiento.idsala;
                const salaEncontrada = salaData.find(s => (s.idsala || s.idSala) == salaId);
                salaInfo = salaEncontrada ? `Sala ${salaEncontrada.numeroSala}` : `Sala ${salaId}`;
            }
            
            tr.innerHTML = `
                <td>${id}</td>
                <td><strong>${numero}</strong></td>
                <td>${fila}</td>
                <td>${columna}</td>
                <td><span class="${tipoClass}">${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</span></td>
                <td><span class="${estadoClass}">${estadoText}</span></td>
                <td>${salaInfo}</td>
                <td class="action-buttons">
                    <button class="action-btn" onclick="editarAsiento(${id})" style="background: #4299e1; color: white;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn" onclick="eliminarAsiento(${id})" style="background: #f56565; color: white;">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Aplicar filtros
    function aplicarFiltros() {
        const filterEstado = document.getElementById('filterEstado');
        const filterTipo = document.getElementById('filterTipo');
        const filterNumero = document.getElementById('filterNumero');
        
        if (!filterEstado || !filterTipo || !filterNumero) return;
        
        const filterEstadoVal = filterEstado.value;
        const filterTipoVal = filterTipo.value;
        const filterNumeroVal = filterNumero.value.toLowerCase();
        
        if (!filterEstadoVal && !filterTipoVal && !filterNumeroVal) {
            asientoData = [...asientosOriginales];
        } else {
            asientoData = asientosOriginales.filter(asiento => {
                const estadoBoolean = asiento.estado === true || asiento.estado === 'true' || asiento.estado === 1;
                
                let estadoMatch = true;
                if (filterEstadoVal) {
                    estadoMatch = filterEstadoVal === 'true' ? estadoBoolean : !estadoBoolean;
                }
                
                const tipoAsiento = (asiento.tipoAsiento || asiento.tipoasiento || asiento.tipo_asiento || 'normal').toLowerCase();
                const tipoMatch = !filterTipoVal || tipoAsiento === filterTipoVal.toLowerCase();
                
                const numeroAsiento = (asiento.numeroAsiento || asiento.numeroasiento || asiento.numero_asiento || '').toLowerCase();
                const numeroMatch = !filterNumeroVal || numeroAsiento.includes(filterNumeroVal);
                
                return estadoMatch && tipoMatch && numeroMatch;
            });
        }
        
        renderAsientoTable();
    }

    // Función para filtrar asientos
    window.filtrarAsientos = function() {
        aplicarFiltros();
    };

    // Función para refrescar los asientos
    window.refreshAsientos = function() {
        const selectSala = document.getElementById('selectSala');
        if (selectSala && selectSala.value) {
            cargarAsientosPorSala();
            showSuccess('Asientos actualizados correctamente');
        } else {
            showError('Seleccione una sala primero');
        }
    };

    // Abrir modal para crear/editar asiento
    window.openModal = function(mode, asiento = null) {
        const modal = document.getElementById('asientoModal');
        const title = document.getElementById('modalTitle');
        
        if (!modal || !title) return;
        
        if (mode === 'create') {
            title.textContent = 'Nuevo Asiento';
            const form = document.getElementById('asientoForm');
            if (form) form.reset();
            document.getElementById('asientoId').value = '';
            document.getElementById('estadoAsiento').value = 'true';
            
            if (salaSeleccionada) {
                const salaId = salaSeleccionada.idsala || salaSeleccionada.idSala;
                document.getElementById('salaIdSeleccionada').value = salaId;
                document.getElementById('salaIdText').textContent = salaId;
                document.getElementById('salaNumeroText').textContent = salaSeleccionada.numeroSala;
            }
        } else if (mode === 'edit' && asiento) {
            title.textContent = 'Editar Asiento';
            document.getElementById('asientoId').value = asiento.idAsiento || asiento.idasiento || asiento.id_asiento;
            document.getElementById('numeroAsiento').value = asiento.numeroAsiento || asiento.numeroasiento || asiento.numero_asiento;
            document.getElementById('fila').value = asiento.fila || '';
            document.getElementById('columna').value = asiento.columna || '';
            document.getElementById('tipoAsiento').value = (asiento.tipoAsiento || asiento.tipoasiento || asiento.tipo_asiento || 'normal').toLowerCase();
            document.getElementById('estadoAsiento').value = (asiento.estado === true || asiento.estado === 'true' || asiento.estado === 1) ? 'true' : 'false';
            
            const salaId = asiento.idSala || asiento.idsala || (asiento.sala ? (asiento.sala.idsala || asiento.sala.idSala) : null);
            document.getElementById('salaIdSeleccionada').value = salaId;
            document.getElementById('salaIdText').textContent = salaId;
            
            if (asiento.sala) {
                document.getElementById('salaNumeroText').textContent = asiento.sala.numeroSala;
            } else {
                const salaEncontrada = salaData.find(s => (s.idsala || s.idSala) == salaId);
                document.getElementById('salaNumeroText').textContent = salaEncontrada ? salaEncontrada.numeroSala : 'Sala ' + salaId;
            }
        }
        
        modal.style.display = 'flex';
    };

    // Cerrar modal
    window.closeModal = function() {
        const modal = document.getElementById('asientoModal');
        if (modal) modal.style.display = 'none';
    };

    // Editar asiento
    window.editarAsiento = function(id) {
        const asiento = asientoData.find(a => {
            const aId = a.idAsiento || a.idasiento || a.id_asiento;
            return aId == id;
        });
        if (asiento) {
            openModal('edit', asiento);
        }
    };

    // Guardar asiento
    window.saveAsiento = async function(event) {
        event.preventDefault();
        
        const id = document.getElementById('asientoId').value;
        const salaId = document.getElementById('salaIdSeleccionada').value || 
                      (salaSeleccionada ? (salaSeleccionada.idsala || salaSeleccionada.idSala) : null);
        
        if (!salaId) {
            showError('No se ha seleccionado una sala');
            return;
        }
        
        const asientoDataToSave = {
            numeroAsiento: document.getElementById('numeroAsiento').value,
            fila: document.getElementById('fila').value,
            columna: parseInt(document.getElementById('columna').value) || 0,
            tipoAsiento: document.getElementById('tipoAsiento').value,
            estado: document.getElementById('estadoAsiento').value === 'true',
            sala: {
                idsala: parseInt(salaId)
            }
        };
        
        if (id) {
            asientoDataToSave.idAsiento = parseInt(id);
        }
        
        try {
            const url = id ? 
                `${API_BASE_URL}/asiento/actualizar` : 
                `${API_BASE_URL}/asiento/crear`;
            
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: getHeaders(),
                body: JSON.stringify(asientoDataToSave)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Error: ${response.status}`);
            }
            
            closeModal();
            await cargarAsientosPorSala();
            showSuccess(id ? 'Asiento actualizado correctamente' : 'Asiento creado correctamente');
            
        } catch (error) {
            console.error('Error guardando asiento:', error);
            showError(`Error al guardar el asiento: ${error.message}`);
        }
    };

    // Eliminar asiento
    window.eliminarAsiento = function(id) {
        asientoAEliminar = id;
        const asiento = asientoData.find(a => {
            const aId = a.idAsiento || a.idasiento || a.id_asiento;
            return aId == id;
        });
        const numeroAsiento = asiento ? (asiento.numeroAsiento || asiento.numeroasiento || asiento.numero_asiento || '') : '';
        const mensaje = numeroAsiento 
            ? `¿Estás seguro de que quieres eliminar el asiento ${numeroAsiento}?`
            : '¿Estás seguro de que quieres eliminar este asiento?';
        
        document.getElementById('confirmMessage').textContent = mensaje;
        document.getElementById('confirmModal').style.display = 'flex';
    };

    // Confirmar eliminación
    window.confirmDelete = async function() {
        if (!asientoAEliminar) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/asiento/eliminar/${asientoAEliminar}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            closeConfirmModal();
            await cargarAsientosPorSala();
            showSuccess('Asiento eliminado correctamente');
            
        } catch (error) {
            console.error('Error eliminando asiento:', error);
            showError('Error al eliminar el asiento: ' + error.message);
        }
    };

    // Cerrar modal de confirmación
    window.closeConfirmModal = function() {
        document.getElementById('confirmModal').style.display = 'none';
        asientoAEliminar = null;
    };

    // Cargar todas las salas en el modal
    window.cargarTodasSalas = async function() {
        const modal = document.getElementById('salasModal');
        const tbody = document.getElementById('todasSalasBody');
        
        if (!modal || !tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Cargando salas...</td></tr>';
        modal.style.display = 'flex';
        
        try {
            const response = await fetch(`${API_BASE_URL}/sala/listar`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const salas = await response.json();
            
            if (salas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay salas registradas</td></tr>';
                return;
            }
            
            tbody.innerHTML = '';
            salas.forEach(sala => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${sala.idsala || sala.idSala}</td>
                    <td><strong>Sala ${sala.numeroSala}</strong></td>
                    <td>${sala.capacidad} asientos</td>
                    <td>${sala.tipoSala || 'No especificado'}</td>
                    <td><span class="${sala.estado ? 'status-active' : 'status-inactive'}">
                        ${sala.estado ? 'Activa' : 'Inactiva'}
                    </span></td>
                    <td>
                        <button class="action-btn" onclick="seleccionarSala(${sala.idsala || sala.idSala})" style="background: #48bb78; color: white;">
                            <i class="fas fa-check"></i> Seleccionar
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
        } catch (error) {
            console.error('Error cargando salas:', error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar las salas</td></tr>`;
        }
    };

    // Seleccionar sala desde el modal
    window.seleccionarSala = function(salaId) {
        document.getElementById('selectSala').value = salaId;
        closeSalasModal();
        cargarAsientosPorSala();
    };

    // Cerrar modal de salas
    window.closeSalasModal = function() {
        document.getElementById('salasModal').style.display = 'none';
    };

    // Función para ver asientos desde sala.html
    window.verAsientosSala = function(salaId) {
        window.location.href = `asiento.html?sala=${salaId}`;
    };

    // Función para crear asientos manualmente (botón adicional)
    window.crearAsientosManual = async function() {
        if (!salaSeleccionada) {
            showError('Seleccione una sala primero');
            return;
        }
        
        const salaId = salaSeleccionada.idsala || salaSeleccionada.idSala;
        
        if (confirm(`¿Crear asientos automáticos para la Sala ${salaSeleccionada.numeroSala}?`)) {
            await crearAsientosAutomaticos(salaId, salaSeleccionada);
            await cargarAsientosPorSala();
        }
    };
})();