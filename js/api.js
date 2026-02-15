// js/api.js
// Configuración de la API
const API_BASE_URL = 'http://localhost:8080/api';
let token = localStorage.getItem('jwtToken') || '';
let currentUser = localStorage.getItem('currentUser') || '';
let userRole = localStorage.getItem('userRole') || '';
let userEmail = localStorage.getItem('userEmail') || '';

// Función para actualizar las variables desde localStorage (útil después de login)
function updateAuthData() {
    token = localStorage.getItem('jwtToken') || '';
    currentUser = localStorage.getItem('currentUser') || '';
    userRole = localStorage.getItem('userRole') || '';
    userEmail = localStorage.getItem('userEmail') || '';
}

// Verificar autenticación y redirigir si es necesario
function checkAuth() {
    updateAuthData(); // Asegurar datos actualizados
    if (!token || !currentUser) {
        // Evitar redirección en bucle si ya estamos en index.html
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
        return false;
    }
    return true;
}

// Verificar rol de usuario
function hasRole(requiredRole) {
    updateAuthData();
    return userRole === requiredRole;
}

// Función para mostrar mensajes de error
function showError(message, elementId = 'errorMessage') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        alert('Error: ' + message);
    }
}

// Función para mostrar mensajes de éxito
function showSuccess(message, elementId = 'successMessage') {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
        
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    } else {
        alert('Éxito: ' + message);
    }
}

// Headers común para las peticiones
function getHeaders() {
    updateAuthData(); // Asegurar que el token es el actual
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function logout() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    // Redirigir al login
    window.location.href = 'index.html';
}

// Verificar token expirado
function checkTokenExpired(response) {
    // Solo tratar como token expirado si es 401 (no autorizado)
    if (response.status === 401) {
        console.warn('Token expirado o no autorizado. Cerrando sesión.');
        logout();
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    // Para 403 (prohibido) no cerrar sesión, solo mostrar error
    if (response.status === 403) {
        console.warn('Acceso prohibido - permisos insuficientes');
        // No cerrar sesión, solo lanzar error
        throw new Error('No tienes permisos para realizar esta acción');
    }
    return response;
}

// Función para obtener información del usuario (opcional, si el backend la provee)
async function fetchAndSaveUserEmail() {
    // Esta función podría implementarse si el backend tiene un endpoint para obtener el email
    // Por ahora, usamos el username como email por defecto.
    console.warn('fetchAndSaveUserEmail no está implementado completamente. Usando username como email.');
    const username = localStorage.getItem('currentUser');
    if (username && !localStorage.getItem('userEmail')) {
        const defaultEmail = username.includes('@') ? username : `${username}@default.com`;
        localStorage.setItem('userEmail', defaultEmail);
        userEmail = defaultEmail;
    }
    return userEmail;
}

async function getBoletosPorSesion(sesionId) {
    try {
        const response = await fetch(`${API_BASE_URL}/boletos/sesion/${sesionId}`, {
            method: 'GET',
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error obteniendo boletos por sesión:', error);
        return [];
    }
}

// Función para obtener boletos por estado
async function getBoletosPorEstado(estado) {
    try {
        const response = await fetch(`${API_BASE_URL}/boletos/estado/${estado}`, {
            method: 'GET',
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error obteniendo boletos por estado:', error);
        return [];
    }
}

// Función para obtener boletos por fecha
async function getBoletosPorFecha(fecha) {
    try {
        const response = await fetch(`${API_BASE_URL}/boletos/fecha/${fecha}`, {
            method: 'GET',
            headers: getHeaders()
        });
        
        checkTokenExpired(response);
        
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Error obteniendo boletos por fecha:', error);
        return [];
    }
}
