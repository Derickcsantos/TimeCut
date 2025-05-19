document.addEventListener('DOMContentLoaded', function () {
  const user = JSON.parse(localStorage.getItem('currentUser'));

  // Verifica se está logado
  if (!user || localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = '/login';
    return;
  }

  if (window.location.pathname === '/logado/agendamentos') {
    document.getElementById('paginaInicial').style.display = 'none';
    document.getElementById('paginaAgendamentos').style.display = 'block';
    carregarAgendamentos(user);
  } else {
    document.getElementById('paginaInicial').style.display = 'block';
    document.getElementById('paginaAgendamentos').style.display = 'none';
  }

  // Elementos da UI
  const perfilModal = new bootstrap.Modal(document.getElementById('perfilModal'));
  const btnPerfil = document.getElementById('btnPerfil');
  const btnLogout = document.getElementById('btnLogout');
  const themeToggle = document.getElementById('themeToggle');
  const profileForm = document.getElementById('profileForm');

  // Configura o botão de perfil
  btnPerfil.addEventListener('click', () => {
    // Preenche os campos do modal com os dados do usuário
    document.getElementById('profileUsername').value = user.username || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profilePassword').value = user.password;
    document.getElementById('profileTipo').value = user.tipo || 'comum';
    
    // Mostra o modal
    perfilModal.show();
  });
  // Função para carregar agendamentos
  async function carregarAgendamentos(user) {
    try {
      const response = await fetch(`/api/logado/appointments?email=${encodeURIComponent(user.email)}`);
      const agendamentos = await response.json();

      const tbody = document.querySelector('#tabelaAgendamentos tbody');

      if (!agendamentos.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Nenhum agendamento encontrado</td></tr>';
        document.getElementById('contagemRegressiva').style.display = 'none';
        return;
      }

      // Ordena por data mais próxima
      agendamentos.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Atualiza a contagem regressiva
      atualizarContagemRegressiva(agendamentos);

      // Preenche a tabela
      tbody.innerHTML = agendamentos.map(agendamento => `
        <tr>
          <td>${formatarData(agendamento.date)}</td>
          <td>${agendamento.professional_name || 'Não informado'}</td>
          <td>${agendamento.start_time} - ${agendamento.end_time}</td>
          <td>${agendamento.service_name}</td>
          <td><span class="badge ${getStatusClass(agendamento.status)}">${agendamento.status}</span></td>
          <td>
            ${agendamento.status === 'confirmed' ? 
              `<button class="btn btn-sm btn-outline-danger cancelar-agendamento" data-id="${agendamento.id}">
                <i class="bi bi-x-circle"></i> Cancelar
              </button>` : 
              '<span class="text-muted">Nenhuma ação</span>'}
          </td>
        </tr>
      `).join('');

      // Adiciona eventos aos botões de cancelar
      document.querySelectorAll('.cancelar-agendamento').forEach(btn => {
        btn.addEventListener('click', cancelarAgendamento);
      });

    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      document.querySelector('#tabelaAgendamentos tbody').innerHTML = 
        '<tr><td colspan="7" class="text-center py-4 text-danger">Erro ao carregar agendamentos</td></tr>';
    }
  }

  // Função para atualizar a contagem regressiva
  function atualizarContagemRegressiva(agendamentos) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera horas para considerar só a data
  
    const agendamentosFuturos = agendamentos
      .filter(a => {
        const dataAgendamento = new Date(a.date);
        dataAgendamento.setHours(0, 0, 0, 0); // Também zera horas do agendamento
        return dataAgendamento >= hoje && a.status === 'confirmed';
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Ordena por data mais próxima
  
    if (agendamentosFuturos.length > 0) {
      const proximo = agendamentosFuturos[0];
      const dataAgendamento = new Date(proximo.date);
      dataAgendamento.setHours(0, 0, 0, 0); // Zera horas
  
      const diffTime = dataAgendamento - hoje;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Agora sim, sem contar hoje
  
      document.getElementById('diasRestantes').textContent = diffDays;
      document.getElementById('proximoServico').textContent = proximo.service_name;
      document.getElementById('contagemRegressiva').style.display = 'flex';
    } else {
      document.getElementById('contagemRegressiva').style.display = 'none';
    }
  }
  

  // Função para cancelar agendamento
  async function cancelarAgendamento(e) {
    const id = e.target.closest('button').dataset.id;

    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }

    try {
      const response = await fetch(`/api/appointments/${id}/cancel`, {
        method: 'PUT'
      });

      if (response.ok) {
        alert('Agendamento cancelado com sucesso!');
        carregarAgendamentos(user);
      } else {
        throw new Error('Falha ao cancelar agendamento');
      }
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      alert('Erro ao cancelar agendamento');
    }
  }

  // Funções auxiliares
  function formatarData(dataString) {
    if (!dataString) return 'N/A';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dataString).toLocaleDateString('pt-BR', options);
  }

  function getStatusClass(status) {
    const classes = {
      'confirmed': 'bg-primary',
      'completed': 'bg-success',
      'canceled': 'bg-secondary',
      'no_show': 'bg-danger'
    };
    return classes[status] || 'bg-warning text-dark';
  }

  // Logout
  btnLogout.addEventListener('click', logout);

  // Alternar tema
  themeToggle.addEventListener('click', toggleTheme);
  updateThemeIcon();

  // Atualizar perfil
  if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const username = document.getElementById('profileUsername').value;
      const email = document.getElementById('profileEmail').value;
      const password = document.getElementById('profilePassword').value;

      try {
        const updateData = { username, email };
        if (password) updateData.password_plaintext = password;

        const response = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });

        if (!response.ok) {
          throw new Error('Erro ao atualizar perfil');
        }

        const updatedUser = await response.json();
        
        // Atualiza localStorage
        localStorage.setItem('currentUser', JSON.stringify({
          ...user,
          username: updatedUser.username,
          email: updatedUser.email,
          password: updatedUser.password
        }));

        showToast('Perfil atualizado com sucesso!', 'success');
        perfilModal.hide();
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showToast(`Erro: ${error.message}`, 'error');
      }
    });
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

  // Funções auxiliares
  function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    window.location.href = '/login';
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const icon = themeToggle.querySelector('i');
    
    if (currentTheme === 'dark') {
      icon.classList.remove('bi-moon-fill');
      icon.classList.add('bi-sun-fill');
    } else {
      icon.classList.remove('bi-sun-fill');
      icon.classList.add('bi-moon-fill');
    }
  }

  function showToast(message, type) {
    // Implementação básica de toast - pode ser substituída por uma biblioteca
    const toastContainer = document.createElement('div');
    toastContainer.className = `toast-container position-fixed bottom-0 end-0 p-3`;
    
    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    const toastBody = document.createElement('div');
    toastBody.className = 'd-flex';
    
    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-body';
    toastMessage.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close btn-close-white me-2 m-auto';
    closeButton.setAttribute('data-bs-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    
    toastBody.appendChild(toastMessage);
    toastBody.appendChild(closeButton);
    toast.appendChild(toastBody);
    toastContainer.appendChild(toast);
    
    document.body.appendChild(toastContainer);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toastContainer.remove(), 300);
    }, 3000);
  }

  // Carregar tema salvo
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-bs-theme', savedTheme);
  updateThemeIcon();
});