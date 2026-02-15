// js/mis-boletos.js - VERSIÓN UNIFICADA
(function() {
    let misBoletos = [];
    let peliculas = [];
    let sesiones = [];

    function init() {
        console.log("🎟️ Inicializando Mis Boletos...");
        if (!checkAuth()) return;

        if (document.querySelector('.dashboard-container')) {
            cargarDatosIniciales();
        } else {
            document.addEventListener('layoutReady', cargarDatosIniciales);
        }
    }

    async function cargarDatosIniciales() {
        try {
            await Promise.all([
                cargarPeliculas(),
                cargarSesiones(),
                cargarMisBoletos()
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
        }
    }

    async function cargarSesiones() {
        const response = await fetch(`${API_BASE_URL}/sesiones/listar`, {
            headers: getHeaders()
        });
        
        if (response.ok) {
            sesiones = await response.json();
        }
    }

    async function cargarMisBoletos() {
        const container = document.getElementById('boletosContainer');
        
        try {
            // Obtener email del usuario
            let email = localStorage.getItem('userEmail');
            if (!email) {
                const userInfo = await fetch(`${API_BASE_URL}/auth/info-usuario`, {
                    headers: getHeaders()
                });
                if (userInfo.ok) {
                    const data = await userInfo.json();
                    email = data.email;
                    localStorage.setItem('userEmail', email);
                }
            }
            
            // Obtener boletos del usuario
            const response = await fetch(`${API_BASE_URL}/boletos/mis-boletos`, {
                headers: getHeaders()
            });
            
            checkTokenExpired(response);
            
            if (response.ok) {
                misBoletos = await response.json();
                mostrarMisBoletos();
            } else {
                throw new Error('Error cargando boletos');
            }
        } catch (error) {
            console.error('Error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error cargando boletos</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    function mostrarMisBoletos() {
        const container = document.getElementById('boletosContainer');
        
        if (!misBoletos || misBoletos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <h3>No tienes boletos</h3>
                    <p>Aún no has comprado ningún boleto.</p>
                    <a href="comprar-boletos.html" class="btn btn-primary" style="margin-top: 20px;">
                        <i class="fas fa-shopping-cart"></i> Comprar Boletos
                    </a>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        misBoletos.forEach(boleto => {
            const sesion = sesiones.find(s => s.idsesion === (boleto.sesion?.idsesion || boleto.sesion));
            const pelicula = peliculas.find(p => p.idpelicula === sesion?.pelicula?.idpelicula);
            
            const fechaCompra = boleto.fechaCompra ? 
                new Date(boleto.fechaCompra).toLocaleDateString('es-ES') : 
                'No disponible';
            
            const fechaSesion = sesion?.fecha ? 
                new Date(sesion.fecha).toLocaleDateString('es-ES') : 
                'No disponible';
            
            html += `
                <div class="boleto-card">
                    <div class="boleto-header">
                        <h3><i class="fas fa-ticket-alt"></i> Boleto #${boleto.idboleto}</h3>
                        <span class="estado-badge estado-${boleto.estado}">${boleto.estado}</span>
                    </div>
                    <div class="boleto-body">
                        <div class="info-row">
                            <span><i class="fas fa-film"></i> Película:</span>
                            <span><strong>${pelicula?.titulo || 'N/A'}</strong></span>
                        </div>
                        <div class="info-row">
                            <span><i class="fas fa-calendar"></i> Fecha sesión:</span>
                            <span>${fechaSesion} ${sesion?.hora?.substring(0,5) || ''}</span>
                        </div>
                        <div class="info-row">
                            <span><i class="fas fa-door-closed"></i> Sala:</span>
                            <span>Sala ${sesion?.sala?.numeroSala || 'N/A'}</span>
                        </div>
                        
                        <div class="asiento-info">
                            <div class="asiento-numero">${boleto.numeroAsiento || 'N/A'}</div>
                            <div>Asiento</div>
                        </div>
                        
                        <div class="info-row">
                            <span><i class="fas fa-tag"></i> Tipo entrada:</span>
                            <span>${boleto.tipoEntrada || 'ADULTO'}</span>
                        </div>
                        <div class="info-row">
                            <span><i class="fas fa-calendar-alt"></i> Fecha compra:</span>
                            <span>${fechaCompra}</span>
                        </div>
                        
                        <div class="precio-info">
                            $${boleto.precioPagado?.toFixed(2) || '0.00'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // --- Iniciar ---
    init();
})();