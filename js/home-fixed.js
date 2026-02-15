// home-fixed.js - VERSIÓN CORREGIDA (SIN REDECLARACIONES)
// =============================================

// SOLO DECLARAMOS UNA VEZ - USAMOS var EN LUGAR DE let PARA EVITAR CONFLICTOS
var stompClient = null;
var unreadMessages = new Map();
var selectedUserForReply = null;

// NO REDECLARAMOS userEmail - USAMOS LA QUE YA EXISTE EN api.js

console.log('📋 home-fixed.js cargado - Datos usuario:', { 
    currentUser: currentUser, 
    userRole: userRole, 
    userEmail: userEmail 
});

// =============================================
// INICIALIZACIÓN
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM cargado en home-fixed.js');
    
    // Verificar autenticación
    if (!checkAuth()) {
        return;
    }
    
    updateAuthData(); // Actualizar datos desde localStorage
    
    // Mostrar información del usuario
    const currentUserNameSpan = document.getElementById('currentUserName');
    const userRoleBadgeSpan = document.getElementById('userRoleBadge');
    
    if (currentUserNameSpan) {
        currentUserNameSpan.textContent = currentUser || 'Usuario';
    }
    
    if (userRoleBadgeSpan) {
        userRoleBadgeSpan.textContent = userRole;
        userRoleBadgeSpan.className = `role-badge badge-${(userRole || 'user').toLowerCase()}`;
    }
    
    // Mostrar/ocultar opciones de ADMIN
    if (userRole === 'ADMIN') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'list-item';
        });
        console.log('✅ Opciones de ADMIN visibles');
    } else {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }
    
    // Inicializar chat después de que el layout esté listo
    if (typeof initChat === 'function') {
        setTimeout(initChat, 500);
    }
});

// =============================================
// INICIALIZACIÓN DEL CHAT
// =============================================
function initChat() {
    console.log('💬 Inicializando chat...');
    
    // Verificar que el usuario esté autenticado
    if (!currentUser || !token) {
        console.log('Usuario no autenticado, chat no disponible');
        return;
    }
    
    // Verificar que las librerías estén cargadas
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        console.log('Cargando librerías WebSocket...');
        loadWebSocketLibraries();
        return;
    }
    
    // Crear widget y conectar
    createChatWidget();
    connectWebSocket();
    
    // Si es admin, iniciar auto-refresh
    if (userRole === 'ADMIN') {
        startAutoRefreshUsers();
    }
}

// Cargar librerías WebSocket si no están
function loadWebSocketLibraries() {
    if (typeof SockJS === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js';
        script.onload = function() {
            if (typeof Stomp !== 'undefined') {
                initChat();
            }
        };
        document.head.appendChild(script);
    }
    
    if (typeof Stomp === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js';
        script.onload = function() {
            if (typeof SockJS !== 'undefined') {
                initChat();
            }
        };
        document.head.appendChild(script);
    }
}

// =============================================
// CREAR WIDGET DE CHAT
// =============================================
function createChatWidget() {
    // No crear si ya existe
    if (document.querySelector('.chat-widget')) {
        console.log('Widget de chat ya existe');
        return;
    }
    
    const isAdmin = userRole === 'ADMIN';
    
    const chatHTML = `
        <div class="chat-widget">
            <button class="chat-toggle-btn" id="chatToggleBtn">
                <i class="fas fa-comment"></i>
                <span class="chat-badge" id="chatBadge" style="display: none;">1</span>
            </button>
            
            <div class="chat-container" id="chatContainer" style="display: none;">
                <div class="chat-header">
                    <h4>
                        <span class="chat-status online" id="chatStatus"></span>
                        ${isAdmin ? 'Panel de Soporte - Admin' : 'Chat con Soporte'}
                    </h4>
                    <button class="chat-close-btn" id="chatCloseBtn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="welcome-message">
                        <p><strong>¡Hola ${currentUser || 'Usuario'}!</strong></p>
                        <p>${isAdmin ? 'Selecciona un usuario para responder.' : '¿En qué podemos ayudarte?'}</p>
                        <p class="connection-info">Conectando...</p>
                    </div>
                </div>
                
                ${isAdmin ? `
                    <div class="admin-panel">
                        <div class="admin-chat-section">
                            <div class="admin-chat-header">
                                <h5><i class="fas fa-users"></i> Usuarios Activos</h5>
                                <button id="refreshUsersBtn" class="btn-refresh">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                            <div id="activeUsersList" class="active-users-list">
                                <div class="loading-users">Cargando usuarios...</div>
                            </div>
                        </div>
                        
                        <div class="admin-reply-section">
                            <div class="form-group">
                                <label>Responder a:</label>
                                <input type="text" id="respondToUser" class="admin-reply-input" 
                                       placeholder="Selecciona un usuario" readonly>
                            </div>
                            <div class="admin-message-input-group">
                                <input type="text" id="chatInput" placeholder="Escribe tu respuesta..." disabled>
                                <button id="adminSendBtn" class="btn-admin-send" disabled>
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="chat-input-container">
                        <input type="text" id="chatInput" placeholder="Escribe tu mensaje...">
                        <button class="chat-send-btn" id="chatSendBtn">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatHTML);
    setupChatEvents();
    console.log('✅ Widget de chat creado');
}

// =============================================
// CONFIGURAR EVENTOS DEL CHAT
// =============================================
function setupChatEvents() {
    const toggleBtn = document.getElementById('chatToggleBtn');
    const closeBtn = document.getElementById('chatCloseBtn');
    const chatContainer = document.getElementById('chatContainer');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const adminSendBtn = document.getElementById('adminSendBtn');
    const refreshBtn = document.getElementById('refreshUsersBtn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const isHidden = chatContainer.style.display === 'none';
            chatContainer.style.display = isHidden ? 'flex' : 'none';
            
            if (isHidden) {
                const badge = document.getElementById('chatBadge');
                if (badge) badge.style.display = 'none';
                
                if (userRole === 'ADMIN') {
                    loadActiveUsers();
                }
            }
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            chatContainer.style.display = 'none';
            toggleBtn.innerHTML = '<i class="fas fa-comment"></i>';
        });
    }
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendUserMessage);
    }
    
    if (adminSendBtn) {
        adminSendBtn.addEventListener('click', sendAdminMessage);
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadActiveUsers);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                if (userRole === 'ADMIN') {
                    sendAdminMessage();
                } else {
                    sendUserMessage();
                }
            }
        });
    }
}

// =============================================
// FUNCIONES DEL CHAT (SIMPLIFICADAS)
// =============================================
function connectWebSocket() {
    console.log('Conectando WebSocket...');
    updateChatStatus('online');
}

function updateChatStatus(status) {
    const indicator = document.getElementById('chatStatus');
    if (indicator) {
        indicator.className = 'chat-status ' + status;
    }
}

function sendUserMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    displayMessage({
        senderEmail: currentUser,
        contenido: message,
        fechaCreacion: new Date().toISOString()
    }, 'own');
    
    input.value = '';
    
    // Simular respuesta
    setTimeout(() => {
        displayMessage({
            senderEmail: 'admin@cine.com',
            contenido: 'Gracias por tu mensaje. Te responderemos pronto.',
            fechaCreacion: new Date().toISOString()
        }, 'auto');
    }, 1000);
}

function sendAdminMessage() {
    const respondTo = document.getElementById('respondToUser').value;
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!respondTo || !message) {
        alert('Selecciona un usuario y escribe un mensaje');
        return;
    }
    
    displayMessage({
        senderEmail: 'admin@cine.com',
        contenido: `Para ${respondTo}: ${message}`,
        fechaCreacion: new Date().toISOString()
    }, 'admin');
    
    input.value = '';
}

function displayMessage(message, type = 'other') {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    // Ocultar mensaje de bienvenida
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg && container.children.length === 1) {
        welcomeMsg.style.display = 'none';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    let senderName = message.senderEmail;
    if (type === 'own') senderName = 'Tú';
    if (type === 'admin') senderName = 'Administrador';
    if (type === 'auto') senderName = 'Sistema';
    
    const time = new Date(message.fechaCreacion).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-sender">${senderName}</div>
        <div class="message-content">${message.contenido}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function loadActiveUsers() {
    const container = document.getElementById('activeUsersList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="user-item" onclick="selectUser('usuario@demo.com')">
            <div class="user-info">
                <div class="user-avatar-small"><i class="fas fa-user-circle"></i></div>
                <div class="user-details">
                    <div class="user-name-row">
                        <span class="user-name">Usuario Demo</span>
                    </div>
                    <div class="user-email">usuario@demo.com</div>
                    <div class="user-last-message">
                        <small>Último mensaje...</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function selectUser(email) {
    selectedUserForReply = email;
    
    const input = document.getElementById('respondToUser');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('adminSendBtn');
    
    if (input) input.value = email;
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.focus();
    }
    if (sendBtn) sendBtn.disabled = false;
    
    // Actualizar UI
    document.querySelectorAll('.user-item').forEach(el => {
        el.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
}

function startAutoRefreshUsers() {
    setInterval(loadActiveUsers, 10000);
}

// Exponer funciones globalmente
window.selectUser = selectUser;
window.initChat = initChat;
window.logout = logout;

// =============================================
// LOGOUT
// =============================================
function logout() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}