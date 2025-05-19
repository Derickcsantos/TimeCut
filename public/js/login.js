document.addEventListener('DOMContentLoaded', function() {
const loginForm = document.getElementById('loginForm');
const cadastroForm = document.getElementById('cadastroForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const loginMessage = document.getElementById('loginMessage');
const cadastroMessage = document.getElementById('cadastroMessage');
const recoveryMessage = document.getElementById('recoveryMessage');
const loginContainer = document.getElementById('loginContainer');
const cadastroContainer = document.getElementById('cadastroContainer');
const switchToCadastro = document.getElementById('switchToCadastro');
const switchToLogin = document.getElementById('switchToLogin');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotPasswordModal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));


// Alternar entre login e cadastro
switchToCadastro.addEventListener('click', function(e) {
  e.preventDefault();
  loginContainer.style.display = 'none';
  cadastroContainer.style.display = 'block';
});

switchToLogin.addEventListener('click', function(e) {
  e.preventDefault();
  cadastroContainer.style.display = 'none';
  loginContainer.style.display = 'block';
});

// Login
// Login
loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'  // Muito importante: isso envia cookies com a requisição
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      // Incrementa tentativas
      let attempts = parseInt(localStorage.getItem('tentativaslogin') || '0');
      attempts++;

      localStorage.setItem('tentativaslogin', attempts);

      if (attempts >= 5) {
        throw new Error('Você excedeu o número máximo de tentativas. Tente novamente mais tarde.');
      } else {
        throw new Error(result.error || `Credenciais inválidas. Tentativa ${attempts}/3.`);
      }
    }

    const userData = {
      ...result.user,
      password: password 
    };

    // Armazena dados no localStorage
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('tentativaslogin', '0');
    localStorage.setItem('currentUser', JSON.stringify(userData));

    // Redireciona para a área apropriada com base no tipo de usuário
    if (result.user.tipo === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/logado';
    }

  } catch (error) {
    showMessage(loginMessage, error.message, 'danger');
  }
});


// Cadastro
cadastroForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const username = document.getElementById('cadastroUsername').value.trim();
  const email = document.getElementById('cadastroEmail').value.trim();
  const aniversario = document.getElementById('cadastroAniversario').value.trim();
  const password = document.getElementById('cadastroPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Validações básicas
  if (password !== confirmPassword) {
    showMessage(cadastroMessage, 'As senhas não coincidem', 'danger');
    return;
  }

  if (password.length < 2) {
    showMessage(cadastroMessage, 'A senha deve ter pelo menos 3 caracteres', 'danger');
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        email, 
        aniversario,
        password_plaintext: password
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Erro ao cadastrar usuário');
    }

    showMessage(cadastroMessage, 'Cadastro realizado com sucesso! Faça login para continuar.', 'success');
    
    // Volta para o login após 2 segundos
    setTimeout(() => {
      cadastroContainer.style.display = 'none';
      loginContainer.style.display = 'block';
      cadastroForm.reset();
    }, 2000);

  } catch (error) {
    showMessage(cadastroMessage, error.message, 'danger');
  }
});

// Adicione este novo evento para o link "Esqueceu a senha"
forgotPasswordLink.addEventListener('click', function(e) {
  e.preventDefault();
  forgotPasswordModal.show();
});

// Formulário de recuperação de senha
forgotPasswordForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('recoveryEmail').value.trim();
  
  try {
    const response = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Erro ao processar solicitação');
    }

    showMessage(recoveryMessage, 'Uma nova senha foi enviada para seu email. Verifique sua caixa de entrada.', 'success');
    
    // Fecha o modal após 3 segundos
    setTimeout(() => {
      forgotPasswordModal.hide();
      forgotPasswordForm.reset();
      recoveryMessage.classList.add('d-none');
    }, 3000);

  } catch (error) {
    showMessage(recoveryMessage, error.message, 'danger');
  }
});

function showMessage(element, message, type) {
  element.textContent = message;
  element.className = `mt-3 alert alert-${type}`;
  element.classList.remove('d-none');
}

// Visibilidade da senha
document.addEventListener('click', function(e) {
  if (e.target.closest('.toggle-password')) {
    const button = e.target.closest('.toggle-password');
    const input = button.parentElement.querySelector('.password-input');

    if (input) {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';

      const icon = button.querySelector('i');
      if (icon) {
        icon.classList.toggle('bi-eye-fill', !isHidden);
        icon.classList.toggle('bi-eye-slash-fill', isHidden);
      }
    }
  }
});
});