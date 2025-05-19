// Elementos do formulário de usuários (admin)
const userForm = document.getElementById('userForm');
const userIdInput = document.getElementById('userId');
const userUsernameInput = document.getElementById('userUsername');
const userEmailInput = document.getElementById('userEmail');
const userPasswordInput = document.getElementById('userPassword');
const userTypeSelect = document.getElementById('userType');
const cancelUserEditBtn = document.getElementById('cancelUserEdit');
const usersTable = document.getElementById('usersTable');

// Elementos do formulário de perfil (configurações)
const userProfileForm = document.getElementById('userProfileForm');
const profileUserIdInput = document.getElementById('userId');
const profileUsernameInput = document.getElementById('userUsername');
const profileEmailInput = document.getElementById('userEmail');
const profilePasswordInput = document.getElementById('userPassword');


// Verificar se os elementos do formulário de perfil existem
if (profileUserIdInput && profileUsernameInput && profileEmailInput && profilePasswordInput) {
  // Carregar dados do usuário ao carregar a página
  document.addEventListener('DOMContentLoaded', loadAndDisplayUserData);
}
// Função para carregar usuário do LocalStorage
function getCurrentUser() {
  const userData = localStorage.getItem('currentUser');
  if (!userData) {
    throw new Error('Nenhum usuário logado encontrado');
  }
  
  const user = JSON.parse(userData);
  
  // Garante que o objeto tenha a propriedade password
  if (!user.password) {
    user.password ;
  }
  
  return user;
}

// Função para carregar e exibir dados do usuário (configurações)
async function loadAndDisplayUserData() {
  const userInfoElement = document.getElementById('userInfo');
  
  try {
    // Mostrar loading
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p>Carregando dados do usuário...</p>
        </div>
      `;
    }

    // Obter usuário do LocalStorage
    const currentUser = getCurrentUser();
    
    // Preencher formulário - incluindo a senha
    profileUserIdInput.value = currentUser.id;
    profileUsernameInput.value = currentUser.username;
    profileEmailInput.value = currentUser.email || '';
    profilePasswordInput.value = currentUser.password || ''; 
    
    // Mostrar informações
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <div class="user-profile-summary">
          <h5 class="mb-3">Informações do Perfil</h5>
          <div class="row">
            <div class="col-md-6">
              <p><strong>ID:</strong> ${currentUser.id}</p>
              <p><strong>Nome de usuário:</strong> ${currentUser.username}</p>
            </div>
            <div class="col-md-6">
              <p><strong>E-mail:</strong> ${currentUser.email || 'Não informado'}</p>
             <p><strong>Senha:</strong> ${'*'.repeat(currentUser.password?.length || 0)}</p>
            </div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
    
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle-fill"></i> Erro ao carregar perfil: ${error.message}
        </div>
      `;
    }
  }
}

// Função para atualizar perfil do usuário (configurações)
// Função para atualizar perfil do usuário (configurações)
async function updateUserProfile(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;

  try {
    // Mostrar loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      Salvando...
    `;

    const userId = profileUserIdInput.value;
    const username = profileUsernameInput.value.trim();
    const email = profileEmailInput.value.trim();
    const password = profilePasswordInput.value;

    if (!username || !email) {
      throw new Error('Preencha nome de usuário e e-mail');
    }

    // Preparar dados para atualização
    const updateData = { 
      username, 
      email,
      // Inclui a senha apenas se foi alterada (não está vazia)
      ...(password && { password_plaintext: password })
    };

    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}` // Adicione se usar autenticação por token
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao atualizar usuário');
    }

    const updatedUser = await response.json();

    // Atualiza os dados no LocalStorage
    const currentUser = getCurrentUser();
    const updatedUserData = {
      ...currentUser,
      username: updatedUser.username,
      email: updatedUser.email,
      // Mantém a senha existente se não foi alterada, ou atualiza se foi alterada
      password: password || currentUser.password
    };
    
    localStorage.setItem('currentUser', JSON.stringify(updatedUserData));

    // Atualiza a exibição
    profileUsernameInput.value = updatedUserData.username;
    profileEmailInput.value = updatedUserData.email;
    
    // Mostra a senha em texto claro na seção de informações
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement) {
      userInfoElement.innerHTML = `
        <div class="user-profile-summary">
          <h5 class="mb-3">Informações do Perfil</h5>
          <div class="row">
            <div class="col-md-6">
              <p><strong>ID:</strong> ${updatedUserData.id}</p>
              <p><strong>Nome de usuário:</strong> ${updatedUserData.username}</p>
            </div>
            <div class="col-md-6">
              <p><strong>E-mail:</strong> ${updatedUserData.email || 'Não informado'}</p>
              <p><strong>Senha:</strong> ${updatedUserData.password || 'Não informado'}</p>
            </div>
          </div>
        </div>
      `;
    }

    showToast('Perfil atualizado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    showToast(`Erro: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}
// Função para carregar usuários na tabela (admin)
async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const users = await response.json();

    if (!response.ok) {
      throw new Error(users.error || 'Erro ao carregar usuários');
    }

    renderUsersTable(users);
  } catch (error) {
    console.error('Erro:', error);
    showToast(error.message, 'error');
  }
}

// Função para renderizar a tabela de usuários (admin)
function renderUsersTable(users) {
  usersTable.innerHTML = '';
  
  users.forEach(user => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td><span class="badge rounded-pill ${user.tipo === 'admin' ? 'bg-primary badge-admin' : 'bg-secondary badge-comum'}">${user.tipo}</span></td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td class="action-buttons">
        <button class="btn btn-sm btn-warning edit-user" data-id="${user.id}">Editar</button>
        <button class="btn btn-sm btn-danger delete-user" data-id="${user.id}">Excluir</button>
      </td>
    `;
    
    usersTable.appendChild(row);
  });

  // Adiciona eventos aos botões de edição
  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', async function() {
      const userId = this.getAttribute('data-id');
      await loadUserForEdit(userId);
    });
  });

  // Adiciona eventos aos botões de exclusão
  document.querySelectorAll('.delete-user').forEach(btn => {
    btn.addEventListener('click', async function() {
      const userId = this.getAttribute('data-id');
      if (confirm('Tem certeza que deseja excluir este usuário?')) {
        await deleteUser(userId);
        loadUsers();
      }
    });
  });
}

// Função para carregar usuário para edição (admin)
async function loadUserForEdit(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    const user = await response.json();

    if (!response.ok) {
      throw new Error(user.error || 'Erro ao carregar usuário');
    }

    userIdInput.value = user.id;
    userUsernameInput.value = user.username;
    userEmailInput.value = user.email;
    userTypeSelect.value = user.tipo;
    userPasswordInput.value = user.password;

    // Rola para o formulário
    document.getElementById('userForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Erro:', error);
    showToast(error.message, 'error');
  }
}

// Função para criar usuário (admin)
async function createUser(userData) {
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao criar usuário');
    }

    showToast('Usuário criado com sucesso!', 'success');
    return true;
  } catch (error) {
    console.error('Erro:', error);
    showToast(`Erro ao criar usuário: ${error.message}`, 'error');
    return false;
  }
}

// Função para atualizar usuário (admin)
async function updateUser(userData) {
  try {
    const response = await fetch(`/api/users/${userData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userData.username,
        email: userData.email,
        tipo: userData.tipo,
        ...(userData.password_plaintext && { password_plaintext: userData.password_plaintext })
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao atualizar usuário');
    }

    showToast('Usuário atualizado com sucesso!', 'success');
    return true;
  } catch (error) {
    console.error('Erro:', error);
    showToast(`Erro ao atualizar usuário: ${error.message}`, 'error');
    return false;
  }
}

// Função para excluir usuário (admin)
async function deleteUser(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao excluir usuário');
    }

    showToast('Usuário excluído com sucesso!', 'success');
  } catch (error) {
    console.error('Erro:', error);
    showToast(error.message || 'Erro ao excluir usuário', 'error');
  }
}

// Função para resetar formulário de usuário (admin)
function resetUserForm() {
  userForm.reset();
  userIdInput.value = '';
  userPasswordInput.value = '';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  
  // Configurações
  if (userProfileForm) {
    userProfileForm.addEventListener('submit', updateUserProfile);
    document.querySelector('a[data-bs-target="#settings"]')?.addEventListener('shown.bs.tab', loadAndDisplayUserData);
  }

  // Admin - Usuários
  if (userForm) {
    userForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const userData = {
        username: userUsernameInput.value.trim(),
        email: userEmailInput.value.trim(),
        tipo: userTypeSelect.value
      };

      if (userPasswordInput.value) {
        userData.password_plaintext = userPasswordInput.value;
      }

      if (userIdInput.value) {
        userData.id = userIdInput.value;
        await updateUser(userData);
      } else {
        await createUser(userData);
      }

      loadUsers();
      resetUserForm();
    });

    cancelUserEditBtn?.addEventListener('click', resetUserForm);
  }
});

// Função auxiliar para mostrar toasts
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toastContainer') || document.body;
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0 show`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}