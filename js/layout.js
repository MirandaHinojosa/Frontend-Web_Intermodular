// js/layout.js - VERSIÓN FINAL CORREGIDA
(function() {
    // --- VARIABLES DE CONTROL ---
    // Usamos una bandera a nivel de window para asegurar que solo se ejecute una vez.
    if (window.__layoutInitialized) {
        console.log('⚠️ Layout ya estaba inicializado. Saliendo.');
        return;
    }
    window.__layoutInitialized = true;

    // --- CONFIGURACIÓN INICIAL ---
    const currentPath = window.location.pathname;
    console.log('🔧 Layout inicializado para:', currentPath);

    // NO APLICAR en ciertas páginas
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
        console.log('🚫 Página de login, layout no aplicado.');
        return;
    }

    // --- VERIFICAR AUTENTICACIÓN ---
    if (!checkAuth()) {
        console.log('🔒 No autenticado, redirigiendo a login.');
        window.location.href = 'index.html';
        return;
    }

    // --- ESPERAR A QUE EL DOM ESTÉ LISTO ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLayout);
    } else {
        setupLayout();
    }

    // --- FUNCIÓN PRINCIPAL PARA CONFIGURAR EL LAYOUT ---
    function setupLayout() {
        console.log('🛠️ Configurando layout...');

        // 1. Si YA HAY un dashboard-container, no hacemos nada (evita duplicados)
        if (document.querySelector('.dashboard-container')) {
            console.log('✅ Layout ya presente en el DOM. Saliendo.');
            // Aún así, aseguramos que los enlaces activos y el rol estén bien.
            updateSidebarUserInfo();
            markActiveLink();
            return;
        }

        // 2. Guardar el contenido original (si existe)
        const mainContainer = document.querySelector('.container, .comprar-container, .mis-boletos-container, .admin-boletos-container, .sesiones-admin-container');
        let savedContent = '';
        if (mainContainer) {
            savedContent = mainContainer.outerHTML;
            // No lo eliminamos aún, lo usaremos para inyectar después.
        } else {
            // Si no hay un contenedor específico, quizás la página ya tiene su propio contenido.
            // En ese caso, tomamos todo el body actual.
            savedContent = document.body.innerHTML;
        }

        // 3. Obtener datos del usuario
        const userName = localStorage.getItem('currentUser') || 'Usuario';
        const userRole = localStorage.getItem('userRole') || 'USER';
        const basePath = getBasePath();

        // 4. Crear el layout COMPLETO
        const layoutHTML = generateLayoutHTML(userName, userRole, basePath);

        // 5. Reemplazar TODO el contenido del body con el nuevo layout
        document.body.innerHTML = layoutHTML;

    

        // 6. Insertar el contenido guardado en el 'mainContent'
        const mainContentDiv = document.getElementById('mainContent');
        if (mainContentDiv && savedContent) {
            // Limpiamos cualquier estilo de display:'none' que pudiera haber quedado
            mainContentDiv.innerHTML = savedContent.replace(/style="display:\s*none;?"/g, '');
        }

        // 7. Actualizar info del sidebar y enlaces activos
        updateSidebarUserInfo();
        markActiveLink();

        // 8. Disparar un evento personalizado para que los scripts de las páginas sepan que el layout está listo
        document.dispatchEvent(new Event('layoutReady'));

        console.log('✅ Layout inyectado correctamente.');
    }

    // --- FUNCIÓN PARA GENERAR EL HTML DEL LAYOUT ---
    function generateLayoutHTML(userName, userRole, basePath) {
        const isAdmin = userRole === 'ADMIN';
        // Clase para el badge
        const roleBadgeClass = `badge-${userRole.toLowerCase()}`;

        return `
        <div class="dashboard-container">
            <!-- Sidebar -->
            <div class="sidebar">
                <div class="user-info">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <h3 id="sidebarUserName">${userName}</h3>
                    <span id="sidebarUserRoleBadge" class="role-badge ${roleBadgeClass}">${userRole}</span>
                </div>
                
                <ul class="menu">
                    <!-- Dashboard - siempre visible -->
                    <li class="menu-item">
                        <a href="${basePath}home.html" class="menu-link" id="menu-home">
                            <i class="fas fa-home"></i> Dashboard
                        </a>
                    </li>
                    
                    <!-- Cartelera (Público) -->
                    <li class="menu-item">
                        <a href="${basePath}peliculas-listar.html" class="menu-link" id="menu-cartelera">
                            <i class="fas fa-film"></i> Cartelera
                        </a>
                    </li>
                    
                    <!-- Comprar Boletos (Público) -->
                    <li class="menu-item">
                        <a href="${basePath}comprar-boletos.html" class="menu-link" id="menu-comprar">
                            <i class="fas fa-ticket-alt"></i> Comprar Boletos
                        </a>
                    </li>
                    
                    <!-- Mis Boletos (Público) -->
                    <li class="menu-item">
                        <a href="${basePath}mis-boletos.html" class="menu-link" id="menu-mis-boletos">
                            <i class="fas fa-receipt"></i> Mis Boletos
                        </a>
                    </li>
                    
                    <!-- SECCIÓN ADMIN (solo visible si es ADMIN) -->
                    ${isAdmin ? `
                    <li class="menu-item admin-only">
                        <a href="${basePath}peliculas.html" class="menu-link" id="menu-peliculas">
                            <i class="fas fa-film"></i> Gestión Películas
                        </a>
                    </li>
                    
                    <li class="menu-item admin-only">
                        <a href="${basePath}salas.html" class="menu-link" id="menu-salas">
                            <i class="fas fa-door-closed"></i> Salas
                        </a>
                    </li>
                    
                    <li class="menu-item admin-only">
                        <a href="${basePath}asiento.html" class="menu-link" id="menu-asientos">
                            <i class="fas fa-chair"></i> Asientos
                        </a>
                    </li>
                    
                    <li class="menu-item admin-only">
                        <a href="${basePath}sesiones.html" class="menu-link" id="menu-sesiones">
                            <i class="fas fa-clock"></i> Sesiones
                        </a>
                    </li>
                    
                    <li class="menu-item admin-only">
                        <a href="${basePath}boletos.html" class="menu-link" id="menu-boletos-admin">
                            <i class="fas fa-ticket-alt"></i> Boletos (Admin)
                        </a>
                    </li>
                    ` : ''}
                    
                    <!-- Cerrar Sesión - siempre visible -->
                    <li class="menu-item">
                        <a href="#" class="menu-link" onclick="logout()">
                            <i class="fas fa-sign-out-alt"></i> Cerrar Sesión
                        </a>
                    </li>
                </ul>
            </div>
            
            <!-- Main Content -->
            <div class="main-content" id="mainContent">
                <!-- El contenido específico de la página se cargará aquí -->
            </div>
        </div>
        
    
        `;
        
    }

    //<!-- <script src="${basePath}js/chat.js"></script>-->
    // --- FUNCIÓN PARA OBTENER LA RUTA BASE CORRECTA PARA LOS ENLACES ---
    function getBasePath() {
        // Si estamos en una subcarpeta (como /pages/), necesitamos subir un nivel
        if (window.location.pathname.includes('/pages/')) {
            return '../';
        }
        return '';
    }

    // --- ACTUALIZAR INFORMACIÓN DEL USUARIO EN EL SIDEBAR (por si cambia) ---
    function updateSidebarUserInfo() {
        const userNameSpan = document.getElementById('sidebarUserName');
        const userRoleSpan = document.getElementById('sidebarUserRoleBadge');
        const currentUser = localStorage.getItem('currentUser') || 'Usuario';
        const userRole = localStorage.getItem('userRole') || 'USER';

        if (userNameSpan) userNameSpan.textContent = currentUser;
        if (userRoleSpan) {
            userRoleSpan.textContent = userRole;
            userRoleSpan.className = `role-badge badge-${userRole.toLowerCase()}`;
        }
    }

    // --- MARCAR EL ENLACE ACTIVO EN EL MENÚ ---
    function markActiveLink() {
        const currentPage = window.location.pathname.split('/').pop();
        document.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            // Comparamos el nombre del archivo, ignorando rutas relativas (../)
            if (href && href.includes(currentPage)) {
                link.classList.add('active');
            }
        });
    }
})();