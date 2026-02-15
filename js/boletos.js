// js/boletos.js - VERSIÓN UNIFICADA Y CORREGIDA
(function() {
    let boletosData = [];
    let boletosOriginales = [];
    let sesionesData = [];
    let sesionesFiltradas = [];
    let currentPage = 1;
    const itemsPerPage = 10;
    let boletoAEliminar = null;
    let accionConfirmar = '';
    let currentBoletoId = null;
    let asientosOcupados = [];
    let precioBase = 0;

    // --- INICIALIZACIÓN: Esperar a que el layout esté listo ---
    function init() {
        console.log("🎫 Inicializando gestión de boletos...");

        // Verificar autenticación (checkAuth está en api.js)
        if (!checkAuth()) return;

        // Si el layout ya está listo, procedemos. Si no, esperamos el evento.
        if (document.querySelector('.dashboard-container')) {
            setupPage();
        } else {
            document.addEventListener('layoutReady', setupPage);
        }
    }

    function setupPage() {
        console.log("🎫 Layout listo, configurando página de boletos.");
        
        // Verificar que estamos en la página correcta
        if (!document.getElementById('boletosTableBody')) {
            console.log("No es la página de boletos, cancelando inicialización");
            return;
        }
        
        configurarVistaPorRol();
        cargarSesiones();
        cargarBoletos();
        cargarEstadisticas();

        // Configurar eventos del modal
        const form = document.getElementById('boletoForm');
        if (form) {
            // Eliminar event listeners anteriores para evitar duplicados
            form.removeEventListener('submit', saveBoleto);
            form.addEventListener('submit', saveBoleto);
        }

        // Configurar eventos de filtros
        const filterEstado = document.getElementById('filterEstado');
        const filterTipoEntrada = document.getElementById('filterTipoEntrada');
        const filterFecha = document.getElementById('filterFecha');
        const filterSesion = document.getElementById('filterSesion');
        
        if (filterEstado) filterEstado.addEventListener('change', aplicarFiltros);
        if (filterTipoEntrada) filterTipoEntrada.addEventListener('change', aplicarFiltros);
        if (filterFecha) filterFecha.addEventListener('change', aplicarFiltros);
        if (filterSesion) filterSesion.addEventListener('change', aplicarFiltros);

        // Configurar búsqueda
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) {
            searchBtn.removeEventListener('click', window.buscarBoletos);
            searchBtn.addEventListener('click', window.buscarBoletos);
        }
        
        if (searchInput) {
            searchInput.removeEventListener('keyup', function(e) {
                if (e.key === 'Enter') window.buscarBoletos();
            });
            searchInput.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') window.buscarBoletos();
            });
        }

        // Cerrar modales con ESC
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeModal();
                closeConfirmModal();
                closeDetailModal();
            }
        });
    }

    // Configurar vista según rol
    function configurarVistaPorRol() {
        const titulo = document.querySelector('h1');
        const descripcion = document.querySelector('.header p');
        
        if (userRole === 'ADMIN') {
            // Vista de administrador - muestra todo
            if (titulo) titulo.innerHTML = '<i class="fas fa-ticket-alt"></i> Administración de Boletos';
            if (descripcion) descripcion.textContent = 'Gestión completa de boletos (venta, reservas, cancelaciones)';
            
            // Mostrar elementos de admin
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'inline-block';
            });
        } else {
            // Vista de usuario normal - solo venta
            if (titulo) titulo.innerHTML = '<i class="fas fa-ticket-alt"></i> Venta de Boletos';
            if (descripcion) descripcion.textContent = 'Compra tus boletos para las funciones disponibles';
            
            // Ocultar elementos de admin
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'none';
            });
        }
    }

    // Cargar sesiones para filtros y formulario
    async function cargarSesiones() {
        try {
            const response = await fetch(`${API_BASE_URL}/sesiones/listar`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            sesionesData = await response.json();
            sesionesFiltradas = [...sesionesData];
            
            // Poblar select de filtro
            const filterSelect = document.getElementById('filterSesion');
            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">Todas las sesiones</option>';
                sesionesData.forEach(sesion => {
                    const option = document.createElement('option');
                    option.value = sesion.idsesion;
                    const peliculaTitulo = sesion.pelicula?.titulo || 'Película desconocida';
                    option.textContent = `${peliculaTitulo} - Sala ${sesion.sala?.numeroSala || 'N/A'}`;
                    filterSelect.appendChild(option);
                });
            }
            
            // Poblar select del formulario
            const formSelect = document.getElementById('sesionId');
            if (formSelect) {
                formSelect.innerHTML = '<option value="">Seleccionar sesión</option>';
                sesionesData.forEach(sesion => {
                    const option = document.createElement('option');
                    option.value = sesion.idsesion;
                    const peliculaTitulo = sesion.pelicula?.titulo || 'Película desconocida';
                    const fecha = new Date(sesion.fecha).toLocaleDateString('es-ES');
                    option.textContent = `${peliculaTitulo} (${fecha} ${sesion.hora})`;
                    option.dataset.precio = sesion.precio || 0;
                    option.dataset.pelicula = peliculaTitulo;
                    option.dataset.fecha = fecha;
                    option.dataset.hora = sesion.hora;
                    option.dataset.sala = sesion.sala?.numeroSala || 'N/A';
                    option.dataset.asientos = sesion.asientosDisponibles || 0;
                    option.dataset.capacidad = sesion.sala?.capacidad || 50;
                    formSelect.appendChild(option);
                });
                
                // Agregar evento change
                formSelect.removeEventListener('change', window.cargarSesionInfo);
                formSelect.addEventListener('change', window.cargarSesionInfo);
            }
            
        } catch (error) {
            console.error('Error cargando sesiones:', error);
            showError('Error al cargar las sesiones: ' + error.message);
        }
    }

    // Cargar boletos
    async function cargarBoletos() {
        const tbody = document.getElementById('boletosTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Cargando boletos...</td></tr>';
        
        try {
            const response = await fetch(`${API_BASE_URL}/boletos/listar`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            boletosData = await response.json();
            boletosOriginales = [...boletosData];
            
            console.log('Boletos cargados:', boletosData.length);
            
            if (!boletosData || boletosData.length === 0) {
                mostrarEstadoVacio();
                return;
            }
            
            renderBoletosTable();
            renderPagination();
            
        } catch (error) {
            console.error('Error cargando boletos:', error);
            showError('Error al cargar los boletos: ' + error.message);
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">${error.message}</td></tr>`;
        }
    }

    // Cargar estadísticas
    async function cargarEstadisticas() {
        try {
            const total = boletosData.length;
            const pagados = boletosData.filter(b => b.estado === 'PAGADO').length;
            const reservados = boletosData.filter(b => b.estado === 'RESERVADO').length;
            const cancelados = boletosData.filter(b => b.estado === 'CANCELADO').length;
            
            const totalEl = document.getElementById('totalBoletos');
            const pagadosEl = document.getElementById('boletosPagados');
            const reservadosEl = document.getElementById('boletosReservados');
            const canceladosEl = document.getElementById('boletosCancelados');
            
            if (totalEl) totalEl.textContent = total;
            if (pagadosEl) pagadosEl.textContent = pagados;
            if (reservadosEl) reservadosEl.textContent = reservados;
            if (canceladosEl) canceladosEl.textContent = cancelados;
            
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    // Renderizar tabla de boletos
    function renderBoletosTable() {
        const tbody = document.getElementById('boletosTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Calcular índices para paginación
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const boletosPagina = boletosData.slice(startIndex, endIndex);
        
        if (boletosPagina.length === 0) {
            mostrarEstadoVacio('No hay boletos para mostrar');
            return;
        }
        
        boletosPagina.forEach(boleto => {
            const tr = document.createElement('tr');
            
            // Formatear fecha
            const fechaCompra = boleto.fechaCompra ? 
                new Date(boleto.fechaCompra).toLocaleString('es-ES') : 
                'No especificada';
            
            // Obtener información de la sesión
            const sesion = sesionesData.find(s => s.idsesion === (boleto.sesion?.idsesion || boleto.sesion));
            const peliculaNombre = sesion?.pelicula?.titulo || 'Desconocida';
            const salaNumero = sesion?.sala?.numeroSala || 'N/A';
            
            // Determinar clase del estado
            let estadoClass = '';
            switch(boleto.estado) {
                case 'PAGADO': estadoClass = 'status-pagado'; break;
                case 'RESERVADO': estadoClass = 'status-reservado'; break;
                case 'CANCELADO': estadoClass = 'status-cancelado'; break;
                default: estadoClass = 'status-reservado';
            }
            
            // Generar botones de acción según el rol
            let accionesHTML = `
                <button class="action-btn" onclick="window.verDetalleBoleto(${boleto.idboleto || boleto.id_boleto})" style="background: #4299e1; color: white;">
                    <i class="fas fa-eye"></i> Ver
                </button>
            `;
            
            if (userRole === 'ADMIN') {
                accionesHTML += `
                    <button class="action-btn btn-edit" onclick="window.editarBoleto(${boleto.idboleto || boleto.id_boleto})" style="background: #48bb78; color: white;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn btn-delete" onclick="window.eliminarBoleto(${boleto.idboleto || boleto.id_boleto})" style="background: #f56565; color: white;">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            }
            
            if (boleto.estado !== 'CANCELADO') {
                accionesHTML += `
                    <button class="action-btn" onclick="window.cancelarBoleto(${boleto.idboleto || boleto.id_boleto})" style="background: #ed8936; color: white;">
                        <i class="fas fa-ban"></i> Cancelar
                    </button>
                `;
            }
            
            tr.innerHTML = `
                <td>${boleto.idboleto || boleto.id_boleto}</td>
                <td>${sesion ? `Sesión ${sesion.idsesion}` : 'N/A'}</td>
                <td><strong>${peliculaNombre}</strong></td>
                <td>Sala ${salaNumero}</td>
                <td><span class="tipo-badge">${boleto.numeroAsiento || 'N/A'}</span></td>
                <td>${fechaCompra}</td>
                <td>$${boleto.precioPagado?.toFixed(2) || '0.00'}</td>
                <td>${boleto.tipoEntrada || 'ADULTO'}</td>
                <td><span class="status-badge ${estadoClass}">${boleto.estado || 'RESERVADO'}</span></td>
                <td class="action-buttons">${accionesHTML}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Mostrar estado vacío
    function mostrarEstadoVacio(mensaje = 'No hay boletos registrados') {
        const tbody = document.getElementById('boletosTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fas fa-ticket-alt"></i>
                        <h3>${mensaje}</h3>
                        <p>No hay boletos para mostrar</p>
                    </div>
                </td>
            </tr>
        `;
    }

    // Renderizar paginación
    function renderPagination() {
        const totalPages = Math.ceil(boletosData.length / itemsPerPage);
        const container = document.getElementById('paginationContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        // Botón anterior
        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn';
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.onclick = () => {
                currentPage--;
                renderBoletosTable();
                renderPagination();
            };
            container.appendChild(prevBtn);
        }
        
        // Números de página
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => {
                currentPage = i;
                renderBoletosTable();
                renderPagination();
            };
            container.appendChild(pageBtn);
        }
        
        // Botón siguiente
        if (currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn';
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.onclick = () => {
                currentPage++;
                renderBoletosTable();
                renderPagination();
            };
            container.appendChild(nextBtn);
        }
    }

    // Aplicar filtros
    function aplicarFiltros() {
        const filterEstado = document.getElementById('filterEstado');
        const filterTipoEntrada = document.getElementById('filterTipoEntrada');
        const filterFecha = document.getElementById('filterFecha');
        const filterSesion = document.getElementById('filterSesion');
        
        boletosData = [...boletosOriginales];
        
        if (filterEstado && filterEstado.value) {
            boletosData = boletosData.filter(b => b.estado === filterEstado.value);
        }
        
        if (filterTipoEntrada && filterTipoEntrada.value) {
            boletosData = boletosData.filter(b => b.tipoEntrada === filterTipoEntrada.value);
        }
        
        if (filterFecha && filterFecha.value) {
            const fechaFiltro = new Date(filterFecha.value).toISOString().split('T')[0];
            boletosData = boletosData.filter(b => {
                if (!b.fechaCompra) return false;
                const fechaBoleto = new Date(b.fechaCompra).toISOString().split('T')[0];
                return fechaBoleto === fechaFiltro;
            });
        }
        
        if (filterSesion && filterSesion.value) {
            const sesionId = parseInt(filterSesion.value);
            boletosData = boletosData.filter(b => 
                (b.sesion?.idsesion || b.sesion) === sesionId
            );
        }
        
        currentPage = 1;
        renderBoletosTable();
        renderPagination();
        cargarEstadisticas();
    }

    // Buscar boletos
    window.buscarBoletos = function() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            boletosData = [...boletosOriginales];
        } else {
            boletosData = boletosOriginales.filter(boleto => {
                // Buscar en número de asiento
                if (boleto.numeroAsiento && boleto.numeroAsiento.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Buscar en información de sesión
                const sesion = sesionesData.find(s => s.idsesion === (boleto.sesion?.idsesion || boleto.sesion));
                if (sesion) {
                    // Buscar en título de película
                    if (sesion.pelicula?.titulo && sesion.pelicula.titulo.toLowerCase().includes(searchTerm)) {
                        return true;
                    }
                    
                    // Buscar en número de sala
                    if (sesion.sala?.numeroSala && sesion.sala.numeroSala.toString().includes(searchTerm)) {
                        return true;
                    }
                }
                
                return false;
            });
        }
        
        currentPage = 1;
        renderBoletosTable();
        renderPagination();
    };

    // Refrescar lista
    window.refreshBoletos = async function() {
        await cargarSesiones();
        await cargarBoletos();
        await cargarEstadisticas();
        showSuccess('Lista de boletos actualizada');
    };

    // Abrir modal para nuevo boleto
    window.openModalNuevoBoleto = function() {
        const modal = document.getElementById('boletoModal');
        const title = document.getElementById('modalTitle');
        
        if (!modal || !title) return;
        
        title.textContent = 'Nuevo Boleto';
        const form = document.getElementById('boletoForm');
        if (form) form.reset();
        document.getElementById('boletoId').value = '';
        document.getElementById('estadoBoleto').value = 'RESERVADO';
        document.getElementById('precioPagado').value = '0.00';
        
        // Limpiar asientos
        const asientosContainer = document.getElementById('asientosContainer');
        const noAsientosMessage = document.getElementById('noAsientosMessage');
        const sesionInfo = document.getElementById('sesionInfo');
        const priceCalculation = document.getElementById('priceCalculation');
        const selectedSeatInfo = document.getElementById('selectedSeatInfo');
        const numeroAsiento = document.getElementById('numeroAsiento');
        
        if (asientosContainer) asientosContainer.style.display = 'none';
        if (noAsientosMessage) noAsientosMessage.style.display = 'none';
        if (sesionInfo) sesionInfo.style.display = 'none';
        if (priceCalculation) priceCalculation.style.display = 'none';
        if (selectedSeatInfo) selectedSeatInfo.textContent = 'Ninguno';
        if (numeroAsiento) numeroAsiento.value = '';
        
        modal.style.display = 'flex';
    };

    // Cargar información de la sesión seleccionada
    window.cargarSesionInfo = async function() {
        const sesionId = document.getElementById('sesionId').value;
        const sesionSelect = document.getElementById('sesionId');
        const selectedOption = sesionSelect.options[sesionSelect.selectedIndex];
        
        const sesionInfo = document.getElementById('sesionInfo');
        const asientosContainer = document.getElementById('asientosContainer');
        const priceCalculation = document.getElementById('priceCalculation');
        
        if (!sesionId) {
            if (sesionInfo) sesionInfo.style.display = 'none';
            if (asientosContainer) asientosContainer.style.display = 'none';
            if (priceCalculation) priceCalculation.style.display = 'none';
            return;
        }
        
        // Mostrar información básica
        if (selectedOption) {
            const peliculaInfo = document.getElementById('peliculaInfo');
            const fechaSesionInfo = document.getElementById('fechaSesionInfo');
            const horaSesionInfo = document.getElementById('horaSesionInfo');
            const salaInfo = document.getElementById('salaInfo');
            const precioBaseInfo = document.getElementById('precioBaseInfo');
            const asientosDisponiblesInfo = document.getElementById('asientosDisponiblesInfo');
            const basePrice = document.getElementById('basePrice');
            
            if (peliculaInfo) peliculaInfo.textContent = selectedOption.dataset.pelicula || '-';
            if (fechaSesionInfo) fechaSesionInfo.textContent = selectedOption.dataset.fecha || '-';
            if (horaSesionInfo) horaSesionInfo.textContent = selectedOption.dataset.hora || '-';
            if (salaInfo) salaInfo.textContent = selectedOption.dataset.sala || '-';
            if (precioBaseInfo) precioBaseInfo.textContent = selectedOption.dataset.precio || '0.00';
            if (asientosDisponiblesInfo) asientosDisponiblesInfo.textContent = selectedOption.dataset.asientos || '0';
            
            precioBase = parseFloat(selectedOption.dataset.precio) || 0;
            if (basePrice) basePrice.textContent = precioBase.toFixed(2);
            
            if (sesionInfo) sesionInfo.style.display = 'block';
        }
        
        // Cargar asientos ocupados y generar grid
        try {
            const response = await fetch(`${API_BASE_URL}/boletos/asientos-ocupados/${sesionId}`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (response.ok) {
                asientosOcupados = await response.json();
                await generarGridAsientos();
                
                // Verificar disponibilidad
                const asientosDisponibles = parseInt(selectedOption.dataset.asientos) || 0;
                const capacidad = parseInt(selectedOption.dataset.capacidad) || 50;
                
                if (asientosDisponibles > 0 && asientosOcupados.length < capacidad) {
                    if (asientosContainer) asientosContainer.style.display = 'block';
                    const noAsientosMessage = document.getElementById('noAsientosMessage');
                    if (noAsientosMessage) noAsientosMessage.style.display = 'none';
                } else {
                    if (asientosContainer) asientosContainer.style.display = 'none';
                    const noAsientosMessage = document.getElementById('noAsientosMessage');
                    if (noAsientosMessage) noAsientosMessage.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error cargando asientos ocupados:', error);
            if (asientosContainer) asientosContainer.style.display = 'none';
        }
        
        // Mostrar cálculo de precio si hay tipo de entrada seleccionado
        const tipoEntrada = document.getElementById('tipoEntrada');
        if (tipoEntrada && tipoEntrada.value) {
            calcularPrecio();
        }
    };

    // Generar grid de asientos
    async function generarGridAsientos() {
        const seatGrid = document.getElementById('seatGrid');
        if (!seatGrid) return;
        
        seatGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Cargando asientos...</div>';
        
        try {
            const sesionSelect = document.getElementById('sesionId');
            const sesionId = parseInt(sesionSelect.value);
            
            if (!sesionId) {
                seatGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Selecciona una sesión primero</div>';
                return;
            }
            
            const sesion = sesionesData.find(s => s.idsesion === sesionId);
            
            if (!sesion || !sesion.sala) {
                seatGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #e53e3e;">No se encontró información de la sala</div>';
                return;
            }
            
            const salaId = sesion.sala.idSala || sesion.sala.idsala;
            
            if (!salaId) {
                seatGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #e53e3e;">Sala no disponible</div>';
                return;
            }
            
            // Obtener los asientos de la sala
            const response = await fetch(`${API_BASE_URL}/asiento/porsala/${salaId}`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const asientosSala = await response.json();
            
            if (!asientosSala || asientosSala.length === 0) {
                seatGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #e53e3e;">No hay asientos configurados para esta sala</div>';
                return;
            }
            
            // ORDENAR CORRECTAMENTE LOS ASIENTOS POR FILA Y COLUMNA
            asientosSala.sort((a, b) => {
                // Primero por fila (A, B, C...)
                const filaA = a.fila || 'A';
                const filaB = b.fila || 'A';
                if (filaA !== filaB) {
                    return filaA.localeCompare(filaB);
                }
                // Luego por columna (1, 2, 3...)
                return (parseInt(a.columna) || 0) - (parseInt(b.columna) || 0);
            });
            
            // Encontrar el número máximo de columnas
            const maxColumna = Math.max(...asientosSala.map(asiento => parseInt(asiento.columna) || 1));
            
            // Configurar el grid
            seatGrid.style.gridTemplateColumns = `repeat(${maxColumna}, 30px)`;
            seatGrid.innerHTML = '';
            
            // Generar asientos ordenados
            asientosSala.forEach(asiento => {
                const seatElement = document.createElement('div');
                const numeroAsiento = asiento.numeroAsiento || `${asiento.fila}${asiento.columna}`;
                
                seatElement.className = 'seat-item';
                seatElement.textContent = numeroAsiento;
                seatElement.dataset.seat = numeroAsiento;
                seatElement.dataset.id = asiento.idAsiento;
                seatElement.dataset.fila = asiento.fila;
                seatElement.dataset.columna = asiento.columna;
                
                // Verificar si está ocupado
                const estaOcupado = asientosOcupados.includes(numeroAsiento);
                const estadoAsiento = asiento.estado === true || asiento.estado === 'true' || asiento.estado === 1;
                
                if (estaOcupado) {
                    seatElement.classList.add('seat-occupied');
                    seatElement.title = 'Asiento ocupado en esta sesión';
                } else if (!estadoAsiento) {
                    seatElement.classList.add('seat-occupied');
                    seatElement.title = 'Asiento deshabilitado';
                    seatElement.style.opacity = '0.6';
                } else {
                    seatElement.classList.add('seat-available');
                    seatElement.onclick = () => seleccionarAsiento(numeroAsiento);
                }
                
                // Agregar clase por tipo
                if (asiento.tipoAsiento) {
                    seatElement.classList.add(`seat-${asiento.tipoAsiento.toLowerCase()}`);
                }
                
                seatGrid.appendChild(seatElement);
            });
            
            actualizarLeyendaAsientos(asientosSala);
            
        } catch (error) {
            console.error('Error cargando asientos:', error);
            seatGrid.innerHTML = `<div style="text-align: center; padding: 20px; color: #e53e3e;">Error: ${error.message}</div>`;
        }
    }

    // Actualizar leyenda de asientos
    function actualizarLeyendaAsientos(asientos) {
        const legendContainer = document.querySelector('.seat-legend');
        if (!legendContainer) return;
        
        // Limpiar leyenda existente (manteniendo los primeros 3 elementos básicos)
        while (legendContainer.children.length > 3) {
            legendContainer.removeChild(legendContainer.lastChild);
        }
        
        // Agregar leyendas para tipos especiales de asientos
        const tiposUnicos = [...new Set(asientos.map(a => a.tipoAsiento).filter(Boolean))];
        
        tiposUnicos.forEach(tipo => {
            if (tipo && tipo.toUpperCase() !== 'NORMAL') {
                const color = obtenerColorPorTipo(tipo);
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.innerHTML = `
                    <div class="legend-color" style="background: ${color};"></div>
                    <span>${tipo}</span>
                `;
                legendContainer.appendChild(legendItem);
            }
        });
        
        // Agregar leyenda para asientos deshabilitados
        const disabledLegend = document.createElement('div');
        disabledLegend.className = 'legend-item';
        disabledLegend.innerHTML = `
            <div class="legend-color" style="background: #a0aec0; opacity: 0.6;"></div>
            <span>Deshabilitado</span>
        `;
        legendContainer.appendChild(disabledLegend);
    }

    // Obtener color por tipo de asiento
    function obtenerColorPorTipo(tipo) {
        switch(tipo.toUpperCase()) {
            case 'VIP':
                return '#9F7AEA'; // Púrpura para VIP
            case 'PREFERENCIAL':
                return '#ED8936'; // Naranja para preferencial
            default:
                return '#c6f6d5'; // Verde para normal
        }
    }

    // Seleccionar asiento
    function seleccionarAsiento(seatNumber) {
        // Limpiar selección anterior
        document.querySelectorAll('.seat-selected').forEach(seat => {
            seat.classList.remove('seat-selected');
            seat.classList.add('seat-available');
        });

        // Seleccionar nuevo asiento - Buscar por el texto del asiento, no por data-seat
        const seatElements = document.querySelectorAll('.seat-item');
        let foundSeat = null;
        
        seatElements.forEach(seat => {
            if (seat.textContent.trim() === seatNumber && !seat.classList.contains('seat-occupied')) {
                foundSeat = seat;
            }
        });

        if (foundSeat) {
            foundSeat.classList.remove('seat-available');
            foundSeat.classList.add('seat-selected');
            const selectedSeatInfo = document.getElementById('selectedSeatInfo');
            const numeroAsiento = document.getElementById('numeroAsiento');
            
            if (selectedSeatInfo) selectedSeatInfo.textContent = seatNumber;
            if (numeroAsiento) numeroAsiento.value = seatNumber;
        } else {
            console.warn('Asiento no encontrado o ya ocupado:', seatNumber);
        }
    }   

    // Calcular precio según tipo de entrada
    window.calcularPrecio = function() {
        const tipoEntrada = document.getElementById('tipoEntrada');
        const priceCalculation = document.getElementById('priceCalculation');
        
        if (!tipoEntrada || !tipoEntrada.value || precioBase <= 0) {
            if (priceCalculation) priceCalculation.style.display = 'none';
            return;
        }
        
        let descuento = 0;
        let tipoTexto = '';
        
        switch(tipoEntrada.value) {
            case 'MENOR':
                descuento = 0.50; // 50% de descuento para menores
                tipoTexto = 'Menor (50% descuento)';
                break;
            case 'ESTUDIANTE':
                descuento = 0.25; // 25% de descuento para estudiantes
                tipoTexto = 'Estudiante (25% descuento)';
                break;
            case 'ADULTO':
            default:
                descuento = 0; // Sin descuento para adultos
                tipoTexto = 'Adulto (sin descuento)';
                break;
        }
        
        const precioFinal = precioBase * (1 - descuento);
        
        // Actualizar UI
        const tipoEntradaText = document.getElementById('tipoEntradaText');
        const discountText = document.getElementById('discountText');
        const totalPrice = document.getElementById('totalPrice');
        const precioPagado = document.getElementById('precioPagado');
        
        if (tipoEntradaText) tipoEntradaText.textContent = tipoTexto;
        if (discountText) discountText.textContent = `${(descuento * 100)}%`;
        if (totalPrice) totalPrice.textContent = precioFinal.toFixed(2);
        if (precioPagado) precioPagado.value = precioFinal.toFixed(2);
        
        if (priceCalculation) priceCalculation.style.display = 'block';
    };

    // Guardar boleto
    async function saveBoleto(event) {
        event.preventDefault();
        
        const id = document.getElementById('boletoId').value;
        const sesionId = document.getElementById('sesionId').value;
        const numeroAsiento = document.getElementById('numeroAsiento').value;
        
        if (!sesionId) {
            showError('Debe seleccionar una sesión');
            return;
        }
        
        if (!numeroAsiento) {
            showError('Debe seleccionar un asiento');
            return;
        }
        
        const boletoData = {
            sesion: { idsesion: parseInt(sesionId) },
            numeroAsiento: numeroAsiento,
            tipoEntrada: document.getElementById('tipoEntrada').value,
            estado: document.getElementById('estadoBoleto').value,
            precioPagado: parseFloat(document.getElementById('precioPagado').value),
            fechaCompra: new Date().toISOString()
        };
        
        if (id) {
            boletoData.idboleto = parseInt(id);
        }
        
        try {
            const url = id ? 
                `${API_BASE_URL}/boletos/actualizar` : 
                `${API_BASE_URL}/boletos/crear`;
            
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: getHeaders(),
                body: JSON.stringify(boletoData)
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Error: ${response.status}`);
            }
            
            closeModal();
            await cargarBoletos();
            await cargarEstadisticas();
            showSuccess(id ? 'Boleto actualizado correctamente' : 'Boleto creado correctamente');
            
        } catch (error) {
            console.error('Error guardando boleto:', error);
            showError(`Error al guardar el boleto: ${error.message}`);
        }
    }

    // Ver detalle del boleto
    window.verDetalleBoleto = async function(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/boletos/listarId/${id}`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const boleto = await response.json();
            mostrarModalDetalle(boleto);
            
        } catch (error) {
            console.error('Error cargando detalle:', error);
            showError('Error al cargar los detalles del boleto: ' + error.message);
        }
    };

    // Mostrar modal de detalle
    function mostrarModalDetalle(boleto) {
        const modal = document.getElementById('detailModal');
        const body = document.getElementById('detailModalBody');
        
        if (!modal || !body) return;
        
        // Encontrar la sesión correspondiente
        const sesion = sesionesData.find(s => s.idsesion === (boleto.sesion?.idsesion || boleto.sesion));
        
        // Formatear fechas
        const fechaCompra = boleto.fechaCompra ? 
            new Date(boleto.fechaCompra).toLocaleString('es-ES') : 
            'No especificada';
        
        const fechaSesion = sesion?.fecha ? 
            new Date(sesion.fecha).toLocaleDateString('es-ES') : 
            'No especificada';
        
        body.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 48px; color: #667eea; margin-bottom: 10px;">
                    <i class="fas fa-ticket-alt"></i>
                </div>
                <h3>Boleto #${boleto.idboleto || boleto.id_boleto}</h3>
                <span class="status-badge ${boleto.estado === 'PAGADO' ? 'status-pagado' : boleto.estado === 'RESERVADO' ? 'status-reservado' : 'status-cancelado'}">
                    ${boleto.estado || 'RESERVADO'}
                </span>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4><i class="fas fa-info-circle"></i> Información del Boleto</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <p><strong>Número de Asiento:</strong></p>
                        <div style="font-size: 24px; font-weight: bold; color: #667eea; text-align: center;">
                            ${boleto.numeroAsiento || 'N/A'}
                        </div>
                    </div>
                    <div>
                        <p><strong>Tipo de Entrada:</strong></p>
                        <div style="font-size: 18px; font-weight: bold; color: #553c9a; text-align: center;">
                            ${boleto.tipoEntrada || 'ADULTO'}
                        </div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <p><strong>Precio Pagado:</strong></p>
                    <div style="font-size: 28px; font-weight: bold; color: #38a169; text-align: center;">
                        $${boleto.precioPagado?.toFixed(2) || '0.00'}
                    </div>
                </div>
                <p style="margin-top: 15px;"><strong>Fecha de Compra:</strong> ${fechaCompra}</p>
            </div>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4><i class="fas fa-film"></i> Información de la Sesión</h4>
                ${sesion ? `
                <p><strong>Película:</strong> ${sesion.pelicula?.titulo || 'Desconocida'}</p>
                <p><strong>Sala:</strong> Sala ${sesion.sala?.numeroSala || 'N/A'}</p>
                <p><strong>Fecha:</strong> ${fechaSesion} a las ${sesion.hora || 'N/A'}</p>
                <p><strong>Precio Base:</strong> $${sesion.precio?.toFixed(2) || '0.00'}</p>
                ` : '<p>Sesión no encontrada</p>'}
            </div>
            
            ${userRole === 'ADMIN' ? `
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-primary" onclick="window.editarBoleto(${boleto.idboleto || boleto.id_boleto}); closeDetailModal();">
                    <i class="fas fa-edit"></i> Editar Boleto
                </button>
                <button class="btn btn-danger" onclick="window.eliminarBoleto(${boleto.idboleto || boleto.id_boleto}); closeDetailModal();" style="margin-left: 10px;">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
            ` : ''}
        `;
        
        modal.style.display = 'flex';
    };

    // Editar boleto
    window.editarBoleto = async function(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/boletos/listarId/${id}`, {
                method: 'GET',
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const boleto = await response.json();
            
            const modal = document.getElementById('boletoModal');
            const title = document.getElementById('modalTitle');
            
            if (!modal || !title) return;
            
            title.textContent = 'Editar Boleto';
            document.getElementById('boletoId').value = boleto.idboleto || boleto.id_boleto;
            document.getElementById('sesionId').value = boleto.sesion?.idsesion || boleto.sesion;
            document.getElementById('tipoEntrada').value = boleto.tipoEntrada || 'ADULTO';
            document.getElementById('estadoBoleto').value = boleto.estado || 'RESERVADO';
            document.getElementById('precioPagado').value = boleto.precioPagado?.toFixed(2) || '0.00';
            document.getElementById('numeroAsiento').value = boleto.numeroAsiento || '';
            
            // Cargar información de la sesión
            if (boleto.sesion?.idsesion) {
                await cargarSesionInfo();
                const selectedSeatInfo = document.getElementById('selectedSeatInfo');
                if (selectedSeatInfo) selectedSeatInfo.textContent = boleto.numeroAsiento || 'Ninguno';
                
                // Marcar asiento seleccionado
                if (boleto.numeroAsiento) {
                    setTimeout(() => {
                        seleccionarAsiento(boleto.numeroAsiento);
                    }, 500);
                }
            }
            
            modal.style.display = 'flex';
            
        } catch (error) {
            console.error('Error cargando boleto:', error);
            showError('Error al cargar el boleto: ' + error.message);
        }
    };

    // Eliminar boleto
    window.eliminarBoleto = function(id) {
        boletoAEliminar = id;
        accionConfirmar = 'eliminar';
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmActionBtn = document.getElementById('confirmActionBtn');
        
        if (confirmTitle) confirmTitle.textContent = 'Confirmar Eliminación';
        if (confirmMessage) confirmMessage.textContent = '¿Estás seguro de que quieres eliminar este boleto? Esta acción no se puede deshacer.';
        if (confirmActionBtn) confirmActionBtn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
        
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) confirmModal.style.display = 'flex';
    };

    // Cancelar boleto
    window.cancelarBoleto = function(id) {
        currentBoletoId = id;
        accionConfirmar = 'cancelar';
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmActionBtn = document.getElementById('confirmActionBtn');
        
        if (confirmTitle) confirmTitle.textContent = 'Confirmar Cancelación';
        if (confirmMessage) confirmMessage.textContent = '¿Estás seguro de que quieres cancelar este boleto?';
        if (confirmActionBtn) confirmActionBtn.innerHTML = '<i class="fas fa-ban"></i> Cancelar';
        
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) confirmModal.style.display = 'flex';
    };

    // Ejecutar acción confirmada
    window.executeConfirmAction = async function() {
        try {
            if (accionConfirmar === 'eliminar' && boletoAEliminar) {
                const response = await fetch(`${API_BASE_URL}/boletos/eliminar/${boletoAEliminar}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                });
                
                checkTokenExpired(response);
                
                if (!response.ok) {
                    throw new Error(`Error: ${response.status}`);
                }
                
                closeConfirmModal();
                await cargarBoletos();
                await cargarEstadisticas();
                showSuccess('Boleto eliminado correctamente');
                
            } else if (accionConfirmar === 'cancelar' && currentBoletoId) {
                const response = await fetch(`${API_BASE_URL}/boletos/cancelar/${currentBoletoId}`, {
                    method: 'PUT',
                    headers: getHeaders()
                });
                
                checkTokenExpired(response);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Error: ${response.status}`);
                }
                
                closeConfirmModal();
                await cargarBoletos();
                await cargarEstadisticas();
                showSuccess('Boleto cancelado correctamente');
            }
            
        } catch (error) {
            console.error('Error ejecutando acción:', error);
            showError('Error: ' + error.message);
            closeConfirmModal();
        }
    };

    // Exportar boletos (solo para admin)
    window.exportarBoletos = function() {
        if (userRole !== 'ADMIN') {
            showError('Solo los administradores pueden exportar boletos');
            return;
        }
        
        // Crear contenido CSV
        let csvContent = "ID,Sesión,Película,Sala,Asiento,Fecha Compra,Precio,Tipo,Estado\n";
        
        boletosOriginales.forEach(boleto => {
            const sesion = sesionesData.find(s => s.idsesion === (boleto.sesion?.idsesion || boleto.sesion));
            const fecha = boleto.fechaCompra ? 
                new Date(boleto.fechaCompra).toLocaleString('es-ES') : 
                'N/A';
            
            csvContent += `${boleto.idboleto || ''},` +
                         `${sesion?.idsesion || ''},` +
                         `"${sesion?.pelicula?.titulo || 'N/A'}",` +
                         `${sesion?.sala?.numeroSala || 'N/A'},` +
                         `${boleto.numeroAsiento || ''},` +
                         `"${fecha}",` +
                         `${boleto.precioPagado?.toFixed(2) || '0.00'},` +
                         `${boleto.tipoEntrada || ''},` +
                         `${boleto.estado || ''}\n`;
        });
        
        // Crear y descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `boletos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('Boletos exportados correctamente');
    };

    // Cerrar modales
    function closeModal() {
        const modal = document.getElementById('boletoModal');
        if (modal) modal.style.display = 'none';
    }

    function closeConfirmModal() {
        const modal = document.getElementById('confirmModal');
        if (modal) modal.style.display = 'none';
        boletoAEliminar = null;
        currentBoletoId = null;
        accionConfirmar = '';
    }

    function closeDetailModal() {
        const modal = document.getElementById('detailModal');
        if (modal) modal.style.display = 'none';
    }

    // Exponer funciones necesarias globalmente
    window.closeModal = closeModal;
    window.closeConfirmModal = closeConfirmModal;
    window.closeDetailModal = closeDetailModal;
    window.aplicarFiltros = aplicarFiltros;
    window.calcularPrecio = window.calcularPrecio;

    // --- Iniciar ---
    init();
})();