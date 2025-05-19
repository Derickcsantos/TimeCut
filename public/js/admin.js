document.addEventListener('DOMContentLoaded', function() {

  if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = '/login';
    return;
  }

  if (!document.getElementById('categoriesTable')) return;
  // Inicializar componentes
  initDatePickers();
  // Carregar dados iniciais
  loadCategories();
  loadServices();
  loadEmployees();
  loadAppointments();
  loadUsers();
  setupEventListeners();
  
  // Adicionar listener para tabs
  document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
    tab.addEventListener('shown.bs.tab', function() {
      const target = this.getAttribute('data-bs-target');
      if (target === '#categories') loadCategories();
      if (target === '#services') loadServices();
      if (target === '#employees') loadEmployees();
      if (target === '#appointments') loadAppointments();
      if (target === '#users') loadUsers();
    });
  });
});

let currentEmployeeId = null;
let allServices = [];
let employeeServices = [];
let workSchedules = [];




function logout() {
  localStorage.removeItem('isLoggedIn');
  window.location.href = '/login';
}

// Função para atualizar data e hora
function atualizarDataHora() {
  const now = new Date();
  
  // Formatar data (dd/mm/aaaa)
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  document.getElementById('dataAtual').textContent = `${day}/${month}/${year}`;
  
  // Formatar hora (hh:mm:ss)
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('tempoAtual').textContent = `${hours}:${minutes}:${seconds}`;
}

// Atualizar imediatamente e depois a cada segundo
atualizarDataHora();
setInterval(atualizarDataHora, 1000);

// Modifique todas as chamadas fetch para incluir a verificação
async function loadCategories() {
  if (!await checkAuth()) return;
  
  try {
    const response = await fetch('/api/admin/categories', {
      credentials: 'include'
    });
    // ... resto do código
  } catch (error) {
    console.error('Erro:', error);
  }
}

// Funções auxiliares
function formatDate(dateString) {
  try {
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return dateString;
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'confirmed': return 'bg-primary';
    case 'canceled': return 'bg-danger';
    case 'completed': return 'bg-success';
    default: return 'bg-secondary';
  }
}

function getStatusText(status) {
  switch (status) {
    case 'confirmed': return 'Confirmado';
    case 'canceled': return 'Cancelado';
    case 'completed': return 'Concluído';
    default: return status;
  }
}

function showToast(message, type = 'success') {
  try {
    const toastElement = document.getElementById('liveToast');
    if (!toastElement) return;

    const toastBody = toastElement.querySelector('.toast-body');
    if (toastBody) toastBody.textContent = message;
    
    toastElement.classList.remove('bg-success', 'bg-danger', 'bg-warning');
    toastElement.classList.add(
      type === 'success' ? 'bg-success' : 
      type === 'error' ? 'bg-danger' : 'bg-warning'
    );

    const toast = new bootstrap.Toast(toastElement);
    toast.show();
  } catch (error) {
    console.error('Erro ao exibir toast:', error);
  }
}

function initDatePickers() {
  try {
    const dateFilter = document.getElementById('appointmentDateFilter');
    if (dateFilter && window.flatpickr) {
      dateFilter.flatpickr({
        dateFormat: 'Y-m-d',
        allowInput: true,
        locale: 'pt'
      });
    }
  } catch (error) {
    console.error('Erro ao inicializar datepickers:', error);
  }
}

function showConfirmationModal(type, id) {
  try {
    const modalElement = document.getElementById('confirmationModal');
    if (!modalElement) throw new Error('Elemento do modal não encontrado');
    
    const modal = new bootstrap.Modal(modalElement);
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('confirmAction');
    
    if (!modalTitle || !modalBody || !confirmBtn) {
      throw new Error('Elementos do modal não encontrados');
    }

    let message = '';
    switch (type) {
      case 'category':
        message = 'Tem certeza que deseja excluir esta categoria? Todos os serviços associados serão removidos.';
        break;
      case 'service':
        message = 'Tem certeza que deseja excluir este serviço? Todos os agendamentos associados serão removidos.';
        break;
      case 'employee':
        message = 'Tem certeza que deseja excluir este funcionário? Todos os agendamentos e associações serão removidos.';
        break;
      case 'appointment':
        message = 'Tem certeza que deseja cancelar este agendamento?';
        break;
      default:
        message = 'Tem certeza que deseja executar esta ação?';
    }
    
    modalTitle.textContent = `Confirmar ${type === 'appointment' ? 'Cancelamento' : 'Exclusão'}`;
    modalBody.textContent = message;
    
    confirmBtn.onclick = async function() {
      try {
        let endpoint = '';
        let method = 'DELETE';
        
        switch (type) {
          case 'category': endpoint = `/api/admin/categories/${id}`; break;
          case 'service': endpoint = `/api/admin/services/${id}`; break;
          case 'employee': endpoint = `/api/admin/employees/${id}`; break;
          case 'appointment': 
            endpoint = `/api/admin/appointments/${id}/cancel`;
            method = 'PUT';
            break;
        }
        
        const response = await fetch(endpoint, { 
          method, 
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          } 
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        switch (type) {
          case 'category': 
            await loadCategories();
            await loadServices();
            break;
          case 'service': 
            await loadServices();
            await loadAppointments();
            break;
          case 'employee': 
            await loadEmployees();
            await loadAppointments();
            break;
          case 'appointment': 
            await loadAppointments();
            break;
        }

        showToast(result.message || 'Operação realizada com sucesso!', 'success');
        modal.hide();
      } catch (error) {
        console.error('Erro na ação de confirmação:', error);
        showToast(`Erro: ${error.message}`, 'error');
        modal.hide();
      }
    };

    modal.show();
  } catch (error) {
    console.error('Erro ao mostrar modal de confirmação:', error);
    showToast(`Erro: ${error.message}`, 'error');
  }
}

// Carregar dados
async function loadCategories() {
  try {
    const response = await fetch('/api/admin/categories');
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const data = await response.json();
    const tableBody = document.getElementById('categoriesTable');
    if (!tableBody) throw new Error('Tabela de categorias não encontrada');
    
    tableBody.innerHTML = '';
    
    data.forEach(category => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${category.id}</td>
        <td>${category.name}</td>
        <td>
          <button class="btn btn-sm btn-primary edit-category" data-id="${category.id}">Editar</button>
          <button class="btn btn-sm btn-danger delete-category" data-id="${category.id}">Excluir</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    const categorySelect = document.getElementById('serviceCategory');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="" selected disabled>Selecione uma categoria</option>';
      data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
    showToast(`Erro ao carregar categorias: ${error.message}`, 'error');
  }
}

async function loadServices() {
  try {
    const response = await fetch('/api/admin/services');
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const data = await response.json();
    const tableBody = document.getElementById('servicesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    data.forEach(service => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${service.id}</td>
        <td>${service.name}</td>
        <td>${service.categories?.name || 'N/A'}</td>
        <td>${service.duration} min</td>
        <td>R$ ${service.price?.toFixed(2) || '0,00'}</td>
        <td>
          <button class="btn btn-sm btn-primary edit-service" data-id="${service.id}">Editar</button>
          <button class="btn btn-sm btn-danger delete-service" data-id="${service.id}">Excluir</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
    showToast(`Erro ao carregar serviços: ${error.message}`, 'error');
  }
}



async function loadEmployees() {
  try {
    const response = await fetch('/api/admin/employees');
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const data = await response.json();
    const tableBody = document.getElementById('employeesTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    data.forEach(employee => {
      // Formatando os horários para exibição
      const schedulesText = employee.work_schedules && employee.work_schedules.length > 0
        ? employee.work_schedules.map(s => 
            `${getDayName(s.day_of_week)}: ${s.start_time.slice(0, 2)}:${s.start_time.slice(2)}-${s.end_time.slice(0, 2)}:${s.end_time.slice(2)}`
          ).join('<br>')
        : 'Sem horários definidos';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${employee.name}</td>
        <td>${employee.email}</td>
        <td>${employee.phone || ''}</td>
        <td>${employee.comissao || '0'}%</td>
        <td>
          <span class="badge ${employee.is_active ? 'bg-success' : 'bg-secondary'}">
            ${employee.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>${schedulesText}</td>
        <td>
          <button class="btn btn-sm btn-primary edit-employee" data-id="${employee.id}">
            <i class="bi bi-pencil"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger delete-employee" data-id="${employee.id}">
            <i class="bi bi-trash"></i> Excluir
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Erro ao carregar funcionários:', error);
    showToast(`Erro ao carregar funcionários: ${error.message}`, 'error');
  }
}

// Função auxiliar para obter nome do dia
function getDayName(dayNumber) {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return days[dayNumber] || 'Dia';
}

// Função para carregar todos os agendamentos com filtros
// Função para formatar a data para YYYY-MM-DD
function formatDateForAPI(dateString) {
  if (!dateString) return null;
  
  // Converte de DD-MM-YYYY para YYYY-MM-DD
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString; // Retorna no formato original se não puder converter
}

async function loadAppointments(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.date) {
      // Converte de YYYY-MM-DD (input) para DD-MM-YYYY (banco)
      const [year, month, day] = filters.date.split('-');
      queryParams.append('date', `${day}-${month}-${year}`);
    }
    if (filters.employee) queryParams.append('employee', filters.employee);

    const response = await fetch(`/api/admin/appointments?${queryParams.toString()}`);
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const data = await response.json();
    renderAppointmentsTable(data);
  } catch (error) {
    console.error('Erro ao carregar agendamentos:', error);
    showToast('Erro ao carregar agendamentos. Tente novamente.', 'error');
  }
}

// Função para renderizar a tabela
function renderAppointmentsTable(appointments) {
  const tableBody = document.getElementById('appointmentsTable');
  if (!tableBody) throw new Error('Tabela de agendamentos não encontrada');
  
  tableBody.innerHTML = '';
  
  appointments.forEach(appointment => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${appointment.id}</td>
      <td>${appointment.client_name}</td>
      <td>${appointment.services?.name || 'N/A'}</td>
      <td>${appointment.employees?.name || 'N/A'}</td>
      <td>${formatDate(appointment.appointment_date)}</td>
      <td>${appointment.start_time} - ${appointment.end_time}</td>
      <td>
        <span class="badge ${getStatusBadgeClass(appointment.status)}">
          ${getStatusText(appointment.status)}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-danger cancel-appointment" 
                data-id="${appointment.id}"
                ${appointment.status !== 'confirmed' ? 'disabled' : ''}>
          Cancelar
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// Função para formatar a URL do Google Calendar
function createGoogleCalendarUrl(appointment) {
  // Converter data de YYYY-MM-DD para YYYYMMDD
  const formattedDate = appointment.date.replace(/-/g, '');
  
  // Converter horários (HH:MM:SS para HHMM) e ajustar fuso horário (+3 horas)
  const adjustTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    let adjustedHours = parseInt(hours) + 3;
    if (adjustedHours >= 24) adjustedHours -= 24;
    return `${String(adjustedHours).padStart(2, '0')}${minutes}`;
  };

  const startTime = adjustTime(appointment.start_time);
  const endTime = adjustTime(appointment.end_time);

  // Criar parâmetros para a URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Agendamento: ${appointment.service}`,
    details: `Cliente: ${appointment.client_name}\nServiço: ${appointment.service}\nProfissional: ${appointment.professional}\nValor: R$ ${appointment.price.toFixed(2)}`,
    location: 'Salão de Beleza', // Altere conforme necessário
    dates: `${formattedDate}T${startTime}00Z/${formattedDate}T${endTime}00Z`
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Adicione esta função para marcar como concluído
async function completeAppointment(appointmentId) {
  try {
    const response = await fetch(`/api/admin/appointments/${appointmentId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Erro ao marcar como concluído');

    const data = await response.json();
    showToast('Agendamento marcado como concluído!', 'success');
    
    // Recarregar a lista de agendamentos
    loadAppointments();
    
    return data;
  } catch (error) {
    console.error('Erro ao concluir agendamento:', error);
    showToast('Erro ao concluir agendamento', 'error');
    throw error;
  }
}

// Atualize a função renderAppointmentsTable para incluir o botão de conclusão
function renderAppointmentsTable(appointments) {
  const tableBody = document.getElementById('appointmentsTable');
  if (!tableBody) throw new Error('Tabela de agendamentos não encontrada');
  
  tableBody.innerHTML = '';
  
  appointments.forEach(appointment => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${appointment.id}</td>
      <td>${appointment.client_name}</td>
      <td>${appointment.services?.name || 'N/A'}</td>
      <td>${appointment.employees?.name || 'N/A'}</td>
      <td>${formatDate(appointment.appointment_date)}</td>
      <td>${appointment.start_time} - ${appointment.end_time}</td>
      <td>
        <span class="badge ${getStatusBadgeClass(appointment.status)}">
          ${getStatusText(appointment.status)}
        </span>
      </td>
      <td class="d-flex gap-1">
        <button class="btn btn-sm btn-success complete-appointment ${appointment.status === 'completed' ? 'd-none' : ''}" 
                data-id="${appointment.id}"
                title="Marcar como concluído">
          <i class="bi bi-check-lg"></i>
        </button>
        <button class="btn btn-sm btn-primary add-to-calendar" 
                data-id="${appointment.id}"
                title="Adicionar ao calendário">
          <i class="bi bi-calendar-plus"></i>
        </button>
        <button class="btn btn-sm btn-danger cancel-appointment ${appointment.status !== 'confirmed' ? 'd-none' : ''}" 
                data-id="${appointment.id}"
                title="Cancelar agendamento">
          <i class="bi bi-x-lg"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // Event listeners para os botões de conclusão
  document.querySelectorAll('.complete-appointment').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const appointmentId = btn.getAttribute('data-id');
      
      // Confirmação antes de marcar como concluído
      if (confirm('Deseja realmente marcar este agendamento como concluído?')) {
        await completeAppointment(appointmentId);
      }
    });
  });

  // ... (mantenha os outros event listeners existentes)
}

  // Adicionar event listeners para os botões de calendário
  document.querySelectorAll('.add-to-calendar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const appointmentId = btn.getAttribute('data-id');
      try {
        const response = await fetch(`/api/admin/appointments/${appointmentId}`);
        if (!response.ok) throw new Error('Erro ao buscar agendamento');
        
        const appointment = await response.json();
        const calendarUrl = createGoogleCalendarUrl(appointment);
        
        // Abrir o Google Calendar em nova aba
        window.open(calendarUrl, '_blank');
      } catch (error) {
        console.error('Erro ao adicionar ao calendário:', error);
        showToast('Erro ao abrir calendário', 'error');
      }
    });
  });


// Função para limpar filtros
function clearFilters() {
  document.getElementById('appointmentSearch').value = '';
  document.getElementById('appointmentDateFilter').value = '';
  document.getElementById('employeeSearch').value = '';
  loadAppointments();
}

// Event listeners quando o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
  // Carregar todos os agendamentos inicialmente
  loadAppointments();

  // Pesquisa geral
  document.getElementById('searchAppointments')?.addEventListener('click', () => {
    const searchTerm = document.getElementById('appointmentSearch').value.trim();
    loadAppointments({ search: searchTerm });
  });

  // Filtro por data
// No seu arquivo JavaScript (index.js ou similar)
document.getElementById('filterByDateBtn')?.addEventListener('click', () => {
    const dateInput = document.getElementById('appointmentDateFilter').value;
    
    if (!dateInput) {
      showToast('Selecione uma data válida', 'warning');
      return;
    }
    
    loadAppointments({ date: dateInput });
  });

  // Filtro por funcionário
document.getElementById('filterByEmployee')?.addEventListener('click', () => {
  const employeeName = document.getElementById('employeeSearch').value.trim();
  if (!employeeName) {
    showToast('Por favor, digite um nome de funcionário', 'warning');
    return;
  }
  
  loadAppointments({ employee: employeeName });
});

  // Limpar filtros
  document.getElementById('clearFilters')?.addEventListener('click', clearFilters);

  // Permitir pressionar Enter nos campos de pesquisa
  [document.getElementById('appointmentSearch'), 
   document.getElementById('employeeSearch')].forEach(input => {
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const searchTerm = e.target.value.trim();
        const filterType = e.target.id === 'appointmentSearch' ? 'search' : 'employee';
        loadAppointments({ [filterType]: searchTerm });
      }
    });
  });
});

// Configurar listeners de eventos
function setupEventListeners() {
  // Formulário de Categorias
  const categoryForm = document.getElementById('categoryForm');
  if (categoryForm) {
    categoryForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      try {
        await handleCategorySubmit(e);
      } catch (error) {
        console.error('Erro no submit da categoria:', error);
        showToast(`Erro: ${error.message}`, 'error');
      }
    });
    
    const cancelCategoryBtn = document.getElementById('cancelCategoryEdit');
    if (cancelCategoryBtn) cancelCategoryBtn.addEventListener('click', cancelCategoryEdit);
  }

  // Formulário de Serviços
  const serviceForm = document.getElementById('serviceForm');
  if (serviceForm) {
    serviceForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      try {
        await handleServiceSubmit(e);
      } catch (error) {
        console.error('Erro no submit do serviço:', error);
        showToast(`Erro: ${error.message}`, 'error');
      }
    });
    
    const cancelServiceBtn = document.getElementById('cancelServiceEdit');
    if (cancelServiceBtn) cancelServiceBtn.addEventListener('click', cancelServiceEdit);
  }

  // Formulário de Funcionários
  const employeeForm = document.getElementById('employeeForm');
  if (employeeForm) {
    employeeForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      try {
        await handleEmployeeSubmit(e);
      } catch (error) {
        console.error('Erro no submit do funcionário:', error);
        showToast(`Erro: ${error.message}`, 'error');
      }
    });
    
    const cancelEmployeeBtn = document.getElementById('cancelEmployeeEdit');
    if (cancelEmployeeBtn) cancelEmployeeBtn.addEventListener('click', cancelEmployeeEdit);
  }

  // Pesquisa e Filtros
  const searchBtn = document.getElementById('searchAppointments');
  if (searchBtn) {
    searchBtn.addEventListener('click', async function() {
      try {
        await searchAppointments();
      } catch (error) {
        console.error('Erro na pesquisa:', error);
        showToast(`Erro: ${error.message}`, 'error');
      }
    });
  }
  
  const filterBtn = document.getElementById('filterByDate');
  if (filterBtn) {
    filterBtn.addEventListener('click', async function() {
      try {
        await filterAppointmentsByDate();
      } catch (error) {
        console.error('Erro no filtro:', error);
        showToast(`Erro: ${error.message}`, 'error');
      }
    });
  }

  // Delegation para botões dinâmicos
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-category')) {
      editCategory(e.target.dataset.id).catch(error => {
        console.error('Erro ao editar categoria:', error);
        showToast(`Erro: ${error.message}`, 'error');
      });
    }
    if (e.target.classList.contains('edit-service')) {
      editService(e.target.dataset.id).catch(error => {
        console.error('Erro ao editar serviço:', error);
        showToast(`Erro: ${error.message}`, 'error');
      });
    }
    if (e.target.classList.contains('edit-employee')) {
      editEmployee(e.target.dataset.id).catch(error => {
        console.error('Erro ao editar funcionário:', error);
        showToast(`Erro: ${error.message}`, 'error');
      });
    }
    if (e.target.classList.contains('delete-category') || 
        e.target.classList.contains('delete-service') || 
        e.target.classList.contains('delete-employee') || 
        e.target.classList.contains('cancel-appointment')) {
      const type = e.target.classList.contains('delete-category') ? 'category' :
                  e.target.classList.contains('delete-service') ? 'service' :
                  e.target.classList.contains('delete-employee') ? 'employee' : 'appointment';
      showConfirmationModal(type, e.target.dataset.id);
    }
  });
}


// Funções para manipulação de categorias
async function handleCategorySubmit(e) {
  try {
    e.preventDefault();
    
    const name = document.getElementById('categoryName')?.value.trim();
    if (!name) throw new Error('O nome da categoria é obrigatório');
    
    const categoryId = document.getElementById('categoryId')?.value;
    const method = categoryId ? 'PUT' : 'POST';
    const endpoint = categoryId ? `/api/admin/categories/${categoryId}` : '/api/admin/categories';
    
    const formData = new FormData();
    formData.append('name', name);
    
    const imageInput = document.getElementById('categoryImage');
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }
    
    const response = await fetch(endpoint, {
      method: method,
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryImagePreview').innerHTML = '';
    
    await loadCategories();
    showToast(result.message || 'Categoria salva com sucesso!', 'success');
  } catch (error) {
    console.error('Erro no submit da categoria:', error);
    showToast(error.message, 'error');
  }
}

async function editCategory(id) {
  try {
    if (!id) throw new Error('ID da categoria não fornecido');
    
    const response = await fetch(`/api/admin/categories/${id}`);
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const category = await response.json();
    
    const idField = document.getElementById('categoryId');
    const nameField = document.getElementById('categoryName');
    const previewDiv = document.getElementById('categoryImagePreview');
    
    if (!idField || !nameField) throw new Error('Elementos do formulário não encontrados');
    
    idField.value = category.id;
    nameField.value = category.name;
    
    if (category.imagem_category) {
      previewDiv.innerHTML = `<img src="${category.imagem_category}" class="img-thumbnail" style="max-height: 150px;">`;
    }
    
    const form = document.getElementById('categoryForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Erro ao editar categoria:', error);
    throw error;
  }
}

function cancelCategoryEdit() {
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryImagePreview').innerHTML = '';
}

// Funções para manipulação de serviços
async function handleServiceSubmit(e) {
  try {
    e.preventDefault();
    
    const categoryId = document.getElementById('serviceCategory')?.value;
    const name = document.getElementById('serviceName')?.value.trim();
    const description = document.getElementById('serviceDescription')?.value.trim();
    const duration = parseInt(document.getElementById('serviceDuration')?.value);
    const price = parseFloat(document.getElementById('servicePrice')?.value) || null;
    
    if (!categoryId) throw new Error('Selecione uma categoria');
    if (!name) throw new Error('O nome do serviço é obrigatório');
    if (!duration || duration <= 0) throw new Error('A duração deve ser um número positivo');
    
    const serviceId = document.getElementById('serviceId')?.value;
    const method = serviceId ? 'PUT' : 'POST';
    const endpoint = serviceId ? `/api/admin/services/${serviceId}` : '/api/admin/services';
    
    const formData = new FormData();
    formData.append('category_id', categoryId);
    formData.append('name', name);
    formData.append('description', description);
    formData.append('duration', duration);
    if (price) formData.append('price', price);
    
    const imageInput = document.getElementById('serviceImage');
    if (imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }
    
    const response = await fetch(endpoint, {
      method: method,
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceId').value = '';
    document.getElementById('serviceImagePreview').innerHTML = '';
    
    await loadServices();
    showToast(result.message || 'Serviço salvo com sucesso!', 'success');
  } catch (error) {
    console.error('Erro no submit do serviço:', error);
    showToast(error.message, 'error');
  }
}

async function editService(id) {
  try {
    if (!id) throw new Error('ID do serviço não fornecido');
    
    const response = await fetch(`/api/admin/services/${id}`);
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const service = await response.json();
    
    const idField = document.getElementById('serviceId');
    const categoryField = document.getElementById('serviceCategory');
    const nameField = document.getElementById('serviceName');
    const descField = document.getElementById('serviceDescription');
    const durationField = document.getElementById('serviceDuration');
    const priceField = document.getElementById('servicePrice');
    const previewDiv = document.getElementById('serviceImagePreview');
    
    if (!idField || !categoryField || !nameField || !descField || !durationField || !priceField) {
      throw new Error('Elementos do formulário não encontrados');
    }
    
    idField.value = service.id;
    categoryField.value = service.category_id;
    nameField.value = service.name;
    descField.value = service.description || '';
    durationField.value = service.duration;
    priceField.value = service.price || '';
    
    if (service.imagem_service) {
      previewDiv.innerHTML = `<img src="${service.imagem_service}" class="img-thumbnail" style="max-height: 150px;">`;
    }
    
    const form = document.getElementById('serviceForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Erro ao editar serviço:', error);
    throw error;
  }
}

function cancelServiceEdit() {
  document.getElementById('serviceForm').reset();
  document.getElementById('serviceId').value = '';
  document.getElementById('serviceImagePreview').innerHTML = '';
}

// Função para visualizar imagem antes de upload
function setupImagePreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  input.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        preview.innerHTML = `<img src="${e.target.result}" class="img-thumbnail" style="max-height: 150px;">`;
      }
      
      reader.readAsDataURL(this.files[0]);
    } else {
      preview.innerHTML = '';
    }
  });
}

// Chamar para ambos os formulários
setupImagePreview('categoryImage', 'categoryImagePreview');
setupImagePreview('serviceImage', 'serviceImagePreview');

// Atualize a função handleEmployeeSubmit para salvar os horários
async function handleEmployeeSubmit(e) {
  e.preventDefault();
  
  try {
    // Coletar dados básicos do funcionário
    const employeeData = {
      name: document.getElementById('employeeName').value.trim(),
      email: document.getElementById('employeeEmail').value.trim(),
      phone: document.getElementById('employeePhone').value.trim() || null,
      comissao: document.getElementById('employeeComissao').value.trim() || null,
      is_active: document.getElementById('employeeStatus').checked
    };
    
    // Coletar horários
    const schedules = collectSchedulesFromForm();
    
    if (schedules.length === 0) {
      throw new Error('Adicione pelo menos um horário de trabalho');
    }

    const hasInvalidSchedules = schedules.some(s => 
      isNaN(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6
    );

    if (hasInvalidSchedules) {
      throw new Error('Selecione um dia da semana válido para todos os horários');
    }
    
    // Verificar se todos os horários têm dia selecionado
    if (schedules.some(s => isNaN(s.day_of_week))) {
      throw new Error('Selecione o dia da semana para todos os horários');
    }
    
    // 1. Salvar/Atualizar funcionário
    const employeeId = document.getElementById('employeeId').value;
    let response;
    
    if (employeeId) {
      response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });
    } else {
      response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });
    }
    
    if (!response.ok) throw new Error('Erro ao salvar funcionário');
    
    const employee = await response.json();
    const savedEmployeeId = employeeId || employee.id;
    
    // 2. Salvar horários
    const schedulesResponse = await fetch(`/schedules/${savedEmployeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedules)
    });
    
    if (!schedulesResponse.ok) throw new Error('Erro ao salvar horários');
    
    showToast('Funcionário e horários salvos com sucesso!', 'success');
    loadEmployees();
    cancelEmployeeEdit();
    
  } catch (error) {
    console.error('Erro ao salvar funcionário:', error);
    showToast(error.message, 'error');
  }
}

// Adicione evento ao botão de adicionar horário
document.getElementById('addScheduleBtn').addEventListener('click', () => {
  addNewSchedule();
});

// Função para cancelar edição
function cancelEmployeeEdit() {
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('workSchedulesContainer').innerHTML = '';
  
  const submitBtn = document.querySelector('#employeeForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Salvar';
  
  currentEmployeeId = null;
}

// Adicionar evento ao botão de gerenciar serviços
document.getElementById('manageServicesBtn').addEventListener('click', openManageServicesModal);

// Função para abrir o modal de serviços
async function openManageServicesModal() {
  if (!currentEmployeeId) return;
  
  const modal = new bootstrap.Modal(document.getElementById('manageServicesModal'));
  modal.show();
  
  try {
    // Carregar todos os serviços
    const servicesResponse = await fetch('/api/services');
    if (!servicesResponse.ok) throw new Error('Erro ao carregar serviços');
    allServices = await servicesResponse.json();
    
    // Carregar serviços do funcionário
    const employeeServicesResponse = await fetch(`/api/employee-services/${currentEmployeeId}`);
    if (!employeeServicesResponse.ok) throw new Error('Erro ao carregar serviços do funcionário');
    employeeServices = await employeeServicesResponse.json();
    
    renderServicesList();
    
    // Configurar busca
    document.getElementById('serviceSearch').addEventListener('input', renderServicesList);
    
    // Configurar botão de salvar
    document.getElementById('saveServicesBtn').onclick = saveEmployeeServices;
    
  } catch (error) {
    console.error('Erro ao abrir modal de serviços:', error);
    showToast('Erro ao carregar serviços', 'error');
  }
}

// Função para renderizar a lista de serviços
function renderServicesList() {
  const searchTerm = document.getElementById('serviceSearch').value.toLowerCase();
  const servicesList = document.getElementById('servicesList');
  
  // Filtrar serviços
  const filteredServices = allServices.filter(service => 
    service.name.toLowerCase().includes(searchTerm) ||
    service.description.toLowerCase().includes(searchTerm)
  );
  
  // Gerar HTML
  servicesList.innerHTML = filteredServices.length > 0 ? '' : 
    '<div class="text-center py-3">Nenhum serviço encontrado</div>';
  
  filteredServices.forEach(service => {
    const isAssigned = employeeServices.some(s => s.service_id === service.id);
    
    const serviceItem = document.createElement('div');
    serviceItem.className = 'list-group-item service-item';
    serviceItem.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h6 class="mb-1">${service.name}</h6>
          <small class="text-muted">${service.description || 'Sem descrição'}</small>
        </div>
        <div class="service-actions">
          <button class="btn btn-sm ${isAssigned ? 'btn-outline-danger' : 'btn-outline-success'} btn-action" 
                  data-service-id="${service.id}">
            <i class="bi ${isAssigned ? 'bi-x-lg' : 'bi-check-lg'}"></i>
          </button>
        </div>
      </div>
    `;
    
    servicesList.appendChild(serviceItem);
  });
  
  // Adicionar eventos aos botões
  document.querySelectorAll('.service-actions button').forEach(btn => {
    btn.addEventListener('click', function() {
      const serviceId = parseInt(this.dataset.serviceId);
      toggleServiceAssignment(serviceId);
    });
  });
}

// Função para alternar atribuição de serviço
function toggleServiceAssignment(serviceId) {
  const index = employeeServices.findIndex(s => s.service_id === serviceId);
  
  if (index >= 0) {
    // Remover serviço
    employeeServices.splice(index, 1);
  } else {
    // Adicionar serviço
    employeeServices.push({
      employee_id: currentEmployeeId,
      service_id: serviceId
    });
  }
  
  renderServicesList();
}

// Função para salvar os serviços do funcionário
async function saveEmployeeServices() {
  try {
    const response = await fetch(`/api/employee-services/${currentEmployeeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(employeeServices)
    });
    
    if (!response.ok) throw new Error('Erro ao salvar serviços');
    
    showToast('Serviços atualizados com sucesso!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('manageServicesModal')).hide();
    
  } catch (error) {
    console.error('Erro ao salvar serviços:', error);
    showToast('Erro ao salvar serviços', 'error');
  }
}

// Adicionar evento ao botão de gerenciar horários
document.getElementById('manageSchedulesBtn').addEventListener('click', openManageSchedulesModal);

// Função para abrir o modal de horários
async function openManageSchedulesModal() {
  if (!currentEmployeeId) return;
  
  const modal = new bootstrap.Modal(document.getElementById('manageSchedulesModal'));
  modal.show();
  
  try {
    // Carregar horários do funcionário
    const response = await fetch(`/schedules/${currentEmployeeId}`);
    if (!response.ok) throw new Error('Erro ao carregar horários');
    
    workSchedules = await response.json();
    renderSchedulesList();
    
    // Configurar botão de adicionar
    document.getElementById('addScheduleBtnModal').onclick = addNewSchedule;
    
    // Configurar botão de salvar
    document.getElementById('saveSchedulesBtn').onclick = saveWorkSchedules;
    
  } catch (error) {
    console.error('Erro ao abrir modal de horários:', error);
    showToast('Erro ao carregar horários', 'error');
  }
}

// Função para renderizar a lista de horários
function renderSchedulesList() {
  const container = document.getElementById('schedulesListContainer');
  container.innerHTML = workSchedules.length > 0 ? '' : 
    '<div class="alert alert-info">Nenhum horário cadastrado</div>';
  
  workSchedules.forEach((schedule, index) => {
    const template = document.getElementById('scheduleItemTemplate').cloneNode(true);
    const scheduleItem = template.querySelector('.schedule-item');
    scheduleItem.dataset.id = schedule.id || `new-${index}`;
    
    // Preencher dados
    scheduleItem.querySelector('.day-select').value = schedule.day_of_week || 0;
    scheduleItem.querySelector('.start-time').value = formatTimeForInput(schedule.start_time);
    scheduleItem.querySelector('.end-time').value = formatTimeForInput(schedule.end_time);
    
    // Adicionar evento de remoção
    scheduleItem.querySelector('.remove-schedule').addEventListener('click', () => {
      removeSchedule(scheduleItem.dataset.id);
    });
    
    container.appendChild(scheduleItem);
  });
}

// Função para adicionar novo horário
function addNewSchedule(schedule = {}) {
  const container = document.getElementById('workSchedulesContainer');
  const template = document.getElementById('scheduleItemTemplate').cloneNode(true);
  const scheduleItem = template.querySelector('.schedule-item');
  
  // Definir ID único para o item
  const scheduleId = schedule.id || `new-${Date.now()}`;
  scheduleItem.dataset.id = scheduleId;
  
  // Preencher dados se for edição
  if (schedule.day_of_week !== undefined) {
    scheduleItem.querySelector('.day-select').value = schedule.day_of_week;
  } else {
    // Deixar sem valor selecionado por padrão
    scheduleItem.querySelector('.day-select').value = '';
  }
  
  if (schedule.start_time) {
    scheduleItem.querySelector('.start-time').value = formatTimeForInput(schedule.start_time);
  }
  if (schedule.end_time) {
    scheduleItem.querySelector('.end-time').value = formatTimeForInput(schedule.end_time);
  }
  
  // Adicionar evento de remoção
  scheduleItem.querySelector('.remove-schedule').addEventListener('click', () => {
    scheduleItem.remove();
  });
  
  container.appendChild(scheduleItem);
}

// Função para formatar hora para input type="time"
function formatTimeForInput(timeStr) {
  if (!timeStr) return '08:00';
  
  // Se já estiver no formato HH:MM
  if (typeof timeStr === 'string' && timeStr.includes(':')) {
    return timeStr.length === 5 ? timeStr : `${timeStr.substr(0, 2)}:${timeStr.substr(3, 2)}`;
  }
  
  // Se for um número (como 800 para 08:00)
  if (typeof timeStr === 'number') {
    const timeStrPadded = String(timeStr).padStart(4, '0');
    return `${timeStrPadded.substr(0, 2)}:${timeStrPadded.substr(2, 2)}`;
  }
  
  return '08:00';
}

// Função para carregar horários ao editar funcionário
async function loadEmployeeSchedules(employeeId) {
  try {
    const response = await fetch(`/schedules/${employeeId}`);
    if (!response.ok) throw new Error('Erro ao carregar horários');
    
    const schedules = await response.json();
    const container = document.getElementById('workSchedulesContainer');
    container.innerHTML = '';
    
    if (schedules.length > 0) {
      schedules.forEach(schedule => {
        addNewSchedule(schedule);
      });
    } else {
      addNewSchedule(); // Adiciona um horário vazio por padrão
    }
    
  } catch (error) {
    console.error('Erro ao carregar horários:', error);
    showToast('Erro ao carregar horários do funcionário', 'error');
  }
}

// Função para salvar os horários
async function saveWorkSchedules() {
  try {
    // Preparar dados para envio
    const schedulesToSave = workSchedules.map(schedule => ({
      id: schedule.id && !schedule.id.startsWith('new-') ? schedule.id : undefined,
      employee_id: currentEmployeeId,
      day_of_week: parseInt(schedule.day_of_week) || 0,
      start_time: document.querySelector(`.schedule-item[data-id="${schedule.id}"] .start-time`).value.replace(':', ''),
      end_time: document.querySelector(`.schedule-item[data-id="${schedule.id}"] .end-time`).value.replace(':', '')
    })).filter(s => s.start_time && s.end_time); // Filtrar horários válidos

    const response = await fetch(`/schedules/${currentEmployeeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schedulesToSave)
    });
    
    if (!response.ok) throw new Error('Erro ao salvar horários');
    
    showToast('Horários atualizados com sucesso!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('manageSchedulesModal')).hide();
    
    // Atualizar a lista de funcionários
    await loadEmployees();
    
  } catch (error) {
    console.error('Erro ao salvar horários:', error);
    showToast('Erro ao salvar horários', 'error');
  }
}

function collectSchedulesFromForm() {
  const schedules = [];
  const scheduleElements = document.querySelectorAll('.schedule-item');
  
  scheduleElements.forEach(element => {
    const daySelect = element.querySelector('.day-select');
    const startTimeInput = element.querySelector('.start-time');
    const endTimeInput = element.querySelector('.end-time');
    
    // Verificar se todos os campos existem e se um dia foi selecionado
    if (daySelect && startTimeInput && endTimeInput && daySelect.value !== '') {
      schedules.push({
        id: element.dataset.id.startsWith('new-') ? undefined : element.dataset.id,
        day_of_week: parseInt(daySelect.value),
        start_time: startTimeInput.value.replace(':', ''),
        end_time: endTimeInput.value.replace(':', '')
      });
    }
  });
  
  return schedules;
}

// Atualize a função editEmployee para mostrar o botão de gerenciar serviços
async function editEmployee(id) {
  try {
    if (!id) throw new Error('ID do funcionário não fornecido');
    currentEmployeeId = id;
    
    const response = await fetch(`/api/admin/employees/${id}`);
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const employee = await response.json();
    
    // Preencher dados básicos
    document.getElementById('employeeId').value = employee.id;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeeEmail').value = employee.email;
    document.getElementById('employeePhone').value = employee.phone || '';
    document.getElementById('employeeComissao').value = employee.comissao || '';
    document.getElementById('employeeStatus').checked = employee.is_active !== false;
    
    // Mostrar ambos os botões de gerenciamento
    document.getElementById('manageServicesBtn').style.display = 'block';
    document.getElementById('manageSchedulesBtn').style.display = 'block';
    
    // Carregar horários do funcionário
    await loadEmployeeSchedules(id);
    
    // Mudar o texto do botão para "Atualizar"
    const submitBtn = document.querySelector('#employeeForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Atualizar';
    
    // Rolar até o formulário
    document.getElementById('employeeForm').scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Erro ao editar funcionário:', error);
    showToast('Erro ao carregar dados do funcionário', 'error');
  }
}

// Atualize a função cancelEmployeeEdit para esconder os botões
function cancelEmployeeEdit() {
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('workSchedulesContainer').innerHTML = '';
  
  // Esconder ambos os botões
  document.getElementById('manageServicesBtn').style.display = 'none';
  document.getElementById('manageSchedulesBtn').style.display = 'none';
  
  const submitBtn = document.querySelector('#employeeForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Salvar';
  
  currentEmployeeId = null;
}

// Theme Toggle Functionality
// Theme and User Profile Functions
document.addEventListener('DOMContentLoaded', function() {
  // Theme initialization
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);

  // Load user data when settings tab is shown
  document.querySelector('a[data-bs-target="#settings"]').addEventListener('shown.bs.tab', function() {
    loadUserData();
  });

  // Theme toggle button
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // User profile form submission
  const userProfileForm = document.getElementById('userProfileForm');
  if (userProfileForm) {
    userProfileForm.addEventListener('submit', function(e) {
      e.preventDefault();
      updateUserProfile();
    });
  }
});

// Theme functions
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = theme === 'dark' 
      ? '<i class="bi bi-sun-fill"></i> Alternar para Modo Claro' 
      : '<i class="bi bi-moon-fill"></i> Alternar para Modo Escuro';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

// Theme functions (unchanged)
document.addEventListener('DOMContentLoaded', function() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);

  document.querySelector('a[data-bs-target="#settings"]').addEventListener('shown.bs.tab', loadUserData);
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  document.getElementById('userProfileForm')?.addEventListener('submit', handleProfileUpdate);
});

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = theme === 'dark' 
      ? '<i class="bi bi-sun-fill"></i> Alternar para Modo Claro' 
      : '<i class="bi bi-moon-fill"></i> Alternar para Modo Escuro';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Helper function to show toast notifications
function showToast(type, message) {
  console.log(`${type.toUpperCase()}: ${message}`);
  // In a real app, you would implement a proper toast notification system
  // Example: bootstrap.Toast or similar
}

// Visibilidade da senha:

document.addEventListener('click', function (e) {
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
