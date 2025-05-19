// Variáveis globais
let currentEmployeeId = null;
let employeeToDelete = null;

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  loadEmployees();
  setupEventListeners();
});

function setupEventListeners() {
  // Formulário de funcionário
  document.getElementById('employeeForm').addEventListener('submit', handleEmployeeSubmit);
  document.getElementById('cancelEmployeeEdit').addEventListener('click', cancelEmployeeEdit);
  
  // Botão para adicionar novo dia de trabalho
  document.getElementById('addScheduleBtn').addEventListener('click', addNewScheduleDay);
  
  // Modal de confirmação de exclusão
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDeleteEmployee);
}

// Carregar lista de funcionários
async function loadEmployees() {
  try {
    showLoading(true); // Mostrar indicador de carregamento
    
    const response = await fetch('/api/admin/employees');
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    const employees = await response.json();
    console.log('Dados recebidos:', employees); // Debug
    
    if (!Array.isArray(employees)) {
      throw new Error('Dados recebidos não são um array');
    }
    
    renderEmployeesTable(employees);
  } catch (error) {
    console.error('Erro ao carregar funcionários:', error);
    showToast('Erro ao carregar funcionários', 'error');
  } finally {
    showLoading(false); // Esconder indicador de carregamento
  }
}

function renderEmployeesTable(employees) {
  const tableBody = document.getElementById('employeesTable');
  if (!tableBody) {
    console.error('Elemento employeesTable não encontrado');
    return;
  }
  
  tableBody.innerHTML = '';
  
  if (!employees || employees.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">Nenhum funcionário cadastrado</td>
      </tr>
    `;
    return;
  }
  
  employees.forEach(employee => {
    const row = document.createElement('tr');
    
    // Status badge
    const statusBadge = employee.is_active !== false ? 
      '<span class="badge bg-success status-badge">Ativo</span>' : 
      '<span class="badge bg-secondary status-badge">Inativo</span>';
    
    // Horários formatados
    let schedulesHtml = '';
    if (employee.work_schedules && Array.isArray(employee.work_schedules) && employee.work_schedules.length > 0) {
      // Agrupar por dia para evitar duplicatas
      const uniqueDays = [...new Set(employee.work_schedules.map(s => s.day))];
      
      uniqueDays.forEach(day => {
        const daySchedules = employee.work_schedules.filter(s => s.day === day);
        const times = daySchedules.map(s => 
          `${formatTime(s.start_time)}-${formatTime(s.end_time)}`
        ).join(', ');
        
        schedulesHtml += `
          <div class="badge bg-light text-dark schedule-badge d-block mb-1">
            ${day || 'Dia não definido'}: ${times}
          </div>
        `;
      });
    } else {
      schedulesHtml = '<span class="text-muted">Nenhum horário definido</span>';
    }
    
    row.innerHTML = `
      <td>${employee.name || '-'}</td>
      <td>${employee.email || '-'}</td>
      <td>${employee.phone || '-'}</td>
      <td>${employee.comissao || '-'}</td>
      <td>${statusBadge}</td>
      <td>${schedulesHtml}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-2" onclick="editEmployee('${employee.id}')">
          <i class="bi bi-pencil"></i> Editar
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="showDeleteModal('${employee.id}')">
          <i class="bi bi-trash"></i> Excluir
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
}

// Adicionar novo dia de trabalho ao formulário
function addNewScheduleDay(day = '', startTime = '08:00', endTime = '17:00') {
  const container = document.getElementById('workSchedulesContainer');
  const scheduleId = Date.now();
  
  const dayOptions = [
    'Segunda-feira', 
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo'
  ];
  
  const scheduleHtml = `
    <div class="schedule-day" id="schedule-${scheduleId}">
      <span class="remove-schedule" onclick="removeScheduleDay('${scheduleId}')">
        <i class="bi bi-x-circle"></i>
      </span>
      <div class="row">
        <div class="col-md-4 mb-3">
          <label class="form-label">Dia da semana</label>
          <select class="form-select schedule-day-select">
            <option value="">Selecione um dia</option>
            ${dayOptions.map(d => 
              `<option value="${d}" ${d === day ? 'selected' : ''}>${d}</option>`
            ).join('')}
          </select>
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Horário de entrada</label>
          <input type="time" class="form-control schedule-start-time" value="${startTime}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Horário de saída</label>
          <input type="time" class="form-control schedule-end-time" value="${endTime}">
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', scheduleHtml);

}

// Remover dia de trabalho do formulário
function removeScheduleDay(scheduleId) {
  const element = document.getElementById(`schedule-${scheduleId}`);
  if (element) element.remove();
}

// Editar funcionário
async function editEmployee(id) {
  try {
    if (!id) throw new Error('ID do funcionário não fornecido');
    
    const container = document.getElementById('workSchedulesContainer');
    container.innerHTML = '<div class="text-center py-3">Carregando...</div>';
    
    const [employeeResponse, schedulesResponse] = await Promise.all([
      fetch(`/api/admin/employees/${id}`),
      fetch(`/schedules/${id}`)
    ]);
    
    if (!employeeResponse.ok || !schedulesResponse.ok) {
      throw new Error('Erro ao carregar dados do funcionário');
    }
    
    const employee = await employeeResponse.json();
    const schedules = await schedulesResponse.json();
    
    // Preencher dados básicos
    document.getElementById('employeeId').value = employee.id;
    document.getElementById('employeeName').value = employee.name;
    document.getElementById('employeeEmail').value = employee.email || '';
    document.getElementById('employeePhone').value = employee.phone || '';
    document.getElementById('employeeComissao').value = employee.comissao || '';
    document.getElementById('employeeStatus').checked = employee.is_active !== false;
    
    // Adicionar horários ao formulário
    container.innerHTML = '';
    
    if (schedules.length > 0) {
      schedules.forEach(schedule => {
        const startTime = formatTimeForInput(schedule.start_time);
        const endTime = formatTimeForInput(schedule.end_time);
        
        // Verifica se o dia existe antes de adicionar
        if (schedule.day && schedule.day !== 'Dia inválido') {
          addNewScheduleDay(schedule.day, startTime, endTime);
        } else {
          console.error('Dia inválido encontrado:', schedule);
        }
      });
    } else {
      addNewScheduleDay(); // Adiciona um dia vazio por padrão
    }
    
    // Atualizar botão de submit
    const submitBtn = document.querySelector('#employeeForm button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Atualizar';
    
    document.getElementById('employeeForm').scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Erro ao editar funcionário:', error);
    showToast('Erro ao carregar dados do funcionário', 'error');
    document.getElementById('workSchedulesContainer').innerHTML = '';
    addNewScheduleDay();
  }
}

// Adicione estas funções no início do seu arquivo horarioFuncionario.js

// Função para formatar horário para exibição
function formatTime(timeString) {
  if (!timeString) return '--:--';
  
  // Se já estiver no formato HH:MM
  if (typeof timeString === 'string' && timeString.includes(':')) {
    return timeString;
  }
  
  // Se for um número (como 100000 para 10:00:00)
  if (typeof timeString === 'number') {
    const timeStr = String(timeString).padStart(6, '0');
    return `${timeStr.substr(0, 2)}:${timeStr.substr(2, 2)}`;
  }
  
  return timeString;
}

// Função para formatar horário para input type="time"
function formatTimeForInput(timeString) {
  if (!timeString) return '08:00';
  
  // Se já estiver no formato HH:MM
  if (typeof timeString === 'string' && timeString.includes(':')) {
    return timeString;
  }
  
  // Se for um número (como 100000 para 10:00:00)
  if (typeof timeString === 'number') {
    const timeStr = String(timeString).padStart(6, '0');
    return `${timeStr.substr(0, 2)}:${timeStr.substr(2, 2)}`;
  }
  
  return '08:00'; // Valor padrão
}

// Mostrar/ocultar loading
function showLoading(show) {
  const loadingElement = document.getElementById('loadingIndicator');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

// Função para mostrar mensagens toast
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toastContainer');
  if (toastContainer) {
    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type}`;
    toast.role = 'alert';
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;
    toastContainer.appendChild(toast);
    
    // Remover após 5 segundos
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
}


// Cancelar edição
function cancelEmployeeEdit() {
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('workSchedulesContainer').innerHTML = '';
  
  const submitBtn = document.querySelector('#employeeForm button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Salvar';
}

// Mostrar modal de confirmação de exclusão
function showDeleteModal(id) {
  employeeToDelete = id;
  const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
  modal.show();
}

// Confirmar exclusão de funcionário
async function confirmDeleteEmployee() {
  if (!employeeToDelete) return;
  
  try {
    const response = await fetch(`/api/admin/employees/${employeeToDelete}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error(`Erro HTTP! status: ${response.status}`);
    
    showToast('Funcionário excluído com sucesso', 'success');
    loadEmployees();
    
    // Fechar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
    modal.hide();
    employeeToDelete = null;
    
  } catch (error) {
    console.error('Erro ao excluir funcionário:', error);
    showToast('Erro ao excluir funcionário', 'error');
  }
}

// Manipular envio do formulário
async function handleEmployeeSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('employeeId').value;
  const name = document.getElementById('employeeName').value.trim();
  const email = document.getElementById('employeeEmail').value.trim();
  const phone = document.getElementById('employeePhone').value.trim() || null;
  const comissao = document.getElementById('employeeComissao').value.trim() || null;
  const isActive = document.getElementById('employeeStatus').checked;
  
  if (!name || !email) {
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }
  
  // Coletar horários
  const schedules = [];
  const scheduleElements = document.querySelectorAll('.schedule-day');
  
    scheduleElements.forEach(element => {
      const daySelect = element.querySelector('.schedule-day-select');
      const startTimeInput = element.querySelector('.schedule-start-time');
      const endTimeInput = element.querySelector('.schedule-end-time');
    
    if (daySelect && startTimeInput && endTimeInput && daySelect.value){
      // Garantir formato HH:MM
      const startTime = startTimeInput.value.includes(':') ? startTimeInput.value : 
                       `${startTimeInput.value.substr(0, 2)}:${startTimeInput.value.substr(2, 2)}`;
      const endTime = endTimeInput.value.includes(':') ? endTimeInput.value : 
                     `${endTimeInput.value.substr(0, 2)}:${endTimeInput.value.substr(2, 2)}`;
      
      schedules.push({
        day: daySelect.value,
        start_time: startTime,
        end_time: endTime,
        is_available: true
      });
    }
  });
  
  if (schedules.length === 0) {
    showToast('Adicione pelo menos um dia de trabalho', 'error');
    return;
  }
  
  try {
    showLoading(true);
    let response;
    const employeeData = { name, email, phone, comissao , is_active: isActive };
    
    // 1. Salvar/Atualizar funcionário
    if (id) {
      response = await fetch(`/api/admin/employees/${id}`, {
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
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
    }
    
    const employee = await response.json();
    const employeeId = id || employee.id;
    
    // 2. Para edição, primeiro deletar os horários existentes
    if (id) {
      const deleteResponse = await fetch(`/schedules/employees/${employeeId}`, { 
        method: 'DELETE' 
      });
      if (!deleteResponse.ok) {
        console.error('Falha ao remover horários antigos:', await deleteResponse.text());
      }
    }
    
    /// 3. Adicionar novos horários
    for (const schedule of schedules) {
      try {
        const scheduleData = {
          day_of_week: convertDayNameToNumber(schedule.day), // Converter para número
          start_time: formatTimeToHHMMSS(schedule.start_time),
          end_time: formatTimeToHHMMSS(schedule.end_time),
          is_available: true,
          employee_id: employeeId
        };
        
        const response = await fetch('/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro ${response.status}`);
        }
        
        await response.json();
      } catch (error) {
        console.error(`Falha ao salvar horário para ${schedule.day}:`, error);
        throw new Error(`Falha ao salvar horário: ${error.message}`);
      }
    }

    showToast('Horários salvos com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao salvar funcionário:', error);
    showToast(error.message, 'error');
  } finally {
    showLoading(false);
  }
}

// Funções auxiliares no cliente
function convertDayNameToNumber(dayName) {
  // Mapeamento completo e case insensitive
  const daysMap = {
    'segunda-feira': 0,
    'terça-feira': 1,
    'quarta-feira': 2,
    'quinta-feira': 3,
    'sexta-feira': 4,
    'sábado': 5,
    'domingo': 6,
    // Adicione variações de escrita se necessário
    'segunda': 0,
    'terca': 1,
    'terca-feira': 1,
    'quarta': 2,
    'quinta': 3,
    'sexta': 4,
    'sabado': 5
  };

  // Normaliza o nome do dia (remove acentos, espaços extras, etc.)
  const normalizedDay = dayName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();

  const dayNumber = daysMap[normalizedDay];
  
  if (dayNumber === undefined) {
    console.error(`Dia não reconhecido: "${dayName}" (normalizado: "${normalizedDay}")`);
    throw new Error(`Dia da semana "${dayName}" não é válido`);
  }
  
  return dayNumber;
}

function formatTimeToHHMMSS(time) {
  // Implementação similar à do servidor
  if (typeof time === 'string' && time.includes(':')) {
    return time.length === 5 ? `${time}:00` : time;
  }
  
  if (typeof time === 'number') {
    const timeStr = String(time).padStart(4, '0');
    return `${timeStr.substr(0, 2)}:${timeStr.substr(2, 2)}:00`;
  }
  
  return '09:00:00';
}

// Função para verificar formato de horário
// Dentro do loop for (const schedule of schedules)
const isValidTime = (time) => {
  if (typeof time === 'number' && time >= 0 && time <= 2359) return true;
  if (typeof time === 'string' && time.match(/^\d{1,2}:\d{2}$/)) return true;
  return false;
};

if (!isValidTime(schedule.start_time) || !isValidTime(schedule.end_time)) {
  throw new Error(`Horário inválido para ${schedule.day}. Use HH:MM ou número (ex: 800)`);
}

// Função para formatar horário para exibição
function formatTimeForDisplay(time) {
  if (!time) return '--:--';
  if (typeof time === 'string' && isValidTime(time)) return time;
  if (typeof time === 'number') {
    const timeStr = String(time).padStart(4, '0');
    return `${timeStr.substr(0, 2)}:${timeStr.substr(2, 2)}`;
  }
  return '--:--';
}

// Nova função para formatar horário para envio ao servidor
function formatTimeForSubmission(timeString) {
  if (!timeString) return '08:00';
  
  // Remover possíveis caracteres não numéricos
  const cleanTime = timeString.replace(/\D/g, '');
  
  // Garantir que temos pelo menos 4 dígitos (HHMM)
  const paddedTime = cleanTime.padStart(4, '0');
  
  // Formatar como número (ex: "08:00" → 800)
  return parseInt(paddedTime, 10);
}