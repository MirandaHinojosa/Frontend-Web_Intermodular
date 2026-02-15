// js/auth.js
(function() {
    // Obtener referencias a elementos del DOM
    const loginContainer = document.getElementById('loginContainer');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');

    // Verificar si ya hay sesión activa al cargar la página
    updateAuthData(); // Usar función de api.js
    if (token && currentUser) {
        window.location.href = 'home.html';
        return;
    }

    // Función de login
    window.login = async function() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            showError('Por favor, completa todos los campos');
            return;
        }
        
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Usuario o contraseña incorrectos');
                }
                throw new Error(`Error del servidor: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Login response:', data);

            // --- ADAPTACIÓN SEGÚN LA RESPUESTA DEL BACKEND ---
            // Asumimos que el token viene en data.token o data.accessToken
            const accessToken = data.token || data.accessToken;
            const role = data.role || data.roles || 'USER'; // Ajusta según tu backend
            const email = data.email || (username.includes('@') ? username : `${username}@example.com`); // Si el email no viene, creamos uno por defecto

            if (accessToken) {
                // Guardar en localStorage
                localStorage.setItem('jwtToken', accessToken);
                localStorage.setItem('currentUser', username);
                localStorage.setItem('userRole', role);
                localStorage.setItem('userEmail', email);
                
                // Actualizar variables globales de api.js
                updateAuthData();
                
                showSuccess('¡Login exitoso! Redirigiendo...');
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 1000);
            } else {
                throw new Error('No se recibió el token de acceso');
            }
            
        } catch (error) {
            showError(error.message || 'Error al iniciar sesión');
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Ingresar';
        }
    };

    // Permitir login con Enter
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') login();
        });
    }
})();